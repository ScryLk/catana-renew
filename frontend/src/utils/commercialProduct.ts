import type { ProductItem } from '../data/editorialCatalog.mock';

export function parseSuppliedPrice(price: string | null | undefined): number | null {
  if (price == null || !price.trim()) return null;
  let value = price.replace(/R\$\s*/g, '').replace(/\s/g, '');
  if (!/^-?[\d.,]+$/.test(value)) return null;
  if (value.includes(',')) value = value.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(value)) value = value.replace(/\./g, '');
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}
export function adjustSuppliedPrice(price: string | null | undefined, percent: number): string | null {
  const value = parseSuppliedPrice(price);
  if (value == null || !Number.isFinite(percent)) return null;
  return `R$ ${(value * (1 + percent / 100)).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
}
export function manualProduct(fields: Partial<ProductItem>): Omit<ProductItem, 'id'> {
  return { category: '', index: '', ...fields, name: fields.name || null,
    sku: fields.sku || null, price: fields.price || null, description: fields.description || null,
    image: fields.image || null, tag: fields.tag || null };
}
