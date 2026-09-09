import type { ElementType } from '../types/editor';

/**
 * Retorna os dados padrão para cada tipo de elemento
 */
export function getDefaultElementData(type: ElementType) {
  switch (type) {
    case 'product-card':
      return {
        productData: {
          name: 'Produto Exemplo',
          image: 'https://via.placeholder.com/300',
          price: 99.90,
          currency: 'BRL',
          description: 'Descrição do produto',
        },
      };
    case 'highlight-banner':
      return {
        highlightBannerData: {
          title: 'Título do Banner',
          subtitle: 'Subtítulo',
          variant: 'primary' as const,
        },
      };
    case 'testimonial':
      return {
        testimonialData: {
          quote: 'Excelente produto!',
          author: 'Cliente Satisfeito',
          rating: 5,
        },
      };
    case 'qr-code':
      return {
        qrCodeData: {
          destinationType: 'url' as const,
          data: '',
          customUrl: '',
          color: '#000000',
          backgroundColor: '#FFFFFF',
          errorCorrection: 'M' as const,
          margin: 4,
          quality: 'medium' as const,
          trackScans: false,
        },
      };
    case 'dipack-showcase':
      return {
        content: {
          lineTitle: 'Linha Exibição',
          productCount: 24,
          products: Array.from({ length: 24 }, (_, i) => ({
            id: i + 1,
            code: `REF-${String(i + 1).padStart(4, '0')}`,
            description: 'Descrição do produto',
            internalDimensions: '00 x 00 x 00 cm',
            externalDimensions: '00 x 00 x 00 cm',
            unitsPerBox: '00 unidades',
            isNew: true,
          })),
        },
      };
    case 'dipack-footer':
      return {
        content: {
          pageNumber: 1,
        },
      };
    case 'dipack-back-cover':
      return {
        content: {
          qrCodeUrl: 'https://lucaskepler.live/',
        },
      };
    case 'dipack-confeitaria':
      return {
        content: {
          pageNumber: 1,
          productsRange: 'page1',
        },
      };
    case 'dipack-confeitaria-intro':
      return {
        content: {},
      };
    case 'dipack-acougue':
      return {
        content: {
          pageNumber: 1,
          productsRange: 'page1',
        },
      };
    case 'dipack-acougue-intro':
      return {
        content: {},
      };
    case 'dipack-festa':
      return {
        content: {
          pageNumber: 1,
        },
      };
    case 'dipack-festa-intro':
      return {
        content: {},
      };
    case 'dipack-food-service':
      return {
        content: {
          pageNumber: 1,
        },
      };
    case 'dipack-food-service-intro':
      return {
        content: {},
      };
    case 'line':
      return {
        lineData: {
          start: { x: 20, y: 20 },
          end: { x: 180, y: 80 },
          strokeColor: '#000000',
          strokeWidth: 2,
          opacity: 1,
          style: 'solid' as const,
          cap: 'round' as const,
          startArrow: 'none' as const,
          endArrow: 'none' as const,
        },
      };
    default:
      return {};
  }
}

/**
 * Retorna o tamanho padrão para cada tipo de elemento
 */
export function getDefaultElementSize(type: ElementType) {
  switch (type) {
    case 'product-card':
      return { width: 280, height: 380 };
    case 'highlight-banner':
      return { width: 800, height: 300 };
    case 'testimonial':
      return { width: 400, height: 200 };
    case 'qr-code':
      return { width: 200, height: 200 };
    case 'footer':
      return { width: 800, height: 300 };
    // DiPACK Templates - Tamanho A4 exato em pixels (800x1130 - 100% de cobertura da folha)
    case 'dipack-cover':
      return { width: 800, height: 1130 };
    case 'dipack-institutional':
      return { width: 800, height: 1130 };
    case 'dipack-showcase':
      return { width: 800, height: 1130 };
    case 'dipack-footer':
      return { width: 800, height: 60 };
    case 'dipack-back-cover':
      return { width: 800, height: 1130 };
    case 'dipack-confeitaria':
      return { width: 800, height: 1130 };
    case 'dipack-confeitaria-intro':
      return { width: 800, height: 1130 };
    case 'dipack-acougue':
      return { width: 800, height: 1130 };
    case 'dipack-acougue-intro':
      return { width: 800, height: 1130 };
    case 'dipack-festa':
      return { width: 800, height: 1130 };
    case 'dipack-festa-intro':
      return { width: 800, height: 1130 };
    case 'dipack-food-service':
      return { width: 800, height: 1130 };
    case 'dipack-food-service-intro':
      return { width: 800, height: 1130 };
    case 'line':
      return { width: 200, height: 100 };
    default:
      return { width: 300, height: 200 };
  }
}
