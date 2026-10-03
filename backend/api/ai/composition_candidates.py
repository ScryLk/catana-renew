"""
Composition Candidate Generator - Motor Generativo de Candidatos Espaciais.
Gera múltiplos candidatos de layout (variando eixo, foco, proporção de imagem, escala tipográfica e respiro)
para a mesma prancheta, avaliando-os com filtros anti-clichê e conformidade de Safe Area,
selecionando a melhor composição vencedora antes do render final.
"""
import copy
import random
import logging
from typing import Dict, Any, List, Optional
from .requirement_contract import RequirementContract
from .visual_dna import VisualDNA
from .creative_director import CreativeDirection
from .narrative_planner import PageNarrativePlan
from .design_grammar import GenerativeBlock, GenerativeCompositionMeta, GenerativeGridSpec
from .composition_mutator import fit_block_to_safe_area, DEFAULT_SAFE_AREA

logger = logging.getLogger(__name__)


class CompositionCandidateGenerator:
    """
    Gerador e Avaliador de Candidatos Espaciais.
    Elimina mini-templates fixos ao explorar o espaço combinatório e selecionar o melhor arranjo.
    """

    @classmethod
    def evaluate_candidate_fitness(
        cls,
        blocks: List[Dict[str, Any]],
        role: str,
        visual_dna: VisualDNA,
        safe_area: Dict[str, float] = None,
    ) -> float:
        """
        Calcula o score de aptidão estética e técnica de um candidato de prancheta (0.0 a 1.0).
        Penaliza clichês (capa 5-elementos), colisões e excesso de centralização monótona.
        """
        score = 0.85
        if not blocks:
            return 0.10

        safe = safe_area or DEFAULT_SAFE_AREA
        s_top = float(safe.get("top", 0.04))
        s_right = float(safe.get("right", 0.04))
        s_bottom = float(safe.get("bottom", 0.04))
        s_left = float(safe.get("left", 0.04))

        # 1. Penalização de Clichê na Capa (Anti-Standardized Luxury Cover)
        if role in ["opening", "cover"]:
            c_logo = any(b.get("type") == "logo" and b.get("alignment") == "center" for b in blocks)
            c_head = any(b.get("role") == "headline" and b.get("alignment") == "center" for b in blocks)
            c_line = any(b.get("type") == "line" and b.get("alignment") == "center" for b in blocks)
            c_sub = any(b.get("role") == "subtitle" and b.get("alignment") == "center" for b in blocks)
            if sum([c_logo, c_head, c_line, c_sub]) >= 3:
                score -= 0.35 # Penalização forte para evitar capas clichês centralizadas idênticas

        # 2. Avaliação de Alinhamento e Assimetria
        center_count = sum(1 for b in blocks if b.get("alignment") == "center")
        center_ratio = center_count / len(blocks)
        if visual_dna.symmetry < 0.45 and center_ratio > 0.60:
            score -= 0.20 # Penaliza centralização quando o DNA pede assimetria

        # 3. Avaliação de Colisões
        n = len(blocks)
        for i in range(n):
            for j in range(i + 1, n):
                b1, b2 = blocks[i], blocks[j]
                if b1.get("allowOverlap") or b2.get("allowOverlap"):
                    continue
                ix1 = max(float(b1.get("x", 0)), float(b2.get("x", 0)))
                iy1 = max(float(b1.get("y", 0)), float(b2.get("y", 0)))
                ix2 = min(float(b1.get("x", 0)) + float(b1.get("width", 0)), float(b2.get("x", 0)) + float(b2.get("width", 0)))
                iy2 = min(float(b1.get("y", 0)) + float(b1.get("height", 0)), float(b2.get("y", 0)) + float(b2.get("height", 0)))
                if ix2 > ix1 and iy2 > iy1:
                    score -= 0.15

        return max(0.0, min(1.0, score))
