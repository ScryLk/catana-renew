import { useState } from 'react';
import { Terminal } from 'lucide-react';

interface AgentInfo {
  index: string;
  name: string;
  role: string;
  description: string;
  specialty: string;
  metric: string;
  systemPromptPreview: string;
}

const AGENTS: AgentInfo[] = [
  {
    index: '01',
    name: 'Orquestrador Chefe',
    role: 'Maestro de Fluxo & Paginação',
    description:
      'Lê o inventário completo e define a narrativa visual: onde o leitor precisa de impacto, onde precisa de respiro e onde a conversão comercial deve acontecer.',
    specialty: 'Arquitetura Editorial & Pacing',
    metric: '99.4% Harmonia Estrutural',
    systemPromptPreview:
      'ROLE: Chief Editorial Orchestrator. Rule: Never place two dense commercial grids sequentially without an editorial breathing divider.',
  },
  {
    index: '02',
    name: 'Diretor de Arte',
    role: 'Guardião de Proporção & Estilo',
    description:
      'Aplica a proporção áurea e o grid suíço de 12 colunas. Bloqueia a paleta cromática da marca e garante que nenhuma tipografia saia da hierarquia de luxo.',
    specialty: 'Harmonia Cromática & Grid Suíço',
    metric: '1:1.414 Proporção A4',
    systemPromptPreview:
      'ROLE: Art Director. Rule: Enforce minimum 48px margins on double-spreads. Primary font must be Cormorant Garamond with Jost as geometric support.',
  },
  {
    index: '03',
    name: 'Curador Comercial',
    role: 'Estrategista de Vendas B2B/D2C',
    description:
      'Agrupa produtos por ticket médio, relevância sazonal e afinidade estética. Cria grades 2x2, duos de lookbook e destaques hero para bestsellers.',
    specialty: 'Merchandising Visual & SKUs',
    metric: '3.8x Engajamento Comercial',
    systemPromptPreview:
      'ROLE: Commercial Curator. Rule: Highlight hero SKUs with full-bleed photography. Group complementary items into curated lookbook spreads.',
  },
  {
    index: '04',
    name: 'Copywriter de Luxo',
    role: 'Prosa Poética & Manifestos',
    description:
      'Transforma tabelas secas de especificações técnicas em manifestos de marca envolventes, títulos marcantes e descrições sensoriais de produtos.',
    specialty: 'Storytelling & Voz de Marca',
    metric: '100% Linguagem de Alta Costura',
    systemPromptPreview:
      'ROLE: Luxury Copywriter. Rule: Elevate technical specifications to sensory prose. Avoid common SaaS clichés; write with restraint and sophistication.',
  },
  {
    index: '05',
    name: 'Guardrail de Qualidade',
    role: 'Auditor Criptográfico & Gráfico',
    description:
      'Validação matemática e gráfica contínua. Verifica contraste WCAG AAA para legibilidade perfeita, DPI de impressão para parque gráfico e integridade de SKUs.',
    specialty: 'Auditoria Gráfica & Acessibilidade',
    metric: 'Zero Erros de Pré-Impressão',
    systemPromptPreview:
      'ROLE: Quality Guardrail. Rule: Fail-closed verification. Verify all images >= 300 DPI, contrast >= 7:1 AAA, and zero orphan text blocks.',
  },
];

export function AgentAtelierSection() {
  const [activeAgentIndex, setActiveAgentIndex] = useState(0);
  const activeAgent = AGENTS[activeAgentIndex];

  return (
    <section
      id="agents"
      className="relative w-full bg-[#09090B] text-[#F5F1EA] px-6 md:px-12 py-24 md:py-36 border-b border-white/10 select-none overflow-hidden"
    >
      {/* Background Subtle Gradient */}
      <div className="absolute top-0 right-1/4 w-[600px] h-[600px] bg-[#B08D57]/5 rounded-full blur-[140px] pointer-events-none" />

      {/* Header */}
      <div className="max-w-6xl mb-16 md:mb-24">
        <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.25em] uppercase text-[#71717A] mb-3">
          <span className="w-1.5 h-1.5 bg-emerald-400 animate-pulse" />
          <span>AUTONOMOUS MULTI-AGENT SWARM · CATANA ATELIER</span>
        </div>
        <h2 className="font-editorial text-3xl sm:text-5xl md:text-6xl font-light tracking-[-0.02em] leading-tight text-[#F5F1EA]">
          Cinco agentes. Uma publicação{' '}
          <em className="font-normal italic text-[#B08D57]">impecável</em>.
        </h2>
        <p className="font-jost text-sm md:text-base text-[#A1A1AA] mt-4 max-w-2xl leading-relaxed">
          O Catana não utiliza um único modelo genérico. Em vez disso, um conselho de
          cinco agentes especializados debate, refina e valida cada página em tempo
          real antes da renderização final.
        </p>
      </div>

      {/* Agents Interactive Blueprint Grid */}
      <div className="w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Agent Selector List */}
        <div className="lg:col-span-5 flex flex-col divide-y divide-white/10 border-y border-white/10">
          {AGENTS.map((agent, index) => {
            const isActive = index === activeAgentIndex;
            return (
              <button
                key={agent.index}
                onClick={() => setActiveAgentIndex(index)}
                className={`group text-left py-5 px-4 transition-all duration-300 flex items-center justify-between ${
                  isActive
                    ? 'bg-white/5 pl-6 border-l-2 border-[#B08D57]'
                    : 'hover:bg-white/[0.02] hover:pl-6'
                }`}
              >
                <div className="flex items-center gap-4">
                  <span
                    className={`font-mono text-xs ${
                      isActive ? 'text-[#B08D57]' : 'text-[#71717A]'
                    }`}
                  >
                    {agent.index}
                  </span>
                  <div>
                    <h4
                      className={`font-editorial text-lg md:text-xl font-normal transition-colors ${
                        isActive ? 'text-[#F5F1EA]' : 'text-[#A1A1AA]'
                      }`}
                    >
                      {agent.name}
                    </h4>
                    <span className="font-jost text-xs text-[#71717A] tracking-wider uppercase block mt-0.5">
                      {agent.role}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isActive ? 'bg-emerald-400 animate-pulse' : 'bg-white/20'
                    }`}
                  />
                  <span className="font-mono text-[10px] text-[#71717A] group-hover:text-white transition-colors">
                    →
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Right Column: Active Agent Dossier / Terminal */}
        <div className="lg:col-span-7 bg-[#121214] border border-white/10 p-6 md:p-10 flex flex-col justify-between min-h-[440px]">
          <div>
            {/* Top Dossier Bar */}
            <div className="flex items-center justify-between pb-6 border-b border-white/10 font-mono text-[10px] tracking-[0.2em] uppercase text-[#71717A]">
              <div className="flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-[#B08D57]" />
                <span>AGENT PROTOCOL // {activeAgent.index}</span>
              </div>
              <span className="text-emerald-400">ACTIVE ON CANVAS</span>
            </div>

            {/* Agent Title & Focus */}
            <div className="mt-8">
              <span className="font-mono text-xs text-[#B08D57] tracking-widest uppercase">
                {activeAgent.specialty}
              </span>
              <h3 className="font-editorial text-3xl md:text-4xl font-light text-[#F5F1EA] mt-1">
                {activeAgent.name}
              </h3>
              <p className="font-jost text-sm md:text-base text-[#D4D4D8] mt-4 leading-relaxed font-light">
                {activeAgent.description}
              </p>
            </div>

            {/* Simulated Live Rule / Guardrail Feed */}
            <div className="mt-8 p-4 bg-black/60 border border-white/5 font-mono text-[11px] text-[#A1A1AA] leading-relaxed">
              <span className="text-[#B08D57] block mb-1">
                // SYSTEM PROMPT CONSTRAINT:
              </span>
              <p className="text-white/80">{activeAgent.systemPromptPreview}</p>
            </div>
          </div>

          {/* Bottom Metric Strip */}
          <div className="pt-6 mt-8 border-t border-white/10 flex items-center justify-between font-mono text-xs text-[#71717A]">
            <span>BENCHMARK DE PERFORMANCE:</span>
            <span className="text-[#F5F1EA] font-medium tracking-wider">
              {activeAgent.metric}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
