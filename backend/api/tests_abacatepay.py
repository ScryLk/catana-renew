import uuid
import unittest
from datetime import timedelta
from decimal import Decimal
from django.utils import timezone
from django.test import TestCase, override_settings
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from api.models import (
    Organization,
    OrganizationSubscription,
    OrganizationQuota,
    SubscriptionPlan,
    BillingInvoice,
    StudioCatalog,
)
from api.guards.quota_guard import (
    get_or_create_default_plan,
    get_user_quota,
    check_chat_guard,
    check_catalog_creation_guard,
    check_council_guard,
    QuotaExceededException,
    CatalogLimitExceededException,
    CouncilFeatureLockedException,
)
from api.views_billing import get_or_create_org_subscription
from api.services.abacatepay_service import AbacatePayService, abacatepay_client

User = get_user_model()


class AbacatePayBillingTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="lucas_test",
            email="lucas@katana.dev",
            password="testpassword123",
            first_name="Lucas",
            last_name="Engenheiro",
        )
        self.org = Organization.objects.create(
            name="Workspace do Lucas",
            owner=self.user,
        )
        self.user.organizations.add(self.org)

        # Garantir planos padrao
        self.free_plan = get_or_create_default_plan("free")
        self.pro_plan = get_or_create_default_plan("pro")
        self.enterprise_plan = get_or_create_default_plan("enterprise")

        self.sub = get_or_create_org_subscription(self.org)
        self.quota, _ = get_user_quota(self.user)

        self.client.force_authenticate(user=self.user)

    @override_settings(ABACATEPAY_API_KEY="")
    def test_abacatepay_service_sandbox_checkout(self):
        """
        Valida se o servico em modo sandbox gera URLs e IDs de cobranca validos.
        """
        sandbox_service = AbacatePayService()
        res = sandbox_service.create_billing_checkout(
            user=self.user,
            org=self.org,
            plan=self.pro_plan,
            interval="monthly",
        )
        self.assertIn("id", res)
        self.assertIn("checkout_url", res)
        self.assertTrue(res.get("is_mock"))
        self.assertEqual(res.get("amount"), int(self.pro_plan.price_monthly_brl * 100))

    def test_abacatepay_service_live_checkout(self):
        """
        Valida se com chave configurada o servico gera checkout real da AbacatePay v2.
        """
        res = abacatepay_client.create_billing_checkout(
            user=self.user,
            org=self.org,
            plan=self.pro_plan,
            interval="monthly",
        )
        self.assertIn("id", res)
        self.assertIn("checkout_url", res)
        self.assertIn("abacatepay.com", res.get("checkout_url"))
        self.assertFalse(res.get("is_mock"))

    def test_checkout_view_pro_plan(self):
        """
        Endpoint POST /api/v2/studio/billing/checkout/ retorna URL do gateway e salva billing_id.
        """
        response = self.client.post(
            "/api/v2/studio/billing/checkout/",
            {"tier": "pro", "interval": "monthly"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data.get("success"))
        self.assertIn("checkout_url", data)
        self.assertIn("billing_id", data)

        sub = OrganizationSubscription.objects.get(organization=self.org)
        self.assertEqual(sub.abacatepay_billing_id, data["billing_id"])

    def test_checkout_view_free_plan_downgrade(self):
        """
        Downgrade para o plano gratuito nao gera checkout financeiro e ativa imediatamente.
        """
        response = self.client.post(
            "/api/v2/studio/billing/checkout/",
            {"tier": "free", "interval": "monthly"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data.get("is_free"))
        self.assertEqual(data.get("tier"), "free")

        sub = OrganizationSubscription.objects.get(organization=self.org)
        self.assertEqual(sub.plan.tier, "free")

    def test_webhook_billing_paid_provisions_plan_and_quota(self):
        """
        Webhook com evento billing.paid atualiza assinatura, zera consumo do novo ciclo e cria fatura.
        """
        billing_id = f"bill_test_{uuid.uuid4().hex[:10]}"
        event_id = f"evt_{uuid.uuid4().hex[:10]}"

        # Consome tokens previamente na cota
        quota, _ = get_user_quota(self.user)
        quota.tokens_used_this_month = 50000
        quota.save()

        webhook_payload = {
            "eventId": event_id,
            "event": "billing.paid",
            "data": {
                "id": billing_id,
                "amount": 100,
                "status": "PAID",
                "paymentMethod": "PIX",
                "url": "https://abacatepay.com/receipt/123",
                "metadata": {
                    "org_id": self.org.id,
                    "tier": "pro",
                    "interval": "monthly",
                },
            },
        }

        # Request desautenticado (webhook externo) com assinatura valida
        anon_client = APIClient()
        with self.settings(ABACATEPAY_WEBHOOK_SECRET="test_wh_secret_xyz"):
            response = anon_client.post(
                "/api/v2/billing/webhook/abacatepay/",
                webhook_payload,
                format="json",
                HTTP_X_ABACATEPAY_SIGNATURE="test_wh_secret_xyz",
            )
        self.assertEqual(response.status_code, 200)

        # 1. Verifica OrganizationSubscription
        sub = OrganizationSubscription.objects.get(organization=self.org)
        self.assertEqual(sub.status, "active")
        self.assertEqual(sub.plan.tier, "pro")
        self.assertEqual(sub.last_webhook_event_id, event_id)
        self.assertEqual(sub.payment_method_type, "pix")

        # 2. Verifica OrganizationQuota
        quota.refresh_from_db()
        self.assertEqual(quota.plan.tier, "pro")
        self.assertEqual(quota.tokens_used_this_month, 0)

        # 3. Verifica BillingInvoice
        invoice = BillingInvoice.objects.get(external_transaction_id=billing_id)
        self.assertEqual(invoice.status, "paid")
        self.assertEqual(invoice.amount_brl, Decimal("1.00"))
        self.assertEqual(invoice.gateway_provider, "abacatepay")

    def test_webhook_idempotency_ignores_duplicate_event(self):
        """
        Envio duplicado do webhook com o mesmo eventId nao duplica faturas.
        """
        billing_id = f"bill_idemp_{uuid.uuid4().hex[:8]}"
        event_id = f"evt_idemp_{uuid.uuid4().hex[:8]}"

        webhook_payload = {
            "eventId": event_id,
            "event": "billing.paid",
            "data": {
                "id": billing_id,
                "amount": 100,
                "status": "PAID",
                "paymentMethod": "PIX",
                "metadata": {
                    "org_id": self.org.id,
                    "tier": "pro",
                    "interval": "monthly",
                },
            },
        }

        anon_client = APIClient()
        with self.settings(ABACATEPAY_WEBHOOK_SECRET="test_wh_secret_xyz"):
            r1 = anon_client.post(
                "/api/v2/billing/webhook/abacatepay/",
                webhook_payload,
                format="json",
                HTTP_X_ABACATEPAY_SIGNATURE="test_wh_secret_xyz",
            )
            self.assertEqual(r1.status_code, 200)
            self.assertEqual(BillingInvoice.objects.filter(external_transaction_id=billing_id).count(), 1)

            # Segunda chamada com o mesmo payload
            r2 = anon_client.post(
                "/api/v2/billing/webhook/abacatepay/",
                webhook_payload,
                format="json",
                HTTP_X_ABACATEPAY_SIGNATURE="test_wh_secret_xyz",
            )
            self.assertEqual(r2.status_code, 200)
            self.assertEqual(r2.json().get("status"), "ignored_already_processed")
            self.assertEqual(BillingInvoice.objects.filter(external_transaction_id=billing_id).count(), 1)

    # ==========================================================================
    # FAIL-CLOSED & SECURITY WEBHOOK TESTS
    # ==========================================================================

    def test_webhook_rejected_when_secret_missing(self):
        """Valida que o webhook seja estritamente rejeitado se o secret do gateway nao estiver configurado"""
        anon_client = APIClient()
        with self.settings(ABACATEPAY_WEBHOOK_SECRET=""):
            res = anon_client.post(
                "/api/v2/billing/webhook/abacatepay/",
                {"event": "billing.paid"},
                format="json",
                HTTP_X_ABACATEPAY_SIGNATURE="any_sig",
            )
            self.assertEqual(res.status_code, 403)

    def test_webhook_rejected_when_secret_whitespace(self):
        """Valida que o webhook seja rejeitado se o secret for apenas espacos em branco"""
        anon_client = APIClient()
        with self.settings(ABACATEPAY_WEBHOOK_SECRET="   "):
            res = anon_client.post(
                "/api/v2/billing/webhook/abacatepay/",
                {"event": "billing.paid"},
                format="json",
                HTTP_X_ABACATEPAY_SIGNATURE="   ",
            )
            self.assertEqual(res.status_code, 403)

    def test_webhook_rejected_when_signature_header_missing(self):
        """Valida que o webhook seja rejeitado quando o cabecalho de assinatura estiver ausente"""
        anon_client = APIClient()
        with self.settings(ABACATEPAY_WEBHOOK_SECRET="secure_secret_123"):
            res = anon_client.post(
                "/api/v2/billing/webhook/abacatepay/",
                {"event": "billing.paid"},
                format="json",
            )
            self.assertEqual(res.status_code, 403)

    def test_webhook_rejected_when_signature_invalid(self):
        """Valida rejeicao quando a assinatura enviada nao coincide com o segredo"""
        anon_client = APIClient()
        with self.settings(ABACATEPAY_WEBHOOK_SECRET="secure_secret_123"):
            res = anon_client.post(
                "/api/v2/billing/webhook/abacatepay/",
                {"event": "billing.paid"},
                format="json",
                HTTP_X_ABACATEPAY_SIGNATURE="forged_signature_abc",
            )
            self.assertEqual(res.status_code, 403)

    def test_webhook_rejected_when_payload_tampered_after_hmac(self):
        """Valida que payload adulterado apos assinatura HMAC seja rejeitado"""
        import hmac
        import hashlib
        import json

        secret = "secret_key_hmac_456"
        original_body = json.dumps({"event": "billing.paid", "amount": 100}).encode('utf-8')
        valid_hmac = hmac.new(secret.encode('utf-8'), original_body, hashlib.sha256).hexdigest()

        # Altera o payload mantendo o HMAC anterior
        tampered_body = json.dumps({"event": "billing.paid", "amount": 999999}).encode('utf-8')

        anon_client = APIClient()
        with self.settings(ABACATEPAY_WEBHOOK_SECRET=secret):
            res = anon_client.post(
                "/api/v2/billing/webhook/abacatepay/",
                data=tampered_body,
                content_type="application/json",
                HTTP_X_ABACATEPAY_SIGNATURE=valid_hmac,
            )
            self.assertEqual(res.status_code, 403)

    def test_quota_guard_blocks_when_tokens_exceeded(self):
        """
        check_chat_guard lanca QuotaExceededException (429) quando tokens do mes estouram a cota.
        """
        quota, _ = get_user_quota(self.user)
        quota.plan = self.free_plan
        quota.tokens_used_this_month = 100001
        quota.save()

        with self.assertRaises(QuotaExceededException):
            check_chat_guard(self.user, agent_role="orchestrator")

    def test_catalog_limit_guard_blocks_on_free_tier(self):
        """
        check_catalog_creation_guard lanca CatalogLimitExceededException (403) apos 5 catalogos no Free.
        """
        quota, _ = get_user_quota(self.user)
        quota.plan = self.free_plan
        quota.save()

        for i in range(5):
            StudioCatalog.objects.create(
                title=f"Catalogo {i}",
                created_by=self.user,
                organization=self.org,
            )

        with self.assertRaises(CatalogLimitExceededException):
            check_catalog_creation_guard(self.user)

    def test_council_guard_locked_on_free_tier(self):
        """
        check_council_guard bloqueia acesso ao Conselho Editorial para usuarios do plano gratuito.
        """
        quota, _ = get_user_quota(self.user)
        quota.plan = self.free_plan
        quota.save()

        with self.assertRaises(CouncilFeatureLockedException):
            check_council_guard(self.user)

    def test_sandbox_instant_confirm_view(self):
        """
        POST /api/v2/studio/billing/sandbox-confirm/ ativa o plano diretamente em modo de desenvolvimento.
        """
        response = self.client.post(
            "/api/v2/studio/billing/sandbox-confirm/",
            {"tier": "pro", "interval": "monthly"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data.get("success"))
        self.assertEqual(data.get("tier"), "pro")

        quota, active_plan = get_user_quota(self.user)
        self.assertEqual(active_plan.tier, "pro")

    def test_studio_billing_sync_view(self):
        """
        POST /api/v2/studio/billing/sync/ reconcilia cobranca paga e ativa o plano.
        """
        mock_checkout = {
            "id": "bill_sync_test_123",
            "status": "PAID",
            "amount": 100,
            "paidAmount": 100,
            "methods": ["PIX"],
            "metadata": {
                "org_id": self.org.id,
                "user_id": self.user.id,
                "tier": "pro",
                "interval": "monthly",
            },
        }

        with unittest.mock.patch("api.views_billing.abacatepay_client.get_checkout_status", return_value=mock_checkout):
            response = self.client.post(
                "/api/v2/studio/billing/sync/",
                {"billing_id": "bill_sync_test_123"},
                format="json",
            )
            self.assertEqual(response.status_code, 200)
            data = response.json()
            self.assertTrue(data.get("synced"))
            self.assertEqual(data.get("tier"), "pro")

            sub = OrganizationSubscription.objects.get(organization=self.org)
            self.assertEqual(sub.plan.tier, "pro")
            self.assertEqual(sub.status, "active")

            quota, active_plan = get_user_quota(self.user)
            self.assertEqual(active_plan.tier, "pro")

    def test_cancel_subscription_scheduled(self):
        """
        POST /api/v2/studio/billing/cancel/ com immediate=False agenda cancelamento para o fim do periodo.
        """
        sub = OrganizationSubscription.objects.get(organization=self.org)
        sub.plan = self.pro_plan
        sub.status = "active"
        sub.current_period_end = timezone.now() + timedelta(days=25)
        sub.save()

        quota = OrganizationQuota.objects.get(organization=self.org)
        quota.plan = self.pro_plan
        quota.save()

        response = self.client.post(
            "/api/v2/studio/billing/cancel/",
            {"immediate": False},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data.get("success"))
        self.assertTrue(data.get("cancel_at_period_end"))
        self.assertEqual(data.get("tier"), "pro")

        sub.refresh_from_db()
        self.assertTrue(sub.cancel_at_period_end)
        self.assertEqual(sub.plan.tier, "pro")

        # Cota permanece Pro ate o fim do ciclo
        quota, active_plan = get_user_quota(self.user)
        self.assertEqual(active_plan.tier, "pro")

    def test_reactivate_subscription(self):
        """
        POST /api/v2/studio/billing/reactivate/ desfaz cancelamento agendado.
        """
        sub = OrganizationSubscription.objects.get(organization=self.org)
        sub.plan = self.pro_plan
        sub.status = "active"
        sub.cancel_at_period_end = True
        sub.current_period_end = timezone.now() + timedelta(days=20)
        sub.save()

        response = self.client.post(
            "/api/v2/studio/billing/reactivate/",
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data.get("success"))
        self.assertFalse(data.get("cancel_at_period_end"))

        sub.refresh_from_db()
        self.assertFalse(sub.cancel_at_period_end)

    def test_cancel_subscription_immediate(self):
        """
        POST /api/v2/studio/billing/cancel/ com immediate=True realiza downgrade imediato.
        """
        sub = OrganizationSubscription.objects.get(organization=self.org)
        sub.plan = self.pro_plan
        sub.status = "active"
        sub.save()

        response = self.client.post(
            "/api/v2/studio/billing/cancel/",
            {"immediate": True},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data.get("success"))
        self.assertTrue(data.get("immediate"))
        self.assertEqual(data.get("tier"), "free")

        sub.refresh_from_db()
        self.assertEqual(sub.plan.tier, "free")
        self.assertEqual(sub.status, "canceled")

        quota, active_plan = get_user_quota(self.user)
        self.assertEqual(active_plan.tier, "free")

    def test_quota_guard_auto_downgrades_when_expired(self):
        """
        get_user_quota rebaixa automaticamente a cota quando cancel_at_period_end expira.
        """
        sub = OrganizationSubscription.objects.get(organization=self.org)
        sub.plan = self.pro_plan
        sub.status = "active"
        sub.cancel_at_period_end = True
        sub.current_period_end = timezone.now() - timedelta(days=1)
        sub.save()

        quota = OrganizationQuota.objects.get(organization=self.org)
        quota.plan = self.pro_plan
        quota.save()

        # Ao consultar cota ou efetuar requisicao, deve rebaixar para free
        quota_res, active_plan = get_user_quota(self.user)
        self.assertEqual(active_plan.tier, "free")
        self.assertEqual(quota_res.plan.tier, "free")

        sub.refresh_from_db()
        self.assertEqual(sub.plan.tier, "free")
        self.assertEqual(sub.status, "canceled")
        self.assertFalse(sub.cancel_at_period_end)



