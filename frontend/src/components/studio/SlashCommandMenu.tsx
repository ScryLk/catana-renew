import React, { useEffect, useRef } from 'react';
import { Terminal, CornerDownLeft } from 'lucide-react';
import { StudioSkill } from '../../data/studioSkills';
import { useStudioStore } from '../../store/studioStore';

interface SlashCommandMenuProps {
  isOpen: boolean;
  searchQuery: string;
  selectedIndex: number;
  filteredSkills: StudioSkill[];
  onSelectSkill: (skill: StudioSkill) => void;
  onClose: () => void;
}

export const SlashCommandMenu: React.FC<SlashCommandMenuProps> = ({
  isOpen,
  searchQuery,
  selectedIndex,
  filteredSkills,
  onSelectSkill,
  onClose,
}) => {
  const { theme } = useStudioStore();
  const isDark = theme === 'dark';
  const menuRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (selectedItemRef.current) {
      selectedItemRef.current.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      className={`absolute bottom-full left-0 mb-2 w-full max-h-80 border rounded-xl shadow-2xl overflow-hidden flex flex-col z-50 animate-in fade-in slide-in-from-bottom-2 duration-150 transition-colors ${
        isDark
          ? 'bg-[#151518] border-zinc-700 text-zinc-200 shadow-[0_12px_36px_rgba(0,0,0,0.85)]'
          : 'bg-white border-zinc-200 text-zinc-900 shadow-[0_8px_30px_rgba(0,0,0,0.15)]'
      }`}
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-inherit flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5">
          <Terminal className="size-3.5 text-zinc-400" />
          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
            Habilidades do Agente (/skills)
          </span>
        </div>
        <span className={`text-[10px] font-mono ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
          {filteredSkills.length} disponíveis
        </span>
      </div>

      {/* Skills List */}
      <div className="overflow-y-auto custom-scrollbar p-1 space-y-0.5 flex-1 max-h-64">
        {filteredSkills.length === 0 ? (
          <div className="p-4 text-center text-xs">
            <span className={isDark ? 'text-zinc-500' : 'text-zinc-400'}>
              Nenhuma skill encontrada para "{searchQuery}".
            </span>
          </div>
        ) : (
          filteredSkills.map((skill, index) => {
            const isSelected = index === selectedIndex;

            return (
              <button
                key={skill.id}
                ref={isSelected ? selectedItemRef : null}
                type="button"
                onClick={() => onSelectSkill(skill)}
                className={`w-full text-left p-2 rounded-lg text-xs transition-colors cursor-pointer flex items-start justify-between gap-2 ${
                  isSelected
                    ? isDark
                      ? 'bg-zinc-800/90 text-white font-medium'
                      : 'bg-zinc-100 text-zinc-950 font-medium'
                    : isDark
                    ? 'hover:bg-zinc-800/50 text-zinc-300'
                    : 'hover:bg-zinc-50 text-zinc-700'
                }`}
              >
                <div className="flex-1 min-w-0 pr-2">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-mono font-semibold text-xs text-pretty tracking-tight">
                      {skill.command}
                    </span>

                    {skill.parametersHint && (
                      <span
                        className={`text-[10px] font-mono ${
                          isDark ? 'text-zinc-500' : 'text-zinc-400'
                        }`}
                      >
                        {skill.parametersHint}
                      </span>
                    )}

                    <span
                      className={`text-[9px] font-mono uppercase px-1.5 py-0.2 rounded shrink-0 ${
                        skill.roleId === 'orchestrator'
                          ? isDark
                            ? 'bg-amber-950/60 text-amber-300 border border-amber-800/60'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                          : isDark
                          ? 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                          : 'bg-zinc-200 text-zinc-600'
                      }`}
                    >
                      {skill.roleBadge}
                    </span>
                  </div>

                  <p
                    className={`text-[11px] truncate ${
                      isDark ? 'text-zinc-400' : 'text-zinc-500'
                    }`}
                  >
                    {skill.description}
                  </p>
                </div>

                {isSelected && (
                  <div className="flex items-center gap-1 shrink-0 pt-0.5 text-zinc-400">
                    <span className="text-[10px] font-mono">enter</span>
                    <CornerDownLeft className="size-2.5" />
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>

      {/* Footer Navigation Hint */}
      <div
        className={`px-3 py-1.5 border-t border-inherit flex items-center justify-between text-[10px] font-mono shrink-0 ${
          isDark ? 'text-zinc-500 bg-[#111114]' : 'text-zinc-400 bg-zinc-50'
        }`}
      >
        <span>↑ ↓ navegar</span>
        <span>Enter selecionar</span>
        <span>Esc fechar</span>
      </div>
    </div>
  );
};
