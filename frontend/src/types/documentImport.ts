import { isSafeImageUrl } from '../utils/imagePolicy';

export type DocumentImportMode = 'preserve' | 'editable' | 'redesign';
export interface DocumentSnapshot {
  url: string;
  hash: string;
  assetId?: string;
  mediaId?: string | number;
  widthPixels: number;
  heightPixels: number;
}
export interface DocumentElement {
  id: string;
  type: string;
  x: number; y: number; width: number; height: number;
  text?: string;
  content?: string;
  editable?: boolean;
  edited?: boolean;
  sourceVisible?: boolean | null;
  visibilityStatus?: string;
  role?: string;
  bindingProduct?: string | Record<string, unknown>;
  appearance?: {asset: DocumentSnapshot; x: number; y: number; width: number; height: number};
  snapshot?: DocumentSnapshot;
  font?: { original?: string; resolved?: string; fallback?: boolean; size?: number; weight?: number };
  fontSize?: number;
  fontFamily?: string;
  resolvedFont?: string;
  fontWeight?: number;
  /** User-approved editing weight; extracted source metadata remains immutable. */
  styleRevision?: {fontWeight: number};
  fontStyle?: string;
  fontFallback?: boolean;
  sourceFont?: string;
  sourceFamily?: string;
  fontResolutionStatus?: 'exact' | 'registry_alias' | 'compatible_family' | 'generic_fallback' | 'unresolved';
  textExtractionConfidence?: number;
  geometryConfidence?: number;
  visibilityConfidence?: number;
  fontResolutionConfidence?: number;
  semanticConfidence?: number;
  color?: string;
  rotation?: number;
  zIndex?: number;
  provenance?: { sourcePage?: number; sourceElement?: string; sourceText?: string | null; sourceBoundingBox?: number[]; sourceTextHash?: string | null; confidence?: number };
  [key: string]: unknown;
}

export function effectiveDocumentFontWeight(element: DocumentElement): number {
  return element.styleRevision?.fontWeight ?? element.fontWeight ?? element.font?.weight ?? 400;
}
export interface DocumentPageIR {
  pageNumber: number;
  width: number; height: number; unit: 'pt' | 'px';
  rotation?: number;
  mediaBox?: number[];
  cropBox?: number[];
  visibility: 'source_only' | 'hybrid' | 'reconstructed';
  sourceSnapshot: DocumentSnapshot;
  fallbackSnapshot?: DocumentSnapshot | null;
  elements: DocumentElement[];
  classification?: string;
  quality?: Record<string, unknown>;
  [key: string]: unknown;
}
export interface DocumentImportMetadata {
  importId?: string;
  import_id?: string;
  mode?: DocumentImportMode;
  sourceHash?: string;
  shareEnabled?: boolean;
  share_enabled?: boolean;
  report?: Record<string, unknown>;
  [key: string]: unknown;
}
export interface DocumentImportAnalysis {
  import_id: string;
  status?: string;
  title?: string;
  mode?: DocumentImportMode;
  pages?: import('../data/editorialCatalog.mock').CatalogPageData[];
  document?: { pages: DocumentPageIR[]; pageCount: number; report?: Record<string, unknown>; [key: string]: unknown };
  document_ir?: { pages: DocumentPageIR[]; pageCount: number; report?: Record<string, unknown>; [key: string]: unknown };
  report?: Record<string, unknown>;
  qualityGate?: import('../data/editorialCatalog.mock').QualityGate;
  catalog_id?: number | string;
  [key: string]: unknown;
}

const finitePositive = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;
export function validDocumentSnapshot(value: unknown): value is DocumentSnapshot {
  if (!value || typeof value !== 'object') return false;
  const snapshot = value as DocumentSnapshot;
  return isSafeImageUrl(snapshot.url) && typeof snapshot.hash === 'string' && Boolean(snapshot.hash)
    && finitePositive(snapshot.widthPixels) && finitePositive(snapshot.heightPixels);
}
export function isEditableDocumentText(element: DocumentElement): boolean {
  return element?.type === 'text' && element.editable === true && typeof element.id === 'string'
    && (element.sourceVisible === undefined || element.sourceVisible === true)
    && (element.visibilityStatus === undefined || element.visibilityStatus === 'sourceVisible')
    && [element.textExtractionConfidence, element.geometryConfidence, element.visibilityConfidence].every(value => value === undefined || (typeof value === 'number' && Number.isFinite(value) && value >= .9))
    && ['x', 'y', 'width', 'height'].every(key => typeof element[key] === 'number' && Number.isFinite(element[key]))
    && element.x >= 0 && element.y >= 0 && element.width > 0 && element.height > 0
    && element.x + element.width <= 1.001 && element.y + element.height <= 1.001
    && (element.text == null || typeof element.text === 'string') && (element.content == null || typeof element.content === 'string')
    && (!element.appearance || (validDocumentSnapshot(element.appearance.asset)
      && ['x', 'y', 'width', 'height'].every(key => typeof element.appearance![key as 'x'] === 'number' && Number.isFinite(element.appearance![key as 'x']))
      && element.appearance.x >= 0 && element.appearance.y >= 0 && element.appearance.width > 0 && element.appearance.height > 0
      && element.appearance.x + element.appearance.width <= 1.001 && element.appearance.y + element.appearance.height <= 1.001))
    && (!element.snapshot || validDocumentSnapshot(element.snapshot));
}
/** Imported text belongs to its source; it is never synthesized as a Product. */
export function normalizeDocumentPage(value: unknown): DocumentPageIR | null {
  if (!value || typeof value !== 'object') return null;
  const page = value as DocumentPageIR;
  if (!finitePositive(page.width) || !finitePositive(page.height) || !['pt', 'px'].includes(page.unit)
    || !validDocumentSnapshot(page.sourceSnapshot) || !['source_only', 'hybrid', 'reconstructed'].includes(page.visibility)) return null;
  if (page.fallbackSnapshot != null && !validDocumentSnapshot(page.fallbackSnapshot)) return null;
  if (!Array.isArray(page.elements)) return null;
  // Metadata can legitimately extend outside the visible crop. The renderer
  // validates only interactive text; retained source evidence is never rewritten.
  return page;
}
