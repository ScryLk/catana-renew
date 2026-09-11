import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Package,
  Plus,
  Search,
  Scissors,
  Edit3,
  Trash2,
  ArrowUpRight,
  ChevronRight,
  Loader2,
  FileSpreadsheet,
  Sparkles,
} from 'lucide-react';
import { useStudioStore } from '../../store/studioStore';
import { ProductItem } from '../../data/aureaCatalog.mock';
import { Tooltip } from '../ui/Tooltip';
import { toast } from 'sonner';

export const ProductDrawer: React.FC = () => {
  const {
    isProductDrawerOpen,
    closeProductDrawer,
    activeTargetSlot,
    setActiveTargetSlot,
    pages,
    unassignedProducts,
    currentSpread,
    goToSpread,
    assignProductToSpread,
    addProductToRepository,
    deleteProductFromRepository,
    updateProduct,
    removeProductBackground,
    openExcelImportModal,
    generateAIProductImage,
    theme,
  } = useStudioStore();

  const isDark = theme === 'dark';

  // Filtros locais
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'assigned' | 'unassigned'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Modal / Subpainel de Novo Produto
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductCategory, setNewProductCategory] = useState('MARROQUINARIA');
  const [newProductPrice, setNewProductPrice] = useState('R$ 1.200');
  const [newProductSku, setNewProductSku] = useState('');
  const [newProductTag, setNewProductTag] = useState('');
  const [newProductDescription, setNewProductDescription] = useState('');
  const [newProductImage, setNewProductImage] = useState('/aurea/images/det-costura.jpg');

  // Modal / Menu rápido de Alocação
  const [targetProductToAssign, setTargetProductToAssign] = useState<ProductItem | null>(null);

  // Edição inline
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editPriceValue, setEditPriceValue] = useState('');
  const [editNameValue, setEditNameValue] = useState('');
  const [isProcessingAI, setIsProcessingAI] = useState<string | null>(null);

  // Fecha no ESC quando a gaveta estiver aberta
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isProductDrawerOpen) {
        if (targetProductToAssign) {
          setTargetProductToAssign(null);
        } else if (isAddModalOpen) {
          setIsAddModalOpen(false);
        } else {
          closeProductDrawer();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isProductDrawerOpen, targetProductToAssign, isAddModalOpen, closeProductDrawer]);

  // Agrega todos os produtos alocados nas páginas
  const allocatedProducts = useMemo(() => {
    const list: Array<ProductItem & { pageNumber: number; pageType: string }> = [];
    pages.forEach((page) => {
      if (page.products && page.products.length > 0) {
        page.products.forEach((prod) => {
          list.push({
            ...prod,
            pageNumber: page.pageNumber,
            pageType: page.type,
          });
        });
      }
    });
    return list;
  }, [pages]);

  // Lista mestre unificada de produtos
  const allProducts = useMemo(() => {
    const allocated = allocatedProducts.map((p) => ({
      ...p,
      isAssigned: true,
      pageNumber: p.pageNumber as number | undefined,
      pageType: p.pageType as string | undefined,
    }));
    const unassigned = unassignedProducts.map((p) => ({
      ...p,
      isAssigned: false,
      pageNumber: undefined,
      pageType: undefined,
    }));
    return [...allocated, ...unassigned];
  }, [allocatedProducts, unassignedProducts]);

  // Categorias únicas existentes
  const categories = useMemo(() => {
    const cats = new Set<string>();
    allProducts.forEach((p) => {
      if (p.category) cats.add(p.category);
    });
    return Array.from(cats);
  }, [allProducts]);

  // Cálculo de Métricas da Coleção
  const metrics = useMemo(() => {
    const total = allProducts.length;
    const allocatedCount = allocatedProducts.length;
    const unassignedCount = unassignedProducts.length;

    const prices = allProducts
      .map((p) => parseInt(p.price.replace(/[^0-9]/g, ''), 10))
      .filter((v) => !isNaN(v) && v > 0);

    const avgPriceNum = prices.length > 0
      ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
      : 0;

    const avgTicket = avgPriceNum > 0
      ? `R$ ${avgPriceNum.toLocaleString('pt-BR')}`
      : 'R$ 0';

    return { total, allocatedCount, unassignedCount, avgTicket };
  }, [allProducts, allocatedProducts, unassignedProducts]);

  // Produtos filtrados para exibição
  const filteredProducts = useMemo(() => {
    return allProducts.filter((prod) => {
      if (statusFilter === 'assigned' && !prod.isAssigned) return false;
      if (statusFilter === 'unassigned' && prod.isAssigned) return false;
      if (selectedCategory !== 'all' && prod.category !== selectedCategory) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = prod.name.toLowerCase().includes(q);
        const matchSku = prod.sku?.toLowerCase().includes(q);
        const matchCat = prod.category?.toLowerCase().includes(q);
        if (!matchName && !matchSku && !matchCat) return false;
      }

      return true;
    });
  }, [allProducts, statusFilter, selectedCategory, searchQuery]);

  // Ação: Navegar para o spread da página onde o produto está alocado
  const handleJumpToPage = (pageNumber?: number) => {
    if (!pageNumber) return;
    const spreadIndex = Math.floor((pageNumber - 1) / 2);
    goToSpread(spreadIndex);
    toast.info(`Visualizando Lâmina da Página ${String(pageNumber).padStart(2, '0')}`);
  };

  // Ação: Salvar edição inline
  const handleSaveInlineEdit = (productId: string) => {
    const updates: Partial<ProductItem> = {};
    if (editNameValue.trim()) updates.name = editNameValue.trim();
    if (editPriceValue.trim()) updates.price = editPriceValue.trim();

    updateProduct(productId, updates);
    setEditingProductId(null);
    toast.success('Produto atualizado com sucesso!');
  };

  // Ação: Remover fundo com IA
  const handleRemoveBg = async (prod: typeof allProducts[0]) => {
    try {
      setIsProcessingAI(prod.id);
      await removeProductBackground(prod.pageNumber || 0, prod.id);
    } finally {
      setIsProcessingAI(null);
    }
  };

  // Ação: Gerar fotografia de estúdio com IA
  const [isGeneratingAIPhoto, setIsGeneratingAIPhoto] = useState<string | null>(null);
  const handleGenerateAIPhoto = async (prod: typeof allProducts[0]) => {
    try {
      setIsGeneratingAIPhoto(prod.id);
      await generateAIProductImage(prod.id, prod.name, prod.category, prod.description);
    } finally {
      setIsGeneratingAIPhoto(null);
    }
  };

  // Ação: Criar novo produto no acervo
  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProductName.trim()) {
      toast.error('Informe o nome do produto.');
      return;
    }

    const nextIndex = String(allProducts.length + 1).padStart(2, '0');
    const defaultSku = newProductSku.trim() || `ART-${nextIndex}`;

    addProductToRepository({
      name: newProductName.trim(),
      category: newProductCategory.trim() || 'COLEÇÃO 2026',
      price: newProductPrice.trim() || 'R$ 1.000',
      sku: defaultSku,
      tag: newProductTag.trim() || 'Novo',
      description: newProductDescription.trim() || 'Peça confeccionada com acabamento artesanal de alto padrão.',
      image: newProductImage.trim() || '/aurea/images/det-costura.jpg',
      index: nextIndex,
    });

    // Limpar formulário
    setNewProductName('');
    setNewProductSku('');
    setNewProductTag('');
    setNewProductDescription('');
    setIsAddModalOpen(false);
  };

  // Páginas do catálogo aptas a receber produtos
  const productPages = useMemo(
    () => pages.filter((p) => ['hero', 'duo', 'single', 'grid_4'].includes(p.type)),
    [pages]
  );

  // Página selecionada no modal de alocação manual
  const [selectedSubpanelPageNumber, setSelectedSubpanelPageNumber] = useState<number | null>(null);

  // Sincroniza página default ao abrir modal manual de alocação
  useEffect(() => {
    if (targetProductToAssign) {
      const leftPageNum = currentSpread[0];
      const rightPageNum = currentSpread[1];
      const leftIsEligible = pages.find(
        (p) => p.pageNumber === leftPageNum && ['hero', 'duo', 'single', 'grid_4'].includes(p.type)
      );
      const rightIsEligible = pages.find(
        (p) => p.pageNumber === rightPageNum && ['hero', 'duo', 'single', 'grid_4'].includes(p.type)
      );

      if (leftIsEligible) {
        setSelectedSubpanelPageNumber(leftPageNum);
      } else if (rightIsEligible) {
        setSelectedSubpanelPageNumber(rightPageNum);
      } else if (productPages.length > 0) {
        setSelectedSubpanelPageNumber(productPages[0].pageNumber);
      }
    }
  }, [targetProductToAssign, currentSpread, pages, productPages]);

  // Estrutura de slots dinâmicos para cada tipo de página
  const getSlotsForPage = (targetPage?: (typeof pages)[0]) => {
    if (!targetPage) return [];
    if (targetPage.type === 'hero' || targetPage.type === 'single') {
      return [
        {
          slotIndex: 0,
          label: targetPage.type === 'hero' ? 'Slot 01 · Destaque Hero' : 'Slot 01 · Fechamento Editorial',
          currentProduct: targetPage.products?.[0] || null,
        },
      ];
    }
    if (targetPage.type === 'duo') {
      return [
        {
          slotIndex: 0,
          label: 'Slot 01 · Item A',
          currentProduct: targetPage.products?.[0] || null,
        },
        {
          slotIndex: 1,
          label: 'Slot 02 · Item B',
          currentProduct: targetPage.products?.[1] || null,
        },
      ];
    }
    if (targetPage.type === 'grid_4') {
      return [0, 1, 2, 3].map((idx) => ({
        slotIndex: idx,
        label: `Slot 0${idx + 1} · Matriz ${idx + 1}/4`,
        currentProduct: targetPage.products?.[idx] || null,
      }));
    }
    return [];
  };

  // Ação: 1-Clique para alocar diretamente no slot ativo
  const handleAssignToActiveSlot = (prod: ProductItem) => {
    if (!activeTargetSlot) return;
    assignProductToSpread(prod, activeTargetSlot.pageNumber, activeTargetSlot.slotIndex);
    const targetSpreadIndex = Math.floor((activeTargetSlot.pageNumber - 1) / 2);
    goToSpread(targetSpreadIndex);
    toast.success(`"${prod.name}" alocado no ${activeTargetSlot.slotLabel || `Slot 0${activeTargetSlot.slotIndex + 1}`}!`);
  };

  // Ação: Executar alocação na lâmina ativa
  const handleConfirmAssignment = (targetPageNumber: number, slotIndex = 0) => {
    if (!targetProductToAssign) return;

    assignProductToSpread(targetProductToAssign, targetPageNumber, slotIndex);
    const targetSpreadIndex = Math.floor((targetPageNumber - 1) / 2);
    goToSpread(targetSpreadIndex);
    toast.success(`"${targetProductToAssign.name}" alocado na Página ${String(targetPageNumber).padStart(2, '0')}, Slot 0${slotIndex + 1}!`);
    setTargetProductToAssign(null);
  };

  if (!isProductDrawerOpen) return null;

  return (
    <>
      {/* Backdrop suave */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs transition-opacity duration-200"
        onClick={closeProductDrawer}
        aria-hidden="true"
      />

      {/* Slide-over Drawer */}
      <aside
        className={`fixed top-0 right-0 z-50 h-full w-full sm:w-[420px] lg:w-[460px] border-l shadow-2xl flex flex-col transition-transform duration-300 animate-in slide-in-from-right select-none ${
          isDark
            ? 'bg-[#0b0b0e] border-zinc-800 text-zinc-100 shadow-[0_0_60px_rgba(0,0,0,0.9)]'
            : 'bg-[#FDFCFA] border-stone-200 text-stone-900 shadow-[0_0_40px_rgba(0,0,0,0.12)]'
        }`}
      >
        {/* Header */}
        <div
          className={`px-5 py-4 border-b flex items-center justify-between shrink-0 ${
            isDark ? 'border-zinc-800/90 bg-zinc-900/40' : 'border-stone-200 bg-[#F7F4EE]'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-xl border ${
                isDark
                  ? 'bg-zinc-900 border-zinc-800 text-zinc-200'
                  : 'bg-white border-stone-200 text-stone-800 shadow-2xs'
              }`}
            >
              <Package className="size-4 text-amber-700 dark:text-zinc-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold tracking-tight">Gaveta de Produtos</h2>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                    isDark
                      ? 'bg-zinc-900 border-zinc-800 text-zinc-400'
                      : 'bg-white border-stone-200 text-stone-600'
                  }`}
                >
                  {allProducts.length} itens
                </span>
              </div>
              <p className={`text-[11px] ${isDark ? 'text-zinc-400' : 'text-stone-500'}`}>
                Acervo central de produtos e alocação nas lâminas.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Tooltip text="Importar produtos de planilha Excel / CSV" position="bottom">
              <button
                type="button"
                onClick={openExcelImportModal}
                className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                  isDark
                    ? 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white'
                    : 'bg-white border-stone-200 hover:border-stone-300 text-stone-600 hover:text-stone-950'
                }`}
                aria-label="Importar planilha de produtos"
              >
                <FileSpreadsheet className="size-4" />
              </button>
            </Tooltip>

            <Tooltip text="Adicionar novo produto ao acervo" position="bottom">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                  isDark
                    ? 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white'
                    : 'bg-white border-stone-200 hover:border-stone-300 text-stone-700 hover:text-stone-950'
                }`}
                aria-label="Adicionar produto"
              >
                <Plus className="size-4" />
              </button>
            </Tooltip>

            <Tooltip text="Fechar gaveta (Esc ou P)" shortcut="Esc" position="bottom">
              <button
                type="button"
                onClick={closeProductDrawer}
                className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                  isDark
                    ? 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white'
                    : 'bg-white border-stone-200 hover:border-stone-300 text-stone-600 hover:text-stone-950'
                }`}
                aria-label="Fechar gaveta"
              >
                <X className="size-4" />
              </button>
            </Tooltip>
          </div>
        </div>

        {/* Metrics Overview Bar */}
        <div
          className={`grid grid-cols-3 gap-2 px-5 py-3 border-b shrink-0 ${
            isDark ? 'border-zinc-800/60 bg-[#0e0e12]' : 'border-stone-200 bg-[#FBF9F5]'
          }`}
        >
          <div className="flex flex-col">
            <span className={`text-[10px] font-mono uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-stone-500'}`}>Alocados</span>
            <span className={`text-xs font-semibold ${isDark ? 'text-zinc-200' : 'text-stone-900'}`}>
              {metrics.allocatedCount} no catálogo
            </span>
          </div>

          <div className="flex flex-col">
            <span className={`text-[10px] font-mono uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-stone-500'}`}>Disponíveis</span>
            <span className={`text-xs font-semibold ${isDark ? 'text-zinc-400' : 'text-stone-500'}`}>
              {metrics.unassignedCount} no acervo
            </span>
          </div>

          <div className="flex flex-col">
            <span className={`text-[10px] font-mono uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-stone-500'}`}>Ticket Médio</span>
            <span className={`text-xs font-semibold font-mono ${isDark ? 'text-zinc-200' : 'text-stone-900'}`}>
              {metrics.avgTicket}
            </span>
          </div>
        </div>

        {/* Active Target Slot Banner */}
        {activeTargetSlot && (
          <div
            className={`px-5 py-3 border-b flex items-center justify-between shrink-0 animate-in fade-in slide-in-from-top-1 duration-150 ${
              isDark
                ? 'bg-amber-950/20 border-amber-800/50 text-amber-200'
                : 'bg-amber-50/90 border-amber-200/90 text-amber-900 shadow-2xs'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`p-1.5 rounded-lg shrink-0 ${
                  isDark ? 'bg-amber-900/60 text-amber-300' : 'bg-amber-100 text-amber-800'
                }`}
              >
                <Plus className="size-3.5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono uppercase tracking-wider font-bold">
                    Alocação Direta Ativa
                  </span>
                  <span
                    className={`text-[9px] font-mono px-1.5 py-0.2 rounded border font-semibold ${
                      isDark
                        ? 'bg-amber-900/40 border-amber-700/60 text-amber-300'
                        : 'bg-white border-amber-300 text-amber-900'
                    }`}
                  >
                    PÁG. {String(activeTargetSlot.pageNumber).padStart(2, '0')}
                  </span>
                </div>
                <p className="text-xs font-semibold truncate mt-0.5">
                  {activeTargetSlot.slotLabel || `Slot 0${activeTargetSlot.slotIndex + 1}`}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveTargetSlot(null)}
              className={`text-[11px] font-medium px-2.5 py-1 rounded-md border transition-colors cursor-pointer shrink-0 ${
                isDark
                  ? 'border-amber-700/60 hover:bg-amber-900/40 text-amber-300'
                  : 'border-amber-300 bg-white hover:bg-amber-100 text-amber-900 shadow-2xs'
              }`}
              title="Cancelar alocação no slot específico"
            >
              Cancelar
            </button>
          </div>
        )}

        {/* Search & Filters */}
        <div className="p-4 border-b space-y-3 shrink-0">
          {/* Search Box */}
          <div className="relative">
            <Search className="size-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por nome, SKU ou categoria..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full text-xs pl-8 pr-3 py-2 rounded-xl border outline-none transition-colors ${
                isDark
                  ? 'bg-zinc-900 border-zinc-800 text-zinc-200 focus:border-zinc-600 placeholder-zinc-500'
                  : 'bg-white border-stone-200 text-stone-900 focus:border-amber-600/60 placeholder-stone-400'
              }`}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="size-3" />
              </button>
            )}
          </div>

          {/* Filter Tabs & Category Filter */}
          <div className="flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-medium text-[11px] transition-colors cursor-pointer ${
                  statusFilter === 'all'
                    ? isDark
                      ? 'bg-zinc-200 text-zinc-950 font-bold'
                      : 'bg-stone-900 text-white font-bold'
                    : isDark
                    ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                    : 'text-stone-600 hover:text-stone-950 hover:bg-stone-100'
                }`}
              >
                Todos ({allProducts.length})
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('assigned')}
                className={`px-2.5 py-1 rounded-lg font-medium text-[11px] transition-colors cursor-pointer ${
                  statusFilter === 'assigned'
                    ? isDark
                      ? 'bg-zinc-200 text-zinc-950 font-bold'
                      : 'bg-stone-900 text-white font-bold'
                    : isDark
                    ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                    : 'text-stone-600 hover:text-stone-950 hover:bg-stone-100'
                }`}
              >
                Alocados ({metrics.allocatedCount})
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('unassigned')}
                className={`px-2.5 py-1 rounded-lg font-medium text-[11px] transition-colors cursor-pointer ${
                  statusFilter === 'unassigned'
                    ? isDark
                      ? 'bg-zinc-200 text-zinc-950 font-bold'
                      : 'bg-stone-900 text-white font-bold'
                    : isDark
                    ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                    : 'text-stone-600 hover:text-stone-950 hover:bg-stone-100'
                }`}
              >
                Disponíveis ({metrics.unassignedCount})
              </button>
            </div>

            {/* Category Dropdown */}
            {categories.length > 0 && (
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className={`text-[11px] px-2 py-1 rounded-lg border outline-none cursor-pointer max-w-[120px] truncate ${
                  isDark
                    ? 'bg-zinc-900 border-zinc-800 text-zinc-300'
                    : 'bg-white border-stone-200 text-stone-800'
                }`}
              >
                <option value="all">Todas</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Product Cards List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredProducts.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-zinc-400">
              <Package className="size-8 text-zinc-600 mb-2" />
              <p className="text-xs font-medium text-zinc-300">Nenhum produto encontrado</p>
              <p className="text-[11px] text-zinc-500 mt-1 max-w-[240px]">
                Ajuste os filtros de busca ou cadastre um novo item no acervo.
              </p>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className={`mt-4 px-3.5 py-2 rounded-xl text-xs font-semibold border flex items-center gap-1.5 cursor-pointer ${
                  isDark
                    ? 'bg-zinc-900 border-zinc-700 hover:border-zinc-500 text-zinc-200'
                    : 'bg-zinc-50 border-zinc-300 hover:border-zinc-400 text-zinc-800'
                }`}
              >
                <Plus className="size-3.5" />
                <span>Cadastrar Novo Produto</span>
              </button>
            </div>
          ) : (
            filteredProducts.map((prod) => {
              const isEditing = editingProductId === prod.id;
              const isAIProcessingThis = isProcessingAI === prod.id;

              return (
                <div
                  key={prod.id}
                  className={`p-3.5 rounded-2xl border transition-all ${
                    isDark
                      ? 'bg-zinc-900/40 border-zinc-800 hover:border-zinc-700'
                      : 'bg-white border-stone-200 hover:border-amber-600/40 hover:shadow-xs'
                  }`}
                >
                  <div className="flex gap-3 items-start">
                    {/* Thumbnail with AI overlay */}
                    <div className="relative size-18 rounded-xl bg-stone-100 overflow-hidden border border-inherit shrink-0 group">
                      <img
                        src={prod.image}
                        alt={prod.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />

                      {/* Quick AI remove background action on hover */}
                      <Tooltip text="Remover fundo da imagem com IA" position="top">
                        <button
                          type="button"
                          onClick={() => handleRemoveBg(prod)}
                          disabled={isAIProcessingThis}
                          className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer text-white disabled:opacity-100"
                        >
                          {isAIProcessingThis ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Scissors className="size-4" />
                          )}
                        </button>
                      </Tooltip>
                    </div>

                    {/* Product Metadata & Actions */}
                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={editNameValue}
                            onChange={(e) => setEditNameValue(e.target.value)}
                            className={`w-full text-xs font-semibold px-2 py-1 rounded border outline-none ${
                              isDark
                                ? 'bg-zinc-900 border-zinc-700 text-zinc-100'
                                : 'bg-white border-zinc-300 text-zinc-900'
                            }`}
                            placeholder="Nome do produto"
                          />
                          <input
                            type="text"
                            value={editPriceValue}
                            onChange={(e) => setEditPriceValue(e.target.value)}
                            className={`w-full text-xs font-mono px-2 py-1 rounded border outline-none ${
                              isDark
                                ? 'bg-zinc-900 border-zinc-700 text-zinc-100'
                                : 'bg-white border-zinc-300 text-zinc-900'
                            }`}
                            placeholder="Preço (ex: R$ 1.500)"
                          />
                          <div className="flex items-center gap-1.5 pt-1">
                            <button
                              type="button"
                              onClick={() => handleSaveInlineEdit(prod.id)}
                              className="px-2.5 py-1 rounded bg-zinc-100 hover:bg-white text-zinc-950 text-[11px] font-semibold cursor-pointer"
                            >
                              Salvar
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingProductId(null)}
                              className="px-2 py-1 rounded text-zinc-400 hover:text-white text-[11px] cursor-pointer"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* Category & Status Badge */}
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className={`text-[9px] font-mono uppercase tracking-wider truncate ${
                              isDark ? 'text-zinc-400' : 'text-stone-500'
                            }`}>
                              {prod.category} {prod.sku ? `· ${prod.sku}` : ''}
                            </span>

                            {prod.isAssigned ? (
                              <Tooltip
                                text={`Clique para visualizar o spread da Página ${String(prod.pageNumber).padStart(2, '0')}`}
                                position="left"
                              >
                                <button
                                  type="button"
                                  onClick={() => handleJumpToPage(prod.pageNumber)}
                                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold cursor-pointer transition-colors border ${
                                    isDark
                                      ? 'bg-zinc-800 text-zinc-300 border-zinc-700/80 hover:bg-zinc-700/80'
                                      : 'bg-stone-100 text-stone-700 border-stone-300 hover:bg-stone-200'
                                  }`}
                                >
                                  <span>Pág. {String(prod.pageNumber).padStart(2, '0')}</span>
                                  <ArrowUpRight className="size-2.5" />
                                </button>
                              </Tooltip>
                            ) : (
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono font-medium border ${
                                isDark
                                  ? 'bg-zinc-800/60 text-zinc-400 border-zinc-700/50'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              }`}>
                                Disponível
                              </span>
                            )}
                          </div>

                          {/* Product Title & Price */}
                          <div className="flex items-baseline justify-between gap-2 mb-1">
                            <h3 className={`text-xs font-semibold truncate ${
                              isDark ? 'text-zinc-100' : 'text-stone-900'
                            }`}>
                              {prod.name}
                            </h3>
                            <span className={`text-xs font-mono font-bold shrink-0 ${
                              isDark ? 'text-zinc-200' : 'text-amber-800'
                            }`}>
                              {prod.price}
                            </span>
                          </div>

                          {/* Description */}
                          <p className={`text-[10.5px] line-clamp-1 leading-snug mb-2 ${
                            isDark ? 'text-zinc-400' : 'text-stone-600'
                          }`}>
                            {prod.description}
                          </p>

                          {/* Action Toolbar on Card */}
                          <div className="flex items-center justify-between pt-1 border-t border-inherit">
                            <div className="flex items-center gap-1">
                              {/* Edit Button */}
                              <Tooltip text="Editar nome e preço" position="bottom">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingProductId(prod.id);
                                    setEditNameValue(prod.name);
                                    setEditPriceValue(prod.price);
                                  }}
                                  className={`p-1 rounded transition-colors cursor-pointer ${
                                    isDark ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-stone-100 text-stone-600'
                                  }`}
                                  aria-label="Editar dados"
                                >
                                  <Edit3 className="size-3" />
                                </button>
                              </Tooltip>

                              {/* AI Photo Generation Button */}
                              <Tooltip text="Gerar nova fotografia de estúdio com IA" position="bottom">
                                <button
                                  type="button"
                                  onClick={() => handleGenerateAIPhoto(prod)}
                                  disabled={isGeneratingAIPhoto === prod.id}
                                  className={`p-1 rounded transition-colors cursor-pointer ${
                                    isDark
                                      ? 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                                      : 'hover:bg-stone-100 text-stone-600 hover:text-stone-900'
                                  }`}
                                  aria-label="Gerar foto com IA"
                                >
                                  {isGeneratingAIPhoto === prod.id ? (
                                    <Loader2 className="size-3 animate-spin text-zinc-300" />
                                  ) : (
                                    <Sparkles className="size-3" />
                                  )}
                                </button>
                              </Tooltip>

                              {/* Delete if unassigned */}
                              {!prod.isAssigned && (
                                <Tooltip text="Remover do acervo" position="bottom">
                                  <button
                                    type="button"
                                    onClick={() => deleteProductFromRepository(prod.id)}
                                    className="p-1 rounded text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                    aria-label="Remover produto"
                                  >
                                    <Trash2 className="size-3" />
                                  </button>
                                </Tooltip>
                              )}
                            </div>

                            {/* Inserir na Lâmina Ativa Trigger */}
                            {activeTargetSlot ? (
                              <button
                                type="button"
                                onClick={() => handleAssignToActiveSlot(prod)}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-xs ${
                                  isDark
                                    ? 'bg-amber-600 hover:bg-amber-500 text-white'
                                    : 'bg-amber-700 hover:bg-amber-800 text-white'
                                }`}
                              >
                                <Plus className="size-3.5" />
                                <span>+ Alocar neste Slot</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setTargetProductToAssign(prod)}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10.5px] font-semibold transition-colors cursor-pointer ${
                                  isDark
                                    ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white'
                                    : 'bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-300/70'
                                }`}
                              >
                                <span>Alocar no Canvas</span>
                                <ChevronRight className="size-3" />
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Subpainel / Modal de Alocação no Canvas */}
        {targetProductToAssign && (
          <div
            className={`p-4 border-t backdrop-blur-md animate-in slide-in-from-bottom duration-150 shrink-0 ${
              isDark ? 'bg-zinc-950/95 border-zinc-800' : 'bg-[#FAF7F2]/98 border-stone-200 shadow-lg'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`text-xs font-semibold truncate ${isDark ? 'text-zinc-100' : 'text-stone-900'}`}>
                  Alocar "{targetProductToAssign.name}"
                </span>
                <span className="text-[10px] font-mono text-amber-700 dark:text-amber-400 font-bold shrink-0">
                  {targetProductToAssign.price}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setTargetProductToAssign(null)}
                className={`p-1 rounded-md transition-colors cursor-pointer shrink-0 ${
                  isDark ? 'text-zinc-400 hover:text-white' : 'text-stone-500 hover:text-stone-900'
                }`}
                aria-label="Cancelar alocação"
              >
                <X className="size-4" />
              </button>
            </div>

            <p className={`text-[11px] mb-2.5 ${isDark ? 'text-zinc-400' : 'text-stone-600'}`}>
              Selecione a página de destino e o slot onde deseja posicionar o item:
            </p>

            {/* Page Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-3 custom-scrollbar">
              {productPages.map((p) => {
                const isSelected = selectedSubpanelPageNumber === p.pageNumber;
                const isCurrentSpreadPage = currentSpread.includes(p.pageNumber);
                return (
                  <button
                    key={`tab-page-${p.pageNumber}`}
                    type="button"
                    onClick={() => setSelectedSubpanelPageNumber(p.pageNumber)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-all cursor-pointer border ${
                      isSelected
                        ? isDark
                          ? 'bg-zinc-100 text-zinc-950 font-bold border-white'
                          : 'bg-stone-900 text-white font-bold border-stone-900 shadow-xs'
                        : isDark
                        ? 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                        : 'bg-white border-stone-200 text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    <span>Pág. {String(p.pageNumber).padStart(2, '0')}</span>
                    <span className="opacity-70 ml-1">({p.type})</span>
                    {isCurrentSpreadPage && (
                      <span className="ml-1 text-[9px] text-amber-700 dark:text-amber-400 font-bold font-mono">
                        · Ativa
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Slots for Selected Page */}
            {(() => {
              const selectedPage = pages.find((p) => p.pageNumber === selectedSubpanelPageNumber);
              if (!selectedPage) {
                return (
                  <p className="text-xs text-stone-400 text-center py-3">
                    Nenhuma página com slots disponível.
                  </p>
                );
              }

              const slots = getSlotsForPage(selectedPage);

              return (
                <div className="space-y-2">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-stone-500 flex items-center justify-between">
                    <span>
                      Slots em Pág. {String(selectedPage.pageNumber).padStart(2, '0')} ({selectedPage.type})
                    </span>
                    <span>{slots.filter((s) => !s.currentProduct).length} de {slots.length} livres</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                    {slots.map((slot) => {
                      const isOccupied = Boolean(slot.currentProduct);
                      return (
                        <button
                          key={`slot-btn-${slot.slotIndex}`}
                          type="button"
                          onClick={() => handleConfirmAssignment(selectedPage.pageNumber, slot.slotIndex)}
                          className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between group ${
                            isDark
                              ? 'bg-zinc-900/80 border-zinc-800 hover:border-amber-600/70 hover:bg-zinc-800/80'
                              : 'bg-white border-stone-200 hover:border-amber-600/70 hover:bg-amber-50/40 shadow-xs'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-amber-700 dark:text-amber-400">
                              {slot.label}
                            </span>
                            <span
                              className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ${
                                isOccupied
                                  ? isDark
                                    ? 'bg-zinc-800 text-zinc-400 border-zinc-700'
                                    : 'bg-stone-100 text-stone-500 border-stone-200'
                                  : isDark
                                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              }`}
                            >
                              {isOccupied ? 'Ocupado' : 'Livre'}
                            </span>
                          </div>

                          <div className="text-xs font-semibold truncate">
                            {isOccupied ? (
                              <span className={isDark ? 'text-zinc-300' : 'text-stone-700'}>
                                Substituir: {slot.currentProduct?.name}
                              </span>
                            ) : (
                              <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                                + Alocar neste espaço
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Modal / Formulário de Cadastro de Novo Produto */}
        {isAddModalOpen && (
          <div
            className={`absolute inset-0 z-50 p-6 flex flex-col justify-between animate-in zoom-in-95 duration-150 ${
              isDark ? 'bg-black/90 backdrop-blur-sm text-zinc-100' : 'bg-[#FAF7F2]/98 backdrop-blur-sm text-stone-900'
            }`}
          >
            <div className="space-y-4">
              <div
                className={`flex items-center justify-between border-b pb-3 ${
                  isDark ? 'border-zinc-800' : 'border-stone-200'
                }`}
              >
                <h3 className="text-sm font-semibold">Novo Produto no Acervo</h3>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className={`cursor-pointer ${isDark ? 'text-zinc-400 hover:text-white' : 'text-stone-500 hover:text-stone-900'}`}
                >
                  <X className="size-4" />
                </button>
              </div>

              <form onSubmit={handleCreateProduct} className="space-y-3 text-xs">
                <div>
                  <label className={`block text-[11px] font-medium mb-1 ${isDark ? 'text-zinc-400' : 'text-stone-600'}`}>
                    Nome da Peça
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Bolsa Satchel Lucca"
                    value={newProductName}
                    onChange={(e) => setNewProductName(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg border outline-none transition-colors ${
                      isDark
                        ? 'bg-zinc-900 border-zinc-700 text-zinc-100 focus:border-zinc-500'
                        : 'bg-white border-stone-200 text-stone-900 focus:border-amber-600/60'
                    }`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={`block text-[11px] font-medium mb-1 ${isDark ? 'text-zinc-400' : 'text-stone-600'}`}>
                      Categoria
                    </label>
                    <input
                      type="text"
                      placeholder="MARROQUINARIA"
                      value={newProductCategory}
                      onChange={(e) => setNewProductCategory(e.target.value)}
                      className={`w-full px-3 py-2 rounded-lg border outline-none transition-colors ${
                        isDark
                          ? 'bg-zinc-900 border-zinc-700 text-zinc-100 focus:border-zinc-500'
                          : 'bg-white border-stone-200 text-stone-900 focus:border-amber-600/60'
                      }`}
                    />
                  </div>

                  <div>
                    <label className={`block text-[11px] font-medium mb-1 ${isDark ? 'text-zinc-400' : 'text-stone-600'}`}>
                      Preço
                    </label>
                    <input
                      type="text"
                      placeholder="R$ 1.950"
                      value={newProductPrice}
                      onChange={(e) => setNewProductPrice(e.target.value)}
                      className={`w-full px-3 py-2 rounded-lg border font-mono outline-none transition-colors ${
                        isDark
                          ? 'bg-zinc-900 border-zinc-700 text-zinc-100 focus:border-zinc-500'
                          : 'bg-white border-stone-200 text-stone-900 focus:border-amber-600/60'
                      }`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={`block text-[11px] font-medium mb-1 ${isDark ? 'text-zinc-400' : 'text-stone-600'}`}>
                      SKU / Código
                    </label>
                    <input
                      type="text"
                      placeholder="ART-011"
                      value={newProductSku}
                      onChange={(e) => setNewProductSku(e.target.value)}
                      className={`w-full px-3 py-2 rounded-lg border font-mono outline-none transition-colors ${
                        isDark
                          ? 'bg-zinc-900 border-zinc-700 text-zinc-100 focus:border-zinc-500'
                          : 'bg-white border-stone-200 text-stone-900 focus:border-amber-600/60'
                      }`}
                    />
                  </div>

                  <div>
                    <label className={`block text-[11px] font-medium mb-1 ${isDark ? 'text-zinc-400' : 'text-stone-600'}`}>
                      Tag Especial
                    </label>
                    <input
                      type="text"
                      placeholder="Lançamento"
                      value={newProductTag}
                      onChange={(e) => setNewProductTag(e.target.value)}
                      className={`w-full px-3 py-2 rounded-lg border outline-none transition-colors ${
                        isDark
                          ? 'bg-zinc-900 border-zinc-700 text-zinc-100 focus:border-zinc-500'
                          : 'bg-white border-stone-200 text-stone-900 focus:border-amber-600/60'
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <label className={`block text-[11px] font-medium mb-1 ${isDark ? 'text-zinc-400' : 'text-stone-600'}`}>
                    Descrição Editorial
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Couro nobre, costura manual, acabamento fino..."
                    value={newProductDescription}
                    onChange={(e) => setNewProductDescription(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg border outline-none resize-none transition-colors ${
                      isDark
                        ? 'bg-zinc-900 border-zinc-700 text-zinc-100 focus:border-zinc-500'
                        : 'bg-white border-stone-200 text-stone-900 focus:border-amber-600/60'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block text-[11px] font-medium mb-1 ${isDark ? 'text-zinc-400' : 'text-stone-600'}`}>
                    Caminho ou URL da Imagem
                  </label>
                  <input
                    type="text"
                    placeholder="/aurea/images/det-atelier.jpg"
                    value={newProductImage}
                    onChange={(e) => setNewProductImage(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg border outline-none font-mono text-[11px] transition-colors ${
                      isDark
                        ? 'bg-zinc-900 border-zinc-700 text-zinc-100 focus:border-zinc-500'
                        : 'bg-white border-stone-200 text-stone-900 focus:border-amber-600/60'
                    }`}
                  />
                </div>

                <div className="pt-3 flex items-center gap-2">
                  <button
                    type="submit"
                    className={`flex-1 py-2.5 px-4 rounded-xl font-semibold text-xs transition-colors cursor-pointer ${
                      isDark
                        ? 'bg-zinc-100 hover:bg-white text-zinc-950'
                        : 'bg-stone-900 hover:bg-stone-800 text-white'
                    }`}
                  >
                    Salvar no Acervo
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className={`py-2.5 px-4 rounded-xl text-xs border cursor-pointer transition-colors ${
                      isDark
                        ? 'text-zinc-400 hover:text-white border-zinc-700'
                        : 'text-stone-600 hover:text-stone-950 border-stone-200 bg-white'
                    }`}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </aside>
    </>
  );
};
