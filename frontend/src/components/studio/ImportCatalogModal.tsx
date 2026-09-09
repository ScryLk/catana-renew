import React, { useState, useRef, useEffect } from 'react';
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
  Palette,
} from 'lucide-react';
import { useStudioStore, API_BASE_URL } from '../../store/studioStore';
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
  const [catalogTitleInput, setCatalogTitleInput] = useState('');

  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fechar com tecla ESC quando aberto e nao processando
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isProcessing) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isProcessing, onClose]);

  if (!isOpen) return null;

  const STEPS = [
    'Leitura estrutural das páginas e vetores do documento...',
    'Isolamento e remoção de fundo dos produtos (IA)...',
    'Decomposição de diagramação e tipografia (Gemini Multimodal)...',
    'Extração da paleta de cores e montagem dos spreads A4...',
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
      formData.append('style_preset', 'auto');

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
      if (result.palette) {
        setActivePalette(result.palette);
      }
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isProcessing) onClose();
      }}
    >
      <div
        className={`w-full max-w-xl rounded-2xl border flex flex-col max-h-[92vh] overflow-hidden transition-colors ${
          isDark
            ? 'bg-[#101013] border-zinc-800 text-zinc-100 shadow-[0_30px_70px_rgba(0,0,0,0.95)]'
            : 'bg-white border-zinc-200 text-zinc-900 shadow-[0_20px_50px_rgba(0,0,0,0.15)]'
        }`}
      >
        {/* Header */}
        <div
          className={`px-6 py-4 border-b flex items-center justify-between shrink-0 ${
            isDark ? 'border-zinc-800 bg-[#151518]' : 'border-zinc-200 bg-zinc-50'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-xl border ${
                isDark
                  ? 'bg-zinc-900 border-zinc-800 text-zinc-200'
                  : 'bg-white border-zinc-200 text-zinc-800 shadow-2xs'
              }`}
            >
              <FileUp className="size-4.5" />
            </div>
            <div>
              <h2
                className={`text-base font-semibold tracking-tight ${
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
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                isDark
                  ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                  : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/60'
              }`}
              title="Fechar"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5">
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
                  className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                    isDragging
                      ? isDark
                        ? 'border-zinc-400 bg-zinc-800/40'
                        : 'border-zinc-600 bg-zinc-100'
                      : isDark
                      ? 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/20'
                      : 'border-zinc-200 hover:border-zinc-300 bg-zinc-50/50'
                  }`}
                >
                  <div className="flex flex-col items-center gap-2.5">
                    <div
                      className={`p-2.5 rounded-full ${
                        isDark ? 'bg-zinc-800/90 text-zinc-300' : 'bg-zinc-200 text-zinc-700'
                      }`}
                    >
                      <UploadCloud className="size-5" />
                    </div>
                    <div>
                      <p className={`text-xs font-medium ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`}>
                        Arraste seu catálogo em PDF ou Word aqui
                      </p>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        ou clique para selecionar do computador (máximo 50 MB)
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  className={`p-3.5 rounded-xl border flex items-center justify-between ${
                    isDark ? 'bg-zinc-900/60 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`p-2 rounded-lg border shrink-0 ${
                        isDark
                          ? 'bg-zinc-800/80 border-zinc-700/60 text-zinc-200'
                          : 'bg-zinc-200 border-zinc-300 text-zinc-800'
                      }`}
                    >
                      <FileText className="size-4.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{selectedFile.name}</p>
                      <p className="text-[11px] text-zinc-400 font-mono">
                        {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedFile(null)}
                    className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                      isDark
                        ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                        : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/60'
                    }`}
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
                  <div
                    className={`w-12 h-12 rounded-full border-2 animate-spin ${
                      isDark
                        ? 'border-zinc-800 border-t-zinc-200'
                        : 'border-zinc-300 border-t-zinc-900'
                    }`}
                  />
                  <Sparkles
                    className={`size-4 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 ${
                      isDark ? 'text-zinc-200' : 'text-zinc-800'
                    }`}
                  />
                </div>
              </div>

              <div>
                <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-zinc-950'}`}>
                  Reconstruindo Catálogo Editorial...
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  {STEPS[currentStepIndex]}
                </p>
              </div>

              <div className={`w-full h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-zinc-800' : 'bg-zinc-200'}`}>
                <div
                  className={`h-full transition-all duration-700 ${isDark ? 'bg-zinc-100' : 'bg-zinc-900'}`}
                  style={{ width: `${((currentStepIndex + 1) / STEPS.length) * 100}%` }}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left pt-2">
                {STEPS.map((step, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center gap-2 text-xs p-2 rounded-lg border ${
                      idx < currentStepIndex
                        ? isDark
                          ? 'text-zinc-300 bg-zinc-800/40 border-zinc-700/40'
                          : 'text-zinc-700 bg-zinc-100 border-zinc-200'
                        : idx === currentStepIndex
                        ? isDark
                          ? 'text-white bg-zinc-800 border-zinc-600 font-medium'
                          : 'text-zinc-950 bg-white border-zinc-300 font-medium shadow-2xs'
                        : isDark
                        ? 'text-zinc-600 border-transparent opacity-50'
                        : 'text-zinc-400 border-transparent opacity-50'
                    }`}
                  >
                    {idx < currentStepIndex ? (
                      <Check className="size-3.5 shrink-0 text-zinc-400" />
                    ) : idx === currentStepIndex ? (
                      <Loader2 className="size-3.5 shrink-0 animate-spin text-zinc-200" />
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
                <label className="block text-[11px] font-medium text-zinc-400 uppercase tracking-wider mb-1.5">
                  Título do Projeto
                </label>
                <input
                  type="text"
                  value={catalogTitleInput}
                  onChange={(e) => setCatalogTitleInput(e.target.value)}
                  placeholder="Ex: Coleção Verão 2026"
                  className={`w-full text-xs px-3.5 py-2.5 rounded-xl border outline-none transition-all ${
                    isDark
                      ? 'bg-zinc-900/60 border-zinc-800 text-zinc-100 focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600/40'
                      : 'bg-zinc-50 border-zinc-200 text-zinc-900 focus:border-zinc-400 focus:ring-1 focus:ring-zinc-300'
                  }`}
                />
              </div>

              {/* Automatic Background Removal Toggle Switch */}
              <div
                className={`p-3.5 rounded-xl border flex items-center justify-between gap-4 transition-colors ${
                  isDark
                    ? 'bg-zinc-900/40 border-zinc-800'
                    : 'bg-zinc-50 border-zinc-200'
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`p-2 rounded-lg border shrink-0 mt-0.5 ${
                      isDark
                        ? 'bg-zinc-800/80 border-zinc-700/60 text-zinc-300'
                        : 'bg-zinc-200/80 border-zinc-300 text-zinc-700'
                    }`}
                  >
                    <Scissors className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>
                        Isolar produtos e remover fundo (IA)
                      </span>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                          isDark
                            ? 'bg-zinc-800 text-zinc-300 border-zinc-700/70'
                            : 'bg-zinc-200/60 text-zinc-600 border-zinc-300'
                        }`}
                      >
                        Recomendado
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">
                      Recorta fotos de produtos com fundo transparente para integração harmoniosa ao layout.
                    </p>
                  </div>
                </div>

                {/* Sleek Toggle Switch */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={removeBackground}
                  onClick={() => setRemoveBackground(!removeBackground)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${
                    removeBackground
                      ? isDark ? 'bg-zinc-100' : 'bg-zinc-900'
                      : isDark ? 'bg-zinc-800' : 'bg-zinc-300'
                  }`}
                  title={removeBackground ? 'Remoção de fundo ativada' : 'Remoção de fundo desativada'}
                >
                  <span
                    className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full shadow-xs transition duration-200 ease-in-out mt-[3px] ${
                      removeBackground
                        ? isDark
                          ? 'translate-x-4.5 bg-zinc-950'
                          : 'translate-x-4.5 bg-white'
                        : isDark
                          ? 'translate-x-1 bg-zinc-400'
                          : 'translate-x-1 bg-white'
                    }`}
                  />
                </button>
              </div>

              {/* Reconstruction Mode */}
              <div>
                <label className="block text-[11px] font-medium text-zinc-400 uppercase tracking-wider mb-2">
                  Modo de Reconstrução
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setReconstructionMode('redesign')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative ${
                      reconstructionMode === 'redesign'
                        ? isDark
                          ? 'bg-zinc-800/90 border-zinc-600 text-white shadow-xs ring-1 ring-zinc-600'
                          : 'bg-zinc-100 border-zinc-400 text-zinc-950 shadow-xs ring-1 ring-zinc-400'
                        : isDark
                        ? 'bg-zinc-900/30 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                        : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Layers className="size-3.5 text-zinc-300" />
                        <span className="text-xs font-semibold">Rediagramação Catana 2.0</span>
                      </div>
                      {reconstructionMode === 'redesign' && (
                        <Check className="size-3.5 text-zinc-200 shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                      Adapta os produtos aos arquétipos editoriais A4 (794x1123 px) com proporções nobres e respiro visual.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReconstructionMode('faithful')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative ${
                      reconstructionMode === 'faithful'
                        ? isDark
                          ? 'bg-zinc-800/90 border-zinc-600 text-white shadow-xs ring-1 ring-zinc-600'
                          : 'bg-zinc-100 border-zinc-400 text-zinc-950 shadow-xs ring-1 ring-zinc-400'
                        : isDark
                        ? 'bg-zinc-900/30 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                        : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <FileText className="size-3.5 text-zinc-400" />
                        <span className="text-xs font-semibold">Fiel ao Original</span>
                      </div>
                      {reconstructionMode === 'faithful' && (
                        <Check className="size-3.5 text-zinc-200 shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                      Preserva a quantidade de itens e a estrutura de página detectada no documento original.
                    </p>
                  </button>
                </div>
              </div>

              {/* Automatic Brand Palette Note */}
              <div
                className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs ${
                  isDark ? 'bg-zinc-900/30 border-zinc-800 text-zinc-400' : 'bg-zinc-50 border-zinc-200 text-zinc-600'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Palette className="size-3.5 text-zinc-400 shrink-0" />
                  <span className="truncate">Paleta e identidade visual extraídas do próprio catálogo importado</span>
                </div>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded border shrink-0 ${
                    isDark
                      ? 'bg-zinc-800/60 text-zinc-400 border-zinc-700/60'
                      : 'bg-zinc-200/60 text-zinc-600 border-zinc-300'
                  }`}
                >
                  Automático
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div
          className={`px-6 py-4 border-t flex items-center justify-between shrink-0 ${
            isDark ? 'border-zinc-800 bg-[#151518]' : 'border-zinc-200 bg-zinc-50'
          }`}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className={`px-4 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 ${
              isDark
                ? 'text-zinc-400 hover:text-white hover:bg-zinc-800/40'
                : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-200/60'
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
                <Sparkles className="size-3.5 shrink-0" />
                <span>Importar e Reconstruir Catálogo</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
