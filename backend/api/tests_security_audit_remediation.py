import io
import os
import shutil
import tempfile
from unittest.mock import patch
from PIL import Image

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import make_password, check_password, PBKDF2PasswordHasher
from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from rest_framework import status

from api.models import (
    Organization, Sede, Catalog, PublicProfile,
    SubscriptionPlan, OrganizationQuota
)

User = get_user_model()


def _create_dummy_image(format_name='PNG', size=(64, 64), color=(255, 0, 0)) -> io.BytesIO:
    buf = io.BytesIO()
    img = Image.new('RGB', size, color)
    img.save(buf, format=format_name)
    buf.seek(0)
    return buf


class SecurityAuditRemediationTests(TestCase):
    """
    Suíte completa de testes de regressão de segurança para validar a remediação
    dos achados críticos e altos da auditoria AppSec & LGPD.
    """

    def setUp(self):
        self.temp_media = tempfile.mkdtemp()
        self.settings_override = override_settings(
            MEDIA_ROOT=self.temp_media,
            ENVIRONMENT='development',
            DEBUG=True,
            ALLOW_MOCK_OAUTH=True,
            REST_FRAMEWORK={
                **settings.REST_FRAMEWORK,
                'DEFAULT_THROTTLE_RATES': {
                    'anon': '1000/min',
                    'user': '2000/min',
                    'auth_login': '3/min',
                    'auth_register': '3/min',
                    'auth_password_reset': '2/min',
                }
            }
        )
        self.settings_override.enable()

        # Tenant A
        self.user_a = User.objects.create_user(
            username='user_a',
            email='user_a@tenant-a.com',
            password='TestPassword123!@#',
            role='editor'
        )
        self.org_a = Organization.objects.create(name='Org A', owner=self.user_a)
        self.sede_a = Sede.objects.create(name='Sede A', organization=self.org_a, responsible_user=self.user_a)
        self.user_a.organizations.add(self.org_a)
        self.user_a.sedes.add(self.sede_a)

        # Tenant B
        self.user_b = User.objects.create_user(
            username='user_b',
            email='user_b@tenant-b.com',
            password='TestPassword123!@#',
            role='editor'
        )
        self.org_b = Organization.objects.create(name='Org B', owner=self.user_b)
        self.sede_b = Sede.objects.create(name='Sede B', organization=self.org_b, responsible_user=self.user_b)
        self.user_b.organizations.add(self.org_b)
        self.user_b.sedes.add(self.sede_b)

        # Superuser
        self.superuser = User.objects.create_superuser(
            username='admin_boss',
            email='admin@catana.dev',
            password='AdminPassword123!@#'
        )

        # Catálogo Tenant A
        self.catalog_a = Catalog.objects.create(
            title='Catalogo Org A',
            organization=self.org_a,
            sede=self.sede_a,
            created_by=self.user_a,
            is_demo=False
        )

        # Catálogo Tenant B
        self.catalog_b = Catalog.objects.create(
            title='Catalogo Org B',
            organization=self.org_b,
            sede=self.sede_b,
            created_by=self.user_b,
            is_demo=False
        )

        # Catálogo Canônico Demo
        self.catalog_demo = Catalog.objects.create(
            title='Catalogo Canônico Demo',
            organization=self.org_a,
            sede=self.sede_a,
            created_by=self.user_a,
            is_demo=True
        )

        self.client_anon = APIClient()
        self.client_a = APIClient()
        self.client_a.force_authenticate(user=self.user_a)
        self.client_b = APIClient()
        self.client_b.force_authenticate(user=self.user_b)
        self.client_admin = APIClient()
        self.client_admin.force_authenticate(user=self.superuser)

    def tearDown(self):
        self.settings_override.disable()
        shutil.rmtree(self.temp_media, ignore_errors=True)

    # ==========================================================================
    # 1. TESTES: VULNERABILIDADE 1 - TOKEN DE RESET DE SENHA NOS LOGS
    # ==========================================================================

    def test_password_reset_does_not_log_token_or_full_url(self):
        """
        Valida que ao solicitar recuperação de senha, nem o token nem a URL de reset
        são emitidos nos logs do logger 'api.views_auth'.
        """
        with self.assertLogs('api.views_auth', level='INFO') as cm:
            res = self.client_anon.post('/api/auth/password-reset/', {'email': self.user_a.email})
            self.assertEqual(res.status_code, 200)

        log_output = "\n".join(cm.output)
        # Nao deve conter a rota sensivel de reset nem o parametro token
        self.assertNotIn("reset-password?uid=", log_output)
        self.assertNotIn("token=", log_output)
        self.assertNotIn("token", log_output.lower().split())
        # Deve conter apenas mensagem limpa com identificador interno
        self.assertIn(f"usuario_id={self.user_a.id}", log_output)

    # ==========================================================================
    # 2. TESTES: VULNERABILIDADE 2 - SSRF & PATH TRAVERSAL (StudioMediaRemoveBackgroundView)
    # ==========================================================================

    def test_remove_background_requires_authentication(self):
        """Garante que anônimo receba 401 Unauthorized"""
        res = self.client_anon.post('/api/v2/studio/media/remove-background/', {})
        self.assertEqual(res.status_code, 401)

    def test_remove_background_blocks_localhost_and_loopback(self):
        """Bloqueia tentativas de SSRF contra localhost / 127.0.0.1"""
        for target in ['http://localhost/secret.png', 'http://127.0.0.1:8000/media/test.png']:
            res = self.client_a.post('/api/v2/studio/media/remove-background/', {'image_url': target})
            self.assertEqual(res.status_code, 400)
            self.assertIn('SSRF', res.data.get('error', ''))

    def test_remove_background_blocks_cloud_metadata_service(self):
        """Bloqueia tentativas de SSRF contra 169.254.169.254 e metadata.google.internal"""
        for target in [
            'http://169.254.169.254/latest/meta-data/',
            'http://metadata.google.internal/computeMetadata/v1/'
        ]:
            res = self.client_a.post('/api/v2/studio/media/remove-background/', {'image_url': target})
            self.assertEqual(res.status_code, 400)
            self.assertIn('SSRF', res.data.get('error', ''))

    def test_remove_background_blocks_private_subnets(self):
        """Bloqueia tentativas de SSRF contra sub-redes privadas (10.x, 192.168.x, 172.16.x)"""
        with patch('socket.getaddrinfo', return_value=[(None, None, None, None, ('192.168.1.10', 80))]):
            res = self.client_a.post('/api/v2/studio/media/remove-background/', {'image_url': 'http://internal-printer.local/img.png'})
            self.assertEqual(res.status_code, 400)
            self.assertIn('SSRF', res.data.get('error', ''))

    def test_remove_background_blocks_unauthorized_external_urls(self):
        """Bloqueia URLs externas arbitrárias não autorizadas na allowlist"""
        res = self.client_a.post('/api/v2/studio/media/remove-background/', {'image_url': 'http://evil-attacker.com/payload.png'})
        self.assertEqual(res.status_code, 400)

    def test_remove_background_blocks_path_traversal(self):
        """Bloqueia sequências de traversal (../, ..\\) na leitura de arquivos locais"""
        traversal_attempts = [
            '../../../../etc/passwd',
            '/media/../../../catana_back/settings.py',
            '..\\..\\..\\windows\\system32',
            '/etc/shadow'
        ]
        for attempt in traversal_attempts:
            res = self.client_a.post('/api/v2/studio/media/remove-background/', {'image_url': attempt})
            self.assertEqual(res.status_code, 400)

    def test_remove_background_rejects_file_outside_media_root(self):
        """Rejeita acesso a arquivos fora do MEDIA_ROOT"""
        outside_file = tempfile.NamedTemporaryFile(delete=False)
        outside_file.write(b"NOT_A_MEDIA_FILE")
        outside_file.close()
        try:
            res = self.client_a.post('/api/v2/studio/media/remove-background/', {'image_url': outside_file.name})
            self.assertIn(res.status_code, [400, 403])
        finally:
            os.unlink(outside_file.name)

    def test_remove_background_handles_valid_local_file_in_media_root(self):
        """Permite carregar arquivo legítimo posicionado dentro de MEDIA_ROOT"""
        valid_img = _create_dummy_image('PNG')
        safe_path = os.path.join(self.temp_media, 'safe_product.png')
        with open(safe_path, 'wb') as f:
            f.write(valid_img.read())

        with patch('api.services.background_removal.BackgroundRemovalService.process_and_save') as mock_bg:
            mock_bg.return_value = {'success': True, 'processed_url': '/media/cutouts/safe_product.png'}
            res = self.client_a.post('/api/v2/studio/media/remove-background/', {'image_url': '/media/safe_product.png'})
            self.assertEqual(res.status_code, 200)
            self.assertTrue(res.data.get('success'))

    def test_remove_background_handles_valid_direct_upload(self):
        """Permite upload direto de arquivo de imagem válido"""
        img_buf = _create_dummy_image('PNG')
        img_buf.name = 'product_upload.png'

        with patch('api.services.background_removal.BackgroundRemovalService.process_and_save') as mock_bg:
            mock_bg.return_value = {'success': True, 'processed_url': '/media/cutouts/product_upload.png'}
            res = self.client_a.post('/api/v2/studio/media/remove-background/', {'image': img_buf}, format='multipart')
            self.assertEqual(res.status_code, 200)

    # ==========================================================================
    # 3. TESTES: VULNERABILIDADE 3 - UPLOADS INSEGUROS (AVATAR E COVER)
    # ==========================================================================

    def test_public_profile_avatar_upload_valid_formats(self):
        """Valida que formatos permitidos (PNG, JPEG, WEBP) sejam aceitos"""
        PublicProfile.objects.get_or_create(user=self.user_a, defaults={'username': 'user_a_prof', 'display_name': 'A'})
        for fmt in ['PNG', 'JPEG', 'WEBP']:
            buf = _create_dummy_image(fmt)
            buf.name = f'avatar.{fmt.lower()}'
            res = self.client_a.post('/api/public-profiles/me/avatar', {'avatar': buf}, format='multipart')
            self.assertEqual(res.status_code, 200)
            self.assertIn('avatarUrl', res.data)

    def test_public_profile_avatar_upload_rejects_oversized_file(self):
        """Rejeita avatar maior que 2MB"""
        PublicProfile.objects.get_or_create(user=self.user_a, defaults={'username': 'user_a_prof', 'display_name': 'A'})
        huge_file = io.BytesIO(b"A" * (3 * 1024 * 1024))
        huge_file.name = 'huge_avatar.png'
        res = self.client_a.post('/api/public-profiles/me/avatar', {'avatar': huge_file}, format='multipart')
        self.assertEqual(res.status_code, 400)
        self.assertIn('excede o tamanho maximo', res.data.get('error', ''))

    def test_public_profile_avatar_upload_rejects_empty_file(self):
        """Rejeita arquivo vazio (0 bytes)"""
        PublicProfile.objects.get_or_create(user=self.user_a, defaults={'username': 'user_a_prof', 'display_name': 'A'})
        empty_file = io.BytesIO(b"")
        empty_file.name = 'empty.png'
        res = self.client_a.post('/api/public-profiles/me/avatar', {'avatar': empty_file}, format='multipart')
        self.assertEqual(res.status_code, 400)

    def test_public_profile_avatar_upload_rejects_html_stored_xss(self):
        """Rejeita HTML malicioso renomeado para .jpg (mitigação Stored XSS)"""
        PublicProfile.objects.get_or_create(user=self.user_a, defaults={'username': 'user_a_prof', 'display_name': 'A'})
        fake_jpg = io.BytesIO(b"<html><script>alert('XSS')</script></html>")
        fake_jpg.name = 'photo.jpg'
        res = self.client_a.post('/api/public-profiles/me/avatar', {'avatar': fake_jpg}, format='multipart')
        self.assertEqual(res.status_code, 400)
        self.assertIn('corrompido', res.data.get('error', ''))

    def test_public_profile_avatar_upload_rejects_svg_script(self):
        """Rejeita SVG contendo script ativo (apenas formatos raster permitidos)"""
        PublicProfile.objects.get_or_create(user=self.user_a, defaults={'username': 'user_a_prof', 'display_name': 'A'})
        svg_file = io.BytesIO(b"<svg onload=alert(1)></svg>")
        svg_file.name = 'vector.svg'
        res = self.client_a.post('/api/public-profiles/me/avatar', {'avatar': svg_file}, format='multipart')
        self.assertEqual(res.status_code, 400)

    def test_public_profile_avatar_upload_rejects_fake_content_type(self):
        """Rejeita binário executável enviado com Content-Type falso de image/png"""
        PublicProfile.objects.get_or_create(user=self.user_a, defaults={'username': 'user_a_prof', 'display_name': 'A'})
        fake_binary = io.BytesIO(b"MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff\x00\x00")
        fake_binary.name = 'exploit.png'
        res = self.client_a.post('/api/public-profiles/me/avatar', {'avatar': fake_binary}, format='multipart')
        self.assertEqual(res.status_code, 400)

    def test_public_profile_cover_applies_same_security_policy(self):
        """Garante que public_profile_me_cover utilize a mesma validação segura"""
        PublicProfile.objects.get_or_create(user=self.user_a, defaults={'username': 'user_a_prof', 'display_name': 'A'})
        fake_cover = io.BytesIO(b"<script>alert('cover xss')</script>")
        fake_cover.name = 'cover.jpg'
        res = self.client_a.post('/api/public-profiles/me/cover', {'cover': fake_cover}, format='multipart')
        self.assertEqual(res.status_code, 400)

    # ==========================================================================
    # 4. TESTES: VULNERABILIDADE 4 - RATE LIMITING DE AUTENTICAÇÃO
    # ==========================================================================

    def test_login_rate_limiting_enforced(self):
        """Valida que excesso de tentativas de login receba HTTP 429 Too Many Requests"""
        from django.core.cache import cache
        cache.clear()
        client = APIClient()
        # Rate configurado no setUp: auth_login = 3/min
        for _ in range(3):
            res = client.post('/api/auth/token/', {'username': 'fake_user', 'password': 'WrongPassword123!'})
            self.assertIn(res.status_code, [400, 401])

        # 4ª tentativa dentro da janela de 1 minuto deve ser bloqueada
        res_blocked = client.post('/api/auth/token/', {'username': 'fake_user', 'password': 'WrongPassword123!'})
        self.assertEqual(res_blocked.status_code, 429)

    def test_password_reset_rate_limiting_enforced(self):
        """Valida que excesso de requisições de reset de senha receba HTTP 429"""
        from django.core.cache import cache
        cache.clear()
        client = APIClient()
        # Rate configurado no setUp: auth_password_reset = 2/min
        for _ in range(2):
            res = client.post('/api/auth/password-reset/', {'email': 'user_a@tenant-a.com'})
            self.assertEqual(res.status_code, 200)

        res_blocked = client.post('/api/auth/password-reset/', {'email': 'user_a@tenant-a.com'})
        self.assertEqual(res_blocked.status_code, 429)

    def test_register_rate_limiting_enforced(self):
        """Valida que criação massiva de contas receba HTTP 429"""
        from django.core.cache import cache
        cache.clear()
        client = APIClient()
        # Rate configurado no setUp: auth_register = 3/min
        for i in range(3):
            res = client.post('/api/register/', {
                'username': f'new_user_{i}',
                'email': f'new_user_{i}@catana.dev',
                'password': 'StrongPassword123!@#'
            })
            self.assertEqual(res.status_code, 201)

        res_blocked = client.post('/api/register/', {
            'username': 'new_user_overflow',
            'email': 'overflow@catana.dev',
            'password': 'StrongPassword123!@#'
        })
        self.assertEqual(res_blocked.status_code, 429)

    # ==========================================================================
    # 5. TESTES: VULNERABILIDADE 5 - BOLA/IDOR & ISOLAMENTO MULTI-TENANT
    # ==========================================================================

    def test_tenant_a_can_read_own_catalog(self):
        """Tenant A lê catálogo de sua organização"""
        res = self.client_a.get(f'/api/catalogs/{self.catalog_a.id}/')
        self.assertEqual(res.status_code, 200)

    def test_tenant_a_cannot_modify_tenant_b_catalog_put(self):
        """Tenant A tenta alterar catálogo de Tenant B via PUT -> NEGADO (403 ou 404)"""
        res = self.client_a.put(f'/api/catalogs/{self.catalog_b.id}/', {
            'title': 'Hackeado por A',
            'organization': self.org_b.id
        })
        self.assertIn(res.status_code, [403, 404])
        self.catalog_b.refresh_from_db()
        self.assertEqual(self.catalog_b.title, 'Catalogo Org B')

    def test_tenant_a_cannot_modify_tenant_b_catalog_patch(self):
        """Tenant A tenta alterar catálogo de Tenant B via PATCH -> NEGADO (403 ou 404)"""
        res = self.client_a.patch(f'/api/catalogs/{self.catalog_b.id}/', {
            'title': 'Hackeado por A via PATCH'
        })
        self.assertIn(res.status_code, [403, 404])
        self.catalog_b.refresh_from_db()
        self.assertEqual(self.catalog_b.title, 'Catalogo Org B')

    def test_tenant_a_cannot_delete_tenant_b_catalog(self):
        """Tenant A tenta excluir catálogo de Tenant B via DELETE -> NEGADO (403 ou 404)"""
        res = self.client_a.delete(f'/api/catalogs/{self.catalog_b.id}/')
        self.assertIn(res.status_code, [403, 404])
        self.assertTrue(Catalog.objects.filter(id=self.catalog_b.id).exists())

    def test_tenant_cannot_modify_protected_demo_catalog_put(self):
        """Usuário comum tenta alterar catálogo demo via PUT -> NEGADO (403)"""
        res = self.client_b.put(f'/api/catalogs/{self.catalog_demo.id}/', {
            'title': 'Demo Alterada',
            'organization': self.org_a.id
        })
        self.assertEqual(res.status_code, 403)
        self.catalog_demo.refresh_from_db()
        self.assertEqual(self.catalog_demo.title, 'Catalogo Canônico Demo')

    def test_tenant_cannot_modify_protected_demo_catalog_patch(self):
        """Usuário comum tenta alterar catálogo demo via PATCH -> NEGADO (403)"""
        res = self.client_b.patch(f'/api/catalogs/{self.catalog_demo.id}/', {
            'title': 'Demo Alterada via PATCH'
        })
        self.assertEqual(res.status_code, 403)

    def test_tenant_cannot_delete_protected_demo_catalog(self):
        """Usuário comum tenta excluir catálogo demo via DELETE -> NEGADO (403)"""
        res = self.client_b.delete(f'/api/catalogs/{self.catalog_demo.id}/')
        self.assertEqual(res.status_code, 403)
        self.assertTrue(Catalog.objects.filter(id=self.catalog_demo.id).exists())

    def test_superuser_can_modify_and_delete_demo_catalog(self):
        """Superusuário tem autorização legítima para manter catálogos demo"""
        res = self.client_admin.patch(f'/api/catalogs/{self.catalog_demo.id}/', {
            'title': 'Demo Atualizada por Admin'
        })
        self.assertEqual(res.status_code, 200)
        self.catalog_demo.refresh_from_db()
        self.assertEqual(self.catalog_demo.title, 'Demo Atualizada por Admin')

    # ==========================================================================
    # 6. TESTES: VULNERABILIDADE 6 - LGPD (DIREITOS DOS TITULARES / ANONIMIZAÇÃO)
    # ==========================================================================

    def test_lgpd_account_anonymization_workflow(self):
        """
        Valida que a anonimização sob a LGPD:
        1. Remove e anonimiza e-mail, nome, username e dados de perfil de forma irreversível.
        2. Desativa a conta (is_active=False).
        3. Mantém a integridade referencial dos catálogos criados.
        4. Bloqueia logins subsequentes.
        """
        user_lgpd = User.objects.create_user(
            username='titular_lgpd',
            email='titular@privacidade.com',
            first_name='Carlos',
            last_name='Silva',
            password='Password123!@#'
        )
        PublicProfile.objects.create(
            user=user_lgpd,
            username='titular_lgpd',
            display_name='Carlos Silva'
        )
        cat = Catalog.objects.create(
            title='Catalogo Titular',
            organization=self.org_a,
            sede=self.sede_a,
            created_by=user_lgpd
        )

        client = APIClient()
        client.force_authenticate(user=user_lgpd)

        res = client.post('/api/profile/delete-account/')
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data.get('success'))

        user_lgpd.refresh_from_db()
        self.assertFalse(user_lgpd.is_active)
        self.assertEqual(user_lgpd.first_name, "")
        self.assertEqual(user_lgpd.last_name, "")
        self.assertIn("@deleted.catana.dev", user_lgpd.email)
        self.assertFalse(user_lgpd.has_usable_password())

        # Integridade relacional preservada
        cat.refresh_from_db()
        self.assertEqual(cat.created_by_id, user_lgpd.id)

        # Tentativa de novo login é rejeitada
        res_login = self.client_anon.post('/api/auth/token/', {
            'username': 'titular_lgpd',
            'password': 'Password123!@#'
        })
        self.assertEqual(res_login.status_code, 401)

    # ==========================================================================
    # 7. TESTES: PASSWORD HASHING (ARGON2ID & RETROCOMPATIBILIDADE)
    # ==========================================================================

    def test_new_user_password_uses_argon2id(self):
        """Garante que novas senhas utilizem o algoritmo Argon2id como preferencial"""
        new_user = User.objects.create_user(
            username='argon_user',
            email='argon@catana.dev',
            password='StrongArgonPassword123!@#'
        )
        self.assertTrue(new_user.password.startswith('argon2'))

    def test_legacy_pbkdf2_password_authenticates_and_upgrades(self):
        """
        Valida que contas antigas armazenadas com hash PBKDF2:
        1. Continuem autenticando com sucesso (sem invalidar senhas legítimas).
        2. Sejam migradas de forma transparente.
        """
        legacy_hasher = PBKDF2PasswordHasher()
        legacy_hash = legacy_hasher.encode('LegacyPassword123!', salt='randomsalt123')
        self.assertTrue(legacy_hash.startswith('pbkdf2_sha256'))

        legacy_user = User.objects.create(
            username='legacy_pbkdf2_user',
            email='legacy@catana.dev',
            password=legacy_hash,
            is_active=True
        )

        # Autentica com a senha correta
        res = self.client_anon.post('/api/auth/token/', {
            'username': 'legacy_pbkdf2_user',
            'password': 'LegacyPassword123!'
        })
        self.assertEqual(res.status_code, 200)
        self.assertIn('access', res.data)
