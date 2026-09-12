import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  Check,
  Crop,
  Pipette,
  Maximize2,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import {
  CropRect,
  detectContentBounds,
  extractFullColorPalette,
  cropImageToDataUrl,
  rgbToHex,
} from '../../utils/colorExtractor';
import { toast } from 'sonner';

interface LogoAreaSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageSrc: string;
  initialPalette?: {
    primary: string;
    secondary: string;
    accent: string;
  };
  onApply: (
    palette: { primary: string; secondary: string; accent: string },
    croppedDataUrl?: string
  ) => void;
  isDark?: boolean;
}

type ColorSlot = 'primary' | 'secondary' | 'accent';

type DragMode =
  | null
  | 'draw'
  | 'move'
  | 'nw'
  | 'n'
  | 'ne'
  | 'e'
  | 'se'
  | 's'
  | 'sw'
  | 'w';

export const LogoAreaSelectorModal: React.FC<LogoAreaSelectorModalProps> = ({
  isOpen,
  onClose,
  imageSrc,
  initialPalette,
  onApply,
  isDark = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Coordenadas de corte normalizadas (0 a 1)
  const [crop, setCrop] = useState<CropRect>({
    x: 0.05,
    y: 0.05,
    width: 0.9,
    height: 0.9,
  });

  // Cores extraídas e ativas
  const [primaryColor, setPrimaryColor] = useState(initialPalette?.primary || '#18181B');
  const [secondaryColor, setSecondaryColor] = useState(initialPalette?.secondary || '#52525B');
  const [tertiaryColor, setTertiaryColor] = useState(initialPalette?.accent || '#B08D57');
  const [detectedSwatches, setDetectedSwatches] = useState<string[]>([]);
  const [activeSlot, setActiveSlot] = useState<ColorSlot>('primary');

  // Opções de processamento
  const [isEyedropperActive, setIsEyedropperActive] = useState(false);
  const [ignoreDark, setIgnoreDark] = useState(true);
  const [shouldCropLogo, setShouldCropLogo] = useState(true);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  // Estados de arrasto do mouse
  const [dragMode, setDragMode] = useState<DragMode>(null);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; initialCrop: CropRect }>({
    mouseX: 0,
    mouseY: 0,
    initialCrop: crop,
  });

  // Fecha no ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Função central de extração com o recorte atual
  const runExtraction = useCallback(
    async (currentCrop: CropRect, ignoreDarkBg: boolean) => {
      if (!imageSrc) return;
      setIsExtracting(true);
      try {
        const result = await extractFullColorPalette(imageSrc, {
          cropRect: currentCrop,
          ignoreDarkBackground: ignoreDarkBg,
        });

        setPrimaryColor(result.palette.primary);
        setSecondaryColor(result.palette.secondary || '#52525B');
        setTertiaryColor(result.palette.accent);
        setDetectedSwatches(result.swatches);
      } catch (err) {
        console.warn('Erro na extração cromática:', err);
      } finally {
        setIsExtracting(false);
      }
    },
    [imageSrc]
  );

  // Ao abrir o modal, detecta os limites automáticos da imagem inicial
  useEffect(() => {
    if (!isOpen || !imageSrc) return;

    let isMounted = true;
    (async () => {
      try {
        const bounds = await detectContentBounds(imageSrc);
        if (isMounted) {
          setCrop(bounds);
          await runExtraction(bounds, true);
        }
      } catch {
        if (isMounted) {
          const fallback: CropRect = { x: 0.1, y: 0.1, width: 0.8, height: 0.8 };
          setCrop(fallback);
          await runExtraction(fallback, true);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [isOpen, imageSrc, runExtraction]);

  // Handler de enquadramento automático do símbolo
  const handleAutoTrim = async () => {
    try {
      const bounds = await detectContentBounds(imageSrc);
      setCrop(bounds);
      await runExtraction(bounds, ignoreDark);
      toast.success('Símbolo enquadrado automaticamente.');
    } catch {
      toast.error('Não foi possível identificar o símbolo automaticamente.');
    }
  };

  // Handler para selecionar imagem inteira
  const handleSelectAll = () => {
    const fullCrop: CropRect = { x: 0, y: 0, width: 1, height: 1 };
    setCrop(fullCrop);
    runExtraction(fullCrop, ignoreDark);
  };

  // Alternar filtro de bordas escuras
  const handleToggleIgnoreDark = () => {
    const nextVal = !ignoreDark;
    setIgnoreDark(nextVal);
    runExtraction(crop, nextVal);
  };

  // Amostragem de cor de pixel para Pipeta (Eyedropper)
  const sampleColorAt = (e: React.MouseEvent) => {
    if (!imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const relX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const relY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    const canvas = document.createElement('canvas');
    canvas.width = imgRef.current.naturalWidth;
    canvas.height = imgRef.current.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(imgRef.current, 0, 0);
    const px = Math.floor(relX * canvas.width);
    const py = Math.floor(relY * canvas.height);
    const pData = ctx.getImageData(px, py, 1, 1).data;

    if (pData[3] < 20) {
      toast.info('Área transparente selecionada.');
      return;
    }

    const hex = rgbToHex(pData[0], pData[1], pData[2]);
    applyColorToActiveSlot(hex);
    toast.success(`Cor ${hex} capturada para ${getSlotLabel(activeSlot)}.`);
    setIsEyedropperActive(false);
  };

  const getSlotLabel = (slot: ColorSlot) => {
    if (slot === 'primary') return 'Cor Primária';
    if (slot === 'secondary') return 'Cor Secundária';
    return 'Cor Terciária';
  };

  const applyColorToActiveSlot = (color: string) => {
    if (activeSlot === 'primary') setPrimaryColor(color);
    else if (activeSlot === 'secondary') setSecondaryColor(color);
    else setTertiaryColor(color);
  };

  // Início de arrasto ou redimensionamento
  const handleMouseDown = (mode: DragMode, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isEyedropperActive) return;

    setDragMode(mode);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      initialCrop: { ...crop },
    };
  };

  // Movimento de arrasto
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragMode || !imgRef.current) return;
      const rect = imgRef.current.getBoundingClientRect();
      const deltaX = (e.clientX - dragStartRef.current.mouseX) / rect.width;
      const deltaY = (e.clientY - dragStartRef.current.mouseY) / rect.height;
      const init = dragStartRef.current.initialCrop;

      let nextX = init.x;
      let nextY = init.y;
      let nextW = init.width;
      let nextH = init.height;

      const minDim = 0.05;

      switch (dragMode) {
        case 'move':
          nextX = Math.max(0, Math.min(1 - init.width, init.x + deltaX));
          nextY = Math.max(0, Math.min(1 - init.height, init.y + deltaY));
          break;
        case 'nw':
          nextX = Math.max(0, Math.min(init.x + init.width - minDim, init.x + deltaX));
          nextY = Math.max(0, Math.min(init.y + init.height - minDim, init.y + deltaY));
          nextW = init.width - (nextX - init.x);
          nextH = init.height - (nextY - init.y);
          break;
        case 'n':
          nextY = Math.max(0, Math.min(init.y + init.height - minDim, init.y + deltaY));
          nextH = init.height - (nextY - init.y);
          break;
        case 'ne':
          nextY = Math.max(0, Math.min(init.y + init.height - minDim, init.y + deltaY));
          nextW = Math.max(minDim, Math.min(1 - init.x, init.width + deltaX));
          nextH = init.height - (nextY - init.y);
          break;
        case 'e':
          nextW = Math.max(minDim, Math.min(1 - init.x, init.width + deltaX));
          break;
        case 'se':
          nextW = Math.max(minDim, Math.min(1 - init.x, init.width + deltaX));
          nextH = Math.max(minDim, Math.min(1 - init.y, init.height + deltaY));
          break;
        case 's':
          nextH = Math.max(minDim, Math.min(1 - init.y, init.height + deltaY));
          break;
        case 'sw':
          nextX = Math.max(0, Math.min(init.x + init.width - minDim, init.x + deltaX));
          nextW = init.width - (nextX - init.x);
          nextH = Math.max(minDim, Math.min(1 - init.y, init.height + deltaY));
          break;
        case 'w':
          nextX = Math.max(0, Math.min(init.x + init.width - minDim, init.x + deltaX));
          nextW = init.width - (nextX - init.x);
          break;
        case 'draw': {
          const startRelX = Math.max(0, Math.min(1, (dragStartRef.current.mouseX - rect.left) / rect.width));
          const startRelY = Math.max(0, Math.min(1, (dragStartRef.current.mouseY - rect.top) / rect.height));
          const curRelX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
          const curRelY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

          nextX = Math.min(startRelX, curRelX);
          nextY = Math.min(startRelY, curRelY);
          nextW = Math.max(minDim, Math.abs(curRelX - startRelX));
          nextH = Math.max(minDim, Math.abs(curRelY - startRelY));
          break;
        }
      }

      setCrop({
        x: Math.max(0, Math.min(1 - nextW, nextX)),
        y: Math.max(0, Math.min(1 - nextH, nextY)),
        width: Math.min(1, Math.max(minDim, nextW)),
        height: Math.min(1, Math.max(minDim, nextH)),
      });
    },
    [dragMode]
  );

  // Fim do arrasto
  const handleMouseUp = () => {
    if (dragMode) {
      setDragMode(null);
      runExtraction(crop, ignoreDark);
    }
  };

  // Clique no canvas de fundo para novo retângulo de seleção
  const handleBackgroundMouseDown = (e: React.MouseEvent) => {
    if (isEyedropperActive) {
      sampleColorAt(e);
      return;
    }
    handleMouseDown('draw', e);
  };

  // Confirmar e aplicar a seleção
  const handleConfirm = async () => {
    setIsApplying(true);
    try {
      let croppedUrl: string | undefined = undefined;
      if (shouldCropLogo) {
        croppedUrl = await cropImageToDataUrl(imageSrc, crop);
      }

      onApply(
        {
          primary: primaryColor,
          secondary: secondaryColor,
          accent: tertiaryColor,
        },
        croppedUrl
      );
      toast.success('Paleta da marca e recorte atualizados com sucesso!');
      onClose();
    } catch {
      toast.error('Erro ao processar o recorte do logotipo.');
    } finally {
      setIsApplying(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 select-none">
      <div
        className={`w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden ${
          isDark
            ? 'bg-[#0f0f13] border-zinc-800 text-zinc-100'
            : 'bg-white border-zinc-200 text-zinc-900'
        }`}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-inherit flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div
              className={`size-8 rounded-lg flex items-center justify-center border ${
                isDark ? 'bg-zinc-900 border-zinc-700 text-amber-400' : 'bg-amber-50 border-amber-200 text-amber-700'
              }`}
            >
              <Crop className="size-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-tight">
                Selecionar Área da Logo Marca
              </h2>
              <p className="text-[11px] text-zinc-400">
                Ajuste o quadro para isolar o símbolo e extrair as cores exatas da identidade visual
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg border border-transparent hover:border-zinc-700 hover:bg-zinc-800/60 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            aria-label="Fechar"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Toolbar de Controles Rápidos */}
        <div
          className={`px-5 py-2.5 border-b border-inherit flex flex-wrap items-center justify-between gap-3 text-xs shrink-0 ${
            isDark ? 'bg-zinc-950/60' : 'bg-zinc-50/80'
          }`}
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAutoTrim}
              className={`px-2.5 py-1.5 rounded-lg border font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                isDark
                  ? 'bg-zinc-900 hover:bg-zinc-800 border-zinc-700 text-zinc-200'
                  : 'bg-white hover:bg-zinc-100 border-zinc-300 text-zinc-800'
              }`}
              title="Enquadrar automaticamente as bordas do logotipo"
            >
              <Maximize2 className="size-3.5 text-amber-400" />
              <span>Enquadrar Símbolo</span>
            </button>

            <button
              type="button"
              onClick={handleSelectAll}
              className={`px-2.5 py-1.5 rounded-lg border font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                isDark
                  ? 'bg-zinc-900 hover:bg-zinc-800 border-zinc-700 text-zinc-200'
                  : 'bg-white hover:bg-zinc-100 border-zinc-300 text-zinc-800'
              }`}
              title="Selecionar imagem completa"
            >
              <RotateCcw className="size-3 text-zinc-400" />
              <span>Imagem Inteira</span>
            </button>

            <button
              type="button"
              onClick={() => setIsEyedropperActive(!isEyedropperActive)}
              className={`px-2.5 py-1.5 rounded-lg border font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                isEyedropperActive
                  ? isDark
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                    : 'bg-amber-100 border-amber-400 text-amber-900'
                  : isDark
                  ? 'bg-zinc-900 hover:bg-zinc-800 border-zinc-700 text-zinc-200'
                  : 'bg-white hover:bg-zinc-100 border-zinc-300 text-zinc-800'
              }`}
              title="Ativar pipeta para clicar em um pixel específico da logo"
            >
              <Pipette className="size-3.5 text-amber-400" />
              <span>{isEyedropperActive ? 'Pipeta Ativa (clique na logo)' : 'Pipeta'}</span>
            </button>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer select-none text-[11px] text-zinc-400 hover:text-zinc-200">
              <input
                type="checkbox"
                checked={ignoreDark}
                onChange={handleToggleIgnoreDark}
                className="rounded border-zinc-700 text-amber-500 focus:ring-amber-500 bg-zinc-900 size-3.5"
              />
              <span>Ignorar bordas pretas / escuras</span>
            </label>

            {isExtracting && (
              <div className="flex items-center gap-1.5 text-amber-400 text-[11px]">
                <Sparkles className="size-3 animate-spin" />
                <span>Atualizando cores...</span>
              </div>
            )}
          </div>
        </div>

        {/* Viewport da Imagem com Caixa de Seleção */}
        <div
          ref={containerRef}
          className="flex-1 min-h-[300px] max-h-[50vh] p-6 flex items-center justify-center overflow-hidden relative bg-zinc-950/90"
          style={{
            backgroundImage: `linear-gradient(45deg, ${isDark ? '#141418' : '#e4e4e7'} 25%, transparent 25%), linear-gradient(-45deg, ${isDark ? '#141418' : '#e4e4e7'} 25%, transparent 25%), linear-gradient(45deg, transparent 75%, ${isDark ? '#141418' : '#e4e4e7'} 75%), linear-gradient(-45deg, transparent 75%, ${isDark ? '#141418' : '#e4e4e7'} 75%)`,
            backgroundSize: '16px 16px',
            backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
          }}
        >
          <div
            className="relative inline-block max-h-full max-w-full shadow-2xl rounded-lg overflow-hidden border border-zinc-800"
            onMouseDown={handleBackgroundMouseDown}
            style={{ cursor: isEyedropperActive ? 'crosshair' : 'default' }}
          >
            <img
              ref={imgRef}
              src={imageSrc}
              alt="Logo para recorte"
              className="max-h-[46vh] max-w-full object-contain pointer-events-none block"
              draggable={false}
            />

            {/* Máscara escura fora do recorte */}
            {!isEyedropperActive && (
              <>
                {/* Top mask */}
                <div
                  className="absolute left-0 top-0 w-full bg-black/60 pointer-events-none"
                  style={{ height: `${crop.y * 100}%` }}
                />
                {/* Bottom mask */}
                <div
                  className="absolute left-0 w-full bg-black/60 pointer-events-none"
                  style={{
                    top: `${(crop.y + crop.height) * 100}%`,
                    bottom: 0,
                  }}
                />
                {/* Left mask */}
                <div
                  className="absolute left-0 bg-black/60 pointer-events-none"
                  style={{
                    top: `${crop.y * 100}%`,
                    height: `${crop.height * 100}%`,
                    width: `${crop.x * 100}%`,
                  }}
                />
                {/* Right mask */}
                <div
                  className="absolute right-0 bg-black/60 pointer-events-none"
                  style={{
                    top: `${crop.y * 100}%`,
                    height: `${crop.height * 100}%`,
                    left: `${(crop.x + crop.width) * 100}%`,
                  }}
                />

                {/* Retângulo de Seleção Ativo */}
                <div
                  className="absolute border-2 border-amber-400 bg-amber-400/10 shadow-[0_0_0_1px_rgba(0,0,0,0.8)] cursor-move"
                  style={{
                    left: `${crop.x * 100}%`,
                    top: `${crop.y * 100}%`,
                    width: `${crop.width * 100}%`,
                    height: `${crop.height * 100}%`,
                  }}
                  onMouseDown={(e) => handleMouseDown('move', e)}
                >
                  {/* Linhas de grade estilo terços fotográficos */}
                  <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-40">
                    <div className="border-r border-b border-amber-300/40" />
                    <div className="border-r border-b border-amber-300/40" />
                    <div className="border-b border-amber-300/40" />
                    <div className="border-r border-b border-amber-300/40" />
                    <div className="border-r border-b border-amber-300/40" />
                    <div className="border-b border-amber-300/40" />
                    <div className="border-r border-amber-300/40" />
                    <div className="border-r border-amber-300/40" />
                    <div />
                  </div>

                  {/* Alças de Redimensionamento (8 pontos) */}
                  <div
                    className="absolute -top-1.5 -left-1.5 size-3 bg-amber-400 border border-black rounded-sm cursor-nwse-resize"
                    onMouseDown={(e) => handleMouseDown('nw', e)}
                  />
                  <div
                    className="absolute -top-1.5 left-1/2 -translate-x-1/2 size-3 bg-amber-400 border border-black rounded-sm cursor-ns-resize"
                    onMouseDown={(e) => handleMouseDown('n', e)}
                  />
                  <div
                    className="absolute -top-1.5 -right-1.5 size-3 bg-amber-400 border border-black rounded-sm cursor-nesw-resize"
                    onMouseDown={(e) => handleMouseDown('ne', e)}
                  />
                  <div
                    className="absolute top-1/2 -right-1.5 -translate-y-1/2 size-3 bg-amber-400 border border-black rounded-sm cursor-ew-resize"
                    onMouseDown={(e) => handleMouseDown('e', e)}
                  />
                  <div
                    className="absolute -bottom-1.5 -right-1.5 size-3 bg-amber-400 border border-black rounded-sm cursor-nwse-resize"
                    onMouseDown={(e) => handleMouseDown('se', e)}
                  />
                  <div
                    className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 size-3 bg-amber-400 border border-black rounded-sm cursor-ns-resize"
                    onMouseDown={(e) => handleMouseDown('s', e)}
                  />
                  <div
                    className="absolute -bottom-1.5 -left-1.5 size-3 bg-amber-400 border border-black rounded-sm cursor-nesw-resize"
                    onMouseDown={(e) => handleMouseDown('sw', e)}
                  />
                  <div
                    className="absolute top-1/2 -left-1.5 -translate-y-1/2 size-3 bg-amber-400 border border-black rounded-sm cursor-ew-resize"
                    onMouseDown={(e) => handleMouseDown('w', e)}
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Rodapé: Cores Extraídas & Atribuição de Slots */}
        <div className="p-5 border-t border-inherit flex flex-col gap-4 shrink-0">
          {/* Três Cores da Marca */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                <span>Paleta Cromática Resultante</span>
                <span className="text-[10px] text-zinc-500 font-normal">
                  (Clique em um slot para direcionar a pipeta ou uma amostra)
                </span>
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {/* Cor Primária */}
              <button
                type="button"
                onClick={() => setActiveSlot('primary')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                  activeSlot === 'primary'
                    ? isDark
                      ? 'bg-zinc-800/80 border-amber-400 ring-1 ring-amber-400/40'
                      : 'bg-zinc-100 border-amber-500 ring-1 ring-amber-500/40'
                    : isDark
                    ? 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'
                    : 'bg-zinc-50 border-zinc-200 hover:border-zinc-300'
                }`}
              >
                <div
                  className="size-8 rounded-lg shadow-sm border border-white/20 shrink-0"
                  style={{ backgroundColor: primaryColor }}
                />
                <div className="min-w-0">
                  <div className="text-[10px] uppercase font-semibold text-zinc-400">
                    Cor Primária
                  </div>
                  <div className="text-xs font-mono font-medium truncate">
                    {primaryColor}
                  </div>
                </div>
              </button>

              {/* Cor Secundária */}
              <button
                type="button"
                onClick={() => setActiveSlot('secondary')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                  activeSlot === 'secondary'
                    ? isDark
                      ? 'bg-zinc-800/80 border-amber-400 ring-1 ring-amber-400/40'
                      : 'bg-zinc-100 border-amber-500 ring-1 ring-amber-500/40'
                    : isDark
                    ? 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'
                    : 'bg-zinc-50 border-zinc-200 hover:border-zinc-300'
                }`}
              >
                <div
                  className="size-8 rounded-lg shadow-sm border border-white/20 shrink-0"
                  style={{ backgroundColor: secondaryColor }}
                />
                <div className="min-w-0">
                  <div className="text-[10px] uppercase font-semibold text-zinc-400">
                    Cor Secundária
                  </div>
                  <div className="text-xs font-mono font-medium truncate">
                    {secondaryColor}
                  </div>
                </div>
              </button>

              {/* Cor Terciária */}
              <button
                type="button"
                onClick={() => setActiveSlot('accent')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                  activeSlot === 'accent'
                    ? isDark
                      ? 'bg-zinc-800/80 border-amber-400 ring-1 ring-amber-400/40'
                      : 'bg-zinc-100 border-amber-500 ring-1 ring-amber-500/40'
                    : isDark
                    ? 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'
                    : 'bg-zinc-50 border-zinc-200 hover:border-zinc-300'
                }`}
              >
                <div
                  className="size-8 rounded-lg shadow-sm border border-white/20 shrink-0"
                  style={{ backgroundColor: tertiaryColor }}
                />
                <div className="min-w-0">
                  <div className="text-[10px] uppercase font-semibold text-zinc-400">
                    Cor Terciária
                  </div>
                  <div className="text-xs font-mono font-medium truncate">
                    {tertiaryColor}
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Amostras Detectadas na Seleção */}
          {detectedSwatches.length > 0 && (
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[11px] text-zinc-400 shrink-0">
                Amostras da área:
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {detectedSwatches.map((hex, i) => (
                  <button
                    key={`${hex}-${i}`}
                    type="button"
                    onClick={() => applyColorToActiveSlot(hex)}
                    className="size-6 rounded-md border border-white/20 shadow-xs hover:scale-115 transition-transform cursor-pointer relative group"
                    style={{ backgroundColor: hex }}
                    title={`Aplicar ${hex} em ${getSlotLabel(activeSlot)}`}
                  >
                    <span className="sr-only">{hex}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Ações e Opção de Salvar Logo Recortado */}
          <div className="flex items-center justify-between pt-2 border-t border-inherit">
            <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-zinc-300">
              <input
                type="checkbox"
                checked={shouldCropLogo}
                onChange={(e) => setShouldCropLogo(e.target.checked)}
                className="rounded border-zinc-700 text-amber-500 focus:ring-amber-500 bg-zinc-900 size-4"
              />
              <span>Atualizar arquivo do logotipo com esta área recortada</span>
            </label>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className={`px-4 py-2 rounded-xl border text-xs font-medium transition-colors cursor-pointer ${
                  isDark
                    ? 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-300'
                    : 'bg-white hover:bg-zinc-100 border-zinc-300 text-zinc-700'
                }`}
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={isApplying}
                onClick={handleConfirm}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-lg shadow-amber-500/20 cursor-pointer disabled:opacity-50"
              >
                <Check className="size-3.5 stroke-[2.5]" />
                <span>{isApplying ? 'Aplicando...' : 'Aplicar Paleta e Concluir'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
