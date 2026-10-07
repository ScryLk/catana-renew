import json
from unittest.mock import patch
from django.test import TestCase
from api import tests_imported_text_resolver as resolver_tests
from api.ai.provider import AIResponseChunk

class AgentProtocolTests(TestCase):
    setUp = resolver_tests.ImportedTextResolverTests.setUp
    analyze = resolver_tests.ImportedTextResolverTests.analyze
    confirm = resolver_tests.ImportedTextResolverTests.confirm
    chat = resolver_tests.ImportedTextResolverTests.chat

    def stream(self, raw):
        catalog = self.confirm(self.analyze([{} for _ in range(8)], mode='preserve'))
        chunks = [AIResponseChunk(text=raw), AIResponseChunk(done=True, metadata={})]
        with patch('api.ai.agents.base.BaseAgent.process_stream', return_value=iter(chunks)):
            _, events = self.chat(catalog, 'crie uma outra página de finalização do catálogo')
        return events

    def test_valid_patch_is_separate_from_human_text(self):
        patch_data = {'actions':[{'action':'add_page','target':'catalog:pages','params':{'afterPage':8,'contentRole':'closing','type':'backcover'}}]}
        events = self.stream('Proposta\n```json:patch\n'+json.dumps(patch_data)+'\n```')
        self.assertTrue(any(e['event']=='patch' for e in events))
        self.assertNotIn('```', ''.join(e.get('text','') for e in events))
        self.assertNotIn('catalog:pages', ''.join(e.get('text','') for e in events))

    def test_truncated_protocol_is_suppressed_and_not_executable(self):
        events = self.stream('Atualizando o título.\n```json:patch\n{"actions":[')
        self.assertNotIn('```', ''.join(e.get('text','') for e in events))
        self.assertFalse(any(e['event']=='patch' for e in events))
        self.assertTrue(any(e['event']=='protocol_error' for e in events))

class AgentOutputParserTests(TestCase):
    def test_malformed_multiple_and_partial_fences_fail_closed(self):
        from api.services.agent_output import parse_agent_output
        valid = '```json:patch\n{"actions":[]}\n```'
        for raw in ('```json:patch', '```json:pa', '```patch\n{"actions":[', valid + valid, '```json:patch\nnot json\n```', '```python\n{"actions":[]}\n```', '{"label":"private","actions":[]}\n```text\nhello\n```'):
            with self.subTest(raw=raw):
                result = parse_agent_output('Proposta\n' + raw)
                self.assertEqual(result.protocol_status, 'invalid')
                self.assertIsNone(result.patch_candidate)
                self.assertNotIn('```', result.human_text)

class ClerkProvisioningTests(TestCase):
    def test_repeated_first_requests_have_one_local_identity_and_workspace(self):
        from api.clerk_auth import provision_local_user_from_clerk
        from api.models import Organization, User
        first = provision_local_user_from_clerk('user_A', 'a@example.test')
        second = provision_local_user_from_clerk('user_A', 'a@example.test')
        other = provision_local_user_from_clerk('user_B', 'b@example.test')
        self.assertEqual(first.pk, second.pk)
        self.assertNotEqual(first.pk, other.pk)
        self.assertEqual(User.objects.filter(clerk_user_id='user_A').count(), 1)
        self.assertEqual(Organization.objects.filter(owner=first).count(), 1)

    def test_workspace_failure_rolls_back_identity(self):
        from api.clerk_auth import provision_local_user_from_clerk
        from api.models import User, Organization
        with patch('api.models.Sede.objects.create', side_effect=RuntimeError('failure')):
            with self.assertRaises(RuntimeError):
                provision_local_user_from_clerk('user_A', 'a@example.test')
        self.assertFalse(User.objects.filter(clerk_user_id='user_A').exists())
        self.assertEqual(Organization.objects.count(), 0)

class BackendAuthPreflightTests(TestCase):
    def settings(self, **overrides):
        from types import SimpleNamespace
        values = dict(AUTH_PROVIDER='clerk',DEBUG=False,ENVIRONMENT='production',SECRET_KEY='nonproduction-test-key-'*4,ALLOWED_HOSTS=['example.test'],CLERK_JWKS_URL='https://example.clerk.accounts.dev/.well-known/jwks.json',CLERK_SECRET_KEY='')
        return SimpleNamespace(**{**values, **overrides})

    def validate(self, **overrides):
        import importlib.util
        from pathlib import Path
        source = Path(__file__).resolve().parents[2] / 'scripts' / 'deploy_preflight.py'
        spec = importlib.util.spec_from_file_location('deploy_preflight', source)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module.validate_backend_config(self.settings(**overrides))

    def test_requires_explicit_mode_and_https_jwks(self):
        self.assertTrue(self.validate(AUTH_PROVIDER='mixed'))
        self.assertTrue(self.validate(CLERK_JWKS_URL=''))
        self.assertTrue(self.validate(CLERK_JWKS_URL='http://example.test/jwks'))
        self.assertTrue(self.validate(CLERK_JWKS_URL='https://api.clerk.com/v1/jwks'))
        self.assertFalse(self.validate())
        self.assertFalse(self.validate(AUTH_PROVIDER='legacy', CLERK_JWKS_URL=''))

from django.test import TransactionTestCase, skipUnlessDBFeature

@skipUnlessDBFeature('has_select_for_update')
class ClerkProvisioningConcurrencyTests(TransactionTestCase):
    def test_simultaneous_first_login_has_one_user_and_one_workspace(self):
        from concurrent.futures import ThreadPoolExecutor
        from threading import Barrier
        from django.db import close_old_connections
        from api import clerk_auth
        from api.models import User, Organization, Sede, OrganizationQuota
        original = clerk_auth._create_local_user_from_clerk
        barrier = Barrier(2)
        def create_after_race(*args, **kwargs):
            barrier.wait(timeout=10)
            return original(*args, **kwargs)
        def provision():
            close_old_connections()
            try:
                return clerk_auth.provision_local_user_from_clerk('user_concurrent', 'race@example.test').pk
            finally:
                close_old_connections()
        with patch('api.clerk_auth._create_local_user_from_clerk', side_effect=create_after_race):
            with ThreadPoolExecutor(max_workers=2) as workers:
                ids = list(workers.map(lambda _: provision(), range(2)))
        self.assertEqual(ids[0], ids[1])
        self.assertEqual(User.objects.filter(clerk_user_id='user_concurrent').count(), 1)
        self.assertEqual(Organization.objects.filter(owner_id=ids[0]).count(), 1)
        self.assertEqual(Sede.objects.count(), 1)
        self.assertEqual(OrganizationQuota.objects.count(), 1)
