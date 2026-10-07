"""Tenant, persistence and publish gates with real synthetic source documents."""
import copy
import io
import json
import os
import shutil
import tempfile
from datetime import timedelta
from unittest.mock import patch

from django.core.management import call_command
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from api.models import (Brand, Catalog, Component, DocumentImport, DocumentImportAsset,
                        Media, Organization, Page, Product, StudioCatalog, User)
from api.services.brand_intelligence import create_material_version
from api.tests_document_adapter import synthetic_pdf


class DocumentImportTests(TestCase):
    def setUp(self):
        self.private_root = tempfile.mkdtemp(prefix='document-private-')
        self.media_root = tempfile.mkdtemp(prefix='document-public-')
        settings = override_settings(DOCUMENT_IMPORT_PRIVATE_ROOT=self.private_root, MEDIA_ROOT=self.media_root)
        settings.enable()
        self.addCleanup(settings.disable)
        self.addCleanup(shutil.rmtree, self.private_root, True)
        self.addCleanup(shutil.rmtree, self.media_root, True)
        self.owner = User.objects.create_user(username='import-owner', role='editor')
        self.foreign = User.objects.create_user(username='import-foreign', role='editor')
        self.viewer = User.objects.create_user(username='import-viewer', role='viewer')
        self.member = User.objects.create_user(username='import-member', role='editor')
        self.org = Organization.objects.create(name='Import A', owner=self.owner)
        self.other_org = Organization.objects.create(name='Import B', owner=self.foreign)
        self.owner.organizations.add(self.org)
        self.foreign.organizations.add(self.other_org)
        self.viewer.organizations.add(self.org)
        self.member.organizations.add(self.org)
        self.client = APIClient()
        self.client.force_authenticate(self.owner)
        self.url = reverse('studio_catalog_import_document')

    def analyze(self, pages=None, **extra):
        response = self.client.post(self.url, {
            'file': SimpleUploadedFile('source.pdf', synthetic_pdf(pages or [{}]), 'application/pdf'),
            'organization': self.org.pk, **extra}, format='multipart')
        self.assertEqual(response.status_code, 200, response.data)
        return response.data

    def confirm(self, data, **extra):
        response = self.client.post(self.url, {'action': 'confirm', 'import_id': data['import_id'], **extra}, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        return StudioCatalog.objects.get(pk=response.data['catalog_id'])

    def share(self, catalog, enabled=True):
        return self.client.put(reverse('studio_catalog_detail', kwargs={'pk': catalog.pk}),
                               {'share_import': enabled}, format='json')

    def test_preview_is_private_source_complete_and_confirm_is_idempotent(self):
        sizes = [(595, 842), (300, 300), (842, 595)]
        with patch('api.ai.catalog_builder.generate_catalog_from_gemini') as generate:
            data = self.analyze([{'size': size} for size in sizes])
            generate.assert_not_called()
        self.assertEqual(StudioCatalog.objects.count(), 0)
        self.assertEqual([(p['pageWidth'], p['pageHeight']) for p in data['pages']], sizes)
        self.assertEqual(data['mode'], 'preserve')
        self.assertEqual(Media.objects.count(), 0)
        self.assertEqual(Product.objects.count(), 0)
        job = DocumentImport.objects.get(pk=data['import_id'])
        self.assertTrue(job.source_asset.file.path.startswith(self.private_root + os.sep))
        self.assertEqual(os.listdir(self.media_root), [])
        catalog = self.confirm(data)
        self.assertEqual((catalog.total_pages, catalog.spreads.count()), (3, 2))
        self.assertEqual(catalog.spreads.order_by('spread_index').last().right_page_elements, [])
        retry = self.client.post(self.url, {'action': 'confirm', 'import_id': data['import_id']}, format='json')
        self.assertEqual(retry.status_code, 200)
        self.assertEqual(retry.data['catalog_id'], catalog.pk)
        self.assertEqual(StudioCatalog.objects.count(), 1)
        self.assertEqual(self.client.delete(self.url + '?import_id=' + str(job.pk)).status_code, 400)

    def test_explicit_share_exposes_only_render_assets_and_can_be_revoked(self):
        data = self.analyze()
        job = DocumentImport.objects.get(pk=data['import_id'])
        snapshot_url = data['pages'][0]['documentPage']['sourceSnapshot']['url']
        source_url = reverse('studio_catalog_import_asset', kwargs={'asset_id': job.source_asset_id})
        catalog = self.confirm(data)
        reader = reverse('studio_public_catalog_detail', kwargs={'catalog_id': str(catalog.pk)})
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(snapshot_url).status_code, 404)
        self.assertEqual(self.client.get(reader).status_code, 403)
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.share(catalog).status_code, 200)
        self.client.force_authenticate(None)
        public = self.client.get(reader)
        self.assertEqual(public.status_code, 200, public.data)
        self.assertNotIn('import_metadata', public.data)
        self.assertNotIn('document_ir', public.data)
        self.assertEqual(self.client.get(snapshot_url).status_code, 200)
        self.assertEqual(self.client.get(source_url).status_code, 404)
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.share(catalog, False).status_code, 200)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(snapshot_url).status_code, 404)


    def test_public_source_projection_does_not_expose_hidden_text_or_unused_image(self):
        from PIL import Image
        data = self.analyze([{'crop': [0, 0, 150, 100], 'image': Image.new('RGB', (60, 40), 'red'),
             'content': 'BT /F1 12 Tf 500 500 Td (HIDDEN-CROP-SECRET) Tj ET'}])
        self.assertIn('HIDDEN-CROP-SECRET', str(data['document_ir']))
        job = DocumentImport.objects.get(pk=data['import_id'])
        image = job.assets.filter(kind='image').first()
        self.assertIsNotNone(image)
        catalog = self.confirm(data)
        self.assertEqual(self.share(catalog).status_code, 200)
        catalog.unassigned_products = [{'id': 'private-inventory', 'name': 'UNRENDERED-INVENTORY-SECRET'}]
        catalog.save(update_fields=['unassigned_products'])
        self.client.force_authenticate(None)
        public = self.client.get(reverse('studio_public_catalog_detail', kwargs={'catalog_id': str(catalog.pk)}))
        self.assertEqual(public.status_code, 200)
        serialized = str(public.data)
        self.assertNotIn('HIDDEN-CROP-SECRET', serialized)
        self.assertNotIn('UNRENDERED-INVENTORY-SECRET', serialized)
        self.assertEqual(public.data['unassigned_products'], [])
        for field in ('sourceText', 'provenance', 'sourceBounds', 'matrix', 'cropBox', 'sourceTextHash'):
            self.assertNotIn(field, serialized)
        document = public.data['spreads'][0]['left_page']['documentPage']
        self.assertEqual(document['elements'], [])
        self.assertEqual(document['visibility'], 'source_only')
        self.assertEqual(self.client.get(document['sourceSnapshot']['url']).status_code, 200)
        self.assertEqual(self.client.get(reverse('studio_catalog_import_asset', kwargs={'asset_id': image.pk})).status_code, 404)
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.get(reverse('studio_catalog_import_asset', kwargs={'asset_id': image.pk})).status_code, 200)

    def test_public_editable_projection_keeps_rendered_text_and_appearance_only(self):
        data = self.analyze([{'content': 'BT /F1 20 Tf 30 100 Td (Visible title) Tj ET\nBT /F1 12 Tf 500 500 Td (OFFPAGE-SECRET) Tj ET'}], mode='editable')
        catalog = self.confirm(data)
        self.assertEqual(self.share(catalog).status_code, 200)
        self.client.force_authenticate(None)
        public = self.client.get(reverse('studio_public_catalog_detail', kwargs={'catalog_id': str(catalog.pk)}))
        self.assertEqual(public.status_code, 200)
        self.assertNotIn('OFFPAGE-SECRET', str(public.data))
        document = public.data['spreads'][0]['left_page']['documentPage']
        self.assertEqual(len(document['elements']), 1)
        self.assertNotIn('text', document['elements'][0])
        self.assertNotIn('content', document['elements'][0])
        self.assertNotIn('provenance', document['elements'][0])
        self.assertEqual(self.client.get(document['fallbackSnapshot']['url']).status_code, 200)
        self.assertEqual(self.client.get(document['elements'][0]['appearance']['asset']['url']).status_code, 200)

    def test_tenant_roles_and_removed_creator_are_enforced(self):
        self.client.force_authenticate(self.member)
        data = self.analyze()
        catalog = self.confirm(data)
        snapshot = data['pages'][0]['documentPage']['sourceSnapshot']['url']
        self.client.force_authenticate(self.viewer)
        self.assertEqual(self.client.get(self.url, {'import_id': data['import_id']}).status_code, 200)
        self.assertEqual(self.client.post(self.url, {'action': 'confirm', 'import_id': data['import_id']}, format='json').status_code, 403)
        self.assertEqual(self.share(catalog).status_code, 403)
        self.client.force_authenticate(self.foreign)
        self.assertEqual(self.client.get(self.url, {'import_id': data['import_id']}).status_code, 404)
        self.assertEqual(self.client.get(snapshot).status_code, 404)
        self.member.organizations.remove(self.org)
        self.client.force_authenticate(self.member)
        self.assertEqual(self.client.get(snapshot).status_code, 404)
        self.assertEqual(self.client.get(reverse('studio_catalog_detail', kwargs={'pk': catalog.pk})).status_code, 404)

    def test_material_edits_invalidate_import_gate_but_noop_save_does_not(self):
        data = self.analyze(mode='editable')
        catalog = self.confirm(data, mode='editable')
        self.assertEqual(self.share(catalog).status_code, 200)
        spread = catalog.spreads.first()
        bulk = reverse('studio_spread_bulk_sync', kwargs={'catalog_id': catalog.pk})
        payload = {'spreads': [{'spread_index': 0, 'left_page_elements': spread.left_page_elements,
                               'right_page_elements': spread.right_page_elements}], 'total_pages': 1}
        self.assertEqual(self.client.post(bulk, payload, format='json').status_code, 200)
        catalog.refresh_from_db()
        self.assertTrue(catalog.import_metadata['quality']['passed'])
        self.assertTrue(catalog.import_metadata['share_enabled'])
        original_page = copy.deepcopy(payload['spreads'][0]['left_page_elements'][0]['documentPage'])
        payload['spreads'][0]['left_page_elements'][0]['documentPage']['width'] = 1
        self.assertEqual(self.client.post(bulk, payload, format='json').status_code, 400)
        payload['spreads'][0]['left_page_elements'][0]['documentPage'] = original_page
        text = next(element for element in original_page['elements'] if element['type'] == 'text' and element['editable'])
        text.update(text='Customer edited title', edited=True)
        self.assertEqual(self.client.post(bulk, payload, format='json').status_code, 200)
        catalog.refresh_from_db()
        self.assertFalse(catalog.import_metadata['quality']['passed'])
        self.assertFalse(catalog.import_metadata['share_enabled'])
        self.assertEqual(self.share(catalog).status_code, 400)
        self.assertEqual(DocumentImport.objects.get(pk=data['import_id']).document_ir['pages'][0]['width'], 300)

    def test_source_forgery_cannot_be_approved_by_share_or_metadata_payload(self):
        data = self.analyze()
        catalog = self.confirm(data)
        spread = catalog.spreads.first()
        forged = copy.deepcopy(spread.left_page_elements)
        forged[0]['documentPage']['sourceSnapshot']['url'] = '/media/foreign.png'
        spread.left_page_elements = forged
        spread.save(update_fields=['left_page_elements'])
        self.assertEqual(self.share(catalog).status_code, 400)
        self.assertEqual(self.client.put(reverse('studio_catalog_detail', kwargs={'pk': catalog.pk}),
                        {'import_metadata': {'quality': {'passed': True}}}, format='json').status_code, 400)

    def test_redesign_exception_retains_all_source_pages_and_blocks_publication(self):
        with patch('api.ai.catalog_builder.generate_catalog_from_gemini', side_effect=RuntimeError('private source secret')):
            data = self.analyze(mode='redesign')
        self.assertTrue(data['report']['redesignFallback'])
        self.assertFalse(data['report']['quality']['passed'])
        self.assertEqual(data['pages'][0]['renderMode'], 'document')
        self.assertNotIn('private source secret', str(data))
        catalog = self.confirm(data)
        self.assertEqual(self.share(catalog).status_code, 400)
        self.assertTrue(DocumentImport.objects.get(pk=data['import_id']).source_asset.file.storage.exists(
            DocumentImport.objects.get(pk=data['import_id']).source_asset.file.name))

    def test_mode_prepare_and_explicit_brand_capture(self):
        brand = Brand.objects.create(name='Source brand', organization=self.org, created_by=self.owner)
        create_material_version(brand, self.owner)
        foreign_brand = Brand.objects.create(name='Other brand', organization=self.other_org, created_by=self.foreign)
        self.owner.organizations.add(self.other_org)
        denied = self.client.post(self.url, {'file': SimpleUploadedFile('source.pdf', synthetic_pdf([{}]), 'application/pdf'),
                     'organization': self.org.pk, 'brand_id': foreign_brand.pk}, format='multipart')
        self.assertEqual(denied.status_code, 400)
        data = self.analyze(brand_id=str(brand.pk))
        unprepared = self.client.post(self.url, {'action': 'confirm', 'import_id': data['import_id'], 'mode': 'redesign'}, format='json')
        self.assertEqual(unprepared.status_code, 400)
        catalog = self.confirm(data, mode='editable')
        self.assertEqual(catalog.brand_id, brand.pk)
        self.assertEqual(catalog.brand_snapshot['identity']['name'], 'Source brand')
        self.assertEqual(catalog.import_metadata['mode'], 'editable')
        self.assertIn(catalog.spreads.first().left_page_elements[0]['documentPage']['visibility'], ('hybrid', 'reconstructed'))

    def test_product_photo_is_retained_as_a_private_png_without_product_creation(self):
        from PIL import Image
        data = self.analyze([{'image': Image.new('RGB', (60, 40), 'red')}])
        job = DocumentImport.objects.get(pk=data['import_id'])
        self.assertTrue(job.assets.filter(kind='image').exists())
        self.assertTrue(job.assets.filter(kind='source_snapshot').exists())
        self.assertEqual(Product.objects.count(), 0)
        self.assertEqual(Media.objects.count(), 0)

    def test_expiry_and_cancellation_clean_private_files_but_retain_confirmed_history(self):
        data = self.analyze()
        job = DocumentImport.objects.get(pk=data['import_id'])
        files = list(job.assets.values_list('file', flat=True))
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.delete(self.url + '?import_id=' + data['import_id'])
        self.assertEqual(response.status_code, 204)
        self.assertFalse(DocumentImport.objects.filter(pk=job.pk).exists())
        self.assertTrue(all(not os.path.exists(os.path.join(self.private_root, name)) for name in files))
        expired = self.analyze()
        confirmed = self.analyze()
        catalog = self.confirm(confirmed)
        DocumentImport.objects.update(expires_at=timezone.now() - timedelta(hours=1))
        self.assertEqual(self.client.get(self.url, {'import_id': expired['import_id']}).status_code, 400)
        with self.captureOnCommitCallbacks(execute=True):
            call_command('prune_document_imports', stdout=io.StringIO())
        self.assertFalse(DocumentImport.objects.filter(pk=expired['import_id']).exists())
        self.assertTrue(DocumentImport.objects.filter(pk=confirmed['import_id'], catalog=catalog).exists())

    def test_fail_closed_unsupported_invalid_oversized_and_anonymous_inputs(self):
        for name, content, mime, expected in [('bad.pdf', b'%PDF-broken', 'application/pdf', 422),
                ('source.docx', b'PK\x03\x04fake', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 415),
                ('bad.pdf', synthetic_pdf([{}]), 'text/plain', 415)]:
            response = self.client.post(self.url, {'file': SimpleUploadedFile(name, content, mime),
                                        'organization': self.org.pk}, format='multipart')
            self.assertEqual(response.status_code, expected, response.data)
        self.assertEqual(DocumentImport.objects.count(), 0)
        with patch('api.services.document_preflight.MAX_SOURCE_BYTES', 10):
            response = self.client.post(self.url, {'file': SimpleUploadedFile('oversized.pdf', b'x' * 20, 'application/pdf'),
                                'organization': self.org.pk}, format='multipart')
        self.assertEqual(response.status_code, 413)
        self.assertEqual(self.client.post(self.url, {'file': SimpleUploadedFile('source.pdf', synthetic_pdf([{}]), 'application/pdf')}, format='multipart').status_code, 400)
        self.client.force_authenticate(None)
        self.assertIn(self.client.post(self.url, {}, format='json').status_code, (401, 403))

    def test_confirm_respects_catalog_quota_and_retry_is_not_double_charged(self):
        from api.guards.quota_guard import CatalogLimitExceededException
        data = self.analyze()
        with patch('api.guards.quota_guard.check_catalog_creation_guard', side_effect=CatalogLimitExceededException):
            denied = self.client.post(self.url, {'action': 'confirm', 'import_id': data['import_id']}, format='json')
        self.assertEqual(denied.status_code, 403)
        self.assertEqual(StudioCatalog.objects.count(), 0)
        catalog = self.confirm(data)
        with patch('api.guards.quota_guard.check_catalog_creation_guard', side_effect=CatalogLimitExceededException):
            retry = self.client.post(self.url, {'action': 'confirm', 'import_id': data['import_id']}, format='json')
        self.assertEqual(retry.status_code, 200)
        self.assertEqual(retry.data['catalog_id'], catalog.pk)

    def test_native_replace_checks_scope_before_deleting_pages(self):
        catalog = Catalog.objects.create(title='Private', organization=self.other_org, created_by=self.foreign)
        Page.objects.create(catalog=catalog, order=0)
        payload = {'app': 'Catana', 'schemaVersion': '1.0', 'catalog': {'name': 'Replacement'}, 'pages': []}
        response = self.client.post('/api/catalogs/import-json/', {'data': payload, 'mode': 'replace', 'catalog_id': catalog.pk}, format='json')
        self.assertIn(response.status_code, (403, 404))
        self.assertEqual(catalog.pages.count(), 1)
        self.owner.organizations.add(self.other_org)
        response = self.client.post('/api/catalogs/import-json/', {'data': payload, 'mode': 'replace',
                     'catalog_id': catalog.pk, 'organization': self.org.pk}, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(catalog.pages.count(), 1)

    def test_private_storage_rejects_media_directory_and_symlink(self):
        from api.document_storage import private_document_storage
        alias = os.path.join(self.private_root, 'public-alias')
        os.symlink(self.media_root, alias)
        with override_settings(DOCUMENT_IMPORT_PRIVATE_ROOT=alias):
            with self.assertRaises(ValueError):
                _ = private_document_storage.location

    def test_source_worker_runs_before_any_job_insert(self):
        from api.services.pdf_import_adapter import PdfImportAdapter
        real_analyze = PdfImportAdapter.analyze

        def worker_before_write(data, filename, sink):
            self.assertEqual(DocumentImport.objects.count(), 0)
            self.assertEqual(DocumentImportAsset.objects.count(), 0)
            return real_analyze(data, filename, sink)

        with patch('api.services.pdf_import_adapter.PdfImportAdapter.analyze', side_effect=worker_before_write):
            self.analyze()
        self.assertEqual(DocumentImport.objects.count(), 1)

    def test_sqlite_confirmation_conflict_is_controlled_and_retryable(self):
        from django.db import OperationalError
        data = self.analyze()
        with patch('api.services.document_reconstructor.DocumentReconstructorService.confirm_import',
                   side_effect=OperationalError('database is locked')):
            response = self.client.post(self.url, {'action': 'confirm', 'import_id': data['import_id']}, format='json')
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data['code'], 'document_import_retry_conflict')
        self.assertEqual(StudioCatalog.objects.count(), 0)
        catalog = self.confirm(data)
        self.assertEqual(catalog.total_pages, 1)

    def test_unexpected_errors_at_all_four_response_sinks_use_static_http_failure(self):
        source = self.analyze()
        secret = 'INTERNAL_SECRET Traceback (most recent call last): ValueError /srv/private/import.pdf'
        requests = [
            lambda: self.client.get(self.url, {'import_id': source['import_id']}),
            lambda: self.client.post(self.url, {'file': SimpleUploadedFile('source.pdf', synthetic_pdf([{}]), 'application/pdf'),
                    'organization': self.org.pk}, format='multipart'),
            lambda: self.client.post(self.url, {'action': 'prepare', 'import_id': source['import_id']}, format='json'),
            lambda: self.client.post(self.url, {'action': 'confirm', 'import_id': source['import_id']}, format='json'),
        ]
        for invoke in requests:
            with self.subTest(action=invoke), patch('api.services.document_reconstructor.DocumentReconstructorService.response',
                    side_effect=RuntimeError(secret)):
                response = invoke()
            self.assertEqual(response.status_code, 500)
            self.assertEqual(response.data, {'code': 'document_import_failed',
                'error': 'Não foi possível concluir a importação. Tente novamente.'})
            self.assertNotIn(secret, response.content.decode())

    def test_document_errors_are_remapped_at_every_api_action_even_after_attribute_mutation(self):
        from api.services.document_preflight import DocumentImportError
        source = self.analyze()
        secret = 'PRIVATE_EXCEPTION Traceback /srv/private/original.pdf'
        scenarios = [
            ('analyze_file', lambda: self.client.post(self.url, {'file': SimpleUploadedFile('source.pdf', synthetic_pdf([{}]), 'application/pdf'),
                    'organization': self.org.pk}, format='multipart')),
            ('get_import', lambda: self.client.get(self.url, {'import_id': source['import_id']})),
            ('prepare_preview', lambda: self.client.post(self.url, {'action': 'prepare', 'import_id': source['import_id']}, format='json')),
            ('confirm_import', lambda: self.client.post(self.url, {'action': 'confirm', 'import_id': source['import_id']}, format='json')),
            ('cancel_import', lambda: self.client.delete(self.url + '?import_id=' + source['import_id'])),
        ]
        for operation, invoke in scenarios:
            error = DocumentImportError('document_docx_unsupported', secret, 200)
            error.message, error.status_code = secret, 200
            with self.subTest(operation=operation), patch('api.services.document_reconstructor.DocumentReconstructorService.' + operation,
                    side_effect=error):
                response = invoke()
            self.assertEqual(response.status_code, 415)
            self.assertEqual(response.data, {'code': 'document_docx_unsupported',
                'error': 'DOCX ainda não é suportado. Exporte o documento para PDF.'})
            self.assertNotIn(secret, response.content.decode())

    def test_unknown_worker_error_details_and_status_are_not_reflected_or_persisted(self):
        from unittest.mock import Mock
        secret = 'PRIVATE_WORKER_SECRET Traceback ValueError /srv/private/document.pdf'
        for code in ('unknown-' + secret, {'private': secret}, 'document_docx_unsupported'):
            with self.subTest(code=code):
                process = Mock()
                process.communicate.return_value = (json.dumps({'error': {'code': code, 'message': secret, 'status_code': 200}}).encode(), b'')
                process.returncode = 0
                with patch('api.services.pdf_import_adapter.subprocess.Popen', return_value=process):
                    response = self.client.post(self.url, {'file': SimpleUploadedFile('source.pdf', synthetic_pdf([{}]), 'application/pdf'),
                                             'organization': self.org.pk}, format='multipart')
                known = code == 'document_docx_unsupported'
                self.assertEqual(response.status_code, 415 if known else 422)
                self.assertEqual(response.data['code'], 'document_docx_unsupported' if known else 'processing_failed')
                for marker in ('PRIVATE_WORKER_SECRET', 'Traceback', 'ValueError', '/srv/private'):
                    self.assertNotIn(marker, response.content.decode())
        self.assertEqual(DocumentImport.objects.count(), 0)
        self.assertEqual(DocumentImportAsset.objects.count(), 0)
        self.assertEqual(StudioCatalog.objects.count(), 0)

    def test_redesign_exception_details_do_not_reach_analyze_get_prepare_or_confirm_success(self):
        secret = 'SOURCE_PRIVATE_TRACEBACK Traceback (most recent call last): ValueError /srv/private/customer.pdf'
        for failure_target in ('api.ai.pipeline.EditorialGenerationPipeline._execute',
                               'api.ai.composition_planner.CompositionPlanner.compose_page'):
            with self.subTest(failure_target=failure_target), patch(failure_target, side_effect=ValueError(secret)):
                source = self.analyze(mode='redesign')
                responses = [source]
                get = self.client.get(self.url, {'import_id': source['import_id']})
                self.assertEqual(get.status_code, 200)
                responses.append(get.data)
                prepared = self.client.post(self.url, {'action': 'prepare', 'import_id': source['import_id'], 'mode': 'redesign'}, format='json')
                self.assertEqual(prepared.status_code, 200, prepared.data)
                responses.append(prepared.data)
                confirmed = self.client.post(self.url, {'action': 'confirm', 'import_id': source['import_id']}, format='json')
                self.assertEqual(confirmed.status_code, 201, confirmed.data)
                responses.append(confirmed.data)
                reloaded = self.client.get(self.url, {'import_id': source['import_id']})
                self.assertEqual(reloaded.status_code, 200)
                responses.append(reloaded.data)
                for payload in responses:
                    serialized = json.dumps(payload)
                    for marker in ('SOURCE_PRIVATE_TRACEBACK', 'Traceback', 'ValueError', '/srv/private'):
                        self.assertNotIn(marker, serialized)
                    self.assertIn('Source title', serialized)
                    self.assertFalse(payload['report']['quality']['passed'])
                self.assertEqual(StudioCatalog.objects.get(pk=confirmed.data['catalog_id']).import_metadata['quality']['passed'], False)

    def test_full_quota_analysis_is_retained_until_archive_and_confirm_retry(self):
        from api.models import OrganizationQuota
        from api.guards.quota_guard import get_or_create_default_plan
        OrganizationQuota.objects.update_or_create(organization=self.org, defaults={'plan': get_or_create_default_plan('free')})
        catalogs = [StudioCatalog.objects.create(organization=self.org, created_by=self.owner, title=f'Existing {i}') for i in range(5)]
        data = self.analyze([{}], mode='editable')
        self.assertEqual(StudioCatalog.objects.filter(organization=self.org).count(), 5)
        response = self.client.post(self.url, {'action': 'confirm', 'import_id': data['import_id']}, format='json')
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data['code'], 'catalog_limit_exceeded')
        job = DocumentImport.objects.get(pk=data['import_id'])
        self.assertEqual(job.status, 'ready'); self.assertIsNone(job.catalog_id)
        self.assertEqual(job.previews, data['pages'])
        archived = self.client.put(reverse('studio_catalog_detail', kwargs={'pk': catalogs[0].pk}), {'status': 'archived'}, format='json')
        self.assertEqual(archived.status_code, 200)
        saved = self.client.post(self.url, {'action': 'confirm', 'import_id': data['import_id']}, format='json')
        self.assertEqual(saved.status_code, 201)
        retried = self.client.post(self.url, {'action': 'confirm', 'import_id': data['import_id']}, format='json')
        self.assertEqual(retried.status_code, 200)
        self.assertEqual(retried.data['catalog_id'], saved.data['catalog_id'])
        self.assertEqual(StudioCatalog.objects.filter(organization=self.org, status='active').count(), 5)
