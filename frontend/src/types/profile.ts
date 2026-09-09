/**
 * 👤 Tipos para Funcionalidade de Perfis Públicos e Descoberta
 *
 * Sistema de perfis profissionais focado em descoberta de negócios
 * e visualização de catálogos públicos.
 */

// ========================================
// PERFIL PÚBLICO
// ========================================

export type ProfileType = 'empresa' | 'criador' | 'revendedor';

export type ProfileVisibility = 'publico' | 'semi-publico' | 'privado';

export interface PublicProfile {
  id: number;
  userId: number;
  username: string;
  displayName: string; // Nome da empresa ou nome do usuário
  bio: string; // Descrição curta (max 160 chars)
  description?: string; // Descrição completa
  avatar?: string; // URL do avatar/logo
  coverImage?: string; // Imagem de capa (opcional)

  // Classificação
  profileType: ProfileType;
  segments: string[]; // Tags de segmento ["Moda", "Eletrônicos"]

  // Localização (opcional)
  city?: string;
  state?: string;
  country?: string;

  // Métricas públicas
  catalogCount: number;
  followersCount?: number;
  followingCount?: number;

  // Configurações de privacidade
  visibility: ProfileVisibility;
  allowMessages: boolean;
  showInSearch: boolean;

  // Metadados
  createdAt: string;
  updatedAt: string;

  // Relacionamento com usuário logado
  isFollowing?: boolean;
  isSaved?: boolean;
}

// ========================================
// CATÁLOGO PÚBLICO (simplificado)
// ========================================

export interface PublicCatalog {
  id: number;
  title: string;
  description?: string;
  coverImage?: string;

  // Métricas
  viewCount: number;
  likeCount: number;

  // Autor
  profileId: number;
  profileName: string;
  profileAvatar?: string;

  // Status
  isPublic: boolean;
  isLiked?: boolean; // Se o usuário logado curtiu

  createdAt: string;
  updatedAt: string;
}

// ========================================
// BUSCA DE PERFIS
// ========================================

export interface ProfileSearchFilters {
  query?: string; // Nome, username, empresa
  profileType?: ProfileType;
  segments?: string[];
  city?: string;
  state?: string;
  hasPublicCatalogs?: boolean;
}

export interface ProfileSearchResult {
  profiles: PublicProfile[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ========================================
// CARD DE PERFIL (para listagens)
// ========================================

export interface ProfileCardData {
  id: number;
  displayName: string;
  bio: string;
  avatar?: string;
  profileType: ProfileType;
  segments: string[];
  catalogCount: number;
  followersCount?: number;
  isFollowing?: boolean;
}

// ========================================
// INTERAÇÕES
// ========================================

export interface ProfileInteraction {
  profileId: number;
  action: 'follow' | 'unfollow' | 'save' | 'unsave' | 'block';
  timestamp: string;
}

export interface CatalogInteraction {
  catalogId: number;
  action: 'like' | 'unlike' | 'view' | 'share';
  timestamp: string;
}

// ========================================
// CONFIGURAÇÕES DE PERFIL
// ========================================

export interface ProfileSettings {
  visibility: ProfileVisibility;
  showInSearch: boolean;
  allowMessages: boolean;
  allowFollows: boolean;
  showFollowersCount: boolean;
  showCatalogCount: boolean;
}

export interface UpdateProfileRequest {
  displayName?: string;
  bio?: string;
  description?: string;
  profileType?: ProfileType;
  segments?: string[];
  city?: string;
  state?: string;
  country?: string;
  settings?: Partial<ProfileSettings>;
}

// ========================================
// PERFIL DO USUÁRIO LOGADO (completo)
// ========================================

export interface MyProfile extends PublicProfile {
  email: string; // Apenas no próprio perfil
  phone?: string;

  // Estatísticas privadas
  totalViews: number;
  totalLikes: number;

  // Listas privadas
  savedProfiles: number[];
  blockedUsers: number[];

  // Configurações
  settings: ProfileSettings;
}

// ========================================
// ESTATÍSTICAS DE PERFIL
// ========================================

export interface ProfileStats {
  catalogViews: number;
  catalogLikes: number;
  profileViews: number;
  newFollowersThisWeek: number;
  topCatalog?: {
    id: number;
    title: string;
    views: number;
  };
}

// ========================================
// SEGMENTOS DISPONÍVEIS
// ========================================

export const AVAILABLE_SEGMENTS = [
  'Moda',
  'Eletrônicos',
  'Alimentos e Bebidas',
  'Casa e Decoração',
  'Esportes',
  'Beleza e Cosméticos',
  'Livros e Papelaria',
  'Brinquedos',
  'Automóveis',
  'Saúde e Bem-estar',
  'Pets',
  'Serviços',
  'Arte e Artesanato',
  'Tecnologia',
  'Outros',
] as const;

export type Segment = typeof AVAILABLE_SEGMENTS[number];
