// Types baseados no swagger da API Catana

export type UserRole = 'admin' | 'editor' | 'viewer';

export interface Sede {
  id: number;
  name: string;
  organization: number;
  responsible_user?: number | null;
  members_count?: number;
  created_at: string;
  updated_at: string;
}

export interface SedeSharing {
  id: number;
  source_sede: number;
  target_sede: number;
  resource_type: 'media' | 'catalog' | 'all';
  permission_level: 'read' | 'write';
  created_at: string;
}

export interface Organization {
  id: number;
  name: string;
  description?: string;
  logo?: string | null;
  owner: number;
  created_at: string;
  updated_at: string;
  sedes?: Sede[];
  default_sede?: number;
}

export interface User {
  id: number;
  username: string;
  email: string;
  avatar?: string | null;
  role: UserRole;
  organizations: Organization[];
  sedes?: Sede[];
}

export interface TokenObtainPair {
  username: string;
  password: string;
}

export interface TokenResponse {
  access: string;
  refresh: string;
}

export interface TokenRefresh {
  refresh: string;
}

export interface TokenRefreshResponse {
  access: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

// Product types
export interface Product {
  id: number;
  name: string;
  description: string;
  price: string;
  sku: string;
  created_at: string;
  updated_at: string;
  image: number | null;
  created_by: number;
  likes_count?: number;
  saves_count?: number;
  is_liked?: boolean;
  is_saved?: boolean;
}

// Media types
export type MediaType = 'image' | 'video' | 'document' | 'other';

export interface MediaFolder {
  id: number;
  name: string;
  parent: number | null;
  created_at: string;
  created_by: number;
}

export interface Media {
  id: number;
  file: string;
  file_url: string;
  name: string;
  description: string | null;
  media_type: MediaType;
  mime_type: string;
  file_size: number;
  file_size_formatted: string;
  width: number | null;
  height: number | null;
  duration: number | null;
  folder: number | null;
  folder_name: string | null;
  tags: string[];
  is_favorite: boolean;
  usage_count: number;
  created_at: string;
  updated_at: string;
  uploaded_by: number;
}

export interface MediaStats {
  total_files: number;
  folders_count: number;
  total_size: number;
  total_size_formatted: string;
  images_count: number;
  videos_count: number;
  documents_count: number;
  favorites_count: number;
}

// Theme types
export interface Theme {
  id: number;
  name: string;
  styles: Record<string, any>;
  created_at: string;
  created_by: number;
}

// Catalog types
export interface Catalog {
  id: number;
  title: string;
  description: string;
  theme: number;
  organization: number;
  sede: number | null;
  created_by: number;
  created_at: string;
  updated_at: string;
  is_public?: boolean;
  is_demo?: boolean;
  status?: 'published' | 'draft' | 'archived';
  cover_image?: string;
  pages_count?: number;
  author_name?: string;
  author_avatar?: string;
  pages?: Page[];
  likes_count?: number;
  saves_count?: number;
  is_liked?: boolean;
  is_saved?: boolean;

  // 🏢 Informações de Organização e Sede para Explorer
  organization_name?: string;
  organization_logo?: string | null;
  sede_name?: string | null;
}

// Page types
export interface Page {
  id: number;
  order: number;
  created_at: string;
  catalog: number;
  background_image: number | null;
  background_image_url?: string;
}

// Component types
export type ComponentType = 'text' | 'image' | 'product';

export interface Component {
  id: number;
  name: string;
  component_type: ComponentType;
  content: Record<string, any>;
  is_reusable: boolean;
  created_at: string;
  created_by: number;
}

// PageComponent types
export interface PageComponent {
  id: number;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  layer: number;
  page: number;
  component: number;
}

// Comment types
export interface Comment {
  id: number;
  text: string;
  created_at: string;
  position_x: number | null;
  position_y: number | null;
  catalog: number;
  user: number;
}

// Activity types
export interface Activity {
  id: number;
  action: string;
  timestamp: string;
  details: Record<string, any> | null;
  user: number;
}

// Dashboard types
export interface DashboardStats {
  catalogs: number;
  catalogs_change: string;
  catalogs_percentage: number;

  products: number;
  products_change: string;
  products_percentage: number;

  library: number;
  library_change: string;
  library_percentage: number;

  history: number;
  history_change: string;
  history_percentage: number;
}

// API Error types
export interface APIError {
  message: string;
  status: number;
  errors?: Record<string, string[]>;
}

// Chat Types
export interface Message {
  id: number;
  conversation: number;
  sender: number;
  sender_name?: string;
  sender_username?: string;
  sender_avatar?: string;
  content: string;
  read_at: string | null;
  created_at: string;
}

export interface Conversation {
  id: number;
  organization: number;
  sede: number | null;
  origin_type: 'catalog' | 'product';
  origin_id: number;
  status: 'open' | 'closed';
  participants: User[]; // Or just IDs if strict, but Serializer usually returns Objects. My Plan said User objects.
  messages: Message[];
  last_message: Message | null;
  context?: {
    title: string;
    image: string | null;
    subtitle: string | null;
  };
  unread_count?: number;
  created_at: string;
  updated_at: string;
}

