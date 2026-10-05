import React from 'react';
import { Trash2, RotateCw, ZoomIn, ZoomOut } from 'lucide-react';
import { CatalogPageData, PageOverlayElement } from '../../data/editorialCatalog.mock';
import { useStudioStore, API_BASE_URL } from '../../store/studioStore';

interface PageOverlayLayerProps {
  page: CatalogPageData;
  interactive?: boolean;
}

// Coordenadas padrao dos slots de produtos por layout (em percentual de 0 a 100)
function getProductSlotCoords(layoutType: string, slotIndex: number): { x: number; y: number; width: number; height: number } {
  switch (layoutType) {
    case 'hero':
      return { x: 50, y: 44, width: 260, height: 260 };
    case 'single':
      return { x: 50, y: 40, width: 280, height: 280 };
    case 'duo':
      return slotIndex === 0
        ? { x: 50, y: 30, width: 220, height: 220 }
        : { x: 50, y: 68, width: 220, height: 220 };
    case 'grid_4': {
      const positions = [
        { x: 30, y: 28, width: 170, height: 170 },
        { x: 70, y: 28, width: 170, height: 170 },
        { x: 30, y: 70, width: 170, height: 170 },
        { x: 70, y: 70, width: 170, height: 170 },
      ];
      return positions[slotIndex % 4];
    }
    default:
      return { x: 50, y: 50, width: 200, height: 200 };
  }
}

export const PageOverlayLayer: React.FC<PageOverlayLayerProps> = ({ page, interactive = true }) => {
  const {
    selectedElementId,
    setSelectedElementId,
    removePageOverlay,
    updatePageOverlay,
    activePalette,
  } = useStudioStore();

  const overlays = page.overlays || [];
  if (overlays.length === 0) return null;

  const defaultAccent = page.accentColor || activePalette.accent || '#B08D57';

  // Handler de selecao
  const handleSelect = (e: React.MouseEvent, overlayId: string) => {
    if (!interactive) return;
    e.stopPropagation();
    const fullId = `page-${page.pageNumber}-overlay-${overlayId}`;
    if (selectedElementId === fullId) {
      setSelectedElementId(null);
    } else {
      setSelectedElementId(fullId);
    }
  };

  return (
    <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden select-none">
      {overlays.map((element) => {
        const fullId = `page-${page.pageNumber}-overlay-${element.id}`;
        const isSelected = interactive && selectedElementId === fullId;

        // Determina posicao efetiva (slot ancorado ou x/y livre)
        let effX = element.x ?? 50;
        let effY = element.y ?? 50;
        let effW = element.width ?? 120;
        let effH = element.height ?? 120;

        if (typeof element.targetSlotIndex === 'number') {
          const slotCoords = getProductSlotCoords(page.type, element.targetSlotIndex);
          if (element.x === undefined || element.x === null) effX = slotCoords.x;
          if (element.y === undefined || element.y === null) effY = slotCoords.y;
          if (!element.width) effW = slotCoords.width;
          if (!element.height) effH = slotCoords.height;
        }

        const color = element.color || defaultAccent;
        const rotation = element.rotation || 0;
        const scale = element.scale || 1;
        const opacity = element.opacity ?? 1;

        return (
          <div
            key={element.id}
            data-overlay-id={element.id}
            onClick={interactive ? (e) => handleSelect(e, element.id) : undefined}
            className={`absolute transition-transform ${
              interactive ? 'pointer-events-auto cursor-pointer group' : 'pointer-events-none'
            } ${
              isSelected ? 'ring-2 ring-amber-500/80 ring-offset-2 ring-offset-transparent' : ''
            }`}
            style={{
              left: `${effX}%`,
              top: `${effY}%`,
              transform: `translate(-50%, -50%) rotate(${rotation}deg) scale(${scale})`,
              opacity,
              zIndex: element.zIndex || (isSelected ? 40 : 25),
            }}
          >
            {/* Renderizador de cada tipo de overlay */}
            {renderOverlayContent(element, color, defaultAccent, effW, effH)}

            {/* Barra de Acoes Flutuante ao Selecionar */}
            {isSelected && interactive && (
              <div
                className="absolute -top-10 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-1 bg-zinc-900/90 text-white rounded-md shadow-xl border border-zinc-700/80 text-xs backdrop-blur-sm pointer-events-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  title="Rotacionar +15 graus"
                  aria-label="Rotacionar overlay"
                  onClick={() =>
                    updatePageOverlay(page.pageNumber, element.id, {
                      rotation: (rotation + 15) % 360,
                    })
                  }
                  className="p-1 hover:bg-zinc-700 rounded transition-colors text-zinc-300 hover:text-white cursor-pointer"
                >
                  <RotateCw className="size-3.5" />
                </button>
                <button
                  type="button"
                  title="Aumentar escala"
                  aria-label="Aumentar escala"
                  onClick={() =>
                    updatePageOverlay(page.pageNumber, element.id, {
                      scale: Math.min(2.5, +(scale + 0.1).toFixed(2)),
                    })
                  }
                  className="p-1 hover:bg-zinc-700 rounded transition-colors text-zinc-300 hover:text-white cursor-pointer"
                >
                  <ZoomIn className="size-3.5" />
                </button>
                <button
                  type="button"
                  title="Diminuir escala"
                  aria-label="Diminuir escala"
                  onClick={() =>
                    updatePageOverlay(page.pageNumber, element.id, {
                      scale: Math.max(0.4, +(scale - 0.1).toFixed(2)),
                    })
                  }
                  className="p-1 hover:bg-zinc-700 rounded transition-colors text-zinc-300 hover:text-white cursor-pointer"
                >
                  <ZoomOut className="size-3.5" />
                </button>
                <div className="w-[1px] h-3.5 bg-zinc-700 mx-0.5" />
                <button
                  type="button"
                  title="Excluir elemento"
                  aria-label="Excluir overlay"
                  onClick={() => removePageOverlay(page.pageNumber, element.id)}
                  className="p-1 hover:bg-red-900/50 rounded transition-colors text-red-400 hover:text-red-300 cursor-pointer"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// Funcao auxiliar para renderizar o conteudo visual vetorial de cada overlay
function renderOverlayContent(
  element: PageOverlayElement,
  color: string,
  accent: string,
  width: number,
  height: number
) {
  const subType = element.subType || '';

  switch (element.type) {
    // ----------------------------------------------------
    // 0. SPRITES GENERATIVOS POR IA (GEMINI + ALPHA MASK)
    // ----------------------------------------------------
    case 'sprite':
      return renderSpriteOverlay(element, width, height);

    // ----------------------------------------------------
    // 1. CONFETES, BRILHOS & ESTRELAS DE AMBIENTACAO
    // ----------------------------------------------------
    case 'stars':
    case 'particles':
      return renderStars(element, color, accent);

    case 'confetti':
      if (subType === 'stars' || subType === 'stardust' || subType === 'particles') {
        return renderStars(element, color, accent);
      }
      return renderConfetti(element, color, accent);

    case 'sparkles':
      return renderSparkles(element, color, accent);

    // ----------------------------------------------------
    // 2. CIRCULOS DE FOCO & DESTAQUES DE PRODUTO
    // ----------------------------------------------------
    case 'focus_ring':
      return renderFocusRing(element, subType, color, width, height);

    // ----------------------------------------------------
    // 3. SETAS & ANOTACOES
    // ----------------------------------------------------
    case 'arrow':
      return renderArrow(element, subType, color);

    // ----------------------------------------------------
    // 4. FORMAS GEOMETRICAS
    // ----------------------------------------------------
    case 'shape':
      return renderShape(element, subType, color, width, height);

    // ----------------------------------------------------
    // 5. SELOS & BADGES PROMOCIONAIS
    // ----------------------------------------------------
    case 'badge':
      return renderBadge(element, subType, color);

    // ----------------------------------------------------
    // 6. CARIMBOS EDITORIAIS
    // ----------------------------------------------------
    case 'stamp':
      return renderStamp(element, color);

    // ----------------------------------------------------
    // 7. DIVISORES & FILETES ORNAMENTAIS
    // ----------------------------------------------------
    case 'divider_rule':
      return renderDividerRule(element, color, width);

    default:
      return null;
  }
}

// --------------------------------------------------------
// Sub-renderizadores de Alta Fidelidade Vetorial & Sprites
// --------------------------------------------------------

function resolveMediaUrl(url?: string): string {
  if (!url) return '';
  if (/^https?:\/\//.test(url) || url.startsWith('data:') || url.startsWith('blob:')) return url;
  if (url.startsWith('/')) return `${API_BASE_URL}${url}`;
  return url;
}

function renderSpriteOverlay(element: PageOverlayElement, width: number, height: number) {
  if (!element.imageUrl) {
    return (
      <div className="flex items-center justify-center p-3 rounded-lg border border-dashed border-zinc-600 bg-zinc-900/60 text-xs text-zinc-400">
        Gerando sprite IA...
      </div>
    );
  }

  const resolvedSrc = resolveMediaUrl(element.imageUrl);

  return (
    <div
      className="relative flex items-center justify-center pointer-events-none select-none"
      style={{
        width: width ? `${width}px` : '100%',
        height: height ? `${height}px` : '100%',
        minWidth: 40,
        minHeight: 40,
      }}
    >
      <img
        src={resolvedSrc}
        alt={element.text || element.prompt || 'Sprite visual'}
        className="w-full h-full object-contain drop-shadow-md pointer-events-none"
        draggable={false}
        onError={() => {
          console.warn('[PageOverlayLayer] Falha ao carregar sprite:', resolvedSrc);
        }}
      />
    </div>
  );
}

function renderStars(element: PageOverlayElement, color: string, _accent: string) {
  // Cores celestiais refinadas de alto padrao
  const isCustomColor = color && color.toUpperCase() !== '#B08D57';
  const baseColor = isCustomColor ? color : '#FFFFFF';

  const starColors = isCustomColor
    ? [
        baseColor,
        '#FFFFFF',
        `${baseColor}CC`,
        `${baseColor}EE`,
        `${baseColor}99`,
      ]
    : [
        '#FFFFFF', // Branco estelar brilhante
        '#F8FAFC', // Slate puro
        '#FFFBEB', // Ouro cosmico suave
        '#FEF3C7', // Ambar estelar sutil
        '#E0F2FE', // Azul nebulosa
        '#F1F5F9', // Prata celestial
      ];

  const count = element.density === 'high' ? 95 : element.density === 'low' ? 40 : 65;

  const stars = Array.from({ length: count }).map((_, i) => {
    const seed = (i * 7919 + 65537) % 233280;
    const rnd1 = (seed / 233280);
    const rnd2 = ((seed * 19) % 233280) / 233280;
    const rnd3 = ((seed * 47) % 233280) / 233280;
    const rnd4 = ((seed * 89) % 233280) / 233280;

    // Distribuicao organica em toda a folha A4 (490x693px)
    const px = (rnd1 * 470) - 235;
    const py = (rnd2 * 670) - 335;
    const sColor = starColors[i % starColors.length];
    const sOpacity = 0.35 + rnd3 * 0.65;
    const sScale = 0.6 + rnd4 * 0.9;
    const starType = i % 10; // 0,1=estrela 4 pontas c/ brilho, 2,3,4=diamante micro, 5..9=ponto estelar

    return { id: i, px, py, sColor, sOpacity, sScale, starType };
  });

  return (
    <div className="relative w-[490px] h-[693px] pointer-events-none">
      <svg className="w-full h-full" viewBox="-245 -346 490 693" fill="none">
        {stars.map((s) => {
          if (s.starType <= 1) {
            // Estrela cruz de 4 pontas com nucleo brilhante
            const r = 5.5 * s.sScale;
            return (
              <g key={s.id} opacity={s.sOpacity}>
                {/* Brilho cruzado em 4 pontas */}
                <path
                  d={`M ${s.px} ${s.py - r} Q ${s.px} ${s.py}, ${s.px + r} ${s.py} Q ${s.px} ${s.py}, ${s.px} ${s.py + r} Q ${s.px} ${s.py}, ${s.px - r} ${s.py} Q ${s.px} ${s.py}, ${s.px} ${s.py - r} Z`}
                  fill={s.sColor}
                />
                {/* Nucleo estelar concentrado */}
                <circle cx={s.px} cy={s.py} r={1.2 * s.sScale} fill="#FFFFFF" />
              </g>
            );
          } else if (s.starType <= 4) {
            // Micro-diamante estelar
            const d = 2.2 * s.sScale;
            return (
              <polygon
                key={s.id}
                points={`${s.px},${s.py - d} ${s.px + d},${s.py} ${s.px},${s.py + d} ${s.px - d},${s.py}`}
                fill={s.sColor}
                opacity={s.sOpacity}
              />
            );
          } else {
            // Ponto de luz estelar circular (stardust / poeira cosmica)
            const rad = (0.7 + (s.id % 3) * 0.45) * s.sScale;
            return (
              <circle
                key={s.id}
                cx={s.px}
                cy={s.py}
                r={rad}
                fill={s.sColor}
                opacity={s.sOpacity}
              />
            );
          }
        })}
      </svg>
    </div>
  );
}

function renderConfetti(element: PageOverlayElement, color: string, accent: string) {
  const subType = element.subType || '';
  const isGoldConfetti = subType === 'gold_confetti' || subType === 'luxury';

  // Paleta adaptada ao estilo
  const confettiColors = isGoldConfetti
    ? [
        '#D4AF37', // Ouro puro
        '#F3E5AB', // Champanhe
        '#C5A059', // Ouro acetinado
        '#AA7A44', // Bronze nobre
        '#FAF0E6', // Marfim
        '#FFFFFF', // Reflexo branco
      ]
    : [
        color,
        accent,
        '#E63946', // Carmim festivo
        '#F4A261', // Ambar
        '#2A9D8F', // Esmeralda
        '#457B9D', // Azul ceruleo
        '#E76F51', // Terracota
        '#D4AF37', // Ouro puro
        '#9B5DE5', // Lavanda nobre
        '#00BBF9', // Ciano
      ];

  const count = element.density === 'high' ? 42 : element.density === 'low' ? 18 : 28;

  // Gerador deterministico baseado no ID para estabilidade visual
  const particles = Array.from({ length: count }).map((_, i) => {
    const seed = (i * 9301 + 49297) % 233280;
    const rnd1 = (seed / 233280);
    const rnd2 = ((seed * 13) % 233280) / 233280;
    const rnd3 = ((seed * 37) % 233280) / 233280;
    const rnd4 = ((seed * 71) % 233280) / 233280;

    const px = (rnd1 * 460) - 230;
    const py = (rnd2 * 600) - 300;
    const pColor = confettiColors[i % confettiColors.length];
    const pRotate = rnd3 * 360;
    const pScale = 0.6 + rnd4 * 0.8;
    const shapeType = i % 4; // 0=retangulo, 1=circulo, 2=fita curva, 3=diamante

    return { id: i, px, py, pColor, pRotate, pScale, shapeType };
  });

  return (
    <div className="relative w-[480px] h-[640px] pointer-events-none">
      <svg className="w-full h-full" viewBox="-240 -320 480 640" fill="none">
        {particles.map((p) => {
          if (p.shapeType === 0) {
            // Retangulo clássico de confete
            return (
              <rect
                key={p.id}
                x={p.px}
                y={p.py}
                width={12 * p.pScale}
                height={6 * p.pScale}
                rx={1.5}
                fill={p.pColor}
                opacity={0.88}
                transform={`rotate(${p.pRotate} ${p.px} ${p.py})`}
              />
            );
          } else if (p.shapeType === 1) {
            // Circulo de confete
            return (
              <circle
                key={p.id}
                cx={p.px}
                cy={p.py}
                r={4 * p.pScale}
                fill={p.pColor}
                opacity={0.85}
              />
            );
          } else if (p.shapeType === 2) {
            // Fita serpentina ondulada
            return (
              <path
                key={p.id}
                d={`M ${p.px} ${p.py} Q ${p.px + 8} ${p.py + 6}, ${p.px + 4} ${p.py + 14} T ${p.px + 10} ${p.py + 22}`}
                stroke={p.pColor}
                strokeWidth={2.5 * p.pScale}
                strokeLinecap="round"
                fill="none"
                opacity={0.82}
                transform={`rotate(${p.pRotate} ${p.px} ${p.py})`}
              />
            );
          } else {
            // Diamante / Losango festivo
            const s = 6 * p.pScale;
            return (
              <polygon
                key={p.id}
                points={`${p.px},${p.py - s} ${p.px + s},${p.py} ${p.px},${p.py + s} ${p.px - s},${p.py}`}
                fill={p.pColor}
                opacity={0.9}
                transform={`rotate(${p.pRotate} ${p.px} ${p.py})`}
              />
            );
          }
        })}
      </svg>
    </div>
  );
}

function renderSparkles(_element: PageOverlayElement, color: string, accent: string) {
  const sparkleColor = color || accent || '#D4AF37';
  return (
    <div className="relative w-28 h-28 pointer-events-none">
      <svg className="w-full h-full" viewBox="0 0 100 100" fill="none">
        {/* Estrela central grande de 4 pontas */}
        <path
          d="M 50 10 Q 50 50, 90 50 Q 50 50, 50 90 Q 50 50, 10 50 Q 50 50, 50 10 Z"
          fill={sparkleColor}
          opacity={0.95}
        />
        {/* Ponto de luz no nucleo */}
        <circle cx="50" cy="50" r="4" fill="#FFFFFF" opacity={0.9} />
        {/* Estrela secundaria menor a esquerda */}
        <path
          d="M 22 18 Q 22 30, 34 30 Q 22 30, 22 42 Q 22 30, 10 30 Q 22 30, 22 18 Z"
          fill={sparkleColor}
          opacity={0.75}
        />
        {/* Estrela secundaria menor a direita */}
        <path
          d="M 80 68 Q 80 78, 90 78 Q 80 78, 80 88 Q 80 78, 70 78 Q 80 78, 80 68 Z"
          fill={sparkleColor}
          opacity={0.8}
        />
      </svg>
    </div>
  );
}

function renderFocusRing(
  element: PageOverlayElement,
  subType: string,
  color: string,
  width: number,
  height: number
) {
  const w = Math.max(80, width);
  const h = Math.max(80, height);
  const strokeWidth = element.strokeWidth || 3;

  if (subType === 'dashed_ring') {
    return (
      <div style={{ width: `${w}px`, height: `${h}px` }} className="relative pointer-events-none">
        <svg className="w-full h-full" viewBox="0 0 100 100">
          <ellipse
            cx="50"
            cy="50"
            rx="46"
            ry="46"
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray="6 4"
            opacity={0.9}
          />
        </svg>
      </div>
    );
  }

  if (subType === 'glowing_ring') {
    return (
      <div
        style={{ width: `${w}px`, height: `${h}px` }}
        className="relative pointer-events-none rounded-full flex items-center justify-center"
      >
        <div
          className="w-full h-full rounded-full border-2 transition-all"
          style={{
            borderColor: color,
            boxShadow: `0 0 16px ${color}88, inset 0 0 16px ${color}33`,
          }}
        />
      </div>
    );
  }

  if (subType === 'bracket_frame') {
    // Cantoneiras editoriais de foco [ ]
    return (
      <div style={{ width: `${w}px`, height: `${h}px` }} className="relative pointer-events-none">
        <svg className="w-full h-full" viewBox="0 0 100 100" fill="none">
          {/* Top Left */}
          <path d="M 5 22 L 5 5 L 22 5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
          {/* Top Right */}
          <path d="M 78 5 L 95 5 L 95 22" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
          {/* Bottom Left */}
          <path d="M 5 78 L 5 95 L 22 95" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
          {/* Bottom Right */}
          <path d="M 78 95 L 95 95 L 95 78" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
        </svg>
      </div>
    );
  }

  if (subType === 'spotlight') {
    return (
      <div
        style={{
          width: `${w * 1.3}px`,
          height: `${h * 1.3}px`,
          background: `radial-gradient(circle, ${color}22 0%, ${color}08 50%, transparent 75%)`,
        }}
        className="rounded-full pointer-events-none"
      />
    );
  }

  // Padrao: hand_drawn_circle (Circulo editorial organico estilo caneta/marcador)
  return (
    <div style={{ width: `${w}px`, height: `${h}px` }} className="relative pointer-events-none">
      <svg className="w-full h-full" viewBox="0 0 200 200" fill="none">
        {/* Traco duplo organico com variacao suave */}
        <path
          d="M 100 16 C 148 14, 186 52, 185 100 C 184 148, 148 184, 98 186 C 48 188, 14 148, 15 99 C 16 52, 54 18, 102 16 C 145 14, 180 50, 181 96"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity={0.92}
        />
      </svg>
    </div>
  );
}

function renderArrow(element: PageOverlayElement, subType: string, color: string) {
  const text = element.text;
  const dir = element.arrowDirection || 'to_bottom_right';

  // Se tem texto de callout integrado (ex: "Mais Vendido", "Edicao Limitada")
  if (subType === 'callout_arrow' || text) {
    return (
      <div className="flex flex-col items-center gap-1 pointer-events-none">
        {text && (
          <div
            className="px-2.5 py-1 rounded-full text-xs font-semibold tracking-wider uppercase shadow-md whitespace-nowrap"
            style={{
              backgroundColor: color,
              color: '#FFFFFF',
              fontFamily: "'Jost', sans-serif",
            }}
          >
            {text}
          </div>
        )}
        <svg className="w-16 h-12" viewBox="0 0 64 48" fill="none">
          <path
            d="M 32 4 Q 32 24, 46 36"
            stroke={color}
            strokeWidth={3}
            strokeLinecap="round"
            fill="none"
          />
          <polygon points="48,42 42,32 50,30" fill={color} />
        </svg>
      </div>
    );
  }

  if (subType === 'straight_arrow') {
    return (
      <div className="w-16 h-10 pointer-events-none">
        <svg className="w-full h-full" viewBox="0 0 64 40" fill="none">
          <line x1="8" y1="20" x2="52" y2="20" stroke={color} strokeWidth={3} strokeLinecap="round" />
          <polygon points="56,20 44,14 44,26" fill={color} />
        </svg>
      </div>
    );
  }

  // Padrao: curved_arrow elegante editorial
  return (
    <div className="w-20 h-16 pointer-events-none">
      <svg className="w-full h-full" viewBox="0 0 80 64" fill="none">
        <path
          d={dir === 'to_left' ? 'M 64 12 Q 24 16, 18 46' : 'M 16 12 Q 56 16, 62 46'}
          stroke={color}
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={subType === 'dashed' ? '4 3' : undefined}
          fill="none"
        />
        {dir === 'to_left' ? (
          <polygon points="14,52 24,44 14,40" fill={color} />
        ) : (
          <polygon points="66,52 66,40 56,44" fill={color} />
        )}
      </svg>
    </div>
  );
}

function renderShape(
  element: PageOverlayElement,
  subType: string,
  color: string,
  width: number,
  height: number
) {
  const w = Math.max(40, width);
  const h = Math.max(40, height);
  const fill = element.fillColor || `${color}22`;
  const stroke = element.strokeColor || color;
  const sw = element.strokeWidth || 2;

  if (subType === 'star') {
    // Estrela geometrica de 8 pontas nobre
    return (
      <div style={{ width: `${w}px`, height: `${h}px` }} className="pointer-events-none">
        <svg className="w-full h-full" viewBox="0 0 100 100" fill="none">
          <polygon
            points="50,5 62,35 95,50 62,65 50,95 38,65 5,50 38,35"
            fill={fill}
            stroke={stroke}
            strokeWidth={sw}
            strokeLinejoin="round"
          />
        </svg>
      </div>
    );
  }

  if (subType === 'polygon' || subType === 'hexagon') {
    return (
      <div style={{ width: `${w}px`, height: `${h}px` }} className="pointer-events-none">
        <svg className="w-full h-full" viewBox="0 0 100 100" fill="none">
          <polygon
            points="50,5 90,27.5 90,72.5 50,95 10,72.5 10,27.5"
            fill={fill}
            stroke={stroke}
            strokeWidth={sw}
            strokeLinejoin="round"
          />
        </svg>
      </div>
    );
  }

  if (subType === 'triangle') {
    return (
      <div style={{ width: `${w}px`, height: `${h}px` }} className="pointer-events-none">
        <svg className="w-full h-full" viewBox="0 0 100 100" fill="none">
          <polygon points="50,10 90,90 10,90" fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
        </svg>
      </div>
    );
  }

  if (subType === 'circle') {
    return (
      <div
        style={{
          width: `${w}px`,
          height: `${h}px`,
          borderColor: stroke,
          borderWidth: `${sw}px`,
          backgroundColor: fill,
        }}
        className="rounded-full pointer-events-none"
      />
    );
  }

  // Padrao: rectangle / moldura elegante
  return (
    <div
      style={{
        width: `${w}px`,
        height: `${h}px`,
        borderColor: stroke,
        borderWidth: `${sw}px`,
        backgroundColor: fill,
      }}
      className="rounded-lg pointer-events-none"
    />
  );
}

function renderBadge(element: PageOverlayElement, subType: string, color: string) {
  const text = element.text || 'OFERTA';
  const subText = element.subText;

  if (subType === 'corner_ribbon') {
    return (
      <div className="relative pointer-events-none shadow-lg">
        <div
          className="px-6 py-1 text-[10px] font-bold tracking-widest uppercase text-white shadow-md text-center rotate-[-45deg]"
          style={{
            backgroundColor: color,
            fontFamily: "'Jost', sans-serif",
          }}
        >
          {text}
        </div>
      </div>
    );
  }

  if (subType === 'feature_pill') {
    return (
      <div
        className="px-3 py-1 rounded-full text-[11px] font-medium tracking-wide uppercase border flex items-center gap-1.5 shadow-sm whitespace-nowrap pointer-events-none"
        style={{
          backgroundColor: `${color}18`,
          borderColor: `${color}66`,
          color,
          fontFamily: "'Jost', sans-serif",
        }}
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
        {text}
      </div>
    );
  }

  // Padrao: discount_badge circular recortado
  return (
    <div
      className="relative w-20 h-20 rounded-full flex flex-col items-center justify-center text-center text-white shadow-xl pointer-events-none border-2 border-white/20"
      style={{
        backgroundColor: color,
        fontFamily: "'Jost', sans-serif",
      }}
    >
      <span className="text-base font-extrabold tracking-tight leading-none">{text}</span>
      {subText && <span className="text-[9px] uppercase tracking-wider font-semibold opacity-90 mt-0.5">{subText}</span>}
    </div>
  );
}

function renderStamp(element: PageOverlayElement, color: string) {
  const text = (element.text || 'AUTENTICO').toUpperCase();
  const subText = (element.subText || 'KATANA ATELIER').toUpperCase();

  return (
    <div
      className="relative w-28 h-28 rounded-full border-2 border-dashed flex flex-col items-center justify-center p-2 text-center pointer-events-none select-none shadow-sm"
      style={{
        borderColor: color,
        color,
        fontFamily: "'Cormorant Garamond', Georgia, serif",
      }}
    >
      {/* Moldura circular interna solida */}
      <div
        className="absolute inset-1.5 rounded-full border border-solid opacity-60 pointer-events-none"
        style={{ borderColor: color }}
      />
      <span className="text-[9px] tracking-[0.25em] font-sans font-semibold uppercase opacity-80 mb-0.5">
        {subText}
      </span>
      <span className="text-base font-bold tracking-[0.15em] uppercase border-y py-0.5 my-0.5 w-4/5 leading-tight" style={{ borderColor: `${color}66` }}>
        {text}
      </span>
      <span className="text-[8px] tracking-[0.3em] font-sans uppercase opacity-70 mt-0.5">
        ORIGINAL
      </span>
    </div>
  );
}

function renderDividerRule(_element: PageOverlayElement, color: string, width: number) {
  const w = Math.max(120, width);
  return (
    <div style={{ width: `${w}px` }} className="flex items-center justify-center pointer-events-none py-2">
      <div className="h-[1px] flex-1 opacity-60" style={{ backgroundColor: color }} />
      <div className="mx-2 w-2 h-2 rotate-45 border" style={{ borderColor: color, backgroundColor: `${color}33` }} />
      <div className="h-[1px] flex-1 opacity-60" style={{ backgroundColor: color }} />
    </div>
  );
}
