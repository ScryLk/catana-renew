export type ElementType =
  // Products
  | 'product-card'
  | 'product-highlight'
  | 'product-list'
  | 'product-grid'
  // Text
  | 'text-title'
  | 'text-subtitle'
  | 'text-paragraph'
  | 'text-list'
  // Media
  | 'image'
  | 'banner'
  | 'gallery'
  | 'carousel'
  | 'uploaded-image'
  // Shapes
  | 'shape-rectangle'
  | 'shape-circle'
  | 'shape-triangle'
  | 'shape-line'
  | 'shape-square'
  | 'shape-frame'
  | 'line'
  // Highlights & Callouts
  | 'highlight-banner'
  | 'highlight-callout'
  | 'testimonial'
  // Technical
  | 'technical-specs'
  | 'feature-list'
  | 'data-table'
  // Interactive
  | 'qr-code'
  | 'icon-grid'
  | 'certification-badge'
  // Layout
  | 'footer'
  | 'divider'
  // DiPACK Templates
  | 'dipack-cover'
  | 'dipack-institutional'
  | 'dipack-showcase'
  | 'dipack-footer'
  | 'dipack-back-cover'
  | 'dipack-confeitaria'
  | 'dipack-confeitaria-intro'
  | 'dipack-acougue'
  | 'dipack-acougue-intro'
  | 'dipack-festa'
  | 'dipack-festa-intro'
  | 'dipack-food-service'
  | 'dipack-food-service-intro';

export type ProductCardVariant = 'compact' | 'detailed' | 'featured' | 'grid-item';
export type HighlightVariant = 'info' | 'success' | 'warning' | 'error' | 'primary';
export type LayoutType = 'grid' | 'list' | 'masonry';
export type BadgeType = 'iso' | 'ce' | 'rohs' | 'energy' | 'fcc' | 'custom';

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface ElementStyle {
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  borderStyle?: 'solid' | 'dashed' | 'dotted';
  padding?: number;
  margin?: number;
  opacity?: number;
  shadow?: boolean;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string;
  fontStyle?: 'normal' | 'italic';
  textDecoration?: 'none' | 'underline' | 'line-through';
  textColor?: string;
  textAlign?: 'left' | 'center' | 'right';
  lineHeight?: number;
  letterSpacing?: number;
  // Image properties
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  brightness?: number;
  contrast?: number;
  saturate?: number;
  grayscale?: number;
  blur?: number;
  // Line properties
  lineStyle?: 'solid' | 'dashed' | 'dotted';
  startArrow?: boolean;
  endArrow?: boolean;
  arrowSize?: number;
  // Sombra CSS bruta (quando precisar de mais controle que o flag `shadow`)
  boxShadow?: string;
}

// Dados de texto de um elemento de texto.
export interface TextData {
  content: string;
  text?: string; // alias legado usado em validacoes
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string | number;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  textColor?: string;
  lineHeight?: number;
  letterSpacing?: number;
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  textDecoration?: 'none' | 'underline' | 'line-through';
}

// Configuracao de layout interno de um elemento (colunas, espacamento, dimensionamento).
export interface ElementLayout {
  columns?: number;
  padding?: number;
  alignment?: 'left' | 'center' | 'right';
  widthMode?: 'fixed' | 'auto';
  heightMode?: 'fixed' | 'auto';
}

// Configuracao de branding por elemento (templates parametrizaveis).
export interface ElementBranding {
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string;
  backgroundType?: 'solid' | 'gradient' | 'image';
  gradientStart?: string;
  gradientEnd?: string;
  highlightPrice?: boolean;
  priceHighlightColor?: string;
  showBorder?: boolean;
  showShadow?: boolean;
}

// Data structures for specific element types
export interface ProductData {
  name: string;
  image: string;
  price: number;
  currency: string;
  description?: string;
  specs?: Array<{ label: string; value: string }>;
  badge?: string;
  sku?: string;
  code?: string;
  category?: string;
  isNew?: boolean;
}

export interface HighlightBannerData {
  title: string;
  subtitle?: string;
  image?: string;
  ctaText?: string;
  ctaLink?: string;
  variant: HighlightVariant;
}

export interface HighlightCalloutData {
  icon?: string;
  title: string;
  message: string;
  variant: HighlightVariant;
}

export interface TestimonialData {
  quote: string;
  author: string;
  role?: string;
  company?: string;
  avatar?: string;
  rating?: number;
}

export interface TechnicalSpecsData {
  title: string;
  specs: Array<{
    category: string;
    items: Array<{ label: string; value: string; icon?: string }>;
  }>;
}

export interface FeatureListData {
  title: string;
  subtitle?: string;
  features: Array<{
    icon: string;
    title: string;
    description: string;
  }>;
  layout: LayoutType;
}

export interface GalleryData {
  images: Array<{
    src: string;
    alt: string;
    caption?: string;
    thumbnail?: string;
  }>;
  columns: number;
  spacing: number;
  lightbox?: boolean;
}

export interface CarouselData {
  slides: Array<{
    image: string;
    title?: string;
    description?: string;
    link?: string;
  }>;
  autoplay: boolean;
  interval?: number;
  showIndicators?: boolean;
  showControls?: boolean;
}

export type QRCodeDestinationType = 'catalog' | 'product' | 'profile' | 'url';

export interface QRCodeData {
  // Tipo de destino
  destinationType?: QRCodeDestinationType;

  // Dados baseados no tipo
  data?: string; // URL final gerada ou URL customizada
  catalogId?: number; // Se tipo = 'catalog'
  productId?: number; // Se tipo = 'product'
  profileId?: number; // Se tipo = 'profile'
  customUrl?: string; // Se tipo = 'url'

  // Personalização visual
  color?: string; // Cor do QR Code
  backgroundColor?: string; // Cor de fundo
  logo?: string; // URL do logo central
  logoSize?: number; // Tamanho do logo (px)
  errorCorrection?: 'L' | 'M' | 'Q' | 'H'; // Nível de correção de erro

  // Margem e qualidade
  margin?: number; // Margem em pixels (padrão 4)
  quality?: 'low' | 'medium' | 'high'; // Qualidade de renderização

  // Tracking e metadados
  trackScans?: boolean; // Se deve rastrear scans
  label?: string; // Label descritivo (aparece abaixo do QR se houver espaço)
}

export interface IconGridData {
  title?: string;
  icons: Array<{
    icon: string;
    label: string;
    description?: string;
    color?: string;
  }>;
  columns: number;
  spacing: number;
}

export interface CertificationBadgeData {
  badgeType: BadgeType;
  label: string;
  image?: string;
  description?: string;
  date?: string;
  certNumber?: string;
}

export interface TableData {
  headers: string[];
  rows: string[][];
  striped: boolean;
  bordered: boolean;
  hoverable?: boolean;
  compact?: boolean;
}

export interface FooterData {
  sections: Array<{
    title: string;
    links: Array<{ label: string; url: string }>;
  }>;
  copyright: string;
  logo?: string;
  socialLinks?: Array<{ platform: string; url: string; icon: string }>;
}

/**
 * 🎯 Linha - Elemento geométrico nativo (RECRIADO DO ZERO)
 *
 * Comportamento Figma-like profissional:
 * - Pontos em coordenadas ABSOLUTAS de world space
 * - Resize nunca move a âncora
 * - Endpoint ativo colado ao cursor
 * - Drag move ambos os pontos igualmente
 * - Sem deltas acumulados, sem transform hacks
 */
export interface LineData {
  // 📍 Coordenadas ABSOLUTAS em world space (não relativas!)
  start: { x: number; y: number };
  end: { x: number; y: number };

  // 🎨 Estilo visual
  strokeColor: string;
  strokeWidth: number;
  opacity: number;
  style: 'solid' | 'dashed' | 'dotted';
  cap: 'butt' | 'round' | 'square';

  // 🎯 Setas (futuro)
  startArrow?: 'none' | 'arrow';
  endArrow?: 'none' | 'arrow';
}

/**
 * 🖼️ Imagem - Elemento de mídia visual
 *
 * Comportamento Figma-like profissional:
 * - Posição e tamanho em coordenadas absolutas
 * - Resize mantém proporção (com Shift opcional)
 * - Drag move a imagem livremente
 * - Object fit controla como a imagem preenche o box
 * - Sem deltas acumulados, snapshot-based
 */
export interface ImageData {
  // 📍 Source da imagem
  src?: string; // URL ou path da imagem
  url?: string; // Alias/URL alternativa da imagem
  alt?: string; // Texto alternativo

  // 🎨 Estilo visual
  opacity?: number; // 0 a 1
  borderRadius?: number; // px
  objectFit?: 'contain' | 'cover' | 'fill'; // Como a imagem preenche o box
  fit?: 'contain' | 'cover' | 'fill'; // Alias de objectFit usado em alguns geradores

  // 🔒 Proporção
  aspectRatioLocked?: boolean; // Manter proporção original
  originalWidth?: number; // Largura original da imagem (para cálculos)
  originalHeight?: number; // Altura original da imagem (para cálculos)

  // 📦 Estado
  loadingState?: 'loading' | 'loaded' | 'error';
  errorMessage?: string;
}

// Dynamic field types for headers/footers
export type DynamicFieldType =
  | 'page-number'        // Número da página atual
  | 'total-pages'        // Total de páginas
  | 'page-of-total'      // "Página X de Y"
  | 'catalog-name'       // Nome do catálogo
  | 'line-name'          // Nome da linha de produtos
  | 'version'            // Versão do catálogo
  | 'date'               // Data atual
  | 'custom-text';       // Texto personalizado

export interface DynamicField {
  id: string;
  type: DynamicFieldType;
  value?: string;        // Para custom-text
  format?: string;       // Para date (ex: "DD/MM/YYYY")
  prefix?: string;       // Texto antes do campo (ex: "Página ")
  suffix?: string;       // Texto depois do campo
}

export interface HeaderFooterConfig {
  enabled: boolean;
  height: number;
  backgroundColor: string;
  borderColor?: string;
  borderWidth?: number;
  padding?: number;
  fields: DynamicField[];
  alignment: 'left' | 'center' | 'right' | 'space-between';
  fontSize?: number;
  fontFamily?: string;
  textColor?: string;
  logo?: string;
  logoSize?: { width: number; height: number };
  logoPosition?: 'left' | 'right' | 'center';
}

export interface CatalogElement {
  id: string;
  type: ElementType;
  name?: string; // Nome do elemento (similar ao Figma)
  componentId?: string; // ID do componente customizado de origem
  componentName?: string; // Nome do componente customizado de origem
  position: Position;
  size: Size;
  style: ElementStyle;
  // Utilitárias Tailwind da SAFELIST (ver @source inline em index.css).
  // Aplicadas pelo ElementRenderer em textos/shapes/imagem estática; classes
  // fora da safelist não existem no CSS compilado e são ignoradas.
  className?: string;
  content?: any;
  locked?: boolean;
  visible?: boolean;
  rotation?: number;
  zIndex?: number;
  pageId: string;
  groupId?: string;
  isGroup?: boolean;
  children?: string[];
  opacity?: number;
  branding?: ElementBranding;
  layout?: ElementLayout;
  textData?: TextData;
  // Image URL (for type 'image')
  imageUrl?: string;
  // Specific data based on element type
  productData?: ProductData;
  highlightBannerData?: HighlightBannerData;
  highlightCalloutData?: HighlightCalloutData;
  testimonialData?: TestimonialData;
  technicalSpecsData?: TechnicalSpecsData;
  featureListData?: FeatureListData;
  galleryData?: GalleryData;
  carouselData?: CarouselData;
  qrCodeData?: QRCodeData;
  iconGridData?: IconGridData;
  certificationBadgeData?: CertificationBadgeData;
  tableData?: TableData;
  footerData?: FooterData;
  lineData?: LineData;
  imageData?: ImageData;
}

export interface CatalogPage {
  id: string;
  name: string;
  order: number;
  elements: CatalogElement[];
  header?: HeaderFooterConfig;
  footer?: HeaderFooterConfig;
}

export interface CatalogState {
  pages: CatalogPage[];
  currentPageId: string;
  selectedElementId: string | null;
  selectedElementIds: string[]; // Múltiplos elementos selecionados
  zoom: number;
  gridVisible: boolean;
  snapToGrid: boolean;
  gridSize: number;
  catalogName: string;
  history: CatalogPage[][];
  historyIndex: number;
  rightSidebarTab: 'layers' | 'properties';
  interactionMode: 'select' | 'pan'; // Modo de interação: seleção ou movimentação
  activeTool: string; // Ferramenta ativa (select, rectangle, circle, text, etc)

  // 🎨 Design Tokens (NOVO - para IA-first)
  designTokens?: import('./designTokens').DesignTokens;
}

export interface EditorStore extends CatalogState {
  // Element Actions
  addElement: (element: Omit<CatalogElement, 'id' | 'pageId' | 'zIndex'>, targetPageId?: string) => void;
  updateElement: (id: string, updates: Partial<CatalogElement>) => void;
  deleteElement: (id: string) => void;
  setSelectedElement: (id: string | null) => void;

  // Multi-selection Actions
  toggleSelection: (id: string, multi: boolean) => void;
  clearSelection: () => void;
  moveSelectedElements: (dx: number, dy: number) => void;
  deleteSelectedElements: () => void;
  duplicateElement: (id: string) => void;
  moveElement: (id: string, position: Position) => void;
  resizeElement: (id: string, size: Size) => void;
  updateElementStyle: (id: string, style: Partial<ElementStyle>) => void;

  toggleSelectElement: (id: string) => void;
  selectMultipleElements: (ids: string[]) => void;

  // Group Actions
  groupElements: (elementIds: string[]) => void;
  ungroupElements: (groupId: string) => void;

  // Page Actions
  addPage: (name?: string) => void;
  deletePage: (pageId: string) => void;
  setCurrentPage: (pageId: string) => void;
  reorderPages: (pageIds: string[]) => void;
  getCurrentPage: () => CatalogPage | undefined;
  updatePageHeader: (pageId: string, header: Partial<HeaderFooterConfig>) => void;
  updatePageFooter: (pageId: string, footer: Partial<HeaderFooterConfig>) => void;
  togglePageHeader: (pageId: string, enabled: boolean) => void;
  togglePageFooter: (pageId: string, enabled: boolean) => void;

  // Other Actions
  setZoom: (zoom: number) => void;
  toggleGrid: () => void;
  toggleSnapToGrid: () => void;
  setInteractionMode: (mode: 'select' | 'pan') => void;
  setActiveTool: (tool: string) => void;
  toggleElementVisibility: (id: string) => void;
  toggleElementLock: (id: string) => void;
  setCatalogName: (name: string) => void;
  setRightSidebarTab: (tab: 'layers' | 'properties') => void;
  undo: () => void;
  redo: () => void;
  clearCanvas: () => void;
  clearCurrentPage: () => void;

  // Import/Export Actions
  exportCatalogToJSON: () => void;
  importCatalogFromJSON: (pages: CatalogPage[], catalogName: string, settings?: any) => void;
  importPages: (pages: CatalogPage[], catalogName: string, designTokens?: import('./designTokens').DesignTokens) => void;
  loadCatalogState: (state: Partial<CatalogState>) => void;
  resetEditor: () => void;

  // 🎨 Design Tokens Actions (NOVO)
  setDesignTokens: (tokens: import('./designTokens').DesignTokens) => void;
  updateDesignTokens: (updates: Partial<import('./designTokens').DesignTokens>) => void;
  resetDesignTokens: () => void;
  // INC-06: liga os elementos ao tema global, trocando cores/fontes por referências $tokens.*
  applyThemeToElements: () => void;
}
