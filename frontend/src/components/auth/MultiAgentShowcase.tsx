import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Palette,
  PenTool,
  FileSpreadsheet,
  ShieldCheck,
  Users,
  CheckCircle2,
  Cpu,
  Layers,
} from 'lucide-react';

interface AgentInfo {
  id: string;
  name: string;
  role: string;
  tag: string;
  action: string;
  icon: React.ComponentType<{ className?: string }>;
  cursorPosition: { x: string; y: string };
  highlightElement: 'header' | 'hero' | 'headline' | 'table' | 'brand' | 'full';
}

const AGENTS: AgentInfo[] = [
  {
    id: 'orchestrator',
    name: 'Editor-Chefe',
    role: 'Orquestracao & Estrutura',
    tag: 'Orquestrador',
    action: 'Estruturando spreads A4 e organizando ritmo visual da edicao...',
    icon: Sparkles,
    cursorPosition: { x: '22%', y: '24%' },
    highlightElement: 'header',
  },
  {
    id: 'director',
    name: 'Diretor de Arte',
    role: 'Proporcao & Diagramacao',
    tag: 'Direcao Visual',
    action: 'Definindo respiro de margens e escala tipografica 794x1123 px...',
    icon: Palette,
    cursorPosition: { x: '35%', y: '48%' },
    highlightElement: 'hero',
  },
  {
    id: 'copywriter',
    name: 'Redator Publicitario',
    role: 'Headlines & Storytelling',
    tag: 'Copywriting',
    action: 'Gerando headline de impacto: "Design Essencial para Espacos Contemporaneos"...',
    icon: PenTool,
    cursorPosition: { x: '28%', y: '68%' },
    highlightElement: 'headline',
  },
  {
    id: 'commercial',
    name: 'Tabela Comercial',
    role: 'SKU & Precificacao B2B',
    tag: 'B2B Intelligence',
    action: 'Configurando tabela de atacado, pedido minimo e codigos SKU...',
    icon: FileSpreadsheet,
    cursorPosition: { x: '72%', y: '45%' },
    highlightElement: 'table',
  },
  {
    id: 'branding',
    name: 'Auditor de Branding',
    role: 'Conformidade & Paleta',
    tag: 'Auditoria de Marca',
    action: 'Verificando zonas de protecao, contraste monocromatico e fontes...',
    icon: ShieldCheck,
    cursorPosition: { x: '80%', y: '82%' },
    highlightElement: 'brand',
  },
  {
    id: 'council',
    name: 'Conselho Editorial',
    role: 'Sintese Multidisciplinar',
    tag: 'Mesa Redonda',
    action: 'Consolidando parecer executivo dos especialistas para aprovacao final...',
    icon: Users,
    cursorPosition: { x: '50%', y: '30%' },
    highlightElement: 'full',
  },
];

export const MultiAgentShowcase: React.FC = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % AGENTS.length);
    }, 3800);

    return () => clearInterval(interval);
  }, [isPaused]);

  const activeAgent = AGENTS[activeIndex];
  const ActiveIcon = activeAgent.icon;

  return (
    <div
      className="w-full h-full relative flex flex-col justify-between p-8 sm:p-10 bg-zinc-950 text-zinc-100 select-none overflow-hidden"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Luz ambiente de fundo sutil */}
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-zinc-800/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-zinc-900/40 rounded-full blur-3xl pointer-events-none" />

      {/* Topo: Cabecalho do Showcase */}
      <div className="relative z-10 space-y-2">
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-zinc-800 bg-zinc-900/80 backdrop-blur-md text-[11px] text-zinc-300 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Catana 2.0 Studio Engine
          </div>
          <div className="text-[11px] font-mono text-zinc-500">
            {activeIndex + 1} de {AGENTS.length} agentes
          </div>
        </div>

        {/* Card do Agente Ativo em Transicao */}
        <div className="p-3.5 rounded-2xl border border-zinc-800/80 bg-zinc-900/60 backdrop-blur-md shadow-lg transition-all duration-300">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-zinc-800 border border-zinc-700/80 flex items-center justify-center text-zinc-200">
                <ActiveIcon className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-white tracking-tight flex items-center gap-2">
                  {activeAgent.name}
                  <span className="text-[10px] font-mono font-normal px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700/60">
                    {activeAgent.tag}
                  </span>
                </div>
                <div className="text-[10px] text-zinc-400 font-mono">
                  {activeAgent.role}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-emerald-400/90 font-mono font-medium">
              <Cpu className="w-3.5 h-3.5 animate-pulse" />
              <span>Em execucao</span>
            </div>
          </div>
          <p className="text-xs text-zinc-300 line-clamp-1 italic font-serif">
            {activeAgent.action}
          </p>
        </div>
      </div>

      {/* Centro: Canvas Interativo de Pagina Dupla (Spread A4) */}
      <div className="relative z-10 my-4 flex-1 flex items-center justify-center">
        {/* Mock Spread A4 com perspectiva elegante */}
        <div className="relative w-full max-w-[500px] h-[260px] rounded-2xl border border-zinc-800/80 bg-[#111115] shadow-2xl p-4 flex gap-3 rotate-[-1.5deg] transition-transform hover:rotate-0 duration-500">
          {/* Pagina Esquerda (Apresentacao & Headline) */}
          <div
            className={`flex-1 rounded-xl p-3 flex flex-col justify-between transition-all duration-500 border ${
              activeAgent.highlightElement === 'header' ||
              activeAgent.highlightElement === 'hero' ||
              activeAgent.highlightElement === 'headline' ||
              activeAgent.highlightElement === 'full'
                ? 'bg-zinc-900/90 border-zinc-700 shadow-inner'
                : 'bg-zinc-950/60 border-zinc-900'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] uppercase tracking-wider font-mono text-zinc-500">
                  Vol. 02 / Spread 01
                </span>
                <span className="text-[9px] font-mono text-zinc-600">p. 04</span>
              </div>
              <div
                className={`transition-all duration-300 rounded p-1 ${
                  activeAgent.highlightElement === 'headline'
                    ? 'bg-zinc-800 text-white ring-1 ring-zinc-600'
                    : 'text-zinc-200'
                }`}
              >
                <div className="text-xs font-bold leading-tight font-serif">
                  Colecao Essencia
                </div>
                <div className="text-[10px] text-zinc-400 mt-0.5">
                  Design contemporaneo e linhas puras.
                </div>
              </div>
            </div>

            {/* Area da Imagem Hero do Catalogo */}
            <div
              className={`w-full h-20 rounded-lg border flex flex-col items-center justify-center gap-1 transition-all duration-500 overflow-hidden ${
                activeAgent.highlightElement === 'hero'
                  ? 'border-zinc-500 bg-zinc-800/80 ring-1 ring-zinc-400'
                  : 'border-zinc-800 bg-zinc-900/40'
              }`}
            >
              <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400">
                <Layers className="w-4 h-4" />
              </div>
              <span className="text-[9px] text-zinc-500 font-mono">
                A4 Hero 794x1123
              </span>
            </div>

            <div className="text-[8px] text-zinc-500 flex justify-between font-mono">
              <span>Grade Editorial</span>
              <span>100% Vetorial</span>
            </div>
          </div>

          {/* Pagina Direita (Produtos & Tabela B2B) */}
          <div
            className={`flex-1 rounded-xl p-3 flex flex-col justify-between transition-all duration-500 border ${
              activeAgent.highlightElement === 'table' ||
              activeAgent.highlightElement === 'brand' ||
              activeAgent.highlightElement === 'full'
                ? 'bg-zinc-900/90 border-zinc-700 shadow-inner'
                : 'bg-zinc-950/60 border-zinc-900'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] uppercase tracking-wider font-mono text-zinc-500">
                  Tabela Comercial
                </span>
                <span className="text-[9px] font-mono text-zinc-600">p. 05</span>
              </div>

              {/* Tabela de Produtos */}
              <div
                className={`space-y-1.5 transition-all duration-300 rounded p-1 ${
                  activeAgent.highlightElement === 'table'
                    ? 'bg-zinc-800/90 ring-1 ring-zinc-600'
                    : ''
                }`}
              >
                <div className="p-1.5 rounded-md bg-zinc-950/60 border border-zinc-800/60 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-medium text-zinc-200">
                      Sofa Modular
                    </div>
                    <div className="text-[8px] font-mono text-zinc-500">SKU-9402</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-semibold text-zinc-200">
                      R$ 4.890
                    </div>
                    <div className="text-[8px] font-mono text-zinc-500">MOQ: 2 un</div>
                  </div>
                </div>

                <div className="p-1.5 rounded-md bg-zinc-950/60 border border-zinc-800/60 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-medium text-zinc-200">
                      Mesa Lateral
                    </div>
                    <div className="text-[8px] font-mono text-zinc-500">SKU-8105</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-semibold text-zinc-200">
                      R$ 1.250
                    </div>
                    <div className="text-[8px] font-mono text-zinc-500">MOQ: 4 un</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Selo de Branding / Validacao */}
            <div
              className={`p-1.5 rounded-md border flex items-center justify-between transition-all duration-300 ${
                activeAgent.highlightElement === 'brand' || activeAgent.highlightElement === 'full'
                  ? 'border-emerald-500/50 bg-emerald-950/20 text-emerald-300'
                  : 'border-zinc-800 bg-zinc-950/40 text-zinc-400'
              }`}
            >
              <div className="flex items-center gap-1 text-[9px] font-mono font-medium">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span>Auditoria de Marca</span>
              </div>
              <span className="text-[8px] font-mono text-zinc-500">100% OK</span>
            </div>
          </div>

          {/* Cursor Dinamico do Agente em Movimento */}
          <div
            className="absolute z-30 transition-all duration-700 ease-out pointer-events-none flex items-center gap-1.5"
            style={{
              left: activeAgent.cursorPosition.x,
              top: activeAgent.cursorPosition.y,
              transform: 'translate(-50%, -50%)',
            }}
          >
            {/* Ponteiro de mouse estilizado */}
            <svg
              className="w-4 h-4 text-white drop-shadow-md"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M4 0l16 12-7 2-4 9-5-23z" />
            </svg>
            <div className="px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-950 text-[9px] font-mono font-semibold shadow-xl border border-zinc-300 whitespace-nowrap">
              {activeAgent.name}
            </div>
          </div>
        </div>
      </div>

      {/* Rodape: Seletor dos 6 Agentes e Status do Gemini */}
      <div className="relative z-10 space-y-3">
        {/* Pills dos Agentes */}
        <div className="grid grid-cols-6 gap-1.5">
          {AGENTS.map((agent, idx) => {
            const IconComponent = agent.icon;
            const isActive = idx === activeIndex;
            return (
              <button
                key={agent.id}
                type="button"
                onClick={() => setActiveIndex(idx)}
                className={`py-2 px-1 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                  isActive
                    ? 'bg-zinc-800 border-zinc-600 text-white shadow-md'
                    : 'bg-zinc-900/50 border-zinc-800/80 text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200'
                }`}
                title={agent.name}
              >
                <IconComponent className="w-3.5 h-3.5" />
                <span className="text-[9px] font-mono truncate max-w-full block leading-none">
                  {agent.name.split(' ')[0]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Status da Engine e Cota */}
        <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between text-[11px] text-zinc-500 font-mono">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
            <span>Google Gemini 2.0 Flash</span>
          </div>
          <span>Multi-Agent Orchestration</span>
        </div>
      </div>
    </div>
  );
};
