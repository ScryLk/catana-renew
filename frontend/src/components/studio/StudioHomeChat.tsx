import React, { useState, useEffect, useRef } from 'react';
import {
  Paperclip,
  ArrowRight,
  X,
  FileSpreadsheet,
  FileText,
  FileImage,
  File,
  FileUp,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { useStudioStore, ChatAttachment } from '../../store/studioStore';
import { ImportCatalogModal } from './ImportCatalogModal';
import { CatalogGenerationModal } from './CatalogGenerationModal';
import { CANONICAL_DEMO_TEMPLATES, DemoTemplateInfo } from '../../data/demoCatalogs.data';
import { toast } from 'sonner';
import { BrandSelectorPill } from './BrandSelectorPill';

const PROMPT_SUGGESTIONS = [
  'Catálogo de confeitaria com potes gourmet e preços...',
  'Cardápio executivo de restaurante com pratos e vinhos...',
  'Lookbook de joalheria com anéis em ouro e diamantes...',
  'Catálogo de hardware e setup com especificações técnicas...',
  'Tabela comercial B2B com códigos SKU e atacado...',
];

export const StudioHomeChat: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedTemplateForDetails, setSelectedTemplateForDetails] = useState<DemoTemplateInfo | null>(null);
  const [loadingTemplateKey, setLoadingTemplateKey] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSelectDemoPrompt = (tpl: DemoTemplateInfo) => {
    setPrompt(tpl.generationPrompt);
    if (textareaRef.current) {
      textareaRef.current.focus();
      const len = tpl.generationPrompt.length;
      textareaRef.current.setSelectionRange(len, len);
    }
    toast.success(`Prompt de "${tpl.brandName}" selecionado!`);
  };

  const {
    triggerCatalogGeneration,
    openExcelImportModal,
    theme,
    isGeneratingCatalog,
    loadDemoCatalog,
    isDemoLoading,
  } = useStudioStore();

  const isDark = theme === 'dark';

  // Typewriter effect com "Ex: " fixo e fluido, sem quebras bruscas
  const [currentText, setCurrentText] = useState('');
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const fullText = PROMPT_SUGGESTIONS[suggestionIndex];
    let timeout: NodeJS.Timeout;

    if (!isDeleting) {
      if (currentText.length < fullText.length) {
        timeout = setTimeout(() => {
          setCurrentText(fullText.slice(0, currentText.length + 1));
        }, 40);
      } else {
        // Pausa com a frase completa antes de iniciar o apagamento
        timeout = setTimeout(() => {
          setIsDeleting(true);
        }, 2600);
      }
    } else {
      if (currentText.length > 0) {
        timeout = setTimeout(() => {
          setCurrentText(fullText.slice(0, currentText.length - 1));
        }, 20);
      } else {
        // Pausa mantendo apenas o "Ex: " antes de digitar a próxima sugestão
        timeout = setTimeout(() => {
          setIsDeleting(false);
          setSuggestionIndex((prev) => (prev + 1) % PROMPT_SUGGESTIONS.length);
        }, 400);
      }
    }

    return () => clearTimeout(timeout);
  }, [currentText, isDeleting, suggestionIndex]);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    processFiles(files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const processFiles = (files: FileList | File[]) => {
    const newAtts: ChatAttachment[] = Array.from(files).map((f) => {
      const ext = f.name.split('.').pop()?.toLowerCase() || '';
      let type: ChatAttachment['type'] = 'file';
      if (['csv', 'xlsx', 'xls'].includes(ext)) type = 'sheet';
      else if (['pdf'].includes(ext)) type = 'pdf';
      else if (['doc', 'docx', 'txt', 'rtf'].includes(ext)) type = 'doc';
      else if (['png', 'jpg', 'jpeg', 'webp', 'svg'].includes(ext)) type = 'image';

      const sizeFormatted =
        f.size > 1024 * 1024
          ? `${(f.size / (1024 * 1024)).toFixed(1)} MB`
          : `${Math.max(1, Math.round(f.size / 1024))} KB`;

      return {
        id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: f.name,
        size: sizeFormatted,
        type,
      };
    });

    setAttachments((prev) => [...prev, ...newAtts]);
    toast.success(`${newAtts.length} arquivo(s) anexado(s) com sucesso.`);
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleStart = (customP?: string) => {
    const promptToUse =
      customP ||
      prompt.trim() ||
      (attachments.length > 0
        ? `Diagramar catálogo editorial com base no(s) ${attachments.length} arquivo(s) anexado(s)`
        : 'Catálogo de confeitaria artesanal com doces finos, potes gourmet e linha festa');
    triggerCatalogGeneration(promptToUse, attachments);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleStart();
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  return (
    <div
      className={`flex-1 h-dvh overflow-y-auto custom-scrollbar flex flex-col items-center justify-center p-6 select-none relative transition-colors ${
        isDark ? 'bg-[#09090b]' : 'bg-[#f8f9fa]'
      }`}
    >
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        multiple
        accept=".pdf,.doc,.docx,.txt,.csv,.xlsx,.xls,image/*"
        onChange={handleFileInputChange}
        className="hidden"
        aria-label="Upload de arquivos"
      />

      <div className="w-full max-w-4xl flex flex-col items-center text-center relative z-10">
        {/* Cursive Brand Icon */}
        <div className="flex items-center gap-3 mb-3">
          <svg
            viewBox="40 10 640 170"
            className={`h-9 fill-none stroke-current transition-colors ${
              isDark
                ? 'text-white drop-shadow-[0_2px_12px_rgba(255,255,255,0.15)]'
                : 'text-zinc-950 drop-shadow-[0_2px_12px_rgba(0,0,0,0.08)]'
            }`}
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-label="Logo Katana"
          >
            <path d="M 132 96 C 124 82 104 76 88 86 C 70 97 62 122 74 138 C 84 150 104 148 116 136 C 128 148 146 142 158 120 C 170 100 190 90 206 90 C 194 78 172 80 160 94 C 148 108 148 128 160 140 C 170 149 186 145 196 132 C 202 124 206 108 208 92 C 206 112 206 130 214 142 C 222 152 236 146 244 128 C 256 102 270 66 282 44 C 280 70 276 110 278 132 C 280 148 294 152 308 138 C 322 124 344 100 384 90 C 370 78 348 80 336 94 C 324 108 324 128 336 140 C 346 149 362 145 372 132 C 378 124 382 108 384 92 C 382 112 382 130 390 142 C 398 152 412 146 420 128 C 428 110 438 96 446 88 C 448 106 446 128 448 142 C 458 116 472 94 486 88 C 494 84 498 92 498 104 C 498 120 496 132 502 142 C 508 150 520 146 528 128 C 536 112 560 92 592 90 C 578 78 556 80 544 94 C 532 108 532 128 544 140 C 554 149 570 145 580 132 C 586 124 590 108 592 92 C 590 112 590 130 598 142 C 608 154 626 148 640 124" />
            <path d="M 250 76 C 272 68 300 64 328 70" />
          </svg>
          <span
            className={`text-xs font-mono tracking-wider font-semibold px-2 py-0.5 rounded-full border ${
              isDark
                ? 'bg-zinc-800/80 border-zinc-700/60 text-zinc-300'
                : 'bg-zinc-100 border-zinc-200 text-zinc-700'
            }`}
          >
            2.0
          </span>
        </div>

        {/* Hero Title */}
        <h1
          className={`text-3xl sm:text-4xl font-semibold tracking-tight mb-6 text-balance transition-colors ${
            isDark ? 'text-white' : 'text-zinc-900'
          }`}
        >
          O que vamos criar hoje?
        </h1>

        <div className="w-full mb-3">
          {/* Central Prompt Input Box */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`w-full rounded-2xl border transition-all text-left relative ${
              isDragging
                ? isDark
                  ? 'border-zinc-400 bg-zinc-900/90 shadow-2xl ring-2 ring-zinc-500/30'
                  : 'border-zinc-500 bg-zinc-50 shadow-2xl ring-2 ring-zinc-400/30'
                : isDark
                ? 'bg-[#121215] border-zinc-800 focus-within:border-zinc-600 shadow-xl'
                : 'bg-white border-zinc-200 focus-within:border-zinc-400 shadow-lg'
            }`}
          >
            <div className="p-3.5">
              <textarea
                ref={textareaRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={3}
                aria-label="Instrução para criação do catálogo"
                placeholder={
                  attachments.length > 0
                    ? 'Descreva instruções adicionais para os arquivos anexados...'
                    : `Ex: ${currentText}`
                }
                className={`w-full bg-transparent text-sm resize-none outline-none leading-relaxed ${
                  isDark
                    ? 'text-zinc-100 placeholder:text-zinc-500'
                    : 'text-zinc-900 placeholder:text-zinc-400'
                }`}
              />
            </div>

            {/* Attached Files Chips Strip */}
            {attachments.length > 0 && (
              <div
                className={`px-3.5 pb-2.5 pt-0.5 flex flex-wrap gap-1.5 border-t ${
                  isDark ? 'border-zinc-800/60' : 'border-zinc-100'
                }`}
              >
                {attachments.map((att) => (
                  <div
                    key={att.id}
                    className={`inline-flex items-center gap-1.5 pl-2 pr-1.5 py-1 rounded-lg text-xs border ${
                      isDark
                        ? 'bg-zinc-900/90 border-zinc-700/80 text-zinc-200'
                        : 'bg-zinc-100 border-zinc-200 text-zinc-800'
                    }`}
                  >
                    {att.type === 'sheet' ? (
                      <FileSpreadsheet className="size-3.5 text-emerald-400 shrink-0" />
                    ) : att.type === 'pdf' ? (
                      <FileText className="size-3.5 text-rose-400 shrink-0" />
                    ) : att.type === 'image' ? (
                      <FileImage className="size-3.5 text-sky-400 shrink-0" />
                    ) : (
                      <File className="size-3.5 text-zinc-400 shrink-0" />
                    )}
                    <span className="truncate max-w-[140px]">{att.name}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(att.id)}
                      className="p-0.5 rounded hover:bg-zinc-700/50 text-zinc-400 hover:text-zinc-200 cursor-pointer"
                      aria-label="Remover anexo"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Bottom Actions Bar */}
            <div
              className={`p-2.5 px-3.5 flex flex-wrap items-center justify-between gap-2 border-t rounded-b-2xl ${
                isDark ? 'border-zinc-800/80 bg-zinc-900/40' : 'border-zinc-100 bg-zinc-50/50'
              }`}
            >
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    attachments.length > 0
                      ? isDark
                        ? 'bg-zinc-800 text-zinc-100 border border-zinc-700'
                        : 'bg-zinc-200 text-zinc-900 border border-zinc-300'
                      : isDark
                      ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80'
                      : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100'
                  }`}
                  aria-label="Anexar arquivos"
                >
                  <Paperclip className="size-3.5" />
                  <span>
                    Anexar arquivos
                    {attachments.length > 0 ? ` (${attachments.length})` : ''}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(true)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    isDark
                      ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80'
                      : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100'
                  }`}
                  aria-label="Importar catálogo"
                >
                  <FileUp className="size-3.5" />
                  <span>Importar Catálogo</span>
                </button>

                <button
                  type="button"
                  onClick={openExcelImportModal}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    isDark
                      ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80'
                      : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100'
                  }`}
                  aria-label="Importar produtos"
                >
                  <FileSpreadsheet className="size-3.5 text-zinc-400" />
                  <span>Importar Produtos</span>
                </button>

                <BrandSelectorPill direction="up" />
              </div>

              <button
                type="button"
                disabled={isGeneratingCatalog || (!prompt.trim() && attachments.length === 0)}
                onClick={() => handleStart()}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${
                  isDark
                    ? 'bg-zinc-100 hover:bg-white text-zinc-950'
                    : 'bg-zinc-900 hover:bg-zinc-800 text-white'
                }`}
                aria-label="Gerar catálogo"
              >
                {isGeneratingCatalog ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin text-[#B08D57]" />
                    <span>Sintetizando...</span>
                  </>
                ) : (
                  <>
                    <span>Gerar Catálogo</span>
                    <ArrowRight className="size-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Sugestões de Demonstração (Estilo ChatGPT: apenas descritivos como prompts, sem imagem) */}
        <div id="demo-showcase-section" className="w-full pt-1 pb-10 text-left">
          <div className="flex flex-col gap-1">
            {CANONICAL_DEMO_TEMPLATES.map((tpl) => (
              <div
                key={tpl.key}
                onClick={() => handleSelectDemoPrompt(tpl)}
                className={`group flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                  isDark
                    ? 'hover:bg-zinc-800/50 active:bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                    : 'hover:bg-zinc-100 active:bg-zinc-200 text-zinc-600 hover:text-zinc-900'
                }`}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSelectDemoPrompt(tpl);
                  }
                }}
                aria-label={`Usar prompt de demonstração para ${tpl.brandName}`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <Sparkles className="size-4 shrink-0 text-zinc-500 group-hover:text-[#B08D57] transition-colors" />
                  <span className="text-xs sm:text-sm font-normal truncate group-hover:text-zinc-100 transition-colors">
                    {tpl.generationPrompt}
                  </span>
                </div>

                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedTemplateForDetails(tpl);
                    }}
                    className={`text-[11px] font-medium px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
                      isDark
                        ? 'border-zinc-700/80 bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700 hover:text-white'
                        : 'border-zinc-200 bg-zinc-100 text-zinc-700 hover:bg-zinc-200 hover:text-zinc-900'
                    }`}
                    title="Ver catálogo pronto e detalhes da direção criativa"
                  >
                    Ver exemplo pronto
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modal de Detalhes da Geracao do Catalogo por IA */}
      <CatalogGenerationModal
        isOpen={Boolean(selectedTemplateForDetails)}
        template={selectedTemplateForDetails}
        onClose={() => setSelectedTemplateForDetails(null)}
        onUsePrompt={(promptText) => {
          setPrompt(promptText);
          setSelectedTemplateForDetails(null);
          toast.success('Prompt inserido no campo de criação!');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onLoadCatalog={async (key) => {
          setLoadingTemplateKey(key);
          try {
            await loadDemoCatalog(key);
            setSelectedTemplateForDetails(null);
          } finally {
            setLoadingTemplateKey(null);
          }
        }}
        isLoadingCatalog={Boolean(isDemoLoading && loadingTemplateKey)}
        isDark={isDark}
      />

      {/* Modal de Importacao Inteligente de Catalogos */}
      <ImportCatalogModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
      />
    </div>
  );
};


