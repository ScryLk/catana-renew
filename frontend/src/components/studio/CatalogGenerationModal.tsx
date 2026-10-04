import { ResponsiveModal } from '../mobile/ResponsiveModal';
import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Bot,
  Copy,
  Check,
  ExternalLink,
  Layers,
  ArrowRight,
  Loader2,
  Palette,
  Type,
  BookOpen,
} from 'lucide-react';
import { DemoTemplateInfo } from '../../data/demoCatalogs.data';
import { toast } from 'sonner';

interface CatalogGenerationModalProps {
  isOpen: boolean;
  template: DemoTemplateInfo | null;
  onClose: () => void;
  onUsePrompt: (promptText: string) => void;
  onLoadCatalog: (templateKey: string) => void;
  isLoadingCatalog: boolean;
  isDark: boolean;
}

export const CatalogGenerationModal: React.FC<CatalogGenerationModalProps> = ({
  isOpen,
  template,
  onClose,
  onUsePrompt,
  onLoadCatalog,
  isLoadingCatalog,
  isDark,
}) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen || !template) return null;

  const handleCopyPrompt = () => {
    if (!template.generationPrompt) return;
    navigator.clipboard.writeText(template.generationPrompt);
    setCopied(true);
    toast.success('Prompt copiado para a area de transferencia.');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenFlipbook = () => {
    window.open(`/view/${template.key}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <ResponsiveModal label="Gerar catálogo" onDismiss={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="generation-modal-title"
    >
      <div
        className={`w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden my-auto flex flex-col transition-all ${
          isDark
            ? 'bg-[#121215] border-zinc-800 text-zinc-100'
            : 'bg-white border-zinc-200 text-zinc-900'
        }`}
      >
        {/* Modal Header */}
        <div
          className={`flex items-center justify-between px-5 py-3.5 border-b ${
            isDark ? 'border-zinc-800/80 bg-zinc-900/40' : 'border-zinc-100 bg-zinc-50/70'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div
              className={`size-7 rounded-lg flex items-center justify-center border ${
                isDark
                  ? 'bg-zinc-800/80 border-zinc-700/80 text-zinc-300'
                  : 'bg-zinc-100 border-zinc-200 text-zinc-700'
              }`}
            >
              <Sparkles className="size-3.5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span
                  className={`text-[9px] font-mono uppercase tracking-widest font-semibold px-1.5 py-0.5 rounded border ${
                    isDark
                      ? 'bg-zinc-800 border-zinc-700 text-zinc-300'
                      : 'bg-zinc-100 border-zinc-200 text-zinc-700'
                  }`}
                >
                  {template.badge}
                </span>
                <span className={`text-xs font-mono ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                  {template.segment}
                </span>
              </div>
              <h2
                id="generation-modal-title"
                className="text-sm sm:text-base font-semibold tracking-tight mt-0.5 leading-snug"
              >
                {template.title}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isDark
                ? 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
                : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
            }`}
            aria-label="Fechar modal"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-5 max-h-[75vh] overflow-y-auto custom-scrollbar">
          {/* Top Banner: Cover Snapshot & Overview */}
          <div
            className={`p-3.5 rounded-xl border flex flex-col sm:flex-row items-center gap-3.5 ${
              isDark ? 'bg-zinc-900/40 border-zinc-800/60' : 'bg-zinc-50 border-zinc-200/80'
            }`}
          >
            {/* Realistic Mini Cover */}
            <div className="relative w-20 aspect-[1/1.414] rounded-md overflow-hidden shadow-md border border-black/20 shrink-0">
              <img
                src={template.featuredImageUrl}
                alt={template.title}
                className="w-full h-full object-cover"
              />
              <div
                className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/60"
              />
              <div className="absolute inset-y-0 left-0 w-2 bg-gradient-to-r from-black/60 to-transparent pointer-events-none" />
              <div className="relative z-10 h-full p-2 flex flex-col justify-between text-white">
                <span className="text-[7px] font-mono tracking-wider font-bold px-1 py-0.5 rounded border border-white/20 bg-black/40">
                  {template.badge}
                </span>
                <div>
                  <div className="text-[8px] font-serif font-bold uppercase leading-tight line-clamp-2">
                    {template.brandName}
                  </div>
                  <div className="text-[7px] text-white/70 font-mono mt-0.5">
                    {template.totalPages} Págs A4
                  </div>
                </div>
              </div>
            </div>

            {/* Description & Preset Info */}
            <div className="flex-1 text-left space-y-2">
              <p className={`text-xs leading-relaxed ${isDark ? 'text-zinc-300' : 'text-zinc-600'}`}>
                {template.description}
              </p>
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-[11px] font-mono">
                <span
                  className={`px-2 py-0.5 rounded border ${
                    isDark
                      ? 'bg-zinc-800/80 border-zinc-700 text-zinc-300'
                      : 'bg-white border-zinc-200 text-zinc-700'
                  }`}
                >
                  Estilo: {template.stylePreset}
                </span>
                <span
                  className={`px-2 py-0.5 rounded border ${
                    isDark
                      ? 'bg-zinc-800/80 border-zinc-700 text-zinc-300'
                      : 'bg-white border-zinc-200 text-zinc-700'
                  }`}
                >
                  {template.products.length} Produtos
                </span>
                <span
                  className={`px-2 py-0.5 rounded border ${
                    isDark
                      ? 'bg-zinc-800/80 border-zinc-700 text-zinc-300'
                      : 'bg-white border-zinc-200 text-zinc-700'
                  }`}
                >
                  Contraste: {template.palette.contrastRatio}
                </span>
              </div>
            </div>
          </div>

          {/* Section 1: Prompt de Geração */}
          <div className="space-y-2 text-left">
            <div className="flex items-center gap-2">
              <Bot className="size-3.5 text-zinc-400" />
              <h3 className="text-xs font-mono uppercase tracking-wider font-semibold">
                Prompt de Geração
              </h3>
            </div>

            <div
              className={`p-3 rounded-xl border font-mono text-xs leading-relaxed relative group ${
                isDark
                  ? 'bg-zinc-950 border-zinc-800 text-zinc-200'
                  : 'bg-zinc-50 border-zinc-200 text-zinc-800'
              }`}
            >
              <p className="select-text whitespace-pre-wrap">{template.generationPrompt}</p>

              <div className="mt-2.5 pt-2 border-t flex flex-wrap items-center justify-between gap-2 border-zinc-800/40">
                <button
                  type="button"
                  onClick={handleCopyPrompt}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                    copied
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : isDark
                      ? 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white'
                      : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900'
                  }`}
                >
                  {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  <span>{copied ? 'Copiado!' : 'Copiar Prompt'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => onUsePrompt(template.generationPrompt)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    isDark
                      ? 'bg-zinc-100 hover:bg-white text-zinc-950'
                      : 'bg-zinc-900 hover:bg-zinc-800 text-white'
                  }`}
                >
                  <span>Usar este Prompt</span>
                  <ArrowRight className="size-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Section 2: Agentes Especialistas Envolvidos */}
          <div className="space-y-2 text-left">
            <div className="flex items-center gap-2">
              <Layers className="size-3.5 text-zinc-400" />
              <h3 className="text-xs font-mono uppercase tracking-wider font-semibold">
                Agentes Especialistas
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {template.agentsUsed.map((agent, idx) => (
                <div
                  key={idx}
                  className={`p-2 rounded-xl border flex items-center gap-2 text-xs ${
                    isDark
                      ? 'bg-zinc-900/60 border-zinc-800 text-zinc-200'
                      : 'bg-zinc-50 border-zinc-200 text-zinc-800'
                  }`}
                >
                  <div
                    className={`size-5 rounded flex items-center justify-center shrink-0 border ${
                      isDark
                        ? 'bg-zinc-800 border-zinc-700 text-zinc-400'
                        : 'bg-zinc-200 border-zinc-300 text-zinc-600'
                    }`}
                  >
                    <Bot className="size-3" />
                  </div>
                  <span className="font-medium truncate">{agent}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Design System & Diagramação */}
          <div className="space-y-2 text-left">
            <div className="flex items-center gap-2">
              <Palette className="size-3.5 text-zinc-400" />
              <h3 className="text-xs font-mono uppercase tracking-wider font-semibold">
                Diretrizes de Design
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Tipografia */}
              <div
                className={`p-2.5 rounded-xl border flex flex-col justify-between ${
                  isDark ? 'bg-zinc-900/50 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 mb-1.5">
                  <Type className="size-3" />
                  <span>Tipografia</span>
                </div>
                <div className="space-y-1 text-xs">
                  <div>
                    <span className="text-[10px] text-zinc-500 font-mono">Display: </span>
                    <span className="font-semibold">{template.typography.display}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 font-mono">Texto: </span>
                    <span>{template.typography.body}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 font-mono">Mono: </span>
                    <span className="font-mono text-[11px]">{template.typography.mono}</span>
                  </div>
                </div>
              </div>

              {/* Grid & Formato */}
              <div
                className={`p-2.5 rounded-xl border flex flex-col justify-between ${
                  isDark ? 'bg-zinc-900/50 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 mb-1.5">
                  <BookOpen className="size-3" />
                  <span>Grid & Formato</span>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="font-semibold">Padrão A4 (210 x 297mm)</div>
                  <p className="text-[11px] text-zinc-500 leading-snug">{template.gridSystem}</p>
                </div>
              </div>

              {/* Paleta Cromática */}
              <div
                className={`p-2.5 rounded-xl border flex flex-col justify-between ${
                  isDark ? 'bg-zinc-900/50 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 mb-1.5">
                  <Palette className="size-3" />
                  <span>Paleta Cromática</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center -space-x-1">
                    <div
                      className="size-5 rounded-full border border-black/30 shadow-xs"
                      style={{ backgroundColor: template.primaryColor }}
                    />
                    <div
                      className="size-5 rounded-full border border-black/30 shadow-xs"
                      style={{ backgroundColor: template.accentColor }}
                    />
                    <div
                      className="size-5 rounded-full border border-black/30 shadow-xs"
                      style={{ backgroundColor: template.backgroundColor }}
                    />
                    <div
                      className="size-5 rounded-full border border-black/30 shadow-xs"
                      style={{ backgroundColor: template.palette.surface }}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-zinc-500 truncate">
                    {template.palette.name}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div
          className={`flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2.5 px-5 py-3 border-t ${
            isDark ? 'border-zinc-800/80 bg-zinc-900/40' : 'border-zinc-100 bg-zinc-50/70'
          }`}
        >
          <button
            type="button"
            onClick={handleOpenFlipbook}
            className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
              isDark
                ? 'border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white'
                : 'border-zinc-300 text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950'
            }`}
          >
            <BookOpen className="size-3.5" />
            <span>Folhear Revista</span>
            <ExternalLink className="size-3 opacity-60" />
          </button>

          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                isDark
                  ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
              }`}
            >
              Fechar
            </button>

            <button
              type="button"
              disabled={isLoadingCatalog}
              onClick={() => onLoadCatalog(template.key)}
              className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                isDark
                  ? 'bg-zinc-100 hover:bg-white text-zinc-950'
                  : 'bg-zinc-900 hover:bg-zinc-800 text-white'
              }`}
            >
              {isLoadingCatalog ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Carregando...</span>
                </>
              ) : (
                <>
                  <span>Abrir na Prancheta</span>
                  <ArrowRight className="size-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </ResponsiveModal>
  );
};
