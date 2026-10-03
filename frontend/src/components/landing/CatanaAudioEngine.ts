/**
 * CatanaAudioEngine.ts
 * Motor procedural de síntese sonora para o Catana 2.0 baseado na Web Audio API nativa.
 * Fornece:
 * 1. Micro-feedback tátil em cliques e rotações de knobs (clicks, frequências analógicas).
 * 2. 4 Paisagens sonoras generativas e procedurais contínuas (zero dependência de MP3s externos):
 *    - "Atelier Noturno" (frequências graves quentes com ruído de fita)
 *    - "Tear Tipográfico" (pulsos rítmicos harmônicos)
 *    - "Prensa de Alta Precisão" (ressoadores metálicos quentes)
 *    - "Câmara de Curadoria" (drones estelares etéreos)
 */

class CatanaAudioEngine {
  private ctx: AudioContext | null = null;
  private isEnabled: boolean = true;
  private currentTrackIndex: number = 0;
  private isPlayingTrack: boolean = false;
  private masterGain: GainNode | null = null;
  private activeNodes: { stop: () => void }[] = [];
  private trackTimer: number | null = null;
  private playbackTime: number = 0;
  private onTimeUpdateCallback: ((time: number, duration: number) => void) | null = null;
  private onTrackEndCallback: (() => void) | null = null;

  public tracks = [
    { id: 1, name: "Atelier Noturno", duration: 166, description: "Síntese de frequências quentes e respiro analógico." },
    { id: 2, name: "Tear Tipográfico", duration: 141, description: "Harmonia modular de pulsos e ritmo editorial." },
    { id: 3, name: "Prensa de Alta Precisão", duration: 148, description: "Resonância tonal metálica de impressão gráfica A4." },
    { id: 4, name: "Câmara de Curadoria", duration: 177, description: "Drone textural contínuo para foco e composição." },
  ];

  private getAudioContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(0.35, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
    if (!enabled && this.isPlayingTrack) {
      this.pauseTrack();
    }
  }

  public getIsEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Dispara um micro-clique tátil com tom sutil (usado em botões e alternadores)
   */
  public playTactileClick(pitch: number = 880) {
    if (!this.isEnabled) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx || !this.masterGain) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(pitch, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(pitch * 0.5, ctx.currentTime + 0.04);

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.04);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } catch {
      // Ignora silenciosamente se o navegador restringir áudio
    }
  }

  /**
   * Dispara um micro-pulso harmônico suave ao girar os knobs analógicos
   */
  public playKnobTick(normalizedValue: number) {
    if (!this.isEnabled) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx || !this.masterGain) return;

      const baseFreq = 220 + normalizedValue * 660; // 220Hz a 880Hz
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);

      filter.type = "lowpass";
      filter.frequency.setValueAtTime(baseFreq * 1.5, ctx.currentTime);

      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.03);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc.start();
      osc.stop(ctx.currentTime + 0.035);
    } catch {
      // noop
    }
  }

  /**
   * Inicia ou pausa a reprodução da faixa sonora procedural
   */
  public toggleTrackPlayback(): boolean {
    if (this.isPlayingTrack) {
      this.pauseTrack();
      return false;
    } else {
      this.playCurrentTrack();
      return true;
    }
  }

  public playCurrentTrack() {
    if (!this.isEnabled) return;
    this.stopActiveProceduralSound();

    const ctx = this.getAudioContext();
    if (!ctx || !this.masterGain) return;

    this.isPlayingTrack = true;
    const track = this.tracks[this.currentTrackIndex];

    // Gerador de Drone Harmônico Procedural baseado no índice da faixa
    const chordFrequencies = [
      [110, 164.81, 220, 329.63], // A2, E3, A3, E4 (Atelier Noturno)
      [130.81, 196, 261.63, 392],  // C3, G3, C4, G4 (Tear Tipográfico)
      [146.83, 220, 293.66, 440],  // D3, A3, D4, A4 (Prensa de Alta Precisão)
      [123.47, 185, 246.94, 370],  // B2, F#3, B3, F#4 (Câmara de Curadoria)
    ][this.currentTrackIndex % 4];

    const nodesToStop: { stop: () => void }[] = [];

    // 1. Acordes fundamentais com filtro suave
    chordFrequencies.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = idx % 2 === 0 ? "sine" : "triangle";
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      // Leve desafinação analógica quente
      osc.detune.setValueAtTime((Math.random() - 0.5) * 8, ctx.currentTime);

      filter.type = "lowpass";
      filter.frequency.setValueAtTime(800 + idx * 200, ctx.currentTime);

      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.05 / (idx + 1), ctx.currentTime + 1.5);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain!);

      osc.start();
      nodesToStop.push(osc);
    });

    // 2. Ruído térmico suave de fita (Tape Warmth)
    const bufferSize = ctx.sampleRate * 2;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      output[i] = (lastOut + 0.02 * white) / 1.02; // Ruído rosa suave
      lastOut = output[i];
    }

    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.setValueAtTime(450, ctx.currentTime);
    noiseFilter.Q.setValueAtTime(1.0, ctx.currentTime);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.001, ctx.currentTime);
    noiseGain.gain.linearRampToValueAtTime(0.015, ctx.currentTime + 2.0);

    whiteNoise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain);

    whiteNoise.start();
    nodesToStop.push(whiteNoise);

    this.activeNodes = nodesToStop;

    // Timer de atualização de playback
    if (this.trackTimer) clearInterval(this.trackTimer);
    this.trackTimer = window.setInterval(() => {
      this.playbackTime += 1;
      if (this.onTimeUpdateCallback) {
        this.onTimeUpdateCallback(this.playbackTime, track.duration);
      }
      if (this.playbackTime >= track.duration) {
        if (this.onTrackEndCallback) {
          this.onTrackEndCallback();
        }
        this.nextTrack();
      }
    }, 1000);
  }

  public pauseTrack() {
    this.isPlayingTrack = false;
    this.stopActiveProceduralSound();
    if (this.trackTimer) {
      clearInterval(this.trackTimer);
      this.trackTimer = null;
    }
  }

  public nextTrack() {
    this.currentTrackIndex = (this.currentTrackIndex + 1) % this.tracks.length;
    this.playbackTime = 0;
    if (this.isPlayingTrack) {
      this.playCurrentTrack();
    }
  }

  public prevTrack() {
    this.currentTrackIndex = (this.currentTrackIndex - 1 + this.tracks.length) % this.tracks.length;
    this.playbackTime = 0;
    if (this.isPlayingTrack) {
      this.playCurrentTrack();
    }
  }

  public seek(seconds: number) {
    const track = this.tracks[this.currentTrackIndex];
    this.playbackTime = Math.max(0, Math.min(seconds, track.duration));
    if (this.onTimeUpdateCallback) {
      this.onTimeUpdateCallback(this.playbackTime, track.duration);
    }
  }

  public setMasterGain(gainFraction: number) {
    if (!this.masterGain || !this.ctx) return;
    const clamped = Math.max(0, Math.min(gainFraction, 1.0));
    this.masterGain.gain.setValueAtTime(clamped * 0.5, this.ctx.currentTime);
  }

  public getCurrentTrack() {
    return this.tracks[this.currentTrackIndex];
  }

  public getIsPlaying(): boolean {
    return this.isPlayingTrack;
  }

  public getPlaybackTime(): number {
    return this.playbackTime;
  }

  public onTimeUpdate(callback: (time: number, duration: number) => void) {
    this.onTimeUpdateCallback = callback;
  }

  public onTrackEnd(callback: () => void) {
    this.onTrackEndCallback = callback;
  }

  private stopActiveProceduralSound() {
    this.activeNodes.forEach(node => {
      try {
        node.stop();
      } catch {
        // noop
      }
    });
    this.activeNodes = [];
  }
}

export const catanaAudio = new CatanaAudioEngine();
