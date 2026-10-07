"""Provider isolation and collision-safe Clerk identity reconciliation contracts."""
import json
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core.cache import cache
from django.test import TestCase, TransactionTestCase, override_settings, skipUnlessDBFeature
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.test import APIClient, APIRequestFactory
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import RefreshToken

from api.clerk_auth import ClerkIdentityConflict, ClerkJWTAuthentication, provision_local_user_from_clerk
from api.models import Organization, OrganizationQuota, Sede

User = get_user_model()
GOOGLE_CLIENT_ID = 'synthetic-client.apps.googleusercontent.com'


class LegacyProviderIsolationTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.user = User.objects.create_user('legacy_user', 'legacy@example.test', 'OriginalSecurePassword42!')
        self.refresh = RefreshToken.for_user(self.user)

    def tearDown(self):
        cache.clear()

    def legacy_requests(self):
        return (
            ('/api/auth/token/', {'username': self.user.username, 'password': 'OriginalSecurePassword42!'}),
            ('/api/auth/token/refresh/', {'refresh': str(self.refresh)}),
            ('/api/auth/logout/', {'refresh': str(self.refresh)}),
            ('/api/auth/logout-all/', {}),
            ('/api/profile/logout-all/', {}),
            ('/api/auth/google/', {'credential': 'mock-google-token', 'email': 'new-google@example.test'}),
            ('/api/register/', {'username': 'new_user', 'email': 'new@example.test', 'password': 'NewStrongPassword42!'}),
            ('/api/auth/password-reset/', {'email': self.user.email}),
            ('/api/auth/password-reset/confirm/', {
                'uid': urlsafe_base64_encode(force_bytes(self.user.pk)),
                'token': default_token_generator.make_token(self.user),
                'new_password': 'ChangedStrongPassword42!',
            }),
            ('/api/profile/change-password/', {
                'old_password': 'OriginalSecurePassword42!', 'new_password': 'ChangedStrongPassword42!',
                'confirm_password': 'ChangedStrongPassword42!',
            }),
        )

    @override_settings(AUTH_PROVIDER='clerk', DEBUG=True, ENVIRONMENT='development', ALLOW_MOCK_OAUTH=True)
    def test_clerk_blocks_every_legacy_mutation_before_authentication_or_side_effects(self):
        counts = [model.objects.count() for model in (User, Organization, Sede, OrganizationQuota, OutstandingToken, BlacklistedToken)]
        self.client.credentials(HTTP_AUTHORIZATION='Bearer mock-clerk-new-subject')
        self.client.cookies['catana_refresh_token'] = str(self.refresh)
        with patch('rest_framework.views.APIView.perform_authentication') as authenticate, patch('api.views_auth.send_mail') as send_mail:
            for path, payload in self.legacy_requests():
                with self.subTest(path=path):
                    response = self.client.post(path, payload, format='json')
                    self.assertEqual(response.status_code, 403)
                    self.assertEqual(response.data['code'], 'legacy_auth_disabled')
                    self.assertNotIn('access', response.data)
                    self.assertNotIn('refresh', response.data)
                    self.assertNotIn('catana_refresh_token', response.cookies)
            authenticate.assert_not_called()
            send_mail.assert_not_called()
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('OriginalSecurePassword42!'))
        self.assertIsNone(self.user.clerk_user_id)
        self.assertEqual(counts, [model.objects.count() for model in (User, Organization, Sede, OrganizationQuota, OutstandingToken, BlacklistedToken)])

    def test_invalid_provider_and_production_mixed_fail_closed(self):
        for mode, environment, debug in (('unknown', 'development', True), ('mixed', 'production', True), ('mixed', 'production', False), ('mixed', 'staging', True)):
            with self.subTest(mode=mode, environment=environment, debug=debug), override_settings(AUTH_PROVIDER=mode, ENVIRONMENT=environment, DEBUG=debug):
                response = self.client.post('/api/auth/token/', {'username': self.user.username, 'password': 'OriginalSecurePassword42!'})
                self.assertEqual(response.status_code, 403)
                self.assertEqual(response.data['code'], 'legacy_auth_disabled')

    @override_settings(AUTH_PROVIDER='mixed', ENVIRONMENT='development')
    def test_local_mixed_compatibility_preserves_legacy_login(self):
        response = self.client.post('/api/auth/token/', {'username': self.user.username, 'password': 'OriginalSecurePassword42!'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['user']['id'], self.user.pk)

    @override_settings(AUTH_PROVIDER='legacy')
    def test_explicit_legacy_preserves_token_rotation_and_logout(self):
        login = self.client.post('/api/auth/token/', {'username': self.user.username, 'password': 'OriginalSecurePassword42!'})
        self.assertEqual(login.status_code, 200)
        refreshed = self.client.post('/api/auth/token/refresh/')
        self.assertEqual(refreshed.status_code, 200)
        rotated = refreshed.cookies['catana_refresh_token'].value
        logout = self.client.post('/api/auth/logout/')
        self.assertEqual(logout.status_code, 200)
        self.assertEqual(logout.cookies['catana_refresh_token'].value, '')
        with self.assertRaises(Exception):
            RefreshToken(rotated)

    @override_settings(AUTH_PROVIDER='legacy', GOOGLE_CLIENT_ID=GOOGLE_CLIENT_ID)
    @patch('google.oauth2.id_token.verify_oauth2_token')
    def test_legacy_google_uses_configured_audience_and_existing_identity(self, verify):
        verify.return_value = {'email': self.user.email, 'email_verified': True, 'sub': 'google-subject'}
        before = User.objects.count()
        for _ in range(2):
            response = self.client.post('/api/auth/google/', {'credential': 'synthetic-google-credential'})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data['user']['id'], self.user.pk)
        self.assertEqual(User.objects.count(), before)
        self.user.refresh_from_db()
        self.assertIsNone(self.user.clerk_user_id)
        self.assertEqual(verify.call_args.args[2], GOOGLE_CLIENT_ID)

    @override_settings(AUTH_PROVIDER='legacy', GOOGLE_CLIENT_ID='')
    @patch('google.oauth2.id_token.verify_oauth2_token')
    def test_legacy_google_missing_audience_does_not_verify_or_issue_tokens(self, verify):
        response = self.client.post('/api/auth/google/', {'credential': 'synthetic-google-credential'})
        self.assertEqual(response.status_code, 503)
        self.assertNotIn('access', response.data)
        self.assertNotIn('catana_refresh_token', response.cookies)
        verify.assert_not_called()

    @override_settings(AUTH_PROVIDER='legacy', GOOGLE_CLIENT_ID=GOOGLE_CLIENT_ID)
    @patch('google.oauth2.id_token.verify_oauth2_token')
    def test_legacy_google_rejects_string_verification_claim(self, verify):
        verify.return_value = {'email': self.user.email, 'email_verified': 'false'}
        response = self.client.post('/api/auth/google/', {'credential': 'synthetic-google-credential'})
        self.assertEqual(response.status_code, 400)
        self.assertNotIn('access', response.data)

    @override_settings(AUTH_PROVIDER='legacy')
    def test_legacy_mode_does_not_process_clerk_webhooks(self):
        with patch('api.views_clerk_webhook.provision_local_user_from_clerk') as provision:
            response = self.client.post('/api/auth/clerk-webhook/', {'type': 'user.created', 'data': {'id': 'new-subject'}}, format='json')
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data['code'], 'clerk_auth_disabled')
        provision.assert_not_called()


@override_settings(AUTH_PROVIDER='clerk')
class ClerkIdentityReconciliationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.legacy = User.objects.create_user('legacy', 'legacy@example.test', 'OriginalSecurePassword42!')
        self.org = Organization.objects.create(name='Existing workspace', owner=self.legacy)
        self.legacy.organizations.add(self.org)

    def jwt_user(self, claims):
        request = APIRequestFactory().get('/api/profile/', HTTP_AUTHORIZATION='Bearer synthetic-token')
        with patch('api.clerk_auth.jwt.get_unverified_header', return_value={'alg': 'RS256', 'kid': 'known-key'}), patch('api.clerk_auth.get_clerk_jwks', return_value={'known-key': {'kid': 'known-key'}}), patch('api.clerk_auth.RSAAlgorithm.from_jwk', return_value='synthetic-public-key'), patch('api.clerk_auth.jwt.decode', return_value=claims):
            return ClerkJWTAuthentication().authenticate(request)[0]

    def webhook(self, subject, verification, *, signed=True):
        event = {'type': 'user.created', 'data': {
            'id': subject, 'primary_email_address_id': 'primary',
            'email_addresses': [{'id': 'primary', 'email_address': self.legacy.email, 'verification': {'status': verification}}],
        }}
        with override_settings(CLERK_WEBHOOK_SECRET='synthetic-secret' if signed else '', DEBUG=True, ENVIRONMENT='development'), patch('api.views_clerk_webhook.Webhook') as verifier:
            response = self.client.post('/api/auth/clerk-webhook/', json.dumps(event), content_type='application/json', HTTP_SVIX_ID='message', HTTP_SVIX_TIMESTAMP='123', HTTP_SVIX_SIGNATURE='synthetic-signature')
            if signed:
                verifier.return_value.verify.assert_called_once()
            return response

    def test_unverified_or_non_boolean_signed_jwt_email_never_links_or_duplicates(self):
        before = User.objects.count()
        for verification in (None, False, 'true', 1):
            with self.subTest(verification=verification), self.assertRaises(ClerkIdentityConflict):
                self.jwt_user({'sub': 'new-clerk-subject', 'email': self.legacy.email, 'email_verified': verification})
        self.legacy.refresh_from_db()
        self.assertIsNone(self.legacy.clerk_user_id)
        self.assertEqual(User.objects.count(), before)

    def test_verified_signed_email_links_once_and_preserves_workspace(self):
        before = (User.objects.count(), Organization.objects.count())
        first = self.jwt_user({'sub': 'new-clerk-subject', 'email': self.legacy.email.upper(), 'email_verified': True})
        second = self.jwt_user({'sub': 'new-clerk-subject', 'email': 'changed@example.test'})
        self.assertEqual(first.pk, self.legacy.pk)
        self.assertEqual(second.pk, self.legacy.pk)
        self.assertEqual(list(first.organizations.values_list('pk', flat=True)), [self.org.pk])
        self.assertEqual((User.objects.count(), Organization.objects.count()), before)
        self.legacy.refresh_from_db()
        self.assertTrue(self.legacy.check_password('OriginalSecurePassword42!'))

    def test_verified_email_cannot_overwrite_another_clerk_subject(self):
        self.legacy.clerk_user_id = 'original-subject'
        self.legacy.save(update_fields=['clerk_user_id'])
        with self.assertRaises(ClerkIdentityConflict):
            self.jwt_user({'sub': 'other-subject', 'email': self.legacy.email, 'email_verified': True})
        self.legacy.refresh_from_db()
        self.assertEqual(self.legacy.clerk_user_id, 'original-subject')
        self.assertEqual(User.objects.count(), 1)

    def test_duplicate_local_emails_require_explicit_migration(self):
        other = User.objects.create_user('other', self.legacy.email.upper(), 'OtherSecurePassword42!')
        with self.assertRaises(ClerkIdentityConflict):
            self.jwt_user({'sub': 'new-clerk-subject', 'email': self.legacy.email, 'email_verified': True})
        self.legacy.refresh_from_db()
        other.refresh_from_db()
        self.assertIsNone(self.legacy.clerk_user_id)
        self.assertIsNone(other.clerk_user_id)
        self.assertEqual(User.objects.count(), 2)

    def test_inactive_legacy_account_is_not_automatically_linked(self):
        self.legacy.is_active = False
        self.legacy.save(update_fields=['is_active'])
        with self.assertRaises(ClerkIdentityConflict):
            self.jwt_user({'sub': 'new-clerk-subject', 'email': self.legacy.email, 'email_verified': True})
        self.legacy.refresh_from_db()
        self.assertIsNone(self.legacy.clerk_user_id)
        self.assertEqual(User.objects.count(), 1)

    def test_malformed_subject_and_email_claims_fail_without_creation(self):
        for claims in ({'sub': 42}, {'sub': {'id': 'nested'}}, {'sub': 'new-clerk-subject', 'email': {'address': 'nested'}}, {'sub': 'new-clerk-subject', 'email': 0}):
            with self.subTest(claims=claims), self.assertRaises(AuthenticationFailed):
                self.jwt_user(claims)
        self.assertEqual(User.objects.count(), 1)

    def test_signed_verified_webhook_links_then_jwt_reuses_same_identity(self):
        response = self.webhook('new-clerk-subject', 'verified')
        self.assertEqual(response.status_code, 200)
        user = self.jwt_user({'sub': 'new-clerk-subject'})
        self.assertEqual(user.pk, self.legacy.pk)
        self.assertEqual(User.objects.count(), 1)
        self.assertEqual(Organization.objects.count(), 1)

    def test_unverified_or_unsigned_webhook_cannot_link_legacy_email(self):
        for signed, verification in ((True, 'unverified'), (False, 'verified')):
            with self.subTest(signed=signed, verification=verification):
                response = self.webhook('new-clerk-subject', verification, signed=signed)
                self.assertEqual(response.status_code, 409)
                self.assertEqual(response.data['code'], 'identity_link_required')
                self.assertNotIn(self.legacy.email, json.dumps(response.data))
        self.legacy.refresh_from_db()
        self.assertIsNone(self.legacy.clerk_user_id)
        self.assertEqual(User.objects.count(), 1)

    def test_signed_webhook_cannot_overwrite_existing_subject(self):
        self.legacy.clerk_user_id = 'original-subject'
        self.legacy.save(update_fields=['clerk_user_id'])
        response = self.webhook('other-subject', 'verified')
        self.assertEqual(response.status_code, 409)
        self.legacy.refresh_from_db()
        self.assertEqual(self.legacy.clerk_user_id, 'original-subject')
        self.assertEqual(User.objects.count(), 1)

    def test_subject_without_email_provisions_once_with_one_workspace(self):
        first = provision_local_user_from_clerk('fresh-subject')
        second = provision_local_user_from_clerk('fresh-subject')
        self.assertEqual(first.pk, second.pk)
        self.assertEqual(first.organizations.count(), 1)
        self.assertEqual(first.sedes.count(), 1)


@skipUnlessDBFeature('has_select_for_update')
class ClerkIdentityLinkingConcurrencyTests(TransactionTestCase):
    def setUp(self):
        self.user = User.objects.create_user('legacy', 'legacy@example.test', 'OriginalSecurePassword42!')
        self.org = Organization.objects.create(name='Existing workspace', owner=self.user)
        self.user.organizations.add(self.org)

    def race(self, subjects):
        from concurrent.futures import ThreadPoolExecutor
        from threading import Barrier
        from django.db import close_old_connections
        barrier = Barrier(2)

        def link(subject):
            close_old_connections()
            try:
                barrier.wait(timeout=10)
                try:
                    return provision_local_user_from_clerk(subject, self.user.email, email_verified=True).pk
                except ClerkIdentityConflict:
                    return 'conflict'
            finally:
                close_old_connections()

        with ThreadPoolExecutor(max_workers=2) as workers:
            return list(workers.map(link, subjects))

    def test_same_subject_linking_converges_on_existing_workspace(self):
        self.assertEqual(self.race(['same-subject', 'same-subject']), [self.user.pk, self.user.pk])
        self.assertEqual(User.objects.count(), 1)
        self.assertEqual(Organization.objects.count(), 1)

    def test_competing_subjects_cannot_overwrite_the_winner(self):
        results = self.race(['subject-one', 'subject-two'])
        self.assertCountEqual(results, [self.user.pk, 'conflict'])
        self.user.refresh_from_db()
        self.assertIn(self.user.clerk_user_id, ('subject-one', 'subject-two'))
        self.assertEqual(User.objects.count(), 1)
        self.assertEqual(Organization.objects.count(), 1)
