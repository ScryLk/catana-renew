import { FONT_REGISTRY, ALL_VERIFIED_FONTS } from '../generated/fontRegistry.generated';
export { ALL_VERIFIED_FONTS };
export type VerifiedFont = typeof FONT_REGISTRY.fonts[number]['family'];

export function isFontVerified(fontName: string): fontName is VerifiedFont {
  return ALL_VERIFIED_FONTS.some(f => f.toLowerCase() === fontName.replace(/[\'"]/g, '').trim().toLowerCase());
}
export function resolveSafeFontFamily(requestedFont?: string, fontRole?: string): string {
  const font = FONT_REGISTRY.fonts.find(f => f.family.toLowerCase() === requestedFont?.replace(/[\'"]/g, '').trim().toLowerCase());
  const fallback = FONT_REGISTRY.fallbacks[fontRole as keyof typeof FONT_REGISTRY.fallbacks] || FONT_REGISTRY.fallbacks.body;
  const family = font?.family || fallback;
  const category = font?.category || FONT_REGISTRY.fonts.find(f => f.family === fallback)?.category;
  const generic = category === 'mono' ? 'monospace' : category?.includes('serif') ? 'Georgia, serif' : 'sans-serif';
  return `"${family}", ${generic}`;
}
