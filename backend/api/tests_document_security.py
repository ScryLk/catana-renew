"""Real inert PDF fixtures exercise input/action/resource security boundaries."""
import io
import zipfile
from unittest.mock import patch

from django.test import SimpleTestCase
from pypdf import PdfWriter
from pypdf.generic import ArrayObject, DictionaryObject, FloatObject, IndirectObject, NameObject, NumberObject, TextStringObject

from api.services.document_preflight import DocumentImportError, validate_pdf, validate_source_file


def pdf_bytes(writer=None, pages=1):
    writer = writer or PdfWriter()
    if not writer.pages:
        for _ in range(pages):
            writer.add_blank_page(width=300, height=500)
    output = io.BytesIO()
    writer.write(output)
    return output.getvalue()


def annotation(writer, action):
    annot = DictionaryObject({NameObject('/Type'): NameObject('/Annot'),
                              NameObject('/Subtype'): NameObject('/Link'),
                              NameObject('/Rect'): ArrayObject([NumberObject(x) for x in [0, 0, 10, 10]]),
                              NameObject('/A'): writer._add_object(action)})
    writer.pages[0][NameObject('/Annots')] = ArrayObject([writer._add_object(annot)])


class DocumentPreflightSecurityTests(SimpleTestCase):
    def assert_rejected(self, content, code, filename='catalog.pdf', mime='application/pdf', status=422):
        with self.assertRaises(DocumentImportError) as caught:
            validate_pdf(content, filename, mime)
        self.assertEqual(caught.exception.code, code)
        self.assertEqual(caught.exception.status_code, status)
        return caught.exception

    def test_valid_geometry_and_source_fingerprint_preserved(self):
        writer = PdfWriter()
        page = writer.add_blank_page(width=300, height=500)
        page.cropbox = ArrayObject([NumberObject(x) for x in [10, 20, 290, 480]])
        page.rotate(90)
        content = pdf_bytes(writer)
        result = validate_pdf(content, 'catalog.PDF', 'application/pdf; charset=binary')
        self.assertEqual(result['page_count'], 1)
        self.assertEqual((result['pages'][0]['width'], result['pages'][0]['height']), (460, 280))
        self.assertEqual(result['pages'][0]['crop_box'], [10, 20, 290, 480])
        self.assertEqual(result['pages'][0]['rotation'], 90)
        self.assertEqual(result['size_bytes'], len(content))
        self.assertEqual(result['source_hash'], validate_pdf(content, 'different-name.pdf')['source_hash'])

    def test_extension_mime_and_magic_must_agree(self):
        valid = pdf_bytes()
        self.assert_rejected(valid, 'document_type_unsupported', filename='catalog.exe', status=415)
        self.assert_rejected(valid, 'document_mime_mismatch', mime='text/html', status=415)
        self.assert_rejected(b'not a PDF', 'document_invalid_pdf')
        self.assert_rejected(b'%PDF-1.7\nno objects', 'document_invalid_pdf')
        self.assert_rejected(b'', 'document_empty', status=400)
        self.assert_rejected(valid, 'document_invalid_filename', filename='invalid\x00.pdf', status=400)
        self.assert_rejected(valid, 'document_invalid_filename', filename='invalid\r\n.pdf', status=400)

    def test_docx_zip_is_rejected_without_decompression(self):
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
            archive.writestr('word/document.xml', 'x' * 1_000_000)
        with patch('zipfile.ZipFile', side_effect=AssertionError('ZIP must not be opened')):
            self.assert_rejected(buffer.getvalue(), 'document_docx_unsupported', filename='catalog.docx',
                                 mime='application/vnd.openxmlformats-officedocument.wordprocessingml.document', status=415)

    def test_size_limit_precedes_parser(self):
        content = pdf_bytes()
        with patch('api.services.document_preflight.MAX_SOURCE_BYTES', len(content) - 1), \
             patch('api.services.document_preflight.PdfReader', side_effect=AssertionError('Must reject before parser')):
            self.assert_rejected(content, 'document_too_large', status=413)

    def test_encrypted_pdf_is_not_opened_with_empty_password(self):
        writer = PdfWriter()
        writer.add_blank_page(width=300, height=500)
        writer.encrypt('')
        self.assert_rejected(pdf_bytes(writer), 'document_encrypted')

    def test_open_action_javascript_and_escaped_pdf_names_rejected(self):
        writer = PdfWriter()
        writer.add_blank_page(width=300, height=500)
        writer.add_js("app.alert('untrusted')")
        content = pdf_bytes(writer)
        self.assert_rejected(content, 'document_active_content')

        class EscapedName(NameObject):
            def write_to_stream(self, stream, encryption_key=None):
                stream.write(b'/Java#53cript')

        # Writer recalculates xref offsets, so the fixture tests actual name
        # decoding rather than rejection caused by corrupted byte positions.
        escaped = DictionaryObject({NameObject('/S'): EscapedName('/JavaScript')})
        writer = PdfWriter(); writer.add_blank_page(width=300, height=500)
        annotation(writer, escaped)
        content = pdf_bytes(writer)
        self.assertIn(b'/Java#53cript', content)
        self.assert_rejected(content, 'document_active_content')

    def test_indirect_annotation_launch_and_additional_actions_rejected(self):
        for action_type in ['/Launch', '/GoToR', '/SubmitForm', '/ImportData', '/JavaScript']:
            with self.subTest(action_type=action_type):
                writer = PdfWriter(); writer.add_blank_page(width=300, height=500)
                annotation(writer, DictionaryObject({NameObject('/S'): NameObject(action_type), NameObject('/F'): TextStringObject('/etc/passwd')}))
                self.assert_rejected(pdf_bytes(writer), 'document_active_content')
        writer = PdfWriter(); writer.add_blank_page(width=300, height=500)
        annotation(writer, DictionaryObject({NameObject('/S'): writer._add_object(NameObject('/Launch')),
                                             NameObject('/F'): TextStringObject('/etc/passwd')}))
        self.assert_rejected(pdf_bytes(writer), 'document_active_content')
        writer = PdfWriter(); writer.add_blank_page(width=300, height=500)
        writer.pages[0][NameObject('/AA')] = writer._add_object(DictionaryObject())
        self.assert_rejected(pdf_bytes(writer), 'document_active_content')

    def test_embedded_files_are_not_extracted(self):
        writer = PdfWriter(); writer.add_blank_page(width=300, height=500)
        writer.add_attachment('payload.exe', b'MZ inert test payload')
        self.assert_rejected(pdf_bytes(writer), 'document_active_content')

    def test_uri_actions_are_inert_and_unsafe_schemes_rejected(self):
        for uri in ['javascript:alert(1)', 'file:///etc/passwd', 'data:text/html,unsafe', '//169.254.169.254/', 'https://example.com/%0aunsafe']:
            with self.subTest(uri=uri):
                writer = PdfWriter(); writer.add_blank_page(width=300, height=500)
                annotation(writer, DictionaryObject({NameObject('/S'): NameObject('/URI'), NameObject('/URI'): TextStringObject(uri)}))
                self.assert_rejected(pdf_bytes(writer), 'document_active_content')
        writer = PdfWriter(); writer.add_blank_page(width=300, height=500)
        annotation(writer, DictionaryObject({NameObject('/S'): NameObject('/URI'), NameObject('/URI'): TextStringObject('https://127.0.0.1/private')}))
        with patch('urllib.request.urlopen', side_effect=AssertionError('No network fetching')), \
             patch('builtins.open', side_effect=AssertionError('No file access')):
            self.assertEqual(validate_pdf(pdf_bytes(writer), 'catalog.pdf')['page_count'], 1)

    def test_page_limit_and_large_metadata_rejected(self):
        self.assert_rejected(pdf_bytes(pages=51), 'document_resource_limit')
        writer = PdfWriter(); writer.add_blank_page(width=300, height=500)
        writer.add_metadata({'/Subject': 'private' * 150_000})
        error = self.assert_rejected(pdf_bytes(writer), 'document_resource_limit')
        self.assertNotIn('private', error.message)

    def test_unused_action_object_and_global_object_budget_are_inspected(self):
        writer = PdfWriter(); writer.add_blank_page(width=300, height=500)
        writer._add_object(DictionaryObject({NameObject('/S'): NameObject('/Launch')}))
        self.assert_rejected(pdf_bytes(writer), 'document_active_content')
        writer = PdfWriter(); writer.add_blank_page(width=300, height=500)
        for _ in range(20_001):
            writer._add_object(DictionaryObject())
        self.assert_rejected(pdf_bytes(writer), 'document_resource_limit')

    def test_oversized_embedded_image_rejected_before_decode(self):
        writer = PdfWriter(); writer.add_blank_page(width=300, height=500)
        image = DictionaryObject({NameObject('/Type'): NameObject('/XObject'), NameObject('/Subtype'): NameObject('/Image'),
                                  NameObject('/Width'): NumberObject(100_000), NameObject('/Height'): NumberObject(100_000)})
        writer.pages[0][NameObject('/Resources')] = DictionaryObject({NameObject('/XObject'): DictionaryObject({NameObject('/Im0'): writer._add_object(image)})})
        self.assert_rejected(pdf_bytes(writer), 'document_resource_limit')

    def test_forms_nonstandard_units_and_invalid_dimensions_are_explicitly_unsupported(self):
        writer = PdfWriter(); writer.add_blank_page(width=300, height=500)
        writer._root_object[NameObject('/AcroForm')] = writer._add_object(DictionaryObject({NameObject('/Fields'): ArrayObject([writer._add_object(DictionaryObject())])}))
        self.assert_rejected(pdf_bytes(writer), 'document_forms_unsupported')
        writer = PdfWriter(); page = writer.add_blank_page(width=300, height=500)
        page[NameObject('/UserUnit')] = NumberObject(2)
        self.assert_rejected(pdf_bytes(writer), 'document_geometry_unsupported')
        page[NameObject('/UserUnit')] = NumberObject(1)
        page[NameObject('/MediaBox')] = ArrayObject([FloatObject(x) for x in [0, 0, -10, 500]])
        self.assert_rejected(pdf_bytes(writer), 'document_invalid_geometry')

    def test_broken_indirect_object_is_a_controlled_failure(self):
        writer = PdfWriter(); writer.add_blank_page(width=300, height=500)
        writer.pages[0][NameObject('/Annots')] = ArrayObject([IndirectObject(999_999, 0, writer)])
        error = self.assert_rejected(pdf_bytes(writer), 'document_invalid_pdf')
        self.assertNotIn('999999', error.message)

    def test_source_envelope_returns_no_original_name_or_text(self):
        result = validate_source_file(pdf_bytes(), 'confidential-customer.pdf')
        self.assertEqual(set(result), {'file_type', 'source_hash', 'size_bytes'})
