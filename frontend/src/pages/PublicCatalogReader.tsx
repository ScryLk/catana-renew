import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Copy,
  Check,
  MessageSquare,
  BookOpen,
  FileText,
  Sun,
  Moon,
  X,
  RotateCcw,
  Sparkles,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import { EditorialPageSnapshot } from '../components/studio/EditorialPageSnapshot';
import { CANONICAL_DEMO_TEMPLATES } from '../data/demoCatalogs.data';
import { CatalogPageData, ProductItem, StudioPalette } from '../data/editorialCatalog.mock';
import api from '../services/api';
import { toast } from 'sonner';

interface PublicSpreadData {
  spread_index: number;
  title?: string;
  left_page?: CatalogPageData | null;
  right_page?: CatalogPageData | null;
}

interface PublicCatalogResponse {
  id: string;
  title: string;
  brand_name: string;
  segment?: string;
  description?: string;
  style_preset?: string;
  primary_color?: string;
  secondary_color?: string;
  accent_color?: string;
  palette_data?: StudioPalette;
  total_pages: number;
  spreads: PublicSpreadData[];
  unassigned_products?: ProductItem[];
  is_demo?: boolean;
}

export const PublicCatalogReader: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Estados de dados
  const [catalog, setCatalog] = useState<PublicCatalogResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Estados de navegação e visualização
  const [viewMode, setViewMode] = useState<'spread' | 'single'>('spread');
  const [currentSpreadIndex, setCurrentSpreadIndex] = useState<number>(0);
  const [currentSinglePageIndex, setCurrentSinglePageIndex] = useState<number>(0);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [ambientTheme, setAmbientTheme] = useState<'dark' | 'light'>('dark');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // Modal de produto
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);

  // Auto-detectar largura de tela no mount para escolher spread vs single
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setViewMode('single');
      } else {
        setViewMode('spread');
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Busca do catálogo público
  useEffect(() => {
    let isMounted = true;
    const fetchCatalog = async () => {
      if (!id) return;
      setLoading(true);
      setError(null);

      const normalizedKey = id.toLowerCase().replace(/-/g, '_').replace(/^demo_/, '');

      try {
        const res = await api.get(`/api/v2/studio/public/catalogs/${id}/`);
        if (isMounted && res.data) {
          setCatalog(res.data);
          setLoading(false);
          return;
        }
      } catch (err: any) {
        // Fallback para os templates canônicos mockados em caso de falha de conexão
        const matchedDemo = CANONICAL_DEMO_TEMPLATES.find(
          (t) => t.key === normalizedKey || t.key.replace(/_/g, '-') === id.toLowerCase()
        );

        if (isMounted && matchedDemo) {
          const spreads: PublicSpreadData[] = [];
          for (let i = 0; i < matchedDemo.pages.length; i += 2) {
            spreads.push({
              spread_index: Math.floor(i / 2),
              title: `Lâmina ${Math.floor(i / 2) + 1}`,
              left_page: matchedDemo.pages[i] || null,
              right_page: matchedDemo.pages[i + 1] || null,
            });
          }

          setCatalog({
            id: matchedDemo.key,
            title: matchedDemo.title,
            brand_name: matchedDemo.brandName,
            segment: matchedDemo.segment,
            description: matchedDemo.description,
            style_preset: matchedDemo.stylePreset,
            primary_color: matchedDemo.primaryColor,
            accent_color: matchedDemo.accentColor,
            palette_data: matchedDemo.palette,
            total_pages: matchedDemo.totalPages,
            spreads,
            unassigned_products: matchedDemo.unassignedProducts,
            is_demo: true,
          });
          setLoading(false);
          return;
        }

        if (isMounted) {
          setError('Catálogo não encontrado ou temporariamente indisponível.');
          setLoading(false);
        }
      }
    };

    fetchCatalog();
    return () => {
      isMounted = false;
    };
  }, [id]);

  // Lista linear de todas as páginas válidas
  const allPages = useMemo(() => {
    if (!catalog?.spreads) return [];
    const pages: CatalogPageData[] = [];
    catalog.spreads.forEach((sp) => {
      if (sp.left_page) pages.push(sp.left_page);
      if (sp.right_page) pages.push(sp.right_page);
    });
    return pages;
  }, [catalog]);

  const totalSpreads = catalog?.spreads?.length || 0;
  const currentSpread = catalog?.spreads?.[currentSpreadIndex] || null;
  const currentSinglePage = allPages[currentSinglePageIndex] || null;

  // Navegação anterior
  const handlePrev = useCallback(() => {
    if (viewMode === 'spread') {
      setCurrentSpreadIndex((prev) => Math.max(0, prev - 1));
    } else {
      setCurrentSinglePageIndex((prev) => Math.max(0, prev - 1));
    }
  }, [viewMode]);

  // Navegação próxima
  const handleNext = useCallback(() => {
    if (viewMode === 'spread') {
      setCurrentSpreadIndex((prev) => Math.min(totalSpreads - 1, prev + 1));
    } else {
      setCurrentSinglePageIndex((prev) => Math.min(allPages.length - 1, prev + 1));
    }
  }, [viewMode, totalSpreads, allPages.length]);

  // Controles por teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedProduct) {
        if (e.key === 'Escape') setSelectedProduct(null);
        return;
      }

      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        setZoomLevel((z) => Math.min(1.6, Number((z + 0.1).toFixed(1))));
      } else if (e.key === '-') {
        e.preventDefault();
        setZoomLevel((z) => Math.max(0.6, Number((z - 0.1).toFixed(1))));
      } else if (e.key === '0') {
        e.preventDefault();
        setZoomLevel(1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePrev, handleNext, selectedProduct]);

  // Sincronizar fullscreen state
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Copiar link público
  const handleCopyLink = () => {
    if (typeof window !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      toast.success('Link do catálogo copiado para a área de transferência!');
      setTimeout(() => setCopiedLink(false), 2400);
    }
  };

  // Compartilhar no WhatsApp
  const handleShareWhatsApp = () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const text = `Acesse o catálogo editorial "${catalog?.title || 'Katana Studio'}": ${url}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  // Pedido de produto via WhatsApp
  const handleOrderProductViaWhatsApp = (prod: ProductItem) => {
    const text = `Olá! Tenho interesse no item "${prod.name}" (SKU: ${prod.sku}, Valor: ${prod.price}) visualizado no catálogo "${catalog?.title}". Poderia me passar mais detalhes e disponibilidade?`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  // Fallback de carregamento elegante
  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="size-12 rounded-2xl border border-zinc-800 bg-zinc-900/60 flex items-center justify-center animate-pulse">
            <BookOpen className="size-6 text-zinc-400" />
          </div>
          <div className="space-y-1">
            <h2 className="text-sm font-semibold tracking-wider uppercase text-zinc-300">
              Carregando Publicação Editorial
            </h2>
            <p className="text-xs text-zinc-500 font-mono">Preparando prancheta e resolução gráfica...</p>
          </div>
          <Loader2 className="size-5 text-zinc-400 animate-spin mt-2" />
        </div>
      </div>
    );
  }

  // Fallback de erro / não encontrado
  if (error || !catalog) {
    return (
      <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8 text-center space-y-5 shadow-2xl">
          <div className="size-12 mx-auto rounded-2xl border border-zinc-800 bg-zinc-900 flex items-center justify-center text-zinc-400">
            <BookOpen className="size-6" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-lg font-semibold tracking-tight">Publicação Não Encontrada</h1>
            <p className="text-xs text-zinc-400 leading-relaxed">
              O catálogo solicitado não existe ou o link de compartilhamento foi desativado pelo autor.
            </p>
          </div>
          <div className="pt-2 flex flex-col sm:flex-row gap-2.5 justify-center">
            <button
              type="button"
              onClick={() => navigate('/view/maison_verdana')}
              className="px-4 py-2.5 rounded-xl border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-xs font-medium transition-colors cursor-pointer"
            >
              Ver Demonstração Maison
            </button>
            <button
              type="button"
              onClick={() => navigate('/studio')}
              className="px-4 py-2.5 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold transition-colors cursor-pointer"
            >
              Criar no Katana Studio
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isDark = ambientTheme === 'dark';
  const accentColor = catalog.accent_color || '#B08D57';

  return (
    <div
      className={`min-h-screen flex flex-col select-none transition-colors duration-300 overflow-x-hidden ${
        isDark ? 'bg-[#09090b] text-zinc-100' : 'bg-[#EFECE6] text-zinc-900'
      }`}
    >
      {/* ================= BARRA SUPERIOR EDITORIAL ================= */}
      <header
        className={`h-14 px-4 sm:px-6 flex items-center justify-between border-b shrink-0 z-30 transition-colors ${
          isDark
            ? 'bg-[#0c0c0f]/90 border-zinc-800/80 backdrop-blur-md'
            : 'bg-white/90 border-stone-200 backdrop-blur-md shadow-xs'
        }`}
      >
        {/* Esquerda: Identificação do Catálogo & Marca */}
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to="/studio"
            className={`p-1.5 rounded-lg border transition-colors flex items-center justify-center shrink-0 ${
              isDark
                ? 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/60 text-zinc-400 hover:text-white'
                : 'border-stone-200 hover:border-stone-300 bg-stone-50 text-stone-600 hover:text-stone-900'
            }`}
            title="Ir para o Katana Studio"
            aria-label="Ir para o Katana Studio"
          >
            <ArrowLeft className="size-4" />
          </Link>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className="text-[10px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded border shrink-0"
                style={{
                  borderColor: `${accentColor}40`,
                  color: accentColor,
                  backgroundColor: `${accentColor}10`,
                }}
              >
                {catalog.brand_name || 'Katana'}
              </span>
              <h1 className="text-xs sm:text-sm font-semibold truncate tracking-tight">
                {catalog.title}
              </h1>
            </div>
          </div>
        </div>

        {/* Centro: Indicador de Lâmina / Página */}
        <div className="hidden md:flex items-center gap-2 text-xs font-mono">
          <span className={isDark ? 'text-zinc-400' : 'text-stone-500'}>
            {viewMode === 'spread'
              ? `Lâmina ${currentSpreadIndex + 1} de ${totalSpreads} · (Páginas ${String(
                  currentSpread?.left_page?.pageNumber || 1
                ).padStart(2, '0')} - ${String(
                  currentSpread?.right_page?.pageNumber || 2
                ).padStart(2, '0')})`
              : `Página ${currentSinglePageIndex + 1} de ${allPages.length}`}
          </span>
        </div>

        {/* Direita: Ações Rápidas & Modos de Leitura */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Alternador de Modo (Lâmina Dupla / Página Única) */}
          <div
            className={`hidden sm:flex items-center p-0.5 rounded-lg border text-xs ${
              isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-stone-100 border-stone-200'
            }`}
          >
            <button
              type="button"
              onClick={() => setViewMode('spread')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'spread'
                  ? isDark
                    ? 'bg-zinc-800 text-white shadow-xs'
                    : 'bg-white text-stone-900 shadow-xs'
                  : isDark
                  ? 'text-zinc-400 hover:text-zinc-200'
                  : 'text-stone-500 hover:text-stone-900'
              }`}
              title="Modo Revista Aberta (Spread Duplo)"
            >
              <BookOpen className="size-3" />
              <span>Lâmina</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('single')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'single'
                  ? isDark
                    ? 'bg-zinc-800 text-white shadow-xs'
                    : 'bg-white text-stone-900 shadow-xs'
                  : isDark
                  ? 'text-zinc-400 hover:text-zinc-200'
                  : 'text-stone-500 hover:text-stone-900'
              }`}
              title="Modo Página Individual"
            >
              <FileText className="size-3" />
              <span>Página</span>
            </button>
          </div>

          {/* Ambiência Dark / Light */}
          <button
            type="button"
            onClick={() => setAmbientTheme(isDark ? 'light' : 'dark')}
            className={`p-2 rounded-lg border transition-colors cursor-pointer ${
              isDark
                ? 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-zinc-300'
                : 'bg-stone-100 border-stone-200 hover:border-stone-300 text-stone-700'
            }`}
            title={isDark ? 'Mudar para Ambiência Clara (Papel)' : 'Mudar para Ambiência Escura (Cinema)'}
            aria-label="Alternar tema de ambiência"
          >
            {isDark ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
          </button>

          {/* Copiar Link */}
          <button
            type="button"
            onClick={handleCopyLink}
            className={`p-2 rounded-lg border transition-colors cursor-pointer flex items-center gap-1.5 text-xs ${
              isDark
                ? 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-zinc-300'
                : 'bg-stone-100 border-stone-200 hover:border-stone-300 text-stone-700'
            }`}
            title="Copiar Link de Visualização"
            aria-label="Copiar link"
          >
            {copiedLink ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
            <span className="hidden lg:inline">{copiedLink ? 'Copiado' : 'Copiar'}</span>
          </button>

          {/* WhatsApp */}
          <button
            type="button"
            onClick={handleShareWhatsApp}
            className="p-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-colors cursor-pointer"
            title="Compartilhar via WhatsApp"
            aria-label="Compartilhar via WhatsApp"
          >
            <MessageSquare className="size-3.5" />
          </button>

          {/* Fullscreen */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className={`hidden sm:flex p-2 rounded-lg border transition-colors cursor-pointer ${
              isDark
                ? 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-zinc-300'
                : 'bg-stone-100 border-stone-200 hover:border-stone-300 text-stone-700'
            }`}
            title="Tela Cheia (F)"
            aria-label="Alternar tela cheia"
          >
            {isFullscreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
          </button>

          {/* CTA Studio */}
          <button
            type="button"
            onClick={() => navigate('/studio')}
            className="px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 font-semibold text-xs transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
          >
            <Sparkles className="size-3 text-amber-600" />
            <span className="hidden sm:inline">Criar no Katana Studio</span>
            <span className="sm:hidden">Studio</span>
          </button>
        </div>
      </header>

      {/* ================= ÁREA DE LEITURA (DIGITAL FLIPBOOK CANVAS) ================= */}
      <main className="flex-1 flex flex-col items-center justify-center p-3 sm:p-8 relative overflow-hidden">
        {/* Botão Anterior Flutuante */}
        <button
          type="button"
          onClick={handlePrev}
          disabled={viewMode === 'spread' ? currentSpreadIndex === 0 : currentSinglePageIndex === 0}
          className={`absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 z-20 size-11 rounded-full border flex items-center justify-center transition-all cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed shadow-xl ${
            isDark
              ? 'bg-zinc-900/90 border-zinc-700 text-zinc-200 hover:bg-zinc-800 hover:border-zinc-500'
              : 'bg-white/95 border-stone-300 text-stone-800 hover:bg-stone-50 hover:border-stone-400'
          }`}
          title="Página Anterior (Seta Esquerda)"
          aria-label="Página anterior"
        >
          <ChevronLeft className="size-5" />
        </button>

        {/* Botão Próximo Flutuante */}
        <button
          type="button"
          onClick={handleNext}
          disabled={
            viewMode === 'spread'
              ? currentSpreadIndex >= totalSpreads - 1
              : currentSinglePageIndex >= allPages.length - 1
          }
          className={`absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 z-20 size-11 rounded-full border flex items-center justify-center transition-all cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed shadow-xl ${
            isDark
              ? 'bg-zinc-900/90 border-zinc-700 text-zinc-200 hover:bg-zinc-800 hover:border-zinc-500'
              : 'bg-white/95 border-stone-300 text-stone-800 hover:bg-stone-50 hover:border-stone-400'
          }`}
          title="Próxima Página (Seta Direita)"
          aria-label="Próxima página"
        >
          <ChevronRight className="size-5" />
        </button>

        {/* Contêiner de Escalonamento e Proporção A4 */}
        <div
          className="transition-transform duration-200 ease-out flex items-center justify-center origin-center"
          style={{ transform: `scale(${zoomLevel})` }}
        >
          {viewMode === 'spread' && currentSpread ? (
            /* ================= MODO SPREAD DUPLO (REVISTA ABERTA) ================= */
            <div
              className={`relative flex items-center rounded-sm overflow-hidden transition-shadow duration-300 ${
                isDark
                  ? 'shadow-[0_30px_90px_rgba(0,0,0,0.85)] border border-zinc-800/80'
                  : 'shadow-[0_25px_70px_rgba(0,0,0,0.18)] border border-stone-300'
              }`}
            >
              {/* Página Esquerda */}
              <div
                className="relative cursor-pointer"
                onClick={(e) => {
                  const targetProd = currentSpread.left_page?.products?.[0];
                  if (targetProd && (e.target as HTMLElement).closest('img, h3, h4')) {
                    setSelectedProduct(targetProd);
                  }
                }}
              >
                {currentSpread.left_page ? (
                  <EditorialPageSnapshot
                    page={currentSpread.left_page}
                    activePalette={catalog.palette_data}
                  />
                ) : (
                  <div className="w-[490px] h-[693px] bg-zinc-900 flex items-center justify-center text-zinc-600 text-xs font-mono">
                    Página em Branco
                  </div>
                )}
              </div>

              {/* Lombada Central (Book Spine Gradient) */}
              <div
                className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-8 pointer-events-none z-10"
                style={{
                  background:
                    'linear-gradient(to right, rgba(0,0,0,0.22) 0%, rgba(0,0,0,0.04) 50%, rgba(0,0,0,0.22) 100%)',
                }}
              />

              {/* Página Direita */}
              <div
                className="relative cursor-pointer"
                onClick={(e) => {
                  const targetProd = currentSpread.right_page?.products?.[0];
                  if (targetProd && (e.target as HTMLElement).closest('img, h3, h4')) {
                    setSelectedProduct(targetProd);
                  }
                }}
              >
                {currentSpread.right_page ? (
                  <EditorialPageSnapshot
                    page={currentSpread.right_page}
                    activePalette={catalog.palette_data}
                  />
                ) : (
                  <div className="w-[490px] h-[693px] bg-zinc-900 flex items-center justify-center text-zinc-600 text-xs font-mono">
                    Página em Branco
                  </div>
                )}
              </div>
            </div>
          ) : currentSinglePage ? (
            /* ================= MODO PÁGINA ÚNICA ================= */
            <div
              className={`relative rounded-sm overflow-hidden transition-shadow duration-300 cursor-pointer ${
                isDark
                  ? 'shadow-[0_25px_80px_rgba(0,0,0,0.8)] border border-zinc-800'
                  : 'shadow-[0_20px_60px_rgba(0,0,0,0.15)] border border-stone-300'
              }`}
              onClick={(e) => {
                const targetProd = currentSinglePage.products?.[0];
                if (targetProd && (e.target as HTMLElement).closest('img, h3, h4')) {
                  setSelectedProduct(targetProd);
                }
              }}
            >
              <EditorialPageSnapshot
                page={currentSinglePage}
                activePalette={catalog.palette_data}
              />
            </div>
          ) : null}
        </div>
      </main>

      {/* ================= BARRA INFERIOR DE NAVEGAÇÃO E ZOOM ================= */}
      <footer
        className={`h-16 px-4 sm:px-6 border-t flex items-center justify-between shrink-0 z-30 transition-colors ${
          isDark
            ? 'bg-[#0c0c0f]/95 border-zinc-800/80 backdrop-blur-md'
            : 'bg-white/95 border-stone-200 backdrop-blur-md shadow-xs'
        }`}
      >
        {/* Esquerda: Controles de Zoom */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.max(0.6, Number((z - 0.1).toFixed(1))))}
            disabled={zoomLevel <= 0.6}
            className={`p-2 rounded-lg border transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              isDark
                ? 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-zinc-300'
                : 'bg-stone-100 border-stone-200 hover:border-stone-300 text-stone-700'
            }`}
            title="Diminuir Zoom (-)"
            aria-label="Diminuir zoom"
          >
            <ZoomOut className="size-3.5" />
          </button>

          <span className="text-xs font-mono w-12 text-center select-none font-medium">
            {Math.round(zoomLevel * 100)}%
          </span>

          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.min(1.6, Number((z + 0.1).toFixed(1))))}
            disabled={zoomLevel >= 1.6}
            className={`p-2 rounded-lg border transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              isDark
                ? 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-zinc-300'
                : 'bg-stone-100 border-stone-200 hover:border-stone-300 text-stone-700'
            }`}
            title="Aumentar Zoom (+)"
            aria-label="Aumentar zoom"
          >
            <ZoomIn className="size-3.5" />
          </button>

          {zoomLevel !== 1 && (
            <button
              type="button"
              onClick={() => setZoomLevel(1)}
              className={`p-2 rounded-lg border text-xs font-mono transition-colors cursor-pointer flex items-center gap-1 ${
                isDark
                  ? 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-zinc-400'
                  : 'bg-stone-100 border-stone-200 hover:border-stone-300 text-stone-600'
              }`}
              title="Resetar Zoom para 100%"
            >
              <RotateCcw className="size-3" />
              <span className="hidden sm:inline">100%</span>
            </button>
          )}
        </div>

        {/* Centro: Slider de Lâminas / Seletor */}
        <div className="flex items-center gap-3 max-w-xs sm:max-w-md w-full mx-4 justify-center">
          {viewMode === 'spread' ? (
            <div className="flex items-center gap-2 w-full max-w-xs">
              <span className="text-[11px] font-mono text-zinc-500 shrink-0">1</span>
              <input
                type="range"
                min={0}
                max={Math.max(0, totalSpreads - 1)}
                value={currentSpreadIndex}
                onChange={(e) => setCurrentSpreadIndex(Number(e.target.value))}
                className="w-full accent-zinc-400 cursor-pointer h-1.5 bg-zinc-700 rounded-lg appearance-none"
              />
              <span className="text-[11px] font-mono text-zinc-500 shrink-0">{totalSpreads}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 w-full max-w-xs">
              <span className="text-[11px] font-mono text-zinc-500 shrink-0">1</span>
              <input
                type="range"
                min={0}
                max={Math.max(0, allPages.length - 1)}
                value={currentSinglePageIndex}
                onChange={(e) => setCurrentSinglePageIndex(Number(e.target.value))}
                className="w-full accent-zinc-400 cursor-pointer h-1.5 bg-zinc-700 rounded-lg appearance-none"
              />
              <span className="text-[11px] font-mono text-zinc-500 shrink-0">{allPages.length}</span>
            </div>
          )}
        </div>

        {/* Direita: Atalho de Teclado & Info */}
        <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono text-zinc-500">
          <span className="px-1.5 py-0.5 rounded border border-zinc-800 bg-zinc-900/50">←</span>
          <span className="px-1.5 py-0.5 rounded border border-zinc-800 bg-zinc-900/50">→</span>
          <span className="hidden lg:inline">para folhear</span>
        </div>
      </footer>

      {/* ================= MODAL DE INSPEÇÃO RÁPIDA DE PRODUTO ================= */}
      {selectedProduct && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setSelectedProduct(null)}
        >
          <div
            className={`w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 ${
              isDark
                ? 'bg-[#111115] border-zinc-800 text-zinc-100 shadow-[0_30px_90px_rgba(0,0,0,0.95)]'
                : 'bg-white border-stone-200 text-stone-900 shadow-[0_25px_60px_rgba(0,0,0,0.2)]'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Imagem do Produto */}
            <div className="relative aspect-video w-full bg-stone-100 overflow-hidden">
              {selectedProduct.image && (
                <img
                  src={selectedProduct.image}
                  alt={selectedProduct.name}
                  className="w-full h-full object-cover"
                />
              )}
              {selectedProduct.tag && (
                <div className="absolute top-3 left-3 px-2.5 py-0.5 rounded bg-black/80 text-white text-[10px] font-mono uppercase tracking-wider">
                  {selectedProduct.tag}
                </div>
              )}
              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                className="absolute top-3 right-3 p-1.5 rounded-full bg-black/60 hover:bg-black/80 text-white transition-colors cursor-pointer"
                title="Fechar"
                aria-label="Fechar"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Conteúdo Informativo */}
            <div className="p-6 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-[10px] font-mono uppercase text-zinc-400 mb-1">
                    <span>{selectedProduct.category || 'Coleção'}</span>
                    <span>·</span>
                    <span>SKU: {selectedProduct.sku}</span>
                  </div>
                  <h3
                    className="text-xl font-medium tracking-tight"
                    style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
                  >
                    {selectedProduct.name}
                  </h3>
                </div>
                <div className="text-base font-semibold tabular-nums text-right">
                  {selectedProduct.price}
                </div>
              </div>

              {selectedProduct.description && (
                <p className={`text-xs leading-relaxed ${isDark ? 'text-zinc-400' : 'text-stone-600'}`}>
                  {selectedProduct.description}
                </p>
              )}

              {selectedProduct.details && selectedProduct.details.length > 0 && (
                <div className="pt-2 border-t border-zinc-800/60">
                  <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1.5">
                    Especificações do Item
                  </span>
                  <ul className="space-y-1">
                    {selectedProduct.details.map((detail, idx) => (
                      <li key={idx} className="text-xs text-zinc-400 flex items-center gap-2">
                        <span className="size-1 rounded-full bg-zinc-400" />
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Ações do Modal de Produto */}
              <div className="pt-3 flex gap-2.5">
                <button
                  type="button"
                  onClick={() => handleOrderProductViaWhatsApp(selectedProduct)}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                >
                  <MessageSquare className="size-3.5" />
                  <span>Consultar via WhatsApp</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedProduct(null)}
                  className={`px-4 py-2.5 rounded-xl border text-xs font-medium transition-colors cursor-pointer ${
                    isDark
                      ? 'border-zinc-800 hover:border-zinc-700 bg-zinc-900 text-zinc-300'
                      : 'border-stone-200 hover:border-stone-300 bg-stone-100 text-stone-700'
                  }`}
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
