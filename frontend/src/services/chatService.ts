import api from './api';
import type { Conversation } from '@/types/api';

export const chatService = {
    /**
     * Inicia (ou recupera) uma conversa a partir de um contexto (catálogo ou produto)
     */
    async startConversation(originType: 'catalog' | 'product', originId: number): Promise<Conversation> {
        const response = await api.post<Conversation>('/api/conversations/start/', {
            origin_type: originType,
            origin_id: originId
        });
        return response.data;
    },

    /**
     * Busca todas as conversas do usuário
     */
    async getConversations(): Promise<Conversation[]> {
        const response = await api.get<Conversation[]>('/api/conversations/');
        return response.data;
    },

    /**
     * Busca uma conversa por ID
     */
    async getConversation(id: number): Promise<Conversation> {
        const response = await api.get<Conversation>(`/api/conversations/${id}/`);
        return response.data;
    },

    /**
     * Envia uma mensagem em uma conversa
     */
    async sendMessage(conversationId: number, content: string): Promise<any> {
        const response = await api.post(`/api/conversations/${conversationId}/message/`, { content });
        return response.data;
    },

    /**
     * Marca uma conversa como lida
     */
    async markRead(conversationId: number): Promise<any> {
        const response = await api.post(`/api/conversations/${conversationId}/mark_read/`);
        return response.data;
    },

    /**
     * Busca contagem total de mensagens não lidas
     * TODO: Endpoint ainda não implementado no backend
     */
    async getUnreadCount(): Promise<{ count: number }> {
        try {
            const response = await api.get('/api/conversations/unread_count/');
            return response.data;
        } catch (error: any) {
            // Se endpoint não existe (404), retorna 0 silenciosamente
            if (error?.response?.status === 404) {
                return { count: 0 };
            }
            throw error;
        }
    }
};
