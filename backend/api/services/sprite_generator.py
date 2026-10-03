import io
import os
import re
import uuid
import base64
import logging
from typing import Optional, Dict, Any, List
from django.conf import settings
from PIL import Image, ImageDraw

from api.ai.provider import get_ai_provider
from api.services.background_removal import BackgroundRemovalService

logger = logging.getLogger(__name__)


class SpriteGeneratorService:
    """
    Motor generativo de sprites, stickers e elementos visuais isolados para o Catana Studio.
    Conecta o Google Gemini Image / Imagen para sintese e o BackgroundRemovalService
    para isolamento perfeito com fundo transparente (canal alfa PNG).
    """

    @classmethod
    def generate_sprite(
        cls,
        prompt: str,
        palette: Optional[List[str]] = None,
        style: str = "editorial_sticker",
        catalog_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Gera uma sprite isolada e transparente a partir de uma descricao textual.
        Retorna dicionario com processed_url, width, height e prompt utilizado.
        """
        prompt_clean = prompt.strip()
        if not prompt_clean:
            raise ValueError("O prompt para geracao da sprite nao pode ser vazio.")

        # Engenharia de prompt estrita para obtencao de assets isolados em fundo solido branco
        prompt_used = (
            f"Isolated 2D graphic design sticker of {prompt_clean}. "
            f"Centered composition on a solid pure white background (#FFFFFF). "
            f"Flat vector art or clean editorial 3D object with sharp distinct edges, "
            f"no drop shadow, no frame, no borders, no text watermark, high resolution."
        )

        if palette and len(palette) > 0:
            clean_palette = [c.strip() for c in palette if c and isinstance(c, str)][:4]
            if clean_palette:
                prompt_used += f" Accent color palette: {', '.join(clean_palette)}."

        raw_bytes: Optional[bytes] = None
        source = "procedural_fallback"

        # 1. Tentativa de sintese via Google Gemini Image API
        provider = get_ai_provider()
        if provider and getattr(provider, "client", None):
            try:
                candidate_models = ["gemini-2.5-flash-image", "imagen-3.0-generate-002", "gemini-2.0-flash"]
                for model_name in candidate_models:
                    try:
                        res = provider.client.models.generate_content(
                            model=model_name,
                            contents=f"Generate an isolated clean graphic asset: {prompt_used}",
                        )
                        if res.candidates and res.candidates[0].content and res.candidates[0].content.parts:
                            for part in res.candidates[0].content.parts:
                                if getattr(part, "inline_data", None) and part.inline_data.data:
                                    raw_bytes = part.inline_data.data
                                    source = f"gemini_{model_name}"
                                    break
                        if raw_bytes:
                            break
                    except Exception as model_err:
                        logger.debug(f"[SpriteGenerator] Modelo {model_name} indisponivel: {model_err}")
            except Exception as ai_err:
                logger.info(f"[SpriteGenerator] API generativa Gemini indisponivel ({ai_err}). Utilizando gerador vetorial de contingencia.")

        # 2. Fallback procedural de alta definicao (para testes, ambiente offline ou contingencia)
        if not raw_bytes:
            raw_bytes = cls._generate_procedural_sprite(prompt_clean, palette)
            source = "procedural_engine"

        # 3. Isolamento neural / cromatico de fundo transparente (Alpha Masking)
        clean_slug = re.sub(r'[^a-zA-Z0-9_-]', '_', prompt_clean[:20]) or "sprite"
        filename = f"sprite_{clean_slug}_{uuid.uuid4().hex[:6]}.png"

        result = BackgroundRemovalService.process_and_save(raw_bytes, original_filename=filename)

        return {
            "sprite_url": result["processed_url"],
            "width": result["width"],
            "height": result["height"],
            "has_transparency": result.get("has_transparency", True),
            "file_size": result.get("file_size", len(raw_bytes)),
            "prompt_used": prompt_used,
            "source": source,
        }

    @classmethod
    def _generate_procedural_sprite(cls, prompt: str, palette: Optional[List[str]] = None) -> bytes:
        """
        Gera um asset visual vetorial/raster de alta resolucao sobre fundo branco solido
        para que o BackgroundRemovalService isole a transparencia de forma limpa.
        """
        img_size = (600, 600)
        img = Image.new("RGB", img_size, color=(255, 255, 255))
        draw = ImageDraw.Draw(img)

        # Escolha das cores principais
        primary_hex = palette[0] if palette and len(palette) > 0 else "#B08D57"
        accent_hex = palette[1] if palette and len(palette) > 1 else "#1E293B"

        def hex_to_rgb(h: str):
            h = h.lstrip('#')
            if len(h) == 6:
                return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))
            return (176, 141, 87)

        color1 = hex_to_rgb(primary_hex)
        color2 = hex_to_rgb(accent_hex)

        p_lower = prompt.lower()

        if any(w in p_lower for w in ["lata", "monster", "energetico", "can", "refrigerante", "drink", "bebida"]):
            # Lata estilizada de energetico (preta com detalhes em verde neon e gotas de condensacao)
            can_body = (18, 18, 20)
            neon_green = (57, 255, 20)
            silver = (210, 215, 220)

            # Topo da lata metálico
            draw.ellipse([210, 70, 390, 130], fill=silver, outline=(140, 145, 150), width=3)
            draw.ellipse([240, 85, 360, 115], fill=(160, 165, 170))
            draw.rectangle([285, 92, 315, 108], fill=(120, 125, 130))
            draw.ellipse([292, 96, 308, 104], fill=(210, 215, 220))

            # Corpo da lata
            draw.rectangle([210, 100, 390, 480], fill=can_body)
            # Base da lata
            draw.ellipse([210, 450, 390, 510], fill=can_body, outline=silver, width=2)
            draw.ellipse([225, 470, 375, 500], fill=(140, 145, 150))

            # Logo em garras verdes neon estilizadas
            draw.line([(265, 210), (255, 360)], fill=neon_green, width=12)
            draw.line([(295, 195), (295, 380)], fill=neon_green, width=14)
            draw.line([(325, 215), (335, 355)], fill=neon_green, width=12)

            # Brilho vertical metálico no corpo da lata
            for i in range(8):
                draw.line([(225 + i * 2, 102), (225 + i * 2, 475)], fill=(180, 185, 190), width=2)

            # Gotas de condensação sutis
            for dx, dy in [(240, 180), (360, 240), (235, 330), (365, 400), (280, 440)]:
                draw.ellipse([dx, dy, dx + 7, dy + 11], fill=(240, 245, 255))

        elif any(w in p_lower for w in ["meteoro", "cadente", "rastro", "shooting"]):
            # Rastro diagonal de meteoro com gradiente
            for step in range(18):
                thick = int(2 + step * 1.5)
                x1 = int(120 + step * 20)
                y1 = int(480 - step * 20)
                x2 = int(140 + step * 20)
                y2 = int(460 - step * 20)
                draw.line([(x1, y1), (x2, y2)], fill=color1, width=thick)
            # Cabeca do meteoro
            draw.ellipse([460, 100, 520, 160], fill=color1, outline=color2, width=3)
            draw.ellipse([475, 115, 505, 145], fill=(255, 255, 255))

        elif any(w in p_lower for w in ["selo", "badge", "carimbo", "stamp", "medalha"]):
            # Selo circular de luxo com aneis concentricos
            draw.ellipse([100, 100, 500, 500], fill=color1, outline=color2, width=6)
            draw.ellipse([130, 130, 470, 470], outline=(255, 255, 255), width=3)
            draw.ellipse([160, 160, 440, 440], fill=color2, outline=color1, width=4)
            # Detalhes em estrela central
            draw.polygon([(300, 220), (325, 275), (385, 280), (340, 320), (355, 380), (300, 345), (245, 380), (260, 320), (215, 280), (275, 275)], fill=color1)

        elif any(w in p_lower for w in ["estrela", "star", "brilho", "sparkle"]):
            # Estrela de 4 pontas luminescente com nucleo
            cx, cy = 300, 300
            pts = [
                (cx, cy - 220), (cx + 35, cy - 35),
                (cx + 220, cy), (cx + 35, cy + 35),
                (cx, cy + 220), (cx - 35, cy + 35),
                (cx - 220, cy), (cx - 35, cy - 35)
            ]
            draw.polygon(pts, fill=color1, outline=color2, width=2)
            draw.ellipse([cx - 20, cy - 20, cx + 20, cy + 20], fill=(255, 255, 255))

        elif any(w in p_lower for w in ["folha", "ramo", "planta", "organico", "oliveira"]):
            # Ramo com folhas estilizadas
            draw.arc([150, 150, 450, 500], start=120, end=300, fill=color2, width=5)
            # Folhas
            for leaf_y in [220, 280, 340, 400]:
                draw.ellipse([220, leaf_y - 25, 280, leaf_y + 25], fill=color1, outline=color2, width=2)
                draw.ellipse([320, leaf_y - 15, 380, leaf_y + 35], fill=color1, outline=color2, width=2)

        else:
            # Emblema geometrico de alta fidelidade
            draw.ellipse([150, 150, 450, 450], fill=color1, outline=color2, width=5)
            draw.rectangle([220, 220, 380, 380], fill=color2, outline=(255, 255, 255), width=3)
            draw.ellipse([270, 270, 330, 330], fill=color1)

        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        return buffer.getvalue()
