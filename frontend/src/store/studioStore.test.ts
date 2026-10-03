import { describe, it, expect, beforeEach } from 'vitest';
import { useStudioStore, INITIAL_BRANDS } from './studioStore';

describe('useStudioStore State & Mutation Suite', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('Theme and Mode Management', () => {
    it('initializes with default dark theme and toggles theme', () => {
      const store = useStudioStore.getState();
      expect(store.theme).toBeDefined();

      store.toggleTheme();
      const updatedTheme = useStudioStore.getState().theme;
      expect(['dark', 'light']).toContain(updatedTheme);
    });

    it('updates activeMode correctly', () => {
      const store = useStudioStore.getState();
      store.setActiveMode('commercial');
      expect(useStudioStore.getState().activeMode).toBe('commercial');

      store.setActiveMode('copywriter');
      expect(useStudioStore.getState().activeMode).toBe('copywriter');
    });
  });

  describe('Brand Selection & Unlinking', () => {
    it('sets active brand and allows unlinking (null)', () => {
      const store = useStudioStore.getState();
      store.setActiveBrandId('brand-vektron');
      expect(useStudioStore.getState().activeBrandId).toBe('brand-vektron');

      // Desvincula (projeto avulso)
      store.setActiveBrandId(null);
      expect(useStudioStore.getState().activeBrandId).toBeNull();
    });

    it('contains default initial brands including VEKTRON', () => {
      expect(INITIAL_BRANDS.length).toBeGreaterThan(0);
      const vektron = INITIAL_BRANDS.find((b) => b.id === 'brand-vektron');
      expect(vektron).toBeDefined();
      expect(vektron?.name).toBe('VEKTRON Systems');
    });

    it('supports adding and removing unlinked catalogs', () => {
      const store = useStudioStore.getState();
      const created = store.addUnlinkedCatalog({
        title: 'Catálogo Avulso Primavera',
        totalPages: 8,
        category: 'GERAL',
        updatedAt: new Date().toISOString(),
      });

      expect(created.id).toBeDefined();
      const unlinked = useStudioStore.getState().unlinkedCatalogs;
      expect(unlinked.some((c) => c.id === created.id)).toBe(true);

      store.removeUnlinkedCatalog(created.id);
      const updatedUnlinked = useStudioStore.getState().unlinkedCatalogs;
      expect(updatedUnlinked.some((c) => c.id === created.id)).toBe(false);
    });
  });

  describe('Product Inventory CRUD', () => {
    it('adds product to repository and updates list', () => {
      const store = useStudioStore.getState();
      const initialCount = store.unassignedProducts.length;

      const created = store.addProductToRepository({
        index: 0,
        name: 'Produto Teste QA',
        price: 'R$ 99',
        category: 'TESTE',
        sku: 'QA-001',
        description: 'Descrição de teste QA',
        image: 'https://images.unsplash.com/photo-1',
      });

      expect(created.id).toBeDefined();
      const updated = useStudioStore.getState().unassignedProducts;
      expect(updated.length).toBe(initialCount + 1);
      expect(updated.some((p) => p.id === created.id)).toBe(true);
    });

    it('updates product properties (inline edit)', () => {
      const store = useStudioStore.getState();
      const created = store.addProductToRepository({
        index: 0,
        name: 'Nome Original',
        price: 'R$ 100',
        category: 'GERAL',
        sku: 'ORIG-01',
        description: 'Original',
        image: 'https://images.unsplash.com/photo-1',
      });

      store.updateProduct(created.id, {
        name: 'Nome Atualizado',
        price: 'R$ 150',
      });

      const found = useStudioStore.getState().unassignedProducts.find((p) => p.id === created.id);
      expect(found?.name).toBe('Nome Atualizado');
      expect(found?.price).toBe('R$ 150');
    });

    it('deletes product from repository cleanly', () => {
      const store = useStudioStore.getState();
      const created = store.addProductToRepository({
        index: 0,
        name: 'Produto Para Deletar',
        price: 'R$ 50',
        category: 'TESTE',
        sku: 'DEL-01',
        description: 'Para deletar',
        image: 'https://images.unsplash.com/photo-1',
      });

      expect(useStudioStore.getState().unassignedProducts.some((p) => p.id === created.id)).toBe(true);

      store.deleteProductFromRepository(created.id);
      expect(useStudioStore.getState().unassignedProducts.some((p) => p.id === created.id)).toBe(false);
    });
  });

  describe('Spread Navigation & Bounds', () => {
    it('navigates to spread index within valid bounds', () => {
      const store = useStudioStore.getState();
      store.goToSpread(1);
      expect(useStudioStore.getState().currentSpread).toEqual([3, 4]);

      // Spread 0 corresponde às páginas [1, 2]
      store.goToSpread(0);
      expect(useStudioStore.getState().currentSpread).toEqual([1, 2]);
    });

    it('toggles product drawer open and close', () => {
      const store = useStudioStore.getState();
      store.openProductDrawer();
      expect(useStudioStore.getState().isProductDrawerOpen).toBe(true);

      store.closeProductDrawer();
      expect(useStudioStore.getState().isProductDrawerOpen).toBe(false);

      store.toggleProductDrawer();
      expect(useStudioStore.getState().isProductDrawerOpen).toBe(true);
      store.toggleProductDrawer();
      expect(useStudioStore.getState().isProductDrawerOpen).toBe(false);
    });
  });
});
