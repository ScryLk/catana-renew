/**
 * CatanaHero.tsx
 * ATO 00 — ARRIVAL & ATO 01 — THE DECONSTRUCTION
 *
 * A Hero como a primeira obra produzida pelo Atelier.
 * Não é uma vitrine de SaaS tradicional. É uma prancheta editorial monumental
 * com marcas de corte de 0.5pt, coordenadas de diagramação, tipografia display
 * monumental e a assinatura oficial Catana em 4K HD.
 */

import { useRef, useState, useEffect, type FC } from 'react';
import { Link } from 'react-router-dom';
import { catanaAudio } from './CatanaAudioEngine';
import { CatanaSignatureLogo } from './CatanaSignatureLogo';

interface CatanaHeroProps {
  isLightMode: boolean;
  onOpenAuditModal: () => void;
}

export const CatanaHero: FC<CatanaHeroProps> = ({ isLightMode, onOpenAuditModal }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ x: 420.5, y: 297.0 });
  const [mouseRelative, setMouseRelative] = useState({ x: 50, y: 50 });
  const [isHoveringSheet, setIsHoveringSheet] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Converte para coordenadas milimétricas de prancheta A4 (420 x 297 mm)
    const mmX = Math.round((x / rect.width) * 420 * 10) / 10;
    const mmY = Math.round((y / rect.height) * 297 * 10) / 10;
    setCoords({ x: mmX, y: mmY });
    setMouseRelative({
      x: (x / rect.width) * 100,
      y: (y / rect.height) * 100,
    });
  };

  useEffect(() => {
    // Posição inicial no centro óptico
    setCoords({ x: 210.0, y: 148.5 });
  }, []);

  return (
    <section
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className="relative max-w-[1240px] mx-auto pt-8 md:pt-14 pb-20 px-4 select-none z-10 overflow-visible"
    >
      {/* 1. Barra de Telemetria de Diagramação Superior (0.5pt) */}
      <div
        className={`w-full flex items-center justify-between py-2 mb-6 border-b font-mono text-[10px] tracking-widest uppercase ${
          isLightMode
            ? 'border-zinc-300 text-zinc-600'
            : 'border-[rgba(136,136,136,0.18)] text-zinc-400'
        }`}
      >
        <div className="flex items-center gap-3">
          <span className={`w-1.5 h-1.5 rounded-full ${isLightMode ? 'bg-zinc-600' : 'bg-zinc-400'}`} />
          <span>CANVAS A4 · RATIO 1:1.414</span>
          <span className="hidden sm:inline">·</span>
          <span className="hidden sm:inline">12-COL HARMONIC GRID</span>
        </div>
        <div className={`flex items-center gap-4 ${isLightMode ? 'text-zinc-600' : 'text-zinc-400'}`}>
          <span className="tabular-nums">X: {coords.x.toFixed(1)}mm</span>
          <span className="tabular-nums">Y: {coords.y.toFixed(1)}mm</span>
          <span
            className={`hidden md:inline px-2 py-0.5 rounded border text-[9px] ${
              isLightMode
                ? 'border-zinc-300 text-zinc-700 bg-zinc-100'
                : 'border-zinc-700/60 text-zinc-300'
            }`}
          >
            DETERMINISTIC
          </span>
        </div>
      </div>

      {/* 2. A PRANCHETA EDITORIAL MONUMENTAL (A PRIMEIRA OBRA) */}
      <div
        onMouseEnter={() => setIsHoveringSheet(true)}
        onMouseLeave={() => setIsHoveringSheet(false)}
        className={`relative w-full rounded-[2px] border transition-all duration-500 p-8 sm:p-12 md:p-16 ${
          isLightMode
            ? 'bg-[#FFFFFF] border-[rgba(26,24,23,0.15)] shadow-[0_8px_40px_rgba(0,0,0,0.06)]'
            : 'bg-[#0A0A0D] border-[rgba(255,255,255,0.12)] shadow-[0_12px_48px_rgba(0,0,0,0.6)]'
        }`}
      >
        {/* Marcas de Corte de Gráfica (Trim Marks) nos 4 Cantos */}
        <div className="absolute -top-3 -left-3 w-6 h-6 pointer-events-none opacity-40">
          <span className="absolute top-3 left-0 w-6 h-[0.5px] bg-zinc-400" />
          <span className="absolute top-0 left-3 w-[0.5px] h-6 bg-zinc-400" />
        </div>
        <div className="absolute -top-3 -right-3 w-6 h-6 pointer-events-none opacity-40">
          <span className="absolute top-3 left-0 w-6 h-[0.5px] bg-zinc-400" />
          <span className="absolute top-0 left-3 w-[0.5px] h-6 bg-zinc-400" />
        </div>
        <div className="absolute -bottom-3 -left-3 w-6 h-6 pointer-events-none opacity-40">
          <span className="absolute top-3 left-0 w-6 h-[0.5px] bg-zinc-400" />
          <span className="absolute top-0 left-3 w-[0.5px] h-6 bg-zinc-400" />
        </div>
        <div className="absolute -bottom-3 -right-3 w-6 h-6 pointer-events-none opacity-40">
          <span className="absolute top-3 left-0 w-6 h-[0.5px] bg-zinc-400" />
          <span className="absolute top-0 left-3 w-[0.5px] h-6 bg-zinc-400" />
        </div>

        {/* Linha Guia Dinâmica de Proporção Áurea (Ativada sutilmente pelo Cursor) */}
        {isHoveringSheet && (
          <div
            className="absolute inset-0 pointer-events-none transition-opacity duration-300 opacity-25"
            style={{
              background: `radial-gradient(circle 320px at ${mouseRelative.x}% ${mouseRelative.y}%, rgba(255,255,255,0.08), transparent 70%)`,
            }}
          />
        )}

        {/* Metadados Técnicos de Topo da Prancheta */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-6 border-b border-[rgba(136,136,136,0.12)] font-mono text-[10px] tracking-[0.2em] uppercase text-zinc-400">
          <div className="flex items-center gap-2">
            <span>EDITORIAL ATELIER</span>
            <span>/</span>
            <span>ISSUE #01 — FIRST PROOF</span>
          </div>
          <div className="flex items-center gap-3">
            <span>BLEED: 3.0MM</span>
            <span>·</span>
            <span>KERNING: OPTICAL</span>
            <span>·</span>
            <span className="text-zinc-200 font-semibold">ZERO SLOP</span>
          </div>
        </div>

        {/* COMPOSIÇÃO MONUMENTAL: TIPOGRAFIA + ASSINATURA CENTRALIZADA */}
        <div className="relative w-full pt-10 pb-6 flex flex-col items-start justify-center">
          {/* Tipografia Monumental Serifada */}
          <div className="relative z-10 max-w-[960px]">
            <h1
              className={`font-serif text-[2.75rem] sm:text-[4.5rem] md:text-[6.5rem] lg:text-[7.25rem] font-normal uppercase tracking-[-0.02em] leading-[0.92] ${
                isLightMode ? 'text-[#1A1817]' : 'text-[#EEEEEE]'
              }`}
            >
              PUBLICATION
              <br />
              <span className="font-light italic text-zinc-400/90 font-serif">WITHOUT</span>
              <br />
              THE TEMPLATE.
            </h1>
          </div>

          {/* Assinatura Cursiva Oficial com Efeito Caligráfico da Splash Screen do Catana 2.0 */}
          <div className="w-full flex items-center justify-center mt-8 sm:mt-12 md:mt-14 mb-4 sm:mb-6 z-20 pointer-events-auto">
            <CatanaSignatureLogo
              isLightMode={isLightMode}
              size="hero"
              showBadge={true}
              showSubtitle={true}
              subtitleText="AUTONOMOUS ATELIER"
              interactive={true}
            />
          </div>
        </div>

        {/* 3. MANIFESTO E PROVOCAÇÃO CENTRAL (YOU DIRECT. THE ATELIER COMPOSES.) */}
        <div className="pt-8 border-t border-[rgba(136,136,136,0.12)] grid grid-cols-1 md:grid-cols-12 gap-8 items-end">
          {/* Lado Esquerdo: A Filosofia de Criação */}
          <div className="md:col-span-7 flex flex-col gap-3">
            <div className="inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.25em] uppercase text-zinc-400">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-300" />
              <span>DIRETRIZ DE AUTORIA HUMANA</span>
            </div>
            <p
              className={`text-xl sm:text-2xl md:text-3xl font-serif font-light leading-snug tracking-normal ${
                isLightMode ? 'text-[#1A1817]' : 'text-[#EEEEEE]'
              }`}
            >
              Você direciona a intenção.
              <br />
              <strong className="font-normal italic text-zinc-400">O Atelier compõe a obra.</strong>
            </p>
            <p className="text-sm font-sans font-light text-zinc-400 max-w-[520px] leading-relaxed mt-1">
              Catálogos comerciais e lookbooks de alta conversão construídos por um conselho autônomo de agentes,
              sem arrastar caixas de texto e sem o visual genérico de inteligência artificial.
            </p>
          </div>

          {/* Lado Direito: Ações Táteis de Estúdio */}
          <div className="md:col-span-5 flex flex-col sm:flex-row md:flex-col lg:flex-row items-stretch sm:items-center justify-end gap-3.5">
            <button
              type="button"
              onClick={() => {
                catanaAudio.playTactileClick(920);
                onOpenAuditModal();
              }}
              className={`flex items-center justify-center gap-2.5 px-6 py-3 min-h-[44px] rounded-[2px] border-2 font-mono text-xs uppercase tracking-widest font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 ${
                isLightMode
                  ? 'border-zinc-800 text-zinc-900 hover:bg-zinc-900 hover:text-white focus-visible:ring-offset-[#F8F6F1]'
                  : 'border-zinc-700 text-zinc-200 hover:bg-zinc-100 hover:text-zinc-950 focus-visible:ring-offset-[#070709]'
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 3" />
              </svg>
              <span>Ver Auditoria A4</span>
            </button>

            <Link
              to="/studio"
              onClick={() => catanaAudio.playTactileClick(1200)}
              className={`flex items-center justify-center gap-3 px-7 py-3 min-h-[44px] rounded-[2px] font-mono text-xs uppercase tracking-widest font-semibold transition-all duration-200 hover:scale-[1.03] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 ${
                isLightMode
                  ? 'bg-zinc-900 text-zinc-50 hover:bg-black shadow-[0_4px_20px_rgba(0,0,0,0.15)] focus-visible:ring-offset-[#F8F6F1]'
                  : 'bg-zinc-100 text-zinc-950 hover:bg-white shadow-[0_4px_24px_rgba(255,255,255,0.12)] focus-visible:ring-offset-[#070709]'
              }`}
            >
              <span>Entrar no Atelier</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </Link>
          </div>
        </div>

        {/* Rodapé Interno da Prancheta: Régua de 0.5pt com Marcação de Spread */}
        <div
          className={`mt-8 pt-4 border-t flex items-center justify-between text-[9px] font-mono ${
            isLightMode
              ? 'border-zinc-200 text-zinc-500'
              : 'border-[rgba(136,136,136,0.1)] text-zinc-400'
          }`}
        >
          <span>CATANA STUDIO ENGINE · CORE BUILD v2.0.4</span>
          <span>ESTOQUE & SKUS TRANCADOS · R$ B2B</span>
          <span>PRESSIONAR [ALT + G] PARA MODO X-RAY</span>
        </div>
      </div>
    </section>
  );
};
