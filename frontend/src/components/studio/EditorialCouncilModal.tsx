import React, { useState } from 'react';
import {
  X,
  Scale,
  Check,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  SlidersHorizontal,
} from 'lucide-react';
import { useStudioStore } from '../../store/studioStore';
import { toast } from 'sonner';

export const EditorialCouncilModal: React.FC = () => {
  const {
    isCouncilModalOpen,
    setIsCouncilModalOpen,
    roles,
    currentSpread,
    pages,
    applyCouncilResolutions,
    theme,
  } = useStudioStore();

  const isDark = theme === 'dark';

  // Participating roles (default to active specialist roles, excluding orchestrator which acts as the chair)
  const specialistRoles = roles.filter((r) => r.id !== 'orchestrator' && r.enabled !== false);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>(
    specialistRoles.map((r) => r.id)
  );

  const [hasDebated, setHasDebated] = useState<boolean>(true);
  const [isDebating, setIsDebating] = useState<boolean>(false);

  if (!isCouncilModalOpen) return null;

  const leftPage = pages.find((p) => p.pageNumber === currentSpread[0]);
  const rightPage = pages.find((p) => p.pageNumber === currentSpread[1]);

  const toggleRoleSelection = (roleId: string) => {
    setSelectedRoleIds((prev) =>
      prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]
    );
  };

  const handleRunDebate = () => {
    if (selectedRoleIds.length === 0) {
      toast.error('Selecione pelo menos um especialista para a mesa redonda.');
      return;
    }
    setIsDebating(true);
    setTimeout(() => {
      setIsDebating(false);
      setHasDebated(true);
      toast.success('Mesa Redonda concluiu os pareceres!');
    }, 600);
  };

  const handleApplyResolutions = () => {
    applyCouncilResolutions({
      summary:
        `Revisão do Spread [${currentSpread[0]} e ${currentSpread[1]}]:\n` +
        `• Design: Alinhamento tabular e respiro de 96px preservados.\n` +
        `• Redação: Claim e manifesto refinados sem clichês descritivos.\n` +
        `• Comercial: SKU-AUR-01 e pedido mínimo de atacado formalizados.\n` +
        `• Branding: Conformidade WCAG AA (6.4:1) homologada.`,
      productUpdates: {
        id: 'prod-bolsa',
        updates: {
          description:
            'Couro de bezerro escovado com acabamento acetinado à mão e fecho em latão. SKU-AUR-01 | Atacado: Pedido mín. 3 un.',
        },
      },
      reasoning:
        'Racional do Editor-Chefe [Conselho Editorial]: Resolução de conflito executada. Mantida a pureza estética do hero visual com inserção compacta e discreta dos requisitos B2B de atacado.',
    });

    toast.success('Melhorias do Conselho Editorial aplicadas com sucesso!');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className={`w-full max-w-4xl h-[680px] rounded-2xl border shadow-2xl flex flex-col overflow-hidden transition-colors ${
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
              <Scale className="size-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold tracking-tight">
                  Conselho Editorial · Mesa Redonda
                </h2>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-mono uppercase tracking-wider ${
                    isDark
                      ? 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                      : 'bg-zinc-200 text-zinc-700'
                  }`}
                >
                  Spread {String(currentSpread[0]).padStart(2, '0')} e {String(currentSpread[1]).padStart(2, '0')}
                </span>
              </div>
              <p className={`text-xs mt-0.5 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                Debate e revisão cruzada multidisciplinar conduzida pelo Editor-Chefe
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsCouncilModalOpen(false)}
            className={`p-2 rounded-lg transition-colors cursor-pointer ${
              isDark
                ? 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                : 'hover:bg-zinc-200 text-zinc-500 hover:text-zinc-900'
            }`}
            aria-label="Fechar Conselho"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto custom-scrollbar p-6 space-y-6">
          {/* Target Spread Context Banner */}
          <div
            className={`p-3.5 rounded-xl border flex items-center justify-between gap-4 text-xs ${
              isDark
                ? 'bg-zinc-900/50 border-zinc-800 text-zinc-300'
                : 'bg-zinc-50 border-zinc-200 text-zinc-700'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`size-8 rounded-lg border flex items-center justify-center font-mono font-bold text-xs shrink-0 ${
                  isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-200' : 'bg-white border-zinc-300 text-zinc-800'
                }`}
              >
                {currentSpread[0]}/{currentSpread[1]}
              </div>
              <div>
                <span className="font-semibold block text-zinc-100">
                  Prancheta sob Análise: {leftPage?.title || 'Divisória'} & {rightPage?.title || 'Hero'}
                </span>
                <span className={`text-[11px] ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                  Coleção ÁUREA · Inverno 2026 · Formato A4 (794x1123)
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className={`text-[11px] font-medium ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                Presidido por:
              </span>
              <span
                className={`text-[11px] px-2 py-0.5 rounded font-mono font-medium ${
                  isDark
                    ? 'bg-amber-950/60 text-amber-300 border border-amber-800/60'
                    : 'bg-amber-50 text-amber-800 border border-amber-200'
                }`}
              >
                Editor-Chefe (Orquestrador)
              </span>
            </div>
          </div>

          {/* Participating Roles Selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <SlidersHorizontal className="size-3.5 text-zinc-400" />
                <label className="text-xs font-semibold">
                  Especialistas Convocados para o Debate ({selectedRoleIds.length}/{specialistRoles.length})
                </label>
              </div>

              <button
                type="button"
                onClick={handleRunDebate}
                disabled={isDebating}
                className={`px-3 py-1 text-xs rounded-lg border transition-all cursor-pointer font-medium flex items-center gap-1.5 ${
                  isDark
                    ? 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-200'
                    : 'bg-zinc-100 hover:bg-zinc-200 border-zinc-300 text-zinc-800'
                }`}
              >
                <Sparkles className="size-3" />
                <span>{isDebating ? 'Debatendo...' : 'Reavaliar Pareceres'}</span>
              </button>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {specialistRoles.map((role) => {
                const isSelected = selectedRoleIds.includes(role.id);
                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => toggleRoleSelection(role.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-2 transition-all cursor-pointer ${
                      isSelected
                        ? isDark
                          ? 'bg-zinc-800 border-zinc-600 text-white shadow-xs'
                          : 'bg-zinc-900 border-zinc-900 text-white shadow-xs'
                        : isDark
                        ? 'bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                        : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:text-zinc-900'
                    }`}
                  >
                    <div
                      className={`size-3.5 rounded border flex items-center justify-center ${
                        isSelected
                          ? isDark
                            ? 'bg-white border-white text-zinc-950'
                            : 'bg-white border-white text-zinc-950'
                          : isDark
                          ? 'border-zinc-700 bg-transparent'
                          : 'border-zinc-300 bg-transparent'
                      }`}
                    >
                      {isSelected && <Check className="size-2.5 stroke-3" />}
                    </div>
                    <span>{role.name}</span>
                    <span
                      className={`text-[10px] font-mono px-1 rounded ${
                        isSelected
                          ? isDark
                            ? 'bg-zinc-700 text-zinc-200'
                            : 'bg-zinc-800 text-zinc-200'
                          : isDark
                          ? 'bg-zinc-800 text-zinc-500'
                          : 'bg-zinc-100 text-zinc-500'
                      }`}
                    >
                      {role.badge}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Specialist Opinions Cards */}
          {hasDebated && (
            <div className="space-y-3">
              <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-400 font-semibold block">
                Pareceres Individuais dos Especialistas
              </span>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {selectedRoleIds.includes('director') && (
                  <div
                    className={`p-3.5 rounded-xl border space-y-2 ${
                      isDark ? 'bg-[#141417] border-zinc-800' : 'bg-zinc-50/70 border-zinc-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-zinc-200">Diretor de Arte</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                          Design
                        </span>
                      </div>
                      <span className="text-[10px] text-zinc-500">Estética & Layout</span>
                    </div>
                    <p className={`text-xs leading-relaxed ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                      "A composição possui equilíbrio formal satisfatório, ancorando a Bolsa Aurelia no centro óptico. Recomendo calibrar o respiro negativo da margem direita para exatamente 96px, preservando o alinhamento da linha de base com o fólio inferior."
                    </p>
                  </div>
                )}

                {selectedRoleIds.includes('copywriter') && (
                  <div
                    className={`p-3.5 rounded-xl border space-y-2 ${
                      isDark ? 'bg-[#141417] border-zinc-800' : 'bg-zinc-50/70 border-zinc-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-zinc-200">Redator Publicitário</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                          Redação
                        </span>
                      </div>
                      <span className="text-[10px] text-zinc-500">Narrativa & Claims</span>
                    </div>
                    <p className={`text-xs leading-relaxed ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                      "O claim atual pode ser mais evocativo. Proponho: 'Couro de bezerro escovado com acabamento acetinado à mão e fecho em latão polido'. Elimina termos genéricos e enfatiza a autenticidade do atelier de manufatura."
                    </p>
                  </div>
                )}

                {selectedRoleIds.includes('commercial') && (
                  <div
                    className={`p-3.5 rounded-xl border space-y-2 ${
                      isDark ? 'bg-[#141417] border-zinc-800' : 'bg-zinc-50/70 border-zinc-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-zinc-200">Tabela Comercial / B2B</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                          Comercial
                        </span>
                      </div>
                      <span className="text-[10px] text-zinc-500">Conversão & Preço</span>
                    </div>
                    <p className={`text-xs leading-relaxed ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                      "O valor de R$ 4.900 cumpre com o markup de 2.8x. Para viabilizar compras de lojistas, é indispensável registrar o código SKU-AUR-01 e a diretriz de pedido mínimo de 3 unidades para atacado no descritivo técnico."
                    </p>
                  </div>
                )}

                {selectedRoleIds.includes('branding') && (
                  <div
                    className={`p-3.5 rounded-xl border space-y-2 ${
                      isDark ? 'bg-[#141417] border-zinc-800' : 'bg-zinc-50/70 border-zinc-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-zinc-200">Auditor de Branding</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                          Auditoria
                        </span>
                      </div>
                      <span className="text-[10px] text-zinc-500">Diretrizes de Marca</span>
                    </div>
                    <p className={`text-xs leading-relaxed ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                      "A tipografia Cormorant Garamond versalete está em conformidade. O contraste cromático de 6.4:1 supera a exigência WCAG AA de 4.5:1. O monograma na página divisória esquerda está rigorosamente alinhado."
                    </p>
                  </div>
                )}
              </div>

              {/* Master Verdict & Conflict Resolution */}
              <div
                className={`p-4 rounded-xl border space-y-2 mt-4 transition-colors ${
                  isDark
                    ? 'bg-zinc-900/80 border-amber-900/40 text-zinc-200'
                    : 'bg-amber-50/50 border-amber-200/80 text-zinc-900'
                }`}
              >
                <div className="flex items-center gap-2">
                  <ShieldCheck className={`size-4 ${isDark ? 'text-amber-400' : 'text-amber-700'}`} />
                  <span className="text-xs font-semibold uppercase tracking-wider font-mono">
                    Veredito e Síntese do Editor-Chefe (Orquestrador)
                  </span>
                </div>

                <p className={`text-xs leading-relaxed font-mono ${isDark ? 'text-zinc-300' : 'text-zinc-800'}`}>
                  "Resolução de conflito: Conciliaremos a demanda comercial de atacado com a pureza estética da maison. O claim poético sugerido pela redação será adotado integralmente. As informações de SKU-AUR-01 e pedido mínimo serão incorporadas de forma compacta e discreta na base inferior, mantendo o respiro negativo de 96px exigido pela arte e a conformidade tipográfica auditada."
                </p>

                <div className="pt-2 flex items-center gap-3 text-[11px] text-zinc-400">
                  <div className="flex items-center gap-1">
                    <CheckCircle2 className="size-3 text-emerald-400" />
                    <span>Estética Preservada</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <CheckCircle2 className="size-3 text-emerald-400" />
                    <span>Dados B2B Integrados</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <CheckCircle2 className="size-3 text-emerald-400" />
                    <span>WCAG AA Homologado</span>
                  </div>
                </div>
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
            onClick={() => setIsCouncilModalOpen(false)}
            className={`px-4 py-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
              isDark
                ? 'border-zinc-800 hover:bg-zinc-800 text-zinc-300'
                : 'border-zinc-200 hover:bg-zinc-100 text-zinc-700'
            }`}
          >
            Fechar sem Aplicar
          </button>

          <button
            type="button"
            onClick={handleApplyResolutions}
            className={`px-5 py-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer shadow-sm flex items-center gap-2 ${
              isDark
                ? 'bg-white text-zinc-950 border-white hover:bg-zinc-200'
                : 'bg-zinc-900 text-white border-zinc-900 hover:bg-zinc-800'
            }`}
          >
            <Check className="size-3.5" />
            <span>Aplicar Resoluções do Conselho no Catálogo</span>
          </button>
        </div>
      </div>
    </div>
  );
};
