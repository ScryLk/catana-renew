import { useState, useEffect, type FC, type MouseEvent } from 'react';
import { catanaAudio } from './CatanaAudioEngine';

interface CatanaAudioPlayerProps {
  isLightMode: boolean;
}

export const CatanaAudioPlayer: FC<CatanaAudioPlayerProps> = ({ isLightMode }) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTrack, setCurrentTrack] = useState(catanaAudio.getCurrentTrack());
  const [playbackTime, setPlaybackTime] = useState<number>(0);
  const [seekPreview, setSeekPreview] = useState<{ visible: boolean; time: number; leftPx: number }>({
    visible: false,
    time: 0,
    leftPx: 0,
  });

  useEffect(() => {
    catanaAudio.onTimeUpdate((time) => {
      setPlaybackTime(time);
      setIsPlaying(catanaAudio.getIsPlaying());
    });
  }, []);

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    return `${('0' + mins).slice(-2)}:${('0' + secs).slice(-2)}`;
  };

  const handleTogglePlay = () => {
    catanaAudio.playTactileClick(900);
    const playing = catanaAudio.toggleTrackPlayback();
    setIsPlaying(playing);
    setCurrentTrack(catanaAudio.getCurrentTrack());
  };

  const handleNext = () => {
    catanaAudio.playTactileClick(1100);
    catanaAudio.nextTrack();
    setCurrentTrack(catanaAudio.getCurrentTrack());
    setIsPlaying(true);
  };

  const handlePrev = () => {
    catanaAudio.playTactileClick(800);
    catanaAudio.prevTrack();
    setCurrentTrack(catanaAudio.getCurrentTrack());
    setIsPlaying(true);
  };

  const handleProgressBarClick = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const targetSeconds = Math.round(ratio * currentTrack.duration);
    catanaAudio.seek(targetSeconds);
    setPlaybackTime(targetSeconds);
    catanaAudio.playTactileClick(950);
  };

  const handleProgressBarMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const previewSec = Math.round(ratio * currentTrack.duration);
    setSeekPreview({
      visible: true,
      time: previewSec,
      leftPx: e.clientX - rect.left,
    });
  };

  const handleProgressBarKeyDown = (e: React.KeyboardEvent) => {
    let target = playbackTime;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      target = Math.min(currentTrack.duration, playbackTime + 5);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      target = Math.max(0, playbackTime - 5);
    } else if (e.key === 'Home') {
      e.preventDefault();
      target = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      target = currentTrack.duration;
    } else {
      return;
    }
    catanaAudio.seek(target);
    setPlaybackTime(target);
    catanaAudio.playTactileClick(950);
  };

  const progressFraction = currentTrack.duration > 0 ? playbackTime / currentTrack.duration : 0;

  return (
    <div className="relative max-w-[996px] mx-auto my-8 px-4 select-none z-10" role="region" aria-label="Reprodutor do Atelier">
      {/* Régua de Contenção de 99.5% */}
      <div className="relative h-12 flex items-center justify-between border-y border-[rgba(136,136,136,0.15)] px-2">
        {/* Controles à Esquerda: Botão Play/Pause + Tempo Decorrido */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleTogglePlay}
            aria-label={isPlaying ? 'Pausar Áudio' : 'Reproduzir Síntese Sonora'}
            className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 ${
              isLightMode
                ? 'border-[#1A1817] text-[#1A1817] bg-[#F8F6F1] focus-visible:ring-offset-[#F8F6F1]'
                : 'border-[#EEEEEE] text-[#EEEEEE] bg-[#070709] focus-visible:ring-offset-[#070709]'
            }`}
          >
            {isPlaying ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="translate-x-[1px]" aria-hidden="true">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            )}
          </button>

          {/* Nome da Faixa e Tempo Decorrido */}
          <div className="flex items-center gap-3">
            <span
              className={`font-mono text-xs tracking-wider uppercase font-medium ${
                isLightMode ? 'text-zinc-800' : 'text-zinc-200'
              }`}
            >
              {currentTrack.name}
            </span>
            <span
              className={`text-[11px] font-mono ${
                isLightMode ? 'text-zinc-600' : 'text-zinc-400'
              }`}
            >
              {formatSeconds(playbackTime)}
            </span>
          </div>
        </div>

        {/* Barra de Progresso com Interação de Scrubbing */}
        <div
          tabIndex={0}
          role="slider"
          aria-valuemin={0}
          aria-valuemax={currentTrack.duration}
          aria-valuenow={playbackTime}
          aria-valuetext={`${formatSeconds(playbackTime)} de ${formatSeconds(currentTrack.duration)}`}
          aria-label="Controle de Linha do Tempo"
          onClick={handleProgressBarClick}
          onKeyDown={handleProgressBarKeyDown}
          onMouseMove={handleProgressBarMouseMove}
          onMouseLeave={() => setSeekPreview((p) => ({ ...p, visible: false }))}
          className="relative flex-1 mx-6 h-4 flex items-center cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 rounded"
        >
          {/* Linha de Fundo Inativa */}
          <div className="w-full h-[2px] bg-[rgba(136,136,136,0.2)] rounded-full relative">
            {/* Linha Preenchida com Progresso Ativo */}
            <div
              className={`h-full transition-all duration-150 rounded-full ${
                isLightMode ? 'bg-zinc-800' : 'bg-zinc-200'
              }`}
              style={{ width: `${progressFraction * 100}%` }}
            />
          </div>

          {/* Tooltip de Prévia Temporal */}
          {seekPreview.visible && (
            <div
              style={{ left: `${seekPreview.leftPx}px` }}
              className={`absolute -top-7 -translate-x-1/2 px-2 py-0.5 text-[10px] font-mono rounded shadow pointer-events-none ${
                isLightMode ? 'bg-[#1A1817] text-[#F8F6F1]' : 'bg-[#1E1E24] text-[#EEEEEE] border border-[#3C3C3C]'
              }`}
            >
              {formatSeconds(seekPreview.time)}
            </div>
          )}
        </div>

        {/* Controles de Próxima/Anterior e Duração Total */}
        <div className="flex items-center gap-2">
          <span
            className={`text-[11px] font-mono mr-1 tabular-nums ${
              isLightMode ? 'text-zinc-600' : 'text-zinc-400'
            }`}
          >
            {formatSeconds(currentTrack.duration)}
          </span>

          <button
            type="button"
            onClick={handlePrev}
            aria-label="Faixa Anterior"
            className={`w-9 h-9 flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 rounded ${
              isLightMode ? 'text-zinc-600 hover:text-zinc-950' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <polygon points="19 20 9 12 19 4 19 20" />
              <line x1="5" y1="19" x2="5" y2="5" />
            </svg>
          </button>

          <button
            type="button"
            onClick={handleNext}
            aria-label="Próxima Faixa"
            className={`w-9 h-9 flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 rounded ${
              isLightMode ? 'text-zinc-600 hover:text-zinc-950' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <polygon points="5 4 15 12 5 20 5 4" />
              <line x1="19" y1="5" x2="19" y2="19" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};
