import json
import copy
from unittest.mock import patch
from types import SimpleNamespace

from django.test import SimpleTestCase, TestCase

from api.ai.provider import GeminiAIProvider
from api.ai.style_commands import plan_text_style
from api.ai.text_commands import parse_replacement


class ImportedCommandGrammarTests(SimpleTestCase):
    def test_routing_preposition_is_not_part_of_the_search(self):
        self.assertEqual(parse_replacement('altere de ITENS para PRODUTOS'), ('ITENS', 'PRODUTOS', None, False))

    def test_literal_de_and_separators_remain_inside_quotes(self):
        for command in ('troque "de ITENS" por "PRODUTOS".', 'altere “de ITENS” para “PRODUTOS”'):
            self.assertEqual(parse_replacement(command), ('de ITENS', 'PRODUTOS', None, False))
        self.assertEqual(parse_replacement('altere de "de para na página 2" para "de por" na página 1'),
                         ('de para na página 2', 'de por', 1, False))

    def test_literal_offsets_preserve_unicode_and_whitespace(self):
        self.assertEqual(parse_replacement('altere de "AÇÃO\nDE  ITENS" para "PRODUTOS  DE"'),
                         ('AÇÃO\nDE  ITENS', 'PRODUTOS  DE', None, False))

    def test_page_scopes_and_selected_form_still_work(self):
        self.assertEqual(parse_replacement('Na página 2, altere de ITENS para PRODUTOS'), ('ITENS', 'PRODUTOS', 2, False))
        self.assertEqual(parse_replacement('altere de ITENS para PRODUTOS na segunda página'), ('ITENS', 'PRODUTOS', 2, False))
        self.assertEqual(parse_replacement('troque para PRODUTOS'), ('', 'PRODUTOS', None, True))
        self.assertIsNone(parse_replacement('Na página 1, troque ITENS para PRODUTOS na página 2'))
        self.assertIsNone(parse_replacement('altere "ITENS para PRODUTOS'))


class ImportedStylePlannerTests(SimpleTestCase):
    def entry(self, text, page=1, element_id='title', weight=300, reliable=False, **flags):
        return {'id': element_id, 'target': f'page:{page}/element:{element_id}', 'page': page,
                'text': text, 'editable': True, 'visible': True, 'role': 'heading',
                'effectiveFontWeight': weight, 'fontWeight': weight,
                'fontWeightReliable': reliable, 'resolvedFont': 'Inter', **flags}

    def context(self, *entries, **kwargs):
        return {'editable_text_index': list(entries), 'catalog_id': 'catalog-1',
                'catalog_revision': 'revision-1', 'imported_text_status': 'ready', **kwargs}

    def test_actual_request_has_unreliable_reference_and_bound_recovery(self):
        context = self.context(self.entry('PLASWILL', element_id='p1-o7'), self.entry('EMPRESA', 2, 'p2-o16'))
        text, patch_data = plan_text_style('deixe o negrito destacado de PLASWILL semelhante ao da EMPRESA na segunda página', context)
        self.assertEqual(patch_data['planner_status'], 'reference_style_unavailable')
        self.assertEqual(patch_data['actions'], [])
        self.assertIn('fonte extraída', text)
        self.assertEqual([c['fontWeight'] for c in patch_data['style_choices']], [400, 600, 700, 800])
        choice = patch_data['style_choices'][2]
        self.assertEqual(choice['target'], 'page:1/element:p1-o7')
        self.assertEqual(choice['catalog_revision'], 'revision-1')
        self.assertEqual(choice['expectedFontWeight'], 300)
        followup = plan_text_style(choice['command'], {**context, 'style_choice': choice})[1]
        self.assertEqual(followup['actions'][0]['params'], {'fontWeight': 700, 'expectedFontWeight': 300, 'expectedText': 'PLASWILL'})

    def test_trusted_reference_copies_only_weight_and_not_reference_page_scope(self):
        context = self.context(self.entry('PLASWILL'), self.entry('EMPRESA', 2, 'reference', 800, True))
        result = plan_text_style('deixe o negrito de PLASWILL igual ao da EMPRESA na segunda página', context)[1]
        self.assertEqual(result['actions'][0]['target'], 'page:1/element:title')
        self.assertEqual(set(result['actions'][0]['params']), {'fontWeight', 'expectedFontWeight', 'expectedText'})
        self.assertEqual(result['actions'][0]['params']['fontWeight'], 800)

    def test_reference_only_reading_does_not_grant_authority_to_mutate_it(self):
        context = self.context(self.entry('PLASWILL'), self.entry('EMPRESA', 2, 'protected', 700, True, commercial=True, editable=False))
        result = plan_text_style('deixe o negrito de PLASWILL igual ao da EMPRESA na segunda página', context)[1]
        self.assertEqual(result['actions'][0]['target'], 'page:1/element:title')
        self.assertEqual(len(result['actions']), 1)

    def test_ambiguous_titles_do_not_choose_visible_or_logo_by_approximation(self):
        context = self.context(self.entry('PLASWILL'), self.entry('PLASWILL', 3, 'other', visible=False))
        self.assertEqual(plan_text_style('deixe PLASWILL em negrito', context)[1]['planner_status'], 'ambiguous')
        selected = plan_text_style('deixe PLASWILL em negrito', {**context, 'selected_element_id': 'other'})[1]
        self.assertEqual(selected['actions'][0]['target'], 'page:3/element:other')
        logo = self.context(self.entry('PLASWILL', role='logo'))
        self.assertEqual(plan_text_style('deixe PLASWILL em negrito', logo)[1]['planner_status'], 'blocked_by_integrity')

    def test_explicit_page_and_selected_text(self):
        context = self.context(self.entry('PLASWILL'), self.entry('PLASWILL', 2, 'other'))
        self.assertEqual(plan_text_style('Na página 2, deixe PLASWILL em negrito', context)[1]['actions'][0]['target'], 'page:2/element:other')
        self.assertEqual(plan_text_style('deixe esse texto em negrito', {**context, 'selected_element_id': 'title'})[1]['actions'][0]['target'], 'page:1/element:title')
        paragraph = self.context(self.entry('A PLASWILL fabrica embalagens'))
        self.assertEqual(plan_text_style('deixe PLASWILL em negrito', paragraph)[1]['planner_status'], 'unsupported_action')
        group = self.context(self.entry('PLASWILL', members=[{'target': 'page:1/element:a'}]))
        self.assertEqual(plan_text_style('deixe PLASWILL em negrito', group)[1]['planner_status'], 'unsupported_action')

    def test_noop_requires_reliable_effective_style(self):
        context = self.context(self.entry('PLASWILL', weight=700, reliable=True))
        self.assertEqual(plan_text_style('deixe PLASWILL em negrito', context)[1]['planner_status'], 'unchanged')
        context['editable_text_index'][0]['fontWeightReliable'] = False
        self.assertEqual(plan_text_style('deixe PLASWILL em negrito', context)[1]['planner_status'], 'proposed')

    def test_stale_choice_cannot_apply_after_revision_text_or_weight_changes(self):
        context = self.context(self.entry('PLASWILL'), self.entry('EMPRESA', 2, 'reference'))
        choice = plan_text_style('deixe o negrito de PLASWILL igual ao da EMPRESA na página 2', context)[1]['style_choices'][2]
        for changed in ({'catalog_revision': 'revision-2'}, {'catalog_id': 'another'},
                        {'editable_text_index': [self.entry('PLASWILL', weight=400)]}):
            result = plan_text_style(choice['command'], {**context, **changed, 'style_choice': choice})[1]
            self.assertEqual(result['planner_status'], 'stale_target')
            self.assertEqual(result['actions'], [])
        self.assertEqual(plan_text_style(choice['command'].replace('700', '800'), {**context, 'style_choice': choice})[1]['planner_status'], 'stale_target')

    def test_invalid_weights_and_unimplemented_operations_are_explicit(self):
        context = self.context(self.entry('PLASWILL'))
        for weight in ('0', '350', '1000', '9' * 12000):
            self.assertEqual(plan_text_style(f'defina o peso de PLASWILL para {weight}', context)[1]['planner_status'], 'invalid_action')
        authored = self.context(self.entry('PLASWILL', target='page:1/field:title'))
        self.assertEqual(plan_text_style('deixe PLASWILL em negrito', authored)[1]['planner_status'], 'unsupported_action')
        self.assertIsNone(plan_text_style('deixe PLASWILL em negrito e mude a cor para vermelho', context))
        self.assertIsNone(plan_text_style('altere peso para massa', context))
        self.assertIsNone(plan_text_style('deixe PLASWILL semelhante ao da EMPRESA', context))

    def test_missing_reference_has_specific_reason_and_explicit_recovery(self):
        result = plan_text_style('deixe o negrito de PLASWILL igual ao da EMPRESA na página 2', self.context(self.entry('PLASWILL')))[1]
        self.assertEqual(result['planner_status'], 'reference_not_found')
        self.assertTrue(result['style_choices'])
        self.assertFalse(result['actions'])

    def test_limited_index_requires_selected_target_and_does_not_guess_reference(self):
        context = self.context(self.entry('PLASWILL'), self.entry('EMPRESA', 2, 'reference', 700, True), imported_text_status='limited')
        self.assertEqual(plan_text_style('deixe PLASWILL em negrito', context)[1]['planner_status'], 'ambiguous')
        selected = {**context, 'selected_element_id': 'title'}
        result = plan_text_style('deixe o negrito de PLASWILL igual ao da EMPRESA na página 2', selected)[1]
        self.assertEqual(result['planner_status'], 'reference_index_limited')
        self.assertTrue(result['style_choices'])

    def test_deterministic_style_planner_precedes_real_model(self):
        provider = GeminiAIProvider(api_key='')
        sdk = SimpleNamespace(generate_content_stream=lambda **kw: self.fail('Style command must not invoke model'))
        provider.client = SimpleNamespace(models=sdk)
        chunks = list(provider.generate_stream('deixe PLASWILL em negrito', context=self.context(self.entry('PLASWILL'))))
        action = json.loads(chunks[0].text.split('```json:patch\n')[1].split('```')[0])['actions'][0]
        self.assertEqual(action['params']['fontWeight'], 700)
        self.assertEqual(chunks[-1].metadata['action_planner'], 'source-text-weight')


class ImportedStylePolicyTests(TestCase):
    from api.tests_imported_text_resolver import ImportedTextResolverTests
    from api.tests_studio_action_policy import StudioActionPolicyTests
    setUp = ImportedTextResolverTests.setUp
    analyze = ImportedTextResolverTests.analyze
    confirm = ImportedTextResolverTests.confirm
    fixture = StudioActionPolicyTests.fixture
    route = StudioActionPolicyTests.route
    action = StudioActionPolicyTests.action

    def entry(self, catalog):
        from api.services.imported_text_resolver import catalog_index
        return catalog_index(catalog)[0][0]

    def style(self, entry, **overrides):
        return self.action('update_text_style', entry['target'], fontWeight=700,
                           expectedFontWeight=entry['effectiveFontWeight'], expectedText=entry['text'], **overrides)

    def test_policy_accepts_only_restricted_current_style_fields(self):
        catalog = self.fixture('editable')
        entry = self.entry(catalog)
        accepted, _ = self.route(catalog, [self.style(entry)])
        self.assertIsNotNone(accepted)
        action = self.style(entry)
        action['params']['fontSize'] = 99
        accepted, decisions = self.route(catalog, [action])
        self.assertIsNone(accepted)
        self.assertEqual(decisions[0].reasonCode, 'invalid_action')

    def test_stale_weight_and_text_are_distinguished(self):
        catalog = self.fixture('editable')
        entry = self.entry(catalog)
        for key, value in (('expectedFontWeight', 100), ('expectedText', 'old')):
            action = self.style(entry)
            action['params'][key] = value
            accepted, decisions = self.route(catalog, [action])
            self.assertIsNone(accepted)
            self.assertEqual(decisions[0].reasonCode, 'stale_target')

    def test_text_and_style_cannot_overlap_in_same_proposal(self):
        catalog = self.fixture('editable')
        entry = self.entry(catalog)
        replace = self.action('update_text', entry['target'], replacement='ITENS', expectedText=entry['text'])
        accepted, decisions = self.route(catalog, [replace, self.style(entry)])
        self.assertIsNone(accepted)
        self.assertEqual(decisions[1].reasonCode, 'stale_target')

    def test_model_cannot_invent_weight_for_an_unavailable_reference(self):
        from api.services.studio_action_policy import ActionPolicyRouter
        catalog = self.fixture('editable')
        entry = self.entry(catalog)
        router = ActionPolicyRouter(catalog, self.owner, {'selected_element_id':entry['id'], 'user_message': f'deixe o negrito de {entry["text"]} igual ao da EMPRESA na página 2'})
        accepted, decisions = router.validate_patch({'actions': [self.style(entry)]})
        self.assertIsNone(accepted)
        self.assertEqual(decisions[0].reasonCode, 'reference_not_found')


class ImportedBoundedSearchTests(TestCase):
    from api.tests_imported_text_resolver import ImportedTextResolverTests as Fixtures
    setUp = Fixtures.setUp
    analyze = Fixtures.analyze
    confirm = Fixtures.confirm
    editable_catalog = Fixtures.editable_catalog
    save_page = Fixtures.save_page
    chat = Fixtures.chat
    patch_for = Fixtures.patch_for

    def test_exact_manual_cover_command_does_not_depend_on_unrelated_index_budget(self):
        from api.services.imported_text_resolver import catalog_index
        catalog = self.editable_catalog()
        page = copy.deepcopy(catalog.spreads.first().left_page_elements[0])
        for element in page['documentPage']['elements']:
            if element.get('text') == 'CATALOGO DE':
                element.update(text='ITENS DE', edited=True)
            elif element.get('text') == 'PRODUTOS':
                element.update(text='PLASWILL', edited=True)
        self.assertEqual(self.save_page(catalog, page).status_code, 200)
        with patch('api.services.imported_text_resolver.MAX_INDEX_CHARS', 1000):
            self.assertEqual(catalog_index(catalog)[1], 'limited')
            accepted, done = self.patch_for(catalog, 'altere de ITENS para PRODUTOS', editable_text_index=[])
        self.assertIsNotNone(accepted, done)
        self.assertEqual(accepted['actions'][0]['params'], {'find':'ITENS', 'replacement':'PRODUTOS', 'expectedText':'ITENS DE'})
