/**
 * 🤖 Catana Catalog Generator Service
 *
 * Gera catálogos JSON válidos seguindo a especificação AI_CATALOG_JSON_SPEC.md
 * Otimizado para geração por IA (Claude, GPT, etc.)
 */

import { genId } from '../utils/id';
import type { CatalogExportSchema, ExportPage, ExportElement } from '../types/catalogIO';

/**
 * Gera um ID lógico único
 */
let elementCounter = 0;
let pageCounter = 0;

export function generateLogicalId(prefix: 'element' | 'page' | 'group' = 'element'): string {
  if (prefix === 'element') {
    return `element-${++elementCounter}`;
  }
  if (prefix === 'page') {
    return `page-${++pageCounter}`;
  }
  return genId('group');
}

/**
 * Reseta os contadores (útil para testes)
 */
export function resetCounters(): void {
  elementCounter = 0;
  pageCounter = 0;
}

/**
 * Cria a estrutura base de um catálogo
 */
export function createBaseCatalog(name: string, description?: string): CatalogExportSchema {
  resetCounters();

  return {
    schemaVersion: '1.0',
    exportedAt: new Date().toISOString(),
    app: 'Catana',
    catalog: {
      name,
      description: description || `Catálogo ${name}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    settings: {
      gridSize: 8,
      snapToGrid: true,
      defaultZoom: 75,
    },
    pages: [],
  };
}

/**
 * Cria uma nova página
 */
export function createPage(
  name: string,
  order: number,
  options?: {
    description?: string;
    header?: boolean;
    footer?: boolean;
  }
): ExportPage {
  const page: ExportPage = {
    logicalId: generateLogicalId('page'),
    name,
    order,
    elements: [],
  };

  if (options?.description) {
    // @ts-ignore - adiciona description como metadado
    page.description = options.description;
  }

  if (options?.header) {
    page.header = {
      enabled: true,
      height: 50,
      backgroundColor: '#F3F4F6',
      borderColor: '#E5E7EB',
      borderWidth: 1,
      padding: 8,
      fields: [
        {
          id: crypto.randomUUID(),
          type: 'catalog-name',
          prefix: '',
          suffix: '',
        },
        {
          id: crypto.randomUUID(),
          type: 'page-of-total',
          prefix: 'Página ',
          suffix: '',
        },
      ],
      alignment: 'space-between',
      fontSize: 12,
      fontFamily: 'Arial',
      textColor: '#374151',
    };
  }

  if (options?.footer) {
    page.footer = {
      enabled: true,
      height: 40,
      backgroundColor: '#F9FAFB',
      borderColor: '#E5E7EB',
      borderWidth: 1,
      padding: 8,
      fields: [],
      alignment: 'center',
      fontSize: 10,
      fontFamily: 'Arial',
      textColor: '#6B7280',
    };
  }

  return page;
}

/**
 * 📝 ELEMENTOS - Geradores
 */

/**
 * Cria um elemento de texto (título, parágrafo, subtítulo)
 */
export function createText(
  content: string,
  position: { x: number; y: number },
  options?: {
    type?: 'text-title' | 'text-paragraph' | 'text-subtitle';
    name?: string;
    description?: string;
    fontSize?: number;
    fontFamily?: string;
    fontWeight?: 'normal' | 'bold' | '300' | '400' | '500' | '600' | '700' | '800' | '900';
    textAlign?: 'left' | 'center' | 'right' | 'justify';
    textColor?: string;
    width?: number;
    height?: number;
  }
): ExportElement {
  const type = options?.type || 'text-title';
  const fontSize = options?.fontSize || (type === 'text-title' ? 48 : type === 'text-subtitle' ? 24 : 16);

  return {
    logicalId: generateLogicalId(),
    type,
    name: options?.name || `Texto ${content.substring(0, 20)}`,
    ...(options?.description && { description: options.description }),
    position: { x: position.x, y: position.y },
    size: { width: options?.width || 600, height: options?.height || 80 },
    zIndex: 10,
    visible: true,
    locked: false,
    textData: {
      content,
      fontSize,
      fontFamily: options?.fontFamily || 'Arial',
      fontWeight: options?.fontWeight || 'bold',
      textAlign: options?.textAlign || 'left',
      textColor: options?.textColor || '#000000',
    },
  };
}

/**
 * Cria uma linha
 */
export function createLine(
  start: { x: number; y: number },
  end: { x: number; y: number },
  position: { x: number; y: number },
  options?: {
    name?: string;
    description?: string;
    strokeColor?: string;
    strokeWidth?: number;
    style?: 'solid' | 'dashed' | 'dotted';
    cap?: 'butt' | 'round' | 'square';
    startArrow?: 'none' | 'arrow';
    endArrow?: 'none' | 'arrow';
  }
): ExportElement {
  const width = Math.abs(end.x - start.x);
  const height = Math.abs(end.y - start.y);

  return {
    logicalId: generateLogicalId(),
    type: 'line',
    name: options?.name || 'Linha',
    ...(options?.description && { description: options.description }),
    position: { x: position.x, y: position.y },
    size: { width: Math.max(width, 100), height: Math.max(height, 100) },
    zIndex: 5,
    visible: true,
    locked: false,
    lineData: {
      start: { x: start.x, y: start.y },
      end: { x: end.x, y: end.y },
      strokeColor: options?.strokeColor || '#000000',
      strokeWidth: options?.strokeWidth || 2,
      opacity: 1,
      style: options?.style || 'solid',
      cap: options?.cap || 'round',
      startArrow: options?.startArrow || 'none',
      endArrow: options?.endArrow || 'none',
    },
  };
}

/**
 * Cria um retângulo
 */
export function createRectangle(
  position: { x: number; y: number },
  size: { width: number; height: number },
  options?: {
    name?: string;
    description?: string;
    backgroundColor?: string;
    borderColor?: string;
    borderWidth?: number;
    borderRadius?: number;
    opacity?: number;
  }
): ExportElement {
  return {
    logicalId: generateLogicalId(),
    type: 'shape-rectangle',
    name: options?.name || 'Retângulo',
    ...(options?.description && { description: options.description }),
    position: { x: position.x, y: position.y },
    size: { width: size.width, height: size.height },
    zIndex: 5,
    visible: true,
    locked: false,
    style: {
      backgroundColor: options?.backgroundColor || '#FFFFFF',
      borderColor: options?.borderColor || '#E0E0E0',
      borderWidth: options?.borderWidth ?? 1,
      borderRadius: options?.borderRadius ?? 0,
      opacity: options?.opacity ?? 1,
    },
  };
}

/**
 * Cria um círculo
 */
export function createCircle(
  position: { x: number; y: number },
  diameter: number,
  options?: {
    name?: string;
    description?: string;
    backgroundColor?: string;
    borderColor?: string;
    borderWidth?: number;
    opacity?: number;
  }
): ExportElement {
  return {
    logicalId: generateLogicalId(),
    type: 'shape-circle',
    name: options?.name || 'Círculo',
    ...(options?.description && { description: options.description }),
    position: { x: position.x, y: position.y },
    size: { width: diameter, height: diameter },
    zIndex: 5,
    visible: true,
    locked: false,
    style: {
      backgroundColor: options?.backgroundColor || '#FF6B00',
      borderColor: options?.borderColor || '#FFFFFF',
      borderWidth: options?.borderWidth ?? 0,
      opacity: options?.opacity ?? 1,
    },
  };
}

/**
 * Cria uma imagem
 */
export function createImage(
  url: string,
  position: { x: number; y: number },
  size: { width: number; height: number },
  options?: {
    name?: string;
    description?: string;
    alt?: string;
    fit?: 'cover' | 'contain' | 'fill';
  }
): ExportElement {
  return {
    logicalId: generateLogicalId(),
    type: 'uploaded-image',
    name: options?.name || 'Imagem',
    ...(options?.description && { description: options.description }),
    position: { x: position.x, y: position.y },
    size: { width: size.width, height: size.height },
    zIndex: 10,
    visible: true,
    locked: false,
    imageData: {
      url,
      alt: options?.alt || 'Imagem',
      fit: options?.fit || 'contain',
    },
  };
}

/**
 * Cria um card de produto
 */
export function createProductCard(
  product: {
    name: string;
    code: string;
    description?: string;
    image?: string;
    price?: number;
    currency?: string;
  },
  position: { x: number; y: number },
  options?: {
    name?: string;
    description?: string;
    width?: number;
    height?: number;
    isNew?: boolean;
  }
): ExportElement {
  return {
    logicalId: generateLogicalId(),
    type: 'product-card',
    name: options?.name || `Produto ${product.code}`,
    ...(options?.description && { description: options.description }),
    position: { x: position.x, y: position.y },
    size: { width: options?.width || 280, height: options?.height || 380 },
    zIndex: 10,
    visible: true,
    locked: false,
    productData: {
      name: product.name,
      code: product.code,
      description: product.description || '',
      image: product.image || 'https://via.placeholder.com/300',
      price: product.price || 0,
      currency: product.currency || 'BRL',
      isNew: options?.isNew || false,
    },
  };
}

/**
 * Cria um QR Code
 */
export function createQRCode(
  data: string,
  position: { x: number; y: number },
  options?: {
    name?: string;
    description?: string;
    size?: number;
    color?: string;
    backgroundColor?: string;
  }
): ExportElement {
  const size = options?.size || 150;

  return {
    logicalId: generateLogicalId(),
    type: 'qr-code',
    name: options?.name || 'QR Code',
    ...(options?.description && { description: options.description }),
    position: { x: position.x, y: position.y },
    size: { width: size, height: size },
    zIndex: 10,
    visible: true,
    locked: false,
    qrCodeData: {
      data,
      color: options?.color || '#000000',
      backgroundColor: options?.backgroundColor || '#FFFFFF',
      errorCorrection: 'M',
    },
  };
}

/**
 * 🎨 TEMPLATES PRONTOS
 */

/**
 * Template: Capa simples
 */
export function createCoverPage(title: string, subtitle?: string): ExportPage {
  const page = createPage('Capa', 0, { description: 'Página de capa do catálogo' });

  // Título principal
  page.elements.push(
    createText(title, { x: 100, y: 300 }, {
      name: 'Título Principal',
      fontSize: 56,
      fontWeight: 'bold',
      textAlign: 'center',
      width: 600,
      height: 120,
    })
  );

  // Linha decorativa
  page.elements.push(
    createLine(
      { x: 0, y: 0 },
      { x: 500, y: 0 },
      { x: 150, y: 450 },
      {
        name: 'Linha Decorativa',
        strokeColor: '#FF6B00',
        strokeWidth: 4,
      }
    )
  );

  // Subtítulo (se fornecido)
  if (subtitle) {
    page.elements.push(
      createText(subtitle, { x: 100, y: 500 }, {
        type: 'text-subtitle',
        name: 'Subtítulo',
        fontSize: 24,
        fontWeight: 'normal',
        textAlign: 'center',
        textColor: '#666666',
        width: 600,
        height: 60,
      })
    );
  }

  // Fundo decorativo
  page.elements.push(
    createRectangle(
      { x: 50, y: 700 },
      { width: 700, height: 200 },
      {
        name: 'Fundo Decorativo',
        backgroundColor: '#FF6B00',
        borderColor: 'transparent',
        borderWidth: 0,
        borderRadius: 12,
        opacity: 0.1,
      }
    )
  );

  return page;
}

/**
 * Template: Página de produtos
 */
export function createProductPage(
  title: string,
  products: Array<{
    name: string;
    code: string;
    description?: string;
    image?: string;
    price?: number;
  }>,
  pageNumber: number
): ExportPage {
  const page = createPage(`Produtos - ${title}`, pageNumber, {
    description: `Página de produtos: ${title}`,
    header: true,
    footer: true,
  });

  // Título da seção
  page.elements.push(
    createText(title, { x: 100, y: 80 }, {
      name: 'Título da Seção',
      fontSize: 32,
      fontWeight: 'bold',
      textColor: '#FF6B00',
      width: 600,
      height: 60,
    })
  );

  // Criar grid de produtos (3 por linha)
  const cols = 3;
  const cardWidth = 240;
  const cardHeight = 340;
  const gap = 20;
  const startX = 60;
  const startY = 180;

  products.forEach((product, index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;

    const x = startX + col * (cardWidth + gap);
    const y = startY + row * (cardHeight + gap);

    page.elements.push(
      createProductCard(product, { x, y }, {
        name: `Produto ${product.code}`,
        width: cardWidth,
        height: cardHeight,
      })
    );
  });

  return page;
}

/**
 * Exemplo completo de catálogo
 */
export function generateSampleCatalog(): CatalogExportSchema {
  const catalog = createBaseCatalog(
    'Catálogo DiPACK 2025',
    'Catálogo completo de embalagens descartáveis'
  );

  // Página 1: Capa
  catalog.pages.push(
    createCoverPage('CATÁLOGO DiPACK 2025', 'Embalagens de Qualidade')
  );

  // Página 2: Produtos - Confeitaria
  catalog.pages.push(
    createProductPage(
      'Linha Confeitaria',
      [
        {
          name: 'Embalagem para Bolo G',
          code: 'REF-001',
          description: 'Embalagem transparente com tampa',
          price: 2.50,
        },
        {
          name: 'Caixa para Doces M',
          code: 'REF-002',
          description: 'Caixa com visor cristal',
          price: 1.80,
        },
        {
          name: 'Forma para Cupcake',
          code: 'REF-003',
          description: 'Forma individual descartável',
          price: 0.50,
        },
      ],
      1
    )
  );

  return catalog;
}
