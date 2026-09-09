import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Sparkles,
  Lock,
  Upload,
  Save,
  LogOut,
  KeyRound,
  Layers,
  Clock,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { profileService, type UserProfile } from '@/services/profileService';
import api from '@/services/api';
import { useStudioStore } from '../../store/studioStore';
import { toast } from 'sonner';

interface StudioQuotaInfo {
  tier: string;
  plan_name: string;
  tokens_used_this_month: number;
  monthly_token_quota: number;
  tokens_remaining: number;
  percentage_used: number;
  max_active_catalogs: number;
  rate_limit_rpm: number;
  can_use_council: boolean;
  can_export_pdf: boolean;
}

interface AccountSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AccountSettingsModal: React.FC<AccountSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { theme } = useStudioStore();
  const isDark = theme === 'dark';

  const [activeTab, setActiveTab] = useState<'profile' | 'plan' | 'security'>('profile');
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [quota, setQuota] = useState<StudioQuotaInfo | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    position: '',
    language: 'pt-BR',
  });

  const [passwordData, setPasswordData] = useState({
    old_password: '',
    new_password: '',
    confirm_password: '',
  });

  // Fechar com Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Carregar dados quando o modal abre
  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      try {
        setIsLoading(true);

        const [profileData, preferencesData] = await Promise.all([
          profileService.getProfile(),
          profileService.getPreferences().catch(() => null),
        ]);

        setProfile(profileData);
        setFormData({
          name: profileData.name || '',
          email: profileData.email || '',
          position: profileData.position || '',
          language: preferencesData?.language || 'pt-BR',
        });

        try {
          const quotaRes = await api.get('/api/v2/studio/quotas/');
          if (quotaRes.data) {
            setQuota(quotaRes.data);
          }
        } catch {
          // Ignorar se cotas indisponíveis
        }
      } catch (error) {
        console.error('Erro ao carregar dados do perfil:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveProfile = async () => {
    if (!profile) return;

    try {
      setIsSavingProfile(true);

      const [updatedProfile] = await Promise.all([
        profileService.updateProfile({
          name: formData.name,
          position: formData.position,
        }),
        profileService.updatePreferences({
          language: formData.language,
        }),
      ]);

      setProfile(updatedProfile);
      toast.success('Perfil atualizado com sucesso');
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast.error('Erro ao salvar alteracoes do perfil');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Limite de 2MB');
      return;
    }

    if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(file.type)) {
      toast.error('Formato invalido. Use PNG, JPG ou WEBP');
      return;
    }

    try {
      setIsUploadingAvatar(true);
      const updatedProfile = await profileService.uploadAvatar(file);
      setProfile(updatedProfile);
      toast.success('Foto de perfil atualizada');
    } catch (error) {
      console.error('Erro no upload:', error);
      toast.error('Erro ao atualizar foto de perfil');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!passwordData.old_password || !passwordData.new_password || !passwordData.confirm_password) {
      toast.error('Preencha todos os campos de senha');
      return;
    }

    if (passwordData.new_password.length < 8) {
      toast.error('A nova senha deve ter no minimo 8 caracteres');
      return;
    }

    if (passwordData.new_password !== passwordData.confirm_password) {
      toast.error('A confirmacao nao coincide com a nova senha');
      return;
    }

    try {
      setIsChangingPassword(true);
      await profileService.changePassword(passwordData);
      toast.success('Senha atualizada com sucesso');
      setPasswordData({
        old_password: '',
        new_password: '',
        confirm_password: '',
      });
    } catch (error: any) {
      const msg =
        error.response?.data?.error ||
        error.response?.data?.detail ||
        'Erro ao alterar senha. Verifique a senha atual.';
      toast.error(msg);
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleLogoutAllSessions = async () => {
    try {
      await profileService.logoutAllSessions();
      toast.success('Todas as outras sessoes foram encerradas');
    } catch {
      toast.error('Erro ao encerrar outras sessoes');
    }
  };

  const getInitials = (name: string) => {
    if (!name) return 'C';
    return name
      .trim()
      .split(' ')
      .filter(Boolean)
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-xl h-[530px] rounded-2xl border shadow-2xl overflow-hidden flex flex-col transition-colors duration-200 animate-in zoom-in-95 duration-150 ${
          isDark
            ? 'bg-[#0f0f13] border-zinc-800 text-zinc-100 shadow-[0_30px_70px_rgba(0,0,0,0.95)]'
            : 'bg-white border-zinc-200 text-zinc-900 shadow-[0_20px_50px_rgba(0,0,0,0.15)]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecalho do Modal */}
        <div
          className={`px-5 py-4 flex items-center justify-between border-b shrink-0 ${
            isDark ? 'border-zinc-800/80 bg-zinc-900/40' : 'border-zinc-100 bg-zinc-50/70'
          }`}
        >
          <div>
            <h2 className="text-base font-semibold tracking-tight">Configurações</h2>
            <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
              Gerencie seus dados pessoais, plano e credenciais.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isDark
                ? 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
                : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
            }`}
            title="Fechar (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Abas de Navegacao Compactas */}
        <div
          className={`px-5 pt-3 pb-2 flex gap-1 border-b shrink-0 ${
            isDark ? 'border-zinc-800/60 bg-zinc-950/20' : 'border-zinc-100 bg-zinc-50/30'
          }`}
        >
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'profile'
                ? isDark
                  ? 'bg-zinc-800 text-white border border-zinc-700/80 shadow-xs'
                  : 'bg-zinc-900 text-white shadow-xs'
                : isDark
                ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Perfil</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('plan')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'plan'
                ? isDark
                  ? 'bg-zinc-800 text-white border border-zinc-700/80 shadow-xs'
                  : 'bg-zinc-900 text-white shadow-xs'
                : isDark
                ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Plano & IA</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'security'
                ? isDark
                  ? 'bg-zinc-800 text-white border border-zinc-700/80 shadow-xs'
                  : 'bg-zinc-900 text-white shadow-xs'
                : isDark
                ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Segurança</span>
          </button>
        </div>

        {/* Conteudo Principal das Abas */}
        <div className="flex-1 min-h-0 p-5 overflow-y-auto space-y-4">
          {isLoading ? (
            <div className="h-full flex flex-col items-center justify-center py-12 text-center text-xs text-zinc-500 gap-2.5">
              <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
              <span>Carregando informações da conta...</span>
            </div>
          ) : (
            <>
              {/* ABA 1: PERFIL */}
              {activeTab === 'profile' && (
                <div className="space-y-4">
                  {/* Avatar Compacto */}
                  <div className="flex items-center gap-4 p-3 rounded-xl border border-inherit bg-zinc-500/5">
                    <Avatar className="w-14 h-14 border border-zinc-700/80">
                      <AvatarImage src={profile?.avatar} />
                      <AvatarFallback className="bg-zinc-800 text-zinc-200 border border-zinc-700/50 text-sm font-semibold">
                        {getInitials(formData.name || profile?.username || 'C')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="space-y-1">
                      <label htmlFor="avatar-modal-upload">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isUploadingAvatar}
                          className="h-8 text-xs cursor-pointer gap-1.5"
                          asChild
                        >
                          <span>
                            <Upload className="w-3 h-3" />
                            {isUploadingAvatar ? 'Enviando...' : 'Alterar foto'}
                          </span>
                        </Button>
                      </label>
                      <input
                        id="avatar-modal-upload"
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp"
                        onChange={handleAvatarUpload}
                        className="hidden"
                      />
                      <p className="text-[11px] text-zinc-500">PNG ou JPG ate 2MB</p>
                    </div>
                  </div>

                  {/* Campos Essenciais */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="input-modal-name" className="text-xs">
                        Nome
                      </Label>
                      <Input
                        id="input-modal-name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Seu nome"
                        className="h-9 text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="input-modal-email" className="text-xs">
                        E-mail
                      </Label>
                      <Input
                        id="input-modal-email"
                        value={formData.email}
                        disabled
                        className="h-9 text-xs opacity-60 cursor-not-allowed"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="input-modal-position" className="text-xs">
                        Cargo
                      </Label>
                      <Input
                        id="input-modal-position"
                        value={formData.position}
                        onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                        placeholder="Ex: Designer Editorial"
                        className="h-9 text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="select-modal-lang" className="text-xs">
                        Idioma
                      </Label>
                      <Select
                        value={formData.language}
                        onValueChange={(val) => setFormData({ ...formData, language: val })}
                      >
                        <SelectTrigger
                          id="select-modal-lang"
                          className={`h-9 text-xs rounded-xl border transition-all cursor-pointer ${
                            isDark
                              ? 'bg-zinc-900/60 border-zinc-800 text-zinc-200 hover:border-zinc-700 hover:bg-zinc-800/40 focus:border-zinc-600'
                              : 'bg-zinc-50 border-zinc-200 text-zinc-900 hover:border-zinc-300 focus:border-zinc-400'
                          }`}
                        >
                          <SelectValue placeholder="Idioma" />
                        </SelectTrigger>
                        <SelectContent
                          className={`rounded-xl border shadow-2xl p-1.5 z-[70] backdrop-blur-md min-w-[var(--radix-select-trigger-width)] ${
                            isDark
                              ? 'bg-[#141418]/95 border-zinc-800 text-zinc-100 shadow-black/80'
                              : 'bg-white/95 border-zinc-200 text-zinc-900 shadow-zinc-300/50'
                          }`}
                        >
                          <SelectItem
                            value="pt-BR"
                            className={`text-xs rounded-lg py-2.5 pl-8 pr-3 cursor-pointer transition-colors ${
                              isDark
                                ? 'hover:bg-zinc-800/80 focus:bg-zinc-800 focus:text-white text-zinc-200'
                                : 'hover:bg-zinc-100 focus:bg-zinc-100 focus:text-zinc-950 text-zinc-800'
                            }`}
                          >
                            Portugues (Brasil)
                          </SelectItem>
                          <SelectItem
                            value="en"
                            className={`text-xs rounded-lg py-2.5 pl-8 pr-3 cursor-pointer transition-colors ${
                              isDark
                                ? 'hover:bg-zinc-800/80 focus:bg-zinc-800 focus:text-white text-zinc-200'
                                : 'hover:bg-zinc-100 focus:bg-zinc-100 focus:text-zinc-950 text-zinc-800'
                            }`}
                          >
                            English (US)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}

              {/* ABA 2: PLANO & IA */}
              {activeTab === 'plan' && (
                <div className="space-y-4">
                  {/* Plano e Tokens */}
                  <div className="p-3.5 rounded-xl border border-inherit bg-zinc-500/5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold">Plano Ativo</span>
                      <Badge
                        variant="outline"
                        className={`text-[11px] font-mono ${
                          isDark
                            ? 'bg-zinc-800/80 border-zinc-700 text-zinc-300'
                            : 'bg-zinc-200/80 border-zinc-300 text-zinc-700'
                        }`}
                      >
                        {quota?.plan_name || 'Plano Gratuito'}
                      </Badge>
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-zinc-400">Tokens de IA (Gemini)</span>
                        <span className="font-mono">
                          {quota?.tokens_used_this_month?.toLocaleString('pt-BR') || '0'} /{' '}
                          {quota?.monthly_token_quota?.toLocaleString('pt-BR') || '100.000'}
                        </span>
                      </div>
                      <div
                        className={`w-full h-2 rounded-full overflow-hidden ${
                          isDark ? 'bg-zinc-800' : 'bg-zinc-200'
                        }`}
                      >
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            isDark ? 'bg-zinc-200' : 'bg-zinc-800'
                          }`}
                          style={{ width: `${Math.min(100, quota?.percentage_used || 0)}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-zinc-500 text-right">
                        {quota?.tokens_remaining?.toLocaleString('pt-BR') || '100.000'} restantes
                      </p>
                    </div>
                  </div>

                  {/* Detalhes Concisos do Motor de IA */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="p-2.5 rounded-xl border border-inherit text-xs space-y-0.5">
                      <div className="flex items-center gap-1.5 text-zinc-500">
                        <Clock className="w-3 h-3" />
                        <span>Taxa de Requisicoes</span>
                      </div>
                      <p className="font-semibold">{quota?.rate_limit_rpm || 15} RPM</p>
                    </div>

                    <div className="p-2.5 rounded-xl border border-inherit text-xs space-y-0.5">
                      <div className="flex items-center gap-1.5 text-zinc-500">
                        <Layers className="w-3 h-3" />
                        <span>Catalogos Ativos</span>
                      </div>
                      <p className="font-semibold">Ate {quota?.max_active_catalogs || 5}</p>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl border border-inherit flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="text-xs font-medium">Google Gemini 2.0 Flash</span>
                    </div>
                    <span className="text-[11px] text-emerald-400 font-medium">Conectado</span>
                  </div>
                </div>
              )}

              {/* ABA 3: SEGURANCA */}
              {activeTab === 'security' && (
                <div className="space-y-4">
                  <form onSubmit={handleChangePassword} className="space-y-3">
                    <div className="space-y-1">
                      <Label htmlFor="modal-old-pass" className="text-xs">
                        Senha Atual
                      </Label>
                      <Input
                        id="modal-old-pass"
                        type="password"
                        value={passwordData.old_password}
                        onChange={(e) => setPasswordData({ ...passwordData, old_password: e.target.value })}
                        placeholder="Sua senha atual"
                        className="h-9 text-xs"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <Label htmlFor="modal-new-pass" className="text-xs">
                          Nova Senha
                        </Label>
                        <Input
                          id="modal-new-pass"
                          type="password"
                          value={passwordData.new_password}
                          onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                          placeholder="Minimo 8 caracteres"
                          className="h-9 text-xs"
                          required
                        />
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="modal-conf-pass" className="text-xs">
                          Confirmar Nova Senha
                        </Label>
                        <Input
                          id="modal-conf-pass"
                          type="password"
                          value={passwordData.confirm_password}
                          onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                          placeholder="Repita a nova senha"
                          className="h-9 text-xs"
                          required
                        />
                      </div>
                    </div>

                    <div className="pt-1 flex justify-end">
                      <Button
                        type="submit"
                        disabled={isChangingPassword}
                        className={`h-8 text-xs cursor-pointer gap-1.5 ${
                          isDark
                            ? 'bg-zinc-100 hover:bg-white text-zinc-950 font-medium'
                            : 'bg-zinc-900 hover:bg-zinc-800 text-white font-medium'
                        }`}
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                        {isChangingPassword ? 'Atualizando...' : 'Atualizar Senha'}
                      </Button>
                    </div>
                  </form>

                  <Separator className={isDark ? 'bg-zinc-800' : 'bg-zinc-200'} />

                  <div className="flex items-center justify-between pt-1">
                    <div>
                      <p className="text-xs font-medium">Outras Sessoes Ativas</p>
                      <p className="text-[11px] text-zinc-500">
                        Desconectar outros dispositivos conectados
                      </p>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleLogoutAllSessions}
                      className="h-8 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10 cursor-pointer gap-1.5"
                    >
                      <LogOut className="w-3 h-3" />
                      Encerrar sessoes
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Rodape do Modal com Altura Fixa e Consistente */}
        <div
          className={`px-5 py-3 border-t flex items-center justify-between transition-colors shrink-0 ${
            isDark ? 'border-zinc-800/80 bg-zinc-900/30' : 'border-zinc-100 bg-zinc-50/70'
          }`}
        >
          {activeTab === 'profile' ? (
            <>
              <span className="text-[11px] text-zinc-500">
                Preferências do Studio salvas na conta.
              </span>
              <Button
                onClick={handleSaveProfile}
                disabled={isSavingProfile}
                className={`h-8 px-4 text-xs cursor-pointer gap-1.5 rounded-lg transition-all ${
                  isDark
                    ? 'bg-zinc-100 hover:bg-white text-zinc-950 font-medium shadow-xs'
                    : 'bg-zinc-900 hover:bg-zinc-800 text-white font-medium shadow-xs'
                }`}
              >
                <Save className="w-3.5 h-3.5" />
                {isSavingProfile ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </>
          ) : activeTab === 'plan' ? (
            <>
              <span className="text-[11px] text-zinc-500">
                Cotas de tokens e limites de taxa renovados a cada ciclo mensal.
              </span>
              <Badge
                variant="outline"
                className={`text-[10px] font-mono ${
                  isDark
                    ? 'bg-zinc-800/80 border-zinc-700 text-zinc-300'
                    : 'bg-zinc-200/80 border-zinc-300 text-zinc-700'
                }`}
              >
                {quota?.plan_name || 'Plano Gratuito'}
              </Badge>
            </>
          ) : (
            <>
              <span className="text-[11px] text-zinc-500">
                Altere sua senha periodicamente para manter a segurança da conta.
              </span>
              <Badge
                variant="outline"
                className={`text-[10px] font-mono ${
                  isDark
                    ? 'bg-zinc-800/80 border-zinc-700 text-zinc-300'
                    : 'bg-zinc-200/80 border-zinc-300 text-zinc-700'
                }`}
              >
                Sessão Ativa
              </Badge>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
