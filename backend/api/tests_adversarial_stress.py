"""
Bateria de Testes Adversariais e Casos Críticos de Estresse.
Valida se o sistema responde por princípios e regras formais,
sem depender de exceções hardcoded ou falhar em solicitações extremas.
"""
from django.test import TestCase
from api.ai.catalog_builder import generate_catalog_from_gemini
from api.ai.requirement_parser import RequirementParser
from api.ai.constraint_engine import ConstraintEngine
from api.ai.page_budget import PageBudgetEngine


class AdversarialStressTestCase(TestCase):

    def test_adversarial_exact_37_pages(self):
        """Caso extremo: 'Quero exatamente 37 páginas.'"""
        result = generate_catalog_from_gemini("Quero exatamente 37 páginas de catálogo para peças industriais.")
        self.assertEqual(len(result["pages"]), 37)
        self.assertEqual(result["totalPages"], 37)
        self.assertEqual(result["pages"][0]["pageNumber"], 1)
        self.assertEqual(result["pages"][-1]["pageNumber"], 37)

    def test_adversarial_40_products_in_one_pager(self):
        """Caso extremo: 'Faça 1 página com 40 produtos.'"""
        sample_prods = [{"name": f"Item {i+1:02d}", "price": f"R$ {50+i},00", "sku": f"SKU-{i+1:03d}"} for i in range(40)]
        result = generate_catalog_from_gemini("Faça 1 página com 40 produtos.", products=sample_prods)
        self.assertEqual(len(result["pages"]), 1)
        self.assertEqual(result["totalPages"], 1)
        self.assertEqual(len(result["pages"][0]["products"]), 40)

    def test_adversarial_maximalist_without_colors(self):
        """Caso dialético: 'Quero maximalista sem usar cores.'"""
        contract = RequirementParser.parse("Quero maximalista sem usar cores.")
        self.assertEqual(contract.design.allowed_color_space, "monochrome")
        self.assertIn("NO_COLORS", contract.constraints.negative)
        result = generate_catalog_from_gemini("Quero maximalista sem usar cores.")
        for p in result["pages"]:
            accent = p.get("accentColor", "").upper()
            # Valida que o tom é monocromático / neutro (escala de cinza onde R==G==B ou neutro escuro)
            is_monochrome = (
                (len(accent) == 7 and accent.startswith('#') and accent[1:3] == accent[3:5] == accent[5:7]) or
                accent in ["#000000", "#141416", "#FFFFFF", "#F5F5F5", "#71717A", "#F6F5F2"]
            )
            self.assertTrue(is_monochrome, f"Cor '{accent}' não é monocromática/neutra.")

    def test_adversarial_minimalist_with_high_information(self):
        """Caso dialético: 'Minimalista com muita informação.'"""
        contract = RequirementParser.parse("Catálogo de 1 página minimalista com muita informação.")
        arbitrated = ConstraintEngine.arbitrate_style_vs_constraints(contract, product_count=10)
        self.assertIn("dense_spec_matrix", arbitrated.design.layout_behavior)

    def test_adversarial_dynamic_without_diagonals(self):
        """Caso dialético: 'Dinâmico sem diagonais.'"""
        contract = RequirementParser.parse("Catálogo dinâmico sem diagonais.")
        self.assertIn("NO_DIAGONALS", contract.constraints.negative)
        self.assertGreaterEqual(contract.design.visual_energy, 75)

    def test_adversarial_futuristic_without_neon(self):
        """Caso dialético: 'Futurista sem neon.'"""
        contract = RequirementParser.parse("Catálogo futurista sem neon.")
        self.assertIn("NO_NEON", contract.constraints.negative)

    def test_adversarial_tech_without_blue(self):
        """Caso restritivo: 'Tecnológico sem azul.'"""
        prompt = "Catálogo de 1 página tecnológico sem a cor azul."
        contract = RequirementParser.parse(prompt)
        self.assertIn("FORBIDDEN_COLOR_BLUE", contract.constraints.negative)
        result = generate_catalog_from_gemini(prompt)
        for p in result["pages"]:
            self.assertNotIn("blue", str(p.get("accentColor", "")).lower())
            self.assertNotIn("#0284c7", str(p.get("accentColor", "")).lower())

    def test_adversarial_corporate_without_cards(self):
        """Caso restritivo: 'Corporativo sem cards.'"""
        prompt = "Catálogo corporativo B2B de 1 página sem cards."
        result = generate_catalog_from_gemini(prompt)
        self.assertEqual(len(result["pages"]), 1)
        self.assertFalse(result["pages"][0].get("useCards", False))
        self.assertEqual(result["pages"][0].get("containerStyle"), "none")

    def test_adversarial_preserve_verbatim_text(self):
        """Preservação incondicional de texto do usuário."""
        prompt = 'Catálogo de 1 página. Não altere meus textos: "Tradição milenar em cada detalhe forjado."'
        result = generate_catalog_from_gemini(prompt)
        self.assertEqual(len(result["pages"]), 1)
        self.assertIn("Tradição milenar em cada detalhe forjado.", result["pages"][0]["content"])
