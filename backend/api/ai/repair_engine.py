"""
Repair Engine - Motor de Auto-Reparo Estrutural e Mutação Criativa Direcionada.
Executa correções cirúrgicas em caso de falha de validação estrutural (contagem de páginas,
elementos proibidos, safe area) ou falha crítica (clichês, repetição excessiva, cadência monótona).
Garante determinismo via creative_seed, mutações restritas apenas às pranchetas ofensivas
e preservação de estado em generativeDraft ao acionar fallback legacy.
"""
import copy
import logging
from typing import Dict, Any, List, Tuple, Optional
from .requirement_contract import RequirementContract
from .generation_validator import GenerationValidator, ValidationResult
from .visual_critic import VisualCritic, VisualCriticReport
from .composition_mutator import CompositionMutator, fit_block_to_safe_area
from .commercial_guard import CommercialIntegrityGuard
from .novelty_engine import NoveltyEngine

logger = logging.getLogger(__name__)


class RepairEngine:
    """
    Motor de Correção Automática e Mutação Direcionada.
    """
    MAX_REPAIR_ATTEMPTS = 3

    @classmethod
    def repair_document(
        cls,
        contract: RequirementContract,
        document: Dict[str, Any],
        initial_validation: ValidationResult,
        critic_report: Optional[VisualCriticReport] = None,
        creative_seed: int = 42,
    ) -> Tuple[Dict[str, Any], ValidationResult, List[str]]:
        """
        Executa o ciclo de auto-reparo estrutural e mutação criativa até o documento passar
        ou atingir o limite de tentativas. Retorna (repaired_document, final_validation, repair_log).
        """
        repaired_doc = copy.deepcopy(document)
        from .commercial_guard import CommercialIntegrityGuard
        commercial_originals = copy.deepcopy([p for page in document.get('pages', []) for p in page.get('products', [])])
        current_val = initial_validation
        current_critic = critic_report or VisualCritic.critique(repaired_doc, contract)
        repair_log: List[str] = []
        attempt = 0

        # O loop roda se houver falha determinística OU falha estética do crítico (Item 5)
        while (not current_val.passed or not current_critic.passed) and attempt < cls.MAX_REPAIR_ATTEMPTS:
            attempt += 1
            logger.info(
                f"[RepairEngine] Iniciando tentativa {attempt}/{cls.MAX_REPAIR_ATTEMPTS} "
                f"(Val Errors: {len(current_val.errors)}, Critic Passed: {current_critic.passed})..."
            )
            actions_taken = []

            pages = repaired_doc.get("pages", [])
            for page in pages:
                page['negativeConstraints'] = list(contract.constraints.negative)
            req_pages = contract.output.page_count
            mode = contract.output.page_count_mode

            # ================= 1. REPARO ESTRUTURAL (VALIDATOR FAIL) =================
            if not current_val.passed:
                # 1.1 Contagem de Páginas
                if req_pages is not None:
                    if (mode == "exact" and len(pages) != req_pages) or (mode == "maximum" and len(pages) > req_pages):
                        if len(pages) > req_pages:
                            repaired_doc["pages"], pruned_action = cls._prune_excess_pages(pages, req_pages)
                            actions_taken.append(pruned_action)
                        elif mode == "exact" and len(pages) < req_pages:
                            repaired_doc["pages"], expanded_action = cls._expand_pages(pages, req_pages, contract)
                            actions_taken.append(expanded_action)
                        repaired_doc["totalPages"] = len(repaired_doc["pages"])

                # 1.2 Restrições Negativas
                negatives = set(contract.constraints.negative)

                if "NO_CARDS" in negatives or "no_cards" in contract.design.layout_behavior:
                    for p in repaired_doc.get("pages", []):
                        p["useCards"] = False
                        p["containerStyle"] = "none"
                        for b in p.get("blocks", []):
                            if b.get("role") in ["card_container", "boxed_card"]:
                                b["role"] = "content_area"
                    actions_taken.append("Substituição de cards por diagramação contínua.")

                if "NO_GRADIENTS" in negatives or "flat_colors_only" in contract.design.layout_behavior:
                    for p in repaired_doc.get("pages", []):
                        if "gradient" in str(p.get("backgroundColor", "")).lower():
                            p["backgroundColor"] = "#F8F8F7"
                        for b in p.get("blocks", []):
                            if "gradient" in str(b.get("colorToken", "")).lower():
                                b["colorToken"] = "primary"
                    actions_taken.append("Substituição de gradientes por cores sólidas.")

                if "NO_IMAGES" in negatives:
                    for p in repaired_doc.get("pages", []):
                        p["editorialImage"] = None
                        for prod in p.get("products", []):
                            prod["image"] = None
                        # Remove blocos de imagem em pranchetas generativas
                        p["blocks"] = [b for b in p.get("blocks", []) if b.get("type") not in ["image", "product_image"]]
                    actions_taken.append("Supressão total de imagens para modo typography-led.")

                if "NO_DARK_BACKGROUND" in negatives:
                    for p in repaired_doc.get("pages", []):
                        bg = str(p.get("backgroundColor", "")).upper()
                        if bg in ["#000000", "#141416", "#0F172A", "#1A1817", "#291819"]:
                            p["backgroundColor"] = "#F9F9F8"
                            p["textColor"] = "#141416"
                    actions_taken.append("Inversão de fundo escuro para fundo claro editorial.")

                if "FORBIDDEN_COLOR_BLUE" in negatives or "FORBIDDEN_COLOR_GREEN" in negatives or "NO_COLORS" in negatives:
                    neutral_accent = "#141416" if contract.design.allowed_color_space == "monochrome" else "#C5A059"
                    for p in repaired_doc.get("pages", []):
                        p["accentColor"] = neutral_accent
                        for b in p.get("blocks", []):
                            if b.get("colorToken") == "accent" and "NO_COLORS" in negatives:
                                b["colorToken"] = "primary"
                    actions_taken.append("Neutralização de cores proibidas.")

                # 1.3 Reparo Imediato de Safe Area (Item 14 & 38)
                for p in repaired_doc.get("pages", []):
                    safe = p.get("safeArea") or {"top": 0.04, "right": 0.04, "bottom": 0.04, "left": 0.04}
                    for b in p.get("blocks", []):
                        fit_block_to_safe_area(b, safe)

                # 1.4 Placeholders
                cls._clean_placeholders(repaired_doc, contract)

            # ================= 2. MUTAÇÃO DIRECIONADA (CRITIC / NOVELTY FAIL) =================
            # Item 36: Se páginas forem similares ou clichê, mutar EXCLUSIVAMENTE a página ofensiva
            novelty_eval = NoveltyEngine.evaluate_catalog_novelty(
                [p for p in repaired_doc.get("pages", []) if p.get("renderMode") == "generative"]
            )
            offending_pages = novelty_eval.get("offending_pages", [])

            if offending_pages:
                for off_pnum in offending_pages:
                    idx = off_pnum - 1
                    if 0 <= idx < len(repaired_doc.get("pages", [])):
                        target_p = repaired_doc["pages"][idx]
                        if target_p.get("renderMode") == "generative" and target_p.get("blocks"):
                            repaired_doc["pages"][idx], mut_desc = CompositionMutator.mutate(
                                target_p,
                                strength=0.75,
                                creative_seed=creative_seed,
                                attempt=attempt,
                            )
                            actions_taken.append(f"Mutação cirúrgica na pág {off_pnum}: {mut_desc}")
            elif not current_critic.passed:
                # Falha específica de clichê no crítico (ex: capa padronizada ou alinhamento monótono)
                if any("CLICHE_STANDARDIZED_LUXURY_COVER" in c for c in current_critic.cliches_detected):
                    if repaired_doc.get("pages"):
                        repaired_doc["pages"][0], mut_desc = CompositionMutator.mutate(
                            repaired_doc["pages"][0],
                            mutation_type="increase_asymmetry",
                            strength=0.85,
                            creative_seed=creative_seed,
                            attempt=attempt,
                        )
                        actions_taken.append(f"MUTAÇÃO POR CRÍTICA VISUAL: Anti-clichê na Capa: {mut_desc}")
                elif any("EXCESSIVE_CENTER_ALIGNMENT" in c for c in current_critic.cliches_detected):
                    for idx in range(1, len(repaired_doc.get("pages", []))):
                        target_p = repaired_doc["pages"][idx]
                        if target_p.get("blocks"):
                            repaired_doc["pages"][idx], mut_desc = CompositionMutator.mutate(
                                target_p,
                                mutation_type="switch_alignment",
                                strength=0.6,
                                creative_seed=creative_seed,
                                attempt=attempt,
                            )
                            actions_taken.append(f"MUTAÇÃO POR CRÍTICA VISUAL: Alternância de alinhamento na pág {idx+1}: {mut_desc}")
                            break
                else:
                    if repaired_doc.get("pages"):
                        repaired_doc["pages"][0], mut_desc = CompositionMutator.mutate(
                            repaired_doc["pages"][0],
                            strength=0.8,
                            creative_seed=creative_seed,
                            attempt=attempt,
                        )
                        actions_taken.append(f"MUTAÇÃO POR CRÍTICA VISUAL: Reparo de risco genérico: {mut_desc}")

            repair_log.append(f"Tentativa {attempt}: " + ("; ".join(actions_taken) if actions_taken else "Nenhuma ação necessária"))

            # Revalidação profunda de ambos os motores
            current_val = GenerationValidator.validate(contract, repaired_doc)
            integrity, violations = CommercialIntegrityGuard.verify_document_commercial_integrity(
                commercial_originals, repaired_doc.get('pages', []), commercial_originals)
            if not integrity:
                for violation in violations:
                    current_val.add_error(violation)
            current_critic = VisualCritic.critique(repaired_doc, contract)

            if current_val.passed and current_critic.passed:
                logger.info(f"[RepairEngine] Documento aprovado com sucesso na tentativa {attempt}!")
                break

        # ================= 3. FALLBACK SEGURO (LEGACY RENDERER) =================
        fallback_used = False
        fallback_pages = []
        fallback_reason = ""

        if not current_val.passed or not current_critic.passed:
            fallback_used = True
            fallback_reason = "; ".join(current_val.errors + ([] if current_critic.passed else ["VISUAL_CRITIC_FAILED"]))
            logger.warning(
                f"[RepairEngine] Documento permaneceu com erros após {attempt} tentativas. "
                f"Ativando fallback seguro: {fallback_reason}"
            )
            metrics = current_critic.to_dict().get('diagnostics', {}).get('pages', [])
            targeted = {m['pageNumber'] for m in metrics if m.get('contrastRatio', 21) < 4.5 or m.get('legibility', 1) < .5}
            for idx, p in enumerate(repaired_doc.get("pages", [])):
                p_num = idx + 1
                if current_val.passed and targeted and p_num not in targeted:
                    continue
                fallback_pages.append(p_num)
                cls.fallback_page_to_legacy(p, reason=fallback_reason)

            repair_log.append("Fallback seguro: pranchetas convertidas para modo legado compatível.")
            current_val = GenerationValidator.validate(contract, repaired_doc)
            integrity, violations = CommercialIntegrityGuard.verify_document_commercial_integrity(
                commercial_originals, repaired_doc.get('pages', []), commercial_originals)
            if not integrity:
                for violation in violations:
                    current_val.add_error(violation)
            current_critic = VisualCritic.critique(repaired_doc, contract)

        # Atualiza a contagem final e metadados de observabilidade
        repaired_doc["totalPages"] = len(repaired_doc.get("pages", []))
        repaired_doc["repair_metadata"] = {
            "repair_attempts": attempt,
            "repair_log": repair_log,
            "passed": current_val.passed,
            "critic_passed": current_critic.passed,
            "fallbackUsed": fallback_used,
            "fallbackReason": fallback_reason,
            "fallbackPages": fallback_pages,
        }

        return repaired_doc, current_val, repair_log

    @classmethod
    def _prune_excess_pages(cls, pages: List[Dict[str, Any]], target_count: int) -> Tuple[List[Dict[str, Any]], str]:
        """Poda páginas excedentes preservando os produtos em slots remanescentes."""
        if len(pages) <= target_count:
            return pages, "Nenhuma poda necessária."

        if target_count == 1:
            first_page = copy.deepcopy(pages[0])
            all_prods = []
            for p in pages:
                all_prods.extend(p.get("products", []))

            first_page["pageNumber"] = 1
            first_page["type"] = "one_pager" if all_prods else "cover"
            first_page["label"] = "CATÁLOGO DE PÁGINA ÚNICA"
            first_page["folio"] = "01 · ONE-PAGER"
            if all_prods:
                first_page["products"] = all_prods

            return [first_page], f"Condensou {len(pages)} páginas em 1 página única (One-Pager)."

        keep_pages = [pages[0]]
        internal_target = target_count - 2
        middle_candidates = pages[1:-1]
        middle_candidates.sort(key=lambda p: len(p.get("products", [])), reverse=True)
        selected_middle = middle_candidates[:internal_target]

        discarded_middle = middle_candidates[internal_target:]
        orphaned_prods = []
        for dp in discarded_middle:
            orphaned_prods.extend(dp.get("products", []))

        if selected_middle and orphaned_prods:
            selected_middle[0].setdefault("products", []).extend(orphaned_prods)

        keep_pages.extend(selected_middle)
        if len(pages) > 1:
            keep_pages.append(pages[-1])

        for idx, p in enumerate(keep_pages):
            p["pageNumber"] = idx + 1
            p["folio"] = f"{idx + 1:02d}"

        return keep_pages, f"Podou páginas excedentes de {len(pages)} para {target_count} páginas."

    @classmethod
    def _expand_pages(
        cls,
        pages: List[Dict[str, Any]],
        target_count: int,
        contract: RequirementContract,
    ) -> Tuple[List[Dict[str, Any]], str]:
        """Expande páginas até atingir target_count sem fabricar copy fiduciário."""
        expanded = list(pages)
        title_ctx = contract.raw_prompt.split(",")[0] if contract.raw_prompt else "Coleção"
        while len(expanded) < target_count:
            next_num = len(expanded) + 1
            expanded.append({
                "id": f"expanded-p{next_num}",
                "pageNumber": next_num,
                "type": "hero" if next_num % 2 == 1 else "duo",
                "contentRole": "product_reveal",
                "renderMode": "generative",
                "title": f"{title_ctx} · Seção {next_num:02d}".upper(),
                "subtitle": f"PRANCHETA {next_num:02d}",
                "label": "EXPANSÃO EDITORIAL",
                "folio": f"{next_num:02d}",
                "backgroundColor": "#F6F5F2",
                "textColor": "#141416",
                "accentColor": "#C5A059",
                "products": [],
            })

        return expanded, f"Expandiu pranchetas de {len(pages)} para {target_count} páginas."

    @classmethod
    def _clean_placeholders(cls, doc: Dict[str, Any], contract: RequirementContract):
        """Substitui menções a 'Lorem Ipsum' por conteúdo editorial legítimo."""
        title_ctx = doc.get("title", "Coleção Editorial")
        for p in doc.get("pages", []):
            if "lorem" in str(p.get("content", "")).lower():
                p["content"] = f"Apresentação oficial de {title_ctx}. Cada detalhe reflete compromisso com o rigor técnico."
            if "lorem" in str(p.get("quote", "")).lower():
                p["quote"] = "O essencial executado sem concessões e com rigor técnico."
            if "nome do produto aqui" in str(p.get("title", "")).lower():
                p["title"] = f"Destaque de Linha · {title_ctx}"

    @classmethod
    def fallback_page_to_legacy(cls, page: Dict[str, Any], reason: str = "") -> Dict[str, Any]:
        """
        Converte uma prancheta generativa para modo legado seguro,
        preservando todos os blocos originais sob 'generativeDraft' sem deixar estado fantasma.
        """
        if page.get('renderMode') != 'legacy' or page.get('blocks') or 'generativeDraft' not in page:
            page["generativeDraft"] = {
                "blocks": page.pop("blocks", []),
                "composition": page.pop("composition", {}),
                "safeArea": page.pop("safeArea", {}),
            }
        page["renderMode"] = "legacy"
        page["fallbackReason"] = reason
        page["blocks"] = []
        return page

    # Backward compatibility alias
    _fallback_to_safe_editorial = fallback_page_to_legacy
