import React, { useState, useRef, useEffect } from 'react';
import {
  Paperclip,
  FileUp,
  FileSpreadsheet,
  ArrowRight,
  Loader2,
  X,
  FileText,
  FileImage,
  File,
} from 'lucide-react';
import { toast } from 'sonner';
import { useStudioStore, ChatAttachment } from '../../store/studioStore';
import { ImportCatalogModal } from './ImportCatalogModal';

export const NewCatalogModal: React.FC = () => {
  const {
    isNewCatalogModalOpen,
    closeNewCatalogModal,
    triggerCatalogGeneration,
    openExcelImportModal,
    isGeneratingCatalog,
    theme,
  } = useStudioStore();

  const isDark = theme === 'dark';

  const [prompt, setPrompt] = useState('');
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isNewCatalogModalOpen && !isImportModalOpen) {
        closeNewCatalogModal();
      }
    };
    if (isNewCatalogModalOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Auto-foco no textarea ao abrir o modal
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isNewCatalogModalOpen, isImportModalOpen, closeNewCatalogModal]);

  if (!isNewCatalogModalOpen) return null;

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

  const handleStart = () => {
    const promptToUse =
      prompt.trim() ||
      (attachments.length > 0
        ? `Diagramar catálogo editorial com base no(s) ${attachments.length} arquivo(s) anexado(s)`
        : '');

    if (!promptToUse && attachments.length === 0) return;

    closeNewCatalogModal();
    triggerCatalogGeneration(promptToUse, attachments);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleStart();
    }
  };

  const handleOpenSpreadsheet = () => {
    closeNewCatalogModal();
    openExcelImportModal();
  };

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Novo Catálogo"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={(e) => {
          if (e.target === e.currentTarget) closeNewCatalogModal();
        }}
      >
        <div className="relative w-full max-w-3xl animate-in zoom-in-95 duration-200">
          {/* Botão de Fechar no canto superior */}
          <button
            type="button"
            onClick={closeNewCatalogModal}
            className={`absolute -top-10 right-0 p-1.5 rounded-lg border transition-colors cursor-pointer flex items-center gap-1.5 text-xs ${
              isDark
                ? 'bg-zinc-900/80 border-zinc-800 text-zinc-400 hover:text-white'
                : 'bg-white/80 border-zinc-200 text-zinc-600 hover:text-zinc-950'
            }`}
            aria-label="Fechar"
            title="Fechar (Esc)"
          >
            <X className="size-3.5" />
            <span className="text-[11px] font-mono">Esc</span>
          </button>

          {/* Input Box Card (exato como na imagem) */}
          <div
            className={`w-full rounded-2xl border shadow-2xl overflow-hidden transition-all ${
              isDark
                ? 'bg-[#121215] border-zinc-800 text-zinc-100'
                : 'bg-white border-zinc-200 text-zinc-900'
            }`}
          >
            {/* Input file invisível para anexos */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg,.webp,.csv,.xlsx,.xls,.doc,.docx"
              onChange={handleFileInputChange}
              className="hidden"
            />

            {/* Textarea */}
            <div className="p-4 pb-2">
              <textarea
                ref={textareaRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={3}
                placeholder="Ex: Catálogo de hardware e setup com especificações técnicas..."
                className={`w-full bg-transparent text-sm resize-none outline-none leading-relaxed custom-scrollbar ${
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
                    <span className="truncate max-w-[140px] font-medium">{att.name}</span>
                    <span className="text-[10px] text-zinc-500 font-mono">({att.size})</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(att.id)}
                      className="p-0.5 rounded hover:bg-zinc-700/50 text-zinc-400 hover:text-zinc-100 cursor-pointer ml-0.5 transition-colors"
                      title="Remover anexo"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Bottom Action Bar */}
            <div
              className={`flex items-center justify-between px-3.5 py-2.5 border-t ${
                isDark ? 'border-zinc-800/80 bg-zinc-900/20' : 'border-zinc-100 bg-zinc-50/50'
              }`}
            >
              {/* Left Buttons: Anexar arquivos, Importar Catálogo, Importar Planilha */}
              <div className="flex items-center gap-1 sm:gap-2">
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
                  title="Importar catálogo existente para torná-lo 100% editável"
                  aria-label="Importar catálogo"
                >
                  <FileUp className="size-3.5" />
                  <span>Importar Catálogo</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenSpreadsheet}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    isDark
                      ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80'
                      : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100'
                  }`}
                  title="Importar produtos de planilha Excel ou CSV"
                  aria-label="Importar Planilha"
                >
                  <FileSpreadsheet className="size-3.5 text-zinc-400" />
                  <span>Importar Planilha</span>
                </button>
              </div>

              {/* Right Button: Gerar Catálogo -> */}
              <button
                type="button"
                disabled={isGeneratingCatalog || (!prompt.trim() && attachments.length === 0)}
                onClick={handleStart}
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
      </div>

      {/* Modal secundário de importação de catálogo existente */}
      <ImportCatalogModal
        isOpen={isImportModalOpen}
        onClose={() => {
          setIsImportModalOpen(false);
          closeNewCatalogModal();
        }}
      />
    </>
  );
};
