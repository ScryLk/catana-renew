/**
 * 🧠 Sistema de Validação Inteligente do Catana
 *
 * "O Catana não apenas importa layouts — ele orienta, protege e aprimora."
 *
 * Detecta problemas, sugere correções e fornece feedback humanizado
 * para garantir catálogos profissionais.
 */

import { PAGE_PRESETS, TYPOGRAPHY_RULES, isValidSpacing, normalizeSpacing } from '../types/layoutRules';

// ============================================
// TIPOS DE SEVERIDADE
// ============================================

export type ValidationSeverity = 'critical' | 'warning' | 'info';

// ============================================
// ESTRUTURA DE VALIDAÇÃO
// ============================================

export interface ValidationIssue {
  id: string;
  severity: ValidationSeverity;
  title: string; // Título curto e claro
  message: string; // Mensagem humanizada
  suggestion?: string; // O que o usuário pode fazer
  autoFixable: boolean; // Pode ser corrigido automaticamente?
  location?: {
    page?: number;
    element?: number;
    field?: string;
  };
  technicalDetails?: string; // Detalhes técnicos (ocultos por padrão)
}

export interface ValidationReport {
  valid: boolean;
  canProceed: boolean; // False se há erros críticos
  issues: ValidationIssue[];
  stats: {
    critical: number;
    warnings: number;
    info: number;
    autoFixable: number;
  };
}

// ============================================
// REGRAS DE VALIDAÇÃO
// ============================================

/**
 * Valida elementos de texto
 */
function validateTextElement(element: any, pageIndex: number, elementIndex: number): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Texto vazio
  if (!element.textData?.text && !element.content) {
    issues.push({
      id: `text-empty-p${pageIndex}-e${elementIndex}`,
      severity: 'critical',
      title: 'Texto vazio detectado',
      message: 'Há um elemento de texto sem conteúdo que não será exibido no catálogo.',
      suggestion: 'Adicione conteúdo ao texto ou remova o elemento.',
      autoFixable: false,
      location: { page: pageIndex, element: elementIndex },
      technicalDetails: `Element ${element.logicalId || elementIndex} has no text content`
    });
  }

  // Fonte não padrão
  const fontFamily = element.style?.fontFamily;
  if (fontFamily && fontFamily !== 'Inter' && fontFamily !== 'Arial') {
    issues.push({
      id: `text-font-p${pageIndex}-e${elementIndex}`,
      severity: 'warning',
      title: 'Fonte diferente do padrão',
      message: `O texto usa a fonte "${fontFamily}", que pode não estar disponível em todos os dispositivos.`,
      suggestion: 'Use a fonte padrão "Inter" para garantir consistência visual.',
      autoFixable: true,
      location: { page: pageIndex, element: elementIndex, field: 'style.fontFamily' },
      technicalDetails: `Font family: ${fontFamily}`
    });
  }

  // Tamanho de fonte fora do padrão
  const fontSize = element.style?.fontSize;
  const standardSizes = Object.values(TYPOGRAPHY_RULES).map(r => r.fontSize);
  if (fontSize && !standardSizes.includes(fontSize)) {
    issues.push({
      id: `text-size-p${pageIndex}-e${elementIndex}`,
      severity: 'warning',
      title: 'Tamanho de texto inconsistente',
      message: `O tamanho do texto (${fontSize}px) não segue a hierarquia visual recomendada.`,
      suggestion: 'Use os tamanhos padrão: 32px (título), 24px (seção), 18px (subtítulo), 14px (corpo) ou 12px (legenda).',
      autoFixable: true,
      location: { page: pageIndex, element: elementIndex, field: 'style.fontSize' },
      technicalDetails: `Font size: ${fontSize}px`
    });
  }

  return issues;
}

/**
 * Valida posicionamento de elementos
 */
function validateElementPosition(
  element: any,
  pageIndex: number,
  elementIndex: number,
  pageSize: 'A4' | 'Letter' = 'A4'
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const page = PAGE_PRESETS[pageSize];

  if (!element.position) {
    issues.push({
      id: `pos-missing-p${pageIndex}-e${elementIndex}`,
      severity: 'critical',
      title: 'Posição não definida',
      message: 'Um elemento não possui posição definida e não será exibido corretamente.',
      suggestion: 'Defina a posição (x, y) do elemento ou use grupos com layout automático.',
      autoFixable: true,
      location: { page: pageIndex, element: elementIndex, field: 'position' },
      technicalDetails: 'Element has no position property'
    });
    return issues;
  }

  const { x, y } = element.position;
  const { width = 0, height = 0 } = element.size || {};

  // Elemento fora da página (esquerda/topo)
  if (x < page.margin.left || y < page.margin.top) {
    issues.push({
      id: `pos-outside-start-p${pageIndex}-e${elementIndex}`,
      severity: 'critical',
      title: 'Elemento fora da área visível',
      message: 'Um elemento está posicionado fora da margem de segurança da página.',
      suggestion: 'Ajuste a posição do elemento para dentro das margens (mínimo 64px de cada lado).',
      autoFixable: true,
      location: { page: pageIndex, element: elementIndex, field: 'position' },
      technicalDetails: `Position: x=${x}, y=${y}. Page margins: ${page.margin.left}px`
    });
  }

  // Elemento fora da página (direita/baixo)
  if (x + width > page.width - page.margin.right || y + height > page.height - page.margin.bottom) {
    issues.push({
      id: `pos-outside-end-p${pageIndex}-e${elementIndex}`,
      severity: 'critical',
      title: 'Elemento ultrapassa limites da página',
      message: 'Um elemento se estende além da área de impressão segura.',
      suggestion: 'Reduza o tamanho do elemento ou ajuste sua posição.',
      autoFixable: true,
      location: { page: pageIndex, element: elementIndex },
      technicalDetails: `Element bounds: ${x + width}x${y + height}. Page: ${page.width}x${page.height}`
    });
  }

  return issues;
}

/**
 * Valida espaçamentos
 */
function validateSpacing(element: any, pageIndex: number, elementIndex: number): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!element.spacing) return issues;

  const spacingValues = Object.entries(element.spacing);

  spacingValues.forEach(([key, value]) => {
    if (typeof value === 'number' && !isValidSpacing(value)) {
      issues.push({
        id: `spacing-${key}-p${pageIndex}-e${elementIndex}`,
        severity: 'warning',
        title: 'Espaçamento fora do padrão',
        message: `O espaçamento "${key}" (${value}px) não segue o grid visual de 8px.`,
        suggestion: `Ajuste para ${normalizeSpacing(value)}px para manter consistência.`,
        autoFixable: true,
        location: { page: pageIndex, element: elementIndex, field: `spacing.${key}` },
        technicalDetails: `${key}: ${value}px (should be multiple of 8)`
      });
    }
  });

  return issues;
}

/**
 * Valida imagens
 */
function validateImageElement(element: any, pageIndex: number, elementIndex: number): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Imagem sem URL
  if (!element.imageData?.url && !element.content) {
    issues.push({
      id: `img-no-url-p${pageIndex}-e${elementIndex}`,
      severity: 'critical',
      title: 'Imagem sem origem',
      message: 'Há um elemento de imagem sem URL definida.',
      suggestion: 'Adicione uma URL válida para a imagem ou remova o elemento.',
      autoFixable: false,
      location: { page: pageIndex, element: elementIndex },
      technicalDetails: 'Image element has no URL'
    });
  }

  // Imagem sem aspect ratio ou dimensões
  if (!element.size?.height && !element.aspectRatio) {
    issues.push({
      id: `img-no-dimensions-p${pageIndex}-e${elementIndex}`,
      severity: 'warning',
      title: 'Imagem pode ficar distorcida',
      message: 'A imagem não possui proporção ou altura definida, podendo aparecer esticada.',
      suggestion: 'Defina a altura ou a proporção (aspectRatio) da imagem.',
      autoFixable: true,
      location: { page: pageIndex, element: elementIndex },
      technicalDetails: 'Image has no height or aspectRatio'
    });
  }

  return issues;
}

/**
 * Valida uma página completa
 */
function validatePage(page: any, pageIndex: number): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Página sem ID lógico
  if (!page.logicalId) {
    issues.push({
      id: `page-no-id-${pageIndex}`,
      severity: 'critical',
      title: 'Página sem identificador',
      message: 'Uma página não possui ID lógico, o que pode causar problemas na importação.',
      suggestion: 'Adicione um "logicalId" único para cada página.',
      autoFixable: true,
      location: { page: pageIndex },
      technicalDetails: `Page at index ${pageIndex} has no logicalId`
    });
  }

  // Página sem elementos
  if (!page.elements || page.elements.length === 0) {
    issues.push({
      id: `page-empty-${pageIndex}`,
      severity: 'info',
      title: 'Página vazia',
      message: `A página ${pageIndex + 1} não contém elementos.`,
      suggestion: 'Adicione elementos à página ou remova-a do catálogo.',
      autoFixable: false,
      location: { page: pageIndex },
      technicalDetails: 'Page has no elements'
    });
    return issues;
  }

  // Validar cada elemento
  page.elements.forEach((element: any, elementIndex: number) => {
    // Elemento sem tipo
    if (!element.type) {
      issues.push({
        id: `elem-no-type-p${pageIndex}-e${elementIndex}`,
        severity: 'critical',
        title: 'Elemento sem tipo',
        message: 'Um elemento não possui tipo definido (text, image, etc.).',
        suggestion: 'Defina o tipo do elemento para que ele possa ser renderizado.',
        autoFixable: false,
        location: { page: pageIndex, element: elementIndex },
        technicalDetails: 'Element has no type property'
      });
      return;
    }

    // Validações específicas por tipo
    switch (element.type) {
      case 'text':
        issues.push(...validateTextElement(element, pageIndex, elementIndex));
        break;
      case 'image':
        issues.push(...validateImageElement(element, pageIndex, elementIndex));
        break;
    }

    // Validações comuns
    issues.push(...validateElementPosition(element, pageIndex, elementIndex, page.size || 'A4'));
    issues.push(...validateSpacing(element, pageIndex, elementIndex));
  });

  return issues;
}

/**
 * Valida catálogo completo
 */
export function validateCatalogIntelligent(catalog: any): ValidationReport {
  const issues: ValidationIssue[] = [];

  // Validar schema
  if (!catalog.schemaVersion) {
    issues.push({
      id: 'catalog-no-schema',
      severity: 'critical',
      title: 'Formato de arquivo inválido',
      message: 'O arquivo não segue o formato esperado pelo Catana.',
      suggestion: 'Verifique se o arquivo foi exportado corretamente ou use um exemplo válido.',
      autoFixable: false,
      technicalDetails: 'Missing schemaVersion property'
    });
  }

  // Validar metadados
  if (!catalog.catalog || !catalog.catalog.name) {
    issues.push({
      id: 'catalog-no-metadata',
      severity: 'critical',
      title: 'Informações do catálogo ausentes',
      message: 'O catálogo não possui nome ou metadados básicos.',
      suggestion: 'Adicione um nome ao catálogo em catalog.name.',
      autoFixable: false,
      technicalDetails: 'Missing catalog.name'
    });
  }

  // Validar páginas
  if (!catalog.pages || !Array.isArray(catalog.pages) || catalog.pages.length === 0) {
    issues.push({
      id: 'catalog-no-pages',
      severity: 'critical',
      title: 'Catálogo sem páginas',
      message: 'O catálogo não possui páginas definidas.',
      suggestion: 'Adicione pelo menos uma página com elementos ao catálogo.',
      autoFixable: false,
      technicalDetails: 'Catalog has no pages array'
    });
  } else {
    // Validar cada página
    catalog.pages.forEach((page: any, pageIndex: number) => {
      issues.push(...validatePage(page, pageIndex));
    });
  }

  // Calcular estatísticas
  const stats = {
    critical: issues.filter(i => i.severity === 'critical').length,
    warnings: issues.filter(i => i.severity === 'warning').length,
    info: issues.filter(i => i.severity === 'info').length,
    autoFixable: issues.filter(i => i.autoFixable).length
  };

  return {
    valid: stats.critical === 0 && stats.warnings === 0,
    canProceed: stats.critical === 0,
    issues,
    stats
  };
}

/**
 * Gera relatório humanizado
 */
export function generateHumanReport(report: ValidationReport): string {
  if (report.valid) {
    return '✅ Seu catálogo está perfeito e pronto para ser importado!';
  }

  let message = '';

  if (!report.canProceed) {
    message += '⛔ Não é possível importar este catálogo.\n\n';
    message += `Encontramos ${report.stats.critical} problema(s) crítico(s) que precisa(m) ser corrigido(s):\n\n`;

    report.issues
      .filter(i => i.severity === 'critical')
      .slice(0, 3) // Mostrar apenas os 3 primeiros
      .forEach(issue => {
        message += `• ${issue.title}\n  ${issue.message}\n  💡 ${issue.suggestion}\n\n`;
      });

    if (report.stats.critical > 3) {
      message += `... e mais ${report.stats.critical - 3} problema(s).\n`;
    }
  } else if (report.stats.warnings > 0) {
    message += '⚠️ Seu catálogo pode ser importado, mas detectamos algumas inconsistências.\n\n';
    message += `${report.stats.warnings} aviso(s) encontrado(s):\n\n`;

    report.issues
      .filter(i => i.severity === 'warning')
      .slice(0, 3)
      .forEach(issue => {
        message += `• ${issue.title}\n  ${issue.message}\n\n`;
      });

    if (report.stats.autoFixable > 0) {
      message += `\n💡 ${report.stats.autoFixable} problema(s) pode(m) ser corrigido(s) automaticamente.`;
    }
  }

  return message;
}

// ============================================
// CORREÇÕES AUTOMÁTICAS
// ============================================

export interface AutoFixResult {
  fixed: number;
  catalog: any;
  changes: string[];
}

/**
 * Aplica correções automáticas
 */
export function applyAutoFixes(catalog: any, issues: ValidationIssue[]): AutoFixResult {
  const fixableCatalog = JSON.parse(JSON.stringify(catalog)); // Deep clone
  const changes: string[] = [];
  let fixed = 0;

  issues.filter(i => i.autoFixable).forEach(issue => {
    const loc = issue.location;
    if (!loc) return;

    try {
      if (loc.page !== undefined && loc.element !== undefined) {
        const page = fixableCatalog.pages[loc.page];
        if (!page) return;

        const element = page.elements[loc.element];
        if (!element) return;

        // Correções específicas
        if (issue.id.includes('spacing-')) {
          // Normalizar espaçamento
          const field = loc.field?.replace('spacing.', '');
          if (field && element.spacing && typeof element.spacing[field] === 'number') {
            const oldValue = element.spacing[field];
            element.spacing[field] = normalizeSpacing(oldValue);
            changes.push(`Espaçamento ajustado de ${oldValue}px para ${element.spacing[field]}px`);
            fixed++;
          }
        } else if (issue.id.includes('text-font')) {
          // Corrigir fonte
          if (element.style) {
            element.style.fontFamily = 'Inter';
            changes.push('Fonte alterada para "Inter" (padrão)');
            fixed++;
          }
        } else if (issue.id.includes('pos-missing')) {
          // Adicionar posição padrão
          element.position = { x: 64, y: 64 };
          changes.push('Posição padrão adicionada');
          fixed++;
        } else if (issue.id.includes('pos-outside')) {
          // Ajustar posição para dentro das margens
          const margins = PAGE_PRESETS['A4'].margin;
          if (element.position.x < margins.left) {
            element.position.x = margins.left;
            changes.push('Posição ajustada para dentro da margem esquerda');
            fixed++;
          }
          if (element.position.y < margins.top) {
            element.position.y = margins.top;
            changes.push('Posição ajustada para dentro da margem superior');
            fixed++;
          }
        } else if (issue.id.includes('page-no-id')) {
          // Adicionar ID lógico
          page.logicalId = `page-${loc.page}-${Date.now()}`;
          changes.push(`ID lógico adicionado à página ${loc.page + 1}`);
          fixed++;
        }
      }
    } catch (error) {
      console.error(`Erro ao aplicar correção para ${issue.id}:`, error);
    }
  });

  return {
    fixed,
    catalog: fixableCatalog,
    changes
  };
}
