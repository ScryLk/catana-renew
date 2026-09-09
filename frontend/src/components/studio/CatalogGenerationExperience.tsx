import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  FileSearch,
  Users,
  Palette,
  LayoutGrid,
  CheckCircle2,
  FastForward,
  Terminal,
  Layers,
  Cpu,
  ShieldCheck,
} from 'lucide-react';
import { useStudioStore } from '../../store/studioStore';

interface GenerationStep {
  id: number;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  agent: string;
  detail: string;
}

const GENERATION_STEPS: GenerationStep[] = [
  {
    id: 1,
    label: 'Análise de Briefing & Posicionamento',
    shortLabel: 'Briefing',
    icon: FileSearch,
    agent: 'Orquestrador',
    detail: 'Decodificando categoria de produto, público-alvo e densidade visual.',
  },
  {
    id: 2,
    label: 'Convocação do Conselho Editorial',
    shortLabel: 'Conselho',
    icon: Users,
    agent: 'Editor-Chefe',
    detail: 'Alocando Diretor de Arte, Copywriter, Diagramador e Auditor de Marca.',
  },
  {
    id: 3,
    label: 'Síntese Cromática & Tipografia',
    shortLabel: 'Cromia',
    icon: Palette,
    agent: 'Diretor de Arte',
    detail: 'Calculando harmonia de cores, contraste WCAG AAA e pares de fontes.',
  },
  {
    id: 4,
    label: 'Diagramação de Spreads & Grid A4',
    shortLabel: 'Grid A4',
    icon: LayoutGrid,
    agent: 'Diagramador A4',
    detail: 'Estruturando margens editoriais de 96px, colunas e proporção áurea.',
  },
  {
    id: 5,
    label: 'Renderização Vetorial & Auditoria',
    shortLabel: 'Renderização',
    icon: Sparkles,
    agent: 'Auditor de Branding',
    detail: 'Compilando pranchetas de alta fidelidade e prontas para edição.',
  },
];

export const CatalogGenerationExperience: React.FC = () => {
  const {
    generationProgress,
    generationStage,
    generationLogs,
    generationTargetCatalog,
    finishCatalogGeneration,
    cancelCatalogGeneration,
  } = useStudioStore();

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Timer de segundos decorridos
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Auto-scroll nos logs
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [generationLogs]);

  const targetTitle = generationTargetCatalog?.title || 'Novo Catálogo Editorial';
  const targetCategory = generationTargetCatalog?.category || 'Editorial';
  const palette = generationTargetCatalog?.palette;
  const previewPages = generationTargetCatalog?.pages || [];
  const coverPage = previewPages[0];
  const innerPage = previewPages[1] || previewPages[2];

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}s`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#09090b] text-zinc-100 flex flex-col overflow-hidden select-none font-sans">
      {/* Background Matrix Grid Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(#27272a_1px,transparent_1px)] [background-size:24px_24px] opacity-35 pointer-events-none" />

      {/* Top Header Bar */}
      <header className="relative z-10 h-16 border-b border-zinc-800/80 bg-[#0b0b0e]/90 backdrop-blur-md px-6 flex items-center justify-between">
        {/* Left: Brand Identity & Active Status */}
        <div className="flex items-center gap-3.5">
          <div className="size-9 rounded-xl bg-zinc-900 border border-zinc-700/80 flex items-center justify-center shadow-inner">
            <Cpu className="size-4 text-zinc-200 animate-pulse" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono uppercase tracking-widest text-zinc-400 font-semibold">
                Katana Engine 2.0
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="size-1.5 rounded-full bg-emerald-400 animate-ping" />
                Gerando Catálogo
              </span>
            </div>
            <h2 className="text-sm font-semibold text-white tracking-tight truncate max-w-[280px] sm:max-w-md">
              {targetTitle}
            </h2>
          </div>
        </div>

        {/* Center: Stage Stepper (Desktop) */}
        <nav className="hidden lg:flex items-center gap-1 bg-zinc-900/80 border border-zinc-800 rounded-full px-3 py-1.5">
          {GENERATION_STEPS.map((step) => {
            const isCompleted = generationStage > step.id;
            const isCurrent = generationStage === step.id;
            const StepIcon = step.icon;

            return (
              <div key={step.id} className="flex items-center">
                <div
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-all ${
                    isCompleted
                      ? 'text-zinc-300 font-medium'
                      : isCurrent
                      ? 'bg-zinc-100 text-zinc-950 font-semibold shadow-sm'
                      : 'text-zinc-500'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="size-3.5 text-emerald-400" />
                  ) : (
                    <StepIcon className="size-3.5" />
                  )}
                  <span>{step.shortLabel}</span>
                </div>
                {step.id < GENERATION_STEPS.length && (
                  <div className="w-2 h-px bg-zinc-800 mx-1" />
                )}
              </div>
            );
          })}
        </nav>

        {/* Right: Progress Meter, Timer & Skip Button */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-zinc-400 bg-zinc-900 border border-zinc-800 px-2.5 py-1.5 rounded-lg">
            <span>{formatTimer(elapsedSeconds)}</span>
            <span className="text-zinc-600">|</span>
            <span className="text-zinc-200 font-semibold">{generationProgress}%</span>
          </div>

          <button
            type="button"
            onClick={cancelCatalogGeneration}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Cancelar geração e retornar ao início"
          >
            <span>Cancelar</span>
          </button>

          <button
            type="button"
            onClick={finishCatalogGeneration}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-zinc-100 hover:bg-white text-zinc-950 transition-all shadow-sm cursor-pointer"
            title="Pular animação e abrir catálogo no estúdio imediatamente"
          >
            <span>Pular para o editor</span>
            <FastForward className="size-3.5" />
          </button>
        </div>
      </header>

      {/* Main Workspace Split: Center Stage Preview + Live Agent Console */}
      <div className="relative z-10 flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Center Stage: Living Canvas Assembly */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 lg:p-10 relative overflow-hidden bg-gradient-to-b from-[#0b0b0e] via-[#09090b] to-[#0b0b0e]">
          {/* Subtle Stage Subtitle */}
          <div className="mb-6 flex flex-col items-center text-center">
            <span className="text-[11px] font-mono uppercase tracking-widest text-zinc-400">
              Etapa {generationStage} de 5 · {GENERATION_STEPS[generationStage - 1]?.label}
            </span>
            <p className="text-xs text-zinc-500 mt-1 max-w-md text-balance">
              {GENERATION_STEPS[generationStage - 1]?.detail}
            </p>
          </div>

          {/* Living A4 Mockup Spread Assembling */}
          <div className="relative w-full max-w-4xl aspect-[1.414/1] max-h-[58vh] flex items-center justify-center perspective-[1200px]">
            {/* Ambient Backlight based on palette */}
            <div
              className="absolute inset-4 blur-3xl opacity-20 transition-all duration-1000 rounded-full"
              style={{
                backgroundColor: palette?.accent || '#ffffff',
              }}
            />

            {/* The Spread Container */}
            <div className="relative w-full h-full flex rounded-xl border border-zinc-800/80 shadow-2xl overflow-hidden bg-[#111115]/90 transition-all duration-700">
              {/* Wireframe Laser Scanline effect when in early stages */}
              {generationProgress < 90 && (
                <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-zinc-200 to-transparent opacity-60 shadow-[0_0_15px_rgba(255,255,255,0.8)] z-30 animate-pulse pointer-events-none" />
              )}

              {/* LEFT PAGE: Capa ou Página de Entrada */}
              <div
                className="flex-1 h-full border-r border-zinc-800/60 p-8 flex flex-col justify-between relative transition-all duration-700 overflow-hidden"
                style={{
                  backgroundColor:
                    generationStage >= 3
                      ? palette?.primary || '#18181b'
                      : '#111115',
                  color:
                    generationStage >= 3
                      ? palette?.background || '#f4f4f5'
                      : '#71717a',
                }}
              >
                {/* Blueprint grid guide overlay */}
                {generationStage < 3 && (
                  <div className="absolute inset-4 border border-dashed border-zinc-700/40 pointer-events-none flex flex-col justify-between p-4">
                    <span className="text-[9px] font-mono text-zinc-600">GRID A4 · MARGEM 96PX</span>
                    <span className="text-[9px] font-mono text-zinc-600 self-end">PROPORÇÃO 1:1.414</span>
                  </div>
                )}

                {/* Top Label */}
                <div className="flex items-center justify-between relative z-10">
                  <span
                    className={`text-[9px] tracking-widest font-mono uppercase transition-opacity duration-500 ${
                      generationStage >= 2 ? 'opacity-70' : 'opacity-20'
                    }`}
                  >
                    {coverPage?.label || targetCategory}
                  </span>
                  <span className="text-[9px] font-mono text-zinc-500">PÁG. 01</span>
                </div>

                {/* Center Identity & Title Materializing */}
                <div className="flex flex-col items-center text-center my-auto relative z-10">
                  {/* Monogram Emblem */}
                  <div
                    className={`size-16 rounded-full border flex items-center justify-center transition-all duration-700 ${
                      generationStage >= 3
                        ? 'border-zinc-500/50 bg-black/20 scale-100 opacity-100 shadow-md'
                        : 'border-dashed border-zinc-700/50 scale-90 opacity-40'
                    }`}
                  >
                    <span
                      className="text-2xl font-serif font-light"
                      style={{ color: palette?.accent || '#ffffff' }}
                    >
                      {targetTitle.charAt(0)}
                    </span>
                  </div>

                  {/* Title & Rule */}
                  <div className="mt-5">
                    {generationStage >= 4 ? (
                      <h1
                        className="text-2xl sm:text-3xl font-serif tracking-[0.2em] uppercase font-normal animate-in fade-in zoom-in-95 duration-500"
                        style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
                      >
                        {coverPage?.title || targetTitle}
                      </h1>
                    ) : (
                      <div className="h-7 w-44 bg-zinc-800/80 rounded animate-pulse mx-auto" />
                    )}

                    <div
                      className="w-10 h-0.5 mx-auto my-3 transition-all duration-700"
                      style={{
                        backgroundColor:
                          generationStage >= 3 ? palette?.accent || '#d4d4d8' : '#3f3f46',
                      }}
                    />

                    {generationStage >= 4 ? (
                      <p className="text-[10px] tracking-widest font-mono uppercase text-zinc-400">
                        {coverPage?.subtitle || 'COLEÇÃO EDITORIAL 2026'}
                      </p>
                    ) : (
                      <div className="h-3 w-28 bg-zinc-800/60 rounded animate-pulse mx-auto" />
                    )}
                  </div>
                </div>

                {/* Bottom Folio */}
                <div className="flex items-center justify-between text-[8px] font-mono tracking-wider opacity-60 relative z-10">
                  <span>CATANA STUDIO</span>
                  <span>EDIÇÃO IMPRESSA & DIGITAL</span>
                </div>
              </div>

              {/* RIGHT PAGE: Manifesto ou Spread Editorial de Produtos */}
              <div
                className="flex-1 h-full p-8 flex flex-col justify-between relative transition-all duration-700 overflow-hidden"
                style={{
                  backgroundColor:
                    generationStage >= 3
                      ? palette?.background || '#f4f4f5'
                      : '#131317',
                  color:
                    generationStage >= 3
                      ? palette?.primary || '#18181b'
                      : '#71717a',
                }}
              >
                {/* Blueprint grid guide overlay */}
                {generationStage < 3 && (
                  <div className="absolute inset-4 border border-dashed border-zinc-700/40 pointer-events-none flex flex-col justify-between p-4">
                    <span className="text-[9px] font-mono text-zinc-600">COLUNAS EDITORIAIS</span>
                    <span className="text-[9px] font-mono text-zinc-600 self-end">BLOCO TIPOGRÁFICO</span>
                  </div>
                )}

                {/* Top Folio */}
                <div className="flex items-center justify-between relative z-10">
                  <span className="text-[9px] tracking-widest font-mono uppercase opacity-60">
                    {innerPage?.folio || '02 · MANIFESTO DE MARCA'}
                  </span>
                  <span className="text-[9px] font-mono opacity-60">PÁG. 02</span>
                </div>

                {/* Inner Content Materialization */}
                <div className="my-auto flex flex-col gap-4 relative z-10">
                  {generationStage >= 4 ? (
                    <div className="space-y-3 animate-in fade-in duration-500">
                      <span
                        className="text-[10px] font-mono font-semibold tracking-widest uppercase block"
                        style={{ color: palette?.accent || '#71717a' }}
                      >
                        {innerPage?.subtitle || 'DIRETRIZES DE CRIAÇÃO'}
                      </span>
                      <h2
                        className="text-xl font-serif font-normal leading-snug"
                        style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
                      >
                        {innerPage?.title || 'Harmonia & Rigor Editorial'}
                      </h2>
                      <p className="text-[11px] leading-relaxed opacity-80 line-clamp-4">
                        {innerPage?.content ||
                          'Cada spread foi concebido com equilíbrio estrito entre tipografia clássica, respiro em espaço negativo e proporções adequadas para apresentação comercial impecável.'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="h-3 w-20 bg-zinc-700/40 rounded animate-pulse" />
                      <div className="h-5 w-48 bg-zinc-700/50 rounded animate-pulse" />
                      <div className="space-y-1.5 pt-2">
                        <div className="h-2.5 w-full bg-zinc-700/30 rounded animate-pulse" />
                        <div className="h-2.5 w-5/6 bg-zinc-700/30 rounded animate-pulse" />
                        <div className="h-2.5 w-4/6 bg-zinc-700/30 rounded animate-pulse" />
                      </div>
                    </div>
                  )}

                  {/* Curated Product / Image Card Slot */}
                  <div
                    className={`mt-2 p-3 rounded-lg border flex items-center gap-3.5 transition-all duration-700 ${
                      generationStage >= 4
                        ? 'border-black/10 bg-black/5 shadow-sm'
                        : 'border-dashed border-zinc-700/40 bg-zinc-800/20'
                    }`}
                  >
                    <div className="size-12 rounded bg-zinc-800/60 shrink-0 flex items-center justify-center overflow-hidden">
                      {generationStage >= 4 && innerPage?.products?.[0]?.image ? (
                        <img
                          src={innerPage.products[0].image}
                          alt={innerPage.products[0].name}
                          className="w-full h-full object-contain p-1"
                        />
                      ) : (
                        <Layers className="size-5 text-zinc-600" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      {generationStage >= 4 && innerPage?.products?.[0] ? (
                        <>
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-semibold truncate">
                              {innerPage.products[0].name}
                            </span>
                            <span
                              className="text-xs font-mono font-bold shrink-0"
                              style={{ color: palette?.accent || '#18181b' }}
                            >
                              {innerPage.products[0].price}
                            </span>
                          </div>
                          <span className="text-[10px] opacity-70 truncate block mt-0.5">
                            {innerPage.products[0].sku} · {innerPage.products[0].category}
                          </span>
                        </>
                      ) : (
                        <div className="space-y-1.5">
                          <div className="h-3 w-28 bg-zinc-700/40 rounded animate-pulse" />
                          <div className="h-2 w-16 bg-zinc-700/30 rounded animate-pulse" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bottom Signature */}
                <div className="flex items-center justify-between text-[8px] font-mono tracking-wider opacity-60 relative z-10">
                  <span>PROPORÇÃO A4 (1:1.414)</span>
                  <span>WCAG AAA COMPLIANT</span>
                </div>
              </div>
            </div>
          </div>

          {/* Palette Swatches Bar */}
          {palette && (
            <div className="mt-6 flex items-center gap-2 bg-zinc-900/90 border border-zinc-800 px-4 py-2 rounded-xl animate-in fade-in duration-500 shadow-md">
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold mr-1">
                Paleta:
              </span>
              <div className="flex items-center gap-1.5">
                <div
                  className="size-4 rounded-full border border-white/20 shadow-sm"
                  style={{ backgroundColor: palette.primary }}
                  title={`Primária: ${palette.primary}`}
                />
                <div
                  className="size-4 rounded-full border border-white/20 shadow-sm"
                  style={{ backgroundColor: palette.background }}
                  title={`Fundo: ${palette.background}`}
                />
                <div
                  className="size-4 rounded-full border border-white/20 shadow-sm"
                  style={{ backgroundColor: palette.accent }}
                  title={`Acento: ${palette.accent}`}
                />
              </div>
              <span className="text-xs font-medium text-zinc-200 ml-1">
                {palette.name}
              </span>
            </div>
          )}
        </div>

        {/* Right / Bottom Panel: Real-Time Multi-Agent Console */}
        <aside className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l border-zinc-800/80 bg-[#0c0c10]/95 flex flex-col h-64 lg:h-auto">
          {/* Console Header */}
          <div className="h-12 border-b border-zinc-800/80 px-4 flex items-center justify-between bg-zinc-900/40">
            <div className="flex items-center gap-2">
              <Terminal className="size-4 text-zinc-400" />
              <span className="text-xs font-mono font-semibold tracking-wider text-zinc-300">
                CONSELHO EDITORIAL · ATIVIDADE
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-mono text-zinc-400">Ao vivo</span>
            </div>
          </div>

          {/* Log Stream Container */}
          <div
            ref={logContainerRef}
            className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-xs custom-scrollbar"
          >
            {generationLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-2.5 p-2 rounded-lg bg-zinc-900/50 border border-zinc-800/60 text-zinc-300 animate-in fade-in duration-200"
              >
                <span className="text-[10px] text-zinc-500 shrink-0 mt-0.5">
                  {log.time}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 border border-zinc-700 text-zinc-200 font-semibold">
                      {log.roleName}
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-zinc-300 font-sans break-words">
                    {log.text}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Council Roles Pill Strip */}
          <div className="p-3.5 border-t border-zinc-800/80 bg-zinc-900/40 flex items-center justify-between text-[10px] text-zinc-400">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-3.5 text-zinc-400" />
              <span>5 agentes colaborando em tempo real</span>
            </div>
            <span className="font-mono text-zinc-500">{previewPages.length} páginas</span>
          </div>
        </aside>
      </div>

      {/* Bottom Global Progress Bar */}
      <div className="h-1 w-full bg-zinc-900 relative">
        <div
          className="h-full bg-gradient-to-r from-zinc-400 via-white to-zinc-300 transition-all duration-300 ease-out shadow-[0_0_12px_rgba(255,255,255,0.6)]"
          style={{ width: `${generationProgress}%` }}
        />
      </div>
    </div>
  );
};
