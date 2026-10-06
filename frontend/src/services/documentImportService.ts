import api, { API_BASE_URL } from './api';
import type { DocumentImportAnalysis, DocumentImportMode, DocumentSnapshot } from '../types/documentImport';

const endpoint = '/api/v2/studio/catalogs/import-document/';
export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;
export function validateDocumentFile(file: File) {
  if (!file.name.toLowerCase().endsWith('.pdf') || (file.type && file.type !== 'application/pdf')) throw new Error('Para importar Word, exporte o documento como PDF. Apenas PDF é aceito nesta versão.');
  if (!file.size || file.size > MAX_DOCUMENT_BYTES) throw new Error('O PDF deve ter entre 1 byte e 25 MB.');
}
export function documentImportFailure(error: unknown) {
  const failure = error as {code?: string; response?: {status?: number; data?: {code?: string; error?: string; detail?: unknown}}};
  const data = failure?.response?.data;
  const status = failure?.response?.status;
  const code = data?.code || (failure?.code === 'ECONNABORTED' ? 'processing_timeout' : status === 403 ? 'permission_denied' : status === 429 ? 'rate_limit_exceeded' : !failure?.response && failure?.code ? 'network_error' : 'document_invalid');
  const message = typeof data?.error === 'string' ? data.error : typeof data?.detail === 'string' ? data.detail : error instanceof Error ? error.message : 'Não foi possível importar o documento.';
  return {code, message, retryable: ['network_error', 'processing_timeout', 'document_import_retry_conflict', 'rate_limit_exceeded'].includes(code)};
}
export function documentImportError(error: unknown) { return documentImportFailure(error).message; }
export interface CatalogQuota {
  organization: number | null; active_catalogs: number; max_active_catalogs: number;
  remaining_catalog_slots: number; plan_tier: string; plan_name: string;
}
export async function getCatalogQuota(organization: number): Promise<CatalogQuota> {
  return (await api.get('/api/v2/studio/quotas/', {params: {organization}})).data;
}
const importWarnings: Record<string, string> = {
  font_unavailable_source_preserved: 'A fonte original foi preservada na aparência de origem.',
  font_substitute_required_for_editing: 'A aparência original foi preservada. Textos editáveis podem usar uma fonte substituta após edição.',
  BORN_DIGITAL_TEXT_EXTRACTION_DEGRADED: 'O PDF contém texto digital, mas nenhum bloco foi validado para edição. Consulte os detalhes da análise.',
  text_metrics_may_change_after_edit: 'O texto original usa escala especial. A edição pode alterar as métricas; revise o ajuste na caixa de origem.',
  reconstruction_budget_source_preserved: 'O limite seguro de processamento foi atingido. Os demais elementos mantêm a aparência original.',
  clipping_preserved_as_raster: 'Recortes e efeitos complexos foram preservados como imagem.',
  ocr_unavailable_source_preserved: 'Esta página foi preservada como imagem; o reconhecimento de texto não está disponível.',
  geometry_extraction_unavailable_source_preserved: 'A página original foi preservada; seus elementos não puderam ser separados para edição.',
  object_geometry_unavailable_source_preserved: 'Alguns elementos mantêm sua aparência original como imagem.',
  element_limit_source_preserved: 'Esta página contém muitos elementos; a aparência original foi preservada.',
  image_extraction_budget_source_preserved: 'Algumas imagens permanecem na página original, sem separação para edição.',
  image_extraction_unavailable_source_preserved: 'Algumas imagens não puderam ser separadas; sua aparência original foi preservada.',
  reconstruction_pixel_mismatch_source_preserved: 'A reconstrução diferiu do original; a página original foi mantida.',
};
export function documentImportWarning(warning: string) {
  return importWarnings[warning] || (/^[a-z][a-z0-9_]{1,100}$/.test(warning) ? 'Alguns elementos foram preservados como imagem para manter a aparência original.' : warning);
}
export const documentImportService = {
  async reanalyze(catalogId: string, signal?: AbortSignal): Promise<DocumentImportAnalysis> {
    return (await api.post(endpoint, {action: 'reanalyze', catalog_id: catalogId}, {timeout: 120000, signal})).data;
  },
  async confirmReanalysis(catalogId: string, importId: string, signal?: AbortSignal): Promise<DocumentImportAnalysis> {
    return (await api.post(endpoint, {action: 'confirm_reanalysis', catalog_id: catalogId, import_id: importId, replace_reconstruction: true}, {timeout: 120000, signal})).data;
  },
  async analyze(file: File, options: {organization: number; title: string; mode: DocumentImportMode; brandId?: string | null}, signal?: AbortSignal): Promise<DocumentImportAnalysis> {
    validateDocumentFile(file);
    const payload = new FormData();
    payload.append('action', 'analyze'); payload.append('file', file);
    payload.append('organization', String(options.organization)); payload.append('title', options.title);
    payload.append('mode', options.mode); payload.append('remove_background', 'false');
    if (options.brandId) payload.append('brand_id', options.brandId);
    return (await api.post(endpoint, payload, {headers: {'Content-Type': undefined}, timeout: 120000, signal})).data;
  },
  async confirm(importId: string, options: {title: string; mode: DocumentImportMode; brandId?: string | null; organization?: number}, signal?: AbortSignal): Promise<DocumentImportAnalysis> {
    return (await api.post(endpoint, {action: 'confirm', import_id: importId, title: options.title, mode: options.mode, brand_id: options.brandId || null, ...(options.organization != null ? {organization: options.organization} : {})}, {timeout: 120000, signal})).data;
  },
  async prepare(importId: string, options: {title: string; mode: DocumentImportMode; brandId?: string | null}, signal?: AbortSignal): Promise<DocumentImportAnalysis> {
    return (await api.post(endpoint, {action: 'prepare', import_id: importId, title: options.title, mode: options.mode, brand_id: options.brandId || null}, {timeout: 120000, signal})).data;
  },
  async get(importId: string, signal?: AbortSignal): Promise<DocumentImportAnalysis> {
    return (await api.get(endpoint, {params: {import_id: importId}, signal})).data;
  },
  async cancel(importId: string) { await api.delete(endpoint, {params: {import_id: importId}}); },
};

/** Only the configured API receives authentication headers. */
export function protectedDocumentAssetPath(url: string): string | null {
  try {
    const configured = new URL(API_BASE_URL || window.location.origin, window.location.origin);
    const asset = new URL(url, configured);
    if (asset.origin !== configured.origin || !/^\/api\/v2\/studio\/catalogs\/import-document\/assets\/[a-f0-9-]+\/$/i.test(asset.pathname)) return null;
    return asset.pathname + asset.search;
  } catch { return null; }
}
export async function fetchDocumentAsset(snapshot: Pick<DocumentSnapshot, 'url'>, signal?: AbortSignal): Promise<Blob> {
  const path = protectedDocumentAssetPath(snapshot.url);
  if (!path) throw new Error('URL de documento privado inválida.');
  const response = await api.get<Blob>(path, {responseType: 'blob', signal});
  if (!/^image\/(png|jpeg|webp)$/.test(response.data.type)) throw new Error('Imagem de documento inválida.');
  return response.data;
}
