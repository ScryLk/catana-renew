"""
Generation Validator - Validação Determinística e Semântica de Documentos Gerados.
Executa asserções programáticas rigorosas sobre contagem de páginas, restrições negativas,
preservação de dados, ausência de placeholders inválidos e integridade visual.
"""
import re
import logging
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
from .requirement_contract import RequirementContract

logger = logging.getLogger(__name__)


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
        self.errors.append(message)

    def add_warning(self, message: str):
        self.warnings.append(message)


class GenerationValidator:
    """
    Motor de Validação de Documentos Gerados.
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

        pages = document.get("pages", [])
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

        # 2. VALIDAÇÃO DE RESTRIÇÕES NEGATIVAS (P3 - Negative Constraints)
        negatives = set(contract.constraints.negative)

        # 2.1 Proibição de Cards
        if "NO_CARDS" in negatives:
            for idx, p in enumerate(pages):
                if p.get("useCards") is True or p.get("containerStyle") == "card":
                    res.add_error(f"FORBIDDEN_ELEMENT: Página {idx + 1} contém 'cards', expressamente proibidos pelo usuário.")

        # 2.2 Proibição de Gradientes
        if "NO_GRADIENTS" in negatives:
            for idx, p in enumerate(pages):
                bg = str(p.get("backgroundColor", "")).lower()
                if "gradient" in bg:
                    res.add_error(f"FORBIDDEN_ELEMENT: Página {idx + 1} utiliza gradiente no fundo, expressamente proibido.")

        # 2.3 Proibição de Imagens
        if "NO_IMAGES" in negatives:
            for idx, p in enumerate(pages):
                if p.get("editorialImage"):
                    res.add_error(f"FORBIDDEN_ELEMENT: Página {idx + 1} contém imagem editorial quando fotos foram proibidas.")
                for prod in p.get("products", []):
                    if prod.get("image") and not prod.get("image").startswith("none"):
                        res.add_error(f"FORBIDDEN_ELEMENT: Produto '{prod.get('name')}' contém imagem quando fotos foram proibidas.")

        # 2.4 Proibição de Fundo Escuro
        if "NO_DARK_BACKGROUND" in negatives:
            for idx, p in enumerate(pages):
                bg = str(p.get("backgroundColor", "")).upper()
                if bg in ["#000000", "#141416", "#0F172A", "#1A1817", "#291819"]:
                    res.add_error(f"FORBIDDEN_ELEMENT: Página {idx + 1} possui fundo escuro ({bg}), proibido no briefing.")

        # 2.5 Proibição de Cores Específicas
        if "FORBIDDEN_COLOR_BLUE" in negatives:
            for idx, p in enumerate(pages):
                bg = str(p.get("backgroundColor", "")).lower()
                accent = str(p.get("accentColor", "")).lower()
                if any(b in bg or b in accent for b in ["#0284c7", "#0000ff", "#1e40af", "#3b82f6", "blue", "azul"]):
                    res.add_error(f"FORBIDDEN_COLOR: Página {idx + 1} utiliza tons de azul, proibidos pelo usuário.")

        if "FORBIDDEN_COLOR_GREEN" in negatives:
            for idx, p in enumerate(pages):
                accent = str(p.get("accentColor", "")).lower()
                if any(g in accent for g in ["#10b981", "#15803d", "#22c55e", "green", "verde"]):
                    res.add_error(f"FORBIDDEN_COLOR: Página {idx + 1} utiliza tons de verde, proibidos pelo usuário.")

        if "NO_COLORS" in negatives or contract.design.allowed_color_space == "monochrome":
            for idx, p in enumerate(pages):
                accent = str(p.get("accentColor", "")).upper()
                is_mono = (
                    (len(accent) == 7 and accent.startswith('#') and accent[1:3] == accent[3:5] == accent[5:7]) or
                    accent in ["#000000", "#141416", "#FFFFFF", "#F5F5F5", "#71717A", "#F6F5F2"]
                )
                if not is_mono:
                    res.add_error(f"FORBIDDEN_COLOR: Página {idx + 1} utiliza cor não-monocromática ({accent}) quando cores foram proibidas.")

        # 3. VALIDAÇÃO DE CONTEÚDO OBRIGATÓRIO (P2 - Mandatory Content)
        doc_text_corpus = ""
        for p in pages:
            doc_text_corpus += " " + str(p.get("title", "")) + " " + str(p.get("subtitle", "")) + " " + str(p.get("content", ""))
            for prod in p.get("products", []):
                doc_text_corpus += " " + str(prod.get("name", "")) + " " + str(prod.get("sku", "")) + " " + str(prod.get("price", ""))

        for req_item in contract.content.required:
            if req_item.lower() not in doc_text_corpus.lower():
                res.add_warning(f"MISSING_REQUIRED_CONTENT: O item '{req_item}' não foi localizado no documento gerado.")

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

        if res.errors:
            res.deterministic_passed = False
            res.passed = False

        res.details = {
            "actual_pages": actual_page_count,
            "expected_pages": req_pages,
            "mode": mode,
            "negatives_checked": list(negatives),
        }

        return res
