import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Printer,
  Share2,
  FileCode,
  Image as ImageIcon,
  Check,
  Copy,
  Download,
  ExternalLink,
  MessageSquare,
  Loader2,
  ShieldCheck,
  Info,
} from 'lucide-react';
import { useStudioStore } from '../../store/studioStore';
import { EditorialPageSnapshot } from './EditorialPageSnapshot';
import { pdfExportService } from '../../services/pdfExportService';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';

export const ExportCatalogModal: React.FC = () => {
  const {
    isExportModalOpen,
    closeExportModal,
    exportModalTab,
    catalogTitle,
    activeCatalogId,
    pages,
    currentSpread,
    activePalette,
    theme,
  } = useStudioStore();

  const isDark = theme === 'dark';

  // Active Tab
  const [activeTab, setActiveTab] = useState<'pdf' | 'share' | 'catana' | 'images'>(exportModalTab || 'pdf');

  // Sincroniza a aba ativa quando o modal for aberto por botões específicos
  useEffect(() => {
    if (isExportModalOpen && exportModalTab) {
      setActiveTab(exportModalTab);
    }
  }, [isExportModalOpen, exportModalTab]);

  // PDF Tab Options
  const [pdfQuality, setPdfQuality] = useState<'print' | 'web'>('print');
  const [pdfScope, setPdfScope] = useState<'all' | 'spread' | 'single'>('all');
  const [selectedSinglePage, setSelectedSinglePage] = useState<number>(1);
  const [showCropMarks, setShowCropMarks] = useState<boolean>(false);
  const [isExportingPDF, setIsExportingPDF] = useState<boolean>(false);
  const [pdfProgress, setPdfProgress] = useState<number>(0);
  const [pdfStage, setPdfStage] = useState<string>('');

  // Share Tab Options
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [copiedJSON, setCopiedJSON] = useState<boolean>(false);
  const [requirePassword, setRequirePassword] = useState<boolean>(false);
  const [passwordValue, setPasswordValue] = useState<string>('');

  // Images Tab Options
  const [imageScope, setImageScope] = useState<'spread' | 'page'>('spread');
  const [selectedImagePage, setSelectedImagePage] = useState<number>(1);
  const [isExportingImage, setIsExportingImage] = useState<boolean>(false);

  const qrContainerRef = useRef<HTMLDivElement>(null);

  // Fecha no ESC quando nao estiver exportando
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isExportModalOpen && !isExportingPDF && !isExportingImage) {
        closeExportModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isExportModalOpen, isExportingPDF, isExportingImage, closeExportModal]);

  if (!isExportModalOpen) return null;

  // Calculo de URLs públicas
  const slug = (catalogTitle || 'catalogo').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const publicUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/c/${slug || 'catalogo-2026'}`
    : `https://usecatana.com.br/c/${slug || 'catalogo-2026'}`;

  // Copiar link público
  const handleCopyLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(publicUrl);
      setCopiedLink(true);
      toast.success('Link do catálogo copiado para a área de transferência!');
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  // Compartilhar WhatsApp
  const handleShareWhatsApp = () => {
    const message = `Acesse o catálogo editorial "${catalogTitle}": ${publicUrl}`;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Download do QR Code como arquivo SVG
  const handleDownloadQRCode = () => {
    if (!qrContainerRef.current) return;
    const svgElement = qrContainerRef.current.querySelector('svg');
    if (!svgElement) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `qrcode-${slug || 'catalogo'}.svg`;
    link.click();
    URL.revokeObjectURL(blobUrl);
    toast.success('QR Code SVG baixado com sucesso!');
  };

  // Gerar e Baixar PDF
  const handleGeneratePDF = async () => {
    try {
      setIsExportingPDF(true);
      setPdfProgress(0);
      setPdfStage('Iniciando processamento gráfico...');

      // Definir quais IDs de página exportar com base no escopo selecionado
      let targetPageIds: string[] = [];
      if (pdfScope === 'spread') {
        const spreadPages = pages.filter(
          (p) => p.pageNumber === currentSpread[0] || p.pageNumber === currentSpread[1]
        );
        targetPageIds = spreadPages.map((p) => p.id);
      } else if (pdfScope === 'single') {
        const page = pages.find((p) => p.pageNumber === selectedSinglePage);
        if (page) targetPageIds = [page.id];
      } else {
        // Todas as páginas
        targetPageIds = pages.map((p) => p.id);
      }

      const isPrint = pdfQuality === 'print';
      const fileName = `${slug || 'catalogo'}-${isPrint ? 'grafica-300dpi' : 'digital-150dpi'}.pdf`;

      await pdfExportService.generatePDF('katana-offscreen-export-container', {
        fileName,
        scale: isPrint ? 3 : 1.8,
        quality: isPrint ? 1.0 : 0.85,
        compress: true,
        pageIds: targetPageIds,
        onProgress: (progress, stage) => {
          setPdfProgress(progress);
          if (stage) setPdfStage(stage);
        },
      });

      toast.success('Arquivo PDF exportado com sucesso!');
    } catch (err: any) {
      console.error('Falha ao exportar PDF:', err);
      toast.error(err?.message || 'Erro ao gerar o arquivo PDF. Tente novamente.');
    } finally {
      setIsExportingPDF(false);
      setPdfProgress(0);
      setPdfStage('');
    }
  };

  // Montagem do Pacote .catana
  const catanaBundle = {
    $schema: 'https://usecatana.com.br/schemas/v2/catalog.json',
    format: 'catana-bundle',
    version: '2.0.0',
    exportedAt: new Date().toISOString(),
    catalog: {
      id: activeCatalogId || 'catana-editorial-01',
      title: catalogTitle,
      totalPages: pages.length,
      aspectRatio: '1:1.414 (A4 Vertical)',
      activePalette: activePalette,
    },
    typography: {
      display: 'Cormorant Garamond',
      body: 'Jost',
      mono: 'JetBrains Mono',
    },
    pages: pages,
  };

  const jsonSnippet = JSON.stringify(catanaBundle, null, 2);

  // Baixar pacote .catana
  const handleDownloadCatana = () => {
    const blob = new Blob([jsonSnippet], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${slug || 'catalogo'}.catana`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Pacote .catana salvo com sucesso!');
  };

  // Copiar JSON
  const handleCopyJSON = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(jsonSnippet);
      setCopiedJSON(true);
      toast.success('Schema JSON copiado para a área de transferência!');
      setTimeout(() => setCopiedJSON(false), 2500);
    }
  };

  // Baixar Imagem PNG de Alta Resolução
  const handleDownloadImage = async () => {
    try {
      setIsExportingImage(true);
      toast.info('Renderizando imagem em alta definição...');

      const targetPageNumber = imageScope === 'spread' ? currentSpread[0] : selectedImagePage;
      const targetPage = pages.find((p) => p.pageNumber === targetPageNumber);

      if (!targetPage) {
        toast.error('Página selecionada não encontrada.');
        return;
      }

      // Localiza o elemento renderizado no container offscreen
      const container = document.getElementById('katana-offscreen-export-container');
      const pageElements = container?.querySelectorAll(`[data-page-id="${targetPage.id}"]`);
      const targetEl = pageElements?.[0] as HTMLElement;

      if (!targetEl) {
        toast.error('Elemento não disponível para captura gráfica.');
        return;
      }

      const dataUrl = await pdfExportService.generatePNG(targetEl, 2.5);

      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `${slug || 'catalogo'}-pag-${String(targetPage.pageNumber).padStart(2, '0')}.png`;
      link.click();

      toast.success('Imagem PNG baixada com sucesso!');
    } catch (err: any) {
      console.error('Falha ao exportar imagem PNG:', err);
      toast.error('Erro ao renderizar imagem PNG.');
    } finally {
      setIsExportingImage(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
        onClick={() => {
          if (!isExportingPDF && !isExportingImage) closeExportModal();
        }}
      >
        {/* Modal Window */}
        <div
          className={`w-full max-w-3xl max-h-[90vh] rounded-2xl border shadow-2xl flex flex-col overflow-hidden transition-colors duration-200 animate-in zoom-in-95 duration-200 ${
            isDark
              ? 'bg-[#0b0b0e] border-zinc-800 text-zinc-100 shadow-[0_30px_90px_rgba(0,0,0,0.95)]'
              : 'bg-white border-zinc-200 text-zinc-900 shadow-[0_25px_60px_rgba(0,0,0,0.15)]'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className={`px-6 py-4 flex items-center justify-between border-b shrink-0 ${
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
                <Download className="size-4 text-zinc-300" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold tracking-tight">Exportar & Distribuir</h2>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                      isDark
                        ? 'bg-zinc-900 border-zinc-800 text-zinc-400'
                        : 'bg-zinc-100 border-zinc-200 text-zinc-600'
                    }`}
                  >
                    {catalogTitle}
                  </span>
                </div>
                <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                  Selecione o formato de saída editorial, resolução e opções de entrega.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={closeExportModal}
              disabled={isExportingPDF || isExportingImage}
              className={`p-2 rounded-xl border transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                isDark
                  ? 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white'
                  : 'bg-zinc-100 border-zinc-200 hover:border-zinc-300 text-zinc-600 hover:text-zinc-950'
              }`}
              title="Fechar (Esc)"
              aria-label="Fechar modal"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Tab Navigation */}
          <div
            className={`px-6 pt-3 flex items-center gap-2 border-b shrink-0 overflow-x-auto ${
              isDark ? 'border-zinc-800 bg-[#0e0e12]' : 'border-zinc-200 bg-zinc-50/50'
            }`}
          >
            <button
              type="button"
              onClick={() => setActiveTab('pdf')}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-t-lg text-xs font-semibold border-b-2 transition-colors cursor-pointer shrink-0 ${
                activeTab === 'pdf'
                  ? isDark
                    ? 'border-zinc-100 text-white bg-zinc-900/60'
                    : 'border-zinc-950 text-zinc-950 bg-white'
                  : isDark
                  ? 'border-transparent text-zinc-400 hover:text-zinc-200'
                  : 'border-transparent text-zinc-600 hover:text-zinc-950'
              }`}
            >
              <Printer className="size-3.5" />
              <span>PDF Gráfico & Digital</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('share')}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-t-lg text-xs font-semibold border-b-2 transition-colors cursor-pointer shrink-0 ${
                activeTab === 'share'
                  ? isDark
                    ? 'border-zinc-100 text-white bg-zinc-900/60'
                    : 'border-zinc-950 text-zinc-950 bg-white'
                  : isDark
                  ? 'border-transparent text-zinc-400 hover:text-zinc-200'
                  : 'border-transparent text-zinc-600 hover:text-zinc-950'
              }`}
            >
              <Share2 className="size-3.5" />
              <span>Compartilhar & Link Público</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('catana')}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-t-lg text-xs font-semibold border-b-2 transition-colors cursor-pointer shrink-0 ${
                activeTab === 'catana'
                  ? isDark
                    ? 'border-zinc-100 text-white bg-zinc-900/60'
                    : 'border-zinc-950 text-zinc-950 bg-white'
                  : isDark
                  ? 'border-transparent text-zinc-400 hover:text-zinc-200'
                  : 'border-transparent text-zinc-600 hover:text-zinc-950'
              }`}
            >
              <FileCode className="size-3.5" />
              <span>Pacote Aberto (.catana)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('images')}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-t-lg text-xs font-semibold border-b-2 transition-colors cursor-pointer shrink-0 ${
                activeTab === 'images'
                  ? isDark
                    ? 'border-zinc-100 text-white bg-zinc-900/60'
                    : 'border-zinc-950 text-zinc-950 bg-white'
                  : isDark
                  ? 'border-transparent text-zinc-400 hover:text-zinc-200'
                  : 'border-transparent text-zinc-600 hover:text-zinc-950'
              }`}
            >
              <ImageIcon className="size-3.5" />
              <span>Imagens PNG</span>
            </button>
          </div>

          {/* Modal Body / Tab Panes */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* ================= TAB 1: PDF GRÁFICO & DIGITAL ================= */}
            {activeTab === 'pdf' && (
              <div className="space-y-6">
                {/* Resolution Presets */}
                <div>
                  <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block mb-2.5">
                    Perfil de Resolução & Destino
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* 300 DPI Print */}
                    <div
                      onClick={() => setPdfQuality('print')}
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${
                        pdfQuality === 'print'
                          ? isDark
                            ? 'bg-zinc-900/90 border-zinc-500 shadow-md ring-1 ring-zinc-500'
                            : 'bg-zinc-50 border-zinc-900 shadow-sm ring-1 ring-zinc-900'
                          : isDark
                          ? 'bg-zinc-900/30 border-zinc-800 hover:border-zinc-700'
                          : 'bg-white border-zinc-200 hover:border-zinc-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Printer className="size-4 text-zinc-200" />
                          <span className="text-sm font-semibold">Gráfica (300 DPI)</span>
                        </div>
                        {pdfQuality === 'print' && (
                          <span className="size-2 rounded-full bg-zinc-100 ring-4 ring-zinc-800" />
                        )}
                      </div>
                      <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-600'} leading-relaxed`}>
                        Resolução máxima para parque gráfico, pré-impressão e fine art. Compatível com corte e sangria.
                      </p>
                      <div className="mt-3 flex items-center gap-2 text-[10.5px] font-mono text-zinc-400">
                        <span className="px-1.5 py-0.5 rounded border border-zinc-700/60">A4 ISO</span>
                        <span className="px-1.5 py-0.5 rounded border border-zinc-700/60">Alta Fidelidade</span>
                      </div>
                    </div>

                    {/* 150 DPI Digital */}
                    <div
                      onClick={() => setPdfQuality('web')}
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${
                        pdfQuality === 'web'
                          ? isDark
                            ? 'bg-zinc-900/90 border-zinc-500 shadow-md ring-1 ring-zinc-500'
                            : 'bg-zinc-50 border-zinc-900 shadow-sm ring-1 ring-zinc-900'
                          : isDark
                          ? 'bg-zinc-900/30 border-zinc-800 hover:border-zinc-700'
                          : 'bg-white border-zinc-200 hover:border-zinc-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Download className="size-4 text-zinc-200" />
                          <span className="text-sm font-semibold">Digital / Web (150 DPI)</span>
                        </div>
                        {pdfQuality === 'web' && (
                          <span className="size-2 rounded-full bg-zinc-100 ring-4 ring-zinc-800" />
                        )}
                      </div>
                      <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-600'} leading-relaxed`}>
                        Otimizado para envio por WhatsApp, anexo de e-mail e visualização ágil em smartphones.
                      </p>
                      <div className="mt-3 flex items-center gap-2 text-[10.5px] font-mono text-zinc-400">
                        <span className="px-1.5 py-0.5 rounded border border-zinc-700/60">Compacto</span>
                        <span className="px-1.5 py-0.5 rounded border border-zinc-700/60">Leveza Web</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Scope Selection */}
                <div>
                  <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block mb-2.5">
                    Lâminas Incluídas no Arquivo
                  </label>
                  <div className="grid grid-cols-3 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setPdfScope('all')}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        pdfScope === 'all'
                          ? isDark
                            ? 'bg-zinc-900 border-zinc-400 text-white'
                            : 'bg-zinc-100 border-zinc-900 text-zinc-950 font-semibold'
                          : isDark
                          ? 'bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                          : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300'
                      }`}
                    >
                      <div className="text-xs font-semibold">Catálogo Completo</div>
                      <div className="text-[11px] text-zinc-400 mt-0.5">Todas as {pages.length} páginas</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPdfScope('spread')}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        pdfScope === 'spread'
                          ? isDark
                            ? 'bg-zinc-900 border-zinc-400 text-white'
                            : 'bg-zinc-100 border-zinc-900 text-zinc-950 font-semibold'
                          : isDark
                          ? 'bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                          : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300'
                      }`}
                    >
                      <div className="text-xs font-semibold">Lâmina Atual</div>
                      <div className="text-[11px] text-zinc-400 mt-0.5">
                        Páginas {String(currentSpread[0]).padStart(2, '0')} e {String(currentSpread[1]).padStart(2, '0')}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPdfScope('single')}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        pdfScope === 'single'
                          ? isDark
                            ? 'bg-zinc-900 border-zinc-400 text-white'
                            : 'bg-zinc-100 border-zinc-900 text-zinc-950 font-semibold'
                          : isDark
                          ? 'bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                          : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300'
                      }`}
                    >
                      <div className="text-xs font-semibold">Página Avulsa</div>
                      <div className="text-[11px] text-zinc-400 mt-0.5">Selecionar uma página</div>
                    </button>
                  </div>

                  {pdfScope === 'single' && (
                    <div className="mt-3 flex items-center gap-3">
                      <span className="text-xs text-zinc-400">Página selecionada:</span>
                      <select
                        value={selectedSinglePage}
                        onChange={(e) => setSelectedSinglePage(Number(e.target.value))}
                        className={`text-xs px-3 py-1.5 rounded-lg border outline-none cursor-pointer ${
                          isDark
                            ? 'bg-zinc-900 border-zinc-700 text-zinc-200'
                            : 'bg-white border-zinc-300 text-zinc-800'
                        }`}
                      >
                        {pages.map((p) => (
                          <option key={p.id} value={p.pageNumber}>
                            Página {String(p.pageNumber).padStart(2, '0')} ({p.type.toUpperCase()})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Pre-press Options */}
                <div
                  className={`p-4 rounded-xl border space-y-3 ${
                    isDark ? 'bg-zinc-900/40 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="text-xs font-semibold">Marcas de Corte & Registro Gráfico</div>
                      <div className="text-[11px] text-zinc-400">
                        Insere guias de sangria de 3mm e cruzes de alinhamento em todos os cantos.
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showCropMarks}
                        onChange={(e) => setShowCropMarks(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-zinc-100" />
                    </label>
                  </div>
                </div>

                {/* Live Progress Bar during Export */}
                {isExportingPDF && (
                  <div
                    className={`p-4 rounded-xl border space-y-2.5 animate-in fade-in ${
                      isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-zinc-100 border-zinc-300'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold flex items-center gap-2">
                        <Loader2 className="size-3.5 animate-spin text-zinc-400" />
                        {pdfStage || 'Renderizando páginas...'}
                      </span>
                      <span className="font-mono font-bold">{pdfProgress}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full bg-zinc-100 transition-all duration-200"
                        style={{ width: `${pdfProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Primary Action Button */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleGeneratePDF}
                    disabled={isExportingPDF}
                    className={`w-full py-3 px-4 rounded-xl font-semibold text-xs transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${
                      isDark
                        ? 'bg-zinc-100 hover:bg-white text-zinc-950'
                        : 'bg-zinc-900 hover:bg-zinc-800 text-white'
                    }`}
                  >
                    {isExportingPDF ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        <span>Compilando PDF Gráfico...</span>
                      </>
                    ) : (
                      <>
                        <Download className="size-4" />
                        <span>Gerar e Baixar PDF ({pdfQuality === 'print' ? '300 DPI' : '150 DPI'})</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* ================= TAB 2: COMPARTILHAR & LINK PÚBLICO ================= */}
            {activeTab === 'share' && (
              <div className="space-y-6">
                {/* Public Link Box */}
                <div>
                  <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block mb-2">
                    Endereço Público do Catálogo
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={publicUrl}
                      className={`flex-1 text-xs px-3.5 py-2.5 rounded-xl border outline-none font-mono select-all ${
                        isDark
                          ? 'bg-zinc-900 border-zinc-700 text-zinc-200'
                          : 'bg-zinc-50 border-zinc-300 text-zinc-800'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className={`px-4 py-2.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 ${
                        copiedLink
                          ? isDark
                            ? 'bg-zinc-200 text-zinc-950 border-white font-bold'
                            : 'bg-zinc-900 text-white border-zinc-900 font-bold'
                          : isDark
                          ? 'bg-zinc-900 border-zinc-700 hover:border-zinc-500 text-zinc-200'
                          : 'bg-white border-zinc-300 hover:border-zinc-400 text-zinc-800'
                      }`}
                    >
                      {copiedLink ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                      <span>{copiedLink ? 'Copiado!' : 'Copiar'}</span>
                    </button>
                  </div>
                </div>

                {/* Direct Distribution Actions */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={handleShareWhatsApp}
                    className={`p-3.5 rounded-xl border flex items-center gap-3 transition-colors cursor-pointer text-left ${
                      isDark
                        ? 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
                        : 'bg-zinc-50 border-zinc-200 hover:border-zinc-300'
                    }`}
                  >
                    <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                      <MessageSquare className="size-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold">Enviar via WhatsApp</div>
                      <div className="text-[11px] text-zinc-400">Abre mensagem com link formatado</div>
                    </div>
                  </button>

                  <a
                    href={publicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`p-3.5 rounded-xl border flex items-center gap-3 transition-colors cursor-pointer text-left ${
                      isDark
                        ? 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
                        : 'bg-zinc-50 border-zinc-200 hover:border-zinc-300'
                    }`}
                  >
                    <div className="p-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 shrink-0">
                      <ExternalLink className="size-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold">Visualizar como Leitor</div>
                      <div className="text-[11px] text-zinc-400">Abrir link em nova aba</div>
                    </div>
                  </a>
                </div>

                {/* QR Code Section */}
                <div
                  className={`p-4 rounded-xl border flex flex-col sm:flex-row items-center gap-5 ${
                    isDark ? 'bg-zinc-900/40 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
                  }`}
                >
                  <div
                    ref={qrContainerRef}
                    className="p-3 bg-white rounded-xl border border-zinc-200 shadow-sm shrink-0"
                  >
                    <QRCodeSVG
                      value={publicUrl}
                      size={110}
                      level="H"
                      bgColor="#FFFFFF"
                      fgColor="#111115"
                    />
                  </div>

                  <div className="flex-1 text-center sm:text-left space-y-2">
                    <div className="text-xs font-semibold">QR Code Vetorial para Aplicação Física</div>
                    <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-600'} leading-relaxed`}>
                      Posicione este código em vitrines, tags de peças, convites impressos ou balcões comerciais.
                    </p>
                    <button
                      type="button"
                      onClick={handleDownloadQRCode}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                        isDark
                          ? 'bg-zinc-900 border-zinc-700 hover:border-zinc-500 text-zinc-200'
                          : 'bg-white border-zinc-300 hover:border-zinc-400 text-zinc-800'
                      }`}
                    >
                      <Download className="size-3" />
                      <span>Baixar QR Code (SVG)</span>
                    </button>
                  </div>
                </div>

                {/* Access Protection */}
                <div
                  className={`p-4 rounded-xl border space-y-3 ${
                    isDark ? 'bg-zinc-900/40 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="text-xs font-semibold flex items-center gap-1.5">
                        <ShieldCheck className="size-3.5 text-zinc-400" />
                        <span>Proteção por Senha</span>
                      </div>
                      <div className="text-[11px] text-zinc-400">
                        Exige senha para visualização dos preços ou do catálogo completo.
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={requirePassword}
                        onChange={(e) => setRequirePassword(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-zinc-100" />
                    </label>
                  </div>

                  {requirePassword && (
                    <div className="pt-2">
                      <input
                        type="text"
                        placeholder="Defina a senha de acesso (ex: KATANA2026)"
                        value={passwordValue}
                        onChange={(e) => setPasswordValue(e.target.value)}
                        className={`w-full text-xs px-3 py-2 rounded-lg border outline-none font-mono ${
                          isDark
                            ? 'bg-zinc-900 border-zinc-700 text-zinc-200'
                            : 'bg-white border-zinc-300 text-zinc-800'
                        }`}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ================= TAB 3: PACOTE ABERTO (.CATANA) ================= */}
            {activeTab === 'catana' && (
              <div className="space-y-5">
                <div
                  className={`p-4 rounded-xl border flex items-start gap-3 ${
                    isDark ? 'bg-zinc-900/40 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
                  }`}
                >
                  <FileCode className="size-5 text-zinc-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h3 className="text-xs font-semibold">Padrão Aberto e Interoperável</h3>
                    <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-600'} leading-relaxed`}>
                      O arquivo .catana é um pacote JSON padronizado contendo todas as lâminas, coordenadas, produtos,
                      tokens tipográficos e especificações de cores. Pode ser versionado em Git e importado em qualquer
                      instância do Katana Studio.
                    </p>
                  </div>
                </div>

                {/* Catalog Metadata Summary */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div
                    className={`p-3 rounded-xl border ${
                      isDark ? 'bg-zinc-900/40 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
                    }`}
                  >
                    <span className="text-[10px] text-zinc-400 block mb-0.5">Total de Lâminas</span>
                    <span className="text-sm font-semibold">{pages.length} páginas</span>
                  </div>
                  <div
                    className={`p-3 rounded-xl border ${
                      isDark ? 'bg-zinc-900/40 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
                    }`}
                  >
                    <span className="text-[10px] text-zinc-400 block mb-0.5">Paleta Cromática</span>
                    <span className="text-sm font-semibold truncate block">{activePalette.name}</span>
                  </div>
                  <div
                    className={`p-3 rounded-xl border ${
                      isDark ? 'bg-zinc-900/40 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
                    }`}
                  >
                    <span className="text-[10px] text-zinc-400 block mb-0.5">Proporção Base</span>
                    <span className="text-sm font-semibold">1:1.414 (A4)</span>
                  </div>
                  <div
                    className={`p-3 rounded-xl border ${
                      isDark ? 'bg-zinc-900/40 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
                    }`}
                  >
                    <span className="text-[10px] text-zinc-400 block mb-0.5">Versão do Schema</span>
                    <span className="text-sm font-semibold font-mono">v2.0.0</span>
                  </div>
                </div>

                {/* JSON Preview Code Snippet */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                      Prévia do Schema Estruturado
                    </label>
                    <button
                      type="button"
                      onClick={handleCopyJSON}
                      className={`inline-flex items-center gap-1.5 text-xs font-medium cursor-pointer transition-colors ${
                        isDark ? 'text-zinc-400 hover:text-white' : 'text-zinc-600 hover:text-zinc-950'
                      }`}
                    >
                      {copiedJSON ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                      <span>{copiedJSON ? 'Copiado!' : 'Copiar JSON'}</span>
                    </button>
                  </div>
                  <pre
                    className={`p-3.5 rounded-xl border text-[11px] font-mono leading-relaxed overflow-x-auto max-h-48 select-all ${
                      isDark
                        ? 'bg-[#0e0e12] border-zinc-800 text-zinc-300'
                        : 'bg-zinc-50 border-zinc-200 text-zinc-800'
                    }`}
                  >
                    {jsonSnippet}
                  </pre>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleDownloadCatana}
                    className={`flex-1 py-3 px-4 rounded-xl font-semibold text-xs transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg ${
                      isDark
                        ? 'bg-zinc-100 hover:bg-white text-zinc-950'
                        : 'bg-zinc-900 hover:bg-zinc-800 text-white'
                    }`}
                  >
                    <Download className="size-4" />
                    <span>Baixar Arquivo .catana</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyJSON}
                    className={`py-3 px-4 rounded-xl border font-semibold text-xs transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      isDark
                        ? 'bg-zinc-900 border-zinc-700 hover:border-zinc-500 text-zinc-200'
                        : 'bg-white border-zinc-300 hover:border-zinc-400 text-zinc-800'
                    }`}
                  >
                    <Copy className="size-4" />
                    <span>Copiar JSON</span>
                  </button>
                </div>
              </div>
            )}

            {/* ================= TAB 4: IMAGENS PNG ================= */}
            {activeTab === 'images' && (
              <div className="space-y-6">
                <div>
                  <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block mb-2.5">
                    Alvo da Exportação Gráfica
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setImageScope('spread')}
                      className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                        imageScope === 'spread'
                          ? isDark
                            ? 'bg-zinc-900 border-zinc-400 text-white'
                            : 'bg-zinc-100 border-zinc-900 text-zinc-950 font-semibold'
                          : isDark
                          ? 'bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                          : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300'
                      }`}
                    >
                      <div className="text-xs font-semibold">Página Esquerda do Spread</div>
                      <div className="text-[11px] text-zinc-400 mt-0.5">
                        Página {String(currentSpread[0]).padStart(2, '0')}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setImageScope('page')}
                      className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                        imageScope === 'page'
                          ? isDark
                            ? 'bg-zinc-900 border-zinc-400 text-white'
                            : 'bg-zinc-100 border-zinc-900 text-zinc-950 font-semibold'
                          : isDark
                          ? 'bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                          : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300'
                      }`}
                    >
                      <div className="text-xs font-semibold">Escolher Outra Página</div>
                      <div className="text-[11px] text-zinc-400 mt-0.5">Qualquer página do catálogo</div>
                    </button>
                  </div>

                  {imageScope === 'page' && (
                    <div className="mt-3 flex items-center gap-3">
                      <span className="text-xs text-zinc-400">Página selecionada:</span>
                      <select
                        value={selectedImagePage}
                        onChange={(e) => setSelectedImagePage(Number(e.target.value))}
                        className={`text-xs px-3 py-1.5 rounded-lg border outline-none cursor-pointer ${
                          isDark
                            ? 'bg-zinc-900 border-zinc-700 text-zinc-200'
                            : 'bg-white border-zinc-300 text-zinc-800'
                        }`}
                      >
                        {pages.map((p) => (
                          <option key={p.id} value={p.pageNumber}>
                            Página {String(p.pageNumber).padStart(2, '0')} ({p.type.toUpperCase()})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div
                  className={`p-4 rounded-xl border flex items-start gap-3 ${
                    isDark ? 'bg-zinc-900/40 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
                  }`}
                >
                  <Info className="size-4 text-zinc-400 shrink-0 mt-0.5" />
                  <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-600'} leading-relaxed`}>
                    A imagem será gerada com fator de escala 2.5x (alta definição), preservando tipografia nítida,
                    filetes vetoriais e fundos com equilíbrio editorial.
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleDownloadImage}
                    disabled={isExportingImage}
                    className={`w-full py-3 px-4 rounded-xl font-semibold text-xs transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${
                      isDark
                        ? 'bg-zinc-100 hover:bg-white text-zinc-950'
                        : 'bg-zinc-900 hover:bg-zinc-800 text-white'
                    }`}
                  >
                    {isExportingImage ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        <span>Renderizando Imagem PNG...</span>
                      </>
                    ) : (
                      <>
                        <ImageIcon className="size-4" />
                        <span>Baixar Imagem PNG em Alta Resolução</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Offscreen Container para Renderização de Páginas para PDF e Imagens */}
      <div
        id="katana-offscreen-export-container"
        className="fixed top-0 left-[-9999px] pointer-events-none opacity-100 z-[-1] flex flex-col gap-10"
        aria-hidden="true"
      >
        {pages.map((page) => (
          <EditorialPageSnapshot
            key={page.id}
            page={page}
            activePalette={activePalette}
            showCropMarks={showCropMarks}
          />
        ))}
      </div>
    </>
  );
};
