"""Inert PDF inspection shared by the existing document importer and its worker.

This module does not extract streams, write files, fetch URLs, or interpret source
text as instructions. Parsing must run inside the importer's bounded subprocess:
application checks alone cannot interrupt a hostile native/parser operation.
"""
import hashlib
import io
import math
from pathlib import PurePath
import re
from urllib.parse import unquote, urlsplit

from pypdf import PdfReader
from pypdf.errors import LimitReachedError
from pypdf.generic import ArrayObject, DictionaryObject, IndirectObject


MAX_SOURCE_BYTES = 25 * 1024 * 1024
MAX_PAGES = 50
MAX_PAGE_PIXELS = 12_000_000
MAX_TOTAL_PIXELS = 120_000_000
MAX_EXTRACTED_OBJECTS = 20_000
MAX_ELEMENTS_PER_PAGE = 5_000
MAX_ASSETS = 500
MAX_ASSET_BYTES = 128 * 1024 * 1024
MAX_PROCESSING_SECONDS = 45
MAX_WORKER_MEMORY_BYTES = 768 * 1024 * 1024
MAX_METADATA_STRING_BYTES = 1024 * 1024
MAX_METADATA_TOTAL_BYTES = 8 * 1024 * 1024
MAX_GRAPH_NODES = 200_000
MAX_GRAPH_DEPTH = 64
MAX_PAGE_DIMENSION_POINTS = 14_400


_PUBLIC_DOCUMENT_ERRORS = {
    'document_empty': ('document_empty', 'Envie um arquivo PDF não vazio.', 400),
    'document_too_large': ('document_too_large', 'O limite de importação é de 25 MB.', 413),
    'file_too_large': ('file_too_large', 'O documento excede o limite de 25 MB.', 413),
    'document_invalid_filename': ('document_invalid_filename', 'O nome do documento é inválido.', 400),
    'document_docx_unsupported': ('document_docx_unsupported', 'DOCX ainda não é suportado. Exporte o documento para PDF.', 415),
    'document_type_unsupported': ('document_type_unsupported', 'A importação aceita arquivos PDF.', 415),
    'document_mime_mismatch': ('document_mime_mismatch', 'O tipo informado não corresponde a um PDF.', 415),
    'document_invalid_pdf': ('document_invalid_pdf', 'O PDF está malformado ou não pode ser importado com segurança.', 422),
    'document_active_content': ('document_active_content', 'Utilize um PDF sem scripts, ações ativas ou arquivos anexados.', 422),
    'document_forms_unsupported': ('document_forms_unsupported', 'Exporte o PDF com os campos de formulário achatados antes de importar.', 422),
    'document_invalid_geometry': ('document_invalid_geometry', 'O PDF contém dimensões ou geometria de página inválidas.', 422),
    'document_encrypted': ('document_encrypted', 'Utilize um PDF sem criptografia ou senha.', 422),
    'document_empty_pdf': ('document_empty_pdf', 'O PDF não contém páginas.', 422),
    'document_geometry_unsupported': ('document_geometry_unsupported', 'A escala UserUnit deste PDF ainda não é suportada. Exporte com escala padrão.', 422),
    'document_resource_limit': ('document_resource_limit', 'O PDF excede os limites de processamento. Reduza as páginas (até 50), a resolução ou a complexidade.', 422),
    'file_size': ('file_size', 'O arquivo está vazio ou excede o limite de importação.', 422),
    'processing_timeout': ('processing_timeout', 'O PDF excedeu o tempo seguro de processamento.', 422),
    'processing_failed': ('processing_failed', 'Não foi possível processar este PDF com segurança.', 422),
    'asset_limit': ('asset_limit', 'O PDF excede o limite seguro de imagens extraídas.', 422),
    'page_count_mismatch': ('page_count_mismatch', 'A contagem de páginas do PDF não pôde ser validada.', 422),
    'invalid_geometry': ('invalid_geometry', 'O PDF contém geometria inválida.', 422),
    'pixel_limit': ('pixel_limit', 'O PDF excede o limite seguro de resolução total.', 422),
    'source_render_failed': ('source_render_failed', 'Uma página do PDF não pôde ser preservada. A importação foi interrompida.', 422),
    'source_not_preserved': ('source_not_preserved', 'Não foi possível preservar todas as páginas.', 422),
    'invalid_document_ir': ('invalid_document_ir', 'A análise do documento ficou incompleta ou uma página não possui representação original válida.', 422),
    'invalid_pdf': ('invalid_pdf', 'Não foi possível ler ou renderizar este PDF.', 422),
    'document_import_failed': ('document_import_failed', 'Não foi possível concluir a importação. Tente novamente.', 500),
}


def public_document_error(code):
    """Select fixed public values; worker/exception messages and statuses are never copied."""
    known = _PUBLIC_DOCUMENT_ERRORS.get(code) if type(code) is str else None
    public_code, message, status_code = known or _PUBLIC_DOCUMENT_ERRORS['processing_failed']
    return {'code': public_code, 'error': message}, status_code


class DocumentImportError(Exception):
    """A classified failure whose public details come only from the static allowlist."""

    def __init__(self, code, message=None, status_code=422):
        # Keep the existing call signature while discarding dynamic parser/worker
        # details. The API maps the code again to guard against mutated attributes.
        public, public_status = public_document_error(code)
        super().__init__(public['error'])
        self.code = public['code']
        self.message = public['error']
        self.status_code = public_status


def _limit(message):
    raise DocumentImportError('document_resource_limit', message)


def validate_source_file(file_bytes, filename, content_type='application/pdf'):
    """Validate the supported source envelope before allocating a PDF parser."""
    if not isinstance(file_bytes, bytes) or not file_bytes:
        raise DocumentImportError('document_empty', 'Envie um arquivo PDF não vazio.', 400)
    if len(file_bytes) > MAX_SOURCE_BYTES:
        raise DocumentImportError('document_too_large', 'O limite de importação é de 25 MB.', 413)
    if not isinstance(filename, str) or len(filename) > 255 or any(ord(char) < 32 for char in filename):
        raise DocumentImportError('document_invalid_filename', 'O nome do documento é inválido.', 400)
    extension = PurePath(filename).suffix.lower()
    if extension == '.docx':
        # Never open the ZIP container until a bounded, faithful adapter exists.
        raise DocumentImportError('document_docx_unsupported', 'DOCX ainda não é suportado. Exporte o documento para PDF.', 415)
    if extension != '.pdf':
        raise DocumentImportError('document_type_unsupported', 'A importação aceita arquivos PDF.', 415)
    mime = (content_type or '').split(';', 1)[0].strip().lower()
    if mime not in ('', 'application/pdf', 'application/x-pdf', 'application/octet-stream'):
        raise DocumentImportError('document_mime_mismatch', 'O tipo informado não corresponde a um PDF.', 415)
    if not re.match(br'%PDF-(?:1\.[0-7]|2\.0)(?:[\r\n \t]|$)', file_bytes[:16]):
        raise DocumentImportError('document_invalid_pdf', 'O arquivo não contém um cabeçalho PDF válido.')
    return {'file_type': 'pdf', 'source_hash': hashlib.sha256(file_bytes).hexdigest(), 'size_bytes': len(file_bytes)}


_ACTIVE_KEYS = {'/OpenAction', '/AA', '/JS', '/JavaScript', '/EmbeddedFiles', '/EF', '/AF', '/XFA',
                '/RichMediaContent', '/RichMediaSettings'}
_ACTIVE_ACTIONS = {'/JavaScript', '/Launch', '/GoToR', '/GoToE', '/SubmitForm', '/ImportData',
                   '/Rendition', '/RichMediaExecute', '/Sound', '/Movie'}
_ACTIVE_SUBTYPES = {'/FileAttachment', '/RichMedia', '/Movie', '/Sound', '/3D', '/Screen'}


def _reject_active_content():
    raise DocumentImportError('document_active_content', 'Utilize um PDF sem scripts, ações ativas ou arquivos anexados.')


def _safe_inert_uri(value):
    # A retained URI is data only. Neither this inspector nor the renderer opens it.
    if not isinstance(value, str) or len(value) > 2048:
        _reject_active_content()
    decoded = value
    for _ in range(3):
        decoded = unquote(decoded)
    if '\\' in decoded or any(ord(char) < 32 for char in decoded):
        _reject_active_content()
    try:
        parts = urlsplit(decoded)
        if parts.scheme.lower() not in ('http', 'https', 'mailto'):
            _reject_active_content()
        if parts.scheme.lower() in ('http', 'https') and not parts.hostname:
            _reject_active_content()
    except ValueError:
        _reject_active_content()


def _inspect_objects(reader):
    """Walk raw dictionaries, including indirect annotation/actions and unused objects.

    Stream dictionaries are inspected without decoding their content. The worker
    provides the hard boundary for xref/object-stream decompression during parsing.
    """
    references = {(generation, number) for generation, entries in reader.xref.items()
                  for number in entries if number > 0 and not reader.xref_free_entry.get(generation, {}).get(number, False)}
    references.update((0, number) for number in reader.xref_objStm)
    if len(references) > MAX_EXTRACTED_OBJECTS:
        _limit('O PDF excede o limite de objetos suportados.')
    visited_references = set()
    visited_containers = set()
    nodes = 0
    metadata_bytes = 0
    image_count = 0
    image_pixels = 0

    def seeds():
        yield reader.trailer
        for generation, number in references:
            yield IndirectObject(number, generation, reader)

    for seed in seeds():
        stack = [(seed, 0)]
        while stack:
            value, depth = stack.pop()
            nodes += 1
            if nodes > MAX_GRAPH_NODES or depth > MAX_GRAPH_DEPTH:
                _limit('A estrutura do PDF excede os limites de complexidade.')
            if isinstance(value, IndirectObject):
                key = (value.generation, value.idnum)
                if key in visited_references:
                    continue
                visited_references.add(key)
                if len(visited_references) > MAX_EXTRACTED_OBJECTS:
                    _limit('O PDF excede o limite de objetos suportados.')
                resolved = value.get_object()
                if resolved is None:
                    raise DocumentImportError('document_invalid_pdf', 'O PDF contém referências inválidas.')
                stack.append((resolved, depth + 1))
                continue
            if isinstance(value, (DictionaryObject, ArrayObject)):
                key = id(value)
                if key in visited_containers:
                    continue
                visited_containers.add(key)
                if isinstance(value, DictionaryObject):
                    action = value['/S'] if '/S' in value else None
                    object_type = value['/Type'] if '/Type' in value else None
                    subtype = value['/Subtype'] if '/Subtype' in value else None
                    if _ACTIVE_KEYS.intersection(value) or action in _ACTIVE_ACTIONS:
                        _reject_active_content()
                    if object_type == '/EmbeddedFile' or subtype in _ACTIVE_SUBTYPES:
                        _reject_active_content()
                    if subtype == '/Widget' or ('/AcroForm' in value and value['/AcroForm'].get('/Fields')):
                        raise DocumentImportError('document_forms_unsupported', 'Exporte o PDF com os campos de formulário achatados antes de importar.')
                    if '/URI' in value:
                        uri = value['/URI']
                        _safe_inert_uri(uri)
                    if subtype == '/Image':
                        width = _positive_number(value.get('/Width'), 'imagem')
                        height = _positive_number(value.get('/Height'), 'imagem')
                        pixels = width * height
                        image_count += 1
                        image_pixels += pixels
                        if pixels > MAX_PAGE_PIXELS or image_pixels > MAX_TOTAL_PIXELS or image_count > MAX_ASSETS:
                            _limit('As imagens incorporadas excedem os limites de processamento.')
                    children = value.values()
                else:
                    children = value
                if len(value) > MAX_GRAPH_NODES - nodes:
                    _limit('A estrutura do PDF excede os limites de complexidade.')
                stack.extend((item, depth + 1) for item in children)
            elif isinstance(value, (str, bytes)):
                length = len(value.encode('utf-8')) if isinstance(value, str) else len(value)
                metadata_bytes += length
                if length > MAX_METADATA_STRING_BYTES or metadata_bytes > MAX_METADATA_TOTAL_BYTES:
                    _limit('Os metadados do PDF excedem os limites de processamento.')


def _positive_number(value, kind):
    if isinstance(value, IndirectObject):
        value = value.get_object()
    number = float(value)
    if not math.isfinite(number) or number <= 0:
        raise DocumentImportError('document_invalid_geometry', f'O PDF contém dimensões inválidas de {kind}.')
    return number


def _box_values(box):
    values = [float(number.get_object() if isinstance(number, IndirectObject) else number) for number in box]
    if len(values) != 4 or not all(math.isfinite(number) for number in values) or values[2] <= values[0] or values[3] <= values[1]:
        raise DocumentImportError('document_invalid_geometry', 'O PDF contém caixas de página inválidas.')
    return values


def validate_pdf(file_bytes, filename, content_type='application/pdf'):
    """Inspect a PDF inside the bounded worker and return trusted structural metadata."""
    result = validate_source_file(file_bytes, filename, content_type)
    try:
        reader = PdfReader(io.BytesIO(file_bytes), strict=True)
        if reader.is_encrypted:
            raise DocumentImportError('document_encrypted', 'Utilize um PDF sem criptografia ou senha.')
        root = reader.trailer['/Root']
        declared_count = int(root['/Pages']['/Count'])
        if declared_count > MAX_PAGES:
            _limit('O limite de importação é de 50 páginas.')
        _inspect_objects(reader)
        count = len(reader.pages)
        if count == 0:
            raise DocumentImportError('document_empty_pdf', 'O PDF não contém páginas.')
        if count > MAX_PAGES:
            _limit('O limite de importação é de 50 páginas.')
        pages = []
        for index, page in enumerate(reader.pages):
            media_box = _box_values(page.mediabox)
            crop_box = _box_values(page.cropbox)
            bleed_box = _box_values(page.bleedbox)
            visible_box = [max(media_box[0], crop_box[0]), max(media_box[1], crop_box[1]),
                           min(media_box[2], crop_box[2]), min(media_box[3], crop_box[3])]
            _box_values(visible_box)
            unit = _positive_number(page.get('/UserUnit', 1), 'página')
            if unit != 1:
                raise DocumentImportError('document_geometry_unsupported', 'A escala UserUnit deste PDF ainda não é suportada. Exporte com escala padrão.')
            width = (visible_box[2] - visible_box[0]) * unit
            height = (visible_box[3] - visible_box[1]) * unit
            if max(width, height) > MAX_PAGE_DIMENSION_POINTS:
                _limit('As dimensões da página excedem os limites de processamento.')
            raw_rotation = float(page['/Rotate'] if '/Rotate' in page else 0)
            if not math.isfinite(raw_rotation) or not raw_rotation.is_integer() or raw_rotation % 90:
                raise DocumentImportError('document_invalid_geometry', 'A rotação de página do PDF não é suportada.')
            rotation = int(raw_rotation) % 360
            if rotation in (90, 270):
                width, height = height, width
            pages.append({'index': index, 'width': width, 'height': height, 'rotation': rotation,
                          'media_box': media_box, 'crop_box': crop_box, 'bleed_box': bleed_box,
                          'user_unit': unit})
        result.update(page_count=count, pages=pages)
        return result
    except DocumentImportError:
        raise
    except (MemoryError, LimitReachedError, RecursionError):
        raise DocumentImportError('document_resource_limit') from None
    except Exception:
        # Source strings and parser exceptions may contain confidential document data.
        raise DocumentImportError('document_invalid_pdf') from None
