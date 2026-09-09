import api from './api';

export interface SearchProfile {
  id: string;
  username: string;
  name: string;
  avatar?: string;
  type: 'empresa' | 'criador' | 'revendedor';
  followers_count: number;
}

export interface SearchCatalog {
  id: string;
  title: string;
  author: string;
  author_avatar?: string;
  cover_image?: string;
  is_sponsored?: boolean;
  pages_count: number;
}

export interface SearchProduct {
  id: string;
  name: string;
  image_url?: string;
  category: string;
  price?: number;
  currency?: string;
}

export interface GlobalSearchResults {
  profiles: SearchProfile[];
  catalogs: SearchCatalog[];
  products: SearchProduct[];
  total: number;
}

class GlobalSearchService {
  private abortController: AbortController | null = null;

  async search(query: string, limit: number = 5): Promise<GlobalSearchResults> {
    // Cancelar requisição anterior se existir
    if (this.abortController) {
      this.abortController.abort();
    }

    // Criar novo AbortController para esta requisição
    this.abortController = new AbortController();

    try {
      const response = await api.get<GlobalSearchResults>('/api/search/global/', {
        params: { q: query, limit },
        signal: this.abortController.signal,
      });

      return response.data;
    } catch (error: any) {
      if (error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
        // Requisição cancelada, retornar vazio
        return { profiles: [], catalogs: [], products: [], total: 0 };
      }
      throw error;
    }
  }

  cancelPendingRequests() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }
}

export const globalSearchService = new GlobalSearchService();
