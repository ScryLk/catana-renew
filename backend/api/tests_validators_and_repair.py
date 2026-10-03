"""
Testes Unitários para o Generation Validator e Repair Engine.
"""
from django.test import TestCase
from api.ai.requirement_parser import RequirementParser
from api.ai.generation_validator import GenerationValidator
from api.ai.repair_engine import RepairEngine


class ValidatorAndRepairTestCase(TestCase):

    def test_validator_catches_page_count_mismatch(self):
        contract = RequirementParser.parse("Catálogo de 1 página.")
        # Documento simulado com 6 páginas (o bug antigo)
        bad_doc = {
            "title": "Teste",
            "pages": [{"id": f"p{i+1}", "pageNumber": i+1} for i in range(6)],
        }
        val_res = GenerationValidator.validate(contract, bad_doc)
        self.assertFalse(val_res.passed)
        self.assertIn("PAGE_COUNT_MISMATCH", val_res.errors[0])

    def test_validator_catches_forbidden_cards_and_gradients(self):
        contract = RequirementParser.parse("Catálogo sem cards e sem gradientes.")
        bad_doc = {
            "title": "Teste",
            "pages": [
                {
                    "id": "p1",
                    "pageNumber": 1,
                    "useCards": True,
                    "containerStyle": "card",
                    "backgroundColor": "linear-gradient(to right, #000, #fff)",
                }
            ],
        }
        val_res = GenerationValidator.validate(contract, bad_doc)
        self.assertFalse(val_res.passed)
        errors_str = " ".join(val_res.errors)
        self.assertIn("cards", errors_str)
        self.assertIn("gradiente", errors_str)

    def test_validator_catches_lorem_ipsum(self):
        contract = RequirementParser.parse("Catálogo de produtos.")
        bad_doc = {
            "title": "Teste",
            "pages": [
                {
                    "id": "p1",
                    "pageNumber": 1,
                    "content": "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
                }
            ],
        }
        val_res = GenerationValidator.validate(contract, bad_doc)
        self.assertFalse(val_res.passed)
        self.assertIn("INVALID_PLACEHOLDER", val_res.errors[0])

    def test_repair_engine_prunes_pages_to_one_pager(self):
        contract = RequirementParser.parse("Catálogo de 1 página.")
        bad_doc = {
            "title": "Teste",
            "pages": [
                {"id": "p1", "pageNumber": 1, "title": "Capa", "products": [{"name": "Item 1"}]},
                {"id": "p2", "pageNumber": 2, "title": "Manifesto", "products": [{"name": "Item 2"}]},
                {"id": "p3", "pageNumber": 3, "title": "Contracapa", "products": []},
            ],
        }
        initial_val = GenerationValidator.validate(contract, bad_doc)
        self.assertFalse(initial_val.passed)

        repaired_doc, final_val, repair_log = RepairEngine.repair_document(contract, bad_doc, initial_val)
        self.assertTrue(final_val.passed)
        self.assertEqual(len(repaired_doc["pages"]), 1)
        self.assertEqual(repaired_doc["pages"][0]["type"], "one_pager")
        # Todos os produtos foram preservados na página única
        prod_names = [p["name"] for p in repaired_doc["pages"][0]["products"]]
        self.assertIn("Item 1", prod_names)
        self.assertIn("Item 2", prod_names)

    def test_repair_engine_strips_forbidden_cards_and_gradients(self):
        contract = RequirementParser.parse("Catálogo sem cards e sem gradientes.")
        bad_doc = {
            "title": "Teste",
            "pages": [
                {
                    "id": "p1",
                    "pageNumber": 1,
                    "useCards": True,
                    "containerStyle": "card",
                    "backgroundColor": "linear-gradient(to right, #000, #fff)",
                }
            ],
        }
        initial_val = GenerationValidator.validate(contract, bad_doc)
        repaired_doc, final_val, repair_log = RepairEngine.repair_document(contract, bad_doc, initial_val)
        self.assertTrue(final_val.passed)
        self.assertFalse(repaired_doc["pages"][0]["useCards"])
        self.assertEqual(repaired_doc["pages"][0]["containerStyle"], "none")
        self.assertNotIn("gradient", repaired_doc["pages"][0]["backgroundColor"])
