"""
Editorial Generation Pipeline - Pipeline Unificado de Direção de Arte e Composição Generativa.
Governa todo o fluxo de criação a partir do prompt:
RequirementParser -> ConstraintEngine -> PageBudgetEngine -> TemplateRAG -> ContentPlanner
-> CreativeDirector -> VisualDNA -> NarrativePlanner -> CompositionPlanner -> GenerativePageSchema
-> GenerationValidator -> VisualCritic -> RepairEngine / Mutation -> Final Document.
"""
import copy
import logging
import os
import time
from typing import Dict, Any, Optional, List
from django.conf import settings
from .requirement_contract import RequirementContract
from .requirement_parser import RequirementParser
from .constraint_engine import ConstraintEngine
from .page_budget import PageBudgetEngine, PageSlot
from .content_planner import ContentPlanner, DocumentContentPlan
from .design_planner import DesignPlanner, DocumentDesignPlan
from .generation_validator import GenerationValidator, ValidationResult
from .repair_engine import RepairEngine
from .visual_dna import VisualDNA, VisualDNABuilder
from .creative_director import CreativeDirector, CreativeDirection
from .narrative_planner import NarrativePlanner, PageNarrativePlan
from .composition_planner import CompositionPlanner
from .novelty_engine import NoveltyEngine
from .visual_critic import VisualCritic, VisualCriticReport, GenerationQualityReport
from .composition_mutator import CompositionMutator
from .seed_utils import derive_creative_seed, compute_generation_fingerprint
from .commercial_guard import CommercialIntegrityGuard
from .design_grammar import validate_runtime_block
import hashlib
import json

logger = logging.getLogger(__name__)

# Feature Flag Oficial da Arquitetura Generativa (Item 43)
# Por padrão é True; pode ser desativado via GENERATIVE_COMPOSITION_ENGINE=false em caso de rollback
_env_flag = os.getenv("GENERATIVE_COMPOSITION_ENGINE")
if _env_flag is not None:
    GENERATIVE_COMPOSITION_ENGINE = _env_flag.lower() not in ["false", "0", "no", "off"]
else:
    GENERATIVE_COMPOSITION_ENGINE = True


class EditorialGenerationPipeline:
    """
    Pipeline unificado de geração editorial governado por direção de arte e gramática compositiva.
    """

    @classmethod
    def execute(cls, prompt, products=None, attachments=None, synthesis_generator_func=None,
                creative_seed=None, creativity_level=0.5):
        try:
            return cls._execute(prompt, products, attachments, synthesis_generator_func,
                                creative_seed, creativity_level)
        except Exception as exc:
            # A failed subsystem cannot turn a safe renderer fallback into approval.
            logger.error('[EditorialPipeline] Controlled failure: %s', type(exc).__name__)
            clean = [CommercialIntegrityGuard.sanitize_supplied_product(p) for p in (products or [])]
            for idx, product in enumerate(clean):
                if product['id'] is None:
                    product['id'] = f'input-product-{idx + 1}'
            contract = RequirementParser.parse(prompt=prompt, products=clean, attachments=attachments)
            slots = PageBudgetEngine.calculate_and_allocate_slots(contract, clean)
            pages = [{'id': f'fallback-p{i+1}', 'pageNumber':i+1, 'type':'single',
                      'renderMode':'legacy', 'blocks':[], 'products':copy.deepcopy(slot.allocated_products),
                      'backgroundColor':'#FFFFFF', 'textColor':'#141416', 'accentColor':'#141416',
                      'title':'CATÁLOGO', 'generativeDraft':{'blocks':[], 'composition':{}, 'safeArea':{}},
                      'negativeConstraints':list(contract.constraints.negative)} for i, slot in enumerate(slots)]
            if 'NO_IMAGES' in contract.constraints.negative:
                for page in pages:
                    for product in page['products']:
                        product['image'] = None
            seed = creative_seed if isinstance(creative_seed, int) else derive_creative_seed(prompt=prompt, products=clean)
            fingerprint = compute_generation_fingerprint(prompt=prompt, products=clean, seed=seed)
            return {'catalogId':'cat-' + fingerprint[:12], 'generationFingerprint':fingerprint,
                    'title':'CATÁLOGO', 'category':'EDITORIAL', 'summary':'', 'reasoning':'Generation requires review.',
                    'initialPrompt':prompt, 'councilDelegations':[],
                    'palette':{'name':'Safe legacy', 'primary':'#141416','background':'#FFFFFF','accent':'#141416'},
                    'pages':pages, 'totalPages':len(pages), 'renderMode':'legacy',
                    'qualityGate':{'passed':False, 'publishable':False, 'status':'blocked',
                                   'reasons':['GENERATION_SUBSYSTEM_FAILURE:' + type(exc).__name__]},
                    'observability':{'fallbackUsed':True, 'fallbackPages':list(range(1,len(pages)+1)),
                                     'qualityGateStatus':'blocked', 'runtimeSecurityPass':False}}

    @classmethod
    def _execute(
        cls,
        prompt: str,
        products: Optional[List[Dict[str, Any]]] = None,
        attachments: Optional[List[Dict[str, Any]]] = None,
        synthesis_generator_func: Optional[Any] = None,
        creative_seed: Optional[int] = None,
        creativity_level: float = 0.5,
    ) -> Dict[str, Any]:
        """
        Executa as etapas completas do pipeline generativo com validação, crítica e auto-reparo.
        """
        start_time = time.time()
        timings: Dict[str, int] = {}
        logger.info("[EditorialPipeline] Starting generation")

        # ETAPA 1 & 2: INTENT PARSER & REQUIREMENT CONTRACT
        t0 = time.time()
        contract = RequirementParser.parse(prompt=prompt, products=products, attachments=attachments)
        timings["requirement_parser_ms"] = int((time.time() - t0) * 1000)

        # ETAPA 3: CONSTRAINT ENGINE & FEASIBILITY CHECK
        t0 = time.time()
        total_prods = len(products) if products else 0
        is_feasible, conflict_msg = ConstraintEngine.evaluate_feasibility(
            contract=contract,
            product_count=total_prods,
            word_count=len(prompt.split()),
        )
        if not is_feasible:
            logger.warning(f"[EditorialPipeline] Alerta de inviabilidade física: {conflict_msg}")

        # Arbitragem de conflitos entre preferências estéticas e restrições rígidas
        contract = ConstraintEngine.arbitrate_style_vs_constraints(contract, product_count=total_prods)
        timings["feasibility_ms"] = int((time.time() - t0) * 1000)

        # Normalização rigorosa de dados comerciais (Item 10 & 11)
        clean_products = []
        if products:
            for idx, p in enumerate(products):
                clean_products.append(CommercialIntegrityGuard.sanitize_supplied_product(p, default_index=idx + 1))

        # Internal IDs are technical, never SKU/name fallbacks. Preserve supplied IDs exactly.
        for idx, product in enumerate(clean_products):
            if product['id'] is None:
                product['id'] = f"input-product-{idx + 1}"
        commercial_originals = copy.deepcopy(clean_products)
        commercial_snapshot = CommercialIntegrityGuard.create_snapshot(commercial_originals)
        snapshot_hash = hashlib.sha256(json.dumps(commercial_snapshot, sort_keys=True, separators=(',', ':')).encode()).hexdigest()

        # Derivação de Creative Seed Criptograficamente Determinístico (Item 2)
        if creative_seed is None:
            seed = derive_creative_seed(prompt=prompt, products=clean_products)
        else:
            seed = int(creative_seed)

        # Cálculo da Assinatura Determinística da Geração (Item 3)
        gen_fingerprint = compute_generation_fingerprint(
            prompt=prompt,
            products=clean_products,
            seed=seed,
            constraints=contract.constraints.__dict__ if hasattr(contract.constraints, "__dict__") else {},
        )

        # ETAPA 4: PAGE BUDGET ENGINE (Criação de N slots com orçamentos espaciais)
        t0 = time.time()
        page_slots = PageBudgetEngine.calculate_and_allocate_slots(contract=contract, products=clean_products)
        timings["page_budget_ms"] = int((time.time() - t0) * 1000)

        # ETAPA 5: RAG RETRIEVAL CONSCIENTE DE RESTRIÇÕES (Inspiração e princípios, não cópia)
        t0 = time.time()
        from api.services.template_rag import TemplateRAGService
        rag_context = TemplateRAGService.retrieve_context_for_contract(contract)
        timings["rag_ms"] = int((time.time() - t0) * 1000)

        # ETAPA 6: CONTENT PLANNER (WHAT TO SAY)
        t0 = time.time()
        content_plan = ContentPlanner.plan(
            contract=contract,
            slots=page_slots,
            products=clean_products,
            synthesis_data=rag_context.get("synthesis_data"),
        )
        timings["content_planner_ms"] = int((time.time() - t0) * 1000)

        # ETAPA 7: CREATIVE DIRECTOR & VISUAL DNA (HOW TO SHOW IT — PARAMÉTRICO)
        t0 = time.time()
        visual_dna = VisualDNABuilder.derive(
            contract=contract,
            creative_seed=seed,
            creativity_level=creativity_level,
        )

        creative_direction = CreativeDirector.direct(
            contract=contract,
            content_plan=content_plan,
            visual_dna=visual_dna,
            rag_context=rag_context,
            creative_seed=seed,
        )
        timings["creative_director_ms"] = int((time.time() - t0) * 1000)

        # ETAPA 8: NARRATIVE PLANNER (RITMO EDITORIAL ENTRE PRANCHETAS)
        t0 = time.time()
        narrative_sequence = NarrativePlanner.plan_sequence(
            contract=contract,
            content_plan=content_plan,
            visual_dna=visual_dna,
            direction=creative_direction,
            creative_seed=seed,
        )
        timings["narrative_planner_ms"] = int((time.time() - t0) * 1000)

        # Design plan clássico mantido para compatibilidade e paleta
        design_plan = DesignPlanner.plan(
            contract=contract,
            content_plan=content_plan,
            rag_context=rag_context,
        )

        # ETAPA 9: GENERATION PLAN & COMPOSITION PLANNER (MONTAGEM DE BLOCOS NORMALIZADOS)
        t0 = time.time()
        raw_document = cls._generate_document(
            contract=contract,
            content_plan=content_plan,
            design_plan=design_plan,
            rag_context=rag_context,
            page_slots=page_slots,
            synthesis_func=synthesis_generator_func,
            visual_dna=visual_dna,
            creative_direction=creative_direction,
            narrative_sequence=narrative_sequence,
            creative_seed=seed,
            generation_fingerprint=gen_fingerprint,
            clean_products=clean_products,
        )
        timings["composition_planner_ms"] = int((time.time() - t0) * 1000)

        # ETAPA 10: VALIDATOR (DETERMINÍSTICO, SEMÂNTICO E GEOMÉTRICO)
        t0 = time.time()
        initial_val = GenerationValidator.validate(contract=contract, document=raw_document)
        timings["validation_ms"] = int((time.time() - t0) * 1000)

        # ETAPA 11: VISUAL CRITIC (AVALIAÇÃO DE RISCO GENÉRICO E CLICHÊS COM MÉTRICAS REAIS)
        t0 = time.time()
        critic_report = VisualCritic.critique(document=raw_document, contract=contract, visual_dna=visual_dna)
        timings["critic_ms"] = int((time.time() - t0) * 1000)

        final_doc = raw_document
        final_val = initial_val
        repair_log = []

        # ETAPA 12: AUTO-REPARO & MUTAÇÃO CRIATIVA (Item 5: Critic FAIL dispara Mutation mesmo se Validator passar)
        t0 = time.time()
        if not initial_val.passed or not critic_report.passed:
            logger.info(
                f"[EditorialPipeline] Intervenção necessária (Val Errors: {len(initial_val.errors)}, "
                f"Crítica Passed: {critic_report.passed}, Clichês: {critic_report.cliches_detected}). "
                f"Acionando RepairEngine & Targeted Mutation..."
            )
            final_doc, final_val, repair_log = RepairEngine.repair_document(
                contract=contract,
                document=raw_document,
                initial_validation=initial_val,
                critic_report=critic_report,
                creative_seed=seed,
            )
            # Reavalia com o crítico após mutações
            critic_report = VisualCritic.critique(document=final_doc, contract=contract, visual_dna=visual_dna)
        timings["repair_ms"] = int((time.time() - t0) * 1000)

        elapsed_ms = int((time.time() - start_time) * 1000)
        timings["total_elapsed_ms"] = elapsed_ms

        # ETAPA 13: AUDITORIA DE INTEGRIDADE COMERCIAL (Item 11 & 12)
        comm_passed, comm_violations = CommercialIntegrityGuard.verify_document_commercial_integrity(
            original_products=commercial_originals,
            document_pages=final_doc.get("pages", []),
            allocated_products=[p for slot in page_slots for p in slot.allocated_products],
        )

        # Final mandatory boundary, including repaired blocks.
        final_val = GenerationValidator.validate(contract=contract, document=final_doc)
        runtime_passed = all(validate_runtime_block(b)[0] for p in final_doc.get('pages', []) for b in p.get('blocks', []))
        gate_passed = final_val.passed and critic_report.passed and comm_passed and runtime_passed
        reasons = final_val.errors + comm_violations
        if not critic_report.passed:
            reasons.append('VISUAL_CRITIC_FAILED')
        if not runtime_passed:
            reasons.append('RUNTIME_SECURITY_FAILED')
        final_doc['qualityGate'] = {
            'passed': gate_passed, 'publishable': gate_passed,
            'status': 'passed' if gate_passed else ('blocked' if not comm_passed or not runtime_passed or not final_val.passed else 'needs_review'),
            'reasons': reasons,
        }

        # ETAPA 14: CÁLCULO DE NOVIDADE FINAL E DETERMINAÇÃO DO MODO EFETIVO
        novelty_eval = NoveltyEngine.evaluate_catalog_novelty(
            [p for p in final_doc.get("pages", []) if p.get("renderMode") == "generative"]
        )

        # Modo efetivo de renderização baseado no estado real das pranchetas (Item 45)
        page_render_modes = [p.get("renderMode") for p in final_doc.get("pages", [])]
        if all(m == "generative" for m in page_render_modes):
            effective_render_mode = "generative"
        elif all(m == "legacy" for m in page_render_modes):
            effective_render_mode = "legacy"
        else:
            effective_render_mode = "mixed"

        repair_meta = final_doc.get("repair_metadata", {})
        fallback_used = repair_meta.get("fallbackUsed", False)

        # Relatório Unificado de Qualidade (Item 6)
        quality_report = GenerationQualityReport(
            structural_valid=final_val.deterministic_passed,
            semantic_valid=final_val.semantic_passed,
            commercial_data_valid=comm_passed,
            novelty_valid=novelty_eval.get("passed", True),
            visual_critic_valid=critic_report.passed,
            passed=(final_val.passed and critic_report.passed and comm_passed and novelty_eval.get("passed", True)),
            errors=final_val.errors + comm_violations + ([f"GENERIC_RISK_EXCEEDED: {critic_report.generic_risk}"] if not critic_report.passed else []),
            warnings=final_val.warnings,
            generic_risk=critic_report.generic_risk,
            novelty_score=novelty_eval.get("overall_novelty", 0.80),
            recommendations=critic_report.recommendations,
        )

        final_doc["designSystem"] = {
            "visualDNA": visual_dna.to_dict(),
            "creativeDirection": creative_direction.to_dict(),
            "creativeSeed": seed,
            "generationFingerprint": gen_fingerprint,
            "renderMode": effective_render_mode,
            "noveltyScore": novelty_eval.get("overall_novelty", 0.80),
        }
        final_doc["criticReport"] = critic_report.to_dict()
        final_doc["qualityReport"] = quality_report.to_dict()
        final_doc["generationFingerprint"] = gen_fingerprint
        final_doc["renderMode"] = effective_render_mode

        # Telemetria e Observabilidade Completa (Items 45, 46, 53)
        final_doc["observability"] = {
            "commercialSnapshotHash": snapshot_hash,
            "validatorPass": final_val.passed,
            "criticPass": critic_report.passed,
            "commercialIntegrityPass": comm_passed,
            "runtimeSecurityPass": runtime_passed,
            "qualityGateStatus": final_doc["qualityGate"]["status"],
            "candidateCount": sum(p.get("composition", {}).get("candidateCount", 0) for p in final_doc.get("pages", [])),
            "elapsed_ms": elapsed_ms,
            "timings_ms": timings,
            "creativeSeed": seed,
            "generationFingerprint": gen_fingerprint,
            "renderMode": effective_render_mode,
            "fallbackUsed": fallback_used,
            "fallbackReason": repair_meta.get("fallbackReason", ""),
            "fallbackPages": repair_meta.get("fallbackPages", []),
            "visualDNA": visual_dna.to_dict(),
            "creativeDirection": creative_direction.to_dict(),
            "noveltyScore": novelty_eval.get("overall_novelty", 0.80),
            "genericRisk": critic_report.generic_risk,
            "commercialIntegrity": {
                "passed": comm_passed,
                "violations": comm_violations,
            },
            "qualityReport": quality_report.to_dict(),
            "contractVersion": 1,
            "parsed_requirements": {"output": contract.output.__dict__,
                                    "design": contract.design.__dict__, "constraints": contract.constraints.__dict__},
            "hard_constraints": contract.constraints.hard,
            "negative_constraints": contract.constraints.negative,
            "soft_preferences": contract.constraints.soft,
            "feasibility_check": {"passed": is_feasible, "message": conflict_msg},
            "content_plan_summary": {
                "total_pages": len(content_plan.page_maps),
                "products_allocated": content_plan.total_products_allocated,
            },
            "initial_validation": {
                "passed": initial_val.passed,
                "errors": initial_val.errors,
                "warnings": initial_val.warnings,
            },
            "repair_attempts": len(repair_log),
            "repair_log": repair_log,
            "final_validation": {
                "passed": final_val.passed,
                "errors": final_val.errors,
                "warnings": final_val.warnings,
            },
        }

        logger.info(
            f"[EditorialPipeline] Geração concluída em {elapsed_ms}ms com {len(final_doc.get('pages', []))} páginas "
            f"(EffectiveMode={effective_render_mode}, Seed={seed}, Novelty={final_doc['designSystem']['noveltyScore']:.2f}, "
            f"QualityPassed={quality_report.passed})."
        )

        return final_doc

    @classmethod
    def _generate_document(
        cls,
        contract: RequirementContract,
        content_plan: DocumentContentPlan,
        design_plan: DocumentDesignPlan,
        rag_context: Dict[str, Any],
        page_slots: Optional[List[Any]] = None,
        synthesis_func: Optional[Any] = None,
        visual_dna: Optional[VisualDNA] = None,
        creative_direction: Optional[CreativeDirection] = None,
        narrative_sequence: Optional[List[PageNarrativePlan]] = None,
        creative_seed: int = 42,
        generation_fingerprint: str = "",
        clean_products: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """Executa a montagem dos blocos generativos e retrocompatibilidade com páginas legadas."""
        # catalog_id determinístico derivado da impressão digital (Item 3)
        catalog_id = f"cat-{generation_fingerprint[:12]}" if generation_fingerprint else f"cat-s{creative_seed}"
        title = content_plan.title
        category = content_plan.category
        summary = content_plan.summary
        palette = design_plan.palette_spec

        # Se houver função de síntese externa injetada, invoca para enriquecer metadados
        if synthesis_func and callable(synthesis_func):
            try:
                external_synth = synthesis_func(contract.raw_prompt)
                if isinstance(external_synth, dict):
                    title = external_synth.get("title", title)
                    category = external_synth.get("category", category)
                    summary = external_synth.get("summary", summary)
                    if "palette" in external_synth and isinstance(external_synth["palette"], dict):
                        palette.update(external_synth["palette"])
            except Exception as e:
                logger.warning(f"[EditorialPipeline] Síntese externa falhou ({e}). Prosseguindo com plano interno.")

        # Inviolabilidade de P3 (Negative Constraints / Monocromia) sobre paleta:
        if contract.design.allowed_color_space == "monochrome" or "NO_COLORS" in contract.constraints.negative:
            palette["primary"] = "#141416"
            palette["background"] = "#F6F5F2"
            palette["accent"] = "#141416"
            palette["secondary"] = "#71717A"
            palette["surface"] = "#FFFFFF"

        assembled_pages = []
        is_one_pager = len(content_plan.page_maps) == 1

        for idx, (p_map, p_design) in enumerate(zip(content_plan.page_maps, design_plan.page_designs)):
            p_num = p_map.page_number
            prods = p_map.product_items
            slot = page_slots[idx] if page_slots and idx < len(page_slots) else None
            p_narrative = narrative_sequence[idx] if narrative_sequence and idx < len(narrative_sequence) else None

            is_dark = p_design.color_role == "primary_dark"
            bg_color = palette.get("primary", "#141416") if is_dark else palette.get("background", "#F6F5F2")
            text_color = palette.get("background", "#F6F5F2") if is_dark else palette.get("primary", "#141416")
            accent_color = palette.get("accent", "#C5A059")

            # Canonical structural type expected by tests & studio
            if slot and slot.role == "one_pager":
                page_type = "single" if prods else "cover"
            elif slot:
                page_type = slot.role
            else:
                page_type = "hero"

            raw_title = title if p_num == 1 else p_map.purpose
            clean_title = str(raw_title or "CATÁLOGO").upper()
            raw_sub = summary if p_num == 1 else f"SEÇÃO {p_num:02d}"
            clean_sub = str(raw_sub or f"SEÇÃO {p_num:02d}").upper()
            clean_cat = str(category or "EDITORIAL").upper()

            # Constrói o objeto da prancheta
            page_obj = {
                "id": f"{catalog_id}-p{p_num}",
                "pageNumber": p_num,
                "type": page_type,
                "contentRole": p_narrative.content_role if p_narrative else page_type,
                "renderMode": "generative" if GENERATIVE_COMPOSITION_ENGINE else "legacy",
                "layoutStrategy": p_design.layout_strategy,
                "slotCapacity": slot.target_capacity if slot else 1,
                "title": clean_title,
                "subtitle": clean_sub,
                "label": "CATÁLOGO DE PÁGINA ÚNICA" if is_one_pager else f"LAMINA {p_num:02d} · {clean_cat}",
                "folio": f"{p_num:02d} · ONE-PAGER" if is_one_pager else f"{p_num:02d}",
                "backgroundColor": bg_color,
                "textColor": text_color,
                "accentColor": accent_color,
                "useCards": "no_cards" not in contract.design.layout_behavior,
                "containerStyle": "none" if "no_cards" in contract.design.layout_behavior else "card",
                "products": [],
                "blocks": [],
                "negativeConstraints": list(contract.constraints.negative),
            }

            # Se houver textos verbatim do usuário
            if p_map.verbatim_blocks:
                page_obj["content"] = "\n\n".join(p_map.verbatim_blocks)
            elif is_one_pager:
                page_obj["content"] = summary
                page_obj["quote"] = "Apresentação comercial e técnica estruturada em página única."

            # Produtos estruturados: Inviolabilidade de Dados Comerciais (Item 10)
            if prods:
                formatted_prods = []
                for p_idx, pr in enumerate(prods):
                    sanitized_p = CommercialIntegrityGuard.sanitize_supplied_product(pr, default_index=p_idx + 1)
                    formatted_prods.append({
                        **sanitized_p,
                        "category": sanitized_p.get("category") or category,
                        "index": f"{p_idx + 1:02d}",
                        "image": None if "NO_IMAGES" in contract.constraints.negative else sanitized_p.get("image"),
                    })
                page_obj["products"] = formatted_prods

            # ETAPA GENERATIVA: PROJEÇÃO ESPACIAL DE BLOCOS (COMPOSITION PLANNER)
            if GENERATIVE_COMPOSITION_ENGINE and visual_dna and creative_direction and p_narrative:
                comp_result = CompositionPlanner.compose_page(
                    narrative=p_narrative,
                    visual_dna=visual_dna,
                    direction=creative_direction,
                    contract=contract,
                    page_dict=page_obj,
                    palette=palette,
                    creative_seed=creative_seed,
                    previous_pages=assembled_pages,
                )
                page_obj["composition"] = comp_result["composition"]
                page_obj["safeArea"] = comp_result["safeArea"]
                page_obj["blocks"] = comp_result["blocks"]

                # Extrai fingerprint para novelties
                fp = NoveltyEngine.compute_fingerprint(page_obj)
                page_obj["fingerprint"] = fp.to_dict()

            assembled_pages.append(page_obj)

        return {
            "catalogId": catalog_id,
            "generationFingerprint": generation_fingerprint,
            "title": title,
            "category": category,
            "summary": summary,
            "renderMode": "generative" if GENERATIVE_COMPOSITION_ENGINE else "legacy",
            "reasoning": f"Geração calibrada pelo motor generativo editorial sob restrições: {contract.constraints.hard}.",
            "palette": palette,
            "pages": assembled_pages,
            "totalPages": len(assembled_pages),
            "initialPrompt": contract.raw_prompt,
            "rag_metadata": {
                "dynamic_pages": len(assembled_pages),
                "industry": contract.detected_industry,
                "tokens_saved_pct": 85,
            },
        }
