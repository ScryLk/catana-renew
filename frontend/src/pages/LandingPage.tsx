/**
 * LandingPage.tsx
 * Catana 2.0 Web Redesign
 *
 * Reconstrução de alta fidelidade baseada na matriz compositiva, escala, ritmo e
 * comportamento de shawnlukas.com, vestida integralmente com a identidade visual,
 * cores oficiais e tipografia do Catana 2.0.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { CatanaBlueprintGrid } from '../components/landing/CatanaBlueprintGrid';
import { CatanaHeader } from '../components/landing/CatanaHeader';
import { CatanaHero } from '../components/landing/CatanaHero';
import { CatanaSideWidgets } from '../components/landing/CatanaSideWidgets';
import { CatanaCardDeck } from '../components/landing/CatanaCardDeck';
import { CatanaFloatingButton } from '../components/landing/CatanaFloatingButton';
import { CatanaSynthesizerSection } from '../components/landing/CatanaSynthesizerSection';
import { CatanaIngestionPerformance } from '../components/landing/CatanaIngestionPerformance';
import { CatanaAgentDeliberation } from '../components/landing/CatanaAgentDeliberation';
import { CatanaTasteFilter } from '../components/landing/CatanaTasteFilter';
import { CatanaFlipbookPreview } from '../components/landing/CatanaFlipbookPreview';
import { CatanaInvitationSection } from '../components/landing/CatanaInvitationSection';
import { CatanaAuditModal } from '../components/landing/CatanaAuditModal';
import { CatanaAmbientNodes } from '../components/landing/CatanaAmbientNodes';
import { catanaAudio } from '../components/landing/CatanaAudioEngine';

export function LandingPage() {
  const [isLightMode, setIsLightMode] = useState<boolean>(false);
  const [isGridActive, setIsGridActive] = useState<boolean>(false);
  const [isAudioActive, setIsAudioActive] = useState<boolean>(true);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState<boolean>(false);

  const cardDeckRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = 'Catana 2.0 — O Atelier Editorial de Inteligência Artificial';
  }, []);

  // Teclas de atalho inspiradas na referência: Alt+M (Modo), Alt+G (Grid), Escape (Fechar modal)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.code === 'KeyM' || e.key === 'm')) {
        e.preventDefault();
        setIsLightMode((prev) => !prev);
        catanaAudio.playTactileClick(700);
      } else if (e.altKey && (e.code === 'KeyG' || e.key === 'g')) {
        e.preventDefault();
        setIsGridActive((prev) => !prev);
        catanaAudio.playTactileClick(850);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const handleToggleLightMode = useCallback(() => {
    setIsLightMode((prev) => !prev);
  }, []);

  const handleToggleGrid = useCallback(() => {
    setIsGridActive((prev) => !prev);
  }, []);

  const handleToggleAudio = useCallback(() => {
    setIsAudioActive((prev) => {
      const next = !prev;
      catanaAudio.setEnabled(next);
      return next;
    });
  }, []);

  const handleOpenAuditModal = useCallback(() => {
    setIsAuditModalOpen(true);
  }, []);

  const handleCloseAuditModal = useCallback(() => {
    setIsAuditModalOpen(false);
  }, []);

  // Desliza o deck de pranchetas de forma suave
  const handleSlideCards = useCallback(() => {
    if (cardDeckRef.current) {
      const deck = cardDeckRef.current;
      const cardWidth = 344;
      if (deck.scrollLeft + deck.clientWidth >= deck.scrollWidth - 20) {
        deck.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        deck.scrollBy({ left: cardWidth, behavior: 'smooth' });
      }
    }
  }, []);

  return (
    <div
      className={`min-h-screen w-full relative overflow-x-hidden transition-colors duration-300 ${
        isLightMode ? 'bg-[#F8F6F1] text-[#1A1817]' : 'bg-[#070709] text-[#EEEEEE]'
      }`}
    >
      {/* Link de Acessibilidade para Pular ao Conteúdo Principal (WCAG 2.4.1) */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:font-mono focus:text-xs focus:uppercase focus:tracking-widest focus:rounded focus:outline-none focus:ring-2 focus:ring-zinc-400 bg-zinc-900 text-zinc-100 shadow-xl"
      >
        Pular para o conteúdo principal
      </a>

      {/* 1. Matriz de Blueprint e Grid de 9 Colunas com Cotas Numéricas */}
      <CatanaBlueprintGrid isGridActive={isGridActive} />

      {/* 2. Micro-elementos Geométricos Flutuantes */}
      <CatanaAmbientNodes />

      {/* 3. Widgets Laterais (Indicador Scroll Esquerdo e Barra Tátil Direita) */}
      <CatanaSideWidgets
        isLightMode={isLightMode}
        onToggleLightMode={handleToggleLightMode}
        isGridActive={isGridActive}
        onToggleGrid={handleToggleGrid}
        isAudioActive={isAudioActive}
        onToggleAudio={handleToggleAudio}
      />

      {/* 4. Botão Flutuante Sticky (Acompanha o Scroll com % e Ação de Deslize) */}
      <CatanaFloatingButton
        isLightMode={isLightMode}
        onSlideCards={handleSlideCards}
        onOpenAuditModal={handleOpenAuditModal}
      />

      {/* Conteúdo Central Principal */}
      <div className="relative z-10">
        {/* 5. Cabeçalho de Precisão com Régua de 99.5% e Data Scramble */}
        <CatanaHeader isLightMode={isLightMode} />

        <main id="main-content" role="main">
          {/* ATO 00 & 01: Seção Hero Monumental & Quebra da Matriz Editorial */}
          <CatanaHero
            isLightMode={isLightMode}
            onOpenAuditModal={handleOpenAuditModal}
          />

          {/* ATO 02 & 03: Performance de Ingestão de Dados Brutos & Extração de DNA (/captar) */}
          <CatanaIngestionPerformance isLightMode={isLightMode} />

          {/* ATO 04 & 05: O Conselho Vivo de Agentes (Artesãos Intervindo Diretamente no Spread) */}
          <CatanaAgentDeliberation isLightMode={isLightMode} />

          {/* ATO 06: O Filtro de Bom Gosto & Arbitragem Anti-Slop (Rejeição de IA Genérica) */}
          <CatanaTasteFilter isLightMode={isLightMode} />

          {/* ATO 07: O Motor Editorial Interativo com Knobs Táteis de Precisão */}
          <CatanaSynthesizerSection
            isLightMode={isLightMode}
            onOpenAuditModal={handleOpenAuditModal}
          />

          {/* ATO 09: Deck Horizontal de Pranchetas e Sistemas com Gráficos de Atividade */}
          <CatanaCardDeck
            ref={cardDeckRef}
            isLightMode={isLightMode}
            onSelectSystem={() => handleOpenAuditModal()}
          />

          {/* ATO 10: O Flipbook Digital Folheável com Gaveta de Pedidos B2B e 300 DPI */}
          <CatanaFlipbookPreview
            isLightMode={isLightMode}
            onOpenAuditModal={handleOpenAuditModal}
          />

          {/* ATO 11: Silêncio Monumental & Convocação Final para Assumir o Atelier */}
          <CatanaInvitationSection
            isLightMode={isLightMode}
            onOpenAuditModal={handleOpenAuditModal}
          />
        </main>
      </div>

      {/* 9. Modal de Auditoria e Telemetria com Blueprint Canvas e Multi-Gauge SVG */}
      <CatanaAuditModal
        isOpen={isAuditModalOpen}
        onClose={handleCloseAuditModal}
        isLightMode={isLightMode}
        onToggleLightMode={handleToggleLightMode}
      />
    </div>
  );
}
export default LandingPage;
