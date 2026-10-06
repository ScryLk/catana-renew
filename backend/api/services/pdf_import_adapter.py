"""Inert PDF geometry extraction behind the existing importer.

PDFium is Apache/BSD licensed. It renders every source page before attempting
progressive reconstruction. Parsing runs in a bounded process, never in a
PDFium thread, and storage callbacks execute only in the authenticated parent.
"""

import base64
import ctypes
import io
import json
import math
from pathlib import Path
import subprocess
import sys
import time
import re
from typing import Any, Dict

from api.services.document_ir import (
    AssetSink, DocumentImportError, MAX_ASSETS, MAX_ELEMENTS_PER_PAGE,
    MAX_PAGE_PIXELS, MAX_PROCESSING_SECONDS, MAX_SOURCE_BYTES, MAX_TOTAL_PIXELS,
    MAX_WORKER_MEMORY_BYTES, SCHEMA_VERSION, SNAPSHOT_SCALE, fingerprint,
    provenance, validate_document_ir,
)
from api.services.document_preflight import (
    MAX_ASSET_BYTES, public_document_error, validate_pdf, validate_source_file,
)


class PdfImportAdapter:
    @classmethod
    def analyze(cls, file_bytes: bytes, filename: str, asset_sink: AssetSink) -> Dict[str, Any]:
        if not file_bytes or len(file_bytes) > MAX_SOURCE_BYTES:
            raise DocumentImportError("file_size", "O arquivo está vazio ou excede o limite de importação.")
        # This cheap envelope check runs before launch; untrusted PDF parsing
        # remains isolated. Filename is UI/storage metadata, never process argv.
        validate_source_file(file_bytes, filename)
        command = [sys.executable, "-m", "api.services.pdf_import_adapter", "--worker"]
        started = time.monotonic()
        process = subprocess.Popen(command, cwd=str(Path(__file__).resolve().parents[2]),
                                   stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
        try:
            output, _ = process.communicate(file_bytes, timeout=MAX_PROCESSING_SECONDS)
        except subprocess.TimeoutExpired:
            process.kill()
            process.communicate()
            raise DocumentImportError("processing_timeout", "O PDF excedeu o tempo seguro de processamento.") from None
        if process.returncode != 0 or len(output) > MAX_ASSET_BYTES * 2 + 8_000_000:
            raise DocumentImportError("processing_failed", "Não foi possível processar este PDF com segurança.")
        try:
            payload = json.loads(output)
        except (ValueError, UnicodeError):
            raise DocumentImportError("processing_failed", "Não foi possível processar este PDF com segurança.") from None
        if not isinstance(payload, dict):
            raise DocumentImportError("processing_failed")
        if "error" in payload:
            error = payload["error"]
            # Worker messages/statuses are never authoritative public output.
            raise DocumentImportError(error.get("code") if isinstance(error, dict) else None)
        assets = payload["assets"]
        if len(assets) > MAX_ASSETS:
            raise DocumentImportError("asset_limit", "O PDF excede o limite seguro de imagens extraídas.")
        saved_assets = []
        total_asset_bytes = 0
        for asset in assets:
            raw = base64.b64decode(asset["data"], validate=True)
            total_asset_bytes += len(raw)
            if total_asset_bytes > MAX_ASSET_BYTES:
                raise DocumentImportError("asset_limit", "O PDF excede o limite seguro de imagens extraídas.")
            saved = asset_sink(raw, asset["name"], asset["kind"])
            saved_assets.append({**saved, "hash": fingerprint(raw),
                                 "widthPixels": asset["widthPixels"], "heightPixels": asset["heightPixels"]})

        def resolve(value):
            if isinstance(value, dict):
                if "assetRef" in value:
                    return dict(saved_assets[value["assetRef"]])
                return {key: resolve(item) for key, item in value.items()}
            if isinstance(value, list):
                return [resolve(item) for item in value]
            return value

        document = resolve(payload["document"])
        for page in document["pages"]:
            for element in page["elements"]:
                if element.get("imageAsset"):
                    element["imageUrl"] = element["imageAsset"]["url"]
        document["report"]["processingSeconds"] = round(time.monotonic() - started, 3)
        return validate_document_ir(document)


class _Assets:
    def __init__(self):
        self.items = []
        self.bytes = 0

    def image(self, image, name, kind):
        stream = io.BytesIO()
        image.save(stream, format="PNG")
        raw = stream.getvalue()
        if len(self.items) >= MAX_ASSETS or self.bytes + len(raw) > MAX_ASSET_BYTES:
            raise DocumentImportError("asset_limit", "O PDF excede o limite seguro de imagens extraídas.")
        reference = {"assetRef": len(self.items), "hash": fingerprint(raw),
                     "widthPixels": image.width, "heightPixels": image.height}
        self.items.append({"data": base64.b64encode(raw).decode("ascii"), "name": name,
                           "kind": kind, "widthPixels": image.width, "heightPixels": image.height})
        self.bytes += len(raw)
        return reference


def _worker_limits():
    import resource
    resource.setrlimit(resource.RLIMIT_AS, (MAX_WORKER_MEMORY_BYTES, MAX_WORKER_MEMORY_BYTES))
    resource.setrlimit(resource.RLIMIT_CPU, (MAX_PROCESSING_SECONDS, MAX_PROCESSING_SECONDS + 1))
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))


def _render(page, scale):
    # No form environment is initialized; PDFs with interactive fields are rejected.
    bitmap = page.render(scale=scale, draw_annots=True, may_draw_forms=False,
                         limit_image_cache=True, rev_byteorder=True)
    try:
        return bitmap.to_pil().convert("RGB").copy()
    finally:
        bitmap.close()


def _display_box(box, visible_box, rotation):
    left, bottom, right, top = visible_box
    width, height = right - left, top - bottom

    def point(x, y):
        x, y = x - left, y - bottom
        if rotation == 90:
            return y, x
        if rotation == 180:
            return width - x, y
        if rotation == 270:
            return height - y, width - x
        return x, height - y

    corners = [point(x, y) for x in (box[0], box[2]) for y in (box[1], box[3])]
    return [min(x for x, _ in corners), min(y for _, y in corners),
            max(x for x, _ in corners), max(y for _, y in corners)]


def _overlap(a, b):
    return min(a[2], b[2]) > max(a[0], b[0]) and min(a[3], b[3]) > max(a[1], b[1])


def _pixel_box(box, image, width, height, padding=2):
    return [max(0, math.floor(box[0] / width * image.width) - padding),
            max(0, math.floor(box[1] / height * image.height) - padding),
            min(image.width, math.ceil(box[2] / width * image.width) + padding),
            min(image.height, math.ceil(box[3] / height * image.height) + padding)]


def _fill_color(obj, raw):
    values = [ctypes.c_uint() for _ in range(4)]
    if not raw.FPDFPageObj_GetFillColor(obj, *(ctypes.byref(value) for value in values)):
        return None, 0
    return "#" + "".join(f"{value.value:02x}" for value in values[:3]), values[3].value / 255


def _font_details(obj, matrix):
    font = obj.get_font()
    name = font.get_base_name()
    canonical = name.split("+", 1)[-1]
    normalized = canonical.lower().replace("-", "").replace(" ", "")
    resolved = None
    if normalized.startswith(("helvetica", "arial")):
        resolved = "Arial"
    elif normalized.startswith(("times", "timesnewroman")):
        resolved = "Times New Roman"
    elif normalized.startswith(("courier", "couriernew")):
        resolved = "Courier New"
    weight = font.get_weight()
    if weight <= 0:
        weight = 900 if "black" in normalized else 600 if "semibold" in normalized else 700 if "bold" in normalized else 300 if "light" in normalized else 500 if "medium" in normalized else 400
    scale_x = math.hypot(matrix[0], matrix[1])
    scale_y = math.hypot(matrix[2], matrix[3])
    return {"fontFamily": name, "resolvedFont": resolved,
            "fontSize": obj.get_font_size() * scale_y, "sourceFontSize": obj.get_font_size(),
            "fontScaleX": scale_x, "fontScaleY": scale_y,
            "fontWeight": weight, "fontStyle": "italic" if "italic" in normalized or "oblique" in normalized else "normal",
            "fontEmbedded": font.is_embedded, "fontFallback": resolved != canonical,
            "fontAvailable": resolved is not None}


def _objects(page, textpage, page_number, width, height, rotation, warnings):
    import pypdfium2.raw as raw
    objects = []
    elements = []
    visible_box = page.get_bbox()
    for index, obj in enumerate(page.get_objects(max_depth=3, textpage=textpage)):
        if index >= MAX_ELEMENTS_PER_PAGE:
            warnings.append("element_limit_source_preserved")
            break
        identifier = f"p{page_number}-o{index + 1}"
        try:
            source_box = obj.get_bounds()
            box = _display_box(source_box, visible_box, rotation)
            if not all(math.isfinite(value) for value in box) or box[2] <= box[0] or box[3] <= box[1]:
                continue
            kind = {raw.FPDF_PAGEOBJ_TEXT: "text", raw.FPDF_PAGEOBJ_IMAGE: "image",
                    raw.FPDF_PAGEOBJ_PATH: "vector", raw.FPDF_PAGEOBJ_FORM: "group"}.get(obj.type, "raster_fallback")
            matrix = list(obj.get_matrix().get())
            element = {"id": identifier, "type": kind,
                       "x": box[0] / width, "y": box[1] / height,
                       "width": (box[2] - box[0]) / width, "height": (box[3] - box[1]) / height,
                       "rotation": (math.degrees(math.atan2(matrix[1], matrix[0])) + rotation) % 360,
                       "zIndex": index, "editable": False, "confidence": 1.0 if obj.level == 0 else 0.5,
                       "sourceVisible": None,
                       "semanticRole": "unknown", "matrix": matrix, "nested": obj.level > 0,
                       "sourceBounds": list(source_box), "coordinateSpace": "normalized_top_left"}
            clip = raw.FPDFPageObj_GetClipPath(obj)
            element["clipped"] = bool(clip and raw.FPDFClipPath_CountPaths(clip) > 0)
            element["color"], element["opacity"] = _fill_color(obj, raw)
            text = None
            if kind == "text":
                text = obj.extract()
                element.update(text=text, **_font_details(obj, matrix))
                element["textRenderMode"] = raw.FPDFTextObj_GetTextRenderMode(obj)
                element["confidence"] = 0.96 if element["fontAvailable"] and obj.level == 0 else 0.6
                if element["textRenderMode"] == 3 or (element["textRenderMode"] == 0 and element["opacity"] == 0):
                    element["sourceVisible"] = False
            if box[2] <= 0 or box[3] <= 0 or box[0] >= width or box[1] >= height:
                element["sourceVisible"] = False
            if kind == "vector":
                count = raw.FPDFPath_CountSegments(obj)
                element["pathSegmentCount"] = count
                element["vectorSupported"] = False
                fill_mode, stroke = ctypes.c_int(), ctypes.c_int()
                if raw.FPDFPath_GetDrawMode(obj, ctypes.byref(fill_mode), ctypes.byref(stroke)):
                    element.update(fillRule="evenodd" if fill_mode.value == 1 else "nonzero", strokeEnabled=bool(stroke.value))
                stroke_width = ctypes.c_float()
                if raw.FPDFPageObj_GetStrokeWidth(obj, ctypes.byref(stroke_width)):
                    element["strokeWidth"] = stroke_width.value
                segments = []
                for segment_index in range(min(count, 128)):
                    segment = raw.FPDFPath_GetPathSegment(obj, segment_index)
                    x, y = ctypes.c_float(), ctypes.c_float()
                    if raw.FPDFPathSegment_GetPoint(segment, ctypes.byref(x), ctypes.byref(y)):
                        segments.append({"type": raw.FPDFPathSegment_GetType(segment), "x": x.value, "y": y.value,
                                         "close": bool(raw.FPDFPathSegment_GetClose(segment))})
                element["pathSegments"] = segments
                element["pathCoordinates"] = "source_pdf"
            element["provenance"] = provenance(page_number, identifier, box, text, element["confidence"])
            elements.append(element)
            objects.append((obj, element, box))
        except Exception:
            warnings.append("object_geometry_unavailable_source_preserved")
    return objects, elements


def _classify_semantics(elements):
    """Classify exact source substrings; never synthesize commercial fields."""
    text_elements = [element for element in elements if element["type"] == "text"]
    sizes = sorted(element.get("fontSize", 0) for element in text_elements)
    median_size = sizes[len(sizes) // 2] if sizes else 0
    patterns = {
        "email": r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}",
        "website": r"(?:https?://|www\.)[^\s<>]+",
        "price": r"(?:R\$|US\$|\$|€|£)\s*\d[\d.,]*",
        "sku": r"\b(?:SKU|REF(?:ERÊNCIA)?|C[ÓO]D(?:IGO)?)\s*[:#-]?\s*[A-Z0-9][A-Z0-9_-]{2,20}\b",
        "dimensions": r"\b\d+(?:[.,]\d+)?\s*(?:[x×]\s*\d+(?:[.,]\d+)?\s*){0,2}(?:mm|cm|metros?|kg|litros?|ml|m²)\b",
        "phone": r"(?:\+\d{1,3}\s*)?(?:\(\d{2,3}\)\s*)?\d{4,5}[ -]\d{4}\b",
    }
    for element in text_elements:
        text = element.get("text", "")
        evidence = []
        for kind, pattern in patterns.items():
            for match in re.finditer(pattern, text, re.IGNORECASE):
                evidence.append({"kind": kind, "value": match.group(),
                                 "provenance": {**element["provenance"], "sourceText": match.group(),
                                                "sourceTextHash": fingerprint(match.group().encode("utf-8")),
                                                "confidence": .98}})
        if evidence:
            element["semanticEvidence"] = evidence
            kinds = {item["kind"] for item in evidence}
            element["semanticRole"] = "contact" if kinds & {"email", "website", "phone"} else "commercial_source" if kinds & {"price", "sku"} else "specification"
        elif median_size > 0 and element.get("fontSize", 0) >= median_size * 1.5 and len(text.strip()) < 160:
            element["semanticRole"] = "heading"


def _scan_like(image):
    """Conservative evidence for a raster text component, not a photo heuristic."""
    sample = image.convert("RGB")
    sample.thumbnail((256, 256))
    pixels = list(sample.get_flattened_data())
    if not pixels:
        return False
    white = sum(min(pixel) > 225 for pixel in pixels) / len(pixels)
    dark = sum(max(pixel) < 70 for pixel in pixels) / len(pixels)
    if white < .65 or not .005 < dark < .25 or 1 - white - dark > .2:
        return False
    rows = [sum(max(pixel) < 100 for pixel in pixels[y * sample.width:(y + 1) * sample.width]) for y in range(sample.height)]
    active = [2 < count < sample.width * .8 for count in rows]
    bands = sum(value and (index == 0 or not active[index - 1]) for index, value in enumerate(active))
    return bands >= 3


def _text_ink_mask(page, obj, page_number, scale, pixel_box):
    """Render the exact admitted text object's ink without surrounding artwork.

    An object can contain both readable and concealed characters. Comparing its
    full ink mask against the source contribution avoids treating one painted
    glyph as proof that every extracted character was visible.
    """
    import pypdfium2 as pdfium
    pointer = ctypes.cast(obj.raw, ctypes.c_void_p).value
    direct_index = next(index for index, other in enumerate(page.get_objects(max_depth=0))
                        if ctypes.cast(other.raw, ctypes.c_void_p).value == pointer)
    isolated_pdf = pdfium.PdfDocument.new()
    try:
        isolated_pdf.import_pages(page.pdf, [page_number - 1])
        isolated_page = isolated_pdf[0]
        try:
            for index, other in enumerate(list(isolated_page.get_objects(max_depth=0))):
                if index != direct_index:
                    isolated_page.remove_obj(other)
                    other.close()
            isolated_page.gen_content()
            bitmap = isolated_page.render(scale=scale, fill_color=(0, 0, 0, 0),
                                           draw_annots=False, may_draw_forms=False, rev_byteorder=True,
                                           limit_image_cache=True)
            try:
                return bitmap.to_pil().getchannel("A").crop(pixel_box)
            finally:
                bitmap.close()
        finally:
            isolated_page.close()
    finally:
        isolated_pdf.close()


def _reconstruct(page, source, objects, width, height, scale, assets, page_number):
    """Admit simple direct text only; preserve all remaining visuals as a raster base.

    Original appearances are crops of the immutable source snapshot, including
    their local backdrop. This guarantees exact initial pixels even when a PDF
    font's metrics differ from the browser. On an explicit text edit the renderer
    uses the identified substitute over the clean base and warns about that font.
    """
    selected = []
    for obj, element, box in objects:
        if (element["type"] != "text" or element["nested"] or element["clipped"]
                or element["confidence"] < 0.9 or not element.get("text", "").strip()
                or len(element["text"]) > 2000 or element["opacity"] != 1
                or element.get("textRenderMode") != 0 or element["rotation"] not in (0, 360)
                or not 0 < element.get("fontSize", 0) <= 500
                or abs(element.get("fontScaleX", 0) - element.get("fontScaleY", 0)) > 1e-5
                or not all(math.isfinite(value) for value in element["matrix"])
                or abs(element["matrix"][1]) > 1e-6 or abs(element["matrix"][2]) > 1e-6
                or min(box) < 0 or box[2] > width or box[3] > height):
            continue
        pixel_box = _pixel_box(box, source, width, height)
        if pixel_box[2] <= pixel_box[0] or pixel_box[3] <= pixel_box[1]:
            continue
        if any(_overlap(pixel_box, candidate[3]) for candidate in selected):
            continue
        # Later complex objects must retain their stacking precedence after edits.
        if any(other["zIndex"] > element["zIndex"] and not other["nested"]
               and _overlap(box, other_box) for _, other, other_box in objects):
            continue
        selected.append((obj, element, box, pixel_box))
        if len(selected) == 8:
            break
    if not selected:
        return None, 0, None
    masks = []
    verified = []
    for candidate in selected:
        try:
            masks.append(_text_ink_mask(page, candidate[0], page_number, scale, candidate[3]))
            verified.append(candidate)
        except Exception:
            # Uncertain visibility remains private; the untouched object stays
            # in the source raster rather than being promoted into source facts.
            candidate[1]["sourceVisible"] = None
    selected = verified
    if not selected:
        return None, 0, None
    # Close textpage handles before removing their objects (required by PDFium).
    for obj, _, _, _ in selected:
        page.remove_obj(obj)
        obj.close()
    page.gen_content()
    background = _render(page, scale)
    from PIL import ImageChops, ImageStat
    visible_selected = []
    for (obj, element, box, pixel_box), mask in zip(selected, masks):
        # Removing this non-overlapping object must actually change its source
        # pixels. White-on-white or fully occluded text is private extraction
        # metadata, never an editable/visible source fact for recomposition.
        difference = ImageChops.difference(source.crop(pixel_box), background.crop(pixel_box))
        changed_channel = ImageChops.lighter(ImageChops.lighter(difference.getchannel("R"), difference.getchannel("G")), difference.getchannel("B"))
        changed_pixels = changed_channel.point(lambda value: 255 if value else 0)
        expected_ink = mask.point(lambda value: 255 if value else 0)
        fully_painted = expected_ink.getbbox() is not None and ImageChops.subtract(expected_ink, changed_pixels).getbbox() is None
        element["sourceVisible"] = fully_painted
        if fully_painted:
            visible_selected.append((obj, element, box, pixel_box))
    selected = visible_selected
    if not selected:
        return None, 0, None
    reconstructed = background.copy()
    for _, _, _, pixel_box in selected:
        reconstructed.paste(source.crop(pixel_box), (pixel_box[0], pixel_box[1]))
    difference = ImageChops.difference(source, reconstructed)
    exact = difference.getbbox() is None
    mean_error = sum(ImageStat.Stat(difference).mean) / 3
    verification = {"method": "source_pixel_comparison", "exactPixels": exact,
                    "meanAbsoluteChannelError": round(mean_error, 6),
                    "widthPixels": source.width, "heightPixels": source.height}
    if not exact:
        for _, element, _, _ in selected:
            element["sourceVisible"] = None
        return None, 0, verification
    fallback = assets.image(background, f"page-{page_number}-fallback.png", "raster_fallback")
    for _, element, _, pixel_box in selected:
        appearance = assets.image(source.crop(pixel_box), f"{element['id']}-appearance.png", "element_appearance")
        element["appearance"] = {"asset": appearance,
                                 "x": pixel_box[0] / source.width, "y": pixel_box[1] / source.height,
                                 "width": (pixel_box[2] - pixel_box[0]) / source.width,
                                 "height": (pixel_box[3] - pixel_box[1]) / source.height}
        element["editable"] = True
        element["reviewRecommended"] = element["fontFallback"]
    return fallback, len(selected), verification


def _extract_images(objects, assets, page_number, warnings):
    import pypdfium2.raw as raw
    for obj, element, _ in objects:
        if element["type"] != "image" or element["nested"] or element["clipped"]:
            continue
        pixel_width, pixel_height = ctypes.c_uint(), ctypes.c_uint()
        if not raw.FPDFImageObj_GetImagePixelSize(obj, ctypes.byref(pixel_width), ctypes.byref(pixel_height)):
            continue
        if not pixel_width.value or not pixel_height.value or pixel_width.value * pixel_height.value > MAX_PAGE_PIXELS:
            warnings.append("image_extraction_budget_source_preserved")
            continue
        # PDFium's scale_to_original uses a uniform scale based on the larger
        # native/content ratio. A very narrow stretched image can otherwise
        # allocate far more pixels than its native dimensions suggest.
        left, bottom, right, top = element["sourceBounds"]
        content_width, content_height = right - left, top - bottom
        native_width, native_height = pixel_width.value, pixel_height.value
        if (native_width < native_height) != (content_width < content_height):
            native_width, native_height = native_height, native_width
        if content_width <= 0 or content_height <= 0:
            continue
        image_scale = max(native_width / content_width, native_height / content_height)
        rendered_pixels = math.ceil(content_width * image_scale) * math.ceil(content_height * image_scale)
        if rendered_pixels > MAX_PAGE_PIXELS:
            warnings.append("image_extraction_budget_source_preserved")
            continue
        try:
            bitmap = obj.get_bitmap(render=True)
            try:
                image = bitmap.to_pil().copy()
            finally:
                bitmap.close()
            if image.width * image.height > MAX_PAGE_PIXELS:
                warnings.append("image_extraction_budget_source_preserved")
                continue
            element["scanRegionDetected"] = _scan_like(image)
            element["imageAsset"] = assets.image(image, f"{element['id']}-image.png", "image")
        except Exception:
            warnings.append("image_extraction_unavailable_source_preserved")


def _analyze_pdf(file_bytes, filename):
    preflight = validate_pdf(file_bytes, filename)
    import pypdfium2 as pdfium
    assets = _Assets()
    document = {"schemaVersion": SCHEMA_VERSION, "sourceFingerprint": preflight["source_hash"],
                "adapter": "pdfium", "fileType": "pdf", "pageCount": preflight["page_count"],
                "pages": [], "candidates": [], "report": {}}
    pdf = pdfium.PdfDocument(file_bytes)
    source_scales = []
    total_pixels = 0
    try:
        if len(pdf) != preflight["page_count"]:
            raise DocumentImportError("page_count_mismatch", "A contagem de páginas do PDF não pôde ser validada.")
        # Capture every page first. Optional extraction can never consume the
        # budget required to preserve a later source page.
        for metadata in preflight["pages"]:
            number = metadata["index"] + 1
            page = pdf[metadata["index"]]
            try:
                native_width, native_height = page.get_size()
                if not all(math.isfinite(v) and v > 0 for v in (native_width, native_height)):
                    raise DocumentImportError("invalid_geometry", "O PDF contém geometria inválida.")
                scale = min(SNAPSHOT_SCALE, math.sqrt(MAX_PAGE_PIXELS / (native_width * native_height)) * .999)
                pixels = math.ceil(native_width * scale) * math.ceil(native_height * scale)
                total_pixels += pixels
                if pixels > MAX_PAGE_PIXELS or total_pixels > MAX_TOTAL_PIXELS:
                    raise DocumentImportError("pixel_limit", "O PDF excede o limite seguro de resolução total.")
                source = _render(page, scale)
                snapshot = assets.image(source, f"page-{number}-source.png", "source_snapshot")
                source_scales.append(scale)
                geometry_matches = abs(native_width - metadata["width"]) < .01 and abs(native_height - metadata["height"]) < .01
                document["pages"].append({
                    "pageNumber": number, "width": metadata["width"], "height": metadata["height"], "unit": "pt",
                    "rotation": metadata["rotation"], "mediaBox": metadata["media_box"],
                    "cropBox": metadata["crop_box"], "bleedBox": metadata["bleed_box"],
                    "sourceSnapshot": snapshot, "sourceHash": snapshot["hash"],
                    "pageType": "born_digital", "elements": [], "visibility": "source_only",
                    "quality": {"status": "preserved", "sourcePreserved": True, "editableCount": 0,
                                "fallbackCount": 1, "geometryValidated": geometry_matches},
                    "warnings": [] if geometry_matches else ["geometry_extraction_unavailable_source_preserved"],
                    "snapshotScale": scale,
                })
                source.close()
            except DocumentImportError:
                raise
            except Exception:
                raise DocumentImportError("source_render_failed", "Uma página do PDF não pôde ser preservada. A importação foi interrompida.") from None
            finally:
                page.close()
        for index, result in enumerate(document["pages"]):
            page = pdf[index]
            textpage = None
            warnings = result["warnings"]
            try:
                textpage = page.get_textpage()
                text = textpage.get_text_bounded()
                result["sourceText"] = text
                objects, elements = _objects(page, textpage, index + 1, result["width"], result["height"], result["rotation"], warnings)
                result["elements"] = elements
                _classify_semantics(elements)
                if any(e["type"] == "text" and not e.get("fontAvailable") for e in elements):
                    warnings.append("font_unavailable_source_preserved")
                if any(e.get("clipped") for e in elements):
                    warnings.append("clipping_preserved_as_raster")
                image_coverage = sum(max(0, min(1, e["width"])) * max(0, min(1, e["height"])) for e in elements if e["type"] == "image")
                _extract_images(objects, assets, index + 1, warnings)
                scanned_region = any(e.get("scanRegionDetected") and e["width"] * e["height"] >= .2 for e in elements)
                result["pageType"] = "hybrid" if text.strip() and scanned_region else "scanned" if not text.strip() and image_coverage >= .5 else "born_digital"
                result["pageTypeEvidence"] = "raster_text_pattern_with_live_text" if result["pageType"] == "hybrid" else "page_image_without_live_text" if result["pageType"] == "scanned" else "live_pdf_objects"
                result["pageTypeConfidence"] = .65 if result["pageType"] == "hybrid" else .95
                if result["pageType"] in ("scanned", "hybrid"):
                    warnings.append("ocr_unavailable_source_preserved")
                textpage.close()
                textpage = None
                if result["quality"]["geometryValidated"]:
                    from PIL import Image
                    source = Image.open(io.BytesIO(base64.b64decode(assets.items[result["sourceSnapshot"]["assetRef"]]["data"]))).convert("RGB")
                    try:
                        fallback, editable_count, verification = _reconstruct(page, source, objects,
                            result["width"], result["height"], source_scales[index], assets, index + 1)
                    finally:
                        source.close()
                    if verification is not None:
                        result["quality"]["reconstructionVerification"] = verification
                    if fallback is not None:
                        result["fallbackSnapshot"] = fallback
                        result["visibility"] = "hybrid"
                        result["quality"].update(status="needs_review", editableCount=editable_count,
                                                 fallbackCount=max(1, len(elements) - editable_count))
                    elif verification is not None:
                        warnings.append("reconstruction_pixel_mismatch_source_preserved")
            except Exception:
                for element in result["elements"]:
                    element["editable"] = False
                    element.pop("appearance", None)
                    if element.get("sourceVisible") is True:
                        element["sourceVisible"] = None
                result.pop("fallbackSnapshot", None)
                result["visibility"] = "source_only"
                result["quality"].update(status="preserved", editableCount=0, fallbackCount=1)
                warnings.append("geometry_extraction_unavailable_source_preserved")
            finally:
                if textpage is not None:
                    textpage.close()
                page.close()
                warnings[:] = list(dict.fromkeys(warnings))
        report = document["report"]
        report.update(pageCount=len(document["pages"]), sourcePreservedCount=len(document["pages"]),
                      editableCount=sum(page["quality"]["editableCount"] for page in document["pages"]),
                      fallbackCount=sum(page["quality"]["fallbackCount"] for page in document["pages"]),
                      sourceOnlyPageCount=sum(page["visibility"] == "source_only" for page in document["pages"]),
                      pageTypes={kind: sum(page["pageType"] == kind for page in document["pages"]) for kind in ("born_digital", "scanned", "hybrid")},
                      ocrAvailable=False, assetCount=len(assets.items), assetBytes=assets.bytes,
                      snapshotDpi=SNAPSHOT_SCALE * 72, status="preserved", adapterVersion=str(pdfium.PYPDFIUM_INFO),
                      candidateDetection="not_established", warnings=list(dict.fromkeys(warning for page in document["pages"] for warning in page["warnings"])))
        return document, assets.items
    finally:
        pdf.close()


def _worker_main():
    try:
        _worker_limits()
        raw = sys.stdin.buffer.read(MAX_SOURCE_BYTES + 1)
        # The parent already validated the upload filename. The worker receives
        # only unchanged PDF bytes and repeats preflight under a fixed PDF name.
        document, assets = _analyze_pdf(raw, "document.pdf")
        payload = {"document": document, "assets": assets}
    except DocumentImportError as exc:
        public_error, _ = public_document_error(exc.code)
        payload = {"error": {"code": public_error["code"]}}
    except Exception:
        payload = {"error": {"code": "invalid_pdf"}}
    sys.stdout.write(json.dumps(payload, ensure_ascii=True, separators=(",", ":")))


if __name__ == "__main__":
    if sys.argv[1:] != ["--worker"]:
        raise SystemExit(2)
    _worker_main()
