"""
Testes Unitários para o Constraint Engine e Hierarquia de Prioridades (P0 - P8).
"""
from django.test import TestCase
from api.ai.requirement_parser import RequirementParser
from api.ai.constraint_engine import ConstraintEngine


class ConstraintEngineTestCase(TestCase):

    def test_feasibility_physical_impossibility(self):
        # 50.000 palavras em 1 página A4 é fisicamente impossível
        contract = RequirementParser.parse("Catálogo de 1 página.")
        is_feasible, conflict_msg = ConstraintEngine.evaluate_feasibility(
            contract=contract,
            product_count=0,
            word_count=50000,
        )
        self.assertFalse(is_feasible)
        self.assertIn("PHYSICAL_IMPOSSIBILITY", conflict_msg)

    def test_feasibility_excessive_products_one_pager(self):
        contract = RequirementParser.parse("Catálogo de 1 página.")
        is_feasible, conflict_msg = ConstraintEngine.evaluate_feasibility(
            contract=contract,
            product_count=60,
            word_count=100,
        )
        self.assertFalse(is_feasible)
        self.assertIn("PHYSICAL_IMPOSSIBILITY", conflict_msg)

    def test_style_arbitration_luxury_one_pager_with_many_products(self):
        # Usuário pediu 1 página de luxo com 15 produtos
        # P1 (1 página) e P2 (produtos) devem vencer P6 (whitespace 70% de luxo)
        contract = RequirementParser.parse("Catálogo de luxo minimalista de 1 página com 15 produtos.")
        arbitrated = ConstraintEngine.arbitrate_style_vs_constraints(contract, product_count=15)
        # O whitespace deve ter sido reduzido para viabilizar a página única sem violar P1
        self.assertLessEqual(arbitrated.design.whitespace, 40)
        self.assertIn("dense_spec_matrix", arbitrated.design.layout_behavior)

    def test_filter_retrieved_knowledge_respects_negative_constraints(self):
        contract = RequirementParser.parse("Catálogo sem cards e sem gradientes.")
        raw_rag_items = [
            {"slug": "card-grid-modern", "description": "Layout com cards flutuantes", "blueprint_data": {"containerStyle": "card"}},
            {"slug": "gradient-hero-saas", "description": "Hero com fundo gradiente", "blueprint_data": {}},
            {"slug": "swiss-clean-lines", "description": "Diagramação com réguas tipográficas", "blueprint_data": {}},
        ]
        filtered = ConstraintEngine.filter_retrieved_knowledge(contract, raw_rag_items)
        self.assertEqual(len(filtered), 1)
        self.assertEqual(filtered[0]["slug"], "swiss-clean-lines")
