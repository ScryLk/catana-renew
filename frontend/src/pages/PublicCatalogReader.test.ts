import { describe, it, expect } from 'vitest';

describe('PublicCatalogReader (Digital Flipbook) Navigation & Formats', () => {
  describe('Spread and Page Index Calculations', () => {
    const getSpreadIndexForPage = (pageNumber: number): number => {
      return Math.floor((Math.max(1, pageNumber) - 1) / 2);
    };

    const getPageNumbersForSpread = (spreadIndex: number): [number, number] => {
      const left = spreadIndex * 2 + 1;
      const right = left + 1;
      return [left, right];
    };

    it('maps page 1 and 2 to spread index 0 (Capa / Abertura)', () => {
      expect(getSpreadIndexForPage(1)).toBe(0);
      expect(getSpreadIndexForPage(2)).toBe(0);
      expect(getPageNumbersForSpread(0)).toEqual([1, 2]);
    });

    it('maps subsequent pages to correct spread pairs', () => {
      expect(getSpreadIndexForPage(3)).toBe(1);
      expect(getSpreadIndexForPage(4)).toBe(1);
      expect(getPageNumbersForSpread(1)).toEqual([3, 4]);

      expect(getSpreadIndexForPage(5)).toBe(2);
      expect(getSpreadIndexForPage(6)).toBe(2);
      expect(getPageNumbersForSpread(2)).toEqual([5, 6]);
    });

    it('handles boundary values (page 0 or negative) safely', () => {
      expect(getSpreadIndexForPage(0)).toBe(0);
      expect(getSpreadIndexForPage(-5)).toBe(0);
    });
  });

  describe('Zoom Clamping Logic', () => {
    const clampZoom = (currentZoom: number, delta: number): number => {
      const MIN_ZOOM = 0.6;
      const MAX_ZOOM = 1.6;
      const next = currentZoom + delta;
      return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, parseFloat(next.toFixed(2))));
    };

    it('increases and decreases zoom within 60% and 160% limits', () => {
      expect(clampZoom(1.0, 0.1)).toBe(1.1);
      expect(clampZoom(1.0, -0.1)).toBe(0.9);

      // Limite superior (160%)
      expect(clampZoom(1.5, 0.2)).toBe(1.6);
      expect(clampZoom(1.6, 0.1)).toBe(1.6);

      // Limite inferior (60%)
      expect(clampZoom(0.7, -0.2)).toBe(0.6);
      expect(clampZoom(0.6, -0.1)).toBe(0.6);
    });
  });

  describe('WhatsApp Product Lead Generation', () => {
    const buildWhatsAppUrl = (phone: string, catalogTitle: string, productName: string, price: string, sku?: string): string => {
      const cleanPhone = phone.replace(/\D/g, '');
      const skuText = sku ? ` (Ref: ${sku})` : '';
      const text = `Olá! Vi o produto "${productName}"${skuText} por ${price} no catálogo "${catalogTitle}" e gostaria de mais informações.`;
      return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
    };

    it('encodes special characters, quotes and accents cleanly for WhatsApp links', () => {
      const url = buildWhatsAppUrl(
        '+55 (11) 98765-4321',
        'Maison Verdana — Coleção 2026',
        'Vestido de Seda "Étoile"',
        'R$ 2.450,00',
        'MV-VEST-01'
      );

      expect(url).toContain('https://wa.me/5511987654321?text=');
      expect(url).toContain(encodeURIComponent('Maison Verdana — Coleção 2026'));
      expect(url).toContain(encodeURIComponent('Vestido de Seda "Étoile"'));
      expect(url).toContain(encodeURIComponent('R$ 2.450,00'));
      expect(url).toContain(encodeURIComponent('(Ref: MV-VEST-01)'));
    });
  });
});
