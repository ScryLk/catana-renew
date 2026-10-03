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
  name: string;
  sku: string;
  price: string;
  description: string;
  image: string;
  tag?: string;
  details?: string[];
  source?: 'sheet' | 'system' | 'catalog';
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

export type PageRenderMode = 'legacy' | 'generative';

export type GenerativeBlockType =
  | 'text'
  | 'image'
  | 'product_image'
  | 'metadata'
  | 'price'
  | 'sku'
  | 'caption'
  | 'line'
  | 'shape'
  | 'folio'
  | 'badge'
  | 'quote'
  | 'logo'
  | 'table'
  | 'color_field';

export interface GenerativeBlock {
  id: string;
  type: GenerativeBlockType | string;
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
  content?: string;
  productId?: string;
  imageUrl?: string;
  cropMode?: 'cover' | 'contain' | 'editorial';
  bleed?: boolean;
  allowOverlap?: boolean;
  intentionalCrop?: boolean;
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
}

export interface CatalogPageData {
  id: string;
  pageNumber: number;
  type: PageLayoutType;
  renderMode?: PageRenderMode;
  composition?: GenerativeCompositionMeta;
  safeArea?: { top: number; right: number; bottom: number; left: number };
  blocks?: GenerativeBlock[];
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
