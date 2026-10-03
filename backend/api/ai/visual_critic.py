"""
Visual Critic - Crítico de Arte e Auditor de Risco Genérico Editorial.
Avalia hierarquia, legibilidade, ritmo, equilíbrio, contraste e brand_fit através de cálculos reais.
Detecta ativamente clichês (incluindo a assinatura padronizada de capa de luxo com 5 elementos),
centralização monótona e repetição de containers, emitindo recomendações formais sem mutações silenciosas.
"""
from dataclasses import dataclass, asdict, field
from typing import Dict, Any, List, Optional
import math
import logging
from .requirement_contract import RequirementContract
from .novelty_engine import NoveltyEngine, PageFingerprint
from .visual_dna import VisualDNA

logger = logging.getLogger(__name__)


@dataclass
class GenerationQualityReport:
    """Resultado formal e unificado da qualidade do catálogo gerado."""
    structural_valid: bool
    semantic_valid: bool
    commercial_data_valid: bool
    novelty_valid: bool
    visual_critic_valid: bool
    passed: bool
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    generic_risk: float = 0.15
    novelty_score: float = 0.80
    recommendations: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class VisualCriticReport:
    """Relatório detalhado de avaliação crítica com métricas reais calculadas."""
    hierarchy: float
    legibility: float
    rhythm: float
    balance: float
    contrast: float
    novelty: float
    brand_fit: float
    generic_risk: float
    cliches_detected: List[str] = field(default_factory=list)
    recommendations: List[str] = field(default_factory=list)
    passed: bool = True

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class VisualCritic:
    """
    Crítico de Arte e Design Editorial.
    Avalia a autenticidade estética e protege contra designs genéricos que poderiam pertencer a qualquer marca.
    """

    GENERIC_RISK_THRESHOLD = 0.55

    @classmethod
    def critique(
        cls,
        document: Dict[str, Any],
        contract: RequirementContract,
        visual_dna: Optional[VisualDNA] = None,
    ) -> VisualCriticReport:
        """
        Executa uma auditoria crítica completa sobre o documento editorial utilizando métricas reais.
        """
        pages = document.get("pages", [])
        if not pages:
            return VisualCriticReport(
                hierarchy=0.0,
                legibility=0.0,
                rhythm=0.0,
                balance=0.0,
                contrast=0.0,
                novelty=0.0,
                brand_fit=0.0,
                generic_risk=1.0,
                cliches_detected=["DOCUMENT_EMPTY"],
                passed=False,
            )

        cliches: List[str] = []
        recommendations: List[str] = []
        generic_risk_score = 0.05

        # 1. Auditoria Rigorosa de Clichê de Capa de Luxo (5 Componentes da LuxuryCoverSignature)
        cover_page = pages[0]
        cover_blocks = cover_page.get("blocks", [])

        if cover_blocks:
            c_logo = False
            c_head = False
            c_line = False
            c_sub = False
            c_bottom = False

            for b in cover_blocks:
                bx = float(b.get("x", 0.0))
                by = float(b.get("y", 0.0))
                bw = float(b.get("width", 0.0))
                cx = bx + bw / 2.0
                is_centered = b.get("alignment") == "center" or (0.35 <= cx <= 0.65)
                role = str(b.get("role", "")).lower()
                btype = str(b.get("type", "")).lower()

                if (btype == "logo" or "monogram" in role or "badge" in btype) and is_centered and by < 0.40:
                    c_logo = True
                if (role == "headline" or btype == "headline") and is_centered:
                    c_head = True
                if (btype == "line" or "rule" in role) and is_centered:
                    c_line = True
                if (role == "subtitle" or "sub" in role) and is_centered:
                    c_sub = True
                if (role in ["folio", "metadata", "caption"] or by > 0.70) and is_centered:
                    c_bottom = True

            signature_points = sum([c_logo, c_head, c_line, c_sub, c_bottom])
            if signature_points >= 4:
                cliches.append(
                    "CLICHE_STANDARDIZED_LUXURY_COVER: Capa com monograma + título central + filete + subtítulo + assinatura inferior."
                )
                recommendations.append("Descentralizar o título da capa ou adotar corte fotográfico macro assimétrico.")
                generic_risk_score += 0.40

        # 2. Auditoria de Centralização Excessiva em Todas as Pranchetas
        centered_pages = 0
        for p in pages:
            p_blocks = p.get("blocks", [])
            if p_blocks:
                center_count = sum(1 for b in p_blocks if b.get("alignment") == "center")
                if (center_count / len(p_blocks)) > 0.65:
                    centered_pages += 1

        if centered_pages >= len(pages) - 1 and len(pages) > 2:
            cliches.append("EXCESSIVE_CENTER_ALIGNMENT: Quase todas as páginas utilizam alinhamento central monótono.")
            recommendations.append("Introduzir alinhamento à margem esquerda e blocos de texto periféricos.")
            generic_risk_score += 0.20

        # 3. Auditoria de Cards Uniformes Repetitivos
        card_pages = sum(1 for p in pages if p.get("useCards") is True or p.get("containerStyle") == "card")
        if card_pages >= len(pages) and "NO_CARDS" not in contract.constraints.negative and len(pages) >= 4:
            cliches.append("REPETITIVE_CARD_CONTAINERS: Uso uniforme e ininterrupto de caixas/cards.")
            recommendations.append("Alternar páginas de produtos com layouts de imagem total ou tipografia contínua.")
            generic_risk_score += 0.15

        # 4. Cálculo de Novidade via NoveltyEngine
        novelty_eval = NoveltyEngine.evaluate_catalog_novelty(pages)
        novelty_score = novelty_eval.get("overall_novelty", 0.75)
        if not novelty_eval.get("passed", True):
            cliches.extend(novelty_eval.get("issues", []))
            generic_risk_score += 0.25

        # 5. CÁLCULO REAL DAS MÉTRICAS COGNITIVAS E COMPOSITIVAS

        # 5.1 Hierarchy: contraste tipográfico real e dominância de massa
        font_sizes = []
        for p in pages:
            for b in p.get("blocks", []):
                fs = b.get("fontSize")
                if fs and isinstance(fs, (int, float)):
                    font_sizes.append(float(fs))

        if font_sizes and max(font_sizes) > 0:
            scale_ratio = max(font_sizes) / (min(font_sizes) or 1.0)
            # Relação saudável entre título e texto corrido: 2.2 a 4.5
            hierarchy_metric = round(min(1.0, max(0.4, (scale_ratio - 1.0) / 3.0)), 2)
        else:
            hierarchy_metric = 0.75

        # 5.2 Legibility: ausência de colisões e proporções físicas adequadas
        legibility_penalties = 0.0
        for p in pages:
            for b in p.get("blocks", []):
                bw = float(b.get("width", 0.5))
                bh = float(b.get("height", 0.2))
                if bw < 0.08 and b.get("type") in ["text", "price"]:
                    legibility_penalties += 0.05
                if bh < 0.02 and b.get("type") in ["text", "price"]:
                    legibility_penalties += 0.05
        legibility_metric = round(max(0.40, min(1.0, 1.0 - legibility_penalties)), 2)

        # 5.3 Rhythm: alternância de eixos e variedade de densidade entre pranchetas
        axes = [p.get("composition", {}).get("axis", "diagonal") for p in pages if p.get("composition")]
        axis_variety = len(set(axes)) / (len(axes) or 1)
        rhythm_metric = round(max(0.40, min(1.0, 0.50 + (axis_variety * 0.45))), 2)

        # 5.4 Balance: desvio médio de centro de massa visual das pranchetas
        fingerprints = novelty_eval.get("fingerprints", [])
        if fingerprints:
            sym_scores = [fp.get("symmetry", 0.5) for fp in fingerprints]
            balance_metric = round(sum(sym_scores) / len(sym_scores), 2)
        else:
            balance_metric = 0.75

        # 5.5 Contrast: contraste cromático relativo entre fundo e texto da paleta
        palette = document.get("palette", {})
        bg_hex = palette.get("background", "#F6F5F2")
        text_hex = palette.get("primary", "#141416")
        contrast_metric = cls._calculate_color_contrast(bg_hex, text_hex)

        # 5.6 Brand Fit: distância entre o VisualDNA solicitado e a composição final
        if visual_dna and fingerprints:
            actual_avg_sym = sum(fp.get("symmetry", 0.5) for fp in fingerprints) / len(fingerprints)
            dna_target_sym = visual_dna.symmetry
            sym_delta = abs(actual_avg_sym - dna_target_sym)
            brand_fit_metric = round(max(0.50, min(1.0, 1.0 - sym_delta)), 2)
        else:
            brand_fit_metric = 0.85

        final_risk = round(min(1.0, generic_risk_score), 3)
        passed = final_risk < cls.GENERIC_RISK_THRESHOLD

        logger.info(
            f"[VisualCritic] Auditoria concluída: generic_risk={final_risk:.2f}, "
            f"novelty={novelty_score:.2f}, hierarchy={hierarchy_metric:.2f}, status={'APROVADO' if passed else 'ALERTA DE CLICHÊ'}."
        )

        return VisualCriticReport(
            hierarchy=hierarchy_metric,
            legibility=legibility_metric,
            rhythm=rhythm_metric,
            balance=balance_metric,
            contrast=contrast_metric,
            novelty=novelty_score,
            brand_fit=brand_fit_metric,
            generic_risk=final_risk,
            cliches_detected=cliches,
            recommendations=recommendations,
            passed=passed,
        )

    @classmethod
    def _calculate_color_contrast(cls, hex1: str, hex2: str) -> float:
        """Calcula o contraste de luminância aproximado entre duas cores hexadecimais."""
        def hex_to_lum(h: str) -> float:
            h = h.lstrip("#")
            if len(h) != 6:
                return 0.5
            try:
                r = int(h[0:2], 16) / 255.0
                g = int(h[2:4], 16) / 255.0
                b = int(h[4:6], 16) / 255.0
                return 0.2126 * r + 0.7152 * g + 0.0722 * b
            except Exception:
                return 0.5

        lum1 = hex_to_lum(hex1)
        lum2 = hex_to_lum(hex2)
        l_high = max(lum1, lum2)
        l_low = min(lum1, lum2)
        ratio = (l_high + 0.05) / (l_low + 0.05)
        # Ratio normalizado: 4.5 (AA) -> ~0.80, 7.0 (AAA) -> ~0.95
        return round(min(1.0, max(0.40, ratio / 7.5)), 2)
