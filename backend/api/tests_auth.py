from django.test import TestCase, override_settings
from django.core.cache import cache
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.token_blacklist.models import OutstandingToken, BlacklistedToken

from api.models import Organization, Sede, StudioCatalog, SubscriptionPlan

User = get_user_model()


@override_settings(AUTH_PROVIDER='legacy')
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

    @override_settings(ALLOW_MOCK_OAUTH=True, DEBUG=True, ENVIRONMENT='development')
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

    def test_password_reset_request_valid_email(self):
        res = self.client.post('/api/auth/password-reset/', {
            'email': 'designer1@catana.dev'
        })
        self.assertEqual(res.status_code, 200)
        self.assertIn('message', res.data)

    def test_password_reset_request_nonexistent_email(self):
        # Deve retornar 200 para nao revelar emails cadastrados (prevencao de enumeracao)
        res = self.client.post('/api/auth/password-reset/', {
            'email': 'inexistente@catana.dev'
        })
        self.assertEqual(res.status_code, 200)
        self.assertIn('message', res.data)

    def test_password_reset_confirm_success(self):
        uidb64 = urlsafe_base64_encode(force_bytes(self.user.pk))
        token = default_token_generator.make_token(self.user)

        res = self.client.post('/api/auth/password-reset/confirm/', {
            'uid': uidb64,
            'token': token,
            'new_password': 'BrandNewPassword456!'
        })
        self.assertEqual(res.status_code, 200)
        self.assertIn('message', res.data)

        # Confirma que a nova senha funciona para login
        login_res = self.client.post('/api/auth/token/', {
            'username': 'designer1',
            'password': 'BrandNewPassword456!'
        })
        self.assertEqual(login_res.status_code, 200)
        self.assertIn('access', login_res.data)

    def test_password_reset_confirm_invalid_token(self):
        uidb64 = urlsafe_base64_encode(force_bytes(self.user.pk))
        res = self.client.post('/api/auth/password-reset/confirm/', {
            'uid': uidb64,
            'token': 'token-invalido-123',
            'new_password': 'BrandNewPassword456!'
        })
        self.assertEqual(res.status_code, 400)
        self.assertIn('error', res.data)

    def test_password_reset_confirm_short_password(self):
        uidb64 = urlsafe_base64_encode(force_bytes(self.user.pk))
        token = default_token_generator.make_token(self.user)

        res = self.client.post('/api/auth/password-reset/confirm/', {
            'uid': uidb64,
            'token': token,
            'new_password': '123'
        })
        self.assertEqual(res.status_code, 400)
        self.assertIn('error', res.data)


@override_settings(AUTH_PROVIDER='legacy', GOOGLE_CLIENT_ID='synthetic-test-client.apps.googleusercontent.com')
class OAuthAndMassAssignmentSecurityTests(TestCase):
    """
    Suíte obrigatória de segurança cobrindo:
    1. Rejeição estrita de tokens mock de OAuth em produção/DEBUG=False.
    2. Bloqueio de Mass Assignment de role e parâmetros privilegiados no registro público.
    3. Validação de complexidade de senhas em registro e alteração.
    4. Isolamento estrito de Multi-Tenancy e privacidade LGPD.
    """

    def setUp(self):
        from django.core.cache import cache
        cache.clear()
        self.client = APIClient()
        self.user_victim = User.objects.create_user(
            username='victim_admin',
            email='victim@corp.test',
            password='StrongPassword123!',
            role='admin'
        )
        self.org_victim = Organization.objects.create(name='Org Vitima', owner=self.user_victim)
        self.user_victim.organizations.add(self.org_victim)

        self.user_attacker = User.objects.create_user(
            username='attacker_user',
            email='attacker@corp.test',
            password='AttackerPassword123!',
            role='editor'
        )
        self.org_attacker = Organization.objects.create(name='Org Atacante', owner=self.user_attacker)
        self.user_attacker.organizations.add(self.org_attacker)

    # --------------------------------------------------------------------------
    # 1. OAUTH BYPASS REGRESSION & SECURITY TESTS
    # --------------------------------------------------------------------------

    @override_settings(ENVIRONMENT='production', DEBUG=False, ALLOW_MOCK_OAUTH=False)
    def test_mock_oauth_token_rejected_in_production(self):
        """Valida que em producao (DEBUG=False, ENV=production) nenhum token mock seja aceito"""
        res = self.client.post('/api/auth/google/', {
            'credential': 'mock-google-test-token',
            'email': 'victim@corp.test',
        })
        self.assertEqual(res.status_code, 401)
        self.assertNotIn('access', res.data)

    @override_settings(ENVIRONMENT='development', DEBUG=False, ALLOW_MOCK_OAUTH=True)
    def test_mock_oauth_token_rejected_when_debug_false(self):
        """Valida que mock OAuth seja rejeitado se DEBUG for False, mesmo com ALLOW_MOCK_OAUTH=True"""
        res = self.client.post('/api/auth/google/', {
            'credential': 'mock-google-any',
            'email': 'any@corp.test',
        })
        self.assertEqual(res.status_code, 401)

    @override_settings(ENVIRONMENT='development', DEBUG=True, ALLOW_MOCK_OAUTH=False)
    def test_mock_oauth_token_rejected_when_mock_flag_disabled(self):
        """Valida que por padrao (ALLOW_MOCK_OAUTH=False) tokens mockados sao rejeitados"""
        res = self.client.post('/api/auth/google/', {
            'credential': 'mock-google-test-token',
            'email': 'any@corp.test',
        })
        self.assertEqual(res.status_code, 401)

    def test_oauth_empty_credential_rejected(self):
        """Valida que credencial vazia seja rejeitada com 400 Bad Request"""
        res = self.client.post('/api/auth/google/', {'credential': ''})
        self.assertEqual(res.status_code, 400)
        self.assertIn('error', res.data)

    def test_oauth_malformed_token_rejected(self):
        """Valida que token malformado ou adulterado seja rejeitado com 401"""
        res = self.client.post('/api/auth/google/', {'credential': 'invalid.malformed.google_token'})
        self.assertEqual(res.status_code, 401)

    # --------------------------------------------------------------------------
    # 2. MASS ASSIGNMENT & PUBLIC REGISTRATION TESTS
    # --------------------------------------------------------------------------

    def test_public_registration_cannot_assign_admin_role(self):
        """Valida que o cliente nao possa enviar role='admin' para obter privilegios"""
        res = self.client.post('/api/register/', {
            'username': 'attacker_candidate',
            'email': 'candidate@attack.test',
            'password': 'StrongSecurePass123!',
            'role': 'admin'
        })
        # O sistema deve rejeitar o atributo privilegiado
        self.assertEqual(res.status_code, 400)
        self.assertFalse(User.objects.filter(username='attacker_candidate').exists())

    def test_public_registration_prohibits_internal_privilege_flags(self):
        """Valida que tentativas de passar is_staff, is_superuser, permissions, tenant_id sejam rejeitadas"""
        malicious_payloads = [
            {'is_superuser': True},
            {'is_staff': True},
            {'is_admin': True},
            {'permissions': ['admin_all']},
            {'organization_id': self.org_victim.id},
            {'tenant_id': self.org_victim.id},
            {'owner_id': self.user_victim.id},
        ]
        for payload in malicious_payloads:
            cache.clear()
            full_data = {
                'username': f'user_{list(payload.keys())[0]}',
                'email': f'user_{list(payload.keys())[0]}@corp.test',
                'password': 'StrongSecurePass123!',
                **payload
            }
            res = self.client.post('/api/register/', full_data)
            self.assertEqual(res.status_code, 400, f"Falha de seguranca: payload {payload} foi aceito!")
            self.assertFalse(User.objects.filter(username=full_data['username']).exists())

    def test_public_registration_rejects_weak_password(self):
        """Valida que senhas fracas sejam rejeitadas conforme regras do Django"""
        res = self.client.post('/api/register/', {
            'username': 'weak_user',
            'email': 'weak@corp.test',
            'password': '123'
        })
        self.assertEqual(res.status_code, 400)
        self.assertFalse(User.objects.filter(username='weak_user').exists())

    def test_public_registration_success_enforces_default_role_and_cookie(self):
        """Valida registro legitimo: assume role='editor', is_staff=False, is_superuser=False e injeta cookie"""
        res = self.client.post('/api/register/', {
            'username': 'legit_user',
            'email': 'legit@corp.test',
            'password': 'StrongValidPassword987!'
        })
        self.assertEqual(res.status_code, 201)
        new_user = User.objects.get(username='legit_user')
        self.assertEqual(new_user.role, 'editor')
        self.assertFalse(new_user.is_staff)
        self.assertFalse(new_user.is_superuser)
        # Verifica presenca de cookie HttpOnly de refresh
        self.assertIn('catana_refresh_token', res.cookies)

    # --------------------------------------------------------------------------
    # 3. PASSWORD CHANGE COMPLEXITY
    # --------------------------------------------------------------------------

    def test_change_password_rejects_weak_new_password(self):
        """Valida que alteracao de senha rejeite senhas curtas/fracas"""
        self.client.force_authenticate(user=self.user_attacker)
        res = self.client.post('/api/profile/change-password/', {
            'old_password': 'AttackerPassword123!',
            'new_password': '123',
            'confirm_password': '123'
        })
        self.assertEqual(res.status_code, 400)
        # Senha antiga permanece ativa
        self.assertTrue(self.user_attacker.check_password('AttackerPassword123!'))

    # --------------------------------------------------------------------------
    # 4. MULTI-TENANT ISOLATION & PRIVACY
    # --------------------------------------------------------------------------

    def test_private_profile_privacy_enforced(self):
        """Valida que perfis marcados como privados nao sejam expostos a terceiros"""
        from api.models import PublicProfile
        profile_victim = PublicProfile.objects.create(
            user=self.user_victim,
            username='victim_priv',
            display_name='Vitima Admin',
            visibility='privado'
        )

        # 1. Anonimo nao tem acesso -> 403
        anon_client = APIClient()
        res_anon = anon_client.get(f'/api/public-profiles/{profile_victim.id}')
        self.assertEqual(res_anon.status_code, 403)

        # 2. Outro usuario comum autenticado nao tem acesso -> 403
        self.client.force_authenticate(user=self.user_attacker)
        res_attacker = self.client.get(f'/api/public-profiles/{profile_victim.id}')
        self.assertEqual(res_attacker.status_code, 403)

        # 3. O proprio titular tem acesso -> 200
        self.client.force_authenticate(user=self.user_victim)
        res_owner = self.client.get(f'/api/public-profiles/{profile_victim.id}')
        self.assertEqual(res_owner.status_code, 200)

    def test_custom_agent_owner_isolation(self):
        """Valida que usuario B nao consiga deletar agente customizado de usuario A"""
        from api.models import UserCustomAgent
        agent_a = UserCustomAgent.objects.create(
            user=self.user_victim,
            role='specialist_a',
            name='Especialista A',
            mission='Missao A'
        )

        # Usuario B tenta deletar agente de A -> 404
        self.client.force_authenticate(user=self.user_attacker)
        res_del = self.client.delete(f'/api/v2/studio/system-design/custom-agents/{agent_a.id}/')
        self.assertEqual(res_del.status_code, 404)
        self.assertTrue(UserCustomAgent.objects.filter(id=agent_a.id).exists())

        # Usuario A (dono) consegue deletar -> 200
        self.client.force_authenticate(user=self.user_victim)
        res_del_ok = self.client.delete(f'/api/v2/studio/system-design/custom-agents/{agent_a.id}/')
        self.assertEqual(res_del_ok.status_code, 200)
        self.assertFalse(UserCustomAgent.objects.filter(id=agent_a.id).exists())

    def test_catalog_import_json_unauthenticated_rejected(self):
        """Valida que importacao de catalogo json sem autenticacao seja rejeitada com 401"""
        anon_client = APIClient()
        res = anon_client.post('/api/catalogs/import-json/', {'app': 'Catana'})
        self.assertEqual(res.status_code, 401)


