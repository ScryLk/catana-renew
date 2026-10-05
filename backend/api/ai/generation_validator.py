"""
Generation Validator - Validação Determinística, Semântica e Geométrica de Documentos Gerados.
Executa asserções programáticas rigorosas sobre contagem de páginas, restrições negativas completas,
safe area, integridade de colisões, dados comerciais e ausência de placeholders inválidos.
"""
import re
import logging
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
from .requirement_contract import RequirementContract
from .design_grammar import validate_runtime_block
from .constraint_engine import ConstraintEngine

logger = logging.getLogger(__name__)

SAFE_AREA_EXEMPT_ROLES = {
    "folio",
    "crop_mark",
    "registration_mark",
    "background",
    "bleed_image",
    "color_field",
}


@dataclass
class ValidationResult:
    """Resultado formal do processo de validação."""
    passed: bool = True
    deterministic_passed: bool = True
    semantic_passed: bool = True
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    details: Dict[str, Any] = field(default_factory=dict)

    def add_error(self, message: str):
        self.passed = False
        self.deterministic_passed = False
        self.errors.append(message)

    def add_warning(self, message: str):
        self.warnings.append(message)


class GenerationValidator:
    """
    Motor de Validação de Documentos Gerados com Auditoria Geométrica e Semântica Rigorosa.
    """

    INVALID_PLACEHOLDER_PATTERNS = [
        r'\blorem\s+ipsum\b',
        r'\bdolor\s+sit\s+amet\b',
        r'\bnome\s+do\s+produto\s+aqui\b',
        r'\bpre[cç]o\s+aqui\b',
        r'\bsku\s+aqui\b',
        r'\bdescri[cç][aã]o\s+do\s+produto\s+aqui\b',
    ]

    @classmethod
    def validate(
        cls,
        contract: RequirementContract,
        document: Dict[str, Any],
    ) -> ValidationResult:
        """Executa a bateria completa de validações determinísticas e semânticas."""
        res = ValidationResult()
        for error in ConstraintEngine.validate_brand_expression(contract, document):
            res.add_error(error)

        pages = []
        for raw_page in document.get("pages", []):
            if not isinstance(raw_page, dict):
                res.add_error('INVALID_RUNTIME_PAGE')
                continue
            page = dict(raw_page)
            page['blocks'] = []
            for raw in raw_page.get('blocks', []):
                valid, errors = validate_runtime_block(raw)
                if not valid:
                    for error in errors:
                        res.add_error(f"INVALID_RUNTIME_BLOCK: pageNumber={raw_page.get('pageNumber')} blockId={raw.get('id') if isinstance(raw, dict) else None} reason={error}")
                else:
                    page['blocks'].append(raw)
            pages.append(page)
        actual_page_count = len(pages)

        # 1. VALIDAÇÃO DE CONTAGEM DE PÁGINAS (P1 - Hard Constraint)
        req_pages = contract.output.page_count
        mode = contract.output.page_count_mode

        if req_pages is not None:
            if mode == "exact" and actual_page_count != req_pages:
                res.add_error(
                    f"PAGE_COUNT_MISMATCH: Esperado exatamente {req_pages} página(s), "
                    f"mas foram geradas {actual_page_count}."
                )
            elif mode == "maximum" and actual_page_count > req_pages:
                res.add_error(
                    f"PAGE_COUNT_EXCEEDED: Limite máximo é de {req_pages} página(s), "
                    f"mas foram geradas {actual_page_count}."
                )
            elif mode == "minimum" and actual_page_count < req_pages:
                res.add_error(
                    f"PAGE_COUNT_DEFICIT: Mínimo exigido é de {req_pages} página(s), "
                    f"mas foram geradas {actual_page_count}."
                )

        # 2. VALIDAÇÃO DE RESTRIÇÕES NEGATIVAS PROFUNDAS (P3 - Negative Constraints em Páginas e Blocos)
        negatives = set(contract.constraints.negative)

        for idx, p in enumerate(pages):
            p_num = idx + 1
            blocks = p.get("blocks", [])
            valid_blocks = []
            for block in blocks:
                valid, reasons = validate_runtime_block(block)
                if not valid:
                    for reason in reasons:
                        res.add_error(f"INVALID_RUNTIME_BLOCK: pageNumber={p_num} blockId={block.get('id') if isinstance(block, dict) else None} reason={reason}")
                else:
                    valid_blocks.append(block)
            blocks = valid_blocks
            if "NO_DIAGONALS" in negatives:
                if "diagonal" in str((p.get("composition") or {}).get("axis", "")).lower():
                    res.add_error(f"FORBIDDEN_COMPOSITION_AXIS: NO_DIAGONALS pageNumber={p_num}")
                if any(float(b.get("rotation", 0)) % 90 != 0 for b in blocks):
                    res.add_error(f"FORBIDDEN_COMPOSITION_AXIS: NO_DIAGONALS rotation pageNumber={p_num}")

            # 2.1 Proibição de Cards
            if "NO_CARDS" in negatives or "no_cards" in contract.design.layout_behavior:
                if p.get("useCards") is True or p.get("containerStyle") == "card":
                    res.add_error(f"FORBIDDEN_ELEMENT: Página {p_num} contém 'cards', expressamente proibidos pelo usuário.")
                for b in blocks:
                    if b.get("role") in ["card_container", "boxed_card"] or b.get("container") == "card":
                        res.add_error(f"FORBIDDEN_ELEMENT: Bloco '{b.get('id')}' na pág {p_num} utiliza estrutura de card proibida.")

            # 2.2 Proibição de Gradientes
            if "NO_GRADIENTS" in negatives or "flat_colors_only" in contract.design.layout_behavior:
                bg = str(p.get("backgroundColor", "")).lower()
                if "gradient" in bg:
                    res.add_error(f"FORBIDDEN_ELEMENT: Página {p_num} utiliza gradiente no fundo, expressamente proibido.")
                for b in blocks:
                    b_color = str(b.get("colorToken", "")).lower()
                    if "gradient" in b_color or (b.get("type") == "color_field" and "gradient" in str(b.get("content", "")).lower()):
                        res.add_error(f"FORBIDDEN_ELEMENT: Bloco '{b.get('id')}' na pág {p_num} contém gradiente proibido.")

            # 2.3 Proibição de Imagens (Audita atributos de página, produtos e todos os blocos)
            if "NO_IMAGES" in negatives:
                if p.get("editorialImage"):
                    res.add_error(f"NEGATIVE_CONSTRAINT_VIOLATION: NO_IMAGES: Página {p_num} contém imagem editorial quando fotos foram proibidas.")
                for prod in p.get("products", []):
                    if prod.get("image") and not str(prod.get("image")).startswith("none"):
                        res.add_error(f"NEGATIVE_CONSTRAINT_VIOLATION: NO_IMAGES: Produto '{prod.get('name')}' contém imagem quando fotos foram proibidas.")
                for b in blocks:
                    if b.get("type") in ["image", "product_image"] or b.get("imageUrl"):
                        res.add_error(f"NEGATIVE_CONSTRAINT_VIOLATION: NO_IMAGES: Bloco '{b.get('id')}' ({b.get('type')}) contém imagem proibida pelo briefing.")

            # 2.4 Proibição de Fundo Escuro
            if "NO_DARK_BACKGROUND" in negatives:
                bg = str(p.get("backgroundColor", "")).upper()
                if bg in ["#000000", "#141416", "#0F172A", "#1A1817", "#291819"]:
                    res.add_error(f"FORBIDDEN_ELEMENT: Página {p_num} possui fundo escuro ({bg}), proibido no briefing.")

            # 2.5 Proibição de Cores Específicas e Validação de Monocromia em Blocos
            if "FORBIDDEN_COLOR_BLUE" in negatives:
                bg = str(p.get("backgroundColor", "")).lower()
                accent = str(p.get("accentColor", "")).lower()
                if any(b in bg or b in accent for b in ["#0284c7", "#0000ff", "#1e40af", "#3b82f6", "blue", "azul"]):
                    res.add_error(f"FORBIDDEN_COLOR: Página {p_num} utiliza tons de azul, proibidos pelo usuário.")

            if "FORBIDDEN_COLOR_GREEN" in negatives:
                accent = str(p.get("accentColor", "")).lower()
                if any(g in accent for g in ["#10b981", "#15803d", "#22c55e", "green", "verde"]):
                    res.add_error(f"FORBIDDEN_COLOR: Página {p_num} utiliza tons de verde, proibidos pelo usuário.")

            if "NO_COLORS" in negatives or contract.design.allowed_color_space == "monochrome":
                accent = str(p.get("accentColor", "")).upper()
                is_mono = (
                    (len(accent) == 7 and accent.startswith('#') and accent[1:3] == accent[3:5] == accent[5:7]) or
                    accent in ["#000000", "#141416", "#FFFFFF", "#F5F5F5", "#71717A", "#F6F5F2"]
                )
                if not is_mono:
                    res.add_error(f"FORBIDDEN_COLOR: Página {p_num} utiliza cor não-monocromática ({accent}) quando cores foram proibidas.")
                for b in blocks:
                    tok = str(b.get("colorToken", "")).upper()
                    if tok.startswith("#") and len(tok) == 7 and not (tok[1:3] == tok[3:5] == tok[5:7]):
                        res.add_error(f"FORBIDDEN_COLOR: Bloco '{b.get('id')}' na pág {p_num} possui cor cromática direta '{tok}' em modo monocromático.")

        # 3. VALIDAÇÃO DE CONTEÚDO OBRIGATÓRIO (P2 - Distinção entre Hard e Soft)
        doc_text_corpus = ""
        for p in pages:
            doc_text_corpus += " " + str(p.get("title", "")) + " " + str(p.get("subtitle", "")) + " " + str(p.get("content", ""))
            for prod in p.get("products", []):
                doc_text_corpus += " " + str(prod.get("name", "")) + " " + str(prod.get("sku", "")) + " " + str(prod.get("price", ""))
            for b in p.get("blocks", []):
                doc_text_corpus += " " + str(b.get("content", ""))

        # Hard requirements: se declarados explicitamente como obrigatórios inegociáveis
        hard_reqs = getattr(contract.content, "required_hard", []) or []
        for req_item in hard_reqs:
            if req_item.lower() not in doc_text_corpus.lower():
                res.add_error(f"MISSING_MANDATORY_CONTENT: O conteúdo obrigatório '{req_item}' não foi localizado no documento gerado.")

        # Soft / Recommended requirements
        soft_reqs = getattr(contract.content, "required_soft", []) or contract.content.required
        for req_item in soft_reqs:
            if req_item not in hard_reqs and req_item.lower() not in doc_text_corpus.lower():
                res.add_warning(f"MISSING_RECOMMENDED_CONTENT: O item recomendado '{req_item}' não foi localizado no documento gerado.")

        # 4. VALIDAÇÃO DE TEXTO VERBATIM (P2)
        for v_text in contract.content.preserve_verbatim:
            if v_text != "USER_PROMPT_CONTENT_VERBATIM" and v_text.lower() not in doc_text_corpus.lower():
                res.add_error(f"VERBATIM_VIOLATION: O texto do usuário '{v_text[:40]}...' não foi preservado fielmente.")

        # 5. VALIDAÇÃO DE PLACEHOLDERS INVÁLIDOS (LOREM IPSUM)
        for pattern in cls.INVALID_PLACEHOLDER_PATTERNS:
            if re.search(pattern, doc_text_corpus, re.IGNORECASE):
                res.add_error(f"INVALID_PLACEHOLDER: Detectado texto de preenchimento ou rascunho inválido ({pattern}).")
                break

        # 6. VALIDAÇÃO DE PÁGINAS DUPLICADAS
        if len(pages) > 1:
            for i in range(len(pages) - 1):
                p1_str = f"{pages[i].get('title')}-{pages[i].get('content')}"
                p2_str = f"{pages[i+1].get('title')}-{pages[i+1].get('content')}"
                if p1_str == p2_str and len(p1_str.strip()) > 10:
                    res.add_warning(f"DUPLICATE_PAGES: Páginas {i+1} e {i+2} são idênticas.")

        # 7. VALIDAÇÃO GEOMÉTRICA DE BLOCOS GENERATIVOS: SAFE AREA, BOUNDS & COLLISIONS
        for idx, p in enumerate(pages):
            p_num = idx + 1
            blocks = p.get("blocks", [])
            valid_blocks = []
            for block in blocks:
                valid, reasons = validate_runtime_block(block)
                if not valid:
                    for reason in reasons:
                        res.add_error(f"INVALID_RUNTIME_BLOCK: pageNumber={p_num} blockId={block.get('id') if isinstance(block, dict) else None} reason={reason}")
                else:
                    valid_blocks.append(block)
            blocks = valid_blocks
            if "NO_DIAGONALS" in negatives:
                if "diagonal" in str((p.get("composition") or {}).get("axis", "")).lower():
                    res.add_error(f"FORBIDDEN_COMPOSITION_AXIS: NO_DIAGONALS pageNumber={p_num}")
                if any(float(b.get("rotation", 0)) % 90 != 0 for b in blocks):
                    res.add_error(f"FORBIDDEN_COMPOSITION_AXIS: NO_DIAGONALS rotation pageNumber={p_num}")
            if not blocks:
                continue

            safe_area = p.get("safeArea") or {"top": 0.04, "right": 0.04, "bottom": 0.04, "left": 0.04}
            safe_top = float(safe_area.get("top", 0.04))
            safe_right = float(safe_area.get("right", 0.04))
            safe_bottom = float(safe_area.get("bottom", 0.04))
            safe_left = float(safe_area.get("left", 0.04))

            # 7.1 Limites Físicos e Safe Area
            for b in blocks:
                bid = b.get("id", "block")
                brole = b.get("role", "element")
                bx = float(b.get("x", 0.0))
                by = float(b.get("y", 0.0))
                bw = float(b.get("width", 0.0))
                bh = float(b.get("height", 0.0))
                is_bleed = b.get("bleed", False)

                if bw <= 0.0 or bh <= 0.0:
                    res.add_error(f"INVALID_BLOCK_DIMENSIONS: Bloco '{bid}' na pág {p_num} possui largura/altura <= 0.")

                # Se não for bleed, não pode vazar a prancheta
                if not is_bleed:
                    if bx < -0.01 or by < -0.01:
                        res.add_error(f"VALID_BLOCK_BOUNDS: Bloco '{bid}' na pág {p_num} possui coordenada negativa (x={bx}, y={by}).")
                    if (bx + bw) > 1.02 or (by + bh) > 1.02:
                        res.add_error(f"VALID_BLOCK_BOUNDS: Bloco '{bid}' na pág {p_num} ultrapassa borda da prancheta (x+w={bx+bw:.2f}, y+h={by+bh:.2f}).")

                    # Safe Area Audit para blocos não-isentos
                    if brole not in SAFE_AREA_EXEMPT_ROLES and b.get("marginExempt") is not True:
                        if (
                            bx < (safe_left - 0.005) or
                            by < (safe_top - 0.005) or
                            (bx + bw) > (1.0 - safe_right + 0.005) or
                            (by + bh) > (1.0 - safe_bottom + 0.005)
                        ):
                            res.add_error(
                                f"SAFE_AREA_VIOLATION: Bloco '{bid}' (role '{brole}') na pág {p_num} viola safe area "
                                f"(bounds=[{bx:.2f}, {by:.2f}, {bx+bw:.2f}, {by+bh:.2f}], safe=[{safe_left}, {safe_top}, {1-safe_right}, {1-safe_bottom}])."
                            )

            # 7.2 Colisões e Sobreposições Rigorosas
            non_overlap_blocks = [b for b in blocks if not b.get("allowOverlap", False)]
            for i in range(len(non_overlap_blocks)):
                for j in range(i + 1, len(non_overlap_blocks)):
                    b1 = non_overlap_blocks[i]
                    b2 = non_overlap_blocks[j]
                    
                    # Interseção de bounding boxes
                    ix1 = max(float(b1.get("x", 0)), float(b2.get("x", 0)))
                    iy1 = max(float(b1.get("y", 0)), float(b2.get("y", 0)))
                    ix2 = min(float(b1.get("x", 0)) + float(b1.get("width", 0)), float(b2.get("x", 0)) + float(b2.get("width", 0)))
                    iy2 = min(float(b1.get("y", 0)) + float(b1.get("height", 0)), float(b2.get("y", 0)) + float(b2.get("height", 0)))

                    if ix2 > ix1 and iy2 > iy1:
                        overlap_area = (ix2 - ix1) * (iy2 - iy1)
                        area1 = float(b1.get("width", 1)) * float(b1.get("height", 1))
                        area2 = float(b2.get("width", 1)) * float(b2.get("height", 1))
                        min_area = min(area1, area2)
                        overlap_ratio = overlap_area / (min_area or 1e-5)

                        # Headline cobrindo preço ou SKU é erro grave imediato
                        roles = {b1.get("role"), b2.get("role")}
                        types = {b1.get("type"), b2.get("type")}
                        if ("headline" in roles or "headline" in types) and (types & {"price", "sku"} or roles & {"price_tag", "sku_tag"}):
                            res.add_error(f"HEADLINE_COMMERCIAL_COLLISION: Título colide com dados comerciais ({b1.get('id')} e {b2.get('id')}) na pág {p_num}.")

                        # > 30% entre blocos de texto é erro
                        is_both_text = (b1.get("type") in ["text", "price", "metadata", "quote"] and
                                        b2.get("type") in ["text", "price", "metadata", "quote"])
                        if is_both_text and overlap_ratio > 0.30:
                            res.add_error(
                                f"SEVERE_TEXT_COLLISION: Colisão severa ({overlap_ratio*100:.1f}%) entre textos '{b1.get('id')}' e '{b2.get('id')}' na pág {p_num}."
                            )
                        elif overlap_ratio >= 0.10:
                            res.add_warning(
                                f"ACCIDENTAL_COLLISION: Sobreposição moderada ({overlap_ratio*100:.1f}%) entre '{b1.get('id')}' e '{b2.get('id')}' na pág {p_num}."
                            )

        # 8. VALIDAÇÃO DE NOVIDADE E CADÊNCIA (Apenas em páginas generativas)
        generative_pages = [p for p in pages if p.get("renderMode") == "generative" and p.get("blocks")]
        if len(generative_pages) >= 2:
            from .novelty_engine import NoveltyEngine
            novelty_eval = NoveltyEngine.evaluate_catalog_novelty(generative_pages)
            for issue in novelty_eval.get("issues", []):
                # Repetição crítica dispara erro para acionar mutation cirúrgica
                res.add_error(issue)

        if res.errors:
            res.deterministic_passed = False
            res.passed = False

        res.details = {
            "actual_pages": actual_page_count,
            "expected_pages": req_pages,
            "mode": mode,
            "negatives_checked": sorted(negatives),
        }

        return res
