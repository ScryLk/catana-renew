/**
 * ÁUREA — Catálogo Showcase de Alta Marroquinaria e Moda Editorial
 * 
 * Baseado nas diretrizes de design editorial de maisons europeias:
 * - 3 Cores estritas: Off-Black (#1A1817), Ivory (#F5F1EA), Ouro (#B08D57)
 * - Tipografia: Cormorant Garamond (display/título) e Jost (corpo/dados)
 * - Proporção A4 (794x1123) com margens editoriais de 96px
 * - Espaço negativo generoso e filetes de 1px em ouro
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
}

export type PageLayoutType = 
  | 'cover'
  | 'manifesto'
  | 'divider'
  | 'hero'
  | 'duo'
  | 'single'
  | 'backcover';

export interface CatalogPageData {
  id: string;
  pageNumber: number;
  type: PageLayoutType;
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

export const AUREA_PALETTE: StudioPalette = {
  name: 'ÁUREA · Noir & Or',
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
    name: 'ÁUREA · Noir & Or',
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

export const AUREA_PAGES: CatalogPageData[] = [
  // ================= PÁGINA 01: CAPA =================
  {
    id: 'aurea-page-1',
    pageNumber: 1,
    type: 'cover',
    title: 'Á U R E A',
    subtitle: 'MODA & ACESSÓRIOS · SÃO PAULO',
    label: 'COLEÇÃO INVERNO 2026',
    backgroundColor: '#1A1817',
    textColor: '#F5F1EA',
    accentColor: '#B08D57',
    folio: '',
  },

  // ================= PÁGINA 02: MANIFESTO =================
  {
    id: 'aurea-page-2',
    pageNumber: 2,
    type: 'manifesto',
    label: 'MANIFESTO',
    quote: 'O essencial,\nexecutado sem pressa.',
    content:
      'Atelier de moda e acessórios fundado sobre uma única convicção: poucas peças, feitas de forma irrepreensível, valem mais do que qualquer abundância. Couro italiano, seda e cashmere em série limitada, sob encomenda.',
    backgroundColor: '#F5F1EA',
    textColor: '#1A1817',
    accentColor: '#B08D57',
    folio: 'ÁUREA · 02',
  },

  // ================= PÁGINA 03: DIVISÓRIA I (ACESSÓRIOS) =================
  {
    id: 'aurea-page-3',
    pageNumber: 3,
    type: 'divider',
    label: 'COLEÇÃO I',
    title: 'ACESSÓRIOS',
    subtitle: 'Marroquinaria e alfaiataria em couro toscano',
    editorialImage: '/aurea/images/div-acessorios.jpg',
    backgroundColor: '#1A1817',
    textColor: '#F5F1EA',
    accentColor: '#B08D57',
    folio: '',
  },

  // ================= PÁGINA 04: HERO (BOLSA AURELIA) =================
  {
    id: 'aurea-page-4',
    pageNumber: 4,
    type: 'hero',
    label: 'ACESSÓRIOS · 01',
    backgroundColor: '#F5F1EA',
    textColor: '#1A1817',
    accentColor: '#B08D57',
    folio: 'ÁUREA · 04',
    products: [
      {
        id: 'prod-bolsa',
        category: 'ACESSÓRIOS',
        index: '01',
        name: 'Bolsa Aurelia',
        sku: 'AUREA-001',
        price: 'R$ 4.900',
        description:
          'Couro toscano de curtimento vegetal, forro em camurça, ferragens banhadas em ouro acetinado.',
        image: '/aurea/images/prod-bolsa.jpg',
        tag: 'Destaque Coleção',
        details: ['Curtimento vegetal italiano', 'Ferragens banhadas a ouro', 'Costura manual'],
      },
    ],
  },

  // ================= PÁGINA 05: DUO ASSIMÉTRICO (CINTO & LUVAS) =================
  {
    id: 'aurea-page-5',
    pageNumber: 5,
    type: 'duo',
    label: 'ACESSÓRIOS',
    backgroundColor: '#F5F1EA',
    textColor: '#1A1817',
    accentColor: '#B08D57',
    folio: 'ÁUREA · 05',
    mirrored: false,
    products: [
      {
        id: 'prod-cinto',
        category: 'ACESSÓRIOS',
        index: '02',
        name: 'Cinto Fiora',
        sku: 'AUREA-002',
        price: 'R$ 890',
        description: 'Corte único de couro integral, fivela em latão maciço escovado à mão.',
        image: '/aurea/images/prod-cinto.jpg',
      },
      {
        id: 'prod-luvas',
        category: 'ACESSÓRIOS',
        index: '03',
        name: 'Luvas Alba',
        sku: 'AUREA-003',
        price: 'R$ 1.190',
        description: 'Pelica extra macia forrada em puro cashmere, costura à mão em ponto sela.',
        image: '/aurea/images/prod-luvas.jpg',
      },
    ],
  },

  // ================= PÁGINA 06: DIVISÓRIA II (SEDA & CASHMERE) =================
  {
    id: 'aurea-page-6',
    pageNumber: 6,
    type: 'divider',
    label: 'COLEÇÃO II',
    title: 'SEDA & CASHMERE',
    subtitle: 'Tricôs em teares artesanais e seda pura 22 momme',
    editorialImage: '/aurea/images/div-seda.jpg',
    backgroundColor: '#1A1817',
    textColor: '#F5F1EA',
    accentColor: '#B08D57',
    folio: '',
  },

  // ================= PÁGINA 07: HERO (CAMISA SOLENE) =================
  {
    id: 'aurea-page-7',
    pageNumber: 7,
    type: 'hero',
    label: 'SEDA & CASHMERE · 04',
    backgroundColor: '#F5F1EA',
    textColor: '#1A1817',
    accentColor: '#B08D57',
    folio: 'ÁUREA · 07',
    products: [
      {
        id: 'prod-camisa',
        category: 'SEDA & CASHMERE',
        index: '04',
        name: 'Camisa Solene',
        sku: 'AUREA-004',
        price: 'R$ 2.300',
        description:
          'Seda dupla de 22 momme, botões de madrepérola natural talhados à mão, corte atemporal.',
        image: '/aurea/images/prod-camisa.jpg',
        tag: 'Pura Seda 22mm',
      },
    ],
  },

  // ================= PÁGINA 08: DUO ESPELHADO (ECHARPE & LENÇO) =================
  {
    id: 'aurea-page-8',
    pageNumber: 8,
    type: 'duo',
    label: 'SEDA & CASHMERE',
    backgroundColor: '#F5F1EA',
    textColor: '#1A1817',
    accentColor: '#B08D57',
    folio: 'ÁUREA · 08',
    mirrored: true,
    products: [
      {
        id: 'prod-echarpe',
        category: 'SEDA & CASHMERE',
        index: '05',
        name: 'Echarpe Ligure',
        sku: 'AUREA-005',
        price: 'R$ 1.590',
        description: 'Cashmere de fio duplo, tecida em tear manual tradicional, bainha cega.',
        image: '/aurea/images/prod-echarpe.jpg',
      },
      {
        id: 'prod-lenco',
        category: 'SEDA & CASHMERE',
        index: '06',
        name: 'Lenço Ária',
        sku: 'AUREA-006',
        price: 'R$ 980',
        description: 'Twill de seda pura estampado a quadro, bainha enrolada à mão.',
        image: '/aurea/images/prod-lenco.jpg',
      },
    ],
  },

  // ================= PÁGINA 09: SINGLE FECHAMENTO (TRICÔ BRUMA) =================
  {
    id: 'aurea-page-9',
    pageNumber: 9,
    type: 'single',
    label: 'SEDA & CASHMERE · 07',
    backgroundColor: '#F5F1EA',
    textColor: '#1A1817',
    accentColor: '#B08D57',
    folio: 'ÁUREA · 09',
    products: [
      {
        id: 'prod-trico',
        category: 'SEDA & CASHMERE',
        index: '07',
        name: 'Tricô Bruma',
        sku: 'AUREA-007',
        price: 'R$ 3.400',
        description:
          'Cashmere de seis fios, tricotado em peça única integral sem costuras. Série limitada.',
        image: '/aurea/images/prod-trico.jpg',
        tag: 'Série Limitada',
      },
    ],
  },

  // ================= PÁGINA 10: CONTRACAPA / ATELIER =================
  {
    id: 'aurea-page-10',
    pageNumber: 10,
    type: 'backcover',
    label: 'SOB CONVITE E AGENDAMENTO',
    title: 'ATELIER ÁUREA',
    content:
      'RUA OSCAR FREIRE 1200 · SÃO PAULO\nATELIER@AUREA.COM.BR · +55 11 3061 0000\n@AUREA.ATELIER',
    backgroundColor: '#1A1817',
    textColor: '#F5F1EA',
    accentColor: '#B08D57',
    folio: 'KATANA STUDIO · 2026',
  },
];
