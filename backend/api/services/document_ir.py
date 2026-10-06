"""Shared, JSON-safe contract for the existing document import coordinator.

Page dimensions use PDF points. Element rectangles use normalized coordinates,
with their origin at the top left of the rotated, cropped source page. Original
PDF boxes remain unmodified for provenance. Source pixels are never discarded.
"""

import hashlib
import math
from typing import Any, Callable, Dict, List, Literal, Protocol, Tuple, TypedDict

from api.services.document_preflight import (
    DocumentImportError, MAX_SOURCE_BYTES, MAX_PAGES, MAX_PAGE_PIXELS,
    MAX_TOTAL_PIXELS, MAX_ASSETS, MAX_ELEMENTS_PER_PAGE, MAX_PROCESSING_SECONDS,
)


SCHEMA_VERSION = 1
MAX_WORKER_MEMORY_BYTES = 768 * 1024 * 1024
SNAPSHOT_SCALE = 2.0  # 144 dpi, with a documented pixel budget.

AssetSink = Callable[[bytes, str, str], Dict[str, Any]]


class OCRTextElement(TypedDict):
    """Uncertain recognized text tied to the exact inert source-page snapshot.

    sourceHash is SHA-256 of the supplied snapshot bytes; sourcePage is one-based.
    The bounding box is (left, top, right, bottom) in rotated/cropped page points.
    Confidence must be finite and between zero and one. Text remains recognized
    evidence, rather than an authoritative replacement for the original page.
    """

    sourceHash: str
    sourcePage: int
    sourceBoundingBox: Tuple[float, float, float, float]
    coordinateSpace: Literal["display_top_left_pt"]
    confidence: float
    text: str


class OCRProvider(Protocol):
    """Optional future OCR boundary; no provider is configured or invoked here.

    Providers consume inert snapshot bytes, never source instructions or URLs.
    A future caller must validate hashes, page identity, finite geometry and
    confidence before accepting output. Recognized text cannot overwrite source
    snapshots; low-confidence output cannot become an editable overlay without
    independent validation. The current adapter reports ocrAvailable=False.
    """

    def recognize_page(
        self, snapshot_bytes: bytes, *, source_hash: str, page_number: int,
        width: float, height: float,
    ) -> List[OCRTextElement]: ...


class DocumentImportAdapter(Protocol):
    @classmethod
    def analyze(cls, file_bytes: bytes, filename: str, asset_sink: AssetSink) -> Dict[str, Any]: ...


def fingerprint(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def finite_box(values):
    box = [float(value) for value in values]
    if len(box) != 4 or not all(math.isfinite(value) for value in box):
        raise DocumentImportError("invalid_geometry", "O PDF contém geometria de página inválida.")
    return box


def provenance(page_number, element_id, box, text=None, confidence=1.0):
    return {
        "sourcePage": page_number,
        "sourceElement": element_id,
        "sourceBoundingBox": [round(float(value), 6) for value in box],
        "coordinateSpace": "display_top_left_pt",
        "sourceText": text,
        "sourceTextHash": fingerprint(text.encode("utf-8")) if text is not None else None,
        "confidence": confidence,
    }


def validate_document_ir(document):
    """Guard the acceptance invariant without silently repairing source pages."""
    pages = document.get("pages", [])
    if document.get("schemaVersion") != SCHEMA_VERSION or document.get("pageCount") != len(pages):
        raise DocumentImportError("invalid_document_ir", "A análise do documento ficou incompleta.")
    for number, page in enumerate(pages, 1):
        snapshot = page.get("sourceSnapshot") or {}
        if (page.get("pageNumber") != number or page.get("unit") != "pt"
                or not all(math.isfinite(page.get(k, 0)) and page.get(k, 0) > 0 for k in ("width", "height"))
                or not snapshot.get("url") or not snapshot.get("hash")
                or not snapshot.get("widthPixels") or not snapshot.get("heightPixels")):
            raise DocumentImportError("invalid_document_ir", "Uma página não possui representação original válida.")
    return document
