import uuid
from decimal import Decimal
from datetime import timedelta
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from api.models import (
    Organization,
    OrganizationQuota,
    SubscriptionPlan,
    OrganizationSubscription,
    BillingInvoice,
)
from api.guards.quota_guard import get_or_create_default_plan, get_user_quota


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
    return subscription


class StudioBillingPlansView(APIView):
    """
    Lista todos os planos disponiveis no Catana Studio (Cenario A).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Garante que os 3 planos padrao existam
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
        quota, active_plan = get_user_quota(user)

        # Buscar historico de faturas
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
            "invoices": invoices_data,
        })


class StudioCheckoutView(APIView):
    """
    Processa contratacao ou upgrade de plano no Catana Studio.
    Atualiza OrganizationSubscription, OrganizationQuota e gera uma fatura paga.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        org = get_or_create_user_org(user)
        target_tier = request.data.get("tier", "").strip().lower()
        billing_interval = request.data.get("interval", "monthly").strip().lower()
        payment_method_type = request.data.get("payment_method_type", "credit_card").strip().lower()
        payment_details = request.data.get("payment_details", {})

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

        # Calcular valor cobrado
        if target_tier == "free":
            amount = Decimal("0.00")
            payment_summary = "Gratuito"
            payment_method_type = "none"
            payment_details = {}
        else:
            if billing_interval == "annual":
                # Cobranca anual (12 meses do valor anual com desconto)
                amount = target_plan.price_annual_brl * 12
            else:
                amount = target_plan.price_monthly_brl

            if payment_method_type == "pix":
                payment_summary = "PIX Instantaneo"
                payment_details = {
                    "pix_key_type": "random",
                    "status": "confirmed",
                }
            else:
                payment_method_type = "credit_card"
                last4 = payment_details.get("last4", "4242")[-4:]
                brand = payment_details.get("brand", "mastercard").lower()
                holder_name = payment_details.get("holder_name", user.get_full_name() or user.username)
                payment_details = {
                    "last4": last4,
                    "brand": brand,
                    "holder_name": holder_name,
                }
                payment_summary = f"{brand.capitalize()} final {last4}"

        # Atualizar assinatura
        now = timezone.now()
        days_ahead = 365 if billing_interval == "annual" else 30
        subscription.plan = target_plan
        subscription.status = "active"
        subscription.billing_interval = billing_interval
        subscription.payment_method_type = payment_method_type
        subscription.payment_method_details = payment_details
        subscription.current_period_start = now
        subscription.current_period_end = now + timedelta(days=days_ahead)
        subscription.cancel_at_period_end = False
        subscription.save()

        # Atualizar cota da organizacao imediatamente
        if quota:
            quota.plan = target_plan
            quota.is_active = True
            quota.save()

        # Gerar registro de fatura/recibo se houver cobranca ou para registrar a mudanca
        receipt_code = f"CAT-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        BillingInvoice.objects.create(
            organization=org,
            plan=target_plan,
            amount_brl=amount,
            billing_interval=billing_interval,
            status="paid",
            payment_method_type=payment_method_type,
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


class StudioCancelSubscriptionView(APIView):
    """
    Cancela a renovacao automatica da assinatura ao final do ciclo.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        org = get_or_create_user_org(user)
        subscription = get_or_create_org_subscription(org)

        if subscription.plan and subscription.plan.tier == "free":
            return Response({"error": "O plano gratuito nao possui cobranca ativa para cancelar."}, status=status.HTTP_400_BAD_REQUEST)

        subscription.cancel_at_period_end = True
        subscription.save()

        return Response({
            "success": True,
            "message": "Renovacao automatica cancelada. Seu acesso aos recursos continuara ativo ate o final do periodo.",
            "cancel_at_period_end": True,
            "current_period_end": subscription.current_period_end.isoformat() if subscription.current_period_end else None,
        })
