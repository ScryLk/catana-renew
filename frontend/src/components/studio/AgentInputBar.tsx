import React, { useState, useRef, useEffect } from 'react';
import {
  Paperclip,
  LayoutGrid,
  Sparkles,
  ArrowUp,
  X,
  FileText,
  FileSpreadsheet,
  FileImage,
  Upload,
} from 'lucide-react';
import { useStudioStore, ChatAttachment } from '../../store/studioStore';
import { STUDIO_SKILLS, StudioSkill } from '../../data/studioSkills';
import { SlashCommandMenu } from './SlashCommandMenu';
import { toast } from 'sonner';

export const AgentInputBar: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [isAttachMenuOpen, setIsAttachMenuOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Slash commands state
  const [isSlashMenuOpen, setIsSlashMenuOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState('');
  const [slashSelectedIndex, setSlashSelectedIndex] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    theme,
    sendMessageToAgent,
    isSkillsModalOpen,
    setIsSkillsModalOpen,
    pendingInputPrompt,
    setPendingInputPrompt,
  } = useStudioStore();
  const isDark = theme === 'dark';

  // Inserção automática de prompt via catálogo de skills
  useEffect(() => {
    if (pendingInputPrompt) {
      setInputText(pendingInputPrompt);
      textareaRef.current?.focus();
      setPendingInputPrompt(null);
    }
  }, [pendingInputPrompt, setPendingInputPrompt]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) {
        setIsAttachMenuOpen(false);
      }
    };
    if (isAttachMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isAttachMenuOpen]);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

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
    setIsAttachMenuOpen(false);
    toast.success(`${newAtts.length} documento(s) anexado(s)!`);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAddSampleAttachment = (sample: {
    name: string;
    size: string;
    type: ChatAttachment['type'];
  }) => {
    const newAtt: ChatAttachment = {
      id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      ...sample,
    };
    setAttachments((prev) => [...prev, newAtt]);
    setIsAttachMenuOpen(false);
    toast.success(`Documento "${sample.name}" anexado!`);
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const filteredSkills = STUDIO_SKILLS.filter((skill) => {
    if (!slashQuery) return true;
    const q = slashQuery.toLowerCase().replace('/', '');
    return (
      skill.command.toLowerCase().includes(q) ||
      skill.name.toLowerCase().includes(q) ||
      skill.description.toLowerCase().includes(q) ||
      skill.roleBadge.toLowerCase().includes(q)
    );
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInputText(value);

    // Detect slash trigger
    const lastSlashIndex = value.lastIndexOf('/');
    if (
      lastSlashIndex !== -1 &&
      (lastSlashIndex === 0 || value[lastSlashIndex - 1] === ' ' || value[lastSlashIndex - 1] === '\n')
    ) {
      const query = value.slice(lastSlashIndex + 1);
      if (!query.includes(' ')) {
        setSlashQuery(query);
        setIsSlashMenuOpen(true);
        setSlashSelectedIndex(0);
        return;
      }
    }
    setIsSlashMenuOpen(false);
  };

  const handleSelectSkill = (skill: StudioSkill) => {
    const lastSlashIndex = inputText.lastIndexOf('/');
    const prefix = lastSlashIndex !== -1 ? inputText.slice(0, lastSlashIndex) : '';
    const newText = `${prefix}${skill.command} `;
    setInputText(newText);
    setIsSlashMenuOpen(false);
    textareaRef.current?.focus();
  };

  const handleSend = () => {
    if (!inputText.trim() && attachments.length === 0) return;

    const currentAttachments = [...attachments];
    const userPrompt =
      inputText.trim() ||
      (currentAttachments.length > 0
        ? `Analise o(s) documento(s) anexado(s): ${currentAttachments.map((a) => a.name).join(', ')}.`
        : '');

    setInputText('');
    setAttachments([]);
    setIsSlashMenuOpen(false);

    sendMessageToAgent(userPrompt, currentAttachments);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isSlashMenuOpen && filteredSkills.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashSelectedIndex((prev) => (prev + 1) % filteredSkills.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashSelectedIndex((prev) => (prev - 1 + filteredSkills.length) % filteredSkills.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        handleSelectSkill(filteredSkills[slashSelectedIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsSlashMenuOpen(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSlashCommand = (cmd: string) => {
    setInputText(cmd + ' ');
    textareaRef.current?.focus();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

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
    toast.success(`${newAtts.length} documento(s) anexado(s)!`);
  };

  return (
    <div
      className={`p-3 border-t transition-colors ${
        isDark ? 'border-zinc-800 bg-[#0c0c0e]' : 'border-zinc-200 bg-white'
      }`}
    >
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        multiple
        accept=".pdf,.doc,.docx,.txt,.csv,.xlsx,.xls,.png,.jpg,.jpeg"
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* Input & Container */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative rounded-xl border transition-all p-2.5 ${
          isDragging
            ? isDark
              ? 'border-white bg-zinc-800/80 ring-2 ring-white/20'
              : 'border-zinc-900 bg-zinc-100 ring-2 ring-zinc-900/10'
            : isDark
            ? 'bg-[#131317] border-zinc-800 focus-within:border-zinc-600'
            : 'bg-zinc-50 border-zinc-200 focus-within:border-zinc-400'
        }`}
      >
        {/* Attached Document Chips */}
        {attachments.length > 0 && (
          <div className="mb-2 pb-2 border-b border-inherit flex flex-wrap gap-1.5">
            {attachments.map((att) => (
              <div
                key={att.id}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-mono border transition-colors ${
                  isDark
                    ? 'bg-zinc-900 border-zinc-700 text-zinc-200'
                    : 'bg-white border-zinc-300 text-zinc-800 shadow-2xs'
                }`}
              >
                {att.type === 'sheet' ? (
                  <FileSpreadsheet className="size-3 text-emerald-400 shrink-0" />
                ) : att.type === 'pdf' ? (
                  <FileText className="size-3 text-red-400 shrink-0" />
                ) : att.type === 'image' ? (
                  <FileImage className="size-3 text-blue-400 shrink-0" />
                ) : (
                  <FileText className="size-3 text-zinc-400 shrink-0" />
                )}
                <span className="truncate max-w-[130px] font-medium">{att.name}</span>
                <span className={`text-[9px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                  ({att.size})
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveAttachment(att.id)}
                  className={`p-0.5 rounded transition-colors cursor-pointer ${
                    isDark ? 'hover:bg-zinc-800 text-zinc-400 hover:text-white' : 'hover:bg-zinc-200 text-zinc-500 hover:text-zinc-900'
                  }`}
                  aria-label="Remover anexo"
                >
                  <X className="size-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Slash Command Autocomplete Palette */}
        <SlashCommandMenu
          isOpen={isSlashMenuOpen}
          searchQuery={slashQuery}
          selectedIndex={slashSelectedIndex}
          filteredSkills={filteredSkills}
          onSelectSkill={handleSelectSkill}
          onClose={() => setIsSlashMenuOpen(false)}
        />

        <textarea
          ref={textareaRef}
          value={inputText}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          rows={2}
          aria-label="Instrução ou comando para o assistente de design"
          placeholder={
            attachments.length > 0
              ? 'Digite uma orientação sobre o documento anexado (ou pressione Enter para analisar)...'
              : 'Peça uma alteração, envie um briefing ou anexe um documento (digite / para ver habilidades)...'
          }
          className={`w-full bg-transparent text-xs resize-none outline-none leading-relaxed ${
            isDark
              ? 'text-zinc-100 placeholder:text-zinc-500'
              : 'text-zinc-900 placeholder:text-zinc-400'
          }`}
        />

        {/* Action icons bar inside input */}
        <div
          className={`flex items-center justify-between pt-1.5 border-t ${
            isDark ? 'border-zinc-800/60' : 'border-zinc-200/60'
          }`}
        >
          <div className={`flex items-center gap-1 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
            {/* Attachment Button & Popover */}
            <div className="relative" ref={attachMenuRef}>
              <button
                type="button"
                onClick={() => setIsAttachMenuOpen((prev) => !prev)}
                className={`p-1 rounded transition-colors cursor-pointer ${
                  isAttachMenuOpen || attachments.length > 0
                    ? isDark
                      ? 'bg-zinc-800 text-white'
                      : 'bg-zinc-200 text-zinc-950'
                    : isDark
                    ? 'hover:text-white hover:bg-zinc-800'
                    : 'hover:text-zinc-900 hover:bg-zinc-200'
                }`}
                title="Anexar documento ou planilha"
                aria-label="Anexar documento ou planilha"
              >
                <Paperclip className="size-3.5" />
              </button>

              {/* Floating Attach Menu */}
              {isAttachMenuOpen && (
                <div
                  className={`absolute bottom-full left-0 mb-2 w-64 border rounded-xl shadow-2xl p-1.5 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150 transition-colors ${
                    isDark
                      ? 'bg-[#151519] border-zinc-700 text-zinc-200 shadow-[0_12px_36px_rgba(0,0,0,0.85)]'
                      : 'bg-white border-zinc-200 text-zinc-900 shadow-[0_8px_30px_rgba(0,0,0,0.15)]'
                  }`}
                >
                  <div className="px-2.5 py-1.5 border-b border-inherit mb-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-medium">
                      Anexar Arquivos
                    </span>
                  </div>

                  {/* Native Upload Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsAttachMenuOpen(false);
                      fileInputRef.current?.click();
                    }}
                    className={`w-full text-left p-2 rounded-lg text-xs flex items-center gap-2 transition-colors cursor-pointer ${
                      isDark
                        ? 'hover:bg-zinc-800 text-zinc-200 hover:text-white'
                        : 'hover:bg-zinc-100 text-zinc-800 hover:text-zinc-950'
                    }`}
                  >
                    <Upload className="size-3.5 text-zinc-400 shrink-0" />
                    <div>
                      <span className="font-medium block text-[11px]">Upload do Computador</span>
                      <span className={`text-[9px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                        PDF, CSV, Excel, Word ou Imagens
                      </span>
                    </div>
                  </button>

                  <div className={`border-t my-1 ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`} />

                  {/* Sample Documents for quick testing */}
                  <div className="px-2.5 py-1">
                    <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-500 font-semibold block mb-1">
                      Documentos de Demonstração
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        handleAddSampleAttachment({
                          name: 'tabela_precos_atacado_2026.csv',
                          size: '42 KB',
                          type: 'sheet',
                        })
                      }
                      className={`w-full text-left p-1.5 rounded text-xs flex items-center gap-2 transition-colors cursor-pointer ${
                        isDark ? 'hover:bg-zinc-800/80 text-zinc-300' : 'hover:bg-zinc-100 text-zinc-700'
                      }`}
                    >
                      <FileSpreadsheet className="size-3.5 text-emerald-400 shrink-0" />
                      <div className="truncate">
                        <span className="truncate block text-[11px]">tabela_precos_atacado.csv</span>
                        <span className="text-[9px] text-zinc-500">Planilha B2B · 42 KB</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleAddSampleAttachment({
                          name: 'briefing_colecao_inverno.pdf',
                          size: '184 KB',
                          type: 'pdf',
                        })
                      }
                      className={`w-full text-left p-1.5 rounded text-xs flex items-center gap-2 transition-colors cursor-pointer ${
                        isDark ? 'hover:bg-zinc-800/80 text-zinc-300' : 'hover:bg-zinc-100 text-zinc-700'
                      }`}
                    >
                      <FileText className="size-3.5 text-red-400 shrink-0" />
                      <div className="truncate">
                        <span className="truncate block text-[11px]">briefing_inverno.pdf</span>
                        <span className="text-[9px] text-zinc-500">Diretrizes da Coleção · 184 KB</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleAddSampleAttachment({
                          name: 'manual_marca_atelier.docx',
                          size: '92 KB',
                          type: 'doc',
                        })
                      }
                      className={`w-full text-left p-1.5 rounded text-xs flex items-center gap-2 transition-colors cursor-pointer ${
                        isDark ? 'hover:bg-zinc-800/80 text-zinc-300' : 'hover:bg-zinc-100 text-zinc-700'
                      }`}
                    >
                      <FileText className="size-3.5 text-zinc-400 shrink-0" />
                      <div className="truncate">
                        <span className="truncate block text-[11px]">manual_marca_atelier.docx</span>
                        <span className="text-[9px] text-zinc-500">Diretrizes de Marca · 92 KB</span>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => toast.info('Abrindo gaveta de produtos cadastrados...')}
              className={`p-1 rounded transition-colors ${
                isDark ? 'hover:text-white hover:bg-zinc-800' : 'hover:text-zinc-900 hover:bg-zinc-200'
              }`}
              title="Inserir produto do catálogo"
              aria-label="Inserir produto do catálogo"
            >
              <LayoutGrid className="size-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setIsSkillsModalOpen(true)}
              className={`p-1 rounded transition-colors cursor-pointer ${
                isSkillsModalOpen
                  ? isDark
                    ? 'bg-zinc-800 text-white'
                    : 'bg-zinc-200 text-zinc-950'
                  : isDark
                  ? 'hover:text-white hover:bg-zinc-800'
                  : 'hover:text-zinc-900 hover:bg-zinc-200'
              }`}
              title="Catálogo de Habilidades (Skills)"
              aria-label="Catálogo de Habilidades (Skills)"
            >
              <Sparkles className="size-3.5" />
            </button>
          </div>

          {/* Send Button */}
          <button
            type="button"
            onClick={handleSend}
            disabled={!inputText.trim() && attachments.length === 0}
            className={`size-7 rounded-full disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center font-semibold shadow-sm transition-all cursor-pointer ${
              isDark
                ? 'bg-zinc-100 hover:bg-white text-zinc-950'
                : 'bg-zinc-900 hover:bg-zinc-800 text-white'
            }`}
            title="Enviar instrução"
            aria-label="Enviar instrução"
          >
            <ArrowUp className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Quick Slash Commands Pills */}
      <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar text-[11px]">
        <button
          type="button"
          onClick={() => handleSlashCommand('/captar')}
          className={`px-2 py-1 rounded-md border transition-colors whitespace-nowrap cursor-pointer font-medium ${
            isDark
              ? 'bg-zinc-100 hover:bg-white text-zinc-950 border-white/60'
              : 'bg-zinc-900 hover:bg-zinc-800 text-white border-zinc-900'
          }`}
        >
          /captar
        </button>
        <button
          type="button"
          onClick={() => handleSlashCommand('/conselho')}
          className={`px-2 py-1 rounded-md border transition-colors whitespace-nowrap cursor-pointer ${
            isDark
              ? 'bg-amber-950/30 border-amber-900/50 text-amber-300 hover:text-amber-200 hover:border-amber-700'
              : 'bg-amber-50 border-amber-200 text-amber-800 hover:text-amber-950 hover:border-amber-300'
          }`}
        >
          /conselho
        </button>
        <button
          type="button"
          onClick={() => handleSlashCommand('/harmonizar-cores')}
          className={`px-2 py-1 rounded-md border transition-colors whitespace-nowrap cursor-pointer ${
            isDark
              ? 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
              : 'bg-zinc-100 border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:border-zinc-300'
          }`}
        >
          /harmonizar-cores
        </button>
        <button
          type="button"
          onClick={() => handleSlashCommand('/manifesto')}
          className={`px-2 py-1 rounded-md border transition-colors whitespace-nowrap cursor-pointer ${
            isDark
              ? 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
              : 'bg-zinc-100 border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:border-zinc-300'
          }`}
        >
          /manifesto
        </button>
        <button
          type="button"
          onClick={() => handleSlashCommand('/markup')}
          className={`px-2 py-1 rounded-md border transition-colors whitespace-nowrap cursor-pointer ${
            isDark
              ? 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
              : 'bg-zinc-100 border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:border-zinc-300'
          }`}
        >
          /markup
        </button>
        <button
          type="button"
          onClick={() => handleSlashCommand('/auditar-wcag')}
          className={`px-2 py-1 rounded-md border transition-colors whitespace-nowrap cursor-pointer ${
            isDark
              ? 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
              : 'bg-zinc-100 border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:border-zinc-300'
          }`}
        >
          /auditar-wcag
        </button>
        <button
          type="button"
          onClick={() => handleSlashCommand('/inverter-spread')}
          className={`px-2 py-1 rounded-md border transition-colors whitespace-nowrap cursor-pointer ${
            isDark
              ? 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
              : 'bg-zinc-100 border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:border-zinc-300'
          }`}
        >
          /inverter-spread
        </button>
      </div>
    </div>
  );
};
