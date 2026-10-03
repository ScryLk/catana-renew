"""
Testes de Integração de Ponta a Ponta para o Editorial Generation Pipeline e catalog_builder.
"""
from django.test import TestCase
from api.ai.catalog_builder import generate_catalog_from_gemini


class PipelineIntegrationTestCase(TestCase):

    def test_end_to_end_one_pager_generation(self):
        result = generate_catalog_from_gemini("Catálogo de 1 página para doces artesanais.")
        self.assertIn("pages", result)
        self.assertEqual(len(result["pages"]), 1)
        self.assertEqual(result["totalPages"], 1)
        self.assertEqual(result["pages"][0]["folio"], "01 · ONE-PAGER")
        self.assertIn("observability", result)
        self.assertTrue(result["observability"]["final_validation"]["passed"])

    def test_end_to_end_exact_two_pages(self):
        result = generate_catalog_from_gemini("Catálogo de 2 páginas para linha de sapatos artesanais.")
        self.assertEqual(len(result["pages"]), 2)
        self.assertEqual(result["totalPages"], 2)
        self.assertEqual(result["pages"][0]["pageNumber"], 1)
        self.assertEqual(result["pages"][1]["pageNumber"], 2)

    def test_end_to_end_negative_constraints_no_cards_no_gradients(self):
        prompt = "Catálogo de 1 página para joalheria. Não use cards, sem gradientes."
        result = generate_catalog_from_gemini(prompt)
        self.assertEqual(len(result["pages"]), 1)
        page = result["pages"][0]
        self.assertFalse(page.get("useCards", False))
        self.assertEqual(page.get("containerStyle"), "none")
        self.assertNotIn("gradient", str(page.get("backgroundColor", "")).lower())

    def test_end_to_end_with_provided_products(self):
        sample_prods = [
            {"name": "Faca Chef Damasco", "price": "R$ 1.850,00", "sku": "KT-DAM-01"},
            {"name": "Santoku Forjada", "price": "R$ 1.450,00", "sku": "KT-SAN-02"},
        ]
        result = generate_catalog_from_gemini("Catálogo de 2 páginas para cutelaria.", products=sample_prods)
        self.assertEqual(len(result["pages"]), 2)
        all_prods = []
        for p in result["pages"]:
            all_prods.extend(p.get("products", []))
        prod_names = [p["name"] for p in all_prods]
        self.assertIn("Faca Chef Damasco", prod_names)
        self.assertIn("Santoku Forjada", prod_names)

    def test_observability_telemetry_complete(self):
        result = generate_catalog_from_gemini("Catálogo corporativo de tecnologia.")
        obs = result.get("observability", {})
        self.assertIn("parsed_requirements", obs)
        self.assertIn("hard_constraints", obs)
        self.assertIn("feasibility_check", obs)
        self.assertIn("initial_validation", obs)
        self.assertIn("final_validation", obs)
        self.assertIn("elapsed_ms", obs)
