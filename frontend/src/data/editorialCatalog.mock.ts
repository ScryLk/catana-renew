import { GENERATIVE_CONTRACT } from '../generated/generativeContract.generated';
import { isSafeImageUrl } from '../utils/imagePolicy';
import { normalizeDocumentPage, type DocumentPageIR } from '../types/documentImport';
/**
 * Catálogo Editorial — Showcase de Design e Tipografia Editorial
 * 
 * Diretrizes de design editorial de alto padrão:
 * - Harmonia cromática de contraste WCAG AAA/AA
 * - Tipografia: Cormorant Garamond (display/título) e Jost (corpo/dados)
 * - Proporção A4 (794x1123) com margens editoriais de 96px
 * - Espaço negativo generoso e filetes de precisão de 1px
 */

export interface ProductItem {
  id: string;
  category: string;
  index: string;
  name: string | null;
  displayLabel?: string;
  sku?: string | null;
  price?: string | null;
  description?: string | null;
  image?: string | null;
  tag?: string | null;
  details?: string[];
  source?: 'sheet' | 'system' | 'catalog';
  quantity?: number | string | null;
  technical_specs?: Record<string, any> | null;
  availability?: string | null;
  inventory?: string | number | null;
  discount?: string | number | null;
}

export type PageLayoutType = 
  | 'cover'
  | 'manifesto'
  | 'divider'
  | 'hero'
  | 'duo'
  | 'single'
  | 'grid_4'
  | 'backcover';

export type PageContentRole =
  | 'opening'
  | 'manifesto'
  | 'product_reveal'
  | 'product_dialogue'
  | 'product_system'
  | 'closing'
  | 'one_pager';

export type OverlayElementType =
  | 'sprite'
  | 'confetti'
  | 'sparkles'
  | 'particles'
  | 'stars'
  | 'meteors'
  | 'focus_ring'
  | 'arrow'
  | 'shape'
  | 'badge'
  | 'stamp'
  | 'divider_rule';

export interface PageOverlayElement {
  id: string;
  type: OverlayElementType;
  subType?: string;
  imageUrl?: string; // URL do sprite gerado por IA com fundo transparente
  prompt?: string; // Prompt original utilizado na geracao do asset
  x: number; // 0-100% horizontal
  y: number; // 0-100% vertical
  width?: number;
  height?: number;
  rotation?: number; // graus (-180 a 180)
  scale?: number;
  color?: string;
  strokeColor?: string;
  fillColor?: string;
  strokeWidth?: number;
  opacity?: number;
  text?: string;
  subText?: string;
  targetSlotIndex?: number; // slot do produto (0, 1, 2, 3)
  targetProductId?: string;
  arrowDirection?: string;
  density?: 'low' | 'medium' | 'high';
  zIndex?: number;
}

export type PageRenderMode = typeof GENERATIVE_CONTRACT.renderModes[number] | 'document';
export type GenerativeBlockType = typeof GENERATIVE_CONTRACT.blockTypes[number];
export const VALID_GENERATIVE_BLOCK_TYPES: readonly GenerativeBlockType[] = GENERATIVE_CONTRACT.blockTypes;

export interface GenerativeBlock {
  id: string;
  type: GenerativeBlockType;
  role?: string;
  x: number; // 0.0 a 1.0 (coordenada horizontal normalizada)
  y: number; // 0.0 a 1.0 (coordenada vertical normalizada)
  width: number; // 0.0 a 1.0
  height: number; // 0.0 a 1.0
  rotation?: number; // Graus
  opacity?: number; // 0.0 a 1.0
  zIndex?: number;
  alignment?: 'left' | 'center' | 'right';
  fontRole?: 'display' | 'body' | 'metadata';
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  letterSpacing?: string;
  lineHeight?: number;
  textTransform?: 'none' | 'uppercase' | 'lowercase';
  colorToken?: string;
  content?: string | number | null;
  productId?: string;
  imageUrl?: string;
  cropMode?: 'cover' | 'contain' | 'editorial';
  bleed?: boolean;
  allowOverlap?: boolean;
  intentionalCrop?: boolean;
  marginExempt?: boolean;
}

/**
 * Validação em tempo de execução para blocos recebidos da API (Item 20)
 * Garante que o frontend Studio nunca quebre por blocos malformados.
 */
export function validateGenerativeBlock(block: any): GenerativeBlock | null {
  if (!block || typeof block !== 'object' || Array.isArray(block)) return null;
  if (!block.id || typeof block.id !== 'string' || !VALID_GENERATIVE_BLOCK_TYPES.includes(block.type)) return null;
  const forbidden = new Set(['innerhtml', 'dangerouslysetinnerhtml', 'rawhtml', 'rawcss', 'html', 'stylestring', 'script', 'eval']);
  const inspect = (value: unknown): boolean => {
    if (Array.isArray(value)) return value.every(inspect);
    if (value && typeof value === 'object') return Object.entries(value).every(([key, child]) =>
      !forbidden.has(key.toLowerCase()) && !key.toLowerCase().startsWith('on') &&
      (!['imageurl', 'src', 'url', 'href'].includes(key.toLowerCase()) || child == null || isSafeImageUrl(child)) && inspect(child));
    return typeof value !== 'number' || Number.isFinite(value);
  };
  if (!inspect(block)) return null;
  if (!['x', 'y', 'width', 'height'].every(k => typeof block[k] === 'number' && Number.isFinite(block[k]))) return null;
  const margin = block.bleed === true ? 0.05 : 0;
  if (block.width <= 0 || block.height <= 0 || block.x < -margin || block.y < -margin || block.x + block.width > 1 + margin + 1e-9 || block.y + block.height > 1 + margin + 1e-9) return null;
  for (const [key, low, high] of [['opacity', 0, 1], ['rotation', -360, 360], ['fontSize', 0.1, 500], ['fontWeight', 1, 1000], ['lineHeight', 0.1, 10], ['zIndex', -100, 1000]] as const) {
    if (block[key] != null && (typeof block[key] !== 'number' || !Number.isFinite(block[key]) || block[key] < low || block[key] > high)) return null;
  }
  for (const key of ['imageUrl','fontFamily','letterSpacing','colorToken']) {
    if (block[key] != null && typeof block[key] !== 'string') return null;
  }
  for (const [key, allowed] of [['alignment',['left','center','right']], ['textTransform',['none','uppercase','lowercase']], ['cropMode',['cover','contain','editorial']]] as const) {
    if (block[key] != null && !(allowed as readonly string[]).includes(block[key])) return null;
  }
  if (block.content != null && !['string', 'number'].includes(typeof block.content)) return null;
  if (block.letterSpacing != null && !/^-?\d+(?:\.\d+)?(?:em|px)$/.test(block.letterSpacing)) return null;
  return block;
}

export interface QualityGate {
  passed: boolean;
  publishable: boolean;
  status: 'passed' | 'needs_review' | 'blocked';
  reasons: string[];
}

/** Applied before data enters the store and again at the renderer boundary. */
export function normalizeCatalogDocument<T extends { pages?: CatalogPageData[]; qualityGate?: QualityGate }>(document: T): T {
  const blockedGate: QualityGate = {passed:false, publishable:false, status:'blocked', reasons:['INVALID_RUNTIME_BLOCK']};
  const normalizeGate = (gate: unknown): QualityGate | undefined => {
    if (gate == null) return undefined;
    const value = gate as QualityGate;
    if (typeof value.passed !== 'boolean' || typeof value.publishable !== 'boolean' || !['passed','needs_review','blocked'].includes(value.status) || !Array.isArray(value.reasons) || !value.reasons.every(r => typeof r === 'string')) return {...blockedGate, reasons:['INVALID_QUALITY_GATE']};
    if (value.publishable && (!value.passed || value.status !== 'passed' || value.reasons.length > 0)) return {...blockedGate, reasons:['INCONSISTENT_QUALITY_GATE']};
    return value;
  };
  const qualityGate = normalizeGate(document.qualityGate);
  let invalid = document.pages !== undefined && !Array.isArray(document.pages);
  const pages = (Array.isArray(document?.pages) ? document.pages : []).filter(page => {if (!page || typeof page !== 'object') {invalid=true; return false;} return true;}).map(page => {
    let pageInvalid = false;
    if (page.renderMode === 'document') {
      const documentPage = normalizeDocumentPage(page.documentPage);
      if (!documentPage) { invalid = true; pageInvalid = true; }
      return {...page, documentPage: documentPage || undefined, renderMode: 'document' as const, ...(page.blocks ? {blocks: []} : {}), products: [],
        qualityGate: pageInvalid ? blockedGate : qualityGate || normalizeGate(page.qualityGate)};
    }
    const products = (Array.isArray(page.products) ? page.products : []).filter(product => product && typeof product === 'object').map(product => ({ ...product,
      ...(page.documentPage ? {} : Object.fromEntries(GENERATIVE_CONTRACT.nullableProductFields.map(field => [field, (product as any)[field] ?? null]))),
      ...(page.documentPage && product.image == null ? {} : {image: isSafeImageUrl(product.image) ? product.image : null}),
    })) as ProductItem[];
    const blocks = (Array.isArray(page.blocks) ? page.blocks : []).flatMap(raw => {
      const block = validateGenerativeBlock(raw);
      if (!block) { invalid = true; pageInvalid=true; return []; }
      const commercialField = block.type === 'price' || block.type === 'sku' ? block.type : block.role === 'product_name' ? 'name' : block.role === 'product_description' ? 'description' : null;
      if (commercialField || block.type === 'product_image') {
        const product = products.find(p => String(p.id) === String(block.productId));
        if (!product) { invalid = true; pageInvalid=true; return []; }
        const expected = commercialField ? product[commercialField] : product.image;
        const actual = commercialField ? block.content : block.imageUrl;
        if (actual !== undefined && actual !== expected) { invalid = true; pageInvalid=true; return []; }
        if (expected == null) return [];
        return [{ ...block, ...(commercialField ? {content: expected} : {imageUrl: expected as string}) }];
      }
      return [block];
    });
    const generativeDraft = Array.isArray(page.generativeDraft) ? { blocks: page.generativeDraft } : page.generativeDraft;
    return { ...page, qualityGate: pageInvalid ? blockedGate : qualityGate || normalizeGate(page.qualityGate), products, generativeDraft, renderMode: page.renderMode === 'generative' ? 'generative' as const : 'legacy' as const,
      blocks: page.renderMode === 'generative' ? blocks : [],
      editorialImage: isSafeImageUrl(page.editorialImage) ? page.editorialImage : undefined };
  });
  if (invalid && import.meta.env.DEV) console.warn('Invalid generative blocks discarded');
  const persistedFailure = pages.find(page => page.qualityGate?.publishable === false)?.qualityGate;
  return { ...document, qualityGate, pages, ...(persistedFailure ? {qualityGate:persistedFailure} : {}), ...(invalid ? {qualityGate: {passed:false, publishable:false, status:'blocked', reasons:['INVALID_RUNTIME_BLOCK']}} : {}) } as T;
}

export interface GenerativeCompositionMeta {
  grid?: {
    columns: number;
    rows: number;
    gutter: number;
  };
  balance?: 'asymmetric' | 'axial' | 'diagonal';
  axis?: string;
  whitespaceRatio?: number;
  visualTension?: number;
  dominantPrimitive?: string;
  lastMutation?: string;
  mutationSeed?: number;
}

export interface CatalogPageData {
  documentPage?: DocumentPageIR;
  pageWidth?: number;
  pageHeight?: number;
  sourceUnit?: 'pt' | 'px';
  qualityGate?: QualityGate;
  id: string;
  pageNumber: number;
  type: PageLayoutType;
  contentRole?: PageContentRole | string;
  renderMode?: PageRenderMode;
  composition?: GenerativeCompositionMeta;
  safeArea?: { top: number; right: number; bottom: number; left: number };
  blocks?: GenerativeBlock[];
  generativeDraft?: {
    blocks?: GenerativeBlock[];
    composition?: GenerativeCompositionMeta;
    safeArea?: { top: number; right: number; bottom: number; left: number };
  };
  visualDNA?: Record<string, number>;
  creativeDirection?: Record<string, any>;
  title?: string;
  subtitle?: string;
  label?: string;
  quote?: string;
  content?: string;
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  editorialImage?: string;
  folio?: string;
  products?: ProductItem[];
  mirrored?: boolean;
  overlays?: PageOverlayElement[];
}

export interface StudioPalette {
  name: string;
  primary: string; // Dominante escuro (Noir / Capas / Texto dominante)
  background: string; // Fundo claro / tela (Ivory / Páginas)
  accent: string; // Acento nobre (Ouro, Prata, Bronze, etc.)
  secondary?: string; // Neutro de apoio (Cinza ardósia / Fólios)
  surface?: string; // Superfícies e cartões
  contrastRatio?: string; // Razão de contraste sob WCAG
  locked?: boolean; // Trava de Marca (Brand Lock)
}

export const DEFAULT_STUDIO_PALETTE: StudioPalette = {
  name: 'Luxe · Noir & Or',
  primary: '#1A1817', // Off-black
  background: '#F5F1EA', // Ivory
  accent: '#B08D57', // Ouro envelhecido
  secondary: '#4A4846', // Cinza ardósia
  surface: '#FDFBF7',
  contrastRatio: '9.2:1 (AAA)',
  locked: false,
};

export const STUDIO_PALETTE_PRESETS: StudioPalette[] = [
  {
    name: 'Luxe · Noir & Or',
    primary: '#1A1817',
    background: '#F5F1EA',
    accent: '#B08D57',
    secondary: '#4A4846',
    surface: '#FDFBF7',
    contrastRatio: '9.2:1 (AAA)',
    locked: false,
  },
  {
    name: 'Atelier · Noir & Argent 925',
    primary: '#121214',
    background: '#F6F7F9',
    accent: '#C0C0C0',
    secondary: '#52525B',
    surface: '#FFFFFF',
    contrastRatio: '8.8:1 (AAA)',
    locked: false,
  },
  {
    name: 'Acervo · Charcoal & Bronze',
    primary: '#201E1C',
    background: '#F3EFEA',
    accent: '#9E6B47',
    secondary: '#5C544E',
    surface: '#FAF8F5',
    contrastRatio: '8.4:1 (AAA)',
    locked: false,
  },
  {
    name: 'Édition · Terracotta & Sable',
    primary: '#2C1E1A',
    background: '#FAF6F0',
    accent: '#C86D51',
    secondary: '#6A4D45',
    surface: '#FFFDF9',
    contrastRatio: '7.9:1 (AA)',
    locked: false,
  },
  {
    name: 'Minimaliste · Slate & Pure Ivory',
    primary: '#1E2022',
    background: '#F8FAFC',
    accent: '#64748B',
    secondary: '#94A3B8',
    surface: '#FFFFFF',
    contrastRatio: '7.5:1 (AA)',
    locked: false,
  },
  {
    name: 'Haute Couture · Emerald & Champagne',
    primary: '#0E1A16',
    background: '#F4F7F5',
    accent: '#C5A869',
    secondary: '#2E473D',
    surface: '#FFFFFF',
    contrastRatio: '8.9:1 (AAA)',
    locked: false,
  },
];

export const EDITORIAL_PAGES: CatalogPageData[] = [
  // ================= PAGINA 01: CAPA =================
  {
    id: 'editorial-page-1',
    pageNumber: 1,
    type: 'cover',
    title: 'CATANA',
    subtitle: 'DESIGN & ATELIER EDITORIAL',
    label: 'COLEÇÃO 2026',
    backgroundColor: '#1A1817',
    textColor: '#F5F1EA',
    accentColor: '#B08D57',
    folio: '',
  },

  // ================= PAGINA 02: MANIFESTO =================
  {
    id: 'editorial-page-2',
    pageNumber: 2,
    type: 'manifesto',
    label: 'MANIFESTO',
    quote: 'O essencial,\nexecutado sem pressa.',
    content:
      'Fundado sobre uma única convicção: peças desenhadas com rigor e executadas de forma irrepreensível comunicam valor duradouro.',
    backgroundColor: '#F5F1EA',
    textColor: '#1A1817',
    accentColor: '#B08D57',
    folio: '02 · MANIFESTO',
  },

  // ================= PAGINA 03: DIVISORIA =================
  {
    id: 'editorial-page-3',
    pageNumber: 3,
    type: 'divider',
    label: 'COLEÇÃO I',
    title: 'SELEÇÃO PRINCIPAL',
    subtitle: 'Criações autorais e manufatura de precisão',
    editorialImage: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=1200&q=80',
    backgroundColor: '#1A1817',
    textColor: '#F5F1EA',
    accentColor: '#B08D57',
    folio: '',
  },

  // ================= PAGINA 04: HERO =================
  {
    id: 'editorial-page-4',
    pageNumber: 4,
    type: 'hero',
    label: 'DESTAQUE · 01',
    backgroundColor: '#F5F1EA',
    textColor: '#1A1817',
    accentColor: '#B08D57',
    folio: '04 · LOOKBOOK',
    products: [
      {
        id: 'prod-destaque-1',
        category: 'DESTAQUE',
        index: '01',
        name: 'Peça de Assinatura Monolith',
        sku: 'EDT-001',
        price: 'R$ 4.900',
        description:
          'Materiais nobres com acabamento artesanal, linhas puras e encaixes milimétricos de alta durabilidade.',
        image: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800&q=80',
        tag: 'Destaque Coleção',
        details: ['Acabamento manual', 'Garantia vitalícia', 'Série numerada'],
      },
    ],
  },

  // ================= PAGINA 05: DUO =================
  {
    id: 'editorial-page-5',
    pageNumber: 5,
    type: 'duo',
    label: 'SELEÇÃO · ITENS',
    backgroundColor: '#F5F1EA',
    textColor: '#1A1817',
    accentColor: '#B08D57',
    folio: '05 · ACERVO',
    mirrored: false,
    products: [
      {
        id: 'prod-item-2',
        category: 'COMPLEMENTOS',
        index: '02',
        name: 'Item Harmônico Série A',
        sku: 'EDT-002',
        price: 'R$ 890',
        description: 'Estrutura precisa em liga metálica nobre e tratamento de superfície escovado.',
        image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80',
      },
      {
        id: 'prod-item-3',
        category: 'COMPLEMENTOS',
        index: '03',
        name: 'Item Harmônico Série B',
        sku: 'EDT-003',
        price: 'R$ 1.190',
        description: 'Desenvolvido para máxima ergonomia e integração perfeita ao portfólio.',
        image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80',
      },
    ],
  },

  // ================= PAGINA 06: CONTRACAPA =================
  {
    id: 'editorial-page-6',
    pageNumber: 6,
    type: 'backcover',
    label: 'ATENDIMENTO & INFORMAÇÕES',
    title: 'STUDIO EDITORIAL',
    content:
      'ATENDIMENTO EXECUTIVO · CONTATO@CATANA.COM.BR\nWWW.USECATANA.COM.BR',
    backgroundColor: '#1A1817',
    textColor: '#F5F1EA',
    accentColor: '#B08D57',
    folio: 'CATANA · 2026',
  },
];

export const DEFAULT_STUDIO_PAGES = EDITORIAL_PAGES;
