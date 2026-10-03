import { forwardRef } from 'react';
import { catanaAudio } from './CatanaAudioEngine';

interface CatanaCardDeckProps {
  isLightMode: boolean;
  onSelectSystem?: (systemId: string) => void;
}

interface SystemCardData {
  id: string;
  issue: string;
  title: string;
  date: string;
  description: string;
  activityPoints: { size: number; count: number; label: string }[];
  category: string;
}

const SYSTEMS_DATA: SystemCardData[] = [
  {
    id: 'system-05',
    issue: '#05',
    title: 'Atelier Multi-Agente',
    date: '19 SET 2026',
    description: 'Coordenação autônoma de Diretor de Arte, Copywriter Sensorial e Curador Comercial com arbitragem executiva.',
    activityPoints: [
      { size: 7, count: 4, label: 'revisões' },
      { size: 10, count: 18, label: 'diretrizes' },
      { size: 6, count: 2, label: 'intervenções' },
      { size: 9, count: 12, label: 'aprovações' },
      { size: 8, count: 9, label: 'artboards' },
    ],
    category: 'GOVERNANÇA & ORQUESTRAÇÃO',
  },
  {
    id: 'system-04',
    issue: '#04',
    title: 'Motor A4 300 DPI',
    date: '16 SET 2026',
    description: 'Diagramação física rigorosa de 794x1123px, proporções áureas, respiro de até 96px e exportação gráfica direta.',
    activityPoints: [
      { size: 8, count: 8, label: 'layouts' },
      { size: 10, count: 24, label: 'pranchetas' },
      { size: 7, count: 6, label: 'grids' },
      { size: 10, count: 32, label: 'vetores' },
      { size: 9, count: 15, label: 'lâminas' },
    ],
    category: 'ENGENHARIA GRÁFICA',
  },
  {
    id: 'system-03',
    issue: '#03',
    title: 'Sistema Tipográfico & Grids',
    date: '12 SET 2026',
    description: 'Cálculo algorítmico de entrelinhas, kerning óptico e hierarquia editorial com Playfair Display, Cormorant e Inter.',
    activityPoints: [
      { size: 6, count: 3, label: 'escalas' },
      { size: 9, count: 14, label: 'variáveis' },
      { size: 7, count: 5, label: 'pesos' },
      { size: 10, count: 21, label: 'contrastes' },
      { size: 7, count: 6, label: 'hífens' },
    ],
    category: 'TIPOGRAFIA EDITORIAL',
  },
  {
    id: 'system-02',
    issue: '#02',
    title: 'Cromatismo & Monocromia',
    date: '08 SET 2026',
    description: 'Paletas puras calibradas para WCAG AAA, preto absoluto (#070709), cinza editorial zinco e marfim (#F8F6F1).',
    activityPoints: [
      { size: 8, count: 7, label: 'harmônicos' },
      { size: 7, count: 4, label: 'amostras' },
      { size: 10, count: 28, label: 'contrastes' },
      { size: 9, count: 11, label: 'pantones' },
      { size: 6, count: 2, label: 'pigmentos' },
    ],
    category: 'GESTÃO CROMÁTICA',
  },
  {
    id: 'system-01',
    issue: '#01',
    title: 'Ingestão Comercial & RAG',
    date: '02 SET 2026',
    description: 'Data-binding determinístico de produtos reais, tabelas de atacado em R$, SKUs e geração de PDF de alta fidelidade.',
    activityPoints: [
      { size: 7, count: 5, label: 'catálogos' },
      { size: 10, count: 40, label: 'produtos' },
      { size: 9, count: 16, label: 'skus' },
      { size: 8, count: 10, label: 'tabelas' },
      { size: 10, count: 35, label: 'pedidos' },
    ],
    category: 'DADOS & INTEGRAÇÃO B2B',
  },
];

export const CatanaCardDeck = forwardRef<HTMLDivElement, CatanaCardDeckProps>(
  ({ isLightMode, onSelectSystem }, ref) => {
    return (
      <div className="relative max-w-[996px] mx-auto overflow-hidden px-4 py-8 select-none z-10">
        {/* Carrossel de Pranchetas (Suporte a Scroll Horizontal Nativo + Teclado) */}
        <div
          ref={ref}
          tabIndex={0}
          aria-label="Carrossel de Sistemas Catana 2.0"
          className="flex gap-6 overflow-x-auto pb-4 pt-2 no-scrollbar scroll-smooth focus:outline-none focus:ring-1 focus:ring-zinc-400"
          style={{ scrollSnapType: 'x mandatory' }}
        >
          {SYSTEMS_DATA.map((card) => {
            return (
              <article
                key={card.id}
                role="button"
                tabIndex={0}
                aria-label={`Inspecionar sistema ${card.issue} - ${card.title}`}
                style={{ scrollSnapAlign: 'start' }}
                onClick={() => {
                  catanaAudio.playTactileClick(1050);
                  if (onSelectSystem) onSelectSystem(card.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    catanaAudio.playTactileClick(1050);
                    if (onSelectSystem) onSelectSystem(card.id);
                  }
                }}
                className={`flex-shrink-0 w-[300px] sm:w-[320px] rounded-[3px] border-2 p-6 flex flex-col justify-between cursor-pointer transition-all duration-200 group hover:border-[#EEEEEE] active:translate-y-[1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 ${
                  isLightMode
                    ? 'bg-[#F8F6F1] border-[rgba(136,136,136,0.25)] text-[#1A1817] hover:border-[#1A1817] shadow-[0_2px_12px_rgba(0,0,0,0.04)] focus-visible:ring-offset-[#F8F6F1]'
                    : 'bg-[#070709] border-[rgba(136,136,136,0.2)] text-[#EEEEEE] hover:border-[#EEEEEE] focus-visible:ring-offset-[#070709]'
                }`}
              >
                {/* Textura Pontilhada Interna */}
                <div
                  className="absolute inset-0 pointer-events-none rounded-[3px] opacity-40"
                  style={{
                    backgroundImage: 'radial-gradient(rgba(123, 123, 123, 0.12) 1px, transparent 1px)',
                    backgroundSize: '12px 12px',
                  }}
                />

                <div className="relative z-10">
                  {/* Topo do Card: Número do Issue (#05, #04...) e Categoria */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[10px] font-mono tracking-widest uppercase ${
                        isLightMode ? 'text-zinc-600' : 'text-zinc-400'
                      }`}
                    >
                      {card.category}
                    </span>
                    <span
                      className={`text-[11px] font-mono font-medium px-2 py-0.5 rounded-[2px] border transition-colors ${
                        isLightMode
                          ? 'border-[rgba(136,136,136,0.3)] group-hover:border-[#1A1817]'
                          : 'border-[rgba(136,136,136,0.25)] group-hover:border-[#EEEEEE]'
                      }`}
                    >
                      {card.issue}
                    </span>
                  </div>

                  {/* Título Principal */}
                  <h3
                    className={`mt-8 text-2xl font-serif font-medium leading-snug transition-colors ${
                      isLightMode ? 'text-[#1A1817]' : 'text-[#EEEEEE]'
                    }`}
                  >
                    {card.title}
                  </h3>

                  {/* Data Editorial */}
                  <div
                    className={`mt-3 text-[11px] font-mono tracking-wider uppercase ${
                      isLightMode ? 'text-zinc-600' : 'text-zinc-400'
                    }`}
                  >
                    {card.date}
                  </div>

                  {/* Gráfico de Atividade / Frequência (Linha Horizontal com Nós) */}
                  <div className="mt-8 mb-6 relative">
                    {/* Linha de Base */}
                    <div
                      className={`w-full h-[2px] relative transition-colors ${
                        isLightMode ? 'bg-[#1A1817]' : 'bg-[#EEEEEE]'
                      }`}
                    >
                      <div className="absolute inset-0 flex justify-between items-center -top-[4px]">
                        {card.activityPoints.map((pt, pIdx) => (
                          <div
                            key={pIdx}
                            className="relative group/node flex items-center justify-center cursor-default"
                          >
                            <span
                              style={{ width: `${pt.size}px`, height: `${pt.size}px` }}
                              className={`rounded-full transition-transform duration-150 hover:scale-150 ${
                                isLightMode ? 'bg-[#1A1817]' : 'bg-[#EEEEEE]'
                              }`}
                            />
                            {/* Tooltip com Contagem de Atividades */}
                            <div
                              className={`absolute bottom-5 left-1/2 -translate-x-1/2 px-2 py-1 text-[10px] font-mono rounded opacity-0 pointer-events-none transition-opacity duration-150 group-hover/node:opacity-100 whitespace-nowrap z-20 ${
                                isLightMode
                                  ? 'bg-[#1A1817] text-[#F8F6F1]'
                                  : 'bg-[#1E1E24] text-[#EEEEEE] border border-[#3C3C3C]'
                              }`}
                            >
                              {pt.count} {pt.label}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Rótulo de Meses */}
                    <div
                      className={`flex justify-between text-[9px] font-mono uppercase tracking-widest mt-3 ${
                        isLightMode ? 'text-zinc-500' : 'text-zinc-400'
                      }`}
                    >
                      <span>Mai</span>
                      <span>Jun</span>
                      <span>Jul</span>
                      <span>Ago</span>
                      <span>Set</span>
                    </div>
                  </div>
                </div>

                {/* Descrição do Sistema */}
                <p
                  className={`relative z-10 text-sm font-sans font-light leading-relaxed mt-4 transition-colors ${
                    isLightMode ? 'text-[#736E65]' : 'text-[rgba(238,238,238,0.7)]'
                  }`}
                >
                  {card.description}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    );
  }
);

CatanaCardDeck.displayName = 'CatanaCardDeck';
