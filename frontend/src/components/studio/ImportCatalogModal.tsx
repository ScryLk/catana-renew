import React, { useState, useRef } from 'react';
import {
  X,
  FileUp,
  FileText,
  UploadCloud,
  Check,
  Loader2,
  Sparkles,
  Scissors,
  Layers,
} from 'lucide-react';
import { useStudioStore, API_BASE_URL } from '../../store/studioStore';
import { STUDIO_PALETTE_PRESETS, StudioPalette } from '../../data/aureaCatalog.mock';
import { toast } from 'sonner';

interface ImportCatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ImportCatalogModal: React.FC<ImportCatalogModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    theme,
    setPages,
    setCatalogTitle,
    setActiveCatalogId,
    setHasStartedSession,
    setActivePalette,
  } = useStudioStore();

  const isDark = theme === 'dark';

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [removeBackground, setRemoveBackground] = useState(true);
  const [reconstructionMode, setReconstructionMode] = useState<'redesign' | 'faithful'>('redesign');
  const [selectedPalette, setSelectedPalette] = useState<StudioPalette>(STUDIO_PALETTE_PRESETS[0]);
  const [catalogTitleInput, setCatalogTitleInput] = useState('');

  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const STEPS = [
    'Leitura estrutural das páginas e vetores do documento...',
    'Isolamento e remoção de fundo dos produtos (IA)...',
    'Decomposição de diagramação e tipografia (Gemini Multimodal)...',
    'Construção dos spreads A4 e montagem no Living Canvas...',
  ];

  const handleFileChange = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'pdf' && ext !== 'docx') {
      toast.error('Formato não suportado. Por favor, envie um arquivo PDF ou Word (.docx).');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast.error('Arquivo muito grande. O limite máximo é de 50 MB.');
      return;
    }
    setSelectedFile(file);
    if (!catalogTitleInput) {
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      setCatalogTitleInput(cleanName);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleStartImport = async () => {
    if (!selectedFile) {
      toast.error('Selecione um arquivo PDF ou Word para iniciar a importação.');
      return;
    }

    setIsProcessing(true);
    setCurrentStepIndex(0);

    const stepInterval = setInterval(() => {
      setCurrentStepIndex((prev) => Math.min(prev + 1, STEPS.length - 1));
    }, 1800);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('title', catalogTitleInput.trim() || selectedFile.name);
      formData.append('remove_background', String(removeBackground));
      formData.append('mode', reconstructionMode);
      formData.append('style_preset', selectedPalette.name.toLowerCase().includes('noir') ? 'noir_or' : 'editorial_clean');

      const token = localStorage.getItem('access_token');
      const response = await fetch(`${API_BASE_URL}/api/v2/studio/catalogs/import-document/`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: formData,
      });

      clearInterval(stepInterval);

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();

      if (result.pages && Array.isArray(result.pages) && result.pages.length > 0) {
        setPages(result.pages);
      }
      if (result.catalog_id) {
        setActiveCatalogId(String(result.catalog_id));
      }
      if (result.title) {
        setCatalogTitle(result.title);
      }
      setActivePalette(selectedPalette);
      setHasStartedSession(true);

      toast.success(result.message || 'Catálogo reconstruído com sucesso!');
      onClose();
    } catch (err: any) {
      clearInterval(stepInterval);
      setIsProcessing(false);
      console.error('Falha na importacao do catalogo:', err);
      toast.error(`Falha ao reconstruir o documento: ${err.message || 'Erro inesperado'}`);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isProcessing) onClose();
      }}
    >
      <div
        className={`w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-colors ${
          isDark ? 'bg-[#121215] border-zinc-800 text-zinc-200' : 'bg-white border-zinc-200 text-zinc-800'
        }`}
      >
        {/* Header */}
        <div
          className={`px-6 py-5 border-b flex items-center justify-between ${
            isDark ? 'border-zinc-800 bg-zinc-900/30' : 'border-zinc-100 bg-zinc-50/50'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl border ${
                isDark ? 'bg-zinc-800/60 border-zinc-700 text-white' : 'bg-zinc-100 border-zinc-200 text-zinc-900'
              }`}
            >
              <FileUp className="size-5" />
            </div>
            <div>
              <h2
                className={`text-lg font-semibold tracking-tight ${
                  isDark ? 'text-white' : 'text-zinc-950'
                }`}
              >
                Importar Catálogo
              </h2>
              <p className="text-xs text-zinc-400">
                Engenharia reversa inteligente com isolamento de fotos e reconstrução em Canvas Vivo.
              </p>
            </div>
          </div>

          {!isProcessing && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition-colors cursor-pointer"
              title="Fechar"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* File Upload Dropzone */}
          {!isProcessing && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileChange(e.target.files[0]);
                  }
                }}
                className="hidden"
              />

              {!selectedFile ? (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                    isDragging
                      ? isDark
                        ? 'border-zinc-400 bg-zinc-800/40'
                        : 'border-zinc-600 bg-zinc-100'
                      : isDark
                      ? 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/20'
                      : 'border-zinc-200 hover:border-zinc-300 bg-zinc-50/50'
                  }`}
                >
                  <div className="flex flex-col items-center gap-3">
                    <div
                      className={`p-3 rounded-full ${
                        isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-200 text-zinc-700'
                      }`}
                    >
                      <UploadCloud className="size-6" />
                    </div>
                    <div>
                      <p className={`text-sm font-medium ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`}>
                        Arraste seu catálogo em PDF ou Word aqui
                      </p>
                      <p className="text-xs text-zinc-400 mt-1">
                        ou clique para selecionar do seu computador (máximo 50 MB)
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  className={`p-4 rounded-xl border flex items-center justify-between ${
                    isDark ? 'bg-zinc-900/60 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 shrink-0">
                      <FileText className="size-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                      <p className="text-xs text-zinc-400 font-mono">
                        {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedFile(null)}
                    className="p-1 rounded-md text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                    title="Remover arquivo"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Processing Progress Feedback */}
          {isProcessing && (
            <div
              className={`p-6 rounded-xl border space-y-5 text-center ${
                isDark ? 'bg-zinc-900/80 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
              }`}
            >
              <div className="flex justify-center">
                <div className="relative">
                  <div className="w-14 h-14 rounded-full border-2 border-zinc-700 border-t-amber-500 animate-spin" />
                  <Sparkles className="size-5 text-amber-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
              </div>

              <div>
                <h3 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-zinc-950'}`}>
                  Reconstruindo Catálogo Editorial...
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  {STEPS[currentStepIndex]}
                </p>
              </div>

              <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-amber-500 h-full transition-all duration-700"
                  style={{ width: `${((currentStepIndex + 1) / STEPS.length) * 100}%` }}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left pt-2">
                {STEPS.map((step, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center gap-2 text-xs p-2 rounded-lg ${
                      idx < currentStepIndex
                        ? 'text-emerald-400 bg-emerald-500/10'
                        : idx === currentStepIndex
                        ? 'text-amber-400 bg-amber-500/10 font-medium'
                        : 'text-zinc-500 opacity-60'
                    }`}
                  >
                    {idx < currentStepIndex ? (
                      <Check className="size-3.5 shrink-0" />
                    ) : idx === currentStepIndex ? (
                      <Loader2 className="size-3.5 shrink-0 animate-spin" />
                    ) : (
                      <span className="size-3.5 flex items-center justify-center font-mono text-[10px] border rounded-full">
                        {idx + 1}
                      </span>
                    )}
                    <span className="truncate">{step}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Configuration Options (When not processing) */}
          {!isProcessing && (
            <div className="space-y-4">
              {/* Title input */}
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                  Título do Projeto
                </label>
                <input
                  type="text"
                  value={catalogTitleInput}
                  onChange={(e) => setCatalogTitleInput(e.target.value)}
                  placeholder="Ex: Coleção Verão 2026"
                  className={`w-full text-xs px-3 py-2 rounded-xl border outline-none transition-colors ${
                    isDark
                      ? 'bg-zinc-900 border-zinc-800 text-zinc-100 focus:border-zinc-600'
                      : 'bg-white border-zinc-300 text-zinc-900 focus:border-zinc-400'
                  }`}
                />
              </div>

              {/* Automatic Background Removal Toggle */}
              <div
                className={`p-3.5 rounded-xl border flex items-start justify-between gap-4 cursor-pointer transition-colors ${
                  isDark
                    ? 'bg-zinc-900/40 border-zinc-800 hover:border-zinc-700'
                    : 'bg-zinc-50 border-zinc-200 hover:border-zinc-300'
                }`}
                onClick={() => setRemoveBackground(!removeBackground)}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0 mt-0.5">
                    <Scissors className="size-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>
                        Isolar produtos e remover fundo automaticamente (IA)
                      </span>
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Recomendado
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-1">
                      Detecta as fotos de produtos, remove fundos ruidosos e gera recortes transparentes para integração perfeita ao layout editorial.
                    </p>
                  </div>
                </div>

                <input
                  type="checkbox"
                  checked={removeBackground}
                  onChange={(e) => setRemoveBackground(e.target.checked)}
                  className="mt-1 size-4 accent-amber-500 cursor-pointer"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>

              {/* Reconstruction Mode */}
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                  Modo de Reconstrução
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setReconstructionMode('redesign')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      reconstructionMode === 'redesign'
                        ? isDark
                          ? 'bg-zinc-800 border-zinc-600 text-white shadow-xs'
                          : 'bg-zinc-100 border-zinc-400 text-zinc-950 shadow-xs'
                        : isDark
                        ? 'bg-zinc-900/30 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                        : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Layers className="size-3.5 text-amber-400" />
                      <span className="text-xs font-semibold">Rediagramação Catana 2.0</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-1">
                      Adapta os produtos aos arquétipos editoriais A4 (794x1123 px) com proporções nobres e respiro visual.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReconstructionMode('faithful')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      reconstructionMode === 'faithful'
                        ? isDark
                          ? 'bg-zinc-800 border-zinc-600 text-white shadow-xs'
                          : 'bg-zinc-100 border-zinc-400 text-zinc-950 shadow-xs'
                        : isDark
                        ? 'bg-zinc-900/30 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                        : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="size-3.5 text-zinc-400" />
                      <span className="text-xs font-semibold">Fiel ao Original</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-1">
                      Preserva a quantidade de itens e a estrutura de página detectada no documento original.
                    </p>
                  </button>
                </div>
              </div>

              {/* Palette Choice */}
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                  Paleta Editorial de Aplicação
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {STUDIO_PALETTE_PRESETS.map((p) => (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => setSelectedPalette(p)}
                      className={`p-2.5 rounded-xl border flex items-center justify-between text-left transition-all cursor-pointer ${
                        selectedPalette.name === p.name
                          ? isDark
                            ? 'bg-zinc-800 border-zinc-600'
                            : 'bg-zinc-100 border-zinc-400'
                          : isDark
                          ? 'bg-zinc-900/30 border-zinc-800 hover:border-zinc-700'
                          : 'bg-white border-zinc-200 hover:border-zinc-300'
                      }`}
                    >
                      <div className="min-w-0 pr-1">
                        <span className={`block text-xs font-medium truncate ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`}>
                          {p.name.split('·')[0].trim()}
                        </span>
                        <span className="text-[10px] text-zinc-400 font-mono">
                          {p.contrastRatio?.split(' ')[0]}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span
                          className="size-3 rounded-full border border-zinc-600/40"
                          style={{ backgroundColor: p.primary }}
                        />
                        <span
                          className="size-3 rounded-full border border-zinc-600/40"
                          style={{ backgroundColor: p.accent }}
                        />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div
          className={`px-6 py-4 border-t flex items-center justify-between ${
            isDark ? 'border-zinc-800 bg-zinc-900/40' : 'border-zinc-100 bg-zinc-50'
          }`}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className={`px-4 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 ${
              isDark ? 'text-zinc-400 hover:text-white' : 'text-zinc-600 hover:text-zinc-950'
            }`}
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleStartImport}
            disabled={!selectedFile || isProcessing}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-sm disabled:opacity-40 disabled:cursor-not-allowed ${
              isDark
                ? 'bg-zinc-100 hover:bg-white text-zinc-950'
                : 'bg-zinc-900 hover:bg-zinc-800 text-white'
            }`}
          >
            {isProcessing ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span>Processando...</span>
              </>
            ) : (
              <>
                <Sparkles className="size-3.5 text-amber-500" />
                <span>Importar e Reconstruir Catálogo</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
