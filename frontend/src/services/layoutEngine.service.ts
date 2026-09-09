/**
 * Motor de Layout do Catana
 *
 * Responsável por aplicar automaticamente as regras visuais
 * a elementos importados via JSON, garantindo layouts profissionais.
 *
 * "JSON define intenção visual, o Catana resolve o layout."
 */

import {
  PAGE_PRESETS,
  getContentArea,
  SPACING,
  DEFAULT_LAYOUT,
  TYPOGRAPHY_RULES,
  GROUP_RULES,
  applyRulesToElement,
  validateElement,
  calculateNextY,
  updatePositionContext,
  type PageRules,
  type PositionContext,
  type ValidationResult,
  type TextRole,
  type LayoutConfig
} from '../types/layoutRules';

import type { CatalogElement } from '../types/editor';

// ============================================
// CONTEXTO DE LAYOUT
// ============================================

interface LayoutEngineContext {
  page: PageRules;
  contentArea: ReturnType<typeof getContentArea>;
  position: PositionContext;
  layout: LayoutConfig;
}

/**
 * Cria um novo contexto de layout
 */
export function createLayoutContext(pageSize: 'A4' | 'Letter' = 'A4'): LayoutEngineContext {
  const page = PAGE_PRESETS[pageSize];
  const contentArea = getContentArea(page);

  return {
    page,
    contentArea,
    position: {
      currentY: contentArea.y,
      contentArea,
      lastElementBottom: contentArea.y
    },
    layout: DEFAULT_LAYOUT
  };
}

// ============================================
// PROCESSAMENTO DE ELEMENTOS
// ============================================

/**
 * Processa um elemento individual aplicando todas as regras
 */
export function processElement(
  element: any,
  context: LayoutEngineContext
): { element: CatalogElement; context: LayoutEngineContext; validation: ValidationResult } {
  // 1. Validar elemento
  const validation = validateElement(element);

  // 2. Aplicar regras baseadas no role
  const processed = applyRulesToElement(element);

  // 3. Calcular posicionamento automático (flow vertical)
  if (!processed.position || context.layout.type === 'vertical-stack') {
    const marginTop = processed.spacing?.marginTop || 0;
    const marginBottom = processed.spacing?.marginBottom || SPACING.BLOCK;

    // Estimar altura do elemento
    const estimatedHeight = estimateElementHeight(processed);

    // Calcular posição Y
    const nextY = calculateNextY(context.position, estimatedHeight, marginTop);

    // Aplicar posição
    processed.position = {
      x: context.contentArea.x + (processed.spacing?.marginLeft || 0),
      y: nextY
    };

    // Aplicar largura padrão (100% da área de conteúdo menos margens)
    if (!processed.size?.width) {
      const marginLeft = processed.spacing?.marginLeft || 0;
      const marginRight = processed.spacing?.marginRight || 0;
      const availableWidth = context.contentArea.width - marginLeft - marginRight;

      processed.size = {
        ...processed.size,
        width: availableWidth
      };
    }

    // Atualizar contexto
    const newContext = {
      ...context,
      position: updatePositionContext(
        context.position,
        estimatedHeight,
        marginBottom
      )
    };

    return { element: processed, context: newContext, validation };
  }

  return { element: processed, context, validation };
}

/**
 * Estima a altura de um elemento baseado no tipo e conteúdo
 */
function estimateElementHeight(element: any): number {
  // Se altura está definida, usa ela
  if (element.size?.height) {
    return element.size.height;
  }

  // Estimar baseado no tipo
  switch (element.type) {
    case 'text': {
      const role = element.role as TextRole;
      const typoRules = TYPOGRAPHY_RULES[role] || TYPOGRAPHY_RULES.body;
      const fontSize = element.style?.fontSize || typoRules.fontSize;
      const lineHeight = element.style?.lineHeight || typoRules.lineHeight;

      // Estimar número de linhas (simplificado)
      const textLength = element.content?.length || 100;
      const charsPerLine = Math.floor((element.size?.width || 600) / (fontSize * 0.6));
      const lines = Math.ceil(textLength / charsPerLine);

      return fontSize * lineHeight * lines;
    }

    case 'image': {
      // Se tem aspectRatio, calcular altura
      if (element.aspectRatio && element.size?.width) {
        return element.size.width / element.aspectRatio;
      }
      // Padrão: 300px
      return element.size?.height || 300;
    }

    case 'rectangle':
      return element.size?.height || 100;

    case 'line':
      return 2; // Linha tem altura mínima

    case 'group': {
      // Somar alturas dos children + gaps
      if (element.children && Array.isArray(element.children)) {
        const gap = element.layout?.gap || SPACING.BLOCK;
        let totalHeight = 0;

        element.children.forEach((child: any, index: number) => {
          totalHeight += estimateElementHeight(child);
          if (index < element.children.length - 1) {
            totalHeight += gap;
          }
        });

        // Adicionar padding
        const paddingTop = element.spacing?.paddingTop || 0;
        const paddingBottom = element.spacing?.paddingBottom || 0;
        totalHeight += paddingTop + paddingBottom;

        return totalHeight;
      }
      return 100;
    }

    case 'product':
      // Produto tem altura estimada baseada no layout
      return 200;

    default:
      return 100;
  }
}

// ============================================
// PROCESSAMENTO DE GRUPOS
// ============================================

/**
 * Processa um grupo de elementos (seção, card, etc)
 */
export function processGroup(
  group: any,
  context: LayoutEngineContext
): { element: CatalogElement; context: LayoutEngineContext; validation: ValidationResult } {
  // Aplicar regras de grupo
  const groupRole = group.role || 'section';
  const groupRules = GROUP_RULES[groupRole] || GROUP_RULES.section;

  // Aplicar padding e gap padrão
  const processed = {
    ...group,
    spacing: {
      ...groupRules.padding,
      ...group.spacing
    },
    layout: {
      ...DEFAULT_LAYOUT,
      gap: groupRules.gap,
      ...group.layout
    }
  };

  // Processar children
  if (processed.children && Array.isArray(processed.children)) {
    // Criar sub-contexto para children
    const paddingTop = processed.spacing?.paddingTop || 0;
    const paddingLeft = processed.spacing?.paddingLeft || 0;

    let childContext: LayoutEngineContext = {
      ...context,
      position: {
        ...context.position,
        currentY: context.position.currentY + paddingTop,
        lastElementBottom: context.position.currentY + paddingTop
      },
      contentArea: {
        ...context.contentArea,
        x: context.contentArea.x + paddingLeft,
        width: context.contentArea.width - paddingLeft - (processed.spacing?.paddingRight || 0)
      }
    };

    const processedChildren: any[] = [];
    const childValidations: ValidationResult[] = [];

    processed.children.forEach((child: any) => {
      if (child.type === 'group') {
        const result = processGroup(child, childContext);
        processedChildren.push(result.element);
        childContext = result.context;
        childValidations.push(result.validation);
      } else {
        const result = processElement(child, childContext);
        processedChildren.push(result.element);
        childContext = result.context;
        childValidations.push(result.validation);
      }
    });

    processed.children = processedChildren;

    // Calcular altura total do grupo
    const paddingBottom = processed.spacing?.paddingBottom || 0;
    const groupHeight = childContext.position.lastElementBottom - context.position.currentY + paddingBottom;

    // Aplicar posição ao grupo
    processed.position = {
      x: context.contentArea.x,
      y: context.position.currentY
    };

    processed.size = {
      width: context.contentArea.width,
      height: groupHeight
    };

    // Atualizar contexto principal
    const newContext = {
      ...context,
      position: updatePositionContext(
        context.position,
        groupHeight,
        processed.spacing?.marginBottom || SPACING.SECTION
      )
    };

    // Consolidar validações
    const validation: ValidationResult = {
      valid: childValidations.every(v => v.valid),
      errors: childValidations.flatMap(v => v.errors),
      warnings: childValidations.flatMap(v => v.warnings)
    };

    return { element: processed, context: newContext, validation };
  }

  return processElement(processed, context);
}

// ============================================
// PROCESSAMENTO DE PÁGINA COMPLETA
// ============================================

/**
 * Processa uma página inteira de elementos
 */
export function processPage(
  elements: any[],
  pageSize: 'A4' | 'Letter' = 'A4'
): {
  elements: CatalogElement[];
  validations: ValidationResult[];
  context: LayoutEngineContext;
} {
  let context = createLayoutContext(pageSize);
  const processedElements: CatalogElement[] = [];
  const validations: ValidationResult[] = [];

  elements.forEach(element => {
    if (element.type === 'group') {
      const result = processGroup(element, context);
      processedElements.push(result.element);
      context = result.context;
      validations.push(result.validation);
    } else {
      const result = processElement(element, context);
      processedElements.push(result.element);
      context = result.context;
      validations.push(result.validation);
    }
  });

  return { elements: processedElements, validations, context };
}

// ============================================
// UTILIDADES
// ============================================

/**
 * Converte elementos com layout relativo para absoluto
 * (útil para o editor que trabalha com posicionamento absoluto)
 */
export function convertToAbsoluteLayout(elements: any[]): CatalogElement[] {
  const { elements: processed } = processPage(elements);
  return processed;
}

/**
 * Valida um catálogo inteiro
 */
export function validateCatalog(catalog: any): {
  valid: boolean;
  errors: Array<{ page: number; element: number; error: string }>;
  warnings: Array<{ page: number; element: number; warning: string }>;
} {
  const errors: Array<{ page: number; element: number; error: string }> = [];
  const warnings: Array<{ page: number; element: number; warning: string }> = [];

  if (!catalog.pages || !Array.isArray(catalog.pages)) {
    errors.push({ page: -1, element: -1, error: 'Catálogo deve conter um array de páginas' });
    return { valid: false, errors, warnings };
  }

  catalog.pages.forEach((page: any, pageIndex: number) => {
    if (!page.elements || !Array.isArray(page.elements)) {
      errors.push({ page: pageIndex, element: -1, error: 'Página deve conter um array de elementos' });
      return;
    }

    page.elements.forEach((element: any, elementIndex: number) => {
      const validation = validateElement(element);

      validation.errors.forEach(err => {
        errors.push({
          page: pageIndex,
          element: elementIndex,
          error: `${err.field}: ${err.message}`
        });
      });

      validation.warnings.forEach(warn => {
        warnings.push({
          page: pageIndex,
          element: elementIndex,
          warning: `${warn.field}: ${warn.message}`
        });
      });
    });
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Gera um relatório de validação em formato legível
 */
export function generateValidationReport(catalog: any): string {
  const result = validateCatalog(catalog);
  let report = '=== RELATÓRIO DE VALIDAÇÃO DO CATÁLOGO ===\n\n';

  if (result.valid) {
    report += '✅ Catálogo válido! Todas as regras foram atendidas.\n';
  } else {
    report += `❌ Catálogo inválido. Encontrados ${result.errors.length} erro(s).\n\n`;
    report += 'ERROS:\n';
    result.errors.forEach((err, index) => {
      report += `${index + 1}. Página ${err.page + 1}, Elemento ${err.element + 1}: ${err.error}\n`;
    });
  }

  if (result.warnings.length > 0) {
    report += `\n⚠️  ${result.warnings.length} aviso(s):\n`;
    result.warnings.forEach((warn, index) => {
      report += `${index + 1}. Página ${warn.page + 1}, Elemento ${warn.element + 1}: ${warn.warning}\n`;
    });
  }

  return report;
}
