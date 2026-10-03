"""
Novelty Engine - Medição e Auditoria de Originalidade Compositiva Editorial.
Calcula impressões digitais espaciais profundas (centro de massa visual, simetria real,
quadrantes ocupados, overlaps intencionais vs acidentais, centróides de texto e imagem).
Compara similaridade em pares consecutivos e pares de mesmo papel narrativo (anti-alternância A-B-A-B).
"""
from dataclasses import dataclass, asdict, field
from typing import Dict, Any, List, Optional, Tuple
import math
import logging

logger = logging.getLogger(__name__)


@dataclass
class PageFingerprint:
    """
    Assinatura geométrica e compositiva profunda de uma prancheta.
    Calculada a partir da distribuição física real das massas visuais.
    """
    symmetry: float = 0.5                  # 0.0 a 1.0 (equilíbrio de massa esquerda vs direita)
    density: float = 0.5                   # 0.0 a 1.0 (área total coberta por blocos)
    image_area: float = 0.0                # 0.0 a 1.0 (fração de área ocupada por fotos)
    center_of_mass_x: float = 0.5          # Centróide X ponderado por peso visual
    center_of_mass_y: float = 0.5          # Centróide Y ponderado por peso visual
    left_right_mass_ratio: float = 1.0     # Razão de massa esquerda / direita
    top_bottom_mass_ratio: float = 1.0     # Razão de massa superior / inferior
    image_centroid_x: float = 0.5          # Centróide X das fotos (0.5 se sem imagem)
    image_centroid_y: float = 0.5          # Centróide Y das fotos
    text_centroid_x: float = 0.5           # Centróide X das massas de texto
    text_centroid_y: float = 0.5           # Centróide Y das massas de texto
    quadrant_histogram: List[float] = field(default_factory=lambda: [0.25, 0.25, 0.25, 0.25]) # [TL, TR, BL, BR]
    largest_block_x: float = 0.5           # Coordenada X do maior bloco
    largest_block_y: float = 0.5           # Coordenada Y do maior bloco
    headline_x: float = 0.0                # Coordenada X do título principal
    headline_y: float = 0.0                # Coordenada Y do título principal
    headline_scale: float = 0.5            # Escala relativa do título
    intentional_overlap_area: float = 0.0  # Área de sobreposição intencional (allowOverlap)
    accidental_overlap_area: float = 0.0   # Área de sobreposição acidental
    block_count: int = 0                   # Número de blocos
    alignment_dominance: str = "left"      # "left", "center", "right"
    visual_axis: str = "diagonal"          # "asymmetric_left", "asymmetric_right", "diagonal", "stark_horizontal"

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    def to_vector(self) -> List[float]:
        """Vetor numérico normalizado para cálculo de distância ponderada."""
        align_code = 0.0 if self.alignment_dominance == "left" else 0.5 if self.alignment_dominance == "center" else 1.0
        axis_code = 0.0 if "horizontal" in self.visual_axis else 0.33 if "left" in self.visual_axis else 0.66 if "right" in self.visual_axis else 1.0

        q = self.quadrant_histogram or [0.25, 0.25, 0.25, 0.25]
        return [
            self.symmetry,
            self.density,
            self.image_area,
            self.center_of_mass_x,
            self.center_of_mass_y,
            min(2.0, self.left_right_mass_ratio) / 2.0,
            min(2.0, self.top_bottom_mass_ratio) / 2.0,
            self.image_centroid_x,
            self.image_centroid_y,
            self.text_centroid_x,
            self.text_centroid_y,
            q[0], q[1], q[2], q[3],
            self.largest_block_x,
            self.largest_block_y,
            self.headline_x,
            self.headline_y,
            self.headline_scale,
            min(1.0, self.intentional_overlap_area * 10),
            align_code,
            axis_code,
        ]


class NoveltyEngine:
    """
    Motor de Medição de Originalidade Editorial e Cadência Rítmica.
    """
    MINIMUM_NOVELTY_THRESHOLD = 0.40       # Abaixo disso, o catálogo é considerado excessivamente repetitivo
    CRITICAL_SIMILARITY_THRESHOLD = 0.90   # Similaridade >= 90% dispara mutação cirúrgica

    @classmethod
    def compute_fingerprint(cls, page_dict: Dict[str, Any]) -> PageFingerprint:
        """Calcula a assinatura geométrica profunda e real da prancheta."""
        blocks = page_dict.get("blocks", [])
        composition = page_dict.get("composition", {})

        if not blocks:
            # Fallback para prancheta puramente legada
            ptype = page_dict.get("type", "hero")
            return PageFingerprint(
                symmetry=0.85 if ptype in ["cover", "manifesto"] else 0.4,
                density=0.6 if ptype == "grid_4" else 0.35,
                alignment_dominance="center" if ptype in ["cover", "backcover"] else "left",
                visual_axis="stark_horizontal",
            )

        total_mass = 0.0
        sum_mass_x = 0.0
        sum_mass_y = 0.0
        left_mass = 0.0
        right_mass = 0.0
        top_mass = 0.0
        bottom_mass = 0.0

        img_mass = 0.0
        sum_img_x = 0.0
        sum_img_y = 0.0

        text_mass = 0.0
        sum_text_x = 0.0
        sum_text_y = 0.0

        quadrants = [0.0, 0.0, 0.0, 0.0]  # Q1 (top-left), Q2 (top-right), Q3 (bottom-left), Q4 (bottom-right)

        largest_area = 0.0
        largest_x = 0.5
        largest_y = 0.5

        head_x = 0.0
        head_y = 0.0
        head_scale = 0.5

        alignments = {"left": 0, "center": 0, "right": 0}

        for b in blocks:
            bx = float(b.get("x", 0.0))
            by = float(b.get("y", 0.0))
            bw = float(b.get("width", 0.0))
            bh = float(b.get("height", 0.0))
            area = max(0.0001, bw * bh)
            cx = bx + bw / 2.0
            cy = by + bh / 2.0

            b_type = str(b.get("type", ""))
            b_role = str(b.get("role", ""))

            # Peso perceptual visual da primitiva
            weight = 1.5 if ("image" in b_type or "photo" in b_role) else (1.3 if b_role == "headline" else 1.0)
            element_mass = area * weight

            total_mass += element_mass
            sum_mass_x += cx * element_mass
            sum_mass_y += cy * element_mass

            if cx < 0.5:
                left_mass += element_mass
            else:
                right_mass += element_mass

            if cy < 0.5:
                top_mass += element_mass
            else:
                bottom_mass += element_mass

            # Quadrantes
            if cx < 0.5 and cy < 0.5:
                quadrants[0] += element_mass
            elif cx >= 0.5 and cy < 0.5:
                quadrants[1] += element_mass
            elif cx < 0.5 and cy >= 0.5:
                quadrants[2] += element_mass
            else:
                quadrants[3] += element_mass

            if "image" in b_type or "photo" in b_role:
                img_mass += element_mass
                sum_img_x += cx * element_mass
                sum_img_y += cy * element_mass

            if b_type in ["text", "price", "metadata", "quote"] or b_role in ["headline", "body", "subtitle"]:
                text_mass += element_mass
                sum_text_x += cx * element_mass
                sum_text_y += cy * element_mass

            if area > largest_area:
                largest_area = area
                largest_x = bx
                largest_y = by

            if b_role == "headline" or b_type == "headline":
                head_x = bx
                head_y = by
                head_scale = min(1.0, float(b.get("fontSize", 24)) / 64.0)

            align = b.get("alignment", "left")
            if align in alignments:
                alignments[align] += 1

        # Cálculo real de overlap area (A ∩ B)
        intentional_overlap = 0.0
        accidental_overlap = 0.0
        n_blocks = len(blocks)
        for i in range(n_blocks):
            for j in range(i + 1, n_blocks):
                b1, b2 = blocks[i], blocks[j]
                ix1 = max(float(b1.get("x", 0)), float(b2.get("x", 0)))
                iy1 = max(float(b1.get("y", 0)), float(b2.get("y", 0)))
                ix2 = min(float(b1.get("x", 0)) + float(b1.get("width", 0)), float(b2.get("x", 0)) + float(b2.get("width", 0)))
                iy2 = min(float(b1.get("y", 0)) + float(b1.get("height", 0)), float(b2.get("y", 0)) + float(b2.get("height", 0)))
                if ix2 > ix1 and iy2 > iy1:
                    inter_area = (ix2 - ix1) * (iy2 - iy1)
                    if b1.get("allowOverlap") or b2.get("allowOverlap"):
                        intentional_overlap += inter_area
                    else:
                        accidental_overlap += inter_area

        safe_total = total_mass if total_mass > 0 else 1.0
        cm_x = sum_mass_x / safe_total
        cm_y = sum_mass_y / safe_total

        # Simetria real calculada a partir do equilíbrio lateral das massas
        diff_lr = abs(left_mass - right_mass)
        calculated_symmetry = max(0.0, min(1.0, 1.0 - (diff_lr / safe_total)))

        lr_ratio = left_mass / (right_mass or 1e-4)
        tb_ratio = top_mass / (bottom_mass or 1e-4)

        img_cx = (sum_img_x / img_mass) if img_mass > 0 else 0.5
        img_cy = (sum_img_y / img_mass) if img_mass > 0 else 0.5
        txt_cx = (sum_text_x / text_mass) if text_mass > 0 else 0.5
        txt_cy = (sum_text_y / text_mass) if text_mass > 0 else 0.5

        # Normaliza histograma de quadrantes
        norm_quadrants = [round(q / safe_total, 3) for q in quadrants]

        dominant_align = max(alignments, key=alignments.get) if alignments else "left"
        axis = composition.get("axis", "diagonal")

        return PageFingerprint(
            symmetry=round(calculated_symmetry, 3),
            density=round(min(1.0, total_mass / 1.5), 3),
            image_area=round(min(1.0, img_mass / 1.5), 3),
            center_of_mass_x=round(cm_x, 3),
            center_of_mass_y=round(cm_y, 3),
            left_right_mass_ratio=round(lr_ratio, 3),
            top_bottom_mass_ratio=round(tb_ratio, 3),
            image_centroid_x=round(img_cx, 3),
            image_centroid_y=round(img_cy, 3),
            text_centroid_x=round(txt_cx, 3),
            text_centroid_y=round(txt_cy, 3),
            quadrant_histogram=norm_quadrants,
            largest_block_x=round(largest_x, 3),
            largest_block_y=round(largest_y, 3),
            headline_x=round(head_x, 3),
            headline_y=round(head_y, 3),
            headline_scale=round(head_scale, 3),
            intentional_overlap_area=round(intentional_overlap, 3),
            accidental_overlap_area=round(accidental_overlap, 3),
            block_count=n_blocks,
            alignment_dominance=dominant_align,
            visual_axis=axis,
        )

    @classmethod
    def calculate_similarity(cls, fp1: PageFingerprint, fp2: PageFingerprint) -> float:
        """
        Calcula a similaridade geométrica entre duas assinaturas espaciais (0.0 = totalmente distintas, 1.0 = idênticas).
        Pondera os atributos segundo percepção visual humana de layout.
        """
        v1 = fp1.to_vector()
        v2 = fp2.to_vector()

        # Pesos para as 23 dimensões
        weights = [
            1.2, # symmetry
            1.4, # density
            1.8, # image_area
            1.6, # cm_x
            1.6, # cm_y
            1.2, # lr_ratio
            1.2, # tb_ratio
            1.5, # img_cx
            1.5, # img_cy
            1.4, # txt_cx
            1.4, # txt_cy
            1.0, 1.0, 1.0, 1.0, # quadrants
            1.5, # largest_x
            1.5, # largest_y
            1.6, # headline_x
            1.6, # headline_y
            1.2, # headline_scale
            0.8, # overlap
            2.0, # alignment
            1.8, # visual_axis
        ]
        weighted_sum_sq = sum(w * ((a - b) ** 2) for w, a, b in zip(weights, v1, v2))
        max_dist = math.sqrt(sum(weights))
        normalized_dist = min(1.0, (math.sqrt(weighted_sum_sq) / max_dist) * 1.6)

        similarity = max(0.0, min(1.0, 1.0 - normalized_dist))
        return round(similarity, 3)

    @classmethod
    def calculate_novelty_score(cls, fp1: PageFingerprint, fp2: PageFingerprint) -> float:
        """
        Retorna o score de novidade/distância entre duas páginas (0.0 = idênticas, 1.0 = totalmente inovadoras).
        """
        sim = cls.calculate_similarity(fp1, fp2)
        return round(max(0.0, min(1.0, 1.0 - sim)), 3)

    @classmethod
    def evaluate_catalog_novelty(cls, pages: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Audita a originalidade e cadência rítmica de todas as pranchetas do catálogo.
        Examina:
        1. Pranchetas consecutivas (Páginas i e i+1)
        2. Pranchetas de mesmo papel narrativo (ex: product_reveal vs product_reveal)
        3. Padrões de alternância repetitiva (ex: A-B-A-B entre i e i+2)
        """
        if len(pages) < 2:
            return {"overall_novelty": 1.0, "consecutive_similarities": [], "passed": True, "issues": []}

        fingerprints = [cls.compute_fingerprint(p) for p in pages]
        consecutive_similarities = []
        issues = []
        offending_pages = set()

        # 1. Comparação Consecutiva (i vs i+1)
        for i in range(len(fingerprints) - 1):
            sim = cls.calculate_similarity(fingerprints[i], fingerprints[i + 1])
            consecutive_similarities.append(sim)

            if sim >= cls.CRITICAL_SIMILARITY_THRESHOLD:
                offender = i + 2 # A segunda prancheta recebe a intervenção de mutação
                offending_pages.add(offender)
                issues.append(
                    f"COMPOSITION_TOO_SIMILAR: Páginas {i + 1} e {i + 2} possuem similaridade excessiva ({sim * 100:.1f}%)."
                )

        # 2. Comparação de Mesmo Papel Narrativo (ex: múltiplos product_reveal)
        role_indices: Dict[str, List[int]] = {}
        for idx, p in enumerate(pages):
            role = p.get("contentRole") or p.get("type", "unknown")
            role_indices.setdefault(role, []).append(idx)

        for role, indices in role_indices.items():
            if len(indices) >= 2:
                for a_idx in range(len(indices)):
                    for b_idx in range(a_idx + 1, len(indices)):
                        idx_a = indices[a_idx]
                        idx_b = indices[b_idx]
                        if idx_b == idx_a + 1:
                            continue # Já avaliado na consecutiva
                        sim = cls.calculate_similarity(fingerprints[idx_a], fingerprints[idx_b])
                        # Se páginas do mesmo papel têm similaridade quase idêntica (>92%)
                        if sim >= (cls.CRITICAL_SIMILARITY_THRESHOLD + 0.02):
                            offender = idx_b + 1
                            offending_pages.add(offender)
                            issues.append(
                                f"COMPOSITION_ROLE_CLONE: Páginas {idx_a + 1} e {idx_b + 1} ({role}) são layouts idênticos clonados ({sim * 100:.1f}%)."
                            )

        # 3. Comparação de Alternância Rítmica (i vs i+2)
        for i in range(len(fingerprints) - 2):
            sim_alt = cls.calculate_similarity(fingerprints[i], fingerprints[i + 2])
            if sim_alt >= 0.94:
                offending_pages.add(i + 3)
                issues.append(
                    f"RHYTHM_PING_PONG: Páginas {i + 1} e {i + 3} repetem a mesma estrutura em padrão ping-pong ({sim_alt * 100:.1f}%)."
                )

        avg_similarity = sum(consecutive_similarities) / (len(consecutive_similarities) or 1)
        overall_novelty = round(1.0 - avg_similarity, 3)

        return {
            "overall_novelty": overall_novelty,
            "consecutive_similarities": consecutive_similarities,
            "fingerprints": [fp.to_dict() for fp in fingerprints],
            "passed": len(issues) == 0 and overall_novelty >= cls.MINIMUM_NOVELTY_THRESHOLD,
            "issues": issues,
            "offending_pages": sorted(list(offending_pages)),
        }
