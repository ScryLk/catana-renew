"""
Repair Engine - Motor de Auto-Reparo Estrutural e Semântico.
Recebe o documento com falhas de validação e executa correções cirúrgicas
(poda de páginas excedentes, remoção de elementos proibidos, substituição de cores,
eliminação de placeholders) em um loop seguro de até 3 tentativas.
"""
import copy
import logging
from typing import Dict, Any, List, Tuple
from .requirement_contract import RequirementContract
from .generation_validator import GenerationValidator, ValidationResult

logger = logging.getLogger(__name__)


class RepairEngine:
    """
    Motor de Correção Automática pós-validação.
    """
    MAX_REPAIR_ATTEMPTS = 3

    @classmethod
    def repair_document(
        cls,
        contract: RequirementContract,
        document: Dict[str, Any],
        initial_validation: ValidationResult,
    ) -> Tuple[Dict[str, Any], ValidationResult, List[str]]:
        """
        Executa o ciclo de auto-reparo até o documento passar ou atingir o limite de tentativas.
        Retorna (repaired_document, final_validation, repair_log).
        """
        repaired_doc = copy.deepcopy(document)
        current_val = initial_validation
        repair_log: List[str] = []
        attempt = 0

        while not current_val.passed and attempt < cls.MAX_REPAIR_ATTEMPTS:
            attempt += 1
            logger.info(f"[RepairEngine] Iniciando tentativa de reparo {attempt}/{cls.MAX_REPAIR_ATTEMPTS}...")
            actions_taken = []

            pages = repaired_doc.get("pages", [])
            req_pages = contract.output.page_count
            mode = contract.output.page_count_mode

            # 1. Reparo de Contagem de Páginas
            if req_pages is not None:
                if (mode == "exact" and len(pages) != req_pages) or (mode == "maximum" and len(pages) > req_pages):
                    if len(pages) > req_pages:
                        # Poda de páginas excedentes preservando produtos
                        repaired_doc["pages"], pruned_action = cls._prune_excess_pages(pages, req_pages)
                        actions_taken.append(pruned_action)
                    elif mode == "exact" and len(pages) < req_pages:
                        # Adição de pranchetas necessárias
                        repaired_doc["pages"], expanded_action = cls._expand_pages(pages, req_pages, contract)
                        actions_taken.append(expanded_action)

                    repaired_doc["totalPages"] = len(repaired_doc["pages"])

            # 2. Reparo de Restrições Negativas
            negatives = set(contract.constraints.negative)

            # 2.1 Remoção de Cards
            if "NO_CARDS" in negatives or "no_cards" in contract.design.layout_behavior:
                for p in repaired_doc.get("pages", []):
                    p["useCards"] = False
                    p["containerStyle"] = "none"
                    p["dividerStyle"] = "hairline_rule"
                actions_taken.append("Substituição de cards por diagramação contínua e réguas finas.")

            # 2.2 Remoção de Gradientes
            if "NO_GRADIENTS" in negatives or "flat_colors_only" in contract.design.layout_behavior:
                for p in repaired_doc.get("pages", []):
                    if "gradient" in str(p.get("backgroundColor", "")).lower():
                        p["backgroundColor"] = "#F8F8F7"
                actions_taken.append("Substituição de gradientes por cores planas sóbrias.")

            # 2.3 Remoção de Imagens
            if "NO_IMAGES" in negatives:
                for p in repaired_doc.get("pages", []):
                    p["editorialImage"] = None
                    for prod in p.get("products", []):
                        prod["image"] = None
                actions_taken.append("Supressão de imagens para ativação do modo typography-led.")

            # 2.4 Remoção de Fundo Escuro
            if "NO_DARK_BACKGROUND" in negatives:
                for p in repaired_doc.get("pages", []):
                    bg = str(p.get("backgroundColor", "")).upper()
                    if bg in ["#000000", "#141416", "#0F172A", "#1A1817", "#291819"]:
                        p["backgroundColor"] = "#F9F9F8"
                        p["textColor"] = "#141416"
                actions_taken.append("Inversão de fundo escuro para fundo claro editorial.")

            # 2.5 Neutralização de Cores Proibidas
            if "FORBIDDEN_COLOR_BLUE" in negatives or "FORBIDDEN_COLOR_GREEN" in negatives or "NO_COLORS" in negatives:
                neutral_accent = "#141416" if contract.design.allowed_color_space == "monochrome" else "#C5A059"
                for p in repaired_doc.get("pages", []):
                    p["accentColor"] = neutral_accent
                actions_taken.append("Substituição de cores proibidas por tokens neutros aprovados.")

            # 2.6 Reparo de Limites Geométricos de Blocos (VALID_BLOCK_BOUNDS)
            for p in repaired_doc.get("pages", []):
                for b in p.get("blocks", []):
                    if not b.get("bleed", False):
                        b["x"] = round(max(0.02, min(0.90, float(b.get("x", 0.0)))), 3)
                        b["y"] = round(max(0.02, min(0.90, float(b.get("y", 0.0)))), 3)
                        b["width"] = round(max(0.05, min(1.0 - float(b["x"]), float(b.get("width", 0.5)))), 3)
                        b["height"] = round(max(0.02, min(1.0 - float(b["y"]), float(b.get("height", 0.2)))), 3)

            # 2.7 Reparo de Repetição e Similaridade Crítica (COMPOSITION_TOO_SIMILAR)
            has_similarity_issue = any("COMPOSITION_TOO_SIMILAR" in err for err in current_val.errors)
            if has_similarity_issue:
                from .composition_mutator import CompositionMutator
                for idx in range(1, len(repaired_doc.get("pages", []))):
                    target_p = repaired_doc["pages"][idx]
                    if target_p.get("renderMode") == "generative" or target_p.get("blocks"):
                        repaired_doc["pages"][idx], mut_desc = CompositionMutator.mutate(
                            target_p,
                            strength=0.6,
                            creative_seed=42 + idx * 7,
                        )
                        actions_taken.append(f"Mutação na pág {idx+1}: {mut_desc}")

            # 3. Reparo de Placeholders Inválidos
            cls._clean_placeholders(repaired_doc, contract)

            repair_log.append(f"Tentativa {attempt}: " + "; ".join(actions_taken))

            # Revalidação
            current_val = GenerationValidator.validate(contract, repaired_doc)
            if current_val.passed:
                logger.info(f"[RepairEngine] Documento corrigido com sucesso na tentativa {attempt}!")
                break

        # Se após MAX_REPAIR_ATTEMPTS ainda falhar, aciona Fallback Seguro para Legacy Renderer
        if not current_val.passed:
            logger.warning(
                f"[RepairEngine] Documento permaneceu com avisos após {attempt} tentativas. Ativando fallback legacy: {current_val.errors}"
            )
            for p in repaired_doc.get("pages", []):
                p["renderMode"] = "legacy"
            repair_log.append("Fallback seguro: páginas convertidas para modo legado compatível.")
            current_val = GenerationValidator.validate(contract, repaired_doc)

        # Atualiza a contagem final
        repaired_doc["totalPages"] = len(repaired_doc.get("pages", []))
        repaired_doc["repair_metadata"] = {
            "repair_attempts": attempt,
            "repair_log": repair_log,
            "passed": current_val.passed,
        }

        return repaired_doc, current_val, repair_log

    @classmethod
    def _prune_excess_pages(cls, pages: List[Dict[str, Any]], target_count: int) -> Tuple[List[Dict[str, Any]], str]:
        """Poda páginas excedentes preservando os produtos em slots remanescentes."""
        if len(pages) <= target_count:
            return pages, "Nenhuma poda necessária."

        # Se target_count for 1, condensa tudo na primeira prancheta
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

        # Para N > 1, preserva Capa (primeira) e Contracapa (última), e poda divisores ou páginas vazias
        keep_pages = [pages[0]]
        internal_target = target_count - 2
        middle_candidates = pages[1:-1]

        # Prioriza páginas que contêm produtos
        middle_candidates.sort(key=lambda p: len(p.get("products", [])), reverse=True)
        selected_middle = middle_candidates[:internal_target]

        # Reúne produtos órfãos das páginas descartadas
        discarded_middle = middle_candidates[internal_target:]
        orphaned_prods = []
        for dp in discarded_middle:
            orphaned_prods.extend(dp.get("products", []))

        # Adiciona produtos órfãos nas páginas mantidas
        if selected_middle and orphaned_prods:
            selected_middle[0].setdefault("products", []).extend(orphaned_prods)

        keep_pages.extend(selected_middle)
        if len(pages) > 1:
            keep_pages.append(pages[-1])

        # Re-indexa a numeração
        for idx, p in enumerate(keep_pages):
            p["pageNumber"] = idx + 1
            p["folio"] = f"{idx + 1:02d}"

        return keep_pages, f"Podou páginas intermediárias excedentes de {len(pages)} para {target_count} páginas."

    @classmethod
    def _expand_pages(
        cls,
        pages: List[Dict[str, Any]],
        target_count: int,
        contract: RequirementContract,
    ) -> Tuple[List[Dict[str, Any]], str]:
        """Expande páginas até atingir target_count."""
        expanded = list(pages)
        while len(expanded) < target_count:
            next_num = len(expanded) + 1
            expanded.append({
                "id": f"expanded-p{next_num}",
                "pageNumber": next_num,
                "type": "hero" if next_num % 2 == 1 else "duo",
                "title": f"Destaque Editorial · Seção {next_num:02d}",
                "subtitle": "Apresentação e diferenciais",
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
        """Substitui menções a 'Lorem Ipsum' e textos clichês por conteúdo editorial coerente."""
        title_ctx = doc.get("title", "Coleção Editorial")
        for p in doc.get("pages", []):
            if "lorem" in str(p.get("content", "")).lower():
                p["content"] = f"Apresentação oficial de {title_ctx}. Cada peça reflete o compromisso com o rigor técnico e a estética funcional."
            if "lorem" in str(p.get("quote", "")).lower():
                p["quote"] = "O essencial executado sem concessões e com rigor técnico."
            if "nome do produto aqui" in str(p.get("title", "")).lower():
                p["title"] = f"Destaque de Linha · {title_ctx}"
