"""Restricted weight revisions retain private PDF evidence and commercial guards."""
import copy

from django.test import TestCase
from django.urls import reverse

from api import tests_document_import as import_tests
from api.services.document_reconstructor import public_import_page
from api.services.imported_text_resolver import (
    catalog_index, effective_font_weight, font_weight_reliable, validate_patch,
    valid_style_revision,
)


class ImportedTextStyleTests(TestCase):
    setUp = import_tests.DocumentImportTests.setUp
    analyze = import_tests.DocumentImportTests.analyze
    confirm = import_tests.DocumentImportTests.confirm

    def catalog(self, mode='editable'):
        return self.confirm(self.analyze([{'content':
            'BT /F1 20 Tf 30 130 Td (EDITORIAL TITLE) Tj ET '
            'BT /F1 12 Tf 3 Tr 30 50 Td (HIDDEN SECRET) Tj ET'}], mode=mode), mode=mode)

    def save(self, catalog, page):
        return self.client.post(reverse('studio_spread_manage', kwargs={'catalog_id': catalog.pk}),
            {'spread_index': 0, 'left_page': page, 'right_page_elements': []}, format='json')

    def style_action(self, entry, weight=700):
        return {'action': 'update_text_style', 'target': entry['target'], 'params': {
            'fontWeight': weight, 'expectedFontWeight': entry['fontWeight'], 'expectedText': entry['text']}}

    def test_public_style_only_revision_saves_reloads_restores_without_source_mutation(self):
        catalog = self.catalog()
        source = catalog.source_import
        retained = copy.deepcopy(source.document_ir)
        original = copy.deepcopy(source.previews)
        projected = public_import_page(catalog.spreads.first().left_page_elements[0])
        element = projected['documentPage']['elements'][0]
        original_weight = element['fontWeight']
        self.assertNotIn('text', element)
        element['styleRevision'] = {'fontWeight': 700}
        response = self.save(catalog, projected)
        self.assertEqual(response.status_code, 200, response.data)
        detail = self.client.get(reverse('studio_catalog_detail', kwargs={'pk': catalog.pk})).data
        page = public_import_page(detail['spreads'][0]['left_page'])
        rendered = page['documentPage']['elements'][0]
        self.assertEqual(rendered['fontWeight'], original_weight)
        self.assertEqual(rendered['styleRevision'], {'fontWeight': 700})
        self.assertEqual(rendered['text'], 'EDITORIAL TITLE')
        self.assertFalse(rendered.get('edited'))
        self.assertNotIn('provenance', rendered)
        source.refresh_from_db()
        self.assertEqual(source.document_ir, retained)
        self.assertEqual(source.previews, original)
        entries, state = catalog_index(catalog)
        self.assertEqual(state, 'ready')
        self.assertEqual(entries[0]['fontWeight'], 700)
        self.assertTrue(entries[0]['fontWeightReliable'])
        rendered.pop('styleRevision')
        self.assertEqual(self.save(catalog, page).status_code, 200)
        restored = public_import_page(catalog.spreads.first().left_page_elements[0])['documentPage']['elements'][0]
        self.assertNotIn('styleRevision', restored)
        self.assertNotIn('text', restored)
        self.assertEqual(restored['fontWeight'], original_weight)

    def test_private_style_and_text_revision_can_be_saved_together(self):
        catalog = self.catalog()
        page = catalog.spreads.first().left_page_elements[0]
        element = next(e for e in page['documentPage']['elements'] if e.get('editable'))
        source_text, source_weight = element['text'], element['fontWeight']
        element.update(text='REVISED TITLE', edited=True, styleRevision={'fontWeight': 600})
        response = self.save(catalog, page)
        self.assertEqual(response.status_code, 200, response.data)
        current = catalog.spreads.first().left_page_elements[0]['documentPage']['elements'][0]
        self.assertEqual(current['fontWeight'], source_weight)
        self.assertEqual(current['styleRevision'], {'fontWeight': 600})
        self.assertEqual(catalog.source_import.previews[0]['documentPage']['elements'][0]['text'], source_text)
        self.assertEqual(catalog_index(catalog)[0][0]['text'], 'REVISED TITLE')
        projected = public_import_page(catalog.spreads.first().left_page_elements[0])
        projected['documentPage']['elements'][0].pop('styleRevision')
        self.assertEqual(self.save(catalog, projected).status_code, 200)
        current = catalog.spreads.first().left_page_elements[0]['documentPage']['elements'][0]
        self.assertEqual(current['text'], 'REVISED TITLE')
        self.assertTrue(current['edited'])
        self.assertNotIn('styleRevision', current)

    def test_patch_style_contract_rejects_stale_values_group_missing_and_forged_fields(self):
        catalog = self.catalog()
        entries, _ = catalog_index(catalog)
        action = self.style_action(entries[0])
        self.assertEqual(validate_patch({'actions': [action]}, entries)['actions'][0]['type'], 'update_text_style')
        for change in ({'fontWeight': True}, {'fontWeight': 650}, {'fontWeight': 1000},
                       {'expectedText': 'stale text'}, {'expectedFontWeight': 100},
                       {'fontFamily': 'forged'}, {'sourceSnapshot': {}}, {'text': 'replacement'}):
            with self.subTest(change=change):
                forged = copy.deepcopy(action)
                forged['params'].update(change)
                self.assertIsNone(validate_patch({'actions': [forged]}, entries))
        missing = copy.deepcopy(action)
        missing['target'] = 'page:1/element:missing'
        self.assertIsNone(validate_patch({'actions': [missing]}, entries))
        group = {**entries[0], 'members': [{'target': entries[0]['target'], 'text': entries[0]['text']}]}
        self.assertIsNone(validate_patch({'actions': [action]}, [group]))
        self.assertIsNone(validate_patch({'actions': [action]}, [{**entries[0], 'role': 'logo'}]))

    def test_both_save_representations_reject_forged_style_and_geometry_atomically(self):
        catalog = self.catalog()
        original = copy.deepcopy(catalog.spreads.first().left_page_elements)
        for projected in (False, True):
            for change in ({'styleRevision': {'fontWeight': 700, 'color': '#ff0000'}},
                           {'styleRevision': {'fontWeight': False}}, {'styleRevision': {'fontWeight': 650}},
                           {'styleRevision': None}, {'fontWeight': 700}, {'x': .9}):
                with self.subTest(projected=projected, change=change):
                    page = public_import_page(original[0]) if projected else copy.deepcopy(original[0])
                    element = next(e for e in page['documentPage']['elements'] if e.get('editable'))
                    element.update(change)
                    self.assertEqual(self.save(catalog, page).status_code, 400)
                    self.assertEqual(catalog.spreads.first().left_page_elements, original)
        forged = copy.deepcopy(original[0])
        forged['documentPage']['elements'][0].update(styleRevision={'fontWeight': 700}, text={})
        self.assertEqual(self.save(catalog, forged).status_code, 400)

    def test_hidden_and_commercial_text_cannot_receive_style_revision(self):
        catalog = self.catalog()
        original = copy.deepcopy(catalog.spreads.first().left_page_elements[0])
        forged = copy.deepcopy(original)
        hidden = next(e for e in forged['documentPage']['elements'] if e.get('text') == 'HIDDEN SECRET')
        hidden['styleRevision'] = {'fontWeight': 700}
        self.assertEqual(self.save(catalog, forged).status_code, 400)
        source = catalog.source_import
        source_page = copy.deepcopy(source.previews[0])
        source_page['documentPage']['elements'][0]['role'] = 'product_name'
        source.previews = [source_page]
        source.save(update_fields=['previews'])
        spread = catalog.spreads.first()
        spread.left_page_elements = [copy.deepcopy(source_page)]
        spread.save(update_fields=['left_page_elements'])
        index, _ = catalog_index(catalog)
        self.assertTrue(index[0]['commercial'])
        self.assertIsNone(validate_patch({'actions': [self.style_action(index[0])]}, index))
        page = public_import_page(source_page)
        page['documentPage']['elements'][0]['styleRevision'] = {'fontWeight': 700}
        self.assertEqual(self.save(catalog, page).status_code, 400)

    def test_preserve_mode_and_foreign_catalog_remain_protected(self):
        catalog = self.catalog(mode='preserve')
        page = catalog.spreads.first().left_page_elements[0]
        element = next(e for e in page['documentPage']['elements'] if e.get('editable'))
        element['styleRevision'] = {'fontWeight': 700}
        self.assertEqual(self.save(catalog, page).status_code, 400)
        self.client.force_authenticate(self.foreign)
        self.assertEqual(self.save(catalog, page).status_code, 404)

    def test_legacy_render_projection_style_uses_retained_private_authority(self):
        catalog = self.catalog()
        spread = catalog.spreads.first()
        rendered = public_import_page(spread.left_page_elements[0])
        rendered['documentPage']['elements'][0]['styleRevision'] = {'fontWeight': 700}
        self.assertEqual(self.save(catalog, rendered).status_code, 200)
        spread.refresh_from_db()
        spread.left_page_elements = [public_import_page(spread.left_page_elements[0])]
        spread.save(update_fields=['left_page_elements'])
        entry = catalog_index(catalog)[0][0]
        self.assertEqual(entry['fontWeight'], 700)
        self.assertTrue(entry['fontWeightReliable'])
        spread.left_page_elements[0]['documentPage']['elements'][0]['styleRevision']['fontFamily'] = 'forged'
        spread.save(update_fields=['left_page_elements'])
        self.assertEqual(catalog_index(catalog)[0], [])

    def test_original_uncertain_weights_are_not_visual_equivalence_evidence(self):
        source = {'fontWeight': 300, 'fontResolutionStatus': 'generic_fallback', 'fontResolutionConfidence': .5}
        self.assertEqual(effective_font_weight(source), 300)
        self.assertFalse(font_weight_reliable(source))
        for status in ('compatible_family', 'unresolved'):
            self.assertFalse(font_weight_reliable({**source, 'fontResolutionStatus': status}))
        exact = {**source, 'fontResolutionStatus': 'registry_alias', 'fontResolutionConfidence': .9}
        self.assertTrue(font_weight_reliable(exact))
        self.assertFalse(font_weight_reliable({**exact, 'fontResolutionConfidence': float('nan')}))
        revised = {**source, 'styleRevision': {'fontWeight': 700}}
        self.assertEqual(effective_font_weight(revised), 700)
        self.assertTrue(font_weight_reliable(revised))
        for invalid in ({}, {'fontWeight': 650}, {'fontWeight': True}, {'fontWeight': 700, 'fontFamily': 'Inter'}):
            self.assertFalse(valid_style_revision(invalid))

    def test_proven_readonly_source_is_indexed_without_mutation_authority(self):
        catalog = self.catalog()
        source = catalog.source_import
        page = copy.deepcopy(source.previews[0])
        title = page['documentPage']['elements'][0]
        title['editable'] = False
        title.pop('appearance')
        source.previews = [copy.deepcopy(page)]
        source.save(update_fields=['previews'])
        spread = catalog.spreads.first()
        spread.left_page_elements = [copy.deepcopy(page)]
        spread.save(update_fields=['left_page_elements'])
        entries, _ = catalog_index(catalog)
        self.assertEqual([e['text'] for e in entries], ['EDITORIAL TITLE'])
        self.assertFalse(entries[0]['editable'])
        self.assertIsNone(validate_patch({'actions': [self.style_action(entries[0])]}, entries))
        self.assertIsNone(validate_patch({'actions': [{'action': 'update_text', 'target': entries[0]['target'],
            'params': {'replacement': 'NEW', 'expectedText': entries[0]['text']}}]}, entries))
        for status in ('partiallyOccluded', 'fullyOccluded', 'unknown'):
            with self.subTest(status=status):
                candidate = copy.deepcopy(page)
                candidate['documentPage']['elements'][0]['visibilityStatus'] = status
                source.previews = [copy.deepcopy(candidate)]
                source.save(update_fields=['previews'])
                spread.left_page_elements = [candidate]
                spread.save(update_fields=['left_page_elements'])
                self.assertEqual(catalog_index(catalog)[0], [])
        source.previews = [copy.deepcopy(page)]
        source.save(update_fields=['previews'])
        spread.left_page_elements = [copy.deepcopy(page)]
        spread.left_page_elements[0]['documentPage']['elements'][0]['fontWeight'] = 700
        spread.save(update_fields=['left_page_elements'])
        self.assertEqual(catalog_index(catalog)[0], [])
