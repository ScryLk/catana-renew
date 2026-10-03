"""
Novelty Engine - Medição e Auditoria de Originalidade Compositiva.
Calcula fingerprints espaciais de pranchetas, compara similaridade geométrica
entre páginas consecutivas e documentos recentes, e sinaliza composições repetitivas.
"""
from dataclasses import dataclass, asdict, field
from typing import Dict, Any, List, Optional
import math
import logging

logger = logging.getLogger(__name__)


@dataclass
class PageFingerprint:
    """
    Assinatura geométrica e compositiva de uma prancheta.
    Permite calcular similaridade sem necessidade de renderizar ou armazenar bitmaps.
    """
    symmetry: float = 0.5                  # 0.0 a 1.0
    density: float = 0.5                   # 0.0 a 1.0 (área total coberta por blocos)
    image_area: float = 0.0                # 0.0 a 1.0 (fração de área ocupada por fotos)
    largest_block_x: float = 0.5           # Coordenada X do maior bloco
    largest_block_y: float = 0.5           # Coordenada Y do maior bloco
    headline_x: float = 0.0                # Coordenada X do título principal
    headline_y: float = 0.0                # Coordenada Y do título principal
    headline_scale: float = 0.5            # Escala relativa do título
    overlap_area: float = 0.0              # Área de interseção entre blocos
    rotation_variance: float = 0.0         # Desvio de rotação entre elementos
    alignment_dominance: str = "left"      # "left", "center", "right"
    visual_axis: str = "diagonal"          # "asymmetric_left", "asymmetric_right", "diagonal", "stark_horizontal"

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    def to_vector(self) -> List[float]:
        """Vetor numérico normalizado para cálculo de distância Euclidiana / Cosseno."""
        align_code = 0.0 if self.alignment_dominance == "left" else 0.5 if self.alignment_dominance == "center" else 1.0
        axis_code = 0.0 if "horizontal" in self.visual_axis else 0.33 if "left" in self.visual_axis else 0.66 if "right" in self.visual_axis else 1.0

        return [
            self.symmetry,
            self.density,
            self.image_area,
            self.largest_block_x,
            self.largest_block_y,
            self.headline_x,
            self.headline_y,
            self.headline_scale,
            self.overlap_area,
            self.rotation_variance,
            align_code,
            axis_code,
        ]


class NoveltyEngine:
    """
    Motor de Medição de Originalidade Editorial.
    Avalia a distância Euclidiana entre pranchetas e detecta repetições indesejadas.
    """
    MINIMUM_NOVELTY_THRESHOLD = 0.40       # Abaixo disso, a composição é considerada excessivamente repetitiva
    CRITICAL_SIMILARITY_THRESHOLD = 0.90   # Similaridade >= 90% entre páginas adjacentes dispara mutação

    @classmethod
    def compute_fingerprint(cls, page_dict: Dict[str, Any]) -> PageFingerprint:
        """Extrai a assinatura geométrica de uma prancheta generativa ou legada."""
        blocks = page_dict.get("blocks", [])
        composition = page_dict.get("composition", {})

        if not blocks:
            # Fallback para página legada
            return PageFingerprint(
                symmetry=0.8 if page_dict.get("type") in ["cover", "manifesto"] else 0.4,
                density=0.6 if page_dict.get("type") == "grid_4" else 0.3,
                alignment_dominance="center" if page_dict.get("type") in ["cover", "backcover"] else "left",
                visual_axis="stark_horizontal",
            )

        total_area = 0.0
        image_area = 0.0
        largest_area = 0.0
        largest_x = 0.5
        largest_y = 0.5

        head_x = 0.0
        head_y = 0.0
        head_scale = 0.5

        rotations = []
        alignments = {"left": 0, "center": 0, "right": 0}

        for b in blocks:
            w = float(b.get("width", 0.0))
            h = float(b.get("height", 0.0))
            x = float(b.get("x", 0.0))
            y = float(b.get("y", 0.0))
            area = min(1.0, w * h)
            total_area += area

            b_type = b.get("type", "")
            b_role = b.get("role", "")

            if b_type in ["image", "product_image"] or b_role in ["hero_image", "primary_photo"]:
                image_area += area

            if area > largest_area:
                largest_area = area
                largest_x = x
                largest_y = y

            if b_role == "headline" or b_type == "headline":
                head_x = x
                head_y = y
                head_scale = min(1.0, float(b.get("fontSize", 24)) / 64.0)

            rot = abs(float(b.get("rotation", 0.0)))
            rotations.append(rot)

            align = b.get("alignment", "left")
            if align in alignments:
                alignments[align] += 1

        # Alinhamento dominante
        dominant_align = max(alignments, key=alignments.get) if alignments else "left"
        axis = composition.get("axis", "diagonal")
        symmetry = 0.8 if dominant_align == "center" else 0.35

        return PageFingerprint(
            symmetry=symmetry,
            density=min(1.0, total_area),
            image_area=min(1.0, image_area),
            largest_block_x=round(largest_x, 3),
            largest_block_y=round(largest_y, 3),
            headline_x=round(head_x, 3),
            headline_y=round(head_y, 3),
            headline_scale=round(head_scale, 3),
            rotation_variance=min(1.0, sum(rotations) / (len(rotations) or 1) / 15.0),
            alignment_dominance=dominant_align,
            visual_axis=axis,
        )

    @classmethod
    def calculate_similarity(cls, fp1: PageFingerprint, fp2: PageFingerprint) -> float:
        """
        Calcula a similaridade geométrica entre duas assinaturas (0.0 = totalmente distintas, 1.0 = idênticas).
        Utiliza ponderação espacial priorizando alinhamento, coordenadas do bloco dominante e fotos.
        """
        v1 = fp1.to_vector()
        v2 = fp2.to_vector()

        # Pesos dos atributos para refletir percepção visual real
        weights = [1.2, 1.5, 2.0, 1.5, 1.5, 1.5, 1.2, 1.0, 0.8, 0.5, 2.2, 1.8]
        weighted_sum_sq = sum(w * ((a - b) ** 2) for w, a, b in zip(weights, v1, v2))
        max_dist = math.sqrt(sum(weights))
        normalized_dist = min(1.0, (math.sqrt(weighted_sum_sq) / max_dist) * 1.7)

        similarity = max(0.0, min(1.0, 1.0 - normalized_dist))
        return round(similarity, 3)

    @classmethod
    def calculate_novelty_score(cls, fp1: PageFingerprint, fp2: PageFingerprint) -> float:
        """Retorna o score de novidade / originalidade (0.0 = cópia, 1.0 = totalmente nova)."""
        sim = cls.calculate_similarity(fp1, fp2)
        return round(1.0 - sim, 3)

    @classmethod
    def evaluate_catalog_novelty(cls, pages: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Audita a cadência e originalidade entre todas as pranchetas de um catálogo.
        Retorna scores por par de páginas e score global de novidade.
        """
        if len(pages) < 2:
            return {"overall_novelty": 1.0, "consecutive_similarities": [], "passed": True}

        fingerprints = [cls.compute_fingerprint(p) for p in pages]
        consecutive_similarities = []
        issues = []

        for i in range(len(fingerprints) - 1):
            fp_a = fingerprints[i]
            fp_b = fingerprints[i + 1]
            sim = cls.calculate_similarity(fp_a, fp_b)
            consecutive_similarities.append(sim)

            if sim >= cls.CRITICAL_SIMILARITY_THRESHOLD:
                issues.append(f"COMPOSITION_TOO_SIMILAR: Páginas {i + 1} e {i + 2} possuem similaridade de {sim * 100:.1f}%.")

        avg_similarity = sum(consecutive_similarities) / len(consecutive_similarities)
        overall_novelty = round(1.0 - avg_similarity, 3)

        return {
            "overall_novelty": overall_novelty,
            "consecutive_similarities": consecutive_similarities,
            "fingerprints": [fp.to_dict() for fp in fingerprints],
            "passed": len(issues) == 0 and overall_novelty >= cls.MINIMUM_NOVELTY_THRESHOLD,
            "issues": issues,
        }
