/**
 * ArtisanStations.ts
 * Station definitions, craft metadata, and dynamic canvas texture renderers
 * for the 3D World Navigation Experience.
 */

export interface ArtisanStation {
  id: string;
  index: string;
  name: string;
  role: string;
  frenchTitle: string;
  subtitle: string;
  description: string;
  zCoord: number;
  badge: string;
  accentColor: string;
  tokens: { label: string; value: string }[];
  logs: string[];
}

export const ARTISAN_STATIONS: ArtisanStation[] = [
  {
    id: 'station-eleonore',
    index: '01',
    name: 'Éléonore',
    frenchTitle: 'DIRECTRICE ARTISTIQUE',
    role: 'Diretora de Arte Editorial',
    subtitle: 'Arquitetura Suíça & Proporção Áurea',
    description: 'Calcula matematicamente o ritmo editorial, estabelecendo o grid de 12 colunas, margens de respiro e pontos focais de alta costura.',
    zCoord: -500,
    badge: '12-COL SWISS GRID',
    accentColor: '#B08D57',
    tokens: [
      { label: 'Grid Ratio', value: '1:1.414 (DIN A4)' },
      { label: 'Gutter Width', value: '6.00 mm' },
      { label: 'Top Margin', value: '48.00 mm' },
      { label: 'Golden Spiral', value: 'Φ = 1.618033' },
    ],
    logs: [
      'Iniciando calibração de grid para Maison Verdana...',
      'Margens de respiro harmônico fixadas: 48mm / 32mm / 36mm',
      'Ponto focal áureo ancorado na imagem principal.',
      'Alinhamento de 12 colunas com 0 falhas de coerência.',
    ],
  },
  {
    id: 'station-henri',
    index: '02',
    name: 'Henri',
    frenchTitle: 'MAÎTRE TYPOGRAPHE',
    role: 'Tipógrafo Editorial & Glifos',
    subtitle: 'Escultura de Glifos & Hierarquia Serifada',
    description: 'Esculpe as fontes com refinamento editorial, ajustando kerning óptico, ligaturas finas e escalas de leitura para máxima sofisticação.',
    zCoord: -1100,
    badge: 'EDITORIAL TYPOGRAPHY',
    accentColor: '#D4AF37',
    tokens: [
      { label: 'Primary Serif', value: 'Playfair Display 72pt' },
      { label: 'Kerning', value: 'Optical Metrics (-0.02em)' },
      { label: 'Leading', value: '1.05 Tight Luxe' },
      { label: 'Drop Cap', value: '3-Line Classical' },
    ],
    logs: [
      'Analisando curva de peso da família Playfair Display...',
      'Ligaduras finas (fi, fl, st) ativadas com acabamento antiqua.',
      'Ajuste óptico no par "Vo" e "Ta": -18 unidades em kerning.',
      'Contraste de traço fino/grosso aferido: 9.8:1 de pureza.',
    ],
  },
  {
    id: 'station-kenji',
    index: '03',
    name: 'Kenji',
    frenchTitle: 'CURATEUR COMMERCIAL',
    role: 'Curador Comercial & Merchandising',
    subtitle: 'Espacialização de SKUs & Lookbook',
    description: 'Posiciona produtos com inteligência espacial de boutique de luxo, conectando descrições, preços e referências sem poluir o visual.',
    zCoord: -1700,
    badge: 'SPATIAL MERCHANDISE',
    accentColor: '#d4d4d8',
    tokens: [
      { label: 'SKU Positioning', value: 'Harmonic 3-Cluster' },
      { label: 'Price Tagging', value: '€ 1.450 / CHF 890' },
      { label: 'Conversion Flow', value: 'Diagonal Z-Scan' },
      { label: 'Lookbook Pairing', value: 'Coat + Silk Scarf' },
    ],
    logs: [
      'Importando SKUs do catálogo: VRD-CST-01 e VRD-BLZ-02...',
      'Calculando vetor de atenção do leitor (Focal Point -> Price Tag).',
      'Tagging flutuante ancorado com linha guia de 0.5pt em cinza zinco.',
      'Equilíbrio entre respiro editorial e conversão comercial validado.',
    ],
  },
  {
    id: 'station-vesper',
    index: '04',
    name: 'Vesper',
    frenchTitle: 'GARDE DU CORPS PRINT',
    role: 'Guardrail de Impressão & Conformidade',
    subtitle: 'Auditoria Vetorial 300 DPI & Sangrias',
    description: 'Varre cada milímetro do catálogo contra falhas gráficas: confere sangria de 3mm, perfil de cor FOGRA51 e carimba o selo de certificação.',
    zCoord: -2300,
    badge: '300 DPI LASER AUDIT',
    accentColor: '#E2C98F',
    tokens: [
      { label: 'Resolution', value: '300 DPI Lossless' },
      { label: 'Bleed Safety', value: '+3.00 mm (Pass)' },
      { label: 'Color Gamut', value: 'ISO 12647-2 FOGRA51' },
      { label: 'WCAG Contrast', value: '14.8:1 AAA Compliant' },
    ],
    logs: [
      'Varredura a laser iniciada sobre o spread editorial...',
      'Sangrias perimetrais de 3mm checadas e validadas.',
      'Contraste cromático aprovado: 14.8:1 em conformidade estrita.',
      'Selo holográfico CATANA CERTIFIED FOR PRINT impresso.',
    ],
  },
  {
    id: 'station-monument',
    index: '05',
    name: 'Atelier Catana',
    frenchTitle: 'LE CHEF-D’ŒUVRE',
    role: 'O Monumento & Catana Studio',
    subtitle: 'A Publicação Viva em Toda a Glória',
    description: 'A convergência dos artesãos se materializa no catálogo final pronto para gráfica de luxo e distribuição global. Entre no estúdio.',
    zCoord: -2900,
    badge: 'MASTER PUBLICATION',
    accentColor: '#F5F1EA',
    tokens: [
      { label: 'Total Spreads', value: '6 Páginas Editoriais' },
      { label: 'Agents Latency', value: '0.4s Instant Sync' },
      { label: 'Export Quality', value: 'Vector PDF/X-1a' },
      { label: 'Status', value: '100% Pronto para Produção' },
    ],
    logs: [
      'Convergência dos 4 artesãos concluída com êxito.',
      'Artefato editorial unificado e gerado em resolução monumental.',
      'Pronto para criação autônoma e edição no Catana Studio.',
    ],
  },
];

/**
 * Helper to render dynamic, high-resolution 2D Canvas textures for Three.js
 */
export function drawStationCanvas(
  ctx: CanvasRenderingContext2D,
  station: ArtisanStation,
  time: number,
  isHovered: boolean
) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;

  // Background - Dark luxury paper with subtle noise texture
  ctx.fillStyle = '#0C0C0E';
  ctx.fillRect(0, 0, w, h);

  // Subtle inner border / frame
  ctx.strokeStyle = isHovered ? 'rgba(212, 175, 55, 0.6)' : 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 2;
  ctx.strokeRect(20, 20, w - 40, h - 40);

  // Corner markers (Swiss precision)
  const cornerSize = 16;
  ctx.strokeStyle = isHovered ? '#D4AF37' : 'rgba(212, 175, 55, 0.4)';
  ctx.lineWidth = 1.5;

  // Top-left
  ctx.beginPath();
  ctx.moveTo(20, 20 + cornerSize);
  ctx.lineTo(20, 20);
  ctx.lineTo(20 + cornerSize, 20);
  ctx.stroke();

  // Top-right
  ctx.beginPath();
  ctx.moveTo(w - 20 - cornerSize, 20);
  ctx.lineTo(w - 20, 20);
  ctx.lineTo(w - 20, 20 + cornerSize);
  ctx.stroke();

  // Bottom-left
  ctx.beginPath();
  ctx.moveTo(20, h - 20 - cornerSize);
  ctx.lineTo(20, h - 20);
  ctx.lineTo(20 + cornerSize, h - 20);
  ctx.stroke();

  // Bottom-right
  ctx.beginPath();
  ctx.moveTo(w - 20 - cornerSize, h - 20);
  ctx.lineTo(w - 20, h - 20);
  ctx.lineTo(w - 20, h - 20 - cornerSize);
  ctx.stroke();

  // Header: Index & French title
  ctx.font = '600 13px "JetBrains Mono", monospace';
  ctx.fillStyle = '#B08D57';
  ctx.fillText(`STATION // ${station.index}`, 44, 56);

  ctx.font = '400 11px "JetBrains Mono", monospace';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.fillText(station.frenchTitle, 180, 56);

  // Badge on the top right
  const badgeText = `[ ${station.badge} ]`;
  ctx.font = '600 11px "JetBrains Mono", monospace';
  ctx.fillStyle = isHovered ? '#D4AF37' : 'rgba(212, 175, 55, 0.7)';
  const badgeWidth = ctx.measureText(badgeText).width;
  ctx.fillText(badgeText, w - 44 - badgeWidth, 56);

  // Thin separator line
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(44, 72);
  ctx.lineTo(w - 44, 72);
  ctx.stroke();

  // Main Artisan Name & Subtitle
  ctx.font = 'italic 700 38px "Playfair Display", serif';
  ctx.fillStyle = '#F5F1EA';
  ctx.fillText(station.name, 44, 120);

  ctx.font = '400 13px "Inter", sans-serif';
  ctx.fillStyle = 'rgba(245, 241, 234, 0.6)';
  ctx.fillText(station.subtitle, 44, 144);

  // Station-specific interactive craft visual in the middle
  ctx.save();
  ctx.translate(44, 168);
  const visualW = w - 88;
  const visualH = 260;

  // Background for craft visual
  ctx.fillStyle = 'rgba(20, 20, 24, 0.8)';
  ctx.fillRect(0, 0, visualW, visualH);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.strokeRect(0, 0, visualW, visualH);

  if (station.id === 'station-eleonore') {
    // 12-Column Swiss Grid with Golden Spiral
    drawSwissGridVisual(ctx, visualW, visualH, time);
  } else if (station.id === 'station-henri') {
    // Typography Carving & Ligature Kerning
    drawTypographyVisual(ctx, visualW, visualH, time);
  } else if (station.id === 'station-kenji') {
    // Spatial Merchandising & SKU Connecting Threads
    drawMerchandiseVisual(ctx, visualW, visualH, time);
  } else if (station.id === 'station-vesper') {
    // Laser Audit Sweep & 300 DPI Stamp
    drawLaserAuditVisual(ctx, visualW, visualH, time);
  } else {
    // Master Monument Spread
    drawMonumentVisual(ctx, visualW, visualH, time);
  }
  ctx.restore();

  // Tokens Grid (Bottom 2x2)
  const tokenStartY = 450;
  const colWidth = (w - 88) / 2;

  station.tokens.forEach((token, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const tx = 44 + col * colWidth;
    const ty = tokenStartY + row * 40;

    ctx.font = '400 11px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fillText(token.label.toUpperCase(), tx, ty);

    ctx.font = '600 12px "JetBrains Mono", monospace';
    ctx.fillStyle = '#F5F1EA';
    ctx.fillText(token.value, tx, ty + 16);
  });

  // Footer: Status and interactive prompt
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.beginPath();
  ctx.moveTo(44, h - 50);
  ctx.lineTo(w - 44, h - 50);
  ctx.stroke();

  // Pulsing Live Craft Dot
  const pulse = Math.sin(time * 3) * 0.4 + 0.6;
  ctx.fillStyle = `rgba(212, 175, 55, ${pulse})`;
  ctx.beginPath();
  ctx.arc(48, h - 32, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = '600 11px "JetBrains Mono", monospace';
  ctx.fillStyle = '#B08D57';
  ctx.fillText('ARTISAN EN ACTIVITÉ', 60, h - 28);

  ctx.font = '400 11px "JetBrains Mono", monospace';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  const clickHint = isHovered ? '[ CLIQUE PARA INSPECIONAR PROMPTS ]' : '[ ATELIER AUTÔNOMO ]';
  const hintW = ctx.measureText(clickHint).width;
  ctx.fillText(clickHint, w - 44 - hintW, h - 28);
}

// 1. ÉLÉONORE: 12-Column Swiss Grid Visual
function drawSwissGridVisual(ctx: CanvasRenderingContext2D, w: number, h: number, time: number) {
  const cols = 12;
  const colW = (w - 20) / cols;

  // Draw vertical grid columns
  for (let i = 0; i < cols; i++) {
    const x = 10 + i * colW;
    const wave = Math.sin(time * 2 + i * 0.4) * 0.5 + 0.5;
    ctx.fillStyle = `rgba(176, 141, 87, ${0.05 + wave * 0.08})`;
    ctx.fillRect(x + 2, 10, colW - 4, h - 20);

    ctx.strokeStyle = 'rgba(176, 141, 87, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, 10);
    ctx.lineTo(x, h - 10);
    ctx.stroke();
  }

  // Draw Golden Spiral approximation
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.7)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  let cx = w * 0.45;
  let cy = h * 0.5;
  let radius = 8;
  for (let a = 0; a < Math.PI * 4; a += 0.1) {
    const r = radius * Math.exp(0.18 * a);
    const px = cx + r * Math.cos(a + time * 0.5);
    const py = cy + r * Math.sin(a + time * 0.5);
    if (a === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();

  // Dynamic Calipers overlay
  ctx.font = '500 10px "JetBrains Mono", monospace';
  ctx.fillStyle = '#D4AF37';
  ctx.fillText('TOP: 48.00mm', 20, 26);
  ctx.fillText('GUTTER: 6.00mm', w - 120, 26);
  ctx.fillText('Φ = 1.618 (GOLDEN RATIO)', 20, h - 16);
}

// 2. HENRI: Typography Carving Visual
function drawTypographyVisual(ctx: CanvasRenderingContext2D, w: number, h: number, time: number) {
  // Center huge serif ligature
  ctx.font = 'italic 700 84px "Playfair Display", serif';
  ctx.fillStyle = '#F5F1EA';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('L’Allure & Fi', w / 2, h / 2 - 10);

  // Reset alignment
  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';

  // Kerning calipers & lines
  const lineY = h / 2 + 35;
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(40, lineY);
  ctx.lineTo(w - 40, lineY);
  ctx.stroke();

  // Kerning delta indicators
  const offset = Math.sin(time * 3) * 4;
  ctx.font = '600 10px "JetBrains Mono", monospace';
  ctx.fillStyle = '#D4AF37';
  ctx.fillText(`Δ KERN: -12.4 (${offset > 0 ? '+' : ''}${offset.toFixed(1)})`, 40, lineY + 18);
  ctx.fillText('OPTICAL SCALE: 1.05', w - 160, lineY + 18);
}

// 3. KENJI: Spatial Merchandising Visual
function drawMerchandiseVisual(ctx: CanvasRenderingContext2D, w: number, h: number, time: number) {
  // 3 Floating product cards with connecting threads
  const products = [
    { title: 'STRUCTURAL NOIR', price: '€ 1.450', x: w * 0.22, y: h * 0.45 },
    { title: 'BLAZER ARDOISE', price: 'CHF 890', x: w * 0.72, y: h * 0.38 },
  ];

  products.forEach((p, idx) => {
    const floatY = p.y + Math.sin(time * 2 + idx * 2) * 6;

    // Card frame
    ctx.fillStyle = 'rgba(30, 30, 36, 0.9)';
    ctx.fillRect(p.x - 70, floatY - 40, 140, 80);
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.4)';
    ctx.strokeRect(p.x - 70, floatY - 40, 140, 80);

    // Product Title & Price
    ctx.font = '600 11px "JetBrains Mono", monospace';
    ctx.fillStyle = '#F5F1EA';
    ctx.fillText(p.title, p.x - 60, floatY - 14);

    ctx.font = '700 13px "Playfair Display", serif';
    ctx.fillStyle = '#D4AF37';
    ctx.fillText(p.price, p.x - 60, floatY + 12);

    ctx.font = '400 9px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fillText('VRD-SKU-0' + (idx + 1), p.x - 60, floatY + 28);
  });

  // Connecting thread in gold
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.3)';
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(products[0].x + 70, products[0].y);
  ctx.lineTo(products[1].x - 70, products[1].y);
  ctx.stroke();
  ctx.setLineDash([]);
}

// 4. VESPER: 300 DPI Laser Audit Visual
function drawLaserAuditVisual(ctx: CanvasRenderingContext2D, w: number, h: number, time: number) {
  // Animated laser scanline sweeping vertically
  const scanY = ((Math.sin(time * 2) * 0.5 + 0.5) * (h - 40)) + 20;

  // Laser beam
  const grad = ctx.createLinearGradient(0, scanY - 10, 0, scanY + 10);
  grad.addColorStop(0, 'rgba(212, 175, 55, 0)');
  grad.addColorStop(0.5, 'rgba(212, 175, 55, 0.8)');
  grad.addColorStop(1, 'rgba(212, 175, 55, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(10, scanY - 8, w - 20, 16);

  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(10, scanY);
  ctx.lineTo(w - 10, scanY);
  ctx.stroke();

  // Holographic Stamp
  const stampX = w * 0.5;
  const stampY = h * 0.5;
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.8)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(stampX, stampY, 44, 0, Math.PI * 2);
  ctx.stroke();

  ctx.font = '700 9px "JetBrains Mono", monospace';
  ctx.fillStyle = '#D4AF37';
  ctx.textAlign = 'center';
  ctx.fillText('CATANA AUDIT', stampX, stampY - 10);
  ctx.font = '600 8px "JetBrains Mono", monospace';
  ctx.fillText('300 DPI PASS', stampX, stampY + 4);
  ctx.fillText('FOGRA 51 OK', stampX, stampY + 16);
  ctx.textAlign = 'start';
}

// 5. MONUMENT: Master Publication Visual
function drawMonumentVisual(ctx: CanvasRenderingContext2D, w: number, h: number, time: number) {
  // Two open pages of luxury catalog
  const spreadW = (w - 60) / 2;
  const spreadH = h - 40;
  const shimmer = Math.sin(time * 2) * 0.2 + 0.8;

  // Left page
  ctx.fillStyle = '#141418';
  ctx.fillRect(20, 20, spreadW, spreadH);
  ctx.strokeStyle = `rgba(212, 175, 55, ${0.4 * shimmer})`;
  ctx.strokeRect(20, 20, spreadW, spreadH);

  ctx.font = 'italic 700 24px "Playfair Display", serif';
  ctx.fillStyle = '#F5F1EA';
  ctx.fillText('Maison Verdana', 36, 60);

  ctx.font = '400 10px "Inter", sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.fillText('Hiver 2026 // Haute Couture Éditoriale', 36, 80);

  // Right page
  ctx.fillStyle = '#18181E';
  ctx.fillRect(20 + spreadW + 20, 20, spreadW, spreadH);
  ctx.strokeStyle = `rgba(212, 175, 55, ${0.4 * shimmer})`;
  ctx.strokeRect(20 + spreadW + 20, 20, spreadW, spreadH);

  // Golden ratio line and preview art
  ctx.fillStyle = 'rgba(176, 141, 87, 0.15)';
  ctx.fillRect(36 + spreadW + 20, 40, spreadW - 32, spreadH - 80);

  ctx.font = '600 11px "JetBrains Mono", monospace';
  ctx.fillStyle = '#D4AF37';
  ctx.textAlign = 'center';
  ctx.fillText('OBRA PRONTA PARA PRODUÇÃO', 20 + spreadW + 20 + spreadW / 2, spreadH / 2 + 25);
  ctx.textAlign = 'start';
}
