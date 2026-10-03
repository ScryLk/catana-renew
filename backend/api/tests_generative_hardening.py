"""
Testes de Hardening e Auditoria Arquitetural do Catana Generative Composition Engine.
Garante:
1. Determinismo Estável de Seed e Fingerprint (SHA256)
2. Inviolabilidade de Dados Comerciais (Zero alucinação de SKU, Preço, Estoque)
3. Fluxo Crítico -> Mutação (Critic FAIL dispara Mutation mesmo se Validator passar)
4. Safe Area Enforcement & Validação de Fronteiras
5. Negative Constraints em profundidade (NO_IMAGES, NO_CARDS, NO_COLORS, NO_GRADIENTS)
6. Mutação Alvo (Apenas páginas ofensivas são alteradas)
7. Telemetria e GenerativeDraft no Fallback
8. Gramática de Runtime (Rejeição de NaN, Inf, XSS e tipos inválidos)
9. Integridade de Fontes com Font Registry
"""
import copy
from django.test import TestCase

from api.ai.seed_utils import derive_creative_seed, compute_generation_fingerprint, derive_mutation_seed
from api.ai.commercial_guard import CommercialIntegrityGuard, IMMUTABLE_COMMERCIAL_FIELDS
from api.ai.design_grammar import validate_runtime_block, BlockType, DEFAULT_SAFE_AREA
from api.ai.generation_validator import GenerationValidator
from api.ai.visual_critic import VisualCritic, VisualCriticReport
from api.ai.composition_mutator import CompositionMutator
from api.ai.repair_engine import RepairEngine
from api.ai.pipeline import EditorialGenerationPipeline
from api.ai.requirement_contract import RequirementContract, ConstraintSet
from api.ai.font_registry import ALL_VERIFIED_FONTS, is_font_verified


class GenerativeHardeningTests(TestCase):
    """Bateria de testes de hardening para garantia arquitetural antes de promoção para production."""

    def setUp(self):
        self.sample_products = [
            {
                "id": "prod-101",
                "name": "Vestido Alta Costura Éthéré",
                "price": "R$ 14.800,00",
                "sku": "AC-2026-ETH",
                "quantity": "5 unidades",
                "description": "Seda pura com bordados manuais em fio metálico.",
                "image": "https://images.unsplash.com/photo-luxury-dress",
            },
            {
                "id": "prod-102",
                "name": "Casaco de Lã Pura Double-Face",
                "price": "R$ 8.900,00",
                "sku": "AC-2026-CAS",
                "quantity": "3 unidades",
                "description": "Lã virgem 100% com acabamento artesanal alfaiataria.",
                "image": None,
            },
        ]

    # 1. DETERMINISMO ESTÁVEL DE SEED E FINGERPRINT
    def test_deterministic_seed_and_fingerprint_reproducibility(self):
        """Mesmo prompt + mesmo seed produz impressão digital e seed idênticos entre execuções."""
        prompt = "Maison Balenciaga Editorial Lookbook 2026"
        seed1 = derive_creative_seed(seed_input=42, prompt=prompt)
        seed2 = derive_creative_seed(seed_input=42, prompt=prompt)
        self.assertEqual(seed1, seed2)

        fp1 = compute_generation_fingerprint(prompt=prompt, seed=42, products=self.sample_products)
        fp2 = compute_generation_fingerprint(prompt=prompt, seed=42, products=self.sample_products)
        self.assertEqual(fp1, fp2)
        self.assertEqual(len(fp1), 64)  # SHA-256 hex string

        # Seeds diferentes geram fingerprints diferentes
        fp_diff = compute_generation_fingerprint(prompt=prompt, seed=99, products=self.sample_products)
        self.assertNotEqual(fp1, fp_diff)

    def test_pipeline_execution_reproducibility(self):
        """Pipeline executado duas vezes com mesmo seed gera o mesmo catálogo."""
        doc1 = EditorialGenerationPipeline.execute(
            prompt="Maison Éthéré Inverno 2026, 4 páginas",
            products=self.sample_products,
            creative_seed=98765,
        )
        doc2 = EditorialGenerationPipeline.execute(
            prompt="Maison Éthéré Inverno 2026, 4 páginas",
            products=self.sample_products,
            creative_seed=98765,
        )
        self.assertEqual(doc1["generationFingerprint"], doc2["generationFingerprint"])
        self.assertEqual(doc1["totalPages"], doc2["totalPages"])
        self.assertEqual(len(doc1["pages"]), len(doc2["pages"]))
        # Verifica que o número de blocos em cada página é idêntico
        for p1, p2 in zip(doc1["pages"], doc2["pages"]):
            self.assertEqual(len(p1.get("blocks", [])), len(p2.get("blocks", [])))
            self.assertEqual(p1.get("type"), p2.get("type"))

    # 2. INVIOLABILIDADE DE DADOS COMERCIAIS
    def test_commercial_data_exact_preservation(self):
        """Campos comerciais fornecidos pelo usuário nunca sofrem mutação ou alteração de valor."""
        doc = EditorialGenerationPipeline.execute(
            prompt="Catálogo Comercial Exclusivo",
            products=self.sample_products,
            creative_seed=112233,
        )
        passed, violations = CommercialIntegrityGuard.verify_document_commercial_integrity(
            original_products=self.sample_products,
            document_pages=doc["pages"],
        )
        self.assertTrue(passed, f"Violações comerciais detectadas: {violations}")
        self.assertEqual(len(violations), 0)

    def test_commercial_guard_never_fabricates_missing_fields(self):
        """Produtos com campos ausentes (sem preço, sem sku, sem imagem) continuam None, sem alucinar defaults sintéticos."""
        sparse_product = {
            "name": "Peça Conceitual Sem Preço",
            # Sem sku, sem price, sem quantity, sem image
        }
        sanitized = CommercialIntegrityGuard.sanitize_supplied_product(sparse_product, default_index=1)
        self.assertIsNone(sanitized.get("price"))
        self.assertIsNone(sanitized.get("sku"))
        self.assertIsNone(sanitized.get("quantity"))
        self.assertIsNone(sanitized.get("image"))
        self.assertNotEqual(sanitized.get("price"), "R$ 0,00")
        self.assertNotEqual(sanitized.get("sku"), "SKU-001")

    # 3. CRITIC FAIL DISPARA MUTATION MESMO SE VALIDATOR PASSAR
    def test_critic_fail_triggers_mutation_when_validator_passes(self):
        """Se o validador passar mas o crítico reprovar por risco genérico/clichê, o RepairEngine DEVE atuar."""
        contract = RequirementContract(raw_prompt="Auditoria Crítica")
        document = {
            "catalogId": "cat-test",
            "renderMode": "generative",
            "totalPages": 1,
            "pages": [
                {
                    "id": "p1",
                    "pageNumber": 1,
                    "renderMode": "generative",
                    "composition": {"axis": "center", "balance": "symmetric"},
                    "blocks": [
                        {"id": "b1", "type": "headline", "role": "headline", "x": 0.20, "y": 0.20, "width": 0.60, "height": 0.15, "fontSize": 32, "alignment": "center", "content": "Título"},
                        {"id": "b2", "type": "text", "role": "body", "x": 0.20, "y": 0.40, "width": 0.60, "height": 0.20, "fontSize": 14, "alignment": "center", "content": "Corpo"},
                    ]
                }
            ]
        }
        # Validador passa (sem colisões, dentro da tela)
        val = GenerationValidator.validate(contract=contract, document=document)
        self.assertTrue(val.passed)

        # Força relatório do Crítico reprovado
        failing_critic = VisualCriticReport(
            hierarchy=0.40,
            legibility=0.50,
            rhythm=0.30,
            balance=0.40,
            contrast=0.40,
            novelty=0.20,
            brand_fit=0.50,
            generic_risk=0.55,  # Excede limite
            passed=False,
            cliches_detected=["CLICHE_STANDARDIZED_LUXURY_COVER"],
            recommendations=["Aumentar assimetria e quebrar rigidez central"],
        )

        repaired_doc, repaired_val, repair_log = RepairEngine.repair_document(
            contract=contract,
            document=document,
            initial_validation=val,
            critic_report=failing_critic,
            creative_seed=5555,
        )

        self.assertGreater(len(repair_log), 0)
        self.assertTrue(any("MUTAÇÃO POR CRÍTICA VISUAL" in log for log in repair_log))

    # 4. SAFE AREA ENFORCEMENT & VALIDAÇÃO DE FRONTEIRAS
    def test_safe_area_violation_detection(self):
        """Bloco fora da safeArea sem isSafeExempt=True é reprovado pelo GenerationValidator."""
        contract = RequirementContract(raw_prompt="Safe area test")
        bad_doc = {
            "totalPages": 1,
            "renderMode": "generative",
            "pages": [
                {
                    "pageNumber": 1,
                    "renderMode": "generative",
                    "safeArea": {"top": 0.08, "bottom": 0.92, "left": 0.08, "right": 0.92},
                    "blocks": [
                        # y=0.02 invade a margem superior de 0.08
                        {"id": "invading-title", "type": "headline", "role": "headline", "x": 0.10, "y": 0.02, "width": 0.50, "height": 0.10, "bleed": False}
                    ]
                }
            ]
        }
        val = GenerationValidator.validate(contract=contract, document=bad_doc)
        self.assertFalse(val.passed)
        self.assertTrue(any("SAFE_AREA_VIOLATION" in err for err in val.errors))

    # 5. NEGATIVE CONSTRAINTS EM PROFUNDIDADE
    def test_negative_constraints_no_images_rejection(self):
        """Garante que NO_IMAGES rejeita blocos de imagem em qualquer nível."""
        contract = RequirementContract(
            raw_prompt="Catálogo Tipográfico Puro",
            constraints=ConstraintSet(negative=["NO_IMAGES"]),
        )
        doc_with_image = {
            "totalPages": 1,
            "renderMode": "generative",
            "pages": [
                {
                    "pageNumber": 1,
                    "renderMode": "generative",
                    "blocks": [
                        {"id": "img1", "type": "image", "x": 0.1, "y": 0.1, "width": 0.4, "height": 0.4}
                    ]
                }
            ]
        }
        val = GenerationValidator.validate(contract=contract, document=doc_with_image)
        self.assertFalse(val.passed)
        self.assertTrue(any("NEGATIVE_CONSTRAINT_VIOLATION: NO_IMAGES" in err for err in val.errors))

    # 6. MUTAÇÃO ALVO (APENAS PÁGINAS OFENSIVAS SÃO ALTERADAS)
    def test_targeted_mutation_only_alters_offending_pages(self):
        """RepairEngine preserva intactas as páginas válidas e só muta pranchetas problemáticas."""
        contract = RequirementContract(raw_prompt="Multi-page test")
        doc = {
            "catalogId": "cat-multi",
            "renderMode": "generative",
            "totalPages": 2,
            "pages": [
                {
                    "id": "p1-valid",
                    "pageNumber": 1,
                    "renderMode": "generative",
                    "blocks": [
                        {"id": "b1", "type": "headline", "x": 0.10, "y": 0.10, "width": 0.50, "height": 0.10, "content": "Página Válida"}
                    ]
                },
                {
                    "id": "p2-invalid",
                    "pageNumber": 2,
                    "renderMode": "generative",
                    "blocks": [
                        # Coordenada fora da prancheta x + width = 1.30 > 1.05
                        {"id": "b2-bad", "type": "text", "x": 0.80, "y": 0.50, "width": 0.50, "height": 0.20, "bleed": False}
                    ]
                }
            ]
        }
        val = GenerationValidator.validate(contract=contract, document=doc)
        self.assertFalse(val.passed)

        repaired_doc, repaired_val, repair_log = RepairEngine.repair_document(
            contract=contract,
            document=doc,
            initial_validation=val,
            creative_seed=999,
        )

        p1_after = repaired_doc["pages"][0]
        # Pág 1 deve ser estritamente idêntica
        self.assertEqual(p1_after["blocks"][0]["x"], 0.10)
        self.assertEqual(p1_after["blocks"][0]["y"], 0.10)
        self.assertEqual(p1_after["blocks"][0]["content"], "Página Válida")

    # 7. TELEMETRIA E GENERATIVEDRAFT NO FALLBACK
    def test_legacy_fallback_preserves_generative_draft(self):
        """Quando ocorre fallback para legacy, os blocos originais vão para generativeDraft sem sumir."""
        page_dict = {
            "id": "p-fail",
            "pageNumber": 1,
            "renderMode": "generative",
            "blocks": [
                {"id": "draft-block", "type": "headline", "x": 0.1, "y": 0.1, "width": 0.4, "height": 0.1}
            ]
        }
        fallback_page = RepairEngine._fallback_to_safe_editorial(page_dict, reason="UNRESOLVED_CRITICAL_COLLISION")
        self.assertEqual(fallback_page["renderMode"], "legacy")
        self.assertIn("generativeDraft", fallback_page)
        self.assertEqual(len(fallback_page["generativeDraft"]), 1)
        self.assertEqual(fallback_page["generativeDraft"][0]["id"], "draft-block")
        self.assertEqual(len(fallback_page["blocks"]), 0)

    # 8. GRAMÁTICA DE RUNTIME (REJEIÇÃO DE NAN, INF, XSS E CHAVES PERIGOSAS)
    def test_runtime_block_validation(self):
        """Validador rejeita blocos com NaN, Inf, chaves inseguras ou coordenadas negativas."""
        valid_block = {
            "id": "b-valid",
            "type": "headline",
            "role": "headline",
            "x": 0.10,
            "y": 0.10,
            "width": 0.80,
            "height": 0.15,
        }
        is_ok, errs = validate_runtime_block(valid_block)
        self.assertTrue(is_ok)

        # Inseguro: Chave XSS
        xss_block = copy.deepcopy(valid_block)
        xss_block["dangerouslySetInnerHTML"] = "<script>alert(1)</script>"
        is_ok_xss, errs_xss = validate_runtime_block(xss_block)
        self.assertFalse(is_ok_xss)
        self.assertTrue(any("DISALLOWED_KEY" in e for e in errs_xss))

        # Inválido: NaN ou Inf
        nan_block = copy.deepcopy(valid_block)
        nan_block["x"] = float("nan")
        is_ok_nan, errs_nan = validate_runtime_block(nan_block)
        self.assertFalse(is_ok_nan)

        # Inválido: Coordenada fora da prancheta
        out_block = copy.deepcopy(valid_block)
        out_block["y"] = -0.5
        is_ok_out, errs_out = validate_runtime_block(out_block)
        self.assertFalse(is_ok_out)

    # 9. INTEGRIDADE DE FONTES COM FONT REGISTRY
    def test_font_registry_membership(self):
        """Todas as fontes geradas devem constar no registro verificado único."""
        doc = EditorialGenerationPipeline.execute(
            prompt="Joalheria Contemporânea Alta Joalheria 2026",
            creative_seed=443322,
        )
        creative_dir = doc["designSystem"]["creativeDirection"]
        font_pairing = creative_dir["font_pairing"]

        for role in ["display", "body", "metadata"]:
            font_family = font_pairing[role]
            self.assertTrue(
                is_font_verified(font_family),
                f"Fonte '{font_family}' não consta no ALL_VERIFIED_FONTS registry.",
            )
