/**
 * CatanaInvitationSection.tsx
 * ATO 11 — MONUMENTAL SILENCE & FINAL INVITATION
 *
 * O momento onde a interface desacelera intencionalmente.
 * Espaço negativo monumental (48mm+ de silêncio editorial), a assinatura oficial
 * do atelier em alta definição e a convocação final para diretores de arte,
 * estilistas e marcas de prestígio assumirem a direção criativa de suas coleções.
 */

import { type FC } from 'react';
import { catanaAudio } from './CatanaAudioEngine';
import { CatanaSignatureLogo } from './CatanaSignatureLogo';

interface CatanaInvitationSectionProps {
  isLightMode: boolean;
  onOpenAuditModal?: () => void;
}

export const CatanaInvitationSection: FC<CatanaInvitationSectionProps> = ({
  isLightMode,
  onOpenAuditModal,
}) => {
  return (
    <section className="relative max-w-[1240px] mx-auto pt-32 pb-40 px-4 select-none z-10">
      {/* 1. Silêncio Editorial Intencional (Régua Minimalista) */}
      <div className="flex items-center justify-center gap-6 mb-24 opacity-60">
        <div className="w-16 h-[1px] bg-[rgba(136,136,136,0.3)]" />
        <span className="font-mono text-[9px] tracking-[0.35em] uppercase text-zinc-400">
          ACT 11 · SILENCE &amp; INVITATION
        </span>
        <div className="w-16 h-[1px] bg-[rgba(136,136,136,0.3)]" />
      </div>

      {/* 2. Composição Monumental de Fechamento */}
      <div className="max-w-3xl mx-auto text-center flex flex-col items-center">
        {/* Assinatura do Atelier com Efeito Caligráfico Oficial */}
        <div className="relative mb-8 flex justify-center">
          <CatanaSignatureLogo
            isLightMode={isLightMode}
            size="lg"
            showBadge={false}
            showSubtitle={false}
            interactive={true}
          />
        </div>

        {/* Título de Convocação */}
        <h2
          className={`font-serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-normal leading-[1.02] tracking-tight mb-8 ${
            isLightMode ? 'text-[#1A1817]' : 'text-[#EEEEEE]'
          }`}
        >
          Traga sua coleção.
          <br />
          <span className="font-light italic text-zinc-400">Assuma a direção do atelier.</span>
        </h2>

        {/* Parágrafo de Manifesto Final */}
        <p className="font-sans text-sm sm:text-base font-light text-zinc-400 max-w-xl leading-relaxed mb-12">
          Você não foi feito para alinhar caixas de texto no Canva ou sofrer com planilhas desformatadas.
          Seu papel é escolher os tecidos, ditar a postura da modelo e definir a alma da marca.
          Deixe que o Catana orquestre a matemática gráfica.
        </p>

        {/* Botões de Ação de Alto Prestígio */}
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
          <a
            href="/"
            onClick={() => catanaAudio.playTactileClick(900)}
            className={`w-full sm:w-auto px-8 py-4 min-h-[44px] flex items-center justify-center font-mono text-xs tracking-[0.2em] uppercase transition-all duration-200 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 ${
              isLightMode
                ? 'bg-zinc-900 text-zinc-100 hover:bg-black shadow-md focus-visible:ring-offset-[#F8F6F1]'
                : 'bg-zinc-100 text-zinc-950 hover:bg-white shadow-xl focus-visible:ring-offset-[#070709]'
            }`}
          >
            ENTRAR NO ATELIER 2.0 →
          </a>

          <button
            type="button"
            onClick={() => {
              onOpenAuditModal?.();
              catanaAudio.playTactileClick(750);
            }}
            className={`w-full sm:w-auto px-8 py-4 min-h-[44px] flex items-center justify-center border border-[rgba(136,136,136,0.3)] hover:border-zinc-400 font-mono text-xs tracking-[0.2em] uppercase transition-all duration-200 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 ${
              isLightMode
                ? 'text-zinc-800 hover:bg-black/5 focus-visible:ring-offset-[#F8F6F1]'
                : 'text-zinc-300 hover:bg-white/5 focus-visible:ring-offset-[#070709]'
            }`}
          >
            [ AUDITAR COLEÇÃO SS27 ]
          </button>
        </div>

        {/* Metadados Técnicos de Rodapé */}
        <div className="mt-24 pt-8 border-t border-[rgba(136,136,136,0.15)] w-full flex flex-col sm:flex-row items-center justify-between font-mono text-[9px] text-zinc-400 gap-4">
          <div className="flex items-center gap-4">
            <span>CATANA PLATFORM 2.0</span>
            <span>·</span>
            <span>BUILD 2026.09.22</span>
            <span>·</span>
            <span>WCAG AAA COMPLIANT</span>
          </div>

          <div className="flex items-center gap-4">
            <span>COORDENADAS: LAT 23.5505° S · LON 46.6333° W</span>
            <span>·</span>
            <span>OFFSET / CMYK 300 DPI READY</span>
          </div>
        </div>
      </div>
    </section>
  );
};
