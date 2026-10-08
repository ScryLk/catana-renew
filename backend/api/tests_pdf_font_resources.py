"""Synthetic embedded fonts; no customer PDF or third-party font is stored."""

import io
import struct

from django.test import SimpleTestCase
from PIL import Image, ImageChops
from pypdf import PdfReader, PdfWriter
from pypdf.generic import (
    ArrayObject, DecodedStreamObject, DictionaryObject, NameObject, NumberObject,
)

from api.services.pdf_import_adapter import PdfImportAdapter


def _synthetic_truetype(points):
    """Construct a minimal sfnt containing our own polygon as the glyph A.

    The two programs deliberately share names and metrics but have different
    ink. This exercises PDFium resource identity without installed font files,
    additional font-building dependencies or copyrighted glyphs.
    """
    def unsigned_short(*values):
        return struct.pack('>' + 'H' * len(values), *values)

    def signed_short(*values):
        return struct.pack('>' + 'h' * len(values), *values)

    def unsigned_long(*values):
        return struct.pack('>' + 'I' * len(values), *values)

    xs, ys = zip(*points)
    glyph = signed_short(1, min(xs), min(ys), max(xs), max(ys))
    glyph += unsigned_short(len(points) - 1, 0) + bytes([1] * len(points))
    glyph += signed_short(*(x - (xs[index - 1] if index else 0) for index, x in enumerate(xs)))
    glyph += signed_short(*(y - (ys[index - 1] if index else 0) for index, y in enumerate(ys)))
    glyph += b'\0' * (-len(glyph) % 4)
    family = 'Collision'.encode('utf-16-be')
    tables = {
        b'head': unsigned_long(0x10000, 0x10000, 0, 0x5f0f3cf5) + unsigned_short(0, 1000)
            + b'\0' * 16 + signed_short(0, 0, 500, 700) + unsigned_short(0, 8) + signed_short(2, 0, 0),
        b'hhea': unsigned_long(0x10000) + signed_short(800, -200, 0) + unsigned_short(600)
            + signed_short(0, 100, 500, 1, 0, 0, 0, 0, 0, 0, 0) + unsigned_short(2),
        b'maxp': unsigned_long(0x10000) + unsigned_short(2, len(points), 1, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0),
        b'hmtx': unsigned_short(600, 0, 600, 0),
        b'loca': unsigned_short(0, 0, len(glyph) // 2),
        b'glyf': glyph,
        b'cmap': unsigned_short(0, 1, 3, 1) + unsigned_long(12)
            + unsigned_short(4, 32, 0, 4, 4, 1, 0, 65, 65535, 0, 65, 65535, 65472, 1, 0, 0),
        b'name': unsigned_short(0, 1, 18, 3, 1, 0x409, 1, len(family), 0) + family,
        b'post': unsigned_long(0x30000, 0) + signed_short(0, 0) + unsigned_long(0, 0, 0, 0, 0),
    }
    header = unsigned_long(0x10000) + unsigned_short(len(tables), 128, 3, 16)
    offset = len(header) + 16 * len(tables)
    entries, body = [], b''
    head_offset = None
    for tag, data in sorted(tables.items()):
        padded = data + b'\0' * (-len(data) % 4)
        checksum = sum(struct.unpack('>' + 'I' * (len(padded) // 4), padded)) & 0xffffffff
        entries.append(tag + unsigned_long(checksum, offset, len(data)))
        if tag == b'head':
            head_offset = offset
        body += padded
        offset += len(padded)
    font = bytearray(header + b''.join(entries) + body)
    checksum = sum(struct.unpack('>' + 'I' * (len(font) // 4), font)) & 0xffffffff
    struct.pack_into('>I', font, head_offset + 8, (0xb1b0afba - checksum) & 0xffffffff)
    return bytes(font)


def synthetic_font_collision_pdf():
    writer = PdfWriter()
    page = writer.add_blank_page(width=300, height=200)
    fonts = DictionaryObject()
    programs = (
        ('F1', [(0, 0), (500, 0), (500, 700), (0, 700)]),
        ('F2', [(0, 0), (500, 0), (250, 700)]),
    )
    for label, points in programs:
        program = DecodedStreamObject()
        program.set_data(_synthetic_truetype(points))
        descriptor = DictionaryObject({
            NameObject('/Type'): NameObject('/FontDescriptor'),
            NameObject('/FontName'): NameObject('/Collision'),
            NameObject('/Flags'): NumberObject(32),
            NameObject('/FontBBox'): ArrayObject([NumberObject(value) for value in [0, 0, 500, 700]]),
            NameObject('/ItalicAngle'): NumberObject(0), NameObject('/Ascent'): NumberObject(800),
            NameObject('/Descent'): NumberObject(-200), NameObject('/CapHeight'): NumberObject(700),
            NameObject('/StemV'): NumberObject(80), NameObject('/FontFile2'): writer._add_object(program),
        })
        font = DictionaryObject({
            NameObject('/Type'): NameObject('/Font'), NameObject('/Subtype'): NameObject('/TrueType'),
            NameObject('/BaseFont'): NameObject('/Collision'), NameObject('/Encoding'): NameObject('/WinAnsiEncoding'),
            NameObject('/FirstChar'): NumberObject(65), NameObject('/LastChar'): NumberObject(65),
            NameObject('/Widths'): ArrayObject([NumberObject(600)]),
            NameObject('/FontDescriptor'): writer._add_object(descriptor),
        })
        fonts[NameObject('/' + label)] = writer._add_object(font)
    page[NameObject('/Resources')] = DictionaryObject({NameObject('/Font'): fonts})
    content = DecodedStreamObject()
    # The invisible F1 object keeps that font resource live after removing the
    # first glyph. Regeneration then merges the remaining font names on import,
    # making F2's triangular glyph acquire F1's rectangular mask in the old path.
    content.set_data(
        b'BT /F1 40 Tf 20 140 Td (A) Tj ET\n'
        b'BT /F1 40 Tf 3 Tr 20 110 Td (A) Tj ET\n'
        b'BT /F2 40 Tf 0 Tr 20 80 Td (A) Tj ET\n'
        b'BT /F1 40 Tf 20 20 Td (A) Tj ET'
    )
    page[NameObject('/Contents')] = writer._add_object(content)
    output = io.BytesIO()
    writer.write(output)
    return output.getvalue()


class PdfFontResourceTests(SimpleTestCase):
    def test_same_basefont_distinct_programs_preserve_visible_ink_and_hidden_text(self):
        source_pdf = synthetic_font_collision_pdf()
        fonts = PdfReader(io.BytesIO(source_pdf)).pages[0]['/Resources']['/Font']
        self.assertEqual(fonts['/F1']['/BaseFont'], fonts['/F2']['/BaseFont'])
        self.assertNotEqual(
            fonts['/F1']['/FontDescriptor']['/FontFile2'].get_data(),
            fonts['/F2']['/FontDescriptor']['/FontFile2'].get_data(),
        )
        assets = {}

        def sink(data, name, kind):
            url = '/private-synthetic-assets/' + name
            assets[url] = data
            return {'url': url, 'mediaId': name}

        document = PdfImportAdapter.analyze(source_pdf, 'synthetic-fonts.pdf', sink)
        page = document['pages'][0]
        self.assertEqual(page['quality']['liveTextElementCount'], 4)
        self.assertEqual(page['quality']['editableSourceTextElementCount'], 3)
        target = next(element for element in page['elements'] if element['id'] == 'p1-o3')
        self.assertTrue(target['editable'])
        self.assertTrue(target['sourceVisible'])
        self.assertEqual(target['visibilityStatus'], 'sourceVisible')
        hidden = next(element for element in page['elements'] if element['id'] == 'p1-o2')
        self.assertFalse(hidden['editable'])
        self.assertFalse(hidden['sourceVisible'])

        def image(asset):
            return Image.open(io.BytesIO(assets[asset['url']])).convert('RGB')

        source = image(page['sourceSnapshot'])
        reconstructed = image(page['fallbackSnapshot'])
        for element in page['elements']:
            if element['editable']:
                appearance = element['appearance']
                reconstructed.paste(image(appearance['asset']),
                    (round(appearance['x'] * source.width), round(appearance['y'] * source.height)))
        self.assertIsNone(ImageChops.difference(source, reconstructed).getbbox())
        verification = page['quality']['reconstructionVerification']
        self.assertTrue(verification['exactPixels'])
        self.assertEqual(verification['inkAlphaThreshold'], 16)
