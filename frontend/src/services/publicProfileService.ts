/**
 * 🌐 Public Profile Service - API Client
 *
 * Serviço para gerenciar perfis públicos, busca, descoberta e interações sociais
 */

import api from './api';
import type {
  PublicProfile,
  MyProfile,
  ProfileSearchFilters,
  ProfileSearchResult,
  PublicCatalog,
  UpdateProfileRequest,
  ProfileStats,
  ProfileSettings,
} from '../types/profile';

class PublicProfileService {
  // ========================================
  // PERFIL PÚBLICO
  // ========================================

  /**
   * Busca perfil público por ID
   */
  async getPublicProfile(profileId: number): Promise<PublicProfile> {
    const response = await api.get(`/api/public-profiles/${profileId}`);
    return response.data;
  }

  /**
   * Busca perfil público por username
   */
  async getPublicProfileByUsername(username: string): Promise<PublicProfile | null> {
    try {
      const response = await api.get(`/api/public-profiles/username/${username}`);
      return response.data;
    } catch (error: any) {
      // Se endpoint não existe (404), retorna null silenciosamente
      if (error?.response?.status === 404) {
        return null;
      }
      // Para outros erros, propagar normalmente
      throw error;
    }
  }

  /**
   * Busca catálogos públicos de um perfil
   */
  async getProfileCatalogs(
    profileId: number,
    params?: {
      page?: number;
      pageSize?: number;
      sortBy?: 'recent' | 'popular' | 'views';
    }
  ): Promise<{
    catalogs: PublicCatalog[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const response = await api.get(`/api/public-profiles/${profileId}/catalogs`, { params });
    return response.data;
  }

  // ========================================
  // MEU PERFIL PÚBLICO
  // ========================================

  /**
   * Busca perfil público do usuário logado (versão completa)
   */
  async getMyPublicProfile(): Promise<MyProfile> {
    const response = await api.get('/api/public-profiles/me');
    return response.data;
  }

  /**
   * Cria/inicializa perfil público do usuário logado
   */
  async createMyPublicProfile(data: {
    displayName: string;
    bio: string;
    profileType: string;
    segments: string[];
  }): Promise<MyProfile> {
    const response = await api.post('/api/public-profiles/me', data);
    return response.data;
  }

  /**
   * Atualiza perfil público do usuário logado
   */
  async updateMyPublicProfile(data: UpdateProfileRequest): Promise<MyProfile> {
    const response = await api.patch('/api/public-profiles/me', data);
    return response.data;
  }

  /**
   * Atualiza avatar do perfil público
   */
  async updateAvatar(file: File): Promise<{ avatarUrl: string }> {
    const formData = new FormData();
    formData.append('avatar', file);

    const response = await api.post('/api/public-profiles/me/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    return response.data;
  }

  /**
   * Atualiza imagem de capa do perfil
   */
  async updateCoverImage(file: File): Promise<{ coverImageUrl: string }> {
    const formData = new FormData();
    formData.append('cover', file);

    const response = await api.post('/api/public-profiles/me/cover', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    return response.data;
  }

  /**
   * Busca estatísticas do meu perfil público
   */
  async getMyStats(): Promise<ProfileStats> {
    const response = await api.get('/api/public-profiles/me/stats');
    return response.data;
  }

  // ========================================
  // BUSCA E DESCOBERTA
  // ========================================

  /**
   * Busca perfis públicos com filtros
   */
  async searchProfiles(
    filters: ProfileSearchFilters,
    page: number = 1,
    pageSize: number = 20
  ): Promise<ProfileSearchResult> {
    const response = await api.get('/api/public-profiles/search', {
      params: {
        ...filters,
        page,
        pageSize,
      },
    });

    return response.data;
  }

  /**
   * Busca perfis sugeridos (baseado em segmentos do usuário)
   */
  async getSuggestedProfiles(limit: number = 10): Promise<PublicProfile[]> {
    const response = await api.get('/api/public-profiles/suggested', {
      params: { limit },
    });
    return response.data;
  }

  /**
   * Busca perfis em destaque
   */
  async getFeaturedProfiles(limit: number = 10): Promise<PublicProfile[]> {
    const response = await api.get('/api/public-profiles/featured', {
      params: { limit },
    });
    return response.data;
  }

  /**
   * Busca catálogos públicos em destaque (todos os perfis)
   */
  async getFeaturedCatalogs(
    params?: {
      page?: number;
      pageSize?: number;
      segment?: string;
    }
  ): Promise<{
    catalogs: PublicCatalog[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const response = await api.get('/api/public-catalogs/featured', { params });
    return response.data;
  }

  // ========================================
  // INTERAÇÕES - SEGUIR
  // ========================================

  /**
   * Seguir um perfil
   */
  async followProfile(profileId: number): Promise<{ success: boolean }> {
    const response = await api.post(`/api/public-profiles/${profileId}/follow`);
    return response.data;
  }

  /**
   * Deixar de seguir um perfil
   */
  async unfollowProfile(profileId: number): Promise<{ success: boolean }> {
    const response = await api.delete(`/api/public-profiles/${profileId}/follow`);
    return response.data;
  }

  /**
   * Lista perfis que estou seguindo
   */
  async getFollowing(page: number = 1, pageSize: number = 20): Promise<ProfileSearchResult> {
    const response = await api.get('/api/public-profiles/me/following', {
      params: { page, pageSize },
    });
    return response.data;
  }

  /**
   * Lista meus seguidores
   */
  async getFollowers(page: number = 1, pageSize: number = 20): Promise<ProfileSearchResult> {
    const response = await api.get('/api/public-profiles/me/followers', {
      params: { page, pageSize },
    });
    return response.data;
  }

  // ========================================
  // INTERAÇÕES - SALVAR
  // ========================================

  /**
   * Salvar um perfil para acesso rápido
   */
  async saveProfile(profileId: number): Promise<{ success: boolean }> {
    const response = await api.post(`/api/public-profiles/${profileId}/save`);
    return response.data;
  }

  /**
   * Remover perfil dos salvos
   */
  async unsaveProfile(profileId: number): Promise<{ success: boolean }> {
    const response = await api.delete(`/api/public-profiles/${profileId}/save`);
    return response.data;
  }

  /**
   * Lista perfis salvos
   */
  async getSavedProfiles(page: number = 1, pageSize: number = 20): Promise<ProfileSearchResult> {
    const response = await api.get('/api/public-profiles/me/saved', {
      params: { page, pageSize },
    });
    return response.data;
  }

  // ========================================
  // INTERAÇÕES - CATÁLOGOS
  // ========================================

  /**
   * Curtir um catálogo
   */
  async likeCatalog(catalogId: number): Promise<{ success: boolean; likeCount: number }> {
    const response = await api.post(`/api/public-catalogs/${catalogId}/like`);
    return response.data;
  }

  /**
   * Descurtir um catálogo
   */
  async unlikeCatalog(catalogId: number): Promise<{ success: boolean; likeCount: number }> {
    const response = await api.delete(`/api/public-catalogs/${catalogId}/like`);
    return response.data;
  }

  /**
   * Registrar visualização de catálogo
   */
  async viewCatalog(catalogId: number): Promise<{ success: boolean }> {
    const response = await api.post(`/api/public-catalogs/${catalogId}/view`);
    return response.data;
  }

  /**
   * Compartilhar catálogo
   */
  async shareCatalog(catalogId: number, platform?: string): Promise<{ success: boolean }> {
    const response = await api.post(`/api/public-catalogs/${catalogId}/share`, { platform });
    return response.data;
  }

  // ========================================
  // CONFIGURAÇÕES E PRIVACIDADE
  // ========================================

  /**
   * Atualiza configurações de privacidade
   */
  async updateSettings(settings: Partial<ProfileSettings>): Promise<ProfileSettings> {
    const response = await api.patch('/api/public-profiles/me/settings', settings);
    return response.data;
  }

  /**
   * Bloquear usuário
   */
  async blockUser(userId: number): Promise<{ success: boolean }> {
    const response = await api.post(`/api/public-profiles/block/${userId}`);
    return response.data;
  }

  /**
   * Desbloquear usuário
   */
  async unblockUser(userId: number): Promise<{ success: boolean }> {
    const response = await api.delete(`/api/public-profiles/block/${userId}`);
    return response.data;
  }

  /**
   * Lista usuários bloqueados
   */
  async getBlockedUsers(): Promise<number[]> {
    const response = await api.get('/api/public-profiles/me/blocked');
    return response.data;
  }

  // ========================================
  // UTILIDADES
  // ========================================

  /**
   * Verifica se username está disponível
   */
  async checkUsernameAvailability(username: string): Promise<{ available: boolean }> {
    const response = await api.get('/api/public-profiles/check-username', {
      params: { username },
    });
    return response.data;
  }

  /**
   * Gera link público do perfil
   */
  getProfilePublicUrl(username: string): string {
    return `${window.location.origin}/profile/${username}`;
  }

  /**
   * Gera link de compartilhamento de catálogo
   */
  getCatalogPublicUrl(catalogId: number): string {
    return `${window.location.origin}/catalog/${catalogId}`;
  }
}

export const publicProfileService = new PublicProfileService();
