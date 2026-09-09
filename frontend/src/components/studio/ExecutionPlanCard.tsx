import React from 'react';
import { CheckCircle2, ChevronDown, ListOrdered } from 'lucide-react';
import { useStudioStore } from '../../store/studioStore';

export const ExecutionPlanCard: React.FC = () => {
  const { executionPlan, isPlanCollapsed, togglePlanCollapse, theme } = useStudioStore();

  const isDark = theme === 'dark';

  if (executionPlan.length === 0) return null;

  return (
    <div
      className={`mx-3 mt-3 rounded-lg border overflow-hidden transition-colors ${
        isDark ? 'bg-[#111114] border-zinc-800' : 'bg-zinc-50 border-zinc-200'
      }`}
    >
      {/* Card Header */}
      <button
        type="button"
        onClick={togglePlanCollapse}
        className={`w-full px-3 py-2.5 flex items-center justify-between text-left transition-colors ${
          isDark ? 'hover:bg-zinc-800/40' : 'hover:bg-zinc-100'
        }`}
        aria-label="Alternar visualização do plano de execução"
      >
        <div
          className={`flex items-center gap-2 text-xs font-semibold tracking-wider uppercase ${
            isDark ? 'text-zinc-300' : 'text-zinc-700'
          }`}
        >
          <ListOrdered className={`size-3.5 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`} />
          <span>Plano de Execução</span>
        </div>
        <ChevronDown
          className={`size-3.5 transition-transform duration-200 ${
            isDark ? 'text-zinc-400' : 'text-zinc-500'
          } ${isPlanCollapsed ? '-rotate-90' : ''}`}
        />
      </button>

      {/* Steps List */}
      {!isPlanCollapsed && (
        <div className="px-3 pb-3 pt-1 space-y-2">
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
                      className={`size-3.5 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}
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
                        ? 'text-zinc-500'
                        : 'text-zinc-400'
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
                            ? 'border-zinc-800 text-zinc-600 bg-zinc-900/40'
                            : 'border-zinc-200 text-zinc-400 bg-zinc-100'
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
        </div>
      )}
    </div>
  );
};
