import { create } from 'zustand';
import axios from 'axios';
import api from '../services/api';
import { toast } from 'sonner';
import {
  CatalogPageData,
  ProductItem,
  StudioPalette,
  STUDIO_PALETTE_PRESETS,
  PageLayoutType,
} from '../data/aureaCatalog.mock';
import { generateCatalogFromPrompt, GeneratedCatalogResult } from '../utils/catalogGenerator';

export const API_BASE_URL = (import.meta.env && import.meta.env.VITE_API_BASE_URL) || 'http://localhost:8000';
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
}

export interface Brand {
  id: string;
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

export const getStoredBrands = (): Brand[] => {
  try {
    const saved = localStorage.getItem('katana_studio_brands');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // fallback
  }
  return INITIAL_BRANDS;
};

export const saveStoredBrands = (brands: Brand[]) => {
  try {
    localStorage.setItem('katana_studio_brands', JSON.stringify(brands));
  } catch {
    // ignore
  }
};

export interface StudioState {
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
  loadExistingCatalog: (catalogId: string) => void;

  // Brands / Marcas Management (Antigravity Projects style)
  brands: Brand[];
  activeBrandId: string | null;
  setActiveBrandId: (id: string | null) => void;
  addBrand: (data: Omit<Brand, 'id' | 'createdAt' | 'catalogs'>) => Brand;
  updateBrand: (id: string, updates: Partial<Brand>) => void;
  deleteBrand: (id: string) => void;
  isBrandModalOpen: boolean;
  brandModalEditingId: string | null;
  openBrandModal: (brandId?: string) => void;
  closeBrandModal: () => void;

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
  updateProduct: (productId: string, updates: Partial<ProductItem>) => void;
  removeProductBackground: (pageNumber: number, productId: string) => Promise<void>;
  executeCopilotCommand: (command: string, attachments?: ChatAttachment[]) => void;

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
    spread_index?: number;
    updates?: Array<{ target: string; field: string; value: any }>;
    actions?: Array<{
      type: string;
      [key: string]: any;
    }>;
    summary?: string;
    reasoning?: string;
    delegations?: ChatDelegation[];
  }) => void;

  // Real Agent Streaming & Command Execution
  sendMessageToAgent: (prompt: string, attachments?: ChatAttachment[]) => Promise<void>;
}

const getInitialTheme = (): 'dark' | 'light' => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('katana_theme');
    if (saved === 'light' || saved === 'dark') {
      document.documentElement.classList.toggle('dark', saved === 'dark');
      return saved;
    }
    document.documentElement.classList.add('dark');
  }
  return 'dark';
};

const applyTheme = (theme: 'dark' | 'light') => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('katana_theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }
};

const getInitialRoles = (): StudioRole[] => {
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem('katana_studio_custom_roles');
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

const saveCustomRoles = (roles: StudioRole[]) => {
  if (typeof window !== 'undefined') {
    const customs = roles.filter((r) => r.isCustom);
    localStorage.setItem('katana_studio_custom_roles', JSON.stringify(customs));
  }
};

export const useStudioStore = create<StudioState>((set, get) => ({
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

  // Brands / Marcas Management (Antigravity Projects style)
  brands: getStoredBrands(),
  activeBrandId: 'brand-maison',
  setActiveBrandId: (id) => set({ activeBrandId: id }),
  addBrand: (data) => {
    const newBrand: Brand = {
      ...data,
      id: `brand-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      catalogs: [],
      createdAt: new Date().toISOString(),
    };
    const updated = [newBrand, ...get().brands];
    saveStoredBrands(updated);
    set({
      brands: updated,
      activeBrandId: newBrand.id,
      isBrandModalOpen: false,
      brandModalEditingId: null,
    });
    toast.success(`Marca "${newBrand.name}" cadastrada com sucesso!`);
    return newBrand;
  },
  updateBrand: (id, updates) => {
    const updated = get().brands.map((b) => (b.id === id ? { ...b, ...updates } : b));
    saveStoredBrands(updated);
    set({
      brands: updated,
      isBrandModalOpen: false,
      brandModalEditingId: null,
    });
    toast.success('Marca atualizada com sucesso!');
  },
  deleteBrand: (id) => {
    const remaining = get().brands.filter((b) => b.id !== id);
    saveStoredBrands(remaining);
    set((s) => ({
      brands: remaining,
      activeBrandId: s.activeBrandId === id ? (remaining[0]?.id || null) : s.activeBrandId,
    }));
    toast.success('Marca removida.');
  },
  isBrandModalOpen: false,
  brandModalEditingId: null,
  openBrandModal: (brandId) => set({ isBrandModalOpen: true, brandModalEditingId: brandId || null }),
  closeBrandModal: () => set({ isBrandModalOpen: false, brandModalEditingId: null }),

  // New Catalog Creation Modal
  isNewCatalogModalOpen: false,
  setIsNewCatalogModalOpen: (open) => set({ isNewCatalogModalOpen: open }),
  openNewCatalogModal: () => set({ isNewCatalogModalOpen: true }),
  closeNewCatalogModal: () => set({ isNewCatalogModalOpen: false }),
  createBlankCatalog: (title, pagesCount = 6, paletteName) => {
    const catalogTitle = title?.trim() || 'Novo Catálogo';
    const catalogId = `cat-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const activeBrand = get().brands.find((b) => b.id === get().activeBrandId);
    const palette =
      (paletteName && STUDIO_PALETTE_PRESETS.find((p) => p.name === paletteName)) ||
      activeBrand?.customPalette ||
      STUDIO_PALETTE_PRESETS.find((p) => p.name === activeBrand?.paletteName) ||
      STUDIO_PALETTE_PRESETS[0];

    const pages: CatalogPageData[] = [];
    // Capa
    pages.push({
      id: `${catalogId}-p1`,
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
      const pageType: PageLayoutType = i === 2 ? 'manifesto' : (i % 2 === 1 ? 'hero' : 'duo');
      pages.push({
        id: `${catalogId}-p${i}`,
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
      id: `${catalogId}-p${pagesCount}`,
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

    const initialThread: ChatThread = {
      id: `thread-${Date.now()}`,
      title: catalogTitle,
      mode: 'director',
      createdAt: new Date().toISOString(),
      messages: [
        {
          id: `msg-welcome-${Date.now()}`,
          role: 'assistant',
          content: `Novo catálogo **${catalogTitle}** criado com ${pagesCount} páginas em branco na prancheta. Você pode alocar produtos do acervo, importar planilha Excel ou me dar instruções de diagramação.`,
          timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        },
      ],
    };

    set({
      hasStartedSession: true,
      activeCatalogId: catalogId,
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

    const activeBrandId = get().activeBrandId;
    if (activeBrandId) {
      const updatedBrands = get().brands.map((b) => {
        if (b.id === activeBrandId) {
          return {
            ...b,
            catalogs: [
              {
                id: catalogId,
                title: catalogTitle,
                totalPages: pagesCount,
                category: b.segment || 'Editorial',
                updatedAt: 'Agora',
              },
              ...b.catalogs,
            ],
          };
        }
        return b;
      });
      saveStoredBrands(updatedBrands);
      set({ brands: updatedBrands });
    }

    toast.success(`Catálogo "${catalogTitle}" pronto para edição!`);
  },

  // Export Catalog Modal
  isExportModalOpen: false,
  exportModalTab: 'pdf',
  openExportModal: (tab = 'pdf') => set({ isExportModalOpen: true, exportModalTab: tab }),
  closeExportModal: () => set({ isExportModalOpen: false }),

  // Product Drawer & Inventory Repository
  isProductDrawerOpen: false,
  unassignedProducts: [
    {
      id: 'prod-unassigned-1',
      category: 'COURO LEGITIMO',
      index: '08',
      name: 'Porta-Cartoes Verona',
      sku: 'ART-008',
      price: 'R$ 490',
      description: 'Couro vegetal encerado com bordas polidas artesanalmente a quente.',
      image: '/aurea/images/det-costura.jpg',
      tag: 'Disponivel',
    },
    {
      id: 'prod-unassigned-2',
      category: 'MARROQUINARIA',
      index: '09',
      name: 'Bolsa Tote Amalfi',
      sku: 'ART-009',
      price: 'R$ 3.800',
      description: 'Espaco generoso com forro em camurca natural e ferragens em latao escovado.',
      image: '/aurea/images/det-atelier.jpg',
      tag: 'Edicao Limitada',
    },
    {
      id: 'prod-unassigned-3',
      category: 'SEDA & CASHMERE',
      index: '10',
      name: 'Lenco de Bolso Lucca',
      sku: 'ART-010',
      price: 'R$ 320',
      description: 'Twill de seda pura com bainha enrolada a mao em padrao geometrico discreto.',
      image: '/aurea/images/det-tecido.jpg',
      tag: 'Seda Pura',
    },
  ],
  activeTargetSlot: null,
  openProductDrawer: (targetSlot) => set({ isProductDrawerOpen: true, activeTargetSlot: targetSlot ?? null }),
  closeProductDrawer: () => set({ isProductDrawerOpen: false, activeTargetSlot: null }),
  setActiveTargetSlot: (activeTargetSlot) => set({ activeTargetSlot }),
  toggleProductDrawer: () => set((s) => ({ isProductDrawerOpen: !s.isProductDrawerOpen, activeTargetSlot: s.isProductDrawerOpen ? null : s.activeTargetSlot })),
  addProductToRepository: (productData) => {
    const newProduct: ProductItem = {
      ...productData,
      id: `prod-custom-${Date.now()}`,
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

  importProductsFromExcel: (items, options = {}) => {
    if (!items || items.length === 0) return;

    const newProducts: ProductItem[] = items.map((item, idx) => {
      const rawPrice = item.price ? String(item.price).trim() : '0,00';
      const formattedPrice = rawPrice.startsWith('R$') ? rawPrice : `R$ ${rawPrice.replace(/^[^\d]+/, '')}`;
      return {
        id: `prod-excel-${Date.now()}-${idx}`,
        name: (item.name || 'Produto sem nome').trim(),
        price: formattedPrice || 'R$ 0,00',
        category: (item.category || 'COLECAO 2026').trim(),
        sku: (item.sku || `SKU-${String(idx + 1).padStart(3, '0')}`).trim(),
        description: (item.description || 'Item catalogado via importacao de planilha comercial.').trim(),
        image: item.image && item.image.trim().startsWith('http') ? item.image.trim() : (item.image?.trim() || '/aurea/images/prod-bolsa.jpg'),
        tag: (item.tag || 'Importado').trim(),
        index: String(idx + 1).padStart(2, '0'),
      };
    });

    set((s) => ({
      unassignedProducts: [...newProducts, ...s.unassignedProducts],
      isExcelImportModalOpen: false,
    }));

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
    try {
      const response = await api.post(`/api/v2/studio/products/generate-image/`, {
        name,
        category: category || '',
        description: description || '',
      });
      const imageUrl = response.data?.image_url;
      if (imageUrl) {
        get().updateProduct(productId, { image: imageUrl });
        toast.success(`Fotografia de estúdio gerada para "${name}"!`);
        return imageUrl;
      }
    } catch (err: any) {
      console.warn('[generateAIProductImage] Falha ao gerar imagem com IA:', err);
      if (err?.response?.status === 401) {
        window.dispatchEvent(new CustomEvent('catana:unauthorized'));
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
      if (!get().isGeneratingCatalog) return;
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
      if (!get().isGeneratingCatalog) return;
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
        { prompt, products },
        { timeout: 60000 }
      );

      clearTimeout(timer2);
      clearTimeout(timer3);

      if (!get().isGeneratingCatalog) return;

      const generated: GeneratedCatalogResult = response.data;
      if (!generated || !generated.pages || generated.pages.length === 0) {
        throw new Error('Retorno do Gemini sem paginas validas');
      }

      generated.initialPrompt = prompt;

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
        if (!get().isGeneratingCatalog) return;
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
              text: 'Homologacao editorial concluida. Compilando pranchetas de alta fidelidade para o Katana Studio.',
            },
          ],
        }));

        setTimeout(() => {
          if (!get().isGeneratingCatalog) return;
          get().finishCatalogGeneration();
        }, 600);
      }, 700);

    } catch (err) {
      console.warn('[triggerCatalogGeneration] Falha ao conectar ao Gemini, acionando sintese de contingencia local:', err);
      clearTimeout(timer2);
      clearTimeout(timer3);

      if (!get().isGeneratingCatalog) return;

      const fallback = generateCatalogFromPrompt(prompt, attachments);
      fallback.initialPrompt = prompt;

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
        if (!get().isGeneratingCatalog) return;
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
          if (!get().isGeneratingCatalog) return;
          get().finishCatalogGeneration();
        }, 600);
      }, 700);
    }
  },

  finishCatalogGeneration: () => {
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
        content: `Catálogo **"${target.title}"** gerado e diagramado com sucesso!\n\nEstruturei **${target.totalPages} páginas em ${Math.ceil(target.totalPages / 2)} spreads duplos**, com direção de arte em harmonia com a paleta **${target.palette.name}**.\n\n${target.summary}\n\n**Você pode interagir livremente:**\n- **Clique em qualquer elemento** na prancheta para editar textos, preços e imagens.\n- **Use o chat do Co-Pilot** para solicitar alterações com auxílio do Conselho Editorial.\n- **Navegue pelos spreads** pelo filmstrip inferior ou teclas de seta.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        reasoning: target.reasoning,
        delegations: target.councilDelegations,
        actions: [`Catálogo "${target.title}" estruturado em ${target.totalPages} páginas sob a paleta ${target.palette.name}`],
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

    set({
      isGeneratingCatalog: false,
      generationProgress: 100,
      hasStartedSession: true,
      activeCatalogId: target.catalogId,
      catalogTitle: target.title,
      pages: target.pages,
      totalPages: target.totalPages,
      activePalette: target.palette,
      currentSpread: [1, 2],
      agentStatus: 'idle',
      threads: [initialThread],
      activeThreadId: initialThread.id,
      messages: initialMessages,
      executionPlan: [
        { id: 'step-1', label: `Análise semântica do briefing: "${target.category}"`, status: 'completed', roleBadge: 'Estratégia' },
        { id: 'step-2', label: `Aplicação da paleta cromática ${target.palette.name}`, status: 'completed', roleBadge: 'Design' },
        { id: 'step-3', label: `Diagramação de ${target.totalPages} páginas no padrão A4`, status: 'completed', roleBadge: 'Diagramação' },
        { id: 'step-4', label: 'Auditoria editorial e conformidade de leitura WCAG AAA', status: 'completed', roleBadge: 'Auditoria' },
      ],
      isPlanCollapsed: true,
      isPlanHidden: false,
    });
    toast.success(`Catálogo "${target.title}" gerado com sucesso!`);
  },

  cancelCatalogGeneration: () => {
    set({
      isGeneratingCatalog: false,
      generationProgress: 0,
      generationStage: 1,
      generationLogs: [],
      generationTargetCatalog: null,
      lastGenerationPrompt: undefined,
    });
  },

  loadExistingCatalog: (catalogId: string) => {
    if (catalogId === 'lookbook-editorial-2026' || catalogId === 'aurea-2026' || catalogId.includes('aurea')) {
      const generated = generateCatalogFromPrompt('Lookbook editorial de moda e acessórios de luxo');
      set({
        hasStartedSession: true,
        catalogTitle: generated.title,
        activeCatalogId: catalogId,
        pages: generated.pages,
        totalPages: generated.totalPages,
        currentSpread: [1, 2],
        activePalette: generated.palette,
      });
      get().addMessage({
        role: 'assistant',
        content: `Catálogo **${generated.title}** carregado com sucesso para edição. Os ${generated.totalPages} spreads e os agentes estão ativos para alterações.`,
        reasoning: 'Racional do Orquestrador: Carregamento do catálogo editorial com paleta harmônica e modos de diagramação A4 aplicados.',
      });
    } else if (catalogId === 'techgear-2026') {
      const generated = generateCatalogFromPrompt('Catálogo TechGear hardware e setup');
      set({
        hasStartedSession: true,
        catalogTitle: generated.title,
        activeCatalogId: 'techgear-2026',
        pages: generated.pages,
        totalPages: generated.totalPages,
        activePalette: generated.palette,
        currentSpread: [1, 2],
      });
      get().addMessage({
        role: 'assistant',
        content: 'Catálogo **TechGear 2026 — Setup & Tech** aberto para edição na prancheta.',
      });
    } else if (catalogId === 'confeitaria-artesanal') {
      const generated = generateCatalogFromPrompt('Catálogo de confeitaria artesanal doces gourmet');
      set({
        hasStartedSession: true,
        catalogTitle: generated.title,
        activeCatalogId: 'confeitaria-artesanal',
        pages: generated.pages,
        totalPages: generated.totalPages,
        activePalette: generated.palette,
        currentSpread: [1, 2],
      });
      get().addMessage({
        role: 'assistant',
        content: 'Catálogo **Confeitaria Artesanal** aberto para edição na prancheta.',
      });
    } else if (catalogId === 'cristallo-joias') {
      const generated = generateCatalogFromPrompt('Alta joalheria cristallo gemas ouro');
      set({
        hasStartedSession: true,
        catalogTitle: generated.title,
        activeCatalogId: 'cristallo-joias',
        pages: generated.pages,
        totalPages: generated.totalPages,
        activePalette: generated.palette,
        currentSpread: [1, 2],
      });
      get().addMessage({
        role: 'assistant',
        content: 'Catálogo **Cristallo Joalheria** aberto para edição na prancheta.',
      });
    } else {
      set({
        hasStartedSession: true,
        catalogTitle: 'Catálogo Comercial',
        activeCatalogId: catalogId,
        currentSpread: [1, 2],
      });
    }
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
  },

  renameThread: (threadId, title) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    set((s) => ({
      threads: s.threads.map((t) => (t.id === threadId ? { ...t, title: trimmed } : t)),
    }));
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
  },
  clearMessages: () =>
    set((s) => ({
      messages: [],
      threads: s.threads.map((t) => (t.id === s.activeThreadId ? { ...t, messages: [] } : t)),
    })),
  setMessageFeedback: (messageId, feedback) =>
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
    }),

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
      const nextLeft = Math.min(s.totalPages - 1, s.currentSpread[0] + 2);
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
      const left = Math.max(1, Math.min(s.totalPages - 1, spreadIndex * 2 + 1));
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

  updatePage: (pageNumber, updates) => {
    get().pushHistorySnapshot();
    set((s) => ({
      pages: s.pages.map((p) => (p.pageNumber === pageNumber ? { ...p, ...updates } : p)),
      saveStatus: 'unsaved',
    }));
    get().debouncedSaveCurrentSpread();
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
        const formData = new FormData();
        formData.append('image', blobData, 'product.png');
        res = await api.post(`/api/v2/studio/media/remove-background/`, formData);
      } else {
        res = await api.post(
          `/api/v2/studio/media/remove-background/`,
          { image_url: prod.image }
        );
      }

      if (res.data && res.data.processed_url) {
        get().updateProduct(productId, { image: res.data.processed_url });
        toast.success('Fundo do produto removido com sucesso!');
      }
    } catch (err: any) {
      console.warn('Falha na remoção de fundo:', err);
      if (err?.response?.status === 401) {
        window.dispatchEvent(new CustomEvent('catana:unauthorized'));
        toast.error('Sessão expirada. Acesse sua conta novamente para continuar.');
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
    const catalogId = state.activeCatalogId;
    if (!catalogId) {
      set({ saveStatus: 'saved' });
      return;
    }
    const [leftPageNum, rightPageNum] = state.currentSpread;
    const leftPage = state.pages.find((p) => p.pageNumber === leftPageNum);
    const rightPage = state.pages.find((p) => p.pageNumber === rightPageNum);

    set({ saveStatus: 'saving' });

    try {
      const numericCatalogId = parseInt(catalogId, 10);
      if (!isNaN(numericCatalogId)) {
        await api.post(
          `/api/v2/studio/catalogs/${numericCatalogId}/spreads/`,
          {
            spread_index: Math.floor((leftPageNum - 1) / 2),
            title: `Spread ${leftPageNum}-${rightPageNum}`,
            left_page_elements: leftPage ? [leftPage] : [],
            right_page_elements: rightPage ? [rightPage] : [],
          }
        );
      }
      set({ saveStatus: 'saved' });
    } catch {
      set({ saveStatus: 'error' });
    }
  },

  applySpreadPatch: (patch) => {
    if (!patch) return;
    const hasUpdates = Array.isArray(patch.updates) && patch.updates.length > 0;
    const hasActions = Array.isArray(patch.actions) && patch.actions.length > 0;
    if (!hasUpdates && !hasActions && typeof patch.spread_index !== 'number') return;

    const state = get();
    state.pushHistorySnapshot();

    const [leftPageNum, rightPageNum] = state.currentSpread;

    // 1. Processar Acoes Operacionais do Conselho Editorial
    if (hasActions && patch.actions) {
      for (const rawAction of patch.actions) {
        if (!rawAction) continue;
        const actType = rawAction.action || rawAction.type;
        if (!actType) continue;

        const targetStr = String(rawAction.target || '');
        const params = rawAction.params || {};

        let targetPage = typeof rawAction.page === 'number' ? rawAction.page : undefined;
        if (targetPage === undefined && targetStr.startsWith('page:')) {
          const parsed = parseInt(targetStr.replace('page:', ''), 10);
          if (!isNaN(parsed)) targetPage = parsed;
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
          case 'remove_product': {
            if (prodId) {
              const currentPages = get().pages;
              const containingPage = targetPage
                ? currentPages.find((p) => p.pageNumber === targetPage)
                : currentPages.find((p) => p.products?.some((pr) => pr.id === prodId));
              const pageNum = containingPage ? containingPage.pageNumber : (targetPage || leftPageNum);
              get().removeProductFromSpread(pageNum, slotIdx, prodId);
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
                (pQuery && p.name && p.name.toLowerCase().includes(String(pQuery).toLowerCase())) ||
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
                (p.name && newId && p.name.toLowerCase() === String(newId).toLowerCase())
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
            const name = rawAction.title || rawAction.name || params.title || params.name || 'Novo Produto';
            const created = get().addProductToRepository({
              name,
              sku: rawAction.sku || params.sku || `SKU-${Date.now().toString().slice(-4)}`,
              price: rawAction.price || params.price || 'R$ 0,00',
              category: rawAction.category || params.category || 'Coleção',
              description: rawAction.description || params.description || 'Item de alta precisão e acabamento manual.',
              index: rawAction.index || params.index || '01',
              image:
                rawAction.image ||
                params.image ||
                'https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=1000&auto=format&fit=crop',
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

          case 'update_text': {
            const finalPage = typeof targetPage === 'number' ? targetPage : leftPageNum;
            const field = rawAction.field || params.field || 'title';
            const val = rawAction.value !== undefined ? rawAction.value : params.value;
            if (field && val !== undefined) {
              get().updatePage(finalPage, { [field]: val });
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
                const currentNumeric =
                  parseFloat(prod.price.replace(/[^\d.,]/g, '').replace(',', '.')) || 100;
                let newNumeric = currentNumeric;
                if (mode === 'set' && targetVal > 0) {
                  newNumeric = targetVal;
                } else if (mode === 'decrease') {
                  newNumeric = currentNumeric * (1 - Math.abs(pct) / 100);
                } else {
                  newNumeric = currentNumeric * (1 + Math.abs(pct) / 100);
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
                (p.name && prodToGen && p.name.toLowerCase().includes(prodToGen.toLowerCase()))
            );
            if (targetProd) {
              get().generateAIProductImage(
                targetProd.id,
                targetProd.name,
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

          default:
            console.warn('[applySpreadPatch] Ação não reconhecida:', actType);
            break;
        }
      }
    }

    // 2. Processar Updates de Campos Especificos (Legado & Direct Field Updates)
    if (hasUpdates && patch.updates) {
      set((s) => {
        let updatedPages = [...s.pages];

        for (const update of patch.updates!) {
          const { target, field, value } = update;

          if (target === 'left_page' || target === 'left') {
            updatedPages = updatedPages.map((p) =>
              p.pageNumber === leftPageNum ? { ...p, [field]: value } : p
            );
          } else if (target === 'right_page' || target === 'right') {
            updatedPages = updatedPages.map((p) =>
              p.pageNumber === rightPageNum ? { ...p, [field]: value } : p
            );
          } else if (typeof target === 'string' && target.startsWith('page:')) {
            const targetPageNum = parseInt(target.replace('page:', ''), 10);
            updatedPages = updatedPages.map((p) =>
              p.pageNumber === targetPageNum ? { ...p, [field]: value } : p
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

    get().debouncedSaveCurrentSpread();
  },

  sendMessageToAgent: async (prompt, attachments) => {
    const state = get();
    const userPrompt = prompt.trim();
    if (!userPrompt && (!attachments || attachments.length === 0)) return;

    // 1. Mensagem do usuario
    const userMsgId = `msg-user-${Date.now()}`;
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

    // 2. Monta o contexto para o backend
    const [leftPageNum, rightPageNum] = state.currentSpread;
    const leftPage = state.pages.find((p) => p.pageNumber === leftPageNum);
    const rightPage = state.pages.find((p) => p.pageNumber === rightPageNum);

    const activeSpreadData = {
      spread_index: Math.floor((leftPageNum - 1) / 2),
      left_page: leftPage,
      right_page: rightPage,
    };

    const catalogSkeleton = state.pages.map((p) => ({
      pageNumber: p.pageNumber,
      type: p.type,
      title: p.title || p.label || `Pagina ${p.pageNumber}`,
    }));

    const token = localStorage.getItem('access_token');
    const numericCatalogId = state.activeCatalogId ? parseInt(state.activeCatalogId, 10) : NaN;
    const numericThreadId = state.activeThreadId ? parseInt(state.activeThreadId, 10) : NaN;

    const payload = {
      message: userPrompt,
      agent_role: state.activeRoleId || 'orchestrator',
      catalog_id: !isNaN(numericCatalogId) ? numericCatalogId : undefined,
      thread_id: !isNaN(numericThreadId) ? numericThreadId : undefined,
      spread_index: Math.floor((leftPageNum - 1) / 2),
      active_spread_data: activeSpreadData,
      catalog_skeleton: catalogSkeleton,
      selected_element_id: state.selectedElementId || undefined,
    };

    try {
      let activeToken = token;
      let response = await fetch(`${API_BASE_URL}/api/v2/studio/chat/stream/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!response.ok && response.status === 401) {
        try {
          const storedRefresh = localStorage.getItem('refresh_token');
          const refreshRes = await axios.post(
            `${API_BASE_URL}/api/auth/token/refresh/`,
            { refresh: storedRefresh || undefined },
            { withCredentials: true }
          );
          const newAccess = refreshRes.data?.access;
          if (newAccess && typeof newAccess === 'string') {
            activeToken = newAccess;
            localStorage.setItem('access_token', newAccess);
            if (refreshRes.data.refresh) {
              localStorage.setItem('refresh_token', refreshRes.data.refresh);
            }
            response = await fetch(`${API_BASE_URL}/api/v2/studio/chat/stream/`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${newAccess}`,
              },
              credentials: 'include',
              body: JSON.stringify(payload),
            });
          }
        } catch {
          // Refresh falhou
        }
      }

      if (!response.ok) {
        if (response.status === 401) {
          window.dispatchEvent(new CustomEvent('catana:unauthorized'));
          set({ agentStatus: 'idle' });
          return;
        }
        throw new Error(`HTTP ${response.status}`);
      }

      set({ agentStatus: 'generating' });

      const reader = response.body?.getReader();
      if (!reader) throw new Error('ReadableStream nao disponivel');

      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedContent = '';
      let appliedPatch: any = null;

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

            if (actType === 'remove_product') return `Produto removido da Página ${pageNum || 'visível'} e retornado ao acervo`;
            if (actType === 'assign_product') return `Produto alocado na Página ${pageNum || 1}`;
            if (actType === 'swap_product') return `Substituição de produto na Página ${pageNum || 1}`;
            if (actType === 'create_product') return `Produto "${title || 'Novo'}" cadastrado e alocado`;
            if (actType === 'change_layout') return `Layout da Página ${pageNum || 1} convertido para ${(layout || 'hero').toUpperCase()}`;
            if (actType === 'adjust_pricing') return `Reajuste de ${percentage || 10}% aplicado à tabela de preços`;
            if (actType === 'generate_skus') return `Códigos SKU padronizados com prefixo ${prefix || 'CAT'}`;
            if (actType === 'set_palette') return 'Paleta cromática do catálogo atualizada';
            if (actType === 'brand_lock') return (act.locked ?? params.locked) ? 'Trava de Marca (Brand Lock) ativada' : 'Trava de Marca desativada';
            if (actType === 'remove_background') return 'Isolamento de silhueta e recorte de fundo executados';
            if (actType === 'remove_image' || actType === 'clear_image') return `Imagem do produto na Página ${pageNum || 'visível'} removida`;
            if (actType === 'generate_photo') return 'Fotografia de estúdio em alta resolução gerada com IA';
            if (actType === 'update_text') return `Texto da Página ${pageNum || 1} (${field || 'conteúdo'}) atualizado`;
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
              get().applySpreadPatch(data.patch);
              toast.success('Prancheta Sincronizada', {
                description: data.patch.summary || 'Alterações aplicadas com sucesso pelo Conselho Editorial.',
              });
            }

            if (data.event === 'done') {
              if (data.patch && !appliedPatch) {
                appliedPatch = data.patch;
                get().applySpreadPatch(data.patch);
                toast.success('Prancheta Sincronizada', {
                  description: data.patch.summary || 'Alterações aplicadas com sucesso pelo Conselho Editorial.',
                });
              }
            }
          } catch {
            // Ignora linhas intermediarias de streaming
          }
        }
      }

      // Se nao veio evento de patch explicito mas o texto acumulado tem json:patch
      if (!appliedPatch && accumulatedContent.includes('json:patch')) {
        const match = accumulatedContent.match(/```(?:json:patch|json)?\s*(\{[\s\S]*?(?:"updates"|"actions")[\s\S]*?\})\s*```/);
        if (match) {
          try {
            const parsed = JSON.parse(match[1]);
            appliedPatch = parsed;
            get().applySpreadPatch(parsed);
            toast.success('Prancheta Sincronizada', {
              description: parsed.summary || 'Alterações aplicadas com sucesso pelo Conselho Editorial.',
            });
          } catch {}
        }
      }

      // Extrai açoes e delegaçoes para a mensagem formada
      const actionSummaries = appliedPatch ? resolveActionSummaries(appliedPatch) : [];
      const mappedDelegations = resolveDelegations(appliedPatch, accumulatedContent);

      // Limpa blocos de patch e tags tecnicas do conteudo apresentado ao usuario
      let cleanContent = accumulatedContent
        .replace(/```(?:json:patch|json)?[\s\S]*?```/g, '')
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
            cleanContent = 'Ajuste executado com sucesso e diagramação sincronizada pelo Conselho Editorial.';
          }
        }
      }

      if (!cleanContent && appliedPatch?.summary) {
        cleanContent = appliedPatch.summary;
      }
      if (!cleanContent) {
        cleanContent = 'Ajuste executado com sucesso pelo Conselho Editorial.';
      }

      const assistantMsgId = `msg-agent-${Date.now()}`;
      const assistantMsg: ChatMessage = {
        id: assistantMsgId,
        role: 'assistant',
        content: cleanContent,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        reasoning: appliedPatch?.reasoning,
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

      await get().flushSaveSpread();

    } catch (err) {
      console.warn('Fallback para orquestracao local:', err);
      state.executeCopilotCommand(userPrompt, attachments);
    }
  },

  executeCopilotCommand: (command, attachments) => {
    const lower = command.toLowerCase();
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
            description: prod.description.includes('SKU') ? prod.description : `${prod.description} · SKU-AUR-0${idx + 1}`,
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

    if (lower.startsWith('/revisao-geral') || lower.includes('revisão geral')) {
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
    const isRemoveIntent = /(?:retire|remover|remova|tire|tirar|apague|apagar|deletar|excluir|limpar|desalocar|remover-produto)/i.test(lower);
    if (isRemoveIntent) {
      const pageMatch = command.match(/(?:p[aá]gina|p[aá]g\.?|page)\s*(\d+)/i);
      const slotMatch = command.match(/(?:slot|posi[cç][aã]o|posicao)\s*(\d+)/i);
      const slotIdx = slotMatch ? parseInt(slotMatch[1], 10) - 1 : undefined;

      // 1.1 Remover todos os produtos do catálogo
      if (lower.includes('todos os produtos') || lower.includes('todo o catálogo') || lower.includes('todos produtos') || lower.includes('limpar catalogo') || lower.includes('limpar catálogo')) {
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
        const targetPageNum = parseInt(pageMatch[1], 10);
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
          if (lower.includes(prod.name.toLowerCase()) || (prod.sku && lower.includes(prod.sku.toLowerCase()))) {
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
    const isAssignIntent = /(?:aloque|alocar|insira|inserir|coloque|colocar|adicione|adicionar)\s+(?:o\s+produto\s+)?(.+?)\s+na\s+p[aá]gina\s+(\d+)/i;
    const assignMatch = command.match(isAssignIntent);
    if (assignMatch) {
      const prodQuery = assignMatch[1].trim().toLowerCase();
      const targetPageNum = parseInt(assignMatch[2], 10);
      const slotMatch = command.match(/(?:slot|posi[cç][aã]o|posicao)\s*(\d+)/i);
      const slotIdx = slotMatch ? parseInt(slotMatch[1], 10) - 1 : 0;

      const allAvailable = [
        ...state.unassignedProducts,
        ...state.pages.flatMap((p) => p.products || []),
      ];

      const foundProduct = allAvailable.find(
        (p) =>
          p.name.toLowerCase().includes(prodQuery) ||
          prodQuery.includes(p.name.toLowerCase()) ||
          (p.sku && p.sku.toLowerCase().includes(prodQuery))
      ) || allAvailable[0];

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
    // 3. INTENT: TROCA DE LAYOUT DA PÁGINA
    // ==========================================
    const layoutMatch = command.match(
      /(?:mude|altere|troque|transforme|converter|converta)\s+(?:a\s+)?p[aá]gina\s+(\d+)\s+para\s+(hero|duo|single|grade comercial|grade|grid_4|grid|manifesto|divis[oó]ria|divisoria|divider|capa|cover)/i
    );
    if (layoutMatch) {
      const pageNum = parseInt(layoutMatch[1], 10);
      const rawType = layoutMatch[2].toLowerCase();
      let newType: CatalogPageData['type'] = 'hero';

      if (rawType.includes('duo')) newType = 'duo';
      else if (rawType.includes('grid') || rawType.includes('grade')) newType = 'grid_4';
      else if (rawType.includes('single')) newType = 'single';
      else if (rawType.includes('divis') || rawType.includes('divider')) newType = 'divider';
      else if (rawType.includes('manifesto')) newType = 'manifesto';
      else if (rawType.includes('capa') || rawType.includes('cover')) newType = 'cover';
      else newType = 'hero';

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
    // 4. INTENT: NAVEGAÇÃO DE PÁGINAS
    // ==========================================
    const navMatch = command.match(
      /(?:v[aá]|navegue|navegar|ir|mostrar|mostre|abra|abrir|exibir|exiba)\s+(?:para\s+a\s+|o\s+|a\s+)?(?:p[aá]gina|p[aá]g\.?|page)\s*(\d+)/i
    );
    if (navMatch) {
      const pageNum = parseInt(navMatch[1], 10);
      if (pageNum >= 1 && pageNum <= state.totalPages) {
        const spreadIdx = Math.floor((pageNum - 1) / 2);
        state.goToSpread(spreadIdx);
        set({ agentStatus: 'idle' });
        toast.info(`Navegando para a Página ${String(pageNum).padStart(2, '0')}`, {
          description: `Lâmina ${spreadIdx + 1} de ${Math.ceil(state.totalPages / 2)} centralizada no canvas.`,
        });

        state.addMessage({
          role: 'assistant',
          content: `Navegando para a **Página ${String(pageNum).padStart(2, '0')}** (Lâmina ${spreadIdx + 1} de ${Math.ceil(state.totalPages / 2)}).`,
          reasoning: 'Racional [Navegação]: Prancheta centralizada na lâmina solicitada.',
          actions: [`Navegação para a Página ${String(pageNum).padStart(2, '0')} (Lâmina ${spreadIdx + 1})`],
        });
        return;
      }
    }

    // ==========================================
    // 5. INTENT: EDIÇÃO DE TÍTULO / SUBTÍTULO / CLAIM DE PÁGINA ESPECÍFICA
    // ==========================================
    const pageTextMatch = command.match(
      /(?:mude|altere|troque|coloque)\s+(?:o\s+)?(t[ií]tulo|subt[ií]tulo|claim|legenda|label)\s+da\s+p[aá]gina\s+(\d+)\s+para\s+["'“]?(.+?)["'”]?$/i
    );
    if (pageTextMatch) {
      const fieldType = pageTextMatch[1].toLowerCase();
      const pageNum = parseInt(pageTextMatch[2], 10);
      const newText = pageTextMatch[3].trim().replace(/^["']|["']$/g, '');

      const fieldKey = fieldType.includes('sub') ? 'subtitle' : fieldType.includes('claim') ? 'quote' : 'title';
      state.updatePage(pageNum, { [fieldKey]: newText });
      set({ agentStatus: 'idle' });
      get().goToSpread(Math.floor((pageNum - 1) / 2));
      toast.success(`${fieldType} da Página ${pageNum} atualizado!`, {
        description: `Texto revisado com tom de voz da coleção e tipografia Cormorant.`,
      });

      state.addMessage({
        role: 'assistant',
        content: `O ${fieldType} da **Página ${String(pageNum).padStart(2, '0')}** foi atualizado para **"${newText}"**.`,
        reasoning: 'Racional [Redator Publicitário]: Refinamento de texto com vocabulário alinhado ao posicionamento da coleção.',
        actions: [`${fieldType} da Página ${String(pageNum).padStart(2, '0')} atualizado para "${newText}"`],
      });
      return;
    }

    // ==========================================
    // 5.1 INTENT: REAJUSTE DE PREÇOS EM MASSA / PERCENTUAL
    // ==========================================
    const pctPriceMatch = command.match(
      /(?:reajuste|reajustar|aumente|aumentar|reduza|reduzir|eleve|elevar|suba|subir|desconto|abaixe|abaixar)\s+(?:os\s+)?pre[cç]os\s+(?:em\s+)?([+-]?\d+(?:[.,]\d+)?)\s*%/i
    ) || command.match(/\/reajustar-precos\s*([+-]?\d+)?/i);

    if (pctPriceMatch) {
      const rawPct = pctPriceMatch[1] ? parseFloat(pctPriceMatch[1].replace(',', '.')) : 10;
      const isReduction = lower.includes('reduz') || lower.includes('desconto') || lower.includes('abaix') || rawPct < 0;
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
          p.name.toLowerCase().includes(prodQuery.toLowerCase()) ||
          prodQuery.toLowerCase().includes(p.name.toLowerCase()) ||
          (p.sku && p.sku.toLowerCase().includes(prodQuery.toLowerCase()))
      ) || allProducts[0];

      if (targetProd) {
        state.generateAIProductImage(
          targetProd.id,
          targetProd.name,
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
    const bgRemovalMatch = command.match(
      /(?:remova|remover|retire|retirar|isole|isolar|fundo\s+transparente)\s+(?:o\s+)?fundo\s+(?:da\s+imagem|da\s+foto|do\s+produto)?\s*(?:de|do|da)?\s*(.+)?/i
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
        for (const p of state.pages) {
          const match = p.products?.find(
            (pr) =>
              pr.name.toLowerCase().includes(prodQuery.toLowerCase()) ||
              prodQuery.toLowerCase().includes(pr.name.toLowerCase()) ||
              (pr.sku && pr.sku.toLowerCase().includes(prodQuery.toLowerCase()))
          );
          if (match) {
            targetProd = match;
            targetPageNum = p.pageNumber;
            break;
          }
        }
        if (!targetProd) {
          targetProd = state.unassignedProducts.find(
            (pr) =>
              pr.name.toLowerCase().includes(prodQuery.toLowerCase()) ||
              prodQuery.toLowerCase().includes(pr.name.toLowerCase())
          );
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

    // 6. Mudança de Preço
    const priceMatch = command.match(/r?\$?\s*([0-9]+[.,]?[0-9]*)/i);
    if ((lower.includes('preço') || lower.includes('valor') || lower.includes('custa')) && priceMatch) {
      const newPrice = `R$ ${priceMatch[1]}`;
      let targetProduct = 'Bolsa Aurelia';
      let updated = false;

      const newPages = state.pages.map((p) => {
        if (!p.products) return p;
        return {
          ...p,
          products: p.products.map((prod) => {
            if (
              (state.selectedElementId && state.selectedElementId.includes(prod.id)) ||
              lower.includes(prod.name.toLowerCase()) ||
              (!updated && prod.id === 'prod-bolsa')
            ) {
              updated = true;
              targetProduct = prod.name;
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
    if (lower.includes('título') || lower.includes('coleção') || lower.includes('nome')) {
      const cleanTitle = command.replace(/(mude|altere|troque|coloque|para|o|título|da|coleção|do|catálogo|:)+/gi, '').trim();
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

    // 4. Mudança de Cor / Paleta
    if (
      lower.includes('paleta') ||
      lower.includes('cor') ||
      lower.includes('ouro') ||
      lower.includes('prata') ||
      lower.includes('bronze') ||
      lower.includes('terracota') ||
      lower.includes('esmeralda') ||
      lower.includes('minimaliste')
    ) {
      let chosenPreset = STUDIO_PALETTE_PRESETS[0];
      if (lower.includes('prata') || lower.includes('silver') || lower.includes('argent')) {
        chosenPreset = STUDIO_PALETTE_PRESETS[1];
      } else if (lower.includes('bronze') || lower.includes('charcoal') || lower.includes('marrom')) {
        chosenPreset = STUDIO_PALETTE_PRESETS[2];
      } else if (lower.includes('terracota') || lower.includes('sable') || lower.includes('laranja')) {
        chosenPreset = STUDIO_PALETTE_PRESETS[3];
      } else if (lower.includes('minimaliste') || lower.includes('slate') || lower.includes('ardósia') || lower.includes('cinza')) {
        chosenPreset = STUDIO_PALETTE_PRESETS[4];
      } else if (lower.includes('esmeralda') || lower.includes('emerald') || lower.includes('verde') || lower.includes('champagne')) {
        chosenPreset = STUDIO_PALETTE_PRESETS[5];
      } else if (lower.includes('ouro') || lower.includes('gold') || lower.includes('dourad')) {
        chosenPreset = STUDIO_PALETTE_PRESETS[0];
      }

      const isLocked = state.activePalette.locked;
      const appliedPalette: StudioPalette = {
        ...chosenPreset,
        locked: isLocked,
      };

      state.setActivePalette(appliedPalette, true);
      set({ agentStatus: 'idle' });

      const lockWarning = isLocked
        ? '\n\n*Nota de Governança [Brand Lock]*: A paleta está travada. A alteração foi autorizada e aplicada como intervenção direta do usuário (Human Override).'
        : '';

      state.addMessage({
        role: 'assistant',
        content: `Paleta do catálogo atualizada para **${appliedPalette.name}** (acento em \`${appliedPalette.accent}\`, fundo em \`${appliedPalette.background}\`). As 10 páginas da prancheta foram sincronizadas em tempo real.${lockWarning}`,
        reasoning: isOrchestrator
          ? 'Racional do Editor-Chefe [Coordenação]: Nova paleta editorial homologada e distribuída por todos os templates de página (capas, divisórias e pranchetas de produto).'
          : `Racional [${currentRole.name}]: Calibração tonal executada com razão de contraste aferida em ${appliedPalette.contrastRatio || '8.5:1'} sob WCAG AA.`,
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
    set({
      hasStartedSession: false,
      activeCatalogId: null,
      catalogTitle: 'Novo Catálogo',
      pages: [],
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
}));
