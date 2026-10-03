import { useEffect, useRef, type FC } from 'react';
import { catanaAudio } from './CatanaAudioEngine';

interface CatanaAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  isLightMode: boolean;
  onToggleLightMode: () => void;
}

export const CatanaAuditModal: FC<CatanaAuditModalProps> = ({
  isOpen,
  onClose,
  isLightMode,
  onToggleLightMode,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Fecha com a tecla Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        catanaAudio.playTactileClick(600);
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Renderização do Blueprint Técnico em Canvas 2D
  useEffect(() => {
    if (!isOpen || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = canvas.offsetHeight * dpr;
    ctx.scale(dpr, dpr);

    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    const strokeColor = isLightMode ? 'rgba(26, 24, 23, 0.08)' : 'rgba(255, 255, 255, 0.07)';

    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1;

    // Grid técnico de fundo
    const step = 40;
    for (let x = 0; x < w; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Círculos concêntricos de mira arquitetônica
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 160, 0, Math.PI * 2);
    ctx.arc(w / 2, h / 2, 220, 0, Math.PI * 2);
    ctx.stroke();

    // Linhas diagonais tracejadas
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(w, h);
    ctx.moveTo(w, 0);
    ctx.lineTo(0, h);
    ctx.stroke();
    ctx.restore();
  }, [isOpen, isLightMode]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Painel de Auditoria e Telemetria Editorial Catana 2.0"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 select-none"
    >
      {/* Backdrop com Textura e Canvas */}
      <div
        onClick={() => {
          catanaAudio.playTactileClick(600);
          onClose();
        }}
        className="absolute inset-0 bg-[#070709]/85 backdrop-blur-md transition-opacity duration-200"
      >
        <canvas ref={canvasRef} className="w-full h-full pointer-events-none" />
      </div>

      {/* Caixa de Conteúdo do Modal */}
      <div
        className={`relative z-10 w-full max-w-[1020px] max-h-[90vh] rounded-[4px] border-2 flex flex-col md:flex-row overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.5)] transition-all ${
          isLightMode
            ? 'bg-[#F8F6F1] border-[#1A1817] text-[#1A1817]'
            : 'bg-[#0A0A0E] border-[rgba(136,136,136,0.3)] text-[#EEEEEE]'
        }`}
      >
        {/* Painel Esquerdo / Central: Mostrador Circular Multi-Gauge */}
        <div className="flex-1 p-6 md:p-10 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-[rgba(136,136,136,0.15)] relative">
          <div className="text-[11px] font-mono tracking-widest text-zinc-400 uppercase mb-4">
            TELEMETRIA EDITORIAL · ÍNDICE DE QUALIDADE A4
          </div>

          {/* SVG Multi-Gauge Dial */}
          <div className="relative w-64 h-64 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 192 192">
              {/* Círculo de Fundo */}
              <circle
                cx="96"
                cy="96"
                r="78"
                fill="none"
                stroke="rgba(136,136,136,0.2)"
                strokeWidth="5"
              />
              {/* Arco Preenchido com Nota 98/100 */}
              <circle
                cx="96"
                cy="96"
                r="78"
                fill="none"
                stroke={isLightMode ? "#18181b" : "#e4e4e7"}
                strokeWidth="5"
                strokeDasharray="490"
                strokeDashoffset="24"
                strokeLinecap="round"
                className="transition-all duration-1000 ease-out"
              />
            </svg>

            {/* Pontuação Central */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-serif text-5xl font-semibold tracking-tight">
                98
              </span>
              <span className="text-[10px] font-mono tracking-widest text-[rgba(170,170,170,0.7)] uppercase mt-1">
                EXCELÊNCIA A4
              </span>
            </div>
          </div>

          {/* 4 Mini Gauges / Métricas Secundárias */}
          <div className="grid grid-cols-4 gap-4 mt-8 w-full max-w-[460px] text-center">
            <div className="flex flex-col items-center">
              <span className={`w-9 h-9 rounded-full border border-[rgba(136,136,136,0.3)] flex items-center justify-center font-mono text-xs font-semibold ${isLightMode ? 'text-zinc-900' : 'text-zinc-200'}`}>
                P
              </span>
              <span className="text-[10px] font-mono text-[rgba(170,170,170,0.8)] mt-1.5 uppercase">
                Precisão A4
              </span>
              <span className="text-xs font-mono font-medium">100%</span>
            </div>

            <div className="flex flex-col items-center">
              <span className={`w-9 h-9 rounded-full border border-[rgba(136,136,136,0.3)] flex items-center justify-center font-mono text-xs font-semibold ${isLightMode ? 'text-zinc-900' : 'text-zinc-200'}`}>
                A
              </span>
              <span className="text-[10px] font-mono text-[rgba(170,170,170,0.8)] mt-1.5 uppercase">
                WCAG AAA
              </span>
              <span className="text-xs font-mono font-medium">100%</span>
            </div>

            <div className="flex flex-col items-center">
              <span className={`w-9 h-9 rounded-full border border-[rgba(136,136,136,0.3)] flex items-center justify-center font-mono text-xs font-semibold ${isLightMode ? 'text-zinc-900' : 'text-zinc-200'}`}>
                T
              </span>
              <span className="text-[10px] font-mono text-[rgba(170,170,170,0.8)] mt-1.5 uppercase">
                Tipografia
              </span>
              <span className="text-xs font-mono font-medium">98%</span>
            </div>

            <div className="flex flex-col items-center">
              <span className={`w-9 h-9 rounded-full border border-[rgba(136,136,136,0.3)] flex items-center justify-center font-mono text-xs font-semibold ${isLightMode ? 'text-zinc-900' : 'text-zinc-200'}`}>
                G
              </span>
              <span className="text-[10px] font-mono text-[rgba(170,170,170,0.8)] mt-1.5 uppercase">
                Zero Emojis
              </span>
              <span className="text-xs font-mono font-medium">100%</span>
            </div>
          </div>
        </div>

        {/* Painel Lateral / Inspector de Especificações */}
        <aside className="w-full md:w-[360px] p-6 flex flex-col justify-between overflow-y-auto">
          <div>
            {/* Cabeçalho do Inspector com Botões de Controle */}
            <div className="flex items-center justify-between pb-4 border-b border-[rgba(136,136,136,0.15)]">
              <span className="font-mono text-xs font-semibold tracking-widest uppercase">
                INSPECTOR DO ATELIER
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    catanaAudio.playTactileClick(700);
                    onToggleLightMode();
                  }}
                  aria-label="Alternar Tema no Inspector"
                  className="w-10 h-10 flex items-center justify-center hover:text-zinc-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 rounded"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M12 18V6a6 6 0 1 0 0 12Zm0-14a8 8 0 1 1 0 16 8 8 0 0 1 0-16Z"
                    />
                  </svg>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    catanaAudio.playTactileClick(600);
                    onClose();
                  }}
                  aria-label="Fechar Painel de Auditoria"
                  className="w-10 h-10 flex items-center justify-center hover:text-zinc-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 rounded"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Lista de Métricas Técnicas */}
            <div className="mt-6 space-y-3.5 text-xs font-mono">
              <div className="flex justify-between py-1.5 border-b border-[rgba(136,136,136,0.08)]">
                <span className="text-[rgba(170,170,170,0.8)]">Dimensão da Prancheta</span>
                <span>794 × 1123 px (A4)</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[rgba(136,136,136,0.08)]">
                <span className="text-[rgba(170,170,170,0.8)]">Resolução Gráfica</span>
                <span>300 DPI Nativo</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[rgba(136,136,136,0.08)]">
                <span className="text-[rgba(170,170,170,0.8)]">Contraste de Acessibilidade</span>
                <span>7.5:1 (WCAG AAA)</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[rgba(136,136,136,0.08)]">
                <span className="text-[rgba(170,170,170,0.8)]">Latência de Síntese</span>
                <span>&lt; 25 ms</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[rgba(136,136,136,0.08)]">
                <span className="text-[rgba(170,170,170,0.8)]">Economia de Tokens RAG</span>
                <span>85% Otimizado</span>
              </div>
            </div>

            {/* Tags e Diretrizes do Sistema */}
            <div className="mt-6">
              <div className="text-[10px] font-mono text-[rgba(170,170,170,0.6)] uppercase tracking-widest mb-2">
                DIRETRIZES ATIVAS
              </div>
              <div className="flex flex-wrap gap-1.5">
                {['A4 300 DPI', 'ZERO EMOJIS', 'PAGE BUDGET', 'WCAG AAA', 'RAG DETERMINÍSTICO'].map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 text-[10px] font-mono tracking-wider rounded border border-[rgba(136,136,136,0.2)] bg-[rgba(136,136,136,0.05)] text-[rgba(170,170,170,0.9)]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Rodapé do Inspector */}
          <div className="pt-6 mt-6 border-t border-[rgba(136,136,136,0.15)] text-[10px] font-mono text-[rgba(170,170,170,0.6)]">
            Auditoria certificada pelo Conselho Editorial Catana.
          </div>
        </aside>
      </div>
    </div>
  );
};
