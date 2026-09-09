from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.token_blacklist.models import OutstandingToken, BlacklistedToken

from api.models import Organization, Sede, StudioCatalog, SubscriptionPlan

User = get_user_model()


class CatanaAuthTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='designer1',
            email='designer1@catana.dev',
            password='SecretPassword123!',
            role='editor'
        )
        self.org = Organization.objects.create(name='Design Studio Org', owner=self.user)
        self.sede = Sede.objects.create(name='Sede SP', organization=self.org, responsible_user=self.user)
        self.org.default_sede = self.sede
        self.org.save()
        self.user.organizations.add(self.org)
        self.user.sedes.add(self.sede)

        # Segundo usuario para teste de isolamento
        self.user2 = User.objects.create_user(
            username='designer2',
            email='designer2@catana.dev',
            password='SecretPassword123!',
            role='editor'
        )
        self.org2 = Organization.objects.create(name='Org 2', owner=self.user2)
        self.user2.organizations.add(self.org2)

    def test_login_with_username(self):
        response = self.client.post('/api/auth/token/', {
            'username': 'designer1',
            'password': 'SecretPassword123!'
        })
        self.assertEqual(response.status_code, 200)
        self.assertIn('access', response.data)
        self.assertIn('user', response.data)
        self.assertEqual(response.data['user']['email'], 'designer1@catana.dev')

        # Verifica presenca do cookie HttpOnly
        self.assertIn('catana_refresh_token', response.cookies)
        cookie = response.cookies['catana_refresh_token']
        self.assertTrue(cookie['httponly'])
        self.assertEqual(cookie['samesite'], 'Lax')

    def test_login_with_email_case_insensitive(self):
        response = self.client.post('/api/auth/token/', {
            'username': 'DESIGNER1@CATANA.DEV',
            'password': 'SecretPassword123!'
        })
        self.assertEqual(response.status_code, 200)
        self.assertIn('access', response.data)
        self.assertEqual(response.data['user']['username'], 'designer1')

    def test_silent_refresh_via_cookie(self):
        # Primeiro faz login
        login_res = self.client.post('/api/auth/token/', {
            'username': 'designer1',
            'password': 'SecretPassword123!'
        })
        self.assertEqual(login_res.status_code, 200)
        raw_refresh = login_res.cookies['catana_refresh_token'].value

        # Realiza refresh enviando o cookie
        refresh_client = APIClient()
        refresh_client.cookies['catana_refresh_token'] = raw_refresh
        refresh_res = refresh_client.post('/api/auth/token/refresh/')
        self.assertEqual(refresh_res.status_code, 200)
        self.assertIn('access', refresh_res.data)

        # Rotacao: o novo cookie deve ter sido emitido
        self.assertIn('catana_refresh_token', refresh_res.cookies)
        new_refresh = refresh_res.cookies['catana_refresh_token'].value
        self.assertNotEqual(raw_refresh, new_refresh)

        # O refresh token antigo deve estar na blacklist
        with self.assertRaises(Exception):
            RefreshToken(raw_refresh)

    def test_logout_blacklists_token_and_deletes_cookie(self):
        login_res = self.client.post('/api/auth/token/', {
            'username': 'designer1',
            'password': 'SecretPassword123!'
        })
        raw_refresh = login_res.cookies['catana_refresh_token'].value

        client = APIClient()
        client.cookies['catana_refresh_token'] = raw_refresh
        logout_res = client.post('/api/auth/logout/')
        self.assertEqual(logout_res.status_code, 200)

        # O cookie deve ter sido expirado/deletado
        self.assertEqual(logout_res.cookies['catana_refresh_token'].value, '')

        # Tentar refresh com o token antigo deve falhar com 401
        retry_res = client.post('/api/auth/token/refresh/', {'refresh': raw_refresh})
        self.assertEqual(retry_res.status_code, 401)

    def test_logout_all_sessions(self):
        # Emite 2 tokens
        t1 = RefreshToken.for_user(self.user)
        t2 = RefreshToken.for_user(self.user)

        self.client.force_authenticate(user=self.user)
        res = self.client.post('/api/auth/logout-all/')
        self.assertEqual(res.status_code, 200)

        # Ambos os tokens devem estar invalidados
        with self.assertRaises(Exception):
            RefreshToken(str(t1))
        with self.assertRaises(Exception):
            RefreshToken(str(t2))

    def test_google_auth_mock_provisioning(self):
        res = self.client.post('/api/auth/google/', {
            'credential': 'mock-google-test-token',
            'email': 'lucas.google@catana.dev',
            'given_name': 'Lucas',
            'family_name': 'Kepler'
        })
        self.assertEqual(res.status_code, 200)
        self.assertIn('access', res.data)
        self.assertEqual(res.data['user']['email'], 'lucas.google@catana.dev')
        self.assertIn('catana_refresh_token', res.cookies)

        # Verifica se o usuario foi criado e provisionado
        created_user = User.objects.get(email='lucas.google@catana.dev')
        self.assertTrue(created_user.organizations.exists())
        self.assertTrue(created_user.sedes.exists())

    def test_studio_catalog_tenant_isolation(self):
        # Catalogo do Usuario 1
        cat1 = StudioCatalog.objects.create(
            title='Catalogo da Org 1',
            created_by=self.user,
            organization=self.org
        )
        # Catalogo do Usuario 2
        cat2 = StudioCatalog.objects.create(
            title='Catalogo da Org 2',
            created_by=self.user2,
            organization=self.org2
        )

        # 1. Sem autenticacao -> 401
        anon_client = APIClient()
        res = anon_client.get('/api/v2/studio/catalogs/')
        self.assertEqual(res.status_code, 401)

        # 2. Autenticado como Usuario 1 -> Ve apenas o Catalogo 1
        self.client.force_authenticate(user=self.user)
        res = self.client.get('/api/v2/studio/catalogs/')
        self.assertEqual(res.status_code, 200)
        catalog_ids = [c['id'] for c in res.data]
        self.assertIn(cat1.id, catalog_ids)
        self.assertNotIn(cat2.id, catalog_ids)

        # 3. Usuario 1 tentando acessar Catalogo 2 diretamente -> 404
        res_detail = self.client.get(f'/api/v2/studio/catalogs/{cat2.id}/')
        self.assertEqual(res_detail.status_code, 404)
