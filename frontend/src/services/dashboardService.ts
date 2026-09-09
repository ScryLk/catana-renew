import api from './api';
import type { DashboardStats, Catalog, Activity } from '@/types/api';
import { useAuthStore } from '@/store/authStore';

export const dashboardService = {
  /**
   * Busca estatísticas do dashboard do usuário
   * @returns Estatísticas do dashboard incluindo catálogos, produtos, biblioteca e histórico
   */
  async getStats(): Promise<DashboardStats> {
    try {
      const response = await api.get<DashboardStats>('/api/dashboard/stats/');
      return response.data;
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      // Return zeroed stats on error to prevent crash
      return {
        catalogs: 0, catalogs_change: '-', catalogs_percentage: 0,
        products: 0, products_change: '-', products_percentage: 0,
        library: 0, library_change: '-', library_percentage: 0,
        history: 0, history_change: '-', history_percentage: 0,
      };
    }
  },

  /**
   * Busca os catálogos mais recentes
   */
  async getRecentCatalogs(params?: { sede?: number; organization?: number }): Promise<Catalog[]> {
    try {
      const queryParams = new URLSearchParams();
      if (params?.sede) queryParams.append('sede', params.sede.toString());
      if (params?.organization) queryParams.append('organization', params.organization.toString());

      const response = await api.get<Catalog[]>(`/api/catalogs/?${queryParams.toString()}`);
      // Sort by created_at desc and take top 5
      return response.data
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5);
    } catch (error) {
      console.error('Error fetching recent catalogs:', error);
      return [];
    }
  },

  /**
   * Busca as atividades recentes
   */
  async getActivities(): Promise<Activity[]> {
    try {
      const response = await api.get<Activity[]>('/api/activities/');
      // Sort by timestamp desc and take top 5
      return response.data
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 5);
    } catch (error) {
      console.error('Error fetching activities:', error);
      return [];
    }
  },

  /**
   * Busca todos os catálogos
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
   * Remove um catálogo
   */
  async deleteCatalog(id: number): Promise<void> {
    await api.delete(`/api/catalogs/${id}/`);
  },

  /**
   * Cria um novo catálogo
   */
  async createCatalog(title: string, description: string = ''): Promise<Catalog> {
    const user = useAuthStore.getState().user;

    // Get context from localStorage
    const storedSede = localStorage.getItem('active_sede');
    const storedOrg = localStorage.getItem('active_organization');

    // Helper to extract ID
    const getId = (item: string | null) => {
      if (!item) return undefined;
      try {
        const parsed = JSON.parse(item);
        return parsed.id ? Number(parsed.id) : Number(item);
      } catch {
        return Number(item);
      }
    };

    const sedeId = getId(storedSede);
    const orgId = getId(storedOrg);

    const payload: any = {
      title,
      description,
      created_by: user?.id
    };

    if (sedeId && !isNaN(sedeId)) {
      payload.sede = sedeId;
    }

    if (orgId && !isNaN(orgId)) {
      payload.organization = orgId;
    }

    const response = await api.post<Catalog>('/api/catalogs/', payload);
    return response.data;
  },
};
