/**
 * 🔄 Catalog Loader Service
 *
 * Carrega catálogos importados do backend e converte para o formato do EditorStore
 * Aplica automaticamente as regras de layout profissional
 */

import { logger } from '../utils/logger';
import { genId } from '../utils/id';
import api from './api';
import { catalogService } from './catalogService';
import { processPage, validateCatalog, generateValidationReport } from './layoutEngine.service';

// Base da API para prefixar URLs de mídia relativas (ex.: catálogos demo gravam
// "/media/..."; o browser precisa da URL absoluta do backend).
const API_BASE_URL = (import.meta.env && import.meta.env.VITE_API_BASE_URL) || 'http://localhost:8000';
function absMedia(url?: string): string | undefined {
  if (!url) return url;
  if (/^https?:\/\//.test(url) || url.startsWith('data:') || url.startsWith('blob:')) return url;
  if (url.startsWith('/')) return `${API_BASE_URL}${url}`;
  return url;
}
import type { CatalogElement, CatalogPage } from '../types/editor';
import type { DesignTokens } from '../types/designTokens';

interface BackendPage {
  id: number;
  catalog: number;
  order: number;
  background_image: number | null;
  created_at: string;
  components?: BackendPageComponent[];
}

interface BackendPageComponent {
  id: number;
  page: number;
  component: BackendComponent;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  layer: number;
}

interface BackendComponent {
  id: number;
  name: string;
  component_type: 'text' | 'image' | 'product';
  content: any; // JSON completo do elemento original
  is_reusable: boolean;
  created_at: string;
}

interface LoadedCatalog {
  catalogName: string;
  pages: CatalogPage[];
  designTokens?: DesignTokens;
  settings?: {
    gridSize?: number;
    snapToGrid?: boolean;
    defaultZoom?: number;
  };
}

/**
 * Carrega um catálogo importado do backend e converte para formato do editor
 */
export async function loadImportedCatalog(catalogId: number): Promise<LoadedCatalog> {
  try {
    // 1. Buscar metadados do catálogo
    const catalog = await catalogService.getCatalog(catalogId);

    // 2. Buscar páginas do catálogo
    const backendPages: BackendPage[] = (
      await api.get(`/api/pages/?catalog=${catalogId}`)
    ).data;

    // 3. Para cada página, buscar seus componentes
    const pagesWithComponents = await Promise.all(
      backendPages.map(async (page) => {
        let pageComponents: BackendPageComponent[];
        try {
          pageComponents = (await api.get(`/api/page-components/?page=${page.id}`)).data;
        } catch {
          console.warn(`Failed to load components for page ${page.id}`);
          return { ...page, components: [] };
        }

        // Buscar dados completos dos componentes
        const componentsWithData = await Promise.all(
          pageComponents.map(async (pc: any) => {
            const component = (await api.get(`/api/components/${pc.component}/`)).data;
            return {
              ...pc,
              component
            };
          })
        );

        return {
          ...page,
          components: componentsWithData
        };
      })
    );

    // 4. Buscar Design Tokens do theme (se existir)
    let designTokens: DesignTokens | undefined;
    if (catalog.theme) {
      try {
        const theme = (await api.get(`/api/themes/${catalog.theme}/`)).data;
        designTokens = theme.styles?.designTokens;
      } catch {
        // Tema opcional: segue sem design tokens se a requisição falhar.
      }
    }

    // 5. Converter para formato do EditorStore
    const editorPages: CatalogPage[] = pagesWithComponents
      .sort((a, b) => a.order - b.order)
      .map((backendPage, index) => {
        const pageId = genId('page');

        // Converter componentes para elementos do editor
        const elements: CatalogElement[] = (backendPage.components || [])
          .sort((a, b) => a.layer - b.layer)
          .map((pc) => {
            const elementId = genId('element');
            const originalElement = pc.component.content;

            // Criar elemento do editor mesclando dados originais com posicionamento
            const element: CatalogElement = {
              id: elementId,
              type: originalElement.type || 'text',
              name: originalElement.name || pc.component.name,
              pageId: pageId,

              // Geometria do PageComponent
              position: {
                x: pc.position_x,
                y: pc.position_y
              },
              size: {
                width: pc.width,
                height: pc.height
              },
              zIndex: pc.layer,
              rotation: originalElement.rotation || originalElement.transform?.rotation || 0,

              // Visibilidade
              visible: originalElement.visible ?? originalElement.visibility?.visible ?? true,
              locked: originalElement.locked ?? originalElement.visibility?.locked ?? false,

              // Estilos do elemento original
              style: originalElement.style || {},
              className: originalElement.className,

              // Conteúdo específico por tipo
              content: originalElement.content,
              textData: originalElement.textData,
              // imageUrl (fallback do PDF/preview) e imageData.src (canvas) com URL absoluta
              imageUrl: absMedia(originalElement.imageUrl),
              imageData: originalElement.imageData
                ? { ...originalElement.imageData, src: absMedia(originalElement.imageData.src) }
                : originalElement.imageData,
              lineData: originalElement.lineData,
              productData: originalElement.productData,
              qrCodeData: originalElement.qrCodeData,

              // Grouping (se existir)
              groupId: originalElement.groupId,
              isGroup: originalElement.isGroup,
              children: originalElement.children
            };

            return element;
          });

        return {
          id: pageId,
          name: `Página ${index + 1}`,
          order: index,
          elements,
          header: undefined,
          footer: undefined
        };
      });

    return {
      catalogName: catalog.title || 'Catálogo Importado',
      pages: editorPages,
      designTokens,
      settings: {
        gridSize: 8,
        snapToGrid: true,
        defaultZoom: 75
      }
    };

  } catch (error) {
    console.error('[CatalogLoader] Error loading catalog:', error);
    throw new Error(`Failed to load catalog: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Verifica se um catálogo foi importado (tem elementos salvos no backend)
 */
export async function isImportedCatalog(catalogId: number): Promise<boolean> {
  try {
    const pages = (await api.get(`/api/pages/?catalog=${catalogId}`)).data;
    return pages.length > 0;
  } catch {
    return false;
  }
}

/**
 * Processa um catálogo JSON aplicando regras de layout profissional
 *
 * Esta função é usada quando importamos um JSON bruto e queremos aplicar
 * automaticamente todas as regras de posicionamento, espaçamento e tipografia.
 *
 * @param catalogJson - Catálogo em formato JSON
 * @returns Catálogo processado com regras aplicadas
 */
export function processCatalogWithLayoutRules(catalogJson: any): {
  catalog: any;
  validation: ReturnType<typeof validateCatalog>;
  report: string;
} {
  logger.debug('[CatalogLoader] Aplicando regras de layout ao catálogo importado...');

  // 1. Validar catálogo antes de processar
  const validation = validateCatalog(catalogJson);
  const report = generateValidationReport(catalogJson);

  logger.debug('[CatalogLoader] Relatório de validação:\n', report);

  // 2. Processar cada página aplicando as regras
  const processedPages = catalogJson.pages.map((page: any, pageIndex: number) => {
    logger.debug(`[CatalogLoader] Processando página ${pageIndex + 1}/${catalogJson.pages.length}...`);

    // Determinar tamanho da página (A4 por padrão)
    const pageSize = page.size || 'A4';

    // Processar elementos da página
    const { elements, validations, context } = processPage(page.elements || [], pageSize);

    // Log de avisos
    validations.forEach((v, elemIndex) => {
      if (v.warnings.length > 0) {
        console.warn(
          `[CatalogLoader] Página ${pageIndex + 1}, Elemento ${elemIndex + 1}:`,
          v.warnings.map(w => w.message).join('; ')
        );
      }
    });

    return {
      ...page,
      elements,
      // Preservar metadados da página
      size: pageSize,
      width: context.page.width,
      height: context.page.height,
      margin: context.page.margin
    };
  });

  const processedCatalog = {
    ...catalogJson,
    pages: processedPages,
    // Adicionar metadados de processamento
    _processing: {
      appliedRules: true,
      processedAt: new Date().toISOString(),
      version: '1.0'
    }
  };

  logger.debug('[CatalogLoader] ✅ Catálogo processado com sucesso!');

  return {
    catalog: processedCatalog,
    validation,
    report
  };
}

/**
 * Carrega e processa um catálogo JSON de um arquivo
 *
 * @param file - Arquivo JSON do catálogo
 * @returns Catálogo processado pronto para importação
 */
export async function loadAndProcessCatalogFile(file: File): Promise<{
  catalog: any;
  validation: ReturnType<typeof validateCatalog>;
  report: string;
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const catalogJson = JSON.parse(text);

        // Processar com regras de layout
        const result = processCatalogWithLayoutRules(catalogJson);

        resolve(result);
      } catch (error) {
        reject(new Error(`Erro ao processar catálogo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`));
      }
    };

    reader.onerror = () => {
      reject(new Error('Erro ao ler arquivo'));
    };

    reader.readAsText(file);
  });
}
