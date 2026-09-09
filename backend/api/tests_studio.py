import json
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from api.models import (
    StudioCatalog,
    CatalogSpread,
    ChatThread,
    ChatMessage,
    SubscriptionPlan,
    OrganizationQuota,
    TokenUsageLog,
)
from api.ai.agents.registry import get_agent, list_agents
from api.guards.quota_guard import (
    get_or_create_default_plan,
    rate_limiter,
    RateLimitExceededException,
    QuotaExceededException,
)

class StudioBackendTests(TestCase):
    """
    Testes de integracao e conformidade da API do Catana Studio 2.0.
    """

    def setUp(self):
        self.client = APIClient()
        self.plan = get_or_create_default_plan("free")

    def test_list_agents(self):
        """Verifica se todos os 6 agentes estao devidamente registrados"""
        url = reverse('studio_agents_list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        agents = response.data.get("agents", [])
        self.assertEqual(len(agents), 6)
        roles = [a["role"] for a in agents]
        self.assertIn("orchestrator", roles)
        self.assertIn("director", roles)
        self.assertIn("copywriter", roles)
        self.assertIn("commercial", roles)
        self.assertIn("branding", roles)
        self.assertIn("council", roles)

    def test_quota_status(self):
        """Verifica a rota de status de cotas e limites"""
        url = reverse('studio_quota_status')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("tier", response.data)
        self.assertIn("monthly_token_quota", response.data)
        self.assertIn("rate_limit_rpm", response.data)

    def test_create_and_fetch_catalog(self):
        """Verifica a criacao de catalogo com spread inicial A4"""
        url = reverse('studio_catalog_list')
        payload = {
            "title": "Catalogo Teste Studio",
            "brand_name": "Marca Teste",
            "style_preset": "editorial_clean",
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        catalog_id = response.data["id"]

        detail_url = reverse('studio_catalog_detail', kwargs={"pk": catalog_id})
        detail_resp = self.client.get(detail_url)
        self.assertEqual(detail_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(detail_resp.data["title"], "Catalogo Teste Studio")
        self.assertEqual(len(detail_resp.data["spreads"]), 1)
        self.assertEqual(detail_resp.data["page_width"], 794)
        self.assertEqual(detail_resp.data["page_height"], 1123)

    def test_chat_stream_mock_sse(self):
        """Verifica o endpoint de streaming SSE com o provedor Mock inteligente"""
        url = reverse('studio_chat_stream')
        payload = {
            "message": "Crie uma capa para catalogo de calcados",
            "agent_role": "director",
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response['Content-Type'], 'text/event-stream')

        # Itera sobre o stream
        content_stream = b"".join(response.streaming_content).decode("utf-8")
        self.assertIn('"event": "start"', content_stream)
        self.assertIn('"event": "token"', content_stream)
        self.assertIn('"event": "done"', content_stream)
        self.assertIn("Diretor de Arte", content_stream)

        # Verifica se o log de tokens foi gravado
        token_logs = TokenUsageLog.objects.filter(agent_role="director")
        self.assertTrue(token_logs.exists())
        self.assertGreater(token_logs.first().total_tokens, 0)

    def test_rate_limit_enforcement(self):
        """Verifica se o rate limiter bloqueia excesso de requisicoes com HTTP 429"""
        test_ip = "192.168.1.99"
        # Esgota as requisicoes permitidas
        for _ in range(15):
            rate_limiter.check_rate_limit(f"ip_{test_ip}", max_rpm=15)

        # A decima sexta requisicao deve falhar
        url = reverse('studio_chat_stream')
        payload = {"message": "teste limite"}
        response = self.client.post(
            url, payload, format='json', REMOTE_ADDR=test_ip
        )
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertIn("code", response.data)
        self.assertEqual(response.data["code"], "rate_limit_exceeded")
