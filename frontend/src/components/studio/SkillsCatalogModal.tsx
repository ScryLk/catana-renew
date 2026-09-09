import React, { useState, useMemo, useEffect } from 'react';
import {
  Sparkles,
  X,
  Search,
  Copy,
  Check,
  CornerDownLeft,
  Play,
  Info,
} from 'lucide-react';
import { useStudioStore } from '../../store/studioStore';
import { STUDIO_SKILLS, StudioSkill } from '../../data/studioSkills';
import { toast } from 'sonner';

type RoleFilterKey = 'all' | 'captar' | 'orchestrator' | 'director' | 'copywriter' | 'commercial' | 'branding';

interface RoleFilterOption {
  key: RoleFilterKey;
  label: string;
}

const FILTER_OPTIONS: RoleFilterOption[] = [
  { key: 'all', label: 'Todas' },
  { key: 'captar', label: 'Engenharia Reversa' },
  { key: 'orchestrator', label: 'Orquestrador' },
  { key: 'director', label: 'Direção de Arte' },
  { key: 'copywriter', label: 'Redação' },
  { key: 'commercial', label: 'Comercial B2B' },
  { key: 'branding', label: 'Auditoria & Marca' },
];

export const SkillsCatalogModal: React.FC = () => {
  const {
    isSkillsModalOpen,
    setIsSkillsModalOpen,
    setPendingInputPrompt,
    addMessage,
    setAgentStatus,
    executeCopilotCommand,
    theme,
  } = useStudioStore();

  const isDark = theme === 'dark';

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<RoleFilterKey>('all');
  const [copiedSkillId, setCopiedSkillId] = useState<string | null>(null);

  // Fechar com tecla ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSkillsModalOpen) {
        setIsSkillsModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSkillsModalOpen, setIsSkillsModalOpen]);

  // Contagem por categoria
  const filterCounts = useMemo(() => {
    const counts: Record<RoleFilterKey, number> = {
      all: STUDIO_SKILLS.length,
      captar: STUDIO_SKILLS.filter((s) => s.command.startsWith('/captar')).length,
      orchestrator: STUDIO_SKILLS.filter((s) => s.roleId === 'orchestrator' && !s.command.startsWith('/captar')).length,
      director: STUDIO_SKILLS.filter((s) => s.roleId === 'director' && !s.command.startsWith('/captar')).length,
      copywriter: STUDIO_SKILLS.filter((s) => s.roleId === 'copywriter' && !s.command.startsWith('/captar')).length,
      commercial: STUDIO_SKILLS.filter((s) => s.roleId === 'commercial' && !s.command.startsWith('/captar')).length,
      branding: STUDIO_SKILLS.filter((s) => s.roleId === 'branding').length,
    };
    return counts;
  }, []);

  // Lista filtrada
  const filteredSkills = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return STUDIO_SKILLS.filter((skill) => {
      // Filtro de categoria
      if (activeFilter === 'captar') {
        if (!skill.command.startsWith('/captar')) return false;
      } else if (activeFilter !== 'all') {
        if (skill.roleId !== activeFilter) return false;
      }

      // Filtro de texto
      if (!query) return true;
      const matchCommand = skill.command.toLowerCase().includes(query);
      const matchName = skill.name.toLowerCase().includes(query);
      const matchDesc = skill.description.toLowerCase().includes(query);
      const matchRole = skill.roleBadge.toLowerCase().includes(query);
      const matchDetails = skill.details?.toLowerCase().includes(query) ?? false;
      const matchOutput = skill.outputSummary?.toLowerCase().includes(query) ?? false;

      return matchCommand || matchName || matchDesc || matchRole || matchDetails || matchOutput;
    });
  }, [searchQuery, activeFilter]);

  const handleCopyCommand = (e: React.MouseEvent, skill: StudioSkill) => {
    e.stopPropagation();
    navigator.clipboard.writeText(skill.command);
    setCopiedSkillId(skill.id);
    toast.success(`Comando ${skill.command} copiado!`);
    setTimeout(() => setCopiedSkillId(null), 1800);
  };

  const handleInsertIntoPrompt = (skill: StudioSkill) => {
    setPendingInputPrompt(skill.command + ' ');
    setIsSkillsModalOpen(false);
    toast.info(`Comando ${skill.command} inserido no chat.`);
  };

  const handleExecuteNow = (skill: StudioSkill) => {
    setIsSkillsModalOpen(false);

    addMessage({
      role: 'user',
      content: skill.defaultPrompt,
    });

    setAgentStatus('thinking');

    setTimeout(() => {
      executeCopilotCommand(skill.defaultPrompt);
      toast.success(`Habilidade ${skill.name} executada!`);
    }, 800);
  };

  const getRoleBadgeStyle = (roleId: string) => {
    if (isDark) {
      switch (roleId) {
        case 'orchestrator':
          return 'bg-zinc-800/80 text-zinc-300 border-zinc-700/80';
        case 'director':
          return 'bg-indigo-950/40 text-indigo-300 border-indigo-800/50';
        case 'copywriter':
          return 'bg-amber-950/40 text-amber-300 border-amber-800/50';
        case 'commercial':
          return 'bg-emerald-950/40 text-emerald-300 border-emerald-800/50';
        case 'branding':
          return 'bg-cyan-950/40 text-cyan-300 border-cyan-800/50';
        default:
          return 'bg-zinc-800 text-zinc-300 border-zinc-700';
      }
    } else {
      switch (roleId) {
        case 'orchestrator':
          return 'bg-zinc-100 text-zinc-700 border-zinc-300';
        case 'director':
          return 'bg-indigo-50 text-indigo-800 border-indigo-200';
        case 'copywriter':
          return 'bg-amber-50 text-amber-800 border-amber-200';
        case 'commercial':
          return 'bg-emerald-50 text-emerald-800 border-emerald-200';
        case 'branding':
          return 'bg-cyan-50 text-cyan-800 border-cyan-200';
        default:
          return 'bg-zinc-100 text-zinc-700 border-zinc-300';
      }
    }
  };

  if (!isSkillsModalOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150"
      onClick={() => setIsSkillsModalOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Catálogo de Habilidades do Estúdio"
    >
      <div
        className={`w-full max-w-5xl max-h-[90vh] rounded-2xl border shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 transition-colors ${
          isDark
            ? 'bg-[#111114] border-zinc-800 text-zinc-100 shadow-[0_25px_60px_rgba(0,0,0,0.9)]'
            : 'bg-white border-zinc-200 text-zinc-900 shadow-[0_20px_50px_rgba(0,0,0,0.15)]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className={`px-6 py-4 border-b flex items-center justify-between shrink-0 ${
            isDark ? 'border-zinc-800/80 bg-zinc-900/40' : 'border-zinc-200/80 bg-zinc-50/60'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-xl border ${
                isDark ? 'bg-zinc-800/80 border-zinc-700 text-white' : 'bg-white border-zinc-200 text-zinc-900'
              }`}
            >
              <Sparkles className="size-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold tracking-wide">
                  Catálogo de Habilidades · Skills do Estúdio
                </h3>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-mono border ${
                    isDark ? 'bg-zinc-800 text-zinc-400 border-zinc-700' : 'bg-zinc-100 text-zinc-600 border-zinc-200'
                  }`}
                >
                  {STUDIO_SKILLS.length} ativas
                </span>
              </div>
              <p className={`text-xs mt-0.5 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                Enciclopédia e guia de execução das capacidades dos agentes de design, redação e estratégia comercial.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsSkillsModalOpen(false)}
            className={`p-2 rounded-lg transition-colors cursor-pointer ${
              isDark
                ? 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                : 'hover:bg-zinc-200 text-zinc-500 hover:text-zinc-900'
            }`}
            title="Fechar (Esc)"
            aria-label="Fechar modal"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Controls: Search & Role Filter Tabs */}
        <div
          className={`p-4 border-b space-y-3 shrink-0 ${
            isDark ? 'border-zinc-800/80 bg-zinc-900/20' : 'border-zinc-200/80 bg-zinc-50/30'
          }`}
        >
          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar habilidade por comando (ex: /captar, /markup), nome ou efeito no catálogo..."
              className={`w-full pl-9 pr-9 py-2 rounded-xl text-xs border outline-none transition-all ${
                isDark
                  ? 'bg-zinc-900/90 border-zinc-800 text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-600 focus:bg-zinc-900'
                  : 'bg-white border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400'
              }`}
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-zinc-400 hover:text-zinc-200"
                aria-label="Limpar busca"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs">
            {FILTER_OPTIONS.map((opt) => {
              const isSelected = activeFilter === opt.key;
              const count = filterCounts[opt.key];

              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setActiveFilter(opt.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap border transition-all cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? isDark
                        ? 'bg-white text-zinc-950 border-white font-semibold'
                        : 'bg-zinc-900 text-white border-zinc-900 font-semibold'
                      : isDark
                      ? 'bg-zinc-900/60 border-zinc-800/80 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                      : 'bg-white border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
                  }`}
                >
                  <span>{opt.label}</span>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                      isSelected
                        ? isDark
                          ? 'bg-zinc-200 text-zinc-900'
                          : 'bg-zinc-800 text-zinc-100'
                        : isDark
                        ? 'bg-zinc-800/80 text-zinc-500'
                        : 'bg-zinc-100 text-zinc-500'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Skills Cards Grid */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-5">
          {filteredSkills.length === 0 ? (
            <div
              className={`text-center py-16 px-4 rounded-xl border border-dashed ${
                isDark ? 'border-zinc-800 text-zinc-500' : 'border-zinc-200 text-zinc-400'
              }`}
            >
              <Search className="size-8 mx-auto mb-3 opacity-30" />
              <p className="text-xs font-medium text-inherit">Nenhuma habilidade encontrada para a busca.</p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setActiveFilter('all');
                }}
                className={`mt-3 text-xs underline cursor-pointer ${
                  isDark ? 'text-zinc-300 hover:text-white' : 'text-zinc-700 hover:text-zinc-950'
                }`}
              >
                Limpar filtros e ver todas as {STUDIO_SKILLS.length} habilidades
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredSkills.map((skill) => {
                const isCopied = copiedSkillId === skill.id;

                return (
                  <div
                    key={skill.id}
                    className={`rounded-xl border p-4 flex flex-col justify-between transition-all ${
                      isDark
                        ? 'bg-zinc-900/40 border-zinc-800/90 hover:border-zinc-700 hover:bg-zinc-900/70'
                        : 'bg-white border-zinc-200 hover:border-zinc-300 hover:shadow-2xs'
                    }`}
                  >
                    <div>
                      {/* Top Row: Command pill & Role Badge */}
                      <div className="flex items-center justify-between gap-2 mb-2.5">
                        <div className="flex items-center gap-1.5">
                          <code
                            className={`font-mono text-xs px-2 py-0.5 rounded border font-semibold select-all ${
                              isDark
                                ? 'bg-zinc-950 text-zinc-200 border-zinc-700/80'
                                : 'bg-zinc-100 text-zinc-900 border-zinc-300'
                            }`}
                          >
                            {skill.command}
                          </code>

                          <button
                            type="button"
                            onClick={(e) => handleCopyCommand(e, skill)}
                            className={`p-1 rounded text-zinc-400 transition-colors cursor-pointer ${
                              isDark ? 'hover:text-zinc-100 hover:bg-zinc-800' : 'hover:text-zinc-900 hover:bg-zinc-200'
                            }`}
                            title="Copiar comando"
                            aria-label="Copiar comando"
                          >
                            {isCopied ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                          </button>
                        </div>

                        <span
                          className={`text-[10px] font-medium uppercase font-mono px-2 py-0.5 rounded-full border ${getRoleBadgeStyle(
                            skill.roleId
                          )}`}
                        >
                          {skill.roleBadge}
                        </span>
                      </div>

                      {/* Title & Description */}
                      <h4 className="text-xs font-semibold tracking-tight text-inherit mb-1">
                        {skill.name}
                      </h4>
                      <p
                        className={`text-[11px] leading-relaxed mb-3 ${
                          isDark ? 'text-zinc-400' : 'text-zinc-600'
                        }`}
                      >
                        {skill.description}
                      </p>

                      {/* Deep Details Box */}
                      {skill.details && (
                        <div
                          className={`p-2.5 rounded-lg text-[11px] leading-relaxed mb-3 border ${
                            isDark
                              ? 'bg-zinc-950/60 border-zinc-800/80 text-zinc-300'
                              : 'bg-zinc-50 border-zinc-200/80 text-zinc-700'
                          }`}
                        >
                          <div className="flex items-start gap-1.5">
                            <Info className="size-3 text-zinc-400 shrink-0 mt-0.5" />
                            <span>{skill.details}</span>
                          </div>

                          {skill.parametersHint && (
                            <div className="mt-2 pt-2 border-t border-inherit flex items-center gap-1.5 text-[10px] font-mono text-zinc-400">
                              <span className="font-semibold text-zinc-500 uppercase tracking-wider">Parâmetros:</span>
                              <span className="text-zinc-300">{skill.parametersHint}</span>
                            </div>
                          )}

                          {skill.outputSummary && (
                            <div className="mt-1.5 text-[10px] text-zinc-400 flex items-start gap-1">
                              <span className="font-semibold text-zinc-500 uppercase tracking-wider font-mono shrink-0">Saída:</span>
                              <span className="text-zinc-400">{skill.outputSummary}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Example Prompt */}
                      <div
                        className={`px-2.5 py-1.5 rounded-md text-[10px] font-mono flex items-center justify-between gap-2 border mb-3.5 ${
                          isDark
                            ? 'bg-zinc-950/40 border-zinc-800/50 text-zinc-400'
                            : 'bg-zinc-50 border-zinc-200 text-zinc-500'
                        }`}
                      >
                        <span className="truncate">
                          Ex: {skill.exampleUsage || skill.defaultPrompt}
                        </span>
                      </div>
                    </div>

                    {/* Card Actions Footer */}
                    <div
                      className={`pt-2.5 border-t flex items-center justify-between gap-2 ${
                        isDark ? 'border-zinc-800/60' : 'border-zinc-200/60'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleInsertIntoPrompt(skill)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-all cursor-pointer ${
                          isDark
                            ? 'bg-zinc-800/70 hover:bg-zinc-800 border-zinc-700/80 text-zinc-200 hover:text-white'
                            : 'bg-zinc-100 hover:bg-zinc-200 border-zinc-200 text-zinc-800 hover:text-zinc-950'
                        }`}
                        title="Inserir comando na caixa de mensagem"
                      >
                        <CornerDownLeft className="size-3 text-zinc-400" />
                        <span>Inserir no Chat</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleExecuteNow(skill)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer shadow-xs ${
                          isDark
                            ? 'bg-zinc-100 hover:bg-white text-zinc-950 font-semibold'
                            : 'bg-zinc-900 hover:bg-zinc-800 text-white font-semibold'
                        }`}
                        title="Executar imediatamente com os parâmetros padrão"
                      >
                        <Play className="size-2.5 fill-current" />
                        <span>Executar</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Info Strip */}
        <div
          className={`px-6 py-2.5 border-t flex items-center justify-between text-[11px] shrink-0 ${
            isDark ? 'border-zinc-800/80 bg-zinc-950/40 text-zinc-400' : 'border-zinc-200/80 bg-zinc-50/80 text-zinc-500'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
              Dica de Invocação:
            </span>
            <span>
              Digite <kbd className="px-1.5 py-0.5 rounded font-mono text-[10px] border border-inherit bg-zinc-800/20">/</kbd> diretamente no chat para abrir a barra de preenchimento rápido.
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-3 text-zinc-500">
            <span>Pressione <kbd className="px-1 py-0.5 rounded font-mono text-[10px] border border-inherit">Esc</kbd> para fechar</span>
          </div>
        </div>
      </div>
    </div>
  );
};
