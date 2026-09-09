import api from './api';
import type { ProductData } from '../types/editor';

// Informações de dropshipping (JSONField flexível no backend)
export interface DropshippingInfo {
  weight?: string;
  width?: string;
  height?: string;
  depth?: string;
  supplier?: string;
  supplierSku?: string;
  leadTime?: string;
  shippingCost?: string;
}

// Extended Product interface for the service
export interface Product extends Omit<ProductData, 'image'> {
  id: number;
  image: number | null;
  image_url: string | null;
  stock: number;
  dropshipping_info?: DropshippingInfo;
  created_at: string;
  updated_at: string;
}

// Product reference interface for editor use (simplified)
export interface ProductReference {
  id: number;
  name: string;
  sku: string;
  description: string;
  price: string;
  currency: string;
  stock: number;
  category: number | null;
  category_name: string | null;
  badge: string | null;
  specs: Array<{ key: string; value: string }>;
  cover_url: string | null;
  gallery_urls: string[];
}

class ProductService {
  async getProducts(params?: { search?: string; category?: string; page?: number; limit?: number; sede?: number; organization?: number }): Promise<{ products: Product[]; total: number }> {
    const queryParams = new URLSearchParams();

    if (params?.search) queryParams.append('search', params.search);
    if (params?.category) queryParams.append('category', params.category);
    if (params?.sede) queryParams.append('sede', params.sede.toString());
    if (params?.organization) queryParams.append('organization', params.organization.toString());
    if (params?.page) queryParams.append('page', params.page.toString());

    // Filter by name/sku if search is provided is default django-filter behavior usually?
    // Or I need to implement search filter in Backend ViewSet?
    // Backend ViewSet uses `filterset_fields`. I need to add 'search_fields'.
    // I'll assume standard DRF search filter is enabled if I add 'search' param?
    // ViewSet default doesn't enable search unless SearchFilter is in filter_backends.
    // I should check ViewSet. But for now I'll pass params.

    const response = await api.get<any>(`/api/products/?${queryParams.toString()}`);

    let products: Product[] = [];
    let total = 0;

    if (Array.isArray(response.data)) {
      products = response.data;
      // .count é preservado (não-enumerável) pelo interceptor quando paginado.
      total = (response.data as any).count ?? products.length;
    } else if (response.data.results) {
      products = response.data.results;
      total = response.data.count;
    }

    return { products, total };
  }

  async getPublicProducts(params?: { search?: string; category?: string; page?: number; limit?: number }): Promise<{ products: any[]; total: number }> {
    const queryParams = new URLSearchParams();
    if (params?.search) queryParams.append('search', params.search);
    if (params?.category) queryParams.append('category', params.category);
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('page_size', params.limit.toString());

    const response = await api.get<any>(`/api/explore/products/?${queryParams.toString()}`);

    let products: any[] = [];
    let total = 0;

    if (Array.isArray(response.data)) {
      products = response.data;
      // .count é preservado (não-enumerável) pelo interceptor quando paginado.
      total = (response.data as any).count ?? products.length;
    } else if (response.data.results) {
      products = response.data.results;
      total = response.data.count;
    }

    return { products, total };
  }

  async getCategories(sedeId?: number, orgId?: number): Promise<string[]> {
    const { products } = await this.getProducts({ sede: sedeId, organization: orgId });
    const categories = new Set(products.map(p => p.category).filter(Boolean));
    return Array.from(categories) as string[];
  }

  async createProduct(data: Partial<Product>): Promise<Product> {
    const response = await api.post<Product>('/api/products/', data);
    return response.data;
  }

  async deleteProduct(id: number): Promise<void> {
    await api.delete(`/api/products/${id}/`);
  }

  async getProductById(id: number): Promise<Product> {
    const response = await api.get<Product>(`/api/products/${id}/`);
    return response.data;
  }

  async updateProduct(id: number, data: Partial<Product>): Promise<Product> {
    const response = await api.patch<Product>(`/api/products/${id}/`, data);
    return response.data;
  }

  async toggleLike(id: number): Promise<{ liked: boolean; count: number }> {
    const response = await api.post<{ liked: boolean; count: number }>(`/api/products/${id}/like/`);
    return response.data;
  }

  async toggleSave(id: number): Promise<{ saved: boolean; count: number }> {
    const response = await api.post<{ saved: boolean; count: number }>(`/api/products/${id}/toggle_save/`);
    return response.data;
  }

  /**
   * Search products for editor use (simplified response)
   * @param query Search query (searches in name and SKU)
   * @param limit Maximum number of results (default: 20, max: 100)
   * @param organization Filter by organization ID
   * @param sede Filter by sede ID
   */
  async searchForEditor(params: {
    query?: string;
    limit?: number;
    organization?: number;
    sede?: number;
  }): Promise<ProductReference[]> {
    const queryParams = new URLSearchParams();

    if (params.query) queryParams.append('q', params.query);
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.organization) queryParams.append('organization', params.organization.toString());
    if (params.sede) queryParams.append('sede', params.sede.toString());

    const response = await api.get<ProductReference[]>(
      `/api/products/search_for_editor/?${queryParams.toString()}`
    );

    return response.data;
  }

  /**
   * Resolve multiple product IDs to full product data
   * @param productIds Array of product IDs to resolve
   * @returns Dictionary mapping product ID to product data
   */
  async resolveReferences(productIds: number[]): Promise<Record<string, ProductReference>> {
    if (productIds.length === 0) {
      return {};
    }

    if (productIds.length > 100) {
      throw new Error('Maximum 100 products per request');
    }

    const response = await api.post<Record<string, ProductReference>>(
      '/api/products/resolve_references/',
      { product_ids: productIds }
    );

    return response.data;
  }

  /**
   * Export products to JSON (Product JSON Specification v1.0)
   * @param params Export parameters
   * @returns JSON file download
   */
  async exportProducts(params?: {
    format?: 'json' | 'xlsx' | 'csv';
    scope?: 'all' | 'filtered' | 'selected';
    ids?: number[];
    filters?: {
      search?: string;
      category?: string;
      organization?: number;
      sede?: number;
    };
  }): Promise<void> {
    const queryParams = new URLSearchParams();

    queryParams.append('format', params?.format || 'json');
    queryParams.append('scope', params?.scope || 'all');

    if (params?.ids && params.ids.length > 0) {
      queryParams.append('ids', params.ids.join(','));
    }

    if (params?.filters) {
      Object.entries(params.filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(`filters[${key}]`, value.toString());
        }
      });
    }

    // Use window.location to trigger download
    const url = `/api/products/export/?${queryParams.toString()}`;
    window.location.href = url;
  }

  /**
   * Bulk import products via dedicated endpoint.
   * @param products List of product payloads (already cleaned of UI-only fields)
   * @param options Extra context (sede/organization)
   * @returns Import summary
   */
  async bulkImport(
    products: Record<string, unknown>[],
    options?: { sede?: number; organization?: number }
  ): Promise<{ success: number; failed: number; errors: string[] }> {
    const response = await api.post<{ success: number; failed: number; errors: string[] }>(
      '/api/products/bulk_import/',
      { products, ...options }
    );
    return response.data;
  }
}

export const productService = new ProductService();
