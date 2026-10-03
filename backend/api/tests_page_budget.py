"""
Testes Unitários para o Page Budget Engine (Alocação Determinística de Slots).
"""
from django.test import TestCase
from api.ai.requirement_parser import RequirementParser
from api.ai.page_budget import PageBudgetEngine


class PageBudgetEngineTestCase(TestCase):

    def test_allocate_exact_one_page(self):
        contract = RequirementParser.parse("Catálogo de 1 página.")
        slots = PageBudgetEngine.calculate_and_allocate_slots(contract)
        self.assertEqual(len(slots), 1)
        self.assertEqual(slots[0].role, "one_pager")
        self.assertFalse(slots[0].is_cover)
        self.assertFalse(slots[0].is_closing)

    def test_allocate_exact_two_pages(self):
        contract = RequirementParser.parse("Catálogo com exatamente 2 páginas.")
        slots = PageBudgetEngine.calculate_and_allocate_slots(contract)
        self.assertEqual(len(slots), 2)
        self.assertEqual(slots[0].role, "cover")
        self.assertEqual(slots[1].page_number, 2)

    def test_allocate_exact_seven_pages(self):
        contract = RequirementParser.parse("Catálogo de 7 páginas.")
        slots = PageBudgetEngine.calculate_and_allocate_slots(contract)
        self.assertEqual(len(slots), 7)
        self.assertEqual(slots[0].role, "cover")
        self.assertEqual(slots[-1].role, "backcover")

    def test_allocate_exact_37_pages(self):
        contract = RequirementParser.parse("Quero exatamente 37 páginas.")
        slots = PageBudgetEngine.calculate_and_allocate_slots(contract)
        self.assertEqual(len(slots), 37)
        self.assertEqual(slots[0].page_number, 1)
        self.assertEqual(slots[-1].page_number, 37)

    def test_allocate_40_products_in_one_pager(self):
        contract = RequirementParser.parse("Faça 1 página com 40 produtos.")
        sample_prods = [{"name": f"Item {i+1}", "price": f"R$ {10+i},00"} for i in range(40)]
        slots = PageBudgetEngine.calculate_and_allocate_slots(contract, products=sample_prods)
        self.assertEqual(len(slots), 1)
        self.assertEqual(len(slots[0].allocated_products), 40)

    def test_maximum_page_count_allocation(self):
        contract = RequirementParser.parse("Catálogo de no máximo 4 páginas.")
        # 1 produto -> precisa de ~3 páginas, que é <= 4
        slots = PageBudgetEngine.calculate_and_allocate_slots(contract, products=[{"name": "P1"}])
        self.assertLessEqual(len(slots), 4)

    def test_minimum_page_count_allocation(self):
        contract = RequirementParser.parse("Catálogo de pelo menos 8 páginas.")
        # 2 produtos normalmente precisariam de 3 páginas, mas o mínimo é 8
        slots = PageBudgetEngine.calculate_and_allocate_slots(contract, products=[{"name": "P1"}, {"name": "P2"}])
        self.assertGreaterEqual(len(slots), 8)
