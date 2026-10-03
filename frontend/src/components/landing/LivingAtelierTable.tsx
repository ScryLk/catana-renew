import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  CheckCircle2,
  ZoomIn,
  Sun,
  Moon,
  ArrowRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface CollectionPreset {
  id: string;
  name: string;
  segment: string;
  brand: string;
  manifesto: string;
  productName: string;
  productPrice: string;
  productSku: string;
  productImage: string;
  productDetails: string[];
  palette: {
    primary: string;
    accent: string;
    bg: string;
    surface: string;
  };
  gridRatio: string;
  sampleBadge: string;
}

const COLLECTIONS: CollectionPreset[] = [
  {
    id: 'maison',
    name: 'Maison Verdana',
    segment: 'Moda & Alta Costura',
    brand: 'Maison Verdana Paris',
    manifesto:
      'A forma pura não aceita concessões. Cada corte de lã fria obedece à geometria do silêncio e à maestria de ateliês centenários.',
    productName: 'Casaco Structural Noir',
    productPrice: 'R$ 4.800,00',
    productSku: 'VRD-CST-01',
    productImage: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=1000&q=85',
    productDetails: ['100% Lã fria italiana', 'Costura sellier artesanal', 'Botões em madrepérola'],
    palette: {
      primary: '#18181B',
      accent: '#B08D57',
      bg: '#F5F1EA',
      surface: '#FDFBF7',
    },
    gridRatio: 'Proporção Áurea 1:1.414 (A4)',
    sampleBadge: 'ALTA COSTURA · NOIR & OR',
  },
  {
    id: 'aether',
    name: 'Aether Labs',
    segment: 'Tech & Hardware Minimalista',
    brand: 'Aether Precision Labs',
    manifesto:
      'Engenharia sem adornos. Um monobloco usinado em alumínio aeroespacial onde cada abertura de ventilação é um exercício de tolerância micrométrica.',
    productName: 'Módulo Aether Core M2',
    productPrice: 'R$ 2.450,00',
    productSku: 'AETH-M2-004',
    productImage: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=1000&q=85',
    productDetails: ['Alumínio série 7000', 'Dissipação térmica passiva', 'Tolerância 0.01mm'],
    palette: {
      primary: '#09090B',
      accent: '#0284C7',
      bg: '#F1F5F9',
      surface: '#FFFFFF',
    },
    gridRatio: 'Grid Modular 8x8 (1:1)',
    sampleBadge: 'PRECISÃO CNC · SÉRIE 7000',
  },
  {
    id: 'vanguard',
    name: 'Vanguard Pack',
    segment: 'Food Service Sustentável',
    brand: 'Vanguard Industrial',
    manifesto:
      'A revolução do acondicionamento térmico. Fibras vegetais prensadas com fechamento hermético de alta barreira para a cadeia alimentar moderna.',
    productName: 'Câmara Selada Kraft 750ml',
    productPrice: 'R$ 148,00 / cx 100un',
    productSku: 'VNG-KFT-75',
    productImage: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=1000&q=85',
    productDetails: ['Biodegradável em 90 dias', 'Barreira térmica ativa', 'Empilhamento seguro'],
    palette: {
      primary: '#14532D',
      accent: '#10B981',
      bg: '#F4F7F4',
      surface: '#FFFFFF',
    },
    gridRatio: 'Grade Comercial B2B 2x2',
    sampleBadge: 'B2B MATRIX · ECO KRAFT',
  },
  {
    id: 'cacao',
    name: 'Atelier Cacao',
    segment: 'Gastronomia Fina & Terroir',
    brand: 'Atelier Cacao São Paulo',
    manifesto:
      'Cacau crioulo colhido no ponto exato de maturação na Mata Atlântica. Fermentação lenta em caixas de madeira nobre para despertar notas florais raras.',
    productName: 'Barra Gran Terroir 72%',
    productPrice: 'R$ 68,00',
    productSku: 'ACA-TR-72',
    productImage: 'https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?w=1000&q=85',
    productDetails: ['Cacau orgânico de origem', 'Bean-to-bar artesanal', 'Sem emulsificantes'],
    palette: {
      primary: '#2D1B14',
      accent: '#D97706',
      bg: '#FAF5EE',
      surface: '#FFFDF9',
    },
    gridRatio: 'Editorial Duo Lookbook (A4)',
    sampleBadge: 'TERROIR 72% · BEAN-TO-BAR',
  },
];

interface AgentCursorState {
  id: string;
  name: string;
  role: string;
  color: string;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  action: string;
  active: boolean;
}

export function LivingAtelierTable() {
  const [activeCollectionId, setActiveCollectionId] = useState<string>('maison');
  const [isAssembling, setIsAssembling] = useState<boolean>(false);
  const [assemblyStep, setAssemblyStep] = useState<number>(4); // 4 = fully assembled
  const [tableLighting, setTableLighting] = useState<'daylight' | 'darkroom'>('daylight');
  const [isMagnifying, setIsMagnifying] = useState<boolean>(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [logs, setLogs] = useState<string[]>([]);

  const collection = COLLECTIONS.find((c) => c.id === activeCollectionId) || COLLECTIONS[0];
  const spreadRef = useRef<HTMLDivElement>(null);

  // 4 Autonomous Artisans / Agents
  const [agents, setAgents] = useState<AgentCursorState[]>([
    {
      id: 'art-director',
      name: 'Éléonore',
      role: 'Diretora de Arte',
      color: '#B08D57',
      x: 18,
      y: 12,
      action: 'Ajustando margem suíça de 48pt',
      active: true,
    },
    {
      id: 'curator',
      name: 'Kenji',
      role: 'Curador Comercial',
      color: '#10B981',
      x: 72,
      y: 65,
      action: 'Vinculando SKU & Preço de Tabela',
      active: true,
    },
    {
      id: 'typographer',
      name: 'Henri',
      role: 'Tipógrafo Editorial',
      color: '#6366F1',
      x: 28,
      y: 42,
      action: 'Entrelinhamento Playfair Display',
      active: true,
    },
    {
      id: 'guardrail',
      name: 'Vesper',
      role: 'Guardrail de Impressão',
      color: '#F43F5E',
      x: 85,
      y: 88,
      action: 'Auditoria 300 DPI · Contraste AAA',
      active: true,
    },
  ]);

  // Add a log entry
  const addLog = useCallback((msg: string) => {
    const time = new Date().toLocaleTimeString('pt-BR', { hour12: false });
    setLogs((prev) => [`[${time}] ${msg}`, ...prev.slice(0, 5)]);
  }, []);

  // Initial logs
  useEffect(() => {
    addLog(`Atelier ativo: ${collection.brand}. Grid 12-colunas bloqueado.`);
    addLog('Éléonore: Margens de 48pt calculadas com proporção áurea.');
    addLog('Kenji: Produtos vinculados com fotos de alta resolução.');
    addLog('Vesper: Contraste verificado (9.4:1 AAA). Selo gráfico emitido.');
  }, [collection.brand, addLog]);

  // Assembly Choreography Trigger
  const triggerAssembly = () => {
    if (isAssembling) return;
    setIsAssembling(true);
    setAssemblyStep(0);
    addLog(`Iniciando montagem ao vivo: ${collection.brand}...`);

    // Step 1: Art Director draws grid
    setTimeout(() => {
      setAssemblyStep(1);
      setAgents((prev) =>
        prev.map((a) =>
          a.id === 'art-director'
            ? { ...a, x: 22, y: 15, action: 'Traçando linhas guias do grid suíço' }
            : a
        )
      );
      addLog('Éléonore: Grid suíço de 12 colunas projetado na bancada.');
    }, 600);

    // Step 2: Typographer places headline
    setTimeout(() => {
      setAssemblyStep(2);
      setAgents((prev) =>
        prev.map((a) =>
          a.id === 'typographer'
            ? { ...a, x: 30, y: 35, action: 'Digitando manifesto da marca' }
            : a
        )
      );
      addLog('Henri: Tipografia Playfair Display posicionada com entrelinha 1.02.');
    }, 1400);

    // Step 3: Curator places product & pricing
    setTimeout(() => {
      setAssemblyStep(3);
      setAgents((prev) =>
        prev.map((a) =>
          a.id === 'curator'
            ? { ...a, x: 74, y: 55, action: 'Formatando tabela e tags de venda' }
            : a
        )
      );
      addLog(`Kenji: ${collection.productName} inserido com preço e SKU oficial.`);
    }, 2200);

    // Step 4: Guardrail audits & stamps
    setTimeout(() => {
      setAssemblyStep(4);
      setAgents((prev) =>
        prev.map((a) =>
          a.id === 'guardrail'
            ? { ...a, x: 88, y: 86, action: 'Certificando vetor 300 DPI e sangria' }
            : a
        )
      );
      addLog('Vesper: Auditoria concluída. 100% pronto para parque gráfico.');
      setIsAssembling(false);
    }, 3000);
  };

  // Switch Collection
  const handleSelectCollection = (id: string) => {
    setActiveCollectionId(id);
    const newColl = COLLECTIONS.find((c) => c.id === id);
    if (newColl) {
      addLog(`Coleção alterada para: ${newColl.brand}. Redefinindo design tokens.`);
      triggerAssembly();
    }
  };

  // Magnifying Glass Mouse Tracker
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!spreadRef.current) return;
    const rect = spreadRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMousePos({ x, y });
  };

  const isDarkroom = tableLighting === 'darkroom';

  return (
    <section className="relative w-full bg-[#EDE8DF] text-zinc-950 py-20 md:py-32 px-4 sm:px-6 md:px-12 border-b border-zinc-300 select-none overflow-hidden">
      {/* Background Millimeter Grid (Architectural Blueprint) */}
      <div
        className="absolute inset-0 pointer-events-none opacity-30"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(24, 24, 27, 0.08) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(24, 24, 27, 0.08) 1px, transparent 1px)
          `,
          backgroundSize: '24px 24px',
        }}
      />

      {/* Section Header */}
      <div className="max-w-7xl mx-auto mb-12 md:mb-16 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.25em] uppercase text-[#B08D57] mb-2 font-semibold">
            <span className="w-2 h-2 bg-[#B08D57] rounded-none animate-pulse" />
            <span>MESA DE LUZ EDITORIAL // LIVE ATELIER STAGE</span>
          </div>
          <h2 className="font-display text-3xl sm:text-5xl md:text-6xl font-bold tracking-tight text-zinc-950 leading-tight">
            Veja os artesãos{' '}
            <em className="font-medium italic text-[#B08D57]">construindo</em> o
            catálogo.
          </h2>
          <p className="font-sans text-sm md:text-base text-zinc-600 mt-2 max-w-xl font-normal">
            Não é um mockup estático. O conselho de agentes do Catana calcula
            margens, alinha o grid suíço e audita a resolução milimétrica em tempo real.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={triggerAssembly}
            disabled={isAssembling}
            className="flex items-center gap-2 px-5 py-2.5 bg-zinc-950 text-white font-sans text-xs uppercase tracking-wider font-semibold rounded-sm hover:bg-[#B08D57] transition-colors shadow-md disabled:opacity-50"
          >
            <Play className={`w-3.5 h-3.5 ${isAssembling ? 'animate-spin' : ''}`} />
            <span>{isAssembling ? 'Artesãos Trabalhando...' : 'Montar ao Vivo'}</span>
          </button>

          <button
            onClick={() => setIsMagnifying(!isMagnifying)}
            className={`flex items-center gap-2 px-4 py-2.5 border font-sans text-xs uppercase tracking-wider font-medium rounded-sm transition-colors ${
              isMagnifying
                ? 'bg-[#B08D57] text-white border-[#B08D57]'
                : 'bg-white/80 text-zinc-800 border-zinc-300 hover:bg-white'
            }`}
          >
            <ZoomIn className="w-3.5 h-3.5" />
            <span>{isMagnifying ? 'Lupa Ativa' : 'Lupa 300 DPI'}</span>
          </button>

          <button
            onClick={() => setTableLighting(isDarkroom ? 'daylight' : 'darkroom')}
            className="p-2.5 bg-white/80 border border-zinc-300 rounded-sm hover:bg-white text-zinc-700 transition-colors"
            title="Alternar Iluminação da Mesa de Luz"
          >
            {isDarkroom ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Brand Tabs (Collection Selector) */}
      <div className="max-w-7xl mx-auto mb-6 flex flex-wrap items-center gap-2.5">
        {COLLECTIONS.map((c) => {
          const isActive = c.id === activeCollectionId;
          return (
            <button
              key={c.id}
              onClick={() => handleSelectCollection(c.id)}
              className={`px-4 py-2 font-sans text-xs uppercase tracking-wider font-semibold rounded-sm transition-all flex items-center gap-2 ${
                isActive
                  ? 'bg-zinc-950 text-white shadow-md'
                  : 'bg-white/70 text-zinc-700 border border-zinc-300/80 hover:bg-white'
              }`}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: c.palette.accent }}
              />
              <span>{c.name}</span>
            </button>
          );
        })}
      </div>

      {/* THE MAIN LIGHT TABLE (Mesa de Luz) */}
      <div
        className={`max-w-7xl mx-auto rounded-lg border transition-colors duration-700 p-4 sm:p-8 md:p-12 shadow-2xl relative ${
          isDarkroom
            ? 'bg-[#121214] border-zinc-800'
            : 'bg-[#FAF8F5] border-zinc-300/90 shadow-[0_30px_90px_rgba(0,0,0,0.12)]'
        }`}
      >
        {/* Light Table Rulers (Régua Superior e Esquerda) */}
        <div className="absolute top-2 left-12 right-12 h-4 hidden md:flex items-end justify-between font-mono text-[8px] text-zinc-400 border-b border-zinc-300/40 pb-0.5">
          <span>0mm</span>
          <span>100mm</span>
          <span>210mm (A4)</span>
          <span>310mm</span>
          <span>420mm (SPREAD DUPLO)</span>
        </div>

        {/* WORKSPACE: OPEN DOUBLE SPREAD (Spread Duplo A4 Aberto) */}
        <div
          ref={spreadRef}
          onMouseMove={handleMouseMove}
          className="relative w-full max-w-5xl mx-auto aspect-[1.414] bg-white border border-zinc-300 shadow-xl overflow-hidden grid grid-cols-1 md:grid-cols-2 mt-4 transition-all duration-500"
          style={{
            backgroundColor: collection.palette.bg,
          }}
        >
          {/* Subtle Page Fold Center Line (Dobra Central do Catálogo) */}
          <div className="hidden md:block absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[2px] bg-gradient-to-r from-black/10 via-black/20 to-black/5 z-20 pointer-events-none" />

          {/* Architectural Cut-Marks (Marcas de Corte e Registro Gráfico) */}
          <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-zinc-400/60 pointer-events-none z-10" />
          <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-zinc-400/60 pointer-events-none z-10" />
          <div className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-zinc-400/60 pointer-events-none z-10" />
          <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-zinc-400/60 pointer-events-none z-10" />

          {/* LEFT PAGE: Editorial Manifesto & Cover Vibe */}
          <div className="relative p-6 sm:p-10 md:p-14 flex flex-col justify-between border-b md:border-b-0 md:border-r border-zinc-200/80">
            {/* Left Page Header */}
            <div
              className={`transition-opacity duration-700 ${
                assemblyStep >= 1 ? 'opacity-100' : 'opacity-10'
              }`}
            >
              <div className="flex items-center gap-2 font-mono text-[9px] tracking-[0.2em] uppercase text-zinc-500 font-semibold">
                <span
                  className="w-2 h-2"
                  style={{ backgroundColor: collection.palette.accent }}
                />
                <span>{collection.sampleBadge}</span>
              </div>
              <h3 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold text-zinc-950 mt-3 leading-tight">
                {collection.brand}
              </h3>
            </div>

            {/* Left Page Body: Manifesto */}
            <div
              className={`my-6 md:my-auto transition-opacity duration-700 ${
                assemblyStep >= 2 ? 'opacity-100' : 'opacity-10'
              }`}
            >
              <div className="w-12 h-[1.5px] bg-[#B08D57] mb-4" />
              <p className="font-sans text-xs sm:text-sm md:text-base text-zinc-700 font-normal leading-relaxed italic font-display">
                "{collection.manifesto}"
              </p>
              <div className="mt-4 flex items-center gap-3 font-mono text-[10px] text-zinc-500 uppercase">
                <span>GRID: {collection.gridRatio}</span>
                <span>·</span>
                <span>CURADORIA CATANA</span>
              </div>
            </div>

            {/* Left Page Footer */}
            <div className="pt-4 border-t border-zinc-200/80 flex items-center justify-between font-mono text-[9px] text-zinc-500 uppercase">
              <span>CATANA ATELIER · SPREAD 04</span>
              <span>PÁG. 08</span>
            </div>
          </div>

          {/* RIGHT PAGE: Product Showcase & Commercial Craft */}
          <div className="relative p-6 sm:p-10 md:p-14 flex flex-col justify-between bg-[#FDFBF7]">
            {/* Product Image Frame */}
            <div
              className={`relative w-full aspect-[4/3] sm:aspect-[16/10] overflow-hidden bg-zinc-950 border border-zinc-200 shadow-sm transition-all duration-700 ${
                assemblyStep >= 3 ? 'opacity-100 scale-100' : 'opacity-20 scale-95'
              }`}
            >
              <img
                src={collection.productImage}
                alt={collection.productName}
                className="w-full h-full object-cover object-center"
              />

              {/* Tag Over Image */}
              <div className="absolute top-2.5 left-2.5 font-mono text-[8px] sm:text-[9px] uppercase tracking-wider px-2 py-0.5 bg-zinc-950/85 text-white backdrop-blur-sm font-semibold">
                {collection.segment}
              </div>
            </div>

            {/* Product Copy, Price & SKUs */}
            <div
              className={`mt-4 transition-all duration-700 ${
                assemblyStep >= 3 ? 'opacity-100 translate-y-0' : 'opacity-20 translate-y-4'
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <h4 className="font-display text-lg sm:text-2xl font-bold text-zinc-950">
                  {collection.productName}
                </h4>
                <span className="font-sans text-base sm:text-xl font-bold text-[#B08D57] whitespace-nowrap">
                  {collection.productPrice}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap gap-2">
                {collection.productDetails.map((detail, idx) => (
                  <span
                    key={idx}
                    className="font-mono text-[9px] px-2 py-0.5 bg-zinc-100 border border-zinc-200 text-zinc-700 font-medium"
                  >
                    {detail}
                  </span>
                ))}
              </div>
            </div>

            {/* Quality Seal Stamp (Embossed) */}
            <div
              className={`mt-4 pt-3 border-t border-zinc-200 flex items-center justify-between transition-all duration-700 ${
                assemblyStep >= 4 ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
              }`}
            >
              <div className="flex items-center gap-2 font-mono text-[9px] text-emerald-700 font-semibold uppercase">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>300 DPI · WCAG AAA APROVADO</span>
              </div>

              <span className="font-mono text-[9px] text-zinc-400">
                SKU: {collection.productSku}
              </span>
            </div>
          </div>

          {/* DYNAMIC AGENT CURSORS (Os Trabalhadores em Ação sobre a Página) */}
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="absolute pointer-events-none transition-all duration-1000 ease-out z-30 select-none"
              style={{
                left: `${agent.x}%`,
                top: `${agent.y}%`,
              }}
            >
              {/* Elegant Artisan Cursor Arrow */}
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="drop-shadow-md"
              >
                <path
                  d="M4 2L20 10L12 13L9 21L4 2Z"
                  fill={agent.color}
                  stroke="#FFFFFF"
                  strokeWidth="1.5"
                />
              </svg>

              {/* Artisan Badge with Name & Action */}
              <div
                className="ml-3 -mt-2 px-2 py-1 rounded-sm text-white font-mono text-[9px] tracking-wide whitespace-nowrap shadow-md flex items-center gap-1.5"
                style={{ backgroundColor: agent.color }}
              >
                <span className="font-bold uppercase">{agent.name}</span>
                <span className="opacity-75">· {agent.role}</span>
              </div>

              {/* Action Tooltip */}
              <div className="ml-3 mt-1 px-2 py-0.5 bg-zinc-950/90 text-zinc-100 font-mono text-[8px] rounded-xs shadow-xs border border-white/10 whitespace-nowrap">
                {agent.action}
              </div>
            </div>
          ))}

          {/* Interactive Magnifying Loupe Overlay */}
          {isMagnifying && (
            <div
              className="absolute pointer-events-none w-36 h-36 rounded-full border-2 border-[#B08D57] shadow-2xl overflow-hidden z-40"
              style={{
                left: `${mousePos.x - 72}px`,
                top: `${mousePos.y - 72}px`,
                backgroundImage: `url(${collection.productImage})`,
                backgroundPosition: `${-mousePos.x * 2 + 72}px ${-mousePos.y * 2 + 72}px`,
                backgroundSize: '1200px 900px',
              }}
            >
              <div className="absolute inset-0 bg-black/5" />
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 font-mono text-[8px] bg-zinc-950/80 text-white px-1.5 py-0.5 rounded-xs uppercase">
                4X MACRO
              </div>
            </div>
          )}
        </div>

        {/* BOTTOM METRICS & LIVE LOGS CONSOLE */}
        <div className="max-w-5xl mx-auto mt-8 grid grid-cols-1 md:grid-cols-12 gap-6 items-start pt-6 border-t border-zinc-300/80 font-mono text-xs">
          {/* Left: Live Agent Dialogue Feed */}
          <div className="md:col-span-8 bg-zinc-950 text-zinc-300 p-4 rounded-sm border border-zinc-800 shadow-inner">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-800 text-[10px] text-zinc-500 uppercase tracking-wider">
              <span>TRILHA DE DIRETRIZES // AGENT MULTI-THREAD LOG</span>
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
                CONSENSO ATIVO
              </span>
            </div>
            <div className="space-y-1 text-[11px] font-mono leading-relaxed max-h-24 overflow-y-auto">
              {logs.map((log, idx) => (
                <div key={idx} className="truncate">
                  {log}
                </div>
              ))}
            </div>
          </div>

          {/* Right: Quick Action to Studio */}
          <div className="md:col-span-4 bg-white p-4 rounded-sm border border-zinc-300 shadow-xs flex flex-col justify-between h-full">
            <div>
              <span className="font-mono text-[9px] uppercase tracking-wider text-[#B08D57] font-semibold">
                EXPERIMENTE NO STUDIO
              </span>
              <h4 className="font-display text-base font-bold text-zinc-950 mt-1">
                Gere seu catálogo em 12 segundos.
              </h4>
              <p className="font-sans text-xs text-zinc-600 mt-1">
                Envie suas fotos ou planilha Excel e deixe os 5 agentes diagramarem sua coleção.
              </p>
            </div>

            <Link
              to="/studio"
              className="mt-4 inline-flex items-center justify-center gap-2 py-2 px-4 bg-zinc-950 text-white font-sans text-xs uppercase tracking-wider font-semibold rounded-sm hover:bg-[#B08D57] transition-colors"
            >
              <span>Abrir o Studio Agora</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
