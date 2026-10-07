import io
import json
from PIL import Image
from django.test import TestCase
from django.urls import reverse
from django.core.management import call_command
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from rest_framework import status
from django.contrib.auth import get_user_model
from api.models import (
    StudioCatalog,
    CatalogSpread,
    ChatThread,
    ChatMessage,
    SubscriptionPlan,
    OrganizationQuota,
    TokenUsageLog,
    CatalogTemplate,
    Product,
)
from api.ai.agents.registry import get_agent, list_agents
from api.guards.quota_guard import (
    get_or_create_default_plan,
    get_user_quota,
    rate_limiter,
    RateLimitExceededException,
    QuotaExceededException,
)

User = get_user_model()

class StudioBackendTests(TestCase):
    """
    Testes de integracao e conformidade da API do Catana Studio 2.0.
    """

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="test_studio_user",
            email="studio@catana.dev",
            password="password123"
        )
        self.client.force_authenticate(user=self.user)
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

    def test_create_catalog_with_palette_and_brand_lock(self):
        """Verifica criacao e persistencia de catalogo com paleta e brand lock"""
        url = reverse('studio_catalog_list')
        palette = {
            "name": "Luxe Noir & Or",
            "primary": "#1A1817",
            "background": "#F5F1EA",
            "accent": "#B08D57",
        }
        payload = {
            "title": "Catalogo Paleta Teste",
            "brand_name": "Atelier Luxo",
            "style_preset": "editorial_clean",
            "brand_lock": True,
            "total_pages": 8,
            "palette_data": palette,
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data["brand_lock"])
        self.assertEqual(response.data["total_pages"], 8)
        self.assertEqual(response.data["palette_data"]["name"], "Luxe Noir & Or")

        cat_id = response.data["id"]
        detail_url = reverse('studio_catalog_detail', kwargs={"pk": cat_id})
        detail_resp = self.client.get(detail_url)
        self.assertEqual(detail_resp.status_code, status.HTTP_200_OK)
        self.assertTrue(detail_resp.data["brand_lock"])
        self.assertEqual(detail_resp.data["total_pages"], 8)
        self.assertEqual(detail_resp.data["palette_data"]["accent"], "#B08D57")

    def test_save_spread_atomic_with_overlays(self):
        """Verifica salvamento e recuperacao de spread contendo overlays e produtos"""
        cat = StudioCatalog.objects.create(
            title="Catalogo Spreads Teste",
            created_by=self.user,
        )
        url = reverse('studio_spread_manage', kwargs={"catalog_id": cat.id})
        left_page = {
            "id": "p-1",
            "pageNumber": 1,
            "type": "cover",
            "title": "CAPA EDITORIAL",
            "backgroundColor": "#1A1817",
            "textColor": "#F5F1EA",
            "accentColor": "#B08D57",
            "overlays": [
                {
                    "id": "ov-1",
                    "type": "badge",
                    "text": "NOVA COLEÇÃO",
                    "x": 50,
                    "y": 20,
                }
            ]
        }
        right_page = {
            "id": "p-2",
            "pageNumber": 2,
            "type": "hero",
            "title": "DESTAQUE HERO",
            "backgroundColor": "#F5F1EA",
            "textColor": "#1A1817",
            "accentColor": "#B08D57",
            "products": [
                {
                    "id": "prod-1",
                    "name": "Bolsa de Couro",
                    "price": "R$ 1.200",
                }
            ],
            "overlays": []
        }
        payload = {
            "spread_index": 0,
            "title": "Spread 1-2",
            "left_page": left_page,
            "right_page": right_page,
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["spread_index"], 0)

        detail_url = reverse('studio_catalog_detail', kwargs={"pk": cat.id})
        detail_resp = self.client.get(detail_url)
        self.assertEqual(detail_resp.status_code, status.HTTP_200_OK)
        spreads = detail_resp.data["spreads"]
        self.assertEqual(len(spreads), 1)
        self.assertEqual(spreads[0]["left_page"]["title"], "CAPA EDITORIAL")
        self.assertEqual(len(spreads[0]["left_page"]["overlays"]), 1)
        self.assertEqual(spreads[0]["left_page"]["overlays"][0]["text"], "NOVA COLEÇÃO")
        self.assertEqual(spreads[0]["right_page"]["products"][0]["name"], "Bolsa de Couro")

    def test_bulk_sync_spreads(self):
        """Verifica sincronizacao em lote de múltiplos spreads em uma transacao atomica"""
        cat = StudioCatalog.objects.create(
            title="Catalogo Bulk Teste",
            created_by=self.user,
        )
        url = reverse('studio_spread_bulk_sync', kwargs={"catalog_id": cat.id})
        payload = {
            "total_pages": 4,
            "spreads": [
                {
                    "spread_index": 0,
                    "title": "Spread 1-2",
                    "left_page": {"id": "p-1", "pageNumber": 1, "type": "cover"},
                    "right_page": {"id": "p-2", "pageNumber": 2, "type": "manifesto"},
                },
                {
                    "spread_index": 1,
                    "title": "Spread 3-4",
                    "left_page": {"id": "p-3", "pageNumber": 3, "type": "hero"},
                    "right_page": {"id": "p-4", "pageNumber": 4, "type": "backcover"},
                }
            ]
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "success")
        self.assertEqual(response.data["count"], 2)

        detail_url = reverse('studio_catalog_detail', kwargs={"pk": cat.id})
        detail_resp = self.client.get(detail_url)
        self.assertEqual(len(detail_resp.data["spreads"]), 2)
        self.assertEqual(detail_resp.data["total_pages"], 4)
        self.assertEqual(detail_resp.data["spreads"][1]["right_page"]["type"], "backcover")

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
        # Esgota as requisicoes permitidas para o usuario
        identifier = f"user_{self.user.id}"
        for _ in range(15):
            rate_limiter.check_rate_limit(identifier, max_rpm=15)

        # A decima sexta requisicao deve falhar
        url = reverse('studio_chat_stream')
        payload = {"message": "teste limite"}
        response = self.client.post(
            url, payload, format='json', REMOTE_ADDR=test_ip
        )
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertIn("code", response.data)
        self.assertEqual(response.data["code"], "rate_limit_exceeded")

    def test_chat_stream_with_active_spread_and_patch(self):
        """Verifica se o streaming recebe o JSON do spread ativo e processa o contexto"""
        url = reverse('studio_chat_stream')
        spread_data = {
            "left_page": {"type": "hero", "title": "Capa Colecao"},
            "right_page": {"type": "grid", "products": [{"id": "prod-1", "price": "R$ 1.000"}]}
        }
        skeleton = [
            {"index": 0, "type": "cover", "title": "Capa Principal"},
            {"index": 1, "type": "hero", "title": "Spread Ativo"}
        ]
        payload = {
            "message": "Aumente o preco do produto 1 em 10%",
            "agent_role": "commercial",
            "spread_index": 1,
            "active_spread_data": spread_data,
            "catalog_skeleton": skeleton,
            "selected_element_id": "prod-1",
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response['Content-Type'], 'text/event-stream')

        content_stream = b"".join(response.streaming_content).decode("utf-8")
        self.assertIn('"event": "start"', content_stream)
        self.assertIn('"event": "done"', content_stream)

    def test_extract_patch_from_text_helper(self):
        """Valida o extrator de blocos json:patch"""
        from api.views_studio import extract_patch_from_text
        text_with_patch = (
            "Aqui esta o parecer tecnico editorial.\n\n"
            "```json:patch\n"
            "{\n"
            '  "spread_index": 1,\n'
            '  "updates": [{"target": "prod-1", "field": "price", "value": "R$ 1.100"}],\n'
            '  "summary": "Preco atualizado com +10%"\n'
            "}\n"
            "```\n\n"
            "Alteracoes efetuadas com sucesso."
        )
        patch = extract_patch_from_text(text_with_patch)
        self.assertIsNotNone(patch)
        self.assertEqual(patch["spread_index"], 1)
        self.assertEqual(len(patch["updates"]), 1)
        self.assertEqual(patch["updates"][0]["value"], "R$ 1.100")

    def test_seed_templates_command(self):
        """Verifica se o comando de seed popula os templates canonicos e seus vetores"""
        call_command('seed_catalog_templates')
        templates = CatalogTemplate.objects.filter(is_system=True)
        self.assertGreaterEqual(templates.count(), 7)

        for tpl in templates:
            self.assertTrue(len(tpl.embedding) > 0, f"Template {tpl.slug} sem embedding!")
            self.assertTrue("type" in tpl.blueprint_data or "left_page" in tpl.blueprint_data)

    def test_rag_search_with_filtering_and_similarity(self):
        """Verifica a busca hibrida (filtros deterministas + cosseno) do TemplateRAGService"""
        from api.services.template_rag import TemplateRAGService
        call_command('seed_catalog_templates')

        # Busca por capa
        cover_results = TemplateRAGService.search_templates("capa minimalista elegante", category="cover", limit=1)
        self.assertEqual(len(cover_results), 1)
        self.assertEqual(cover_results[0].category, "cover")

        # Busca por grade comercial B2B
        grid_results = TemplateRAGService.search_templates("grade de 4 produtos com precos e atacado", limit=1)
        self.assertEqual(len(grid_results), 1)
        self.assertEqual(grid_results[0].slug, "commercial-grid-4-b2b")

    def test_director_prompt_with_rag_injection(self):
        """Verifica se o prompt montado para o Diretor de Arte recebe a referencia RAG"""
        call_command('seed_catalog_templates')
        director = get_agent('director')
        self.assertIsNotNone(director)

        prompt = director.build_user_prompt(
            user_message="Crie uma capa sofisticada para a colecao de joias",
            catalog_context={"brand_name": "Luxe Joias", "style_preset": "noir_or"}
        )

        self.assertIn("[CONHECIMENTO EDITORIAL E REFERENCIA (RAG - NON-BINDING)]", prompt)
        self.assertIn("Blueprint Estrutural de Referencia", prompt)

    def test_template_list_api_endpoint(self):
        """Verifica o endpoint GET /api/v2/studio/templates/ com e sem filtros"""
        call_command('seed_catalog_templates')
        url = reverse('studio_templates_list')

        # Listagem global
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(response.data["count"], 7)

        # Filtragem por categoria
        cover_resp = self.client.get(f"{url}?category=cover")
        self.assertEqual(cover_resp.status_code, status.HTTP_200_OK)
        for tpl in cover_resp.data["templates"]:
            self.assertEqual(tpl["category"], "cover")

        # Busca semantica via parametro q
        search_resp = self.client.get(f"{url}?q=grade+de+produtos+b2b")
        self.assertEqual(search_resp.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(search_resp.data["count"], 1)

    def test_template_save_from_spread_endpoint(self):
        """Verifica o endpoint POST /api/v2/studio/templates/save-from-spread/"""
        url = reverse('studio_templates_save_from_spread')
        payload = {
            "title": "Meu Template Customizado Lookbook",
            "category": "duo",
            "industry": "luxury_fashion",
            "style_preset": "atelier_silver",
            "description": "Template exclusivo criado pelo usuario.",
            "left_page": {"type": "single", "title": "Pagina Esquerda"},
            "right_page": {"type": "single", "title": "Pagina Direita"},
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("id", response.data)

        created_tpl = CatalogTemplate.objects.get(id=response.data["id"])
        self.assertEqual(created_tpl.title, "Meu Template Customizado Lookbook")
        self.assertFalse(created_tpl.is_system)
        self.assertTrue(len(created_tpl.embedding) > 0)

    def test_background_removal_alpha_channel(self):
        """Verifica se o servico de remocao de fundo produz canal alfa transparente"""
        from api.services.background_removal import BackgroundRemovalService

        # Cria imagem sintetica de 80x80 com fundo branco e circulo central vermelho
        img = Image.new("RGB", (80, 80), color=(255, 255, 255))
        for x in range(30, 50):
            for y in range(30, 50):
                img.putpixel((x, y), (220, 20, 60))

        buf = io.BytesIO()
        img.save(buf, format="PNG")
        image_bytes = buf.getvalue()

        nobg_bytes = BackgroundRemovalService.remove_background(image_bytes)
        out_img = Image.open(io.BytesIO(nobg_bytes))

        self.assertEqual(out_img.mode, "RGBA")
        # O canto (0, 0) que era branco deve ser transparente (alfa == 0)
        self.assertEqual(out_img.getpixel((0, 0))[3], 0)
        # O centro (40, 40) deve permanecer opaco (alfa == 255)
        self.assertEqual(out_img.getpixel((40, 40))[3], 255)

    def test_document_import_pdf_reconstruction(self):
        """A preview creates no catalog; explicit confirmation retains both pages."""
        import tempfile
        import shutil
        from django.test import override_settings
        from api.models import Organization
        private_root = tempfile.mkdtemp(prefix='studio-import-')
        setting = override_settings(DOCUMENT_IMPORT_PRIVATE_ROOT=private_root)
        setting.enable()
        self.addCleanup(setting.disable)
        self.addCleanup(shutil.rmtree, private_root, True)
        organization = Organization.objects.create(name='Import tenant', owner=self.user)
        self.user.organizations.add(organization)
        url = reverse('studio_catalog_import_document')

        # Cria um PDF sintetico com 2 paginas usando pypdf
        import pypdf
        writer = pypdf.PdfWriter()
        writer.add_blank_page(width=794, height=1123)
        writer.add_blank_page(width=794, height=1123)

        pdf_buf = io.BytesIO()
        writer.write(pdf_buf)
        pdf_bytes = pdf_buf.getvalue()

        upload = SimpleUploadedFile("catalogo_fornecedor.pdf", pdf_bytes, content_type="application/pdf")

        response = self.client.post(
            url,
            {
                "file": upload,
                "title": "Colecao Fornecedor 2026",
                "organization": organization.pk,
                "mode": "preserve",
            },
            format="multipart"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertNotIn('catalog_id', response.data)
        self.assertEqual(response.data["total_pages"], 2)
        response = self.client.post(url, {'action': 'confirm', 'import_id': response.data['import_id']}, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)

        # Verifica persistencia no banco
        catalog = StudioCatalog.objects.get(id=response.data["catalog_id"])
        self.assertEqual(catalog.title, "Colecao Fornecedor 2026")
        self.assertEqual(catalog.spreads.count(), 1)
        self.assertEqual(catalog.total_pages, 2)

    def test_remove_background_api_endpoint(self):
        """Verifica a rota POST /api/v2/studio/media/remove-background/ com upload de arquivo"""
        url = reverse('studio_media_remove_background')

        img = Image.new("RGB", (60, 60), color=(255, 255, 255))
        buf = io.BytesIO()
        img.save(buf, format="JPEG")
        img_bytes = buf.getvalue()

        upload = SimpleUploadedFile("sapato.jpg", img_bytes, content_type="image/jpeg")

        response = self.client.post(url, {"image": upload}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("processed_url", response.data)
        self.assertTrue(response.data["has_transparency"])

    def test_billing_plans_list(self):
        """Verifica a rota GET /api/v2/studio/billing/plans/ e precificacao do Cenario A"""
        url = reverse('studio_billing_plans')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        plans = response.data.get("plans", [])
        self.assertEqual(len(plans), 3)

        tiers = {p["tier"]: p for p in plans}
        self.assertIn("free", tiers)
        self.assertIn("pro", tiers)
        self.assertIn("enterprise", tiers)

        # Checa valores do Cenario A
        self.assertEqual(tiers["free"]["price_monthly_brl"], 0.0)
        self.assertEqual(tiers["pro"]["price_monthly_brl"], 67.0)
        self.assertEqual(tiers["pro"]["price_annual_brl"], 49.0)
        self.assertTrue(tiers["pro"]["is_popular"])
        self.assertTrue(tiers["pro"]["can_use_council"])
        self.assertEqual(tiers["enterprise"]["price_monthly_brl"], 197.0)

    def test_billing_subscription_and_checkout_flow(self):
        """Verifica o fluxo completo de consulta de assinatura, checkout com cartao e atualizacao de cota"""
        # 1. Consulta inicial (Plano Gratuito)
        sub_url = reverse('studio_billing_subscription')
        res_sub = self.client.get(sub_url)
        self.assertEqual(res_sub.status_code, status.HTTP_200_OK)
        self.assertEqual(res_sub.data["tier"], "free")
        self.assertEqual(len(res_sub.data["invoices"]), 0)

        # 2. Realizar Upgrade para Pro via Cartao
        checkout_url = reverse('studio_billing_checkout')
        payload = {
            "tier": "pro",
            "interval": "monthly",
            "payment_method_type": "credit_card",
            "payment_details": {
                "last4": "5521",
                "brand": "mastercard",
                "holder_name": "Designer Catana"
            }
        }
        res_checkout = self.client.post(checkout_url, payload, format="json")
        self.assertEqual(res_checkout.status_code, status.HTTP_200_OK)
        self.assertTrue(res_checkout.data["success"])
        self.assertEqual(res_checkout.data["tier"], "pro")
        self.assertEqual(res_checkout.data["amount_brl"], 67.0)

        # 3. Verificar se a cota do usuario foi atualizada imediatamente
        quota_url = reverse('studio_quota_status')
        res_quota = self.client.get(quota_url)
        self.assertEqual(res_quota.status_code, status.HTTP_200_OK)
        self.assertEqual(res_quota.data["tier"], "pro")
        self.assertEqual(res_quota.data["monthly_token_quota"], 1500000)
        self.assertTrue(res_quota.data["can_use_council"])

        # 4. Verificar se a fatura foi gravada no historico
        res_sub_after = self.client.get(sub_url)
        self.assertEqual(res_sub_after.data["tier"], "pro")
        self.assertEqual(len(res_sub_after.data["invoices"]), 1)
        inv = res_sub_after.data["invoices"][0]
        self.assertEqual(inv["amount_brl"], 67.0)
        self.assertEqual(inv["status"], "paid")
        self.assertIn("5521", inv["payment_method_summary"])

    def test_billing_checkout_pix(self):
        """Verifica upgrade utilizando PIX"""
        checkout_url = reverse('studio_billing_checkout')
        payload = {
            "tier": "enterprise",
            "interval": "annual",
            "payment_method_type": "pix",
            "payment_details": {}
        }
        res_checkout = self.client.post(checkout_url, payload, format="json")
        self.assertEqual(res_checkout.status_code, status.HTTP_200_OK)
        self.assertEqual(res_checkout.data["tier"], "enterprise")
        # 159 * 12 = 1908
        self.assertEqual(res_checkout.data["amount_brl"], 1908.0)

    def test_data_export_lgpd(self):
        """Verifica o endpoint de portabilidade e exportacao de dados em conformidade com a LGPD"""
        url = reverse('studio_data_export')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response["Content-Type"], "application/json; charset=utf-8")
        self.assertIn("attachment", response["Content-Disposition"])

        data = json.loads(response.content.decode("utf-8"))
        self.assertIn("export_metadata", data)
        self.assertIn("user_profile", data)
        self.assertEqual(data["user_profile"]["username"], "test_studio_user")
        self.assertIn("catalogs", data)
        self.assertIn("ai_quota", data)

    def test_export_guard_check(self):
        """Verifica validacao de cotas para exportacao de PDF em 150 DPI vs 300 DPI"""
        url = reverse('studio_export_check_guard')

        # 1. 150 DPI (Web/Digital) e liberado para todos
        res_150 = self.client.post(url, {"dpi": 150}, format='json')
        self.assertEqual(res_150.status_code, status.HTTP_200_OK)
        self.assertTrue(res_150.data["allowed"])

        # 2. 300 DPI (Grafica) e bloqueado para plano Free
        res_300_free = self.client.post(url, {"dpi": 300}, format='json')
        self.assertEqual(res_300_free.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(res_300_free.data["allowed"])
        self.assertEqual(res_300_free.data["code"], "export_dpi_restricted")

        # 3. Upgrade para plano Pro libera 300 DPI
        pro_plan = get_or_create_default_plan("pro")
        quota, _ = get_user_quota(self.user)
        quota.plan = pro_plan
        quota.save()

        res_300_pro = self.client.post(url, {"dpi": 300}, format='json')
        self.assertEqual(res_300_pro.status_code, status.HTTP_200_OK)
        self.assertTrue(res_300_pro.data["allowed"])

    def test_import_sheet_products_json(self):
        """Verifica a importacao de produtos via JSON com sanitizacao de precos e persistencia"""
        cat = StudioCatalog.objects.create(
            title="Catalogo Teste Importacao",
            created_by=self.user,
        )
        url = reverse('studio_catalog_product_sheet_import', kwargs={"catalog_id": cat.id})
        payload = {
            "products": [
                {
                    "name": "Bolsa Couro Legítimo",
                    "price": "R$ 1.450,00",
                    "sku": "BLS-001",
                    "category": "Acessórios",
                    "description": "Acabamento premium artesanal.",
                },
                {
                    "name": "Carteira Slim",
                    "price": "289.90",
                    "sku": "",
                    "category": "Couros",
                }
            ]
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 2)
        prods = response.data["products"]
        self.assertEqual(prods[0]["name"], "Bolsa Couro Legítimo")
        self.assertEqual(prods[0]["price"], "R$ 1.450,00")
        self.assertEqual(prods[0]["numeric_price"], 1450.0)
        self.assertEqual(prods[1]["price"], "R$ 289,90")
        self.assertTrue(prods[1]["sku"].startswith("SKU-"))

        # Verifica persistencia no StudioCatalog
        cat.refresh_from_db()
        self.assertEqual(len(cat.unassigned_products), 2)
        self.assertEqual(cat.unassigned_products[0]["sku"], "BLS-001")

        # Verifica sincronizacao no modelo Product
        synced_prod = Product.objects.filter(sku="BLS-001").first()
        self.assertIsNotNone(synced_prod)
        self.assertEqual(synced_prod.name, "Bolsa Couro Legítimo")

    def test_import_sheet_products_csv_file(self):
        """Verifica a importacao direta de arquivo CSV com delimitador e headers comerciais"""
        cat = StudioCatalog.objects.create(
            title="Catalogo CSV Teste",
            created_by=self.user,
        )
        url = reverse('studio_catalog_product_sheet_import', kwargs={"catalog_id": cat.id})
        csv_content = (
            "Nome do Produto;Preço de Venda;Código SKU;Categoria;Descrição\n"
            "Vinho Tinto Reserva;189,50;VNH-778;Bebidas Finas;Safra especial 2020\n"
            "Azeite Extravirgem;75,00;AZT-102;Empório;Acidez máxima 0,2%\n"
        )
        upload = SimpleUploadedFile("tabela_produtos.csv", csv_content.encode("utf-8-sig"), content_type="text/csv")
        response = self.client.post(url, {"file": upload}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 2)

        cat.refresh_from_db()
        self.assertEqual(len(cat.unassigned_products), 2)
        self.assertEqual(cat.unassigned_products[0]["name"], "Vinho Tinto Reserva")
        self.assertEqual(cat.unassigned_products[0]["price"], "R$ 189,50")
        self.assertEqual(cat.unassigned_products[1]["sku"], "AZT-102")

    def test_catalog_detail_with_unassigned_products(self):
        """Verifica serializacao e atualizacao de unassigned_products no GET/PUT de catalogo"""
        cat = StudioCatalog.objects.create(
            title="Catalogo Acervo Teste",
            created_by=self.user,
            unassigned_products=[{"id": "p1", "name": "Item 1", "price": "R$ 50,00"}]
        )
        url = reverse('studio_catalog_detail', kwargs={"pk": cat.id})
        res_get = self.client.get(url)
        self.assertEqual(res_get.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_get.data["unassigned_products"]), 1)
        self.assertEqual(res_get.data["unassigned_products"][0]["name"], "Item 1")

        # Atualiza via PUT
        payload = {
            "unassigned_products": [
                {"id": "p1", "name": "Item 1", "price": "R$ 50,00"},
                {"id": "p2", "name": "Item 2", "price": "R$ 120,00"},
            ]
        }
        res_put = self.client.put(url, payload, format="json")
        self.assertEqual(res_put.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_put.data["unassigned_products"]), 2)

        cat.refresh_from_db()
        self.assertEqual(len(cat.unassigned_products), 2)

    def test_demo_templates_list(self):
        """Verifica listagem dos templates canonicos de demonstracao (Prioridade 4)"""
        url = reverse('studio_demo_templates_list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        templates = response.data.get("templates", [])
        self.assertEqual(len(templates), 4)
        keys = [t["key"] for t in templates]
        self.assertIn("maison_verdana", keys)
        self.assertIn("vektron_systems", keys)
        self.assertIn("atelier_sucre", keys)
        self.assertIn("cristallo_joias", keys)

    def test_demo_catalog_load_authenticated(self):
        """Verifica clonagem e persistencia de catalogo demo no PostgreSQL para usuario autenticado"""
        url = reverse('studio_demo_catalog_load')
        response = self.client.post(url, {"template_key": "vektron_systems"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data.get("persisted"))

        cat_data = response.data.get("catalog", {})
        self.assertIn("VEKTRON", cat_data.get("title", ""))
        self.assertEqual(cat_data.get("total_pages"), 6)
        self.assertEqual(len(cat_data.get("spreads", [])), 3)
        self.assertTrue(len(cat_data.get("unassigned_products", [])) > 0)

        # Verifica persistencia real no banco
        db_cat = StudioCatalog.objects.get(id=cat_data["id"])
        self.assertEqual(db_cat.created_by, self.user)
        self.assertEqual(db_cat.spreads.count(), 3)
        self.assertTrue(db_cat.brand_lock)

    def test_demo_catalog_load_anonymous(self):
        """Verifica carregamento de catalogo demo para usuario anonimo sem quebrar sessao"""
        self.client.force_authenticate(user=None)
        url = reverse('studio_demo_catalog_load')
        response = self.client.post(url, {"template_key": "maison_verdana"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data.get("persisted"))
        cat_data = response.data.get("catalog", {})
        self.assertEqual(cat_data.get("id"), "demo-maison_verdana")
        self.assertEqual(len(cat_data.get("spreads", [])), 3)

    def test_public_catalog_detail_db(self):
        """Verifica acesso publico anonimo a catalogo persistido no PostgreSQL (Prioridade 5)"""
        self.client.force_authenticate(user=None)
        cat = StudioCatalog.objects.create(
            title="Catálogo Público Primavera 2026",
            brand_name="Primavera Haute",
            created_by=self.user,
            total_pages=2,
            primary_color="#18181B",
            accent_color="#B08D57",
        )
        CatalogSpread.objects.create(
            catalog=cat,
            spread_index=0,
            title="Lâmina 1",
            left_page_elements=[{"id": "p1", "type": "cover", "title": "Capa"}],
            right_page_elements=[{"id": "p2", "type": "manifesto", "title": "Manifesto"}],
        )

        url = reverse('studio_public_catalog_detail', kwargs={"catalog_id": cat.id})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data.get("id"), str(cat.id))
        self.assertEqual(response.data.get("title"), "Catálogo Público Primavera 2026")
        self.assertEqual(response.data.get("brand_name"), "Primavera Haute")
        self.assertEqual(len(response.data.get("spreads", [])), 1)
        self.assertFalse(response.data.get("is_demo"))
        # Verifica que dados sensiveis nao foram vazados
        self.assertNotIn("created_by", response.data)
        self.assertNotIn("organization", response.data)

    def test_public_catalog_detail_demo(self):
        """Verifica acesso publico anonimo a catalogo demo canônico (Prioridade 5)"""
        self.client.force_authenticate(user=None)
        # Teste com chave canônica pura
        url = reverse('studio_public_catalog_detail', kwargs={"catalog_id": "maison_verdana"})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data.get("id"), "maison_verdana")
        self.assertEqual(response.data.get("brand_name"), "Maison Verdana")
        self.assertTrue(response.data.get("is_demo"))
        self.assertEqual(len(response.data.get("spreads", [])), 3)

        # Teste com prefixo demo-
        url_prefixed = reverse('studio_public_catalog_detail', kwargs={"catalog_id": "demo-vektron_systems"})
        res_prefixed = self.client.get(url_prefixed)
        self.assertEqual(res_prefixed.status_code, status.HTTP_200_OK)
        self.assertEqual(res_prefixed.data.get("id"), "vektron_systems")

    def test_public_catalog_detail_not_found(self):
        """Verifica resposta 404 para ID inexistente no endpoint publico (Prioridade 5)"""
        self.client.force_authenticate(user=None)
        url = reverse('studio_public_catalog_detail', kwargs={"catalog_id": "99999999"})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertIn("error", response.data)






    def test_imported_pt_text_command_streams_patch_and_separated_guard_metadata(self):
        from unittest.mock import patch
        from api.ai.provider import GeminiAIProvider
        import tempfile
        import shutil
        from django.test import override_settings
        from api.models import Organization
        from api.tests_document_adapter import synthetic_pdf
        from api.services.document_reconstructor import DocumentReconstructorService
        private_root=tempfile.mkdtemp(prefix='studio-command-')
        setting=override_settings(DOCUMENT_IMPORT_PRIVATE_ROOT=private_root)
        setting.enable()
        self.addCleanup(setting.disable)
        self.addCleanup(shutil.rmtree,private_root,True)
        organization=Organization.objects.create(name='Command tenant',owner=self.user)
        self.user.organizations.add(organization)
        job=DocumentReconstructorService.analyze_file(synthetic_pdf([{'content':'BT /F1 20 Tf 30 100 Td (CATALOGO DE PRODUTOS) Tj ET'}]),'source.pdf',self.user,organization,mode='editable')
        job,_=DocumentReconstructorService.confirm_import(job,self.user,mode='editable')
        source=next(e for e in job.previews[0]['documentPage']['elements'] if e.get('editable'))
        provider = GeminiAIProvider(api_key='')
        provider.client = None
        with patch('api.ai.agents.base.get_ai_provider', return_value=provider), patch('api.ai.agents.base.TemplateRAGService.retrieve_best_template_prompt', return_value='Brand PL Design; imported geometry unit pt'):
            response = self.client.post(reverse('studio_chat_stream'), {
                'message': 'altere catálogo de produtos para catálogo de itens',
                'catalog_id':job.catalog_id, 'agent_role': 'orchestrator', 'active_spread_data': {'left_page': {'unit': 'pt'}},
                'editable_text_index': [],
            }, format='json')
            events = [json.loads(line[6:]) for line in b''.join(response.streaming_content).decode().splitlines() if line.startswith('data: ')]
        patch_event = next(event for event in events if event['event'] == 'patch')
        self.assertEqual(patch_event['patch']['actions'][0]['target'], f"page:1/element:{source['id']}")
        done = next(event for event in events if event['event'] == 'done')
        self.assertEqual(done['metadata']['user_guard_status'], 'PASSED')
        self.assertEqual(done['metadata']['provider'], 'local-command-planner')
        self.assertNotIn('neutralidade institucional', json.dumps(events, ensure_ascii=False))

    def test_chat_rejects_swapped_or_oversized_user_boundary_before_creating_history(self):
        for message in [{'unit': 'pt'}, ['edit'], 'x' * 20001]:
            response = self.client.post(reverse('studio_chat_stream'), {'message': message}, format='json')
            self.assertEqual(response.status_code, 400)
            self.assertEqual(response.data['code'], 'invalid_user_boundary')
        self.assertEqual(ChatMessage.objects.count(), 0)
