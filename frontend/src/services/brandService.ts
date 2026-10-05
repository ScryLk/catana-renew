import api from './api';
import type { Brand, RecentCatalogItem } from '../store/studioStore';
import { cropImageToDataUrl } from '../utils/colorExtractor';
import { parseBrandMarkdown } from '../utils/brandMarkdownParser';

export type BrandEvidenceStatus = 'user_supplied' | 'inferred' | 'confirmed' | 'rejected';
export interface BrandColor { hex: string; role: string; source: string; status: BrandEvidenceStatus; confidence?: number }
export interface BrandRule { id: string; type: 'MUST' | 'PREFER' | 'AVOID'; category: string; rule: string; source: string; status: BrandEvidenceStatus; confidence?: number }
export interface BrandInference { value: unknown; source: string; status: BrandEvidenceStatus; confidence?: number }
export interface BrandAsset { id: string; kind: string; url?: string; media?: number; width?: number; height?: number }
export interface BrandSnapshotState { brandId: string | null; brandVersion: number | null; brandSnapshot: Record<string, unknown> | null; brandSnapshotHash: string | null }

interface BackendBrand {
  id: string; organization: number; name: string; segment?: string; logo_url?: string;
  palette_name?: string; custom_palette?: Brand['customPalette']; brand_markdown?: string;
  tone_of_voice?: string; commercial_contact?: Brand['commercialContact']; created_at: string;
  status?: string; current_version?: number; colors?: BrandColor[]; guidelines?: BrandRule[];
  memories?: BrandRule[]; intelligence?: Record<string, BrandInference>; assets?: BrandAsset[];
  catalog_ids?: Array<string | number>; legacy_data?: Record<string, unknown>;
}

/** Compatibility adapter: one server Brand domain, the existing Studio vocabulary. */
export function adaptBrand(data: BackendBrand): Brand {
  return {
    id: String(data.id), organization: data.organization, name: data.name, segment: data.segment,
    logoUrl: data.logo_url, paletteName: data.palette_name, customPalette: data.custom_palette,
    brandMarkdown: data.brand_markdown, toneOfVoice: data.tone_of_voice,
    commercialContact: data.commercial_contact, createdAt: data.created_at,
    status: data.status, currentVersion: data.current_version || 1, colors: data.colors || [],
    guidelines: data.guidelines || [], memories: data.memories || [],
    intelligence: data.intelligence || {}, assets: data.assets || [], catalogs: [],
  };
}

export function brandPayload(brand: Partial<Brand>, organization: number) {
  return {
    organization, name: brand.name, segment: brand.segment || '', logo_url: brand.logoUrl || '',
    palette_name: brand.paletteName || '', custom_palette: brand.customPalette || {},
    brand_markdown: brand.brandMarkdown || '', tone_of_voice: brand.toneOfVoice || '',
    commercial_contact: brand.commercialContact || {}, ...(brand.colors ? {colors: brand.colors} : {}),
    guidelines_input: parseBrandMarkdown(brand.brandMarkdown || '').guidelines,
  };
}

/** Editing the familiar three swatches must preserve the rest of the Brand kit. */
export function brandVisualUpdate(brand: Brand | null | undefined, name: string, swatches: {primary: string; secondary: string; accent: string}, source: string) {
  const customPalette = {...brand?.customPalette,
    name: `Paleta ${name}`, ...swatches,
    background: brand?.customPalette?.background || '#F6F5F2',
    surface: brand?.customPalette?.surface || '#FFFFFF', locked: true};
  const colors: BrandColor[] = [
    ...(brand?.colors || []).filter(color => !['primary', 'secondary', 'accent'].includes(color.role)),
    ...Object.entries(swatches).map(([role, hex]): BrandColor => brand?.colors?.find(color => color.role === role && color.hex.toUpperCase() === hex.toUpperCase()) || ({role, hex, source, status: 'confirmed'})),
  ];
  return {customPalette, colors};
}

async function persistedLogo(brand: Partial<Brand>): Promise<Partial<Brand>> {
  if (!brand.logoUrl?.startsWith('data:image/svg+xml')) return brand;
  try {
    const logoUrl = await cropImageToDataUrl(brand.logoUrl, {x: 0, y: 0, width: 1, height: 1});
    return {...brand, logoUrl};
  } catch { throw new Error('Não foi possível converter o logo SVG. Selecione um PNG; a marca original neste navegador foi preservada.'); }
}

const cacheKey = (userId: string | number, organization: number) => `katana_brand_cache:v1:${userId}:${organization}`;
export function readBrandCache(userId: string | number, organization: number): Brand[] {
  try {
    const cached = JSON.parse(localStorage.getItem(cacheKey(userId, organization)) || 'null');
    return Array.isArray(cached) ? cached.filter((brand: Brand) => brand.organization === organization) : [];
  } catch { return []; }
}
export function writeBrandCache(userId: string | number, organization: number, brands: Brand[]) {
  try { localStorage.setItem(cacheKey(userId, organization), JSON.stringify(brands.filter(brand => brand.organization === organization))); } catch { /* Cache is optional. */ }
}

/** Legacy keys had no tenant. Only an explicit destination choice can import them. */
export function readLegacyBrands(userId: string | number): Brand[] {
  if (userId === 'anonymous') return [];
  try {
    const brands = JSON.parse(localStorage.getItem(`katana_studio_brands:${userId}`) || 'null');
    return Array.isArray(brands) ? brands.filter(brand => brand && typeof brand.id === 'string' && typeof brand.name === 'string') : [];
  } catch { return []; }
}
export function legacyMigrationKey(userId: string | number, organization: number) {
  return `katana_brand_migration:v1:${userId}:${organization}`;
}
export function pendingLegacyBrands(userId: string | number, organization: number): Brand[] {
  try {
    const mapping = JSON.parse(localStorage.getItem(legacyMigrationKey(userId, organization)) || '{}');
    return readLegacyBrands(userId).filter(brand => !mapping[brand.id]);
  } catch { return readLegacyBrands(userId); }
}

/** Catalog history never changes when active Brand truth changes. */
export function catalogBrandSnapshot(data: Record<string, unknown>): BrandSnapshotState {
  const id = data.brand_id ?? data.brandId ?? data.brand;
  return {
    brandId: typeof id === 'string' || typeof id === 'number' ? String(id) : null,
    brandVersion: typeof (data.brand_version ?? data.brandVersion) === 'number' ? (data.brand_version ?? data.brandVersion) as number : null,
    brandSnapshot: (data.brand_snapshot ?? data.brandSnapshot ?? null) as Record<string, unknown> | null,
    brandSnapshotHash: (data.brand_snapshot_hash ?? data.brandSnapshotHash ?? null) as string | null,
  };
}

export function groupBrandCatalogs(brands: Brand[], catalogs: Array<Record<string, unknown>>) {
  const grouped = brands.map(brand => ({...brand, catalogs: [] as RecentCatalogItem[]}));
  const unlinked: RecentCatalogItem[] = [];
  for (const catalog of catalogs) {
    const {brandId} = catalogBrandSnapshot(catalog);
    const item: RecentCatalogItem = {
      id: String(catalog.id), title: String(catalog.title || 'Catálogo'),
      totalPages: Number(catalog.total_pages || Number(catalog.spread_count || 0) * 2 || 6),
      category: String(catalog.style_preset || 'Editorial'), updatedAt: 'Salvo no banco', brandId,
    };
    const brand = grouped.find(candidate => candidate.id === brandId);
    if (brand) brand.catalogs.push(item); else unlinked.push(item);
  }
  return {brands: grouped, unlinkedCatalogs: unlinked};
}

export const brandService = {
  async list(organization: number): Promise<Brand[]> {
    const {data} = await api.get<BackendBrand[] | {results: BackendBrand[]}>(`/api/brands/?organization=${organization}&status=all`);
    return (Array.isArray(data) ? data : data.results).map(adaptBrand);
  },
  async create(brand: Partial<Brand>, organization: number) {
    const {data} = await api.post<BackendBrand>('/api/brands/', brandPayload(await persistedLogo(brand), organization));
    return adaptBrand(data);
  },
  async update(id: string, brand: Partial<Brand>, organization: number) {
    const {data} = await api.patch<BackendBrand>(`/api/brands/${id}/`, brandPayload(await persistedLogo(brand), organization));
    return adaptBrand(data);
  },
  async archive(id: string) { await api.delete(`/api/brands/${id}/`); },
  async migrate(userId: string | number, organization: number) {
    const brands = pendingLegacyBrands(userId, organization);
    if (!brands.length) return {brands: [] as Brand[], idMapping: {} as Record<string, string>};
    const payload = await Promise.all(brands.map(async brand => ({...await persistedLogo(brand), guidelines_input: parseBrandMarkdown(brand.brandMarkdown || '').guidelines})));
    const {data} = await api.post<{brands: BackendBrand[]; id_mapping: Record<string, string>}>('/api/brands/migrate/', {organization, brands: payload});
    // The source key stays intact for rollback; mark only acknowledged server IDs.
    try {
      const previous = JSON.parse(localStorage.getItem(legacyMigrationKey(userId, organization)) || '{}');
      localStorage.setItem(legacyMigrationKey(userId, organization), JSON.stringify({...previous, ...data.id_mapping}));
    } catch { /* Server import remains idempotent if cache is unavailable. */ }
    return {brands: data.brands.map(adaptBrand), idMapping: data.id_mapping};
  },
  async decide(id: string, decision: {kind: 'guideline' | 'memory' | 'intelligence' | 'color'; id?: string; key?: string; status: 'confirmed' | 'rejected'}) {
    const payload = decision.kind === 'color' ? {...decision, id: Number(decision.id)} : decision;
    if (decision.kind === 'color' && (!Number.isInteger(payload.id) || Number(payload.id) < 0)) throw new Error('Selecione uma cor válida para confirmar.');
    await api.post(`/api/brands/${id}/decisions/`, payload);
    const {data} = await api.get<BackendBrand>(`/api/brands/${id}/`);
    return adaptBrand(data);
  },
  async addRule(id: string, kind: 'guidelines' | 'memories', rule: Omit<BrandRule, 'id'>) {
    await api.post(`/api/brands/${id}/${kind}/`, rule);
    const {data} = await api.get<BackendBrand>(`/api/brands/${id}/`);
    return adaptBrand(data);
  },
};
