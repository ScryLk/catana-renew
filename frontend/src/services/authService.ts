import api from './api';
import type { LoginCredentials, TokenResponse, TokenRefreshResponse, User } from '../types/api';

class AuthService {
  /**
   * Realiza login e retorna tokens JWT
   * POST /api/auth/token/
   */
  async login(credentials: LoginCredentials): Promise<TokenResponse> {
    const response = await api.post<TokenResponse>('/api/auth/token/', credentials);
    return response.data;
  }

  /**
   * Renova o access token usando o refresh token
   * POST /api/auth/token/refresh/
   */
  async refreshToken(refreshToken: string): Promise<TokenRefreshResponse> {
    const response = await api.post<TokenRefreshResponse>('/api/auth/token/refresh/', {
      refresh: refreshToken,
    });
    return response.data;
  }

  /**
   * Obtém informações do usuário atual
   * Nota: A API não tem um endpoint /me, então vamos precisar
   * decodificar o JWT ou buscar o usuário pelo ID
   */
  async getCurrentUser(userId: number): Promise<User> {
    const response = await api.get<User>(`/api/users/${userId}/`);
    return response.data;
  }

  /**
   * Salva tokens no localStorage
   */
  saveTokens(tokens: TokenResponse): void {
    localStorage.setItem('access_token', tokens.access);
    localStorage.setItem('refresh_token', tokens.refresh);
  }

  /**
   * Remove tokens do localStorage
   */
  clearTokens(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
  }

  /**
   * Verifica se o usuário está autenticado
   */
  isAuthenticated(): boolean {
    const token = localStorage.getItem('access_token');
    return !!token;
  }

  /**
   * Obtém o access token do localStorage
   */
  getAccessToken(): string | null {
    return localStorage.getItem('access_token');
  }

  /**
   * Obtém o refresh token do localStorage
   */
  getRefreshToken(): string | null {
    return localStorage.getItem('refresh_token');
  }

  /**
   * Decodifica o JWT para extrair informações do usuário
   * Nota: Isso NÃO verifica a assinatura do token
   */
  decodeToken(token: string): any {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Erro ao decodificar token:', error);
      return null;
    }
  }

  /**
   * Verifica se o token está expirado
   */
  isTokenExpired(token: string): boolean {
    const decoded = this.decodeToken(token);
    if (!decoded || !decoded.exp) return true;

    const currentTime = Date.now() / 1000;
    return decoded.exp < currentTime;
  }

  /**
   * Realiza logout
   */
  logout(): void {
    this.clearTokens();
  }
}

export const authService = new AuthService();
export default authService;
