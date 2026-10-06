"""Synthetic PDF fixtures; customer documents must never be committed here."""

import hashlib
import io
import json
import subprocess
import sys
from types import SimpleNamespace
from unittest import mock

from django.test import SimpleTestCase
from PIL import Image, ImageChops, ImageDraw
from pypdf import PdfWriter
from pypdf.generic import ArrayObject, DecodedStreamObject, DictionaryObject, NameObject, NumberObject

from api.services.document_ir import DocumentImportError
from api.services.pdf_import_adapter import PdfImportAdapter


def synthetic_pdf(pages):
    writer = PdfWriter()
    for spec in pages:
        width, height = spec.get("size", (300, 200))
        page = writer.add_blank_page(width=width, height=height)
        font = DictionaryObject({NameObject("/Type"): NameObject("/Font"),
                                 NameObject("/Subtype"): NameObject("/Type1"),
                                 NameObject("/BaseFont"): NameObject("/" + spec.get("font", "Helvetica"))})
        resources = DictionaryObject({NameObject("/Font"): DictionaryObject({NameObject("/F1"): writer._add_object(font)})})
        content = spec.get("content", "0.9 0.95 1 rg 0 0 300 200 re f\n0 0 0 rg BT /F1 20 Tf 30 100 Td (Source title) Tj ET")
        if "image" in spec:
            image = spec["image"].convert("RGB")
            stream = DecodedStreamObject()
            stream.set_data(image.tobytes())
            stream.update({NameObject("/Type"): NameObject("/XObject"), NameObject("/Subtype"): NameObject("/Image"),
                           NameObject("/Width"): NumberObject(image.width), NameObject("/Height"): NumberObject(image.height),
                           NameObject("/ColorSpace"): NameObject("/DeviceRGB"), NameObject("/BitsPerComponent"): NumberObject(8)})
            resources[NameObject("/XObject")] = DictionaryObject({NameObject("/Im1"): writer._add_object(stream.flate_encode())})
            matrix = spec.get("image_matrix", (width, 0, 0, height, 0, 0))
            content = "q " + " ".join(str(value) for value in matrix) + " cm /Im1 Do Q\n" + spec.get("content", "")
        page[NameObject("/Resources")] = resources
        stream = DecodedStreamObject()
        stream.set_data(content.encode("ascii"))
        page[NameObject("/Contents")] = writer._add_object(stream)
        if "crop" in spec:
            page[NameObject("/CropBox")] = ArrayObject([NumberObject(value) for value in spec["crop"]])
        if spec.get("rotation"):
            page.rotate(spec["rotation"])
    result = io.BytesIO()
    writer.write(result)
    return result.getvalue()


class DocumentAdapterTests(SimpleTestCase):
    def setUp(self):
        self.assets = {}

    def sink(self, data, name, kind):
        url = "/private-test-assets/" + name
        self.assets[url] = (data, kind)
        return {"url": url, "mediaId": name}

    def analyze(self, pages):
        return PdfImportAdapter.analyze(synthetic_pdf(pages), "synthetic.pdf", self.sink)

    def image(self, asset):
        return Image.open(io.BytesIO(self.assets[asset["url"]][0])).convert("RGB")

    def test_odd_page_count_and_mixed_dimensions_are_preserved(self):
        sizes = [(595, 842), (612, 792), (300, 300), (842, 595), (321, 678), (300, 200), (200, 300)]
        document = self.analyze([{"size": size, "content": ""} for size in sizes])
        self.assertEqual(document["pageCount"], 7)
        self.assertEqual([(page["width"], page["height"]) for page in document["pages"]], sizes)
        self.assertEqual([page["pageNumber"] for page in document["pages"]], list(range(1, 8)))
        self.assertTrue(all(page["sourceSnapshot"]["url"] for page in document["pages"]))

    def test_exact_pixel_composition_and_original_text_provenance(self):
        document = self.analyze([{}])
        page = document["pages"][0]
        self.assertEqual(page["quality"]["editableCount"], 1)
        self.assertTrue(page["quality"]["reconstructionVerification"]["exactPixels"])
        source = self.image(page["sourceSnapshot"])
        reconstructed = self.image(page["fallbackSnapshot"])
        for element in page["elements"]:
            if not element["editable"]:
                continue
            appearance = element["appearance"]
            image = self.image(appearance["asset"])
            reconstructed.paste(image, (round(appearance["x"] * source.width), round(appearance["y"] * source.height)))
            self.assertEqual(element["text"], "Source title")
            self.assertEqual(element["provenance"]["sourceText"], "Source title")
            self.assertEqual(element["semanticRole"], "unknown")
        self.assertIsNone(ImageChops.difference(source, reconstructed).getbbox())
        # Editing starts over a genuinely clean base; the original text is absent.
        self.assertIsNotNone(ImageChops.difference(source, self.image(page["fallbackSnapshot"])).getbbox())

    def test_crop_and_rotation_preserve_original_boxes_and_visible_size(self):
        page = self.analyze([{"crop": [50, 25, 250, 175], "rotation": 90}])["pages"][0]
        self.assertEqual((page["width"], page["height"]), (150, 200))
        self.assertEqual(page["mediaBox"], [0, 0, 300, 200])
        self.assertEqual(page["cropBox"], [50, 25, 250, 175])
        self.assertEqual(page["rotation"], 90)
        self.assertEqual((page["sourceSnapshot"]["widthPixels"], page["sourceSnapshot"]["heightPixels"]), (300, 400))

    def test_scanned_and_digital_pages_are_detected_individually(self):
        image = Image.new("RGB", (300, 200), "white")
        draw = ImageDraw.Draw(image)
        for row in range(8):
            draw.text((20, 15 + row * 20), "Printed source line", fill="black")
        document = self.analyze([{}, {"image": image}, {"image": Image.new("RGB", (300, 200), "red"),
            "content": "BT /F1 18 Tf 30 100 Td (Digital caption) Tj ET"}])
        self.assertEqual([page["pageType"] for page in document["pages"]], ["born_digital", "scanned", "born_digital"])
        self.assertFalse(document["report"]["ocrAvailable"])
        self.assertIn("ocr_unavailable_source_preserved", document["pages"][1]["warnings"])

    def test_hybrid_scanned_region_and_live_caption_preserve_both(self):
        image = Image.new("RGB", (300, 200), "white")
        draw = ImageDraw.Draw(image)
        for row in range(8):
            draw.text((20, 15 + row * 20), "Printed source line", fill="black")
        page = self.analyze([{"image": image, "content": "BT /F1 10 Tf 200 5 Td (Live folio) Tj ET"}])["pages"][0]
        self.assertEqual(page["pageType"], "hybrid")
        self.assertEqual(page["pageTypeEvidence"], "raster_text_pattern_with_live_text")
        self.assertTrue(page["sourceSnapshot"]["url"])
        self.assertIn("Live folio", page["sourceText"])

    def test_unsupported_font_and_clipped_text_remain_faithful(self):
        for spec in ({"font": "ProprietaryMissingFont"},
                     {"content": "q 30 100 20 20 re W n BT /F1 20 Tf 30 100 Td (Clipped title) Tj ET Q"}):
            with self.subTest(spec=spec):
                page = self.analyze([spec])["pages"][0]
                self.assertEqual(page["visibility"], "source_only")
                self.assertEqual(page["quality"]["editableCount"], 0)
                self.assertTrue(page["sourceSnapshot"]["hash"])

    def test_white_on_white_text_is_private_metadata_without_editable_overlay(self):
        page = self.analyze([{"content": "1 1 1 rg BT /F1 20 Tf 30 100 Td (Private invisible source) Tj ET"}])["pages"][0]
        text = next(element for element in page["elements"] if element["type"] == "text")
        self.assertFalse(text["sourceVisible"])
        self.assertFalse(text["editable"])
        self.assertEqual(text["provenance"]["sourceText"], "Private invisible source")
        self.assertEqual(page["visibility"], "source_only")
        self.assertIsNone(ImageChops.difference(self.image(page["sourceSnapshot"]), Image.new("RGB", (600, 400), "white")).getbbox())

    def test_invisible_render_mode_and_off_crop_text_are_not_visible_source_facts(self):
        fixtures = [
            {"content": "BT /F1 20 Tf 3 Tr 30 100 Td (Invisible text layer) Tj ET"},
            {"content": "BT /F1 20 Tf 30 100 Td (Private outside crop) Tj ET", "crop": [200, 0, 300, 200]},
        ]
        for spec in fixtures:
            with self.subTest(spec=spec):
                page = self.analyze([spec])["pages"][0]
                text = next(element for element in page["elements"] if element["type"] == "text")
                self.assertFalse(text["sourceVisible"])
                self.assertFalse(text["editable"])
                self.assertEqual(page["visibility"], "source_only")
                self.assertTrue(page["sourceSnapshot"]["hash"])

    def test_visible_text_receives_actual_pixel_evidence(self):
        page = self.analyze([{}])["pages"][0]
        text = next(element for element in page["elements"] if element["type"] == "text")
        self.assertTrue(text["sourceVisible"])
        self.assertTrue(text["editable"])
        self.assertTrue(page["quality"]["reconstructionVerification"]["exactPixels"])

    def test_partially_concealed_text_does_not_promote_its_hidden_characters(self):
        content = "0 0 0 rg 90 0 210 200 re f\nBT /F1 20 Tf 20 100 Td (Visible SECRET) Tj ET"
        page = self.analyze([{"content": content}])["pages"][0]
        text = next(element for element in page["elements"] if element["type"] == "text")
        self.assertFalse(text["sourceVisible"])
        self.assertFalse(text["editable"])
        self.assertEqual(text["provenance"]["sourceText"], "Visible SECRET")
        self.assertEqual(page["visibility"], "source_only")
        self.assertTrue(page["sourceSnapshot"]["hash"])

    def test_extremely_stretched_image_is_not_allocated_at_unbounded_resolution(self):
        page = self.analyze([{"image": Image.new("RGB", (300, 200), "red"),
                             "image_matrix": (0.1, 0, 0, 2000, 0, 0)}])["pages"][0]
        self.assertIn("image_extraction_budget_source_preserved", page["warnings"])
        self.assertTrue(page["sourceSnapshot"]["url"])
        self.assertFalse(any(element.get("imageAsset") for element in page["elements"]))

    def test_vector_graphics_survive_in_fallback(self):
        page = self.analyze([{"content": "0 0 1 rg 10 10 m 290 10 l 150 180 l h f\n0 0 0 rg BT /F1 20 Tf 30 100 Td (Source title) Tj ET"}])["pages"][0]
        self.assertTrue(any(element["type"] == "vector" for element in page["elements"]))
        self.assertEqual(self.image(page["sourceSnapshot"]).getpixel((300, 250)), (0, 0, 255))
        self.assertEqual(self.image(page["fallbackSnapshot"]).getpixel((300, 250)), (0, 0, 255))

    def test_no_commercial_values_are_invented_and_evidence_is_exact(self):
        content = "BT /F1 18 Tf 20 150 Td (No commercial fields) Tj 0 -40 Td (REF: REAL-42 R$ 12,50 20 cm) Tj 0 -40 Td (info@example.com) Tj ET"
        document = self.analyze([{"content": content}])
        self.assertEqual(document["candidates"], [])
        evidence = [item for element in document["pages"][0]["elements"] for item in element.get("semanticEvidence", [])]
        self.assertEqual({item["kind"] for item in evidence}, {"sku", "price", "dimensions", "email"})
        self.assertTrue(all(item["value"] in item["provenance"]["sourceText"] for item in evidence))
        self.assertNotIn("Sob consulta", str(document))
        self.assertNotIn("CAT-001", str(document))

    def test_failed_source_render_rejects_instead_of_fabricating_pages(self):
        with self.assertRaises(DocumentImportError):
            PdfImportAdapter.analyze(b"%PDF-1.7\ncorrupted", "malformed.pdf", self.sink)
        self.assertEqual(self.assets, {})

    def test_worker_timeout_kills_process_and_never_calls_asset_sink(self):
        process = mock.Mock()
        process.communicate.side_effect = [subprocess.TimeoutExpired("worker", 45), (b"", b"")]
        with mock.patch("api.services.pdf_import_adapter.subprocess.Popen", return_value=process):
            with self.assertRaises(DocumentImportError) as failure:
                PdfImportAdapter.analyze(synthetic_pdf([{}]), "synthetic.pdf", self.sink)
        self.assertEqual(failure.exception.code, "processing_timeout")
        process.kill.assert_called_once()
        self.assertEqual(self.assets, {})

    def test_worker_preserves_safe_preflight_http_status(self):
        with self.assertRaises(DocumentImportError) as failure:
            PdfImportAdapter.analyze(b"PK-not-a-PDF", "source.docx", self.sink)
        self.assertEqual(failure.exception.status_code, 415)

    def test_option_shaped_filenames_never_enter_real_worker_argv_or_change_source(self):
        source = synthetic_pdf([{}])
        baseline = PdfImportAdapter.analyze(source, "reference.pdf", self.sink)
        snapshot = baseline["pages"][0]["sourceSnapshot"]
        expected_png = self.assets[snapshot["url"]][0]
        real_popen = subprocess.Popen
        for filename in ("--help.pdf", "-c print('option-shaped').pdf", "--worker;$(echo filename).pdf"):
            with self.subTest(filename=filename):
                with mock.patch("api.services.pdf_import_adapter.subprocess.Popen", wraps=real_popen) as launch:
                    document = PdfImportAdapter.analyze(source, filename, self.sink)
                launch.assert_called_once()
                self.assertEqual(launch.call_args.args[0],
                                 [sys.executable, "-m", "api.services.pdf_import_adapter", "--worker"])
                self.assertNotIn(filename, launch.call_args.args[0])
                self.assertFalse(launch.call_args.kwargs.get("shell", False))
                self.assertEqual(document["sourceFingerprint"], hashlib.sha256(source).hexdigest())
                result_snapshot = document["pages"][0]["sourceSnapshot"]
                self.assertEqual(result_snapshot["hash"], snapshot["hash"])
                self.assertEqual(self.assets[result_snapshot["url"]][0], expected_png)

    def test_invalid_filename_is_rejected_before_worker_launch(self):
        for filename in ("source\x00.pdf", "source\r\n.pdf"):
            with self.subTest(filename=filename):
                with mock.patch("api.services.pdf_import_adapter.subprocess.Popen") as launch:
                    with self.assertRaises(DocumentImportError) as failure:
                        PdfImportAdapter.analyze(synthetic_pdf([{}]), filename, self.sink)
                self.assertEqual(failure.exception.code, "document_invalid_filename")
                self.assertEqual(failure.exception.status_code, 400)
                launch.assert_not_called()

    def test_worker_error_messages_and_statuses_are_not_trusted(self):
        source = synthetic_pdf([{}])
        cases = [
            ({"error": {"code": "document_docx_unsupported", "message": "PRIVATE_PARSER_DETAIL", "status_code": 200}},
             "document_docx_unsupported", 415),
            ({"error": {"code": "unknown_PRIVATE_PARSER_DETAIL", "message": "PRIVATE_PARSER_DETAIL", "status_code": 200}},
             "processing_failed", 422),
            ({"error": None}, "processing_failed", 422),
            ({"error": "PRIVATE_PARSER_DETAIL"}, "processing_failed", 422),
            ({"error": {"code": ["PRIVATE_PARSER_DETAIL"]}}, "processing_failed", 422),
            ([], "processing_failed", 422),
        ]
        for response, expected_code, expected_status in cases:
            with self.subTest(response=response):
                process = mock.Mock(returncode=0)
                process.communicate.return_value = (json.dumps(response).encode(), None)
                with mock.patch("api.services.pdf_import_adapter.subprocess.Popen", return_value=process):
                    with self.assertRaises(DocumentImportError) as failure:
                        PdfImportAdapter.analyze(source, "synthetic.pdf", self.sink)
                self.assertEqual(failure.exception.code, expected_code)
                self.assertEqual(failure.exception.status_code, expected_status)
                self.assertNotIn("PRIVATE_PARSER_DETAIL", failure.exception.message)
        self.assertEqual(self.assets, {})

    def test_worker_serializes_only_static_allowlisted_error_code(self):
        from api.services.pdf_import_adapter import _worker_main
        for code, expected in (("document_invalid_pdf", "document_invalid_pdf"),
                               ("UNKNOWN_PRIVATE_PARSER_DETAIL", "processing_failed")):
            with self.subTest(code=code):
                failure = DocumentImportError("document_invalid_pdf")
                failure.code = code
                failure.message = "PRIVATE_PARSER_DETAIL"
                failure.status_code = 200
                output = io.StringIO()
                with mock.patch("api.services.pdf_import_adapter._worker_limits"), \
                     mock.patch("api.services.pdf_import_adapter._analyze_pdf", side_effect=failure), \
                     mock.patch("api.services.pdf_import_adapter.sys.stdin", SimpleNamespace(buffer=io.BytesIO(synthetic_pdf([{}])))), \
                     mock.patch("api.services.pdf_import_adapter.sys.stdout", output):
                    _worker_main()
                self.assertEqual(json.loads(output.getvalue()), {"error": {"code": expected}})
                self.assertNotIn("PRIVATE_PARSER_DETAIL", output.getvalue())

    def test_scaled_font_matrix_keeps_actual_point_size(self):
        page = self.analyze([{"content": "BT /F1 1 Tf 24 0 0 24 30 100 Tm (Actual 24 pt text) Tj ET"}])["pages"][0]
        text = next(element for element in page["elements"] if element["type"] == "text")
        self.assertEqual(text["sourceFontSize"], 1)
        self.assertEqual(text["fontSize"], 24)
        self.assertTrue(text["editable"])

    def test_geometry_failure_keeps_real_source_snapshot(self):
        from api.services.pdf_import_adapter import _analyze_pdf
        with mock.patch("api.services.pdf_import_adapter._objects", side_effect=RuntimeError("parser detail")):
            document, assets = _analyze_pdf(synthetic_pdf([{}]), "synthetic.pdf")
        page = document["pages"][0]
        self.assertEqual(page["visibility"], "source_only")
        self.assertIn("geometry_extraction_unavailable_source_preserved", page["warnings"])
        self.assertTrue(assets[page["sourceSnapshot"]["assetRef"]]["data"])

    def test_optional_reconstruction_failure_clears_visible_admission(self):
        from api.services.pdf_import_adapter import _analyze_pdf, _Assets
        original = _Assets.image
        calls = 0

        def store(asset_store, *args, **kwargs):
            nonlocal calls
            calls += 1
            if calls == 2:
                raise RuntimeError("optional fallback storage failed")
            return original(asset_store, *args, **kwargs)

        with mock.patch.object(_Assets, "image", new=store):
            document, _ = _analyze_pdf(synthetic_pdf([{}]), "synthetic.pdf")
        page = document["pages"][0]
        text = next(element for element in page["elements"] if element["type"] == "text")
        self.assertIsNone(text["sourceVisible"])
        self.assertFalse(text["editable"])
        self.assertEqual(page["visibility"], "source_only")
        self.assertTrue(page["sourceSnapshot"]["hash"])

    def test_one_geometry_failure_does_not_discard_successful_pages(self):
        from api.services.pdf_import_adapter import _analyze_pdf, _objects
        calls = 0

        def extract(*args, **kwargs):
            nonlocal calls
            calls += 1
            if calls == 2:
                raise RuntimeError("untrusted parser detail")
            return _objects(*args, **kwargs)

        with mock.patch("api.services.pdf_import_adapter._objects", side_effect=extract):
            document, _ = _analyze_pdf(synthetic_pdf([{}, {}]), "synthetic.pdf")
        self.assertEqual(document["pages"][0]["quality"]["editableCount"], 1)
        self.assertEqual(document["pages"][1]["visibility"], "source_only")
        self.assertEqual(document["report"]["sourcePreservedCount"], 2)

    def test_source_render_failure_prevents_accepting_an_incomplete_document(self):
        from api.services.pdf_import_adapter import _analyze_pdf, _render
        calls = 0

        def render(*args, **kwargs):
            nonlocal calls
            calls += 1
            if calls == 2:
                raise RuntimeError("untrusted renderer detail")
            return _render(*args, **kwargs)

        with mock.patch("api.services.pdf_import_adapter._render", side_effect=render):
            with self.assertRaises(DocumentImportError) as failure:
                _analyze_pdf(synthetic_pdf([{}, {}]), "synthetic.pdf")
        self.assertEqual(failure.exception.code, "source_render_failed")

    def test_pixel_mismatch_degrades_without_changing_source(self):
        from api.services.pdf_import_adapter import _analyze_pdf, _render
        renders = 0

        def changed_render(page, scale):
            nonlocal renders
            renders += 1
            image = _render(page, scale)
            if renders > 1:
                image.putpixel((0, 0), (255, 0, 255))
            return image

        with mock.patch("api.services.pdf_import_adapter._render", side_effect=changed_render):
            document, _ = _analyze_pdf(synthetic_pdf([{}]), "synthetic.pdf")
        page = document["pages"][0]
        self.assertEqual(page["visibility"], "source_only")
        self.assertFalse(page["quality"]["reconstructionVerification"]["exactPixels"])
        self.assertIn("reconstruction_pixel_mismatch_source_preserved", page["warnings"])

    def test_eight_text_limit_preserves_other_objects_as_raster(self):
        lines = [f"BT /F1 10 Tf 20 {180 - i * 18} Td (Line {i}) Tj ET" for i in range(10)]
        page = self.analyze([{"content": "\n".join(lines)}])["pages"][0]
        self.assertEqual(len(page["elements"]), 10)
        self.assertEqual(page["quality"]["editableCount"], 8)
        self.assertTrue(page["quality"]["reconstructionVerification"]["exactPixels"])

    def test_visual_fidelity_for_cover_editorial_two_products_grid_and_contact(self):
        photo = Image.new("RGB", (300, 200))
        photo.putdata([(x % 256, y % 256, (x + y) % 256) for y in range(200) for x in range(300)])
        fixtures = [
            {"content": "0.1 0.2 0.4 rg 0 0 300 200 re f\n1 1 1 rg BT /F1 36 Tf 20 110 Td (SOURCE COVER) Tj ET"},
            {"image": photo, "content": "1 1 1 rg BT /F1 20 Tf 20 170 Td (Editorial source caption) Tj ET"},
            {"content": "BT /F1 18 Tf 20 150 Td (Source item A) Tj 150 0 Td (Source item B) Tj ET"},
            {"content": "\n".join(f"BT /F1 10 Tf {20 + (i % 3) * 90} {180 - (i // 3) * 20} Td (Grid item {i}) Tj ET" for i in range(18))},
            {"content": "BT /F1 20 Tf 20 150 Td (Contact source) Tj 0 -40 Td (info@example.com) Tj 0 -40 Td (11 12345-6789) Tj ET"},
        ]
        document = self.analyze(fixtures)
        self.assertEqual(document["pageCount"], 5)
        for page in document["pages"]:
            with self.subTest(page=page["pageNumber"]):
                source = self.image(page["sourceSnapshot"])
                reconstructed = self.image(page.get("fallbackSnapshot") or page["sourceSnapshot"])
                for element in page["elements"]:
                    if element.get("editable"):
                        appearance = element["appearance"]
                        reconstructed.paste(self.image(appearance["asset"]),
                                            (round(appearance["x"] * source.width), round(appearance["y"] * source.height)))
                self.assertIsNone(ImageChops.difference(source, reconstructed).getbbox())
