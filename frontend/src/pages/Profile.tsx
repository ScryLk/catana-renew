import { useState, useEffect, type FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  ArrowLeft,
  User,
  Sparkles,
  ShieldCheck,
  Activity,
  Upload,
  Save,
  LogOut,
  Sun,
  Moon,
  KeyRound,
  CheckCircle2,
  Lock,
  Zap,
  Cpu,
  Clock,
  Mail,
  Briefcase,
  Layers,
} from 'lucide-react';
import {
  profileService,
  type UserProfile,
  type ActivityLog,
} from '@/services/profileService';
import api from '@/services/api';
import { useStudioStore } from '../store/studioStore';
import { toast } from 'sonner';
import { LoadingScreen } from '@/components/common/LoadingScreen';

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

export const Profile: FC = () => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useStudioStore();
  const isDark = theme === 'dark';

  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Estados dos dados
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [recentActivity, setRecentActivity] = useState<ActivityLog[]>([]);
  const [quota, setQuota] = useState<StudioQuotaInfo | null>(null);

  // Estados do formulario geral
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    position: '',
    language: 'pt-BR',
    notifyOnPublish: true,
    notifyOnUpdates: true,
  });

  // Estados do formulario de senha
  const [passwordData, setPasswordData] = useState({
    old_password: '',
    new_password: '',
    confirm_password: '',
  });

  // Atalho de teclado: tecla Escape retorna ao Studio
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        navigate('/');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  // Carregar dados de perfil, preferencias, atividades e cotas
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);

        const [profileData, preferencesData, activityData] = await Promise.all([
          profileService.getProfile(),
          profileService.getPreferences(),
          profileService.getRecentActivity(),
        ]);

        setProfile(profileData);
        setRecentActivity(activityData);

        setFormData({
          name: profileData.name || '',
          email: profileData.email || '',
          position: profileData.position || '',
          language: preferencesData.language || 'pt-BR',
          notifyOnPublish: preferencesData.notify_on_publish ?? true,
          notifyOnUpdates: preferencesData.notify_on_updates ?? true,
        });

        // Buscar dados de cota do Studio
        try {
          const quotaRes = await api.get('/api/v2/studio/quotas/');
          if (quotaRes.data) {
            setQuota(quotaRes.data);
          }
        } catch (quotaErr) {
          console.warn('Nao foi possivel carregar cotas em tempo real:', quotaErr);
        }
      } catch (error) {
        console.error('Erro ao carregar dados do perfil:', error);
        toast.error('Erro ao carregar dados do perfil');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

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
          notify_on_publish: formData.notifyOnPublish,
          notify_on_updates: formData.notifyOnUpdates,
        }),
      ]);

      setProfile(updatedProfile);
      toast.success('Informacoes atualizadas com sucesso');
    } catch (error) {
      console.error('Erro ao salvar informacoes:', error);
      toast.error('Erro ao salvar alteracoes do perfil');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Arquivo muito grande. O limite e de 2MB');
      return;
    }

    if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(file.type)) {
      toast.error('Formato invalido. Envie uma imagem PNG, JPG ou WEBP');
      return;
    }

    try {
      setIsUploadingAvatar(true);
      const updatedProfile = await profileService.uploadAvatar(file);
      setProfile(updatedProfile);
      toast.success('Foto de perfil atualizada com sucesso');
    } catch (error) {
      console.error('Erro ao fazer upload da imagem:', error);
      toast.error('Erro ao atualizar foto de perfil');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!passwordData.old_password || !passwordData.new_password || !passwordData.confirm_password) {
      toast.error('Preencha todos os campos para alterar a senha');
      return;
    }

    if (passwordData.new_password.length < 8) {
      toast.error('A nova senha deve ter no minimo 8 caracteres');
      return;
    }

    if (passwordData.new_password !== passwordData.confirm_password) {
      toast.error('A confirmacao de senha nao coincide com a nova senha');
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
      console.error('Erro ao alterar senha:', error);
      const msg =
        error.response?.data?.error ||
        error.response?.data?.detail ||
        'Erro ao alterar senha. Verifique a senha atual informada.';
      toast.error(msg);
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleLogoutAllSessions = async () => {
    try {
      await profileService.logoutAllSessions();
      toast.success('Todas as sessoes ativas foram encerradas');
    } catch (error) {
      console.error('Erro ao encerrar sessoes:', error);
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

  if (isLoading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-[#09090b]' : 'bg-[#fafafa]'}`}>
        <LoadingScreen message="Carregando configuracoes da conta..." />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-6 ${isDark ? 'bg-[#09090b] text-zinc-100' : 'bg-[#fafafa] text-zinc-900'}`}>
        <p className="text-sm text-zinc-400 mb-4">Nao foi possivel carregar os dados do seu perfil.</p>
        <Button onClick={() => navigate('/')} variant="outline">
          Voltar ao Studio
        </Button>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen transition-colors duration-200 ${
        isDark ? 'bg-[#09090b] text-zinc-100' : 'bg-[#fafafa] text-zinc-900'
      }`}
    >
      {/* Barra Superior Editorial Catana 2.0 */}
      <header
        className={`sticky top-0 z-40 border-b backdrop-blur-md transition-colors ${
          isDark
            ? 'bg-[#09090b]/85 border-zinc-800/80 text-zinc-100'
            : 'bg-white/85 border-zinc-200 text-zinc-900'
        }`}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          {/* Esquerda: Retorno ao Studio e Marca */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className={`gap-2 text-xs font-medium cursor-pointer transition-colors ${
                isDark
                  ? 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80'
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
              }`}
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar ao Studio</span>
              <kbd
                className={`hidden sm:inline-block text-[10px] px-1.5 py-0.5 rounded font-mono border ${
                  isDark
                    ? 'bg-zinc-800/80 border-zinc-700 text-zinc-400'
                    : 'bg-zinc-100 border-zinc-300 text-zinc-500'
                }`}
              >
                Esc
              </kbd>
            </Button>

            <Separator
              orientation="vertical"
              className={`h-4 ${isDark ? 'bg-zinc-800' : 'bg-zinc-200'}`}
            />

            {/* Logo de assinatura Catana 2.0 */}
            <div className="flex items-center gap-2">
              <svg
                viewBox="40 10 640 170"
                className={`h-4.5 fill-none stroke-current ${
                  isDark ? 'text-white' : 'text-zinc-950'
                }`}
                strokeWidth="8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path
                  d="M 132 96 C 124 82 104 76 88 86 C 70 97 62 122 74 138 C 84 150 104 148 116 136 C 128 148 146 142 158 120 C 170 100 190 90 206 90 C 194 78 172 80 160 94 C 148 108 148 128 160 140 C 170 149 186 145 196 132 C 202 124 206 108 208 92 C 206 112 206 130 214 142 C 222 152 236 146 244 128 C 256 102 270 66 282 44 C 280 70 276 110 278 132 C 280 148 294 152 308 138 C 322 124 344 100 384 90 C 370 78 348 80 336 94 C 324 108 324 128 336 140 C 346 149 362 145 372 132 C 378 124 382 108 384 92 C 382 112 382 130 390 142 C 398 152 412 146 420 128 C 428 110 438 96 446 88 C 448 106 446 128 448 142 C 458 116 472 94 486 88 C 494 84 498 92 498 104 C 498 120 496 132 502 142 C 508 150 520 146 528 128 C 536 112 560 92 592 90 C 578 78 556 80 544 94 C 532 108 532 128 544 140 C 554 149 570 145 580 132 C 586 124 590 108 592 92 C 590 112 590 130 598 142 C 608 154 626 148 640 124"
                />
                <path d="M 250 76 C 272 68 300 64 328 70" />
              </svg>
              <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded border bg-purple-500/10 border-purple-500/20 text-purple-400">
                2.0
              </span>
            </div>
          </div>

          {/* Direita: Alternador de Tema e Avatar */}
          <div className="flex items-center gap-2.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className={`w-8 h-8 rounded-lg cursor-pointer transition-colors ${
                isDark
                  ? 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
              }`}
              title={isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>

            <div
              className={`hidden sm:flex items-center gap-2 pl-2 border-l ${
                isDark ? 'border-zinc-800' : 'border-zinc-200'
              }`}
            >
              <Avatar className="w-7 h-7">
                <AvatarImage src={profile.avatar} />
                <AvatarFallback className="bg-purple-600 text-white text-xs">
                  {getInitials(profile.name || profile.username)}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs font-medium text-zinc-300 truncate max-w-[140px]">
                {profile.name || profile.username}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Conteudo Principal */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Cabecalho da Pagina */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Configuracoes da Conta
              </h1>
              <Badge
                variant="outline"
                className="bg-purple-500/10 border-purple-500/20 text-purple-400 text-xs"
              >
                {quota?.plan_name || 'Plano Gratuito'}
              </Badge>
            </div>
            <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
              Gerencie dados cadastrais, cotas de IA do Google Gemini e diretrizes de seguranca.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`text-xs px-2.5 py-1 rounded-md border font-mono ${
                isDark
                  ? 'bg-zinc-900 border-zinc-800 text-zinc-400'
                  : 'bg-zinc-100 border-zinc-200 text-zinc-600'
              }`}
            >
              ID: {profile.username || profile.email}
            </span>
          </div>
        </div>

        {/* Sistema de Abas */}
        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList
            className={`p-1 rounded-xl border flex flex-wrap h-auto gap-1 ${
              isDark
                ? 'bg-zinc-900/90 border-zinc-800 text-zinc-400'
                : 'bg-zinc-100 border-zinc-200 text-zinc-600'
            }`}
          >
            <TabsTrigger
              value="profile"
              className="gap-2 cursor-pointer data-[state=active]:bg-purple-600 data-[state=active]:text-white text-xs sm:text-sm py-2 px-3.5 rounded-lg transition-all"
            >
              <User className="w-4 h-4" />
              Geral & Perfil
            </TabsTrigger>
            <TabsTrigger
              value="plan"
              className="gap-2 cursor-pointer data-[state=active]:bg-purple-600 data-[state=active]:text-white text-xs sm:text-sm py-2 px-3.5 rounded-lg transition-all"
            >
              <Sparkles className="w-4 h-4" />
              Plano & IA (Gemini)
            </TabsTrigger>
            <TabsTrigger
              value="security"
              className="gap-2 cursor-pointer data-[state=active]:bg-purple-600 data-[state=active]:text-white text-xs sm:text-sm py-2 px-3.5 rounded-lg transition-all"
            >
              <ShieldCheck className="w-4 h-4" />
              Seguranca & Acesso
            </TabsTrigger>
            <TabsTrigger
              value="activity"
              className="gap-2 cursor-pointer data-[state=active]:bg-purple-600 data-[state=active]:text-white text-xs sm:text-sm py-2 px-3.5 rounded-lg transition-all"
            >
              <Activity className="w-4 h-4" />
              Historico de Atividades
            </TabsTrigger>
          </TabsList>

          {/* ABA 1: Geral & Perfil */}
          <TabsContent value="profile" className="space-y-6 mt-0">
            <Card
              className={`border transition-colors ${
                isDark ? 'bg-zinc-900/60 border-zinc-800' : 'bg-white border-zinc-200 shadow-sm'
              }`}
            >
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base sm:text-lg">Informacoes Pessoais</CardTitle>
                    <CardDescription className={isDark ? 'text-zinc-400' : 'text-zinc-500'}>
                      Atualize seu nome, cargo institucional e imagem de perfil do Studio.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Secao de Avatar */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 p-4 rounded-xl border border-dashed border-inherit">
                  <Avatar className="w-20 h-20 border-2 border-purple-500/40">
                    <AvatarImage src={profile.avatar} />
                    <AvatarFallback className="bg-purple-600 text-white text-xl font-medium">
                      {getInitials(formData.name || profile.username)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <label htmlFor="avatar-upload-field">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isUploadingAvatar}
                          className="cursor-pointer gap-2"
                          asChild
                        >
                          <span>
                            <Upload className="w-3.5 h-3.5" />
                            {isUploadingAvatar ? 'Enviando imagem...' : 'Alterar foto de perfil'}
                          </span>
                        </Button>
                      </label>
                      <input
                        id="avatar-upload-field"
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp"
                        onChange={handleAvatarUpload}
                        className="hidden"
                      />
                    </div>
                    <p className={`text-xs ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>
                      Formatos recomendados: PNG, JPG ou WEBP. Tamanho maximo: 2MB.
                    </p>
                  </div>
                </div>

                <Separator className={isDark ? 'bg-zinc-800' : 'bg-zinc-200'} />

                {/* Campos do Formulario */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label htmlFor="field-name" className="text-xs font-semibold uppercase tracking-wider">
                      Nome Completo
                    </Label>
                    <div className="relative">
                      <User className="w-4 h-4 absolute left-3 top-3 text-zinc-500" />
                      <Input
                        id="field-name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Seu nome completo"
                        className="pl-9"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="field-email" className="text-xs font-semibold uppercase tracking-wider">
                      E-mail Institucional
                    </Label>
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3 top-3 text-zinc-500" />
                      <Input
                        id="field-email"
                        value={formData.email}
                        disabled
                        className="pl-9 opacity-70 cursor-not-allowed"
                      />
                    </div>
                    <p className={`text-[11px] ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>
                      O e-mail e vinculado a sua autenticacao e nao pode ser alterado diretamente.
                    </p>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="field-position" className="text-xs font-semibold uppercase tracking-wider">
                      Cargo ou Funcao
                    </Label>
                    <div className="relative">
                      <Briefcase className="w-4 h-4 absolute left-3 top-3 text-zinc-500" />
                      <Input
                        id="field-position"
                        value={formData.position}
                        onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                        placeholder="Ex: Diretor de Arte / Especialista em Catalogos"
                        className="pl-9"
                      />
                    </div>
                  </div>
                </div>

                <Separator className={isDark ? 'bg-zinc-800' : 'bg-zinc-200'} />

                {/* Preferencias de Idioma e Notificacoes */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold mb-1">Preferencias do Studio</h3>
                    <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                      Configure linguagem e alertas de publicacao no sistema.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                    <div className="space-y-2">
                      <Label htmlFor="field-lang" className="text-xs">
                        Idioma da Interface
                      </Label>
                      <Select
                        value={formData.language}
                        onValueChange={(val) => setFormData({ ...formData, language: val })}
                      >
                        <SelectTrigger id="field-lang">
                          <SelectValue placeholder="Selecione o idioma" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pt-BR">Portugues (Brasil)</SelectItem>
                          <SelectItem value="en">English (US)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between p-3.5 rounded-xl border border-inherit">
                      <div>
                        <p className="text-xs font-medium">Notificacoes de Publicacao</p>
                        <p className={`text-[11px] ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                          Receber alertas no painel ao finalizar a geracao e publicacao de um catalogo.
                        </p>
                      </div>
                      <Switch
                        checked={formData.notifyOnPublish}
                        onCheckedChange={(val) => setFormData({ ...formData, notifyOnPublish: val })}
                      />
                    </div>

                    <div className="flex items-center justify-between p-3.5 rounded-xl border border-inherit">
                      <div>
                        <p className="text-xs font-medium">Atualizacoes da Plataforma</p>
                        <p className={`text-[11px] ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                          Receber informativos sobre novos agentes de IA e recursos editoriais do Catana 2.0.
                        </p>
                      </div>
                      <Switch
                        checked={formData.notifyOnUpdates}
                        onCheckedChange={(val) => setFormData({ ...formData, notifyOnUpdates: val })}
                      />
                    </div>
                  </div>
                </div>

                {/* Botao de Salvar */}
                <div className="pt-2 flex justify-end">
                  <Button
                    onClick={handleSaveProfile}
                    disabled={isSavingProfile}
                    className="bg-purple-600 hover:bg-purple-700 text-white cursor-pointer gap-2 font-medium"
                  >
                    <Save className="w-4 h-4" />
                    {isSavingProfile ? 'Salvando...' : 'Salvar Alteracoes'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ABA 2: Plano & IA (Google Gemini) */}
          <TabsContent value="plan" className="space-y-6 mt-0">
            {/* Card de Quota e Tokens */}
            <Card
              className={`border transition-colors ${
                isDark ? 'bg-zinc-900/60 border-zinc-800' : 'bg-white border-zinc-200 shadow-sm'
              }`}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                      <Zap className="w-5 h-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base sm:text-lg">Plano de Assinatura & Cotas de IA</CardTitle>
                      <CardDescription className={isDark ? 'text-zinc-400' : 'text-zinc-500'}>
                        Consumo mensal de processamento multi-agente e capacidade de geracao.
                      </CardDescription>
                    </div>
                  </div>

                  <Badge
                    variant="outline"
                    className="bg-emerald-500/10 border-emerald-500/20 text-emerald-400 text-xs uppercase tracking-wider font-semibold"
                  >
                    {quota?.plan_name || 'Plano Gratuito'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Barra de Progresso de Tokens */}
                <div className="space-y-2.5 p-4 rounded-xl border border-inherit">
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <span className="font-medium">Consumo Mensal de Tokens de IA</span>
                    <span className="font-mono text-xs">
                      {quota?.tokens_used_this_month?.toLocaleString('pt-BR') || '0'} /{' '}
                      {quota?.monthly_token_quota?.toLocaleString('pt-BR') || '100.000'} tokens ({quota?.percentage_used || 0}%)
                    </span>
                  </div>

                  <div className={`w-full h-3 rounded-full overflow-hidden ${isDark ? 'bg-zinc-800' : 'bg-zinc-200'}`}>
                    <div
                      className="h-full bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, quota?.percentage_used || 0)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-zinc-500">
                    <span>
                      Restantes: {quota?.tokens_remaining?.toLocaleString('pt-BR') || '100.000'} tokens
                    </span>
                    <span>Renovacao automatica no dia 1 de cada mes</span>
                  </div>
                </div>

                {/* Grade de Recursos e Limites */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
                  <div className="p-3.5 rounded-xl border border-inherit space-y-1">
                    <div className="flex items-center gap-1.5 text-zinc-500 text-xs">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Taxa de Requisicoes</span>
                    </div>
                    <p className="text-lg font-bold">{quota?.rate_limit_rpm || 15} RPM</p>
                    <p className="text-[11px] text-zinc-500">Requisicoes por minuto</p>
                  </div>

                  <div className="p-3.5 rounded-xl border border-inherit space-y-1">
                    <div className="flex items-center gap-1.5 text-zinc-500 text-xs">
                      <Layers className="w-3.5 h-3.5" />
                      <span>Catalogos Simultaneos</span>
                    </div>
                    <p className="text-lg font-bold">Ate {quota?.max_active_catalogs || 5}</p>
                    <p className="text-[11px] text-zinc-500">Projetos ativos no Studio</p>
                  </div>

                  <div className="p-3.5 rounded-xl border border-inherit space-y-1">
                    <div className="flex items-center gap-1.5 text-zinc-500 text-xs">
                      <Cpu className="w-3.5 h-3.5" />
                      <span>Conselho Editorial</span>
                    </div>
                    <p className="text-sm font-semibold text-emerald-400 flex items-center gap-1 mt-1">
                      <CheckCircle2 className="w-4 h-4" />
                      6 Agentes Ativos
                    </p>
                    <p className="text-[11px] text-zinc-500">Diretor, Copy, Comercial...</p>
                  </div>

                  <div className="p-3.5 rounded-xl border border-inherit space-y-1">
                    <div className="flex items-center gap-1.5 text-zinc-500 text-xs">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Exportacao PDF A4</span>
                    </div>
                    <p className="text-sm font-semibold text-emerald-400 flex items-center gap-1 mt-1">
                      <CheckCircle2 className="w-4 h-4" />
                      Habilitada
                    </p>
                    <p className="text-[11px] text-zinc-500">Renderizacao em alta definicao</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Card de Integracao Google Gemini */}
            <Card
              className={`border transition-colors ${
                isDark ? 'bg-zinc-900/60 border-zinc-800' : 'bg-white border-zinc-200 shadow-sm'
              }`}
            >
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                    <Cpu className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base sm:text-lg">
                      Motor de Inteligencia Artificial (Google Gemini)
                    </CardTitle>
                    <CardDescription className={isDark ? 'text-zinc-400' : 'text-zinc-500'}>
                      Arquitetura de processamento neural e integracao com a API Google GenAI.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 rounded-xl border border-inherit space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-sm font-semibold">Provedor Ativo: Google Gemini 2.0 Flash</span>
                    </div>
                    <Badge variant="outline" className="bg-blue-500/10 border-blue-500/20 text-blue-400 text-xs">
                      Conexao Estavel
                    </Badge>
                  </div>
                  <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                    O Catana 2.0 executa o pipeline multi-agente utilizando o SDK oficial da Google (google-genai).
                    Os prompts estruturados coordenam o Diretor de Arte, Copywriter, Estrategista Comercial e
                    Analista de Branding com streaming em tempo real (SSE).
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-inherit space-y-3">
                  <div className="flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-purple-400" />
                    <span className="text-xs font-semibold uppercase tracking-wider">
                      Politica BYOK (Bring Your Own Key)
                    </span>
                  </div>
                  <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                    Para conectar a cota dedicada da sua organizacao da Google Cloud Platform, defina a chave na variavel
                    de ambiente <code className="font-mono bg-zinc-800/80 px-1 py-0.5 rounded text-zinc-300">GEMINI_API_KEY</code> no arquivo de configuracao do backend.
                    Caso nenhuma chave seja informada, o sistema aciona de forma transparente o provedor simulado inteligente para testes sem bloqueio.
                  </p>
                  <div className="pt-1">
                    <Badge variant="outline" className="text-[11px] text-zinc-400 border-zinc-700">
                      Modo Atual: Integracao Nativa Ativa
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ABA 3: Seguranca & Acesso */}
          <TabsContent value="security" className="space-y-6 mt-0">
            {/* Formulario de Alteracao de Senha */}
            <Card
              className={`border transition-colors ${
                isDark ? 'bg-zinc-900/60 border-zinc-800' : 'bg-white border-zinc-200 shadow-sm'
              }`}
            >
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base sm:text-lg">Alteracao de Senha</CardTitle>
                    <CardDescription className={isDark ? 'text-zinc-400' : 'text-zinc-500'}>
                      Mantenha suas credenciais seguras. A nova senha deve ter no minimo 8 caracteres.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleChangePassword} className="space-y-4 max-w-xl">
                  <div className="space-y-2">
                    <Label htmlFor="old-pass" className="text-xs font-semibold uppercase tracking-wider">
                      Senha Atual
                    </Label>
                    <Input
                      id="old-pass"
                      type="password"
                      value={passwordData.old_password}
                      onChange={(e) => setPasswordData({ ...passwordData, old_password: e.target.value })}
                      placeholder="Digite a senha atual"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="new-pass" className="text-xs font-semibold uppercase tracking-wider">
                        Nova Senha
                      </Label>
                      <Input
                        id="new-pass"
                        type="password"
                        value={passwordData.new_password}
                        onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                        placeholder="Minimo 8 caracteres"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirm-pass" className="text-xs font-semibold uppercase tracking-wider">
                        Confirmar Nova Senha
                      </Label>
                      <Input
                        id="confirm-pass"
                        type="password"
                        value={passwordData.confirm_password}
                        onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                        placeholder="Repita a nova senha"
                        required
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <Button
                      type="submit"
                      disabled={isChangingPassword}
                      className="bg-purple-600 hover:bg-purple-700 text-white cursor-pointer text-xs font-medium"
                    >
                      <KeyRound className="w-4 h-4 mr-2" />
                      {isChangingPassword ? 'Atualizando senha...' : 'Salvar Nova Senha'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Sessoes e Ultimo Acesso */}
            <Card
              className={`border transition-colors ${
                isDark ? 'bg-zinc-900/60 border-zinc-800' : 'bg-white border-zinc-200 shadow-sm'
              }`}
            >
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base sm:text-lg">Sessoes Ativas & Acessos</CardTitle>
                    <CardDescription className={isDark ? 'text-zinc-400' : 'text-zinc-500'}>
                      Controle os dispositivos autenticados na sua conta.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-inherit">
                  <div>
                    <p className="text-xs font-semibold">Ultimo Acesso Registrado</p>
                    <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                      {profile.last_login
                        ? new Date(profile.last_login).toLocaleString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'Sessao ativa no navegador atual'}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[11px] self-start sm:self-center">
                    Sessao Atual Segura
                  </Badge>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-inherit">
                  <div>
                    <p className="text-xs font-semibold">Encerrar Todas as Outras Sessoes</p>
                    <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                      Desconecta outros navegadores ou computadores previamente autenticados.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLogoutAllSessions}
                    className="border-red-500/30 text-red-400 hover:bg-red-500/10 cursor-pointer self-start sm:self-center"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Encerrar Sessoes
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ABA 4: Historico de Atividades */}
          <TabsContent value="activity" className="space-y-6 mt-0">
            <Card
              className={`border transition-colors ${
                isDark ? 'bg-zinc-900/60 border-zinc-800' : 'bg-white border-zinc-200 shadow-sm'
              }`}
            >
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400">
                    <Activity className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base sm:text-lg">Historico Recente de Acoes</CardTitle>
                    <CardDescription className={isDark ? 'text-zinc-400' : 'text-zinc-500'}>
                      Registro cronologico de alteracoes, publicacoes e manipulacoes no Studio.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {recentActivity && recentActivity.length > 0 ? (
                  <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-inherit">
                    {recentActivity.map((act) => (
                      <div key={act.id} className="relative group">
                        <div className="absolute -left-6 top-1.5 w-2.5 h-2.5 rounded-full bg-purple-500 ring-4 ring-[#09090b]" />
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold">{act.action}</span>
                            {act.catalog_title && (
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1.5 py-0 bg-purple-500/5 text-purple-400 border-purple-500/20"
                              >
                                {act.catalog_title}
                              </Badge>
                            )}
                          </div>
                          <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                            {act.description}
                          </p>
                          <p className="text-[10px] text-zinc-500 font-mono">
                            {new Date(act.created_at).toLocaleString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 space-y-2">
                    <Activity className="w-8 h-8 mx-auto text-zinc-500 opacity-50" />
                    <p className="text-xs font-medium text-zinc-400">Nenhuma atividade recente registrada.</p>
                    <p className="text-[11px] text-zinc-500">
                      Suas acoes de edicao, criacao de paginas e publicacoes aparecerao aqui.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};
