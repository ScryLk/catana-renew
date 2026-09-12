import React, { useRef, useEffect } from 'react';
import {
  Sparkles,
  BrainCircuit,
  Users,
  FileText,
  FileSpreadsheet,
  FileImage,
  ShieldCheck,
  Cpu,
  ArrowRight,
  CheckCircle2,
  ThumbsUp,
  ThumbsDown,
  ChevronDown,
} from 'lucide-react';
import { useStudioStore } from '../../store/studioStore';
import { toast } from 'sonner';

interface TypewriterTextProps {
  text: string;
  isStreaming?: boolean;
  isCompleted?: boolean;
  onAnimationEnd?: () => void;
  className?: string;
}

const TypewriterText: React.FC<TypewriterTextProps> = ({
  text,
  isStreaming = false,
  isCompleted = false,
  onAnimationEnd,
  className = '',
}) => {
  const [displayedChars, setDisplayedChars] = React.useState(() =>
    isCompleted ? text.length : 0
  );

  React.useEffect(() => {
    if (isCompleted) {
      setDisplayedChars(text.length);
      return;
    }

    if (isStreaming) {
      setDisplayedChars(text.length);
      return;
    }

    if (displayedChars >= text.length) {
      onAnimationEnd?.();
      return;
    }

    // Ritmo adaptativo de digitacao (300ms a 750ms total)
    const remaining = text.length - displayedChars;
    const step = Math.max(1, Math.ceil(remaining / 14));

    const timer = setTimeout(() => {
      setDisplayedChars((prev) => {
        const next = Math.min(prev + step, text.length);
        if (next >= text.length) {
          onAnimationEnd?.();
        }
        return next;
      });
    }, 18);

    return () => clearTimeout(timer);
  }, [displayedChars, text.length, isStreaming, isCompleted, onAnimationEnd]);

  const visibleText = text.slice(0, displayedChars);
  const isTyping = !isCompleted && (isStreaming || displayedChars < text.length);

  const renderFormatted = (str: string) => {
    const parts = str.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
        return (
          <strong key={i} className="font-semibold text-inherit">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('**')) {
        return <span key={i}>{part.slice(2)}</span>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <p
      className={`whitespace-pre-line text-pretty cursor-text ${className}`}
      onClick={() => {
        if (displayedChars < text.length) {
          setDisplayedChars(text.length);
          onAnimationEnd?.();
        }
      }}
    >
      {renderFormatted(visibleText)}
      {isTyping && (
        <span
          aria-hidden="true"
          className="inline-block w-1.5 h-3.5 ml-0.5 bg-[#B08D57] animate-pulse align-middle rounded-xs"
        />
      )}
    </p>
  );
};

export const AgentChatStream: React.FC = () => {
  const {
    messages,
    theme,
    roles,
    activeRoleId,
    addMessage,
    setAgentStatus,
    agentStatus,
    executeCopilotCommand,
    setIsRoleManagerOpen,
    toggleRoleEnabled,
    setRoleEnabled,
    setActivePalette,
    setIsPalettePanelOpen,
    activePalette,
    setMessageFeedback,
  } = useStudioStore();
  const bottomRef = useRef<HTMLDivElement>(null);

  const isDark = theme === 'dark';

  const activeRole = roles.find((r) => r.id === activeRoleId) || roles[0];
  const activeChips =
    activeRole?.starterChips && activeRole.starterChips.length > 0
      ? activeRole.starterChips
      : [
          'Ajustar contrastes e filetes da capa',
          'Aumentar o respiro negativo no fólio',
          'Harmonizar paleta cromática da coleção',
        ];

  // Garante que a mensagem nativa de boas-vindas do sistema/geracao fique no topo, com mensagens do usuario abaixo
  const displayMessages = React.useMemo(() => {
    if (messages.length >= 2) {
      const firstIsUser = messages[0].role === 'user';
      const secondIsWelcome =
        messages[1].role === 'assistant' &&
        (messages[1].id === 'msg-2' ||
          messages[1].id === 'msg-welcome' ||
          messages[1].content.includes('gerado e diagramado com sucesso!'));

      if (firstIsUser && secondIsWelcome) {
        return [messages[1], messages[0], ...messages.slice(2)];
      }
    }
    return messages;
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [displayMessages]);

  const initialIdsRef = useRef<Set<string> | null>(null);
  const [completedMessageIds, setCompletedMessageIds] = React.useState<Set<string>>(() => new Set());
  const [expandedOpinions, setExpandedOpinions] = React.useState<Record<string, boolean>>({});
  const [feedbacks, setFeedbacks] = React.useState<Record<string, 'like' | 'dislike' | null>>({});

  useEffect(() => {
    if (!initialIdsRef.current && messages.length > 0) {
      const existingIds = new Set(messages.map((m) => m.id));
      initialIdsRef.current = existingIds;
      setCompletedMessageIds(existingIds);
    }
  }, [messages]);

  const markMessageCompleted = React.useCallback((id: string) => {
    setCompletedMessageIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const toggleOpinions = (msgId: string) => {
    setExpandedOpinions((prev) => ({
      ...prev,
      [msgId]: !prev[msgId],
    }));
  };

  const handleFeedback = (msgId: string, type: 'like' | 'dislike') => {
    const current = feedbacks[msgId];
    const next = current === type ? null : type;
    setFeedbacks((prev) => ({ ...prev, [msgId]: next }));
    setMessageFeedback(msgId, next);

    if (next === 'like') {
      toast.success('Resposta avaliada como positiva.', {
        description: 'Anotamos sua avaliação para calibrar os especialistas do conselho.',
      });
    } else if (next === 'dislike') {
      toast.info('Resposta avaliada como negativa.', {
        description: 'Registramos seu feedback para aprimorar os ajustes futuros.',
      });
    } else {
      toast.info('Avaliação removida.');
    }
  };

  const latestAssistantMsgId = React.useMemo(() => {
    for (let i = displayMessages.length - 1; i >= 0; i--) {
      if (displayMessages[i].role === 'assistant') {
        return displayMessages[i].id;
      }
    }
    return null;
  }, [displayMessages]);

  const cleanMessageContent = (content: string) => {
    return content
      .replace(/```(?:json:patch|json)?[\s\S]*?```/g, '')
      .trim();
  };

  const handleChipClick = (chipText: string) => {
    addMessage({
      role: 'user',
      content: chipText,
    });
    setAgentStatus('thinking');
    setTimeout(() => {
      executeCopilotCommand(chipText);
    }, 900);
  };

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-4 space-y-4 text-xs select-text">
      {displayMessages.length === 0 && (
        <div className="h-full flex flex-col items-center justify-center text-center p-4 space-y-3">
          <div
            className={`size-10 rounded-2xl border flex items-center justify-center transition-colors ${
              isDark
                ? 'bg-zinc-900 border-zinc-800 text-zinc-300'
                : 'bg-zinc-100 border-zinc-200 text-zinc-700'
            }`}
          >
            <Sparkles className="size-5" />
          </div>
          <div>
            <h4 className="font-semibold text-xs">Nova Conversa Aberta</h4>
            <div className="mt-1 flex items-center justify-center gap-1.5">
              <span
                className={`text-[10px] px-2 py-0.5 rounded-md font-mono uppercase tracking-wider ${
                  isDark ? 'bg-zinc-900 text-zinc-400 border border-zinc-800' : 'bg-zinc-100 text-zinc-600 border border-zinc-200'
                }`}
              >
                {activeRole?.name || 'Diretor de Arte'}
              </span>
            </div>
            <p className={`text-[11px] mt-1.5 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
              Envie uma instrução para o assistente ou clique em uma das sugestões abaixo:
            </p>
          </div>
          <div className="w-full space-y-1.5 pt-2">
            {activeChips.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => handleChipClick(chip)}
                className={`w-full text-left text-[11px] p-2.5 rounded-xl border transition-all cursor-pointer shadow-2xs ${
                  isDark
                    ? 'bg-zinc-900/60 border-zinc-800/80 hover:border-zinc-700 text-zinc-300 hover:text-zinc-100'
                    : 'bg-zinc-50 border-zinc-200 hover:border-zinc-300 text-zinc-700 hover:text-zinc-950'
                }`}
              >
                {chip}
              </button>
            ))}
          </div>
        </div>
      )}

      {displayMessages.map((msg) => {
        const isUser = msg.role === 'user';

        if (isUser) {
          return (
            <div key={msg.id} className="flex justify-end">
              <div
                className={`max-w-[85%] rounded-2xl rounded-tr-sm px-3.5 py-2.5 shadow-sm transition-colors border ${
                  isDark
                    ? 'bg-zinc-800 border-zinc-700/80 text-zinc-100'
                    : 'bg-zinc-100 border-zinc-200 text-zinc-900'
                }`}
              >
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {msg.attachments.map((att) => (
                      <div
                        key={att.id}
                        className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-mono border ${
                          isDark
                            ? 'bg-zinc-900/90 border-zinc-700 text-zinc-200'
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
                        <span className="truncate max-w-[140px] font-medium">{att.name}</span>
                        <span className={`text-[9px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                          ({att.size})
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <p className="leading-relaxed font-normal text-pretty">{msg.content}</p>
                <div
                  className={`mt-1 text-[10px] text-right tabular-nums ${
                    isDark ? 'text-zinc-400' : 'text-zinc-500'
                  }`}
                >
                  Você · {msg.timestamp}
                </div>
              </div>
            </div>
          );
        }

        return (
          <div key={msg.id} className="flex items-start gap-2.5 max-w-[95%]">
            {/* Assistant Avatar */}
            <div
              className={`size-6 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                isDark
                  ? 'bg-zinc-800 border-zinc-700 text-zinc-300'
                  : 'bg-zinc-200 border-zinc-300 text-zinc-800'
              }`}
            >
              <Sparkles className="size-3" />
            </div>

            {/* Assistant Message Content */}
            <div className="flex-1 space-y-2">
              <div
                className={`rounded-2xl rounded-tl-sm p-3 leading-relaxed border shadow-sm transition-colors ${
                  isDark
                    ? 'bg-[#151518] border-zinc-800 text-zinc-200'
                    : 'bg-white border-zinc-200 text-zinc-800'
                }`}
              >
                <TypewriterText
                  text={cleanMessageContent(msg.content)}
                  isStreaming={msg.id === latestAssistantMsgId && agentStatus === 'generating'}
                  isCompleted={completedMessageIds.has(msg.id)}
                  onAnimationEnd={() => markMessageCompleted(msg.id)}
                />

                {/* Alerta Intuitivo de Acao Operacional Executada */}
                {msg.actions && msg.actions.length > 0 && (
                  <div
                    className={`mt-2.5 p-2.5 rounded-xl border flex items-start gap-2.5 transition-all ${
                      isDark
                        ? 'bg-[#181614] border-[#B08D57]/30 text-zinc-200'
                        : 'bg-[#FDFBF7] border-[#B08D57]/40 text-zinc-900'
                    }`}
                  >
                    <div className="size-5 rounded-full bg-[#B08D57]/20 border border-[#B08D57]/40 flex items-center justify-center shrink-0 mt-0.5">
                      <CheckCircle2 className="size-3 text-[#B08D57]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-[#B08D57] font-semibold">
                          Ação Editorial Executada
                        </span>
                        <span className="text-[9px] font-mono text-zinc-400">
                          Sincronizado
                        </span>
                      </div>
                      <div className="mt-1 space-y-1">
                        {msg.actions.map((act, idx) => (
                          <div key={idx} className="flex items-start gap-1.5 text-[11px] font-medium leading-snug">
                            <span className="text-[#B08D57] font-mono text-xs shrink-0">•</span>
                            <span>{act}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Captured Brand Dossier & Agents Suite */}
                {msg.capturedDossier && (
                  <div
                    className={`mt-3 pt-2.5 border-t space-y-2.5 p-3 rounded-xl text-xs transition-colors ${
                      isDark ? 'border-zinc-800 bg-[#121316]' : 'border-zinc-200 bg-zinc-50'
                    }`}
                  >
                    {/* Dossier Header */}
                    <div className="flex items-center justify-between pb-2 border-b border-inherit">
                      <div className="flex items-center gap-1.5">
                        <ShieldCheck className="size-3.5 text-zinc-300" />
                        <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-300 font-semibold">
                          Dossiê de Marca & Gabinete de Agentes
                        </span>
                      </div>
                      <span
                        className={`px-1.5 py-0.2 rounded text-[9px] font-mono uppercase ${
                          isDark ? 'bg-zinc-800 text-zinc-400 border border-zinc-700' : 'bg-zinc-200 text-zinc-600'
                        }`}
                      >
                        {msg.capturedDossier.sourceDocument}
                      </span>
                    </div>

                    {/* Brand Title and Palette */}
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div
                        className={`p-2 rounded-lg border ${
                          isDark ? 'bg-zinc-900/80 border-zinc-800 text-zinc-300' : 'bg-white border-zinc-200 text-zinc-700'
                        }`}
                      >
                        <span className="text-[9px] font-mono uppercase text-zinc-500 block mb-1">
                          Paleta Cromática Captada
                        </span>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <div
                            className="size-4 rounded-full border border-white/20 shadow-2xs shrink-0"
                            style={{ backgroundColor: msg.capturedDossier.palette.background }}
                            title="Fundo"
                          />
                          <div
                            className="size-4 rounded-full border border-white/20 shadow-2xs shrink-0"
                            style={{ backgroundColor: msg.capturedDossier.palette.primary }}
                            title="Texto Primário"
                          />
                          <div
                            className="size-4 rounded-full border border-white/20 shadow-2xs shrink-0"
                            style={{ backgroundColor: msg.capturedDossier.palette.accent }}
                            title="Acento"
                          />
                          <span className="font-mono text-[10px] truncate">{msg.capturedDossier.palette.name}</span>
                        </div>
                        <span className="text-[9px] font-mono text-zinc-400 block mb-1.5">
                          Contraste: {msg.capturedDossier.palette.contrastRatio}
                        </span>
                        <div className="pt-1.5 border-t border-inherit flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => {
                              setActivePalette(
                                {
                                  name: msg.capturedDossier!.palette.name,
                                  background: msg.capturedDossier!.palette.background,
                                  primary: msg.capturedDossier!.palette.primary,
                                  accent: msg.capturedDossier!.palette.accent,
                                  contrastRatio: msg.capturedDossier!.palette.contrastRatio,
                                  locked: activePalette.locked,
                                },
                                true
                              );
                              toast.success(`Paleta "${msg.capturedDossier!.palette.name}" aplicada à prancheta!`);
                            }}
                            className={`text-[10px] font-medium transition-colors cursor-pointer hover:underline ${
                              isDark ? 'text-zinc-200' : 'text-zinc-800'
                            }`}
                          >
                            Aplicar Paleta
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsPalettePanelOpen(true)}
                            className={`text-[10px] transition-colors cursor-pointer hover:underline ${
                              isDark ? 'text-zinc-400' : 'text-zinc-500'
                            }`}
                          >
                            Ver Tokens
                          </button>
                        </div>
                      </div>

                      <div
                        className={`p-2 rounded-lg border ${
                          isDark ? 'bg-zinc-900/80 border-zinc-800 text-zinc-300' : 'bg-white border-zinc-200 text-zinc-700'
                        }`}
                      >
                        <span className="text-[9px] font-mono uppercase text-zinc-500 block mb-1">
                          Tipografia & Escala
                        </span>
                        <div className="text-[11px] font-medium truncate mb-0.5">
                          {msg.capturedDossier.typography.heading}
                        </div>
                        <span className="text-[9px] text-zinc-400 block truncate">
                          {msg.capturedDossier.typography.body}
                        </span>
                      </div>
                    </div>

                    {/* Configured Roles Suite */}
                    <div className="pt-1 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold flex items-center gap-1">
                          <Cpu className="size-3" />
                          Agentes da Marca (Nativamente Desativados)
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            msg.capturedDossier?.configuredRoles.forEach((cr) => setRoleEnabled(cr.roleId, true));
                            toast.success('Todos os agentes da marca foram ativados com sucesso!');
                          }}
                          className={`text-[9px] font-mono px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                            isDark
                              ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700'
                              : 'bg-zinc-200 hover:bg-zinc-300 text-zinc-800 border-zinc-300'
                          }`}
                        >
                          Ativar Todos
                        </button>
                      </div>

                      <div className="space-y-1.5">
                        {msg.capturedDossier.configuredRoles.map((role) => {
                          const isEnabled =
                            roles.find((r) => r.id === role.roleId)?.enabled ?? role.enabled;

                          return (
                            <div
                              key={role.roleId}
                              className={`p-2 rounded-lg border flex items-center justify-between gap-2.5 text-[10.5px] transition-colors ${
                                isDark
                                  ? isEnabled
                                    ? 'bg-zinc-900/90 border-zinc-700 text-zinc-200'
                                    : 'bg-zinc-950/40 border-zinc-800/60 text-zinc-400'
                                  : isEnabled
                                  ? 'bg-white border-zinc-300 text-zinc-900 shadow-2xs'
                                  : 'bg-zinc-100/70 border-zinc-200 text-zinc-500'
                              }`}
                            >
                              <div className="flex items-start gap-2 min-w-0 flex-1">
                                <span
                                  className={`px-1.5 py-0.2 rounded text-[9px] font-mono uppercase shrink-0 mt-0.5 ${
                                    role.roleId.includes('orchestrator')
                                      ? isDark
                                        ? 'bg-amber-950/60 text-amber-300 border border-amber-800/60'
                                        : 'bg-amber-50 text-amber-800 border border-amber-200'
                                      : isDark
                                      ? 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                                      : 'bg-zinc-200 text-zinc-600'
                                  }`}
                                >
                                  {role.badge}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <span
                                      className={`font-semibold block text-[11px] truncate ${
                                        isEnabled
                                          ? isDark
                                            ? 'text-zinc-100'
                                            : 'text-zinc-900'
                                          : 'text-zinc-400'
                                      }`}
                                    >
                                      {role.roleName}
                                    </span>
                                    <span
                                      className={`text-[8.5px] font-mono uppercase px-1 py-0.2 rounded shrink-0 ${
                                        isEnabled
                                          ? isDark
                                            ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60'
                                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                          : isDark
                                          ? 'bg-zinc-800/80 text-zinc-500 border border-zinc-700'
                                          : 'bg-zinc-200 text-zinc-500'
                                      }`}
                                    >
                                      {isEnabled ? 'Ativo' : 'Desativado'}
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-zinc-400 leading-snug truncate block">
                                    {role.summary}
                                  </span>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  toggleRoleEnabled(role.roleId);
                                  if (!isEnabled) {
                                    toast.success(`Agente "${role.roleName}" ativado!`);
                                  } else {
                                    toast.info(`Agente "${role.roleName}" desativado.`);
                                  }
                                }}
                                className={`px-2 py-1 rounded-md text-[10px] font-mono border transition-all cursor-pointer shrink-0 ${
                                  !isEnabled
                                    ? isDark
                                      ? 'bg-zinc-800 hover:bg-emerald-950/80 hover:text-emerald-300 hover:border-emerald-700 text-zinc-300 border-zinc-700'
                                      : 'bg-white hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300 text-zinc-700 border-zinc-300 shadow-2xs'
                                    : isDark
                                    ? 'bg-zinc-800/40 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border-zinc-700'
                                    : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600 hover:text-zinc-900 border-zinc-300'
                                }`}
                              >
                                {isEnabled ? 'Desativar' : 'Ativar'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Quick Action to open Role Manager */}
                    <div className="pt-1 flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => setIsRoleManagerOpen(true)}
                        className={`px-2.5 py-1.5 rounded-lg text-[10px] font-mono flex items-center gap-1.5 transition-colors cursor-pointer border ${
                          isDark
                            ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700'
                            : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border-zinc-300'
                        }`}
                      >
                        <span>Ver Diretrizes no Gerenciador de Cargos</span>
                        <ArrowRight className="size-2.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Alternativa Interativa: Opinião e Parecer de Outros Agentes */}
                {((msg.delegations && msg.delegations.length > 0) || msg.reasoning) && (
                  <div className="mt-2.5 pt-2 border-t border-inherit/40">
                    <button
                      type="button"
                      onClick={() => toggleOpinions(msg.id)}
                      className={`w-full px-2.5 py-1.5 rounded-lg border text-[11px] font-medium flex items-center justify-between transition-all cursor-pointer ${
                        expandedOpinions[msg.id]
                          ? isDark
                            ? 'bg-[#181614] border-[#B08D57]/40 text-zinc-200'
                            : 'bg-[#FDFBF7] border-[#B08D57]/50 text-zinc-900'
                          : isDark
                            ? 'bg-zinc-900/40 border-zinc-800/80 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200'
                            : 'bg-zinc-50/80 border-zinc-200 hover:border-zinc-300 text-zinc-600 hover:text-zinc-900'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <Users
                          className={`size-3.5 ${
                            expandedOpinions[msg.id] ? 'text-[#B08D57]' : 'text-zinc-400'
                          }`}
                        />
                        <span>
                          Opinião de outros agentes ({msg.delegations?.length || 1})
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] font-mono text-zinc-400">
                        <span>{expandedOpinions[msg.id] ? 'Ocultar pareceres' : 'Consultar pareceres'}</span>
                        <ChevronDown
                          className={`size-3 transition-transform duration-200 ${
                            expandedOpinions[msg.id] ? 'rotate-180 text-[#B08D57]' : ''
                          }`}
                        />
                      </div>
                    </button>

                    {/* Pareceres Expandidos dos Especialistas */}
                    {expandedOpinions[msg.id] && (
                      <div
                        className={`mt-2 p-3 rounded-xl border space-y-2.5 text-xs transition-all ${
                          isDark
                            ? 'border-zinc-800/80 bg-[#121214] text-zinc-300'
                            : 'border-zinc-200 bg-[#FAF8F5] text-zinc-800'
                        }`}
                      >
                        <div className="flex items-center justify-between pb-1.5 border-b border-inherit">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold flex items-center gap-1.5">
                            <BrainCircuit className="size-3 text-[#B08D57]" />
                            Pareceres do Conselho Editorial
                          </span>
                          <span className="text-[9px] font-mono text-zinc-400">
                            Multi-Agente Katana
                          </span>
                        </div>

                        {msg.delegations && msg.delegations.length > 0 && (
                          <div className="space-y-2 pt-0.5">
                            {msg.delegations.map((del, i) => (
                              <div key={i} className="flex items-start gap-2 text-[11px] leading-relaxed">
                                <span className="text-[#B08D57] shrink-0 font-mono text-xs mt-0.5">↳</span>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 mb-0.5">
                                    <span
                                      className={`px-1.5 py-0.2 rounded text-[9px] font-mono uppercase shrink-0 ${
                                        isDark
                                          ? 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                                          : 'bg-zinc-200 text-zinc-700 border border-zinc-300'
                                      }`}
                                    >
                                      {del.badge}
                                    </span>
                                    <strong className={`text-[11px] ${isDark ? 'text-zinc-200' : 'text-zinc-900'}`}>
                                      {del.roleName}
                                    </strong>
                                  </div>
                                  <p className={`text-[11px] ${isDark ? 'text-zinc-300' : 'text-zinc-600'}`}>
                                    {del.action}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {msg.reasoning && (
                          <div
                            className={`pt-2 border-t border-inherit flex items-start gap-2 text-[10.5px] ${
                              isDark ? 'text-zinc-400' : 'text-zinc-600'
                            }`}
                          >
                            <div className="size-4 rounded-full bg-[#B08D57]/15 border border-[#B08D57]/30 flex items-center justify-center shrink-0 mt-0.5">
                              <ShieldCheck className="size-2.5 text-[#B08D57]" />
                            </div>
                            <div>
                              <span className={`font-semibold block ${isDark ? 'text-zinc-300' : 'text-zinc-800'}`}>
                                Racional Editorial:
                              </span>
                              <span className="text-pretty">{msg.reasoning}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Rodapé da Mensagem: Assinatura e Botões de Feedback (Curtir / Descurtir) */}
                <div className="mt-3 pt-2 border-t border-inherit/40 flex items-center justify-between text-[10px]">
                  <div
                    className={`tabular-nums ${
                      isDark ? 'text-zinc-500' : 'text-zinc-400'
                    }`}
                  >
                    Katana Studio · {msg.timestamp}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleFeedback(msg.id, 'like')}
                      title="Avaliar resposta como positiva (Curtir)"
                      className={`size-6 rounded-md border flex items-center justify-center transition-all cursor-pointer ${
                        (feedbacks[msg.id] || msg.feedback) === 'like'
                          ? isDark
                            ? 'bg-[#B08D57]/25 border-[#B08D57] text-[#B08D57]'
                            : 'bg-[#B08D57]/20 border-[#B08D57] text-[#8C6D3B]'
                          : isDark
                            ? 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                            : 'bg-white border-zinc-200 text-zinc-500 hover:text-zinc-800 hover:border-zinc-300 shadow-2xs'
                      }`}
                    >
                      <ThumbsUp className="size-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFeedback(msg.id, 'dislike')}
                      title="Avaliar resposta como negativa (Descurtir)"
                      className={`size-6 rounded-md border flex items-center justify-center transition-all cursor-pointer ${
                        (feedbacks[msg.id] || msg.feedback) === 'dislike'
                          ? isDark
                            ? 'bg-zinc-800 border-zinc-600 text-zinc-200'
                            : 'bg-zinc-200 border-zinc-400 text-zinc-800'
                          : isDark
                            ? 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                            : 'bg-white border-zinc-200 text-zinc-500 hover:text-zinc-800 hover:border-zinc-300 shadow-2xs'
                      }`}
                    >
                      <ThumbsDown className="size-3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      <div ref={bottomRef} />
    </div>
  );
};
