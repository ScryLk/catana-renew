import { useState, useRef, type FC, type MouseEvent as ReactMouseEvent } from 'react';
import { catanaAudio } from './CatanaAudioEngine';

interface KnobParam {
  id: string;
  name: string;
  shortLabel: string;
  unit: string;
  min: number;
  max: number;
  value: number;
  defaultValue: number;
}

interface CatanaKnobControlsProps {
  isLightMode: boolean;
  onParamChange?: (paramId: string, value: number) => void;
}

export const CatanaKnobControls: FC<CatanaKnobControlsProps> = ({ isLightMode, onParamChange }) => {
  const [params, setParams] = useState<KnobParam[]>([
    {
      id: 'whitespace',
      name: 'Respiro Negativo',
      shortLabel: 'R',
      unit: '%',
      min: 20,
      max: 85,
      value: 65,
      defaultValue: 65,
    },
    {
      id: 'density',
      name: 'Densidade de Grid',
      shortLabel: 'D',
      unit: 'cols',
      min: 2,
      max: 12,
      value: 6,
      defaultValue: 6,
    },
    {
      id: 'tension',
      name: 'Tensão Editorial',
      shortLabel: 'T',
      unit: '%',
      min: 10,
      max: 100,
      value: 80,
      defaultValue: 80,
    },
  ]);

  const activeDragRef = useRef<{
    paramId: string;
    startY: number;
    startVal: number;
  } | null>(null);

  const handleMouseDown = (param: KnobParam, e: ReactMouseEvent) => {
    e.preventDefault();
    activeDragRef.current = {
      paramId: param.id,
      startY: e.clientY,
      startVal: param.value,
    };

    const handleMouseMove = (moveEvent: globalThis.MouseEvent) => {
      if (!activeDragRef.current) return;
      const deltaY = activeDragRef.current.startY - moveEvent.clientY;
      const range = param.max - param.min;
      const stepValue = (deltaY / 150) * range;
      const rawVal = activeDragRef.current.startVal + stepValue;
      const clampedVal = Math.round(Math.max(param.min, Math.min(param.max, rawVal)));

      setParams((prev) =>
        prev.map((p) => {
          if (p.id === param.id) {
            const normalized = (clampedVal - p.min) / (p.max - p.min);
            catanaAudio.playKnobTick(normalized);
            if (onParamChange) onParamChange(p.id, clampedVal);
            return { ...p, value: clampedVal };
          }
          return p;
        })
      );
    };

    const handleMouseUp = () => {
      activeDragRef.current = null;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleKeyDown = (param: KnobParam, e: React.KeyboardEvent) => {
    let newVal = param.value;
    const step = param.unit === 'cols' ? 1 : 5;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
      e.preventDefault();
      newVal = Math.min(param.max, param.value + step);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
      e.preventDefault();
      newVal = Math.max(param.min, param.value - step);
    } else if (e.key === 'Home') {
      e.preventDefault();
      newVal = param.min;
    } else if (e.key === 'End') {
      e.preventDefault();
      newVal = param.max;
    } else {
      return;
    }

    setParams((prev) =>
      prev.map((p) => {
        if (p.id === param.id) {
          const normalized = (newVal - p.min) / (p.max - p.min);
          catanaAudio.playKnobTick(normalized);
          if (onParamChange) onParamChange(p.id, newVal);
          return { ...p, value: newVal };
        }
        return p;
      })
    );
  };

  return (
    <div className="flex items-center justify-center gap-8 select-none my-6" role="group" aria-label="Ajustes Paramétricos do Atelier">
      {params.map((param) => {
        // Mapeia valor para rotação de -140° a +140°
        const normalized = (param.value - param.min) / (param.max - param.min);
        const rotationDeg = -140 + normalized * 280;

        return (
          <div key={param.id} className="relative flex flex-col items-center group cursor-ns-resize">
            {/* Tooltip com Nome e Valor */}
            <div
              className={`absolute -top-10 px-2 py-1 text-[11px] font-mono rounded opacity-0 pointer-events-none transition-opacity duration-150 group-hover:opacity-100 whitespace-nowrap z-20 shadow-md ${
                isLightMode ? 'bg-[#1A1817] text-[#F8F6F1]' : 'bg-[#1E1E24] text-[#EEEEEE] border border-[#3C3C3C]'
              }`}
            >
              {param.name}: {param.value}{param.unit}
            </div>

            {/* Dial Giratório de Alta Precisão */}
            <div
              role="slider"
              tabIndex={0}
              aria-label={param.name}
              aria-valuemin={param.min}
              aria-valuemax={param.max}
              aria-valuenow={param.value}
              aria-valuetext={`${param.value} ${param.unit}`}
              onKeyDown={(e) => handleKeyDown(param, e)}
              onMouseDown={(e) => handleMouseDown(param, e)}
              className={`relative w-10 h-10 rounded-full border-2 transition-transform duration-75 active:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 ${
                isLightMode
                  ? 'border-[#1A1817] bg-[#F8F6F1] focus-visible:ring-offset-[#F8F6F1]'
                  : 'border-[#EEEEEE] bg-[#070709] focus-visible:ring-offset-[#070709]'
              }`}
            >
              {/* Régua de Graus Circular (Efeito de Estilo da Referência) */}
              <div
                className="absolute -inset-1 rounded-full border border-dashed border-[rgba(136,136,136,0.3)] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
              />

              {/* Ponteiro Indicador da Agulha */}
              <div
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
                style={{ transform: `rotate(${rotationDeg}deg)` }}
              >
                <div
                  className={`w-[2px] h-3.5 -translate-y-2 rounded-full ${
                    isLightMode ? 'bg-zinc-800' : 'bg-zinc-200'
                  }`}
                />
              </div>

              {/* Hub Central */}
              <div
                className={`absolute inset-0 m-auto w-2 h-2 rounded-full ${
                  isLightMode ? 'bg-[#1A1817]' : 'bg-[#EEEEEE]'
                }`}
              />
            </div>

            {/* Rótulo da Letra (R, D, T) e Valor Numérico */}
            <div className="flex flex-col items-center mt-2">
              <span
                className={`font-mono text-xs font-semibold tracking-wider ${
                  isLightMode ? 'text-zinc-700' : 'text-zinc-300'
                }`}
              >
                {param.shortLabel}
              </span>
              <span className={`font-mono text-[10px] ${isLightMode ? 'text-zinc-600' : 'text-zinc-400'}`}>
                {param.value}{param.unit}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
