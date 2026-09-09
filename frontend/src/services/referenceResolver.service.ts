/**
 * 🔗 Reference Resolver Service
 *
 * Resolve referências semânticas em JSONs gerados por IA
 * Exemplo: "$tokens.colors.primary" → "#4472C4"
 *          "$product.123.cover" → URL da imagem
 *          "$brand.logo" → URL do logo
 *
 * Isso permite que IA gere JSONs mais limpos e manuteníveis,
 * sem duplicar dados e com sincronização automática.
 */

import { logger } from '../utils/logger';
import { DesignTokens, resolveTokenReference } from '../types/designTokens';
import type { CatalogExportSchema } from '../types/catalogIO';
import { productService, type ProductReference as APIProductReference } from './productService';

// ============================================
// Reference Context
// ============================================

export interface ReferenceContext {
  // Design tokens do catálogo
  designTokens?: DesignTokens;

  // Produtos disponíveis (carregados do backend)
  products?: Map<number, ProductReference>;

  // Mídia disponível
  media?: Map<number, MediaReference>;

  // Configurações da marca/organização
  brand?: BrandReference;

  // Catálogo atual
  catalog?: CatalogReference;
}

export interface ProductReference {
  id: number;
  name: string;
  sku: string;
  cover: string; // URL da imagem principal (cover_url from API)
  price: string;
  currency: string;
  description: string;
  specs: Array<{ key: string; value: string }>;
  category?: string; // category_name from API
  badge?: string | null;
  stock: number;
  gallery: string[]; // gallery_urls from API
}

export interface MediaReference {
  id: number;
  name: string;
  url: string;
  type: 'image' | 'video' | 'document' | 'other';
}

export interface BrandReference {
  primaryColor: string;
  secondaryColor: string;
  logo: string;
  name: string;
}

export interface CatalogReference {
  id?: number;
  name: string;
  description?: string;
  title: string;
}

// ============================================
// Reference Types
// ============================================

type ReferenceString =
  | `$tokens.${string}`      // Design tokens
  | `$product.${number}.${string}` // Produto por ID
  | `$media.${number}.url`   // Mídia por ID
  | `$brand.${string}`       // Propriedades da marca
  | `$catalog.${string}`     // Propriedades do catálogo
  | string;                  // Valor literal (fallback)

// ============================================
// Main Resolver Function
// ============================================

/**
 * Resolve uma referência semântica para seu valor real
 *
 * @param reference - String de referência (ex: "$tokens.colors.primary")
 * @param context - Contexto com dados disponíveis
 * @returns Valor resolvido ou string original se não for referência
 *
 * @example
 * resolveReference("$tokens.colors.primary", { designTokens })
 * // Retorna: "#4472C4"
 *
 * resolveReference("$product.123.cover", { products })
 * // Retorna: "https://example.com/media/product-123.png"
 *
 * resolveReference("#FF0000", context)
 * // Retorna: "#FF0000" (valor literal, sem resolução)
 */
export function resolveReference(
  reference: ReferenceString,
  context: ReferenceContext
): any {
  // Se não é uma referência (não começa com $), retornar valor literal
  if (!reference || typeof reference !== 'string' || !reference.startsWith('$')) {
    return reference;
  }

  try {
    // 1. Design Tokens
    if (reference.startsWith('$tokens.')) {
      if (!context.designTokens) {
        console.warn(`[ReferenceResolver] Design tokens não disponíveis para: ${reference}`);
        return reference;
      }
      return resolveTokenReference(reference, context.designTokens);
    }

    // 2. Produtos
    if (reference.startsWith('$product.')) {
      return resolveProductReference(reference, context);
    }

    // 3. Mídia
    if (reference.startsWith('$media.')) {
      return resolveMediaReference(reference, context);
    }

    // 4. Brand
    if (reference.startsWith('$brand.')) {
      return resolveBrandReference(reference, context);
    }

    // 5. Catalog
    if (reference.startsWith('$catalog.')) {
      return resolveCatalogReference(reference, context);
    }

    // Referência desconhecida
    console.warn(`[ReferenceResolver] Tipo de referência desconhecido: ${reference}`);
    return reference;

  } catch (error) {
    console.error(`[ReferenceResolver] Erro ao resolver ${reference}:`, error);
    return reference; // Fallback para valor original
  }
}

// ============================================
// Specific Resolvers
// ============================================

function resolveProductReference(reference: string, context: ReferenceContext): any {
  // Formato: $product.{id}.{property}
  // Exemplo: $product.123.cover
  const match = reference.match(/^\$product\.(\d+)\.(.+)$/);
  if (!match) {
    console.warn(`[ReferenceResolver] Formato inválido de produto: ${reference}`);
    return reference;
  }

  const productId = parseInt(match[1], 10);
  const property = match[2];

  if (!context.products || !context.products.has(productId)) {
    console.warn(`[ReferenceResolver] Produto ${productId} não encontrado`);
    return reference;
  }

  const product = context.products.get(productId)!;

  // Acessar propriedade do produto
  if (property in product) {
    return (product as any)[property];
  }

  console.warn(`[ReferenceResolver] Propriedade '${property}' não existe no produto ${productId}`);
  return reference;
}

function resolveMediaReference(reference: string, context: ReferenceContext): string {
  // Formato: $media.{id}.url
  const match = reference.match(/^\$media\.(\d+)\.url$/);
  if (!match) {
    console.warn(`[ReferenceResolver] Formato inválido de mídia: ${reference}`);
    return reference;
  }

  const mediaId = parseInt(match[1], 10);

  if (!context.media || !context.media.has(mediaId)) {
    console.warn(`[ReferenceResolver] Mídia ${mediaId} não encontrada`);
    return reference;
  }

  return context.media.get(mediaId)!.url;
}

function resolveBrandReference(reference: string, context: ReferenceContext): any {
  // Formato: $brand.{property}
  // Exemplo: $brand.logo, $brand.primaryColor
  const match = reference.match(/^\$brand\.(.+)$/);
  if (!match) {
    return reference;
  }

  const property = match[1];

  if (!context.brand) {
    console.warn(`[ReferenceResolver] Configurações de marca não disponíveis`);
    return reference;
  }

  if (property in context.brand) {
    return (context.brand as any)[property];
  }

  console.warn(`[ReferenceResolver] Propriedade '${property}' não existe na marca`);
  return reference;
}

function resolveCatalogReference(reference: string, context: ReferenceContext): any {
  // Formato: $catalog.{property}
  const match = reference.match(/^\$catalog\.(.+)$/);
  if (!match) {
    return reference;
  }

  const property = match[1];

  if (!context.catalog) {
    console.warn(`[ReferenceResolver] Dados do catálogo não disponíveis`);
    return reference;
  }

  if (property in context.catalog) {
    return (context.catalog as any)[property];
  }

  console.warn(`[ReferenceResolver] Propriedade '${property}' não existe no catálogo`);
  return reference;
}

// ============================================
// Deep Object Resolution
// ============================================

/**
 * Resolve TODAS as referências em um objeto recursivamente
 *
 * @param obj - Objeto a ser processado (pode ser CatalogExportSchema)
 * @param context - Contexto de resolução
 * @returns Objeto com todas as referências resolvidas
 */
export function resolveAllReferences<T = any>(obj: T, context: ReferenceContext): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Se é string, tentar resolver como referência
  if (typeof obj === 'string') {
    return resolveReference(obj as any, context) as any;
  }

  // Se é array, processar cada item
  if (Array.isArray(obj)) {
    return obj.map(item => resolveAllReferences(item, context)) as any;
  }

  // Se é objeto, processar cada propriedade
  if (typeof obj === 'object') {
    const resolved: any = {};
    for (const [key, value] of Object.entries(obj)) {
      resolved[key] = resolveAllReferences(value, context);
    }
    return resolved;
  }

  // Outros tipos (number, boolean, etc) retornar como está
  return obj;
}

// ============================================
// Catalog-Specific Resolver
// ============================================

/**
 * Resolve todas as referências em um CatalogExportSchema
 */
export function resolveCatalogReferences(
  catalog: CatalogExportSchema,
  context: ReferenceContext
): CatalogExportSchema {
  // Adicionar designTokens do próprio catálogo ao contexto
  const enrichedContext: ReferenceContext = {
    ...context,
    designTokens: catalog.designTokens || context.designTokens,
    catalog: {
      name: catalog.catalog.name,
      description: catalog.catalog.description,
      title: catalog.catalog.name,
    },
  };

  return resolveAllReferences(catalog, enrichedContext);
}

// ============================================
// Validation Helpers
// ============================================

/**
 * Verifica se uma string é uma referência válida
 */
export function isReference(value: any): value is ReferenceString {
  return typeof value === 'string' && value.startsWith('$');
}

/**
 * Extrai todas as referências de um objeto
 */
export function extractReferences(obj: any): string[] {
  const references: string[] = [];

  function traverse(current: any) {
    if (current === null || current === undefined) return;

    if (isReference(current)) {
      references.push(current);
      return;
    }

    if (Array.isArray(current)) {
      current.forEach(traverse);
      return;
    }

    if (typeof current === 'object') {
      Object.values(current).forEach(traverse);
    }
  }

  traverse(obj);
  return references;
}

/**
 * Valida se todas as referências podem ser resolvidas
 */
export function validateReferences(
  obj: any,
  context: ReferenceContext
): { valid: boolean; unresolvedRefs: string[] } {
  const references = extractReferences(obj);
  const unresolvedRefs: string[] = [];

  for (const ref of references) {
    const resolved = resolveReference(ref, context);
    // Se o valor resolvido é igual à referência original, não foi resolvido
    if (resolved === ref) {
      unresolvedRefs.push(ref);
    }
  }

  return {
    valid: unresolvedRefs.length === 0,
    unresolvedRefs,
  };
}

// ============================================
// Product Loading Helpers
// ============================================

/**
 * Convert API ProductReference to internal ProductReference format
 */
export function convertAPIProduct(apiProduct: APIProductReference): ProductReference {
  return {
    id: apiProduct.id,
    name: apiProduct.name,
    sku: apiProduct.sku,
    cover: apiProduct.cover_url || '',
    price: apiProduct.price,
    currency: apiProduct.currency,
    description: apiProduct.description,
    specs: apiProduct.specs,
    category: apiProduct.category_name || undefined,
    badge: apiProduct.badge,
    stock: apiProduct.stock,
    gallery: apiProduct.gallery_urls,
  };
}

/**
 * Load products from backend and convert to Map for reference resolution
 * @param productIds Array of product IDs to load
 * @returns Map of product ID to ProductReference
 */
export async function loadProductsForContext(
  productIds: number[]
): Promise<Map<number, ProductReference>> {
  if (productIds.length === 0) {
    return new Map();
  }

  try {
    const apiProducts = await productService.resolveReferences(productIds);
    const productMap = new Map<number, ProductReference>();

    Object.values(apiProducts).forEach((apiProduct) => {
      const product = convertAPIProduct(apiProduct);
      productMap.set(product.id, product);
    });

    logger.debug(`[ReferenceResolver] Loaded ${productMap.size} products from backend`);
    return productMap;
  } catch (error) {
    console.error('[ReferenceResolver] Error loading products:', error);
    return new Map();
  }
}

/**
 * Extract product IDs from references in a catalog
 * @param catalog Catalog JSON to scan for product references
 * @returns Array of unique product IDs
 */
export function extractProductIds(catalog: any): number[] {
  const refs = extractReferences(catalog);
  const productIds = new Set<number>();

  refs.forEach((ref) => {
    const match = ref.match(/^\$product\.(\d+)\./);
    if (match) {
      productIds.add(parseInt(match[1], 10));
    }
  });

  return Array.from(productIds);
}

/**
 * Prepare context with products loaded from backend
 * This is a convenience function for loading products before resolving references
 *
 * @param catalog Catalog JSON to resolve
 * @param partialContext Partial context (designTokens, brand, etc)
 * @returns Complete context with products loaded
 */
export async function prepareContextWithProducts(
  catalog: any,
  partialContext: Omit<ReferenceContext, 'products'>
): Promise<ReferenceContext> {
  const productIds = extractProductIds(catalog);

  if (productIds.length === 0) {
    return partialContext;
  }

  const products = await loadProductsForContext(productIds);

  return {
    ...partialContext,
    products,
  };
}

// ============================================
// Example Usage for AI
// ============================================

/**
 * EXEMPLO DE USO PARA IA:
 *
 * const catalogJSON = {
 *   designTokens: {
 *     colors: { primary: { value: "#4472C4" } }
 *   },
 *   pages: [{
 *     elements: [{
 *       type: "text-title",
 *       content: { text: "$catalog.name" },
 *       style: {
 *         textColor: "$tokens.colors.primary",
 *         backgroundColor: "$brand.primaryColor"
 *       }
 *     }]
 *   }]
 * };
 *
 * const context = {
 *   designTokens: catalogJSON.designTokens,
 *   brand: { primaryColor: "#FF6B6B", logo: "/logo.png" },
 *   catalog: { name: "Meu Catálogo" }
 * };
 *
 * const resolved = resolveCatalogReferences(catalogJSON, context);
 * // Todas as referências $... foram substituídas pelos valores reais
 */
