/**
 * CatanaAgentDeliberation.tsx
 * ATO 04 — THE LIVING DELIBERATION & ATO 05 — THE ASSEMBLY OF THE SPREAD
 *
 * Mostra o conselho de agentes (Hélène, Kenji, Gaston, Sylvan) operando DIRETAMENTE
 * sobre uma prancheta editorial dupla (Spread 04-05), com anotações vivas de margem,
 * linhas de guia, correções de cópia e aprovação gráfica.
 * Nunca cards SaaS passivos; agentes como artesãos intervindo ao vivo.
 */

import { useState, type FC } from 'react';
import { catanaAudio } from './CatanaAudioEngine';

interface CatanaAgentDeliberationProps {
  isLightMode: boolean;
}

type AgentId = 'helene' | 'kenji' | 'gaston' | 'sylvan';

interface AgentIntervention {
  id: AgentId;
  name: string;
  role: string;
  command: string;
  critique: string;
  action: string;
  badge: string;
}

const INTERVENTIONS: Record<AgentId, AgentIntervention> = {
  helene: {
    id: 'helene',
    name: 'Hélène',
    role: 'DIREÇÃO DE ARTE & MALHA COMPOSITIVA',
    command: 'EXPAND_WHITESPACE(48mm)',
    critique: '“A página está densa demais. Um lookbook de luxo precisa de silêncio para a alfaiataria respirar.”',
    action: 'Margem esquerda ampliada em 48mm. Imagem central elevada a 65% de dominância óptica.',
    badge: '12-COL RATIO',
  },
  kenji: {
    id: 'kenji',
    name: 'Kenji',
    role: 'CURADORIA COMERCIAL & MERCHANDISING',
    command: 'ALIGN_Z_SCAN_CLUSTER()',
    critique: '“O olho do comprador desce pela lapela antes de buscar o valor. Ancore o SKU na diagonal óptica.”',
    action: 'SKU VRD-BLZ-01 e preço R$ 1.890,00 reposicionados no vetor focal inferior com tag de 0.5pt.',
    badge: 'CONVERSION FLOW',
  },
  gaston: {
    id: 'gaston',
    name: 'Gaston',
    role: 'REDAÇÃO PUBLICITÁRIA & BRAND VOICE',
    command: 'REPLACE_GENERIC_COPY()',
    critique: '“‘Qualidade impecável e sofisticação única’ é clichê de IA genérica. Corte os adjetivos vazios.”',
    action: 'Texto clichê riscado. Substituído por descrição arquitetônica sóbria da lã merino 120s.',
    badge: 'ZERO AI SLOP',
  },
  sylvan: {
    id: 'sylvan',
    name: 'Sylvan',
    role: 'AUDITORIA DE PRÉ-IMPRESSÃO & WCAG',
    command: 'VERIFY_COLOR_CONTRAST_AAA()',
    critique: '“Matriz de imagem com 326 DPI. Contraste de texto em 14.2:1. Zero emojis. 100% pronta para gráfica e web.”',
    action: 'Certificação editorial A4 aprovada. Pronta para distribuição em PDF CMYK e Flipbook Web.',
    badge: 'PASS · 300 DPI',
  },
};

export const CatanaAgentDeliberation: FC<CatanaAgentDeliberationProps> = ({ isLightMode }) => {
  const [selectedAgent, setSelectedAgent] = useState<AgentId>('helene');
  const activeData = INTERVENTIONS[selectedAgent];

  return (
    <section className="relative max-w-[1240px] mx-auto py-20 px-4 select-none z-10">
      {/* Marcador de Ato e Régua de Seção */}
      <div className="flex items-center gap-4 mb-8">
        <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-zinc-400">
          ACT 04 · THE LIVING ATELIER SWARM
        </span>
        <div className="flex-1 h-[1px] bg-[rgba(136,136,136,0.18)]" />
        <span className="font-mono text-[10px] tracking-widest text-zinc-400">
          DELIBERATION ENGINE · SPREAD 04–05
        </span>
      </div>

      {/* Título do Ato */}
      <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-6 mb-10">
        <div>
          <h2
            className={`font-serif text-3xl sm:text-4xl md:text-5xl font-normal leading-[1.05] tracking-tight ${
              isLightMode ? 'text-[#1A1817]' : 'text-[#EEEEEE]'
            }`}
          >
            Os artesãos não são chatbots.
            <br />
            <span className="font-light italic text-zinc-400">Eles intervêm diretamente na folha.</span>
          </h2>
          <p className="text-sm font-sans font-light text-zinc-400 max-w-[560px] leading-relaxed mt-2">
            No Catana, os agentes não respondem com parágrafos conversacionais genéricos.
            Eles alteram margens, recalculam grids, riscam clichês de texto e validam o DPI da gráfica.
          </p>
        </div>

        {/* Seletores dos 4 Artesãos */}
        <div
          role="tablist"
          aria-label="Conselho de Artesãos do Atelier"
          className="flex flex-wrap items-center gap-2 p-1.5 rounded-[2px] border border-[rgba(136,136,136,0.2)] bg-black/10"
        >
          {(['helene', 'kenji', 'gaston', 'sylvan'] as AgentId[]).map((agentKey) => {
            const agent = INTERVENTIONS[agentKey];
            const isCurrent = selectedAgent === agentKey;
            return (
              <button
                key={agentKey}
                type="button"
                role="tab"
                aria-selected={isCurrent}
                aria-controls={`panel-${agentKey}`}
                id={`tab-${agentKey}`}
                onClick={() => {
                  catanaAudio.playTactileClick(1000);
                  setSelectedAgent(agentKey);
                }}
                className={`px-3.5 py-1.5 rounded-[2px] font-mono text-xs uppercase tracking-wider transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 ${
                  isCurrent
                    ? isLightMode
                      ? 'bg-zinc-900 text-white font-semibold shadow-sm focus-visible:ring-offset-[#F8F6F1]'
                      : 'bg-zinc-100 text-zinc-950 font-semibold shadow-sm focus-visible:ring-offset-[#070709]'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <span>{agent.name}</span>
                <span className="hidden sm:inline text-[9px] opacity-60 ml-1.5">
                  ({agent.name === 'Hélène' ? 'Arte' : agent.name === 'Kenji' ? 'Vendas' : agent.name === 'Gaston' ? 'Copy' : 'Audit'})
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* A PRANCHETA DUPLA (SPREAD 04–05) COM INTERVENÇÃO EM TEMPO REAL */}
      <div
        role="tabpanel"
        id={`panel-${selectedAgent}`}
        aria-labelledby={`tab-${selectedAgent}`}
        className={`relative w-full rounded-[2px] border overflow-hidden p-6 sm:p-10 md:p-12 transition-all ${
          isLightMode
            ? 'bg-[#FFFFFF] border-[rgba(26,24,23,0.15)] shadow-lg'
            : 'bg-[#0A0A0D] border-[rgba(255,255,255,0.12)] shadow-2xl'
        }`}
      >
        {/* Cabeçalho Técnico do Spread */}
        <div className="flex items-center justify-between pb-6 mb-6 border-b border-[rgba(136,136,136,0.15)] font-mono text-[10px] tracking-[0.2em] uppercase text-zinc-400">
          <div className="flex items-center gap-3">
            <span>SPREAD 04–05 · COLEÇÃO ALFAIATARIA INVERNO</span>
            <span>·</span>
            <span>GRID: 12 COLUNAS</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 animate-pulse" />
            <span className="text-zinc-300 font-semibold">AGENTE ATIVO: {activeData.name.toUpperCase()}</span>
          </div>
        </div>

        {/* Layout da Página Dupla Aberta */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center relative">
          {/* Página 04 (Esquerda): Imagem de Lookbook com Corte de Precisão */}
          <div className="md:col-span-6 relative flex flex-col items-center">
            {/* Imagem do Produto com Tag de Auditoria */}
            <div className="relative w-full aspect-[4/5] rounded-[1px] overflow-hidden border border-[rgba(136,136,136,0.2)] bg-black/20">
              <img
                src="https://images.unsplash.com/photo-1594938298603-c8148c4dae35?q=80&w=1200&auto=format&fit=crop"
                alt="Editorial Lookbook"
                className={`w-full h-full object-cover transition-all duration-700 ${
                  selectedAgent === 'helene' ? 'scale-105 filter brightness-105' : 'scale-100'
                }`}
              />

              {/* Marcação de Foco / Curadoria de Kenji */}
              {selectedAgent === 'kenji' && (
                <div className="absolute bottom-6 left-6 p-2 rounded bg-black/85 backdrop-blur border border-white/20 text-white font-mono text-[10px] flex items-center gap-2 animate-fadeIn">
                  <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                  <span>FOCAL POINT · SKU ANCHOR: VRD-BLZ-01</span>
                </div>
              )}

              {/* Carimbo de Auditoria de Sylvan */}
              {selectedAgent === 'sylvan' && (
                <div className="absolute top-4 right-4 px-2 py-1 bg-black/90 border border-zinc-500 font-mono text-[9px] text-zinc-200 uppercase tracking-widest flex items-center gap-1.5">
                  <span>✓ 326 DPI NATIVO</span>
                </div>
              )}
            </div>

            <div className="w-full flex items-center justify-between mt-3 text-[9px] font-mono text-zinc-400 uppercase">
              <span>PÁGINA 04 · FOTOGRAFIA EDITORIAL</span>
              <span>LOOKBOOK · BIELA MERINO</span>
            </div>
          </div>

          {/* Vinco Central de Lombada da Revista (0.5pt) */}
          <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-[1px] bg-[rgba(136,136,136,0.2)]" />

          {/* Página 05 (Direita): Tipografia, Cópia de Gaston e Especificação de SKUs */}
          <div className="md:col-span-6 flex flex-col justify-between h-full pl-0 md:pl-6">
              {/* Balão de Anotação do Agente Ativo na Margem */}
              <div
                className={`p-4 rounded-[2px] border mb-6 relative transition-colors ${
                  isLightMode
                    ? 'border-zinc-200 bg-zinc-100/90 text-zinc-900'
                    : 'border-zinc-700/80 bg-black/30 text-zinc-200'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] font-mono tracking-widest uppercase mb-2">
                  <span className={`font-semibold ${isLightMode ? 'text-zinc-800' : 'text-zinc-300'}`}>
                    {activeData.name} ({activeData.role.split('&')[0]})
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded border text-[8px] ${
                      isLightMode ? 'border-zinc-300 text-zinc-700 bg-white/60' : 'border-zinc-700 text-zinc-300'
                    }`}
                  >
                    {activeData.badge}
                  </span>
                </div>
                <p
                  className={`font-serif italic text-base sm:text-lg leading-snug ${
                    isLightMode ? 'text-zinc-900' : 'text-zinc-200'
                  }`}
                >
                  {activeData.critique}
                </p>
                <div className={`mt-2 text-[10px] font-mono ${isLightMode ? 'text-zinc-600' : 'text-zinc-400'}`}>
                  <span className={`font-semibold ${isLightMode ? 'text-zinc-900' : 'text-zinc-200'}`}>
                    AÇÃO EXECUTADA:
                  </span>{' '}
                  {activeData.action}
                </div>
              </div>

              {/* Título Editorial & Texto Riscado de Gaston */}
              <div className="space-y-3">
                <span
                  className={`font-mono text-[10px] tracking-[0.25em] uppercase ${
                    isLightMode ? 'text-zinc-600' : 'text-zinc-400'
                  }`}
                >
                  REF. VRD-BLZ-01 · EDITION 2027
                </span>

                <h3
                  className={`font-serif text-2xl sm:text-3xl md:text-4xl font-normal leading-tight ${
                    isLightMode ? 'text-[#1A1817]' : 'text-[#EEEEEE]'
                  }`}
                >
                  O Blazer de Lã Fria 120s
                </h3>

                {/* Demonstração do Texto de IA Genérica sendo Riscado por Gaston */}
                <div className="space-y-2 pt-2">
                  <p className="line-through text-xs font-sans text-zinc-500 opacity-60">
                    “Descubra a peça mais sofisticada da estação com qualidade única e elegância incomparável para homens modernos.”
                  </p>
                  <p
                    className={`text-sm sm:text-base font-serif font-light leading-relaxed ${
                      isLightMode ? 'text-zinc-800' : 'text-zinc-200'
                    }`}
                  >
                    Linhas arquitetônicas esculpidas em lã merino Biella. Corte desestruturado com lapela notch e abotoamento duplo que prioriza a fluidez do movimento sobre o excesso.
                  </p>
                </div>
              </div>

              {/* Bloco Comercial de SKU Travado por Kenji */}
              <div
                className={`mt-6 pt-4 border-t flex items-center justify-between font-mono text-xs ${
                  isLightMode ? 'border-zinc-200' : 'border-[rgba(136,136,136,0.15)]'
                }`}
              >
                <div>
                  <div className={`text-[10px] uppercase ${isLightMode ? 'text-zinc-600' : 'text-zinc-400'}`}>
                    Preço Atacado (LOCKED)
                  </div>
                  <div
                    className={`text-base font-semibold tabular-nums ${
                      isLightMode ? 'text-zinc-950' : 'text-zinc-200'
                    }`}
                  >
                    R$ 1.890,00
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-[10px] uppercase ${isLightMode ? 'text-zinc-600' : 'text-zinc-400'}`}>
                    Grade Disponível
                  </div>
                  <div className={`text-xs ${isLightMode ? 'text-zinc-700 font-medium' : 'text-zinc-300'}`}>
                    46 · 48 · 50 · 52 · 54
                  </div>
                </div>
              </div>

            <div className="w-full flex items-center justify-between mt-8 pt-4 border-t border-[rgba(136,136,136,0.1)] text-[9px] font-mono text-zinc-400 uppercase">
              <span>PÁGINA 05 · ESPECIFICAÇÃO COMERCIAL</span>
              <span>CATANA ATELIER ENGINE v2.0</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
