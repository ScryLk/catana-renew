import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, X, Check, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useStudioStore } from '../../store/studioStore';

interface BrandSelectorPillProps {
  direction?: 'up' | 'down';
  className?: string;
}

export const BrandSelectorPill: React.FC<BrandSelectorPillProps> = ({
  direction = 'up',
  className = '',
}) => {
  const {
    theme,
    brands,
    activeBrandId,
    setActiveBrandId,
    openBrandModal,
  } = useStudioStore();

  const isDark = theme === 'dark';
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeBrand = brands.find((b) => b.id === activeBrandId);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleUnlink = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveBrandId(null);
    setIsOpen(false);
    toast.info('Marca desvinculada. O projeto será criado como avulso.');
  };

  return (
    <div className={`relative inline-flex items-center ${className}`} ref={dropdownRef}>
      {/* Pill Container com hover group para exibir o botão X */}
      <div
        className={`group/brand-pill flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all select-none ${
          activeBrand
            ? isDark
              ? 'bg-zinc-800/70 border-zinc-700/80 text-zinc-200 hover:border-zinc-500 hover:bg-zinc-800'
              : 'bg-zinc-100 border-zinc-300 text-zinc-800 hover:border-zinc-400 hover:bg-zinc-200/70'
            : isDark
            ? 'bg-transparent border-dashed border-zinc-700/80 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
            : 'bg-transparent border-dashed border-zinc-300 text-zinc-600 hover:border-zinc-400 hover:text-zinc-900'
        }`}
      >
        {/* Botão de Toggle do Dropdown */}
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex items-center gap-1.5 cursor-pointer outline-none select-none"
          title={
            activeBrand
              ? `Marca ativa: ${activeBrand.name}. Clique para selecionar outra marca.`
              : 'Nenhuma marca vinculada. Clique para selecionar uma marca.'
          }
          aria-expanded={isOpen}
          aria-haspopup="true"
        >
          <span
            className={`size-1.5 rounded-full shrink-0 ${
              activeBrand ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]' : 'bg-zinc-500'
            }`}
          />
          <span className="truncate max-w-[130px]">
            {activeBrand ? activeBrand.name : 'Sem Marca (Avulso)'}
          </span>
          <ChevronDown
            className={`size-3 text-zinc-400 transition-transform duration-150 ${
              isOpen ? 'rotate-180 text-zinc-200' : ''
            }`}
          />
        </button>

        {/* Botão X ao colocar o mouse em cima da marca para desvincular */}
        {activeBrand && (
          <button
            type="button"
            onClick={handleUnlink}
            className="opacity-0 group-hover/brand-pill:opacity-100 p-0.5 rounded hover:bg-zinc-700/60 text-zinc-400 hover:text-zinc-100 transition-all cursor-pointer -mr-0.5 ml-0.5 shrink-0"
            title="Desvincular marca (criar projeto avulso)"
            aria-label="Desvincular marca"
          >
            <X className="size-2.5" />
          </button>
        )}
      </div>

      {/* Dropdown Menu de Seleção de Marca */}
      {isOpen && (
        <div
          role="menu"
          className={`absolute left-0 ${
            direction === 'up' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
          } z-50 min-w-[220px] rounded-xl border p-1 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150 ${
            isDark
              ? 'bg-[#121215]/95 border-zinc-800 text-zinc-200 shadow-black/80'
              : 'bg-white/95 border-zinc-200 text-zinc-800 shadow-zinc-300/50'
          }`}
        >
          <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-semibold flex items-center justify-between select-none">
            <span>Vincular Marca</span>
            <span className="text-[9px] text-zinc-600 font-normal">{brands.length} marcas</span>
          </div>

          {/* Opção 1: Sem Marca (Projeto Avulso) */}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setActiveBrandId(null);
              setIsOpen(false);
              toast.info('Projeto configurado como avulso.');
            }}
            className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer select-none ${
              !activeBrand
                ? isDark
                  ? 'bg-zinc-800/80 text-white font-medium'
                  : 'bg-zinc-200/80 text-zinc-950 font-medium'
                : isDark
                ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="size-1.5 rounded-full bg-zinc-500 shrink-0" />
              <span className="truncate">Sem marca (Projeto Avulso)</span>
            </div>
            {!activeBrand && <Check className="size-3 text-emerald-400 shrink-0" />}
          </button>

          <div className={`h-px my-1 ${isDark ? 'bg-zinc-800/80' : 'bg-zinc-200'}`} />

          {/* Lista de Marcas Cadastradas */}
          <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-0.5">
            {brands.map((brand) => {
              const isSelected = activeBrandId === brand.id;
              return (
                <button
                  key={brand.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setActiveBrandId(brand.id);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer select-none ${
                    isSelected
                      ? isDark
                        ? 'bg-zinc-800/80 text-white font-medium'
                        : 'bg-zinc-200/80 text-zinc-950 font-medium'
                      : isDark
                      ? 'text-zinc-300 hover:text-white hover:bg-zinc-900/60'
                      : 'text-zinc-700 hover:text-zinc-950 hover:bg-zinc-100'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span
                      className={`size-1.5 rounded-full shrink-0 ${
                        isSelected ? 'bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.6)]' : 'bg-zinc-500'
                      }`}
                    />
                    <span className="truncate font-medium">{brand.name}</span>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-500 shrink-0 truncate max-w-[70px]">
                    {brand.segment || 'Geral'}
                  </span>
                  {isSelected && <Check className="size-3 text-emerald-400 shrink-0" />}
                </button>
              );
            })}
          </div>

          <div className={`h-px my-1 ${isDark ? 'bg-zinc-800/80' : 'bg-zinc-200'}`} />

          {/* Ação de Adicionar Nova Marca */}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setIsOpen(false);
              openBrandModal();
            }}
            className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-2 transition-colors cursor-pointer select-none ${
              isDark
                ? 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/60'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
            }`}
          >
            <Plus className="size-3 shrink-0" />
            <span className="font-medium">+ Nova Marca</span>
          </button>
        </div>
      )}
    </div>
  );
};
