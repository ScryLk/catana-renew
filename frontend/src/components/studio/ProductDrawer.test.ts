import { describe, it, expect } from 'vitest';
import { isSheetProduct, isSystemProduct } from './ProductDrawer';
import { ProductItem } from '../../data/editorialCatalog.mock';

const createMockProduct = (overrides: Partial<ProductItem>): ProductItem => ({
  id: 'prod-default',
  index: 0,
  name: 'Produto Padrão',
  sku: 'SKU-000',
  price: 'R$ 100',
  description: 'Descrição padrão',
  category: 'GERAL',
  image: 'https://images.unsplash.com/photo-1',
  ...overrides,
});

describe('ProductDrawer Helpers & Logic Suite', () => {
  describe('isSheetProduct and isSystemProduct', () => {
    it('identifies products with source="sheet"', () => {
      const prod = createMockProduct({
        id: 'p-1',
        name: 'Vinho Tinto Reserva',
        price: 'R$ 180',
        category: 'BEBIDAS',
        source: 'sheet',
      });
      expect(isSheetProduct(prod)).toBe(true);
      expect(isSystemProduct(prod)).toBe(false);
    });

    it('identifies products with id prefix "sheet-" or "prod-sheet"', () => {
      const prod1 = createMockProduct({
        id: 'sheet-101',
        name: 'Azeite Extra Virgem',
        price: 'R$ 85',
        category: 'EMPORIO',
      });
      const prod2 = createMockProduct({
        id: 'prod-sheet-202',
        name: 'Queijo Canastra',
        price: 'R$ 120',
        category: 'LATICINIOS',
      });
      expect(isSheetProduct(prod1)).toBe(true);
      expect(isSheetProduct(prod2)).toBe(true);
      expect(isSystemProduct(prod1)).toBe(false);
      expect(isSystemProduct(prod2)).toBe(false);
    });

    it('identifies products with tag containing "import" or "planilha"', () => {
      const prod1 = createMockProduct({
        id: 'prod-99',
        name: 'Café Especial',
        price: 'R$ 45',
        category: 'GRAOS',
        tag: 'Importado Planilha',
      });
      const prod2 = createMockProduct({
        id: 'prod-100',
        name: 'Mel Silvestre',
        price: 'R$ 35',
        category: 'DOCES',
        tag: 'planilha_2026',
      });
      expect(isSheetProduct(prod1)).toBe(true);
      expect(isSheetProduct(prod2)).toBe(true);
    });

    it('identifies standard system/acervo products correctly', () => {
      const systemProd = createMockProduct({
        id: 'prod-custom-01',
        name: 'Blazer Alfaiataria',
        price: 'R$ 1.290',
        category: 'MODA',
        source: 'system',
        tag: 'Destaque',
      });
      expect(isSheetProduct(systemProd)).toBe(false);
      expect(isSystemProduct(systemProd)).toBe(true);
    });

    it('handles edge cases with missing or empty fields without throwing', () => {
      const bareProd = createMockProduct({
        id: '123',
        name: 'Item Sem Tag',
        price: '0',
        category: '',
      });
      expect(isSheetProduct(bareProd)).toBe(false);
      expect(isSystemProduct(bareProd)).toBe(true);
    });
  });

  describe('Metrics and Filtering Logic', () => {
    const mockProducts: (ProductItem & { isAssigned?: boolean })[] = [
      createMockProduct({
        id: 'sheet-1',
        name: 'Camisa Linho',
        sku: 'LIN-01',
        price: 'R$ 350',
        category: 'VESTUARIO',
        source: 'sheet',
        isAssigned: true,
      }),
      createMockProduct({
        id: 'sheet-2',
        name: 'Calça Alfaiataria',
        sku: 'ALF-02',
        price: 'R$ 450',
        category: 'VESTUARIO',
        source: 'sheet',
        isAssigned: false,
      }),
      createMockProduct({
        id: 'sys-1',
        name: 'Relógio Cronógrafo',
        sku: 'REL-03',
        price: 'R$ 2.200',
        category: 'ACESSORIOS',
        source: 'system',
        isAssigned: true,
      }),
      createMockProduct({
        id: 'sys-2',
        name: 'Cinto Couro',
        sku: 'CIN-04',
        price: 'R$ 200',
        category: 'ACESSORIOS',
        source: 'system',
        isAssigned: false,
      }),
    ];

    it('computes correct breakdown counts for sheet vs system and assigned vs unassigned', () => {
      const sheetCount = mockProducts.filter(isSheetProduct).length;
      const systemCount = mockProducts.filter(isSystemProduct).length;
      const allocatedCount = mockProducts.filter((p) => p.isAssigned).length;
      const unassignedCount = mockProducts.filter((p) => !p.isAssigned).length;

      expect(sheetCount).toBe(2);
      expect(systemCount).toBe(2);
      expect(allocatedCount).toBe(2);
      expect(unassignedCount).toBe(2);
      expect(mockProducts.length).toBe(4);
    });

    it('computes average ticket accurately with Brazilian currency format', () => {
      const prices = mockProducts
        .map((p) => parseInt(p.price.replace(/[^0-9]/g, ''), 10))
        .filter((v) => !isNaN(v) && v > 0);

      const avg = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
      // (350 + 450 + 2200 + 200) = 3200 / 4 = 800
      expect(avg).toBe(800);
      const formatted = `R$ ${avg.toLocaleString('pt-BR')}`;
      expect(formatted).toBe('R$ 800');
    });

    it('filters accurately by search query across name, SKU and category', () => {
      const filterBySearch = (query: string) => {
        const q = query.toLowerCase().trim();
        return mockProducts.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.sku?.toLowerCase().includes(q) ||
            p.category?.toLowerCase().includes(q)
        );
      };

      expect(filterBySearch('linho').length).toBe(1);
      expect(filterBySearch('LIN-01').length).toBe(1);
      expect(filterBySearch('acessorios').length).toBe(2);
      expect(filterBySearch('inexistente').length).toBe(0);
      expect(filterBySearch('').length).toBe(4);
    });

    it('filters accurately by origin tabs', () => {
      const filterByOrigin = (origin: 'all' | 'sheet' | 'system' | 'unassigned' | 'assigned') => {
        return mockProducts.filter((p) => {
          if (origin === 'sheet') return isSheetProduct(p);
          if (origin === 'system') return isSystemProduct(p);
          if (origin === 'assigned') return p.isAssigned;
          if (origin === 'unassigned') return !p.isAssigned;
          return true;
        });
      };

      expect(filterByOrigin('all').length).toBe(4);
      expect(filterByOrigin('sheet').length).toBe(2);
      expect(filterByOrigin('system').length).toBe(2);
      expect(filterByOrigin('assigned').length).toBe(2);
      expect(filterByOrigin('unassigned').length).toBe(2);
    });
  });
});
