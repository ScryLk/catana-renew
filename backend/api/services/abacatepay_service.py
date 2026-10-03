import uuid
import hmac
import hashlib
import logging
import requests
from typing import Dict, Any, Optional
from django.conf import settings
from api.models import User, Organization, SubscriptionPlan

logger = logging.getLogger(__name__)


class AbacatePayService:
    """
    Servico de integracao com o gateway AbacatePay (API v2).
    Gerencia catalogo de produtos, checkouts seguros (Pix e Cartao de Credito)
    e validacao de assinaturas de webhooks.
    Opera em modo Sandbox transparente quando nenhuma chave de API e configurada.
    """

    BASE_URL = "https://api.abacatepay.com/v2"

    def __init__(self):
        self.api_key = getattr(settings, 'ABACATEPAY_API_KEY', '').strip()
        self.frontend_url = getattr(settings, 'KATANA_FRONTEND_URL', 'http://localhost:5174').rstrip('/')
        self.is_sandbox = not bool(self.api_key)
        self._product_cache: Dict[str, str] = {}

    @property
    def webhook_secret(self) -> str:
        return getattr(settings, 'ABACATEPAY_WEBHOOK_SECRET', '').strip()

    @property
    def headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def get_or_create_product(self, plan: SubscriptionPlan, interval: str = "monthly") -> Optional[str]:
        """
        Obtem o ID do produto na AbacatePay v2 correspondente ao plano e ciclo de faturamento.
        Se ainda nao existir na conta do gateway, cria via POST /v2/products/create.
        """
        if interval == "annual":
            price_amount = plan.price_annual_brl * 12
            interval_label = "Anual"
        else:
            price_amount = plan.price_monthly_brl
            interval_label = "Mensal"

        price_cents = int(price_amount * 100)
        external_id = f"katana_{plan.tier}_{interval}_{price_cents}"

        # Verifica cache em memoria
        if external_id in self._product_cache:
            return self._product_cache[external_id]

        # 1. Tenta listar os produtos existentes no gateway
        try:
            list_res = requests.get(f"{self.BASE_URL}/products/list", headers=self.headers, timeout=10)
            if list_res.status_code == 200:
                products = list_res.json().get("data", [])
                for prod in products:
                    p_ext = prod.get("externalId")
                    p_id = prod.get("id")
                    if p_ext and p_id:
                        self._product_cache[p_ext] = p_id
                if external_id in self._product_cache:
                    return self._product_cache[external_id]
        except Exception as exc:
            logger.warning(f"[AbacatePay-v2] Erro ao listar produtos: {str(exc)}")

        # 2. Se nao existir, cria o produto
        create_url = f"{self.BASE_URL}/products/create"
        payload = {
            "externalId": external_id,
            "name": f"Katana Studio {plan.name} ({interval_label})",
            "price": price_cents,
            "currency": "BRL",
            "description": plan.description[:200] if plan.description else f"Assinatura do {plan.name}",
        }

        try:
            res = requests.post(create_url, json=payload, headers=self.headers, timeout=10)
            if res.status_code == 200:
                prod_data = res.json().get("data", {})
                product_id = prod_data.get("id")
                if product_id:
                    self._product_cache[external_id] = product_id
                    return product_id
            elif "already exists" in res.text:
                list_res = requests.get(f"{self.BASE_URL}/products/list", headers=self.headers, timeout=10)
                if list_res.status_code == 200:
                    for prod in list_res.json().get("data", []):
                        p_ext = prod.get("externalId")
                        p_id = prod.get("id")
                        if p_ext and p_id:
                            self._product_cache[p_ext] = p_id
                    if external_id in self._product_cache:
                        return self._product_cache[external_id]
            else:
                logger.error(f"[AbacatePay-v2] Falha ao criar produto: {res.status_code} - {res.text}")
        except Exception as exc:
            logger.error(f"[AbacatePay-v2] Excecao ao criar produto: {str(exc)}")

        return None

    def create_billing_checkout(
        self,
        user: User,
        org: Organization,
        plan: SubscriptionPlan,
        interval: str = "monthly",
    ) -> Dict[str, Any]:
        """
        Cria uma cobranca / sessao de checkout na AbacatePay v2 com suporte a Pix e Cartao.
        Retorna checkout_url, billing_id e status.
        """
        if interval == "annual":
            price_amount = plan.price_annual_brl * 12
        else:
            price_amount = plan.price_monthly_brl

        price_cents = int(price_amount * 100)

        # Se for plano gratuito, ativa sem cobranca financeira
        if plan.tier == "free" or price_amount <= 0:
            return {
                "id": f"bill_free_{uuid.uuid4().hex[:10]}",
                "checkout_url": f"{self.frontend_url}/studio?billing=success&tier=free",
                "amount": 0,
                "status": "PAID",
                "is_free": True,
            }

        return_url = f"{self.frontend_url}/studio?billing=canceled"
        completion_url = f"{self.frontend_url}/studio?billing=success&tier={plan.tier}&interval={interval}"

        # Se nao houver chave configurada, opera em modo Sandbox local
        if self.is_sandbox:
            billing_id = f"bill_mock_{uuid.uuid4().hex[:12]}"
            mock_url = (
                f"{self.frontend_url}/studio?billing=sandbox"
                f"&billing_id={billing_id}"
                f"&tier={plan.tier}"
                f"&interval={interval}"
                f"&amount={float(price_amount):.2f}"
            )
            logger.info(f"[AbacatePay-Sandbox] Checkout mock criado: {billing_id} para {plan.name}")
            return {
                "id": billing_id,
                "checkout_url": mock_url,
                "amount": price_cents,
                "status": "PENDING",
                "is_mock": True,
            }

        # Obter ID do produto no gateway v2
        product_id = self.get_or_create_product(plan, interval)
        if not product_id:
            logger.error(f"[AbacatePay-v2] Nao foi possivel obter ID de produto para {plan.name}")
            fallback_id = f"bill_err_{uuid.uuid4().hex[:10]}"
            return {
                "id": fallback_id,
                "checkout_url": f"{self.frontend_url}/studio?billing=sandbox&billing_id={fallback_id}&tier={plan.tier}",
                "amount": price_cents,
                "status": "PENDING",
                "is_mock": True,
            }

        url = f"{self.BASE_URL}/checkouts/create"
        payload = {
            "frequency": "ONE_TIME",
            "methods": ["PIX", "CARD"],
            "items": [
                {
                    "id": product_id,
                    "quantity": 1,
                }
            ],
            "returnUrl": return_url,
            "completionUrl": completion_url,
            "metadata": {
                "org_id": org.id,
                "user_id": user.id,
                "tier": plan.tier,
                "interval": interval,
            },
        }

        try:
            response = requests.post(url, json=payload, headers=self.headers, timeout=12)
            response.raise_for_status()
            res_data = response.json()
            checkout_data = res_data.get("data", res_data)

            billing_id = checkout_data.get("id")
            checkout_url = checkout_data.get("url")

            logger.info(f"[AbacatePay-v2] Checkout real gerado: {billing_id} - URL: {checkout_url}")
            return {
                "id": billing_id,
                "checkout_url": checkout_url,
                "amount": checkout_data.get("amount", price_cents),
                "status": checkout_data.get("status", "PENDING"),
                "is_mock": False,
            }
        except Exception as exc:
            logger.error(f"[AbacatePay-v2] Erro ao criar checkout: {str(exc)}")
            fallback_id = f"bill_err_{uuid.uuid4().hex[:10]}"
            return {
                "id": fallback_id,
                "checkout_url": f"{self.frontend_url}/studio?billing=sandbox&billing_id={fallback_id}&tier={plan.tier}",
                "amount": price_cents,
                "status": "PENDING",
                "is_mock": True,
            }

    def get_checkout_status(self, billing_id: str) -> Optional[Dict[str, Any]]:
        """
        Consulta o status de um checkout diretamente na AbacatePay v2 via GET /checkouts/list.
        Retorna o dicionario do checkout se encontrado, ou None.
        """
        if not billing_id or self.is_sandbox:
            return None

        try:
            res = requests.get(f"{self.BASE_URL}/checkouts/list", headers=self.headers, timeout=12)
            if res.status_code == 200:
                checkouts = res.json().get("data", [])
                for checkout in checkouts:
                    if checkout.get("id") == billing_id:
                        return checkout
        except Exception as exc:
            logger.error(f"[AbacatePay-v2] Erro ao buscar checkout {billing_id}: {str(exc)}")

        return None

    def find_paid_checkout_for_org(self, org_id: int, user_id: Optional[int] = None) -> Optional[Dict[str, Any]]:
        """
        Busca o checkout com status PAID mais recente associado a organizacao ou usuario.
        """
        if self.is_sandbox:
            return None

        try:
            res = requests.get(f"{self.BASE_URL}/checkouts/list", headers=self.headers, timeout=12)
            if res.status_code == 200:
                checkouts = res.json().get("data", [])
                for checkout in checkouts:
                    if checkout.get("status") == "PAID":
                        meta = checkout.get("metadata") or {}
                        meta_org = meta.get("org_id")
                        meta_user = meta.get("user_id")
                        if (meta_org is not None and int(meta_org) == int(org_id)) or (user_id and meta_user is not None and int(meta_user) == int(user_id)):
                            return checkout
        except Exception as exc:
            logger.error(f"[AbacatePay-v2] Erro ao buscar checkouts pagos para org {org_id}: {str(exc)}")

        return None

    def verify_webhook_signature(
        self,
        signature_header: Optional[str],
        payload_bytes: Optional[bytes] = None,
        secret_param: Optional[str] = None
    ) -> bool:
        """
        Valida a autenticidade do webhook do AbacatePay.
        Principio FAIL-CLOSED estrito:
        Rejeita imediatamente se o segredo ou a assinatura estiverem ausentes ou vazios.
        """
        secret = self.webhook_secret
        if not secret:
            logger.error("[AbacatePay-Webhook] Rejeitado (fail-closed): ABACATEPAY_WEBHOOK_SECRET ausente ou vazio.")
            return False

        signature = (signature_header or secret_param or "").strip()
        if not signature:
            logger.warning("[AbacatePay-Webhook] Rejeitado: Cabecalho de assinatura ausente ou vazio.")
            return False

        # 1. Comparacao direta em tempo constante contra timing attacks
        if hmac.compare_digest(signature, secret):
            return True

        # 2. Validacao por HMAC-SHA256 do payload bruto
        if payload_bytes:
            try:
                computed_hmac = hmac.new(secret.encode('utf-8'), payload_bytes, hashlib.sha256).hexdigest()
                if hmac.compare_digest(signature, computed_hmac):
                    return True
            except Exception as exc:
                logger.error("[AbacatePay-Webhook] Erro ao calcular HMAC: %s", exc)

        logger.warning("[AbacatePay-Webhook] Rejeitado: Assinatura invalida.")
        return False


abacatepay_client = AbacatePayService()
