import api from './api';
import type { Organization, Sede } from '@/types/api';

export const organizationService = {
    /**
     * List user's organizations
     */
    async getOrganizations(): Promise<Organization[]> {
        const response = await api.get<Organization[]>('/api/organizations/');
        return response.data;
    },

    /**
     * Create a new organization
     */
    async createOrganization(data: Pick<Organization, 'name' | 'description'>): Promise<Organization> {
        const response = await api.post<Organization>('/api/organizations/', data);
        return response.data;
    },

    /**
     * Update an organization
     */
    async updateOrganization(id: number, data: Partial<Organization>): Promise<Organization> {
        const response = await api.patch<Organization>(`/api/organizations/${id}/`, data);
        return response.data;
    },

    /**
     * Delete an organization
     */
    async deleteOrganization(id: number): Promise<void> {
        await api.delete(`/api/organizations/${id}/`);
    },

    getActiveOrganizationId(): number | null {
        try {
            const stored = localStorage.getItem('active_organization');
            if (!stored) return null;
            const org = JSON.parse(stored);
            return org.id || null;
        } catch {
            return null;
        }
    },

    /**
     * Sede operations
     */
    async createSede(organizationId: number, data: Pick<Sede, 'name'>): Promise<Sede> {
        const response = await api.post<Sede>('/api/sedes/', { ...data, organization: organizationId });
        return response.data;
    },

    async updateSede(id: number, data: Partial<Pick<Sede, 'name'>>): Promise<Sede> {
        const response = await api.patch<Sede>(`/api/sedes/${id}/`, data);
        return response.data;
    },

    async deleteSede(id: number): Promise<void> {
        await api.delete(`/api/sedes/${id}/`);
    },

    /**
     * Sharing operations
     */
    async createShare(data: { source_sede: number; target_sede: number; resource_type: string; permission_level: string }): Promise<any> {
        const response = await api.post('/api/sede-shares/', data);
        return response.data;
    },

    async getShares(sedeId: number, type: 'sent' | 'received'): Promise<any[]> {
        const params = new URLSearchParams();
        if (type === 'sent') params.append('source_sede', sedeId.toString());
        if (type === 'received') params.append('target_sede', sedeId.toString());

        const response = await api.get(`/api/sede-shares/?${params}`);
        return response.data;
    },

    async deleteShare(id: number): Promise<void> {
        await api.delete(`/api/sede-shares/${id}/`);
    },

    getActiveSedeId(): number | null {
        try {
            const stored = localStorage.getItem('active_sede');
            if (!stored) return null;
            const sede = JSON.parse(stored);
            return sede.id || null;
        } catch {
            return null;
        }
    }
};
