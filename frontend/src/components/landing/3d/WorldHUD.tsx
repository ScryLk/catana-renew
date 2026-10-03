/**
 * WorldHUD.tsx
 * Minimalist luxury HUD inspired by Cipher.tv with real-time 3D telemetry,
 * progress shader bar, timeline jump rail, and artisan inspector drawer.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ARTISAN_STATIONS, ArtisanStation } from './ArtisanStations';
import { WorldCoords } from './WorldCanvas';
import { ArrowUpRight, Volume2, VolumeX, X, Compass, Activity, Sparkles, Terminal } from 'lucide-react';

interface WorldHUDProps {
  coords: WorldCoords | null;
  onJumpToStation: (stationId: string) => void;
  selectedStation: ArtisanStation | null;
  onCloseStationModal: () => void;
}

export const WorldHUD: React.FC<WorldHUDProps> = ({
  coords,
  onJumpToStation,
  selectedStation,
  onCloseStationModal,
}) => {
  const navigate = useNavigate();
  const [audioMuted, setAudioMuted] = useState(true);

  const activeStation = coords?.activeStation || ARTISAN_STATIONS[0];
  const progress = coords?.progress ?? 0;

  return (
    <div className="fixed inset-0 pointer-events-none z-20 flex flex-col justify-between p-4 md:p-8 font-mono select-none">
      {/* 1. TOP NAVIGATION BAR */}
      <header className="w-full flex items-center justify-between text-xs tracking-widest text-[#F5F1EA]">
        {/* Brand & Edition */}
        <div className="flex items-center gap-3 pointer-events-auto">
          <button
            onClick={() => onJumpToStation('station-eleonore')}
            className="group flex items-baseline gap-2 text-left focus:outline-none"
          >
            <span className="font-serif italic text-2xl md:text-3xl font-bold tracking-tight text-[#F5F1EA] group-hover:text-[#D4AF37] transition-colors">
              Catana
            </span>
            <span className="text-[10px] text-[#B08D57] font-mono tracking-widest">
              [ 3D WORLD ]
            </span>
          </button>
        </div>

        {/* Center Live Station Status */}
        <div className="hidden md:flex items-center gap-3 bg-[#121216]/80 backdrop-blur-md px-4 py-2 border border-white/10 rounded-full">
          <span className="w-2 h-2 rounded-full bg-[#D4AF37] animate-pulse" />
          <span className="text-[11px] text-white/50 tracking-wider">ATELIER EN DIRECT:</span>
          <span className="text-[11px] text-[#F5F1EA] font-semibold tracking-wider">
            {activeStation.index} // {activeStation.name.toUpperCase()} · {activeStation.badge}
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3 md:gap-4 pointer-events-auto">
          {/* Ambiance Audio Toggle */}
          <button
            onClick={() => setAudioMuted(!audioMuted)}
            className="p-2.5 rounded-full border border-white/15 bg-[#121216]/80 backdrop-blur-md text-white/70 hover:text-[#D4AF37] hover:border-[#D4AF37]/50 transition-all"
            title={audioMuted ? 'Ativar Atmosfera Sonora' : 'Silenciar'}
          >
            {audioMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>

          {/* Enter Studio CTA */}
          <button
            onClick={() => navigate('/studio')}
            className="group relative inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#D4AF37] text-[#0C0C0E] font-semibold text-[11px] tracking-wider hover:bg-[#F5F1EA] transition-all shadow-[0_0_20px_rgba(212,175,55,0.25)]"
          >
            <span>ENTRAR NO STUDIO</span>
            <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </button>
        </div>
      </header>

      {/* 2. TIMELINE JUMP RAIL (Right Side) */}
      <div className="hidden lg:flex fixed right-8 top-1/2 -translate-y-1/2 flex-col items-end gap-5 pointer-events-auto">
        <div className="text-[9px] text-white/30 tracking-widest uppercase mb-1">
          TRAJETÓRIA // STATIONS
        </div>
        {ARTISAN_STATIONS.map((station) => {
          const isActive = activeStation.id === station.id;
          return (
            <button
              key={station.id}
              onClick={() => onJumpToStation(station.id)}
              className="group flex items-center gap-3 text-right focus:outline-none transition-all"
            >
              <span
                className={`text-[10px] tracking-widest font-mono transition-all duration-300 ${
                  isActive
                    ? 'text-[#D4AF37] font-bold translate-x-0 opacity-100'
                    : 'text-white/40 group-hover:text-white/80 translate-x-2 group-hover:translate-x-0 opacity-60 group-hover:opacity-100'
                }`}
              >
                {station.index} {station.name.toUpperCase()}
              </span>
              <div
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  isActive
                    ? 'bg-[#D4AF37] ring-4 ring-[#D4AF37]/20 scale-125'
                    : 'bg-white/20 group-hover:bg-[#D4AF37]/60 scale-90'
                }`}
              />
            </button>
          );
        })}
      </div>

      {/* 3. BOTTOM TELEMETRY & PROGRESS HUD */}
      <footer className="w-full flex flex-col md:flex-row items-end md:items-center justify-between gap-4 text-xs text-white/60 tracking-wider">
        {/* Left: 3D Coordinates Readout */}
        <div className="hidden md:flex items-center gap-4 bg-[#121216]/80 backdrop-blur-md px-4 py-2 border border-white/10 rounded-full">
          <div className="flex items-center gap-1.5 text-white/40 text-[10px]">
            <Compass className="w-3 h-3 text-[#D4AF37]" />
            <span>POS:</span>
          </div>
          <span className="text-[#F5F1EA] text-[11px] font-mono">
            X {coords?.x?.toFixed(1) ?? '0.0'} &nbsp; Y {coords?.y?.toFixed(1) ?? '0.0'} &nbsp; Z {coords?.z?.toFixed(0) ?? '0'}
          </span>
          <span className="w-px h-3 bg-white/15" />
          <div className="flex items-center gap-1.5 text-white/40 text-[10px]">
            <Activity className="w-3 h-3 text-[#D4AF37]" />
            <span>VEL:</span>
          </div>
          <span className="text-[#F5F1EA] text-[11px] font-mono">
            {coords?.speed?.toFixed(1) ?? '0.0'}
          </span>
        </div>

        {/* Center: progress_shader Indicator (Cipher.tv Style) */}
        <div className="w-full md:w-80 pointer-events-auto flex flex-col gap-1.5 bg-[#121216]/80 backdrop-blur-md p-3 border border-white/10 rounded-2xl">
          <div className="flex items-center justify-between text-[10px] tracking-widest font-mono">
            <span className="text-white/50">PROGRESS_SHADER</span>
            <span className="text-[#D4AF37] font-bold">[ {progress}% ]</span>
          </div>
          <div className="relative w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-[#B08D57] via-[#D4AF37] to-[#F5F1EA] rounded-full transition-all duration-150"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[9px] text-white/40">
            <span>ENTRADA (Z: 100)</span>
            <span>MONUMENTO (Z: -2900)</span>
          </div>
        </div>

        {/* Right: Scroll & Interaction Guide */}
        <div className="flex items-center gap-3 bg-[#121216]/80 backdrop-blur-md px-4 py-2 border border-white/10 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-[#B08D57] animate-ping" />
          <span className="text-[10px] tracking-widest text-white/70 uppercase">
            ROLE OU ARRASTE PARA VIAJAR
          </span>
        </div>
      </footer>

      {/* 4. ARTISAN INSPECTOR DRAWER / MODAL */}
      {selectedStation && (
        <aside className="fixed inset-y-0 right-0 w-full max-w-md bg-[#0D0D10]/95 backdrop-blur-2xl border-l border-white/15 p-6 md:p-8 z-50 flex flex-col justify-between pointer-events-auto animate-in slide-in-from-right duration-300 shadow-2xl">
          <div>
            {/* Header with Close */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-[#D4AF37] font-bold">
                  STATION // {selectedStation.index}
                </span>
                <span className="text-white/30 text-xs">/</span>
                <span className="text-[10px] font-mono text-white/60 tracking-wider">
                  {selectedStation.frenchTitle}
                </span>
              </div>
              <button
                onClick={onCloseStationModal}
                className="p-1.5 rounded-full border border-white/10 text-white/60 hover:text-white hover:border-white/40 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Artisan Hero */}
            <div className="mb-6">
              <span className="inline-block px-2.5 py-1 mb-3 text-[9px] font-mono tracking-widest uppercase bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30 rounded-full">
                {selectedStation.badge}
              </span>
              <h2 className="font-serif italic text-3xl font-bold text-[#F5F1EA] mb-1">
                {selectedStation.name}
              </h2>
              <p className="text-xs text-[#B08D57] font-sans font-medium mb-3">
                {selectedStation.role}
              </p>
              <p className="text-xs text-white/70 leading-relaxed font-sans">
                {selectedStation.description}
              </p>
            </div>

            {/* Live Design Tokens */}
            <div className="mb-6">
              <div className="flex items-center gap-2 text-[10px] font-mono text-white/40 uppercase tracking-widest mb-3">
                <Sparkles className="w-3 h-3 text-[#D4AF37]" />
                <span>MÉTRICAS & TOKENS DE DESIGN</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {selectedStation.tokens.map((token, i) => (
                  <div
                    key={i}
                    className="p-3 bg-white/5 border border-white/10 rounded-lg"
                  >
                    <div className="text-[9px] text-white/40 font-mono mb-1">{token.label}</div>
                    <div className="text-xs font-mono font-semibold text-[#F5F1EA]">{token.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Live Execution Logs */}
            <div>
              <div className="flex items-center gap-2 text-[10px] font-mono text-white/40 uppercase tracking-widest mb-3">
                <Terminal className="w-3 h-3 text-[#D4AF37]" />
                <span>LOGS DE EXECUÇÃO EM TEMPO REAL</span>
              </div>
              <div className="p-3.5 bg-black/60 border border-white/10 rounded-lg space-y-2 font-mono text-[10px] text-white/70">
                {selectedStation.logs.map((log, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-[#D4AF37] select-none">&gt;</span>
                    <span className="leading-tight">{log}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer Action */}
          <div className="pt-6 border-t border-white/10">
            <button
              onClick={() => navigate('/studio')}
              className="w-full py-3 px-4 rounded-xl bg-[#D4AF37] hover:bg-[#F5F1EA] text-[#0C0C0E] font-semibold text-xs tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg"
            >
              <span>EXPERIMENTAR ESTE ARTESÃO NO STUDIO</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
        </aside>
      )}
    </div>
  );
};
