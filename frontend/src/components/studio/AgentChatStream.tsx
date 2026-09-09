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
} from 'lucide-react';
import { useStudioStore } from '../../store/studioStore';
import { toast } from 'sonner';

export const AgentChatStream: React.FC = () => {
  const {
    messages,
    theme,
    roles,
    activeRoleId,
    addMessage,
    setAgentStatus,
    executeCopilotCommand,
    setIsRoleManagerOpen,
    toggleRoleEnabled,
    setRoleEnabled,
    setActivePalette,
    setIsPalettePanelOpen,
    activePalette,
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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
      {messages.length === 0 && (
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

      {messages.map((msg) => {
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
                <p className="whitespace-pre-line text-pretty">{msg.content}</p>

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

                {/* Delegations Tree (Orchestrator Coordination) */}
                {msg.delegations && msg.delegations.length > 0 && (
                  <div
                    className={`mt-3 pt-2.5 border-t space-y-2 p-2.5 rounded-lg text-xs transition-colors ${
                      isDark ? 'border-zinc-800 bg-zinc-900/50' : 'border-zinc-100 bg-zinc-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold flex items-center gap-1.5">
                        <Users className="size-3 text-zinc-400" />
                        Coordenação Editorial · Delegações
                      </span>
                      <span className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                        {msg.delegations.length} frentes
                      </span>
                    </div>

                    <div className="space-y-1.5 pt-0.5">
                      {msg.delegations.map((del, i) => (
                        <div key={i} className="flex items-start gap-1.5 text-[11px] leading-relaxed">
                          <span className="text-zinc-500 shrink-0 font-mono text-xs">↳</span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-mono uppercase shrink-0 ${
                              isDark
                                ? 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                                : 'bg-zinc-200 text-zinc-700'
                            }`}
                          >
                            {del.badge}
                          </span>
                          <span className={isDark ? 'text-zinc-300' : 'text-zinc-700'}>
                            <strong className={isDark ? 'text-zinc-200' : 'text-zinc-900'}>
                              {del.roleName}:
                            </strong>{' '}
                            {del.action}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Optional Rationale / Reasoning Box */}
                {msg.reasoning && (
                  <div
                    className={`mt-3 pt-2.5 border-t flex items-start gap-2 text-[11px] p-2.5 rounded-lg transition-colors ${
                      isDark
                        ? 'border-zinc-800 text-zinc-400 bg-zinc-900/60'
                        : 'border-zinc-100 text-zinc-600 bg-zinc-50'
                    }`}
                  >
                    <BrainCircuit className="size-3.5 shrink-0 mt-0.5" />
                    <div>
                      <span
                        className={`font-semibold block mb-0.5 ${
                          isDark ? 'text-zinc-300' : 'text-zinc-800'
                        }`}
                      >
                        Racional Editorial:
                      </span>
                      <span className="text-pretty">{msg.reasoning}</span>
                    </div>
                  </div>
                )}

                <div
                  className={`mt-2 text-[10px] tabular-nums ${
                    isDark ? 'text-zinc-500' : 'text-zinc-400'
                  }`}
                >
                  Katana Studio · {msg.timestamp}
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
