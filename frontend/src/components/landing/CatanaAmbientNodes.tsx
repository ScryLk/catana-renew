import type { FC } from 'react';

/**
 * CatanaAmbientNodes
 * Micro-elementos gráficos geométricos (cruzes de precisão, nós e círculos concêntricos)
 * que flutuam suavemente no plano de fundo, recriando a atmosfera de laboratório de shawnlukas.com.
 */
export const CatanaAmbientNodes: FC = () => {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
      {/* Nó 1: Círculo Segmentado */}
      <div className="absolute top-[6%] left-[48%] animate-[floatOne_7s_ease-in-out_infinite] opacity-25">
        <svg width="12" height="12" viewBox="0 0 10 10">
          <path
            fill="#a1a1aa"
            d="M5 10C7.76142 10 10 7.76142 10 5H8C8 6.65685 6.65685 8 5 8V10ZM10 5C10 2.23858 7.76142 0 5 0V2C6.65685 2 8 3.34315 8 5H10ZM5 0C2.23858 0 0 2.23858 0 5H2C2 3.34315 3.34315 2 5 2V0ZM0 5C0 7.76142 2.23858 10 5 10V8C3.34315 8 2 6.65685 2 5H0Z"
          />
        </svg>
      </div>

      {/* Nó 2: Cruz Diagonal */}
      <div className="absolute top-[22%] left-[72%] animate-[floatTwo_8s_ease-in-out_infinite] opacity-20">
        <svg width="14" height="14" viewBox="0 0 11 11">
          <path
            fill="#EEEEEE"
            d="M2.731 0.817L2.048 0.086L0.586 1.451L1.269 2.182L2.731 0.817ZM8.054 9.451L8.737 10.182L10.199 8.817L9.516 8.086L8.054 9.451ZM1.269 2.182L8.054 9.451L9.516 8.086L2.731 0.817L1.269 2.182Z"
          />
        </svg>
      </div>

      {/* Nó 3: Losango Rotativo */}
      <div className="absolute top-[48%] left-[75%] animate-[floatOne_9s_ease-in-out_infinite] opacity-20">
        <svg width="12" height="12" viewBox="0 0 11 11">
          <path
            fill="#a1a1aa"
            d="M3.07 2L3.25 1.01L2.27 0.83L2.09 1.82L3.07 2ZM9 3.07L9.98 3.25L10.16 2.27L9.17 2.09L9 3.07ZM7.92 9L7.74 9.98L8.72 10.16L8.9 9.17L7.92 9ZM2 7.92L1.01 7.74L0.83 8.72L1.82 8.9L2 7.92Z"
          />
        </svg>
      </div>

      {/* Nó 4: Ponto Quântico */}
      <div className="absolute top-[88%] left-[68%] animate-[floatTwo_7.5s_ease-in-out_infinite] opacity-20">
        <svg width="10" height="10" viewBox="0 0 10 10">
          <circle cx="5" cy="5" r="3" fill="#EEEEEE" />
        </svg>
      </div>

      {/* Nó 5: Mira Esquerda */}
      <div className="absolute top-[18%] left-[22%] animate-[floatOne_6.5s_ease-in-out_infinite] opacity-20">
        <svg width="14" height="14" viewBox="0 0 12 14">
          <path
            fill="#a1a1aa"
            d="M10.37 2.41L11.37 2.52L11.6 0.28L9.78 1.61L10.37 2.41ZM9.34 12.21L8.84 13.07L10.17 13.84L10.33 12.31L9.34 12.21ZM2.41 8.21L1.82 7.4L0.57 8.3L1.91 9.07L2.41 8.21Z"
          />
        </svg>
      </div>

      {/* Nó 6: Ponto Lateral */}
      <div className="absolute top-[62%] left-[28%] animate-[floatTwo_8.5s_ease-in-out_infinite] opacity-20">
        <svg width="10" height="10" viewBox="0 0 10 10">
          <rect x="2" y="2" width="6" height="6" fill="#EEEEEE" />
        </svg>
      </div>
    </div>
  );
};
