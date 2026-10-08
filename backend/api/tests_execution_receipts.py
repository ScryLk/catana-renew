"""Execution receipts certify server-observed values, not client success flags."""
import copy
from django.test import TestCase
from django.urls import reverse
from api import tests_document_import as imports
from api import tests_imported_text_resolver as resolver


class ExecutionReceiptTests(TestCase):
    setUp = imports.DocumentImportTests.setUp
    analyze = imports.DocumentImportTests.analyze
    confirm = imports.DocumentImportTests.confirm
    chat = resolver.ImportedTextResolverTests.chat
    editable_catalog = resolver.ImportedTextResolverTests.editable_catalog
    patch_for = resolver.ImportedTextResolverTests.patch_for

    def proposal(self, catalog, message='troque PRODUTOS por ITENS'):
        patch, done = self.patch_for(catalog, message, editable_text_index=[])
        self.assertIsNotNone(patch, done)
        return patch, {'client_request_id': done['client_request_id'], 'message_id': done['message_id']}

    def save(self, catalog, page, execution=None):
        body = {'spreads': [{'spread_index': 0, 'left_page_elements': [page], 'right_page_elements': []}],
                'total_pages': 1, 'unassigned_products': []}
        if execution:
            body['execution'] = execution
        return self.client.post(reverse('studio_spread_bulk_sync', kwargs={'catalog_id': catalog.pk}), body, format='json')

    def receipt(self, catalog, execution, results=None):
        return self.client.post(reverse('studio_execution_receipt', kwargs={'catalog_id': catalog.pk}),
            {**execution, 'results': results or [{'status': 'applied'}]}, format='json')

    def revised_page(self, catalog, text='ITENS'):
        page = copy.deepcopy(catalog.spreads.first().left_page_elements[0])
        next(e for e in page['documentPage']['elements'] if e.get('text') == 'PRODUTOS').update(text=text, edited=True)
        return page

    def test_client_success_without_save_cannot_confirm(self):
        catalog = self.editable_catalog()
        _, execution = self.proposal(catalog)
        response = self.receipt(catalog, execution)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['execution_results'][0]['status'], 'failed')
        self.assertEqual(response.data['execution_receipt']['status'], 'unverified')
        self.assertNotIn("atualizado para 'ITENS'", response.data['content'])

    def test_saved_values_override_client_flags_and_survive_reload(self):
        catalog = self.editable_catalog()
        _, execution = self.proposal(catalog)
        self.assertEqual(self.save(catalog, self.revised_page(catalog), execution).status_code, 200)
        response = self.receipt(catalog, execution, [{'status': 'failed', 'value': 'FORGED'}])
        self.assertEqual(response.data['execution_results'][0]['status'], 'applied')
        self.assertEqual(response.data['content'], "Texto da página atualizado para 'ITENS'.")
        from api.models import ChatMessage
        message = ChatMessage.objects.get(pk=execution['message_id'])
        self.assertEqual(message.content, response.data['content'])
        self.assertEqual(message.metadata['proposal_content'], 'Proposta validada; aguardando execução.')
        thread = self.client.get(reverse('studio_thread_messages', kwargs={'thread_id': message.thread_id})).data
        saved = next(item for item in thread['messages'] if item['id'] == message.pk)
        self.assertEqual(saved['metadata']['execution_results'][0]['status'], 'applied')
        self.assertEqual(self.receipt(catalog, execution).data, response.data)

    def test_unbound_or_different_revision_never_proves_requested_edit(self):
        catalog = self.editable_catalog()
        _, execution = self.proposal(catalog)
        self.assertEqual(self.save(catalog, self.revised_page(catalog), None).status_code, 200)
        self.assertEqual(self.receipt(catalog, execution).data['execution_results'][0]['status'], 'failed')

    def test_bound_save_of_wrong_value_is_not_applied(self):
        catalog = self.editable_catalog()
        _, execution = self.proposal(catalog)
        self.assertEqual(self.save(catalog, self.revised_page(catalog, 'OUTRO'), execution).status_code, 200)
        result = self.receipt(catalog, execution).data['execution_results'][0]
        self.assertEqual(result['status'], 'failed')
        self.assertEqual(result['reason'], 'saved_value_mismatch')
        self.assertIn('a alteração solicitada não consta', self.receipt(catalog, execution).data['content'])

    def test_style_only_receipt_keeps_source_weight(self):
        catalog = self.editable_catalog('BT /F1 20 Tf 30 100 Td (PRODUTOS) Tj ET')
        _, execution = self.proposal(catalog, 'deixe PRODUTOS em negrito')
        page = copy.deepcopy(catalog.spreads.first().left_page_elements[0])
        element = next(e for e in page['documentPage']['elements'] if e.get('text') == 'PRODUTOS')
        source_weight = element['fontWeight']
        element['styleRevision'] = {'fontWeight': 700}
        self.assertEqual(self.save(catalog, page, execution).status_code, 200)
        response = self.receipt(catalog, execution)
        self.assertEqual(response.data['execution_results'][0]['status'], 'applied')
        self.assertEqual(response.data['content'], 'Peso do texto atualizado para 700.')
        saved = catalog.spreads.first().left_page_elements[0]['documentPage']['elements'][0]
        self.assertEqual(saved['fontWeight'], source_weight)
        self.assertEqual(saved['styleRevision'], {'fontWeight': 700})

    def test_receipts_require_same_user_request_message_and_catalog(self):
        catalog = self.editable_catalog()
        _, execution = self.proposal(catalog)
        wrong = {**execution, 'client_request_id': '00000000-0000-0000-0000-000000000000'}
        self.assertEqual(self.receipt(catalog, wrong).status_code, 400)
        other = self.editable_catalog()
        self.assertEqual(self.receipt(other, execution).status_code, 400)
        self.client.force_authenticate(self.foreign)
        self.assertEqual(self.receipt(catalog, execution).status_code, 404)

    def test_uncertain_same_numeric_weight_requires_an_actual_style_revision(self):
        catalog = self.editable_catalog()
        from api.services.imported_text_resolver import catalog_index
        entry = next(e for e in catalog_index(catalog)[0] if e.get('text') == 'PRODUTOS' and not e.get('members'))
        self.assertFalse(entry['fontWeightReliable'])
        _, execution = self.proposal(catalog, f'defina o peso de "PRODUTOS" para {entry["fontWeight"]} na página 1')
        page = copy.deepcopy(catalog.spreads.first().left_page_elements[0])
        self.assertEqual(self.save(catalog, page, execution).status_code, 200)
        self.assertEqual(self.receipt(catalog, execution).data['execution_results'][0]['status'], 'failed')
        next(e for e in page['documentPage']['elements'] if e['id'] == entry['id'])['styleRevision'] = {'fontWeight': entry['fontWeight']}
        self.assertEqual(self.save(catalog, page, execution).status_code, 200)
        self.assertEqual(self.receipt(catalog, execution).data['execution_results'][0]['status'], 'applied')

    def test_stale_save_does_not_overwrite_intervening_revision(self):
        catalog = self.editable_catalog()
        _, execution = self.proposal(catalog)
        self.assertEqual(self.save(catalog, self.revised_page(catalog, 'OUTRO')).status_code, 200)
        response = self.save(catalog, self.revised_page_from_current(catalog, 'ITENS'), execution)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(str(response.data['code']), 'stale_execution')
        self.assertTrue(any(e.get('text') == 'OUTRO' for e in catalog.spreads.first().left_page_elements[0]['documentPage']['elements']))

    def test_added_page_receipt_verifies_saved_identity_copy_and_sequence(self):
        catalog = self.editable_catalog()
        accepted, execution = self.proposal(catalog, 'crie uma outra página de finalização do catálogo')
        params = accepted['actions'][0]['params']
        source = copy.deepcopy(catalog.spreads.first().left_page_elements[0])
        added = {key:value for key,value in params.items() if key not in {'afterPage','pageId','pageColors'}}
        added.update(id=params['pageId'], pageNumber=2, products=[], **params['pageColors'])
        body = {'spreads':[{'spread_index':0,'left_page_elements':[source],'right_page_elements':[added]}],
            'total_pages':2, 'unassigned_products':[], 'execution':execution}
        self.assertEqual(self.client.post(reverse('studio_spread_bulk_sync',kwargs={'catalog_id':catalog.pk}),body,format='json').status_code,200)
        result = self.receipt(catalog, execution).data
        self.assertEqual(result['execution_results'][0]['status'], 'applied')
        self.assertEqual(result['content'], 'Página de finalização adicionada após a página 1.')

    def revised_page_from_current(self, catalog, text):
        page = copy.deepcopy(catalog.spreads.first().left_page_elements[0])
        next(e for e in page['documentPage']['elements'] if e.get('editable')).update(text=text, edited=True)
        return page

    def test_confirmed_receipt_is_historical_and_replay_cannot_undo_later_edits(self):
        catalog = self.editable_catalog()
        _, execution = self.proposal(catalog)
        self.assertEqual(self.save(catalog, self.revised_page(catalog), execution).status_code, 200)
        first = self.receipt(catalog, execution).data
        self.assertEqual(self.save(catalog, self.revised_page_from_current(catalog, 'OUTRO')).status_code, 200)
        self.assertEqual(self.receipt(catalog, execution).data, first)
        self.assertEqual(self.save(catalog, self.revised_page_from_current(catalog, 'ITENS'), execution).status_code, 400)
