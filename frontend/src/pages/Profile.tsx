import { useState, useEffect, type FC } from 'react';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { User, Lock, Building2, Settings, Activity, Upload, Save, LogOut } from 'lucide-react';
import { profileService, type UserProfile, type UserPreferences, type ActivityLog } from '@/services/profileService';
import { toast } from 'sonner';
import { LoadingScreen } from '@/components/common/LoadingScreen';

export const Profile: FC = () => {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Estados do backend
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [recentActivity, setRecentActivity] = useState<ActivityLog[]>([]);

  // Estados do formulário
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    position: '',
    language: 'pt-BR',
    theme: 'dark',
    notifyOnPublish: true,
    notifyOnUpdates: true,
  });

  // Carregar dados do perfil
  useEffect(() => {
    const loadProfileData = async () => {
      try {
        setIsLoading(true);

        const [profileData, preferencesData, activityData] = await Promise.all([
          profileService.getProfile(),
          profileService.getPreferences(),
          profileService.getRecentActivity(),
        ]);

        setProfile(profileData);
        setPreferences(preferencesData);
        setRecentActivity(activityData);

        // Atualizar formData com os dados do backend
        setFormData({
          name: profileData.name || '',
          email: profileData.email || '',
          position: profileData.position || '',
          language: preferencesData.language,
          theme: preferencesData.theme,
          notifyOnPublish: preferencesData.notify_on_publish,
          notifyOnUpdates: preferencesData.notify_on_updates,
        });
      } catch (error) {
        console.error('Erro ao carregar dados do perfil:', error);
        toast.error('Erro ao carregar dados do perfil');
      } finally {
        setIsLoading(false);
      }
    };

    loadProfileData();
  }, []);

  const handleSave = async () => {
    if (!profile) return;

    try {
      setIsSaving(true);

      // Atualizar perfil
      const updatedProfile = await profileService.updateProfile({
        name: formData.name,
        position: formData.position,
      });

      // Atualizar preferências
      const updatedPreferences = await profileService.updatePreferences({
        language: formData.language,
        theme: formData.theme,
        notify_on_publish: formData.notifyOnPublish,
        notify_on_updates: formData.notifyOnUpdates,
      });

      setProfile(updatedProfile);
      setPreferences(updatedPreferences);

      toast.success('Perfil atualizado com sucesso!');
      setIsEditing(false);
    } catch (error) {
      console.error('Erro ao salvar perfil:', error);
      toast.error('Erro ao salvar alterações');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar tamanho do arquivo (2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo: 2MB');
      return;
    }

    // Validar tipo do arquivo
    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
      toast.error('Formato inválido. Use PNG ou JPG');
      return;
    }

    try {
      const updatedProfile = await profileService.uploadAvatar(file);
      setProfile(updatedProfile);
      toast.success('Avatar atualizado com sucesso!');
    } catch (error) {
      console.error('Erro ao fazer upload do avatar:', error);
      toast.error('Erro ao atualizar avatar');
    }
  };

  const handleLogoutAllSessions = async () => {
    try {
      await profileService.logoutAllSessions();
      toast.success('Todas as sessões foram encerradas');
    } catch (error) {
      console.error('Erro ao encerrar sessões:', error);
      toast.error('Erro ao encerrar sessões');
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleBadge = (role: string) => {
    const colors = {
      'Proprietário': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      'Administrador': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      'Membro': 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
    };
    return colors[role as keyof typeof colors] || colors['Membro'];
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950">
        <Sidebar />
        <Header />
        <main className="ml-16 pt-20">
          <div className="p-8 max-w-[1400px] mx-auto">
            <LoadingScreen message="Carregando perfil..." />
          </div>
        </main>
      </div>
    );
  }

  if (!profile || !preferences) {
    return (
      <div className="min-h-screen bg-zinc-950">
        <Sidebar />
        <Header />
        <main className="ml-16 pt-20">
          <div className="p-8 max-w-[1400px] mx-auto">
            <div className="text-center text-zinc-400 py-12">
              Erro ao carregar dados do perfil
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <Sidebar />
      <Header />

      {/* Main Content */}
      <main className="ml-16 pt-20">
        <div className="p-8 max-w-[1400px] mx-auto">
          {/* Title Section */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-zinc-100 mb-2">Meu Perfil</h1>
            <p className="text-zinc-400">Gerencie suas informações pessoais e preferências</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Main Info */}
            <div className="lg:col-span-2 space-y-6">
              {/* 1️⃣ Informações do Perfil */}
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/10 rounded-lg">
                      <User className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                      <CardTitle className="text-zinc-100">Informações do Perfil</CardTitle>
                      <CardDescription className="text-zinc-400">
                        Seus dados pessoais e informações de contato
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Avatar */}
                  <div className="flex items-center gap-6">
                    <Avatar className="w-24 h-24">
                      <AvatarImage src={profile.avatar || `https://ui-avatars.com/api/?name=${formData.name}&background=8b5cf6&color=fff&size=96`} />
                      <AvatarFallback className="bg-purple-500 text-white text-2xl">
                        {getInitials(formData.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="space-y-2">
                      <label htmlFor="avatar-upload">
                        <Button
                          variant="outline"
                          size="sm"
                          className="bg-zinc-800 border-zinc-700 text-zinc-100 hover:bg-zinc-700 cursor-pointer"
                          asChild
                        >
                          <span>
                            <Upload className="w-4 h-4 mr-2" />
                            Alterar foto
                          </span>
                        </Button>
                      </label>
                      <input
                        id="avatar-upload"
                        type="file"
                        accept="image/png,image/jpeg,image/jpg"
                        onChange={handleAvatarUpload}
                        className="hidden"
                      />
                      <p className="text-xs text-zinc-500">PNG, JPG até 2MB</p>
                    </div>
                  </div>

                  <Separator className="bg-zinc-800" />

                  {/* Form Fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-zinc-300">Nome completo</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        disabled={!isEditing}
                        className="bg-zinc-800 border-zinc-700 text-zinc-100 disabled:opacity-60 disabled:cursor-not-allowed"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-zinc-300">E-mail</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        disabled
                        className="bg-zinc-800 border-zinc-700 text-zinc-100 opacity-60 cursor-not-allowed"
                      />
                      <p className="text-xs text-zinc-500">O e-mail não pode ser alterado</p>
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="position" className="text-zinc-300">Cargo ou função (opcional)</Label>
                      <Input
                        id="position"
                        value={formData.position}
                        onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                        disabled={!isEditing}
                        placeholder="Ex: Gerente de Marketing"
                        className="bg-zinc-800 border-zinc-700 text-zinc-100 disabled:opacity-60 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 pt-4">
                    {!isEditing ? (
                      <Button
                        onClick={() => setIsEditing(true)}
                        className="bg-zinc-100 hover:bg-zinc-200 text-zinc-900 cursor-pointer"
                      >
                        Editar informações
                      </Button>
                    ) : (
                      <>
                        <Button
                          onClick={handleSave}
                          disabled={isSaving}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                        >
                          {isSaving ? (
                            <>Salvando...</>
                          ) : (
                            <>
                              <Save className="w-4 h-4 mr-2" />
                              Salvar alterações
                            </>
                          )}
                        </Button>
                        <Button
                          onClick={() => setIsEditing(false)}
                          variant="outline"
                          className="bg-zinc-800 border-zinc-700 text-zinc-100 hover:bg-zinc-700 cursor-pointer"
                        >
                          Cancelar
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* 2️⃣ Segurança da Conta */}
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-500/10 rounded-lg">
                      <Lock className="w-5 h-5 text-red-500" />
                    </div>
                    <div>
                      <CardTitle className="text-zinc-100">Segurança da Conta</CardTitle>
                      <CardDescription className="text-zinc-400">
                        Mantenha sua conta protegida
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-lg border border-zinc-800">
                    <div>
                      <p className="text-sm font-medium text-zinc-100">Senha</p>
                      <p className="text-xs text-zinc-500">Última alteração: {profile.updated_at ? new Date(profile.updated_at).toLocaleDateString('pt-BR') : 'Não disponível'}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-zinc-800 border-zinc-700 text-zinc-100 hover:bg-zinc-700 cursor-pointer"
                    >
                      Alterar senha
                    </Button>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-lg border border-zinc-800">
                    <div>
                      <p className="text-sm font-medium text-zinc-100">Último acesso</p>
                      <p className="text-xs text-zinc-500">
                        {profile.last_login
                          ? new Date(profile.last_login).toLocaleString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                          : 'Não disponível'}
                      </p>
                    </div>
                  </div>

                  <Separator className="bg-zinc-800" />

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-zinc-100">Encerrar todas as sessões</p>
                      <p className="text-xs text-zinc-500">Sair de todos os dispositivos conectados</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleLogoutAllSessions}
                      className="bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20 cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Encerrar sessões
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* 4️⃣ Preferências do Usuário */}
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-500/10 rounded-lg">
                      <Settings className="w-5 h-5 text-purple-500" />
                    </div>
                    <div>
                      <CardTitle className="text-zinc-100">Preferências</CardTitle>
                      <CardDescription className="text-zinc-400">
                        Personalize sua experiência no Catana
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="language" className="text-zinc-300">Idioma</Label>
                      <Select value={formData.language} onValueChange={(value) => setFormData({ ...formData, language: value })}>
                        <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-100">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-800 border-zinc-700">
                          <SelectItem value="pt-BR">Português (Brasil)</SelectItem>
                          <SelectItem value="en">English</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="theme" className="text-zinc-300">Tema</Label>
                      <Select value={formData.theme} onValueChange={(value) => setFormData({ ...formData, theme: value })}>
                        <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-100">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-800 border-zinc-700">
                          <SelectItem value="light">Claro</SelectItem>
                          <SelectItem value="dark">Escuro</SelectItem>
                          <SelectItem value="auto">Automático</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Separator className="bg-zinc-800" />

                  <div className="space-y-4">
                    <p className="text-sm font-medium text-zinc-100">Notificações</p>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-zinc-300">Publicação de catálogo</p>
                        <p className="text-xs text-zinc-500">Receber notificação quando um catálogo for publicado</p>
                      </div>
                      <Switch
                        checked={formData.notifyOnPublish}
                        onCheckedChange={(checked) => setFormData({ ...formData, notifyOnPublish: checked })}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-zinc-300">Atualizações importantes</p>
                        <p className="text-xs text-zinc-500">Novidades e mudanças na plataforma</p>
                      </div>
                      <Switch
                        checked={formData.notifyOnUpdates}
                        onCheckedChange={(checked) => setFormData({ ...formData, notifyOnUpdates: checked })}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Organization & Activity */}
            <div className="space-y-6">
              {/* 3️⃣ Organização / Empresa Ativa */}
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/10 rounded-lg">
                      <Building2 className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div>
                      <CardTitle className="text-zinc-100">Minha Empresa</CardTitle>
                      <CardDescription className="text-zinc-400">
                        Organização ativa
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-zinc-800/50 rounded-lg border border-zinc-800">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold text-lg">
                        {profile.username?.[0]?.toUpperCase() || 'C'}
                      </div>
                      <div>
                        <p className="font-medium text-zinc-100">{profile.name || 'Organização'}</p>
                        <p className="text-xs text-zinc-500">Membro desde {new Date(profile.created_at).toLocaleDateString('pt-BR')}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge className={`${getRoleBadge(profile.role)} border`}>
                        {profile.role}
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-sm font-medium text-zinc-100">Permissões</p>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-zinc-400">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                        Criar e editar catálogos
                      </div>
                      <div className="flex items-center gap-2 text-zinc-400">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                        Gerenciar produtos
                      </div>
                      <div className="flex items-center gap-2 text-zinc-400">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                        Convidar membros
                      </div>
                      <div className="flex items-center gap-2 text-zinc-400">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                        Configurações da empresa
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    className="w-full bg-zinc-800 border-zinc-700 text-zinc-100 hover:bg-zinc-700 cursor-pointer"
                  >
                    Gerenciar empresa
                  </Button>
                </CardContent>
              </Card>

              {/* 5️⃣ Atividade Recente */}
              <Card className="bg-zinc-900 border-zinc-800 flex flex-col h-[790px]">
                <CardHeader className="flex-shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-500/10 rounded-lg">
                      <Activity className="w-5 h-5 text-orange-500" />
                    </div>
                    <div>
                      <CardTitle className="text-zinc-100">Atividade Recente</CardTitle>
                      <CardDescription className="text-zinc-400">
                        Suas últimas ações
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto">
                  {recentActivity.length > 0 ? (
                    <div className="space-y-3">
                      {recentActivity.map((activity, index) => {
                        const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-orange-500'];
                        const color = colors[index % colors.length];

                        return (
                          <div key={activity.id}>
                            <div className="flex items-start gap-3">
                              <div className={`w-2 h-2 rounded-full ${color} mt-2`}></div>
                              <div>
                                <p className="text-sm text-zinc-100">{activity.action}</p>
                                <p className="text-xs text-zinc-500">{activity.description}</p>
                                {activity.catalog_title && (
                                  <p className="text-xs text-zinc-500">{activity.catalog_title}</p>
                                )}
                                <p className="text-xs text-zinc-600">
                                  {new Date(activity.created_at).toLocaleString('pt-BR', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </p>
                              </div>
                            </div>
                            {index < recentActivity.length - 1 && (
                              <Separator className="bg-zinc-800 my-3" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center text-zinc-500 text-sm py-6">
                      Nenhuma atividade recente
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
