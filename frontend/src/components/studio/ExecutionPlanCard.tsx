import React from 'react';
import { CheckCircle2, ChevronDown, ListOrdered, X } from 'lucide-react';
import { useStudioStore } from '../../store/studioStore';
import { Tooltip } from '../ui/Tooltip';
import { toast } from 'sonner';

export const ExecutionPlanCard: React.FC = () => {
  const {
    executionPlan,
    isPlanCollapsed,
    togglePlanCollapse,
    isPlanHidden,
    setPlanHidden,
    theme,
  } = useStudioStore();

  const isDark = theme === 'dark';

  if (executionPlan.length === 0 || isPlanHidden) return null;

  const completedCount = executionPlan.filter((s) => s.status === 'completed').length;
  const totalCount = executionPlan.length;

  return (
    <div
      className={`mx-3 mt-2 rounded-lg border overflow-hidden transition-all duration-200 ${
        isDark ? 'bg-[#111114] border-zinc-800/80 shadow-xs' : 'bg-zinc-50 border-zinc-200 shadow-2xs'
      }`}
    >
      {/* Card Header */}
      <div
        onClick={togglePlanCollapse}
        className={`w-full px-3 py-2 flex items-center justify-between text-left cursor-pointer transition-colors select-none ${
          isDark ? 'hover:bg-zinc-800/40' : 'hover:bg-zinc-100'
        }`}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            togglePlanCollapse();
          }
        }}
        aria-label={isPlanCollapsed ? 'Expandir plano de execução' : 'Recolher plano de execução'}
      >
        <div className="flex items-center gap-2 min-w-0">
          <ListOrdered className="size-3.5 text-[#B08D57] shrink-0" />
          <span
            className={`text-xs font-semibold tracking-wider uppercase truncate ${
              isDark ? 'text-zinc-300' : 'text-zinc-700'
            }`}
          >
            Plano de Execução
          </span>
          <span
            className={`text-[10px] font-mono px-1.5 py-0.2 rounded shrink-0 font-medium ${
              completedCount === totalCount
                ? isDark
                  ? 'bg-[#B08D57]/20 text-[#B08D57] border border-[#B08D57]/30'
                  : 'bg-amber-50 text-amber-900 border border-amber-200'
                : isDark
                ? 'bg-zinc-800 text-zinc-400'
                : 'bg-zinc-200 text-zinc-600'
            }`}
          >
            {completedCount}/{totalCount}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          <Tooltip text={isPlanCollapsed ? 'Expandir etapas' : 'Recolher etapas'} position="bottom">
            <button
              type="button"
              onClick={togglePlanCollapse}
              className={`p-1 rounded transition-colors cursor-pointer ${
                isDark ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800' : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-200'
              }`}
              aria-label={isPlanCollapsed ? 'Expandir etapas' : 'Recolher etapas'}
            >
              <ChevronDown
                className={`size-3.5 transition-transform duration-200 ${
                  isPlanCollapsed ? '-rotate-90' : ''
                }`}
              />
            </button>
          </Tooltip>

          <Tooltip text="Ocultar plano de execução" position="bottom">
            <button
              type="button"
              onClick={() => {
                setPlanHidden(true);
                toast('Plano de execução ocultado. Use o botão de lista no topo do painel para reexibi-lo.');
              }}
              className={`p-1 rounded transition-colors cursor-pointer ${
                isDark
                  ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                  : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-200'
              }`}
              aria-label="Ocultar plano de execução"
            >
              <X className="size-3.5" />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Steps List */}
      {!isPlanCollapsed && (
        <div className="px-3 pb-2.5 pt-1 space-y-2 border-t border-zinc-200/50 dark:border-zinc-800/60">
          {executionPlan.map((step) => {
            const isCompleted = step.status === 'completed';
            const isActive = step.status === 'active';

            return (
              <div
                key={step.id}
                className={`relative flex items-start gap-2.5 py-1 text-xs transition-colors ${
                  isActive
                    ? `pl-2 border-l-2 font-medium ${
                        isDark ? 'border-zinc-300 text-zinc-100' : 'border-zinc-900 text-zinc-950'
                      }`
                    : ''
                }`}
              >
                {/* Status Indicator Icon */}
                <div className="pt-0.5 shrink-0">
                  {isCompleted && (
                    <CheckCircle2
                      className={`size-3.5 ${isDark ? 'text-[#B08D57]' : 'text-amber-600'}`}
                    />
                  )}
                  {isActive && (
                    <div className="size-3.5 flex items-center justify-center">
                      <span
                        className={`size-2 rounded-full ${isDark ? 'bg-white' : 'bg-zinc-950'}`}
                      />
                    </div>
                  )}
                  {step.status === 'pending' && (
                    <div
                      className={`size-3.5 rounded-full border ${
                        isDark ? 'border-zinc-700 bg-zinc-900' : 'border-zinc-300 bg-zinc-200'
                      }`}
                    />
                  )}
                </div>

                {/* Step Description */}
                <span
                  className={`leading-relaxed text-pretty ${
                    isCompleted
                      ? isDark
                        ? 'text-zinc-400'
                        : 'text-zinc-500'
                      : isActive
                      ? isDark
                        ? 'text-zinc-100 font-semibold'
                        : 'text-zinc-900 font-semibold'
                      : isDark
                      ? 'text-zinc-500'
                      : 'text-zinc-500'
                  }`}
                >
                  {step.roleBadge && (
                    <span
                      className={`inline-block mr-1.5 text-[9px] font-mono uppercase px-1.5 py-0.2 rounded border ${
                        isCompleted
                          ? isDark
                            ? 'border-zinc-800 text-zinc-500 bg-zinc-900/40'
                            : 'border-zinc-200 text-zinc-500 bg-zinc-100'
                          : isActive
                          ? isDark
                            ? 'border-zinc-700 text-zinc-200 bg-zinc-800'
                            : 'border-zinc-300 text-zinc-800 bg-zinc-200'
                          : isDark
                          ? 'border-zinc-800 text-zinc-500 bg-zinc-900/30'
                          : 'border-zinc-200 text-zinc-500 bg-zinc-100'
                      }`}
                    >
                      {step.roleBadge}
                    </span>
                  )}
                  {step.label}
                </span>
              </div>
            );
          })}

          <div className="pt-1 flex justify-end">
            <button
              type="button"
              onClick={() => {
                setPlanHidden(true);
                toast('Plano de execução ocultado. Use o botão de lista no topo do painel para reexibi-lo.');
              }}
              className={`text-[11px] font-medium transition-colors cursor-pointer hover:underline ${
                isDark ? 'text-zinc-500 hover:text-zinc-300' : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              Ocultar painel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
