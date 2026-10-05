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
from .constraint_engine import ConstraintEngine

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
    contrast_ratio: float = 0.0
    diagnostics: Dict[str, Any] = field(default_factory=dict)

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

        # Programmatic metrics from the actual page blocks, including WCAG text contrast.
        page_metrics = [cls.measure_page(page, visual_dna) for page in pages]
        legibility_metric = round(sum(m['legibility'] for m in page_metrics) / len(pages), 3)
        balance_metric = round(sum(m['balance'] for m in page_metrics) / len(pages), 3)
        brand_fit_metric = round(sum(m['brandFit'] for m in page_metrics) / len(pages), 3)
        axes = [p.get('composition', {}).get('axis', 'orthogonal') for p in pages]
        rhythm_metric = round(.5 + .45 * len(set(axes)) / len(axes), 3)
        contrast_ratio = min(m['contrastRatio'] for m in page_metrics)
        contrast_metric = round(min(1.0, contrast_ratio / 7), 3)
        if contrast_ratio < 4.5:
            cliches.append('INSUFFICIENT_TEXT_CONTRAST')
            recommendations.append('Increase text/background WCAG contrast to at least 4.5:1.')
        if legibility_metric < .5:
            cliches.append('INSUFFICIENT_LEGIBILITY')

        brand_errors = ConstraintEngine.validate_brand_expression(contract, document)
        if brand_errors:
            cliches.extend(brand_errors)
            recommendations.append('Revisar a identidade confirmada e a política dos ativos da marca.')
        logo_positions = [(round(b.get('x', 0), 2), round(b.get('y', 0), 2))
                          for p in pages for b in p.get('blocks', []) if b.get('role') == 'brand_hallmark']
        if len(logo_positions) >= 3 and len(set(logo_positions)) == 1:
            cliches.append('BRAND_IDENTICAL_LOGO_PLACEMENT')
            generic_risk_score += .35
        final_risk = round(min(1.0, generic_risk_score), 3)
        passed = final_risk < cls.GENERIC_RISK_THRESHOLD and contrast_ratio >= 4.5 and legibility_metric >= .5 and not brand_errors

        logger.info(
            f"[VisualCritic] Auditoria concluída: generic_risk={final_risk:.2f}, "
            f"novelty={novelty_score:.2f}, hierarchy={hierarchy_metric:.2f}, status={'APROVADO' if passed else 'ALERTA DE CLICHÊ'}."
        )

        return VisualCriticReport(
            contrast_ratio=round(contrast_ratio, 3),
            diagnostics={"pages": page_metrics, **({"brandPolicyErrors": brand_errors} if contract.brand_context else {})},
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

    @staticmethod
    def _calculate_color_contrast(hex1, hex2):
        """WCAG relative luminance with sRGB linearization; return the actual ratio."""
        def luminance(value):
            if not isinstance(value, str):
                raise ValueError('INVALID_COLOR')
            value = value.lstrip('#')
            if len(value) == 3:
                value = ''.join(c * 2 for c in value)
            if len(value) != 6:
                raise ValueError('INVALID_COLOR')
            channels = [int(value[i:i+2], 16) / 255 for i in (0,2,4)]
            linear = [c / 12.92 if c <= .04045 else ((c+.055)/1.055)**2.4 for c in channels]
            return sum(c*w for c,w in zip(linear, [.2126,.7152,.0722]))
        try:
            a,b = luminance(hex1), luminance(hex2)
            return (max(a,b)+.05)/(min(a,b)+.05)
        except (ValueError, TypeError):
            return 1.0

    @classmethod
    def measure_page(cls, page, dna=None):
        blocks = page.get('blocks', [])
        background = page.get('backgroundColor', '#FFFFFF')
        text = page.get('textColor', '#141416')
        ratios = [cls._calculate_color_contrast(background, text)]
        text_blocks = [b for b in blocks if b.get('content') is not None and b['type'] not in ['image', 'product_image', 'line', 'shape', 'color_field']]
        penalties = []
        for b in text_blocks:
            color = b.get('colorToken', 'primary')
            foreground = color if color.startswith('#') else {'primary':text, 'muted':'#71717A', 'accent':page.get('accentColor', text), 'background':background}.get(color,text)
            ratio = cls._calculate_color_contrast(background, foreground)
            ratios.append(ratio)
            size = b.get('fontSize',12)
            capacity = max(1, (b['width']*794/(size*.55)) * (b['height']*1123/(size*b.get('lineHeight',1.3))))
            density = len(str(b.get('content',''))) / capacity
            penalties.append(min(1, max(0,density-1)*.5 + (.3 if size < 9 else 0) + (.5 if ratio < 4.5 else 0)))
        collisions = 0
        for i,a in enumerate(text_blocks):
            for b in text_blocks[i+1:]:
                if a.get('allowOverlap') or b.get('allowOverlap'):
                    continue
                if min(a['x']+a['width'],b['x']+b['width']) > max(a['x'],b['x']) and min(a['y']+a['height'],b['y']+b['height']) > max(a['y'],b['y']):
                    collisions += 1
        weights = []
        for b in blocks:
            importance = 2.5 if 'image' in b['type'] else 2 if b.get('role') in ['headline','product_name'] else 1
            weights.append(b['width']*b['height']*importance*(1+.02*max(0,b.get('zIndex',1))))
        total = sum(weights) or 1
        cx = sum((b['x']+b['width']/2)*w for b,w in zip(blocks,weights))/total if weights else .5
        cy = sum((b['y']+b['height']/2)*w for b,w in zip(blocks,weights))/total if weights else .5
        area = min(1, sum(b['width']*b['height'] for b in blocks))
        image_area = sum(b['width']*b['height'] for b in blocks if 'image' in b['type'])
        center = sum(b.get('alignment')=='center' for b in blocks)/(len(blocks) or 1)
        sizes = [b.get('fontSize',12) for b in text_blocks]
        actual = {'symmetry':center, 'density':area, 'whitespace':1-area,
                  'image_dominance':min(1,image_area), 'grid_rigidity':1-len({b['x'] for b in blocks})/(len(blocks) or 1),
                  'typographic_drama':min(1, (max(sizes)/min(sizes)-1)/4) if sizes else 0,
                  'axis_tension':min(1,sum(abs(b.get('rotation',0)) for b in blocks)/(max(1,len(blocks))*45))}
        fit = 1-sum(abs(v-getattr(dna,k,v)) for k,v in actual.items())/len(actual) if dna else 1
        return {'pageNumber':page.get('pageNumber'), 'contrastRatio':min(ratios),
                'legibility':max(0,1-(sum(penalties)+collisions*.3)/(len(text_blocks) or 1)),
                'balance':max(0,1-math.hypot(cx-.5,cy-.5)), 'centerOfMass':[round(cx,3),round(cy,3)],
                'brandFit':fit, 'dnaDimensions':actual}
