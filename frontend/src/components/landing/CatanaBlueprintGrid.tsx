import type { FC } from 'react';

interface CatanaBlueprintGridProps {
  isGridActive?: boolean;
}

/**
 * CatanaBlueprintGrid
 * Recreação de alta fidelidade da matriz gráfica de shawnlukas.com:
 * - Malha de fundo pontilhada radial de 14px x 14px.
 * - 9 colunas verticais com cotas numéricas rotacionadas a 90° ('300', '800', '900', '200').
 * - Modo Grid X-Ray técnico ativável em ouro editorial (#C5A059).
 */
export const CatanaBlueprintGrid: FC<CatanaBlueprintGridProps> = ({ isGridActive = false }) => {
  return (
    <div
      className={`fixed inset-0 pointer-events-none z-0 transition-opacity duration-300 ${
        isGridActive ? 'opacity-100' : 'opacity-60'
      }`}
      aria-hidden="true"
    >
      {/* Matriz Pontilhada Subjacente */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: 'radial-gradient(rgba(136, 136, 136, 0.08) 1px, transparent 1px)',
          backgroundSize: '14px 14px',
        }}
      />

      {/* Grid de 9 Colunas com Limites Laterais */}
      <div className="relative max-w-[1336px] h-full mx-auto border-x border-[rgba(136,136,136,0.1)] flex justify-between">
        {/* Cota Lateral Esquerda 300 */}
        <span
          className="hidden md:block absolute left-[-18px] top-[40%] text-[10px] tracking-widest font-mono text-[rgba(170,170,170,0.3)] rotate-90 select-none"
        >
          300
        </span>

        {/* Cota Lateral Direita 800 */}
        <span
          className="hidden md:block absolute right-[-18px] top-[60%] text-[10px] tracking-widest font-mono text-[rgba(170,170,170,0.3)] rotate-90 select-none"
        >
          800
        </span>

        {/* 9 Colunas Proporcionais com réguas */}
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((colIndex) => {
          // Cotas internas em colunas específicas (como na referência)
          const hasCota900 = colIndex === 1;
          const hasCota200 = colIndex === 7;

          return (
            <div
              key={colIndex}
              className={`relative flex-1 h-full border-r border-[rgba(136,136,136,0.08)] ${
                colIndex === 8 ? 'border-r-0' : ''
              } ${isGridActive ? 'bg-white/[0.02] border-white/20' : ''}`}
            >
              {hasCota900 && (
                <span className="hidden md:block absolute left-2 top-[75%] text-[10px] tracking-widest font-mono text-[rgba(170,170,170,0.3)] rotate-90 select-none">
                  900
                </span>
              )}
              {hasCota200 && (
                <span className="hidden md:block absolute right-2 top-[30%] text-[10px] tracking-widest font-mono text-[rgba(170,170,170,0.3)] rotate-90 select-none">
                  200
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Marcações adicionais quando Grid X-Ray ativo */}
      {isGridActive && (
        <div className="absolute inset-0 border-2 border-white/20 pointer-events-none">
          <div className="max-w-[996px] h-full mx-auto border-x border-dashed border-white/25" />
        </div>
      )}
    </div>
  );
};
