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
} from 'lucide-react';
import { useStudioStore } from '../../store/studioStore';
import { ProductItem } from '../../data/aureaCatalog.mock';
import { Tooltip } from '../ui/Tooltip';
import { toast } from 'sonner';

export const ProductDrawer: React.FC = () => {
  const {
    isProductDrawerOpen,
    closeProductDrawer,
    pages,
    unassignedProducts,
    currentSpread,
    goToSpread,
    assignProductToSpread,
    addProductToRepository,
    deleteProductFromRepository,
    updateProduct,
    removeProductBackground,
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

  // Ação: Executar alocação na lâmina ativa
  const handleConfirmAssignment = (targetPageNumber: number, slotIndex = 0) => {
    if (!targetProductToAssign) return;

    assignProductToSpread(targetProductToAssign, targetPageNumber, slotIndex);
    setTargetProductToAssign(null);
  };

  if (!isProductDrawerOpen) return null;

  const leftPageNumber = currentSpread[0];
  const rightPageNumber = currentSpread[1];
  const leftPage = pages.find((p) => p.pageNumber === leftPageNumber);
  const rightPage = pages.find((p) => p.pageNumber === rightPageNumber);

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
        className={`fixed top-0 right-0 z-50 h-full w-full sm:w-[420px] lg:w-[440px] border-l shadow-2xl flex flex-col transition-transform duration-300 animate-in slide-in-from-right select-none ${
          isDark
            ? 'bg-[#0b0b0e] border-zinc-800 text-zinc-100 shadow-[0_0_60px_rgba(0,0,0,0.9)]'
            : 'bg-white border-zinc-200 text-zinc-900 shadow-[0_0_40px_rgba(0,0,0,0.15)]'
        }`}
      >
        {/* Header */}
        <div
          className={`px-5 py-4 border-b flex items-center justify-between shrink-0 ${
            isDark ? 'border-zinc-800/90 bg-zinc-900/40' : 'border-zinc-200 bg-zinc-50'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-xl border ${
                isDark
                  ? 'bg-zinc-900 border-zinc-800 text-zinc-200'
                  : 'bg-zinc-100 border-zinc-200 text-zinc-800'
              }`}
            >
              <Package className="size-4 text-zinc-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold tracking-tight">Gaveta de Produtos</h2>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                    isDark
                      ? 'bg-zinc-900 border-zinc-800 text-zinc-400'
                      : 'bg-zinc-100 border-zinc-200 text-zinc-600'
                  }`}
                >
                  {allProducts.length} itens
                </span>
              </div>
              <p className={`text-[11px] ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                Acervo central de produtos e alocação nas lâminas.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Tooltip text="Adicionar novo produto ao acervo" position="bottom">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                  isDark
                    ? 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white'
                    : 'bg-zinc-100 border-zinc-200 hover:border-zinc-300 text-zinc-700 hover:text-zinc-950'
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
                    : 'bg-zinc-100 border-zinc-200 hover:border-zinc-300 text-zinc-600 hover:text-zinc-950'
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
            isDark ? 'border-zinc-800/60 bg-[#0e0e12]' : 'border-zinc-200 bg-zinc-50/50'
          }`}
        >
          <div className="flex flex-col">
            <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">Alocados</span>
            <span className="text-xs font-semibold text-emerald-400">
              {metrics.allocatedCount} no catálogo
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">Disponíveis</span>
            <span className="text-xs font-semibold text-amber-400">
              {metrics.unassignedCount} no acervo
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">Ticket Médio</span>
            <span className="text-xs font-semibold font-mono text-zinc-200">
              {metrics.avgTicket}
            </span>
          </div>
        </div>

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
                  : 'bg-zinc-50 border-zinc-200 text-zinc-800 focus:border-zinc-400 placeholder-zinc-400'
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
                      : 'bg-zinc-900 text-white font-bold'
                    : isDark
                    ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                    : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100'
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
                      : 'bg-zinc-900 text-white font-bold'
                    : isDark
                    ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                    : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100'
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
                      : 'bg-zinc-900 text-white font-bold'
                    : isDark
                    ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                    : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100'
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
                    : 'bg-zinc-50 border-zinc-200 text-zinc-700'
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
                      : 'bg-zinc-50/70 border-zinc-200 hover:border-zinc-300'
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
                            <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-wider truncate">
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
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-mono font-bold cursor-pointer hover:bg-emerald-500/20 transition-colors"
                                >
                                  <span>Pág. {String(prod.pageNumber).padStart(2, '0')}</span>
                                  <ArrowUpRight className="size-2.5" />
                                </button>
                              </Tooltip>
                            ) : (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] font-mono font-medium">
                                Disponível
                              </span>
                            )}
                          </div>

                          {/* Product Title & Price */}
                          <div className="flex items-baseline justify-between gap-2 mb-1">
                            <h3 className="text-xs font-semibold truncate text-zinc-100">
                              {prod.name}
                            </h3>
                            <span className="text-xs font-mono font-bold text-zinc-200 shrink-0">
                              {prod.price}
                            </span>
                          </div>

                          {/* Description */}
                          <p className="text-[10.5px] text-zinc-400 line-clamp-1 leading-snug mb-2">
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
                                    isDark ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-zinc-200 text-zinc-600'
                                  }`}
                                  aria-label="Editar dados"
                                >
                                  <Edit3 className="size-3" />
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
                            <button
                              type="button"
                              onClick={() => setTargetProductToAssign(prod)}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10.5px] font-semibold transition-colors cursor-pointer ${
                                isDark
                                  ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white'
                                  : 'bg-zinc-200 hover:bg-zinc-300 text-zinc-800'
                              }`}
                            >
                              <span>Alocar no Canvas</span>
                              <ChevronRight className="size-3" />
                            </button>
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
          <div className="p-4 border-t bg-black/40 backdrop-blur-md animate-in slide-in-from-bottom duration-150">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold">
                Alocar "{targetProductToAssign.name}"
              </div>
              <button
                type="button"
                onClick={() => setTargetProductToAssign(null)}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="size-3.5" />
              </button>
            </div>
            <p className="text-[11px] text-zinc-400 mb-3">
              Selecione em qual página do spread ativo você deseja posicionar este item:
            </p>

            <div className="grid grid-cols-2 gap-2">
              {leftPage && (
                <button
                  type="button"
                  onClick={() => handleConfirmAssignment(leftPage.pageNumber, 0)}
                  className={`p-2.5 rounded-xl border text-left cursor-pointer transition-colors ${
                    isDark
                      ? 'bg-zinc-900 border-zinc-700 hover:border-zinc-500 text-zinc-200'
                      : 'bg-zinc-100 border-zinc-300 hover:border-zinc-400 text-zinc-900'
                  }`}
                >
                  <div className="text-[10px] font-mono text-zinc-400">PÁGINA {String(leftPage.pageNumber).padStart(2, '0')}</div>
                  <div className="text-xs font-semibold truncate capitalize">{leftPage.type}</div>
                  <div className="text-[10px] text-zinc-400 mt-1">Lado Esquerdo</div>
                </button>
              )}

              {rightPage && (
                <button
                  type="button"
                  onClick={() => handleConfirmAssignment(rightPage.pageNumber, 0)}
                  className={`p-2.5 rounded-xl border text-left cursor-pointer transition-colors ${
                    isDark
                      ? 'bg-zinc-900 border-zinc-700 hover:border-zinc-500 text-zinc-200'
                      : 'bg-zinc-100 border-zinc-300 hover:border-zinc-400 text-zinc-900'
                  }`}
                >
                  <div className="text-[10px] font-mono text-zinc-400">PÁGINA {String(rightPage.pageNumber).padStart(2, '0')}</div>
                  <div className="text-xs font-semibold truncate capitalize">{rightPage.type}</div>
                  <div className="text-[10px] text-zinc-400 mt-1">Lado Direito</div>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Modal / Formulário de Cadastro de Novo Produto */}
        {isAddModalOpen && (
          <div className="absolute inset-0 z-50 bg-black/85 backdrop-blur-sm p-6 flex flex-col justify-between animate-in zoom-in-95 duration-150">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-3 border-zinc-800">
                <h3 className="text-sm font-semibold">Novo Produto no Acervo</h3>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="text-zinc-400 hover:text-white cursor-pointer"
                >
                  <X className="size-4" />
                </button>
              </div>

              <form onSubmit={handleCreateProduct} className="space-y-3 text-xs">
                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                    Nome da Peça
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Bolsa Satchel Lucca"
                    value={newProductName}
                    onChange={(e) => setNewProductName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 outline-none focus:border-zinc-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                      Categoria
                    </label>
                    <input
                      type="text"
                      placeholder="MARROQUINARIA"
                      value={newProductCategory}
                      onChange={(e) => setNewProductCategory(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 outline-none focus:border-zinc-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                      Preço
                    </label>
                    <input
                      type="text"
                      placeholder="R$ 1.950"
                      value={newProductPrice}
                      onChange={(e) => setNewProductPrice(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 font-mono outline-none focus:border-zinc-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                      SKU / Código
                    </label>
                    <input
                      type="text"
                      placeholder="ART-011"
                      value={newProductSku}
                      onChange={(e) => setNewProductSku(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 font-mono outline-none focus:border-zinc-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                      Tag Especial
                    </label>
                    <input
                      type="text"
                      placeholder="Lançamento"
                      value={newProductTag}
                      onChange={(e) => setNewProductTag(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 outline-none focus:border-zinc-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                    Descrição Editorial
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Couro nobre, costura manual, acabamento fino..."
                    value={newProductDescription}
                    onChange={(e) => setNewProductDescription(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 outline-none focus:border-zinc-500 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                    Caminho ou URL da Imagem
                  </label>
                  <input
                    type="text"
                    placeholder="/aurea/images/det-atelier.jpg"
                    value={newProductImage}
                    onChange={(e) => setNewProductImage(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 outline-none font-mono text-[11px] focus:border-zinc-500"
                  />
                </div>

                <div className="pt-3 flex items-center gap-2">
                  <button
                    type="submit"
                    className="flex-1 py-2.5 px-4 rounded-xl font-semibold text-xs bg-zinc-100 hover:bg-white text-zinc-950 transition-colors cursor-pointer"
                  >
                    Salvar no Acervo
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="py-2.5 px-4 rounded-xl text-xs text-zinc-400 hover:text-white border border-zinc-700 cursor-pointer"
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
