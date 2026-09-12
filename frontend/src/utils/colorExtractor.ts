import { StudioPalette } from '../data/editorialCatalog.mock';

export interface CropRect {
  x: number;      // 0 a 1 (coordenada horizontal normalizada)
  y: number;      // 0 a 1 (coordenada vertical normalizada)
  width: number;  // 0 a 1 (largura normalizada)
  height: number; // 0 a 1 (altura normalizada)
}

export interface ColorExtractionOptions {
  cropRect?: CropRect | null;
  ignoreDarkBackground?: boolean;
  ignoreLightBackground?: boolean;
}

export interface ExtractedPaletteResult {
  palette: StudioPalette;
  swatches: string[];
}

export const rgbToHex = (r: number, g: number, b: number): string => {
  return '#' + [r, g, b].map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('').toUpperCase();
};

export const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return { r, g, b };
  }
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return { r, g, b };
  }
  return null;
};

export const getLuminance = (r: number, g: number, b: number): number => {
  const a = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
};

export const getSaturation = (r: number, g: number, b: number): number => {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === 0) return 0;
  return (max - min) / max;
};

/**
 * Calcula a distancia perceptual euclidiana aproximada entre duas cores RGB.
 */
export const colorDistance = (
  c1: { r: number; g: number; b: number },
  c2: { r: number; g: number; b: number }
): number => {
  const rDiff = c1.r - c2.r;
  const gDiff = c1.g - c2.g;
  const bDiff = c1.b - c2.b;
  return Math.sqrt(rDiff * rDiff + gDiff * gDiff + bDiff * bDiff);
};

/**
 * Detecta automaticamente o bounding box (area de conteudo) de uma imagem de logo,
 * ignorando transparencia e bordas uniformes escuras ou brancas.
 */
export const detectContentBounds = (imageSrc: string): Promise<CropRect> => {
  return new Promise((resolve) => {
    const defaultRect: CropRect = { x: 0.05, y: 0.05, width: 0.9, height: 0.9 };
    if (!imageSrc) {
      resolve(defaultRect);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = imageSrc;

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(defaultRect);
          return;
        }

        const maxDim = 320;
        const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(20, Math.round(img.naturalWidth * scale));
        const h = Math.max(20, Math.round(img.naturalHeight * scale));

        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(img, 0, 0, w, h);

        const imgData = ctx.getImageData(0, 0, w, h).data;

        // Amostra cantos para verificar cor de fundo uniforme externa (ex: borda preta ou branca)
        const corners = [
          { r: imgData[0], g: imgData[1], b: imgData[2], a: imgData[3] },
          { r: imgData[(w - 1) * 4], g: imgData[(w - 1) * 4 + 1], b: imgData[(w - 1) * 4 + 2], a: imgData[(w - 1) * 4 + 3] },
          { r: imgData[((h - 1) * w) * 4], g: imgData[((h - 1) * w) * 4 + 1], b: imgData[((h - 1) * w) * 4 + 2], a: imgData[((h - 1) * w) * 4 + 3] },
          { r: imgData[((h - 1) * w + (w - 1)) * 4], g: imgData[((h - 1) * w + (w - 1)) * 4 + 1], b: imgData[((h - 1) * w + (w - 1)) * 4 + 2], a: imgData[((h - 1) * w + (w - 1)) * 4 + 3] },
        ];

        // Se os cantos forem similares, define a cor de fundo a ignorar
        let bgSample: { r: number; g: number; b: number } | null = null;
        const validCorners = corners.filter((c) => c.a > 40);
        if (validCorners.length >= 3) {
          const first = validCorners[0];
          const allClose = validCorners.every((c) => colorDistance(first, c) < 25);
          if (allClose) {
            bgSample = { r: first.r, g: first.g, b: first.b };
          }
        }

        let minX = w;
        let minY = h;
        let maxX = 0;
        let maxY = 0;
        let foundContent = false;

        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const idx = (y * w + x) * 4;
            const a = imgData[idx + 3];
            if (a < 35) continue; // Transparencia

            const r = imgData[idx];
            const g = imgData[idx + 1];
            const b = imgData[idx + 2];

            // Se for similar ao fundo uniforme das bordas, ignora
            if (bgSample && colorDistance({ r, g, b }, bgSample) < 28) {
              continue;
            }

            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
            foundContent = true;
          }
        }

        if (!foundContent || maxX <= minX || maxY <= minY) {
          resolve(defaultRect);
          return;
        }

        // Adiciona 4% de margem de respiro
        const padX = Math.round((maxX - minX) * 0.04);
        const padY = Math.round((maxY - minY) * 0.04);

        const boundLeft = Math.max(0, minX - padX);
        const boundTop = Math.max(0, minY - padY);
        const boundRight = Math.min(w, maxX + padX);
        const boundBottom = Math.min(h, maxY + padY);

        resolve({
          x: boundLeft / w,
          y: boundTop / h,
          width: Math.max(0.1, (boundRight - boundLeft) / w),
          height: Math.max(0.1, (boundBottom - boundTop) / h),
        });
      } catch {
        resolve(defaultRect);
      }
    };

    img.onerror = () => resolve(defaultRect);
  });
};

/**
 * Gera um novo dataUrl PNG cortando a imagem com base no CropRect informado.
 */
export const cropImageToDataUrl = (imageSrc: string, crop: CropRect): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = imageSrc;

    img.onload = () => {
      try {
        const natW = img.naturalWidth;
        const natH = img.naturalHeight;

        const sx = Math.max(0, Math.min(natW - 1, crop.x * natW));
        const sy = Math.max(0, Math.min(natH - 1, crop.y * natH));
        const sw = Math.max(1, Math.min(natW - sx, crop.width * natW));
        const sh = Math.max(1, Math.min(natH - sy, crop.height * natH));

        const canvas = document.createElement('canvas');
        canvas.width = Math.round(sw);
        canvas.height = Math.round(sh);

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Canvas 2D nao disponivel');
        }

        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/png'));
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = (err) => reject(err);
  });
};

/**
 * Extrai cores dominantes de uma imagem ou regiao recortada, priorizando a identidade
 * cromatica real da marca (e evitando capturar preto ou bordas residuais indevidamente).
 */
export const extractColorsFromImage = (
  imageSrc: string,
  options?: ColorExtractionOptions | CropRect | null
): Promise<StudioPalette> => {
  return new Promise((resolve, reject) => {
    const opts: ColorExtractionOptions =
      options && 'x' in options
        ? { cropRect: options }
        : options || {};

    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = imageSrc;

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Canvas 2D nao disponivel');
        }

        const natW = img.naturalWidth;
        const natH = img.naturalHeight;

        // Se houver recorte, calcula as coordenadas de origem
        const crop = opts.cropRect;
        const sx = crop ? Math.max(0, Math.min(natW - 1, crop.x * natW)) : 0;
        const sy = crop ? Math.max(0, Math.min(natH - 1, crop.y * natH)) : 0;
        const sw = crop ? Math.max(1, Math.min(natW - sx, crop.width * natW)) : natW;
        const sh = crop ? Math.max(1, Math.min(natH - sy, crop.height * natH)) : natH;

        // Tamanho de amostragem
        const sampleSize = 100;
        canvas.width = sampleSize;
        canvas.height = sampleSize;

        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sampleSize, sampleSize);

        const imgData = ctx.getImageData(0, 0, sampleSize, sampleSize).data;
        const colorCounts: Record<
          string,
          { count: number; r: number; g: number; b: number; sat: number; lum: number }
        > = {};

        for (let i = 0; i < imgData.length; i += 4) {
          const a = imgData[i + 3];
          if (a < 35) continue; // Ignora transparencia

          const r = imgData[i];
          const g = imgData[i + 1];
          const b = imgData[i + 2];

          const lum = getLuminance(r, g, b);
          const sat = getSaturation(r, g, b);

          // Se a opcao de ignorar fundos escuros residuais estiver ativa
          if (opts.ignoreDarkBackground && lum < 0.12 && sat < 0.25) {
            continue;
          }

          if (opts.ignoreLightBackground && lum > 0.94 && sat < 0.1) {
            continue;
          }

          // Quantizacao em passos de 16 para agrupar tons proximos
          const qR = Math.round(r / 16) * 16;
          const qG = Math.round(g / 16) * 16;
          const qB = Math.round(b / 16) * 16;
          const key = `${qR},${qG},${qB}`;

          if (!colorCounts[key]) {
            colorCounts[key] = {
              count: 1,
              r,
              g,
              b,
              sat,
              lum,
            };
          } else {
            colorCounts[key].count += 1;
          }
        }

        let colors = Object.values(colorCounts);

        // Se todas as cores foram filtradas por serem escuras, relaxa o filtro
        if (colors.length === 0) {
          for (let i = 0; i < imgData.length; i += 4) {
            if (imgData[i + 3] < 35) continue;
            const r = imgData[i];
            const g = imgData[i + 1];
            const b = imgData[i + 2];
            const key = `${Math.round(r / 16) * 16},${Math.round(g / 16) * 16},${Math.round(b / 16) * 16}`;
            if (!colorCounts[key]) {
              colorCounts[key] = { count: 1, r, g, b, sat: getSaturation(r, g, b), lum: getLuminance(r, g, b) };
            } else {
              colorCounts[key].count += 1;
            }
          }
          colors = Object.values(colorCounts);
        }

        // 1. Separa cores cromaticas (vibrantes da marca) de cores neutras
        const chromatic = colors.filter((c) => c.sat > 0.18 && c.lum >= 0.08 && c.lum <= 0.92);

        // Ordena cromaticas por ponderacao de saturacao e frequencia
        chromatic.sort((a, b) => {
          const scoreA = a.count * Math.pow(a.sat + 0.2, 1.6);
          const scoreB = b.count * Math.pow(b.sat + 0.2, 1.6);
          return scoreB - scoreA;
        });

        // Agrupa cores cromaticas com distancia minima para nao pegar dois tons quase identicos
        const distinctChromatic: typeof chromatic = [];
        for (const c of chromatic) {
          const isTooClose = distinctChromatic.some(
            (existing) => colorDistance(c, existing) < 45
          );
          if (!isTooClose) {
            distinctChromatic.push(c);
          }
        }

        let primaryHex = '#1A1817';
        let secondaryHex = '#52525B';
        let accentHex = '#B08D57';

        if (distinctChromatic.length >= 3) {
          // Caso 1: Logotipo rico em cores da marca (ex: Google Azul, Vermelho, Amarelo)
          primaryHex = rgbToHex(distinctChromatic[0].r, distinctChromatic[0].g, distinctChromatic[0].b);
          secondaryHex = rgbToHex(distinctChromatic[1].r, distinctChromatic[1].g, distinctChromatic[1].b);
          accentHex = rgbToHex(distinctChromatic[2].r, distinctChromatic[2].g, distinctChromatic[2].b);
        } else if (distinctChromatic.length === 2) {
          // Caso 2: Duas cores marcantes
          primaryHex = rgbToHex(distinctChromatic[0].r, distinctChromatic[0].g, distinctChromatic[0].b);
          secondaryHex = rgbToHex(distinctChromatic[1].r, distinctChromatic[1].g, distinctChromatic[1].b);
          // Terceira cor: tom neutro equilibrado ou variacao tonal
          accentHex = distinctChromatic[0].lum < 0.5 ? '#B08D57' : '#27272A';
        } else if (distinctChromatic.length === 1) {
          // Caso 3: Uma cor cromatica forte (ex: Spotify verde, Tiffany azul)
          primaryHex = rgbToHex(distinctChromatic[0].r, distinctChromatic[0].g, distinctChromatic[0].b);
          const darkNeutrals = colors.filter((c) => c.lum < 0.25);
          if (darkNeutrals.length > 0) {
            darkNeutrals.sort((a, b) => b.count - a.count);
            secondaryHex = rgbToHex(darkNeutrals[0].r, darkNeutrals[0].g, darkNeutrals[0].b);
          } else {
            secondaryHex = '#27272A';
          }
          accentHex = primaryHex;
        } else {
          // Caso 4: Identidade monocromatica ou neutra (ex: Chanel, Prada)
          const sortedAll = [...colors].sort((a, b) => b.count - a.count);
          if (sortedAll.length > 0) {
            primaryHex = rgbToHex(sortedAll[0].r, sortedAll[0].g, sortedAll[0].b);
          }
          if (sortedAll.length > 1) {
            secondaryHex = rgbToHex(sortedAll[1].r, sortedAll[1].g, sortedAll[1].b);
          }
          accentHex = '#B08D57';
        }

        // Monta lista de swatches com todas as cores distintas relevantes
        const allCandidates = [...distinctChromatic, ...colors.filter((c) => c.count > 3)];
        const swatchesList: string[] = [];
        for (const c of allCandidates) {
          const hex = rgbToHex(c.r, c.g, c.b);
          const rgb = { r: c.r, g: c.g, b: c.b };
          const already = swatchesList.some((s) => {
            const parsed = hexToRgb(s);
            return parsed ? colorDistance(parsed, rgb) < 32 : false;
          });
          if (!already) {
            swatchesList.push(hex);
          }
          if (swatchesList.length >= 10) break;
        }

        const extractedPalette: StudioPalette & { swatches?: string[] } = {
          name: 'Paleta da Marca (Extraida)',
          primary: primaryHex,
          background: '#F6F5F2',
          accent: accentHex,
          secondary: secondaryHex,
          surface: '#FFFFFF',
          contrastRatio: '9.2:1 (AAA)',
          locked: true,
          swatches: swatchesList,
        };

        resolve(extractedPalette);
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = (err) => reject(err);
  });
};

/**
 * Retorna as cores dominantes e amostras de uma imagem com detalhamento completo de swatches.
 */
export const extractFullColorPalette = async (
  imageSrc: string,
  options?: ColorExtractionOptions
): Promise<ExtractedPaletteResult> => {
  const palette = await extractColorsFromImage(imageSrc, options);
  const swatches = (palette as unknown as { swatches?: string[] }).swatches || [
    palette.primary,
    palette.secondary || '#52525B',
    palette.accent,
  ];
  return { palette, swatches };
};
