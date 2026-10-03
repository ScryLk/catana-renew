/**
 * CatanaTasteFilter.tsx
 * ATO 06 — THE TASTE FILTER / REJECTION
 *
 * Demonstração visual e interativa do filtro de bom gosto do Catana:
 * O sistema detecta e REJEITA ativamente templates genéricos, gradientes decorativos de IA,
 * cartões repetitivos estilo SaaS e clichês de marketing, elevando a composição ao nível
 * de publicação de alto luxo.
 */

import { useState, type FC } from 'react';
import { catanaAudio } from './CatanaAudioEngine';

interface CatanaTasteFilterProps {
  isLightMode: boolean;
}

export const CatanaTasteFilter: FC<CatanaTasteFilterProps> = ({ isLightMode }) => {
  const [activeTab, setActiveTab] = useState<'slop' | 'editorial'>('editorial');
  const [inspectedViolation, setInspectedViolation] = useState<number | null>(null);

  const violations = [
    {
      label: 'GRADIENTE VIOLETA DECORATIVO',
      rule: 'VIOLATION · SEMIOTIC_EMPTY',
      detail: 'Gradientes roxos flutuantes sem ancoragem têxtil ou tipográfica. Poluição cromática que destrói o prestígio da marca.',
    },
    {
      label: 'CARDS ARREDONDADOS BENTO / SAAS',
      rule: 'VIOLATION · TEMPLATE_INERTIA',
      detail: 'Estrutura de 3 colunas idênticas com cantos arredondados de 16px. Não reflete proporção editorial nem hierarquia visual.',
    },
    {
      label: 'EMOJIS & ADJETIVOS VAZIOS',
      rule: 'VIOLATION · INFANTILE_TONE',
      detail: 'Uso de “✨ Revolucionário” e “🔥 Incrível”. Redação clichê gerada por LLM padrão sem curadoria humana.',
    },
    {
      label: 'FALHA DE CONTRASTE (2.8:1)',
      rule: 'VIOLATION · WCAG_FAIL',
      detail: 'Texto cinza claro sobre fundo com gradiente. Ilegível para compradores em dispositivos móveis e fora do padrão de impressão.',
    },
  ];

  return (
    <section className="relative max-w-[1240px] mx-auto py-20 px-4 select-none z-10">
      {/* Marcador de Ato e Régua de Seção */}
      <div className="flex items-center gap-4 mb-8">
        <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-zinc-400">
          ACT 06 · THE TASTE FILTER &amp; ARBITRATION
        </span>
        <div className="flex-1 h-[1px] bg-[rgba(136,136,136,0.18)]" />
        <span className="font-mono text-[10px] tracking-widest text-zinc-400">
          ALGORITHM: ANTI-SLOP DETERMINISTIC 2.0
        </span>
      </div>

      {/* Cabeçalho do Ato */}
      <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-6 mb-12">
        <div>
          <h2
            className={`font-serif text-3xl sm:text-4xl md:text-5xl font-normal leading-[1.05] tracking-tight ${
              isLightMode ? 'text-[#1A1817]' : 'text-[#EEEEEE]'
            }`}
          >
            O que recusamos define
            <br />
            <span className="font-light italic text-zinc-400">quem somos.</span>
          </h2>
          <p className="text-sm font-sans font-light text-zinc-400 max-w-[580px] leading-relaxed mt-2">
            A maioria das ferramentas de IA gera layouts fáceis: gradientes violetas flutuantes, cards arredondados
            idênticos e emojis infantis. O Catana possui um <strong>Filtro de Bom Gosto Algorítmico</strong> que audita,
            rejeita a preguiça estética e impõe rigor de atelier de arte.
          </p>
        </div>

        {/* Chave Seletora Tátil: Slop vs Editorial */}
        <div
          role="tablist"
          aria-label="Filtro de Bom Gosto: Clichê de IA vs Padrão Atelier"
          className="flex items-center p-1 rounded-sm border border-[rgba(136,136,136,0.25)] bg-[rgba(136,136,136,0.05)] backdrop-blur-sm"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'slop'}
            onClick={() => {
              setActiveTab('slop');
              catanaAudio.playTactileClick(500);
            }}
            className={`px-4 py-2 font-mono text-xs tracking-wider uppercase transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 ${
              activeTab === 'slop'
                ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            [01] O Clichê Genérico (IA Comum)
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'editorial'}
            onClick={() => {
              setActiveTab('editorial');
              catanaAudio.playTactileClick(880);
            }}
            className={`px-4 py-2 font-mono text-xs tracking-wider uppercase transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${
              activeTab === 'editorial'
                ? isLightMode
                  ? 'bg-zinc-900 text-zinc-100 shadow-sm'
                  : 'bg-zinc-100 text-zinc-950 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            [02] O Padrão Catana (Atelier)
          </button>
        </div>
      </div>

      {/* Visualizador de Julgamento */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        {/* Painel Principal de Prova Gráfica (8 Colunas) */}
        <div
          className={`lg:col-span-8 relative border rounded-sm p-6 sm:p-10 transition-all duration-500 min-h-[460px] flex flex-col justify-between overflow-hidden ${
            activeTab === 'slop'
              ? 'border-red-500/30 bg-red-950/[0.04]'
              : isLightMode
              ? 'border-zinc-300 bg-[#FFFFFF] shadow-lg'
              : 'border-zinc-800 bg-[#0B0B0E] shadow-2xl'
          }`}
        >
          {/* Fundo / Marca d'água técnica */}
          <div className="absolute top-3 left-4 font-mono text-[9px] tracking-widest text-zinc-500 uppercase">
            {activeTab === 'slop'
              ? 'SIMULATED BUFFER · CANVA / GENERIC AI SAAS'
              : 'PRODUCTION BUFFER · CATANA EDITORIAL MATRIX 12-COL'}
          </div>

          <div className="absolute top-3 right-4 font-mono text-[9px] tracking-widest text-zinc-500 uppercase">
            {activeTab === 'slop' ? 'STATUS: REJECTED (ERR_TASTE_04)' : 'STATUS: CERTIFIED (WCAG_AAA · 300 DPI)'}
          </div>

          {/* Conteúdo Dinâmico com base na Seleção */}
          {activeTab === 'slop' ? (
            <div className="relative my-auto py-8">
              {/* Carimbo de Rejeição Monumental */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                <div className="rotate-[-12deg] border-4 border-red-600/80 bg-red-950/40 backdrop-blur-xs px-8 py-4 text-center transform shadow-2xl">
                  <div className="font-mono text-xs tracking-[0.3em] uppercase text-red-300 font-bold">
                    ATELIER TASTE ARBITRATION
                  </div>
                  <div className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-red-500 my-1">
                    REJEITADO POR CLICHÊ
                  </div>
                  <div className="font-mono text-[10px] tracking-widest text-red-400">
                    ERR: SLOP DETECTED · ZERO EDITORIAL TENSION
                  </div>
                </div>
              </div>

              {/* A Prova Falsa / Clichê de IA */}
              <div className="opacity-40 filter blur-[0.5px] max-w-xl mx-auto space-y-6">
                {/* Gradiente roxo falso */}
                <div className="h-32 rounded-2xl bg-gradient-to-r from-purple-600/30 via-pink-500/30 to-indigo-600/30 p-6 flex flex-col justify-end border border-purple-500/20">
                  <div className="text-xl font-bold text-white tracking-wide">
                    ✨ Descubra a Nova Coleção Inovadora! 🔥
                  </div>
                  <div className="text-xs text-purple-200 mt-1">
                    Compre agora as melhores peças com tecnologia e elegância incomparáveis.
                  </div>
                </div>

                {/* Grid de 3 cards arredondados idênticos */}
                <div className="grid grid-cols-3 gap-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="bg-zinc-800/40 rounded-xl p-4 border border-zinc-700/40 text-center">
                      <div className="w-10 h-10 rounded-full bg-purple-500/20 mx-auto mb-2 flex items-center justify-center text-sm">
                        💎
                      </div>
                      <div className="text-xs font-semibold text-zinc-300">Produto Incrível {i}</div>
                      <div className="text-[10px] text-zinc-500 mt-1">Alta qualidade</div>
                      <div className="text-xs font-bold text-purple-400 mt-2">R$ 99,90</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="relative my-auto py-8">
              {/* Carimbo de Aprovação Editorial */}
              <div className="absolute top-0 right-0 pointer-events-none z-20">
                <div className="rotate-[6deg] border border-zinc-500/40 bg-zinc-900/60 backdrop-blur-xs px-4 py-2 text-right">
                  <div className="font-mono text-[8px] tracking-[0.25em] text-zinc-400 uppercase">CERTIFICADO</div>
                  <div className="font-serif text-sm font-semibold tracking-wider text-zinc-200">STANDARDS ATELIER</div>
                  <div className="font-mono text-[8px] text-zinc-400">14.2:1 AAA · 326 DPI</div>
                </div>
              </div>

              {/* Composição Editorial de Alto Padrão */}
              <div className="max-w-xl mx-auto">
                <div className="flex items-baseline justify-between border-b border-[rgba(136,136,136,0.2)] pb-4 mb-6">
                  <div>
                    <span className="font-mono text-[10px] tracking-[0.2em] text-zinc-400 uppercase">
                      CATALOGUE RAISONNÉ · LIVRE 04
                    </span>
                    <h3
                      className={`font-serif text-2xl sm:text-3xl font-normal tracking-tight mt-1 ${
                        isLightMode ? 'text-zinc-900' : 'text-zinc-100'
                      }`}
                    >
                      Arquitetura em Lã Fria 120s
                    </h3>
                  </div>
                  <span className="font-mono text-xs tracking-widest text-zinc-400 tabular-nums">
                    AUTUMN / WINTER 2027
                  </span>
                </div>

                <div className="grid grid-cols-12 gap-6 items-center">
                  <div className="col-span-7 space-y-4">
                    <p
                      className={`text-xs font-sans leading-relaxed font-light ${
                        isLightMode ? 'text-zinc-600' : 'text-zinc-400'
                      }`}
                    >
                      O corte desce em ângulo reto pela clavícula, sustentado pela estrutura interna em crina de cavalo
                      natural. Sem logotipos visíveis, sem adjetivos vazios. Apenas o peso da fibra e a rigidez do ponto.
                    </p>
                    <div
                      className={`pt-2 flex items-center gap-6 font-mono text-[10px] ${
                        isLightMode ? 'text-zinc-600' : 'text-zinc-400'
                      }`}
                    >
                      <div>
                        <span className={`block ${isLightMode ? 'text-zinc-500' : 'text-zinc-400'}`}>SKU</span>
                        <strong className={`font-normal ${isLightMode ? 'text-zinc-950 font-medium' : 'text-zinc-200'}`}>
                          VRD-BLZ-01
                        </strong>
                      </div>
                      <div className={`w-[1px] h-6 ${isLightMode ? 'bg-zinc-200' : 'bg-zinc-800'}`} />
                      <div>
                        <span className={`block ${isLightMode ? 'text-zinc-500' : 'text-zinc-400'}`}>ATACADO</span>
                        <strong className={`font-normal ${isLightMode ? 'text-zinc-950 font-medium' : 'text-zinc-200'}`}>
                          R$ 1.890,00
                        </strong>
                      </div>
                      <div className={`w-[1px] h-6 ${isLightMode ? 'bg-zinc-200' : 'bg-zinc-800'}`} />
                      <div>
                        <span className={`block ${isLightMode ? 'text-zinc-500' : 'text-zinc-400'}`}>TECIDO</span>
                        <strong className={`font-normal ${isLightMode ? 'text-zinc-950 font-medium' : 'text-zinc-200'}`}>
                          Biella Merino
                        </strong>
                      </div>
                    </div>
                  </div>

                  <div className="col-span-5 relative aspect-[3/4] bg-zinc-900 border border-zinc-800 overflow-hidden flex items-center justify-center">
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-10" />
                    <img
                      src="/media_1790124007956.png"
                      alt="Alfaiataria Catana"
                      className="w-full h-full object-cover grayscale contrast-125"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                    <div className="absolute bottom-2 left-2 z-20 font-mono text-[8px] text-zinc-300 tracking-wider">
                      PROOF 300 DPI · CROP 4:5
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Rodapé do Painel de Prova */}
          <div className="pt-4 border-t border-[rgba(136,136,136,0.15)] flex items-center justify-between font-mono text-[9px] text-zinc-400">
            <span>GRID: DIN A4 (210 × 297 MM)</span>
            <span>KERNING: OPTICAL METRIC</span>
            <span>COLORSPACE: GRAFITE #070709 / MARFIM #F8F6F1</span>
          </div>
        </div>

        {/* Lado Direito: Diagnóstico de Violações e Critérios (4 Colunas) */}
        <div className="lg:col-span-4 flex flex-col justify-between gap-4">
          <div className="space-y-3">
            <div className="font-mono text-[10px] tracking-[0.2em] text-zinc-400 uppercase mb-2">
              DIAGNÓSTICO DETERMINÍSTICO DE ARBITRAGEM
            </div>

            {violations.map((v, idx) => (
              <div
                key={idx}
                role="button"
                tabIndex={0}
                aria-label={`Violação 0${idx + 1}: ${v.label}. ${v.detail}`}
                onMouseEnter={() => {
                  setInspectedViolation(idx);
                  catanaAudio.playTactileClick(600 + idx * 60);
                }}
                onFocus={() => {
                  setInspectedViolation(idx);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setInspectedViolation(idx);
                    catanaAudio.playTactileClick(600 + idx * 60);
                  }
                }}
                className={`p-4 rounded-sm border transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400 ${
                  inspectedViolation === idx
                    ? 'border-zinc-400 bg-zinc-800/20'
                    : 'border-[rgba(136,136,136,0.18)] bg-[rgba(136,136,136,0.02)]'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-[9px] tracking-wider text-red-400 font-medium">
                    {v.rule}
                  </span>
                  <span className="font-mono text-[9px] text-zinc-400">0{idx + 1}</span>
                </div>
                <h4
                  className={`font-mono text-xs font-semibold tracking-wide ${
                    isLightMode ? 'text-zinc-800' : 'text-zinc-200'
                  }`}
                >
                  {v.label}
                </h4>
                <p className="font-sans text-[11px] text-zinc-400 leading-normal mt-1">
                  {v.detail}
                </p>
              </div>
            ))}
          </div>

          <div className="p-4 border border-[rgba(136,136,136,0.18)] bg-[rgba(136,136,136,0.03)] font-mono text-[10px] text-zinc-400 space-y-1">
            <div className="text-zinc-300 font-medium">RESULTADO DA AUDITORIA AUTOMÁTICA:</div>
            <div>• Rejeição de modelos padrão: 100% ativa</div>
            <div>• Preservação de integridade de marca: 10/10</div>
            <div>• Ruído visual gerado por IA: 0.0%</div>
          </div>
        </div>
      </div>
    </section>
  );
};
