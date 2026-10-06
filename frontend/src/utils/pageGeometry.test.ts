import {describe, expect, it} from 'vitest';
import {getPageGeometry, getSpreadGeometry} from './pageGeometry';

describe('source page geometry', () => {
  it('preserves physical Letter, square and landscape dimensions without converting them to A4', () => {
    for (const [width, height] of [[612, 792], [400, 400], [792, 612]]) {
      const geometry = getPageGeometry({documentPage: {width, height, unit: 'pt'}});
      expect([geometry.width, geometry.height]).toEqual([width, height]);
      expect(geometry.pdfWidthMm).toBeCloseTo(width * 25.4 / 72);
      expect(geometry.pdfHeightMm).toBeCloseTo(height * 25.4 / 72);
    }
  });
  it('sizes mixed-page spreads and a virtual last slot without creating data pages', () => {
    const left = {documentPage: {width: 612, height: 792, unit: 'pt'}};
    const right = {documentPage: {width: 792, height: 612, unit: 'pt'}};
    expect(getSpreadGeometry(left, right)).toMatchObject({width: 1404, height: 792});
    expect(getSpreadGeometry(left, null)).toMatchObject({width: 1224, height: 792});
    expect(right.documentPage.width).toBe(792);
  });
  it('retains legacy A4 behavior and safely rejects invalid source geometry', () => {
    expect(getPageGeometry()).toMatchObject({width: 490, height: 693, pdfWidthMm: 210, pdfHeightMm: 297});
    expect(getPageGeometry({pageWidth: Infinity, pageHeight: -1})).toEqual(getPageGeometry());
  });
});
