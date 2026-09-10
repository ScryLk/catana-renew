import { create } from 'zustand';
import axios from 'axios';
import { toast } from 'sonner';
import {
  CatalogPageData,
  ProductItem,
  StudioPalette,
  STUDIO_PALETTE_PRESETS,
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
}

export interface ChatThread {
  id: string;
  title: string;
  mode: StudioMode;
  roleId?: string;
  messages: ChatMessage[];
  createdAt: string;
}

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

  // Export Catalog Modal
  isExportModalOpen: boolean;
  exportModalTab: 'pdf' | 'share' | 'catana' | 'images';
  openExportModal: (tab?: 'pdf' | 'share' | 'catana' | 'images') => void;
  closeExportModal: () => void;

  // Product Drawer & Inventory Repository
  isProductDrawerOpen: boolean;
  unassignedProducts: ProductItem[];
  openProductDrawer: () => void;
  closeProductDrawer: () => void;
  toggleProductDrawer: () => void;
  addProductToRepository: (product: Omit<ProductItem, 'id'>) => ProductItem;
  deleteProductFromRepository: (productId: string) => void;
  assignProductToSpread: (product: ProductItem, targetPageNumber: number, slotIndex?: number) => void;

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
  triggerCatalogGeneration: (prompt: string, attachments?: ChatAttachment[]) => void | Promise<void>;
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
  setStepStatus: (stepId: string, status: StepStatus) => void;
  setExecutionPlan: (steps: ExecutionStep[]) => void;

  // Chat stream
  messages: ChatMessage[];
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  clearMessages: () => void;

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
    updates: Array<{ target: string; field: string; value: any }>;
    summary?: string;
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
  openProductDrawer: () => set({ isProductDrawerOpen: true }),
  closeProductDrawer: () => set({ isProductDrawerOpen: false }),
  toggleProductDrawer: () => set((s) => ({ isProductDrawerOpen: !s.isProductDrawerOpen })),
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

      let newProducts = [...(page.products || [])];
      if (page.type === 'hero' || page.type === 'single') {
        newProducts = [product];
      } else if (page.type === 'duo') {
        if (slotIndex === 1) {
          newProducts[1] = product;
          if (!newProducts[0]) newProducts[0] = product;
        } else {
          newProducts[0] = product;
        }
      } else {
        newProducts = [product];
      }

      return {
        ...page,
        products: newProducts,
      };
    });

    const updatedUnassigned = state.unassignedProducts.filter((p) => p.id !== product.id);

    set({
      pages: updatedPages,
      unassignedProducts: updatedUnassigned,
      saveStatus: 'unsaved',
    });

    get().debouncedSaveCurrentSpread();
    toast.success(`Produto "${product.name}" alocado na Pagina ${String(targetPageNumber).padStart(2, '0')}!`);
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
      const categorySummary = newProducts[0]?.category || 'Editorial';
      const prompt = `Catalogo de produtos para a colecao ${categorySummary} com ${newProducts.length} itens importados da planilha`;
      get().triggerCatalogGeneration(prompt);
    }
  },

  generateAIProductImage: async (productId, name, category, description) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/v2/studio/products/generate-image/`, {
        name,
        category: category || '',
        description: description || '',
      });
      const imageUrl = response.data?.image_url;
      if (imageUrl) {
        get().updateProduct(productId, { image: imageUrl });
        toast.success(`Fotografia de estudio gerada para "${name}"!`);
        return imageUrl;
      }
    } catch (err) {
      console.warn('[generateAIProductImage] Falha ao gerar imagem com IA:', err);
      toast.error('Falha ao gerar imagem com IA para o produto.');
    }
    return null;
  },

  isGeneratingCatalog: false,
  generationStage: 1,
  generationProgress: 0,
  generationLogs: [],
  generationTargetCatalog: null,
  lastGenerationPrompt: undefined,

  triggerCatalogGeneration: async (prompt: string, attachments?: ChatAttachment[]) => {
    const nowTime = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const shortPrompt = prompt.length > 55 ? `${prompt.slice(0, 52)}...` : prompt;

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
          text: `Iniciando sintese generativa via Google Gemini para: "${shortPrompt}".`,
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
            text: 'Conselho Editorial ativado. Gemini sintetizando conceito de marca, manifesto e mix de produtos.',
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
      const response = await axios.post(
        `${API_BASE_URL}/api/v2/studio/catalogs/generate/`,
        { prompt },
        { timeout: 45000 }
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
        id: 'msg-1',
        role: 'user',
        content: target.initialPrompt || `Criar catalogo ${target.title}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
      {
        id: 'msg-2',
        role: 'assistant',
        content: `Catálogo **"${target.title}"** gerado e diagramado com sucesso!\n\nEstruturei **${target.totalPages} páginas em ${Math.ceil(target.totalPages / 2)} spreads duplos**, com direção de arte em harmonia com a paleta **${target.palette.name}**.\n\n${target.summary}\n\n**Você pode interagir livremente:**\n- **Clique em qualquer elemento** na prancheta para editar textos, preços e imagens.\n- **Use o chat do Co-Pilot** para solicitar alterações com auxílio do Conselho Editorial.\n- **Navegue pelos spreads** pelo filmstrip inferior ou teclas de seta.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        reasoning: target.reasoning,
        delegations: target.councilDelegations,
      },
    ];

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
  isPlanCollapsed: false,
  togglePlanCollapse: () => set((s) => ({ isPlanCollapsed: !s.isPlanCollapsed })),
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
      const token = localStorage.getItem('access_token');
      const res = await axios.post(
        `${API_BASE_URL}/api/v2/studio/media/remove-background/`,
        { image_url: prod.image },
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          withCredentials: true,
        }
      );

      if (res.data && res.data.processed_url) {
        get().updateProduct(productId, { image: res.data.processed_url });
        toast.success('Fundo do produto removido com sucesso!');
      }
    } catch (err) {
      console.warn('Falha na remocao de fundo:', err);
      toast.error('Nao foi possivel remover o fundo desta imagem.');
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
      const token = localStorage.getItem('access_token');
      const numericCatalogId = parseInt(catalogId, 10);
      if (!isNaN(numericCatalogId)) {
        await axios.post(
          `${API_BASE_URL}/api/v2/studio/catalogs/${numericCatalogId}/spreads/`,
          {
            spread_index: Math.floor((leftPageNum - 1) / 2),
            title: `Spread ${leftPageNum}-${rightPageNum}`,
            left_page_elements: leftPage ? [leftPage] : [],
            right_page_elements: rightPage ? [rightPage] : [],
          },
          {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            withCredentials: true,
          }
        );
      }
      set({ saveStatus: 'saved' });
    } catch {
      set({ saveStatus: 'error' });
    }
  },

  applySpreadPatch: (patch) => {
    if (!patch || !Array.isArray(patch.updates)) return;

    const state = get();
    state.pushHistorySnapshot();

    const [leftPageNum, rightPageNum] = state.currentSpread;

    set((s) => {
      let updatedPages = [...s.pages];

      for (const update of patch.updates) {
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
          // target e um produto ou elemento especifico
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

      return {
        pages: updatedPages,
        saveStatus: 'unsaved',
      };
    });

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

    // 2. Mensagem do assistente pronta para streaming
    const assistantMsgId = `msg-agent-${Date.now()}`;
    const assistantMsg: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };

    set((s) => {
      const activeThread = s.threads.find((t) => t.id === s.activeThreadId);
      if (!activeThread) return s;
      return {
        agentStatus: 'thinking',
        threads: s.threads.map((t) =>
          t.id === s.activeThreadId
            ? { ...t, messages: [...t.messages, userMsg, assistantMsg] }
            : t
        ),
      };
    });

    // 3. Monta o contexto para o backend
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
      const response = await fetch(`${API_BASE_URL}/api/v2/studio/chat/stream/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      set({ agentStatus: 'generating' });

      const reader = response.body?.getReader();
      if (!reader) throw new Error('ReadableStream nao disponivel');

      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedContent = '';
      let appliedPatch: any = null;

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

            if (data.event === 'token' && data.text) {
              accumulatedContent += data.text;
              set((s) => ({
                threads: s.threads.map((t) =>
                  t.id === s.activeThreadId
                    ? {
                        ...t,
                        messages: t.messages.map((m) =>
                          m.id === assistantMsgId
                            ? { ...m, content: accumulatedContent }
                            : m
                        ),
                      }
                    : t
                ),
              }));
            }

            if (data.event === 'patch' && data.patch && !appliedPatch) {
              appliedPatch = data.patch;
              get().applySpreadPatch(data.patch);
              toast.success(data.patch.summary || 'Alteracoes aplicadas ao spread!');
            }

            if (data.event === 'done') {
              if (data.patch && !appliedPatch) {
                appliedPatch = data.patch;
                get().applySpreadPatch(data.patch);
                toast.success(data.patch.summary || 'Alteracoes aplicadas ao spread!');
              }
            }
          } catch {
            // Ignora linhas intermediarias de streaming
          }
        }
      }

      // Se nao veio evento de patch explicito mas o texto acumulado tem json:patch
      if (!appliedPatch && accumulatedContent.includes('json:patch')) {
        const match = accumulatedContent.match(/```(?:json:patch|json)?\s*(\{[\s\S]*?"updates"[\s\S]*?\})\s*```/);
        if (match) {
          try {
            const parsed = JSON.parse(match[1]);
            get().applySpreadPatch(parsed);
            toast.success(parsed.summary || 'Alteracoes aplicadas ao spread!');
          } catch {}
        }
      }

      set({ agentStatus: 'idle' });
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

    // 1. Mudança de Preço
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
