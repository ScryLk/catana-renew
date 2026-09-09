import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Plus, History, ChevronDown, Check, Trash2, Settings2, Users, Scale, Palette, Lock, Unlock } from 'lucide-react';
import { ExecutionPlanCard } from './ExecutionPlanCard';
import { AgentChatStream } from './AgentChatStream';
import { AgentInputBar } from './AgentInputBar';
import { ConversationTabBar } from './ConversationTabBar';
import { RoleManagerModal } from './RoleManagerModal';
import { EditorialCouncilModal } from './EditorialCouncilModal';
import { PaletteManagerModal } from './PaletteManagerModal';
import { SkillsCatalogModal } from './SkillsCatalogModal';
import { useStudioStore } from '../../store/studioStore';
import { toast } from 'sonner';

export const AgentCoPilot: React.FC = () => {
  const {
    roles,
    activeRoleId,
    setActiveRole,
    setRoleEnabled,
    setIsRoleManagerOpen,
    setIsCouncilModalOpen,
    activePalette,
    setIsPalettePanelOpen,
    setPaletteLocked,
    theme,
    threads,
    activeThreadId,
    createThread,
    switchThread,
    closeThread,
  } = useStudioStore();

  const isDark = theme === 'dark';
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const historyRef = useRef<HTMLDivElement>(null);
  const roleDropdownRef = useRef<HTMLDivElement>(null);

  const activeRole = roles.find((r) => r.id === activeRoleId) || roles[0];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (historyRef.current && !historyRef.current.contains(e.target as Node)) {
        setIsHistoryOpen(false);
      }
      if (roleDropdownRef.current && !roleDropdownRef.current.contains(e.target as Node)) {
        setIsRoleDropdownOpen(false);
      }
    };
    if (isHistoryOpen || isRoleDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isHistoryOpen, isRoleDropdownOpen]);

  const handleCreateNewThread = () => {
    createThread();
    setIsHistoryOpen(false);
    toast.success('Nova conversa iniciada!');
  };

  return (
    <aside
      className={`w-[420px] max-w-[460px] min-w-[360px] h-full flex flex-col border-r select-none transition-colors ${
        isDark
          ? 'bg-[#0e0e11] border-zinc-800 text-zinc-300'
          : 'bg-[#fcfcfd] border-zinc-200 text-zinc-700'
      }`}
    >
      {/* Persona Mode & Session Header */}
      <div
        className={`h-11 px-3 border-b flex items-center justify-between text-xs transition-colors relative ${
          isDark ? 'border-zinc-800 text-zinc-300' : 'border-zinc-200 text-zinc-700'
        }`}
      >
        <div className="flex items-center gap-1.5">
          <div className="relative" ref={roleDropdownRef}>
            <button
              type="button"
              onClick={() => setIsRoleDropdownOpen((prev) => !prev)}
              className={`flex items-center gap-2 font-medium px-2.5 py-1 rounded-md border transition-colors cursor-pointer ${
                isRoleDropdownOpen
                  ? isDark
                    ? 'bg-zinc-800 border-zinc-700 text-white'
                    : 'bg-zinc-100 border-zinc-300 text-zinc-950 shadow-xs'
                  : isDark
                  ? 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-zinc-200'
                  : 'bg-white border-zinc-200 hover:border-zinc-300 text-zinc-800 shadow-sm'
              }`}
              aria-label="Cargo e diretrizes do assistente"
              aria-expanded={isRoleDropdownOpen}
            >
              <Sparkles className="size-3.5 text-zinc-400" />
              <span className="truncate max-w-[140px]">{activeRole?.name || 'Diretor de Arte'}</span>
              <ChevronDown
                className={`size-3 text-zinc-400 shrink-0 transition-transform duration-150 ${
                  isRoleDropdownOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Dropdown Menu */}
            {isRoleDropdownOpen && (
              <div
                className={`absolute top-full left-0 mt-1.5 w-64 border rounded-xl shadow-2xl py-1 z-50 animate-in fade-in slide-in-from-top-2 duration-150 transition-colors ${
                  isDark
                    ? 'bg-[#16161a] border-zinc-700 text-zinc-200 shadow-[0_12px_36px_rgba(0,0,0,0.8)]'
                    : 'bg-white border-zinc-200 text-zinc-900 shadow-[0_8px_30px_rgba(0,0,0,0.15)]'
                }`}
              >
                <div className="px-3 py-1.5 border-b border-inherit">
                  <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-400 font-medium">
                    Cargos do Assistente
                  </span>
                </div>

                <div className="max-h-56 overflow-y-auto custom-scrollbar py-0.5">
                  {roles.map((role) => {
                    const isSelected = role.id === activeRoleId;
                    return (
                      <button
                        key={role.id}
                        type="button"
                        onClick={() => {
                          if (role.enabled === false) {
                            setRoleEnabled(role.id, true);
                            toast.success(`Cargo "${role.name}" foi ativado e selecionado!`);
                          }
                          setActiveRole(role.id);
                          setIsRoleDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 text-xs transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                          isSelected
                            ? isDark
                              ? 'bg-zinc-800 text-white font-medium'
                              : 'bg-zinc-100 text-zinc-950 font-medium'
                            : isDark
                            ? 'hover:bg-zinc-800/60 hover:text-white text-zinc-300'
                            : 'hover:bg-zinc-100/80 hover:text-zinc-900 text-zinc-700'
                        }`}
                      >
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`truncate text-[11px] font-medium ${
                                role.enabled === false
                                  ? 'text-zinc-500 line-through decoration-zinc-600'
                                  : ''
                              }`}
                            >
                              {role.name}
                            </span>
                            {role.enabled === false && (
                              <span className="text-[8px] font-mono uppercase px-1 py-0.2 rounded bg-zinc-800 text-zinc-500 border border-zinc-700">
                                Desativado
                              </span>
                            )}
                          </div>
                          <span
                            className={`text-[9px] truncate ${
                              isDark ? 'text-zinc-500' : 'text-zinc-400'
                            }`}
                          >
                            {role.badge} · {role.isCustom ? 'Personalizado' : 'Padrão'}
                          </span>
                        </div>
                        {isSelected && <Check className="size-3 text-emerald-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>

                <div className={`border-t my-1 ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`} />

                <button
                  type="button"
                  onClick={() => {
                    setIsRoleManagerOpen(true);
                    setIsRoleDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs transition-colors cursor-pointer flex items-center gap-2 ${
                    isDark
                      ? 'hover:bg-zinc-800 text-zinc-300 hover:text-white'
                      : 'hover:bg-zinc-100 text-zinc-700 hover:text-zinc-950'
                  }`}
                >
                  <Settings2 className="size-3.5 text-zinc-400" />
                  <span className="font-medium text-[11px]">Gerenciar Cargos e Diretrizes...</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIsCouncilModalOpen(true)}
            className={`p-1.5 rounded transition-colors cursor-pointer ${
              isDark
                ? 'hover:text-white hover:bg-zinc-800 text-zinc-400'
                : 'hover:text-zinc-950 hover:bg-zinc-100 text-zinc-500'
            }`}
            title="Conselho Editorial (Mesa Redonda)"
            aria-label="Conselho Editorial (Mesa Redonda)"
          >
            <Scale className="size-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setIsRoleManagerOpen(true)}
            className={`p-1.5 rounded transition-colors cursor-pointer ${
              isDark
                ? 'hover:text-white hover:bg-zinc-800 text-zinc-400'
                : 'hover:text-zinc-950 hover:bg-zinc-100 text-zinc-500'
            }`}
            title="Gerenciar Agentes e Cargos"
            aria-label="Gerenciar Agentes e Cargos"
          >
            <Users className="size-3.5" />
          </button>

          <button
            type="button"
            onClick={handleCreateNewThread}
            className={`p-1.5 rounded transition-colors cursor-pointer ${
              isDark
                ? 'hover:text-white hover:bg-zinc-800 text-zinc-400'
                : 'hover:text-zinc-950 hover:bg-zinc-100 text-zinc-500'
            }`}
            title="Nova conversa (adicionar aba)"
            aria-label="Nova conversa"
          >
            <Plus className="size-3.5" />
          </button>

          <div className="relative" ref={historyRef}>
            <button
              type="button"
              onClick={() => setIsHistoryOpen((prev) => !prev)}
              className={`p-1.5 rounded transition-colors cursor-pointer ${
                isHistoryOpen
                  ? isDark
                    ? 'bg-zinc-800 text-white'
                    : 'bg-zinc-200 text-zinc-950'
                  : isDark
                  ? 'hover:text-white hover:bg-zinc-800 text-zinc-400'
                  : 'hover:text-zinc-950 hover:bg-zinc-100 text-zinc-500'
              }`}
              title="Histórico de conversas"
              aria-label="Histórico de conversas"
            >
              <History className="size-3.5" />
            </button>

            {/* Floating History Dropdown */}
            {isHistoryOpen && (
              <div
                className={`absolute top-full right-0 mt-1.5 w-68 border rounded-xl shadow-2xl p-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150 transition-colors ${
                  isDark
                    ? 'bg-[#151519] border-zinc-700 text-zinc-200 shadow-[0_12px_36px_rgba(0,0,0,0.8)]'
                    : 'bg-white border-zinc-200 text-zinc-900 shadow-[0_8px_30px_rgba(0,0,0,0.15)]'
                }`}
              >
                <div className="px-2.5 py-1.5 border-b border-zinc-700/40 mb-1 flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-medium">
                    Conversas Ativas ({threads.length})
                  </span>
                  <button
                    type="button"
                    onClick={handleCreateNewThread}
                    className={`text-[10px] font-medium flex items-center gap-1 hover:underline cursor-pointer ${
                      isDark ? 'text-zinc-300 hover:text-white' : 'text-zinc-700 hover:text-zinc-950'
                    }`}
                  >
                    <Plus className="size-2.5" /> Nova
                  </button>
                </div>

                <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-1 py-0.5">
                  {threads.map((t) => {
                    const isCurrent = t.id === activeThreadId;
                    return (
                      <div
                        key={t.id}
                        onClick={() => {
                          switchThread(t.id);
                          setIsHistoryOpen(false);
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
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-[11px] font-medium">{t.title}</span>
                            {isCurrent && <Check className="size-3 text-emerald-400 shrink-0" />}
                          </div>
                          <div
                            className={`text-[10px] mt-0.5 flex items-center gap-2 ${
                              isDark ? 'text-zinc-500' : 'text-zinc-400'
                            }`}
                          >
                            <span>{t.createdAt}</span>
                            <span>·</span>
                            <span>{t.messages.length} msgs</span>
                          </div>
                        </div>

                        {threads.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              closeThread(t.id);
                            }}
                            className={`p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity ${
                              isDark
                                ? 'hover:bg-zinc-700 text-zinc-400 hover:text-red-400'
                                : 'hover:bg-zinc-200 text-zinc-500 hover:text-red-600'
                            }`}
                            title="Excluir conversa"
                            aria-label="Excluir conversa"
                          >
                            <Trash2 className="size-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Multi-Conversation Tabs Bar */}
      <ConversationTabBar />

      {/* Brand & Palette Quick Strip */}
      <div
        className={`mx-3 mt-2 px-2.5 py-1.5 rounded-lg border text-xs flex items-center justify-between transition-colors ${
          isDark
            ? 'bg-[#121215] border-zinc-800 text-zinc-300'
            : 'bg-zinc-50 border-zinc-200 text-zinc-700'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => setIsPalettePanelOpen(true)}
            className="flex items-center gap-1.5 hover:underline cursor-pointer min-w-0"
            title="Abrir painel de tokens de cor e design system"
          >
            <Palette className="size-3 text-zinc-400 shrink-0" />
            <span className="font-medium truncate max-w-[130px] text-[11px]">{activePalette.name}</span>
          </button>
          <div className="flex items-center gap-1 shrink-0">
            <span
              className="size-2 rounded-full border border-black/20"
              style={{ backgroundColor: activePalette.primary }}
              title={`Dominante: ${activePalette.primary}`}
            />
            <span
              className="size-2 rounded-full border border-black/20"
              style={{ backgroundColor: activePalette.background }}
              title={`Fundo: ${activePalette.background}`}
            />
            <span
              className="size-2 rounded-full border border-black/20"
              style={{ backgroundColor: activePalette.accent }}
              title={`Acento: ${activePalette.accent}`}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            const next = !activePalette.locked;
            setPaletteLocked(next);
            toast(next ? 'Trava de Marca ativada.' : 'Trava de Marca desativada.');
          }}
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono border transition-colors cursor-pointer shrink-0 ${
            activePalette.locked
              ? isDark
                ? 'bg-amber-950/60 text-amber-300 border-amber-800/80 hover:bg-amber-900/60'
                : 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200'
              : isDark
              ? 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
              : 'bg-white text-zinc-600 border-zinc-200 hover:text-zinc-900 shadow-2xs'
          }`}
          title={activePalette.locked ? 'Brand Lock ativo: agentes restritos' : 'Modo flexível: clique para travar'}
        >
          {activePalette.locked ? (
            <>
              <Lock className="size-2.5 text-amber-400" />
              <span>Travada</span>
            </>
          ) : (
            <>
              <Unlock className="size-2.5 text-zinc-400" />
              <span>Flexível</span>
            </>
          )}
        </button>
      </div>

      {/* Execution Plan Card */}
      <ExecutionPlanCard />

      {/* Chat Stream Feed */}
      <AgentChatStream />

      {/* Prompt Bar */}
      <AgentInputBar />

      {/* Roles & Guidelines Management Modal */}
      <RoleManagerModal />

      {/* Editorial Council / Mesa Redonda Modal */}
      <EditorialCouncilModal />

      {/* Design Tokens & Color Palette Modal */}
      <PaletteManagerModal />

      {/* Skills Catalog Modal */}
      <SkillsCatalogModal />
    </aside>
  );
};
