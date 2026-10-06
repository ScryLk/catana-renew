"""Operational parsing regressions without real AI calls or streaming delays."""

import json
from pathlib import Path
import subprocess
import sys

from django.test import SimpleTestCase

from api.ai.provider import MockGeminiProvider


_ISOLATED_RESPONSE_CHECK = """
import json
import sys
from api.ai.provider import MockGeminiProvider

case = json.load(sys.stdin)
response = MockGeminiProvider()._build_mock_response('orchestrator', case['prompt'])
expected = case['actions']
if expected is None:
    assert 'json:patch' not in response, 'Oversized operand produced a patch'
    assert 0 < len(response) <= 1000, 'Refusal was empty or echoed excessive input'
else:
    prefix, marker, remainder = response.partition('```json:patch')
    assert marker, 'Expected an operational patch'
    payload, closing, trailing = remainder.partition('```')
    assert closing, 'Patch fence was not closed'
    assert json.loads(payload)['actions'] == expected, 'Operational actions changed'
print(json.dumps({'checked': True, 'response_length': len(response)}))
"""


def remove_action(page):
    return {
        'action': 'remove_product', 'type': 'remove_product',
        'target': f'page:{page}', 'page': page,
        'params': {'slotIndex': 0, 'returnToDrawer': True},
    }


def layout_action(page, layout='duo'):
    return {
        'action': 'change_layout', 'type': 'change_layout',
        'target': f'page:{page}', 'page': page, 'layout': layout,
        'params': {'type': layout, 'layout': layout},
    }


def pricing_action(percentage):
    return {
        'action': 'adjust_pricing', 'type': 'adjust_pricing', 'target': 'global',
        'percentage': percentage,
        'params': {'mode': 'percentage', 'percentage': percentage, 'amount': percentage},
    }


class MockProviderOperandSecurityTests(SimpleTestCase):
    def assert_actions(self, prompt, actions):
        response = MockGeminiProvider()._build_mock_response('orchestrator', prompt)
        _, marker, remainder = response.partition('```json:patch')
        self.assertTrue(marker, 'Expected an operational patch')
        payload, closing, _ = remainder.partition('```')
        self.assertTrue(closing, 'Patch fence was not closed')
        self.assertEqual(json.loads(payload)['actions'], actions)

    def assert_isolated_response(self, prompt, actions):
        """A CPU-bound parsing regression must finish even when it would hang the suite."""
        try:
            result = subprocess.run(
                [sys.executable, '-c', _ISOLATED_RESPONSE_CHECK],
                input=json.dumps({'prompt': prompt, 'actions': actions}),
                text=True, capture_output=True, timeout=5, check=False,
                cwd=Path(__file__).resolve().parent.parent,
            )
        except subprocess.TimeoutExpired:
            self.fail('Mock operational parsing exceeded the isolated 5-second timeout')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(json.loads(result.stdout)['checked'])

    def test_removal_keeps_page_and_canvas_parameters(self):
        for selector in ['página', 'pagina', 'PÁGINA']:
            with self.subTest(selector=selector):
                self.assert_actions(f'Remova o produto da {selector} 7', [remove_action(7)])

    def test_layout_variants_keep_original_patch_schema(self):
        for requested, layout in [
            ('grid', 'grid_4'), ('grade', 'grid_4'), ('hero', 'hero'),
            ('single', 'single'), ('manifesto', 'manifesto'), ('duo', 'duo'),
        ]:
            with self.subTest(layout=requested):
                self.assert_actions(f'Mude o layout da página 6 para {requested}', [layout_action(6, layout)])

    def test_increase_and_discount_keep_signed_pricing_parameters(self):
        for prompt, percentage in [
            ('Aumente os preços em 15%', 15),
            ('Aplique desconto de 20%', -20),
            ('Reduza os preços em 8%', -8),
            ('Reajuste os preços em 0%', 0),
        ]:
            with self.subTest(percentage=percentage):
                self.assert_actions(prompt, [pricing_action(percentage)])

    def test_combined_request_keeps_action_order_and_shared_page(self):
        self.assert_actions(
            'Remova produto e mude layout da página 2 para hero; aumente os preços em 7%',
            [remove_action(2), layout_action(2, 'hero'), pricing_action(7)],
        )

    def test_first_matching_percentage_and_page_are_used(self):
        self.assert_actions('Reajuste preços em 7% e depois 12%', [pricing_action(7)])
        self.assert_actions('Remova produto página 2 e página 8', [remove_action(2)])
        self.assert_actions('Mude layout página sem número; página 6', [layout_action(6)])

    def test_missing_operands_keep_existing_defaults(self):
        for prompt, actions in [
            ('Remova o produto', [remove_action(3)]),
            ('Mude o layout', [layout_action(4)]),
            ('Aumente os preços', [pricing_action(10)]),
            ('Aumente os preços em 12 sem sinal percentual', [pricing_action(10)]),
            ('Remova o produto página sem número', [remove_action(3)]),
            ('Mude layout página sem número', [layout_action(4)]),
            ('Remova o produto código 1234567890', [remove_action(3)]),
            ('Mude layout código 1234567890', [layout_action(4)]),
        ]:
            with self.subTest(prompt=prompt):
                self.assert_actions(prompt, actions)

    def test_packaged_user_request_ignores_operands_in_context(self):
        for marker in ['Solicitacao do Usuario:', 'Solicitação do Usuário:']:
            with self.subTest(marker=marker):
                self.assert_actions(
                    'Contexto: remova página 99; aumente preços em 88%.\n'
                    + marker + '\nRemova produto página 2; aumente preços em 7%',
                    [remove_action(2), pricing_action(7)],
                )

    def test_unicode_decimal_digits_work_for_pricing_and_pages(self):
        for digits in ['١٢', '１２', '1٢', '𝟙𝟚']:
            with self.subTest(digits=digits):
                self.assert_actions(f'Aumente preços em {digits}%', [pricing_action(12)])
                self.assert_actions(f'Remova produto página {digits}', [remove_action(12)])
                self.assert_actions(f'Mude layout pagina {digits}', [layout_action(12)])

    def test_unicode_whitespace_preserves_operand_matching(self):
        for whitespace in ['\u00a0', '\u2003', '\u2028', '\u001c']:
            with self.subTest(whitespace=repr(whitespace)):
                self.assert_actions(f'Aumente preços em 12{whitespace}%', [pricing_action(12)])
                self.assert_actions(f'Remova produto página{whitespace}12', [remove_action(12)])

    def test_non_decimal_unicode_numbers_do_not_become_operands(self):
        self.assert_actions('Aumente preços em ²%', [pricing_action(10)])
        self.assert_actions('Remova produto página ²', [remove_action(3)])

    def test_nine_digit_operands_are_accepted_without_changing_patch_types(self):
        for digits, value in [('123456789', 123456789), ('000000002', 2), ('١٢٣٤٥٦٧٨٩', 123456789)]:
            with self.subTest(digits=digits):
                self.assert_actions(f'Aumente preços em {digits}%', [pricing_action(value)])
                self.assert_actions(f'Remova produto página {digits}', [remove_action(value)])

    def test_oversized_percentage_tokens_refuse_without_suffix_matching(self):
        for digits in ['1234567890', '0000000002', '９' * 10, '١' * 10]:
            with self.subTest(digits=digits):
                self.assert_isolated_response(f'Aumente preços em {digits}%', None)

    def test_oversized_page_selectors_refuse_removal_and_layout(self):
        for keyword in ['Remova produto', 'Mude layout']:
            for selector in ['página', 'pagina']:
                with self.subTest(keyword=keyword, selector=selector):
                    self.assert_isolated_response(f'{keyword} {selector} 1234567890', None)

    def test_100k_digit_percentage_with_and_without_percent_completes_with_refusal(self):
        for suffix in ['%', '', ' %', ' sem porcentagem; 7%']:
            with self.subTest(suffix=suffix):
                self.assert_isolated_response('Aumente preços em ' + '9' * 100_000 + suffix, None)

    def test_100k_digit_page_selectors_complete_with_refusal(self):
        for keyword, selector in [('Remova produto', 'página'), ('Mude layout', 'pagina')]:
            with self.subTest(keyword=keyword):
                self.assert_isolated_response(f'{keyword} {selector} ' + '9' * 100_000, None)

    def test_long_whitespace_without_percent_keeps_default_and_completes(self):
        self.assert_isolated_response('Aumente preços em 9' + ' ' * 100_000 + 'fim', [pricing_action(10)])
        self.assert_isolated_response('Aumente preços em 9' + '\u2003' * 100_000 + '%', [pricing_action(9)])

    def test_long_page_whitespace_keeps_explicit_or_default_page(self):
        for keyword, action in [('Remova produto', remove_action), ('Mude layout', layout_action)]:
            with self.subTest(keyword=keyword):
                self.assert_isolated_response(f'{keyword} página' + ' ' * 100_000 + '2', [action(2)])
                default = 3 if action is remove_action else 4
                self.assert_isolated_response(f'{keyword} página' + ' ' * 100_000 + 'fim', [action(default)])

    def test_repeated_short_numeric_runs_complete_and_keep_first_real_percentage(self):
        repeated = '123456789 ' * 10_000
        self.assert_isolated_response('Aumente preços ' + repeated + 'fim', [pricing_action(10)])
        self.assert_isolated_response('Aumente preços ' + repeated + '7%', [pricing_action(7)])

    def test_first_valid_operand_is_not_overridden_by_later_oversized_tokens(self):
        self.assert_isolated_response('Aumente preços 7% e ' + '9' * 100_000 + '%', [pricing_action(7)])
        self.assert_isolated_response('Remova produto página 2; página ' + '9' * 100_000, [remove_action(2)])

    def test_invalid_operand_never_partially_applies_a_combined_request(self):
        self.assert_isolated_response('Remova produto página 2; aumente preços ' + '9' * 100_000, None)
        self.assert_isolated_response('Mude layout página ' + '9' * 100_000 + '; aumente preços 7%', None)
