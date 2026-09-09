import api from './api';

export interface UserProfile {
  id: number;
  username: string;
  email: string;
  name?: string;
  avatar?: string;
  position?: string;
  role: string;
  last_login?: string;
  created_at: string;
  updated_at: string;
}

export interface UpdateProfileData {
  name?: string;
  position?: string;
  avatar?: string;
}

export interface ChangePasswordData {
  old_password: string;
  new_password: string;
  confirm_password: string;
}

export interface UserPreferences {
  language: string;
  theme: string;
  notify_on_publish: boolean;
  notify_on_updates: boolean;
}

export interface ActivityLog {
  id: number;
  action: string;
  description: string;
  created_at: string;
  catalog_title?: string;
}

export const profileService = {
  // Obter perfil do usuário
  getProfile: async (): Promise<UserProfile> => {
    const response = await api.get('/api/profile/');
    return response.data;
  },

  // Atualizar perfil
  updateProfile: async (data: UpdateProfileData): Promise<UserProfile> => {
    const response = await api.patch('/api/profile/', data);
    return response.data;
  },

  // Alterar senha
  changePassword: async (data: ChangePasswordData): Promise<{ message: string }> => {
    const response = await api.post('/api/profile/change-password/', data);
    return response.data;
  },

  // Upload de avatar
  uploadAvatar: async (file: File): Promise<UserProfile> => {
    const formData = new FormData();
    formData.append('avatar', file);
    const response = await api.post('/api/profile/avatar/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Obter preferências
  getPreferences: async (): Promise<UserPreferences> => {
    const response = await api.get('/api/profile/preferences/');
    return response.data;
  },

  // Atualizar preferências
  updatePreferences: async (data: Partial<UserPreferences>): Promise<UserPreferences> => {
    const response = await api.patch('/api/profile/preferences/', data);
    return response.data;
  },

  // Obter atividades recentes
  getRecentActivity: async (): Promise<ActivityLog[]> => {
    const response = await api.get('/api/profile/activity/');
    return response.data;
  },

  // Encerrar todas as sessões
  logoutAllSessions: async (): Promise<{ message: string }> => {
    const response = await api.post('/api/profile/logout-all/');
    return response.data;
  },
};
