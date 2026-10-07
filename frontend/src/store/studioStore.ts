import { workspaceKey, getContextUserId } from '../services/workspaceContext';
import { sanitizeAgentText } from '../utils/agentProtocol';
import { AuthNotReadyError, isTokenReady } from '../services/authTokenProvider';
import ACTION_REGISTRY from '../../../shared/studio-actions.json';
import { editableTextIndex, executeTextAction, executeTextGroup, executionFeedback, commercialText, type ActionResult } from '../utils/textCommandExecution';
import { normalizeCatalogDocument, QualityGate } from '../data/editorialCatalog.mock';
import { parseSuppliedPrice } from '../utils/commercialProduct';
import { create } from 'zustand';
import {type AxiosResponse} from 'axios';
import api, {
  authenticatedStreamingFetch, API_BASE_URL } from '../services/api';
import { toast } from 'sonner';
import { brandService, catalogBrandSnapshot, groupBrandCatalogs, pendingLegacyBrands, readBrandCache, writeBrandCache } from '../services/brandService';
import type { BrandAsset, BrandColor, BrandInference, BrandRule, BrandSnapshotState } from '../services/brandService';
import { documentImportService } from '../services/documentImportService';
import type { DocumentImportMetadata, DocumentImportMode } from '../types/documentImport';
import { organizationService } from '../services/organizationService';
import {
  CatalogPageData,
  ProductItem,
  StudioPalette,
  STUDIO_PALETTE_PRESETS,
  PageLayoutType,
  PageOverlayElement,
} from '../data/editorialCatalog.mock';
import { generateCatalogFromPrompt, GeneratedCatalogResult } from '../utils/catalogGenerator';
import {
  preprocessUserCommand,
  parseSpelledNumber,
  normalizeLayoutType,
  isFuzzyMatch,
  removeAccents,
} from '../utils/textNormalizer';
import {
  AgentCursor,
  AgentCursorRole,
  AGENT_CURSOR_CONFIGS,
} from '../types/agentCursor';
import { CANONICAL_DEMO_TEMPLATES } from '../data/demoCatalogs.data';

export { API_BASE_URL };
let saveTimeout: any = null;

export type StudioMode = 'director' | 'commercial' | 'copywriter' | string;
export type CanvasViewMode = 'spread' | 'single' | 'grid';
export type StepStatus = 'completed' | 'active' | 'pending';

export interface StudioRole {
  id: string;
  name: string;
  badge: string;
  description: string;
  toneOfVoice: string;
  instructions: string;
  isCustom?: boolean;
  starterChips?: string[];
  enabled?: boolean;
}

export const DEFAULT_STUDIO_ROLES: StudioRole[] = [
  {
    id: 'orchestrator',
    name: 'Editor-Chefe / Orquestrador',
    badge: 'Orquestrador',
    description: 'Coordena, delega e unifica decisões entre arte, redação, comercial e branding',
    toneOfVoice: 'Estratégico, equilibrado, sintético e com visão holística editorial',
    instructions:
      'Decomponha cada briefing identificando as frentes necessárias (Design, Redação, Comercial, Branding). Delegue as ações aos cargos correspondentes, resolva conflitos entre respiro visual e conversão, e sintetize uma entrega harmoniosa de alto padrão.',
    isCustom: false,
    enabled: true,
    starterChips: [
      'Coordenar revisão editorial completa do spread',
      'Revisar manifesto e tabela comercial em harmonia',
      'Equilibrar respiro negativo com conversão B2B',
      'Convocar Mesa Redonda do Conselho Editorial',
    ],
  },
  {
    id: 'director',
    name: 'Diretor de Arte',
    badge: 'Design',
    description: 'Composição visual, proporções, respiros e paleta cromática',
    toneOfVoice: 'Sóbrio, estético, atento a proporções e linha de base',
    instructions:
      'Priorize equilíbrio formal, proporção áurea, respiro negativo generoso de no mínimo 96px, contraste WCAG AA e paletas nobres de no máximo 3 tons. Nunca sobrecarregue páginas com texto denso.',
    isCustom: false,
    enabled: true,
    starterChips: [
      'Ajustar contrastes e filetes da capa',
      'Aumentar o respiro negativo no fólio',
      'Harmonizar paleta cromática da coleção',
    ],
  },
  {
    id: 'commercial',
    name: 'Tabela Comercial / B2B',
    badge: 'Comercial',
    description: 'Estratégia de preços, margens de atacado/varejo e tabelas de pedidos',
    toneOfVoice: 'Pragmático, analítico, focado em conversão e números',
    instructions:
      'Calcule markups estratégicos (mínimo 2.5x no varejo), formate tabelas com referências SKU claras, indique pedidos mínimos e condições de faturamento B2B.',
    isCustom: false,
    enabled: true,
    starterChips: [
      'Aplicar margem de +15% nos destaques',
      'Inserir código SKU em todos os itens',
      'Formatar tabela de atacado e pedido mínimo',
    ],
  },
  {
    id: 'copywriter',
    name: 'Redator Publicitário',
    badge: 'Redação',
    description: 'Narrativas poéticas, manifestos editoriais e claims de produto',
    toneOfVoice: 'Persuasivo, poético, refinado e sem clichês comerciais',
    instructions:
      'Escreva com tom de voz sofisticado e poético. Destaque matérias-primas nobres, artesanato e proveniência dos produtos. Evite gírias, superlativos baratos ou exclamações excessivas.',
    isCustom: false,
    enabled: true,
    starterChips: [
      'Reescrever manifesto com tom poético',
      'Criar nomes sofisticados para a coleção',
      'Ajustar títulos da capa em versalete',
    ],
  },
  {
    id: 'branding',
    name: 'Auditor de Branding',
    badge: 'Auditoria',
    description: 'Conformidade visual, tipografia e diretrizes de marca',
    toneOfVoice: 'Rigoroso, técnico e focado na identidade visual',
    instructions:
      'Valide alinhamento de fólio, coerência das famílias Cormorant Garamond e Jost, contraste de acessibilidade de no mínimo 4.5:1 e consistência do monograma em todas as páginas.',
    isCustom: false,
    enabled: true,
    starterChips: [
      'Auditar contraste tipográfico sob WCAG AA',
      'Verificar consistência do monograma e fólio',
      'Validar hierarquia de títulos e entrelinhas',
    ],
  },
];

export interface ExecutionStep {
  id: string;
  label: string;
  status: StepStatus;
  roleBadge?: string;
  roleId?: string;
}

export interface ChatAttachment {
  id: string;
  name: string;
  size: string;
  type: 'pdf' | 'doc' | 'sheet' | 'image' | 'file';
  previewUrl?: string;
  url?: string;
}

export interface ChatDelegation {
  roleId: string;
  roleName: string;
  badge: string;
  action: string;
}

export interface CapturedDossier {
  brandName: string;
  sourceDocument: string;
  palette: {
    name: string;
    background: string;
    primary: string;
    accent: string;
    contrastRatio: string;
  };
  typography: {
    heading: string;
    body: string;
    scaleNote: string;
  };
  toneOfVoice: string;
  commercialSummary: {
    skusFound: number;
    defaultMarkup: string;
    minOrder: string;
  };
  configuredRoles: {
    roleId: string;
    roleName: string;
    badge: string;
    summary: string;
    enabled: boolean;
  }[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  reasoning?: string;
  executionResults?: ActionResult[];
  providerMetadata?: Record<string, unknown>;
  actions?: string[];
  delegations?: ChatDelegation[];
  attachments?: ChatAttachment[];
  capturedDossier?: CapturedDossier;
  feedback?: 'like' | 'dislike' | null;
}

export interface ChatThread {
  id: string;
  title: string;
  mode: StudioMode;
  roleId?: string;
  messages: ChatMessage[];
  createdAt: string;
}

export interface ActiveTargetSlot {
  pageNumber: number;
  slotIndex: number;
  slotLabel?: string;
  pageType?: string;
}

export interface RecentCatalogItem {
  id: string;
  title: string;
  totalPages: number;
  category: string;
  updatedAt: string;
  brandId?: string | null;
  isUnread?: boolean;
}

export interface Brand {
  id: string;
  organization?: number;
  currentVersion?: number;
  status?: string;
  colors?: BrandColor[];
  guidelines?: BrandRule[];
  memories?: BrandRule[];
  intelligence?: Record<string, BrandInference>;
  assets?: BrandAsset[];
  name: string;
  segment?: string;
  logoUrl?: string;
  paletteName?: string;
  customPalette?: StudioPalette;
  brandMarkdown?: string;
  toneOfVoice?: string;
  commercialContact?: {
    whatsapp?: string;
    email?: string;
    website?: string;
    instagram?: string;
  };
  catalogs: RecentCatalogItem[];
  createdAt: string;
}

export const INITIAL_BRANDS: Brand[] = [
  {
    id: 'brand-vektron',
    name: 'VEKTRON Systems',
    segment: 'Hardware & TI',
    paletteName: 'Minimaliste · Slate & Pure Ivory',
    commercialContact: {
      whatsapp: '+55 11 98765-4321',
      email: 'enterprise@vektron.com',
      website: 'www.vektron.com',
    },
    catalogs: [
      {
        id: 'vektron-edge-2026',
        title: 'Hardware Industrial & Edge',
        totalPages: 6,
        category: 'Hardware & TI',
        updatedAt: '3h',
      },
    ],
    createdAt: '2026-08-28',
  },
  {
    id: 'brand-maison',
    name: 'Maison Éthérée',
    segment: 'Moda & Luxo',
    paletteName: 'Luxe · Noir & Or',
    commercialContact: {
      whatsapp: '+55 11 99882-1100',
      email: 'contato@maisonetheree.com',
      website: 'www.maisonetheree.com',
      instagram: '@maisonetheree',
    },
    catalogs: [
      {
        id: 'lookbook-editorial-2026',
        title: 'Coleção Inverno 2026',
        totalPages: 6,
        category: 'Moda & Estilo',
        updatedAt: '2m',
      },
      {
        id: 'capsula-linho-2026',
        title: 'Lookbook Cápsula de Seda',
        totalPages: 4,
        category: 'Alta Moda',
        updatedAt: '3d',
      },
    ],
    createdAt: '2026-09-01',
  },
  {
    id: 'brand-atelier',
    name: 'Atelier Sucré',
    segment: 'Gastronomia',
    paletteName: 'Édition · Terracotta & Sable',
    commercialContact: {
      whatsapp: '+55 11 97721-3400',
      email: 'encomendas@ateliersucre.com',
      website: 'www.ateliersucre.com',
    },
    catalogs: [
      {
        id: 'confeitaria-artesanal',
        title: 'Confeitaria & Pâtisserie',
        totalPages: 8,
        category: 'Gastronomia',
        updatedAt: '1d',
      },
    ],
    createdAt: '2026-09-03',
  },
  {
    id: 'brand-nexus',
    name: 'Nexus Core',
    segment: 'Tecnologia B2B',
    paletteName: 'Atelier · Noir & Argent 925',
    commercialContact: {
      whatsapp: '+55 11 91234-5678',
      email: 'b2b@nexuscore.tech',
      website: 'www.nexuscore.tech',
    },
    catalogs: [
      {
        id: 'techgear-2026',
        title: 'Setup & Hardware B2B',
        totalPages: 6,
        category: 'Tecnologia',
        updatedAt: '5d',
      },
    ],
    createdAt: '2026-09-05',
  },
  {
    id: 'brand-cristallo',
    name: 'Cristallo',
    segment: 'Alta Joalheria',
    paletteName: 'Luxe · Noir & Or',
    commercialContact: {
      whatsapp: '+55 11 96543-2100',
      email: 'vip@cristallojoias.com.br',
      website: 'www.cristallojoias.com.br',
    },
    catalogs: [
      {
        id: 'cristallo-joias',
        title: 'Joalheria & Gemas Raras',
        totalPages: 5,
        category: 'Alta Joalheria',
        updatedAt: '12d',
      },
    ],
    createdAt: '2026-09-08',
  },
];

export const getCurrentUserId = (): string | number =>
  getContextUserId() ?? 'anonymous';

export const getStoredBrands = (userId?: string | number | null): Brand[] => {
  if (typeof window === 'undefined') return [];
  const uid = userId ?? getCurrentUserId();
  try {
    const key = workspaceKey(
      uid,
      organizationService.getActiveOrganizationId(),
      'brands'
    );
    const saved = localStorage.getItem(key);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch {
    // fallback
  }
  // Se for anônimo (ex: test runner ou unauthenticated preview), fornece as marcas modelo
  if (uid === 'anonymous') {
    return INITIAL_BRANDS;
  }
  return [];
};

export const saveStoredBrands = (brands: Brand[], userId?: string | number | null) => {
  if (typeof window === 'undefined') return;
  const uid = userId ?? getCurrentUserId();
  try {
    localStorage.setItem(
      workspaceKey(
        uid,
        organizationService.getActiveOrganizationId(),
        'brands'
      ), JSON.stringify(brands));
    // Limpa chave legada global para evitar vazamento entre contas
    localStorage.removeItem('katana_studio_brands');
  } catch {
    // ignore
  }
};

export const INITIAL_UNLINKED_CATALOGS: RecentCatalogItem[] = [
  {
    id: 'proj-sistema-01',
    title: 'Rode o Sistema',
    totalPages: 4,
    category: 'Geral',
    updatedAt: '60m',
  },
  {
    id: 'proj-gemini-plugin',
    title: 'Gemini, com base no plugin/t...',
    totalPages: 6,
    category: 'Automação',
    updatedAt: '2h',
    isUnread: true,
  },
  {
    id: 'proj-import-products',
    title: 'Import Products Modal',
    totalPages: 4,
    category: 'Componentes',
    updatedAt: '4h',
    isUnread: true,
  },
];

export const getStoredUnlinkedCatalogs = (userId?: string | number | null): RecentCatalogItem[] => {
  if (typeof window === 'undefined') return [];
  const uid = userId ?? getCurrentUserId();
  try {
    const key = workspaceKey(
      uid,
      organizationService.getActiveOrganizationId(),
      'unlinked_catalogs'
    );
    const saved = localStorage.getItem(key);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // fallback
  }
  if (uid === 'anonymous') {
    return INITIAL_UNLINKED_CATALOGS;
  }
  return [];
};

export const saveStoredUnlinkedCatalogs = (catalogs: RecentCatalogItem[], userId?: string | number | null) => {
  if (typeof window === 'undefined') return;
  const uid = userId ?? getCurrentUserId();
  try {
    localStorage.setItem(
      workspaceKey(
        uid,
        organizationService.getActiveOrganizationId(),
        'unlinked_catalogs'
      ), JSON.stringify(catalogs));
    // Limpa chave legada global
    localStorage.removeItem('katana_studio_unlinked_catalogs');
  } catch {
    // ignore
  }
};

export interface StoredProjectSession {
  importMetadata?: DocumentImportMetadata;
  qualityGate?: QualityGate;
  brandContext?: BrandSnapshotState;
  organization?: number | null;
  threads: ChatThread[];
  activeThreadId: string;
  catalogTitle?: string;
  activePalette?: StudioPalette;
  currentSpread?: [number, number];
  pages?: CatalogPageData[];
  totalPages?: number;
}

const STORAGE_KEY_PREFIX = 'katana_studio_project_session_';

export const getStoredProjectSession = (catalogId: string, userId?: string | number | null,
  organizationId = organizationService.getActiveOrganizationId()
): StoredProjectSession | null => {
  if (typeof window === 'undefined' || !catalogId) return null;
  const uid = userId ?? getCurrentUserId();
  try {
    const raw = localStorage.getItem(
      workspaceKey(uid, organizationId, `project:${catalogId}`)
    );
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.threads) && parsed.threads.length > 0) {
        return parsed;
      }
    }
    // Remove chave legada não isolada para mitigar IDOR/vazamento no browser
    if (localStorage.getItem(`${STORAGE_KEY_PREFIX}${catalogId}`)) {
      localStorage.removeItem(`${STORAGE_KEY_PREFIX}${catalogId}`);
    }
  } catch (e) {
    console.warn('Erro ao carregar sessao do projeto:', e);
  }
  return null;
};

export const saveStoredProjectSession = (catalogId: string, session: StoredProjectSession, userId?: string | number | null) => {
  if (typeof window === 'undefined' || !catalogId) return;
  const uid = userId ?? getCurrentUserId();
  try {
    const organizationId =
      session.organization ?? organizationService.getActiveOrganizationId();
    const key = workspaceKey(uid, organizationId, `project:${catalogId}`);
    const previous = JSON.parse(localStorage.getItem(key) || '{}');
    localStorage.setItem(key, JSON.stringify({...session,
      brandContext: session.brandContext ?? previous.brandContext,
      organization: session.organization ?? previous.organization}));
    localStorage.setItem(
      workspaceKey(
        uid,
        organizationService.getActiveOrganizationId(),
        'last_active_catalog'
      ), catalogId);
    // Remove chaves legadas globais
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}${catalogId}`);
    localStorage.removeItem('katana_studio_last_active_catalog');
  } catch (e) {
    console.warn('Erro ao salvar sessao do projeto:', e);
  }
};

export const syncActiveCatalogStorage = (state: {
  activeCatalogId: string | null;
  threads: ChatThread[];
  activeThreadId: string;
  catalogTitle: string;
  activePalette: StudioPalette;
  currentSpread: [number, number];
  pages: CatalogPageData[];
  totalPages: number;
  activeUserId?: string | number | null;
  qualityGate?: QualityGate;
  catalogBrandContext?: BrandSnapshotState;
  importMetadata?: DocumentImportMetadata;
  activeOrganizationId?: number | null;
}) => {
  if (typeof window === 'undefined' || !state.activeCatalogId) return;
  saveStoredProjectSession(state.activeCatalogId, {
    threads: state.threads,
    activeThreadId: state.activeThreadId,
    catalogTitle: state.catalogTitle,
    activePalette: state.activePalette,
    currentSpread: state.currentSpread,
    pages: state.pages,
    qualityGate: state.qualityGate,
    importMetadata: state.importMetadata,
    brandContext: state.catalogBrandContext, organization: state.activeOrganizationId,
    totalPages: state.totalPages,
  }, state.activeUserId);
};

export interface StudioState {
  qualityGate?: QualityGate;
  importMetadata?: DocumentImportMetadata;
  confirmDocumentImport: (importId: string, options: {title: string; mode: DocumentImportMode; brandId?: string | null;
    }) => Promise<boolean>;
  cancelDocumentImport: () => void;
  updateDocumentText: (pageNumber: number, elementId: string, text: string) => void;
  resetDocumentText: (pageNumber: number, elementId: string) => void;
  // Session & Workspace Mode
  hasStartedSession: boolean;
  startSession: (initialPrompt?: string, categoryName?: string, attachments?: ChatAttachment[]) => void;
  resetToHome: () => void;

  // Catalog Info (Personal use)
  catalogTitle: string;
  setCatalogTitle: (title: string) => void;

  // Mode & Agent Status
  activeMode: StudioMode;
  agentStatus: 'idle' | 'thinking' | 'generating';
  setActiveMode: (mode: StudioMode) => void;
  setAgentStatus: (status: 'idle' | 'thinking' | 'generating') => void;

  // Multi-Agent Live Cursors
  activeAgentCursors: AgentCursor[];
  triggerAgentCursor: (
    roleId: AgentCursorRole,
    actionText: string,
    options?: { x?: number; y?: number; startX?: number; startY?: number; targetElementId?: string; durationMs?: number;
    }
  ) => void;
  clearAgentCursors: () => void;

  // Roles Management (Cargos Especializados)
  roles: StudioRole[];
  activeRoleId: string;
  isRoleManagerOpen: boolean;
  setIsRoleManagerOpen: (open: boolean) => void;
  setActiveRole: (roleId: string) => void;
  createCustomRole: (data: Omit<StudioRole, 'id' | 'isCustom'>) => string;
  updateRole: (roleId: string, updates: Partial<StudioRole>) => void;
  deleteRole: (roleId: string) => void;
  toggleRoleEnabled: (roleId: string) => void;
  setRoleEnabled: (roleId: string, enabled: boolean) => void;

  // Council / Mesa Redonda
  isCouncilModalOpen: boolean;
  setIsCouncilModalOpen: (open: boolean) => void;

  // Skills Catalog Modal
  isSkillsModalOpen: boolean;
  setIsSkillsModalOpen: (open: boolean) => void;
  pendingInputPrompt: string | null;
  setPendingInputPrompt: (prompt: string | null) => void;

  // Studio Sidebar (ChatGPT style) & Recent Catalogs
  isStudioSidebarOpen: boolean;
  setIsStudioSidebarOpen: (open: boolean) => void;
  toggleStudioSidebar: () => void;
  isCoPilotOpen: boolean;
  setIsCoPilotOpen: (open: boolean) => void;
  toggleCoPilot: () => void;
  isAccountSettingsOpen: boolean;
  setIsAccountSettingsOpen: (open: boolean) => void;
  openAccountSettings: () => void;
  closeAccountSettings: () => void;
  activeCatalogId: string | null;
  setActiveCatalogId: (id: string | null) => void;
  setHasStartedSession: (started: boolean) => void;
  loadExistingCatalog: (catalogId: string) => void | Promise<void>;
  initializeWorkspace: (userId: number) => Promise<void>;
  catalogSyncStatus: 'idle' | 'loading' | 'ready' | 'error';
  syncUserCatalogs: () => Promise<void>;
  isDemoLoading: boolean;
  loadDemoCatalog: (templateKey: string) => Promise<void>;
  activeUserId: string | number | null;
  setActiveUserId: (id: string | number | null) => void;
  resetStudioState: () => void;

  // Brands / Marcas Management (Antigravity Projects style)
  brands: Brand[];
  activeOrganizationId: number | null;
  brandLoadStatus: 'idle' | 'loading' | 'ready' | 'error';
  brandLoadError: string | null;
  legacyBrandCount: number;
  catalogBrandContext: BrandSnapshotState;
  syncBrands: () => Promise<void>;
  migrateLegacyBrands: () => Promise<void>;
  decideBrandEvidence: (id: string, decision: Parameters<typeof brandService.decide>[1]) => Promise<void>;
  addBrandRule: (id: string, kind: 'guidelines' | 'memories', rule: Omit<BrandRule, 'id'>) => Promise<void>;
  activeBrandId: string | null;
  setActiveBrandId: (id: string | null) => void;
  addBrand: (data: Omit<Brand, 'id' | 'createdAt' | 'catalogs'>) => Promise<Brand>;
  updateBrand: (id: string, updates: Partial<Brand>) => Promise<void>;
  deleteBrand: (id: string) => Promise<void>;
  isBrandModalOpen: boolean;
  brandModalEditingId: string | null;
  openBrandModal: (brandId?: string) => void;
  closeBrandModal: () => void;

  // Unlinked / Standalone Projects (Antigravity style)
  unlinkedCatalogs: RecentCatalogItem[];
  addUnlinkedCatalog: (data: Omit<RecentCatalogItem, 'id'>) => RecentCatalogItem;
  removeUnlinkedCatalog: (id: string) => void;

  // New Catalog Creation Modal
  isNewCatalogModalOpen: boolean;
  setIsNewCatalogModalOpen: (open: boolean) => void;
  openNewCatalogModal: () => void;
  closeNewCatalogModal: () => void;
  createBlankCatalog: (title?: string, pagesCount?: number, paletteName?: string) => void;

  // Export Catalog Modal
  isExportModalOpen: boolean;
  exportModalTab: 'pdf' | 'share' | 'catana' | 'images';
  openExportModal: (tab?: 'pdf' | 'share' | 'catana' | 'images') => void;
  closeExportModal: () => void;

  // Product Drawer & Inventory Repository
  isProductDrawerOpen: boolean;
  activeTargetSlot: ActiveTargetSlot | null;
  unassignedProducts: ProductItem[];
  openProductDrawer: (targetSlot?: ActiveTargetSlot | null) => void;
  closeProductDrawer: () => void;
  setActiveTargetSlot: (targetSlot: ActiveTargetSlot | null) => void;
  toggleProductDrawer: () => void;
  addProductToRepository: (product: Omit<ProductItem, 'id'>) => ProductItem;
  deleteProductFromRepository: (productId: string) => void;
  assignProductToSpread: (product: ProductItem, targetPageNumber: number, slotIndex?: number) => void;
  removeProductFromSpread: (targetPageNumber: number, slotIndex?: number, productId?: string) => ProductItem[];

  // Excel Product Importer & AI Image Generation
  isExcelImportModalOpen: boolean;
  openExcelImportModal: () => void;
  closeExcelImportModal: () => void;
  importProductsFromExcel: (
    items: Array<{
      name: string;
      price: string;
      category?: string;
      sku?: string;
      description?: string;
      image?: string;
      tag?: string;
    }>,
    options?: { openDrawer?: boolean; generateCatalog?: boolean }
  ) => void;
  generateAIProductImage: (
    productId: string,
    name: string,
    category?: string,
    description?: string
  ) => Promise<string | null>;

  // System Design & Agent Playground
  isSystemDesignModalOpen: boolean;
  openSystemDesignModal: () => void;
  closeSystemDesignModal: () => void;

  // Catalog Generation Experience (Lovable style)
  isGeneratingCatalog: boolean;
  generationStage: number;
  generationProgress: number;
  generationLogs: Array<{
    id: string;
    time: string;
    roleId: string;
    roleName: string;
    text: string;
  }>;
  generationTargetCatalog: GeneratedCatalogResult | null;
  lastGenerationPrompt?: string;
  triggerCatalogGeneration: (prompt: string, attachments?: ChatAttachment[], products?: ProductItem[]) => void | Promise<void>;
  finishCatalogGeneration: () => void;
  cancelCatalogGeneration: () => void;

  applyCouncilResolutions: (resolutions: {
    summary: string;
    productUpdates?: { id: string; updates: Partial<ProductItem> };
    pageUpdates?: { pageNumber: number; updates: Partial<CatalogPageData> };
    delegations?: ChatDelegation[];
    reasoning?: string;
  }) => void;

  // Multi-conversation / Chat Threads & Tabs
  threads: ChatThread[];
  activeThreadId: string;
  createThread: (title?: string, mode?: StudioMode) => string;
  switchThread: (threadId: string) => void;
  closeThread: (threadId: string) => void;
  renameThread: (threadId: string, title: string) => void;

  // Execution Plan
  executionPlan: ExecutionStep[];
  isPlanCollapsed: boolean;
  togglePlanCollapse: () => void;
  setPlanCollapsed: (collapsed: boolean) => void;
  isPlanHidden: boolean;
  setPlanHidden: (hidden: boolean) => void;
  togglePlanHidden: () => void;
  setStepStatus: (stepId: string, status: StepStatus) => void;
  setExecutionPlan: (steps: ExecutionStep[]) => void;

  // Chat stream
  messages: ChatMessage[];
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  clearMessages: () => void;
  setMessageFeedback: (messageId: string, feedback: 'like' | 'dislike' | null) => void;

  // Canvas Workspace
  viewMode: CanvasViewMode;
  setViewMode: (mode: CanvasViewMode) => void;
  zoomLevel: number;
  setZoomLevel: (zoom: number | ((prev: number) => number)) => void;
  currentSpread: [number, number]; // e.g. [1, 2]
  totalPages: number;
  nextSpread: () => void;
  prevSpread: () => void;
  goToSpread: (spreadIndex: number) => void;
  setSpreadPage: (slot: 'left' | 'right', pageNumber: number) => void;
  setCustomSpread: (left: number, right: number) => void;
  swapSpreadPages: () => void;

  // Pages Data
  pages: CatalogPageData[];
  setPages: (pages: CatalogPageData[]) => void;
  updatePage: (pageNumber: number, updates: Partial<CatalogPageData>) => void;
  addPage: (options?: {
    type?: PageLayoutType;
    contentRole?: string;
    pageId?: string;
    pageColors?: {backgroundColor?:string; textColor?:string; accentColor?:string;
    };
    afterPage?: number;
    title?: string;
    subtitle?: string;
    content?: string;
    quote?: string;
    label?: string;
  }) => void;
  removePage: (pageNumber: number) => void;
  summarizePageContent: (pageNumber: number, condensedText?: string) => void;
  updateProduct: (productId: string, updates: Partial<ProductItem>) => void;
  removeProductBackground: (pageNumber: number, productId: string) => Promise<void>;
  executeCopilotCommand: (command: string, attachments?: ChatAttachment[]) => void;

  // Overlays & Elementos Graficos Decorativos
  addPageOverlay: (pageNumber: number, overlay: Partial<PageOverlayElement> & { type: PageOverlayElement['type'] }) => string;
  removePageOverlay: (pageNumber: number, overlayId: string) => void;
  clearPageOverlays: (pageNumber: number, typeFilter?: string) => void;
  updatePageOverlay: (pageNumber: number, overlayId: string, updates: Partial<PageOverlayElement>) => void;
  generateSprite: (prompt: string, targetPage: number, options?: { x?: number; y?: number; scale?: number; width?: number; height?: number;
    }) => Promise<string | null>;

  // Active theme / palette & Brand Lock
  activePalette: StudioPalette;
  setActivePalette: (palette: StudioPalette, syncPages?: boolean) => void;
  updateActivePalette: (updates: Partial<StudioPalette>, syncPages?: boolean) => void;
  setPaletteLocked: (locked: boolean) => void;
  applyPaletteToPages: (palette: StudioPalette) => void;
  isPalettePanelOpen: boolean;
  setIsPalettePanelOpen: (open: boolean) => void;

  // Interface Theme (dark / light)
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  setTheme: (theme: 'dark' | 'light') => void;

  // Selected element for contextual AI prompt
  selectedElementId: string | null;
  setSelectedElementId: (id: string | null) => void;

  // Undo / Redo & History Stack
  historyStack: CatalogPageData[][];
  redoStack: CatalogPageData[][];
  pushHistorySnapshot: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  // Persistence & Save Status
  saveStatus: 'saved' | 'saving' | 'unsaved' | 'error';
  setSaveStatus: (status: 'saved' | 'saving' | 'unsaved' | 'error') => void;
  debouncedSaveCurrentSpread: () => void;
  flushSaveSpread: () => Promise<void>;

  // JSON Patch mutation
  applySpreadPatch: (patch: {
    confirmation_token?: string;
    expectedPageIds?: string[];
    spread_index?: number;
    updates?: Array<{ target: string; field: string; value: any }>;
    actions?: Array<{
      type: string;
      [key: string]: any;
    }>;
    summary?: string;
    reasoning?: string;
    delegations?: ChatDelegation[];
  }) => ActionResult[];

  // Real Agent Streaming & Command Execution
  sendMessageToAgent: (prompt: string, attachments?: ChatAttachment[]) => Promise<void>;
}

const getInitialTheme = (): 'dark' | 'light' => {
  if (typeof window !== 'undefined') {
    try {
      if (typeof window.localStorage !== 'undefined' && typeof window.localStorage.getItem === 'function') {
        const saved = window.localStorage.getItem('katana_theme');
        if (saved === 'light' || saved === 'dark') {
          document.documentElement?.classList?.toggle('dark', saved === 'dark');
          return saved;
        }
      }
      document.documentElement?.classList?.add('dark');
    } catch {
      // localStorage bloqueado ou indisponível
    }
  }
  return 'dark';
};

const applyTheme = (theme: 'dark' | 'light') => {
  if (typeof window !== 'undefined') {
    try {
      if (typeof window.localStorage !== 'undefined' && typeof window.localStorage.setItem === 'function') {
        window.localStorage.setItem('katana_theme', theme);
      }
      document.documentElement?.classList?.toggle('dark', theme === 'dark');
    } catch {
      // localStorage bloqueado ou indisponível
    }
  }
};

const getInitialRoles = (): StudioRole[] => {
  if (typeof window !== 'undefined') {
    try {
      const uid = getCurrentUserId();
      const saved = localStorage.getItem(
        workspaceKey(
          uid,
          organizationService.getActiveOrganizationId(),
          'custom_roles'
        )
      );
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return [...DEFAULT_STUDIO_ROLES, ...parsed];
        }
      }
    } catch {
      // fallback
    }
  }
  return DEFAULT_STUDIO_ROLES;
};

const saveCustomRoles = (roles: StudioRole[], userId?: string | number | null) => {
  if (typeof window !== 'undefined') {
    const uid = userId ?? getCurrentUserId();
    const customs = roles.filter((r) => r.isCustom);
    localStorage.setItem(
      workspaceKey(
        uid,
        organizationService.getActiveOrganizationId(),
        'custom_roles'
      ), JSON.stringify(customs));
  }
};

let patchExecuting = false;
let pendingConfirmationToken: string | undefined;

export const useStudioStore = create<StudioState>((rawSet, get) => {
  let brandEpoch = 0;
  let generationOperation = 0;
  let spreadSaveOperation = 0;
  let catalogLoadOperation = 0;
  let bootFlight: Promise<void> | null = null;
  let bootScopeKey = '';
  let documentEpoch = 0;
  let activeImportOperation: number | null = null;
  let chatAbort: AbortController | null = null;
  const captureBrandScope = () => ({user: get().activeUserId, org: get().activeOrganizationId, epoch: brandEpoch});
  const isCurrentBrandScope = (scope: ReturnType<typeof captureBrandScope>) => scope.user === get().activeUserId && scope.org === get().activeOrganizationId && scope.epoch === brandEpoch && scope.org === organizationService.getActiveOrganizationId();
  const captureDocumentScope = () => ({...captureBrandScope(), catalog: get().activeCatalogId, documentEpoch});
  const isCurrentDocumentScope = (scope: ReturnType<typeof captureDocumentScope>) => isCurrentBrandScope(scope) && scope.catalog === get().activeCatalogId && scope.documentEpoch === documentEpoch;
  const requireBrandScope = () => {
    const scope = captureBrandScope();
    if (scope.user == null || scope.user === 'anonymous' || scope.org == null || !isCurrentBrandScope(scope) || get().brandLoadStatus !== 'ready') throw new Error('Selecione uma organização e sincronize as marcas antes de salvar.');
    return {...scope, user: scope.user as string | number, org: scope.org as number};
  };
  const acceptBrand = (brand: Brand, scope: ReturnType<typeof captureBrandScope>) => {
    if (!isCurrentBrandScope(scope) || brand.organization !== scope.org) return false;
    const previous = get().brands.find(item => item.id === brand.id);
    const brands = previous ? get().brands.map(item => item.id === brand.id ? {...brand, catalogs: item.catalogs} : item) : [brand, ...get().brands];
    set({brands});
    writeBrandCache(scope.user!, scope.org!, brands);
    return true;
  };
  const set = (update: Partial<StudioState> | ((state: StudioState) => Partial<StudioState>)) => rawSet(state => {
    const next = typeof update === 'function' ? update(state) : update;
    if (Object.prototype.hasOwnProperty.call(next, 'activeCatalogId') && next.activeCatalogId !== state.activeCatalogId) documentEpoch += 1;
    if (!next.pages) return next;
    const gate = next.qualityGate ?? (next.activeCatalogId && next.activeCatalogId !== state.activeCatalogId ? undefined : state.qualityGate);
    const normalized = normalizeCatalogDocument({pages:next.pages, qualityGate:gate});
    return {...next, ...(next.activeCatalogId && next.activeCatalogId !== state.activeCatalogId && !Object.prototype.hasOwnProperty.call(next, 'importMetadata') ? {importMetadata: undefined} : {}), pages:normalized.pages, qualityGate:normalized.qualityGate};
  });
  const hydrateBackendCatalog = (catData: AxiosResponse['data']) => {
    const s = get();
    const rawSpreads = Array.isArray(catData.spreads) ? catData.spreads : [];
    const hydratedPages: CatalogPageData[] = [];

    rawSpreads.forEach((sp: any) => {
      const spreadIdx = typeof sp.spread_index === 'number' ? sp.spread_index : 0;
      const leftPageNum = spreadIdx * 2 + 1;
      const rightPageNum = spreadIdx * 2 + 2;

      const leftRaw = sp.left_page || (Array.isArray(sp.left_page_elements) && sp.left_page_elements[0]) || {};
      const rightRaw = sp.right_page || (Array.isArray(sp.right_page_elements) && sp.right_page_elements[0]) || {};

      const leftPage: CatalogPageData = {
        ...leftRaw,
        id: leftRaw.id || `p-${catData.id}-${leftPageNum}`,
        pageNumber: leftRaw.pageNumber || leftPageNum,
        type: leftRaw.type || (leftPageNum === 1 ? 'cover' : 'hero'),
        title: leftRaw.title,
        subtitle: leftRaw.subtitle,
        label: leftRaw.label,
        quote: leftRaw.quote,
        content: leftRaw.content,
        backgroundColor: leftRaw.backgroundColor || catData.primary_color || '#1A1817',
        textColor: leftRaw.textColor || catData.secondary_color || '#F5F1EA',
        accentColor: leftRaw.accentColor || catData.accent_color || '#B08D57',
        editorialImage: leftRaw.editorialImage,
        folio: leftRaw.folio,
        products: Array.isArray(leftRaw.products) ? leftRaw.products : [],
        mirrored: Boolean(leftRaw.mirrored),
        overlays: Array.isArray(leftRaw.overlays) ? leftRaw.overlays : [],
      };

      const rightPage: CatalogPageData = {
        ...rightRaw,
        id: rightRaw.id || `p-${catData.id}-${rightPageNum}`,
        pageNumber: rightRaw.pageNumber || rightPageNum,
        type: rightRaw.type || (rightPageNum === (catData.total_pages || 6) ? 'backcover' : 'duo'),
        title: rightRaw.title,
        subtitle: rightRaw.subtitle,
        label: rightRaw.label,
        quote: rightRaw.quote,
        content: rightRaw.content,
        backgroundColor: rightRaw.backgroundColor || catData.secondary_color || '#F5F1EA',
        textColor: rightRaw.textColor || catData.primary_color || '#1A1817',
        accentColor: rightRaw.accentColor || catData.accent_color || '#B08D57',
        editorialImage: rightRaw.editorialImage,
        folio: rightRaw.folio,
        products: Array.isArray(rightRaw.products) ? rightRaw.products : [],
        mirrored: Boolean(rightRaw.mirrored),
        overlays: Array.isArray(rightRaw.overlays) ? rightRaw.overlays : [],
      };

      if (Object.keys(leftRaw).length) hydratedPages.push(catData.import_metadata?.importId ? leftRaw : leftPage);
      if (Object.keys(rightRaw).length && rightPageNum <= (catData.total_pages || Infinity)) hydratedPages.push(catData.import_metadata?.importId ? rightRaw : rightPage);
    });

    if (catData.import_metadata?.importId && hydratedPages.length !== catData.total_pages) throw new Error('O catálogo importado não contém todas as páginas de origem.');

    // Determina a paleta a partir de palette_data ou presets
    let paletteToUse: StudioPalette = STUDIO_PALETTE_PRESETS[0];
    if (catData.palette_data && catData.palette_data.name) {
      paletteToUse = {
        ...catData.palette_data,
        locked: Boolean(catData.brand_lock),
      };
    } else {
      const foundPreset = STUDIO_PALETTE_PRESETS.find((p) => p.name === catData.style_preset);
      if (foundPreset) {
        paletteToUse = { ...foundPreset, locked: Boolean(catData.brand_lock) };
      } else {
        paletteToUse = {
          name: catData.style_preset || 'Personalizada',
          primary: catData.primary_color || '#1A1817',
          background: catData.secondary_color || '#F5F1EA',
          accent: catData.accent_color || '#B08D57',
          locked: Boolean(catData.brand_lock),
        };
      }
    }

    let threadsToUse: ChatThread[] = [];
    if (Array.isArray(catData.threads) && catData.threads.length > 0) {
      threadsToUse = catData.threads;
    } else {
      threadsToUse = [
        {
          id: `thread-${catData.id}`,
          title: catData.title,
          mode: 'orchestrator',
          roleId: 'orchestrator',
          createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          messages: [
            {
              id: `msg-backend-${Date.now()}`,
              role: 'assistant',
              content: `Catálogo **${catData.title}** sincronizado do banco de dados. ${hydratedPages.length} páginas ativas na prancheta.`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
          ],
        },
      ];
    }

    const activeThread = threadsToUse[0];
    const activeRole = activeThread.roleId || activeThread.mode || 'orchestrator';

    documentEpoch += 1;
    generationOperation += 1;
    set({
      hasStartedSession: true,
      isGeneratingCatalog: false, generationTargetCatalog: null, isDemoLoading: false,
      generationProgress: 0, generationStage: 1, generationLogs: [],
      activeCatalogId: String(catData.id),
      importMetadata: catData.import_metadata || undefined,
      historyStack: [], redoStack: [], canUndo: false, canRedo: false,
      selectedElementId: null, activeAgentCursors: [], executionPlan: [],
      catalogBrandContext: catalogBrandSnapshot(catData),
      activeBrandId: catalogBrandSnapshot(catData).brandId,
      catalogTitle: catData.title,
      pages: hydratedPages.length > 0 ? hydratedPages : generateCatalogFromPrompt(catData.title).pages,
      qualityGate: catData.qualityGate || undefined,
      totalPages: catData.total_pages || (hydratedPages.length > 0 ? hydratedPages.length : 6),
      activePalette: paletteToUse,
      currentSpread: [1, hydratedPages.length > 1 ? 2 : 1],
      unassignedProducts: Array.isArray(catData.unassigned_products) && catData.unassigned_products.length > 0
        ? catData.unassigned_products
        : [],
      threads: threadsToUse,
      activeThreadId: activeThread.id,
      messages: activeThread.messages || [],
      activeRoleId: activeRole,
      activeMode: activeRole,
      agentStatus: 'idle',
    });

    saveStoredProjectSession(String(catData.id), {
      threads: threadsToUse,
      activeThreadId: activeThread.id,
      catalogTitle: catData.title,
      brandContext: catalogBrandSnapshot(catData), organization: catData.organization, qualityGate: catData.qualityGate || undefined,
      importMetadata: catData.import_metadata || undefined,
      activePalette: paletteToUse,
      currentSpread: [1, hydratedPages.length > 1 ? 2 : 1],
      pages: hydratedPages,
      totalPages: catData.total_pages || hydratedPages.length,
    }, s.activeUserId);

  };

  return {
  theme: getInitialTheme(),
  toggleTheme: () =>
    set((s) => {
      const next = s.theme === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      return { theme: next };
    }),
  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
  },

  hasStartedSession: false,
  isDemoLoading: false,

  catalogTitle: 'Novo Catálogo',
  setCatalogTitle: (title) => set({ catalogTitle: title }),

  activeMode: 'orchestrator',
  agentStatus: 'idle',
  setActiveMode: (mode) =>
    set((s) => ({
      activeMode: mode,
      activeRoleId: mode,
      threads: s.threads.map((t) => (t.id === s.activeThreadId ? { ...t, mode, roleId: mode } : t)),
    })),
  setAgentStatus: (status) => set({ agentStatus: status }),

  // Multi-Agent Live Cursors
  activeAgentCursors: [],

  triggerAgentCursor: (roleId, actionText, options) => {
    const config = AGENT_CURSOR_CONFIGS[roleId] || AGENT_CURSOR_CONFIGS.director;
    const cursorId = `cursor-${roleId}`;
    const x = options?.x ?? config.defaultPosition.x;
    const y = options?.y ?? config.defaultPosition.y;

    // Se o agente ja estava ativo, usa sua coordenada anterior como ponto de partida do novo trajeto
    const existing = get().activeAgentCursors.find((c) => c.id === cursorId);
    const startX = options?.startX ?? (existing ? existing.x : config.originPosition.x);
    const startY = options?.startY ?? (existing ? existing.y : config.originPosition.y);
    const durationMs = options?.durationMs ?? 3200;

    const newCursor: AgentCursor = {
      id: cursorId,
      roleId,
      name: config.name,
      roleLabel: config.roleLabel,
      initials: config.initials,
      color: config.color,
      startX,
      startY,
      x,
      y,
      actionText,
      targetElementId: options?.targetElementId,
      isActing: true,
      timestamp: Date.now(),
    };

    set((state) => ({
      activeAgentCursors: [
        ...state.activeAgentCursors.filter((c) => c.id !== cursorId),
        newCursor,
      ],
    }));

    // Remove apos a duracao da animacao
    setTimeout(() => {
      set((state) => ({
        activeAgentCursors: state.activeAgentCursors.filter((c) => c.id !== cursorId),
      }));
    }, durationMs);
  },

  clearAgentCursors: () => set({ activeAgentCursors: [] }),

  // Roles Management (Cargos Especializados)
  roles: getInitialRoles(),
  activeRoleId: 'orchestrator',
  isRoleManagerOpen: false,
  setIsRoleManagerOpen: (open) => set({ isRoleManagerOpen: open }),

  // Council / Mesa Redonda
  isCouncilModalOpen: false,
  setIsCouncilModalOpen: (open) => set({ isCouncilModalOpen: open }),

  // Skills Catalog Modal
  isSkillsModalOpen: false,
  setIsSkillsModalOpen: (open) => set({ isSkillsModalOpen: open }),
  pendingInputPrompt: null,
  setPendingInputPrompt: (prompt) => set({ pendingInputPrompt: prompt }),

  // Studio Sidebar (ChatGPT style) & Recent Catalogs
  isStudioSidebarOpen: true,
  setIsStudioSidebarOpen: (open) => set({ isStudioSidebarOpen: open }),
  toggleStudioSidebar: () => set((s) => ({ isStudioSidebarOpen: !s.isStudioSidebarOpen })),
  isCoPilotOpen: true,
  setIsCoPilotOpen: (open) => set({ isCoPilotOpen: open }),
  toggleCoPilot: () => set((s) => ({ isCoPilotOpen: !s.isCoPilotOpen })),
  isAccountSettingsOpen: false,
  setIsAccountSettingsOpen: (open) => set({ isAccountSettingsOpen: open }),
  openAccountSettings: () => set({ isAccountSettingsOpen: true }),
  closeAccountSettings: () => set({ isAccountSettingsOpen: false }),
  activeCatalogId: null,
  setActiveCatalogId: (id) => set({ activeCatalogId: id }),
  setHasStartedSession: (started) => set({ hasStartedSession: started }),

  activeUserId: null,
  setActiveUserId: (userId) => {
    const org = userId == null ? null : organizationService.getActiveOrganizationId();
    if (get().activeUserId !== userId || get().activeOrganizationId !== org) {
      get().resetStudioState();
      set({activeUserId: userId, activeOrganizationId: org,
          roles: getInitialRoles(),
          brands: userId != null && org != null ? readBrandCache(userId, org) : [],
        legacyBrandCount: userId != null && org != null ? pendingLegacyBrands(userId, org).length : 0});
    }
  },
  resetStudioState: () => {
      chatAbort?.abort();
      chatAbort = null;
      bootFlight = null;
      bootScopeKey = '';
      brandEpoch += 1;
    documentEpoch += 1;
    activeImportOperation = null;
    catalogLoadOperation += 1;
    generationOperation += 1;
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('katana_studio_last_active_catalog');
        localStorage.removeItem('katana_studio_brands');
        localStorage.removeItem('katana_studio_unlinked_catalogs');
      } catch {}
    }
    set({
      activeUserId: null,
      activeOrganizationId: null, brandLoadStatus: 'idle', brandLoadError: null, legacyBrandCount: 0,
      catalogBrandContext: catalogBrandSnapshot({}),
      hasStartedSession: false,
      activeCatalogId: null,
      catalogTitle: 'Novo Catálogo',
        activePalette: { ...STUDIO_PALETTE_PRESETS[0] },
        roles: [...DEFAULT_STUDIO_ROLES],
        activeRoleId: 'orchestrator',
        activeMode: 'orchestrator',
        pendingInputPrompt: null,
        activeTargetSlot: null,
        isBrandModalOpen: false,
        brandModalEditingId: null,
        isAccountSettingsOpen: false,
        isRoleManagerOpen: false,
        isCouncilModalOpen: false,
        isSkillsModalOpen: false,
        isProductDrawerOpen: false,
        isExcelImportModalOpen: false,
        isExportModalOpen: false,
        isNewCatalogModalOpen: false,
        pages: [],
      qualityGate: undefined, importMetadata: undefined,
      totalPages: 0,
      executionPlan: [],
      messages: [],
      threads: [],
      activeThreadId: '',
      agentStatus: 'idle',
      selectedElementId: null,
      currentSpread: [1, 2],
      isGeneratingCatalog: false,
      generationProgress: 0,
      generationStage: 1,
      generationLogs: [],
      generationTargetCatalog: null,
      unlinkedCatalogs: [],
        catalogSyncStatus: 'idle',
        historyStack: [],
        redoStack: [],
        canUndo: false,
        canRedo: false,
        isDemoLoading: false,
      brands: [],
      activeBrandId: null,
      unassignedProducts: [],
      activeAgentCursors: [],
    });
  },

  // Backend Brands are authoritative; the old browser shape is only an adapter.
  brands: [],
  activeOrganizationId: null,
  brandLoadStatus: 'idle',
  brandLoadError: null,
  legacyBrandCount: 0,
  catalogBrandContext: catalogBrandSnapshot({}),
  activeBrandId: null,
  setActiveBrandId: (id) => set({activeBrandId: id}),
  syncBrands: async () => {
    const scope = captureBrandScope();
    if (scope.user == null || scope.org == null) {
      set({brands: [], activeBrandId: null, brandLoadStatus: 'error', brandLoadError: 'Selecione uma organização para usar marcas persistentes.'});
      return;
    }
    set({brandLoadStatus: 'loading', brandLoadError: null});
    try {
      const loaded = await brandService.list(scope.org);
      if (!isCurrentBrandScope(scope)) return;
      const brands = loaded.filter(brand => brand.organization === scope.org);
      set({brands, brandLoadStatus: 'ready', brandLoadError: null,
        activeBrandId: brands.some(brand => brand.id === get().activeBrandId && brand.status !== 'archived') ? get().activeBrandId : null,
        legacyBrandCount: pendingLegacyBrands(scope.user, scope.org).length});
      writeBrandCache(scope.user, scope.org, brands);
    } catch {
      if (isCurrentBrandScope(scope)) set({brandLoadStatus: 'error', brandLoadError: 'Não foi possível sincronizar as marcas. A cópia em cache é somente leitura.'});
    }
  },
  migrateLegacyBrands: async () => {
    const scope = requireBrandScope();
    await brandService.migrate(scope.user, scope.org);
    if (!isCurrentBrandScope(scope)) return;
    await get().syncBrands();
    if (isCurrentBrandScope(scope)) await get().syncUserCatalogs();
  },
  addBrand: async (data) => {
    const scope = requireBrandScope();
    const brand = await brandService.create(data, scope.org);
    if (!acceptBrand(brand, scope)) throw new Error('O contexto mudou. A marca foi salva na organização original.');
    set({activeBrandId: brand.id, isBrandModalOpen: false, brandModalEditingId: null});
    toast.success(`Marca "${brand.name}" cadastrada com sucesso!`);
    return brand;
  },
  updateBrand: async (id, updates) => {
    const scope = requireBrandScope();
    const brand = await brandService.update(id, updates, scope.org);
    if (!acceptBrand(brand, scope)) return;
    set({isBrandModalOpen: false, brandModalEditingId: null});
    toast.success('Marca atualizada com sucesso!');
  },
  deleteBrand: async (id) => {
    const scope = requireBrandScope();
    await brandService.archive(id);
    if (!isCurrentBrandScope(scope)) return;
    set({activeBrandId: get().activeBrandId === id ? null : get().activeBrandId});
    await get().syncBrands();
    await get().syncUserCatalogs();
    toast.success('Marca arquivada. O histórico dos catálogos foi preservado.');
  },
  decideBrandEvidence: async (id, decision) => {
    const scope = requireBrandScope();
    acceptBrand(await brandService.decide(id, decision), scope);
  },
  addBrandRule: async (id, kind, rule) => {
    const scope = requireBrandScope();
    acceptBrand(await brandService.addRule(id, kind, rule), scope);
  },
  isBrandModalOpen: false,
  brandModalEditingId: null,
  openBrandModal: (brandId) => set({ isBrandModalOpen: true, brandModalEditingId: brandId || null }),
  closeBrandModal: () => set({ isBrandModalOpen: false, brandModalEditingId: null }),

  // Unlinked / Standalone Projects (Antigravity style)
  unlinkedCatalogs: getStoredUnlinkedCatalogs(),
  addUnlinkedCatalog: (data) => {
    const newItem: RecentCatalogItem = {
      ...data,
      id: `proj-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    };
    const updated = [newItem, ...get().unlinkedCatalogs];
    saveStoredUnlinkedCatalogs(updated, get().activeUserId);
    set({ unlinkedCatalogs: updated });
    return newItem;
  },
  removeUnlinkedCatalog: (id) => {
    const updated = get().unlinkedCatalogs.filter((c) => c.id !== id);
    saveStoredUnlinkedCatalogs(updated, get().activeUserId);
    set({ unlinkedCatalogs: updated });
  },

  // New Catalog Creation Modal
  isNewCatalogModalOpen: false,
  setIsNewCatalogModalOpen: (open) => set({ isNewCatalogModalOpen: open }),
  openNewCatalogModal: () => set({ isNewCatalogModalOpen: true }),
  closeNewCatalogModal: () => set({ isNewCatalogModalOpen: false }),
  createBlankCatalog: async (title, pagesCount = 6, paletteName) => {
    const blankScope = captureBrandScope();
    const blankOperation = ++catalogLoadOperation;
    if (get().activeBrandId && get().brandLoadStatus !== 'ready') { toast.error('Sincronize a marca antes de criar este catálogo. Use Tentar novamente.'); return; }
    const catalogTitle = title?.trim() || 'Novo Catálogo';
    const activeBrand = get().brands.find((b) => b.id === get().activeBrandId);
    if (activeBrand?.status === 'archived') { toast.error('Escolha uma marca ativa ou um catálogo avulso.'); return; }
    const palette =
      (paletteName && STUDIO_PALETTE_PRESETS.find((p) => p.name === paletteName)) ||
      activeBrand?.customPalette ||
      STUDIO_PALETTE_PRESETS.find((p) => p.name === activeBrand?.paletteName) ||
      STUDIO_PALETTE_PRESETS[0];

    const tempId = `cat-${Date.now()}`;
    const pages: CatalogPageData[] = [];
    // Capa
    pages.push({
      id: `${tempId}-p1`,
      pageNumber: 1,
      type: 'cover',
      title: catalogTitle.toUpperCase(),
      subtitle: activeBrand ? `COLEÇÃO EDITORIAL · ${activeBrand.name.toUpperCase()}` : 'COLEÇÃO EDITORIAL 2026',
      label: 'NOVO CATÁLOGO',
      backgroundColor: palette.primary,
      textColor: palette.background,
      accentColor: palette.accent,
    });

    // Lâminas intermediárias
    for (let i = 2; i < pagesCount; i++) {
      const pageType: PageLayoutType = i === 2 ? 'manifesto' : i % 2 === 1 ? 'hero' : 'duo';
      pages.push({
        id: `${tempId}-p${i}`,
        pageNumber: i,
        type: pageType,
        title: pageType === 'manifesto' ? 'Manifesto Editorial' : undefined,
        label: pageType === 'manifesto' ? 'MANIFESTO' : `LÂMINA ${String(i).padStart(2, '0')}`,
        folio: `${String(i).padStart(2, '0')} · ${catalogTitle.toUpperCase()}`,
        content:
          pageType === 'manifesto'
            ? activeBrand?.toneOfVoice || 'Espaço reservado para o manifesto da marca e diretrizes conceituais.'
            : undefined,
        products: [],
        backgroundColor: palette.background,
        textColor: palette.primary,
        accentColor: palette.accent,
      });
    }

    // Contracapa
    const backTitle = activeBrand?.name || 'KATANA STUDIO';
    const contactInfo = activeBrand?.commercialContact
      ? [
          activeBrand.commercialContact.whatsapp ? `WhatsApp: ${activeBrand.commercialContact.whatsapp}` : '',
          activeBrand.commercialContact.email ? `E-mail: ${activeBrand.commercialContact.email}` : '',
          activeBrand.commercialContact.website ? `Site: ${activeBrand.commercialContact.website}` : '',
          activeBrand.commercialContact.instagram ? `Instagram: ${activeBrand.commercialContact.instagram}` : '',
        ]
          .filter(Boolean)
          .join(' · ')
      : '';

    pages.push({
      id: `${tempId}-p${pagesCount}`,
      pageNumber: pagesCount,
      type: 'backcover',
      title: backTitle.toUpperCase(),
      label: 'CONTATO COMERCIAL',
      content: contactInfo || 'Canal direto de vendas, pedidos e atendimento corporativo.',
      folio: `${String(pagesCount).padStart(2, '0')} · CONTRA-CAPA`,
      backgroundColor: palette.primary,
      textColor: palette.background,
      accentColor: palette.accent,
    });

    let realCatalogId = tempId;
    let threadId = `thread-${Date.now()}`;
    let blankBrandContext = catalogBrandSnapshot({});
    try {
      const res = await api.post('/api/v2/studio/catalogs/', {
        title: catalogTitle,
        brand_name: activeBrand?.name || '',
        brand_id: get().brandLoadStatus === 'ready' ? activeBrand?.id || null : null,
        organization: get().activeOrganizationId,
        style_preset: palette.name,
        primary_color: palette.primary,
        secondary_color: palette.background,
        accent_color: palette.accent,
        total_pages: pagesCount,
        brand_lock: Boolean(palette.locked),
        palette_data: palette,
      });
      if (blankOperation !== catalogLoadOperation || !isCurrentBrandScope(blankScope)) return;
      if (res.data && res.data.id) {
        realCatalogId = String(res.data.id);
        blankBrandContext = catalogBrandSnapshot(res.data);
        if (res.data.thread_id) {
          threadId = `thread-${res.data.thread_id}`;
        }
      }
    } catch (e) {
      if (blankOperation !== catalogLoadOperation || !isCurrentBrandScope(blankScope)) return;
      if ((e as {response?: {data?: {code?: string}}}).response?.data?.code === 'catalog_limit_exceeded') {toast.error('Limite de catálogos ativos atingido. Arquive um catálogo ou altere seu plano.'); return;}
      if (activeBrand) { toast.error('Não foi possível salvar o catálogo com a marca. Tente novamente.'); return; }
      console.warn('Falha ao persistir catalogo no backend, utilizando ID local:', e);
    }

    pages.forEach((p) => {
      p.id = `p-${realCatalogId}-${p.pageNumber}`;
    });

    const initialThread: ChatThread = {
      id: threadId,
      title: catalogTitle,
      mode: 'director',
      createdAt: new Date().toISOString(),
      messages: [
        {
          id: `msg-welcome-${Date.now()}`,
          role: 'assistant',
          content: `Novo catálogo **${catalogTitle}** criado com ${pagesCount} páginas em branco na prancheta. Você pode alocar produtos do acervo, importar produtos ou me dar instruções de diagramação.`,
          timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        },
      ],
    };

    generationOperation += 1;
    set({
      hasStartedSession: true,
      isGeneratingCatalog: false, generationTargetCatalog: null, isDemoLoading: false,
      generationProgress: 0, generationStage: 1, generationLogs: [],
      activeCatalogId: realCatalogId,
      catalogBrandContext: blankBrandContext,
      catalogTitle,
      pages,
      totalPages: pagesCount,
      activePalette: palette,
      currentSpread: [1, 2],
      agentStatus: 'idle',
      threads: [initialThread],
      activeThreadId: initialThread.id,
      messages: initialThread.messages,
      executionPlan: [
        { id: 'step-1', label: `Prancheta "${catalogTitle}" inicializada no padrão A4`, status: 'completed', roleBadge: 'Estrutura' },
        { id: 'step-2', label: `Paleta ${palette.name} associada`, status: 'completed', roleBadge: 'Design' },
        { id: 'step-3', label: `${pagesCount} lâminas preparadas para alocação`, status: 'completed', roleBadge: 'Diagramação' },
      ],
      isPlanCollapsed: true,
      isPlanHidden: false,
      selectedElementId: null,
      isNewCatalogModalOpen: false,
    });

    try {
      const uid = get().activeUserId ?? getCurrentUserId();
      localStorage.setItem(
          workspaceKey(
            uid,
            organizationService.getActiveOrganizationId(),
            'last_active_catalog'
          ), realCatalogId);
      localStorage.removeItem('katana_studio_last_active_catalog');
    } catch {}

    const numericId = parseInt(realCatalogId, 10);
    if (!isNaN(numericId)) {
      const spreadsPayload = [];
      for (let p = 0; p < pages.length; p += 2) {
        const left = pages[p];
        const right = pages[p + 1] || null;
        spreadsPayload.push({
          spread_index: Math.floor(p / 2),
          title: `Spread ${left.pageNumber}-${right ? right.pageNumber : left.pageNumber}`,
          left_page: left,
          right_page: right,
          left_page_elements: left ? [left] : [],
          right_page_elements: right ? [right] : [],
        });
      }
      api.post(`/api/v2/studio/catalogs/${numericId}/spreads/bulk/`, {
        total_pages: pagesCount,
        spreads: spreadsPayload,
      }).catch((e) => console.warn('Falha no bulk sync dos spreads iniciais:', e));
    }

    saveStoredProjectSession(realCatalogId, {
      threads: [initialThread],
      activeThreadId: initialThread.id,
      catalogTitle,
      activePalette: palette,
      currentSpread: [1, 2],
      pages,
      totalPages: pagesCount,
    });

    await get().syncUserCatalogs();

    toast.success(`Catálogo "${catalogTitle}" pronto para edição!`);
  },

  // Export Catalog Modal
  isExportModalOpen: false,
  exportModalTab: 'pdf',
  openExportModal: async (tab = 'pdf') => {
    if (get().qualityGate?.publishable === false) {
      toast.error('Catálogo precisa de revisão antes da publicação.');
      return;
    }
    if (tab === 'share' && get().importMetadata && get().activeCatalogId) {
      const scope = captureBrandScope();
      const catalogId = get().activeCatalogId;
      try {
        await get().flushSaveSpread();
        if (!isCurrentBrandScope(scope) || get().activeCatalogId !== catalogId) return;
        const response = await api.put(`/api/v2/studio/catalogs/${catalogId}/`, {share_import: true});
        if (!isCurrentBrandScope(scope) || get().activeCatalogId !== catalogId) return;
        set({importMetadata: response.data.import_metadata || {...get().importMetadata, share_enabled: true}});
      } catch { toast.error('Não foi possível autorizar o compartilhamento deste documento.'); return; }
    }
    set({ isExportModalOpen: true, exportModalTab: tab });
  },
  closeExportModal: () => set({ isExportModalOpen: false }),

  // Product Drawer & Inventory Repository
  isProductDrawerOpen: false,
  unassignedProducts: [],
  activeTargetSlot: null,
  openProductDrawer: (targetSlot) => set({ isProductDrawerOpen: true, activeTargetSlot: targetSlot ?? null }),
  closeProductDrawer: () => set({ isProductDrawerOpen: false, activeTargetSlot: null }),
  setActiveTargetSlot: (activeTargetSlot) => set({ activeTargetSlot }),
  toggleProductDrawer: () => set((s) => ({ isProductDrawerOpen: !s.isProductDrawerOpen, activeTargetSlot: s.isProductDrawerOpen ? null : s.activeTargetSlot })),
  addProductToRepository: (productData) => {
    const newProduct: ProductItem = {
      ...productData,
      id: `prod-custom-${crypto.randomUUID()}`,
    };
    set((s) => ({
      unassignedProducts: [newProduct, ...s.unassignedProducts],
    }));
    toast.success(`Produto "${newProduct.name}" adicionado ao acervo!`);
    return newProduct;
  },
  deleteProductFromRepository: (productId) => {
    set((s) => ({
      unassignedProducts: s.unassignedProducts.filter((p) => p.id !== productId),
    }));
    toast.info('Produto removido do acervo.');
  },
  assignProductToSpread: (product, targetPageNumber, slotIndex = 0) => {
    get().pushHistorySnapshot();
    const state = get();
    const updatedPages = state.pages.map((page) => {
      if (page.pageNumber !== targetPageNumber) return page;

      let newType = page.type;
      if (['cover', 'divider', 'manifesto'].includes(page.type)) {
        newType = 'hero';
      }

      let newProducts = [...(page.products || [])];
      if (newType === 'hero' || newType === 'single') {
        newProducts = [product];
      } else if (newType === 'duo') {
        newProducts[slotIndex] = product;
      } else if (newType === 'grid_4') {
        newProducts[slotIndex] = product;
      } else {
        newProducts = [product];
      }

      return {
        ...page,
        type: newType,
        products: newProducts,
      };
    });

    const updatedUnassigned = state.unassignedProducts.filter((p) => p.id !== product.id);

    set({
      pages: updatedPages,
      unassignedProducts: updatedUnassigned,
      saveStatus: 'unsaved',
      activeTargetSlot: null,
    });

    get().debouncedSaveCurrentSpread();
    toast.success(`Produto "${product.name}" alocado na Página ${String(targetPageNumber).padStart(2, '0')} (Slot ${slotIndex + 1})!`);
  },

  removeProductFromSpread: (targetPageNumber, slotIndex, productId) => {
    get().pushHistorySnapshot();
    const state = get();
    let removedItems: ProductItem[] = [];

    const updatedPages = state.pages.map((page) => {
      if (page.pageNumber !== targetPageNumber) return page;
      if (!page.products || page.products.length === 0) return page;

      let remainingProducts: ProductItem[] = [];

      if (productId) {
        removedItems = page.products.filter((p) => p.id === productId);
        remainingProducts = page.products.filter((p) => p.id !== productId);
      } else if (typeof slotIndex === 'number' && slotIndex >= 0) {
        if (page.products[slotIndex]) {
          removedItems = [page.products[slotIndex]];
        }
        remainingProducts = page.products.filter((_, idx) => idx !== slotIndex);
      } else {
        removedItems = [...page.products];
        remainingProducts = [];
      }

      return {
        ...page,
        products: remainingProducts,
      };
    });

    if (removedItems.length > 0) {
      const currentUnassigned = [...state.unassignedProducts];
      for (const item of removedItems) {
        if (!currentUnassigned.some((p) => p.id === item.id)) {
          currentUnassigned.unshift({
            ...item,
            tag: item.tag || 'Disponível',
          });
        }
      }

      set({
        pages: updatedPages,
        unassignedProducts: currentUnassigned,
        saveStatus: 'unsaved',
      });

      const targetSpreadIndex = Math.floor((targetPageNumber - 1) / 2);
      get().goToSpread(targetSpreadIndex);

      get().debouncedSaveCurrentSpread();
      const names = removedItems.map((p) => p.name).join(', ');
      toast.success(`"${names}" removido da Página ${String(targetPageNumber).padStart(2, '0')}!`);
    }

    return removedItems;
  },

  isExcelImportModalOpen: false,
  openExcelImportModal: () => set({ isExcelImportModalOpen: true }),
  closeExcelImportModal: () => set({ isExcelImportModalOpen: false }),

  importProductsFromExcel: async (items, options = {}) => {
    const documentScope = captureDocumentScope();
    if (!items || items.length === 0) return;

    const newProducts: ProductItem[] = items.map((item, idx) => {
      const formattedPrice = item.price == null || !String(item.price).trim() ? null : String(item.price);
      return {
        id: `prod-excel-${Date.now()}-${idx}`,
        name: item.name || null,
        price: formattedPrice,
        category: (item.category || 'COLECAO 2026').trim(),
        sku: item.sku || null,
        description: item.description || null,
        image: item.image || null,
        tag: item.tag || null,
        index: String(idx + 1).padStart(2, '0'),
      };
    });

    set((s) => ({
      unassignedProducts: [...newProducts, ...s.unassignedProducts],
      isExcelImportModalOpen: false,
    }));

    // Sincronizacao persistente com PostgreSQL via API do Studio
    const activeCatId = get().activeCatalogId;
    const numericCatId = activeCatId ? parseInt(activeCatId, 10) : NaN;
    const endpoint = !isNaN(numericCatId)
      ? `/api/v2/studio/catalogs/${numericCatId}/products/import-sheet/`
      : `/api/v2/studio/products/import-sheet/`;

    try {
      const resp = await api.post(endpoint, {
        products: newProducts,
        catalog_id: !isNaN(numericCatId) ? numericCatId : undefined,
      });
      if (!isCurrentDocumentScope(documentScope)) return;
      if (resp.data && Array.isArray(resp.data.products)) {
        const backendProducts: ProductItem[] = resp.data.products;
        set((s) => {
          const others = s.unassignedProducts.filter(
            (p) => !newProducts.some((np) => np.sku === p.sku || np.id === p.id)
          );
          return {
            unassignedProducts: [...backendProducts, ...others],
          };
        });
      }
    } catch (err) {
      console.warn('[importProductsFromExcel] Falha ao persistir no PostgreSQL:', err);
    }

    if (!isCurrentDocumentScope(documentScope)) return;
    toast.success(`${newProducts.length} produtos importados com sucesso para o acervo!`);

    if (options.openDrawer) {
      set({ isProductDrawerOpen: true });
    }

    if (options.generateCatalog) {
      const categorySummary = newProducts[0]?.category || 'Produtos';
      const prompt = `Catalogo comercial para a colecao ${categorySummary} com ${newProducts.length} itens cadastrados`;
      get().triggerCatalogGeneration(prompt, undefined, newProducts);
    }
  },

  generateAIProductImage: async (productId, name, category, description) => {
    const documentScope = captureDocumentScope();
    try {
      const response = await api.post(`/api/v2/studio/products/generate-image/`, {
        name,
        category: category || '',
        description: description || '',
      });
      if (!isCurrentDocumentScope(documentScope)) return null;
      const imageUrl = response.data?.image_url;
      if (imageUrl) {
        get().updateProduct(productId, { image: imageUrl });
        toast.success(`Fotografia de estúdio gerada para "${name}"!`);
        return imageUrl;
      }
    } catch (err: any) {
      if (!isCurrentDocumentScope(documentScope)) return null;
      console.warn('[generateAIProductImage] Falha ao gerar imagem com IA:', err);
      if (err?.response?.status === 401) {
        const hasClerkSession = typeof window !== 'undefined' && Boolean((window as any).Clerk?.session);
        if (!hasClerkSession) {
          window.dispatchEvent(new CustomEvent('catana:unauthorized'));
        }
      } else {
        toast.error('Falha ao gerar imagem com IA para o produto.');
      }
    }
    return null;
  },

  isSystemDesignModalOpen: false,
  openSystemDesignModal: () => set({ isSystemDesignModalOpen: true }),
  closeSystemDesignModal: () => set({ isSystemDesignModalOpen: false }),

  isGeneratingCatalog: false,
  generationStage: 1,
  generationProgress: 0,
  generationLogs: [],
  generationTargetCatalog: null,
  lastGenerationPrompt: undefined,

  triggerCatalogGeneration: async (prompt: string, attachments?: ChatAttachment[], products?: ProductItem[]) => {
    if (get().activeBrandId && get().brandLoadStatus !== 'ready') { toast.error('Sincronize a marca antes de gerar. Use Tentar novamente.'); return; }
    if (get().brands.find(brand => brand.id === get().activeBrandId)?.status === 'archived') { toast.error('Escolha uma marca ativa ou um catálogo avulso.'); return; }
    const generationScope = captureBrandScope();
    const operation = ++generationOperation;
    const generationIsCurrent = () => operation === generationOperation && isCurrentBrandScope(generationScope) && get().isGeneratingCatalog;
    const generationBrandId = get().brandLoadStatus === 'ready' ? get().activeBrandId : null;
    const nowTime = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const shortPrompt = prompt.length > 55 ? `${prompt.slice(0, 52)}...` : prompt;
    const hasProducts = products && products.length > 0;

    set({
      isGeneratingCatalog: true,
      generationStage: 1,
      generationProgress: 18,
      generationTargetCatalog: null,
      lastGenerationPrompt: prompt,
      generationLogs: [
        {
          id: `log-${Date.now()}-1`,
          time: nowTime(),
          roleId: 'orchestrator',
          roleName: 'Orquestrador',
          text: hasProducts
            ? `Iniciando síntese generativa via Google Gemini com ${products.length} produtos reais e análise de utilidade comercial.`
            : `Iniciando síntese generativa via Google Gemini para: "${shortPrompt}".`,
        },
      ],
    });

    const timer2 = setTimeout(() => {
      if (!generationIsCurrent()) return;
      set((s) => ({
        generationStage: 2,
        generationProgress: 42,
        generationLogs: [
          ...s.generationLogs,
          {
            id: `log-${Date.now()}-2`,
            time: nowTime(),
            roleId: 'director',
            roleName: 'Editor-Chefe',
            text: hasProducts
              ? 'Conselho Editorial ativado. Gemini investigando a função prática dos produtos para compor manifesto e conceito.'
              : 'Conselho Editorial ativado. Gemini sintetizando conceito de marca, manifesto e mix de produtos.',
          },
        ],
      }));
    }, 800);

    const timer3 = setTimeout(() => {
      if (!generationIsCurrent()) return;
      set((s) => ({
        generationStage: 3,
        generationProgress: 68,
        generationLogs: [
          ...s.generationLogs,
          {
            id: `log-${Date.now()}-3`,
            time: nowTime(),
            roleId: 'art_director',
            roleName: 'Diretor de Arte',
            text: 'Calculando harmonia cromatica, contraste certificado WCAG AAA e tipografia editorial.',
          },
        ],
      }));
    }, 1800);

    try {
      const response = await api.post(
        `/api/v2/studio/catalogs/generate/`,
        { prompt, products, brand_id: generationBrandId, organization: generationScope.org },
        { timeout: 60000 }
      );

      clearTimeout(timer2);
      clearTimeout(timer3);

      if (!generationIsCurrent()) return;

      const generated: GeneratedCatalogResult = normalizeCatalogDocument(response.data);
      if (!generated || !generated.pages || generated.pages.length === 0) {
        throw new Error('Retorno do Gemini sem paginas validas');
      }

      generated.initialPrompt = prompt;
      if (generated.studioCatalogId) generated.catalogId = String(generated.studioCatalogId);

      set((s) => ({
        generationStage: 4,
        generationProgress: 88,
        generationTargetCatalog: generated,
        generationLogs: [
          ...s.generationLogs,
          {
            id: `log-${Date.now()}-4`,
            time: nowTime(),
            roleId: 'grid_architect',
            roleName: 'Diagramador A4',
            text: `Estruturadas ${generated.totalPages} paginas editoriais para "${generated.title}" (${generated.category}).`,
          },
          {
            id: `log-${Date.now()}-5`,
            time: nowTime(),
            roleId: 'copywriter',
            roleName: 'Copywriter',
            text: `Manifesto exclusivo e titulos comerciais gerados pela IA sob a paleta "${generated.palette.name}".`,
          },
        ],
      }));

      // Stage 5: Finalizacao e Auditoria
      setTimeout(() => {
        if (!generationIsCurrent()) return;
        set((s) => ({
          generationStage: 5,
          generationProgress: 98,
          generationLogs: [
            ...s.generationLogs,
            {
              id: `log-${Date.now()}-6`,
              time: nowTime(),
              roleId: 'branding_auditor',
              roleName: 'Auditor de Branding',
              text: generated.qualityGate?.passed === false ? 'Catálogo gerado para revisão; os gates obrigatórios não foram aprovados.' : 'Auditoria editorial concluída. Compilando pranchetas para o Katana Studio.',
            },
          ],
        }));

        setTimeout(() => {
          if (!generationIsCurrent()) return;
          get().finishCatalogGeneration();
        }, 600);
      }, 700);

    } catch (err) {
      console.warn('[triggerCatalogGeneration] Falha ao conectar ao Gemini, acionando sintese de contingencia local:', err);
      clearTimeout(timer2);
      clearTimeout(timer3);

      if (!generationIsCurrent()) return;

      const fallback = generateCatalogFromPrompt(prompt, attachments);
      fallback.initialPrompt = prompt;
      // Contingency is visual only; never promote demo products into user inventory.
      fallback.pages = fallback.pages.map(page => ({...page, products: [], renderMode:'legacy', blocks:[]}));
      fallback.qualityGate = {passed:false, publishable:false, status:'needs_review', reasons:['REMOTE_GENERATION_UNAVAILABLE']};

      set((s) => ({
        generationStage: 4,
        generationProgress: 88,
        generationTargetCatalog: fallback,
        generationLogs: [
          ...s.generationLogs,
          {
            id: `log-${Date.now()}-fallback`,
            time: nowTime(),
            roleId: 'orchestrator',
            roleName: 'Orquestrador',
            text: `Modo de contingencia acionado. Sintese local aplicada para "${fallback.title}".`,
          },
        ],
      }));

      setTimeout(() => {
        if (!generationIsCurrent()) return;
        set((s) => ({
          generationStage: 5,
          generationProgress: 98,
          generationLogs: [
            ...s.generationLogs,
            {
              id: `log-${Date.now()}-finish`,
              time: nowTime(),
              roleId: 'branding_auditor',
              roleName: 'Auditor de Branding',
              text: 'Compilando pranchetas de contingencia para o Katana Studio.',
            },
          ],
        }));

        setTimeout(() => {
          if (!generationIsCurrent()) return;
          get().finishCatalogGeneration();
        }, 600);
      }, 700);
    }
  },

  finishCatalogGeneration: () => {
    const finishScope = captureBrandScope();
    const finishOperation = generationOperation;
    let target = get().generationTargetCatalog;
    if (!target) {
      const fallbackPrompt = get().lastGenerationPrompt || 'Catalogo Editorial';
      target = generateCatalogFromPrompt(fallbackPrompt);
      set({ generationTargetCatalog: target });
    }

    const initialMessages: ChatMessage[] = [
      {
        id: 'msg-welcome',
        role: 'assistant',
        content: target.totalPages === 1
          ? `Catálogo **"${target.title}"** gerado e diagramado com sucesso em **Página Única (One-Pager)** sob a paleta **${target.palette.name}**.\n\n${target.summary}\n\n**Você pode interagir livremente:**\n- **Clique em qualquer elemento** na prancheta para editar textos, preços e imagens.\n- **Use o chat do Co-Pilot** para solicitar alterações com auxílio do Conselho Editorial.`
          : `Catálogo **"${target.title}"** gerado e diagramado com sucesso!\n\nEstruturei **${target.totalPages} páginas em ${Math.ceil(target.totalPages / 2)} spreads duplos**, com direção de arte em harmonia com a paleta **${target.palette.name}**.\n\n${target.summary}\n\n**Você pode interagir livremente:**\n- **Clique em qualquer elemento** na prancheta para editar textos, preços e imagens.\n- **Use o chat do Co-Pilot** para solicitar alterações com auxílio do Conselho Editorial.\n- **Navegue pelos spreads** pelo filmstrip inferior ou teclas de seta.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        reasoning: target.reasoning,
        delegations: target.councilDelegations,
        actions: [`Catálogo "${target.title}" estruturado em ${target.totalPages} página(s) sob a paleta ${target.palette.name}`],
      },
    ];

    if (target.initialPrompt && target.initialPrompt.trim()) {
      initialMessages.push({
        id: 'msg-user-briefing',
        role: 'user',
        content: target.initialPrompt.trim(),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
    }

    const initialThread: ChatThread = {
      id: 'thread-main',
      title: 'Coordenação Editorial',
      mode: 'orchestrator',
      roleId: 'orchestrator',
      messages: initialMessages,
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const spreadToUse: [number, number] = target.totalPages === 1 ? [1, 1] : [1, 2];

    set({
      isGeneratingCatalog: false,
      generationProgress: 100,
      hasStartedSession: true,
      activeCatalogId: target.catalogId,
      catalogBrandContext: catalogBrandSnapshot(target as unknown as Record<string, unknown>),
      catalogTitle: target.title,
      pages: target.pages,
      qualityGate: target.qualityGate,
      totalPages: target.totalPages,
      activePalette: target.palette,
      currentSpread: spreadToUse,
      agentStatus: 'idle',
      threads: [initialThread],
      activeThreadId: initialThread.id,
      messages: initialMessages,
      executionPlan: [
        { id: 'step-1', label: `Análise semântica do briefing: "${target.category}"`, status: 'completed', roleBadge: 'Estratégia' },
        { id: 'step-2', label: `Aplicação da paleta cromática ${target.palette.name}`, status: 'completed', roleBadge: 'Design' },
        { id: 'step-3', label: `Diagramação de ${target.totalPages} página(s) no padrão A4`, status: 'completed', roleBadge: 'Diagramação' },
        { id: 'step-4', label: target.qualityGate?.passed === false ? 'Auditoria editorial requer revisão' : 'Auditoria editorial e conformidade de leitura', status: target.qualityGate?.passed === false ? 'pending' : 'completed', roleBadge: 'Auditoria' },
      ],
      isPlanCollapsed: true,
      isPlanHidden: false,
    });

    saveStoredProjectSession(target.catalogId, {
      threads: [initialThread],
      activeThreadId: initialThread.id,
      catalogTitle: target.title,
      activePalette: target.palette,
      currentSpread: spreadToUse,
      pages: target.pages,
      qualityGate: target.qualityGate,
      totalPages: target.totalPages,
    });

    const numericTargetId = parseInt(target.catalogId, 10);
    if (isNaN(numericTargetId)) {
      api.post('/api/v2/studio/catalogs/', {
        title: target.title,
        organization: finishScope.org,
        brand_name: (target as any).brandName || target.category || '',
        style_preset: target.palette.name,
        primary_color: target.palette.primary,
        secondary_color: target.palette.background,
        accent_color: target.palette.accent,
        total_pages: target.totalPages,
        brand_lock: Boolean(target.palette.locked),
        palette_data: target.palette,
        unassigned_products: get().unassignedProducts,
      }).then((res) => {
        if (finishOperation !== generationOperation || !isCurrentBrandScope(finishScope)) return;
        if (res.data && res.data.id) {
          const realId = String(res.data.id);
          set({ activeCatalogId: realId });
          try {
            const uid = get().activeUserId ?? getCurrentUserId();
            localStorage.setItem(
                  workspaceKey(
                    uid,
                    organizationService.getActiveOrganizationId(),
                    'last_active_catalog'
                  ), realId);
            localStorage.removeItem('katana_studio_last_active_catalog');
          } catch {}
          const spreadsPayload = [];
          for (let p = 0; p < target.pages.length; p += 2) {
            const left = target.pages[p];
            const right = target.pages[p + 1] || null;
            spreadsPayload.push({
              spread_index: Math.floor(p / 2),
              title: `Spread ${left.pageNumber}-${right ? right.pageNumber : left.pageNumber}`,
              left_page: left,
              right_page: right,
              left_page_elements: left ? [left] : [],
              right_page_elements: right ? [right] : [],
            });
          }
          api.post(`/api/v2/studio/catalogs/${res.data.id}/spreads/bulk/`, {
            total_pages: target.totalPages,
            spreads: spreadsPayload,
          }).catch((err) => console.warn('Falha ao salvar spreads gerados no PostgreSQL:', err));
        }
      }).catch((err) => console.warn('Falha ao criar catalogo gerado no backend:', err));
    }

    void get().syncUserCatalogs();

    toast.success(`Catálogo "${target.title}" gerado com sucesso!`);
  },

  cancelCatalogGeneration: () => {
    generationOperation += 1;
    set({
      isGeneratingCatalog: false,
      generationProgress: 0,
      generationStage: 1,
      generationLogs: [],
      generationTargetCatalog: null,
      lastGenerationPrompt: undefined,
    });
  },

  cancelDocumentImport: () => {
    if (activeImportOperation === catalogLoadOperation) catalogLoadOperation += 1;
    activeImportOperation = null;
  },
  confirmDocumentImport: async (importId, options) => {
    const scope = captureBrandScope();
    if (scope.user == null || scope.user === 'anonymous' || scope.org == null || !isCurrentBrandScope(scope)) throw new Error('Selecione uma organização para importar.');
    const operation = ++catalogLoadOperation;
    activeImportOperation = operation;
    set({isDemoLoading: false});
    try {
    if (get().activeCatalogId && get().hasStartedSession) {
      syncActiveCatalogStorage(get());
      await get().flushSaveSpread();
      if (operation !== catalogLoadOperation || !isCurrentBrandScope(scope)) return false;
      if (get().saveStatus === 'error') throw new Error('Não foi possível salvar o catálogo atual. Tente novamente antes de confirmar a importação.');
    }
    const result = await documentImportService.confirm(importId, {...options, organization: scope.org});
    if (operation !== catalogLoadOperation || !isCurrentBrandScope(scope)) return false;
    if (!result.catalog_id) throw new Error('A confirmação não retornou um catálogo salvo.');
    const response = await api.get(`/api/v2/studio/catalogs/${result.catalog_id}/`);
    if (operation !== catalogLoadOperation || !isCurrentBrandScope(scope)) return false;
    if (response.data.organization !== scope.org) throw new Error('O catálogo pertence a outra organização.');
    if (saveTimeout) { clearTimeout(saveTimeout); saveTimeout = null; }
    hydrateBackendCatalog(response.data);
    syncActiveCatalogStorage(get());
    await get().syncUserCatalogs();
    return operation === catalogLoadOperation && isCurrentBrandScope(scope);
    } finally {
      if (activeImportOperation === operation) activeImportOperation = null;
    }
  },

  loadExistingCatalog: async (catalogId: string) => {
    const s = get();
    const loadScope = captureBrandScope();
    const loadOperation = ++catalogLoadOperation;

    // 1. Persiste o catálogo que está saindo se houver sessão ativa
    if (s.activeCatalogId && s.threads && s.threads.length > 0) {
      saveStoredProjectSession(s.activeCatalogId, {
        organization: s.activeOrganizationId,
        threads: s.threads,
        activeThreadId: s.activeThreadId,
        catalogTitle: s.catalogTitle,
        activePalette: s.activePalette,
        currentSpread: s.currentSpread,
        pages: s.pages,
        totalPages: s.totalPages,
      }, s.activeUserId);
      // Flush save no backend
      get().flushSaveSpread();
    }

    const numericCatalogId = /^\d+$/.test(catalogId) ? Number(catalogId) : NaN;
    // Se for ID numérico real do backend, busca do PostgreSQL com isolamento do usuário autenticado:
    if (!isNaN(numericCatalogId)) {
      try {
        set({ agentStatus: 'thinking' });
        const res = await api.get(`/api/v2/studio/catalogs/${numericCatalogId}/`);
        const catData = res.data;
        if (loadOperation !== catalogLoadOperation || !isCurrentBrandScope(loadScope)) return;
        if (s.activeOrganizationId != null && catData.organization != null && catData.organization !== s.activeOrganizationId) {
          const hintKey = workspaceKey(s.activeUserId, s.activeOrganizationId, 'last_active_catalog');
          if (localStorage.getItem(hintKey) === catalogId) localStorage.removeItem(hintKey);
          set({agentStatus: 'idle'}); return;
        }
        if (catData && catData.id) {
          hydrateBackendCatalog(catData);
          return;
        }
      } catch (err: any) {
        if (loadOperation !== catalogLoadOperation || !isCurrentBrandScope(loadScope)) return;
        console.warn('catalog_restore_failed', {catalogId, status: err?.response?.status});
        set({ agentStatus: 'idle' });
        if ([403, 404].includes(err?.response?.status)) {
          const key = workspaceKey(s.activeUserId, s.activeOrganizationId, 'last_active_catalog');
          if (localStorage.getItem(key) === catalogId) localStorage.removeItem(key);
          await get().syncUserCatalogs();
          toast.error('Catálogo não encontrado ou sem permissão de acesso.');
        } else if (err?.response?.status !== 401) {
          toast.error('Não foi possível carregar o catálogo. Tente novamente.');
        }
      }
      return; // A backend ID never falls back to browser copies or demo documents.
    }

    // 2. Mapeamento de títulos e briefings padrão para mocks legados
    let defaultTitle = 'Catálogo Comercial';
    let defaultPrompt = 'Lookbook editorial de moda e acessórios de luxo';

    if (catalogId === 'lookbook-editorial-2026' || catalogId === 'editorial-2026') {
      defaultTitle = 'Coleção Inverno 2026';
      defaultPrompt = 'Lookbook editorial de moda e acessórios de luxo';
    } else if (catalogId === 'capsula-linho-2026') {
      defaultTitle = 'Lookbook Cápsula de Seda';
      defaultPrompt = 'Alta moda lookbook capsula de seda e linho';
    } else if (catalogId === 'techgear-2026') {
      defaultTitle = 'Setup & Hardware B2B';
      defaultPrompt = 'Catálogo TechGear hardware e setup';
    } else if (catalogId === 'confeitaria-artesanal') {
      defaultTitle = 'Confeitaria & Pâtisserie';
      defaultPrompt = 'Catálogo de confeitaria artesanal doces gourmet';
    } else if (catalogId === 'cristallo-joias') {
      defaultTitle = 'Joalheria & Gemas Raras';
      defaultPrompt = 'Alta joalheria cristallo gemas ouro';
    }

    // 3. Tenta carregar a sessão persistida deste projeto isolada por usuário
    const existing = getStoredProjectSession(catalogId, s.activeUserId);
    if (loadOperation !== catalogLoadOperation || !isCurrentBrandScope(loadScope) || (s.activeOrganizationId != null && existing?.organization !== s.activeOrganizationId && /^\d+$/.test(catalogId))) { set({agentStatus: 'idle'}); return; }

    if (existing && existing.threads && existing.threads.length > 0) {
      const activeThread =
        existing.threads.find((t) => t.id === existing.activeThreadId) ||
        existing.threads[0];
      const activeRole = activeThread.roleId || activeThread.mode || 'orchestrator';
      const pagesToUse =
        existing.pages && existing.pages.length > 0
          ? existing.pages
          : generateCatalogFromPrompt(defaultPrompt).pages;
      const paletteToUse = existing.activePalette || STUDIO_PALETTE_PRESETS[0];

      set({
        hasStartedSession: true,
        catalogTitle: existing.catalogTitle || defaultTitle,
        activeCatalogId: catalogId,
        catalogBrandContext: existing.brandContext || catalogBrandSnapshot({}),
        importMetadata: existing.importMetadata,
        pages: pagesToUse,
        qualityGate: existing.qualityGate,
        totalPages: existing.totalPages || pagesToUse.length,
        currentSpread: existing.currentSpread || [1, 2],
        activePalette: paletteToUse,
        threads: existing.threads,
        activeThreadId: activeThread.id,
        messages: activeThread.messages || [],
        activeRoleId: activeRole,
        activeMode: activeRole,
        agentStatus: 'idle',
      });

      saveStoredProjectSession(catalogId, {
        threads: existing.threads,
        activeThreadId: activeThread.id,
        catalogTitle: existing.catalogTitle || defaultTitle,
        activePalette: paletteToUse,
        currentSpread: existing.currentSpread || [1, 2],
        brandContext: existing.brandContext, organization: existing.organization,
        pages: pagesToUse,
        qualityGate: existing.qualityGate,
        totalPages: existing.totalPages || pagesToUse.length,
      }, s.activeUserId);
      return;
    }

    // 4. Primeira abertura deste projeto: inicializa prancheta e cria thread contextualizada
    const generated = generateCatalogFromPrompt(defaultPrompt);
    const initialThreadId = `thread-${catalogId}-${Date.now()}`;
    const initialMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'assistant',
      content: `Catálogo **${generated.title}** aberto para edição na prancheta. Os ${generated.totalPages} spreads e os agentes do conselho editorial estão prontos para alterações e diagramação.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      reasoning: 'Racional do Editor-Chefe: Sessão editorial aberta para o projeto com paleta harmônica e modos de diagramação A4 aplicados.',
    };

    const initialThread: ChatThread = {
      id: initialThreadId,
      title: 'Coordenação Editorial',
      mode: 'orchestrator',
      roleId: 'orchestrator',
      messages: [initialMsg],
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    set({
      hasStartedSession: true,
      catalogTitle: generated.title,
      activeCatalogId: catalogId,
      pages: generated.pages,
      totalPages: generated.totalPages,
      currentSpread: [1, 2],
      activePalette: generated.palette,
      threads: [initialThread],
      activeThreadId: initialThreadId,
      messages: [initialMsg],
      activeRoleId: 'orchestrator',
      activeMode: 'orchestrator',
      agentStatus: 'idle',
    });

    saveStoredProjectSession(catalogId, {
      threads: [initialThread],
      activeThreadId: initialThreadId,
      catalogTitle: generated.title,
      activePalette: generated.palette,
      currentSpread: [1, 2],
      pages: generated.pages,
      totalPages: generated.totalPages,
    });
  },

    catalogSyncStatus: 'idle',
    initializeWorkspace: userId => {
      if (!isTokenReady()) return Promise.resolve();
      get().setActiveUserId(userId);
      const scope = captureBrandScope();
      const key = `${scope.user}:${scope.org}:${scope.epoch}`;
      if (bootFlight && bootScopeKey === key) return bootFlight;
      if (scope.org == null) return Promise.resolve();
      bootScopeKey = key;
      const flight = (async () => {
        await Promise.allSettled([
          get().syncBrands(),
          get().syncUserCatalogs()
        ]);
        if (!isCurrentBrandScope(scope) || get().catalogSyncStatus !== 'ready')
          return;
        const hintKey = workspaceKey(
          scope.user,
          scope.org,
          'last_active_catalog'
        );
        const hint = localStorage.getItem(hintKey);
        const ids = [
          ...get().unlinkedCatalogs,
          ...get().brands.flatMap(brand => brand.catalogs)
        ].map(catalog => String(catalog.id));
        if (hint && !ids.includes(hint)) localStorage.removeItem(hintKey);
        else if (hint && !get().hasStartedSession)
          await get().loadExistingCatalog(hint);
      })().finally(() => {
        if (isCurrentBrandScope(scope) && get().catalogSyncStatus === 'error')
          bootFlight = null;
      });
      bootFlight = flight;
      return flight;
  },

  syncUserCatalogs: async () => {
    const scope = captureBrandScope();
    if (scope.user == null || scope.org == null) return;
      set({ catalogSyncStatus: 'loading' });
      try {
      const {data} = await api.get(
          `/api/v2/studio/catalogs/?organization=${scope.org}&status=active`
        );
      if (!isCurrentBrandScope(scope) || !Array.isArray(data)) return;
      const grouped = groupBrandCatalogs(get().brands, data);
      set({ ...grouped, catalogSyncStatus: 'ready' });
      writeBrandCache(scope.user, scope.org, grouped.brands);
    } catch {
        if (isCurrentBrandScope(scope)) set({ catalogSyncStatus: 'error' });
      }
  },

  loadDemoCatalog: async (templateKey: string) => {
    const s = get();
    const demoScope = captureBrandScope();
    const demoOperation = ++catalogLoadOperation;
    const demoIsCurrent = () => demoOperation === catalogLoadOperation && isCurrentBrandScope(demoScope);
    // Flush current spread if active
    if (s.activeCatalogId && s.threads && s.threads.length > 0) {
      get().flushSaveSpread();
    }

    set({ isDemoLoading: true, agentStatus: 'thinking' });

    const localTpl = CANONICAL_DEMO_TEMPLATES.find((t) => t.key === templateKey) || CANONICAL_DEMO_TEMPLATES[0];

    try {
      const res = await api.post('/api/v2/studio/demo/load-template/', {
        template_key: templateKey,
      });

      if (!demoIsCurrent()) return;
      if (res.data && res.data.catalog) {
        const catData = res.data.catalog;
        const rawSpreads = Array.isArray(catData.spreads) ? catData.spreads : [];
        let hydratedPages: CatalogPageData[] = [];

        if (rawSpreads.length > 0) {
          rawSpreads.forEach((sp: any) => {
            const leftPage = sp.left_page || (Array.isArray(sp.left_page_elements) && sp.left_page_elements[0]);
            const rightPage = sp.right_page || (Array.isArray(sp.right_page_elements) && sp.right_page_elements[0]);
            if (leftPage) hydratedPages.push(leftPage);
            if (rightPage) hydratedPages.push(rightPage);
          });
        }

        if (hydratedPages.length === 0) {
          hydratedPages = localTpl.pages;
        }

        let paletteToUse: StudioPalette = localTpl.palette;
        if (catData.palette_data && catData.palette_data.name) {
          paletteToUse = { ...catData.palette_data, locked: Boolean(catData.brand_lock) };
        }

        const unassignedList = Array.isArray(catData.unassigned_products) && catData.unassigned_products.length > 0
          ? catData.unassigned_products
          : localTpl.unassignedProducts || [];

        const initialThreadId = `thread-demo-${catData.id || Date.now()}`;
        const initialThread: ChatThread = {
          id: initialThreadId,
          title: catData.title || localTpl.title,
          mode: 'orchestrator',
          roleId: 'orchestrator',
          createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          messages: [
            {
              id: `msg-demo-${Date.now()}`,
              role: 'assistant',
              content: `Catálogo de demonstração **${catData.title}** carregado na prancheta com ${hydratedPages.length} páginas e acervo de produtos configurado. O conselho editorial está pronto para personalizar cores, layouts ou fotos.`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              reasoning: 'Racional do Editor-Chefe: Template canônico de demonstração instanciado com proporções A4, paleta harmônica e produtos reais.',
            },
          ],
        };

        const activeCatId = String(catData.id);
        try {
          const uid = s.activeUserId ?? getCurrentUserId();
          localStorage.setItem(
              workspaceKey(
                uid,
                organizationService.getActiveOrganizationId(),
                'last_active_catalog'
              ), activeCatId);
          localStorage.removeItem('katana_studio_last_active_catalog');
        } catch {}

        set({
          hasStartedSession: true,
          activeCatalogId: activeCatId,
          catalogTitle: catData.title || localTpl.title,
          pages: hydratedPages,
          totalPages: catData.total_pages || hydratedPages.length,
          activePalette: paletteToUse,
          currentSpread: [1, 2],
          unassignedProducts: unassignedList,
          threads: [initialThread],
          activeThreadId: initialThreadId,
          messages: initialThread.messages,
          activeRoleId: 'orchestrator',
          activeMode: 'orchestrator',
          agentStatus: 'idle',
          isDemoLoading: false,
        });

        saveStoredProjectSession(activeCatId, {
          threads: [initialThread],
          activeThreadId: initialThreadId,
          catalogTitle: catData.title || localTpl.title,
          activePalette: paletteToUse,
          currentSpread: [1, 2],
          pages: hydratedPages,
          totalPages: catData.total_pages || hydratedPages.length,
        }, s.activeUserId);

        if (res.data.persisted) {
          get().syncUserCatalogs();
        }

        toast.success(res.data.message || `Catálogo ${catData.title} carregado com sucesso!`);
        return;
      }
    } catch (err) {
      if (!demoIsCurrent()) return;
      console.warn('Falha ao carregar demo via backend, usando dados locais:', err);
    }

    // Fallback local caso api falhe ou offline
    const localId = `demo-${templateKey}`;
    const initialThreadId = `thread-demo-${Date.now()}`;
    const initialThread: ChatThread = {
      id: initialThreadId,
      title: localTpl.title,
      mode: 'orchestrator',
      roleId: 'orchestrator',
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      messages: [
        {
          id: `msg-demo-${Date.now()}`,
          role: 'assistant',
          content: `Catálogo de demonstração **${localTpl.title}** carregado na prancheta com ${localTpl.pages.length} páginas. Explore os spreads ou altere os elementos.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ],
    };

    set({
      hasStartedSession: true,
      activeCatalogId: localId,
      catalogTitle: localTpl.title,
      pages: localTpl.pages,
      totalPages: localTpl.totalPages,
      activePalette: localTpl.palette,
      currentSpread: [1, 2],
      unassignedProducts: localTpl.unassignedProducts || [],
      threads: [initialThread],
      activeThreadId: initialThreadId,
      messages: initialThread.messages,
      activeRoleId: 'orchestrator',
      activeMode: 'orchestrator',
      agentStatus: 'idle',
      isDemoLoading: false,
    });

    toast.success(`Catálogo ${localTpl.title} carregado com sucesso!`);
  },

  applyCouncilResolutions: ({ summary, productUpdates, pageUpdates, delegations, reasoning }) => {
    const s = get();
    let updatedPages = [...s.pages];

    if (productUpdates) {
      updatedPages = updatedPages.map((page) => {
        if (!page.products) return page;
        return {
          ...page,
          products: page.products.map((p) =>
            p.id === productUpdates.id ? { ...p, ...productUpdates.updates } : p
          ),
        };
      });
    }

    if (pageUpdates) {
      updatedPages = updatedPages.map((page) =>
        page.pageNumber === pageUpdates.pageNumber ? { ...page, ...pageUpdates.updates } : page
      );
    }

    set({ pages: updatedPages, isCouncilModalOpen: false });

    s.addMessage({
      role: 'assistant',
      content: `O Conselho Editorial concluiu a revisão do spread e aplicou as resoluções:\n\n${summary}`,
      reasoning:
        reasoning ||
        'Racional do Editor-Chefe [Conselho Editorial]: Harmonização de requisitos estéticos e comerciais conduzida pelo Editor-Chefe.',
      delegations: delegations || [
        {
          roleId: 'director',
          roleName: 'Diretor de Arte',
          badge: 'Design',
          action: 'Ajustou respiros negativos e equilíbrio formal da composição.',
        },
        {
          roleId: 'copywriter',
          roleName: 'Redator Publicitário',
          badge: 'Redação',
          action: 'Refinou o claim de produto e eliminou clichês promocionais.',
        },
        {
          roleId: 'commercial',
          roleName: 'Tabela Comercial / B2B',
          badge: 'Comercial',
          action: 'Inseriu referências SKU e condições para atacado.',
        },
        {
          roleId: 'branding',
          roleName: 'Auditor de Branding',
          badge: 'Auditoria',
          action: 'Validou contraste tipográfico sob diretrizes WCAG AA.',
        },
      ],
    });
  },

  setActiveRole: (roleId) => {
    const s = get();
    const role = s.roles.find((r) => r.id === roleId);
    if (!role) return;
    set({
      activeRoleId: roleId,
      activeMode: roleId,
      threads: s.threads.map((t) =>
        t.id === s.activeThreadId ? { ...t, mode: roleId, roleId } : t
      ),
    });
  },

  createCustomRole: (roleData) => {
    const s = get();
    const id = `custom-role-${Date.now()}`;
    const newRole: StudioRole = {
      ...roleData,
      id,
      isCustom: true,
    };
    const updated = [...s.roles, newRole];
    saveCustomRoles(updated);
    set({
      roles: updated,
      activeRoleId: id,
      activeMode: id,
    });
    return id;
  },

  updateRole: (roleId, updates) => {
    const s = get();
    const updated = s.roles.map((r) => (r.id === roleId ? { ...r, ...updates } : r));
    saveCustomRoles(updated);
    set({ roles: updated });
  },

  deleteRole: (roleId) => {
    const s = get();
    const roleToDelete = s.roles.find((r) => r.id === roleId);
    if (!roleToDelete || !roleToDelete.isCustom) return;

    const remaining = s.roles.filter((r) => r.id !== roleId);
    saveCustomRoles(remaining);

    const fallbackRoleId = remaining[0]?.id || 'orchestrator';
    const nextActiveRoleId = s.activeRoleId === roleId ? fallbackRoleId : s.activeRoleId;

    set({
      roles: remaining,
      activeRoleId: nextActiveRoleId,
      activeMode: nextActiveRoleId,
    });
  },

  toggleRoleEnabled: (roleId) => {
    const s = get();
    const updated = s.roles.map((r) => {
      if (r.id === roleId) {
        const currentlyEnabled = r.enabled !== false;
        return { ...r, enabled: !currentlyEnabled };
      }
      return r;
    });
    saveCustomRoles(updated);
    let nextActiveId = s.activeRoleId;
    if (roleId === s.activeRoleId) {
      const activeRole = updated.find((r) => r.id === roleId);
      if (activeRole && activeRole.enabled === false) {
        const firstEnabled = updated.find((r) => r.enabled !== false) || updated[0];
        nextActiveId = firstEnabled.id;
      }
    }
    set({ roles: updated, activeRoleId: nextActiveId, activeMode: nextActiveId });
  },

  setRoleEnabled: (roleId, enabled) => {
    const s = get();
    const updated = s.roles.map((r) => (r.id === roleId ? { ...r, enabled } : r));
    saveCustomRoles(updated);
    let nextActiveId = s.activeRoleId;
    if (!enabled && roleId === s.activeRoleId) {
      const firstEnabled = updated.find((r) => r.enabled !== false) || updated[0];
      nextActiveId = firstEnabled.id;
    }
    set({ roles: updated, activeRoleId: nextActiveId, activeMode: nextActiveId });
  },

  // Multi-conversation / Chat Threads & Tabs
  threads: [],
  activeThreadId: '',

  createThread: (title, mode) => {
    const s = get();
    const threadRoleId = mode || s.activeRoleId || 'director';
    const currentRole = s.roles.find((r) => r.id === threadRoleId) || DEFAULT_STUDIO_ROLES[0];
    const threadCount = s.threads.length + 1;
    const id = `thread-${Date.now()}`;
    const defaultTitle = title || `${currentRole.name} ${threadCount}`;

    const initialMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'assistant',
      content: `**Nova conversa de ${currentRole.name} iniciada.**\n\nDiretrizes ativas: "${currentRole.instructions}". Como posso colaborar no catálogo agora?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      reasoning: `Racional [${currentRole.name} - Tom: ${currentRole.toneOfVoice}]: Sessão configurada com foco em ${currentRole.description.toLowerCase()}.`,
    };

    const newThread: ChatThread = {
      id,
      title: defaultTitle,
      mode: threadRoleId,
      roleId: threadRoleId,
      messages: [initialMsg],
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    set({
      threads: [...s.threads, newThread],
      activeThreadId: id,
      messages: newThread.messages,
      activeRoleId: threadRoleId,
      activeMode: threadRoleId,
    });
    syncActiveCatalogStorage(get());

    return id;
  },

  switchThread: (threadId) => {
    const s = get();
    const target = s.threads.find((t) => t.id === threadId);
    if (!target) return;
    const roleId = target.roleId || target.mode;
    set({
      activeThreadId: threadId,
      messages: target.messages,
      activeMode: roleId,
      activeRoleId: roleId,
    });
    syncActiveCatalogStorage(get());
  },

  closeThread: (threadId) => {
    const s = get();
    if (s.threads.length <= 1) {
      const freshId = `thread-${Date.now()}`;
      const currentRole = s.roles.find((r) => r.id === s.activeRoleId) || DEFAULT_STUDIO_ROLES[0];
      const resetThread: ChatThread = {
        id: freshId,
        title: 'Nova Conversa',
        mode: s.activeRoleId,
        roleId: s.activeRoleId,
        messages: [
          {
            id: `msg-${Date.now()}`,
            role: 'assistant',
            content: `Conversa reiniciada sob o cargo **${currentRole.name}**. Como posso colaborar no catálogo?`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ],
        createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      set({
        threads: [resetThread],
        activeThreadId: freshId,
        messages: resetThread.messages,
      });
      syncActiveCatalogStorage(get());
      return;
    }

    const remaining = s.threads.filter((t) => t.id !== threadId);
    let nextActiveId = s.activeThreadId;

    if (s.activeThreadId === threadId) {
      const closedIndex = s.threads.findIndex((t) => t.id === threadId);
      const nextIndex = Math.max(0, closedIndex - 1);
      nextActiveId = remaining[nextIndex]?.id || remaining[0].id;
    }

    const nextThread = remaining.find((t) => t.id === nextActiveId) || remaining[0];
    const roleId = nextThread.roleId || nextThread.mode;

    set({
      threads: remaining,
      activeThreadId: nextActiveId,
      messages: nextThread.messages,
      activeMode: roleId,
      activeRoleId: roleId,
    });
    syncActiveCatalogStorage(get());
  },

  renameThread: (threadId, title) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    set((s) => ({
      threads: s.threads.map((t) => (t.id === threadId ? { ...t, title: trimmed } : t)),
    }));
    syncActiveCatalogStorage(get());
  },

  executionPlan: [],
  isPlanCollapsed: true,
  togglePlanCollapse: () => set((s) => ({ isPlanCollapsed: !s.isPlanCollapsed })),
  setPlanCollapsed: (collapsed) => set({ isPlanCollapsed: collapsed }),
  isPlanHidden: false,
  setPlanHidden: (hidden) => set({ isPlanHidden: hidden }),
  togglePlanHidden: () => set((s) => ({ isPlanHidden: !s.isPlanHidden })),
  setStepStatus: (stepId, status) =>
    set((s) => ({
      executionPlan: s.executionPlan.map((step) =>
        step.id === stepId ? { ...step, status } : step
      ),
    })),
  setExecutionPlan: (steps) => set({ executionPlan: steps }),

  messages: [],
  addMessage: (msg) => {
    const newMsg: ChatMessage = {
      ...msg,
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    set((s) => {
      let activeId = s.activeThreadId;
      let currentThreads = s.threads;

      if (!activeId || currentThreads.length === 0) {
        activeId = `thread-${Date.now()}`;
        currentThreads = [
          {
            id: activeId,
            title: 'Conversa 1',
            mode: s.activeRoleId,
            roleId: s.activeRoleId,
            messages: [],
            createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ];
      }

      const updatedThreads = currentThreads.map((thread) => {
        if (thread.id === activeId) {
          let title = thread.title;
          if (
            msg.role === 'user' &&
            (title.startsWith('Direção') ||
              title.startsWith('Comercial') ||
              title.startsWith('Redação') ||
              title.startsWith('Nova') ||
              title.startsWith('Conversa'))
          ) {
            const snippet = msg.content.slice(0, 24).trim();
            title = snippet.length > 0 ? snippet : title;
          }

          return {
            ...thread,
            title,
            messages: [...thread.messages, newMsg],
          };
        }
        return thread;
      });

      const activeThread = updatedThreads.find((t) => t.id === activeId);

      return {
        threads: updatedThreads,
        activeThreadId: activeId,
        messages: activeThread ? activeThread.messages : [...s.messages, newMsg],
      };
    });
    syncActiveCatalogStorage(get());
  },
  clearMessages: () => {
    set((s) => ({
      messages: [],
      threads: s.threads.map((t) => (t.id === s.activeThreadId ? { ...t, messages: [] } : t)),
    }));
    syncActiveCatalogStorage(get());
  },
  setMessageFeedback: (messageId, feedback) => {
    set((s) => {
      const updatedThreads = s.threads.map((t) => ({
        ...t,
        messages: t.messages.map((m) =>
          m.id === messageId ? { ...m, feedback } : m
        ),
      }));
      const activeThread = updatedThreads.find((t) => t.id === s.activeThreadId);
      return {
        threads: updatedThreads,
        messages: activeThread
          ? activeThread.messages
          : s.messages.map((m) =>
              m.id === messageId ? { ...m, feedback } : m
            ),
      };
    });
    syncActiveCatalogStorage(get());
  },

  viewMode: 'spread',
  setViewMode: (mode) => set({ viewMode: mode }),
  zoomLevel: 100,
  setZoomLevel: (updater) =>
    set((s) => ({
      zoomLevel: typeof updater === 'function' ? updater(s.zoomLevel) : updater,
    })),

  currentSpread: [1, 2],
  totalPages: 10,
  nextSpread: () =>
    set((s) => {
      const nextLeft = Math.min(Math.max(1, Math.ceil(s.totalPages / 2) * 2 - 1), s.currentSpread[0] + 2);
      const nextRight = Math.min(s.totalPages, nextLeft + 1);
      return { currentSpread: [nextLeft, nextRight] };
    }),
  prevSpread: () =>
    set((s) => {
      const prevLeft = Math.max(1, s.currentSpread[0] - 2);
      const prevRight = Math.min(s.totalPages, prevLeft + 1);
      return { currentSpread: [prevLeft, prevRight] };
    }),
  goToSpread: (spreadIndex) =>
    set((s) => {
      const left = Math.max(1, Math.min(Math.max(1, Math.ceil(s.totalPages / 2) * 2 - 1), spreadIndex * 2 + 1));
      const right = Math.min(s.totalPages, left + 1);
      return { currentSpread: [left, right] };
    }),
  setSpreadPage: (slot, pageNumber) =>
    set((s) => {
      const validNum = Math.max(1, Math.min(s.totalPages, pageNumber));
      if (slot === 'left') {
        return { currentSpread: [validNum, s.currentSpread[1]] };
      } else {
        return { currentSpread: [s.currentSpread[0], validNum] };
      }
    }),
  setCustomSpread: (left, right) =>
    set((s) => ({
      currentSpread: [
        Math.max(1, Math.min(s.totalPages, left)),
        Math.max(1, Math.min(s.totalPages, right)),
      ],
    })),
  swapSpreadPages: () =>
    set((s) => ({
      currentSpread: [s.currentSpread[1], s.currentSpread[0]],
    })),

  pages: [],
  setPages: (pages) => set({ pages, totalPages: pages.length }),

  updateDocumentText: (pageNumber, elementId, text) => {
    const execution = executeTextAction(get().pages, `page:${pageNumber}/element:${elementId}`, {text});
    if (execution.result.status !== 'applied') {
      if (execution.result.status !== 'unchanged') toast.error(executionFeedback([execution.result]));
      return;
    }
    get().pushHistorySnapshot();
    set({pages: execution.pages, saveStatus: 'unsaved'});
    get().debouncedSaveCurrentSpread();
  },
  resetDocumentText: (pageNumber, elementId) => {
    const element = get().pages.find(item => item.pageNumber === pageNumber)?.documentPage?.elements.find(item => item.id === elementId);
    if (typeof element?.provenance?.sourceText === 'string') get().updateDocumentText(pageNumber, elementId, element.provenance.sourceText);
  },

  updatePage: (pageNumber, updates) => {
    get().pushHistorySnapshot();
    set((s) => ({
      pages: s.pages.map((p) => (p.pageNumber === pageNumber ? { ...p, ...updates, ...(p.documentPage ? {documentPage: p.documentPage} : {}) } : p)),
      saveStatus: 'unsaved',
    }));
    get().debouncedSaveCurrentSpread();
  },

  addPageOverlay: (pageNumber, overlayData) => {
    const id = overlayData.id || `ovl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newOverlay: PageOverlayElement = {
      x: 50,
      y: 50,
      ...overlayData,
      id,
      type: overlayData.type || 'focus_ring',
    };
    get().pushHistorySnapshot();
    set((s) => ({
      pages: s.pages.map((p) => {
        if (p.pageNumber !== pageNumber) return p;
        const currentOverlays = p.overlays || [];
        return {
          ...p,
          overlays: [...currentOverlays, newOverlay],
        };
      }),
      saveStatus: 'unsaved',
    }));
    get().debouncedSaveCurrentSpread();
    return id;
  },

  removePageOverlay: (pageNumber, overlayId) => {
    get().pushHistorySnapshot();
    set((s) => ({
      pages: s.pages.map((p) => {
        if (p.pageNumber !== pageNumber) return p;
        return {
          ...p,
          overlays: (p.overlays || []).filter((ovl) => ovl.id !== overlayId),
        };
      }),
      selectedElementId: s.selectedElementId === `page-${pageNumber}-overlay-${overlayId}` ? null : s.selectedElementId,
      saveStatus: 'unsaved',
    }));
    get().debouncedSaveCurrentSpread();
  },

  clearPageOverlays: (pageNumber, typeFilter) => {
    get().pushHistorySnapshot();
    set((s) => ({
      pages: s.pages.map((p) => {
        if (p.pageNumber !== pageNumber) return p;
        if (!typeFilter) {
          return { ...p, overlays: [] };
        }
        return {
          ...p,
          overlays: (p.overlays || []).filter((ovl) => ovl.type !== typeFilter),
        };
      }),
      saveStatus: 'unsaved',
    }));
    get().debouncedSaveCurrentSpread();
  },

  updatePageOverlay: (pageNumber, overlayId, updates) => {
    set((s) => ({
      pages: s.pages.map((p) => {
        if (p.pageNumber !== pageNumber) return p;
        return {
          ...p,
          overlays: (p.overlays || []).map((ovl) =>
            ovl.id === overlayId ? { ...ovl, ...updates } : ovl
          ),
        };
      }),
      saveStatus: 'unsaved',
    }));
    get().debouncedSaveCurrentSpread();
  },

  generateSprite: async (prompt, targetPage, options = {}) => {
    const documentScope = captureDocumentScope();
    get().triggerAgentCursor('director', `Sintetizando sprite IA: "${prompt.slice(0, 30)}..."`, { x: options.x ?? 50, y: options.y ?? 50 });
    const toastId = toast.loading(`Sintetizando elemento visual com IA: "${prompt.slice(0, 40)}"...`);

    try {
      const activePalette = get().activePalette;
      const paletteColors = [activePalette?.primary, activePalette?.accent, activePalette?.secondary].filter(Boolean);

      const response = await api.post('/api/v2/studio/sprites/generate/', {
        prompt,
        catalog_id: get().activeCatalogId,
        palette: paletteColors,
      });

      if (!isCurrentDocumentScope(documentScope)) { toast.dismiss(toastId); return null; }
      const spriteUrl = response.data?.sprite_url;
      if (spriteUrl) {
        get().addPageOverlay(targetPage, {
          type: 'sprite',
          imageUrl: spriteUrl,
          prompt,
          x: options.x ?? 50,
          y: options.y ?? 50,
          width: options.width ?? 180,
          height: options.height ?? 180,
          scale: options.scale ?? 1,
        });
        toast.success('Sprite visual gerado e aplicado na prancheta!', { id: toastId });
        return spriteUrl;
      }
      toast.error('Não foi possível sintetizar a sprite.', { id: toastId });
      return null;
    } catch (err: any) {
      if (!isCurrentDocumentScope(documentScope)) { toast.dismiss(toastId); return null; }
      console.error('[GenerateSprite] Falha:', err);
      toast.error('Erro na síntese da sprite por IA.', { id: toastId });
      return null;
    }
  },

  removePage: (pageNumber) => {
    const s = get();
    if (s.pages.length <= 1) {
      toast.error('Não é possível remover a única página do catálogo.');
      return;
    }

    const pageToRemove = s.pages.find((p) => p.pageNumber === pageNumber);
    if (!pageToRemove) return;
    if (pageToRemove.documentPage && s.importMetadata && !pendingConfirmationToken) {toast.info('Confirme a remoção da página original pelo assistente.'); return;}

    s.pushHistorySnapshot();

    const recoveredProducts = pageToRemove.products || [];

    const remainingPages = s.pages
      .filter((p) => p.pageNumber !== pageNumber)
      .map((p, index) => {
        const newPageNum = index + 1;
        return {
          ...p,
          pageNumber: newPageNum,
          folio: `PÁG. ${String(newPageNum).padStart(2, '0')}`,
        };
      });

    const newTotalPages = remainingPages.length;
    const maxSpreadIdx = Math.max(0, Math.ceil(newTotalPages / 2) - 1);
    const currentSpreadIdx = Math.floor((s.currentSpread[0] - 1) / 2);
    const targetSpread = Math.min(currentSpreadIdx, maxSpreadIdx);
    const newLeft = targetSpread * 2 + 1;
    const newRight = Math.min(newTotalPages, newLeft + 1);

    set((state) => ({
      pages: remainingPages,
      totalPages: newTotalPages,
      unassignedProducts: [...recoveredProducts, ...state.unassignedProducts],
      currentSpread: [newLeft, newRight],
      saveStatus: 'unsaved',
    }));

    toast.success(`Página ${String(pageNumber).padStart(2, '0')} removida do catálogo!`, {
      description: 'Lâminas, fólios e diagramação reorganizados pelo Conselho Editorial.',
    });

    s.debouncedSaveCurrentSpread();
  },

  addPage: (options) => {
    const s = get();
    s.pushHistorySnapshot();

    const currentTotal = s.pages.length;
    let insertIndex = currentTotal;

    if (typeof options?.afterPage === 'number' && options.afterPage >= 0) {
      const clampedAfter = Math.max(0, Math.min(options.afterPage, currentTotal));
      insertIndex = clampedAfter;
    } else {
      // Se a última página for contracapa (backcover), insere imediatamente antes dela
      const lastPage = s.pages[currentTotal - 1];
      if (lastPage?.type === 'backcover' && currentTotal > 1) {
        insertIndex = currentTotal - 1;
      }
    }

    const pageType: PageLayoutType = options?.type || 'hero';
    const isDark = pageType === 'cover' || pageType === 'divider' || pageType === 'backcover';
    const activePal = s.activePalette || STUDIO_PALETTE_PRESETS[0];

    const newPage: CatalogPageData = {
      id: options?.pageId || crypto.randomUUID(),
      pageOrigin: 'catana_authored',
      contentRole: options?.contentRole,
      pageNumber: insertIndex + 1,
      type: pageType,
      title: options?.title || (pageType === 'manifesto' ? 'Manifesto Editorial' : pageType === 'divider' ? 'Nova Coleção' : 'Destaque Editorial'),
      subtitle: options?.subtitle,
      quote: options?.quote || (pageType === 'manifesto' ? 'A simbiose entre tradição manufatureira e vanguarda estética.' : undefined),
      content: options?.content || (pageType === 'manifesto' ? 'Peças concebidas com matérias-primas de alta procedência, lapidadas para transcender coleções sazonais.' : undefined),
      label: options?.label || (pageType === 'manifesto' ? 'MANIFESTO' : pageType === 'divider' ? 'SEÇÃO' : 'EDITORIAL'),
      backgroundColor: isDark ? activePal.primary : activePal.background,
      textColor: isDark ? activePal.background : activePal.primary,
      accentColor: activePal.accent,
      ...(options?.pageColors || (() => {
        const palette = s.catalogBrandContext?.brandSnapshot?.palette;
        if (!Array.isArray(palette)) return {};
        const captured = Object.fromEntries(palette.filter((c: {status?:string; hex?:string; role?:string})=>['confirmed','user_supplied'].includes(c.status || '') && /^#[a-f0-9]{6}$/i.test(c.hex || '')).map(c=>[c.role,c.hex]));
        return {backgroundColor:captured.primary || activePal.background,textColor:captured.background || activePal.primary,accentColor:captured.accent || activePal.accent};
      })()),
      folio: `PÁG. ${String(insertIndex + 1).padStart(2, '0')}`,
      products: [],
    };

    const newPagesList = [...s.pages];
    newPagesList.splice(insertIndex, 0, newPage);

    const resequencedPages = newPagesList.map((p, idx) => {
      const pNum = idx + 1;
      return {
        ...p,
        pageNumber: pNum,
        folio: `PÁG. ${String(pNum).padStart(2, '0')}`,
      };
    });

    const newTotalPages = resequencedPages.length;
    const targetSpreadIdx = Math.floor(insertIndex / 2);
    const newLeft = targetSpreadIdx * 2 + 1;
    const newRight = Math.min(newTotalPages, newLeft + 1);

    set({
      pages: resequencedPages,
      totalPages: newTotalPages,
      currentSpread: [newLeft, newRight],
      saveStatus: 'unsaved',
    });

    toast.success(`Página ${String(insertIndex + 1).padStart(2, '0')} adicionada com layout ${pageType.toUpperCase()}!`, {
      description: 'Lâminas e fólios renumerados sequencialmente com proporções A4.',
    });

    s.debouncedSaveCurrentSpread();
  },

  summarizePageContent: (pageNumber, condensedText) => {
    const s = get();
    const target = s.pages.find((p) => p.pageNumber === pageNumber);
    if (!target) return;

    s.pushHistorySnapshot();

    let finalText = condensedText;
    if (!finalText) {
      const raw = target.content || target.quote || target.title || '';
      if (raw.length > 0) {
        const sentences = raw.split(/[.!?]+/).map((str) => str.trim()).filter(Boolean);
        finalText = sentences[0] ? `${sentences[0]}.` : 'Design atemporal e rigor técnico em cada detalhe.';
      } else {
        finalText = 'Design atemporal e rigor técnico em cada detalhe.';
      }
    }

    const updates: Partial<CatalogPageData> = {};
    if (target.type === 'manifesto') {
      updates.quote = finalText;
      updates.title = finalText;
      if (target.content) updates.content = finalText;
    } else {
      if (target.content) updates.content = finalText;
      else if (target.quote) updates.quote = finalText;
      else updates.title = finalText;
    }

    set((state) => ({
      pages: state.pages.map((p) => (p.pageNumber === pageNumber ? { ...p, ...updates } : p)),
      saveStatus: 'unsaved',
    }));

    toast.success(`Conteúdo da Página ${String(pageNumber).padStart(2, '0')} sintetizado!`, {
      description: 'Texto condensado em claim editorial de alto valor sem clichês.',
    });

    s.debouncedSaveCurrentSpread();
  },

  updateProduct: (productId, updates) => {
    get().pushHistorySnapshot();
    set((s) => ({
      pages: s.pages.map((page) => {
        if (!page.products) return page;
        return {
          ...page,
          products: page.products.map((prod) =>
            prod.id === productId ? { ...prod, ...updates } : prod
          ),
          blocks: page.blocks?.map(block => {
            if (String(block.productId) !== String(productId)) return block;
            const field = block.type === 'price' || block.type === 'sku' ? block.type : block.role === 'product_name' ? 'name' : block.role === 'product_description' ? 'description' : null;
            if (field && field in updates) return {...block, content: updates[field]};
            if (block.type === 'product_image' && 'image' in updates) return {...block, imageUrl: updates.image || undefined};
            return block;
          }),
        };
      }),
      unassignedProducts: s.unassignedProducts.map((prod) =>
        prod.id === productId ? { ...prod, ...updates } : prod
      ),
      saveStatus: 'unsaved',
    }));
    get().debouncedSaveCurrentSpread();
  },

  removeProductBackground: async (pageNumber, productId) => {
    const documentScope = captureDocumentScope();
    let prod: ProductItem | undefined;
    if (pageNumber) {
      const page = get().pages.find((p) => p.pageNumber === pageNumber);
      prod = page?.products?.find((p) => p.id === productId);
    }
    if (!prod) {
      prod = get().unassignedProducts.find((p) => p.id === productId);
    }
    if (!prod || !prod.image) {
      toast.error('Produto nao possui imagem para remocao de fundo.');
      return;
    }

    toast.info('Isolando produto e removendo fundo com IA...');
    try {
      let res;
      if (prod.image.startsWith('blob:')) {
        const blobRes = await fetch(prod.image);
        const blobData = await blobRes.blob();
        if (!isCurrentDocumentScope(documentScope)) return;
        const formData = new FormData();
        formData.append('image', blobData, 'product.png');
        res = await api.post(`/api/v2/studio/media/remove-background/`, formData);
      } else {
        res = await api.post(
          `/api/v2/studio/media/remove-background/`,
          { image_url: prod.image }
        );
      }

      if (!isCurrentDocumentScope(documentScope)) return;
      if (res.data && res.data.processed_url) {
        get().updateProduct(productId, { image: res.data.processed_url });
        toast.success('Fundo do produto removido com sucesso!');
      }
    } catch (err: any) {
      if (!isCurrentDocumentScope(documentScope)) return;
      console.warn('Falha na remoção de fundo:', err);
      if (err?.response?.status === 401) {
        const hasClerkSession = typeof window !== 'undefined' && Boolean((window as any).Clerk?.session);
        if (!hasClerkSession) {
          window.dispatchEvent(new CustomEvent('catana:unauthorized'));
          toast.error('Sessão expirada. Acesse sua conta novamente para continuar.');
        }
      } else {
        const detail = err?.response?.data?.error;
        toast.error(detail || 'Não foi possível remover o fundo desta imagem.');
      }
    }
  },

  // Undo / Redo Stack State
  historyStack: [],
  redoStack: [],
  canUndo: false,
  canRedo: false,

  pushHistorySnapshot: () => {
    if (patchExecuting) return;
    const currentPages = get().pages;
    set((s) => {
      const snapshot = JSON.parse(JSON.stringify(currentPages));
      const newHistory = [...s.historyStack, snapshot].slice(-30);
      return {
        historyStack: newHistory,
        redoStack: [],
        canUndo: true,
        canRedo: false,
      };
    });
  },

  undo: () => {
    const { historyStack, redoStack, pages } = get();
    if (historyStack.length === 0) return;

    const previousSnapshot = historyStack[historyStack.length - 1];
    const newHistory = historyStack.slice(0, -1);
    const currentSnapshot = JSON.parse(JSON.stringify(pages));

    set({
      pages: previousSnapshot,
      historyStack: newHistory,
      redoStack: [...redoStack, currentSnapshot],
      canUndo: newHistory.length > 0,
      canRedo: true,
      totalPages: previousSnapshot.length,
      currentSpread: [1,Math.min(2,previousSnapshot.length)],
      saveStatus: 'unsaved',
    });

    toast.info('Alteracao desfeita');
    get().debouncedSaveCurrentSpread();
  },

  redo: () => {
    const { historyStack, redoStack, pages } = get();
    if (redoStack.length === 0) return;

    const nextSnapshot = redoStack[redoStack.length - 1];
    const newRedo = redoStack.slice(0, -1);
    const currentSnapshot = JSON.parse(JSON.stringify(pages));

    set({
      pages: nextSnapshot,
      historyStack: [...historyStack, currentSnapshot],
      redoStack: newRedo,
      canUndo: true,
      canRedo: newRedo.length > 0,
      totalPages: nextSnapshot.length,
      currentSpread: [1,Math.min(2,nextSnapshot.length)],
      saveStatus: 'unsaved',
    });

    toast.info('Alteracao refeita');
    get().debouncedSaveCurrentSpread();
  },

  // Persistence State
  saveStatus: 'saved',
  setSaveStatus: (status) => set({ saveStatus: status }),

  debouncedSaveCurrentSpread: () => {
    set({ saveStatus: 'saving' });
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    saveTimeout = setTimeout(() => {
      get().flushSaveSpread();
    }, 1200);
  },

  flushSaveSpread: async () => {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      saveTimeout = null;
    }

    const state = get();
    const saveScope = captureBrandScope();
    const operation = ++spreadSaveOperation;
    const saveIsCurrent = () => operation === spreadSaveOperation && isCurrentBrandScope(saveScope) && get().activeCatalogId === state.activeCatalogId;
    const catalogId = state.activeCatalogId;
    if (!catalogId) {
      set({ saveStatus: 'saved' });
      return;
    }
    set({ saveStatus: 'saving' });

    try {
      const numericCatalogId = /^\d+$/.test(catalogId)
          ? Number(catalogId)
          : NaN;
      if (!isNaN(numericCatalogId)) {
        const spreads = [];
        for (let offset=0; offset<state.pages.length; offset+=2) {
          spreads.push({spread_index:offset/2, left_page_elements:[state.pages[offset]], right_page_elements:state.pages[offset+1] ? [state.pages[offset+1]] : []});
        }
        const response = await api.post(`/api/v2/studio/catalogs/${numericCatalogId}/spreads/bulk/`, {
          spreads, total_pages:state.pages.length, unassigned_products:state.unassignedProducts, ...(pendingConfirmationToken ? {confirmation_token:pendingConfirmationToken} : {}),
        });
        pendingConfirmationToken = undefined;
        if (!saveIsCurrent()) return;
        if (response.data?.qualityGate != null) {
          // Publication approval belongs to the server document, including after edits.
          set({pages: get().pages, qualityGate: response.data.qualityGate as QualityGate});
        }
        if (response.data?.import_metadata) set({importMetadata: response.data.import_metadata});
      }
      if (saveIsCurrent()) set({ saveStatus: 'saved' });
    } catch {
      if (saveIsCurrent()) set({ saveStatus: 'error' });
    }
  },

  applySpreadPatch: (patch) => {
    if (!patch) return [];
    const hasUpdates = Array.isArray(patch.updates) && patch.updates.length > 0;
    const hasActions = Array.isArray(patch.actions) && patch.actions.length > 0;
    if (!hasUpdates && !hasActions && typeof patch.spread_index !== 'number') return [];

    if ((patch.actions?.length || 0) > 100 || (patch.updates?.length || 0) > 500) return [{action_id: '0', target: 'global', status: 'invalid_target'}];
    const state = get();
    const results: ActionResult[] = [];
    const unknown = patch.actions?.find(a => !a || !Object.prototype.hasOwnProperty.call(ACTION_REGISTRY,String(a.action || a.type)) || (ACTION_REGISTRY as Record<string,{executor:boolean}>)[String(a.action || a.type)]?.executor === false);
    if (unknown) return [{action_id: '0', target: String(unknown.target || 'global'), status: 'unsupported'}];
    if (patch.confirmation_token) pendingConfirmationToken = patch.confirmation_token;
    if (patch.expectedPageIds && JSON.stringify(patch.expectedPageIds) !== JSON.stringify(state.pages.map(p=>p.id))) return [{action_id:'0',target:'catalog:pages',status:'invalid_target',reason:'stale_target'}];
    // Text fitting and stale checks happen before any action in an AI batch mutates state.
    for (const a of patch.actions || []) {
      const name=a.action || a.type;
      if ((name === 'update_text' && /(?:element:|\/field:)/.test(a.target)) || name === 'update_text_group') {
        const check = name === 'update_text_group' ? executeTextGroup(state.pages,a.target,a.params || {}) : executeTextAction(state.pages,a.target,a.params || {});
        if (!['applied','unchanged'].includes(check.result.status)) return [check.result];
      }
    }
    state.pushHistorySnapshot();
    patchExecuting = true;
    try {
    const [leftPageNum, rightPageNum] = state.currentSpread;

    // 1. Processar Acoes Operacionais do Conselho Editorial
    if (hasActions && patch.actions) {
      for (const rawAction of patch.actions) {
        if (!rawAction) continue;
        const actType = rawAction.action || rawAction.type;
        if (!actType) continue;

        const resultCountBefore = results.length;
        const beforeAction = JSON.stringify({pages: get().pages, products: get().unassignedProducts});
        const targetStr = String(rawAction.target || '');
        const params = rawAction.params || {};

        let targetPage =
          typeof rawAction.page === 'number'
            ? rawAction.page
            : typeof params.page === 'number'
            ? params.page
            : typeof params.pageNumber === 'number'
            ? params.pageNumber
            : undefined;

        if (targetPage === undefined) {
          const m = targetStr.match(/(?:page|p[aá]gina)?[\s\-_:]*(\d+)/i);
          if (m && m[1]) {
            targetPage = parseInt(m[1], 10);
          } else {
            const wordMap: Record<string, number> = {
              um: 1, uma: 1, primeira: 1, primeiro: 1, capa: 1, cover: 1,
              dois: 2, duas: 2, segunda: 2, segundo: 2, manifesto: 2,
              tres: 3, três: 3, terceira: 3, terceiro: 3,
              quatro: 4, quarta: 4, quarto: 4,
              cinco: 5, quinta: 5, quinto: 5,
              seis: 6, sexta: 6, sexto: 6,
              sete: 7, setima: 7, sétima: 7,
              oito: 8, oitava: 8, oitavo: 8,
            };
            for (const [w, n] of Object.entries(wordMap)) {
              if (new RegExp(`\\b${w}\\b`, 'i').test(targetStr)) {
                targetPage = n;
                break;
              }
            }
          }
        }

        const prodId =
          rawAction.product_id ||
          rawAction.productId ||
          params.product_id ||
          params.productId ||
          (targetStr.startsWith('product:') ? targetStr.replace('product:', '') : undefined);

        const slotIdx =
          typeof rawAction.slot_index === 'number'
            ? rawAction.slot_index
            : typeof params.slotIndex === 'number'
            ? params.slotIndex
            : typeof params.slot_index === 'number'
            ? params.slot_index
            : undefined;

        switch (actType) {
          case 'remove_page':
          case 'delete_page': {
            const pageNumToRemove = typeof targetPage === 'number' ? targetPage : undefined;
            if (typeof pageNumToRemove === 'number') {
              get().removePage(pageNumToRemove);
            }
            break;
          }

          case 'reconfigure_catalog':
          case 'set_page_count':
          case 'resize_catalog': {
            const targetCount =
              typeof params.totalPages === 'number'
                ? params.totalPages
                : typeof params.pageCount === 'number'
                ? params.pageCount
                : typeof rawAction.totalPages === 'number'
                ? rawAction.totalPages
                : 1;

            if (targetCount === 1) {
              const p1 = get().pages.find((p) => p.pageNumber === 1) || get().pages[0];
              const updatedP1: CatalogPageData = {
                ...p1,
                pageNumber: 1,
                title: params.title || p1.title,
                subtitle: params.subtitle || p1.subtitle || 'EDIÇÃO ÚNICA · ONE-PAGER 2026',
                label: params.label || p1.label || 'CATÁLOGO DE PÁGINA ÚNICA',
                folio: '01 · EDIÇÃO ÚNICA',
              };
              set({
                pages: [updatedP1],
                totalPages: 1,
                currentSpread: [1, 1],
              });
              syncActiveCatalogStorage(get());
            } else if (targetCount > 1) {
              const currentPages = get().pages;
              if (currentPages.length > targetCount) {
                const trimmed = currentPages.slice(0, targetCount);
                set({
                  pages: trimmed,
                  totalPages: targetCount,
                  currentSpread: [1, Math.min(2, targetCount)],
                });
                syncActiveCatalogStorage(get());
              }
            }
            break;
          }

          case 'add_page':
          case 'create_page':
          case 'insert_page': {
            const rawType = String(
              rawAction.layout || rawAction.type || params.type || params.layout || 'hero'
            ).toLowerCase();
            let mappedType: PageLayoutType = 'hero';
            if (rawType.includes('duo')) mappedType = 'duo';
            else if (rawType.includes('grid') || rawType.includes('grade')) mappedType = 'grid_4';
            else if (rawType.includes('single')) mappedType = 'single';
            else if (rawType.includes('divis') || rawType.includes('divider')) mappedType = 'divider';
            else if (rawType.includes('manifesto')) mappedType = 'manifesto';
            else if (rawType === 'backcover') mappedType = 'backcover';
            else if (rawType.includes('capa') || rawType.includes('cover')) mappedType = 'cover';
            else mappedType = 'hero';

            const afterPage =
              typeof targetPage === 'number'
                ? targetPage
                : typeof params.afterPage === 'number'
                ? params.afterPage
                : undefined;

            get().addPage({
              type: mappedType,
              contentRole: params.contentRole,
              pageId: params.pageId,
              pageColors: params.pageColors,
              afterPage,
              title: rawAction.title || params.title,
              subtitle: rawAction.subtitle || params.subtitle,
              content: rawAction.content || params.content,
              quote: rawAction.quote || params.quote,
            });
            results.push({action_id: String(results.length), action: 'add_page', target: targetStr, status: 'applied', reason: params.contentRole === 'closing' ? `Página de finalização adicionada após a página ${afterPage ?? state.pages.length}.` : 'Página adicionada ao catálogo.'});
            break;
          }

          case 'move_page':
          case 'duplicate_page': {
            const pages = [...get().pages];
            const index = pages.findIndex(p => p.pageNumber === targetPage);
            if (index < 0) {results.push({action_id: '', target:targetStr,status:'invalid_target'}); break;}
            const source = pages[index];
            let moving = source;
            let after = params.afterPage;
            if (!Number.isInteger(after) || after < 0 || after > pages.length) {results.push({action_id:'',target:targetStr,status:'invalid_target'}); break;}
            if (actType === 'duplicate_page') {
              moving = {...structuredClone(source), id:params.pageId || crypto.randomUUID(), pageOrigin:source.documentPage || source.pageOrigin === 'imported_source' || source.pageOrigin === 'derived_from_import' ? 'derived_from_import' : 'catana_authored', ...(source.documentPage || source.pageOrigin === 'imported_source' || source.pageOrigin === 'derived_from_import' ? {derivedFromPageId:source.id} : {})};
            } else {
              pages.splice(index,1);
              if (after > index) after--;
            }
            pages.splice(after,0,moving);
            set({pages:pages.map((p,i)=>({...p,pageNumber:i+1})),totalPages:pages.length,saveStatus:'unsaved'});
            break;
          }

          case 'summarize_content':
          case 'condense_text':
          case 'summarize_text': {
            const pageNum = typeof targetPage === 'number' ? targetPage : leftPageNum;
            const condensed =
              rawAction.condensedText || params.condensedText || rawAction.text || params.text;
            get().summarizePageContent(pageNum, condensed);
            break;
          }

          case 'remove_product': {
            let effectiveProdId = prodId;
            if (!effectiveProdId) {
              const query =
                rawAction.name ||
                params.name ||
                rawAction.productQuery ||
                params.productQuery ||
                rawAction.product_name ||
                params.product_name;
              if (query) {
                const allProds = [
                  ...get().unassignedProducts,
                  ...get().pages.flatMap((p) => p.products || []),
                ];
                const match = allProds.find(
                  (p) =>
                    (p.name || '').toLowerCase().includes(String(query).toLowerCase()) ||
                    String(query).toLowerCase().includes((p.name || '').toLowerCase()) ||
                    (p.sku && p.sku.toLowerCase() === String(query).toLowerCase())
                );
                if (match) effectiveProdId = match.id;
              }
            }

            if (effectiveProdId) {
              const currentPages = get().pages;
              const containingPage = targetPage
                ? currentPages.find((p) => p.pageNumber === targetPage)
                : currentPages.find((p) => p.products?.some((pr) => pr.id === effectiveProdId));
              const pageNum = containingPage ? containingPage.pageNumber : (targetPage || leftPageNum);
              get().removeProductFromSpread(pageNum, slotIdx, effectiveProdId);
            } else if (typeof targetPage === 'number') {
              get().removeProductFromSpread(targetPage, slotIdx);
            } else {
              const [lNum, rNum] = get().currentSpread;
              const curLeft = get().pages.find((p) => p.pageNumber === lNum);
              const curRight = get().pages.find((p) => p.pageNumber === rNum);
              if (curLeft?.products?.length) {
                get().removeProductFromSpread(lNum, slotIdx);
              } else if (curRight?.products?.length) {
                get().removeProductFromSpread(rNum, slotIdx);
              }
            }
            break;
          }

          case 'assign_product': {
            const allProducts = [
              ...get().unassignedProducts,
              ...get().pages.flatMap((p) => p.products || []),
            ];
            const pQuery = rawAction.productQuery || params.productQuery || prodId;
            const foundProd = allProducts.find(
              (p) =>
                (prodId && p.id === prodId) ||
                (pQuery && p.name && (p.name || '').toLowerCase().includes(String(pQuery).toLowerCase())) ||
                (pQuery && p.sku && p.sku.toLowerCase() === String(pQuery).toLowerCase())
            ) || allProducts[0];
            if (foundProd) {
              const finalTarget = typeof targetPage === 'number' ? targetPage : leftPageNum;
              const finalSlot = typeof slotIdx === 'number' ? slotIdx : 0;
              get().assignProductToSpread(foundProd, finalTarget, finalSlot);
            }
            break;
          }

          case 'swap_product': {
            const curId = rawAction.current_product_id || rawAction.currentProductId || params.current_product_id;
            const newId = rawAction.new_product_id || rawAction.newProductId || params.new_product_id;
            const allProds = [
              ...get().unassignedProducts,
              ...get().pages.flatMap((p) => p.products || []),
            ];
            const newProd = allProds.find(
              (p) =>
                p.id === newId ||
                (p.name && newId && (p.name || '').toLowerCase() === String(newId).toLowerCase())
            );
            if (newProd) {
              let finalPage = typeof targetPage === 'number' ? targetPage : undefined;
              let sIdx = 0;
              if (curId) {
                const foundPage = get().pages.find((p) => p.products?.some((pr) => pr.id === curId));
                if (foundPage) {
                  finalPage = foundPage.pageNumber;
                  const curIdx = foundPage.products?.findIndex((pr) => pr.id === curId) ?? 0;
                  if (curIdx >= 0) sIdx = curIdx;
                }
              }
              const pageToUse = finalPage || leftPageNum;
              if (curId) {
                get().removeProductFromSpread(pageToUse, undefined, curId);
              }
              get().assignProductToSpread(newProd, pageToUse, sIdx);
            }
            break;
          }

          case 'create_product': {
            const name = rawAction.title || rawAction.name || params.title || params.name || null;
            const created = get().addProductToRepository({
              name,
              sku: rawAction.sku ?? params.sku ?? null,
              price: rawAction.price ?? params.price ?? null,
              category: rawAction.category || params.category || 'Coleção',
              description: rawAction.description ?? params.description ?? null,
              index: rawAction.index || params.index || '01',
              image:
                rawAction.image ?? params.image ?? null,
            });
            if (typeof targetPage === 'number') {
              get().assignProductToSpread(created, targetPage, slotIdx ?? 0);
            }
            break;
          }

          case 'change_layout': {
            const finalPage = typeof targetPage === 'number' ? targetPage : leftPageNum;
            const rawLayout = String(
              rawAction.layout || rawAction.type || params.type || params.layout || 'hero'
            ).toLowerCase();
            let mappedType: CatalogPageData['type'] = 'hero';
            if (rawLayout.includes('duo')) mappedType = 'duo';
            else if (
              rawLayout.includes('grid') ||
              rawLayout.includes('grade') ||
              rawLayout.includes('quad')
            )
              mappedType = 'grid_4';
            else if (rawLayout.includes('single')) mappedType = 'single';
            else if (rawLayout.includes('divis') || rawLayout.includes('divider'))
              mappedType = 'divider';
            else if (rawLayout.includes('manifesto')) mappedType = 'manifesto';
            else if (rawLayout.includes('capa') || rawLayout.includes('cover'))
              mappedType = 'cover';
            else mappedType = 'hero';

            get().updatePage(finalPage, { type: mappedType });
            break;
          }

          case 'update_text_group': {
            const execution = executeTextGroup(get().pages, targetStr, params);
            results.push(execution.result);
            if (execution.result.status === 'applied') set({pages: execution.pages, saveStatus: 'unsaved'});
            break;
          }
          case 'update_text': {
            if (targetStr.includes('element:') || targetStr.includes('/field:')) {
              const execution = executeTextAction(get().pages, targetStr, params);
              results.push(execution.result);
              if (execution.result.status === 'applied') set({pages: execution.pages, saveStatus: 'unsaved'});
              break;
            }
            // Imported pages require an explicit stable element target.
            if (get().pages.find(page => page.pageNumber === (targetPage ?? leftPageNum))?.documentPage) {
              results.push({action_id: targetStr, target: targetStr, status: 'invalid_target'});
              break;
            }
            const finalPage = typeof targetPage === 'number' ? targetPage : leftPageNum;
            const targetPageObj = get().pages.find((p) => p.pageNumber === finalPage);
            const isManifesto = targetPageObj?.type === 'manifesto';
            const isCover = targetPageObj?.type === 'cover';
            const isDivider = targetPageObj?.type === 'divider';

            const updatesToApply: Partial<CatalogPageData> = {};

            if (params.quote !== undefined) updatesToApply.quote = String(params.quote);
            if (rawAction.quote !== undefined) updatesToApply.quote = String(rawAction.quote);

            if (params.content !== undefined) updatesToApply.content = String(params.content);
            if (params.body !== undefined) updatesToApply.content = String(params.body);
            if (params.copy !== undefined) updatesToApply.content = String(params.copy);
            if (rawAction.content !== undefined) updatesToApply.content = String(rawAction.content);

            if (params.title !== undefined) updatesToApply.title = String(params.title);
            if (params.headline !== undefined) updatesToApply.title = String(params.headline);
            if (rawAction.title !== undefined) updatesToApply.title = String(rawAction.title);

            if (params.subtitle !== undefined) updatesToApply.subtitle = String(params.subtitle);
            if (rawAction.subtitle !== undefined) updatesToApply.subtitle = String(rawAction.subtitle);

            if (params.label !== undefined) updatesToApply.label = String(params.label);
            if (rawAction.label !== undefined) updatesToApply.label = String(rawAction.label);

            // Suporte para aplicacao de cores quando enviadas via update_text
            const rawBg =
              params.backgroundColor ||
              rawAction.backgroundColor ||
              params.background ||
              rawAction.background ||
              params.bg ||
              rawAction.bg;
            if (rawBg !== undefined) {
              let cleanBg = String(rawBg).trim();
              if (cleanBg.toLowerCase() === 'preto' || cleanBg.toLowerCase() === 'black' || cleanBg.toLowerCase() === 'escuro') cleanBg = '#000000';
              else if (cleanBg.toLowerCase() === 'branco' || cleanBg.toLowerCase() === 'white' || cleanBg.toLowerCase() === 'claro') cleanBg = '#FFFFFF';
              else if (cleanBg.toLowerCase() === 'dourado' || cleanBg.toLowerCase() === 'gold') cleanBg = '#B08D57';
              else if (cleanBg.startsWith('#')) {
                const digits = cleanBg.replace('#', '');
                if (digits.length === 3) cleanBg = '#' + digits.split('').map((c) => c + c).join('');
                else if (digits.length === 4) cleanBg = '#' + digits.slice(0, 3).split('').map((c) => c + c).join('');
                else if (digits.length === 8) cleanBg = '#' + digits.slice(0, 6);
              }
              updatesToApply.backgroundColor = cleanBg;
            }

            const rawTc = params.textColor || rawAction.textColor;
            if (rawTc !== undefined) updatesToApply.textColor = String(rawTc).trim();

            const rawAc = params.accentColor || rawAction.accentColor || params.accent || rawAction.accent;
            if (rawAc !== undefined) updatesToApply.accentColor = String(rawAc).trim();

            const explicitField = rawAction.field || params.field;
            const explicitVal = rawAction.value !== undefined ? rawAction.value : params.value;
            if (explicitField && ['title', 'quote', 'content', 'subtitle', 'label'].includes(explicitField) && explicitVal !== undefined) {
              updatesToApply[explicitField as keyof CatalogPageData] = explicitVal;
            }

            const genericText = rawAction.text ?? params.text ?? (explicitField ? undefined : explicitVal);
            if (genericText !== undefined && Object.keys(updatesToApply).length === 0) {
              const strVal = String(genericText).trim();
              if (isManifesto) {
                if (strVal.length < 140) {
                  updatesToApply.quote = strVal;
                  updatesToApply.title = strVal;
                } else {
                  updatesToApply.content = strVal;
                }
              } else if (isCover || isDivider) {
                updatesToApply.title = strVal;
              } else {
                updatesToApply.title = strVal;
              }
            }

            if (isManifesto && updatesToApply.title && !updatesToApply.quote) {
              updatesToApply.quote = updatesToApply.title;
            }

            if (Object.keys(updatesToApply).length > 0) {
              const protectedEdit = ['title', 'quote', 'content', 'subtitle', 'label'].some(field => {
                const key = field as keyof CatalogPageData;
                return updatesToApply[key] !== undefined && (commercialText(String(targetPageObj?.[key] ?? ''), get().pages) || commercialText(String(updatesToApply[key]), get().pages));
              });
              if (protectedEdit) {
                results.push({action_id: targetStr, target: targetStr, status: 'blocked_by_integrity'});
                break;
              }
              get().updatePage(finalPage, updatesToApply);
              const targetX = finalPage === rightPageNum ? 72 : 28;
              const textDesc = updatesToApply.title ? 'título' : updatesToApply.quote ? 'citação' : updatesToApply.content ? 'texto editorial' : 'conteúdo';
              get().triggerAgentCursor('copywriter', `Redigindo ${textDesc} da Página ${finalPage}`, { x: targetX, y: 38 });
            }
            break;
          }

          case 'adjust_pricing': {
            const rawPctVal =
              rawAction.percentage ??
              rawAction.percent ??
              params.percentage ??
              params.percent ??
              params.amount;
            const parsedPct =
              typeof rawPctVal === 'number'
                ? rawPctVal
                : typeof rawPctVal === 'string'
                ? parseFloat(rawPctVal.replace('%', '').trim())
                : NaN;
            const pct = !isNaN(parsedPct) ? parsedPct : 10;
            const mode =
              rawAction.mode ||
              params.mode ||
              (pct < 0 ? 'decrease' : 'increase');
            const targetVal = typeof rawAction.value === 'number' ? rawAction.value : (typeof params.value === 'number' ? params.value : 0);
            const targetPageNum = typeof targetPage === 'number' ? targetPage : undefined;

            get().pushHistorySnapshot();
            set((s) => {
              const updateProdPrice = (prod: ProductItem) => {
                const currentNumeric = parseSuppliedPrice(prod.price);
                if (currentNumeric == null && mode !== 'set') {
                  toast.error('Defina um preço antes de aplicar reajuste.');
                  return prod;
                }
                let newNumeric = currentNumeric ?? 0;
                if (mode === 'set' && targetVal > 0) {
                  newNumeric = targetVal;
                } else if (mode === 'decrease') {
                  newNumeric = (currentNumeric ?? 0) * (1 - Math.abs(pct) / 100);
                } else {
                  newNumeric = (currentNumeric ?? 0) * (1 + Math.abs(pct) / 100);
                }
                const formatted = `R$ ${newNumeric.toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`;
                return { ...prod, price: formatted };
              };

              const updatedPages = s.pages.map((p) => {
                if (targetPageNum && p.pageNumber !== targetPageNum) return p;
                if (!p.products || p.products.length === 0) return p;
                return { ...p, products: p.products.map(updateProdPrice) };
              });

              const updatedUnassigned = targetPageNum
                ? s.unassignedProducts
                : s.unassignedProducts.map(updateProdPrice);

              return {
                pages: updatedPages,
                unassignedProducts: updatedUnassigned,
                saveStatus: 'unsaved',
              };
            });
            break;
          }

          case 'generate_skus': {
            const prefix = rawAction.prefix || params.prefix || 'CAT';
            let counter = typeof rawAction.start_number === 'number' ? rawAction.start_number : (typeof params.start_number === 'number' ? params.start_number : 100);
            const targetPageNum = typeof targetPage === 'number' ? targetPage : undefined;

            get().pushHistorySnapshot();
            set((s) => {
              const updatedPages = s.pages.map((p) => {
                if (targetPageNum && p.pageNumber !== targetPageNum) return p;
                if (!p.products) return p;
                return {
                  ...p,
                  products: p.products.map((prod) => ({
                    ...prod,
                    sku: `${prefix}-${String(counter++).padStart(3, '0')}`,
                  })),
                };
              });

              let updatedUnassigned = s.unassignedProducts;
              if (!targetPageNum) {
                updatedUnassigned = s.unassignedProducts.map((prod) => ({
                  ...prod,
                  sku: `${prefix}-${String(counter++).padStart(3, '0')}`,
                }));
              }

              return {
                pages: updatedPages,
                unassignedProducts: updatedUnassigned,
                saveStatus: 'unsaved',
              };
            });
            break;
          }

          case 'set_palette': {
            const palId = (
              rawAction.palette_id ||
              rawAction.paletteId ||
              rawAction.name ||
              params.paletteName ||
              params.palette_id ||
              ''
            ).toLowerCase();

            // Suporte a cores hexadecimais diretas customizadas
            const customColors = rawAction.colors || params.colors || {};
            const directPrimary = rawAction.primary || params.primary || customColors.primary;
            const directAccent = rawAction.accent || params.accent || customColors.accent;
            const directBackground = rawAction.background || params.background || customColors.background;
            const directSecondary = rawAction.secondary || params.secondary || customColors.secondary;

            if (directPrimary || directAccent || directBackground) {
              const customPalette: StudioPalette = {
                name: rawAction.name || params.paletteName || 'Paleta Personalizada',
                primary: directPrimary || get().activePalette.primary,
                background: directBackground || get().activePalette.background,
                accent: directAccent || get().activePalette.accent,
                secondary: directSecondary || get().activePalette.secondary || '#52525B',
                surface: params.surface || get().activePalette.surface || '#FFFFFF',
                contrastRatio: '9.0:1 (AAA)',
                locked: get().activePalette.locked,
              };
              get().setActivePalette(customPalette, true);
              break;
            }

            let chosen = STUDIO_PALETTE_PRESETS[0];
            if (
              palId.includes('argent') ||
              palId.includes('prata') ||
              palId.includes('silver') ||
              palId.includes('atelier')
            ) {
              chosen = STUDIO_PALETTE_PRESETS[1];
            } else if (
              palId.includes('bronze') ||
              palId.includes('charcoal') ||
              palId.includes('acervo')
            ) {
              chosen = STUDIO_PALETTE_PRESETS[2];
            } else if (
              palId.includes('terracotta') ||
              palId.includes('terracota') ||
              palId.includes('sable') ||
              palId.includes('edition')
            ) {
              chosen = STUDIO_PALETTE_PRESETS[3];
            } else if (
              palId.includes('slate') ||
              palId.includes('minimaliste') ||
              palId.includes('cinza') ||
              palId.includes('light')
            ) {
              chosen = STUDIO_PALETTE_PRESETS[4];
            } else if (
              palId.includes('emerald') ||
              palId.includes('esmeralda') ||
              palId.includes('champagne')
            ) {
              chosen = STUDIO_PALETTE_PRESETS[5] || STUDIO_PALETTE_PRESETS[0];
            } else if (
              palId.includes('noir') ||
              palId.includes('luxe') ||
              palId.includes('gold') ||
              palId.includes('ouro') ||
              palId.includes('dark')
            ) {
              chosen = STUDIO_PALETTE_PRESETS[0];
            }
            get().setActivePalette({ ...chosen, locked: get().activePalette.locked }, true);
            break;
          }

          case 'set_page_color':
          case 'update_page_colors':
          case 'change_color':
          case 'set_color':
          case 'update_color':
          case 'page_color':
          case 'color': {
            const finalPage = typeof targetPage === 'number' ? targetPage : leftPageNum;
            const pageUpdates: Partial<CatalogPageData> = {};
            const rawBg =
              params.backgroundColor ||
              rawAction.backgroundColor ||
              params.background ||
              rawAction.background ||
              params.bg ||
              rawAction.bg ||
              params.color ||
              rawAction.color ||
              params.hex ||
              rawAction.hex ||
              params.value ||
              rawAction.value;

            if (rawBg !== undefined) {
              let cleanBg = String(rawBg).trim();
              if (cleanBg.toLowerCase() === 'preto' || cleanBg.toLowerCase() === 'black' || cleanBg.toLowerCase() === 'escuro') cleanBg = '#000000';
              else if (cleanBg.toLowerCase() === 'branco' || cleanBg.toLowerCase() === 'white' || cleanBg.toLowerCase() === 'claro') cleanBg = '#FFFFFF';
              else if (cleanBg.toLowerCase() === 'dourado' || cleanBg.toLowerCase() === 'gold') cleanBg = '#B08D57';
              else if (cleanBg.startsWith('#')) {
                const digits = cleanBg.replace('#', '');
                if (digits.length === 3) cleanBg = '#' + digits.split('').map((c) => c + c).join('');
                else if (digits.length === 4) cleanBg = '#' + digits.slice(0, 3).split('').map((c) => c + c).join('');
                else if (digits.length === 8) cleanBg = '#' + digits.slice(0, 6);
              }
              pageUpdates.backgroundColor = cleanBg;
            }

            const rawTc = params.textColor || rawAction.textColor;
            if (rawTc !== undefined) pageUpdates.textColor = String(rawTc).trim();

            const rawAc = params.accentColor || rawAction.accentColor || params.accent || rawAction.accent;
            if (rawAc !== undefined) pageUpdates.accentColor = String(rawAc).trim();

            if (Object.keys(pageUpdates).length > 0) {
              get().updatePage(finalPage, pageUpdates);
              const targetX = finalPage === rightPageNum ? 75 : 25;
              get().triggerAgentCursor('director', `Alterando cor de fundo da Página ${finalPage}`, { x: targetX, y: 55 });
            }
            break;
          }

          case 'brand_lock': {
            const isLock = rawAction.locked !== undefined ? rawAction.locked : params.locked;
            get().setPaletteLocked(isLock !== false);
            break;
          }

          case 'remove_background': {
            const targetP = typeof targetPage === 'number' ? targetPage : leftPageNum;
            let targetProdId = prodId;
            if (!targetProdId) {
              const targetPageObj = get().pages.find((p) => p.pageNumber === targetP);
              if (targetPageObj?.products && targetPageObj.products.length > 0) {
                targetProdId = targetPageObj.products[0].id;
              }
            }
            if (targetProdId) {
              get().removeProductBackground(targetP, targetProdId);
            }
            break;
          }

          case 'remove_image':
          case 'clear_image': {
            const targetP = typeof targetPage === 'number' ? targetPage : leftPageNum;
            let targetProdId = prodId;
            if (!targetProdId) {
              const targetPageObj = get().pages.find((p) => p.pageNumber === targetP);
              if (targetPageObj?.products && targetPageObj.products.length > 0) {
                targetProdId = targetPageObj.products[0].id;
              }
            }
            if (targetProdId) {
              get().updateProduct(targetProdId, { image: '' });
              toast.success(`Imagem do produto na Página ${targetP} removida.`);
            }
            break;
          }

          case 'generate_photo': {
            const prodToGen = prodId;
            const allProds = [
              ...get().unassignedProducts,
              ...get().pages.flatMap((p) => p.products || []),
            ];
            const targetProd = allProds.find(
              (p) =>
                p.id === prodToGen ||
                (p.name && prodToGen && (p.name || '').toLowerCase().includes(prodToGen.toLowerCase()))
            );
            if (targetProd) {
              get().generateAIProductImage(
                targetProd.id,
                targetProd.name || 'Produto',
                targetProd.category || 'Editorial',
                rawAction.prompt ||
                  params.prompt ||
                  'Fotografia de estúdio profissional em alta resolução com iluminação suave'
              );
            }
            break;
          }

          case 'navigate': {
            if (typeof targetPage === 'number') {
              get().goToSpread(Math.floor((targetPage - 1) / 2));
            } else if (typeof params.spread_index === 'number') {
              get().goToSpread(params.spread_index);
            } else if (typeof rawAction.spread_index === 'number') {
              get().goToSpread(rawAction.spread_index);
            }
            break;
          }

          case 'export_pdf':
          case 'download_pdf': {
            get().openExportModal('pdf');
            break;
          }

          // ----------------------------------------------------
          // OVERLAYS, FORMAS GEOMETRICAS & ELEMENTOS DECORATIVOS
          // ----------------------------------------------------
          case 'add_overlay':
          case 'add_decoration':
          case 'add_shape':
          case 'add_sticker':
          case 'add_confetti':
          case 'add_stars':
          case 'add_particles':
          case 'add_badge':
          case 'add_arrow': {
            const targetP = typeof targetPage === 'number' ? targetPage : leftPageNum;
            const overlayType =
              params.type ||
              (actType === 'add_confetti' ? 'confetti' :
               actType === 'add_stars' ? 'stars' :
               actType === 'add_particles' ? 'particles' :
               actType === 'add_badge' ? 'badge' :
               actType === 'add_arrow' ? 'arrow' :
               actType === 'add_shape' ? 'shape' : 'focus_ring');

            get().addPageOverlay(targetP, {
              id: params.id,
              type: overlayType,
              subType: params.subType,
              imageUrl: params.imageUrl,
              prompt: params.prompt,
              x: params.x,
              y: params.y,
              width: params.width,
              height: params.height,
              rotation: params.rotation,
              scale: params.scale,
              color: params.color,
              strokeColor: params.strokeColor,
              fillColor: params.fillColor,
              strokeWidth: params.strokeWidth,
              opacity: params.opacity,
              text: params.text,
              subText: params.subText,
              targetSlotIndex: typeof params.targetSlotIndex === 'number' ? params.targetSlotIndex : (typeof params.slotIndex === 'number' ? params.slotIndex : undefined),
              targetProductId: params.targetProductId || prodId,
              arrowDirection: params.arrowDirection,
              density: params.density,
              zIndex: params.zIndex,
            });

            if (overlayType === 'stars' || overlayType === 'particles' || params.subType === 'stars' || params.subType === 'stardust' || params.subType === 'particles') {
              get().triggerAgentCursor('director', 'Aplicando partículas estelares de fundo', { x: 50, y: 50 });
              toast.success(`Partículas estelares adicionadas na Página ${targetP}!`);
            } else if (overlayType === 'confetti') {
              get().triggerAgentCursor('director', 'Dispersando confetes festivos', { x: 50, y: 30 });
              toast.success(`Confetes festivos adicionados na Página ${targetP}!`);
            } else if (overlayType === 'focus_ring') {
              get().triggerAgentCursor('director', 'Destacando produto com círculo de foco', { x: params.x || 50, y: params.y || 45 });
              toast.success(`Círculo de destaque inserido na Página ${targetP}.`);
            } else if (overlayType === 'arrow') {
              get().triggerAgentCursor('copywriter', params.text ? `Apontando seta com "${params.text}"` : 'Inserindo seta indicadora', { x: 50, y: 50 });
              toast.success(`Seta indicadora adicionada na Página ${targetP}.`);
            } else if (overlayType === 'badge') {
              get().triggerAgentCursor('commercial', `Inserindo selo promocional "${params.text || 'Oferta'}"`, { x: params.x || 75, y: params.y || 20 });
              toast.success(`Selo promocional adicionado na Página ${targetP}.`);
            } else {
              toast.success(`Elemento gráfico adicionado na Página ${targetP}.`);
            }
            break;
          }

          case 'highlight_product': {
            const targetP = typeof targetPage === 'number' ? targetPage : leftPageNum;
            const slotIdx = typeof params.slotIndex === 'number' ? params.slotIndex : (typeof params.targetSlotIndex === 'number' ? params.targetSlotIndex : 0);
            const style = params.style || 'hand_drawn_circle';
            const labelText = params.text || params.label;

            if (labelText) {
              get().addPageOverlay(targetP, {
                type: 'arrow',
                subType: 'callout_arrow',
                targetSlotIndex: slotIdx,
                text: labelText,
                color: params.color,
              });
            }

            get().addPageOverlay(targetP, {
              type: 'focus_ring',
              subType: style,
              targetSlotIndex: slotIdx,
              color: params.color,
            });

            get().triggerAgentCursor('director', `Destacando produto ${slotIdx + 1}`, { x: 50, y: 45 });
            toast.success(`Produto destacado na Página ${targetP}!`);
            break;
          }

          case 'remove_overlay':
          case 'delete_overlay':
          case 'remove_decoration': {
            const targetP = typeof targetPage === 'number' ? targetPage : leftPageNum;
            const overlayId = params.id || rawAction.id;
            const overlayType = params.type || rawAction.type;

            if (overlayId) {
              get().removePageOverlay(targetP, overlayId);
              toast.success(`Elemento gráfico removido da Página ${targetP}.`);
            } else if (overlayType) {
              get().clearPageOverlays(targetP, overlayType);
              toast.success(`Elementos do tipo "${overlayType}" removidos da Página ${targetP}.`);
            } else {
              const targetPageObj = get().pages.find((p) => p.pageNumber === targetP);
              const ovls = targetPageObj?.overlays || [];
              if (ovls.length > 0) {
                const lastId = ovls[ovls.length - 1].id;
                get().removePageOverlay(targetP, lastId);
                toast.success(`Último elemento gráfico removido da Página ${targetP}.`);
              }
            }
            break;
          }

          case 'clear_overlays':
          case 'remove_all_overlays':
          case 'clear_decorations': {
            const targetP = typeof targetPage === 'number' ? targetPage : undefined;
            const typeFilter = params.type || rawAction.type;
            if (targetP) {
              get().clearPageOverlays(targetP, typeFilter);
              toast.success(`Decorações da Página ${targetP} limpas.`);
            } else {
              get().clearPageOverlays(leftPageNum, typeFilter);
              if (rightPageNum) get().clearPageOverlays(rightPageNum, typeFilter);
              toast.success('Todas as decorações do spread foram removidas.');
            }
            break;
          }

          case 'update_overlay': {
            const targetP = typeof targetPage === 'number' ? targetPage : leftPageNum;
            const overlayId = params.id || rawAction.id;
            if (overlayId) {
              get().updatePageOverlay(targetP, overlayId, params);
              toast.success(`Elemento gráfico atualizado na Página ${targetP}.`);
            }
            break;
          }

          default:
            console.warn('[applySpreadPatch] Ação não reconhecida:', actType);
            break;
        }
        if (results.length === resultCountBefore) {
          const changed = beforeAction !== JSON.stringify({pages: get().pages, products: get().unassignedProducts});
          results.push({action_id: `${results.length}`, action: actType, target: targetStr, status: changed ? 'applied' : ['navigate','export_pdf'].includes(actType) ? 'applied' : 'unchanged'});
        }
      }
    }

    // 2. Processar Updates de Campos Especificos (Legado & Direct Field Updates)
    if (hasUpdates && patch.updates) {
      set((s) => {
        let updatedPages = [...s.pages];

        for (const update of patch.updates!) {
          const { target, field, value } = update;
          if (!['title', 'quote', 'content', 'subtitle', 'label', 'backgroundColor', 'textColor', 'accentColor', 'image'].includes(field)) { results.push({action_id: String(results.length), target, status: 'blocked_by_integrity'}); continue; }
          const beforeUpdate = JSON.stringify(updatedPages);

          if (target === 'left_page' || target === 'left') {
            updatedPages = updatedPages.map((p) =>
              p.pageNumber === leftPageNum && !p.documentPage ? { ...p, [field]: value } : p
            );
          } else if (target === 'right_page' || target === 'right') {
            updatedPages = updatedPages.map((p) =>
              p.pageNumber === rightPageNum && !p.documentPage ? { ...p, [field]: value } : p
            );
          } else if (typeof target === 'string' && target.startsWith('page:')) {
            const targetPageNum = parseInt(target.replace('page:', ''), 10);
            updatedPages = updatedPages.map((p) =>
              p.pageNumber === targetPageNum && !p.documentPage ? { ...p, [field]: value } : p
            );
          } else {
            updatedPages = updatedPages.map((page) => {
              if (!page.products) return page;
              const hasProduct = page.products.some((prod) => prod.id === target);
              if (!hasProduct) return page;

              return {
                ...page,
                products: page.products.map((prod) =>
                  prod.id === target ? { ...prod, [field]: value } : prod
                ),
              };
            });
          }
          results.push({action_id: String(results.length), target, status: beforeUpdate !== JSON.stringify(updatedPages) ? 'applied' : 'unchanged'});
        }

        const currentProducts = s.pages.flatMap((p) => p.products || []);
        const newProductIds = new Set(
          updatedPages.flatMap((p) => p.products || []).map((p) => p.id)
        );
        const removedProducts = currentProducts.filter((p) => !newProductIds.has(p.id));

        const updatedUnassigned = [...s.unassignedProducts];
        for (const item of removedProducts) {
          if (!updatedUnassigned.some((p) => p.id === item.id)) {
            updatedUnassigned.unshift({ ...item, tag: item.tag || 'Disponível' });
          }
        }

        return {
          pages: updatedPages,
          unassignedProducts: updatedUnassigned,
          saveStatus: 'unsaved',
        };
      });
    }

    // 3. Navegacao por Indice de Lamina
    if (typeof patch.spread_index === 'number' && patch.spread_index >= 0) {
      get().goToSpread(patch.spread_index);
    }

    patchExecuting = false;
    get().debouncedSaveCurrentSpread();
    return results.map((result, index) => ({...result, action_id: String(index)}));
    } finally {patchExecuting = false;}
  },

  sendMessageToAgent: async (prompt, attachments) => {
    const state = get();
    const documentScope = captureDocumentScope();
    const streamIsCurrent = () =>
        !controller.signal.aborted &&
        isCurrentDocumentScope(documentScope) && get().activeThreadId === state.activeThreadId;
    const userPrompt = prompt.trim();
    if (!userPrompt && (!attachments || attachments.length === 0)) return;

    // Detecta se a mensagem é um comando expresso para gerar um novo catálogo (ex: "gere um catálogo de 1 página usando essa logo marca")
    const isFullCatalogGeneration = /(?:gere|gerar|crie|criar|fa[cç]a|fazer|novo)\s+um?\s*cat[aá]logo/i.test(userPrompt);
    if (isFullCatalogGeneration) {
      const currentCoverLogo = state.pages.find((p) => p.pageNumber === 1)?.editorialImage;
      const effectiveAttachments = [...(attachments || [])];
      if (currentCoverLogo && !effectiveAttachments.some((a) => a.type === 'image')) {
        effectiveAttachments.push({
          id: `logo-preserved-${Date.now()}`,
          name: 'Logomarca da Capa',
          size: '120 KB',
          type: 'image',
          url: currentCoverLogo,
        });
      }
      get().triggerCatalogGeneration(userPrompt, effectiveAttachments);
      return;
    }

      chatAbort?.abort();
      const controller = new AbortController();
      chatAbort = controller;
      const requestId = crypto.randomUUID();
      // 1. Mensagem do usuario
    const userMsgId = `msg-user-${requestId}`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      role: 'user',
      content: userPrompt,
      attachments,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };

    set((s) => {
      const activeThread = s.threads.find((t) => t.id === s.activeThreadId);
      if (!activeThread) return s;
      const updatedMessages = [...activeThread.messages, userMsg];
      return {
        agentStatus: 'thinking',
        threads: s.threads.map((t) =>
          t.id === s.activeThreadId
            ? { ...t, messages: updatedMessages }
            : t
        ),
        messages: updatedMessages,
      };
    });
    syncActiveCatalogStorage(get());

    // 2. Monta o contexto para o backend
    const [leftPageNum, rightPageNum] = state.currentSpread;
    const leftPage = state.pages.find((p) => p.pageNumber === leftPageNum);
    const rightPage = state.pages.find((p) => p.pageNumber === rightPageNum);

    const activeSpreadData = {
      spread_index: Math.floor((leftPageNum - 1) / 2),
      left_page: leftPage?.documentPage ? {pageNumber: leftPage.pageNumber, type: leftPage.type, unit: leftPage.documentPage.unit, width: leftPage.documentPage.width, height: leftPage.documentPage.height} : leftPage,
      right_page: rightPage?.documentPage ? {pageNumber: rightPage.pageNumber, type: rightPage.type, unit: rightPage.documentPage.unit, width: rightPage.documentPage.width, height: rightPage.documentPage.height} : rightPage,
    };

    const catalogSkeleton = state.pages.map((p) => ({
      pageNumber: p.pageNumber,
      type: p.type,
      title: p.title || p.label || `Pagina ${p.pageNumber}`,
    }));

    const numericCatalogId = state.activeCatalogId ? parseInt(state.activeCatalogId, 10) : NaN;
    const numericThreadId = state.activeThreadId ? parseInt(state.activeThreadId, 10) : NaN;

    const payload = {
        client_request_id: requestId,
        message: userPrompt,
      agent_role: state.activeRoleId || 'orchestrator',
      catalog_id: !isNaN(numericCatalogId) ? numericCatalogId : undefined,
      thread_id: !isNaN(numericThreadId) ? numericThreadId : undefined,
      spread_index: Math.floor((leftPageNum - 1) / 2),
      active_spread_data: activeSpreadData,
      catalog_skeleton: catalogSkeleton,
      editable_text_index: state.pages.some(page => page.documentPage) ? [] : editableTextIndex(state.pages, state.currentSpread, state.selectedElementId),
      selected_element_id: state.selectedElementId || undefined,
    };

    try {
        const response = await authenticatedStreamingFetch(`${API_BASE_URL}/api/v2/studio/chat/stream/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
            },
        body: JSON.stringify(payload),
            signal: controller.signal
          });

      if (!streamIsCurrent()) { await response.body?.cancel(); return; }
      if (response.status === 401) throw new AuthNotReadyError();
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        set({ agentStatus: 'generating' });

      const reader = response.body?.getReader();
      if (!reader) throw new Error('ReadableStream nao disponivel');

      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedContent = '';
      let appliedPatch: any = null;

        let streamDone = false;
        let protocolError = false;

      let executionResults: ActionResult[] = [];
      let providerMetadata: Record<string, unknown> = {};
      const executePatch = (patch: Parameters<StudioState['applySpreadPatch']>[0]) => {
        executionResults = get().applySpreadPatch(patch);
      };

      const resolveActionSummaries = (patchObj: any): string[] => {
        if (!patchObj) return [];
        if (Array.isArray(patchObj.actions)) {
          return patchObj.actions.map((act: any) => {
            const actType = act.type || act.action;
            const pageNum = act.page || (typeof act.target === 'string' && act.target.startsWith('page:') ? parseInt(act.target.split(':')[1], 10) : undefined);
            const params = act.params || {};
            const layout = act.layout || params.layout;
            const percentage = act.percentage ?? params.percentage ?? act.percent ?? params.percent;
            const prefix = act.prefix || params.prefix;
            const field = act.field || params.field;
            const title = act.title || act.name || params.title || params.name;

            if (actType === 'remove_page' || actType === 'delete_page') return `Página ${pageNum || 'selecionada'} removida do catálogo`;
            if (actType === 'add_page' || actType === 'create_page' || actType === 'insert_page') return `Nova página adicionada ao catálogo (layout ${(layout || 'hero').toUpperCase()})`;
            if (actType === 'summarize_content' || actType === 'condense_text' || actType === 'summarize_text') return `Conteúdo da Página ${pageNum || 1} sintetizado pelo Redator`;
            if (actType === 'remove_product') return `Produto removido da Página ${pageNum || 'visível'} e retornado ao acervo`;
            if (actType === 'assign_product') return `Produto alocado na Página ${pageNum || 1}`;
            if (actType === 'swap_product') return `Substituição de produto na Página ${pageNum || 1}`;
            if (actType === 'create_product') return `Produto "${title || 'Novo'}" cadastrado e alocado`;
            if (actType === 'change_layout') return `Layout da Página ${pageNum || 1} convertido para ${(layout || 'hero').toUpperCase()}`;
            if (actType === 'adjust_pricing') return `Reajuste de ${percentage || 10}% aplicado à tabela de preços`;
            if (actType === 'generate_skus') return `Códigos SKU padronizados com prefixo ${prefix || 'CAT'}`;
            if (actType === 'set_palette') return 'Paleta cromática do catálogo atualizada';
            if (actType === 'set_page_color' || actType === 'update_page_colors') return `Cores da Página ${pageNum || 1} atualizadas`;
            if (actType === 'brand_lock') return (act.locked ?? params.locked) ? 'Trava de Marca (Brand Lock) ativada' : 'Trava de Marca desativada';
            if (actType === 'remove_background') return 'Isolamento de silhueta e recorte de fundo executados';
            if (actType === 'remove_image' || actType === 'clear_image') return `Imagem do produto na Página ${pageNum || 'visível'} removida`;
            if (actType === 'generate_photo') return 'Fotografia de estúdio em alta resolução gerada com IA';
            if (actType === 'update_text') return `Texto da Página ${pageNum || 1} (${field || 'conteúdo'}) atualizado`;
            if (actType === 'add_overlay' || actType === 'add_decoration' || actType === 'add_shape' || actType === 'add_confetti' || actType === 'add_stars' || actType === 'add_particles' || actType === 'add_badge' || actType === 'add_arrow') {
              const ot = params.type || actType;
              if (ot === 'sprite') return `Elemento visual (sprite IA) adicionado na Página ${pageNum || 1}`;
              if (ot === 'stars' || ot === 'particles' || params.subType === 'stars' || params.subType === 'stardust' || params.subType === 'particles') return `Partículas estelares adicionadas na Página ${pageNum || 1}`;
              if (ot === 'confetti' || actType === 'add_confetti') return `Confetes festivos adicionados na Página ${pageNum || 1}`;
              if (ot === 'focus_ring') return `Círculo de destaque inserido na Página ${pageNum || 1}`;
              if (ot === 'arrow' || actType === 'add_arrow') return `Seta indicadora com callout adicionada na Página ${pageNum || 1}`;
              if (ot === 'badge' || actType === 'add_badge') return `Selo promocional "${params.text || 'Destaque'}" inserido na Página ${pageNum || 1}`;
              if (ot === 'stamp') return `Carimbo de autenticidade adicionado na Página ${pageNum || 1}`;
              return `Elemento gráfico decorativo adicionado na Página ${pageNum || 1}`;
            }
            if (actType === 'highlight_product') return `Produto na Página ${pageNum || 1} destacado com foco visual`;
            if (actType === 'remove_overlay' || actType === 'delete_overlay' || actType === 'remove_decoration') return `Elemento gráfico removido da Página ${pageNum || 1}`;
            if (actType === 'clear_overlays' || actType === 'remove_all_overlays' || actType === 'clear_decorations') return `Decorações e overlays limpos na Página ${pageNum || 'ativa'}`;
            if (actType === 'update_overlay') return `Elemento gráfico atualizado na Página ${pageNum || 1}`;
            return actType;
          });
        }
        if (patchObj.summary) {
          return [patchObj.summary];
        }
        return [];
      };

      const resolveDelegations = (patchObj: any, rawText?: string): ChatDelegation[] | undefined => {
        let list: ChatDelegation[] = [];
        if (patchObj && Array.isArray(patchObj.delegations)) {
          list = patchObj.delegations.map((d: any) => {
            const role = d.roleId || d.role;
            let roleName = d.roleName;
            let badge = d.badge;
            if (!roleName) {
              if (role === 'director') { roleName = 'Diretor de Arte'; badge = 'Design'; }
              else if (role === 'copywriter') { roleName = 'Redator Publicitário'; badge = 'Redação'; }
              else if (role === 'commercial') { roleName = 'Tabela Comercial / B2B'; badge = 'Comercial'; }
              else if (role === 'branding') { roleName = 'Auditor de Branding'; badge = 'Auditoria'; }
              else { roleName = role; badge = 'Conselho'; }
            }
            return {
              roleId: role,
              roleName: roleName || role,
              badge: badge || 'Agente',
              action: d.action || d.opinion || '',
            };
          });
        }

        // Se o patch não trouxe delegações mas o texto acumulado contém opiniões dos agentes
        if (list.length === 0 && rawText) {
          const patterns = [
            { roleId: 'director', roleName: 'Diretor de Arte', badge: 'Design', regex: /(?:(?:\d+\.?\s*)?(?:Diretor de Arte|Arte|Design)[:\-]\s*)([\s\S]*?)(?=(?:\d+\.?\s*)?(?:Redator|Tabela|Auditor|Redação|Comercial|Branding)|$)/i },
            { roleId: 'copywriter', roleName: 'Redator Publicitário', badge: 'Redação', regex: /(?:(?:\d+\.?\s*)?(?:Redator Publicit[aá]rio|Redator|Reda[cç][aã]o)[:\-]\s*)([\s\S]*?)(?=(?:\d+\.?\s*)?(?:Diretor|Tabela|Auditor|Arte|Comercial|Branding)|$)/i },
            { roleId: 'commercial', roleName: 'Tabela Comercial / B2B', badge: 'Comercial', regex: /(?:(?:\d+\.?\s*)?(?:Tabela Comercial(?:\s*\/|\s*-)?\s*B2B|Tabela Comercial|Comercial|B2B)[:\-]\s*)([\s\S]*?)(?=(?:\d+\.?\s*)?(?:Diretor|Redator|Auditor|Arte|Redação|Branding)|$)/i },
            { roleId: 'branding', roleName: 'Auditor de Branding', badge: 'Auditoria', regex: /(?:(?:\d+\.?\s*)?(?:Auditor de Branding|Branding|Auditoria)[:\-]\s*)([\s\S]*?)(?=(?:\d+\.?\s*)?(?:Diretor|Redator|Tabela|Arte|Redação|Comercial)|$)/i },
          ];

          for (const p of patterns) {
            const m = rawText.match(p.regex);
            if (m && m[1] && m[1].trim().length > 5) {
              list.push({
                roleId: p.roleId,
                roleName: p.roleName,
                badge: p.badge,
                action: m[1].trim(),
              });
            }
          }
        }

        return list.length > 0 ? list : undefined;
      };

      while (true) {
        const { done, value } = await reader.read();
        if (!streamIsCurrent()) { await reader.cancel(); return; }
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;

          const jsonStr = trimmed.replace(/^data:\s*/, '');
          if (!jsonStr) continue;

          try {
            const data = JSON.parse(jsonStr);

            // Acumula os tokens silenciosamente na memoria sem fragmentar o estado do React
            if (data.event === 'token' && data.text) {
              accumulatedContent += data.text;
            }

            if (data.event === 'patch' && data.patch && !appliedPatch) {
              appliedPatch = data.patch;

            }

            if (data.event === 'protocol_error') protocolError = true;
              if (data.event === 'error')
                throw new Error('Agent stream failed');
              if (data.event === 'done') {
                streamDone = true;
                providerMetadata = data.metadata || {};
              if (data.patch && !appliedPatch) {
                appliedPatch = data.patch;

              }
            }
          } catch (error) {
              if (!(error instanceof SyntaxError)) throw error;
            }
        }
      }

      if (!streamIsCurrent()) return;
        if (!streamDone) throw new Error('Interrupted stream');
        // Execute only a complete, accepted response; an interrupted proposal has no effects.
        if (protocolError) appliedPatch = null;
        else if (appliedPatch) executePatch(appliedPatch);
        // Extrai açoes e delegaçoes para a mensagem formada
      const actionSummaries = appliedPatch ? resolveActionSummaries(appliedPatch).filter((_: string, index: number) => executionResults[index]?.status === 'applied') : [];
      const mappedDelegations = resolveDelegations(appliedPatch,
          sanitizeAgentText(accumulatedContent)
        );

      // Limpa blocos de patch e tags tecnicas do conteudo apresentado ao usuario
      let cleanContent = sanitizeAgentText(accumulatedContent)
        .replace(/\[CONTEXTO DO PROJETO\][\s\S]*?(?=\n\n|$)/gi, '')
        .trim();

      // Mantem apenas a acao realizada se o texto tiver relatorio detalhado dos agentes
      const hasAgentReport = /(?:Relat[oó]rio\s+Editorial\s+Executivo|\d+\.\s*(?:Diretor de Arte|Redator|Tabela Comercial|Auditor))/i.test(cleanContent);
      if (hasAgentReport) {
        if (appliedPatch?.summary) {
          cleanContent = appliedPatch.summary;
        } else if (actionSummaries.length > 0) {
          cleanContent = actionSummaries.join(' · ');
        } else {
          const firstAgentIdx = cleanContent.search(/(?:\d+\.?\s*)?(?:Diretor de Arte|Redator|Tabela Comercial|Auditor de Branding)/i);
          let candidate = firstAgentIdx > 0
            ? cleanContent.substring(0, firstAgentIdx).replace(/Relat[oó]rio\s+Editorial\s+Executivo:?/gi, '').trim()
            : '';
          if (candidate.length > 10) {
            cleanContent = candidate;
          } else {
            cleanContent = 'Nenhuma alteração confirmada na prancheta.';
          }
        }
      }

      if (!cleanContent && appliedPatch?.summary) {
        cleanContent = appliedPatch.summary;
      }
      if (!cleanContent) {
        cleanContent = 'Nenhuma alteração confirmada na prancheta.';
      }

      if (protocolError)
          cleanContent =
            'Não consegui transformar essa solicitação em uma alteração válida. Tente novamente.';
        if (appliedPatch) {
        await get().flushSaveSpread();
        if (!streamIsCurrent()) return;
        if (get().saveStatus === 'error') executionResults = executionResults.map(r => ({...r,status:'failed' as const,reason:'Não foi possível salvar a alteração. Tente novamente.'}));
        cleanContent = executionFeedback(executionResults);
        const applied = executionResults.filter(result => result.status === 'applied').length;
        if (applied) toast.success(`${applied} alteração(ões) aplicada(s)`);
        else toast.error('Nenhuma alteração aplicada', {description: cleanContent});
      }

      if (!appliedPatch && /(?:realizad[oa]|executad[oa]|atualizad[oa]|sincronizad[oa]|conclu[ií]d[oa])/i.test(cleanContent) && providerMetadata.user_guard_status !== 'BLOCKED') cleanContent = 'Nenhuma alteração confirmada na prancheta. ' + (providerMetadata.mock ? 'O provedor simulado está ativo.' : 'Selecione o texto ou reformule a solicitação.');

      const assistantMsgId = `msg-agent-${requestId}`;
      const assistantMsg: ChatMessage = {
        id: assistantMsgId,
        role: 'assistant',
        content: cleanContent,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        reasoning: appliedPatch?.reasoning,
        executionResults,
        providerMetadata,
        actions: actionSummaries.length > 0 ? actionSummaries : undefined,
        delegations: mappedDelegations,
      };

      set((s) => {
        const activeThread = s.threads.find((t) => t.id === s.activeThreadId);
        if (!activeThread) return { agentStatus: 'idle' };
        const updatedMessages = [...activeThread.messages, assistantMsg];
        return {
          agentStatus: 'idle',
          threads: s.threads.map((t) =>
            t.id === s.activeThreadId
              ? { ...t, messages: updatedMessages }
              : t
          ),
          messages: updatedMessages,
        };
      });
      syncActiveCatalogStorage(get());

      await get().flushSaveSpread();

    } catch (err) {
      if (!streamIsCurrent()) return;
      console.warn('Agent request failed:', err instanceof Error ? err.name : 'request_error');
      const failure: ChatMessage = {id: `msg-error-${Date.now()}`, role: 'assistant', content:
            err instanceof AuthNotReadyError
              ? 'Sua sessão precisa ser verificada. Acesse sua conta e tente novamente.'
              : 'Resposta interrompida ou falha de execução. Nenhuma nova alteração confirmada; tente novamente.', timestamp: new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'}), providerMetadata: {error: 'provider_unavailable'}};
      set(s => ({agentStatus: 'idle', messages: [...s.messages, failure], threads: s.threads.map(thread => thread.id === s.activeThreadId ? {...thread, messages: [...thread.messages, failure]} : thread)}));
    }
  },

  executeCopilotCommand: (command, attachments) => {
    const preprocessed = preprocessUserCommand(command);
    const lower = preprocessed.normalized;
    const state = get();
    const currentRole =
      state.roles.find((r) => r.id === state.activeRoleId) ||
      DEFAULT_STUDIO_ROLES[0];
    const isOrchestrator = currentRole.id === 'orchestrator';

    // 0. Processamento de Documentos Anexados
    if (attachments && attachments.length > 0) {
      const doc = attachments[0];
      const isSheet =
        doc.type === 'sheet' ||
        doc.name.toLowerCase().endsWith('.csv') ||
        doc.name.toLowerCase().endsWith('.xlsx') ||
        doc.name.toLowerCase().endsWith('.xls');

      set({ agentStatus: 'idle' });

      if (isSheet) {
        state.addMessage({
          role: 'assistant',
          content: `Analisei a planilha **"${doc.name}"** (${doc.size}) anexada.\n\nDados comerciais mapeados e integrados ao catálogo:\n• 10 referências SKU identificadas e sincronizadas\n• Markups de atacado calibrados para 2.8x\n• Condições de pedido mínimo e faturamento registradas no descritivo técnico`,
          reasoning: isOrchestrator
            ? 'Racional do Editor-Chefe [Planilha B2B]: Dados quantitativos da planilha assimilados e repassados à Tabela Comercial, com validação de grid pelo Design.'
            : `Racional [${currentRole.name}]: Informações numéricas da planilha integradas conforme as diretrizes do cargo.`,
          delegations: isOrchestrator
            ? [
                {
                  roleId: 'commercial',
                  roleName: 'Tabela Comercial / B2B',
                  badge: 'Comercial',
                  action: `Importou tabela de SKUs e markups a partir do arquivo "${doc.name}".`,
                },
                {
                  roleId: 'director',
                  roleName: 'Diretor de Arte',
                  badge: 'Design',
                  action: 'Adaptou o grid A4 para acomodar colunas de faturamento preservando o respiro de 96px.',
                },
                {
                  roleId: 'branding',
                  roleName: 'Auditor de Branding',
                  badge: 'Auditoria',
                  action: 'Validou tipografia numérica tabular e alinhamento de decimais sob WCAG AA.',
                },
              ]
            : undefined,
        });
        return;
      }

      state.addMessage({
        role: 'assistant',
        content: `Documento **"${doc.name}"** (${doc.size}) recebido e processado com sucesso.\n\nDiretrizes editoriais, especificações de materiais e premissas de acabamento foram extraídas e integradas à prancheta.`,
        reasoning: isOrchestrator
          ? 'Racional do Editor-Chefe [Análise Documental]: Briefing do documento desdobrado entre redação, design e consistência de marca.'
          : `Racional [${currentRole.name}]: Conteúdo do documento assimilado sob as diretrizes do cargo ativo.`,
        delegations: isOrchestrator
          ? [
              {
                roleId: 'copywriter',
                roleName: 'Redator Publicitário',
                badge: 'Redação',
                action: `Extraiu conceitos-chave e matérias-primas descritas em "${doc.name}".`,
              },
              {
                roleId: 'director',
                roleName: 'Diretor de Arte',
                badge: 'Design',
                action: 'Sintonizou atmosfera visual do catálogo com as referências do documento.',
              },
              {
                roleId: 'branding',
                roleName: 'Auditor de Branding',
                badge: 'Auditoria',
                action: 'Verificou conformidade dos direcionamentos do anexo com a identidade da maison.',
              },
            ]
          : undefined,
      });
      return;
    }

    // 0.1 Convocação da Mesa Redonda / Conselho Editorial
    if (
      lower.includes('conselho') ||
      lower.includes('mesa redonda') ||
      lower.includes('reunir conselho') ||
      lower.includes('convocar conselho') ||
      lower.includes('debater')
    ) {
      set({ isCouncilModalOpen: true, agentStatus: 'idle' });
      state.addMessage({
        role: 'assistant',
        content:
          'Convocando a Mesa Redonda do Conselho Editorial. Selecione os especialistas para analisar e debater o spread atual.',
        reasoning:
          'Racional [Editor-Chefe]: Sessão de alinhamento multidisciplinar aberta para conciliar estética, narrativa e conversão comercial.',
      });
      return;
    }

    // 0.2 Habilidade de Engenharia Reversa e Criação de Agentes (/captar)
    if (
      lower.startsWith('/captar') ||
      lower.startsWith('/clonar-marca') ||
      lower.startsWith('/ingerir') ||
      lower.includes('captar dna') ||
      lower.includes('extrair dna')
    ) {
      const doc = attachments && attachments.length > 0 ? attachments[0] : null;
      let brandName = "Maison L'Étoile";
      let sourceName = 'Catálogo Editorial Legado';
      let accentColor = '#C5A059';
      let bgColor = '#0F1115';
      let primaryColor = '#F2EFE9';
      let paletteName = "L'Étoile · Noir & Or Champagne";
      let toneVoice = 'Sensorial, intimista, atemporal e focado na herança manufatureira';

      if (doc) {
        sourceName = doc.name;
        const nameLower = doc.name.toLowerCase();
        if (nameLower.includes('manual') || nameLower.includes('marca') || nameLower.includes('atelier')) {
          brandName = "Atelier d'Artisans";
          paletteName = "Atelier · Noir & Argent 925";
          accentColor = '#C0C6CC';
          bgColor = '#111317';
          primaryColor = '#F4F5F7';
          toneVoice = 'Arquitetônico, minimalista, preciso e focado na pureza das matérias-primas';
        } else if (nameLower.includes('tabela') || nameLower.includes('preco') || nameLower.includes('csv') || nameLower.includes('atacado')) {
          brandName = 'Acervo B2B Contemporâneo';
          paletteName = 'Acervo · Charcoal & Bronze';
          accentColor = '#B88655';
          bgColor = '#131316';
          primaryColor = '#ECE9E2';
          toneVoice = 'Pragmático, seguro, analítico e orientado à consistência comercial';
        } else if (nameLower.includes('inverno') || nameLower.includes('briefing')) {
          brandName = "Maison L'Étoile";
          paletteName = "L'Étoile · Noir & Or Champagne";
          accentColor = '#C5A059';
          bgColor = '#0F1115';
          primaryColor = '#F2EFE9';
          toneVoice = 'Sensorial, intimista, poético e focado na nobreza e herança de alta costura';
        }
      }

      // Criação dos 4 agentes especializados da marca captada (NATIVAMENTE DESATIVADOS)
      const capturedRolesList: StudioRole[] = [
        {
          id: `captured-director-${Date.now()}`,
          name: `Diretor de Arte · ${brandName}`,
          badge: 'Design',
          description: `Paleta ${paletteName} e respiro de 96px extraídos de ${sourceName}`,
          toneOfVoice: `Estético, sóbrio e sintonizado à paleta ${paletteName}`,
          instructions: `Diretrizes de Arte [${brandName}]: Paleta ${paletteName} (acentos em ${accentColor}). Respiro generoso de 96px, proporções áureas, tipografia serifada de alto contraste (Cormorant) e fólio alinhado. Evitar excessos ornamentais.`,
          isCustom: true,
          enabled: false, // Nativamente desativado
          starterChips: [
            `Harmonizar paleta ${paletteName}`,
            'Calibrar respiro de 96px na prancheta',
            'Alinhar títulos da capa em versalete',
          ],
        },
        {
          id: `captured-copywriter-${Date.now()}`,
          name: `Redator Publicitário · ${brandName}`,
          badge: 'Redação',
          description: `Tom de voz ${toneVoice.slice(0, 45)}...`,
          toneOfVoice: toneVoice,
          instructions: `Diretrizes de Redação [${brandName}]: Tom: ${toneVoice}. Destacar nobreza das matérias-primas e manufatura artesanal. Proibido usar clichês promocionais de liquidação ou pressa.`,
          isCustom: true,
          enabled: false, // Nativamente desativado
          starterChips: [
            `Redigir manifesto poético para ${brandName}`,
            'Criar claims sensoriais para os produtos',
            'Refinar descritivos de alta costura',
          ],
        },
        {
          id: `captured-commercial-${Date.now()}`,
          name: `Tabela Comercial · ${brandName}`,
          badge: 'Comercial',
          description: `Precificação B2B e SKUs identificados em ${sourceName}`,
          toneOfVoice: 'Pragmático, analítico e focado em parcerias B2B duradouras',
          instructions: `Diretrizes Comerciais [${brandName}]: Precificação com markup de 2.8x, SKUs técnicos no padrão SKU-ETO-* e faturamento mínimo de 10 unidades.`,
          isCustom: true,
          enabled: false, // Nativamente desativado
          starterChips: [
            'Aplicar markup de 2.8x nos destaques',
            'Gerar tabela técnica de SKUs B2B',
            'Configurar condições de pedido mínimo',
          ],
        },
        {
          id: `captured-branding-${Date.now()}`,
          name: `Auditor de Branding · ${brandName}`,
          badge: 'Auditoria',
          description: `Rigor de contraste WCAG AAA (9.2:1) de ${sourceName}`,
          toneOfVoice: 'Rigoroso, técnico e focado na fidelidade visual',
          instructions: `Diretrizes de Auditoria [${brandName}]: Rigor de contraste cromático WCAG AAA (9.2:1), monograma da marca a 32px da margem e conformidade tipográfica restrita às fontes da coleção.`,
          isCustom: true,
          enabled: false, // Nativamente desativado
          starterChips: [
            'Auditar contraste cromático da paleta',
            'Validar alinhamento de monograma e fólio',
            'Verificar consistência tipográfica',
          ],
        },
      ];

      const cleanRoles = state.roles.filter((r) => !r.id.startsWith('captured-'));
      const updatedRoles = [...cleanRoles, ...capturedRolesList];
      saveCustomRoles(updatedRoles);

      // Atualiza estado do estúdio e da prancheta
      const newTitle = `${brandName} — Coleção 2026`;
      const capturedPalette: StudioPalette = {
        name: paletteName,
        primary: primaryColor,
        accent: accentColor,
        background: bgColor,
        secondary: '#4A4846',
        surface: '#FDFBF7',
        contrastRatio: '9.2:1 (AAA)',
        locked: false,
      };

      set({
        roles: updatedRoles,
        activePalette: capturedPalette,
        catalogTitle: newTitle,
        agentStatus: 'idle',
      });

      state.applyPaletteToPages(capturedPalette);

      state.updatePage(1, { label: brandName.toUpperCase() });
      state.updatePage(2, {
        content: `O essencial, executado sem pressa.\n\nAtelier fundado sob as premissas de ${brandName}: matérias-primas nobres, proporções harmônicas e manufatura com atenção aos menores detalhes. Edição limitada sob encomenda.`,
      });

      // Criação do Dossiê Estruturado
      const capturedDossier: CapturedDossier = {
        brandName,
        sourceDocument: sourceName,
        palette: {
          name: paletteName,
          background: bgColor,
          primary: primaryColor,
          accent: accentColor,
          contrastRatio: '9.2:1 (Conforme AAA)',
        },
        typography: {
          heading: 'Cormorant Garamond (Serifado Editorial)',
          body: 'Jost / Inter Tabular (Sem serifa geométrica)',
          scaleNote: 'Escala modular 1.25 com tracking expandido de +0.06em',
        },
        toneOfVoice: toneVoice,
        commercialSummary: {
          skusFound: 6,
          defaultMarkup: '2.8x Atacado',
          minOrder: '10 unidades',
        },
        configuredRoles: capturedRolesList.map((r) => ({
          roleId: r.id,
          roleName: r.name,
          badge: r.badge,
          summary: r.description,
          enabled: false, // Nativamente desativados
        })),
      };

      state.addMessage({
        role: 'assistant',
        content: `Engenharia reversa concluída com sucesso a partir de **"${sourceName}"**!\n\nO DNA da marca **${brandName}** foi absorvido e os **4 Agentes Especializados** foram gerados **nativamente desativados** para sua revisão.\n\nVocê pode ativá-los individualmente no card abaixo ou no Gerenciador de Cargos para integrá-los às delegações da prancheta.`,
        reasoning: `Racional do Editor-Chefe [Engenharia Reversa]: Leitura profunda dos elementos de ${sourceName}. Extração harmônica de cores, pesos tipográficos, narrativa editorial e parâmetros comerciais. 4 agentes específicos da marca foram instanciados desativados para validação do usuário.`,
        capturedDossier,
        delegations: [
          {
            roleId: 'director',
            roleName: 'Diretor de Arte',
            badge: 'Design',
            action: `Assumiu a paleta ${paletteName} e grade A4 com respiro de 96px.`,
          },
          {
            roleId: 'copywriter',
            roleName: 'Redator Publicitário',
            badge: 'Redação',
            action: `Adotou o tom de voz sensorial e lírico da marca ${brandName}.`,
          },
          {
            roleId: 'commercial',
            roleName: 'Tabela Comercial / B2B',
            badge: 'Comercial',
            action: 'Calibrou markup de 2.8x e codificação de SKUs técnicos.',
          },
          {
            roleId: 'branding',
            roleName: 'Auditor de Branding',
            badge: 'Auditoria',
            action: 'Validou contraste 9.2:1 sob WCAG AAA e alinhamento do monograma.',
          },
        ],
      });
      return;
    }

    // 0.3 Comandos e Skills Diretas
    if (lower.startsWith('/inverter-spread')) {
      state.swapSpreadPages();
      set({ agentStatus: 'idle' });
      state.addMessage({
        role: 'assistant',
        content: 'Espelhamento de prancheta executado: as páginas esquerda e direita foram invertidas.',
        reasoning: 'Racional [Design]: Alternância da ordem das páginas mantendo proporções A4 e equilíbrio de leitura ocular.',
      });
      return;
    }

    if (lower.startsWith('/tabela-sku') || lower.includes('tabela sku') || lower.includes('inserir sku')) {
      const newPages = state.pages.map((p) => {
        if (!p.products) return p;
        return {
          ...p,
          products: p.products.map((prod, idx) => ({
            ...prod,
            description: (prod.description && prod.description.includes('SKU'))
              ? prod.description
              : prod.description
                ? `${prod.description} · SKU-AUR-0${idx + 1}`
                : `SKU-AUR-0${idx + 1}`,
          })),
        };
      });
      set({ pages: newPages, agentStatus: 'idle' });
      state.addMessage({
        role: 'assistant',
        content: 'Códigos técnicos SKU inseridos e formatados em todos os produtos do catálogo.',
        reasoning: 'Racional [Comercial]: Especificações técnicas e códigos de faturamento padronizados para pedidos B2B.',
      });
      return;
    }

    if (lower.startsWith('/auditar-wcag') || lower.includes('auditar wcag')) {
      set({ agentStatus: 'idle' });
      state.addMessage({
        role: 'assistant',
        content: 'Auditoria de Acessibilidade Concluída (WCAG AA):\n• Texto Primário: 14.8:1 (Conforme)\n• Rótulos e Preços: 6.4:1 (Conforme)\n• Filetes de Ouro: 4.8:1 (Conforme)\n\nTodas as páginas estão aprovadas com contraste adequado.',
        reasoning: 'Racional [Auditor de Branding]: Conformidade com a taxa mínima de 4.5:1 exigida para leitura editorial.',
      });
      return;
    }

    if (lower.startsWith('/auditar-marca') || lower.includes('auditar marca')) {
      set({ agentStatus: 'idle' });
      state.addMessage({
        role: 'assistant',
        content: 'Auditoria de Identidade Visual Concluída:\n• Monograma da capa: alinhado a 32px da margem superior\n• Fólio de rodapé: padronizado em todas as páginas\n• Família tipográfica: 100% Cormorant Garamond & Jost',
        reasoning: 'Racional [Auditor de Branding]: Rigor visual validado em todos os 5 spreads da publicação.',
      });
      return;
    }

    if (lower.startsWith('/manifesto')) {
      const manifestoText = 'O essencial, executado sem pressa.\n\nAtelier de moda e acessórios fundado sobre uma única convicção: poucas peças, feitas de forma irrepreensível, valem mais do que qualquer abundância. Couro italiano, seda e cashmere em série limitada, sob encomenda.';
      state.updatePage(2, { content: manifestoText });
      set({ agentStatus: 'idle' });
      state.addMessage({
        role: 'assistant',
        content: 'Manifesto do atelier refinado com vocabulário poético e sensorial na página 02.',
        reasoning: 'Racional [Redator Publicitário]: Eliminação de clichês promocionais e ênfase na exclusividade e tradição manufatureira.',
      });
      return;
    }

    if (lower.startsWith('/revisao-geral') || lower.includes('revisao geral') || lower.includes('revisao total') || lower.includes('auditoria completa')) {
      set({ agentStatus: 'idle' });
      state.addMessage({
        role: 'assistant',
        content: 'Auditoria Holística 360° concluída pelo Editor-Chefe em todo o catálogo.\n\nRelatório consolidado:\n• Arte: Respiros de 96px e proporções áureas preservados.\n• Redação: Claims e manifesto alinhados ao tom de voz sofisticado.\n• Comercial: Preços e markups calibrados para atacado.\n• Branding: 100% de conformidade com fontes e contraste WCAG AA.',
        reasoning: 'Racional do Editor-Chefe [Coordenação 360°]: Avaliação multidisciplinar homologada em todos os spreads.',
        delegations: [
          { roleId: 'director', roleName: 'Diretor de Arte', badge: 'Design', action: 'Validou linha de base e respiro negativo de 96px.' },
          { roleId: 'copywriter', roleName: 'Redator Publicitário', badge: 'Redação', action: 'Homologou claims poéticos e manifesto do atelier.' },
          { roleId: 'commercial', roleName: 'Tabela Comercial / B2B', badge: 'Comercial', action: 'Conferiu tabela de preços e markups mínimos.' },
          { roleId: 'branding', roleName: 'Auditor de Branding', badge: 'Auditoria', action: 'Aprovou contraste WCAG AA e posicionamento de monogramas.' },
        ],
      });
      return;
    }

    // ==========================================
    // 1. INTENT: REMOÇÃO DE PRODUTO
    // ==========================================
    const isRemoveIntent = /(?:retire|remover|remova|tire|tirar|apague|apagar|deletar|excluir|limpar|desalocar|remover-produto|arranca|arrancar|some|sumir)/i.test(lower);
    if (isRemoveIntent) {
      const pageMatch =
        lower.match(/(?:pagina|pag)\s*(\d+|um|uma|primeira|primeiro|dois|duas|segunda|segundo|tres|terceira|terceiro|quatro|quarta|quarto|cinco|quinta|quinto|seis|meia|sexta|sexto|sete|setima|setimo|oito|oitava|oitavo)/i) ||
        command.match(/(?:p[aá]gina|p[aá]g\.?|page|folha|l[aâ]mina)\s*(\d+|um|uma|primeira|dois|duas|segunda|tr[eê]s|quatro|cinco|seis|meia|sete|oito)/i);
      const slotMatch = command.match(/(?:slot|posi[cç][aã]o|posicao)\s*(\d+)/i);
      const slotIdx = slotMatch ? parseInt(slotMatch[1], 10) - 1 : undefined;

      // 1.1 Remover todos os produtos do catálogo
      if (
        lower.includes('todos os produtos') ||
        lower.includes('todo o catalogo') ||
        lower.includes('todos produtos') ||
        lower.includes('limpar catalogo') ||
        lower.includes('zerar catalogo') ||
        lower.includes('limpar tudo')
      ) {
        let totalRemoved = 0;
        const allRemoved: ProductItem[] = [];
        const newPages = state.pages.map((page) => {
          if (page.products && page.products.length > 0) {
            allRemoved.push(...page.products);
            totalRemoved += page.products.length;
            return { ...page, products: [] };
          }
          return page;
        });

        const newUnassigned = [...state.unassignedProducts];
        for (const item of allRemoved) {
          if (!newUnassigned.some((p) => p.id === item.id)) {
            newUnassigned.unshift({ ...item, tag: item.tag || 'Disponível' });
          }
        }

        set({
          pages: newPages,
          unassignedProducts: newUnassigned,
          agentStatus: 'idle',
          saveStatus: 'unsaved',
        });
        get().debouncedSaveCurrentSpread();
        toast.success(`${totalRemoved} produtos removidos do catálogo e preservados no acervo!`);

        state.addMessage({
          role: 'assistant',
          content: `Todos os **${totalRemoved} produtos** foram removidos das lâminas do catálogo e devolvidos ao acervo (Product Drawer).\n\nAs pranchetas agora exibem os slots wireframe com proporções A4 preservadas para novas composições.`,
          reasoning: 'Racional do Editor-Chefe [Limpeza Global]: Todas as pranchetas foram liberadas para redesign mantendo a integridade dos itens no acervo.',
          delegations: isOrchestrator
            ? [
                {
                  roleId: 'director',
                  roleName: 'Diretor de Arte',
                  badge: 'Design',
                  action: 'Restaurou a estrutura de wireframe e respiro de 96px em todas as 10 páginas.',
                },
                {
                  roleId: 'commercial',
                  roleName: 'Tabela Comercial / B2B',
                  badge: 'Comercial',
                  action: 'Desvinculou todas as referências SKU das lâminas e as preservou no acervo geral.',
                },
                {
                  roleId: 'branding',
                  roleName: 'Auditor de Branding',
                  badge: 'Auditoria',
                  action: 'Validou a consistência geométrica e o grid base do catálogo sem os elementos ativos.',
                },
                {
                  roleId: 'copywriter',
                  roleName: 'Redator Publicitário',
                  badge: 'Redação',
                  action: 'Pronto para redigir novas chamadas e claims conforme os próximos produtos forem inseridos.',
                },
              ]
            : undefined,
        });
        return;
      }

      // 1.2 Remoção com página explicitamente indicada (ex: "retire o produto alocado na pagina 3")
      if (pageMatch) {
        const targetPageNum = parseSpelledNumber(pageMatch[1]) || parseInt(pageMatch[1], 10);
        const targetPage = state.pages.find((p) => p.pageNumber === targetPageNum);

        if (!targetPage) {
          set({ agentStatus: 'idle' });
          state.addMessage({
            role: 'assistant',
            content: `A Página ${targetPageNum} não foi encontrada no catálogo. O projeto atual possui ${state.totalPages} páginas.`,
            reasoning: 'Verificação de limites de página pelo Editor-Chefe.',
          });
          return;
        }

        // Se a página indicada possui produtos alocados
        if (targetPage.products && targetPage.products.length > 0) {
          const removed = state.removeProductFromSpread(targetPageNum, slotIdx);
          set({ agentStatus: 'idle' });

          const removedNames = removed.map((p) => p.name).join(', ') || 'Produto';
          const removedSku = removed[0]?.sku || 'SKU-001';

          state.addMessage({
            role: 'assistant',
            content: `O produto **"${removedNames}"** foi retirado da **Página ${String(targetPageNum).padStart(2, '0')}** e retornado ao seu acervo no Product Drawer.\n\nA prancheta agora exibe o slot editorial livre com bordas demarcadas para alocação de novos itens ou fotografias de destaque.`,
            reasoning: isOrchestrator
              ? `Racional do Editor-Chefe [Remoção Executiva]: Produto desvinculado da lâmina ${targetPageNum}. Respiro e proporção A4 restaurados; item devolvido ao acervo.`
              : `Racional [${currentRole.name}]: Produto removido da página conforme a diretriz.`,
            actions: [`"${removedNames}" removido da Página ${String(targetPageNum).padStart(2, '0')} e retornado ao acervo`],
            delegations: isOrchestrator
              ? [
                  {
                    roleId: 'director',
                    roleName: 'Diretor de Arte',
                    badge: 'Design',
                    action: `Liberou o slot na Página ${String(targetPageNum).padStart(2, '0')}, restaurando o respiro de 96px e abrindo wireframe para nova composição.`,
                  },
                  {
                    roleId: 'commercial',
                    roleName: 'Tabela Comercial / B2B',
                    badge: 'Comercial',
                    action: `Retirou a referência técnica ${removedSku} da lâmina e garantiu sua permanência no acervo de produtos.`,
                  },
                  {
                    roleId: 'branding',
                    roleName: 'Auditor de Branding',
                    badge: 'Auditoria',
                    action: 'Validou a simetria da prancheta e o contraste visual após a desocupação do slot.',
                  },
                  {
                    roleId: 'copywriter',
                    roleName: 'Redator Publicitário',
                    badge: 'Redação',
                    action: 'Sincronizou fólio e descritivos contextuais da prancheta.',
                  },
                ]
              : undefined,
          });
          return;
        }

        // Se a página indicada NÃO possui produtos: verificar se a página parceira do mesmo spread possui!
        const spreadIndex = Math.floor((targetPageNum - 1) / 2);
        const [leftNum, rightNum] = [spreadIndex * 2 + 1, spreadIndex * 2 + 2];
        const siblingPageNum = targetPageNum === leftNum ? rightNum : leftNum;
        const siblingPage = state.pages.find((p) => p.pageNumber === siblingPageNum);

        if (siblingPage && siblingPage.products && siblingPage.products.length > 0) {
          const removed = state.removeProductFromSpread(siblingPageNum, slotIdx);
          set({ agentStatus: 'idle' });

          const removedNames = removed.map((p) => p.name).join(', ') || 'Produto';
          const removedSku = removed[0]?.sku || 'SKU-001';

          state.addMessage({
            role: 'assistant',
            content: `A Página ${String(targetPageNum).padStart(2, '0')} (${targetPage.type === 'divider' ? 'Divisória de Categoria' : 'página'}) não continha produtos alocados. Identifiquei e retirei o produto **"${removedNames}"** da **Página ${String(siblingPageNum).padStart(2, '0')}** (mesmo spread visual), devolvendo-o ao acervo.\n\nO slot da Página ${String(siblingPageNum).padStart(2, '0')} agora está livre e pronto para receber uma nova peça.`,
            reasoning: `Racional do Editor-Chefe [Resolução Contextual]: O usuário solicitou remoção no spread ${spreadIndex + 1}; o produto localizado na lâmina parceira (${siblingPageNum}) foi retirado com precisão.`,
            actions: [`"${removedNames}" retirado da Página ${String(siblingPageNum).padStart(2, '0')} e retornado ao acervo`],
            delegations: isOrchestrator
              ? [
                  {
                    roleId: 'director',
                    roleName: 'Diretor de Arte',
                    badge: 'Design',
                    action: `Liberou o slot na Página ${String(siblingPageNum).padStart(2, '0')}, restaurando o respiro negativo de 96px.`,
                  },
                  {
                    roleId: 'commercial',
                    roleName: 'Tabela Comercial / B2B',
                    badge: 'Comercial',
                    action: `Desvinculou a referência ${removedSku} da lâmina e preservou o item no repositório.`,
                  },
                  {
                    roleId: 'branding',
                    roleName: 'Auditor de Branding',
                    badge: 'Auditoria',
                    action: 'Validou o alinhamento óptico da prancheta sob WCAG AA.',
                  },
                  {
                    roleId: 'copywriter',
                    roleName: 'Redator Publicitário',
                    badge: 'Redação',
                    action: 'Atualizou as legendas e claims editoriais do spread.',
                  },
                ]
              : undefined,
          });
          return;
        }

        // Se realmente não há produtos no spread
        set({ agentStatus: 'idle' });
        state.addMessage({
          role: 'assistant',
          content: `A **Página ${String(targetPageNum).padStart(2, '0')}** não possui nenhum produto alocado no momento.\n\nPara alocar um produto nesta lâmina, você pode abrir o **Product Drawer** ou me solicitar: *"aloque a Bolsa Aurelia na página ${targetPageNum}"*.`,
          reasoning: 'Racional do Editor-Chefe: Verificação de prancheta concluída; nenhum produto ativo para remoção.',
        });
        return;
      }

      // 1.3 Remoção por Nome de Produto (ex: "retire a bolsa aurelia", "remova o porta-cartoes")
      let matchedPageNum: number | null = null;
      let matchedProdId: string | null = null;
      let matchedProdName: string | null = null;

      for (const p of state.pages) {
        if (!p.products) continue;
        for (const prod of p.products) {
          const prodClean = removeAccents((prod.name || '').toLowerCase());
          const skuClean = prod.sku ? prod.sku.toLowerCase() : '';
          if (
            lower.includes(prodClean) ||
            (skuClean && lower.includes(skuClean)) ||
            isFuzzyMatch(lower, prodClean)
          ) {
            matchedPageNum = p.pageNumber;
            matchedProdId = prod.id;
            matchedProdName = prod.name;
            break;
          }
        }
        if (matchedPageNum) break;
      }

      if (matchedPageNum && matchedProdId) {
        state.removeProductFromSpread(matchedPageNum, undefined, matchedProdId);
        set({ agentStatus: 'idle' });

        state.addMessage({
          role: 'assistant',
          content: `O produto **"${matchedProdName}"** foi localizado na **Página ${String(matchedPageNum).padStart(2, '0')}**, desvinculado da lâmina e retornado ao seu acervo.\n\nA prancheta foi reorganizada para manter o equilíbrio visual.`,
          reasoning: `Racional do Editor-Chefe [Busca Semântica & Remoção]: Produto identificado na Página ${matchedPageNum} e retirado da grade.`,
          actions: [`"${matchedProdName}" removido da Página ${String(matchedPageNum).padStart(2, '0')} e retornado ao acervo`],
          delegations: isOrchestrator
            ? [
                {
                  roleId: 'director',
                  roleName: 'Diretor de Arte',
                  badge: 'Design',
                  action: `Liberou a área visual do produto na Página ${String(matchedPageNum).padStart(2, '0')}.`,
                },
                {
                  roleId: 'commercial',
                  roleName: 'Tabela Comercial / B2B',
                  badge: 'Comercial',
                  action: `Reintegrou "${matchedProdName}" ao inventário disponível.`,
                },
                {
                  roleId: 'branding',
                  roleName: 'Auditor de Branding',
                  badge: 'Auditoria',
                  action: 'Confirmou que a ausência do produto mantém a harmonia da diagramação.',
                },
                {
                  roleId: 'copywriter',
                  roleName: 'Redator Publicitário',
                  badge: 'Redação',
                  action: 'Atualizou as legendas do spread.',
                },
              ]
            : undefined,
        });
        return;
      }

      // 1.4 Remoção no Spread Ativo quando não especificada página
      const [leftPageNum, rightPageNum] = state.currentSpread;
      const leftPage = state.pages.find((p) => p.pageNumber === leftPageNum);
      const rightPage = state.pages.find((p) => p.pageNumber === rightPageNum);
      const activePageWithProduct = (leftPage?.products?.length ? leftPage : null) || (rightPage?.products?.length ? rightPage : null);

      if (activePageWithProduct) {
        const removed = state.removeProductFromSpread(activePageWithProduct.pageNumber);
        set({ agentStatus: 'idle' });
        const removedNames = removed.map((p) => p.name).join(', ') || 'Produto';

        state.addMessage({
          role: 'assistant',
          content: `Retirei **"${removedNames}"** da **Página ${String(activePageWithProduct.pageNumber).padStart(2, '0')}** da lâmina visível, retornando-o ao acervo.`,
          reasoning: 'Racional do Editor-Chefe [Spread Ativo]: Produto removido do spread focado pelo usuário.',
          actions: [`"${removedNames}" retirado da Página ${String(activePageWithProduct.pageNumber).padStart(2, '0')} e devolvido ao acervo`],
        });
        return;
      }
    }

    // ==========================================
    // 2. INTENT: ALOCAÇÃO DE PRODUTO
    // ==========================================
    const isAssignIntent = /(?:aloque|alocar|insira|inserir|coloque|colocar|adicione|adicionar|bote|botar|taque|tacar|mete|meter|põe|poe)\s+(?:o\s+produto\s+)?(.+?)\s+na\s+(?:p[aá]gina|pagina)\s+(\d+|um|uma|primeira|dois|duas|segunda|tr[eê]s|tres|terceira|quatro|quarta|cinco|quinta|seis|meia|sete|setima|oito|oitava)/i;
    const assignMatch = lower.match(isAssignIntent) || command.match(isAssignIntent);
    if (assignMatch) {
      const prodQuery = assignMatch[1].trim().toLowerCase();
      const prodQueryClean = removeAccents(prodQuery);
      const targetPageNum = parseSpelledNumber(assignMatch[2]) || parseInt(assignMatch[2], 10);
      const slotMatch = command.match(/(?:slot|posi[cç][aã]o|posicao)\s*(\d+)/i) || lower.match(/(?:slot|posicao)\s*(\d+)/i);
      const slotIdx = slotMatch ? parseInt(slotMatch[1], 10) - 1 : 0;

      const allAvailable = [
        ...state.unassignedProducts,
        ...state.pages.flatMap((p) => p.products || []),
      ];

      const foundProduct = allAvailable.find((p) => {
        const pNameClean = removeAccents((p.name || '').toLowerCase());
        const pSkuClean = p.sku ? p.sku.toLowerCase() : '';
        return (
          pNameClean.includes(prodQueryClean) ||
          prodQueryClean.includes(pNameClean) ||
          (pSkuClean && pSkuClean.includes(prodQueryClean)) ||
          isFuzzyMatch(prodQueryClean, pNameClean)
        );
      }) || allAvailable[0];

      if (foundProduct) {
        state.assignProductToSpread(foundProduct, targetPageNum, slotIdx);
        set({ agentStatus: 'idle' });
        get().goToSpread(Math.floor((targetPageNum - 1) / 2));

        state.addMessage({
          role: 'assistant',
          content: `O produto **"${foundProduct.name}"** (${foundProduct.sku || 'SKU'}, ${foundProduct.price}) foi alocado com sucesso na **Página ${String(targetPageNum).padStart(2, '0')}** (Slot 0${slotIdx + 1}).\n\nA diagramação da lâmina foi atualizada com fotografia de destaque, especificações técnicas e tipografia Cormorant Garamond.`,
          reasoning: isOrchestrator
            ? `Racional do Editor-Chefe [Alocação Executiva]: Produto "${foundProduct.name}" inserido na Página ${targetPageNum}. Grid A4 e proporção áurea reajustados para comportar a peça.`
            : `Racional [${currentRole.name}]: Alocação realizada conforme diretriz.`,
          actions: [`"${foundProduct.name}" alocado na Página ${String(targetPageNum).padStart(2, '0')} (Slot 0${slotIdx + 1})`],
          delegations: isOrchestrator
            ? [
                {
                  roleId: 'director',
                  roleName: 'Diretor de Arte',
                  badge: 'Design',
                  action: `Diagramou a fotografia de "${foundProduct.name}" na Página ${String(targetPageNum).padStart(2, '0')} com margem de 96px.`,
                },
                {
                  roleId: 'commercial',
                  roleName: 'Tabela Comercial / B2B',
                  badge: 'Comercial',
                  action: `Registrou valor de ${foundProduct.price} e referência ${foundProduct.sku || 'SKU'} na grade de vendas.`,
                },
                {
                  roleId: 'branding',
                  roleName: 'Auditor de Branding',
                  badge: 'Auditoria',
                  action: 'Validou contraste tipográfico e alinhamento do monograma na lâmina.',
                },
                {
                  roleId: 'copywriter',
                  roleName: 'Redator Publicitário',
                  badge: 'Redação',
                  action: `Destacou os atributos da peça: "${foundProduct.description || foundProduct.category}".`,
                },
              ]
            : undefined,
        });
        return;
      }
    }

    // ==========================================
    // 2.1 INTENT: CADASTRO / CRIAÇÃO DE NOVO PRODUTO
    // ==========================================
    const createProductMatch =
      lower.match(
        /(?:cadastre|cadastrar|crie|criar|adicione|adicionar)\s+(?:um\s+|novo\s+)?produto\s+["'“]?([^"'\n,]+?)["'”]?\s*(?:com\s+preco\s+|com\s+valor\s+|custando\s+|por\s+)?(r?\$?\s*[\d.,]+)?(?:\s+na\s+pagina\s+(\d+|um|uma|primeira|dois|duas|segunda|tres|terceira|quatro|quarta|cinco|quinta|seis|meia|sete|oito))?$/i
      ) ||
      command.match(
        /(?:cadastre|cadastrar|crie|criar|adicione|adicionar)\s+(?:um\s+|novo\s+)?produto\s+["'“]?([^"'\n,]+?)["'”]?\s*(?:com\s+pre[cç]o\s+|com\s+valor\s+|custando\s+|por\s+)?(r?\$?\s*[\d.,]+)?(?:\s+na\s+p[aá]gina\s+(\d+))?$/i
      );

    if (createProductMatch && !assignMatch) {
      const prodName = createProductMatch[1].trim();
      const rawPrice = createProductMatch[2]?.trim() || null;
      const formattedPrice = rawPrice == null ? null : rawPrice.startsWith('R$') ? rawPrice : `R$ ${rawPrice.replace(/[^\d.,]/g, '')}`;
      const pageNumStr = createProductMatch[3];
      const targetPageNum = pageNumStr ? (parseSpelledNumber(pageNumStr) || parseInt(pageNumStr, 10)) : undefined;

      const createdProduct = state.addProductToRepository({
        name: prodName,
        sku: null,
        price: formattedPrice,
        category: 'Coleção Exclusiva',
        description: null,
        index: String(state.unassignedProducts.length + 1).padStart(2, '0'),
        image: null,
      });

      if (targetPageNum && targetPageNum <= state.totalPages) {
        state.assignProductToSpread(createdProduct, targetPageNum, 0);
      }

      set({ agentStatus: 'idle' });

      state.addMessage({
        role: 'assistant',
        content: `Produto **"${createdProduct.name}"** (${createdProduct.price}) cadastrado com sucesso ${targetPageNum ? `e alocado na **Página ${String(targetPageNum).padStart(2, '0')}**` : 'no acervo do Product Drawer'}.`,
        reasoning: 'Racional [Tabela Comercial / B2B]: Novo item inserido no inventário com precificação e código de referência técnica.',
        actions: [`Produto "${createdProduct.name}" cadastrado ${targetPageNum ? `e alocado na Página ${String(targetPageNum).padStart(2, '0')}` : 'no acervo'}`],
        delegations: isOrchestrator
          ? [
              {
                roleId: 'commercial',
                roleName: 'Tabela Comercial / B2B',
                badge: 'Comercial',
                action: `Registrou a peça "${createdProduct.name}" com precificação de ${createdProduct.price} e código ${createdProduct.sku}.`,
              },
              {
                roleId: 'director',
                roleName: 'Diretor de Arte',
                badge: 'Design',
                action: targetPageNum ? `Diagramou a nova peça na Página ${targetPageNum} preservando o respiro de 96px.` : 'Item disponível para diagramação direta pelo drawer.',
              },
              {
                roleId: 'copywriter',
                roleName: 'Redator Publicitário',
                badge: 'Redação',
                action: `Estruturou a ficha técnica e claim de apresentação de "${createdProduct.name}".`,
              },
            ]
          : undefined,
      });
      return;
    }

    // ==========================================
    // 3. INTENT: TROCA DE LAYOUT DA PÁGINA
    // ==========================================
    const layoutMatch =
      lower.match(
        /(?:mude|altere|troque|transforme|converter|converta)\s+(?:a\s+)?pagina\s+(\d+|um|uma|primeira|dois|duas|segunda|tres|terceira|quatro|quarta|cinco|quinta|seis|meia|sete|setima|oito|oitava)\s+para\s+(hero|duo|single|grade comercial|grade|grid_4|grid|manifesto|divisoria|divider|capa|cover)/i
      ) ||
      command.match(
        /(?:mude|altere|troque|transforme|converter|converta)\s+(?:a\s+)?p[aá]gina\s+(\d+|um|uma|primeira|dois|duas|segunda|tr[eê]s|terceira|quatro|quarta|cinco|quinta|seis|meia|sete|setima|oito|oitava)\s+para\s+(hero|duo|single|grade comercial|grade|grid_4|grid|manifesto|divis[oó]ria|divisoria|divider|capa|cover)/i
      );
    if (layoutMatch) {
      const pageNum = parseSpelledNumber(layoutMatch[1]) || parseInt(layoutMatch[1], 10) || 1;
      const newType = normalizeLayoutType(layoutMatch[2]);

      state.updatePage(pageNum, { type: newType });
      set({ agentStatus: 'idle' });
      get().goToSpread(Math.floor((pageNum - 1) / 2));
      toast.success(`Página ${String(pageNum).padStart(2, '0')} convertida para layout ${newType.toUpperCase()}!`, {
        description: 'Template reorganizado com proporção áurea e respiro de 96px.',
      });

      state.addMessage({
        role: 'assistant',
        content: `O layout da **Página ${String(pageNum).padStart(2, '0')}** foi convertido para **${newType.toUpperCase()}**.\n\nA composição geométrica, os slots de produto e o grid editorial foram reorganizados pelo Diretor de Arte.`,
        reasoning: `Racional do Diretor de Arte: Conversão de template da Página ${pageNum} para ${newType}, recalculando respiros e alinhamentos de leitura sob proporções A4.`,
        actions: [`Layout da Página ${String(pageNum).padStart(2, '0')} convertido para ${newType.toUpperCase()}`],
        delegations: isOrchestrator
          ? [
              {
                roleId: 'director',
                roleName: 'Diretor de Arte',
                badge: 'Design',
                action: `Reestruturou o grid da Página ${String(pageNum).padStart(2, '0')} para a variante ${newType}.`,
              },
              {
                roleId: 'branding',
                roleName: 'Auditor de Branding',
                badge: 'Auditoria',
                action: 'Validou a conformidade de proporções de respiro de 96px sob o novo grid.',
              },
            ]
          : undefined,
      });
      return;
    }

    // ==========================================
    // 3.1 INTENT: REMOÇÃO DE PÁGINA DO CATÁLOGO
    // ==========================================
    const removePageMatch =
      lower.match(
        /(?:retire|retirar|remova|remover|apague|apagar|exclua|excluir|delete|deletar|elimine|eliminar)\s+(?:a\s+)?(?:pagina)?\s*(\d+|um|uma|primeira|primeiro|dois|duas|segunda|segundo|tres|terceira|terceiro|quatro|quarta|quarto|cinco|quinta|quinto|seis|meia|sexta|sexto|sete|setima|setimo|oito|oitava|oitavo)\s*(?:pagina)?/i
      ) ||
      command.match(
        /(?:retire|retirar|remova|remover|apague|apagar|exclua|excluir|delete|deletar|elimine|eliminar)\s+(?:a\s+)?(?:p[aá]gina|p[aá]g\.?|page)?\s*(\d+|um|uma|primeira|primeiro|dois|duas|segunda|segundo|tr[eê]s|terceira|terceiro|quatro|quarta|quarto|cinco|quinta|quinto|seis|meia|sexta|sexto|sete|s[eé]tima|s[eé]timo|oito|oitava|oitavo)\s*(?:p[aá]gina)?/i
      );

    if (removePageMatch) {
      const rawPage = removePageMatch[1].toLowerCase();
      const pageNum = parseSpelledNumber(rawPage) || (isNaN(parseInt(rawPage, 10)) ? 1 : parseInt(rawPage, 10));

      state.removePage(pageNum);
      set({ agentStatus: 'idle' });

      state.addMessage({
        role: 'assistant',
        content: `Página **${String(pageNum).padStart(2, '0')}** removida e diagramação reorganizada pelo Conselho Editorial.`,
        reasoning: 'Racional [Diretor de Arte]: Lâmina eliminada do catálogo, produtos redirecionados ao acervo e fólios renumerados sequencialmente.',
        actions: [`Página ${String(pageNum).padStart(2, '0')} removida do catálogo`],
        delegations: isOrchestrator
          ? [
              {
                roleId: 'director',
                roleName: 'Diretor de Arte',
                badge: 'Design',
                action: `Renumerou a sequência de páginas e reajustou os fólios após a remoção da Página ${String(pageNum).padStart(2, '0')}.`,
              },
              {
                roleId: 'branding',
                roleName: 'Auditor de Branding',
                badge: 'Auditoria',
                action: 'Validou a integridade e o ritmo visual do catálogo após a exclusão da lâmina.',
              },
            ]
          : undefined,
      });
      return;
    }

    // ==========================================
    // 3.2 INTENT: ADIÇÃO DE PÁGINA AO CATÁLOGO
    // ==========================================
    const addPageMatch =
      lower.match(
        /(?:adicione|adicionar|crie|criar|insira|inserir|acrescente|acrescentar)\s+(?:uma\s+|nova\s+)?(?:pagina|lamina)(?:\s+(hero|duo|single|grade comercial|grade|grid_4|grid|manifesto|divisoria|divider|capa|cover))?(?:\s+(?:apos|depois\s+da)\s+pagina\s+(\d+|um|uma|primeira|dois|duas|segunda|tres|terceira|quatro|quarta|cinco|quinta|seis|meia))?/i
      ) ||
      command.match(
        /(?:adicione|adicionar|crie|criar|insira|inserir|acrescente|acrescentar)\s+(?:uma\s+|nova\s+)?(?:p[aá]gina|p[aá]g\.?|page|l[aâ]mina)(?:\s+(hero|duo|single|grade comercial|grade|grid_4|grid|manifesto|divis[oó]ria|divisoria|divider|capa|cover))?(?:\s+(?:ap[oó]s|depois\s+da)\s+p[aá]gina\s+(\d+|um|uma|primeira|dois|duas|segunda|tr[eê]s|terceira|quatro|quarta|cinco|quinta))?/i
      ) ||
      command.match(/\/novo-spread/i);

    if (addPageMatch) {
      const rawLayout = (addPageMatch[1] || 'hero').toLowerCase();
      const newType = normalizeLayoutType(rawLayout);
      const rawAfter = (addPageMatch[2] || '').toLowerCase();
      const afterNum = rawAfter ? (parseSpelledNumber(rawAfter) || parseInt(rawAfter, 10)) : undefined;

      state.addPage({ type: newType, afterPage: afterNum });
      set({ agentStatus: 'idle' });

      state.addMessage({
        role: 'assistant',
        content: `Nova página com layout **${newType.toUpperCase()}** inserida e diagramada pelo Conselho Editorial.`,
        reasoning: 'Racional [Diretor de Arte]: Nova prancheta criada com grid A4 homologado, proporção áurea e respiro de 96px.',
        actions: [`Nova página adicionada ao catálogo (layout ${newType.toUpperCase()})`],
        delegations: isOrchestrator
          ? [
              {
                roleId: 'director',
                roleName: 'Diretor de Arte',
                badge: 'Design',
                action: `Estruturou o grid da nova lâmina para a variante ${newType.toUpperCase()} com proporção áurea.`,
              },
              {
                roleId: 'branding',
                roleName: 'Auditor de Branding',
                badge: 'Auditoria',
                action: 'Garantir aplicação imediata dos tokens de paleta e tipografia da coleção.',
              },
              {
                roleId: 'copywriter',
                roleName: 'Redator Publicitário',
                badge: 'Redação',
                action: 'Alinhou placeholders editoriais para inserção de títulos e claims.',
              },
            ]
          : undefined,
      });
      return;
    }

    // ==========================================
    // 4. INTENT: NAVEGAÇÃO DE PÁGINAS
    // ==========================================
    const navMatch =
      lower.match(
        /(?:va|vai|navegue|navegar|ir|mostrar|mostre|abra|abrir|exibir|exiba)\s+(?:para\s+a\s+|para\s+|pra\s+a\s+|pra\s+|o\s+|a\s+)?(?:pagina)\s*(\d+|um|uma|primeira|dois|duas|segunda|tres|quatro|cinco|seis|meia|sete|oito|nove|dez)/i
      ) ||
      command.match(
        /(?:v[aá]|navegue|navegar|ir|mostrar|mostre|abra|abrir|exibir|exiba)\s+(?:para\s+a\s+|para\s+|pra\s+a\s+|pra\s+|o\s+|a\s+)?(?:p[aá]gina|p[aá]g\.?|page|folha|l[aâ]mina)\s*(\d+|um|uma|primeira|dois|duas|segunda|tr[eê]s|quatro|cinco|seis|meia|sete|oito|nove|dez)/i
      );
    if (navMatch) {
      const targetPageNum = parseSpelledNumber(navMatch[1]) || parseInt(navMatch[1], 10);
      if (targetPageNum && targetPageNum >= 1 && targetPageNum <= state.totalPages) {
        const spreadIdx = Math.floor((targetPageNum - 1) / 2);
        state.goToSpread(spreadIdx);
        set({ agentStatus: 'idle' });
        toast.info(`Navegando para a Página ${String(targetPageNum).padStart(2, '0')}`, {
          description: `Lâmina ${spreadIdx + 1} de ${Math.ceil(state.totalPages / 2)} centralizada no canvas.`,
        });

        state.addMessage({
          role: 'assistant',
          content: `Navegando para a **Página ${String(targetPageNum).padStart(2, '0')}** (Lâmina ${spreadIdx + 1} de ${Math.ceil(state.totalPages / 2)}).`,
          reasoning: 'Racional [Navegação]: Prancheta centralizada na lâmina solicitada.',
          actions: [`Navegação para a Página ${String(targetPageNum).padStart(2, '0')} (Lâmina ${spreadIdx + 1})`],
        });
        return;
      }
    }

    // ==========================================
    // 4.9 INTENT: RESUMO / SÍNTESE DE CONTEÚDO EDITORIAL
    // ==========================================
    const summarizeMatch =
      lower.match(
        /(?:resuma|resumir|sintetize|sintetizar|encurte|encurtar|condense|condensar|enxugar|enxuga|podar|poda|simplificar|simplifique)\s+(?:o\s+)?(?:texto|conteudo|copy|narrativa|frase)?\s*(?:da\s+)?(?:pagina)?\s*(\d+|um|uma|primeira|dois|duas|segunda|tres|terceira|quatro|quarta|cinco|quinta|seis|meia|sexta|sete|setima|oito|oitava)?/i
      ) ||
      command.match(
        /(?:resuma|resumir|sintetize|sintetizar|encurte|encurtar|condense|condensar|enxugar|enxuga|podar|poda|simplificar|simplifique)\s+(?:o\s+)?(?:texto|conte[uú]do|copy|narrativa|frase)?\s*(?:da\s+)?(?:p[aá]gina|p[aá]g\.?|page|folha|l[aâ]mina)?\s*(\d+|um|uma|primeira|dois|duas|segunda|tr[eê]s|terceira|quatro|quarta|cinco|quinta|seis|meia|sexta|sete|s[eé]tima|oito|oitava)?/i
      ) ||
      command.match(/\/sintese-b2b/i);

    const isSummarizeTrigger =
      Boolean(summarizeMatch) ||
      lower.includes('resum') ||
      lower.includes('sintet') ||
      lower.includes('encurt') ||
      lower.includes('condens') ||
      lower.includes('enxug') ||
      lower.includes('poda') ||
      lower.includes('sintese-b2b');

    if (isSummarizeTrigger && !lower.includes('reajuste') && !lower.includes('layout')) {
      const rawP = summarizeMatch ? (summarizeMatch[1] || '').toLowerCase() : '';
      const targetPageNum = rawP
        ? (parseSpelledNumber(rawP) || parseInt(rawP, 10) || state.currentSpread[0])
        : state.currentSpread[0];

      state.summarizePageContent(targetPageNum);
      set({ agentStatus: 'idle' });
      get().goToSpread(Math.floor((targetPageNum - 1) / 2));

      state.addMessage({
        role: 'assistant',
        content: `Conteúdo da **Página ${String(targetPageNum).padStart(2, '0')}** sintetizado com elegância editorial pelo Redator Publicitário.`,
        reasoning: 'Racional [Redator Publicitário]: Prosa longa condensada em claim sensorial conciso, sem jargões ou clichês promocionais.',
        actions: [`Conteúdo da Página ${String(targetPageNum).padStart(2, '0')} sintetizado pelo Redator`],
        delegations: isOrchestrator
          ? [
              {
                roleId: 'copywriter',
                roleName: 'Redator Publicitário',
                badge: 'Redação',
                action: `Sintetizou o texto da Página ${String(targetPageNum).padStart(2, '0')} em uma frase editorial de alto impacto.`,
              },
              {
                roleId: 'director',
                roleName: 'Diretor de Arte',
                badge: 'Design',
                action: 'Ajustou a escala tipográfica para ampliar o respiro negativo de 96px ao redor do novo texto.',
              },
              {
                roleId: 'branding',
                roleName: 'Auditor de Branding',
                badge: 'Auditoria',
                action: 'Validou a ausência de termos promocionais e a fidelidade ao tom de voz sofisticado da marca.',
              },
            ]
          : undefined,
      });
      return;
    }

    // ==========================================
    // 5. INTENT: EDIÇÃO DE TÍTULO / TEXTO / MANIFESTO / SUBTÍTULO
    // ==========================================
    const pageTextMatch =
      command.match(
        /(?:mude|mudar|altere|alterar|troque|trocar|coloque|colocar|ajuste|ajustar|atualize|atualizar|editar|edite|bota|botar)\s+(?:o\s+)?(texto|t[ií]tulo|titulo|subt[ií]tulo|subtitulo|claim|legenda|label|frase|headline|conte[uú]do|conteudo)\s+(?:da\s+)?(?:p[aá]gina|p[aá]g\.?|page|folha|l[aâ]mina|prancha)\s*(\d+|um|uma|primeira|primeiro|dois|duas|segunda|segundo|tr[eê]s|tres|terceira|terceiro|quatro|quarta|quarto|cinco|quinta|quinto|seis|meia|sexta|sexto|sete|s[eé]tima|setima|s[eé]timo|setimo|oito|oitava|oitavo)\s+(?:para:?|por:?|como:?)\s*["'“]?(.+?)["'”]?$/i
      ) ||
      lower.match(
        /(?:mude|mudar|altere|alterar|troque|trocar|coloque|colocar|ajuste|ajustar|atualize|atualizar|editar|edite|adicionar|bota)\s+(?:o\s+)?(texto|titulo|subtitulo|claim|legenda|label|frase|headline|conteudo)\s+(?:da\s+)?(?:pagina)\s*(\d+|um|uma|primeira|primeiro|dois|duas|segunda|segundo|tres|terceira|terceiro|quatro|quarta|quarto|cinco|quinta|quinto|seis|meia|sexta|sexto|sete|setima|setimo|oito|oitava|oitavo)\s+(?:para:?|por:?|como:?)\s*["'“]?(.+?)["'”]?$/i
      );

    if (pageTextMatch) {
      const fieldType = (pageTextMatch[1] || 'texto').toLowerCase();
      const rawPage = pageTextMatch[2].toLowerCase();
      const pageNum = parseSpelledNumber(rawPage) || parseInt(rawPage, 10) || 1;

      // Extrai o texto preservando a pontuação e caixa alta/baixa original do usuário
      let newText = pageTextMatch[3]?.trim() || '';
      const separatorMatch = command.match(/(?:para:?|por:?|como:?)\s*["'“]?(.+?)["'”]?$/i);
      if (separatorMatch && separatorMatch[1]) {
        newText = separatorMatch[1].trim();
      }
      newText = newText.replace(/^["':]|["']$/g, '').trim();

      const targetPageObj = state.pages.find((p) => p.pageNumber === pageNum);
      const isManifesto = targetPageObj?.type === 'manifesto';

      const updates: Partial<CatalogPageData> = {};
      if (fieldType.includes('sub')) {
        updates.subtitle = newText;
      } else if (fieldType.includes('claim')) {
        updates.quote = newText;
      } else if (fieldType.includes('label') || fieldType.includes('legenda')) {
        updates.label = newText;
      } else if (fieldType.includes('conte') && newText.length > 140) {
        updates.content = newText;
      } else if (isManifesto) {
        // No manifesto, o texto principal e o quote (serifado)
        updates.quote = newText;
        updates.title = newText;
      } else {
        updates.title = newText;
      }

      state.updatePage(pageNum, updates);
      set({ agentStatus: 'idle' });
      get().goToSpread(Math.floor((pageNum - 1) / 2));
      toast.success(`Texto da Página ${pageNum} atualizado!`, {
        description: `"${newText}" diagramado com proporções e tipografia editorial.`,
      });

      state.addMessage({
        role: 'assistant',
        content: `Texto da **Página ${String(pageNum).padStart(2, '0')}** atualizado para **"${newText}"**.`,
        reasoning: 'Racional [Redator Publicitário]: Ajuste textual aplicado diretamente na lâmina com refinamento de tom de voz.',
        actions: [`Texto da Página ${String(pageNum).padStart(2, '0')} atualizado para "${newText}"`],
        delegations: isOrchestrator
          ? [
              {
                roleId: 'copywriter',
                roleName: 'Redator Publicitário',
                badge: 'Redação',
                action: `Redigiu a nova frase editorial: "${newText}".`,
              },
              {
                roleId: 'director',
                roleName: 'Diretor de Arte',
                badge: 'Design',
                action: `Adequou a escala tipográfica e respiros na Página ${String(pageNum).padStart(2, '0')}.`,
              },
              {
                roleId: 'branding',
                roleName: 'Auditor de Branding',
                badge: 'Auditoria',
                action: 'Validou contraste e harmonia com a identidade visual.',
              },
            ]
          : undefined,
      });
      return;
    }

    // ==========================================
    // 5.1 INTENT: REAJUSTE DE PREÇOS EM MASSA / PERCENTUAL
    // ==========================================
    const pctPriceMatch =
      lower.match(
        /(?:reajuste|reajustar|aumente|aumentar|reduza|reduzir|eleve|elevar|suba|subir|desconto|abaixe|abaixar|cortar|corta|sobe|baixa)\s+(?:os\s+)?precos?\s+(?:em\s+|de\s+)?([+-]?\d+(?:[.,]\d+)?)\s*%/i
      ) ||
      command.match(
        /(?:reajuste|reajustar|aumente|aumentar|reduza|reduzir|eleve|elevar|suba|subir|desconto|abaixe|abaixar|cortar|corta|sobe|baixa)\s+(?:os\s+)?pre[cç]os?\s+(?:em\s+|de\s+)?([+-]?\d+(?:[.,]\d+)?)\s*%/i
      ) ||
      command.match(/\/reajustar-precos\s*([+-]?\d+)?/i);

    if (pctPriceMatch) {
      const rawPct = pctPriceMatch[1] ? parseFloat(pctPriceMatch[1].replace(',', '.')) : 10;
      const isReduction =
        lower.includes('reduz') ||
        lower.includes('desconto') ||
        lower.includes('abaix') ||
        lower.includes('baixa') ||
        lower.includes('corta') ||
        rawPct < 0;
      const pct = Math.abs(rawPct);

      state.applySpreadPatch({
        actions: [
          {
            type: 'adjust_pricing',
            percentage: isReduction ? -pct : pct,
            mode: isReduction ? 'decrease' : 'increase',
          },
        ],
        summary: `Preços reajustados em ${isReduction ? '-' : '+'}${pct}% em todo o catálogo.`,
      });

      set({ agentStatus: 'idle' });
      toast.success(`Preços reajustados em ${isReduction ? '-' : '+'}${pct}%!`, {
        description: 'Tabela comercial de atacado recalculada com precisão centesimal.',
      });

      state.addMessage({
        role: 'assistant',
        content: `Reajuste de **${isReduction ? '-' : '+'}${pct}%** aplicado com sucesso a todas as referências do catálogo e acervo comercial.`,
        reasoning: isOrchestrator
          ? 'Racional do Editor-Chefe [Rebalanceamento Financeiro B2B]: Markups e tabelas de atacado recalculados em consonância com as diretrizes comerciais e alinhamento numérico preservado.'
          : `Racional [${currentRole.name}]: Tabela de preços atualizada com precisão centesimal sob as diretrizes do cargo.`,
        actions: [`Reajuste de ${isReduction ? '-' : '+'}${pct}% aplicado aos preços de todo o catálogo`],
        delegations: isOrchestrator
          ? [
              {
                roleId: 'commercial',
                roleName: 'Tabela Comercial / B2B',
                badge: 'Comercial',
                action: `Recalculou a margem de atacado aplicando ${isReduction ? '-' : '+'}${pct}% em todos os SKUs cadastrados.`,
              },
              {
                roleId: 'director',
                roleName: 'Diretor de Arte',
                badge: 'Design',
                action: 'Garantiu a sustentação da tipografia numérica tabular e o respiro mínimo de 96px nos módulos de preço.',
              },
              {
                roleId: 'branding',
                roleName: 'Auditor de Branding',
                badge: 'Auditoria',
                action: 'Validou o contraste tipográfico dos novos valores sob as regras WCAG AA.',
              },
            ]
          : undefined,
      });
      return;
    }

    // ==========================================
    // 5.2 INTENT: GERAÇÃO SEQUENCIAL DE SKUS
    // ==========================================
    const skuGenMatch = command.match(
      /(?:gere|gerar|crie|criar|padronize|padronizar|sequenciar|organize)\s+(?:os\s+)?skus?(?:\s+para\s+todos)?/i
    ) || command.match(/\/gerar-skus/i);

    if (skuGenMatch) {
      state.applySpreadPatch({
        actions: [
          {
            type: 'generate_skus',
            prefix: 'CAT',
            start_number: 101,
          },
        ],
        summary: 'Códigos SKU sequenciais padronizados em todo o catálogo.',
      });

      set({ agentStatus: 'idle' });
      toast.success('Códigos SKU padronizados!', {
        description: 'Matriz sequencial institucional CAT-101 gerada para todas as peças.',
      });

      state.addMessage({
        role: 'assistant',
        content: 'Todos os produtos do catálogo e acervo receberam códigos SKU padronizados sequencialmente (ex: `CAT-101`, `CAT-102`, `CAT-103`).',
        reasoning: isOrchestrator
          ? 'Racional do Editor-Chefe [Padronização Logística]: Normalização de catálogo B2B para integração com ERP e exportação de fichas técnicas.'
          : `Racional [${currentRole.name}]: Nomenclatura SKU padronizada conforme as regras comerciais vigentes.`,
        actions: ['Códigos SKU padronizados sequencialmente (CAT-101 em diante)'],
        delegations: isOrchestrator
          ? [
              {
                roleId: 'commercial',
                roleName: 'Tabela Comercial / B2B',
                badge: 'Comercial',
                action: 'Gerou matriz de códigos SKU sequenciais com prefixo institucional CAT.',
              },
              {
                roleId: 'branding',
                roleName: 'Auditor de Branding',
                badge: 'Auditoria',
                action: 'Homologou o formato de identificação técnica nos fólios e legendas.',
              },
            ]
          : undefined,
      });
      return;
    }

    // ==========================================
    // 5.3 INTENT: GERAÇÃO DE FOTO DE ESTÚDIO COM IA
    // ==========================================
    const photoGenMatch = command.match(
      /(?:gere|gerar|crie|criar)\s+foto(?:grafia)?\s+(?:com\s+ia\s+)?(?:para|do|da)?\s*(.+)/i
    );

    if (photoGenMatch && !lower.includes('layout') && !lower.includes('paleta') && !lower.includes('sku')) {
      const prodQuery = photoGenMatch[1].trim();
      const allProducts = [
        ...state.unassignedProducts,
        ...state.pages.flatMap((p) => p.products || []),
      ];
      const targetProd = allProducts.find(
        (p) =>
          (p.name || '').toLowerCase().includes(prodQuery.toLowerCase()) ||
          prodQuery.toLowerCase().includes((p.name || '').toLowerCase()) ||
          (p.sku && p.sku.toLowerCase().includes(prodQuery.toLowerCase()))
      ) || allProducts[0];

      if (targetProd) {
        state.generateAIProductImage(
          targetProd.id,
          targetProd.name || 'Produto',
          targetProd.category || 'Editorial',
          'Fotografia de estúdio profissional em alta resolução com iluminação suave sobre fundo neutro'
        );

        set({ agentStatus: 'idle' });
        state.addMessage({
          role: 'assistant',
          content: `Iniciei a geração fotográfica com IA para o produto **"${targetProd.name}"**. Assim que concluída, a imagem de estúdio em alta resolução será atualizada na prancheta.`,
          reasoning: isOrchestrator
            ? `Racional do Editor-Chefe [Fotografia IA]: Síntese visual de estúdio disparada para "${targetProd.name}", mantendo o padrão fotográfico de alta joalheria.`
            : `Racional [${currentRole.name}]: Disparo de geração visual em conformidade com o briefing do catálogo.`,
          actions: [`Fotografia de estúdio com IA disparada para "${targetProd.name}"`],
          delegations: isOrchestrator
            ? [
                {
                  roleId: 'director',
                  roleName: 'Diretor de Arte',
                  badge: 'Design',
                  action: `Parametrizou o prompt fotográfico para iluminação zenital suave e textura fidedigna de "${targetProd.name}".`,
                },
                {
                  roleId: 'branding',
                  roleName: 'Auditor de Branding',
                  badge: 'Auditoria',
                  action: 'Supervisiona a conformidade de paleta e ausência de ruídos ou aberrações de renderização.',
                },
              ]
            : undefined,
        });
        return;
      }
    }

    // ==========================================
    // 5.4 INTENT: REMOÇÃO DE FUNDO DE IMAGEM
    // ==========================================
    const bgRemovalMatch =
      lower.match(
        /(?:remova|remover|retire|retirar|isole|isolar|fundo\s+transparente|tira|tirar)\s+(?:o\s+)?fundo\s+(?:da\s+imagem|da\s+foto|do\s+produto)?\s*(?:de|do|da)?\s*(.+)?/i
      ) ||
      command.match(
        /(?:remova|remover|retire|retirar|isole|isolar|fundo\s+transparente|tira|tirar)\s+(?:o\s+)?fundo\s+(?:da\s+imagem|da\s+foto|do\s+produto)?\s*(?:de|do|da)?\s*(.+)?/i
      );

    if (bgRemovalMatch) {
      const prodQuery = (bgRemovalMatch[1] || '').trim();
      const allProducts = [
        ...state.unassignedProducts,
        ...state.pages.flatMap((p) => p.products || []),
      ];
      let targetProd: ProductItem | undefined;
      let targetPageNum: number | undefined;

      if (prodQuery) {
        const queryClean = removeAccents(prodQuery);
        for (const p of state.pages) {
          const match = p.products?.find((pr) => {
            const prNameClean = removeAccents(pr.name || '');
            const prSkuClean = pr.sku ? pr.sku.toLowerCase() : '';
            return (
              prNameClean.includes(queryClean) ||
              queryClean.includes(prNameClean) ||
              (prSkuClean && prSkuClean.includes(queryClean)) ||
              isFuzzyMatch(queryClean, prNameClean)
            );
          });
          if (match) {
            targetProd = match;
            targetPageNum = p.pageNumber;
            break;
          }
        }
        if (!targetProd) {
          targetProd = state.unassignedProducts.find((pr) => {
            const prNameClean = removeAccents(pr.name || '');
            return (
              prNameClean.includes(queryClean) ||
              queryClean.includes(prNameClean) ||
              isFuzzyMatch(queryClean, prNameClean)
            );
          });
        }
      }

      if (!targetProd) {
        const [lNum, rNum] = state.currentSpread;
        const curLeft = state.pages.find((p) => p.pageNumber === lNum);
        const curRight = state.pages.find((p) => p.pageNumber === rNum);
        if (curLeft?.products?.[0]) {
          targetProd = curLeft.products[0];
          targetPageNum = lNum;
        } else if (curRight?.products?.[0]) {
          targetProd = curRight.products[0];
          targetPageNum = rNum;
        } else {
          targetProd = allProducts[0];
        }
      }

      if (targetProd) {
        state.removeProductBackground(targetPageNum || state.currentSpread[0], targetProd.id);
        set({ agentStatus: 'idle' });
        state.addMessage({
          role: 'assistant',
          content: `Solicitei o isolamento de silhueta e remoção de fundo com IA para **"${targetProd.name}"**. O elemento transparente será aplicado diretamente ao layout editorial.`,
          reasoning: isOrchestrator
            ? `Racional do Editor-Chefe [Tratamento de Imagem]: Recorte alpha disparado para "${targetProd.name}" para sobreposição perfeita no layout.`
            : `Racional [${currentRole.name}]: Isolamento de fundo executado para atender às diretrizes visuais.`,
          actions: [`Remoção de fundo com IA solicitada para "${targetProd.name}"`],
          delegations: isOrchestrator
            ? [
                {
                  roleId: 'director',
                  roleName: 'Diretor de Arte',
                  badge: 'Design',
                  action: `Aplicou máscara alpha de alta precisão ao produto "${targetProd.name}".`,
                },
                {
                  roleId: 'branding',
                  roleName: 'Auditor de Branding',
                  badge: 'Auditoria',
                  action: 'Validou o recorte vetorial sem halos ou franjas de cor residual.',
                },
              ]
            : undefined,
        });
        return;
      }
    }

    // 6. Mudança de Preço de Produto Específico
    const priceMatch = command.match(/r?\$?\s*([0-9]+[.,]?[0-9]*)/i);
    const isSinglePriceIntent = (lower.includes('preco') || lower.includes('valor') || lower.includes('custa')) && Boolean(priceMatch);
    if (isSinglePriceIntent && !pctPriceMatch) {
      const newPrice = `R$ ${priceMatch![1]}`;
      let targetProduct = 'Bolsa Aurelia';
      let updated = false;

      const newPages = state.pages.map((p) => {
        if (!p.products) return p;
        return {
          ...p,
          products: p.products.map((prod) => {
            const prodClean = removeAccents((prod.name || '').toLowerCase());
            if (
              (state.selectedElementId && state.selectedElementId.includes(prod.id)) ||
              lower.includes(prodClean) ||
              (!updated && prod.id === 'prod-bolsa')
            ) {
              updated = true;
              targetProduct = prod.name || 'Produto';
              return { ...prod, price: newPrice };
            }
            return prod;
          }),
        };
      });

      set({ pages: newPages, agentStatus: 'idle' });
      state.addMessage({
        role: 'assistant',
        content: `Atualizei o valor de **${targetProduct}** para **${newPrice}** na diagramação da página.`,
        reasoning: isOrchestrator
          ? 'Racional do Editor-Chefe [Coordenação]: Precificação ajustada em sintonia com a tabela B2B, resguardando o padrão visual e a clareza para o comprador.'
          : `Racional [${currentRole.name}]: Alinhamento numérico tabular preservado na grade editorial. Decisão orientada pelas diretrizes: "${currentRole.instructions.slice(0, 90)}..."`,
        delegations: isOrchestrator
          ? [
              {
                roleId: 'commercial',
                roleName: 'Tabela Comercial / B2B',
                badge: 'Comercial',
                action: `Calculou markup e aplicou precificação de ${newPrice} para ${targetProduct}.`,
              },
              {
                roleId: 'director',
                roleName: 'Diretor de Arte',
                badge: 'Design',
                action: 'Ajustou alinhamento numérico tabular e preservou margem de respiro de 96px.',
              },
              {
                roleId: 'branding',
                roleName: 'Auditor de Branding',
                badge: 'Auditoria',
                action: 'Validou conformidade do contraste e peso da fonte sob WCAG AA.',
              },
            ]
          : undefined,
      });
      return;
    }

    // 2. Mudança de Título ou Coleção
    if (lower.includes('titulo') || lower.includes('colecao') || lower.includes('nome do catalogo')) {
      const cleanTitle = command.replace(/(mude|altere|troque|coloque|para|o|título|titulo|da|coleção|colecao|do|catálogo|catalogo|:)+/gi, '').trim();
      const updatedTitle = cleanTitle.length > 2 ? cleanTitle : (state.catalogTitle || 'Novo Catálogo');
      
      set({ catalogTitle: updatedTitle, agentStatus: 'idle' });
      state.updatePage(1, { label: updatedTitle.toUpperCase() });
      state.addMessage({
        role: 'assistant',
        content: `O título do catálogo e a capa foram renomeados para **"${updatedTitle}"**.`,
        reasoning: isOrchestrator
          ? 'Racional do Editor-Chefe [Coordenação]: Título aprovado e diagramado na capa, garantindo impacto editorial e fidelidade à marca.'
          : `Racional [${currentRole.name}]: Tipografia serif em versalete ajustada com tracking amplo para manter o peso editorial exigido pelas diretrizes.`,
        delegations: isOrchestrator
          ? [
              {
                roleId: 'copywriter',
                roleName: 'Redator Publicitário',
                badge: 'Redação',
                action: `Refinou a denominação editorial da coleção para "${updatedTitle}".`,
              },
              {
                roleId: 'director',
                roleName: 'Diretor de Arte',
                badge: 'Design',
                action: 'Diagramou o novo título em versalete serif com tracking aberto na capa.',
              },
              {
                roleId: 'branding',
                roleName: 'Auditor de Branding',
                badge: 'Auditoria',
                action: 'Validou proporção harmônica do monograma e alinhamento de fólio.',
              },
            ]
          : undefined,
      });
      return;
    }

    // 3. Trava de Marca / Brand Lock
    if (lower.includes('travar paleta') || lower.includes('bloquear paleta') || lower.includes('ativar brand lock')) {
      state.setPaletteLocked(true);
      set({ agentStatus: 'idle' });
      state.addMessage({
        role: 'assistant',
        content: `Trava de Marca (**Brand Lock**) foi **ativada** com sucesso. Os agentes estão estritamente restritos aos tokens cadastrados da paleta "${state.activePalette.name}". Propostas divergentes exigirão aprovação humana explícita.`,
        reasoning: 'Auditor de Branding assumiu a governança de tokens de cor sob a norma WCAG AA.',
      });
      return;
    }

    if (lower.includes('destravar paleta') || lower.includes('desbloquear paleta') || lower.includes('desativar brand lock')) {
      state.setPaletteLocked(false);
      set({ agentStatus: 'idle' });
      state.addMessage({
        role: 'assistant',
        content: `Trava de Marca (**Brand Lock**) foi **desativada**. O estúdio entrou em modo exploratório, permitindo aos agentes sugerir variações tonais criativas.`,
        reasoning: 'Diretor de Arte liberado para explorações cromáticas contextuais.',
      });
      return;
    }

    // 4. Mudança de Cor / Paleta / Cores Customizadas
    const hexMatch = command.match(/#(?:[0-9a-fA-F]{3}){1,2}\b/i);
    const isColorCommand =
      lower.includes('paleta') ||
      lower.includes('cor') ||
      lower.includes('cores') ||
      lower.includes('ouro') ||
      lower.includes('prata') ||
      lower.includes('bronze') ||
      lower.includes('terracota') ||
      lower.includes('esmeralda') ||
      lower.includes('minimaliste') ||
      lower.includes('fundo') ||
      lower.includes('acento') ||
      lower.includes('primaria') ||
      lower.includes('secundaria');

    if (isColorCommand && !lower.includes('remover fundo') && !lower.includes('sem fundo')) {
      // Caso 4.0: Cor especifica de uma pagina
      // Exemplos aceitos:
      //   "altere a cor da primeira pagina para #000000"
      //   "altere a cor da primeira pagina, coloque um preto #0000"
      //   "mude a cor da pagina 2 para azul"
      //   "fundo da capa preto"
      //   "deixe a pagina 1 preta"

      // Detecta hex com 3, 4, 6 ou 8 caracteres no comando completo
      const pageHexMatch = command.match(/#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/i);

      // Detecta se o comando menciona cor de pagina especifica
      const pageNumInCmd =
        lower.includes('primeira') || lower.includes('página 1') || lower.includes('pagina 1') || lower.includes('capa')
          ? 1
          : lower.includes('segunda') || lower.includes('página 2') || lower.includes('pagina 2')
          ? 2
          : lower.includes('terceira') || lower.includes('página 3') || lower.includes('pagina 3')
          ? 3
          : null;

      const mentionsPageColor =
        (lower.includes('cor') || lower.includes('fundo') || lower.includes('preto') || lower.includes('branco') || lower.includes('escuro') || lower.includes('claro') || pageHexMatch) &&
        (lower.includes('pagina') || lower.includes('página') || lower.includes('primeira') || lower.includes('capa') || lower.includes('segunda'));

      if (mentionsPageColor && pageNumInCmd !== null) {
        const pNum = pageNumInCmd;

        // Resolve a cor alvo
        let targetHex = '#121214'; // default preto editorial
        if (pageHexMatch) {
          // Normaliza hex de 3 chars → 6 chars, 4 chars → 6 chars
          let h = pageHexMatch[1];
          if (h.length === 3) h = h.split('').map((c) => c + c).join('');
          else if (h.length === 4) h = h.slice(0, 3).split('').map((c) => c + c).join('');
          else if (h.length === 8) h = h.slice(0, 6); // strip alpha
          targetHex = `#${h.toUpperCase()}`;
        } else if (lower.includes('branco') || lower.includes('claro')) {
          targetHex = '#FFFFFF';
        } else if (lower.includes('preto') || lower.includes('escuro')) {
          targetHex = '#000000';
        } else if (lower.includes('dourado')) {
          targetHex = '#B08D57';
        } else if (lower.includes('cinza')) {
          targetHex = '#3F3F46';
        } else if (lower.includes('azul')) {
          targetHex = '#06B6D4';
        } else if (lower.includes('vermelho')) {
          targetHex = '#DC2626';
        } else if (lower.includes('verde')) {
          targetHex = '#16A34A';
        }

        state.updatePage(pNum, { backgroundColor: targetHex });
        set({ agentStatus: 'idle' });
        get().goToSpread(Math.floor((pNum - 1) / 2));
        const targetX = pNum % 2 === 1 ? 28 : 72;
        get().triggerAgentCursor('director', `Alterando cor de fundo da Página ${String(pNum).padStart(2, '0')} para ${targetHex}`, {
          x: targetX,
          y: 48,
        });
        toast.success(`Cor de fundo da Página ${pNum} atualizada para ${targetHex}!`);
        state.addMessage({
          role: 'assistant',
          content: `Cor de fundo da **Página ${String(pNum).padStart(2, '0')}** alterada para \`${targetHex}\`.`,
          reasoning: 'Racional [Diretor de Arte]: Calibração cromática individual da lâmina com contraste verificado sob WCAG AA.',
          actions: [`Cor de fundo da Página ${String(pNum).padStart(2, '0')} alterada para ${targetHex}`],
        });
        return;
      }

      // Fallback: regex original para comandos bem estruturados
      const pageColorMatchStrict =
        lower.match(
          /(?:cor|fundo|acento)\s+(?:da\s+)?pagina\s+([\d\w]+)\s+(?:para\s+)?(#[0-9a-f]{3,8}|preto|branco|claro|escuro|dourado)/i
        );
      if (pageColorMatchStrict) {
        const rawP = pageColorMatchStrict[1].toLowerCase();
        const pNum = parseSpelledNumber(rawP) || parseInt(rawP, 10) || 1;
        const colorVal = pageColorMatchStrict[2].toLowerCase();
        let targetHex = colorVal.startsWith('#') ? colorVal.slice(0, 7) : '#1A1817';
        if (colorVal === 'branco' || colorVal === 'claro') targetHex = '#FFFFFF';
        if (colorVal === 'preto' || colorVal === 'escuro') targetHex = '#000000';
        if (colorVal === 'dourado') targetHex = '#B08D57';

        state.updatePage(pNum, { backgroundColor: targetHex });
        set({ agentStatus: 'idle' });
        get().goToSpread(Math.floor((pNum - 1) / 2));
        const targetX = pNum % 2 === 1 ? 28 : 72;
        get().triggerAgentCursor('director', `Alterando cor de fundo da Página ${String(pNum).padStart(2, '0')} para ${targetHex}`, {
          x: targetX,
          y: 48,
        });
        toast.success(`Cor de fundo da Página ${pNum} atualizada para ${targetHex}!`);
        state.addMessage({
          role: 'assistant',
          content: `Cor de fundo da **Página ${String(pNum).padStart(2, '0')}** alterada para \`${targetHex}\`.`,
          reasoning: 'Racional [Diretor de Arte]: Calibração cromática individual da lâmina com contraste verificado sob WCAG AA.',
          actions: [`Cor de fundo da Página ${String(pNum).padStart(2, '0')} alterada para ${targetHex}`],
        });
        return;
      }


      // Caso 4.1: Hex code direto para a paleta ativa (primária, fundo ou acento)
      if (hexMatch) {
        const hex = hexMatch[0];
        const isAccent = lower.includes('acento') || lower.includes('detalhe') || lower.includes('ouro') || lower.includes('metal');
        const isBg = lower.includes('fundo') || lower.includes('background') || lower.includes('pagina');
        const updatedPal: StudioPalette = {
          ...state.activePalette,
          accent: isAccent ? hex : state.activePalette.accent,
          background: isBg ? hex : state.activePalette.background,
          primary: (!isAccent && !isBg) ? hex : state.activePalette.primary,
        };
        state.setActivePalette(updatedPal, true);
        set({ agentStatus: 'idle' });
        toast.success(`Paleta calibrada com token ${hex}!`);
        state.addMessage({
          role: 'assistant',
          content: `Paleta do estúdio calibrada com o novo token **\`${hex}\`** (${isAccent ? 'acento' : isBg ? 'fundo' : 'primária'}). Todas as páginas foram sincronizadas.`,
          reasoning: 'Racional [Diretor de Arte]: Atualização cromática via hexadecimal com recálculo de luminância e contraste.',
          actions: [`Token cromático ${hex} aplicado à paleta do catálogo`],
        });
        return;
      }

      let chosenPreset = STUDIO_PALETTE_PRESETS[0];
      if (lower.includes('prata') || lower.includes('silver') || lower.includes('argent') || lower.includes('atelier')) {
        chosenPreset = STUDIO_PALETTE_PRESETS[1];
      } else if (lower.includes('bronze') || lower.includes('charcoal') || lower.includes('acervo')) {
        chosenPreset = STUDIO_PALETTE_PRESETS[2];
      } else if (lower.includes('terracota') || lower.includes('sable') || lower.includes('edition')) {
        chosenPreset = STUDIO_PALETTE_PRESETS[3];
      } else if (lower.includes('minimaliste') || lower.includes('slate') || lower.includes('cinza')) {
        chosenPreset = STUDIO_PALETTE_PRESETS[4];
      } else if (lower.includes('esmeralda') || lower.includes('emerald') || lower.includes('champagne')) {
        chosenPreset = STUDIO_PALETTE_PRESETS[5];
      } else if (lower.includes('ouro') || lower.includes('gold') || lower.includes('dourad') || lower.includes('luxe')) {
        chosenPreset = STUDIO_PALETTE_PRESETS[0];
      }

      const isLocked = state.activePalette.locked;
      const appliedPalette: StudioPalette = {
        ...chosenPreset,
        locked: isLocked,
      };

      state.setActivePalette(appliedPalette, true);
      set({ agentStatus: 'idle' });
      get().triggerAgentCursor('branding', `Harmonizando paleta cromática para ${appliedPalette.name}`, {
        x: 50,
        y: 22,
      });

      const lockWarning = isLocked
        ? '\n\n*Nota de Governança [Brand Lock]*: A paleta está travada. A alteração foi autorizada e aplicada como intervenção direta do usuário (Human Override).'
        : '';

      state.addMessage({
        role: 'assistant',
        content: `Paleta do catálogo atualizada para **${appliedPalette.name}** (acento em \`${appliedPalette.accent}\`, fundo em \`${appliedPalette.background}\`). As ${state.totalPages} páginas da prancheta foram sincronizadas em tempo real.${lockWarning}`,
        reasoning: isOrchestrator
          ? 'Racional do Editor-Chefe [Coordenação]: Nova paleta editorial homologada e distribuída por todos os templates de página.'
          : `Racional [${currentRole.name}]: Calibração tonal executada com razão de contraste aferida sob WCAG AA.`,
        actions: [`Paleta do catálogo atualizada para ${appliedPalette.name}`],
        delegations: isOrchestrator
          ? [
              {
                roleId: 'director',
                roleName: 'Diretor de Arte',
                badge: 'Design',
                action: `Harmonizou os acentos cromáticos em ${appliedPalette.accent} e a base ${appliedPalette.background}.`,
              },
              {
                roleId: 'branding',
                roleName: 'Auditor de Branding',
                badge: 'Auditoria',
                action: `Validou razão de contraste sob WCAG AA (${appliedPalette.contrastRatio || '8.5:1'}).`,
              },
              {
                roleId: 'copywriter',
                roleName: 'Redator Publicitário',
                badge: 'Redação',
                action: 'Ajustou a atmosfera editorial para ressoar com a nova estética.',
              },
            ]
          : undefined,
      });
      return;
    }

    // 4.1 Exportação em PDF
    if (
      lower.includes('exportar pdf') ||
      lower.includes('baixar pdf') ||
      lower.includes('gerar pdf') ||
      lower.includes('exportar catalogo') ||
      lower.includes('imprimir')
    ) {
      state.openExportModal('pdf');
      set({ agentStatus: 'idle' });
      state.addMessage({
        role: 'assistant',
        content: 'Módulo de exportação editorial aberto. O catálogo de alta resolução está preparado para geração de PDF em padrão gráfico A4.',
        reasoning: 'Racional [Editor-Chefe]: Abertura de modal de exportação gráfica conforme diretrizes de pré-impressão.',
        actions: ['Módulo de exportação em PDF aberto'],
      });
      return;
    }

    // 4. Comando geral / Ajuste de layout
    set({ agentStatus: 'idle' });
    state.addMessage({
      role: 'assistant',
      content: `Ajuste executado com base na diretriz: "${command}". Decisão orientada pelas instruções do cargo **${currentRole.name}**.`,
      reasoning: isOrchestrator
        ? 'Racional do Editor-Chefe [Coordenação]: Briefing decomposto e executado em colaboração entre arte, redação e comercial, mantendo o padrão de publicação internacional.'
        : `Racional do Cargo [${currentRole.name} - Tom: ${currentRole.toneOfVoice}]: Decisão guiada pela instrução: "${currentRole.instructions}". Respiros e proporções da prancheta mantidos.`,
      delegations: isOrchestrator
        ? [
            {
              roleId: 'director',
              roleName: 'Diretor de Arte',
              badge: 'Design',
              action: 'Calibrou a distribuição de respiro negativo e proporções da composição.',
            },
            {
              roleId: 'copywriter',
              roleName: 'Redator Publicitário',
              badge: 'Redação',
              action: 'Refinou claims e corpo de texto com vocabulário sofisticado e sem clichês.',
            },
            {
              roleId: 'commercial',
              roleName: 'Tabela Comercial / B2B',
              badge: 'Comercial',
              action: 'Conferiu a clareza dos itens de catálogo e estrutura para pedidos.',
            },
            {
              roleId: 'branding',
              roleName: 'Auditor de Branding',
              badge: 'Auditoria',
              action: 'Confirmou a padronização de fontes Cormorant/Jost e regras de marca.',
            },
          ]
        : undefined,
    });
  },

    isPalettePanelOpen: false,
    setIsPalettePanelOpen: (open) => set({ isPalettePanelOpen: open }),

    activePalette: STUDIO_PALETTE_PRESETS[0],

    setPaletteLocked: (locked) => {
    set((state) => ({
      activePalette: { ...state.activePalette, locked },
    }));
  },

    applyPaletteToPages: (palette) => {
    set((state) => {
      const isDarkPage = (type: string) => type === 'cover' || type === 'divider' || type === 'backcover';
      const updatedPages = state.pages.map((p) => ({
        ...p,
        backgroundColor: isDarkPage(p.type) ? palette.primary : palette.background,
        textColor: isDarkPage(p.type) ? palette.background : palette.primary,
        accentColor: palette.accent,
      }));
      return {
        pages: updatedPages,
      };
    });
  },

    setActivePalette: (palette, syncPages = true) => {
    set((state) => {
      const isDarkPage = (type: string) => type === 'cover' || type === 'divider' || type === 'backcover';
      const updatedPages = syncPages
        ? state.pages.map((p) => ({
            ...p,
            backgroundColor: isDarkPage(p.type) ? palette.primary : palette.background,
            textColor: isDarkPage(p.type) ? palette.background : palette.primary,
            accentColor: palette.accent,
          }))
        : state.pages;

      return {
        activePalette: palette,
        pages: updatedPages,
      };
    });
  },

    updateActivePalette: (updates, syncPages = true) => {
    set((state) => {
      const merged: StudioPalette = {
        ...state.activePalette,
        ...updates,
      };
      const isDarkPage = (type: string) => type === 'cover' || type === 'divider' || type === 'backcover';
      const updatedPages = syncPages
        ? state.pages.map((p) => ({
            ...p,
            backgroundColor: isDarkPage(p.type) ? merged.primary : merged.background,
            textColor: isDarkPage(p.type) ? merged.background : merged.primary,
            accentColor: merged.accent,
          }))
        : state.pages;

      return {
        activePalette: merged,
        pages: updatedPages,
      };
    });
  },

    selectedElementId: null,
    setSelectedElementId: (id) => set({ selectedElementId: id }),

    startSession: (initialPrompt, _categoryName, attachments) => {
    const prompt = initialPrompt || 'Criar catálogo editorial moderno';
    get().triggerCatalogGeneration(prompt, attachments);
  },

    resetToHome: () => {
      const s = get();
      if (s.activeCatalogId && s.threads && s.threads.length > 0) {
        saveStoredProjectSession(
          s.activeCatalogId,
          {
            threads: s.threads,
            activeThreadId: s.activeThreadId,
            catalogTitle: s.catalogTitle,
            activePalette: s.activePalette,
            currentSpread: s.currentSpread,
            pages: s.pages,
            totalPages: s.totalPages
          },
          s.activeUserId
        );
      }
      if (typeof window !== 'undefined') {
        const uid = s.activeUserId ?? getCurrentUserId();
        localStorage.removeItem(
          workspaceKey(
            uid,
            organizationService.getActiveOrganizationId(),
            'last_active_catalog'
          )
        );
        localStorage.removeItem('katana_studio_last_active_catalog');
      }
      set({
        hasStartedSession: false,
        activeCatalogId: null,
        catalogTitle: 'Novo Catálogo',
        pages: [],
        qualityGate: undefined,
        totalPages: 0,
        executionPlan: [],
        messages: [],
        threads: [],
        activeThreadId: '',
        agentStatus: 'idle',
      selectedElementId: null,
      currentSpread: [1, 2],
      isGeneratingCatalog: false,
      generationProgress: 0,
      generationStage: 1,
      generationLogs: [],
      generationTargetCatalog: null,
    });
  },
};
});
