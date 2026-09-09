import React, { useEffect } from 'react';
import {
  X,
  Palette,
  Check,
  Lock,
  Unlock,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';
import { useStudioStore } from '../../store/studioStore';
import { STUDIO_PALETTE_PRESETS, AUREA_PALETTE, StudioPalette } from '../../data/aureaCatalog.mock';
import { toast } from 'sonner';

export const PaletteManagerModal: React.FC = () => {
  const {
    isPalettePanelOpen,
    setIsPalettePanelOpen,
    activePalette,
    setActivePalette,
    updateActivePalette,
    setPaletteLocked,
    theme,
  } = useStudioStore();

  const isDark = theme === 'dark';

  // Fechar com tecla ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isPalettePanelOpen) {
        setIsPalettePanelOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPalettePanelOpen, setIsPalettePanelOpen]);

  if (!isPalettePanelOpen) return null;

  const handleToggleLock = () => {
    const nextState = !activePalette.locked;
    setPaletteLocked(nextState);
    if (nextState) {
      toast.success('Trava de Marca (Brand Lock) ativada. Agentes restritos aos tokens oficiais.');
    } else {
      toast.info('Trava de Marca desativada. Modo exploratório liberado para os agentes.');
    }
  };

  const handleSelectPreset = (preset: StudioPalette) => {
    const isLocked = activePalette.locked;
    setActivePalette(
      {
        ...preset,
        locked: isLocked,
      },
      true
    );
    toast.success(`Paleta "${preset.name}" aplicada ao catálogo!`);
  };

  const handleResetToDefault = () => {
    setActivePalette(
      {
        ...AUREA_PALETTE,
        locked: activePalette.locked,
      },
      true
    );
    toast.success('Paleta restaurada para o padrão ÁUREA.');
  };

  const handleColorChange = (key: 'primary' | 'background' | 'accent' | 'secondary', value: string) => {
    updateActivePalette(
      {
        [key]: value,
      },
      true
    );
  };

  return (
    <div
      onClick={() => setIsPalettePanelOpen(false)}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-3xl max-h-[90vh] rounded-2xl border shadow-2xl flex flex-col overflow-hidden transition-colors ${
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
              <Palette className="size-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold tracking-tight">
                  Sistema de Cores & Design Tokens
                </h2>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-mono uppercase tracking-wider ${
                    activePalette.locked
                      ? isDark
                        ? 'bg-amber-950/60 text-amber-300 border border-amber-800/80'
                        : 'bg-amber-100 text-amber-800 border border-amber-300'
                      : isDark
                      ? 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                      : 'bg-zinc-100 text-zinc-700 border border-zinc-300'
                  }`}
                >
                  {activePalette.locked ? 'Brand Lock Ativo' : 'Modo Flexível'}
                </span>
              </div>
              <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                Governança visual, tokens semânticos e prioridade de design
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsPalettePanelOpen(false)}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isDark
                ? 'hover:bg-zinc-800 text-zinc-400 hover:text-white'
                : 'hover:bg-zinc-200 text-zinc-500 hover:text-zinc-950'
            }`}
            aria-label="Fechar painel de paleta"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
          {/* SEÇÃO 1: Governança de Marca (Brand Lock) */}
          <div
            className={`p-4 rounded-xl border flex items-center justify-between gap-4 transition-colors ${
              isDark
                ? activePalette.locked
                  ? 'bg-amber-950/20 border-amber-900/60'
                  : 'bg-zinc-900/60 border-zinc-800'
                : activePalette.locked
                ? 'bg-amber-50/80 border-amber-200'
                : 'bg-zinc-50 border-zinc-200'
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`p-2 rounded-lg border mt-0.5 shrink-0 ${
                  activePalette.locked
                    ? isDark
                      ? 'bg-amber-900/40 border-amber-800 text-amber-300'
                      : 'bg-amber-100 border-amber-300 text-amber-900'
                    : isDark
                    ? 'bg-zinc-800 border-zinc-700 text-zinc-400'
                    : 'bg-white border-zinc-300 text-zinc-600'
                }`}
              >
                {activePalette.locked ? (
                  <Lock className="size-4" />
                ) : (
                  <Unlock className="size-4" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-semibold tracking-wide">
                    Trava de Marca (Brand Lock)
                  </h3>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                      activePalette.locked
                        ? 'bg-amber-500/20 text-amber-400 font-medium'
                        : 'bg-zinc-500/20 text-zinc-400'
                    }`}
                  >
                    {activePalette.locked ? 'PRIORIDADE: PALETA' : 'PRIORIDADE: AGENTE'}
                  </span>
                </div>
                <p
                  className={`text-xs mt-1 leading-relaxed ${
                    isDark ? 'text-zinc-400' : 'text-zinc-600'
                  }`}
                >
                  {activePalette.locked
                    ? 'Diretrizes ativas: Os agentes operam exclusivamente com os tokens semânticos cadastrados. Nenhuma cor fora do manual de identidade é permitida sem autorização explícita do usuário.'
                    : 'Modo exploratório: Os agentes possuem liberdade editorial para sugerir variações cromáticas contextuais e novos acordes visuais no chat.'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleToggleLock}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer shrink-0 ${
                activePalette.locked
                  ? isDark
                    ? 'bg-amber-400 text-black border-amber-300 hover:bg-amber-300'
                    : 'bg-amber-900 text-white border-amber-950 hover:bg-amber-800'
                  : isDark
                  ? 'bg-zinc-800 text-zinc-200 border-zinc-700 hover:border-zinc-500'
                  : 'bg-white text-zinc-800 border-zinc-300 hover:border-zinc-400 shadow-2xs'
              }`}
            >
              {activePalette.locked ? 'Destravar Paleta' : 'Travar Paleta'}
            </button>
          </div>

          {/* SEÇÃO 2: Tokens Semânticos Vivos */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase font-mono tracking-wider text-zinc-400">
                  Tokens Semânticos Ativos
                </span>
                <span
                  className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                    isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-100 text-zinc-700'
                  }`}
                >
                  {activePalette.name}
                </span>
              </div>

              {/* Indicador WCAG */}
              <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                <ShieldCheck className="size-3.5 text-emerald-500" />
                <span>Contraste: {activePalette.contrastRatio || '9.2:1 (AAA)'}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Token 1: Dominante Escuro */}
              <div
                className={`p-3 rounded-xl border transition-colors ${
                  isDark ? 'bg-zinc-900/50 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold">Dominante Escuro</span>
                  <div
                    className="size-4 rounded-full border border-zinc-500/40"
                    style={{ backgroundColor: activePalette.primary }}
                  />
                </div>
                <p className={`text-[10px] mb-2.5 ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>
                  Capas, divisórias e texto contrastante
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={activePalette.primary}
                    onChange={(e) => handleColorChange('primary', e.target.value)}
                    className="size-7 rounded cursor-pointer border border-zinc-700 bg-transparent"
                    title="Escolher cor dominante"
                  />
                  <input
                    type="text"
                    value={activePalette.primary}
                    onChange={(e) => handleColorChange('primary', e.target.value)}
                    className={`w-full px-2 py-1 text-xs font-mono rounded border uppercase ${
                      isDark
                        ? 'bg-zinc-800 border-zinc-700 text-zinc-200 focus:border-zinc-500'
                        : 'bg-white border-zinc-300 text-zinc-800 focus:border-zinc-500'
                    }`}
                  />
                </div>
              </div>

              {/* Token 2: Fundo Claro */}
              <div
                className={`p-3 rounded-xl border transition-colors ${
                  isDark ? 'bg-zinc-900/50 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold">Fundo Claro / Tela</span>
                  <div
                    className="size-4 rounded-full border border-zinc-500/40"
                    style={{ backgroundColor: activePalette.background }}
                  />
                </div>
                <p className={`text-[10px] mb-2.5 ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>
                  Canvas das páginas e texto de capas
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={activePalette.background}
                    onChange={(e) => handleColorChange('background', e.target.value)}
                    className="size-7 rounded cursor-pointer border border-zinc-700 bg-transparent"
                    title="Escolher cor de fundo claro"
                  />
                  <input
                    type="text"
                    value={activePalette.background}
                    onChange={(e) => handleColorChange('background', e.target.value)}
                    className={`w-full px-2 py-1 text-xs font-mono rounded border uppercase ${
                      isDark
                        ? 'bg-zinc-800 border-zinc-700 text-zinc-200 focus:border-zinc-500'
                        : 'bg-white border-zinc-300 text-zinc-800 focus:border-zinc-500'
                    }`}
                  />
                </div>
              </div>

              {/* Token 3: Acento Nobre */}
              <div
                className={`p-3 rounded-xl border transition-colors ${
                  isDark ? 'bg-zinc-900/50 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold">Acento Editorial</span>
                  <div
                    className="size-4 rounded-full border border-zinc-500/40"
                    style={{ backgroundColor: activePalette.accent }}
                  />
                </div>
                <p className={`text-[10px] mb-2.5 ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>
                  Filetes de 1px, monogramas e selos
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={activePalette.accent}
                    onChange={(e) => handleColorChange('accent', e.target.value)}
                    className="size-7 rounded cursor-pointer border border-zinc-700 bg-transparent"
                    title="Escolher cor de acento"
                  />
                  <input
                    type="text"
                    value={activePalette.accent}
                    onChange={(e) => handleColorChange('accent', e.target.value)}
                    className={`w-full px-2 py-1 text-xs font-mono rounded border uppercase ${
                      isDark
                        ? 'bg-zinc-800 border-zinc-700 text-zinc-200 focus:border-zinc-500'
                        : 'bg-white border-zinc-300 text-zinc-800 focus:border-zinc-500'
                    }`}
                  />
                </div>
              </div>

              {/* Token 4: Neutro Secundário */}
              <div
                className={`p-3 rounded-xl border transition-colors ${
                  isDark ? 'bg-zinc-900/50 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold">Neutro Secundário</span>
                  <div
                    className="size-4 rounded-full border border-zinc-500/40"
                    style={{ backgroundColor: activePalette.secondary || '#4A4846' }}
                  />
                </div>
                <p className={`text-[10px] mb-2.5 ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>
                  Fólios, notas técnicas e legendas
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={activePalette.secondary || '#4A4846'}
                    onChange={(e) => handleColorChange('secondary', e.target.value)}
                    className="size-7 rounded cursor-pointer border border-zinc-700 bg-transparent"
                    title="Escolher tom neutro"
                  />
                  <input
                    type="text"
                    value={activePalette.secondary || '#4A4846'}
                    onChange={(e) => handleColorChange('secondary', e.target.value)}
                    className={`w-full px-2 py-1 text-xs font-mono rounded border uppercase ${
                      isDark
                        ? 'bg-zinc-800 border-zinc-700 text-zinc-200 focus:border-zinc-500'
                        : 'bg-white border-zinc-300 text-zinc-800 focus:border-zinc-500'
                    }`}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SEÇÃO 3: Coleção de Paletas da Maison (Curadoria Editorial) */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase font-mono tracking-wider text-zinc-400">
                Curadoria de Paletas da Maison
              </span>
              <span className={`text-[11px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                Clique para aplicar instantaneamente a todas as 10 páginas
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {STUDIO_PALETTE_PRESETS.map((preset) => {
                const isSelected = activePalette.name === preset.name;
                return (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-3 relative ${
                      isSelected
                        ? isDark
                          ? 'bg-zinc-800/90 border-white text-white shadow-md ring-1 ring-white/20'
                          : 'bg-zinc-100 border-zinc-950 text-zinc-950 shadow-sm ring-1 ring-zinc-950/20'
                        : isDark
                        ? 'bg-zinc-900/40 border-zinc-800 hover:border-zinc-600 text-zinc-200 hover:bg-zinc-800/40'
                        : 'bg-white border-zinc-200 hover:border-zinc-400 text-zinc-800 hover:bg-zinc-50'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold truncate">{preset.name}</span>
                        {isSelected && <Check className="size-3.5 text-emerald-500 shrink-0" />}
                      </div>
                      <span className={`text-[10px] font-mono ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                        {preset.contrastRatio}
                      </span>
                    </div>

                    {/* Swatches strip */}
                    <div className="flex items-center gap-1.5 pt-1 border-t border-inherit">
                      <div
                        className="size-5 rounded-md border border-black/20 shadow-2xs"
                        style={{ backgroundColor: preset.primary }}
                        title={`Dominante: ${preset.primary}`}
                      />
                      <div
                        className="size-5 rounded-md border border-black/20 shadow-2xs"
                        style={{ backgroundColor: preset.background }}
                        title={`Fundo: ${preset.background}`}
                      />
                      <div
                        className="size-5 rounded-md border border-black/20 shadow-2xs"
                        style={{ backgroundColor: preset.accent }}
                        title={`Acento: ${preset.accent}`}
                      />
                      {preset.secondary && (
                        <div
                          className="size-5 rounded-md border border-black/20 shadow-2xs"
                          style={{ backgroundColor: preset.secondary }}
                          title={`Secundário: ${preset.secondary}`}
                        />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div
          className={`px-6 py-3.5 border-t flex items-center justify-between shrink-0 ${
            isDark ? 'border-zinc-800 bg-[#151518]' : 'border-zinc-200 bg-zinc-50'
          }`}
        >
          <button
            type="button"
            onClick={handleResetToDefault}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
              isDark
                ? 'border-zinc-700 hover:bg-zinc-800 text-zinc-300 hover:text-white'
                : 'border-zinc-300 hover:bg-zinc-100 text-zinc-700 hover:text-zinc-950'
            }`}
          >
            <RotateCcw className="size-3.5" />
            <span>Restaurar Padrão ÁUREA</span>
          </button>

          <button
            type="button"
            onClick={() => setIsPalettePanelOpen(false)}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              isDark
                ? 'bg-white text-zinc-950 hover:bg-zinc-200'
                : 'bg-zinc-950 text-white hover:bg-zinc-800'
            }`}
          >
            Concluído
          </button>
        </div>
      </div>
    </div>
  );
};
