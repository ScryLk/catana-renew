import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Plus,
  X,
  Pencil,
  Check,
  TrendingUp,
  FileText,
  MessageSquare,
  Library,
  Search,
  Trash2,
} from 'lucide-react';
import { useStudioStore, StudioMode } from '../../store/studioStore';
import { toast } from 'sonner';

export const ConversationTabBar: React.FC = () => {
  const {
    threads,
    activeThreadId,
    switchThread,
    closeThread,
    createThread,
    renameThread,
    theme,
  } = useStudioStore();

  const isDark = theme === 'dark';
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editTitleValue, setEditTitleValue] = useState('');
  const [isListOpen, setIsListOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editingThreadId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingThreadId]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (listRef.current && !listRef.current.contains(e.target as Node)) {
        setIsListOpen(false);
      }
    };
    if (isListOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isListOpen]);

  const handleStartRename = (id: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingThreadId(id);
    setEditTitleValue(currentTitle);
  };

  const handleSaveRename = (id: string) => {
    if (editTitleValue.trim()) {
      renameThread(id, editTitleValue.trim());
    }
    setEditingThreadId(null);
  };

  const handleKeyDown = (id: string, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSaveRename(id);
    } else if (e.key === 'Escape') {
      setEditingThreadId(null);
    }
  };

  const handleCreateNew = () => {
    createThread();
    setIsListOpen(false);
    toast.success('Nova conversa iniciada!');
  };

  const getModeIcon = (mode: StudioMode) => {
    switch (mode) {
      case 'director':
        return <Sparkles className="size-3 text-amber-500/80 shrink-0" />;
      case 'commercial':
        return <TrendingUp className="size-3 text-emerald-500/80 shrink-0" />;
      case 'copywriter':
        return <FileText className="size-3 text-blue-500/80 shrink-0" />;
      default:
        return <MessageSquare className="size-3 text-zinc-400 shrink-0" />;
    }
  };

  const filteredThreads = threads.filter((t) =>
    t.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (threads.length === 0) return null;

  return (
    <div
      className={`border-b px-2 py-1.5 flex items-center gap-1.5 transition-colors select-none relative z-30 ${
        isDark ? 'bg-[#0b0b0e] border-zinc-800/80' : 'bg-[#f8f9fa] border-zinc-200'
      }`}
    >
      {/* Scrollable Tabs List */}
      <div className="flex-1 flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
        {threads.map((thread) => {
          const isActive = thread.id === activeThreadId;
          const isEditing = thread.id === editingThreadId;
          const msgCount = thread.messages.length;

          if (isEditing) {
            return (
              <div
                key={thread.id}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border text-xs min-w-[120px] max-w-[170px] ${
                  isDark
                    ? 'bg-zinc-900 border-zinc-600 text-zinc-100'
                    : 'bg-white border-zinc-400 text-zinc-900'
                }`}
              >
                {getModeIcon(thread.mode)}
                <input
                  ref={inputRef}
                  type="text"
                  value={editTitleValue}
                  onChange={(e) => setEditTitleValue(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(thread.id, e)}
                  onBlur={() => handleSaveRename(thread.id)}
                  aria-label="Nome da aba de conversa"
                  className="w-full bg-transparent text-[11px] font-medium outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleSaveRename(thread.id)}
                  className="p-0.5 rounded hover:bg-zinc-700/50 text-zinc-400 hover:text-zinc-200"
                  title="Salvar nome"
                  aria-label="Salvar nome"
                >
                  <Check className="size-3" />
                </button>
              </div>
            );
          }

          return (
            <div
              key={thread.id}
              onClick={() => switchThread(thread.id)}
              onDoubleClick={(e) => handleStartRename(thread.id, thread.title, e)}
              className={`group flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all cursor-pointer border shrink-0 ${
                isActive
                  ? isDark
                    ? 'bg-[#18181c] border-zinc-700 text-zinc-100 font-medium shadow-xs'
                    : 'bg-white border-zinc-300 text-zinc-900 font-medium shadow-xs'
                  : isDark
                  ? 'bg-transparent border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
                  : 'bg-transparent border-transparent text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/60'
              }`}
              title={`${thread.title} (Duplo clique para renomear)`}
            >
              {getModeIcon(thread.mode)}

              <span className="text-[11px] max-w-[120px] truncate leading-none">
                {thread.title}
              </span>

              {/* Message Count Pill */}
              {msgCount > 0 && (
                <span
                  className={`text-[9px] px-1 rounded-full tabular-nums font-normal ${
                    isActive
                      ? isDark
                        ? 'bg-zinc-700 text-zinc-300'
                        : 'bg-zinc-200 text-zinc-700'
                      : isDark
                      ? 'bg-zinc-800 text-zinc-500'
                      : 'bg-zinc-100 text-zinc-400'
                  }`}
                >
                  {msgCount}
                </span>
              )}

              {/* Inline Edit Button (on hover) */}
              <button
                type="button"
                onClick={(e) => handleStartRename(thread.id, thread.title, e)}
                className={`p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity ${
                  isDark
                    ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/60'
                    : 'text-zinc-400 hover:text-zinc-800 hover:bg-zinc-200'
                }`}
                title="Renomear conversa"
                aria-label="Renomear conversa"
              >
                <Pencil className="size-2.5" />
              </button>

              {/* Close Tab Button (X) */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  closeThread(thread.id);
                }}
                className={`p-0.5 rounded transition-all ${
                  isActive
                    ? 'opacity-80 hover:opacity-100'
                    : 'opacity-0 group-hover:opacity-100'
                } ${
                  isDark
                    ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/60'
                    : 'text-zinc-400 hover:text-zinc-800 hover:bg-zinc-200'
                }`}
                title="Fechar conversa"
                aria-label="Fechar conversa"
              >
                <X className="size-3" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Right Controls: Stacked Books (Library) Dropdown & New Tab (+) */}
      <div className="flex items-center gap-1 shrink-0 relative" ref={listRef}>
        {/* Livros Empilhados (Terminal style Tabs Switcher) */}
        <button
          type="button"
          onClick={() => setIsListOpen((prev) => !prev)}
          className={`p-1.5 rounded-lg border transition-all cursor-pointer shadow-xs flex items-center justify-center relative ${
            isListOpen
              ? isDark
                ? 'bg-zinc-800 border-zinc-600 text-white'
                : 'bg-zinc-200 border-zinc-400 text-zinc-950'
              : isDark
              ? 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 hover:bg-zinc-800'
              : 'bg-white border-zinc-200 text-zinc-700 hover:text-zinc-950 hover:border-zinc-300 hover:bg-zinc-50'
          }`}
          title="Ver lista de conversas abertas (estilo terminal)"
          aria-label="Ver todas as conversas abertas"
        >
          <Library className="size-3.5" />
          {threads.length > 0 && (
            <span
              className={`absolute -top-1 -right-1 text-[8px] font-mono px-1 rounded-full font-bold leading-tight ${
                isDark
                  ? 'bg-zinc-700 text-zinc-200 border border-zinc-800'
                  : 'bg-zinc-200 text-zinc-800 border border-zinc-300'
              }`}
            >
              {threads.length}
            </span>
          )}
        </button>

        {/* Add New Conversation Button (+) */}
        <button
          type="button"
          onClick={handleCreateNew}
          className={`p-1.5 rounded-lg border transition-all cursor-pointer shadow-xs flex items-center justify-center ${
            isDark
              ? 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 hover:bg-zinc-800'
              : 'bg-white border-zinc-200 text-zinc-700 hover:text-zinc-950 hover:border-zinc-300 hover:bg-zinc-50'
          }`}
          title="Nova conversa com o assistente"
          aria-label="Nova conversa com o assistente"
        >
          <Plus className="size-3.5" />
        </button>

        {/* Floating Dropdown List of Open Conversations */}
        {isListOpen && (
          <div
            className={`absolute top-full right-0 mt-1.5 w-72 border rounded-xl shadow-2xl p-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150 transition-colors ${
              isDark
                ? 'bg-[#151519] border-zinc-700 text-zinc-200 shadow-[0_16px_40px_rgba(0,0,0,0.85)]'
                : 'bg-white border-zinc-200 text-zinc-900 shadow-[0_12px_36px_rgba(0,0,0,0.18)]'
            }`}
          >
            {/* Header */}
            <div className="px-2.5 py-1.5 border-b border-zinc-700/40 mb-1.5 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Library className="size-3 text-zinc-400" />
                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
                  Conversas Abertas ({threads.length})
                </span>
              </div>
              <button
                type="button"
                onClick={handleCreateNew}
                className={`text-[10px] font-medium flex items-center gap-1 hover:underline cursor-pointer ${
                  isDark ? 'text-zinc-300 hover:text-white' : 'text-zinc-700 hover:text-zinc-950'
                }`}
              >
                <Plus className="size-2.5" /> Nova
              </button>
            </div>

            {/* Quick Search if more than 3 conversations */}
            {threads.length > 3 && (
              <div className="px-1 mb-1.5">
                <div
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs ${
                    isDark
                      ? 'bg-zinc-900/80 border-zinc-800 text-zinc-300'
                      : 'bg-zinc-50 border-zinc-200 text-zinc-800'
                  }`}
                >
                  <Search className="size-3 text-zinc-400 shrink-0" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filtrar conversas..."
                    aria-label="Filtrar conversas abertas"
                    className="w-full bg-transparent text-[10px] outline-none placeholder:text-zinc-500"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="text-zinc-400 hover:text-zinc-200"
                      aria-label="Limpar filtro"
                    >
                      <X className="size-2.5" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* List of items */}
            <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-1 py-0.5">
              {filteredThreads.map((t) => {
                const isCurrent = t.id === activeThreadId;
                return (
                  <div
                    key={t.id}
                    onClick={() => {
                      switchThread(t.id);
                      setIsListOpen(false);
                    }}
                    className={`group flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition-colors border ${
                      isCurrent
                        ? isDark
                          ? 'bg-zinc-800/90 border-zinc-700 text-white font-medium'
                          : 'bg-zinc-100 border-zinc-300 text-zinc-900 font-medium'
                        : isDark
                        ? 'bg-transparent border-transparent hover:bg-zinc-800/50 text-zinc-300'
                        : 'bg-transparent border-transparent hover:bg-zinc-100 text-zinc-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                      {getModeIcon(t.mode)}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-[11px] font-medium">{t.title}</span>
                          {isCurrent && <Check className="size-3 text-emerald-400 shrink-0" />}
                        </div>
                        <div
                          className={`text-[9px] mt-0.5 flex items-center gap-2 tabular-nums ${
                            isDark ? 'text-zinc-500' : 'text-zinc-400'
                          }`}
                        >
                          <span>{t.createdAt}</span>
                          <span>·</span>
                          <span>{t.messages.length} msgs</span>
                        </div>
                      </div>
                    </div>

                    {threads.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          closeThread(t.id);
                        }}
                        className={`p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer ${
                          isDark
                            ? 'hover:bg-zinc-700 text-zinc-400 hover:text-red-400'
                            : 'hover:bg-zinc-200 text-zinc-500 hover:text-red-600'
                        }`}
                        title="Fechar conversa"
                        aria-label="Fechar conversa"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    )}
                  </div>
                );
              })}

              {filteredThreads.length === 0 && (
                <div className="p-3 text-center text-[11px] text-zinc-500">
                  Nenhuma conversa encontrada com "{searchQuery}".
                </div>
              )}
            </div>

            {/* Bottom New Thread Button */}
            <div className="pt-1.5 mt-1 border-t border-zinc-700/30">
              <button
                type="button"
                onClick={handleCreateNew}
                className={`w-full py-1.5 px-2.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 border transition-colors cursor-pointer ${
                  isDark
                    ? 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-zinc-200 hover:text-white hover:bg-zinc-800'
                    : 'bg-zinc-50 border-zinc-200 hover:border-zinc-300 text-zinc-800 hover:bg-zinc-100'
                }`}
              >
                <Plus className="size-3" />
                <span>Nova conversa</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
