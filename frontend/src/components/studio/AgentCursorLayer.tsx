import React, { useEffect, useState } from 'react';
import { useStudioStore } from '../../store/studioStore';
import { AgentCursor } from '../../types/agentCursor';

interface AgentCursorLayerProps {
  cursorsOverride?: AgentCursor[];
  className?: string;
}

interface SingleCursorPointerProps {
  cursor: AgentCursor;
}

const SingleCursorPointer: React.FC<SingleCursorPointerProps> = ({ cursor }) => {
  const [pos, setPos] = useState({
    x: cursor.startX ?? cursor.x,
    y: cursor.startY ?? cursor.y,
  });

  useEffect(() => {
    // Deslocamento sutil e fluido da origem ao destino
    const raf = requestAnimationFrame(() => {
      setPos({ x: cursor.x, y: cursor.y });
    });

    return () => {
      cancelAnimationFrame(raf);
    };
  }, [cursor.x, cursor.y, cursor.startX, cursor.startY]);

  return (
    <div
      className="absolute transform -translate-x-1 -translate-y-1 transition-all duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] will-change-[left,top]"
      style={{
        left: `${pos.x}%`,
        top: `${pos.y}%`,
      }}
    >
      {/* Sutil anel de foco no ponto de acao */}
      {cursor.isActing && (
        <span
          className="absolute -top-1 -left-1 w-6 h-6 rounded-full opacity-30 animate-ping pointer-events-none"
          style={{ backgroundColor: cursor.color }}
        />
      )}

      {/* Seta vetorial do cursor no formato Figma / Linear elegante e discreto (20px) */}
      <svg
        className="w-5 h-5 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M5.65376 12.3673H5.46026L5.31717 12.4976L0.500002 16.8829L0.500002 1.19841L11.7841 12.3673H5.65376Z"
          fill={cursor.color}
          stroke="#09090b"
          strokeWidth="1.2"
        />
      </svg>

      {/* Cracha discreto do Agente & Acao */}
      <div className="absolute left-4 top-3 flex flex-col items-start gap-1 pointer-events-none drop-shadow-md animate-in fade-in zoom-in-95 duration-150">
        {/* Nome do Especialista */}
        <div
          className="flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold tracking-tight text-white shadow-sm border border-white/20 whitespace-nowrap"
          style={{ backgroundColor: cursor.color }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-white/80 shrink-0" />
          <span>{cursor.name}</span>
        </div>

        {/* Pilula de acao contextual sutil */}
        {cursor.actionText && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-medium bg-[#141418]/90 text-zinc-300 border border-zinc-800/80 shadow-md backdrop-blur-sm whitespace-nowrap">
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse shrink-0"
              style={{ backgroundColor: cursor.color }}
            />
            <span className="truncate max-w-[240px]">{cursor.actionText}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export const AgentCursorLayer: React.FC<AgentCursorLayerProps> = ({
  cursorsOverride,
  className = '',
}) => {
  const storeCursors = useStudioStore((s) => s.activeAgentCursors);
  const cursors = cursorsOverride || storeCursors;

  if (!cursors || cursors.length === 0) return null;

  return (
    <div
      className={`absolute inset-0 pointer-events-none z-40 overflow-visible select-none ${className}`}
      aria-hidden="true"
    >
      {/* Estilos para o trajeto sutil */}
      <style>{`
        @keyframes agentSubtleDash {
          to {
            stroke-dashoffset: -16;
          }
        }
        .agent-subtle-dash {
          animation: agentSubtleDash 1.2s linear infinite;
        }
      `}</style>

      {/* Trajetos sutis em curva conectando origem ao destino */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none z-30 overflow-visible"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        {cursors.map((cursor) => {
          const sX = cursor.startX ?? cursor.x;
          const sY = cursor.startY ?? cursor.y;
          const eX = cursor.x;
          const eY = cursor.y;

          const dist = Math.hypot(eX - sX, eY - sY);
          if (dist < 2) return null;

          // Curva suave em arco sutil
          const dx = eX - sX;
          const dy = eY - sY;
          const midX = (sX + eX) / 2 - dy * 0.12;
          const midY = (sY + eY) / 2 + dx * 0.12;
          const pathD = `M ${sX} ${sY} Q ${midX} ${midY} ${eX} ${eY}`;

          return (
            <g key={`traj-${cursor.id}`}>
              {/* Linha pontilhada delicada indicando o trajeto */}
              <path
                d={pathD}
                fill="none"
                stroke={cursor.color}
                strokeWidth="1.2"
                strokeOpacity="0.45"
                strokeDasharray="3 3"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                className="agent-subtle-dash"
              />

              {/* Ponto inicial discreto */}
              <circle
                cx={sX}
                cy={sY}
                r="0.8"
                fill={cursor.color}
                opacity="0.5"
                vectorEffect="non-scaling-stroke"
              />

              {/* Ponto de destino sutil */}
              <circle
                cx={eX}
                cy={eY}
                r="1.2"
                fill="none"
                stroke={cursor.color}
                strokeWidth="1"
                strokeOpacity="0.6"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          );
        })}
      </svg>

      {/* Cursores com cracha e movimento suave */}
      {cursors.map((cursor) => (
        <SingleCursorPointer key={cursor.id} cursor={cursor} />
      ))}
    </div>
  );
};
