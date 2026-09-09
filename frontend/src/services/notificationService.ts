import api from './api';

export interface Notification {
    id: number;
    recipient: number;
    organization?: number;
    type: 'message' | 'system' | 'alert';
    title: string;
    content: string;
    link?: string;
    read_at?: string;
    created_at: string;
}

export const notificationService = {
    getNotifications: async () => {
        const response = await api.get<Notification[]>('/api/notifications/');
        return response.data;
    },

    getUnreadCount: async () => {
        try {
            const response = await api.get<{ count: number }>('/api/notifications/unread_count/');
            return response.data.count;
        } catch (error: any) {
            // Se endpoint não existe (404), retorna 0 silenciosamente
            // TODO: Endpoint ainda não implementado no backend
            if (error?.response?.status === 404) {
                return 0;
            }
            throw error;
        }
    },

    markRead: async (id: number) => {
        const response = await api.post(`/api/notifications/${id}/mark_read/`);
        return response.data;
    },

    markAllRead: async () => {
        const response = await api.post('/api/notifications/mark_all_read/');
        return response.data;
    }
};
