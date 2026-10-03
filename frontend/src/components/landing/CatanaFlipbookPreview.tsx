/**
 * CatanaFlipbookPreview.tsx
 * ATO 10 — THE DIGITAL FLIPBOOK CONVERSION
 *
 * Demonstra a transição da prancheta física A4 para um leitor digital folheável
 * (Digital Flipbook) de alta resolução, com curva de lombada, pontos interativos de SKU,
 * gaveta de pedido de atacado B2B e exportação para gráfica em 300 DPI CMYK.
 */

import { useState, type FC } from 'react';
import { catanaAudio } from './CatanaAudioEngine';

interface CatanaFlipbookPreviewProps {
  isLightMode: boolean;
  onOpenAuditModal?: () => void;
}

interface FlipSpread {
  id: string;
  spreadNum: string;
  titleLeft: string;
  titleRight: string;
  category: string;
  description: string;
  skus: Array<{
    code: string;
    name: string;
    wholesale: string;
    retail: string;
    fabric: string;
    x: string; // % horizontal
    y: string; // % vertical
  }>;
}

const SPREADS: FlipSpread[] = [
  {
    id: 'spread-01',
    spreadNum: 'SPREAD 02–03',
    titleLeft: 'Silhueta & Estrutura',
    titleRight: 'Corte Anatômico 120s',
    category: 'ALFAIATARIA MASCULINA & UNISSEX',
    description: 'A lapela alongada de 9.5cm equilibra a proporção dos ombros sem ombreiras artificiais.',
    skus: [
      {
        code: 'VRD-BLZ-01',
        name: 'Blazer Estruturado em Lã Fria',
        wholesale: 'R$ 1.890,00',
        retail: 'R$ 3.450,00',
        fabric: 'Lã Merino Biella 120s',
        x: '38%',
        y: '42%',
      },
      {
        code: 'VRD-CAL-03',
        name: 'Calça Alfaiataria Pregas Duplas',
        wholesale: 'R$ 920,00',
        retail: 'R$ 1.760,00',
        fabric: 'Lã & Seda Tussah',
        x: '62%',
        y: '68%',
      },
    ],
  },
  {
    id: 'spread-02',
    spreadNum: 'SPREAD 04–05',
    titleLeft: 'Fibra & Matéria Pura',
    titleRight: 'Camisaria & Echarpes',
    category: 'ALGODÃO EGÍPCIO & CASHMERE',
    description: 'Popeline 88 fios com costura inglesa de 8 pontos por centímetro. Botões em madrepérola natural.',
    skus: [
      {
        code: 'VRD-CST-02',
        name: 'Camisa Popeline Giza Colarinho Italiano',
        wholesale: 'R$ 490,00',
        retail: 'R$ 980,00',
        fabric: 'Algodão Egípcio Giza 88',
        x: '32%',
        y: '40%',
      },
      {
        code: 'VRD-ACC-04',
        name: 'Echarpe Cashmere Acabamento Manual',
        wholesale: 'R$ 680,00',
        retail: 'R$ 1.250,00',
        fabric: 'Cashmere 14.5µm',
        x: '70%',
        y: '55%',
      },
    ],
  },
  {
    id: 'spread-03',
    spreadNum: 'SPREAD 06–07',
    titleLeft: 'Acessórios & Couro',
    titleRight: 'Mochila Estruturada',
    category: 'MARROQUINARIA & HARDWARE INDUSTRIAL',
    description: 'Couro vegetal tingido com extrato de quebracho. Fechos em latão escovado com usinagem CNC.',
    skus: [
      {
        code: 'VRD-LEA-08',
        name: 'Pasta Portfólio A4 Couro Vacum',
        wholesale: 'R$ 1.150,00',
        retail: 'R$ 2.290,00',
        fabric: 'Couro Bovino Integral',
        x: '45%',
        y: '50%',
      },
    ],
  },
];

export const CatanaFlipbookPreview: FC<CatanaFlipbookPreviewProps> = ({ isLightMode, onOpenAuditModal }) => {
  const [currentSpreadIndex, setCurrentSpreadIndex] = useState<number>(0);
  const [selectedSkuCode, setSelectedSkuCode] = useState<string | null>(null);
  const [isZoomed, setIsZoomed] = useState<boolean>(false);
  const [isOrderDrawerOpen, setIsOrderDrawerOpen] = useState<boolean>(false);

  const currentSpread = SPREADS[currentSpreadIndex];
  const activeSku = currentSpread.skus.find((s) => s.code === selectedSkuCode) || currentSpread.skus[0];

  const handlePrev = () => {
    setCurrentSpreadIndex((prev) => {
      const next = prev > 0 ? prev - 1 : SPREADS.length - 1;
      catanaAudio.playTactileClick(650);
      return next;
    });
  };

  const handleNext = () => {
    setCurrentSpreadIndex((prev) => {
      const next = prev < SPREADS.length - 1 ? prev + 1 : 0;
      catanaAudio.playTactileClick(850);
      return next;
    });
  };

  return (
    <section className="relative max-w-[1240px] mx-auto py-20 px-4 select-none z-10">
      {/* Marcador de Ato e Régua de Seção */}
      <div className="flex items-center gap-4 mb-8">
        <span className={`font-mono text-[10px] tracking-[0.25em] uppercase ${isLightMode ? 'text-zinc-600' : 'text-zinc-400'}`}>
          ACT 10 · THE DIGITAL FLIPBOOK DESTINATION
        </span>
        <div className={`flex-1 h-[1px] ${isLightMode ? 'bg-zinc-300' : 'bg-[rgba(136,136,136,0.18)]'}`} />
        <span className={`font-mono text-[10px] tracking-widest ${isLightMode ? 'text-zinc-600' : 'text-zinc-400'}`}>
          DELIVERY: DUAL VECTOR (PDF 300 DPI + WEB INTERACTIVE)
        </span>
      </div>

      {/* Título e Filosofia */}
      <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-6 mb-10">
        <div>
          <h2
            className={`font-serif text-3xl sm:text-4xl md:text-5xl font-normal leading-[1.05] tracking-tight ${
              isLightMode ? 'text-[#1A1817]' : 'text-[#EEEEEE]'
            }`}
          >
            Da gráfica para o navegador.
            <br />
            <span className={`font-light italic ${isLightMode ? 'text-zinc-600' : 'text-zinc-400'}`}>Sem perder o toque do papel.</span>
          </h2>
          <p className={`text-sm font-sans font-light max-w-[580px] leading-relaxed mt-2 ${isLightMode ? 'text-zinc-600' : 'text-zinc-400'}`}>
            O Catana gera um arquivo unificado: pronto para imprimir com sangria e marcas de corte de gráfica em 300 DPI,
            ou navegável na web como um <strong>Flipbook B2B interativo</strong> onde cada peça pode ser encomendada
            diretamente por lojistas e compradores internacionais.
          </p>
        </div>

        {/* Controles de Navegação do Flipbook */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrev}
            className={`px-3 py-2 border font-mono text-xs uppercase tracking-widest transition-all ${
              isLightMode
                ? 'border-zinc-300 bg-white text-zinc-800 hover:border-zinc-500 hover:bg-zinc-100'
                : 'border-[rgba(136,136,136,0.25)] bg-[rgba(136,136,136,0.05)] text-zinc-200 hover:border-zinc-400'
            }`}
            aria-label="Página anterior"
          >
            ← PÁG ANT
          </button>
          <span
            className={`font-mono text-xs tracking-widest px-3 py-2 border tabular-nums ${
              isLightMode
                ? 'border-zinc-300 bg-white text-zinc-700'
                : 'border-[rgba(136,136,136,0.15)] text-zinc-400'
            }`}
          >
            {currentSpread.spreadNum} / 24
          </span>
          <button
            onClick={handleNext}
            className={`px-3 py-2 border font-mono text-xs uppercase tracking-widest transition-all ${
              isLightMode
                ? 'border-zinc-300 bg-white text-zinc-800 hover:border-zinc-500 hover:bg-zinc-100'
                : 'border-[rgba(136,136,136,0.25)] bg-[rgba(136,136,136,0.05)] text-zinc-200 hover:border-zinc-400'
            }`}
            aria-label="Próxima página"
          >
            PRÓX PÁG →
          </button>
        </div>
      </div>

      {/* O Livro Digital (Dual-Page Spread com Curva de Lombada) */}
      <div
        className={`relative border rounded-sm p-4 sm:p-8 overflow-hidden transition-all duration-300 ${
          isLightMode
            ? 'border-zinc-300 bg-white shadow-[0_8px_32px_rgba(0,0,0,0.06)]'
            : 'border-[rgba(136,136,136,0.25)] bg-[#09090C] shadow-2xl'
        }`}
      >
        {/* Barra Superior Técnica do Visualizador */}
        <div
          className={`flex items-center justify-between border-b pb-3 mb-6 font-mono text-[9px] tracking-wider ${
            isLightMode ? 'border-zinc-200 text-zinc-600' : 'border-[rgba(136,136,136,0.15)] text-zinc-400'
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-emerald-500/80 animate-pulse" />
            <span className={isLightMode ? 'text-zinc-800 font-medium' : 'text-zinc-300'}>
              CATALOGUE READER 2.0 · B2B WHOLESALE ENGINE
            </span>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => {
                setIsZoomed((prev) => !prev);
                catanaAudio.playTactileClick(720);
              }}
              aria-label={isZoomed ? 'Reduzir zoom para 100%' : 'Ampliar prancheta para 200%'}
              className={`transition-colors uppercase focus-visible:outline-none focus-visible:ring-1 rounded px-1 ${
                isLightMode
                  ? 'hover:text-zinc-950 text-zinc-700 focus-visible:ring-zinc-600'
                  : 'hover:text-zinc-200 text-zinc-400 focus-visible:ring-zinc-400'
              }`}
            >
              {isZoomed ? '[ ZOOM 100% ]' : '[ LUPA 200% ]'}
            </button>
            <span className={isLightMode ? 'text-zinc-300' : 'text-zinc-600'} aria-hidden="true">|</span>
            <button
              type="button"
              onClick={() => {
                onOpenAuditModal?.();
                catanaAudio.playTactileClick(900);
              }}
              aria-label="Exportar PDF de alta resolução 300 DPI CMYK"
              className={`transition-colors uppercase focus-visible:outline-none focus-visible:ring-1 rounded px-1 ${
                isLightMode
                  ? 'hover:text-zinc-950 text-zinc-700 focus-visible:ring-zinc-600'
                  : 'hover:text-zinc-200 text-zinc-400 focus-visible:ring-zinc-400'
              }`}
            >
              [ EXPORTAR PDF CMYK ]
            </button>
          </div>
        </div>

        {/* Visualização de Dupla Prancheta (Lombada Central Física) */}
        <div
          className={`grid grid-cols-1 md:grid-cols-2 gap-0 relative transition-transform duration-300 ${
            isZoomed ? 'scale-105 origin-center' : 'scale-100'
          }`}
        >
          {/* Lombada Central (Gradiente Simula Vinco do Papel) */}
          <div
            className={`hidden md:block absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-8 pointer-events-none z-30 ${
              isLightMode
                ? 'bg-gradient-to-r from-black/15 via-transparent to-black/15'
                : 'bg-gradient-to-r from-black/60 via-black/10 to-black/60'
            }`}
          />

          {/* Página Esquerda (Verso) */}
          <div
            className={`relative border-r p-6 sm:p-10 flex flex-col justify-between min-h-[440px] transition-colors duration-200 ${
              isLightMode
                ? 'bg-[#FAF8F5] border-zinc-200 text-zinc-900'
                : 'bg-[#0E0E12] border-zinc-800/60 text-[#EEEEEE]'
            }`}
          >
            {/* Cabeçalho da Página Esquerda */}
            <div
              className={`flex justify-between items-baseline font-mono text-[9px] tracking-widest ${
                isLightMode ? 'text-zinc-500' : 'text-zinc-400'
              }`}
            >
              <span>{currentSpread.category}</span>
              <span>{currentSpread.spreadNum.split('–')[0]}</span>
            </div>

            {/* Conteúdo Editorial */}
            <div className="my-auto py-6">
              <span
                className={`font-mono text-[10px] tracking-[0.2em] uppercase block mb-1 ${
                  isLightMode ? 'text-zinc-500 font-medium' : 'text-zinc-400'
                }`}
              >
                ENSAIO VISUAL N° 04
              </span>
              <h3
                className={`font-serif text-3xl sm:text-4xl font-normal tracking-tight leading-tight ${
                  isLightMode ? 'text-zinc-900' : 'text-zinc-100'
                }`}
              >
                {currentSpread.titleLeft}
              </h3>
              <p
                className={`text-xs font-sans font-light mt-4 leading-relaxed max-w-sm ${
                  isLightMode ? 'text-zinc-600' : 'text-zinc-400'
                }`}
              >
                {currentSpread.description}
              </p>
              <div
                className={`mt-8 pt-4 border-t font-mono text-[10px] flex items-center justify-between ${
                  isLightMode ? 'border-zinc-200 text-zinc-500' : 'border-zinc-800/80 text-zinc-400'
                }`}
              >
                <span>PADRÃO EDITORIAL: A4 OFFSET</span>
                <span>PAPEL: FEDRIGONI 170G</span>
              </div>
            </div>

            {/* Rodapé da Página Esquerda */}
            <div
              className={`flex justify-between items-center font-mono text-[8px] tracking-wider ${
                isLightMode ? 'text-zinc-500' : 'text-zinc-400'
              }`}
            >
              <span>CATANA ATELIER EDITION</span>
              <span>CONFIDENCIAL B2B</span>
            </div>
          </div>

          {/* Página Direita (Reto) */}
          <div
            className={`relative p-6 sm:p-10 flex flex-col justify-between min-h-[440px] transition-colors duration-200 ${
              isLightMode ? 'bg-[#FAF8F5] text-zinc-900' : 'bg-[#0E0E12] text-[#EEEEEE]'
            }`}
          >
            {/* Cabeçalho da Página Direita */}
            <div
              className={`flex justify-between items-baseline font-mono text-[9px] tracking-widest ${
                isLightMode ? 'text-zinc-500' : 'text-zinc-400'
              }`}
            >
              <span>LOOKBOOK TÉCNICO</span>
              <span>{currentSpread.spreadNum.split('–')[1]}</span>
            </div>

            {/* Conteúdo com Hotspots Interativos */}
            <div className="relative my-auto py-6 flex flex-col justify-center">
              <h4
                className={`font-serif text-2xl font-normal mb-6 ${
                  isLightMode ? 'text-zinc-900' : 'text-zinc-200'
                }`}
              >
                {currentSpread.titleRight}
              </h4>

              {/* Lista Interativa de Peças com Preço de Atacado */}
              <div className="space-y-4">
                {currentSpread.skus.map((sku) => {
                  const isSelected = sku.code === activeSku.code;
                  return (
                    <div
                      key={sku.code}
                      role="button"
                      tabIndex={0}
                      aria-label={`Selecionar peça ${sku.name}, código ${sku.code}, atacado ${sku.wholesale}`}
                      onClick={() => {
                        setSelectedSkuCode(sku.code);
                        setIsOrderDrawerOpen(true);
                        catanaAudio.playTactileClick(780);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedSkuCode(sku.code);
                          setIsOrderDrawerOpen(true);
                          catanaAudio.playTactileClick(780);
                        }
                      }}
                      className={`p-3 border rounded-sm transition-all duration-200 cursor-pointer flex items-center justify-between focus-visible:outline-none focus-visible:ring-1 ${
                        isLightMode
                          ? isSelected
                            ? 'border-zinc-900 bg-zinc-100 focus-visible:ring-zinc-900 shadow-sm'
                            : 'border-zinc-200 bg-white hover:border-zinc-400 focus-visible:ring-zinc-600'
                          : isSelected
                          ? 'border-zinc-300 bg-zinc-800/50 focus-visible:ring-zinc-400'
                          : 'border-zinc-800/80 bg-zinc-900/30 hover:border-zinc-600 focus-visible:ring-zinc-400'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isLightMode ? 'bg-zinc-700' : 'bg-zinc-400'
                            }`}
                          />
                          <span
                            className={`font-mono text-[10px] tracking-wider font-medium ${
                              isLightMode ? 'text-zinc-900' : 'text-zinc-300'
                            }`}
                          >
                            {sku.code}
                          </span>
                        </div>
                        <div
                          className={`text-xs font-serif ${
                            isLightMode ? 'text-zinc-900 font-medium' : 'text-zinc-200'
                          }`}
                        >
                          {sku.name}
                        </div>
                        <div
                          className={`font-mono text-[9px] ${
                            isLightMode ? 'text-zinc-500' : 'text-zinc-400'
                          }`}
                        >
                          {sku.fabric}
                        </div>
                      </div>

                      <div className="text-right space-y-1">
                        <div
                          className={`font-mono text-[9px] ${
                            isLightMode ? 'text-zinc-500' : 'text-zinc-400'
                          }`}
                        >
                          ATACADO
                        </div>
                        <div
                          className={`font-mono text-xs font-semibold tabular-nums ${
                            isLightMode ? 'text-zinc-950' : 'text-zinc-100'
                          }`}
                        >
                          {sku.wholesale}
                        </div>
                        <div
                          className={`font-mono text-[8px] ${
                            isLightMode ? 'text-zinc-500' : 'text-zinc-400'
                          }`}
                        >
                          VAREJO: {sku.retail}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Rodapé da Página Direita com Gatilho de Pedido */}
            <div
              className={`flex justify-between items-center pt-4 border-t font-mono text-[9px] ${
                isLightMode ? 'border-zinc-200' : 'border-zinc-800/60'
              }`}
            >
              <span className={isLightMode ? 'text-zinc-500' : 'text-zinc-400'}>
                CLIQUE NO ITEM PARA ENCOMENDAR
              </span>
              <button
                type="button"
                aria-expanded={isOrderDrawerOpen}
                onClick={() => {
                  setIsOrderDrawerOpen(true);
                  catanaAudio.playTactileClick(850);
                }}
                className={`underline uppercase tracking-wider focus-visible:outline-none focus-visible:ring-1 rounded ${
                  isLightMode
                    ? 'text-zinc-900 hover:text-black focus-visible:ring-zinc-600'
                    : 'text-zinc-200 hover:text-white focus-visible:ring-zinc-400'
                }`}
              >
                VER GAVETA DE PEDIDO →
              </button>
            </div>
          </div>
        </div>

        {/* Gaveta de Pedido de Atacado B2B Slide-Over */}
        {isOrderDrawerOpen && (
          <div
            role="region"
            aria-label="Gaveta de Pedido B2B"
            className={`mt-6 border-t pt-6 rounded-sm p-4 sm:p-6 transition-all animate-fadeIn ${
              isLightMode
                ? 'border-zinc-200 bg-zinc-50/95 text-zinc-900 shadow-inner'
                : 'border-zinc-700/80 bg-zinc-900/90 text-zinc-100'
            }`}
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
              <div>
                <span
                  className={`font-mono text-[9px] tracking-widest uppercase font-semibold ${
                    isLightMode ? 'text-emerald-700' : 'text-emerald-400'
                  }`}
                >
                  SIMULAÇÃO DE PEDIDO B2B DIRETO
                </span>
                <h5
                  className={`font-serif text-lg mt-0.5 ${
                    isLightMode ? 'text-zinc-950 font-medium' : 'text-zinc-100'
                  }`}
                >
                  {activeSku.name} ({activeSku.code})
                </h5>
                <span
                  className={`font-mono text-xs ${
                    isLightMode ? 'text-zinc-600' : 'text-zinc-400'
                  }`}
                >
                  Preço Atacado: {activeSku.wholesale} · Lote Mínimo: 12 Peças
                </span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    catanaAudio.playTactileClick(940);
                    alert(`Item ${activeSku.code} adicionado à grade B2B.`);
                  }}
                  className={`px-4 py-2 font-mono text-xs uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 ${
                    isLightMode
                      ? 'bg-zinc-900 text-zinc-50 hover:bg-black focus-visible:ring-zinc-900'
                      : 'bg-zinc-100 text-zinc-950 hover:bg-white focus-visible:ring-zinc-400'
                  }`}
                >
                  Adicionar Grade Completa
                </button>
                <button
                  type="button"
                  aria-label="Fechar gaveta de pedido"
                  onClick={() => setIsOrderDrawerOpen(false)}
                  className={`px-3 py-2 border font-mono text-xs focus-visible:outline-none focus-visible:ring-2 ${
                    isLightMode
                      ? 'border-zinc-300 text-zinc-600 hover:text-zinc-950 hover:border-zinc-500 focus-visible:ring-zinc-600'
                      : 'border-zinc-700 text-zinc-400 hover:text-zinc-200 focus-visible:ring-zinc-400'
                  }`}
                >
                  ✕ Fechar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
