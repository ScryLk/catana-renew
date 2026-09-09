/**
 * 🎨 Design Tokens System
 *
 * Sistema de tokens de design para permitir que IA gere catálogos
 * com consistência visual e controle global de estilos.
 *
 * Tokens podem ser referenciados por elementos usando sintaxe:
 * - "$tokens.colors.primary"
 * - "$tokens.typography.heading.fontSize"
 * - "$tokens.spacing.large"
 */

// ============================================
// Color Tokens
// ============================================

export interface ColorToken {
  value: string;           // Valor da cor (#RRGGBB, rgb(), hsl())
  description?: string;    // Descrição semântica
  contrast?: string;       // Cor de contraste sugerida para texto
}

export interface ColorPalette {
  // Brand Colors
  primary: ColorToken;
  secondary: ColorToken;
  accent?: ColorToken;

  // Neutral Colors
  background: ColorToken;
  surface: ColorToken;
  border: ColorToken;

  // Text Colors
  text: {
    primary: ColorToken;
    secondary: ColorToken;
    disabled: ColorToken;
  };

  // Semantic Colors
  success?: ColorToken;
  warning?: ColorToken;
  error?: ColorToken;
  info?: ColorToken;

  // Custom Colors (extensível)
  [key: string]: ColorToken | any;
}

// ============================================
// Typography Tokens
// ============================================

export interface TypographyToken {
  fontFamily: string;
  fontSize: number;        // em px
  fontWeight: number | 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900';
  lineHeight: number;      // multiplicador (1.5 = 150%)
  letterSpacing?: number;  // em px
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
}

export interface TypographyScale {
  // Headings
  h1: TypographyToken;
  h2: TypographyToken;
  h3: TypographyToken;
  h4: TypographyToken;
  h5: TypographyToken;
  h6: TypographyToken;

  // Body
  body: TypographyToken;
  bodySmall: TypographyToken;
  bodyLarge: TypographyToken;

  // Special
  caption: TypographyToken;
  button: TypographyToken;
  overline?: TypographyToken;

  // Custom (extensível)
  [key: string]: TypographyToken | undefined;
}

// ============================================
// Spacing Tokens
// ============================================

export interface SpacingScale {
  // Base spacing unit (geralmente 4px ou 8px)
  base: number;

  // Scale multipliers
  xxs: number;   // 0.25x base (2px se base = 8px)
  xs: number;    // 0.5x base (4px)
  sm: number;    // 1x base (8px)
  md: number;    // 2x base (16px)
  lg: number;    // 3x base (24px)
  xl: number;    // 4x base (32px)
  xxl: number;   // 6x base (48px)
  xxxl: number;  // 8x base (64px)

  // Custom (extensível)
  [key: string]: number;
}

// ============================================
// Border Radius Tokens
// ============================================

export interface BorderRadiusScale {
  none: number;      // 0
  sm: number;        // 2-4px
  md: number;        // 6-8px
  lg: number;        // 12-16px
  xl: number;        // 20-24px
  full: number;      // 9999px (completamente arredondado)

  // Custom
  [key: string]: number;
}

// ============================================
// Shadow Tokens
// ============================================

export interface ShadowToken {
  value: string;         // CSS box-shadow completo
  description?: string;
}

export interface ShadowScale {
  none: ShadowToken;
  sm: ShadowToken;
  md: ShadowToken;
  lg: ShadowToken;
  xl: ShadowToken;

  // Custom
  [key: string]: ShadowToken;
}

// ============================================
// Complete Design Token System
// ============================================

export interface DesignTokens {
  // Metadata
  name: string;
  version: string;
  description?: string;

  // Token Categories
  colors: ColorPalette;
  typography: TypographyScale;
  spacing: SpacingScale;
  borderRadius: BorderRadiusScale;
  shadows: ShadowScale;

  // Additional custom tokens
  custom?: {
    [key: string]: any;
  };
}

// ============================================
// Catalog with Design Tokens
// ============================================

export interface CatalogWithTokens {
  catalog: {
    name: string;
    description?: string;
    // ... outros metadados
  };

  // Design tokens aplicados globalmente
  designTokens?: DesignTokens;

  pages: any[]; // Array de páginas
}

// ============================================
// Default Design Tokens (exemplo profissional)
// ============================================

export const DEFAULT_DESIGN_TOKENS: DesignTokens = {
  name: 'Catana Default Theme',
  version: '1.0.0',
  description: 'Design tokens padrão do Catana - clean, profissional e versátil',

  colors: {
    primary: {
      value: '#4472C4',
      description: 'Cor primária da marca',
      contrast: '#FFFFFF',
    },
    secondary: {
      value: '#FF6B6B',
      description: 'Cor secundária para destaques',
      contrast: '#FFFFFF',
    },
    accent: {
      value: '#FFA500',
      description: 'Cor de destaque/call-to-action',
      contrast: '#000000',
    },
    background: {
      value: '#FFFFFF',
      description: 'Fundo principal',
      contrast: '#1A1A1A',
    },
    surface: {
      value: '#F5F5F5',
      description: 'Superfícies elevadas (cards, modais)',
      contrast: '#1A1A1A',
    },
    border: {
      value: '#E0E0E0',
      description: 'Bordas e divisores',
      contrast: '#1A1A1A',
    },
    text: {
      primary: {
        value: '#1A1A1A',
        description: 'Texto principal',
      },
      secondary: {
        value: '#6B6B6B',
        description: 'Texto secundário',
      },
      disabled: {
        value: '#BDBDBD',
        description: 'Texto desabilitado',
      },
    },
    success: {
      value: '#4CAF50',
      description: 'Indicador de sucesso',
      contrast: '#FFFFFF',
    },
    warning: {
      value: '#FF9800',
      description: 'Indicador de atenção',
      contrast: '#000000',
    },
    error: {
      value: '#F44336',
      description: 'Indicador de erro',
      contrast: '#FFFFFF',
    },
    info: {
      value: '#2196F3',
      description: 'Informação',
      contrast: '#FFFFFF',
    },
  },

  typography: {
    h1: {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: 48,
      fontWeight: 700,
      lineHeight: 1.2,
      letterSpacing: -0.5,
    },
    h2: {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: 36,
      fontWeight: 700,
      lineHeight: 1.3,
      letterSpacing: -0.25,
    },
    h3: {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: 28,
      fontWeight: 600,
      lineHeight: 1.4,
    },
    h4: {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: 24,
      fontWeight: 600,
      lineHeight: 1.4,
    },
    h5: {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: 20,
      fontWeight: 600,
      lineHeight: 1.5,
    },
    h6: {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: 16,
      fontWeight: 600,
      lineHeight: 1.5,
    },
    body: {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: 16,
      fontWeight: 400,
      lineHeight: 1.6,
    },
    bodySmall: {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: 14,
      fontWeight: 400,
      lineHeight: 1.6,
    },
    bodyLarge: {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: 18,
      fontWeight: 400,
      lineHeight: 1.6,
    },
    caption: {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: 12,
      fontWeight: 400,
      lineHeight: 1.5,
    },
    button: {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: 14,
      fontWeight: 600,
      lineHeight: 1,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
  },

  spacing: {
    base: 8,
    xxs: 2,   // 2px
    xs: 4,    // 4px
    sm: 8,    // 8px
    md: 16,   // 16px
    lg: 24,   // 24px
    xl: 32,   // 32px
    xxl: 48,  // 48px
    xxxl: 64, // 64px
  },

  borderRadius: {
    none: 0,
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    full: 9999,
  },

  shadows: {
    none: {
      value: 'none',
      description: 'Sem sombra',
    },
    sm: {
      value: '0 1px 2px rgba(0, 0, 0, 0.05)',
      description: 'Sombra sutil',
    },
    md: {
      value: '0 4px 6px rgba(0, 0, 0, 0.1)',
      description: 'Sombra média',
    },
    lg: {
      value: '0 10px 15px rgba(0, 0, 0, 0.1)',
      description: 'Sombra grande',
    },
    xl: {
      value: '0 20px 25px rgba(0, 0, 0, 0.15)',
      description: 'Sombra extra grande',
    },
  },
};

// ============================================
// Helper Types
// ============================================

/**
 * Token Reference - permite referenciar tokens via string
 * Exemplo: "$tokens.colors.primary" ou "#FF0000"
 */
export type TokenReference = string;

/**
 * Resolve um token reference para seu valor real
 */
export function resolveTokenReference(
  reference: TokenReference,
  tokens: DesignTokens
): any {
  // Se não começar com $tokens., retornar valor literal
  if (!reference.startsWith('$tokens.')) {
    return reference;
  }

  // Extrair caminho do token
  const path = reference.replace('$tokens.', '').split('.');

  // Navegar pelo objeto de tokens
  let current: any = tokens;
  for (const key of path) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key];
    } else {
      console.warn(`Token não encontrado: ${reference}`);
      return reference; // Fallback para valor literal
    }
  }

  // Se for um ColorToken ou ShadowToken, retornar .value
  if (current && typeof current === 'object' && 'value' in current) {
    return current.value;
  }

  return current;
}

/**
 * Valida se uma referência de token existe
 */
export function isValidTokenReference(
  reference: TokenReference,
  tokens: DesignTokens
): boolean {
  if (!reference.startsWith('$tokens.')) {
    return true; // Valores literais são sempre válidos
  }

  const resolved = resolveTokenReference(reference, tokens);
  return resolved !== reference; // Token foi resolvido
}
