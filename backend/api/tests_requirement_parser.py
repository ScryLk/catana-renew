"""
Testes Unitários para o Requirement Parser e Modelagem do Requirement Contract.
"""
from django.test import TestCase
from api.ai.requirement_parser import RequirementParser


class RequirementParserTestCase(TestCase):

    def test_exact_page_count(self):
        contract = RequirementParser.parse("Gere um catálogo com exatamente 7 páginas para relógios.")
        self.assertEqual(contract.output.page_count, 7)
        self.assertEqual(contract.output.page_count_mode, "exact")
        self.assertIn("PAGE_COUNT_EXACT:7", contract.constraints.hard)

    def test_one_pager_variations(self):
        prompts = [
            "Catálogo de 1 página para doces",
            "Crie um one-pager editorial",
            "Quero uma folha única com apresentação",
            "Single page lookbook",
        ]
        for p in prompts:
            contract = RequirementParser.parse(p)
            self.assertEqual(contract.output.page_count, 1, f"Falhou para prompt: {p}")
            self.assertEqual(contract.output.page_count_mode, "exact")

    def test_maximum_page_count(self):
        contract = RequirementParser.parse("Apresentação de no máximo 5 páginas para diretoria.")
        self.assertEqual(contract.output.page_count, 5)
        self.assertEqual(contract.output.page_count_mode, "maximum")
        self.assertIn("PAGE_COUNT_MAXIMUM:5", contract.constraints.hard)

    def test_minimum_page_count(self):
        contract = RequirementParser.parse("Catálogo de pelo menos 10 slides com produtos.")
        self.assertEqual(contract.output.page_count, 10)
        self.assertEqual(contract.output.page_count_mode, "minimum")
        self.assertIn("PAGE_COUNT_MINIMUM:10", contract.constraints.hard)

    def test_negative_constraints_extraction(self):
        prompt = "Catálogo de moda. Não use cards, sem gradientes, sem fotos e não use a cor azul."
        contract = RequirementParser.parse(prompt)
        self.assertIn("NO_CARDS", contract.constraints.negative)
        self.assertIn("NO_GRADIENTS", contract.constraints.negative)
        self.assertIn("NO_IMAGES", contract.constraints.negative)
        self.assertIn("FORBIDDEN_COLOR_BLUE", contract.constraints.negative)
        self.assertEqual(contract.design.image_behavior, "typography_led")
        self.assertIn("no_cards", contract.design.layout_behavior)

    def test_monochrome_color_space(self):
        contract = RequirementParser.parse("Portfólio somente preto e branco com estética minimalista.")
        self.assertEqual(contract.design.allowed_color_space, "monochrome")
        self.assertIn("NO_COLORS", contract.constraints.negative)

    def test_orientation_and_dimensions(self):
        contract_landscape = RequirementParser.parse("Apresentação em 16:9 paisagem.")
        self.assertEqual(contract_landscape.output.orientation, "landscape")
        self.assertEqual(contract_landscape.output.dimensions, {"width": 1920, "height": 1080})

        contract_square = RequirementParser.parse("Catálogo em formato quadrado para feed.")
        self.assertEqual(contract_square.output.orientation, "square")
        self.assertEqual(contract_square.output.dimensions, {"width": 1080, "height": 1080})

    def test_verbatim_extraction(self):
        prompt = 'Crie um catálogo e não altere meus textos: "Esta é a frase exata que deve permanecer intocada."'
        contract = RequirementParser.parse(prompt)
        self.assertIn("Esta é a frase exata que deve permanecer intocada.", contract.content.preserve_verbatim)
        self.assertIn("PRESERVE_VERBATIM:USER_TEXT", contract.constraints.hard)
