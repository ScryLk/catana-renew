import io
import os
import uuid
import math
import logging
from typing import Optional, Dict, Any, Tuple
from django.conf import settings
from PIL import Image, ImageFilter

logger = logging.getLogger(__name__)

try:
    import rembg
    HAS_REMBG = True
except ImportError:
    HAS_REMBG = False


class BackgroundRemovalService:
    """
    Servico de remocao de fundo e isolamento de produtos para o Catana 2.0.
    Emprega rembg (U2-Net) quando disponivel no ambiente, com fallback nativo
    robusto baseado em Pillow com amostragem de bordas e suavizacao alfa gaussiana.
    """

    @classmethod
    def remove_background(cls, image_bytes: bytes, tolerance: int = 35) -> bytes:
        """
        Recebe bytes de uma imagem e devolve bytes em formato PNG com canal alfa transparente.
        """
        # 1. Tentativa via rembg neural
        if HAS_REMBG:
            try:
                output_bytes = rembg.remove(image_bytes)
                if output_bytes:
                    return output_bytes
            except Exception as exc:
                logger.warning(f"[BackgroundRemoval] Falha no rembg ({exc}). Utilizando fallback Pillow.")

        # 2. Fallback deterministico com Pillow
        return cls._pillow_remove_background(image_bytes, tolerance=tolerance)

    @classmethod
    def _pillow_remove_background(cls, image_bytes: bytes, tolerance: int = 35) -> bytes:
        """
        Algoritmo nativo de isolamento por amostragem cromatica periférica e feathering alfa.
        """
        img = Image.open(io.BytesIO(image_bytes)).convert("RGBA")
        width, height = img.size

        # Amostra as cores dos cantos e bordas para detectar a cor do fundo
        border_pixels = []
        # Cantos
        border_pixels.append(img.getpixel((0, 0)))
        border_pixels.append(img.getpixel((width - 1, 0)))
        border_pixels.append(img.getpixel((0, height - 1)))
        border_pixels.append(img.getpixel((width - 1, height - 1)))
        # Meios das bordas
        border_pixels.append(img.getpixel((width // 2, 0)))
        border_pixels.append(img.getpixel((width // 2, height - 1)))
        border_pixels.append(img.getpixel((0, height // 2)))
        border_pixels.append(img.getpixel((width - 1, height // 2)))

        # Calcula a media da cor de fundo (RGB)
        avg_r = sum(p[0] for p in border_pixels) // len(border_pixels)
        avg_g = sum(p[1] for p in border_pixels) // len(border_pixels)
        avg_b = sum(p[2] for p in border_pixels) // len(border_pixels)

        # Se os cantos forem predominantemente claros (caso de 98% dos catalogos e e-commerces)
        if avg_r > 200 and avg_g > 200 and avg_b > 200:
            target_r, target_g, target_b = 255, 255, 255
            effective_tol = max(tolerance, 40)
        else:
            target_r, target_g, target_b = avg_r, avg_g, avg_b
            effective_tol = tolerance

        feather_range = 25
        datas = img.getdata()
        new_data = []

        for item in datas:
            r, g, b = item[0], item[1], item[2]
            # Distancia euclidiana no espaco de cores
            dist = math.sqrt((r - target_r) ** 2 + (g - target_g) ** 2 + (b - target_b) ** 2)

            if dist <= effective_tol:
                # Totalmente transparente
                new_data.append((r, g, b, 0))
            elif dist < effective_tol + feather_range:
                # Zona de transicao suave (feathering)
                alpha_factor = (dist - effective_tol) / feather_range
                alpha = int(255 * alpha_factor)
                new_data.append((r, g, b, alpha))
            else:
                # Mantem opaco
                new_data.append((r, g, b, 255))

        img.putdata(new_data)

        # Suaviza levemente a mascara para eliminar artefatos dentados
        alpha = img.split()[-1]
        alpha = alpha.filter(ImageFilter.SMOOTH_MORE)
        img.putalpha(alpha)

        output_io = io.BytesIO()
        img.save(output_io, format="PNG", optimize=True)
        return output_io.getvalue()

    @classmethod
    def process_and_save(cls, image_bytes: bytes, original_filename: str = "product.jpg") -> Dict[str, Any]:
        """
        Executa a remocao de fundo e grava o arquivo resultante no diretorio media do Django.
        """
        nobg_bytes = cls.remove_background(image_bytes)

        media_root = getattr(settings, 'MEDIA_ROOT', os.path.join(settings.BASE_DIR, 'media'))
        studio_dir = os.path.join(media_root, 'studio', 'transparent')
        os.makedirs(studio_dir, exist_ok=True)

        base_name, _ = os.path.splitext(os.path.basename(original_filename))
        unique_name = f"{base_name}-nobg-{uuid.uuid4().hex[:8]}.png"
        file_path = os.path.join(studio_dir, unique_name)

        with open(file_path, "wb") as f:
            f.write(nobg_bytes)

        media_url = getattr(settings, 'MEDIA_URL', '/media/')
        relative_url = f"{media_url}studio/transparent/{unique_name}"

        img = Image.open(io.BytesIO(nobg_bytes))
        return {
            "processed_url": relative_url,
            "width": img.width,
            "height": img.height,
            "has_transparency": True,
            "file_size": len(nobg_bytes),
        }
