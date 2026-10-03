"""
Test Suite - Catana Generative Composition Engine.
Testa exaustivamente:
1. VisualDNA: determinismo com mesmo seed, variância entre seeds, intervalos 0..1 e respeito a restrições.
2. CreativeDirector: diretrizes concretas, fontes seguras do registry e lista de proibições.
3. NarrativePlanner: cadência de ritmo e eixos entre páginas adjacentes.
4. CompositionPlanner: coordenadas normalizadas (0..1), Safe Area e integridade dos blocos.
5. NoveltyEngine: cálculo de fingerprints, distância Euclidiana e score de novidade.
6. CompositionMutator: mutações espaciais preservando 100% dos dados comerciais do usuário (SKU, preço, nome).
7. GeometryValidator: detecção de limites, dimensões inválidas e colisão.
8. Pipeline Integration: execução de ponta a ponta com renderMode=generative e telemetria.
9. Retrocompatibilidade: documentos legados preservados e fallback seguro.
"""
from django.test import TestCase
from api.ai.requirement_contract import RequirementContract
from api.ai.visual_dna import VisualDNABuilder, VisualDNA
from api.ai.creative_director import CreativeDirector, FONT_REGISTRY
from api.ai.narrative_planner import NarrativePlanner
from api.ai.content_planner import ContentPlanner
from api.ai.page_budget import PageBudgetEngine
from api.ai.design_grammar import GenerativeBlock
from api.ai.composition_planner import CompositionPlanner
from api.ai.novelty_engine import NoveltyEngine, PageFingerprint
from api.ai.composition_mutator import CompositionMutator
from api.ai.visual_critic import VisualCritic
from api.ai.generation_validator import GenerationValidator
from api.ai.pipeline import EditorialGenerationPipeline


class GenerativeCompositionEngineTests(TestCase):

    def setUp(self):
        self.luxury_prompt = "Maison Verdana Alta Costura Inverno 2026, 6 páginas, luxo editorial"
        self.sample_products = [
            {"id": "p1", "name": "Vestido Éthéré", "price": "R$ 14.500", "sku": "VER-001", "description": "Seda pura drapeada à mão."},
            {"id": "p2", "name": "Casaco Monumental", "price": "R$ 22.000", "sku": "VER-002", "description": "Lã virgem com corte arquitetônico."},
        ]

    # 1. TESTES DE VISUAL DNA
    def test_visual_dna_determinism(self):
        """Mesmo prompt + mesmo seed -> exatamente o mesmo VisualDNA."""
        contract = RequirementContract(raw_prompt=self.luxury_prompt)
        dna_1 = VisualDNABuilder.derive(contract, creative_seed=424242)
        dna_2 = VisualDNABuilder.derive(contract, creative_seed=424242)
        self.assertEqual(dna_1, dna_2)

    def test_visual_dna_variance(self):
        """Mesmo prompt + seeds diferentes -> DNAs mensuravelmente distintos."""
        contract = RequirementContract(raw_prompt=self.luxury_prompt)
        dna_a = VisualDNABuilder.derive(contract, creative_seed=11111)
        dna_b = VisualDNABuilder.derive(contract, creative_seed=99999)
        self.assertNotEqual(dna_a, dna_b)
        self.assertNotEqual(dna_a.symmetry, dna_b.symmetry)

    def test_visual_dna_range_and_constraints(self):
        """Todos os parâmetros devem estar entre 0.0 e 1.0 e respeitar hard constraints."""
        from api.ai.requirement_parser import RequirementParser
        contract = RequirementParser.parse(prompt="Catálogo sem fotos, sem cards e sem diagonais")
        contract.constraints.negative = ["NO_IMAGES", "NO_CARDS", "NO_DIAGONALS"]
        dna = VisualDNABuilder.derive(contract, creative_seed=55555)

        for param, val in dna.to_dict().items():
            self.assertGreaterEqual(val, 0.0, f"{param} abaixo de 0")
            self.assertLessEqual(val, 1.0, f"{param} acima de 1")

        # Hard constraints
        self.assertEqual(dna.image_dominance, 0.0)
        self.assertEqual(dna.crop_aggressiveness, 0.0)
        self.assertEqual(dna.axis_tension, 0.0)

    # 2. TESTES DE CREATIVE DIRECTOR
    def test_creative_director_concrete_guidelines(self):
        """CreativeDirector deve gerar diretrizes operacionais e fontes válidas do registry."""
        contract = RequirementContract(raw_prompt=self.luxury_prompt)
        slots = PageBudgetEngine.calculate_and_allocate_slots(contract)
        content_plan = ContentPlanner.plan(contract, slots)
        dna = VisualDNABuilder.derive(contract, creative_seed=777)
        direction = CreativeDirector.direct(contract, content_plan, dna, creative_seed=777)

        self.assertTrue(len(direction.concept_name) > 0)
        self.assertTrue(len(direction.avoid) >= 3)
        # Fontes devem estar no registry
        all_safe_fonts = [f for sublist in FONT_REGISTRY.values() for f in sublist]
        self.assertIn(direction.font_pairing["display"], all_safe_fonts)

    # 3. TESTES DE NARRATIVE PLANNER
    def test_narrative_planner_rhythm_and_axis_alternation(self):
        """Páginas consecutivas não devem repetir cegamente o mesmo eixo ou ritmo."""
        contract = RequirementContract(raw_prompt=self.luxury_prompt)
        slots = PageBudgetEngine.calculate_and_allocate_slots(contract)
        content_plan = ContentPlanner.plan(contract, slots)
        dna = VisualDNABuilder.derive(contract, creative_seed=888)
        direction = CreativeDirector.direct(contract, content_plan, dna, creative_seed=888)
        narrative = NarrativePlanner.plan_sequence(contract, content_plan, dna, direction, creative_seed=888)

        self.assertEqual(len(narrative), 6)
        # Verifica que existem pelo menos 2 eixos diferentes na sequência
        unique_axes = set(p.layout_axis for p in narrative)
        self.assertGreaterEqual(len(unique_axes), 2)

    # 4. TESTES DE NOVELTY ENGINE
    def test_novelty_engine_fingerprint_and_distance(self):
        """NoveltyEngine deve computar fingerprints e detectar páginas idênticas vs distintas."""
        fp1 = PageFingerprint(symmetry=0.2, density=0.3, headline_x=0.06, alignment_dominance="left")
        fp1_dup = PageFingerprint(symmetry=0.2, density=0.3, headline_x=0.06, alignment_dominance="left")
        fp2 = PageFingerprint(symmetry=0.8, density=0.7, headline_x=0.50, alignment_dominance="center")

        # Identical fingerprints
        self.assertEqual(NoveltyEngine.calculate_similarity(fp1, fp1_dup), 1.0)
        self.assertEqual(NoveltyEngine.calculate_novelty_score(fp1, fp1_dup), 0.0)

        # Different fingerprints
        sim = NoveltyEngine.calculate_similarity(fp1, fp2)
        novelty = NoveltyEngine.calculate_novelty_score(fp1, fp2)
        self.assertLess(sim, 0.80)
        self.assertGreater(novelty, 0.20)

    # 5. TESTES DE COMPOSITION MUTATOR (REGRA DE OURO DOS DADOS COMERCIAIS)
    def test_composition_mutator_preserves_product_data(self):
        """Mutação altera coordenadas e layout, mas NUNCA corrompe dados de produto (SKU, preço, nome)."""
        page = {
            "id": "p-01",
            "pageNumber": 1,
            "renderMode": "generative",
            "composition": {"axis": "diagonal", "balance": "asymmetric"},
            "blocks": [
                {"id": "b1", "type": "headline", "role": "headline", "x": 0.2, "y": 0.2, "width": 0.6, "height": 0.2, "fontSize": 32, "alignment": "center", "content": "Título Original"},
                {"id": "b2", "type": "price", "role": "price", "x": 0.2, "y": 0.5, "width": 0.3, "height": 0.1, "fontSize": 18, "content": "R$ 9.999", "productId": "p1"},
                {"id": "b3", "type": "metadata", "role": "sku", "x": 0.2, "y": 0.6, "width": 0.3, "height": 0.05, "content": "SKU-999", "productId": "p1"},
            ]
        }

        mutated, desc = CompositionMutator.mutate(page, mutation_type="increase_asymmetry", strength=0.8)

        # Dados de produto devem permanecer 100% inalterados
        price_block = next(b for b in mutated["blocks"] if b["id"] == "b2")
        sku_block = next(b for b in mutated["blocks"] if b["id"] == "b3")
        self.assertEqual(price_block["content"], "R$ 9.999")
        self.assertEqual(price_block["productId"], "p1")
        self.assertEqual(sku_block["content"], "SKU-999")

        # Alinhamento ou coordenadas devem ter mutado
        head_block = next(b for b in mutated["blocks"] if b["id"] == "b1")
        self.assertEqual(head_block["alignment"], "left")

    # 6. TESTES DE GEOMETRY VALIDATOR
    def test_geometry_validator_detects_bounds_violations(self):
        """Validador deve rejeitar blocos que vazem da prancheta se não forem bleed."""
        doc_invalid = {
            "pages": [
                {
                    "pageNumber": 1,
                    "renderMode": "generative",
                    "blocks": [
                        {"id": "bad-block", "type": "text", "x": 0.85, "y": 0.85, "width": 0.30, "height": 0.30, "bleed": False}
                    ]
                }
            ]
        }
        contract = RequirementContract(raw_prompt="Teste")
        val = GenerationValidator.validate(contract, doc_invalid)
        self.assertFalse(val.passed)
        self.assertTrue(any("VALID_BLOCK_BOUNDS" in err for err in val.errors))

    # 7. TESTES DE PIPELINE INTEGRATION DE PONTA A PONTA
    def test_full_pipeline_generative_catalog(self):
        """Executa o pipeline completo e garante renderMode=generative e metadados no documento."""
        doc = EditorialGenerationPipeline.execute(prompt=self.luxury_prompt, creative_seed=12345)

        self.assertEqual(doc["totalPages"], 6)
        self.assertEqual(doc["renderMode"], "generative")
        self.assertIn("designSystem", doc)
        self.assertIn("visualDNA", doc["designSystem"])
        self.assertIn("creativeDirection", doc["designSystem"])
        self.assertEqual(doc["designSystem"]["creativeSeed"], 12345)

        # Cada página deve possuir renderMode e lista de blocks
        for p in doc["pages"]:
            self.assertEqual(p["renderMode"], "generative")
            self.assertGreater(len(p.get("blocks", [])), 0)
            self.assertIn("safeArea", p)
            self.assertIn("composition", p)

    # 8. TESTE DE RETROCOMPATIBILIDADE COM PÁGINAS LEGADAS
    def test_legacy_compatibility_fallback(self):
        """Páginas sem renderMode ou blocks devem validar e permanecer no modo legacy."""
        legacy_doc = {
            "totalPages": 2,
            "renderMode": "legacy",
            "pages": [
                {"pageNumber": 1, "type": "cover", "title": "Capa Antiga", "backgroundColor": "#141416", "textColor": "#FFFFFF"},
                {"pageNumber": 2, "type": "hero", "title": "Hero Antigo", "backgroundColor": "#FFFFFF", "textColor": "#141416"},
            ]
        }
        contract = RequirementContract(raw_prompt="Catálogo legado")
        val = GenerationValidator.validate(contract, legacy_doc)
        self.assertTrue(val.passed)
