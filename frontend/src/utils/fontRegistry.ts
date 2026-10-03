/**
 * Font Registry Frontend - Single Source of Truth
 * Garante que somente fontes devidamente registradas e carregadas sejam renderizadas.
 */

export const ALL_VERIFIED_FONTS = [
  'Cormorant Garamond',
  'Playfair Display',
  'Cinzel',
  'Prata',
  'Instrument Serif',
  'Inter',
  'Plus Jakarta Sans',
  'Jost',
  'Space Grotesk',
  'Outfit',
  'Syne',
  'Oswald',
  'Anton',
  'Bebas Neue',
  'JetBrains Mono',
  'Space Mono',
  'IBM Plex Mono',
] as const;

export type VerifiedFont = typeof ALL_VERIFIED_FONTS[number];

export function isFontVerified(fontName: string): fontName is VerifiedFont {
  const clean = fontName.replace(/['"]/g, '').trim().toLowerCase();
  return ALL_VERIFIED_FONTS.some((f) => f.toLowerCase() === clean);
}

export function resolveSafeFontFamily(
  requestedFont?: string,
  fontRole?: 'display' | 'body' | 'metadata' | string
): string {
  if (requestedFont && isFontVerified(requestedFont)) {
    // Retorna a fonte com fallbacks apropriados
    if (requestedFont === 'JetBrains Mono' || requestedFont === 'Space Mono' || requestedFont === 'IBM Plex Mono') {
      return `"${requestedFont}", monospace`;
    }
    if (
      requestedFont === 'Cormorant Garamond' ||
      requestedFont === 'Playfair Display' ||
      requestedFont === 'Cinzel' ||
      requestedFont === 'Prata' ||
      requestedFont === 'Instrument Serif'
    ) {
      return `"${requestedFont}", Georgia, serif`;
    }
    return `"${requestedFont}", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  }

  // Fallbacks seguros padrão por role
  if (fontRole === 'display') {
    return '"Cormorant Garamond", "Playfair Display", Georgia, serif';
  }
  if (fontRole === 'metadata') {
    return '"JetBrains Mono", monospace';
  }
  return '"Inter", "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, sans-serif';
}
