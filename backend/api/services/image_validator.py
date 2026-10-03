import io
import logging
from typing import Tuple, Optional
from PIL import Image

logger = logging.getLogger(__name__)

# Formatos permitidos e seguros para imagem web e editorial
ALLOWED_IMAGE_FORMATS = {'PNG', 'JPEG', 'WEBP'}
ALLOWED_MIME_TYPES = {'image/png', 'image/jpeg', 'image/pjpeg', 'image/webp'}
MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB


def validate_image_file(
    file_obj,
    max_size: int = MAX_UPLOAD_SIZE_BYTES,
    allowed_formats: set = ALLOWED_IMAGE_FORMATS,
) -> Tuple[bool, Optional[str], Optional[str]]:
    """
    Valida rigorosamente um arquivo de imagem contra ataques de upload malicioso:
    1. Verifica se o arquivo nao esta vazio (size > 0).
    2. Valida o limite de tamanho maximo.
    3. Analisa os Magic Bytes reais decodificando com PIL (Image.open + verify).
    4. Rejeita formatos perigosos/ativos (HTML, SVG com scripts, executaveis, macros).
    5. Garante que o formato real pertenca a lista de formatos confiaveis.
    6. Rebobina o ponteiro do arquivo (seek(0)).

    Retorna: (is_valid, detected_format, error_message)
    """
    if not file_obj:
        return False, None, "Nenhum arquivo de imagem fornecido."

    # 1. Verifica tamanho
    size = getattr(file_obj, 'size', None)
    if size is None:
        try:
            cur = file_obj.tell()
            file_obj.seek(0, io.SEEK_END)
            size = file_obj.tell()
            file_obj.seek(cur)
        except Exception:
            size = 0

    if size <= 0:
        return False, None, "Arquivo de imagem vazio ou corrompido (tamanho 0 bytes)."

    if size > max_size:
        max_mb = max_size / (1024 * 1024)
        return False, None, f"Arquivo excede o tamanho maximo permitido de {max_mb:.1f} MB."

    # 2. Inspeciona magic bytes e estrutura via PIL
    try:
        # Se for UploadedFile do Django ou BytesIO
        file_obj.seek(0)
        img = Image.open(file_obj)
        img.verify()  # Inspeciona integridade de cabecalho e magic bytes
        detected_format = (img.format or '').upper()

        # Normalizacao de JPEG
        if detected_format == 'JPG':
            detected_format = 'JPEG'

        if detected_format not in allowed_formats:
            return (
                False,
                detected_format,
                f"Formato '{detected_format}' nao permitido. Formatos aceitos: {', '.join(sorted(allowed_formats))}."
            )

        # Reabre para verificar que nao ha payload corrompido nos blocos de imagem
        file_obj.seek(0)
        img_load = Image.open(file_obj)
        img_load.load()

        file_obj.seek(0)
        return True, detected_format, None

    except Exception as exc:
        logger.warning("Falha na validacao de imagem por magic bytes: %s", exc)
        return False, None, "Arquivo corrompido, formato adulterado ou nao reconhecido como imagem valida."


def validate_image_bytes(
    raw_bytes: bytes,
    max_size: int = MAX_UPLOAD_SIZE_BYTES,
    allowed_formats: set = ALLOWED_IMAGE_FORMATS,
) -> Tuple[bool, Optional[str], Optional[str]]:
    """
    Valida bytes em memoria (ex.: recebidos via base64 ou leitura crua).
    """
    if not raw_bytes:
        return False, None, "Conteudo de imagem vazio."

    if len(raw_bytes) > max_size:
        max_mb = max_size / (1024 * 1024)
        return False, None, f"Imagem excede o limite de {max_mb:.1f} MB."

    stream = io.BytesIO(raw_bytes)
    return validate_image_file(stream, max_size=max_size, allowed_formats=allowed_formats)
