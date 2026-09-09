import api from './api';
import type { Catalog } from '@/types/api';
import type { CatalogPage } from '@/types/editor';
import type { CatalogExportSchema } from '@/types/catalogIO';

export interface ImportJsonResult {
    catalog_id: number;
    title: string;
    pages: number;
    elements: number;
    mode: string;
    theme_id: number | null;
}

export interface SaveContentResult {
  status: string;
  catalog: number;
  pages: number;
  elements: number;
}

export type DemoTema = 'padaria' | 'acougue' | 'mercado' | 'restaurante' | 'festas' | 'boutique';
export type DemoEstrutura = 'completo' | 'essencial' | 'custom';

export interface GerarDemoPayload {
  tema: DemoTema;
  estrutura?: DemoEstrutura;
  secoes?: string[];
  b2b?: boolean;
  periodo?: string;
  identidade_premium?: boolean;
}

export interface GerarDemoResult {
  catalog_id: number;
  title: string;
  pages: number;
}

export const catalogService = {
    /**
     * Busca todos os catálogos (com filtros de sede/org)
     */
    async getAllCatalogs(params?: { sede?: number; organization?: number }): Promise<Catalog[]> {
        try {
            const queryParams = new URLSearchParams();
            if (params?.sede) queryParams.append('sede', params.sede.toString());
            if (params?.organization) queryParams.append('organization', params.organization.toString());

            const response = await api.get<Catalog[]>(`/api/catalogs/?${queryParams.toString()}`);
            return response.data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        } catch (error) {
            console.error('Error fetching all catalogs:', error);
            return [];
        }
    },

    /**
     * Busca catálogos públicos para o Explorer
     */
    async getExploreCatalogs(search?: string, filters?: any): Promise<Catalog[]> {
        try {
            const queryParams = new URLSearchParams();
            if (search) queryParams.append('search', search);

            if (filters) {
                if (filters.category) queryParams.append('category', filters.category);
                // Add other filters as needed
            }

            const response = await api.get<Catalog[]>(`/api/catalogs/explore/?${queryParams.toString()}`);
            return response.data;
        } catch (error) {
            console.error('Error fetching explore catalogs:', error);
            return [];
        }
    },

    /**
     * Busca um catálogo por ID (com detalhes completos)
     */
    async getCatalog(id: number): Promise<Catalog> {
        const response = await api.get<Catalog>(`/api/catalogs/${id}/`);
        return response.data;
    },

    /**
     * Cria um novo catálogo
     */
    async createCatalog(payload: Partial<Catalog>): Promise<Catalog> {
        const response = await api.post<Catalog>('/api/catalogs/', payload);
        return response.data;
    },

    /**
     * Atualiza um catálogo existente
     */
    async updateCatalog(id: number, payload: Partial<Catalog>): Promise<Catalog> {
        const response = await api.patch<Catalog>(`/api/catalogs/${id}/`, payload);
        return response.data;
    },

    async toggleLike(id: number): Promise<{ liked: boolean; count: number }> {
        const response = await api.post<{ liked: boolean; count: number }>(`/api/catalogs/${id}/like/`);
        return response.data;
    },

    async toggleSave(id: number): Promise<{ saved: boolean; count: number }> {
        const response = await api.post<{ saved: boolean; count: number }>(`/api/catalogs/${id}/toggle_save/`);
        return response.data;
    },

    /**
     * INC-01: persiste o conteúdo do editor (páginas/elementos) no backend
     * de forma transacional, via /api/catalogs/{id}/save_content/.
     * Recebe as páginas do editorStore e serializa geometria + JSON do elemento.
     */
    async saveCatalogContent(id: number, pages: CatalogPage[]): Promise<SaveContentResult> {
        const payload = {
            pages: pages.map((page, index) => ({
                order: typeof page.order === 'number' ? page.order : index,
                background_image: null,
                elements: page.elements,
            })),
        };
        const response = await api.post<SaveContentResult>(`/api/catalogs/${id}/save_content/`, payload);
        return response.data;
    },

    /**
     * Gera um catálogo de demonstração temático (síncrono).
     * POST /api/catalogs/gerar-demo/
     */
    async gerarDemo(payload: GerarDemoPayload): Promise<GerarDemoResult> {
        const response = await api.post<GerarDemoResult>('/api/catalogs/gerar-demo/', payload);
        return response.data;
    },

    /**
     * Materializa um JSON catalogIO v1.0 como catálogo relacional editável.
     * POST /api/catalogs/import-json/ (inverso do catalogLoader).
     * mode 'new' (default) cria um catálogo; 'replace' recria sobre catalogId.
     */
    async importJson(
        schema: CatalogExportSchema,
        opts?: { mode?: 'new' | 'replace'; catalogId?: number },
    ): Promise<ImportJsonResult> {
        const body =
            opts?.mode === 'replace'
                ? { data: schema, mode: 'replace', catalog_id: opts.catalogId }
                : schema;
        const response = await api.post<ImportJsonResult>('/api/catalogs/import-json/', body);
        return response.data;
    },

    /**
     * Remove um catálogo
     */
    async deleteCatalog(id: number): Promise<void> {
        await api.delete(`/api/catalogs/${id}/`);
    },
};
