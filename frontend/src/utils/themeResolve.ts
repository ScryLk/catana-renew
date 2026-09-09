// INC-06: resolve referências $tokens.* nos estilos de um elemento contra os
// design tokens globais. Mantém a mesma referência de objeto quando nada muda,
// para não quebrar memoização/re-render.
import { resolveTokenReference, type DesignTokens } from '../types/designTokens';
import type { CatalogElement } from '../types/editor';

function resolveStrings<T extends Record<string, unknown>>(
  obj: T | undefined,
  tokens: DesignTokens
): T | undefined {
  if (!obj) return obj;
  let changed = false;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string' && value.startsWith('$tokens.')) {
      out[key] = resolveTokenReference(value, tokens);
      changed = true;
    } else {
      out[key] = value;
    }
  }
  return (changed ? (out as T) : obj);
}

export function resolveElementTokens(
  element: CatalogElement,
  tokens?: DesignTokens
): CatalogElement {
  if (!tokens) return element;
  const style = resolveStrings(element.style as Record<string, unknown>, tokens);
  const textData = resolveStrings(element.textData as Record<string, unknown> | undefined, tokens);
  if (style === element.style && textData === element.textData) {
    return element;
  }
  return {
    ...element,
    style: style as CatalogElement['style'],
    textData: textData as CatalogElement['textData'],
  };
}
