from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from api.models import User, Organization, StudioCatalog, ChatThread, ChatMessage, CatalogSpread

class UserDataIsolationTests(TestCase):
    """
    Testes estruturais de isolamento de dados entre multiplas contas.
    Garante que a Conta A nunca acessa, altera ou exclui dados da Conta B,
    e que IDOR / cross-tenant leaks sao estritamente bloqueados (404/403).
    """

    def setUp(self):
        # Usuario A
        self.user_a = User.objects.create_user(
            username="user_a",
            email="user_a@test.com",
            password="PasswordA123!"
        )
        self.org_a = Organization.objects.create(name="Org A", owner=self.user_a)
        self.user_a.organizations.add(self.org_a)

        # Usuario B
        self.user_b = User.objects.create_user(
            username="user_b",
            email="user_b@test.com",
            password="PasswordB123!"
        )
        self.org_b = Organization.objects.create(name="Org B", owner=self.user_b)
        self.user_b.organizations.add(self.org_b)

        # Catalogo e Thread criados pelo Usuario A
        self.catalog_a = StudioCatalog.objects.create(
            title="Catalogo Secreto Usuario A",
            brand_name="Maison Alpha",
            created_by=self.user_a,
            organization=self.org_a,
        )
        self.spread_a = CatalogSpread.objects.create(
            catalog=self.catalog_a,
            spread_index=0,
            title="Capa Alpha",
            left_page_elements=[{"type": "heading", "content": "Alpha Secret"}],
            right_page_elements=[],
        )
        self.thread_a = ChatThread.objects.create(
            catalog=self.catalog_a,
            user=self.user_a,
            title="Chat Privado A",
            active_agent="orchestrator",
        )
        self.msg_a = ChatMessage.objects.create(
            thread=self.thread_a,
            sender_type="user",
            content="Instrucao confidencial da Conta A",
        )

        self.client_a = APIClient()
        self.client_a.force_authenticate(user=self.user_a)

        self.client_b = APIClient()
        self.client_b.force_authenticate(user=self.user_b)

    def test_user_a_can_list_own_catalogs_and_user_b_sees_empty(self):
        """Usuario A ve seus proprios catalogos; Usuario B nao ve catalogos do Usuario A."""
        # Usuario A lista
        res_a = self.client_a.get('/api/v2/studio/catalogs/')
        self.assertEqual(res_a.status_code, status.HTTP_200_OK)
        catalog_ids_a = [c['id'] for c in res_a.data]
        self.assertIn(self.catalog_a.id, catalog_ids_a)

        # Usuario B lista
        res_b = self.client_b.get('/api/v2/studio/catalogs/')
        self.assertEqual(res_b.status_code, status.HTTP_200_OK)
        catalog_ids_b = [c['id'] for c in res_b.data]
        self.assertNotIn(self.catalog_a.id, catalog_ids_b)
        self.assertEqual(len(catalog_ids_b), 0)

    def test_user_b_cannot_get_user_a_catalog_detail(self):
        """Usuario B nao pode acessar detalhes de catalogo pertencente ao Usuario A (404)."""
        res = self.client_b.get(f'/api/v2/studio/catalogs/{self.catalog_a.id}/')
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_user_b_cannot_update_user_a_catalog(self):
        """Usuario B nao pode alterar catalogo pertencente ao Usuario A (404)."""
        res = self.client_b.put(
            f'/api/v2/studio/catalogs/{self.catalog_a.id}/',
            {"title": "Hacked Title by User B"},
            format='json'
        )
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)
        self.catalog_a.refresh_from_db()
        self.assertEqual(self.catalog_a.title, "Catalogo Secreto Usuario A")

    def test_user_b_cannot_delete_user_a_catalog(self):
        """Usuario B nao pode excluir catalogo pertencente ao Usuario A (404)."""
        res = self.client_b.delete(f'/api/v2/studio/catalogs/{self.catalog_a.id}/')
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(StudioCatalog.objects.filter(id=self.catalog_a.id).exists())

    def test_user_b_cannot_access_user_a_chat_thread_messages(self):
        """Usuario B nao pode acessar historico de chat pertencente ao Usuario A (404)."""
        res = self.client_b.get(f'/api/v2/studio/threads/{self.thread_a.id}/messages/')
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_user_b_cannot_stream_into_user_a_catalog_or_thread(self):
        """Usuario B nao pode injetar mensagens no catalogo ou thread do Usuario A (404)."""
        res_cat = self.client_b.post(
            '/api/v2/studio/chat/stream/',
            {"message": "Ataque", "catalog_id": str(self.catalog_a.id)},
            format='json'
        )
        self.assertEqual(res_cat.status_code, status.HTTP_404_NOT_FOUND)

        res_thread = self.client_b.post(
            '/api/v2/studio/chat/stream/',
            {"message": "Ataque", "thread_id": str(self.thread_a.id)},
            format='json'
        )
        self.assertEqual(res_thread.status_code, status.HTTP_404_NOT_FOUND)

    def test_catalog_creation_forces_authenticated_user_as_owner(self):
        """Ao criar catalogo, created_by e obrigatoriamente request.user mesmo se payload enviar outro ID."""
        res = self.client_a.post(
            '/api/v2/studio/catalogs/',
            {
                "title": "Catalogo Legítimo A",
                "created_by": self.user_b.id, # tentativa de spoofing
                "user_id": self.user_b.id,
            },
            format='json'
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        new_catalog = StudioCatalog.objects.get(id=res.data['id'])
        self.assertEqual(new_catalog.created_by, self.user_a)
        self.assertNotEqual(new_catalog.created_by, self.user_b)
