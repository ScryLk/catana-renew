/**
 * CatanaIngestionPerformance.tsx
 * ATO 02 — THE RAW INGESTION & ATO 03 — THE DNA EXTRACTION (/captar)
 *
 * Transforma a ingestão de dados brutos (Excel / ERP / Lookbook) em uma performance
 * visual de engenharia editorial determinística. Sem promessas vagas, com dados reais.
 */

import { useState, type FC } from 'react';
import { catanaAudio } from './CatanaAudioEngine';

interface CatanaIngestionPerformanceProps {
  isLightMode: boolean;
}

interface RawSkuItem {
  sku: string;
  name: string;
  material: string;
  wholesalePrice: string;
  retailPrice: string;
  resolutionDpi: number;
  status: 'LOCKED' | 'CAPTURED' | 'PARSED';
}

const RAW_SKUS: RawSkuItem[] = [
  {
    sku: 'VRD-BLZ-01',
    name: 'Blazer Estruturado em Lã Fria 120s',
    material: '100% Lã Merino Biella',
    wholesalePrice: 'R$ 1.890,00',
    retailPrice: 'R$ 3.450,00',
    resolutionDpi: 326,
    status: 'LOCKED',
  },
  {
    sku: 'VRD-CST-02',
    name: 'Camisa Popeline Egípcia Colarinho Italiano',
    material: 'Algodão Giza 88',
    wholesalePrice: 'R$ 490,00',
    retailPrice: 'R$ 980,00',
    resolutionDpi: 300,
    status: 'LOCKED',
  },
  {
    sku: 'VRD-CAL-03',
    name: 'Calça Alfaiataria Cintura Dupla Pregas',
    material: 'Lã & Seda Tussah',
    wholesalePrice: 'R$ 920,00',
    retailPrice: 'R$ 1.760,00',
    resolutionDpi: 340,
    status: 'LOCKED',
  },
  {
    sku: 'VRD-ACC-04',
    name: 'Echarpe Cashmere Penteado Acabamento Manual',
    material: 'Pure Cashmere 14.5µm',
    wholesalePrice: 'R$ 680,00',
    retailPrice: 'R$ 1.250,00',
    resolutionDpi: 312,
    status: 'LOCKED',
  },
];

export const CatanaIngestionPerformance: FC<CatanaIngestionPerformanceProps> = ({ isLightMode }) => {
  const [activeSku, setActiveSku] = useState<RawSkuItem>(RAW_SKUS[0]);

  return (
    <section className="relative max-w-[1240px] mx-auto py-20 px-4 select-none z-10">
      {/* Marcador de Ato e Régua de Seção */}
      <div className="flex items-center gap-4 mb-8">
        <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-zinc-400">
          ACT 02 · DATA INGESTION &amp; DNA EXTRACTION
        </span>
        <div className="flex-1 h-[1px] bg-[rgba(136,136,136,0.18)]" />
        <span className="font-mono text-[10px] tracking-widest text-zinc-400 tabular-nums">
          428 SKUS DETECTED
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Lado Esquerdo: A Filosofia da Ingestão Sem Alucinações */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <h2
            className={`font-serif text-3xl sm:text-4xl md:text-5xl font-normal leading-[1.05] tracking-tight ${
              isLightMode ? 'text-[#1A1817]' : 'text-[#EEEEEE]'
            }`}
          >
            O caos comercial
            <br />
            <span className="font-light italic text-zinc-400">transformado em disciplina.</span>
          </h2>

          <p className="text-sm font-sans font-light text-zinc-400 leading-relaxed">
            Seus catálogos dependem de precisão contábil. No Catana, planilhas brutas de ERP,
            tabelas de atacado em R$ e fotos de alta resolução são congeladas através de um{' '}
            <strong className="font-medium text-zinc-200">Contrato de Requisitos</strong>.
            A IA nunca modifica um preço, nunca troca um SKU e nunca inventa um produto.
          </p>

          {/* Cartões Pantone de DNA Extraído via /captar */}
          <div className="mt-4 p-4 rounded-[2px] border border-[rgba(136,136,136,0.18)] bg-black/10">
            <div className="flex items-center justify-between pb-3 border-b border-[rgba(136,136,136,0.12)] text-[10px] font-mono tracking-widest uppercase text-zinc-400">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                SKILL /captar · BRAND DNA
              </span>
              <span className="text-zinc-300 font-semibold">LOCKED</span>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-3 text-center">
              <div className="flex flex-col items-center">
                <div className="w-full h-8 rounded-[2px] bg-[#070709] border border-zinc-700" />
                <span className="text-[9px] font-mono text-zinc-400 mt-1 uppercase">Carbono</span>
                <span className="text-[8px] font-mono text-zinc-400">#070709</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-full h-8 rounded-[2px] bg-[#F8F6F1] border border-zinc-300" />
                <span className="text-[9px] font-mono text-zinc-400 mt-1 uppercase">Marfim</span>
                <span className="text-[8px] font-mono text-zinc-400">#F8F6F1</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-full h-8 rounded-[2px] bg-[#27272A] border border-zinc-600" />
                <span className="text-[9px] font-mono text-zinc-400 mt-1 uppercase">Zinco Studio</span>
                <span className="text-[8px] font-mono text-zinc-400">#27272A</span>
              </div>
            </div>
          </div>
        </div>

        {/* Lado Direito: A Planilha Viva Ingerida com Inspetor de Células */}
        <div
          className={`lg:col-span-8 rounded-[2px] border overflow-hidden transition-colors ${
            isLightMode
              ? 'bg-[#FFFFFF] border-[rgba(26,24,23,0.15)] shadow-sm'
              : 'bg-[#0E0E12] border-[rgba(255,255,255,0.1)] shadow-xl'
          }`}
        >
          {/* Topbar da Planilha */}
          <div className="px-4 py-3 border-b border-[rgba(136,136,136,0.15)] flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono uppercase bg-black/15">
            <div className="flex items-center gap-2 text-zinc-300">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M3 9h18M9 21V9" />
              </svg>
              <span>DATA-SOURCE: COLLECTION_SS27_B2B.xlsx</span>
            </div>
            <div className="flex items-center gap-3 text-zinc-400">
              <span>FORMAT: TABULAR B2B</span>
              <span>·</span>
              <span className="text-zinc-200">AUTO-PARSE ON HOVER</span>
            </div>
          </div>

          {/* Tabela de Dados Interativa */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[rgba(136,136,136,0.12)] text-[10px] font-mono uppercase text-zinc-400 bg-white/[0.02]">
                  <th className="py-2.5 px-4">SKU Code</th>
                  <th className="py-2.5 px-4">Item &amp; Composição</th>
                  <th className="py-2.5 px-4">Atacado</th>
                  <th className="py-2.5 px-4">Varejo Sugerido</th>
                  <th className="py-2.5 px-4 text-center">Matriz DPI</th>
                  <th className="py-2.5 px-4 text-right">Governança</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(136,136,136,0.08)] font-mono text-xs">
                {RAW_SKUS.map((item) => {
                  const isSelected = activeSku.sku === item.sku;
                  return (
                    <tr
                      key={item.sku}
                      tabIndex={0}
                      role="row"
                      aria-selected={isSelected}
                      aria-label={`SKU ${item.sku}: ${item.name}, Atacado ${item.wholesalePrice}`}
                      onMouseEnter={() => {
                        catanaAudio.playTactileClick(1100);
                        setActiveSku(item);
                      }}
                      onFocus={() => {
                        setActiveSku(item);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          catanaAudio.playTactileClick(1100);
                          setActiveSku(item);
                        }
                      }}
                      className={`cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400 ${
                        isSelected
                          ? isLightMode
                            ? 'bg-zinc-100 text-zinc-950 font-medium'
                            : 'bg-white/10 text-white font-medium'
                          : isLightMode
                          ? 'hover:bg-zinc-50 text-zinc-700'
                          : 'hover:bg-white/[0.03] text-zinc-300'
                      }`}
                    >
                      <td className="py-3 px-4 text-zinc-400 font-semibold">{item.sku}</td>
                      <td className="py-3 px-4 font-sans text-xs">
                        <div>{item.name}</div>
                        <div className="text-[10px] font-mono text-zinc-400">{item.material}</div>
                      </td>
                      <td className="py-3 px-4 tabular-nums font-semibold">{item.wholesalePrice}</td>
                      <td className="py-3 px-4 tabular-nums text-zinc-400">{item.retailPrice}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-1.5 py-0.5 rounded border border-zinc-700 text-[9px] text-zinc-300">
                          {item.resolutionDpi} DPI
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="inline-flex items-center gap-1 text-[10px] text-zinc-300 uppercase font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-zinc-300" />
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Inspetor Inferior da Célula Ativa */}
          <div className="p-4 border-t border-[rgba(136,136,136,0.12)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[11px] font-mono text-zinc-400 bg-black/10">
            <div className="flex items-center gap-2">
              <span className="text-zinc-200 font-semibold">ITEM SELECIONADO:</span>
              <span>{activeSku.sku} — {activeSku.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-zinc-200">DESTINO:</span>
              <span className="px-2 py-0.5 rounded border border-zinc-700 bg-black/20 text-zinc-300 text-[10px]">
                SPREAD 04 · COLUNA 03
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
