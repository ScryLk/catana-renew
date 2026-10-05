"""Exercise the real HTTP/persistence boundary without live or paid AI calls."""
import copy
from unittest.mock import patch

from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from api.models import Brand, BrandGuideline, Organization, StudioCatalog, User, ChatThread
from api.services.brand_intelligence import create_material_version, snapshot_hash


class BrandStudioIntegrationTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='brand-studio-owner', role='editor')
        self.other = User.objects.create_user(username='brand-studio-other', role='editor')
        self.organization = Organization.objects.create(name='Atelier', owner=self.owner)
        self.other_org = Organization.objects.create(name='Other tenant', owner=self.other)
        self.owner.organizations.add(self.organization)
        self.other.organizations.add(self.other_org)
        self.brand = Brand.objects.create(
            organization=self.organization, created_by=self.owner, name='Atelier',
            tone_of_voice='Preciso e direto', custom_palette={'primary': '#102A43'},
            brand_markdown='# Private identity manual\nDo not change commercial truth.',
        )
        create_material_version(self.brand, self.owner)
        self.client = APIClient()
        self.client.force_authenticate(self.owner)

    @staticmethod
    def generated():
        return {
            'title': 'Collection', 'palette': {'primary': '#102A43', 'background': '#FFFFFF', 'accent': '#444444'},
            'pages': [{'pageNumber': 1, 'title': 'Cover'}, {'pageNumber': 2, 'title': 'Products'}],
            'brandSnapshot': {'identity': {'name': 'Untrusted builder replacement'}},
            'qualityGate': {'status': 'passed', 'passed': True, 'publishable': True},
        }

    def create_catalog(self, **extra):
        return self.client.post(reverse('studio_catalog_list'), {
            'title': 'Historical catalog', 'brand_id': str(self.brand.pk),
            'organization': self.organization.pk, **extra,
        }, format='json')

    def generate(self, **extra):
        return self.client.post(reverse('studio_catalog_generate'), {
            'prompt': 'New catalog', 'brand_id': str(self.brand.pk),
            'organization': self.organization.pk, **extra,
        }, format='json')

    def test_manual_catalog_links_authorized_brand_and_owns_snapshot(self):
        response = self.create_catalog(brand_snapshot={'identity': {'name': 'Client fake'}}, brand_version=999)
        self.assertEqual(response.status_code, 201, response.data)
        catalog = StudioCatalog.objects.get(pk=response.data['id'])
        self.assertEqual(catalog.brand_id, self.brand.pk)
        self.assertEqual(catalog.brand_version, 1)
        self.assertEqual(catalog.brand_snapshot['identity']['name'], 'Atelier')
        self.assertEqual(catalog.brand_snapshot_hash, snapshot_hash(catalog.brand_snapshot))

    def test_unbranded_personal_catalog_still_works(self):
        response = self.client.post(reverse('studio_catalog_list'), {'title': 'Avulso'}, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertIsNone(response.data['brand'])
        self.assertEqual(response.data['brand_snapshot'], {})

    def test_catalog_remains_v1_after_brand_v2_and_ordinary_save(self):
        response = self.create_catalog()
        catalog = StudioCatalog.objects.get(pk=response.data['id'])
        previous = copy.deepcopy(catalog.brand_snapshot)
        self.brand.tone_of_voice = 'Uma nova voz'
        self.brand.save()
        create_material_version(self.brand, self.owner)
        response = self.client.put(reverse('studio_catalog_detail', kwargs={'pk': catalog.pk}), {
            'title': 'Edited title', 'brand': str(self.brand.pk),
        }, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        catalog.refresh_from_db()
        self.assertEqual(catalog.brand_version, 1)
        self.assertEqual(catalog.brand_snapshot, previous)
        fresh = self.create_catalog()
        self.assertEqual(fresh.data['brand_version'], 2)

    def test_client_cannot_overwrite_historical_snapshot(self):
        response = self.create_catalog()
        catalog = StudioCatalog.objects.get(pk=response.data['id'])
        previous = copy.deepcopy(catalog.brand_snapshot)
        response = self.client.put(reverse('studio_catalog_detail', kwargs={'pk': catalog.pk}), {
            'brand_snapshot': {'identity': {'name': 'Client fake'}},
        }, format='json')
        self.assertEqual(response.status_code, 400)
        catalog.refresh_from_db()
        self.assertEqual(catalog.brand_snapshot, previous)

    def test_dual_membership_does_not_allow_cross_organization_link(self):
        self.owner.organizations.add(self.other_org)
        response = self.create_catalog(organization=self.other_org.pk)
        self.assertEqual(response.status_code, 400)
        self.assertFalse(StudioCatalog.objects.exists())

    def test_wrong_tenant_and_anonymous_cannot_generate_brand(self):
        with patch('api.ai.catalog_builder.generate_catalog_from_gemini') as builder:
            self.client.force_authenticate(self.other)
            self.assertEqual(self.generate().status_code, 404)
            self.client.force_authenticate(None)
            self.assertIn(self.generate().status_code, (401, 403))
            builder.assert_not_called()

    def test_malformed_identity_references_fail_before_ai(self):
        with patch('api.ai.catalog_builder.generate_catalog_from_gemini') as builder:
            self.assertIn(self.generate(brand_id='not-a-uuid').status_code, (400, 404))
            self.assertEqual(self.generate(catalog_id='not-an-id').status_code, 400)
            builder.assert_not_called()

    def test_viewer_can_read_but_cannot_generate_or_mutate_brand_catalog(self):
        response = self.create_catalog()
        catalog_id = response.data['id']
        viewer = User.objects.create_user(username='brand-studio-viewer', role='viewer')
        viewer.organizations.add(self.organization)
        self.client.force_authenticate(viewer)
        detail = reverse('studio_catalog_detail', kwargs={'pk': catalog_id})
        self.assertEqual(self.client.get(detail).status_code, 200)
        self.assertEqual(self.client.put(detail, {'title': 'Forbidden'}, format='json').status_code, 403)
        self.assertEqual(self.generate().status_code, 403)
        self.assertEqual(self.client.post(reverse('studio_spread_bulk_sync', kwargs={'catalog_id': catalog_id}), {
            'spreads': [],
        }, format='json').status_code, 403)

    def test_generation_uses_and_persists_exact_snapshot_captured_before_ai(self):
        captured = {}

        def generation(**kwargs):
            captured.update(copy.deepcopy(kwargs['brand_context']))
            # A concurrent material edit must not change the in-flight catalog identity.
            self.brand.tone_of_voice = 'Versão dois'
            self.brand.save()
            create_material_version(self.brand, self.owner)
            return self.generated()

        with patch('api.ai.catalog_builder.generate_catalog_from_gemini', side_effect=generation):
            response = self.generate(brand_snapshot={'identity': {'name': 'Client fake'}})
        self.assertEqual(response.status_code, 200, response.data)
        catalog = StudioCatalog.objects.get(pk=response.data['studioCatalogId'])
        self.assertEqual(catalog.brand_snapshot, captured)
        self.assertEqual(response.data['brandSnapshot'], captured)
        self.assertEqual(catalog.brand_version, 1)
        self.assertEqual(catalog.brand_snapshot['tone']['text'], 'Preciso e direto')
        self.assertEqual(catalog.spreads.count(), 1)
        self.assertEqual(catalog.spreads.first().right_page_elements[0]['title'], 'Products')
        self.assertTrue(ChatThread.objects.filter(catalog=catalog).exists())
        self.assertEqual(response.data['brandSnapshotHash'], snapshot_hash(captured))

    def test_real_builder_consumes_persisted_guideline_and_preserves_product_truth(self):
        BrandGuideline.objects.create(brand=self.brand, type='AVOID', category='color',
                                      rule='Evitar dourado', status='confirmed', source='user_input')
        create_material_version(self.brand, self.owner)
        product = {'id': 'motor-a', 'name': 'Motor A', 'sku': 'A-001', 'price': '129.50',
                   'quantity': 4, 'inventory': 7, 'category': 'Motores', 'technical_specs': {'rpm': 1800}}
        original = copy.deepcopy(product)
        # Only disable optional template retrieval; HTTP -> resolver -> builder -> pipeline is real.
        with patch('api.services.template_rag.TemplateRAGService.retrieve_context_for_contract', return_value={}):
            result = self.generate(prompt='Catálogo industrial de 4 páginas', products=[product], creativeSeed=42)
        self.assertEqual(result.status_code, 200, result.data)
        self.assertNotEqual(result.data['palette']['accent'].lower(), '#c5a059')
        self.assertNotEqual(result.data['palette']['accent'].lower(), '#b08d57')
        catalog = StudioCatalog.objects.get(pk=result.data['studioCatalogId'])
        self.assertEqual(catalog.brand_version, 2)
        self.assertEqual(catalog.brand_snapshot['negative_constraints'][0]['rule'], 'Evitar dourado')
        self.assertEqual(catalog.brand_snapshot['categories'][0]['name'], 'Motores')
        self.assertEqual(product, original)

    def test_generation_from_old_catalog_uses_historical_identity(self):
        response = self.create_catalog()
        self.brand.name = 'New Brand name'
        self.brand.save()
        create_material_version(self.brand, self.owner)
        with patch('api.ai.catalog_builder.generate_catalog_from_gemini', return_value=self.generated()) as builder:
            result = self.generate(catalog_id=response.data['id'])
        self.assertEqual(result.status_code, 200, result.data)
        self.assertEqual(builder.call_args.kwargs['brand_context']['identity']['name'], 'Atelier')
        self.assertEqual(result.data['brandVersion'], 1)

    def test_anonymous_unbranded_generation_keeps_existing_contract(self):
        self.client.force_authenticate(None)
        with patch('api.ai.catalog_builder.generate_catalog_from_gemini', return_value=self.generated()) as builder:
            result = self.client.post(reverse('studio_catalog_generate'), {'prompt': 'Avulso'}, format='json')
        self.assertEqual(result.status_code, 200)
        self.assertNotIn('brand_context', builder.call_args.kwargs)
        self.assertNotIn('studioCatalogId', result.data)

    def test_public_reader_never_exposes_brand_snapshot_manual_or_memory(self):
        response = self.create_catalog()
        self.client.force_authenticate(None)
        public = self.client.get(reverse('studio_public_catalog_detail', kwargs={'catalog_id': str(response.data['id'])}))
        self.assertEqual(public.status_code, 200)
        self.assertNotIn('brand_snapshot', public.data)
        self.assertNotIn('Private identity manual', str(public.data))

    def test_generated_blocked_brand_draft_keeps_gate_and_cannot_be_publicly_shared(self):
        document = self.generated()
        document['qualityGate'] = {'status': 'blocked', 'passed': False, 'publishable': False}
        with patch('api.ai.catalog_builder.generate_catalog_from_gemini', return_value=document):
            result = self.generate()
        self.assertEqual(result.status_code, 200, result.data)
        catalog_id = result.data['studioCatalogId']
        detail_url = reverse('studio_catalog_detail', kwargs={'pk': catalog_id})
        self.assertEqual(self.client.get(detail_url).data['qualityGate'], document['qualityGate'])
        self.assertEqual(self.client.put(detail_url, {'qualityGate': {'status': 'passed'}}, format='json').status_code, 400)
        unlinked = self.client.put(detail_url, {'brand': None, 'update_brand_identity': True}, format='json')
        self.assertEqual(unlinked.status_code, 200, unlinked.data)
        self.client.force_authenticate(None)
        public = self.client.get(reverse('studio_public_catalog_detail', kwargs={'catalog_id': catalog_id}))
        self.assertEqual(public.status_code, 403)
        self.assertEqual(public.data['code'], 'brand_catalog_not_publishable')

    def test_generated_passed_brand_catalog_can_be_shared_without_private_context(self):
        with patch('api.ai.catalog_builder.generate_catalog_from_gemini', return_value=self.generated()):
            result = self.generate()
        self.client.force_authenticate(None)
        public = self.client.get(reverse('studio_public_catalog_detail', kwargs={'catalog_id': result.data['studioCatalogId']}))
        self.assertEqual(public.status_code, 200)
        self.assertNotIn('brandSnapshot', public.data)
        self.assertNotIn('brand_snapshot', public.data)

    def approved_catalog(self):
        with patch('api.ai.catalog_builder.generate_catalog_from_gemini', return_value=self.generated()):
            result = self.generate()
        self.assertEqual(result.status_code, 200, result.data)
        return StudioCatalog.objects.get(pk=result.data['studioCatalogId'])

    def assert_review_required(self, catalog):
        catalog.refresh_from_db()
        gate = catalog.generation_metadata['qualityGate']
        self.assertFalse(gate['passed'])
        self.assertFalse(gate['publishable'])
        self.assertEqual(gate['status'], 'needs_review')
        anonymous = APIClient()
        public = anonymous.get(reverse('studio_public_catalog_detail', kwargs={'catalog_id': catalog.pk}))
        self.assertEqual(public.status_code, 403, public.data)

    def test_changed_generated_pages_invalidate_approval_for_both_save_routes(self):
        for route in ('studio_spread_manage', 'studio_spread_bulk_sync'):
            with self.subTest(route=route):
                catalog = self.approved_catalog()
                item = {'spread_index': 0, 'left_page': {'pageNumber': 1, 'accentColor': '#C5A059'},
                        'right_page': {'pageNumber': 2, 'products': [{'sku': 'Changed', 'price': '1.00'}]}}
                payload = {'spreads': [item]} if route.endswith('bulk_sync') else item
                response = self.client.post(reverse(route, kwargs={'catalog_id': catalog.pk}), payload, format='json')
                self.assertEqual(response.status_code, 200, response.data)
                self.assertFalse(response.data['qualityGate']['publishable'])
                self.assert_review_required(catalog)

    def test_changed_generated_palette_and_page_count_invalidate_approval(self):
        for update in ({'palette_data': {'accent': '#C5A059'}}, {'total_pages': 8},
                       {'font_family': 'Times New Roman'}):
            with self.subTest(update=update):
                catalog = self.approved_catalog()
                response = self.client.put(reverse('studio_catalog_detail', kwargs={'pk': catalog.pk}), update, format='json')
                self.assertEqual(response.status_code, 200, response.data)
                self.assert_review_required(catalog)

    def test_idempotent_generated_content_saves_keep_approval_and_snapshot(self):
        catalog = self.approved_catalog()
        original_snapshot = copy.deepcopy(catalog.brand_snapshot)
        spread = catalog.spreads.first()
        item = {'spread_index': spread.spread_index, 'title': 'Editor navigation label',
                'left_page_elements': spread.left_page_elements, 'right_page_elements': spread.right_page_elements}
        responses = [
            self.client.post(reverse('studio_spread_manage', kwargs={'catalog_id': catalog.pk}), item, format='json'),
            self.client.post(reverse('studio_spread_bulk_sync', kwargs={'catalog_id': catalog.pk}),
                             {'spreads': [item], 'total_pages': catalog.total_pages}, format='json'),
            self.client.put(reverse('studio_catalog_detail', kwargs={'pk': catalog.pk}),
                            {'palette_data': catalog.palette_data, 'font_family': catalog.font_family}, format='json'),
        ]
        for response in responses:
            self.assertEqual(response.status_code, 200, response.data)
            self.assertTrue(response.data['qualityGate']['publishable'])
        catalog.refresh_from_db()
        self.assertEqual(catalog.brand_snapshot, original_snapshot)
        anonymous = APIClient()
        self.assertEqual(anonymous.get(reverse('studio_public_catalog_detail', kwargs={'catalog_id': catalog.pk})).status_code, 200)

    def test_removed_member_cannot_read_brand_catalog_or_thread_by_old_creator_access(self):
        editor = User.objects.create_user(username='brand-studio-former-editor', role='editor')
        editor.organizations.add(self.organization)
        self.client.force_authenticate(editor)
        response = self.create_catalog()
        catalog_id = response.data['id']
        thread_id = response.data['thread_id']
        editor.organizations.remove(self.organization)
        self.assertEqual(self.client.get(reverse('studio_catalog_detail', kwargs={'pk': catalog_id})).status_code, 404)
        self.assertEqual(self.client.get(reverse('studio_thread_messages', kwargs={'thread_id': thread_id})).status_code, 404)
