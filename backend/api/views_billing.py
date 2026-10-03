import uuid
import logging
from decimal import Decimal
from datetime import timedelta
from django.utils import timezone
from django.db import transaction
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny

from api.models import (
    Organization,
    OrganizationQuota,
    SubscriptionPlan,
    OrganizationSubscription,
    BillingInvoice,
)
from api.guards.quota_guard import get_or_create_default_plan, get_user_quota
from api.services.abacatepay_service import abacatepay_client

logger = logging.getLogger(__name__)


def get_or_create_user_org(user) -> Organization:
    """
    Retorna a organizacao principal do usuario ou cria um workspace padrao.
    """
    org = user.organizations.first() or user.owned_organizations.first()
    if not org:
        org, _ = Organization.objects.get_or_create(
            name=f"Workspace de {user.username}",
            owner=user,
        )
        user.organizations.add(org)
    return org


def get_or_create_org_subscription(org: Organization) -> OrganizationSubscription:
    """
    Retorna a assinatura da organizacao ou cria com o plano gratuito padrao.
    """
    free_plan = get_or_create_default_plan("free")
    subscription, created = OrganizationSubscription.objects.get_or_create(
        organization=org,
        defaults={
            "plan": free_plan,
            "status": "active",
            "billing_interval": "monthly",
            "payment_method_type": "none",
            "payment_method_details": {},
            "current_period_start": timezone.now(),
            "current_period_end": timezone.now() + timedelta(days=365),
            "cancel_at_period_end": False,
        }
    )
    if not subscription.plan:
        subscription.plan = free_plan
        subscription.save()

    # Se a assinatura possuia cancelamento agendado e o periodo terminou, rebaixa para gratuito
    if (
        subscription.cancel_at_period_end
        and subscription.current_period_end
        and subscription.current_period_end <= timezone.now()
    ):
        subscription.plan = free_plan
        subscription.status = "canceled"
        subscription.cancel_at_period_end = False
        subscription.save()
        quota = getattr(org, 'quota', None)
        if quota:
            quota.plan = free_plan
            quota.save()

    return subscription


def activate_subscription_from_paid_checkout(
    org: Organization,
    checkout_data: dict,
    event_id: str = None,
) -> BillingInvoice:
    """
    Ativa ou atualiza o plano da organizacao de forma atomica e idempotente
    a partir de um checkout com pagamento confirmado no AbacatePay.
    """
    billing_id = checkout_data.get("id")
    metadata = checkout_data.get("metadata") or {}
    tier = metadata.get("tier", "pro")
    interval = metadata.get("interval", "monthly")

    target_plan = get_or_create_default_plan(tier)
    subscription = get_or_create_org_subscription(org)
    quota = getattr(org, 'quota', None)

    amount_cents = checkout_data.get("paidAmount") or checkout_data.get("amount") or 0
    amount_brl = (
        Decimal(str(amount_cents)) / Decimal("100.00")
        if amount_cents
        else target_plan.price_annual_brl * 12 if interval == "annual" else target_plan.price_monthly_brl
    )

    methods = checkout_data.get("methods") or []
    payment_method = checkout_data.get("paymentMethod") or (methods[0] if methods else "PIX")
    method_type = "pix" if "PIX" in str(payment_method).upper() else "credit_card"

    now = timezone.now()
    days_ahead = 365 if interval == "annual" else 30

    quota, _ = OrganizationQuota.objects.get_or_create(
        organization=org,
        defaults={
            "plan": target_plan,
            "tokens_used_this_month": 0,
            "is_active": True,
        }
    )

    with transaction.atomic():
        subscription.plan = target_plan
        subscription.status = "active"
        subscription.billing_interval = interval
        subscription.payment_method_type = method_type
        subscription.payment_method_details = {
            "method": str(payment_method),
            "gateway": "abacatepay",
            "status": "confirmed",
        }
        subscription.abacatepay_billing_id = billing_id
        if event_id:
            subscription.last_webhook_event_id = event_id
        subscription.current_period_start = now
        subscription.current_period_end = now + timedelta(days=days_ahead)
        subscription.cancel_at_period_end = False
        subscription.save()

        quota.plan = target_plan
        quota.tokens_used_this_month = 0
        quota.is_active = True
        quota.save()

        existing_invoice = BillingInvoice.objects.filter(external_transaction_id=billing_id).first()
        if existing_invoice:
            existing_invoice.status = "paid"
            existing_invoice.plan = target_plan
            existing_invoice.amount_brl = amount_brl
            existing_invoice.paid_at = now
            existing_invoice.save()
            return existing_invoice

        receipt_code = f"CAT-{now.strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        invoice_url = checkout_data.get("receiptUrl") or checkout_data.get("url")

        invoice = BillingInvoice.objects.create(
            organization=org,
            plan=target_plan,
            amount_brl=amount_brl,
            billing_interval=interval,
            status="paid",
            payment_method_type=method_type,
            payment_method_summary=f"AbacatePay {payment_method}",
            receipt_code=receipt_code,
            gateway_provider="abacatepay",
            external_transaction_id=billing_id,
            invoice_url=invoice_url,
            paid_at=now,
        )
        return invoice


class StudioBillingPlansView(APIView):
    """
    Lista todos os planos disponiveis no Catana Studio.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        for tier in ["free", "pro", "enterprise"]:
            get_or_create_default_plan(tier)

        plans = SubscriptionPlan.objects.filter(tier__in=["free", "pro", "enterprise"]).order_by("price_monthly_brl")
        data = []
        for p in plans:
            data.append({
                "id": p.id,
                "tier": p.tier,
                "name": p.name,
                "description": p.description,
                "price_monthly_brl": float(p.price_monthly_brl),
                "price_annual_brl": float(p.price_annual_brl),
                "is_popular": p.is_popular,
                "monthly_token_quota": p.monthly_token_quota,
                "max_active_catalogs": p.max_active_catalogs,
                "rate_limit_rpm": p.rate_limit_rpm,
                "can_use_council": p.can_use_council,
                "can_export_pdf": p.can_export_pdf,
                "features": p.features or [],
            })
        return Response({"plans": data})


class StudioSubscriptionView(APIView):
    """
    Retorna os detalhes da assinatura ativa, metodo de pagamento e faturas da organizacao.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        org = get_or_create_user_org(user)
        subscription = get_or_create_org_subscription(org)

        # Reconciliacao proativa caso webhook nao tenha chegado ao localhost
        if subscription.plan and subscription.plan.tier == "free" and subscription.abacatepay_billing_id:
            try:
                checkout = abacatepay_client.get_checkout_status(subscription.abacatepay_billing_id)
                if not checkout or checkout.get("status") != "PAID":
                    checkout = abacatepay_client.find_paid_checkout_for_org(org.id, user.id)
                if checkout and checkout.get("status") == "PAID":
                    activate_subscription_from_paid_checkout(org, checkout)
                    subscription.refresh_from_db()
            except Exception as exc:
                logger.warning(f"[StudioSubscriptionView] Falha na reconciliacao automatica: {str(exc)}")

        quota, active_plan = get_user_quota(user)

        invoices = BillingInvoice.objects.filter(organization=org).order_by("-created_at")[:10]
        invoices_data = []
        for inv in invoices:
            invoices_data.append({
                "id": inv.id,
                "receipt_code": inv.receipt_code,
                "plan_name": inv.plan.name if inv.plan else "Assinatura",
                "amount_brl": float(inv.amount_brl),
                "billing_interval": inv.billing_interval,
                "status": inv.status,
                "payment_method_type": inv.payment_method_type,
                "payment_method_summary": inv.payment_method_summary,
                "gateway_provider": inv.gateway_provider,
                "invoice_url": inv.invoice_url,
                "paid_at": inv.paid_at.isoformat() if inv.paid_at else None,
            })

        return Response({
            "status": subscription.status,
            "billing_interval": subscription.billing_interval,
            "tier": active_plan.tier,
            "plan_name": active_plan.name,
            "current_period_start": subscription.current_period_start.isoformat() if subscription.current_period_start else None,
            "current_period_end": subscription.current_period_end.isoformat() if subscription.current_period_end else None,
            "cancel_at_period_end": subscription.cancel_at_period_end,
            "payment_method_type": subscription.payment_method_type,
            "payment_method_details": subscription.payment_method_details,
            "abacatepay_billing_id": subscription.abacatepay_billing_id,
            "invoices": invoices_data,
        })


class StudioCheckoutView(APIView):
    """
    Inicia o fluxo de checkout seguro via AbacatePay ou downgrade para plano gratuito.
    Retorna a URL de pagamento do gateway ou atualizacao direta para plano free.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        org = get_or_create_user_org(user)
        target_tier = request.data.get("tier", "").strip().lower()
        billing_interval = request.data.get("interval", "monthly").strip().lower()

        if target_tier not in ["free", "pro", "enterprise"]:
            return Response(
                {"error": "Plano invalido. Escolha entre free, pro ou enterprise."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if billing_interval not in ["monthly", "annual"]:
            billing_interval = "monthly"

        target_plan = get_or_create_default_plan(target_tier)
        subscription = get_or_create_org_subscription(org)
        quota, _ = get_user_quota(user)

        # 1. Downgrade para plano gratuito (nao requer cobranca no gateway)
        if target_tier == "free":
            with transaction.atomic():
                subscription.plan = target_plan
                subscription.status = "active"
                subscription.billing_interval = "monthly"
                subscription.payment_method_type = "none"
                subscription.payment_method_details = {}
                subscription.save()

                if quota:
                    quota.plan = target_plan
                    quota.is_active = True
                    quota.save()

            return Response({
                "success": True,
                "is_free": True,
                "message": "Plano Gratuito ativado com sucesso.",
                "tier": "free",
                "plan_name": target_plan.name,
                "billing_interval": "monthly",
            })

        # 2. Se informados dados diretos de cartao para ativacao direta / testes
        payment_details = request.data.get("payment_details")
        if payment_details and payment_details.get("last4"):
            with transaction.atomic():
                last4 = payment_details.get("last4", "4242")[-4:]
                brand = payment_details.get("brand", "mastercard").lower()
                holder_name = payment_details.get("holder_name", user.get_full_name() or user.username)
                payment_summary = f"{brand.capitalize()} final {last4}"

                now = timezone.now()
                days_ahead = 365 if billing_interval == "annual" else 30
                subscription.plan = target_plan
                subscription.status = "active"
                subscription.billing_interval = billing_interval
                subscription.payment_method_type = "credit_card"
                subscription.payment_method_details = {
                    "last4": last4,
                    "brand": brand,
                    "holder_name": holder_name,
                }
                subscription.current_period_start = now
                subscription.current_period_end = now + timedelta(days=days_ahead)
                subscription.cancel_at_period_end = False
                subscription.save()

                if quota:
                    quota.plan = target_plan
                    quota.tokens_used_this_month = 0
                    quota.is_active = True
                    quota.save()

                amount = (
                    target_plan.price_annual_brl * 12
                    if billing_interval == "annual"
                    else target_plan.price_monthly_brl
                )
                receipt_code = f"CAT-{now.strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
                BillingInvoice.objects.create(
                    organization=org,
                    plan=target_plan,
                    amount_brl=amount,
                    billing_interval=billing_interval,
                    status="paid",
                    payment_method_type="credit_card",
                    payment_method_summary=payment_summary,
                    receipt_code=receipt_code,
                    paid_at=now,
                )

            return Response({
                "success": True,
                "message": f"Assinatura do {target_plan.name} ativada com sucesso.",
                "tier": target_plan.tier,
                "plan_name": target_plan.name,
                "billing_interval": billing_interval,
                "receipt_code": receipt_code,
                "amount_brl": float(amount),
                "current_period_end": subscription.current_period_end.isoformat(),
            })

        # 3. Criar sessao de checkout no AbacatePay
        checkout_data = abacatepay_client.create_billing_checkout(
            user=user,
            org=org,
            plan=target_plan,
            interval=billing_interval,
        )

        billing_id = checkout_data.get("id")
        checkout_url = checkout_data.get("checkout_url")

        # Salvar o billing_id pendente na assinatura
        if billing_id:
            subscription.abacatepay_billing_id = billing_id
            subscription.save(update_fields=["abacatepay_billing_id"])

        amount_brl = (
            float(target_plan.price_annual_brl * 12)
            if billing_interval == "annual"
            else float(target_plan.price_monthly_brl)
        )

        return Response({
            "success": True,
            "checkout_url": checkout_url,
            "billing_id": billing_id,
            "tier": target_tier,
            "plan_name": target_plan.name,
            "billing_interval": billing_interval,
            "amount_brl": amount_brl,
            "is_sandbox": checkout_data.get("is_mock", False),
            "message": f"Checkout do {target_plan.name} gerado com sucesso.",
        })


class StudioBillingSandboxConfirmView(APIView):
    """
    Confirma imediatamente o pagamento em ambiente de desenvolvimento / sandbox
    para validar a transicao visual e funcional sem depender do webhook externo.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        org = get_or_create_user_org(user)
        target_tier = request.data.get("tier", "pro").strip().lower()
        billing_interval = request.data.get("interval", "monthly").strip().lower()
        billing_id = request.data.get("billing_id", f"bill_mock_{uuid.uuid4().hex[:10]}")

        if target_tier not in ["pro", "enterprise"]:
            target_tier = "pro"

        target_plan = get_or_create_default_plan(target_tier)
        subscription = get_or_create_org_subscription(org)
        quota, _ = get_user_quota(user)

        amount = (
            target_plan.price_annual_brl * 12
            if billing_interval == "annual"
            else target_plan.price_monthly_brl
        )

        now = timezone.now()
        days_ahead = 365 if billing_interval == "annual" else 30

        with transaction.atomic():
            subscription.plan = target_plan
            subscription.status = "active"
            subscription.billing_interval = billing_interval
            subscription.payment_method_type = "pix"
            subscription.payment_method_details = {
                "method": "PIX",
                "gateway": "abacatepay",
                "status": "confirmed",
            }
            subscription.abacatepay_billing_id = billing_id
            subscription.current_period_start = now
            subscription.current_period_end = now + timedelta(days=days_ahead)
            subscription.cancel_at_period_end = False
            subscription.save()

            if quota:
                quota.plan = target_plan
                quota.tokens_used_this_month = 0
                quota.is_active = True
                quota.save()

            receipt_code = f"CAT-{now.strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
            BillingInvoice.objects.create(
                organization=org,
                plan=target_plan,
                amount_brl=amount,
                billing_interval=billing_interval,
                status="paid",
                payment_method_type="pix",
                payment_method_summary="AbacatePay PIX",
                receipt_code=receipt_code,
                gateway_provider="abacatepay",
                external_transaction_id=billing_id,
                paid_at=now,
            )

        return Response({
            "success": True,
            "message": f"Assinatura do {target_plan.name} ativada com sucesso!",
            "tier": target_plan.tier,
            "plan_name": target_plan.name,
            "billing_interval": billing_interval,
            "receipt_code": receipt_code,
            "amount_brl": float(amount),
            "current_period_end": subscription.current_period_end.isoformat(),
        })


class AbacatePayWebhookView(APIView):
    """
    Webhook do AbacatePay.
    Processa confirmacoes de pagamento de forma transacional e idempotente.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        signature = request.headers.get("X-AbacatePay-Signature") or request.headers.get("X-Signature")
        secret_param = request.query_params.get("secret")
        payload_bytes = request.body

        if not abacatepay_client.verify_webhook_signature(signature, payload_bytes=payload_bytes, secret_param=secret_param):
            logger.warning("[AbacatePay-Webhook] Rejeitado: Assinatura invalida ou webhook nao configurado.")
            return Response({"error": "Assinatura invalida ou webhook nao configurado."}, status=status.HTTP_403_FORBIDDEN)

        payload = request.data or {}
        event_id = payload.get("eventId") or payload.get("id") or str(uuid.uuid4())
        event_type = payload.get("event") or payload.get("type", "billing.paid")
        data = payload.get("data", {})
        billing_id = data.get("id")

        logger.info(f"[AbacatePay-Webhook] Evento recebido: {event_type} - {event_id} - billing {billing_id}")

        # Garantia de idempotencia: verifica se o evento ja foi processado
        if event_id and OrganizationSubscription.objects.filter(last_webhook_event_id=event_id).exists():
            logger.info(f"[AbacatePay-Webhook] Evento duplicado ignorado: {event_id}")
            return Response({"status": "ignored_already_processed"}, status=status.HTTP_200_OK)

        if billing_id and BillingInvoice.objects.filter(external_transaction_id=billing_id).exists():
            logger.info(f"[AbacatePay-Webhook] Cobranca ja faturada: {billing_id}")
            return Response({"status": "ignored_already_invoiced"}, status=status.HTTP_200_OK)

        # Tratar confirmacao de pagamento
        if event_type in ["billing.paid", "payment.confirmed", "charge.paid"] or data.get("status") == "PAID":
            metadata = data.get("metadata", {})
            org_id = metadata.get("org_id")

            org = None
            if org_id:
                org = Organization.objects.filter(id=org_id).first()
            elif billing_id:
                sub = OrganizationSubscription.objects.filter(abacatepay_billing_id=billing_id).first()
                if sub:
                    org = sub.organization

            if not org:
                logger.error(f"[AbacatePay-Webhook] Nenhuma organizacao localizada para o evento {event_id}")
                return Response({"error": "Organizacao nao encontrada."}, status=status.HTTP_404_NOT_FOUND)

            invoice = activate_subscription_from_paid_checkout(org, data, event_id=event_id)
            logger.info(f"[AbacatePay-Webhook] Plano atribuido a org {org.name} com sucesso (Fatura: {invoice.receipt_code}).")
            return Response({"status": "success", "processed": True}, status=status.HTTP_200_OK)

        # Cancelamento ou expiracao de cobranca
        elif event_type in ["subscription.canceled", "billing.expired"]:
            if billing_id:
                OrganizationSubscription.objects.filter(abacatepay_billing_id=billing_id).update(
                    status="canceled",
                    last_webhook_event_id=event_id,
                )
            return Response({"status": "subscription_canceled"}, status=status.HTTP_200_OK)

        return Response({"status": "event_unhandled"}, status=status.HTTP_200_OK)


class StudioBillingSyncView(APIView):
    """
    Sincroniza imediatamente o status da cobranca com o gateway AbacatePay.
    Permite ativacao instantanea no retorno do checkout ou na abertura do modal,
    eliminando a dependencia exclusiva de webhooks externos em desenvolvimento local.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        org = get_or_create_user_org(user)
        subscription = get_or_create_org_subscription(org)

        billing_id = request.data.get("billing_id") or subscription.abacatepay_billing_id

        checkout_data = None
        if billing_id:
            checkout_data = abacatepay_client.get_checkout_status(billing_id)

        if not checkout_data or checkout_data.get("status") != "PAID":
            found_paid = abacatepay_client.find_paid_checkout_for_org(org.id, user.id)
            if found_paid:
                checkout_data = found_paid

        if checkout_data and checkout_data.get("status") == "PAID":
            invoice = activate_subscription_from_paid_checkout(org, checkout_data)
            subscription.refresh_from_db()
            quota, active_plan = get_user_quota(user)

            return Response({
                "synced": True,
                "status": "paid",
                "tier": active_plan.tier,
                "plan_name": active_plan.name,
                "billing_interval": subscription.billing_interval,
                "receipt_code": invoice.receipt_code,
                "amount_brl": float(invoice.amount_brl),
                "monthly_token_quota": active_plan.monthly_token_quota,
                "message": f"Pagamento confirmado! Plano {active_plan.name} ativado com sucesso.",
            })

        return Response({
            "synced": False,
            "status": subscription.status,
            "tier": subscription.plan.tier if subscription.plan else "free",
            "plan_name": subscription.plan.name if subscription.plan else "Plano Gratuito",
            "message": "Nenhum pagamento pendente confirmado no momento.",
        })


class StudioCancelSubscriptionView(APIView):
    """
    Cancela a renovacao automatica da assinatura ao final do ciclo ou realiza downgrade imediato.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        org = get_or_create_user_org(user)
        subscription = get_or_create_org_subscription(org)

        if not subscription.plan or subscription.plan.tier == "free":
            return Response(
                {"error": "O plano gratuito nao possui cobranca ativa para cancelar."},
                status=status.HTTP_400_BAD_REQUEST
            )

        immediate = bool(request.data.get("immediate", False))

        if immediate:
            free_plan = get_or_create_default_plan("free")
            with transaction.atomic():
                subscription.plan = free_plan
                subscription.status = "canceled"
                subscription.cancel_at_period_end = False
                subscription.save()

                quota = getattr(org, 'quota', None)
                if quota:
                    quota.plan = free_plan
                    quota.save()

            return Response({
                "success": True,
                "immediate": True,
                "cancel_at_period_end": False,
                "status": "canceled",
                "tier": "free",
                "plan_name": free_plan.name,
                "message": "Assinatura cancelada imediatamente. Sua conta retornou ao Plano Gratuito.",
            })

        # Cancelamento agendado para o final do ciclo (padrao SaaS)
        subscription.cancel_at_period_end = True
        subscription.save()

        period_end_formatted = (
            subscription.current_period_end.strftime("%d/%m/%Y")
            if subscription.current_period_end
            else "o final do ciclo"
        )

        return Response({
            "success": True,
            "immediate": False,
            "cancel_at_period_end": True,
            "status": subscription.status,
            "tier": subscription.plan.tier,
            "plan_name": subscription.plan.name,
            "current_period_end": subscription.current_period_end.isoformat() if subscription.current_period_end else None,
            "message": f"Renovacao automatica cancelada. Seu acesso aos recursos do {subscription.plan.name} continuara ativo ate {period_end_formatted}.",
        })


class StudioReactivateSubscriptionView(APIView):
    """
    Reativa a renovacao automatica de uma assinatura com cancelamento agendado.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        org = get_or_create_user_org(user)
        subscription = get_or_create_org_subscription(org)

        if not subscription.plan or subscription.plan.tier == "free":
            return Response(
                {"error": "O plano gratuito nao possui renovacao para reativar."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not subscription.cancel_at_period_end:
            return Response({
                "success": True,
                "cancel_at_period_end": False,
                "message": "A renovacao automatica ja se encontra ativa.",
            })

        subscription.cancel_at_period_end = False
        subscription.save()

        period_end_formatted = (
            subscription.current_period_end.strftime("%d/%m/%Y")
            if subscription.current_period_end
            else "o final do ciclo"
        )

        return Response({
            "success": True,
            "cancel_at_period_end": False,
            "status": subscription.status,
            "tier": subscription.plan.tier,
            "plan_name": subscription.plan.name,
            "current_period_end": subscription.current_period_end.isoformat() if subscription.current_period_end else None,
            "message": f"Renovacao automatica reativada com sucesso! Seu plano sera renovado em {period_end_formatted}.",
        })

