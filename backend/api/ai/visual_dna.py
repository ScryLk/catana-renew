"""
Visual DNA - Representação Paramétrica Contínua do Caráter Visual Editorial.
Define dimensões contínuas (0.0 a 1.0) derivadas deterministamente do briefing,
restrições e creative_seed, eliminando templates estáticos e permitindo variação controlada.
"""
from dataclasses import dataclass, asdict, field
from typing import Dict, Any, List, Optional
import random
import logging
from .requirement_contract import RequirementContract

logger = logging.getLogger(__name__)


@dataclass
class VisualDNA:
    """
    Genoma visual de um documento editorial.
    Todos os parâmetros operam no intervalo normalizado de 0.0 a 1.0.
    """
    symmetry: float = 0.5                  # 0.0 = assimetria extrema, 1.0 = simetria axial perfeita
    density: float = 0.5                   # 0.0 = respiro monumental, 1.0 = matriz densa de informação
    whitespace: float = 0.5                # 0.0 = ocupação máxima, 1.0 = amplo espaço negativo
    visual_energy: float = 0.5             # 0.0 = serenidade / contemplação, 1.0 = tensão dinâmica alta
    typographic_drama: float = 0.5         # 0.0 = tipografia uniforme e técnica, 1.0 = saltos monumentais de escala
    image_dominance: float = 0.5           # 0.0 = tipografia pura / zero fotos, 1.0 = fotos dominando a prancheta
    overlap: float = 0.0                   # 0.0 = sem sobreposição de blocos, 1.0 = camadas e sobreposições ativas
    grid_rigidity: float = 0.7             # 0.0 = grid fluido / quebrado, 1.0 = grid estrito e modular
    decorative_intensity: float = 0.2      # 0.0 = zero adornos / purismo, 1.0 = filigranas, linhas e selos ativos
    experimentalism: float = 0.3           # 0.0 = conservador / comercial seguro, 1.0 = avant-garde / desconstruído
    scale_contrast: float = 0.5            # 0.0 = escala uniforme, 1.0 = contraste colossal entre H1 e corpo
    crop_aggressiveness: float = 0.3       # 0.0 = enquadramento integral, 1.0 = corte editorial ousado de fotografia
    axis_tension: float = 0.3              # 0.0 = alinhamento ortogonal tranquilo, 1.0 = diagonais e tensões ópticas
    creativity_level: float = 0.5          # 0.0 = conservador, 0.5 = editorial refinado, 1.0 = experimental

    def to_dict(self) -> Dict[str, float]:
        """Serializa os parâmetros para dicionário serializável em JSON."""
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "VisualDNA":
        """Reconstitui o VisualDNA a partir de dicionário."""
        valid_keys = cls.__dataclass_fields__.keys()
        filtered = {k: float(v) for k, v in data.items() if k in valid_keys}
        return cls(**filtered)


class VisualDNABuilder:
    """
    Construtor e sintetizador determinístico de VisualDNA.
    Garante: mesmo prompt + mesmo seed -> mesmo DNA.
             mesmo prompt + seeds diferentes -> variações estilísticas calibradas.
    """

    @classmethod
    def derive(
        cls,
        contract: RequirementContract,
        creative_seed: int,
        creativity_level: float = 0.5,
    ) -> VisualDNA:
        """
        Deriva o VisualDNA combinando intenção do briefing, regras de domínio e creative_seed.
        """
        rng = random.Random(creative_seed)
        style_keywords = [k.lower() for k in contract.design.style_keywords]
        raw_prompt = contract.raw_prompt.lower()
        negatives = set(contract.constraints.negative)

        # 1. Âncoras base derivadas do RequirementContract (0-100 para 0.0-1.0)
        base_density = contract.design.density / 100.0
        base_whitespace = contract.design.whitespace / 100.0
        base_symmetry = contract.design.symmetry / 100.0
        base_energy = contract.design.visual_energy / 100.0
        base_grid = contract.design.grid_rigidity / 100.0
        base_typo = contract.design.typographic_contrast / 100.0
        base_image = contract.design.image_dominance / 100.0
        base_decor = contract.design.decorative_intensity / 100.0

        # 2. Moduladores semânticos de estilo
        is_luxury = any(k in style_keywords or k in raw_prompt for k in ["luxury", "luxo", "alta costura", "haute couture", "nobel", "joias", "atelier"])
        is_brutalist = any(k in style_keywords or k in raw_prompt for k in ["brutalist", "brutalista", "raw", "exposto"])
        is_minimalist = any(k in style_keywords or k in raw_prompt for k in ["minimalist", "minimalista", "clean", "sobrio"])
        is_editorial = any(k in style_keywords or k in raw_prompt for k in ["editorial", "fashion", "moda", "revista", "magazine"])
        is_technical = any(k in style_keywords or k in raw_prompt for k in ["technical", "tecnico", "especificacao", "industrial", "b2b", "tabela"])

        # Fatores de estilo
        if is_luxury:
            # Luxo não é template fixo: é amplitude de respiro e dramaticidade tipográfica
            base_whitespace = max(base_whitespace, 0.60)
            base_density = min(base_density, 0.40)
            scale_contrast_target = 0.85
            drama_target = 0.80
            decor_target = 0.15 # Menos adorno redundante, mais espaço
            crop_target = 0.55
        elif is_technical:
            base_density = max(base_density, 0.70)
            base_whitespace = min(base_whitespace, 0.35)
            scale_contrast_target = 0.40
            drama_target = 0.30
            decor_target = 0.05
            crop_target = 0.15
        elif is_brutalist:
            base_grid = 0.90
            base_symmetry = 0.25
            scale_contrast_target = 0.90
            drama_target = 0.85
            decor_target = 0.0
            crop_target = 0.70
        else:
            scale_contrast_target = 0.60
            drama_target = 0.55
            decor_target = 0.20
            crop_target = 0.40

        if is_minimalist:
            base_whitespace = max(base_whitespace, 0.65)
            base_decor = min(base_decor, 0.10)
            decor_target = 0.05

        if is_editorial:
            drama_target = max(drama_target, 0.75)
            crop_target = max(crop_target, 0.60)

        # 3. Influência do Creative Seed (variação controlada proporcional a creativity_level)
        # Variance scale: de +/- 0.05 (conservador) a +/- 0.25 (experimental)
        variance = 0.05 + (creativity_level * 0.20)

        def perturb(val: float, weight: float = 1.0) -> float:
            delta = rng.uniform(-variance, variance) * weight
            return round(max(0.02, min(0.98, val + delta)), 3)

        # Geração dos valores perturbados deterministicamente
        symmetry = perturb(base_symmetry, 1.2)
        density = perturb(base_density, 0.8)
        whitespace = perturb(base_whitespace, 0.8)
        visual_energy = perturb(base_energy, 1.0)
        typographic_drama = perturb(drama_target, 1.0)
        image_dominance = perturb(base_image, 0.8)
        grid_rigidity = perturb(base_grid, 1.0)
        decorative_intensity = perturb(decor_target, 0.8)
        scale_contrast = perturb(scale_contrast_target, 1.0)
        crop_aggressiveness = perturb(crop_target, 1.2)

        # Parâmetros adicionais de exploração espacial
        overlap = perturb(0.15 + (creativity_level * 0.30), 1.0)
        experimentalism = perturb(0.20 + (creativity_level * 0.60), 1.0)
        axis_tension = perturb(0.25 + (creativity_level * 0.40), 1.0)

        # 4. Inviolabilidade das Restrições Negativas (Hard Constraints vencerem criatividade)
        if "NO_CARDS" in negatives:
            # Sem cards -> composição mais arejada e pura
            whitespace = max(whitespace, 0.45)
        if "NO_IMAGES" in negatives:
            image_dominance = 0.0
            crop_aggressiveness = 0.0
            typographic_drama = max(typographic_drama, 0.70)
        if "NO_DIAGONALS" in negatives:
            axis_tension = 0.0
        if "NO_OVERLAP" in negatives:
            overlap = 0.0

        # Normalização de coerência mútua (densidade + whitespace <= 1.0)
        if density + whitespace > 1.05:
            # Ajuste de equilíbrio
            factor = 1.0 / (density + whitespace)
            density = round(density * factor, 3)
            whitespace = round(whitespace * factor, 3)

        return VisualDNA(
            symmetry=symmetry,
            density=density,
            whitespace=whitespace,
            visual_energy=visual_energy,
            typographic_drama=typographic_drama,
            image_dominance=image_dominance,
            overlap=overlap,
            grid_rigidity=grid_rigidity,
            decorative_intensity=decorative_intensity,
            experimentalism=experimentalism,
            scale_contrast=scale_contrast,
            crop_aggressiveness=crop_aggressiveness,
            axis_tension=axis_tension,
            creativity_level=creativity_level,
        )
