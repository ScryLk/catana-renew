/**
 * 🔐 Zod Schema Validation for Catalog Import/Export
 *
 * Valida JSONs gerados por IA ou importados manualmente
 * Garante type safety e fornece mensagens de erro claras
 */

import { z } from 'zod';

// ============================================
// Design Tokens Schemas
// ============================================

const ColorTokenSchema = z.object({
  value: z.string().describe('Cor em formato #RRGGBB, rgb(), hsl(), etc.'),
  description: z.string().optional(),
  contrast: z.string().optional().describe('Cor de contraste sugerida'),
});

const ColorPaletteSchema = z.object({
  primary: ColorTokenSchema,
  secondary: ColorTokenSchema,
  accent: ColorTokenSchema.optional(),
  background: ColorTokenSchema,
  surface: ColorTokenSchema,
  border: ColorTokenSchema,
  text: z.object({
    primary: ColorTokenSchema,
    secondary: ColorTokenSchema,
    disabled: ColorTokenSchema,
  }),
  success: ColorTokenSchema.optional(),
  warning: ColorTokenSchema.optional(),
  error: ColorTokenSchema.optional(),
  info: ColorTokenSchema.optional(),
}).passthrough(); // Permite cores customizadas

const TypographyTokenSchema = z.object({
  fontFamily: z.string(),
  fontSize: z.number().positive(),
  fontWeight: z.union([
    z.number().int().min(100).max(900),
    z.enum(['normal', 'bold', '100', '200', '300', '400', '500', '600', '700', '800', '900']),
  ]),
  lineHeight: z.number().positive(),
  letterSpacing: z.number().optional(),
  textTransform: z.enum(['none', 'uppercase', 'lowercase', 'capitalize']).optional(),
});

const TypographyScaleSchema = z.object({
  h1: TypographyTokenSchema,
  h2: TypographyTokenSchema,
  h3: TypographyTokenSchema,
  h4: TypographyTokenSchema,
  h5: TypographyTokenSchema,
  h6: TypographyTokenSchema,
  body: TypographyTokenSchema,
  bodySmall: TypographyTokenSchema,
  bodyLarge: TypographyTokenSchema,
  caption: TypographyTokenSchema,
  button: TypographyTokenSchema,
  overline: TypographyTokenSchema.optional(),
}).passthrough(); // Permite estilos customizados

const SpacingScaleSchema = z.object({
  base: z.number().positive(),
  xxs: z.number().nonnegative(),
  xs: z.number().nonnegative(),
  sm: z.number().nonnegative(),
  md: z.number().nonnegative(),
  lg: z.number().nonnegative(),
  xl: z.number().nonnegative(),
  xxl: z.number().nonnegative(),
  xxxl: z.number().nonnegative(),
}).passthrough();

const BorderRadiusScaleSchema = z.object({
  none: z.literal(0),
  sm: z.number().nonnegative(),
  md: z.number().nonnegative(),
  lg: z.number().nonnegative(),
  xl: z.number().nonnegative(),
  full: z.number().nonnegative(),
}).passthrough();

const ShadowTokenSchema = z.object({
  value: z.string(),
  description: z.string().optional(),
});

const ShadowScaleSchema = z.object({
  none: ShadowTokenSchema,
  sm: ShadowTokenSchema,
  md: ShadowTokenSchema,
  lg: ShadowTokenSchema,
  xl: ShadowTokenSchema,
}).passthrough();

const DesignTokensSchema = z.object({
  name: z.string(),
  version: z.string(),
  description: z.string().optional(),
  colors: ColorPaletteSchema,
  typography: TypographyScaleSchema,
  spacing: SpacingScaleSchema,
  borderRadius: BorderRadiusScaleSchema,
  shadows: ShadowScaleSchema,
  custom: z.record(z.any()).optional(),
});

// ============================================
// Element Schemas
// ============================================

const PositionSchema = z.object({
  x: z.number(),
  y: z.number(),
  unit: z.enum(['px', 'mm', 'cm', 'in', '%']).optional().default('px'),
});

const SizeSchema = z.object({
  width: z.number().positive(),
  height: z.number().positive(),
  unit: z.enum(['px', 'mm', 'cm', 'in', '%']).optional().default('px'),
});

const StyleSchema = z.object({
  backgroundColor: z.string().optional(),
  borderColor: z.string().optional(),
  borderWidth: z.number().nonnegative().optional(),
  borderRadius: z.number().nonnegative().optional(),
  opacity: z.number().min(0).max(1).optional(),
  boxShadow: z.string().optional(),
  // Adicionar outros estilos conforme necessário
}).passthrough();

const TransformSchema = z.object({
  rotation: z.number().optional().default(0),
  scale: z.number().positive().optional().default(1),
  zIndex: z.number().int().optional().default(0),
});

const VisibilitySchema = z.object({
  visible: z.boolean().optional().default(true),
  locked: z.boolean().optional().default(false),
});

// Text Data
const TextDataSchema = z.object({
  content: z.string(),
  fontSize: z.number().positive().optional(),
  fontFamily: z.string().optional(),
  fontWeight: z.union([z.string(), z.number()]).optional(),
  textAlign: z.enum(['left', 'center', 'right', 'justify']).optional(),
  textColor: z.string().optional(),
  lineHeight: z.number().positive().optional(),
  letterSpacing: z.number().optional(),
  textTransform: z.enum(['none', 'uppercase', 'lowercase', 'capitalize']).optional(),
  textDecoration: z.enum(['none', 'underline', 'line-through']).optional(),
});

// Image Data
const ImageDataSchema = z.object({
  src: z.string().url().or(z.string()).describe('URL da imagem ou caminho'),
  alt: z.string().optional(),
  opacity: z.number().min(0).max(1).optional(),
  borderRadius: z.number().nonnegative().optional(),
  objectFit: z.enum(['contain', 'cover', 'fill', 'none', 'scale-down']).optional(),
  aspectRatioLocked: z.boolean().optional(),
  originalWidth: z.number().positive().optional(),
  originalHeight: z.number().positive().optional(),
});

// Line Data
const LineDataSchema = z.object({
  start: z.object({ x: z.number(), y: z.number() }),
  end: z.object({ x: z.number(), y: z.number() }),
  strokeColor: z.string(),
  strokeWidth: z.number().positive(),
  opacity: z.number().min(0).max(1).optional(),
  style: z.enum(['solid', 'dashed', 'dotted']).optional(),
  cap: z.enum(['butt', 'round', 'square']).optional(),
  arrows: z.object({
    start: z.enum(['none', 'arrow']).optional(),
    end: z.enum(['none', 'arrow']).optional(),
  }).optional(),
});

// Product Data
const ProductDataSchema = z.object({
  name: z.string(),
  image: z.string().optional(),
  price: z.number().positive().optional(),
  currency: z.string().length(3).optional(),
  description: z.string().optional(),
  specs: z.array(z.object({
    label: z.string(),
    value: z.string(),
  })).optional(),
  badge: z.string().optional(),
  sku: z.string().optional(),
  category: z.string().optional(),
});

// QR Code Data
const QRCodeDataSchema = z.object({
  destinationType: z.enum(['catalog', 'product', 'profile', 'url']),
  data: z.string(),
  catalogId: z.number().optional(),
  productId: z.number().optional(),
  profileId: z.number().optional(),
  customUrl: z.string().url().optional(),
  color: z.string().optional(),
  backgroundColor: z.string().optional(),
  logo: z.string().optional(),
  logoSize: z.number().positive().optional(),
  errorCorrection: z.enum(['L', 'M', 'Q', 'H']).optional(),
  margin: z.number().nonnegative().optional(),
  quality: z.enum(['low', 'medium', 'high']).optional(),
  trackScans: z.boolean().optional(),
  label: z.string().optional(),
});

// Element Type (50+ tipos)
const ElementTypeSchema = z.enum([
  // Text
  'text-title', 'text-subtitle', 'text-paragraph', 'text-list', 'text',
  // Shapes
  'shape-rectangle', 'shape-circle', 'shape-triangle', 'shape-line', 'line',
  // Images
  'image', 'uploaded-image', 'banner', 'gallery', 'carousel',
  // Products
  'product-card', 'product-highlight', 'product-list', 'product-grid',
  // Templates
  'dipack-cover', 'dipack-showcase', 'dipack-confeitaria',
  // Interactive
  'qr-code', 'icon-grid', 'certification-badge',
  // Others
  'frame', 'group',
]);

// Generic Element Schema
const ExportElementSchema = z.object({
  logicalId: z.string().describe('ID lógico temporário para referência'),
  type: ElementTypeSchema,
  name: z.string().optional(),
  description: z.string().optional(),

  // Layout
  position: PositionSchema,
  size: SizeSchema,

  // Transform
  transform: TransformSchema.optional(),
  rotation: z.number().optional(),
  zIndex: z.number().int().optional(),

  // Visibility
  visibility: VisibilitySchema.optional(),
  visible: z.boolean().optional(),
  locked: z.boolean().optional(),
  opacity: z.number().min(0).max(1).optional(),

  // Style
  style: StyleSchema.optional(),

  // Group data
  isGroup: z.boolean().optional(),
  groupId: z.string().optional(),
  children: z.array(z.string()).optional(),

  // Type-specific content
  content: z.any().optional(),
  textData: TextDataSchema.optional(),
  imageData: ImageDataSchema.optional(),
  lineData: LineDataSchema.optional(),
  productData: ProductDataSchema.optional(),
  qrCodeData: QRCodeDataSchema.optional(),

  // Legacy
  imageUrl: z.string().optional(),
}).passthrough(); // Permite campos customizados

// ============================================
// Page Schema
// ============================================

const HeaderFooterConfigSchema = z.object({
  show: z.boolean().optional().default(true),
  logoUrl: z.string().optional(),
  showPageNumber: z.boolean().optional().default(true),
  fields: z.array(z.object({
    key: z.string(),
    label: z.string(),
    value: z.string(),
  })).optional(),
}).passthrough();

const ExportPageSchema = z.object({
  logicalId: z.string().describe('ID lógico da página (ex: "page-1")'),
  name: z.string(),
  order: z.number().int().nonnegative(),
  description: z.string().optional(),
  elements: z.array(ExportElementSchema),
  header: HeaderFooterConfigSchema.optional(),
  footer: HeaderFooterConfigSchema.optional(),
});

// ============================================
// Complete Catalog Export Schema
// ============================================

export const CatalogExportSchemaValidator = z.object({
  // Metadados técnicos
  schemaVersion: z.literal('1.0').describe('Versão do schema'),
  exportedAt: z.string().datetime().describe('ISO 8601 timestamp'),
  app: z.literal('Catana').describe('Aplicativo de origem'),

  // Metadados do catálogo
  catalog: z.object({
    name: z.string().min(1).max(255),
    description: z.string().optional(),
    dimensions: z.object({
      width: z.number().positive(),
      height: z.number().positive(),
      unit: z.enum(['px', 'mm', 'cm', 'in']).default('px'),
    }).optional(),
    organization: z.string().optional(),
    sede: z.string().optional(),
    createdAt: z.string().datetime().optional(),
    updatedAt: z.string().datetime().optional(),
    tags: z.array(z.string()).optional(),
    language: z.string().length(5).optional(), // 'pt-BR', 'en-US', etc
  }),

  // Settings
  settings: z.object({
    gridSize: z.number().positive().optional(),
    snapToGrid: z.boolean().optional(),
    defaultZoom: z.number().min(25).max(200).optional(),
  }).optional(),

  // 🎨 Design Tokens
  designTokens: DesignTokensSchema.optional(),

  // Pages
  pages: z.array(ExportPageSchema).min(1).describe('Pelo menos 1 página é necessária'),
});

// ============================================
// Validation Helpers
// ============================================

export type CatalogExportValidationResult =
  | { success: true; data: z.infer<typeof CatalogExportSchemaValidator> }
  | { success: false; errors: z.ZodError };

/**
 * Valida um JSON de catálogo e retorna resultado tipado
 */
export function validateCatalogJSON(json: unknown): CatalogExportValidationResult {
  const result = CatalogExportSchemaValidator.safeParse(json);

  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { success: false, errors: result.error };
  }
}

/**
 * Formata erros de validação para exibição amigável
 */
export function formatValidationErrors(errors: z.ZodError): string[] {
  return errors.errors.map((err) => {
    const path = err.path.join(' → ');
    return `${path}: ${err.message}`;
  });
}

/**
 * Exemplo de uso para IA:
 *
 * const json = {
 *   schemaVersion: "1.0",
 *   exportedAt: new Date().toISOString(),
 *   app: "Catana",
 *   catalog: { name: "Meu Catálogo" },
 *   pages: [...]
 * };
 *
 * const result = validateCatalogJSON(json);
 * if (result.success) {
 *   logger.debug("JSON válido!", result.data);
 * } else {
 *   console.error("Erros:", formatValidationErrors(result.errors));
 * }
 */
