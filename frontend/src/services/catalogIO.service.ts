/**
 * 📦 Catana Catalog Import/Export Service
 *
 * Serviço centralizado para exportar e importar catálogos em JSON
 */

import { genId } from '../utils/id';
import type { CatalogPage, CatalogElement } from '../types/editor';
import type {
  CatalogExportSchema,
  ExportPage,
  ExportElement,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  ImportPreview,
  ImportOptions,
} from '../types/catalogIO';

/**
 * 📤 EXPORTAÇÃO
 */

/**
 * Exporta um catálogo para JSON
 *
 * @param pages - Páginas do catálogo
 * @param catalogName - Nome do catálogo
 * @param options - Opções adicionais (organização, sede, etc.)
 * @returns Schema JSON do catálogo
 */
export function exportCatalog(
  pages: CatalogPage[],
  catalogName: string,
  options?: {
    description?: string;
    organization?: string;
    sede?: string;
    gridSize?: number;
    snapToGrid?: boolean;
    defaultZoom?: number;
  }
): CatalogExportSchema {
  // Mapear IDs reais para IDs lógicos
  const idMap = new Map<string, string>();
  let logicalIdCounter = 0;

  const getLogicalId = (realId: string): string => {
    if (!idMap.has(realId)) {
      idMap.set(realId, `logical-${logicalIdCounter++}`);
    }
    return idMap.get(realId)!;
  };

  // Converter páginas
  const exportPages: ExportPage[] = pages.map((page) => ({
    logicalId: getLogicalId(page.id),
    name: page.name,
    order: page.order,
    elements: page.elements.map((element) =>
      convertElementToExport(element, getLogicalId)
    ),
    header: page.header,
    footer: page.footer,
  }));

  // Montar schema
  const schema: CatalogExportSchema = {
    schemaVersion: '1.0',
    exportedAt: new Date().toISOString(),
    app: 'Catana',
    catalog: {
      name: catalogName,
      description: options?.description,
      organization: options?.organization,
      sede: options?.sede,
      createdAt: new Date().toISOString(),
    },
    settings: {
      gridSize: options?.gridSize ?? 8,
      snapToGrid: options?.snapToGrid ?? true,
      defaultZoom: options?.defaultZoom ?? 75,
    },
    pages: exportPages,
  };

  return schema;
}

/**
 * Converte elemento real para formato de exportação
 */
function convertElementToExport(
  element: CatalogElement,
  getLogicalId: (id: string) => string
): ExportElement {
  const exportElement: ExportElement = {
    logicalId: getLogicalId(element.id),
    type: element.type,
    name: element.name,
    position: { ...element.position },
    size: { ...element.size },
    zIndex: element.zIndex,
    visible: element.visible,
    locked: element.locked,
    rotation: element.rotation,
    opacity: element.opacity,
  };

  // Group data
  if (element.isGroup) {
    exportElement.isGroup = true;
    exportElement.children = element.children?.map(getLogicalId);
  }

  if (element.groupId) {
    exportElement.groupId = getLogicalId(element.groupId);
  }

  // Style
  if (element.style) {
    exportElement.style = { ...element.style };
  }
  if (element.className) exportElement.className = element.className;

  // Content específico por tipo
  if (element.content) exportElement.content = JSON.parse(JSON.stringify(element.content));
  if (element.textData) exportElement.textData = { ...element.textData };
  if (element.productData) exportElement.productData = { ...element.productData };
  // imageUrl é o fallback de render do PDF/preview — sem ele, um catálogo
  // reimportado mostra placeholder fora do editor (que usa imageData.src).
  if (element.imageUrl) exportElement.imageUrl = element.imageUrl;
  if (element.imageData) exportElement.imageData = { ...element.imageData };
  if (element.highlightBannerData) exportElement.highlightBannerData = { ...element.highlightBannerData };
  if (element.testimonialData) exportElement.testimonialData = { ...element.testimonialData };
  if (element.qrCodeData) exportElement.qrCodeData = { ...element.qrCodeData };
  if (element.lineData) exportElement.lineData = { ...element.lineData };

  return exportElement;
}

/**
 * Faz download do JSON como arquivo
 *
 * @param schema - Schema do catálogo
 * @param filename - Nome do arquivo (opcional)
 */
export function downloadCatalogJSON(
  schema: CatalogExportSchema,
  filename?: string
): void {
  const catalogName = schema.catalog.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  const finalFilename =
    filename || `catana-catalog-${catalogName}-${date}.json`;

  const json = JSON.stringify(schema, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = finalFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 📥 IMPORTAÇÃO
 */

/**
 * Valida schema de importação
 *
 * @param data - Dados JSON parseados
 * @returns Resultado da validação
 */
export function validateCatalogSchema(data: any): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Validações críticas
  if (!data) {
    errors.push({
      type: 'critical',
      field: 'root',
      message: 'Arquivo JSON vazio ou inválido',
    });
    return { valid: false, errors, warnings };
  }

  if (!data.app || data.app !== 'Catana') {
    errors.push({
      type: 'critical',
      field: 'app',
      message: 'Este arquivo não foi gerado pelo Catana',
    });
  }

  if (!data.schemaVersion) {
    errors.push({
      type: 'critical',
      field: 'schemaVersion',
      message: 'Schema version não encontrado',
    });
  } else if (data.schemaVersion !== '1.0') {
    errors.push({
      type: 'error',
      field: 'schemaVersion',
      message: `Schema version "${data.schemaVersion}" incompatível. Suportada: 1.0`,
    });
  }

  if (!data.catalog) {
    errors.push({
      type: 'critical',
      field: 'catalog',
      message: 'Metadados do catálogo não encontrados',
    });
  } else {
    if (!data.catalog.name || data.catalog.name.trim() === '') {
      errors.push({
        type: 'error',
        field: 'catalog.name',
        message: 'Nome do catálogo é obrigatório',
      });
    }
  }

  if (!data.pages || !Array.isArray(data.pages)) {
    errors.push({
      type: 'critical',
      field: 'pages',
      message: 'Estrutura de páginas inválida',
    });
  } else {
    if (data.pages.length === 0) {
      warnings.push({
        type: 'warning',
        field: 'pages',
        message: 'Catálogo não possui páginas',
      });
    }

    // Validar cada página
    data.pages.forEach((page: any, index: number) => {
      if (!page.logicalId) {
        errors.push({
          type: 'error',
          field: `pages[${index}].logicalId`,
          message: 'Página sem ID lógico',
        });
      }

      if (!page.name) {
        warnings.push({
          type: 'warning',
          field: `pages[${index}].name`,
          message: `Página ${index + 1} sem nome`,
        });
      }

      if (!page.elements || !Array.isArray(page.elements)) {
        errors.push({
          type: 'error',
          field: `pages[${index}].elements`,
          message: 'Estrutura de elementos inválida',
        });
      }
    });
  }

  return {
    valid: errors.filter((e) => e.type === 'critical' || e.type === 'error').length === 0,
    errors,
    warnings,
  };
}

/**
 * Gera preview de importação
 *
 * @param schema - Schema do catálogo
 * @returns Preview com informações resumidas
 */
export function generateImportPreview(
  schema: CatalogExportSchema
): ImportPreview {
  const validation = validateCatalogSchema(schema);

  const elementCount = schema.pages.reduce(
    (total, page) => total + page.elements.length,
    0
  );

  return {
    catalogName: schema.catalog.name,
    description: schema.catalog.description,
    pageCount: schema.pages.length,
    elementCount,
    schemaVersion: schema.schemaVersion,
    exportedAt: schema.exportedAt,
    organization: schema.catalog.organization,
    sede: schema.catalog.sede,
    warnings: validation.warnings,
  };
}

/**
 * Importa catálogo a partir do schema
 *
 * @param schema - Schema do catálogo
 * @param options - Opções de importação
 * @returns Estrutura de páginas para o editorStore
 */
export function importCatalog(
  schema: CatalogExportSchema,
  _options?: ImportOptions
): {
  pages: CatalogPage[];
  catalogName: string;
  settings?: {
    gridSize?: number;
    snapToGrid?: boolean;
    defaultZoom?: number;
  };
} {
  // Validar schema primeiro
  const validation = validateCatalogSchema(schema);
  if (!validation.valid) {
    throw new Error(
      `Schema inválido: ${validation.errors.map((e) => e.message).join(', ')}`
    );
  }

  // Mapear IDs lógicos para IDs reais
  const idMap = new Map<string, string>();

  const getRealId = (logicalId: string, prefix: string = 'element'): string => {
    if (!idMap.has(logicalId)) {
      const newId = genId(prefix);
      idMap.set(logicalId, newId);
    }
    return idMap.get(logicalId)!;
  };

  // Converter páginas
  const pages: CatalogPage[] = schema.pages.map((exportPage, index) => {
    const pageId = getRealId(exportPage.logicalId, 'page');

    return {
      id: pageId,
      name: exportPage.name || `Página ${index + 1}`,
      order: exportPage.order ?? index,
      elements: exportPage.elements.map((element) =>
        convertElementFromExport(element, getRealId, pageId)
      ),
      header: exportPage.header,
      footer: exportPage.footer,
    };
  });

  return {
    pages,
    catalogName: schema.catalog.name,
    settings: schema.settings,
  };
}

/**
 * Converte elemento de exportação para formato real
 */
function convertElementFromExport(
  exportElement: ExportElement,
  getRealId: (logicalId: string, prefix?: string) => string,
  pageId: string
): CatalogElement {
  const element: CatalogElement = {
    id: getRealId(exportElement.logicalId),
    type: exportElement.type,
    name: exportElement.name,
    position: { ...exportElement.position },
    size: { ...exportElement.size },
    pageId,
    style: exportElement.style || {},
    zIndex: exportElement.zIndex ?? 0,
    visible: exportElement.visible ?? true,
    locked: exportElement.locked ?? false,
    rotation: exportElement.rotation,
    opacity: exportElement.opacity,
  };

  // Group data
  if (exportElement.isGroup) {
    element.isGroup = true;
    element.children = exportElement.children?.map((logicalId) =>
      getRealId(logicalId)
    );
  }

  if (exportElement.groupId) {
    element.groupId = getRealId(exportElement.groupId);
  }

  // Style
  if (exportElement.style) {
    element.style = { ...exportElement.style };
  }
  if (exportElement.className) element.className = exportElement.className;

  // Content específico por tipo
  if (exportElement.content) element.content = JSON.parse(JSON.stringify(exportElement.content));
  if (exportElement.textData) element.textData = { ...exportElement.textData };
  if (exportElement.productData) element.productData = { ...exportElement.productData };
  if (exportElement.imageUrl) element.imageUrl = exportElement.imageUrl;
  if (exportElement.imageData) element.imageData = { ...exportElement.imageData };
  if (exportElement.highlightBannerData) element.highlightBannerData = { ...exportElement.highlightBannerData };
  if (exportElement.testimonialData) element.testimonialData = { ...exportElement.testimonialData };
  if (exportElement.qrCodeData) element.qrCodeData = { ...exportElement.qrCodeData };
  if (exportElement.lineData) element.lineData = { ...exportElement.lineData };

  return element;
}

/**
 * Lê arquivo JSON e retorna schema parseado
 *
 * @param file - Arquivo JSON
 * @returns Promise com schema parseado
 */
export async function readCatalogFile(
  file: File
): Promise<CatalogExportSchema> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const data = JSON.parse(text);
        resolve(data);
      } catch (error) {
        reject(new Error('Arquivo JSON inválido'));
      }
    };

    reader.onerror = () => {
      reject(new Error('Erro ao ler arquivo'));
    };

    reader.readAsText(file);
  });
}
