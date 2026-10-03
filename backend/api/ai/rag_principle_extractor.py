"""
RAG Principle Extractor - Extrator de Princípios de Direção de Arte Editorial.
Transforma templates e referências recuperadas pelo RAG em princípios de design abstratos
(escala, comportamento de imagem, ritmo e malha), NUNCA copiando coordenadas ou layouts rígidos.
"""
from typing import Dict, Any, List, Optional
import logging

logger = logging.getLogger(__name__)


class RAGPrincipleExtractor:
    """
    Extrator de Princípios Estéticos do RAG.
    Alimenta o CreativeDirector com diretrizes compositivas de alto nível.
    """

    @classmethod
    def extract_principles(cls, rag_context: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Extrai princípios estilísticos das referências recuperadas sem acoplamento a coordenadas.
        """
        if not rag_context or not isinstance(rag_context, dict):
            return {
                "scale_contrast": "high",
                "image_behavior": "cropped_editorial",
                "rhythm": "slow-fast-slow",
                "grid_behavior": "modular_loose",
                "chromatic_tendency": "balanced_editorial",
                "references_consulted": 0,
            }

        synthesis_data = rag_context.get("synthesis_data", {})
        references = rag_context.get("retrieved_templates") or rag_context.get("top_k_templates") or []

        # 1. Escala e Contraste
        has_luxury = any("luxo" in str(r).lower() or "alta" in str(r).lower() for r in references)
        has_tech = any("tecn" in str(r).lower() or "b2b" in str(r).lower() for r in references)
        has_minimal = any("clean" in str(r).lower() or "minimal" in str(r).lower() for r in references)

        if has_luxury:
            scale_contrast = "extreme_contrast"
            img_behavior = "monumental_bleed"
            grid_behavior = "single_axis_asymmetric"
        elif has_tech:
            scale_contrast = "disciplined_hierarchy"
            img_behavior = "spec_framing"
            grid_behavior = "strict_12_column"
        elif has_minimal:
            scale_contrast = "subtle_scale_jump"
            img_behavior = "floating_detail"
            grid_behavior = "modular_loose"
        else:
            scale_contrast = "high"
            img_behavior = "cropped_editorial"
            grid_behavior = "modular_loose"

        # 2. Ritmo
        rhythm = "slow-fast-slow" if not has_tech else "dense_flow"

        return {
            "scale_contrast": scale_contrast,
            "image_behavior": img_behavior,
            "rhythm": rhythm,
            "grid_behavior": grid_behavior,
            "chromatic_tendency": synthesis_data.get("style", "balanced_editorial"),
            "references_consulted": len(references),
        }
