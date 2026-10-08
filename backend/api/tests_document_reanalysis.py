"""Review and reconcile retained source without silently replacing customer revisions."""
import copy
from unittest.mock import patch

from django.test import TestCase
from django.urls import reverse

from api.models import CatalogSpread, DocumentImport
from api import tests_document_import as import_tests
from api.services.document_reconstructor import DocumentReconstructorService, public_import_page


class SafeDocumentReanalysisTests(TestCase):
    setUp = import_tests.DocumentImportTests.setUp
    analyze = import_tests.DocumentImportTests.analyze
    confirm = import_tests.DocumentImportTests.confirm

    def catalog(self, pages=None):
        data = self.analyze(pages or [{'content': 'BT /F1 20 Tf 30 130 Td (CATALOGO DE) Tj ET BT /F1 21 Tf 30 105 Td (PRODUTOS) Tj ET'}], mode='editable')
        return self.confirm(data, mode='editable')

    def save_page(self, catalog, page):
        return self.client.post(reverse('studio_spread_manage', kwargs={'catalog_id': catalog.pk}),
            {'spread_index': 0, 'left_page': page, 'right_page_elements': []}, format='json')

    def prepare(self, catalog):
        response = self.client.post(self.url, {'action': 'reanalyze', 'catalog_id': catalog.pk}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        return response.data

    def accept(self, catalog, preview, **extra):
        return self.client.post(self.url, {'action': 'confirm_reanalysis', 'catalog_id': catalog.pk,
            'import_id': preview['import_id'], 'replace_reconstruction': True, **extra}, format='json')

    def revise(self, catalog, text='ITENS DE', style=None):
        page = copy.deepcopy(catalog.spreads.first().left_page_elements[0])
        element = next(e for e in page['documentPage']['elements'] if e.get('editable'))
        element.update(text=text, edited=True)
        if style:
            element['styleRevision'] = style
        self.assertEqual(self.save_page(catalog, page).status_code, 200)
        return element

    def test_preview_and_confirmation_preserve_text_style_and_immutable_history(self):
        catalog = self.catalog()
        source_id = catalog.source_import.pk
        source_ir = copy.deepcopy(catalog.source_import.document_ir)
        revised = self.revise(catalog, style={'fontWeight': 700})
        current = copy.deepcopy(catalog.spreads.first().left_page_elements)
        preview = self.prepare(catalog)
        review = preview['report']['reanalysis']
        self.assertEqual((review['preservedTextEdits'], review['preservedStyleEdits']), (1, 1))
        self.assertTrue(review['canConfirm'])
        self.assertEqual(review['conflicts'], [])
        self.assertEqual(catalog.spreads.first().left_page_elements, current)
        projected = next(e for e in review['reviewPages'][0]['documentPage']['elements'] if e['id'] == revised['id'])
        self.assertEqual(projected['text'], 'ITENS DE')
        self.assertEqual(projected['styleRevision'], {'fontWeight': 700})
        self.assertEqual(self.accept(catalog, preview).status_code, 200)
        catalog.refresh_from_db()
        result = next(e for e in catalog.spreads.first().left_page_elements[0]['documentPage']['elements'] if e['id'] == revised['id'])
        self.assertEqual((result['text'], result['styleRevision']), ('ITENS DE', {'fontWeight': 700}))
        self.assertEqual(result['provenance']['sourceText'], 'CATALOGO DE')
        old = DocumentImport.objects.get(pk=source_id)
        self.assertIsNone(old.catalog_id)
        self.assertEqual(old.document_ir, source_ir)
        self.assertEqual(old.status, 'confirmed')
        original = next(e for e in catalog.source_import.previews[0]['documentPage']['elements'] if e['id'] == revised['id'])
        self.assertEqual(original['text'], 'CATALOGO DE')
        self.assertNotIn('styleRevision', original)
        self.assertFalse(catalog.import_metadata['quality']['passed'])
        self.assertFalse(catalog.import_metadata['share_enabled'])

    def test_authored_pages_and_current_sequence_are_preserved(self):
        catalog = self.catalog([{'content': 'BT /F1 20 Tf 30 100 Td (FIRST) Tj ET'}, {'content': 'BT /F1 20 Tf 30 100 Td (SECOND) Tj ET'}])
        authored = {'id': 'authored-closing', 'pageNumber': 3, 'pageOrigin': 'catana_authored',
                    'type': 'quote', 'renderMode': 'generative', 'quote': 'Closing', 'products': [], 'blocks': []}
        CatalogSpread.objects.create(catalog=catalog, spread_index=1, left_page_elements=[authored], right_page_elements=[])
        catalog.total_pages = 3
        catalog.save(update_fields=['total_pages'])
        before_ids = [p['id'] for spread in catalog.spreads.order_by('spread_index') for side in (spread.left_page_elements, spread.right_page_elements) for p in side]
        preview = self.prepare(catalog)
        self.assertEqual(preview['report']['reanalysis']['preservedAuthoredPages'], 1)
        self.assertEqual(len(preview['report']['reanalysis']['reviewPages']), 3)
        self.assertEqual(self.accept(catalog, preview).status_code, 200)
        catalog.refresh_from_db()
        self.assertEqual(catalog.total_pages, 3)
        after = [p for spread in catalog.spreads.order_by('spread_index') for side in (spread.left_page_elements, spread.right_page_elements) for p in side]
        self.assertEqual([p['id'] for p in after], before_ids)
        self.assertEqual(after[-1], authored)

    def test_intervening_manual_revision_rejects_stale_confirmation(self):
        catalog = self.catalog()
        preview = self.prepare(catalog)
        self.revise(catalog, 'NEWER TEXT')
        before = copy.deepcopy(catalog.spreads.first().left_page_elements)
        source_id = catalog.source_import.pk
        response = self.accept(catalog, preview)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(str(response.data['code']), 'reanalysis_conflict')
        catalog.refresh_from_db()
        self.assertEqual(catalog.source_import.pk, source_id)
        self.assertEqual(catalog.spreads.first().left_page_elements, before)

    def test_unproved_target_blocks_even_explicit_replacement_and_keeps_current_catalog(self):
        catalog = self.catalog()
        revised = self.revise(catalog)
        source_id = catalog.source_import.pk
        current = copy.deepcopy(catalog.spreads.first().left_page_elements)
        prepared = DocumentReconstructorService.analyze_file(
            import_tests.synthetic_pdf([{'content': 'BT /F1 20 Tf 30 130 Td (CATALOGO DE) Tj ET BT /F1 21 Tf 30 105 Td (PRODUTOS) Tj ET'}]),
            'source.pdf', self.owner, self.org, mode='editable')
        target = next(e for e in prepared.previews[0]['documentPage']['elements'] if e['id'] == revised['id'])
        target.update(editable=False, sourceVisible=False, visibilityStatus='partiallyOccluded')
        prepared.save(update_fields=['previews'])
        with patch.object(DocumentReconstructorService, 'analyze_file', return_value=prepared):
            preview = self.prepare(catalog)
        review = preview['report']['reanalysis']
        self.assertFalse(review['canConfirm'])
        self.assertEqual(review['conflicts'][0]['code'], 'edited_target_not_editable')
        response = self.accept(catalog, preview)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(str(response.data['code']), 'reanalysis_edit_conflict')
        catalog.refresh_from_db()
        self.assertEqual(catalog.source_import.pk, source_id)
        self.assertEqual(catalog.spreads.first().left_page_elements, current)

    def test_ambiguous_source_mapping_keeps_edits_for_review(self):
        catalog = self.catalog()
        revised = self.revise(catalog)
        source = catalog.source_import
        prepared = copy.deepcopy(source)
        prepared.previews = copy.deepcopy(source.previews)
        target = next(e for e in prepared.previews[0]['documentPage']['elements'] if e['id'] == revised['id'])
        prepared.previews[0]['documentPage']['elements'].append(copy.deepcopy(target))
        _, review = DocumentReconstructorService._reconcile_reanalysis(catalog, source, prepared)
        self.assertFalse(review['canConfirm'])
        self.assertEqual(review['conflicts'][0]['code'], 'edited_target_mapping_conflict')

    def test_public_stored_projection_is_matched_against_private_source(self):
        catalog = self.catalog()
        spread = catalog.spreads.first()
        projected = public_import_page(spread.left_page_elements[0])
        element = projected['documentPage']['elements'][0]
        element.update(text='ITENS DE', edited=True, provenance={'sourceText': 'CATALOGO DE'})
        spread.left_page_elements = [projected]
        spread.save(update_fields=['left_page_elements'])
        preview = self.prepare(catalog)
        self.assertTrue(preview['report']['reanalysis']['canConfirm'])
        self.assertEqual(self.accept(catalog, preview).status_code, 200)
        result = next(e for e in catalog.spreads.first().left_page_elements[0]['documentPage']['elements'] if e['id'] == element['id'])
        self.assertEqual(result['text'], 'ITENS DE')
        self.assertEqual(result['provenance']['sourceText'], 'CATALOGO DE')

    def test_invalid_style_and_source_evidence_cannot_cross_reanalysis(self):
        catalog = self.catalog()
        spread = catalog.spreads.first()
        page = copy.deepcopy(spread.left_page_elements[0])
        target = next(e for e in page['documentPage']['elements'] if e.get('editable'))
        target['styleRevision'] = {'fontWeight': 700, 'color': 'red'}
        spread.left_page_elements = [page]
        spread.save(update_fields=['left_page_elements'])
        preview = self.prepare(catalog)
        self.assertEqual(preview['report']['reanalysis']['conflicts'][0]['code'], 'invalid_revision')
        self.assertEqual(self.accept(catalog, preview).status_code, 400)
        target['styleRevision'] = {'fontWeight': 700}
        target['x'] += .01
        spread.left_page_elements = [page]
        spread.save(update_fields=['left_page_elements'])
        preview = self.prepare(catalog)
        self.assertEqual(preview['report']['reanalysis']['conflicts'][0]['code'], 'source_evidence_changed')
        self.assertEqual(self.accept(catalog, preview).status_code, 400)

    def test_explicit_discard_is_not_enabled_by_reconstruction_confirmation(self):
        catalog = self.catalog()
        self.revise(catalog)
        preview = self.prepare(catalog)
        response = self.accept(catalog, preview, preserve_edits=False)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(str(response.data['code']), 'preservation_required')
