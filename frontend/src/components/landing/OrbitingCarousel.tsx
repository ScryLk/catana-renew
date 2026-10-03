import { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, MoveHorizontal } from 'lucide-react';

interface OrbitItem {
  id: string;
  index: string;
  brand: string;
  collection: string;
  segment: string;
  image: string;
  accent: string;
  link: string;
}

const ORBIT_ITEMS: OrbitItem[] = [
  {
    id: 'maison-verdana',
    index: '01',
    brand: 'Maison Verdana',
    collection: 'Hiver 2026',
    segment: 'Alta Costura',
    image: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=900&q=85',
    accent: '#B08D57',
    link: '/view/maison_verdana',
  },
  {
    id: 'aether-labs',
    index: '02',
    brand: 'Aether Labs',
    collection: 'Core Series M2',
    segment: 'Tech & Hardware',
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=900&q=85',
    accent: '#0284C7',
    link: '/view/aether_labs',
  },
  {
    id: 'vanguard-pack',
    index: '03',
    brand: 'Vanguard Pack',
    collection: 'Circular Kraft B2B',
    segment: 'Food Service',
    image: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=900&q=85',
    accent: '#10B981',
    link: '/view/vanguard_pack',
  },
  {
    id: 'atelier-cacao',
    index: '04',
    brand: 'Atelier Cacao',
    collection: 'Terroir 72%',
    segment: 'Gastronomia Fina',
    image: 'https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?w=900&q=85',
    accent: '#D97706',
    link: '/view/atelier_cacao',
  },
  {
    id: 'studio-noir',
    index: '05',
    brand: 'Studio Noir',
    collection: 'Monograph 04',
    segment: 'Design Autoral',
    image: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=900&q=85',
    accent: '#52525B',
    link: '/view/studio_noir',
  },
  {
    id: 'botanica-atelier',
    index: '06',
    brand: 'Botanica Parfum',
    collection: 'Extrait Rare',
    segment: 'Perfumaria de Nicho',
    image: 'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=900&q=85',
    accent: '#B08D57',
    link: '/view/botanica_parfum',
  },
];

export function OrbitingCarousel() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [rotation, setRotation] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const startXRef = useRef(0);
  const currentRotationRef = useRef(0);
  const velocityRef = useRef(0.08); // Initial gentle auto-spin velocity
  const lastXRef = useRef(0);
  const animFrameRef = useRef<number | null>(null);

  // Keep ref synchronized
  useEffect(() => {
    currentRotationRef.current = rotation;
  }, [rotation]);

  // Responsive radius & tilt calculation
  const [dimensions, setDimensions] = useState({ radius: 460, yOffset: 130 });

  useEffect(() => {
    const updateDimensions = () => {
      const w = window.innerWidth;
      if (w < 640) {
        setDimensions({ radius: 210, yOffset: 90 });
      } else if (w < 1024) {
        setDimensions({ radius: 340, yOffset: 110 });
      } else {
        setDimensions({ radius: 480, yOffset: 135 });
      }
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Main animation loop
  useEffect(() => {
    const loop = () => {
      if (!isDragging) {
        if (!isHovered) {
          currentRotationRef.current = (currentRotationRef.current + velocityRef.current) % 360;
          setRotation(currentRotationRef.current);
        } else {
          velocityRef.current *= 0.96;
          currentRotationRef.current = (currentRotationRef.current + velocityRef.current) % 360;
          setRotation(currentRotationRef.current);
        }
      }
      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isDragging, isHovered]);

  // Mouse & Touch Dragging Handlers
  const handleStart = (clientX: number) => {
    setIsDragging(true);
    startXRef.current = clientX;
    lastXRef.current = clientX;
  };

  const handleMove = useCallback(
    (clientX: number) => {
      if (!isDragging) return;
      const deltaX = clientX - lastXRef.current;
      lastXRef.current = clientX;

      const rotationDelta = deltaX * 0.28;
      currentRotationRef.current = (currentRotationRef.current + rotationDelta) % 360;
      velocityRef.current = rotationDelta * 0.15;
      setRotation(currentRotationRef.current);
    },
    [isDragging]
  );

  const handleEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (Math.abs(velocityRef.current) < 0.05) {
      velocityRef.current = 0.08;
    }
  };

  const count = ORBIT_ITEMS.length;
  const angleStep = 360 / count;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[660px] md:h-[780px] flex flex-col items-center justify-between pt-10 pb-6 select-none overflow-hidden cursor-grab active:cursor-grabbing"
      onMouseDown={(e) => handleStart(e.clientX)}
      onMouseMove={(e) => handleMove(e.clientX)}
      onMouseUp={handleEnd}
      onMouseLeave={handleEnd}
      onTouchStart={(e) => handleStart(e.touches[0].clientX)}
      onTouchMove={(e) => handleMove(e.touches[0].clientX)}
      onTouchEnd={handleEnd}
      onMouseEnter={() => setIsHovered(true)}
      data-cursor-label="DRAG · ORBIT"
      style={{
        perspective: '1600px',
      }}
    >
      {/* Central Monumental Brand Name "CATANA" (Elevated & 100% Unobstructed) */}
      <div className="relative z-20 pointer-events-none flex flex-col items-center justify-center text-center mt-2 md:mt-4">
        <div className="relative flex items-center justify-center">
          {/* Subtle Golden Katana Blade Accent */}
          <span className="absolute w-56 md:w-[460px] h-[1.5px] bg-gradient-to-r from-transparent via-[#B08D57]/70 to-transparent -rotate-6 transform" />
          <h2 className="font-display text-6xl sm:text-8xl md:text-9xl lg:text-[10.5rem] font-bold tracking-tight leading-none text-zinc-950 select-none drop-shadow-sm">
            CATANA
          </h2>
        </div>

        <p className="font-sans text-xs sm:text-sm md:text-base font-semibold text-zinc-600 tracking-[0.25em] uppercase mt-2">
          Atelier de Alta Costura Editorial
        </p>

        <div className="mt-3 flex items-center gap-2 font-mono text-[9px] md:text-[10px] tracking-[0.25em] text-[#B08D57] uppercase font-medium">
          <span className="w-1.5 h-1.5 bg-[#B08D57] rounded-full animate-ping" />
          <span>ORBITAL 3D RUNTIME // {ORBIT_ITEMS.length} EDIÇÕES CANÔNICAS</span>
        </div>
      </div>

      {/* 3D Orbiting Stage with Inclination / Tilt */}
      <div
        className="relative w-full h-[460px] md:h-[520px] flex items-center justify-center pointer-events-none -mt-28 md:-mt-36"
        style={{
          transformStyle: 'preserve-3d',
        }}
      >
        {ORBIT_ITEMS.map((item, i) => {
          const itemAngle = (i * angleStep + rotation) % 360;
          const rad = (itemAngle * Math.PI) / 180;
          const sin = Math.sin(rad);
          const cos = Math.cos(rad);

          // Position in 3D inclined ellipse:
          // X moves horizontally
          const x = sin * dimensions.radius;
          // Z moves in depth (-radius back, +radius front)
          const z = cos * dimensions.radius;
          // Y shifts vertically based on Z so front cards glide gracefully UNDER the title!
          const normalizedZ = (z + dimensions.radius) / (2 * dimensions.radius); // 0 (back) to 1 (front)
          const y = (normalizedZ - 0.5) * dimensions.yOffset * 1.6;

          const isForeground = z >= -60;
          const opacity = Math.max(0.3, 0.35 + normalizedZ * 0.65);
          const scale = 0.78 + normalizedZ * 0.28;
          const blur = isForeground ? 0 : Math.round((1 - normalizedZ) * 4);
          // Foreground cards get high z-index, but below title (title is z-20)
          const zIndex = Math.round(normalizedZ * 15);

          return (
            <div
              key={item.id}
              className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transition-shadow duration-300 pointer-events-auto ${
                isForeground ? 'cursor-pointer' : 'pointer-events-none'
              }`}
              style={{
                width: dimensions.radius > 300 ? '240px' : '165px',
                transform: `translate3d(${x}px, ${y}px, ${z}px) rotateY(${itemAngle}deg) scale(${scale})`,
                opacity: opacity,
                filter: blur > 0 ? `blur(${blur}px)` : 'none',
                zIndex: zIndex,
                transformStyle: 'preserve-3d',
                willChange: 'transform, opacity',
              }}
            >
              {/* Publication Card Frame with NO blue focus outline */}
              <Link
                to={item.link}
                className="group block w-full bg-[#FDFBF7] border border-zinc-300/80 shadow-xl hover:shadow-2xl transition-all duration-300 p-2.5 md:p-3 overflow-hidden outline-none focus:outline-none focus:ring-0 focus-visible:ring-1 focus-visible:ring-[#B08D57]"
              >
                {/* Image Container with Editorial Ratio */}
                <div className="relative w-full aspect-[3/4] overflow-hidden bg-zinc-900">
                  <img
                    src={item.image}
                    alt={item.brand}
                    className="w-full h-full object-cover object-center transform group-hover:scale-105 transition-transform duration-700"
                    loading="lazy"
                  />

                  {/* Top Minimal Tag */}
                  <div className="absolute top-2.5 left-2.5 font-mono text-[8px] md:text-[9px] tracking-[0.15em] uppercase px-2 py-0.5 bg-zinc-950/85 text-zinc-100 backdrop-blur-sm font-semibold">
                    {item.index} · {item.segment}
                  </div>

                  {/* Hover Arrow */}
                  <div className="absolute top-2.5 right-2.5 w-6 h-6 bg-[#F5F1EA] text-zinc-950 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </div>
                </div>

                {/* Card Metadata Below with Inter and Playfair Display */}
                <div className="mt-2.5 pt-2 border-t border-zinc-200 flex items-baseline justify-between font-mono text-[10px] text-zinc-950">
                  <div className="flex items-center gap-1.5 truncate">
                    <span
                      className="w-1.5 h-1.5 rounded-none flex-shrink-0"
                      style={{ backgroundColor: item.accent }}
                    />
                    <span className="font-display text-sm font-semibold text-zinc-950 truncate">
                      {item.brand}
                    </span>
                  </div>
                  <span className="font-sans text-[9px] text-zinc-500 font-medium flex-shrink-0">
                    {item.collection}
                  </span>
                </div>
              </Link>
            </div>
          );
        })}
      </div>

      {/* Bottom Orbital Control Strip */}
      <div className="relative z-20 w-full px-6 md:px-12 flex items-center justify-between font-mono text-[10px] tracking-[0.2em] uppercase text-zinc-500 pointer-events-none mt-2">
        <div className="flex items-center gap-2">
          <MoveHorizontal className="w-3.5 h-3.5 text-[#B08D57] animate-pulse" />
          <span className="font-semibold text-zinc-700">ARRASTE PARA GIRAR O ATELIER</span>
        </div>

        <div className="hidden sm:flex items-center gap-4 text-zinc-700 font-medium">
          <span>VELOCIDADE: {isHovered ? 'PAUSADO' : 'AUTO-SPIN 60FPS'}</span>
          <span>·</span>
          <span>PERSPECTIVA 3D: 1600PX</span>
        </div>
      </div>
    </div>
  );
}
