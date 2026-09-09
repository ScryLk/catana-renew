import React, { useState } from 'react';
import {
  Sparkles,
  Check,
  X,
  Edit3,
  DollarSign,
  ChevronDown,
  ArrowLeftRight,
} from 'lucide-react';
import { useStudioStore } from '../../store/studioStore';
import { CatalogPageData } from '../../data/aureaCatalog.mock';
import { MiniPageThumbnail } from './MiniPageThumbnail';
import { toast } from 'sonner';

export const SpreadViewport: React.FC = () => {
  const {
    zoomLevel,
    viewMode,
    currentSpread,
    pages,
    selectedElementId,
    setSelectedElementId,
    addMessage,
    setAgentStatus,
    theme,
    updateProduct,
    setSpreadPage,
    swapSpreadPages,
    activePalette,
  } = useStudioStore();

  const isDark = theme === 'dark';

  // Inline Prompt & Quick Edit state
  const [customPrompt, setCustomPrompt] = useState('');
  const [editingPrice, setEditingPrice] = useState('');
  const [editingName, setEditingName] = useState('');

  // Encontra as duas páginas do spread atual
  const leftPage = pages.find((p) => p.pageNumber === currentSpread[0]);
  const rightPage = pages.find((p) => p.pageNumber === currentSpread[1]);

  // Handler para selecionar elemento
  const handleSelect = (elementId: string, e: React.MouseEvent, defaultName?: string, defaultPrice?: string) => {
    e.stopPropagation();
    if (selectedElementId === elementId) {
      setSelectedElementId(null);
    } else {
      setSelectedElementId(elementId);
      setEditingName(defaultName || '');
      setEditingPrice(defaultPrice || '');
      setCustomPrompt('');
    }
  };

  // Aplica prompt customizado ou chip rápido no elemento
  const handleApplyAction = (actionPrompt: string, targetProductId?: string) => {
    if (!actionPrompt.trim()) return;

    setAgentStatus('generating');
    setSelectedElementId(null);
    toast.info(`Aplicando ajuste: "${actionPrompt}"...`);

    setTimeout(() => {
      setAgentStatus('idle');

      // Se for alteração direta de preço
      if (editingPrice && targetProductId) {
        updateProduct(targetProductId, { price: editingPrice });
        addMessage({
          role: 'assistant',
          content: `Preço atualizado para **${editingPrice}** no produto selecionado.`,
          reasoning: 'Alinhamento com a métrica tabular e contraste em conformidade com as diretrizes de luxo.',
        });
        toast.success('Preço atualizado com sucesso!');
        return;
      }

      // Se for alteração direta de nome
      if (editingName && targetProductId) {
        updateProduct(targetProductId, { name: editingName });
        addMessage({
          role: 'assistant',
          content: `Nome do produto atualizado para **"${editingName}"**.`,
          reasoning: 'Tipografia Cormorant Garamond re-renderizada com espaçamento entre letras balanceado.',
        });
        toast.success('Nome atualizado com sucesso!');
        return;
      }

      // Se for ação rápida predefinida
      const lower = actionPrompt.toLowerCase();
      if (lower.includes('+10%') && targetProductId) {
        const prod = pages.flatMap((p) => p.products || []).find((p) => p.id === targetProductId);
        if (prod) {
          const num = parseInt(prod.price.replace(/[^0-9]/g, ''), 10) || 1000;
          const newPrice = `R$ ${(num * 1.1).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
          updateProduct(targetProductId, { price: newPrice });
          addMessage({
            role: 'assistant',
            content: `Reajuste de 10% aplicado a **${prod.name}**: novo valor **${newPrice}**.`,
            reasoning: 'Proporção de precificação da maison recalibrada mantendo alinhamento à margem direita.',
          });
          toast.success(`Preço atualizado: ${newPrice}`);
          return;
        }
      }

      if (lower.includes('exclusivo') && targetProductId) {
        updateProduct(targetProductId, { tag: 'Edição Exclusiva' });
        addMessage({
          role: 'assistant',
          content: 'Selo editorial **"Edição Exclusiva"** adicionado ao produto.',
          reasoning: 'Badge em versalete com fundo off-black e contraste 12:1 sobre a fotografia.',
        });
        toast.success('Selo exclusivo adicionado!');
        return;
      }

      if (lower.includes('respiro') || lower.includes('espaçamento')) {
        addMessage({
          role: 'assistant',
          content: 'Margens e respiro ampliado em 12px ao redor do bloco editorial.',
          reasoning: 'Aumento do espaço negativo para enfatizar a aura de maison de alta costura.',
        });
        toast.success('Respiro editorial ampliado!');
        return;
      }

      // Default feedback
      addMessage({
        role: 'assistant',
        content: `Ajuste concluído: "${actionPrompt}". A página foi sincronizada no layout A4.`,
        reasoning: 'Direção de arte editorial e tipografia mantidas na grade de 8px.',
      });
      toast.success('Elemento atualizado com sucesso!');
    }, 900);
  };

  const [openDropdown, setOpenDropdown] = useState<'left' | 'right' | null>(null);

  const getPageTitleOrLabel = (page: CatalogPageData): string => {
    if (page.type === 'cover') return 'Capa · Coleção Inverno 2026';
    if (page.type === 'manifesto') return 'Manifesto do Atelier';
    if (page.type === 'divider') return `Divisória · ${page.title || page.label}`;
    if (page.type === 'hero') return `Destaque · ${page.products?.[0]?.name || page.label}`;
    if (page.type === 'duo') return `Duo · ${page.products?.map((p) => p.name).join(' & ')}`;
    if (page.type === 'single') return `Single · ${page.products?.[0]?.name || page.label}`;
    if (page.type === 'backcover') return 'Contracapa · Atelier';
    return `Página ${page.pageNumber}`;
  };

  const renderPagePickerDropdown = (slot: 'left' | 'right') => {
    const activePageNumber = slot === 'left' ? currentSpread[0] : currentSpread[1];

    return (
      <div
        onClick={(e) => e.stopPropagation()}
        className={`absolute right-0 top-full mt-1.5 w-72 max-h-80 overflow-y-auto custom-scrollbar rounded-xl border shadow-2xl p-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150 transition-colors ${
          isDark
            ? 'bg-[#141418] border-zinc-700 text-zinc-100 shadow-[0_16px_40px_rgba(0,0,0,0.85)]'
            : 'bg-white border-zinc-200 text-zinc-900 shadow-[0_12px_36px_rgba(0,0,0,0.18)]'
        }`}
      >
        <div className="px-2.5 py-1.5 border-b border-zinc-700/40 mb-1 flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
            Exibir no lado {slot === 'left' ? 'esquerdo' : 'direito'}
          </span>
          <button
            type="button"
            onClick={() => setOpenDropdown(null)}
            className="text-zinc-400 hover:text-zinc-200 p-0.5 rounded cursor-pointer"
            aria-label="Fechar lista de páginas"
          >
            <X className="size-3" />
          </button>
        </div>

        <div className="flex flex-col gap-0.5">
          {pages.map((p) => {
            const isSelected = p.pageNumber === activePageNumber;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setSpreadPage(slot, p.pageNumber);
                  setOpenDropdown(null);
                  toast.success(
                    `Página ${String(p.pageNumber).padStart(2, '0')} carregada no lado ${
                      slot === 'left' ? 'esquerdo' : 'direito'
                    }.`
                  );
                }}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors text-left cursor-pointer ${
                  isSelected
                    ? isDark
                      ? 'bg-zinc-800 text-white font-semibold'
                      : 'bg-zinc-200 text-zinc-950 font-semibold'
                    : isDark
                    ? 'hover:bg-zinc-800/60 text-zinc-300 hover:text-white'
                    : 'hover:bg-zinc-100 text-zinc-700 hover:text-zinc-950'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-6 h-8 shrink-0 shadow-xs">
                    <MiniPageThumbnail page={p} className="w-full h-full p-0.5" showBadge={false} />
                  </div>
                  <div className="min-w-0 flex flex-col">
                    <span className="font-mono text-[9px] text-zinc-400">
                      Pág. {String(p.pageNumber).padStart(2, '0')}
                    </span>
                    <span className="truncate text-xs font-medium">{getPageTitleOrLabel(p)}</span>
                  </div>
                </div>
                {isSelected && <Check className="size-3.5 text-zinc-200 shrink-0 ml-1" />}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const scale = zoomLevel / 100;

  // ================= RENDERIZADORES DE PÁGINA =================

  const renderPageContent = (page: CatalogPageData) => {
    const accent = page.accentColor || activePalette.accent;

    switch (page.type) {
      // ---------------- PÁGINA 01: CAPA ----------------
      case 'cover':
        return (
          <div className="h-full flex flex-col justify-between items-center text-center py-12 px-8 select-none relative">
            {/* Top Empty Space for Editorial Balance */}
            <div className="h-6" />

            {/* Central Identity Monogram + Wordmark */}
            <div
              className={`flex flex-col items-center gap-6 p-4 rounded-xl transition-all cursor-pointer ${
                selectedElementId === `page-${page.pageNumber}-brand`
                  ? 'ring-2 ring-amber-600/80 bg-white/5'
                  : 'hover:bg-white/5'
              }`}
              onClick={(e) => handleSelect(`page-${page.pageNumber}-brand`, e, 'Identidade da Capa')}
            >
              {/* Monogram PNG */}
              <div
                className="w-24 h-24 rounded-full border flex items-center justify-center p-2 bg-[#1A1817] shadow-lg overflow-hidden"
                style={{ borderColor: `${accent}66` }}
              >
                <img
                  src="/aurea/aurea-monograma.png"
                  alt="Monograma Áurea"
                  className="w-full h-full object-contain"
                />
              </div>

              {/* Wordmark */}
              <div className="flex flex-col items-center">
                <h1
                  className="text-4xl tracking-[0.35em] text-[#F5F1EA] font-normal uppercase"
                  style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
                >
                  {page.title || 'Á U R E A'}
                </h1>
                <div className="w-8 h-[1px] my-3" style={{ backgroundColor: accent }} />
                <span className="text-[10px] tracking-[0.3em] uppercase font-medium" style={{ color: accent }}>
                  {page.label || 'COLEÇÃO INVERNO 2026'}
                </span>
              </div>
            </div>

            {/* Bottom Subtitle / Origin */}
            <div
              className={`p-2 rounded transition-all cursor-pointer ${
                selectedElementId === `page-${page.pageNumber}-sub`
                  ? 'ring-2 ring-amber-600/80 bg-white/5'
                  : 'hover:bg-white/5'
              }`}
              onClick={(e) => handleSelect(`page-${page.pageNumber}-sub`, e, 'Assinatura')}
            >
              <p className="text-[9px] tracking-[0.3em] text-[#F5F1EA]/80 uppercase font-light">
                {page.subtitle || 'MODA & ACESSÓRIOS · SÃO PAULO'}
              </p>
            </div>
          </div>
        );

      // ---------------- PÁGINA 02: MANIFESTO ----------------
      case 'manifesto':
        return (
          <div className="h-full flex flex-col justify-between py-12 px-10 select-none">
            <div className="mt-8">
              {/* Section Tag */}
              <div
                className={`inline-block p-1 rounded transition-all cursor-pointer ${
                  selectedElementId === `page-${page.pageNumber}-label`
                    ? 'ring-2 ring-amber-600/80 bg-black/5'
                    : 'hover:bg-black/5'
                }`}
                onClick={(e) => handleSelect(`page-${page.pageNumber}-label`, e, 'Rótulo Manifesto')}
              >
                <span className="text-[10px] tracking-[0.35em] font-semibold uppercase" style={{ color: accent }}>
                  {page.label || 'MANIFESTO'}
                </span>
                <div className="w-10 h-[1px] mt-2 mb-8" style={{ backgroundColor: accent }} />
              </div>

              {/* Big Serif Quote */}
              <div
                className={`p-2 rounded-lg transition-all cursor-pointer mb-8 ${
                  selectedElementId === `page-${page.pageNumber}-quote`
                    ? 'ring-2 ring-amber-600/80 bg-black/5'
                    : 'hover:bg-black/5'
                }`}
                onClick={(e) => handleSelect(`page-${page.pageNumber}-quote`, e, 'Citação Principal')}
              >
                <h2
                  className="text-3xl sm:text-[34px] leading-[1.25] text-[#1A1817] font-normal whitespace-pre-line"
                  style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
                >
                  {page.quote || 'O essencial,\nexecutado sem pressa.'}
                </h2>
              </div>

              {/* Body Copy */}
              <div
                className={`p-2 rounded-lg transition-all cursor-pointer max-w-[340px] ${
                  selectedElementId === `page-${page.pageNumber}-body`
                    ? 'ring-2 ring-amber-600/80 bg-black/5'
                    : 'hover:bg-black/5'
                }`}
                onClick={(e) => handleSelect(`page-${page.pageNumber}-body`, e, 'Texto do Manifesto')}
              >
                <p className="text-xs text-stone-600 leading-[1.8] font-light text-pretty">
                  {page.content}
                </p>
              </div>
            </div>

            {/* Folio Footer */}
            <div className="flex flex-col items-center">
              <div className="w-6 h-[1px] mb-2" style={{ backgroundColor: accent }} />
              <span className="text-[9px] tracking-[0.3em] text-[#1A1817]/70 font-mono">
                {page.folio || 'ÁUREA · 02'}
              </span>
            </div>
          </div>
        );

      // ---------------- PÁGINA 03 & 06: DIVISÓRIAS ----------------
      case 'divider':
        return (
          <div className="h-full relative overflow-hidden flex flex-col justify-center items-center text-center p-8 select-none">
            {/* Background Editorial Photo */}
            {page.editorialImage && (
              <img
                src={page.editorialImage}
                alt={page.title || 'Divisória de Categoria'}
                className="absolute inset-0 w-full h-full object-cover object-center"
              />
            )}
            {/* Dark Editorial Contrast Veil (62% Off-Black) */}
            <div className="absolute inset-0 bg-[#1A1817]/65 backdrop-blur-[0.5px]" />

            {/* Center Content Block */}
            <div
              className={`relative z-10 p-6 rounded-2xl transition-all cursor-pointer ${
                selectedElementId === `page-${page.pageNumber}-div`
                  ? 'ring-2 ring-amber-500 bg-black/30'
                  : 'hover:bg-black/20'
              }`}
              onClick={(e) => handleSelect(`page-${page.pageNumber}-div`, e, page.title || 'Divisória')}
            >
              <span className="text-[10px] tracking-[0.4em] uppercase font-semibold block mb-3" style={{ color: accent }}>
                {page.label}
              </span>
              <h2
                className="text-4xl tracking-[0.15em] text-[#F5F1EA] font-normal uppercase mb-4"
                style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
              >
                {page.title}
              </h2>
              <div className="w-14 h-[1px] mx-auto mb-4" style={{ backgroundColor: accent }} />
              {page.subtitle && (
                <p className="text-[10px] tracking-[0.2em] text-[#F5F1EA]/80 font-light max-w-[260px] mx-auto">
                  {page.subtitle}
                </p>
              )}
            </div>
          </div>
        );

      // ---------------- PÁGINA 04 & 07: HERO PRODUCT ----------------
      case 'hero': {
        const prod = page.products?.[0];
        if (!prod) return null;
        const isSelected = selectedElementId === prod.id;

        return (
          <div className="h-full flex flex-col justify-between py-9 px-9 select-none">
            {/* Product Photo */}
            <div
              className={`w-full h-[360px] bg-stone-100 overflow-hidden relative rounded-sm transition-all cursor-pointer group ${
                isSelected ? 'ring-2 ring-amber-600' : 'hover:opacity-95'
              }`}
              onClick={(e) => handleSelect(prod.id, e, prod.name, prod.price)}
            >
              <img
                src={prod.image}
                alt={prod.name}
                className="w-full h-full object-cover object-center group-hover:scale-[1.02] transition-transform duration-500"
              />
              {prod.tag && (
                <div className="absolute top-3 left-3 bg-[#1A1817] text-[#F5F1EA] text-[9px] font-mono tracking-wider px-2.5 py-0.5 uppercase">
                  {prod.tag}
                </div>
              )}
            </div>

            {/* Product Details Block */}
            <div
              className={`p-3 rounded-lg transition-all cursor-pointer ${
                isSelected ? 'ring-2 ring-amber-600/80 bg-black/5' : 'hover:bg-black/5'
              }`}
              onClick={(e) => handleSelect(prod.id, e, prod.name, prod.price)}
            >
              {/* Category & Index Label */}
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[9px] tracking-[0.3em] font-semibold uppercase" style={{ color: accent }}>
                  {prod.category} · {prod.index}
                </span>
                <span className="text-[9px] font-mono text-stone-400">{prod.sku}</span>
              </div>
              <div className="w-10 h-[1px] mb-2.5" style={{ backgroundColor: accent }} />

              {/* Title & Price in Same Baseline Row */}
              <div className="flex items-baseline justify-between gap-4 mb-2">
                <h3
                  className="text-2xl text-[#1A1817] font-medium"
                  style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
                >
                  {prod.name}
                </h3>
                <span className="text-sm font-sans tracking-wider text-[#1A1817] font-semibold tabular-nums">
                  {prod.price}
                </span>
              </div>

              {/* Description */}
              <p className="text-[11px] text-stone-600 leading-[1.65] font-light line-clamp-2">
                {prod.description}
              </p>
            </div>

            {/* Folio Footer */}
            <div className="flex flex-col items-center">
              <div className="w-6 h-[1px] mb-2" style={{ backgroundColor: accent }} />
              <span className="text-[9px] tracking-[0.3em] text-[#1A1817]/70 font-mono">
                {page.folio}
              </span>
            </div>
          </div>
        );
      }

      // ---------------- PÁGINA 05 & 08: DUO PRODUCTS ----------------
      case 'duo': {
        const [prodA, prodB] = page.products || [];
        if (!prodA || !prodB) return null;
        const isMirrored = page.mirrored;

        return (
          <div className="h-full flex flex-col justify-between py-9 px-8 select-none">
            {/* 2-Column Asymmetric Grid */}
            <div className="grid grid-cols-2 gap-5 items-start">
              {/* Column 1 (Starts top if not mirrored, offset down if mirrored) */}
              <div
                className={`flex flex-col gap-2.5 transition-transform ${
                  isMirrored ? 'translate-y-10' : ''
                }`}
              >
                <div
                  className={`w-full h-44 bg-stone-100 overflow-hidden rounded-sm transition-all cursor-pointer group ${
                    selectedElementId === prodA.id ? 'ring-2 ring-amber-600' : 'hover:opacity-95'
                  }`}
                  onClick={(e) => handleSelect(prodA.id, e, prodA.name, prodA.price)}
                >
                  <img
                    src={prodA.image}
                    alt={prodA.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <div
                  className={`p-1.5 rounded transition-all cursor-pointer ${
                    selectedElementId === prodA.id ? 'ring-2 ring-amber-600/80 bg-black/5' : 'hover:bg-black/5'
                  }`}
                  onClick={(e) => handleSelect(prodA.id, e, prodA.name, prodA.price)}
                >
                  <span className="text-[8px] tracking-[0.25em] uppercase font-semibold block mb-1" style={{ color: accent }}>
                    {prodA.category} · {prodA.index}
                  </span>
                  <div className="w-8 h-[1px] mb-1.5" style={{ backgroundColor: accent }} />
                  <div className="flex items-baseline justify-between mb-1">
                    <h4
                      className="text-base text-[#1A1817] font-medium"
                      style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
                    >
                      {prodA.name}
                    </h4>
                  </div>
                  <div className="text-xs font-semibold text-[#1A1817] tabular-nums mb-1">
                    {prodA.price}
                  </div>
                  <p className="text-[10px] text-stone-600 leading-snug line-clamp-2">
                    {prodA.description}
                  </p>
                </div>
              </div>

              {/* Column 2 (Offset down if not mirrored, starts top if mirrored) */}
              <div
                className={`flex flex-col gap-2.5 transition-transform ${
                  !isMirrored ? 'translate-y-12' : ''
                }`}
              >
                <div
                  className={`w-full h-44 bg-stone-100 overflow-hidden rounded-sm transition-all cursor-pointer group ${
                    selectedElementId === prodB.id ? 'ring-2 ring-amber-600' : 'hover:opacity-95'
                  }`}
                  onClick={(e) => handleSelect(prodB.id, e, prodB.name, prodB.price)}
                >
                  <img
                    src={prodB.image}
                    alt={prodB.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <div
                  className={`p-1.5 rounded transition-all cursor-pointer ${
                    selectedElementId === prodB.id ? 'ring-2 ring-amber-600/80 bg-black/5' : 'hover:bg-black/5'
                  }`}
                  onClick={(e) => handleSelect(prodB.id, e, prodB.name, prodB.price)}
                >
                  <span className="text-[8px] tracking-[0.25em] uppercase font-semibold block mb-1" style={{ color: accent }}>
                    {prodB.category} · {prodB.index}
                  </span>
                  <div className="flex items-baseline justify-between mb-1">
                    <h4
                      className="text-base text-[#1A1817] font-medium"
                      style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
                    >
                      {prodB.name}
                    </h4>
                  </div>
                  <div className="text-xs font-semibold text-[#1A1817] tabular-nums mb-1">
                    {prodB.price}
                  </div>
                  <p className="text-[10px] text-stone-600 leading-snug line-clamp-2">
                    {prodB.description}
                  </p>
                </div>
              </div>
            </div>

            {/* Folio Footer */}
            <div className="flex flex-col items-center mt-4">
              <div className="w-6 h-[1px] mb-2" style={{ backgroundColor: accent }} />
              <span className="text-[9px] tracking-[0.3em] text-[#1A1817]/70 font-mono">
                {page.folio}
              </span>
            </div>
          </div>
        );
      }

      // ---------------- PÁGINA 09: SINGLE FECHAMENTO ----------------
      case 'single': {
        const prod = page.products?.[0];
        if (!prod) return null;
        const isSelected = selectedElementId === prod.id;

        return (
          <div className="h-full flex flex-col justify-between py-10 px-10 select-none">
            <div className="flex flex-col items-center text-center mt-4">
              <div
                className={`w-64 h-72 bg-stone-100 overflow-hidden rounded-sm transition-all cursor-pointer group mb-6 ${
                  isSelected ? 'ring-2 ring-amber-600' : 'hover:opacity-95'
                }`}
                onClick={(e) => handleSelect(prod.id, e, prod.name, prod.price)}
              >
                <img
                  src={prod.image}
                  alt={prod.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>

              <div
                className={`p-3 rounded-lg transition-all cursor-pointer max-w-[320px] ${
                  isSelected ? 'ring-2 ring-amber-600/80 bg-black/5' : 'hover:bg-black/5'
                }`}
                onClick={(e) => handleSelect(prod.id, e, prod.name, prod.price)}
              >
                <span className="text-[9px] tracking-[0.3em] font-semibold uppercase block mb-1" style={{ color: accent }}>
                  {prod.category} · {prod.index}
                </span>
                <div className="w-8 h-[1px] mx-auto mb-2" style={{ backgroundColor: accent }} />
                <h3
                  className="text-2xl text-[#1A1817] font-medium mb-1"
                  style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
                >
                  {prod.name}
                </h3>
                <div className="text-sm font-semibold text-[#1A1817] tabular-nums mb-2">
                  {prod.price}
                </div>
                <p className="text-[11px] text-stone-600 leading-relaxed font-light">
                  {prod.description}
                </p>
              </div>
            </div>

            {/* Folio Footer */}
            <div className="flex flex-col items-center">
              <div className="w-6 h-[1px] mb-2" style={{ backgroundColor: accent }} />
              <span className="text-[9px] tracking-[0.3em] text-[#1A1817]/70 font-mono">
                {page.folio}
              </span>
            </div>
          </div>
        );
      }

      // ---------------- PÁGINA 10: CONTRACAPA / ATELIER ----------------
      case 'backcover':
        return (
          <div className="h-full flex flex-col justify-between items-center text-center py-14 px-8 select-none">
            <div className="h-6" />

            {/* Centered Monogram & Invitation */}
            <div
              className={`flex flex-col items-center gap-6 p-6 rounded-2xl transition-all cursor-pointer ${
                selectedElementId === `page-${page.pageNumber}-back`
                  ? 'ring-2 ring-amber-500 bg-white/5'
                  : 'hover:bg-white/5'
              }`}
              onClick={(e) => handleSelect(`page-${page.pageNumber}-back`, e, 'Contracapa & Atelier')}
            >
              <div
                className="w-20 h-20 rounded-full border flex items-center justify-center p-2 bg-[#1A1817] shadow-lg"
                style={{ borderColor: `${accent}66` }}
              >
                <span
                  className="text-3xl font-serif text-[#F5F1EA]"
                  style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
                >
                  Á
                </span>
              </div>

              <div className="flex flex-col items-center gap-3">
                <span className="text-[10px] tracking-[0.35em] uppercase font-semibold" style={{ color: accent }}>
                  {page.label}
                </span>
                <div className="w-10 h-[1px]" style={{ backgroundColor: accent }} />
                <p className="text-xs tracking-[0.2em] text-[#F5F1EA] font-light leading-relaxed whitespace-pre-line max-w-[280px]">
                  {page.content}
                </p>
              </div>
            </div>

            {/* Bottom Credit */}
            <div className="text-[9px] font-mono tracking-[0.3em] uppercase" style={{ color: `${accent}CC` }}>
              {page.folio || 'KATANA STUDIO · 2026'}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // Encontra o produto ou elemento selecionado para o modal de edição
  const selectedProduct = pages
    .flatMap((p) => p.products || [])
    .find((p) => p.id === selectedElementId);

  return (
    <div
      onClick={() => {
        setSelectedElementId(null);
        setOpenDropdown(null);
      }}
      className={`flex-1 overflow-auto custom-scrollbar p-8 flex items-center justify-center relative select-none transition-colors ${
        isDark ? 'bg-[#0a0a0c]' : 'bg-[#e5e7eb]'
      }`}
      style={{
        backgroundImage: `radial-gradient(${isDark ? '#1f1f26' : '#cbd5e1'} 1px, transparent 1px)`,
        backgroundSize: '24px 24px',
      }}
    >
      {/* Spread Container (proporção A4 com escala de zoom) */}
      <div
        className="transition-transform duration-150 origin-center flex items-start justify-center gap-6"
        style={{ transform: `scale(${scale})` }}
      >
        {/* ================= LEFT PAGE WRAPPER ================= */}
        {leftPage && (
          <div className={`flex flex-col items-center ${viewMode === 'single' ? 'hidden' : ''}`}>
            {/* Top Bar for Left Page */}
            <div className="w-[490px] flex items-center justify-between px-1.5 pb-2.5 text-xs select-none">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`text-[10px] font-mono font-bold tracking-wider uppercase px-2 py-0.5 rounded border shrink-0 ${
                    isDark
                      ? 'bg-zinc-900 border-zinc-800 text-zinc-300'
                      : 'bg-white border-zinc-200 text-zinc-700 shadow-xs'
                  }`}
                >
                  PÁGINA {String(leftPage.pageNumber).padStart(2, '0')}
                </span>
                <span
                  className={`text-[11px] font-medium truncate max-w-[200px] ${
                    isDark ? 'text-zinc-400' : 'text-zinc-600'
                  }`}
                >
                  {getPageTitleOrLabel(leftPage)}
                </span>
              </div>

              {/* Page Switcher Trigger */}
              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenDropdown(openDropdown === 'left' ? null : 'left');
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer shadow-xs ${
                    openDropdown === 'left'
                      ? isDark
                        ? 'bg-zinc-200 text-zinc-950 border-white font-bold'
                        : 'bg-zinc-900 text-white border-zinc-900 font-bold'
                      : isDark
                      ? 'bg-[#141418] hover:bg-[#1f1f26] text-zinc-200 border-zinc-700 hover:border-zinc-500'
                      : 'bg-white hover:bg-zinc-50 text-zinc-800 border-zinc-300 hover:border-zinc-400'
                  }`}
                  title="Trocar página exibida no lado esquerdo"
                  aria-label="Trocar página esquerda"
                >
                  <ArrowLeftRight className="size-3 text-zinc-400" />
                  <span>Trocar Página</span>
                  <ChevronDown className="size-3 text-zinc-400" />
                </button>

                {/* Dropdown Menu */}
                {openDropdown === 'left' && renderPagePickerDropdown('left')}
              </div>
            </div>

            {/* Left Page Frame */}
            <div
              className={`w-[490px] h-[693px] rounded-sm relative transition-all border overflow-hidden ${
                isDark
                  ? 'shadow-[0_16px_50px_rgba(0,0,0,0.65)] border-zinc-700/60'
                  : 'shadow-[0_12px_36px_rgba(0,0,0,0.12)] border-stone-300/80'
              }`}
              style={{
                backgroundColor: leftPage.backgroundColor,
                color: leftPage.textColor,
              }}
            >
              {renderPageContent(leftPage)}
            </div>
          </div>
        )}

        {/* Center Swap Pages Quick Button (Between Left and Right) */}
        {viewMode !== 'single' && (
          <div className="flex flex-col items-center justify-center pt-44 self-start">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                swapSpreadPages();
                toast.success('Páginas invertidas: esquerda ⇄ direita!');
              }}
              className={`p-2.5 rounded-full border transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95 ${
                isDark
                  ? 'bg-[#141418] border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800'
                  : 'bg-white border-zinc-300 text-zinc-700 hover:text-zinc-950 hover:bg-zinc-100'
              }`}
              title="Inverter páginas (Esquerda ⇄ Direita)"
              aria-label="Inverter lados das páginas"
            >
              <ArrowLeftRight className="size-4 text-zinc-400" />
            </button>
          </div>
        )}

        {/* ================= RIGHT PAGE WRAPPER ================= */}
        {rightPage && (
          <div className="flex flex-col items-center">
            {/* Top Bar for Right Page */}
            <div className="w-[490px] flex items-center justify-between px-1.5 pb-2.5 text-xs select-none">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`text-[10px] font-mono font-bold tracking-wider uppercase px-2 py-0.5 rounded border shrink-0 ${
                    isDark
                      ? 'bg-zinc-900 border-zinc-800 text-zinc-300'
                      : 'bg-white border-zinc-200 text-zinc-700 shadow-xs'
                  }`}
                >
                  PÁGINA {String(rightPage.pageNumber).padStart(2, '0')}
                </span>
                <span
                  className={`text-[11px] font-medium truncate max-w-[200px] ${
                    isDark ? 'text-zinc-400' : 'text-zinc-600'
                  }`}
                >
                  {getPageTitleOrLabel(rightPage)}
                </span>
              </div>

              {/* Page Switcher Trigger */}
              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenDropdown(openDropdown === 'right' ? null : 'right');
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer shadow-xs ${
                    openDropdown === 'right'
                      ? isDark
                        ? 'bg-zinc-200 text-zinc-950 border-white font-bold'
                        : 'bg-zinc-900 text-white border-zinc-900 font-bold'
                      : isDark
                      ? 'bg-[#141418] hover:bg-[#1f1f26] text-zinc-200 border-zinc-700 hover:border-zinc-500'
                      : 'bg-white hover:bg-zinc-50 text-zinc-800 border-zinc-300 hover:border-zinc-400'
                  }`}
                  title="Trocar página exibida no lado direito"
                  aria-label="Trocar página direita"
                >
                  <ArrowLeftRight className="size-3 text-zinc-400" />
                  <span>Trocar Página</span>
                  <ChevronDown className="size-3 text-zinc-400" />
                </button>

                {/* Dropdown Menu */}
                {openDropdown === 'right' && renderPagePickerDropdown('right')}
              </div>

            </div>

            {/* Right Page Frame */}
            <div
              className={`w-[490px] h-[693px] rounded-sm relative transition-all border overflow-hidden ${
                isDark
                  ? 'shadow-[0_16px_50px_rgba(0,0,0,0.65)] border-zinc-700/60'
                  : 'shadow-[0_12px_36px_rgba(0,0,0,0.12)] border-stone-300/80'
              }`}
              style={{
                backgroundColor: rightPage.backgroundColor,
                color: rightPage.textColor,
              }}
            >
              {renderPageContent(rightPage)}
            </div>
          </div>
        )}
      </div>

      {/* ================= FLOATING EDITORIAL CLICK-TO-PROMPT POPOVER ================= */}
      {selectedElementId && (
        <div
          onClick={(e) => e.stopPropagation()}
          className={`fixed bottom-16 right-8 w-96 rounded-2xl border shadow-2xl p-4 z-40 animate-in fade-in slide-in-from-bottom-3 duration-200 transition-colors ${
            isDark
              ? 'bg-[#121216] border-zinc-700 text-zinc-100 shadow-[0_20px_50px_rgba(0,0,0,0.8)]'
              : 'bg-white border-zinc-200 text-zinc-900 shadow-[0_20px_40px_rgba(0,0,0,0.15)]'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2.5 border-b border-zinc-700/40">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-md bg-amber-500/10 text-amber-500">
                <Sparkles className="size-3.5" />
              </span>
              <div>
                <h4 className="text-xs font-semibold">Ajuste Editorial com IA</h4>
                <p className="text-[10px] text-zinc-400">
                  {selectedProduct ? `Produto: ${selectedProduct.name}` : 'Elemento de página'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedElementId(null)}
              className="p-1 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
              aria-label="Fechar painel de ajuste"
            >
              <X className="size-3.5" />
            </button>
          </div>

          {/* Direct Input Fields (Se for produto) */}
          {selectedProduct && (
            <div className="grid grid-cols-2 gap-2 mt-3 mb-2">
              <div>
                <label className="text-[10px] text-zinc-400 font-medium block mb-1">Preço</label>
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border bg-zinc-800/20 border-zinc-700/60 focus-within:border-amber-500">
                  <DollarSign className="size-3 text-amber-500" />
                  <input
                    type="text"
                    value={editingPrice}
                    onChange={(e) => setEditingPrice(e.target.value)}
                    className="w-full bg-transparent text-xs font-mono font-medium outline-none"
                    placeholder="R$ 4.900"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-zinc-400 font-medium block mb-1">Nome</label>
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border bg-zinc-800/20 border-zinc-700/60 focus-within:border-amber-500">
                  <Edit3 className="size-3 text-zinc-400" />
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    className="w-full bg-transparent text-xs font-medium outline-none"
                    placeholder="Nome da peça"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Quick Action Chips */}
          <div className="my-2.5">
            <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-400 block mb-1.5">
              Ações Rápidas
            </span>
            <div className="flex flex-wrap gap-1.5">
              {selectedProduct ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleApplyAction('Reajustar valor +10%', selectedProduct.id)}
                    className="px-2 py-1 rounded-md text-[10px] font-medium border bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20 transition-colors"
                  >
                    +10% Valor
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyAction('Adicionar selo de Edição Exclusiva', selectedProduct.id)}
                    className="px-2 py-1 rounded-md text-[10px] font-medium border bg-zinc-800/50 border-zinc-700 text-zinc-300 hover:bg-zinc-700 transition-colors"
                  >
                    Selo Exclusivo
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyAction('Reescrever descrição com tom poético de luxo', selectedProduct.id)}
                    className="px-2 py-1 rounded-md text-[10px] font-medium border bg-zinc-800/50 border-zinc-700 text-zinc-300 hover:bg-zinc-700 transition-colors"
                  >
                    Refinar Copy
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => handleApplyAction('Ampliar respiro editorial')}
                    className="px-2 py-1 rounded-md text-[10px] font-medium border bg-zinc-800/50 border-zinc-700 text-zinc-300 hover:bg-zinc-700 transition-colors"
                  >
                    Ampliar Respiro
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyAction('Ajustar contraste do título')}
                    className="px-2 py-1 rounded-md text-[10px] font-medium border bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20 transition-colors"
                  >
                    Realçar Título
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Custom Instruction Input */}
          <div className="flex items-center gap-1.5 pt-2 border-t border-zinc-700/40">
            <input
              type="text"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleApplyAction(customPrompt, selectedProduct?.id);
                }
              }}
              placeholder="Instrução para a IA (ex: 'destaque em ouro')..."
              className="flex-1 bg-zinc-800/40 border border-zinc-700/60 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-amber-500 placeholder:text-zinc-500"
            />
            <button
              type="button"
              onClick={() => handleApplyAction(customPrompt || 'Salvar alterações', selectedProduct?.id)}
              className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold flex items-center gap-1 shadow-sm transition-colors cursor-pointer"
            >
              <Check className="size-3" />
              <span>Salvar</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
