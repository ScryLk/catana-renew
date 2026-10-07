import json
from unittest.mock import patch
from django.test import TestCase, override_settings
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient, APIRequestFactory
from rest_framework.exceptions import AuthenticationFailed
from svix.webhooks import WebhookVerificationError

from api.clerk_auth import ClerkJWTAuthentication, provision_local_user_from_clerk
from api.models import Organization, Sede, SubscriptionPlan

User = get_user_model()


class ClerkJWTAuthenticationTests(TestCase):
    def setUp(self):
        self.auth = ClerkJWTAuthentication()
        self.factory = APIRequestFactory()

    def test_no_auth_header_returns_none(self):
        request = self.factory.get('/api/v2/studio/catalogs/')
        result = self.auth.authenticate(request)
        self.assertIsNone(result)

    def test_non_bearer_header_returns_none(self):
        request = self.factory.get(
            '/api/v2/studio/catalogs/',
            HTTP_AUTHORIZATION='Basic dXNlcjpwYXNz'
        )
        result = self.auth.authenticate(request)
        self.assertIsNone(result)

    @override_settings(ALLOW_MOCK_OAUTH=True, DEBUG=True, ENVIRONMENT='development')
    def test_mock_token_in_dev_provisions_and_authenticates(self):
        request = self.factory.get(
            '/api/v2/studio/catalogs/',
            HTTP_AUTHORIZATION='Bearer mock-clerk-token-123',
            HTTP_X_MOCK_CLERK_USER='clerk_mock_user_abc'
        )
        user, payload = self.auth.authenticate(request)
        self.assertIsNotNone(user)
        self.assertEqual(user.clerk_user_id, 'clerk_mock_user_abc')
        self.assertTrue(user.organizations.exists())
        self.assertTrue(user.sedes.exists())
        self.assertEqual(payload['sub'], 'clerk_mock_user_abc')

    @override_settings(ALLOW_MOCK_OAUTH=False, DEBUG=False, ENVIRONMENT='production')
    def test_mock_token_rejected_in_production(self):
        request = self.factory.get(
            '/api/v2/studio/catalogs/',
            HTTP_AUTHORIZATION='Bearer mock-clerk-token-123',
            HTTP_X_MOCK_CLERK_USER='clerk_mock_user_abc'
        )
        # Em producao, token mock nao compativel com JWT oficial retorna None ou lanca AuthenticationFailed
        result = self.auth.authenticate(request)
        self.assertIsNone(result)

    @patch('api.clerk_auth.jwt.get_unverified_header')
    @patch('api.clerk_auth.get_clerk_jwks')
    @patch('api.clerk_auth.RSAAlgorithm.from_jwk')
    @patch('api.clerk_auth.jwt.decode')
    def test_valid_clerk_jwt_provisions_new_user(self, mock_jwt_decode, mock_rsa, mock_jwks, mock_header):
        mock_header.return_value = {'kid': 'test-kid-1', 'alg': 'RS256'}
        mock_jwks.return_value = {'test-kid-1': {'kid': 'test-kid-1'}}
        mock_rsa.return_value = 'mock-public-key'
        mock_jwt_decode.return_value = {
            'sub': 'user_clerk_real_999',
            'email': 'newclerkuser@catana.dev',
            'first_name': 'Ana',
            'last_name': 'Silva',
        }

        request = self.factory.get(
            '/api/v2/studio/catalogs/',
            HTTP_AUTHORIZATION='Bearer eyJhbGciOiJSUzI1NiJ9.realtoken'
        )
        user, payload = self.auth.authenticate(request)
        self.assertIsNotNone(user)
        self.assertEqual(user.clerk_user_id, 'user_clerk_real_999')
        self.assertEqual(user.email, 'newclerkuser@catana.dev')
        self.assertEqual(user.first_name, 'Ana')
        self.assertEqual(user.last_name, 'Silva')

    @patch('api.clerk_auth.jwt.get_unverified_header')
    @patch('api.clerk_auth.get_clerk_jwks')
    @patch('api.clerk_auth.RSAAlgorithm.from_jwk')
    @patch('api.clerk_auth.jwt.decode')
    def test_existing_user_linked_by_verified_email(self, mock_jwt_decode, mock_rsa, mock_jwks, mock_header):
        existing_user = User.objects.create_user(
            username='carlos',
            email='carlos@catana.dev',
            password='Password123!'
        )
        self.assertIsNone(existing_user.clerk_user_id)

        mock_header.return_value = {'kid': 'test-kid-1', 'alg': 'RS256'}
        mock_jwks.return_value = {'test-kid-1': {'kid': 'test-kid-1'}}
        mock_rsa.return_value = 'mock-public-key'
        mock_jwt_decode.return_value = {
            'sub': 'user_clerk_carlos_555',
            'email': 'carlos@catana.dev',
            'email_verified': True,
        }

        request = self.factory.get(
            '/api/v2/studio/catalogs/',
            HTTP_AUTHORIZATION='Bearer eyJhbGciOiJSUzI1NiJ9.realtoken'
        )
        user, payload = self.auth.authenticate(request)
        self.assertEqual(user.id, existing_user.id)
        existing_user.refresh_from_db()
        self.assertEqual(existing_user.clerk_user_id, 'user_clerk_carlos_555')


@override_settings(AUTH_PROVIDER='clerk')
class ClerkWebhookViewTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    @override_settings(CLERK_WEBHOOK_SECRET='whsec_test_secret_123')
    def test_webhook_missing_svix_headers_returns_400(self):
        response = self.client.post(
            '/api/auth/clerk-webhook/',
            data=json.dumps({'type': 'user.created'}),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn('error', response.data)

    @override_settings(CLERK_WEBHOOK_SECRET='whsec_test_secret_123')
    @patch('api.views_clerk_webhook.Webhook')
    def test_webhook_user_created(self, mock_webhook_class):
        mock_instance = mock_webhook_class.return_value
        mock_instance.verify.return_value = True
        payload = {
            'type': 'user.created',
            'data': {
                'id': 'user_webhook_001',
                'first_name': 'Beatriz',
                'last_name': 'Mendes',
                'primary_email_address_id': 'email_1',
                'email_addresses': [
                    {'id': 'email_1', 'email_address': 'beatriz@catana.dev'}
                ]
            }
        }
        headers = {
            'HTTP_SVIX_ID': 'msg_123',
            'HTTP_SVIX_TIMESTAMP': '1234567890',
            'HTTP_SVIX_SIGNATURE': 'v1,signature_mock',
        }
        response = self.client.post(
            '/api/auth/clerk-webhook/',
            data=json.dumps(payload),
            content_type='application/json',
            **headers
        )
        self.assertEqual(response.status_code, 200)
        user = User.objects.filter(clerk_user_id='user_webhook_001').first()
        self.assertIsNotNone(user)
        self.assertEqual(user.email, 'beatriz@catana.dev')
        self.assertEqual(user.first_name, 'Beatriz')
        self.assertEqual(user.last_name, 'Mendes')

    @override_settings(CLERK_WEBHOOK_SECRET='whsec_test_secret_123')
    @patch('api.views_clerk_webhook.Webhook')
    def test_webhook_user_updated(self, mock_webhook_class):
        mock_instance = mock_webhook_class.return_value
        mock_instance.verify.return_value = True
        user = provision_local_user_from_clerk('user_webhook_002', email='old@catana.dev')
        payload = {
            'type': 'user.updated',
            'data': {
                'id': 'user_webhook_002',
                'first_name': 'Novo Nome',
                'last_name': 'Novo Sobrenome',
                'primary_email_address_id': 'email_2',
                'email_addresses': [
                    {'id': 'email_2', 'email_address': 'updated@catana.dev'}
                ]
            }
        }
        headers = {
            'HTTP_SVIX_ID': 'msg_456',
            'HTTP_SVIX_TIMESTAMP': '1234567890',
            'HTTP_SVIX_SIGNATURE': 'v1,signature_mock',
        }
        response = self.client.post(
            '/api/auth/clerk-webhook/',
            data=json.dumps(payload),
            content_type='application/json',
            **headers
        )
        self.assertEqual(response.status_code, 200)
        user.refresh_from_db()
        self.assertEqual(user.first_name, 'Novo Nome')
        self.assertEqual(user.last_name, 'Novo Sobrenome')
        self.assertEqual(user.email, 'updated@catana.dev')

    @override_settings(CLERK_WEBHOOK_SECRET='whsec_test_secret_123')
    @patch('api.views_clerk_webhook.Webhook')
    def test_webhook_user_deleted(self, mock_webhook_class):
        mock_instance = mock_webhook_class.return_value
        mock_instance.verify.return_value = True
        user = provision_local_user_from_clerk('user_webhook_003', email='delete_me@catana.dev')
        self.assertTrue(user.is_active)

        payload = {
            'type': 'user.deleted',
            'data': {
                'id': 'user_webhook_003',
            }
        }
        headers = {
            'HTTP_SVIX_ID': 'msg_789',
            'HTTP_SVIX_TIMESTAMP': '1234567890',
            'HTTP_SVIX_SIGNATURE': 'v1,signature_mock',
        }
        response = self.client.post(
            '/api/auth/clerk-webhook/',
            data=json.dumps(payload),
            content_type='application/json',
            **headers
        )
        self.assertEqual(response.status_code, 200)
        user.refresh_from_db()
        self.assertFalse(user.is_active)
