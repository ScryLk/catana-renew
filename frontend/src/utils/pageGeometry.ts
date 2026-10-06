/** Source dimensions are fixed; only the publication viewport scales them. */
export interface GeometryPage {
  pageWidth?: number;
  pageHeight?: number;
  sourceUnit?: string;
  documentPage?: {width: number; height: number; unit?: string};
}

export function getPageGeometry(page?: GeometryPage | null) {
  const source = page?.documentPage;
  const width = source?.width ?? page?.pageWidth;
  const height = source?.height ?? page?.pageHeight;
  const valid = typeof width === 'number' && Number.isFinite(width) && width > 0
    && typeof height === 'number' && Number.isFinite(height) && height > 0;
  const unit = (source?.unit ?? page?.sourceUnit) === 'pt' ? 'pt' : 'px';
  if (!valid) return {width: 490, height: 693, unit: 'px' as const, pdfWidthMm: 210, pdfHeightMm: 297};
  const millimeters = unit === 'pt' ? 25.4 / 72 : 25.4 / 96;
  return {width, height, unit, pdfWidthMm: width * millimeters, pdfHeightMm: height * millimeters};
}

export function getSpreadGeometry(left?: GeometryPage | null, right?: GeometryPage | null) {
  const a = getPageGeometry(left ?? right);
  const b = getPageGeometry(right ?? left);
  return {width: a.width + b.width, height: Math.max(a.height, b.height), left: a, right: b};
}

export function pdfGeometryFromElement(element: HTMLElement) {
  const width = Number(element.dataset.sourceWidth);
  const height = Number(element.dataset.sourceHeight);
  return getPageGeometry({pageWidth: width, pageHeight: height, sourceUnit: element.dataset.sourceUnit});
}
