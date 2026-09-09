import type { DynamicField, DynamicFieldType } from '../types/editor';

interface DynamicFieldContext {
  currentPage: number;
  totalPages: number;
  catalogName: string;
  lineName?: string;
  version?: string;
}

/**
 * Processa um campo dinâmico e retorna o valor formatado
 */
export function processDynamicField(
  field: DynamicField,
  context: DynamicFieldContext
): string {
  let value = '';

  switch (field.type) {
    case 'page-number':
      value = context.currentPage.toString();
      break;

    case 'total-pages':
      value = context.totalPages.toString();
      break;

    case 'page-of-total':
      value = `${context.currentPage} de ${context.totalPages}`;
      break;

    case 'catalog-name':
      value = context.catalogName || 'Catálogo';
      break;

    case 'line-name':
      value = context.lineName || '';
      break;

    case 'version':
      value = context.version || '1.0';
      break;

    case 'date':
      value = formatDate(field.format);
      break;

    case 'custom-text':
      value = field.value || '';
      break;

    default:
      value = '';
  }

  // Adiciona prefixo e sufixo
  const prefix = field.prefix || '';
  const suffix = field.suffix || '';

  return `${prefix}${value}${suffix}`;
}

/**
 * Formata a data atual de acordo com o formato especificado
 */
function formatDate(format?: string): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');

  if (!format) {
    format = 'DD/MM/YYYY';
  }

  return format
    .replace('DD', day)
    .replace('MM', month)
    .replace('YYYY', year.toString())
    .replace('YY', year.toString().slice(-2))
    .replace('HH', hours)
    .replace('mm', minutes);
}

/**
 * Processa todos os campos de um header/footer e retorna array de strings
 */
export function processAllFields(
  fields: DynamicField[],
  context: DynamicFieldContext
): string[] {
  return fields.map(field => processDynamicField(field, context));
}

/**
 * Retorna label amigável para cada tipo de campo dinâmico
 */
export function getFieldTypeLabel(type: DynamicFieldType): string {
  const labels: Record<DynamicFieldType, string> = {
    'page-number': 'Número da Página',
    'total-pages': 'Total de Páginas',
    'page-of-total': 'Página X de Y',
    'catalog-name': 'Nome do Catálogo',
    'line-name': 'Nome da Linha',
    'version': 'Versão',
    'date': 'Data',
    'custom-text': 'Texto Personalizado',
  };

  return labels[type] || type;
}

/**
 * Retorna exemplo de como o campo será exibido
 */
export function getFieldExample(type: DynamicFieldType, value?: string): string {
  const examples: Record<DynamicFieldType, string> = {
    'page-number': '1',
    'total-pages': '10',
    'page-of-total': '1 de 10',
    'catalog-name': 'Catálogo DiPACK',
    'line-name': 'Linha Premium',
    'version': '1.0',
    'date': '18/10/2025',
    'custom-text': value || 'Seu texto aqui',
  };

  return examples[type] || '';
}
