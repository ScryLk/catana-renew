/**
 * Sistema de Regras Visuais do Catana
 *
 * "JSON define intenção visual, o Catana resolve o layout."
 *
 * Este arquivo contém todas as regras obrigatórias de layout, tipografia,
 * espaçamento e posicionamento para garantir catálogos profissionais.
 */

// ============================================
// 1️⃣ REGRAS DE PÁGINA (CANVAS)
// ============================================

export interface PageRules {
  size: 'A4' | 'Letter' | 'Custom';
  width: number;
  height: number;
  margin: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}

export const PAGE_PRESETS: Record<string, PageRules> = {
  A4: {
    size: 'A4',
    width: 794,
    height: 1123,
    margin: { top: 64, right: 64, bottom: 64, left: 64 }
  },
  Letter: {
    size: 'Letter',
    width: 816,
    height: 1056,
    margin: { top: 64, right: 64, bottom: 64, left: 64 }
  }
};

export function getContentArea(page: PageRules) {
  return {
    x: page.margin.left,
    y: page.margin.top,
    width: page.width - page.margin.left - page.margin.right,
    height: page.height - page.margin.top - page.margin.bottom
  };
}

// ============================================
// 2️⃣ SISTEMA DE ESPAÇAMENTO (GRID & RHYTHM)
// ============================================

/**
 * Unidade base: 8px
 * Todos os espaçamentos devem ser múltiplos de 8
 */
export const SPACING_UNIT = 8;

export const SPACING = {
  /** Entre seções - 48px */
  SECTION: 48,
  /** Entre título e conteúdo - 24px */
  TITLE_CONTENT: 24,
  /** Entre blocos internos - 16px */
  BLOCK: 16,
  /** Padding mínimo de cards - 16px */
  CARD_MIN: 16,
  /** Padding padrão de cards - 24px */
  CARD_DEFAULT: 24,
  /** Espaçamento mínimo - 8px */
  MIN: 8,
  /** Espaçamento pequeno - 12px */
  SMALL: 12,
  /** Espaçamento médio - 16px */
  MEDIUM: 16,
  /** Espaçamento grande - 24px */
  LARGE: 24,
  /** Espaçamento extra grande - 32px */
  XLARGE: 32,
} as const;

/**
 * Normaliza valor para múltiplo de 8
 */
export function normalizeSpacing(value: number): number {
  return Math.round(value / SPACING_UNIT) * SPACING_UNIT;
}

/**
 * Valida se o espaçamento é múltiplo de 8
 */
export function isValidSpacing(value: number): boolean {
  return value % SPACING_UNIT === 0;
}

// ============================================
// 3️⃣ SISTEMA DE LAYOUT (FLOW VERTICAL)
// ============================================

export type LayoutType = 'vertical-stack' | 'horizontal-stack' | 'grid' | 'absolute';
export type AlignType = 'start' | 'center' | 'end' | 'stretch';

export interface LayoutConfig {
  type: LayoutType;
  gap?: number;
  align?: AlignType;
  columns?: number; // Para grid
}

export const DEFAULT_LAYOUT: LayoutConfig = {
  type: 'vertical-stack',
  gap: SPACING.TITLE_CONTENT,
  align: 'start'
};

// ============================================
// 4️⃣ TIPOGRAFIA (OBRIGATÓRIA)
// ============================================

export type TextRole =
  | 'title'           // Título principal
  | 'section-title'   // Título de seção
  | 'subtitle'        // Subtítulo
  | 'body'            // Texto normal
  | 'caption'         // Texto auxiliar
  | 'decorative';     // Decorativo

export interface TypographyRule {
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  marginBottom?: number;
}

export const TYPOGRAPHY_RULES: Record<TextRole, TypographyRule> = {
  'title': {
    fontSize: 32,
    fontWeight: 600,
    lineHeight: 1.25,
    marginBottom: SPACING.TITLE_CONTENT
  },
  'section-title': {
    fontSize: 24,
    fontWeight: 600,
    lineHeight: 1.3,
    marginBottom: SPACING.BLOCK
  },
  'subtitle': {
    fontSize: 18,
    fontWeight: 500,
    lineHeight: 1.4,
    marginBottom: SPACING.BLOCK
  },
  'body': {
    fontSize: 14,
    fontWeight: 400,
    lineHeight: 1.6,
    marginBottom: SPACING.BLOCK
  },
  'caption': {
    fontSize: 12,
    fontWeight: 400,
    lineHeight: 1.6,
    marginBottom: SPACING.MIN
  },
  'decorative': {
    fontSize: 14,
    fontWeight: 400,
    lineHeight: 1.6,
    marginBottom: 0
  }
};

export const DEFAULT_FONT_FAMILY = 'Inter';

// ============================================
// 5️⃣ COMPONENTES ESSENCIAIS
// ============================================

export type ElementType = 'text' | 'image' | 'group' | 'line' | 'rectangle' | 'product';
export type ElementRole = TextRole | 'hero' | 'thumbnail' | 'section' | 'card' | 'divider';

export interface ElementSpacing {
  marginTop?: number;
  marginBottom?: number;
  marginLeft?: number;
  marginRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  paddingRight?: number;
}

export interface BaseElementRules {
  type: ElementType;
  role: ElementRole;
  spacing?: ElementSpacing;
}

// ============================================
// 6️⃣ REGRAS PARA IMAGENS
// ============================================

export interface ImageRules {
  maxWidth: string | number;
  align: 'left' | 'center' | 'right';
  borderRadius?: number;
  aspectRatio?: number;
}

export const IMAGE_RULES: Record<string, ImageRules> = {
  hero: {
    maxWidth: '100%',
    align: 'center',
    borderRadius: 8
  },
  thumbnail: {
    maxWidth: 200,
    align: 'center',
    borderRadius: 4
  },
  grid: {
    maxWidth: '100%',
    align: 'center',
    borderRadius: 4
  }
};

// ============================================
// 7️⃣ INTELIGÊNCIA DE POSICIONAMENTO
// ============================================

export interface PositionContext {
  currentY: number;
  contentArea: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  lastElementBottom: number;
}

/**
 * Calcula a próxima posição Y baseada no contexto atual
 */
export function calculateNextY(
  context: PositionContext,
  elementHeight: number,
  marginTop: number = 0
): number {
  const nextY = context.lastElementBottom + marginTop;

  // Verifica se cabe na página
  if (nextY + elementHeight > context.contentArea.y + context.contentArea.height) {
    console.warn('[Layout] Elemento ultrapassa área de conteúdo');
  }

  return nextY;
}

/**
 * Atualiza o contexto após inserir um elemento
 */
export function updatePositionContext(
  context: PositionContext,
  elementHeight: number,
  marginBottom: number = 0
): PositionContext {
  return {
    ...context,
    currentY: context.lastElementBottom + marginBottom,
    lastElementBottom: context.lastElementBottom + elementHeight + marginBottom
  };
}

// ============================================
// 8️⃣ AGRUPAMENTO SEMÂNTICO
// ============================================

export interface GroupRules {
  role: 'section' | 'card' | 'header' | 'footer' | 'content';
  padding?: ElementSpacing;
  gap?: number;
}

export const GROUP_RULES: Record<string, GroupRules> = {
  section: {
    role: 'section',
    padding: {
      paddingTop: 0,
      paddingBottom: SPACING.SECTION
    },
    gap: SPACING.BLOCK
  },
  card: {
    role: 'card',
    padding: {
      paddingTop: SPACING.CARD_DEFAULT,
      paddingBottom: SPACING.CARD_DEFAULT,
      paddingLeft: SPACING.CARD_DEFAULT,
      paddingRight: SPACING.CARD_DEFAULT
    },
    gap: SPACING.BLOCK
  },
  header: {
    role: 'header',
    padding: {
      paddingBottom: SPACING.TITLE_CONTENT
    },
    gap: SPACING.MIN
  },
  footer: {
    role: 'footer',
    padding: {
      paddingTop: SPACING.TITLE_CONTENT
    },
    gap: SPACING.MIN
  },
  content: {
    role: 'content',
    gap: SPACING.BLOCK
  }
};

// ============================================
// 9️⃣ VALIDAÇÃO
// ============================================

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

/**
 * Valida se um elemento está de acordo com as regras
 */
export function validateElement(element: any): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Validar tipo obrigatório
  if (!element.type) {
    errors.push({
      field: 'type',
      message: 'Elemento deve ter um tipo definido',
      severity: 'error'
    });
  }

  // Validar role obrigatório
  if (!element.role) {
    warnings.push({
      field: 'role',
      message: 'Elemento deve ter um role definido para aplicação automática de estilos',
      severity: 'warning'
    });
  }

  // Validar espaçamentos múltiplos de 8
  if (element.spacing) {
    const spacingValues = Object.values(element.spacing) as number[];
    spacingValues.forEach((value, index) => {
      if (typeof value === 'number' && !isValidSpacing(value)) {
        warnings.push({
          field: `spacing[${index}]`,
          message: `Espaçamento ${value}px não é múltiplo de 8. Será normalizado para ${normalizeSpacing(value)}px`,
          severity: 'warning'
        });
      }
    });
  }

  // Validar posicionamento absoluto sem contexto
  if (element.position && !element.positionContext) {
    warnings.push({
      field: 'position',
      message: 'Posicionamento absoluto sem contexto. Considere usar layout vertical-stack',
      severity: 'warning'
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Aplica regras automáticas a um elemento baseado no seu role
 */
export function applyRulesToElement(element: any): any {
  const enhanced = { ...element };

  // Aplicar tipografia baseada no role
  if (element.type === 'text' && element.role && TYPOGRAPHY_RULES[element.role as TextRole]) {
    const typoRules = TYPOGRAPHY_RULES[element.role as TextRole];
    enhanced.style = {
      ...enhanced.style,
      fontFamily: enhanced.style?.fontFamily || DEFAULT_FONT_FAMILY,
      fontSize: enhanced.style?.fontSize || typoRules.fontSize,
      fontWeight: enhanced.style?.fontWeight || typoRules.fontWeight,
      lineHeight: enhanced.style?.lineHeight || typoRules.lineHeight
    };

    // Aplicar marginBottom padrão se não especificado
    if (!enhanced.spacing?.marginBottom && typoRules.marginBottom) {
      enhanced.spacing = {
        ...enhanced.spacing,
        marginBottom: typoRules.marginBottom
      };
    }
  }

  // Aplicar regras de imagem baseada no role
  if (element.type === 'image' && element.role) {
    const imageRole = element.role === 'hero' ? 'hero' : 'thumbnail';
    const imageRules = IMAGE_RULES[imageRole];

    if (imageRules) {
      enhanced.style = {
        ...enhanced.style,
        borderRadius: enhanced.style?.borderRadius || imageRules.borderRadius
      };
    }
  }

  // Normalizar espaçamentos para múltiplos de 8
  if (enhanced.spacing) {
    Object.keys(enhanced.spacing).forEach(key => {
      const value = enhanced.spacing[key];
      if (typeof value === 'number') {
        enhanced.spacing[key] = normalizeSpacing(value);
      }
    });
  }

  return enhanced;
}

// Os tipos acima ja sao exportados na propria declaracao (export interface).
