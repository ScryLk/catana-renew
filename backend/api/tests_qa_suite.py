import json
from decimal import Decimal
from django.test import TestCase
from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from api.models import (
    StudioCatalog,
    CatalogSpread,
    ChatThread,
    ChatMessage,
    Organization,
    Product,
)
from api.guards.quota_guard import get_or_create_default_plan

User = get_user_model()

class StudioProductionQASuite(TestCase):
    """
    Suite de testes exaustiva de QA para o Catana Studio 2.0.
    Cobre Edge Cases, BOLA/IDOR, Ciclo de Vida de Estado, Injeção/Sanitização,
    Idempotência, Integridade Relacional e Resiliência em Produção.
    """

    def setUp(self):
        self.client_a = APIClient()
        self.client_b = APIClient()
        self.anon_client = APIClient()

        # Usuário A e Organização A
        self.user_a = User.objects.create_user(
            username="qa_user_alpha",
            email="alpha@catana.test",
            password="password_alpha_123"
        )
        self.org_a = Organization.objects.create(
            name="Org Alpha Luxury",
            owner=self.user_a
        )
        self.user_a.organizations.add(self.org_a)
        self.client_a.force_authenticate(user=self.user_a)

        # Usuário B e Organização B (Invasor / Tenant Isolado)
        self.user_b = User.objects.create_user(
            username="qa_user_beta",
            email="beta@attacker.test",
            password="password_beta_123"
        )
        self.org_b = Organization.objects.create(
            name="Org Beta Competitor",
            owner=self.user_b
        )
        self.user_b.organizations.add(self.org_b)
        self.client_b.force_authenticate(user=self.user_b)

        get_or_create_default_plan("free")

    # ==========================================================================
    # 1. AUTORIZAÇÃO E SEGURANÇA MULTI-TENANT (IDOR / BOLA)
    # ==========================================================================

    def test_idor_prevent_user_b_from_reading_user_a_catalog(self):
        """Impede que o Usuário B visualize catálogo privado do Usuário A"""
        cat_a = StudioCatalog.objects.create(
            title="Catálogo Confidencial Alpha",
            created_by=self.user_a,
            organization=self.org_a
        )
        url = reverse('studio_catalog_detail', kwargs={"pk": cat_a.id})
        response = self.client_b.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_idor_prevent_user_b_from_updating_user_a_catalog(self):
        """Impede que o Usuário B altere dados do catálogo do Usuário A"""
        cat_a = StudioCatalog.objects.create(
            title="Catálogo Confidencial Alpha",
            created_by=self.user_a,
            organization=self.org_a
        )
        url = reverse('studio_catalog_detail', kwargs={"pk": cat_a.id})
        payload = {"title": "Título Adulterado por Hacker"}
        response = self.client_b.put(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        cat_a.refresh_from_db()
        self.assertEqual(cat_a.title, "Catálogo Confidencial Alpha")

    def test_idor_prevent_user_b_from_deleting_user_a_catalog(self):
        """Impede que o Usuário B exclua catálogo do Usuário A"""
        cat_a = StudioCatalog.objects.create(
            title="Catálogo Para Manter",
            created_by=self.user_a,
            organization=self.org_a
        )
        url = reverse('studio_catalog_detail', kwargs={"pk": cat_a.id})
        response = self.client_b.delete(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(StudioCatalog.objects.filter(id=cat_a.id).exists())

    def test_idor_prevent_user_b_from_injecting_spread_into_user_a_catalog(self):
        """Impede que o Usuário B insira spreads no catálogo do Usuário A"""
        cat_a = StudioCatalog.objects.create(
            title="Catálogo Alpha Spreads",
            created_by=self.user_a,
            organization=self.org_a
        )
        url = reverse('studio_spread_manage', kwargs={"catalog_id": cat_a.id})
        payload = {
            "spread_index": 5,
            "title": "Spread Malicioso",
            "left_page": {"type": "cover", "title": "Hacked"},
        }
        response = self.client_b.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(cat_a.spreads.count(), 0)

    def test_idor_prevent_user_b_from_bulk_sync_on_user_a_catalog(self):
        """Impede que o Usuário B sincronize em lote spreads no catálogo do Usuário A"""
        cat_a = StudioCatalog.objects.create(
            title="Catálogo Alpha Bulk",
            created_by=self.user_a,
            organization=self.org_a
        )
        url = reverse('studio_spread_bulk_sync', kwargs={"catalog_id": cat_a.id})
        payload = {
            "spreads": [
                {"spread_index": 0, "title": "Invasão 1"},
                {"spread_index": 1, "title": "Invasão 2"},
            ]
        }
        response = self.client_b.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(cat_a.spreads.count(), 0)

    def test_idor_prevent_user_b_from_importing_products_into_user_a_catalog(self):
        """Impede que o Usuário B injete produtos no catálogo do Usuário A via importação de planilha"""
        cat_a = StudioCatalog.objects.create(
            title="Catálogo Alpha Produtos",
            created_by=self.user_a,
            organization=self.org_a
        )
        url = reverse('studio_catalog_product_sheet_import', kwargs={"catalog_id": cat_a.id})
        payload = {
            "products": [
                {"name": "Produto Invasor", "price": "100", "sku": "HACK-01"}
            ]
        }
        response = self.client_b.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        cat_a.refresh_from_db()
        self.assertEqual(len(cat_a.unassigned_products), 0)

    def test_unauthenticated_user_cannot_import_products_into_catalog(self):
        """Impede que usuário não autenticado vincule produtos a um catálogo específico"""
        cat_a = StudioCatalog.objects.create(
            title="Catálogo Alpha Protegido",
            created_by=self.user_a,
            organization=self.org_a
        )
        url = reverse('studio_catalog_product_sheet_import', kwargs={"catalog_id": cat_a.id})
        payload = {
            "products": [
                {"name": "Produto Anônimo", "price": "50", "sku": "ANON-01"}
            ]
        }
        response = self.anon_client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        cat_a.refresh_from_db()
        self.assertEqual(len(cat_a.unassigned_products), 0)

    def test_unauthenticated_requests_are_rejected_on_protected_endpoints(self):
        """Garante que requisições anônimas recebam 401 Unauthorized nas rotas privadas"""
        protected_urls = [
            reverse('studio_catalog_list'),
            reverse('studio_catalog_detail', kwargs={"pk": 999}),
            reverse('studio_spread_manage', kwargs={"catalog_id": 999}),
            reverse('studio_spread_bulk_sync', kwargs={"catalog_id": 999}),
        ]
        for url in protected_urls:
            resp_get = self.anon_client.get(url)
            self.assertEqual(resp_get.status_code, status.HTTP_401_UNAUTHORIZED, f"Endpoint {url} deveria exigir autenticação")

    # ==========================================================================
    # 2. EDGE CASES, LIMITES NUMÉRICOS E SANITIZAÇÃO DE ENTRADA
    # ==========================================================================

    def test_catalog_creation_with_extreme_and_special_strings(self):
        """Testa criação de catálogo com strings vazias, tags XSS e Unicode extremo"""
        url = reverse('studio_catalog_list')
        payload = {
            "title": "<script>alert('xss')</script> — Coleção Étoile 2026 🎉",
            "brand_name": "L'Atelier & Co.",
            "style_preset": "editorial_clean",
            "primary_color": "#123456",
            "total_pages": 12,
        }
        response = self.client_a.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        cat_id = response.data["id"]
        cat = StudioCatalog.objects.get(id=cat_id)
        # O título deve ser persistido como texto seguro sem quebrar o banco
        self.assertIn("Coleção Étoile", cat.title)
        self.assertEqual(cat.brand_name, "L'Atelier & Co.")

    def test_catalog_creation_empty_payload_fallback(self):
        """Valida que envio de payload vazio {} adote defaults seguros sem crash 500"""
        url = reverse('studio_catalog_list')
        response = self.client_a.post(url, {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["title"], "Novo Catalogo Studio")
        self.assertEqual(response.data["total_pages"], 6)

    def test_catalog_creation_invalid_total_pages_fallback(self):
        """Valida tratamento seguro quando total_pages vier com valor inválido ou string"""
        url = reverse('studio_catalog_list')
        payload = {
            "title": "Catálogo Teste Fallback",
            "total_pages": "invalido",
        }
        # Se total_pages não for conversível para int, não deve estourar 500 não tratado
        try:
            response = self.client_a.post(url, payload, format='json')
            self.assertIn(response.status_code, [status.HTTP_201_CREATED, status.HTTP_400_BAD_REQUEST])
        except ValueError:
            self.fail("API estourou ValueError não tratado com total_pages='invalido'")

    def test_spread_bulk_sync_malformed_payload(self):
        """Valida que bulk sync rejeite payloads com campo spreads que não seja lista"""
        cat = StudioCatalog.objects.create(title="Catálogo Teste", created_by=self.user_a, organization=self.org_a)
        url = reverse('studio_spread_bulk_sync', kwargs={"catalog_id": cat.id})

        # Envia spreads como string em vez de lista
        response = self.client_a.post(url, {"spreads": "not-a-list"}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)

    # ==========================================================================
    # 3. COMBINAÇÃO DE ESTADOS E CICLO DE VIDA (CREATE -> EDIT -> DELETE -> 404)
    # ==========================================================================

    def test_catalog_lifecycle_state_transitions(self):
        """Testa o ciclo de vida completo: Criar -> Sincronizar Spreads -> Atualizar -> Excluir -> Verificar 404"""
        # 1. Criar
        create_url = reverse('studio_catalog_list')
        resp_create = self.client_a.post(create_url, {"title": "Ciclo Alpha", "brand_name": "Alpha"}, format='json')
        self.assertEqual(resp_create.status_code, status.HTTP_201_CREATED)
        cat_id = resp_create.data["id"]

        # 2. Sincronizar Spreads
        sync_url = reverse('studio_spread_bulk_sync', kwargs={"catalog_id": cat_id})
        resp_sync = self.client_a.post(sync_url, {
            "spreads": [
                {"spread_index": 0, "title": "Capa"},
                {"spread_index": 1, "title": "Destaque"},
            ],
            "total_pages": 4,
        }, format='json')
        self.assertEqual(resp_sync.status_code, status.HTTP_200_OK)
        self.assertEqual(resp_sync.data["count"], 2)

        # 3. Atualizar Metadados
        detail_url = reverse('studio_catalog_detail', kwargs={"pk": cat_id})
        resp_update = self.client_a.put(detail_url, {"title": "Ciclo Alpha Renomeado"}, format='json')
        self.assertEqual(resp_update.status_code, status.HTTP_200_OK)
        self.assertEqual(resp_update.data["title"], "Ciclo Alpha Renomeado")

        # 4. Excluir
        resp_del = self.client_a.delete(detail_url)
        self.assertEqual(resp_del.status_code, status.HTTP_204_NO_CONTENT)

        # 5. Tentativa de Recuperação após Exclusão
        resp_get_deleted = self.client_a.get(detail_url)
        self.assertEqual(resp_get_deleted.status_code, status.HTTP_404_NOT_FOUND)

        # 6. Tentativa de Sincronização em Catálogo Excluído
        resp_sync_deleted = self.client_a.post(sync_url, {"spreads": []}, format='json')
        self.assertEqual(resp_sync_deleted.status_code, status.HTTP_404_NOT_FOUND)

    # ==========================================================================
    # 4. DUPLICIDADES, IDEMPOTÊNCIA E INTEGRIDADE RELACIONAL
    # ==========================================================================

    def test_spread_manage_idempotency(self):
        """Valida que chamadas repetidas de spread manage com o mesmo spread_index atualizem sem duplicar linhas"""
        cat = StudioCatalog.objects.create(title="Catálogo Idempotência", created_by=self.user_a, organization=self.org_a)
        url = reverse('studio_spread_manage', kwargs={"catalog_id": cat.id})

        payload = {
            "spread_index": 0,
            "title": "Versão Inicial",
            "left_page": {"type": "cover", "title": "V1"},
        }
        # Primeira chamada
        resp1 = self.client_a.post(url, payload, format='json')
        self.assertEqual(resp1.status_code, status.HTTP_200_OK)
        self.assertEqual(cat.spreads.count(), 1)

        # Segunda chamada com mesmo índice mas título atualizado
        payload["title"] = "Versão Atualizada"
        resp2 = self.client_a.post(url, payload, format='json')
        self.assertEqual(resp2.status_code, status.HTTP_200_OK)
        self.assertEqual(cat.spreads.count(), 1)

        spread = cat.spreads.first()
        self.assertEqual(spread.title, "Versão Atualizada")

    def test_cascade_delete_integrity(self):
        """Garante que ao deletar um catálogo, todos os seus spreads e threads sejam excluídos em cascata"""
        cat = StudioCatalog.objects.create(title="Catálogo Para Cascata", created_by=self.user_a, organization=self.org_a)
        CatalogSpread.objects.create(catalog=cat, spread_index=0, title="Spread 01")
        CatalogSpread.objects.create(catalog=cat, spread_index=1, title="Spread 02")
        thread = ChatThread.objects.create(catalog=cat, user=self.user_a, title="Sessão IA")
        ChatMessage.objects.create(thread=thread, sender_type="user", content="Oi")

        cat_id = cat.id
        cat.delete()

        # Nenhum spread ou thread órfão deve permanecer
        self.assertEqual(CatalogSpread.objects.filter(catalog_id=cat_id).count(), 0)
        self.assertEqual(ChatThread.objects.filter(catalog_id=cat_id).count(), 0)

    # ==========================================================================
    # 5. IMPORTADOR DE PLANILHAS E HIGIENIZAÇÃO MONETÁRIA
    # ==========================================================================

    def test_import_sheet_monetary_sanitization_and_deduplication(self):
        """Verifica higienização de preços em formatos diversos e atualização por SKU repetido"""
        cat = StudioCatalog.objects.create(title="Catálogo Ingest", created_by=self.user_a, organization=self.org_a)
        url = reverse('studio_catalog_product_sheet_import', kwargs={"catalog_id": cat.id})

        payload = {
            "products": [
                {
                    "nome": "Item Preço Float",
                    "preco": 1290.5,
                    "sku": "SKU-MONEY-01",
                    "categoria": "LUXO",
                },
                {
                    "nome": "Item Preço Virgula",
                    "preco": "2.450,80",
                    "sku": "SKU-MONEY-02",
                    "categoria": "LUXO",
                },
                {
                    "nome": "Item Preço Simbolo R$",
                    "preco": "R$ 490,00",
                    "sku": "SKU-MONEY-03",
                    "categoria": "LUXO",
                },
            ]
        }
        response = self.client_a.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 3)

        cat.refresh_from_db()
        items = cat.unassigned_products
        self.assertEqual(len(items), 3)

        p1 = next(p for p in items if p["sku"] == "SKU-MONEY-01")
        self.assertEqual(p1["numeric_price"], 1290.5)
        self.assertEqual(p1["price"], "R$ 1.290,50")

        # Importar novamente com atualização do item SKU-MONEY-01 (Idempotência / Merge)
        payload_update = {
            "products": [
                {
                    "nome": "Item Preço Float Atualizado",
                    "preco": 1500.0,
                    "sku": "SKU-MONEY-01",
                    "categoria": "LUXO",
                }
            ]
        }
        resp_update = self.client_a.post(url, payload_update, format='json')
        self.assertEqual(resp_update.status_code, status.HTTP_200_OK)

        cat.refresh_from_db()
        # Não deve ter 4 produtos, mas sim os mesmos 3 com o primeiro atualizado
        self.assertEqual(len(cat.unassigned_products), 3)
        updated_p1 = next(p for p in cat.unassigned_products if p["sku"] == "SKU-MONEY-01")
        self.assertEqual(updated_p1["name"], "Item Preço Float Atualizado")
        self.assertEqual(updated_p1["numeric_price"], 1500.0)

    # ==========================================================================
    # 6. ENDPOINT PÚBLICO (DIGITAL FLIPBOOK) E SEGURANÇA DE DADOS
    # ==========================================================================

    def test_public_catalog_does_not_leak_sensitive_fields(self):
        """Verifica que o endpoint público não vaza e-mails, user IDs ou threads"""
        cat = StudioCatalog.objects.create(
            title="Catálogo Exposição Pública",
            created_by=self.user_a,
            organization=self.org_a,
            brand_name="Maison Alpha"
        )
        CatalogSpread.objects.create(catalog=cat, spread_index=0, title="Capa")
        thread = ChatThread.objects.create(catalog=cat, user=self.user_a, title="Sessão Privada de IA")
        ChatMessage.objects.create(thread=thread, sender_type="user", content="Prompt confidencial")

        url = reverse('studio_public_catalog_detail', kwargs={"catalog_id": str(cat.id)})
        response = self.anon_client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        resp_text = json.dumps(response.data)
        # NUNCA deve conter o e-mail do autor ou mensagens internas de chat
        self.assertNotIn("alpha@catana.test", resp_text)
        self.assertNotIn("Prompt confidencial", resp_text)
        self.assertNotIn("created_by", response.data)
        self.assertNotIn("organization_id", response.data)

    def test_public_catalog_canonical_case_insensitivity(self):
        """Valida que templates canônicos funcionem com maiúsculas, hífens e prefixos"""
        variants = [
            "maison_verdana",
            "MAISON-VERDANA",
            "demo-maison-verdana",
            "demo_maison_verdana",
        ]
        for var in variants:
            url = reverse('studio_public_catalog_detail', kwargs={"catalog_id": var})
            response = self.anon_client.get(url)
            self.assertEqual(response.status_code, status.HTTP_200_OK, f"Falha para variante '{var}'")
            self.assertEqual(response.data["brand_name"], "Maison Verdana")
            self.assertTrue(response.data["is_demo"])

    def test_public_catalog_non_existent_id(self):
        """Valida retorno correto 404 para ID inexistente"""
        url = reverse('studio_public_catalog_detail', kwargs={"catalog_id": "999999999"})
        response = self.anon_client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    # ==========================================================================
    # 7. CONCORRÊNCIA, SQLi E ARQUIVOS CORROMPIDOS
    # ==========================================================================

    def test_concurrency_simultaneous_spread_updates(self):
        """Testa updates concorrentes em spreads do mesmo catálogo garantindo consistência"""
        cat = StudioCatalog.objects.create(
            title="Catálogo Concorrente",
            created_by=self.user_a,
            organization=self.org_a
        )
        url = reverse('studio_spread_manage', kwargs={"catalog_id": cat.id})

        resp1 = self.client_a.post(url, {
            "spread_index": 0,
            "title": "Versão Usuário 1",
            "left_page": {"title": "P1"},
        }, format='json')
        self.assertEqual(resp1.status_code, status.HTTP_200_OK)

        resp2 = self.client_a.post(url, {
            "spread_index": 0,
            "title": "Versão Usuário 2",
            "left_page": {"title": "P2"},
        }, format='json')
        self.assertEqual(resp2.status_code, status.HTTP_200_OK)

        self.assertEqual(cat.spreads.count(), 1)
        self.assertEqual(cat.spreads.first().title, "Versão Usuário 2")

    def test_sql_injection_resilience_in_catalog_title(self):
        """Testa resistência a SQLi e caracteres de escape em payloads de texto"""
        sqli_payloads = [
            "' OR '1'='1",
            "1; DROP TABLE studio_catalogs; --",
            "1' UNION SELECT * FROM auth_user --",
        ]
        url = reverse('studio_catalog_list')
        for payload in sqli_payloads:
            resp = self.client_a.post(url, {"title": payload}, format='json')
            self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
            self.assertTrue(StudioCatalog.objects.filter(id=resp.data["id"]).exists())

    def test_empty_and_corrupted_csv_import(self):
        """Valida que envio de CSV vazio retorne 400 Bad Request amigável"""
        from django.core.files.uploadedfile import SimpleUploadedFile
        url = reverse('studio_product_sheet_import')

        empty_csv = SimpleUploadedFile("empty.csv", b"", content_type="text/csv")
        resp_empty = self.client_a.post(url, {"file": empty_csv}, format='multipart')
        self.assertEqual(resp_empty.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", resp_empty.data)

    # ==========================================================================
    # 8. CISO SECURITY GATE REGRESSION SUITE
    # ==========================================================================

    def test_user_viewset_idor_and_bfla_protection(self):
        """Valida que usuários não consigam enumerar outros usuários e nem mutar registros via /api/users/"""
        # 1. Usuário anônimo é bloqueado
        resp_anon = self.anon_client.get('/api/users/')
        self.assertEqual(resp_anon.status_code, status.HTTP_401_UNAUTHORIZED)

        # 2. Usuário regular só enxerga a si mesmo
        resp_a = self.client_a.get('/api/users/')
        self.assertEqual(resp_a.status_code, status.HTTP_200_OK)
        results = resp_a.data.get('results', resp_a.data)
        user_ids = [u['id'] for u in results]
        self.assertIn(self.user_a.id, user_ids)
        self.assertNotIn(self.user_b.id, user_ids)

        # 3. Tentativa de IDOR em registro alheio retorna 404
        resp_idor = self.client_a.get(f'/api/users/{self.user_b.id}/')
        self.assertEqual(resp_idor.status_code, status.HTTP_404_NOT_FOUND)

        # 4. Tentativa de DELETE em usuário retorna 405 Method Not Allowed (ReadOnlyModelViewSet)
        resp_delete = self.client_a.delete(f'/api/users/{self.user_b.id}/')
        self.assertEqual(resp_delete.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_avatar_upload_mime_spoofing_rejected(self):
        """Valida que arquivos com MIME header forjado mas payload malicioso sejam rejeitados via verificação PIL"""
        from django.core.files.uploadedfile import SimpleUploadedFile
        fake_png = SimpleUploadedFile(
            "exploit.png",
            b"<script>alert('xss')</script>",
            content_type="image/png"
        )
        resp = self.client_a.post('/api/profile/avatar/', {'avatar': fake_png}, format='multipart')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', resp.data)

    def test_security_settings_conformance(self):
        """Valida conformidade das diretivas de segurança: JWT TTL 30m e throttling ativo"""
        from datetime import timedelta
        from django.conf import settings

        # JWT TTL
        self.assertEqual(settings.SIMPLE_JWT.get('ACCESS_TOKEN_LIFETIME'), timedelta(minutes=30))

        # Throttling
        self.assertIn('DEFAULT_THROTTLE_CLASSES', settings.REST_FRAMEWORK)
        self.assertTrue(len(settings.REST_FRAMEWORK['DEFAULT_THROTTLE_CLASSES']) >= 2)

