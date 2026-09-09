import api from './api';
import type { Media, MediaFolder, MediaStats, MediaType } from '@/types/api';

export interface MediaFilters {
  folder?: number | null;
  media_type?: MediaType | 'folder';
  is_favorite?: boolean;
  search?: string;
  sede?: number | null;
}

export interface UploadMediaData {
  file: File;
  name?: string;
  description?: string;
  folder?: number;
  tags?: string[];
  sede?: number;
}

import { organizationService } from './organizationService';

export const mediaService = {
  /**
   * Lista todos os arquivos de mídia do usuário com filtros opcionais
   */
  async getMedia(filters?: MediaFilters): Promise<Media[]> {
    const params = new URLSearchParams();
    const orgId = organizationService.getActiveOrganizationId();
    if (orgId) params.append('organization', orgId.toString());

    const sedeId = organizationService.getActiveSedeId();
    if (sedeId) params.append('sede', sedeId.toString());

    if (filters?.folder !== undefined) {
      if (filters.folder === null) {
        params.append('folder', 'null');
      } else {
        params.append('folder', filters.folder.toString());
      }
    }
    if (filters?.media_type) params.append('media_type', filters.media_type);
    if (filters?.is_favorite !== undefined) params.append('is_favorite', filters.is_favorite.toString());
    if (filters?.search) params.append('search', filters.search);

    const response = await api.get<Media[]>(`/api/media/?${params.toString()}`);
    return response.data;
  },

  /**
   * Busca um arquivo de mídia específico
   */
  async getMediaById(id: number): Promise<Media> {
    const response = await api.get<Media>(`/api/media/${id}/`);
    return response.data;
  },

  /**
   * Faz upload de um novo arquivo
   */
  async uploadMedia(data: UploadMediaData): Promise<Media> {
    const formData = new FormData();
    const orgId = organizationService.getActiveOrganizationId();
    if (orgId) formData.append('organization', orgId.toString());

    const sedeId = organizationService.getActiveSedeId();
    if (sedeId) formData.append('sede', sedeId.toString());

    formData.append('file', data.file);
    if (data.name) formData.append('name', data.name);
    if (data.description) formData.append('description', data.description);
    if (data.folder) formData.append('folder', data.folder.toString());
    if (data.tags && data.tags.length > 0) {
      formData.append('tags', JSON.stringify(data.tags));
    }

    const response = await api.post<Media>('/api/media/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  /**
   * Atualiza informações de um arquivo
   */
  async updateMedia(id: number, data: Partial<Pick<Media, 'name' | 'description' | 'tags'>>): Promise<Media> {
    const response = await api.patch<Media>(`/api/media/${id}/`, data);
    return response.data;
  },

  /**
   * Deleta um arquivo
   */
  async deleteMedia(id: number): Promise<void> {
    await api.delete(`/api/media/${id}/`);
  },

  /**
   * Marca/desmarca um arquivo como favorito
   */
  async toggleFavorite(id: number): Promise<Media> {
    const response = await api.post<Media>(`/api/media/${id}/toggle_favorite/`);
    return response.data;
  },

  /**
   * Move um arquivo para outra pasta
   */
  async moveToFolder(id: number, folderId: number | null): Promise<Media> {
    const response = await api.post<Media>(`/api/media/${id}/move_to_folder/`, {
      folder: folderId,
    });
    return response.data;
  },

  /**
   * Obtém estatísticas da biblioteca de mídia
   */
  async getStats(folderId?: number | null): Promise<MediaStats> {
    try {
      const params = new URLSearchParams();
      const orgId = organizationService.getActiveOrganizationId();
      if (orgId) params.append('organization', orgId.toString());

      const sedeId = organizationService.getActiveSedeId();
      if (sedeId) params.append('sede', sedeId.toString());

      if (folderId !== undefined) {
        if (folderId === null) {
          params.append('folder', 'null');
        } else {
          params.append('folder', folderId.toString());
        }
      }
      const response = await api.get<MediaStats>(`/api/media/stats/?${params.toString()}`);
      return response.data;
    } catch (error) {
      console.warn('API /api/media/stats/ not found, using mock data');
      return {
        total_files: 0,
        folders_count: 0,
        total_size: 0,
        total_size_formatted: '0 MB',
        images_count: 0,
        videos_count: 0,
        documents_count: 0,
        favorites_count: 0
      };
    }
  },

  /**
   * Lista todas as pastas do usuário
   */
  async getFolders(): Promise<MediaFolder[]> {
    try {
      const params = new URLSearchParams();
      const orgId = organizationService.getActiveOrganizationId();
      if (orgId) params.append('organization', orgId.toString());

      const sedeId = organizationService.getActiveSedeId();
      if (sedeId) params.append('sede', sedeId.toString());

      const response = await api.get<MediaFolder[]>(`/api/media-folders/?${params}`);
      return response.data;
    } catch (error) {
      console.warn('API /api/media-folders/ not found, using mock data');
      return [];
    }
  },

  /**
   * Cria uma nova pasta
   */
  async createFolder(name: string, parent?: number | null): Promise<MediaFolder> {
    try {
      const orgId = organizationService.getActiveOrganizationId();
      const sedeId = organizationService.getActiveSedeId();

      const payload: any = {
        name,
        parent: parent || null,
      };
      if (orgId) payload.organization = orgId;
      if (sedeId) payload.sede = sedeId;

      const response = await api.post<MediaFolder>('/api/media-folders/', payload);
      return response.data;
    } catch (error) {
      console.warn('API /api/media-folders/ not found, using mock data');
      return {
        id: Math.floor(Math.random() * 1000),
        name,
        parent: parent || null,
        created_at: new Date().toISOString(),
        created_by: 1
      };
    }
  },

  /**
   * Atualiza uma pasta
   */
  async updateFolder(id: number, name: string): Promise<MediaFolder> {
    const response = await api.patch<MediaFolder>(`/api/media-folders/${id}/`, {
      name,
    });
    return response.data;
  },

  /**
   * Deleta uma pasta
   */
  async deleteFolder(id: number): Promise<void> {
    await api.delete(`/api/media-folders/${id}/`);
  },

  /**
   * Endpoint otimizado para buscar imagens no editor
   * Retorna apenas imagens, ordenadas por favoritos e data
   */
  async getImagesForEditor(filters?: MediaFilters & { limit?: number }): Promise<Media[]> {
    const params = new URLSearchParams();
    const orgId = organizationService.getActiveOrganizationId();
    if (orgId) params.append('organization', orgId.toString());

    const sedeId = organizationService.getActiveSedeId();
    if (sedeId) params.append('sede', sedeId.toString());

    if (filters?.folder) params.append('folder', filters.folder.toString());
    if (filters?.is_favorite !== undefined) params.append('is_favorite', filters.is_favorite.toString());
    if (filters?.search) params.append('search', filters.search);
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const response = await api.get<Media[]>(`/api/media/for_editor/?${params.toString()}`);
    return response.data;
  },
  /**
   * Garante que uma hierarquia de pastas exista
   * @param sourcePath Array com nomes das pastas (ex: ['Produtos', 'Nome do Produto'])
   * @returns ID da última pasta
   */
  async ensureFolderHierarchy(path: string[]): Promise<number | null> {
    if (!path || path.length === 0) return null;

    let currentParentId: number | null = null;

    try {
      // Get all folders once to minimize API calls
      // Ideally we would have a better search API, but for now we fetch all folders
      // and filter in memory. This is acceptable for typical folder counts.
      const allFolders = await this.getFolders();

      for (const folderName of path) {
        // Find folder in current parent
        const existingFolder = allFolders.find(
          f => f.name === folderName && f.parent === currentParentId
        );

        if (existingFolder) {
          currentParentId = existingFolder.id;
        } else {
          // Create if not exists
          const newFolder = await this.createFolder(folderName, currentParentId);
          currentParentId = newFolder.id;
          // Add to local cache to find it in next iteration if needed (though createFolder returns it with ID)
          // We don't strictly need to update allFolders because we just need currentParentId for the next step.
          // But if we had duplicate names in the path it handles it incorrectly? 
          // No, parent check handles it.
        }
      }

      return currentParentId;
    } catch (error) {
      console.error('Error ensuring folder hierarchy:', error);
      return null;
    }
  },
};
