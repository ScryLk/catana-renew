import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Sparkles,
  Lock,
  CreditCard,
  Check,
  ArrowLeft,
  Receipt,
  Copy,
  CheckCircle2,
  ShieldCheck,
  QrCode,
  FileDown,
  ExternalLink,
  Upload,
  Save,
  LogOut,
  KeyRound,
  Layers,
  Clock,
  Loader2,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { profileService, type UserProfile } from '@/services/profileService';
import { billingService, type BillingPlan, type SubscriptionInfo } from '@/services/billingService';
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

  const [activeTab, setActiveTab] = useState<'profile' | 'plan' | 'billing' | 'transparency' | 'security'>('profile');
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [quota, setQuota] = useState<StudioQuotaInfo | null>(null);

  // Estados de Faturamento & Planos
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'annual'>('monthly');
  const [selectedPlanForCheckout, setSelectedPlanForCheckout] = useState<BillingPlan | null>(null);
  const [checkoutPaymentType, setCheckoutPaymentType] = useState<'credit_card' | 'pix'>('credit_card');
  const [isViewingInvoices, setIsViewingInvoices] = useState(false);
  const [isSubmittingCheckout, setIsSubmittingCheckout] = useState(false);
  const [pixCopied, setPixCopied] = useState(false);

  // Estados de Transparencia & LGPD
  const [includeAiMetadata, setIncludeAiMetadata] = useState(true);
  const [isExportingData, setIsExportingData] = useState(false);

  const [cardData, setCardData] = useState({
    number: '•••• •••• •••• 4242',
    name: '',
    expiry: '12/28',
    cvv: '888',
  });

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

        const [profileData, preferencesData, plansData, subscriptionData] = await Promise.all([
          profileService.getProfile(),
          profileService.getPreferences().catch(() => null),
          billingService.getPlans().catch(() => []),
          billingService.getSubscription().catch(() => null),
        ]);

        setProfile(profileData);
        setPlans(plansData);
        setSubscription(subscriptionData);

        setFormData({
          name: profileData.name || '',
          email: profileData.email || '',
          position: profileData.position || '',
          language: preferencesData?.language || 'pt-BR',
        });

        if (subscriptionData?.billing_interval) {
          setBillingInterval(subscriptionData.billing_interval);
        }

        try {
          const quotaRes = await api.get('/api/v2/studio/quotas/');
          if (quotaRes.data) {
            setQuota(quotaRes.data);
          }
        } catch {
          // Ignorar se cotas indisponiveis
        }
      } catch (error) {
        console.error('Erro ao carregar dados da conta:', error);
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

  const handleExecuteCheckout = async () => {
    if (!selectedPlanForCheckout) return;

    try {
      setIsSubmittingCheckout(true);
      const res = await billingService.checkout({
        tier: selectedPlanForCheckout.tier,
        interval: billingInterval,
        payment_method_type: checkoutPaymentType,
        payment_details: {
          last4: cardData.number.replace(/\D/g, '').slice(-4) || '4242',
          brand: 'mastercard',
          holder_name: cardData.name || formData.name || 'Assinante Catana',
        },
      });

      toast.success(res.message || 'Plano atualizado com sucesso');

      const [updatedSub, quotaRes] = await Promise.all([
        billingService.getSubscription(),
        api.get('/api/v2/studio/quotas/').catch(() => null),
      ]);
      setSubscription(updatedSub);
      if (quotaRes?.data) {
        setQuota(quotaRes.data);
      }

      setSelectedPlanForCheckout(null);
    } catch (error: any) {
      const msg = error.response?.data?.error || 'Erro ao processar assinatura.';
      toast.error(msg);
    } finally {
      setIsSubmittingCheckout(false);
    }
  };

  const handleCopyPix = () => {
    const pixCode = '00020126580014br.gov.bcb.pix0136342c1290-7cb2-4a0b-9df2-catana20265204000053039865802BR5920Catana Studio Ltda6009Sao Paulo62070503***6304E8A2';
    navigator.clipboard.writeText(pixCode);
    setPixCopied(true);
    toast.success('Chave PIX copiada para a area de transferencia');
    setTimeout(() => setPixCopied(false), 2500);
  };

  const handleExportData = async () => {
    try {
      setIsExportingData(true);
      const res = await api.get('/api/v2/studio/transparency/export-data/', {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `catana_dados_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Arquivo de dados gerado com sucesso (LGPD)');
    } catch {
      toast.error('Erro ao exportar dados da conta');
    } finally {
      setIsExportingData(false);
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
        {/* Abas de Navegacao Compactas (5 Abas) */}
        <div
          className={`px-4 pt-2.5 pb-2 flex gap-1 border-b shrink-0 overflow-x-auto ${
            isDark ? 'border-zinc-800/60 bg-zinc-950/20' : 'border-zinc-100 bg-zinc-50/30'
          }`}
        >
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11.5px] font-medium transition-colors cursor-pointer shrink-0 ${
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
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11.5px] font-medium transition-colors cursor-pointer shrink-0 ${
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
            <span>Consumo & IA</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('billing');
              setIsViewingInvoices(false);
              setSelectedPlanForCheckout(null);
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11.5px] font-medium transition-colors cursor-pointer shrink-0 ${
              activeTab === 'billing'
                ? isDark
                  ? 'bg-zinc-800 text-white border border-zinc-700/80 shadow-xs'
                  : 'bg-zinc-900 text-white shadow-xs'
                : isDark
                ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Planos & Cobrança</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('transparency')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11.5px] font-medium transition-colors cursor-pointer shrink-0 ${
              activeTab === 'transparency'
                ? isDark
                  ? 'bg-zinc-800 text-white border border-zinc-700/80 shadow-xs'
                  : 'bg-zinc-900 text-white shadow-xs'
                : isDark
                ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Transparência</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11.5px] font-medium transition-colors cursor-pointer shrink-0 ${
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

              {/* ABA 3: PLANOS & COBRANCA */}
              {activeTab === 'billing' && (
                <div className="space-y-3.5">
                  {selectedPlanForCheckout ? (
                    /* SUB-TELA: CHECKOUT INTEGRADO */
                    <div className="space-y-3 animate-in fade-in-50 duration-150">
                      <div className="flex items-center justify-between pb-1.5 border-b border-inherit">
                        <button
                          type="button"
                          onClick={() => setSelectedPlanForCheckout(null)}
                          className={`flex items-center gap-1.5 text-xs transition-colors cursor-pointer ${
                            isDark ? 'text-zinc-400 hover:text-zinc-100' : 'text-zinc-500 hover:text-zinc-900'
                          }`}
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />
                          <span>Voltar aos planos</span>
                        </button>
                        <span className="text-xs font-semibold">
                          Contratação &bull; {selectedPlanForCheckout.name}
                        </span>
                      </div>

                      {/* Resumo do Pedido */}
                      <div className="p-3 rounded-xl border border-inherit bg-zinc-500/5 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold">{selectedPlanForCheckout.name}</span>
                            <Badge
                              variant="outline"
                              className={`text-[10px] font-mono capitalize ${
                                isDark
                                  ? 'bg-zinc-800/80 border-zinc-700 text-zinc-300'
                                  : 'bg-zinc-200/80 border-zinc-300 text-zinc-700'
                              }`}
                            >
                              {billingInterval === 'annual' ? 'Ciclo Anual (-25% OFF)' : 'Ciclo Mensal'}
                            </Badge>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-semibold tracking-tight">
                              R${' '}
                              {billingInterval === 'annual'
                                ? (selectedPlanForCheckout.price_annual_brl * 12)
                                    .toFixed(2)
                                    .replace('.', ',')
                                : selectedPlanForCheckout.price_monthly_brl
                                    .toFixed(2)
                                    .replace('.', ',')}
                            </span>
                            <span className="text-[11px] text-zinc-400 ml-1">
                              {billingInterval === 'annual' ? '/ano' : '/mês'}
                            </span>
                          </div>
                        </div>
                        <p className="text-[11px] text-zinc-400 leading-tight">
                          {selectedPlanForCheckout.description}
                        </p>
                      </div>

                      {/* Seletor de Forma de Pagamento */}
                      <div className="space-y-1.5">
                        <Label className="text-xs">Forma de Pagamento</Label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setCheckoutPaymentType('credit_card')}
                            className={`flex items-center justify-center gap-2 p-2 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                              checkoutPaymentType === 'credit_card'
                                ? isDark
                                  ? 'bg-zinc-800 border-zinc-600 text-white shadow-xs'
                                  : 'bg-zinc-900 border-zinc-900 text-white shadow-xs'
                                : isDark
                                ? 'bg-zinc-900/30 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                                : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:text-zinc-900'
                            }`}
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>Cartão de Crédito</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setCheckoutPaymentType('pix')}
                            className={`flex items-center justify-center gap-2 p-2 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                              checkoutPaymentType === 'pix'
                                ? isDark
                                  ? 'bg-zinc-800 border-zinc-600 text-white shadow-xs'
                                  : 'bg-zinc-900 border-zinc-900 text-white shadow-xs'
                                : isDark
                                ? 'bg-zinc-900/30 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                                : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:text-zinc-900'
                            }`}
                          >
                            <QrCode className="w-3.5 h-3.5" />
                            <span>PIX Instantâneo</span>
                          </button>
                        </div>
                      </div>

                      {/* Campos do Meio de Pagamento */}
                      {checkoutPaymentType === 'credit_card' ? (
                        <div className="grid grid-cols-2 gap-2">
                          <div className="col-span-2 space-y-1">
                            <Label className="text-[11px] text-zinc-400">Número do Cartão</Label>
                            <Input
                              value={cardData.number}
                              onChange={(e) => setCardData({ ...cardData, number: e.target.value })}
                              placeholder="4242 4242 4242 4242"
                              className="h-8 text-xs font-mono"
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-[11px] text-zinc-400">Nome do Titular</Label>
                            <Input
                              value={cardData.name}
                              onChange={(e) => setCardData({ ...cardData, name: e.target.value })}
                              placeholder="Como gravado no cartão"
                              className="h-8 text-xs"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-1.5">
                            <div className="space-y-1">
                              <Label className="text-[11px] text-zinc-400">Validade</Label>
                              <Input
                                value={cardData.expiry}
                                onChange={(e) => setCardData({ ...cardData, expiry: e.target.value })}
                                placeholder="MM/AA"
                                className="h-8 text-xs font-mono"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[11px] text-zinc-400">CVV</Label>
                              <Input
                                value={cardData.cvv}
                                onChange={(e) => setCardData({ ...cardData, cvv: e.target.value })}
                                placeholder="123"
                                className="h-8 text-xs font-mono"
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 rounded-xl border border-inherit bg-zinc-500/5 flex items-center gap-3">
                          <div className="p-1.5 rounded-lg bg-white shrink-0">
                            <QRCodeSVG
                              value="00020126580014br.gov.bcb.pix0136342c1290-7cb2-4a0b-9df2-catana20265204000053039865802BR5920Catana Studio Ltda6009Sao Paulo62070503***6304E8A2"
                              size={68}
                            />
                          </div>
                          <div className="space-y-1.5 flex-1 min-w-0">
                            <p className="text-xs font-medium">QR Code PIX com Aprovação Instantânea</p>
                            <p className="text-[10.5px] text-zinc-400 leading-tight">
                              Escaneie ou copie o código. A liberação de tokens e novos limites ocorre na hora.
                            </p>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={handleCopyPix}
                              className="h-7 px-2.5 text-[11px] cursor-pointer gap-1.5"
                            >
                              <Copy className="w-3 h-3" />
                              <span>{pixCopied ? 'Chave Copiada' : 'Copiar Chave PIX'}</span>
                            </Button>
                          </div>
                        </div>
                      )}

                      <Button
                        type="button"
                        onClick={handleExecuteCheckout}
                        disabled={isSubmittingCheckout}
                        className={`w-full h-8 text-xs cursor-pointer gap-1.5 rounded-lg transition-all ${
                          isDark
                            ? 'bg-zinc-100 hover:bg-white text-zinc-950 font-medium shadow-xs'
                            : 'bg-zinc-900 hover:bg-zinc-800 text-white font-medium shadow-xs'
                        }`}
                      >
                        {isSubmittingCheckout ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Processando ativação...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Confirmar e Ativar {selectedPlanForCheckout.name}</span>
                          </>
                        )}
                      </Button>
                    </div>
                  ) : isViewingInvoices ? (
                    /* SUB-TELA: HISTORICO DE FATURAS */
                    <div className="space-y-3 animate-in fade-in-50 duration-150">
                      <div className="flex items-center justify-between pb-1.5 border-b border-inherit">
                        <button
                          type="button"
                          onClick={() => setIsViewingInvoices(false)}
                          className={`flex items-center gap-1.5 text-xs transition-colors cursor-pointer ${
                            isDark ? 'text-zinc-400 hover:text-zinc-100' : 'text-zinc-500 hover:text-zinc-900'
                          }`}
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />
                          <span>Voltar aos planos</span>
                        </button>
                        <span className="text-xs font-semibold">
                          Histórico de Faturas ({subscription?.invoices?.length || 0})
                        </span>
                      </div>

                      {!subscription?.invoices || subscription.invoices.length === 0 ? (
                        <div className="py-12 text-center text-xs text-zinc-500">
                          Nenhuma fatura anterior registrada nesta conta.
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                          {subscription.invoices.map((inv) => (
                            <div
                              key={inv.id}
                              className="p-2.5 rounded-xl border border-inherit flex items-center justify-between text-xs"
                            >
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-[11px] font-semibold">
                                    {inv.receipt_code}
                                  </span>
                                  <Badge
                                    variant="outline"
                                    className="text-[9px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                  >
                                    Pago
                                  </Badge>
                                </div>
                                <p className="text-[10.5px] text-zinc-400">
                                  {inv.plan_name} &bull; {inv.billing_interval === 'annual' ? 'Anual' : 'Mensal'} &bull;{' '}
                                  {inv.payment_method_summary || 'Cartão'}
                                </p>
                              </div>
                              <div className="text-right">
                                <span className="font-semibold font-mono">
                                  R$ {inv.amount_brl.toFixed(2).replace('.', ',')}
                                </span>
                                <p className="text-[10px] text-zinc-500">
                                  {inv.paid_at ? new Date(inv.paid_at).toLocaleDateString('pt-BR') : 'Hoje'}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* SUB-TELA PRINCIPAL: COMPARATIVO DOS 3 PLANOS */
                    <div className="space-y-3">
                      {/* Barra Superior: Plano Atual + Toggle de Ciclo */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-zinc-400">Plano Atual:</span>
                          <Badge
                            variant="outline"
                            className={`text-[10.5px] font-mono ${
                              isDark
                                ? 'bg-zinc-800/80 border-zinc-700 text-zinc-300'
                                : 'bg-zinc-200/80 border-zinc-300 text-zinc-700'
                            }`}
                          >
                            {subscription?.plan_name || quota?.plan_name || 'Plano Gratuito'}
                          </Badge>
                        </div>

                        {/* Toggle Ciclo Mensal / Anual */}
                        <div
                          className={`flex items-center p-0.5 rounded-lg border text-xs ${
                            isDark ? 'border-zinc-800 bg-zinc-900/60' : 'border-zinc-200 bg-zinc-100'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => setBillingInterval('monthly')}
                            className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                              billingInterval === 'monthly'
                                ? isDark
                                  ? 'bg-zinc-800 text-white shadow-xs'
                                  : 'bg-white text-zinc-950 shadow-xs'
                                : isDark
                                ? 'text-zinc-400 hover:text-zinc-200'
                                : 'text-zinc-500 hover:text-zinc-900'
                            }`}
                          >
                            Mensal
                          </button>
                          <button
                            type="button"
                            onClick={() => setBillingInterval('annual')}
                            className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                              billingInterval === 'annual'
                                ? isDark
                                  ? 'bg-zinc-800 text-white shadow-xs'
                                  : 'bg-white text-zinc-950 shadow-xs'
                                : isDark
                                ? 'text-zinc-400 hover:text-zinc-200'
                                : 'text-zinc-500 hover:text-zinc-900'
                            }`}
                          >
                            Anual (-25%)
                          </button>
                        </div>
                      </div>

                      {/* Grid de 3 Cards de Planos */}
                      <div className="grid grid-cols-3 gap-2">
                        {plans.map((planItem) => {
                          const currentTier = subscription?.tier || quota?.tier || 'free';
                          const isCurrent = currentTier === planItem.tier;
                          const price =
                            billingInterval === 'annual'
                              ? planItem.price_annual_brl
                              : planItem.price_monthly_brl;

                          return (
                            <div
                              key={planItem.id}
                              className={`p-2.5 rounded-xl border flex flex-col justify-between transition-all ${
                                planItem.is_popular
                                  ? isDark
                                    ? 'border-zinc-600 bg-zinc-900/70 relative shadow-sm'
                                    : 'border-zinc-400 bg-zinc-50 relative shadow-sm'
                                  : isDark
                                  ? 'border-zinc-800/80 bg-zinc-500/5'
                                  : 'border-zinc-200 bg-zinc-50/50'
                              }`}
                            >
                              {planItem.is_popular && (
                                <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-1.5 py-0.2 rounded text-[9px] font-semibold bg-zinc-100 text-zinc-950 tracking-tight shadow-xs">
                                  Mais Escolhido
                                </div>
                              )}

                              <div className="space-y-1.5">
                                <h4 className="text-xs font-semibold tracking-tight">{planItem.name}</h4>
                                <div>
                                  <div className="flex items-baseline gap-0.5">
                                    <span className="text-sm font-bold tracking-tight">
                                      R$ {price.toFixed(0)}
                                    </span>
                                    <span className="text-[10px] text-zinc-400">/mês</span>
                                  </div>
                                  {billingInterval === 'annual' && price > 0 && (
                                    <p className="text-[9px] text-zinc-400 font-mono">
                                      Cobrado R$ {(price * 12).toFixed(0)}/ano
                                    </p>
                                  )}
                                </div>

                                <ul className="space-y-1 pt-1.5 border-t border-inherit">
                                  {planItem.features.slice(0, 3).map((feat, idx) => (
                                    <li
                                      key={idx}
                                      className="flex items-start gap-1 text-[10px] text-zinc-300 leading-tight"
                                    >
                                      <Check className="w-2.5 h-2.5 text-zinc-400 shrink-0 mt-0.5" />
                                      <span className="line-clamp-2">{feat}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>

                              <div className="pt-2">
                                {isCurrent ? (
                                  <Button
                                    disabled
                                    size="sm"
                                    variant="outline"
                                    className="w-full h-7 text-[10.5px] opacity-60 cursor-not-allowed"
                                  >
                                    Plano Atual
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    onClick={() => setSelectedPlanForCheckout(planItem)}
                                    className={`w-full h-7 text-[10.5px] font-medium cursor-pointer transition-all ${
                                      planItem.is_popular
                                        ? 'bg-zinc-100 hover:bg-white text-zinc-950 shadow-xs'
                                        : isDark
                                        ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-100'
                                        : 'bg-zinc-900 hover:bg-zinc-800 text-white'
                                    }`}
                                  >
                                    <span>
                                      {planItem.tier === 'free'
                                        ? 'Plano Gratuito'
                                        : `Assinar ${planItem.name.replace('Plano ', '')}`}
                                    </span>
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Barra de Status e Link de Faturas */}
                      <div className="p-2.5 rounded-xl border border-inherit flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                          <span className="text-[11px] text-zinc-400">
                            {subscription?.tier && subscription.tier !== 'free'
                              ? `Renovação automática via ${
                                  subscription.payment_method_type === 'pix'
                                    ? 'PIX'
                                    : subscription.payment_method_details?.last4
                                    ? `Cartão final ${subscription.payment_method_details.last4}`
                                    : 'Cartão'
                                } em ${
                                  subscription.current_period_end
                                    ? new Date(subscription.current_period_end).toLocaleDateString('pt-BR')
                                    : 'breve'
                                }`
                              : 'Plano gratuito sem cobrança recorrente ativa.'}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => setIsViewingInvoices(true)}
                          className={`text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                            isDark ? 'text-zinc-300 hover:text-white' : 'text-zinc-700 hover:text-zinc-950'
                          }`}
                        >
                          <Receipt className="w-3 h-3" />
                          <span>Faturas ({subscription?.invoices?.length || 0})</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ABA 4: TRANSPARENCIA */}
              {activeTab === 'transparency' && (
                <div className="space-y-4 animate-in fade-in-50 duration-150">
                  {/* Card Central de Transparencia & Governanca */}
                  <div className="p-4 rounded-2xl border border-inherit bg-zinc-500/5 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-zinc-800/80 border border-zinc-700/60 text-emerald-400">
                          <ShieldCheck className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-xs font-semibold">Governança & Privacidade de IA</h3>
                            <Badge
                              variant="outline"
                              className="text-[9px] font-mono bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            >
                              Zero-Training
                            </Badge>
                          </div>
                          <p className="text-[11px] text-zinc-400">
                            Seus catálogos e ativos nunca alimentam modelos públicos de IA.
                          </p>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-zinc-300 leading-relaxed">
                      Conheça nossas diretrizes completas sobre isolamento estrito de dados, titularidade comercial de 100% das peças e stack de motores do Catana Studio.
                    </p>

                    <Button
                      type="button"
                      onClick={() => window.open('/transparency', '_blank')}
                      className={`w-full h-8 text-xs font-medium cursor-pointer gap-1.5 rounded-lg transition-all ${
                        isDark
                          ? 'bg-zinc-100 hover:bg-white text-zinc-950 shadow-xs'
                          : 'bg-zinc-900 hover:bg-zinc-800 text-white shadow-xs'
                      }`}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Ver Documentação Completa de Transparência</span>
                    </Button>
                  </div>

                  {/* Acoes do Titular & LGPD */}
                  <div className="p-3.5 rounded-2xl border border-inherit bg-zinc-500/5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <p className="text-xs font-medium">Portabilidade de Dados (Art. 18 LGPD)</p>
                        <p className="text-[11px] text-zinc-400">
                          Baixe uma cópia estruturada dos dados da sua conta, catálogos e histórico em formato JSON.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleExportData}
                        disabled={isExportingData}
                        className="h-8 text-xs cursor-pointer gap-1.5 shrink-0"
                      >
                        {isExportingData ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <FileDown className="w-3.5 h-3.5" />
                        )}
                        <span>{isExportingData ? 'Gerando...' : 'Exportar Dados'}</span>
                      </Button>
                    </div>

                    <Separator className={isDark ? 'bg-zinc-800' : 'bg-zinc-200'} />

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <p className="text-xs font-medium">Metadados de IA nos Catálogos</p>
                        <p className="text-[11px] text-zinc-400">
                          Registrar metadados de diagramação assistida por IA nos arquivos exportados.
                        </p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={includeAiMetadata}
                        onClick={() => setIncludeAiMetadata(!includeAiMetadata)}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                          includeAiMetadata
                            ? isDark
                              ? 'bg-zinc-100'
                              : 'bg-zinc-900'
                            : isDark
                            ? 'bg-zinc-800'
                            : 'bg-zinc-300'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                            includeAiMetadata
                              ? isDark
                                ? 'translate-x-4 bg-zinc-950'
                                : 'translate-x-4 bg-white'
                              : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ABA 5: SEGURANCA */}
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
          ) : activeTab === 'billing' ? (
            <>
              <span className="text-[11px] text-zinc-500">
                Cobrança segura com ativação imediata de tokens e ferramentas de IA.
              </span>
              <div className="flex items-center gap-1 text-[10px] text-zinc-400 font-mono">
                <ShieldCheck className="w-3 h-3 text-emerald-500" />
                <span>SSL Seguro 256-bit</span>
              </div>
            </>
          ) : activeTab === 'transparency' ? (
            <>
              <span className="text-[11px] text-zinc-500">
                Diretrizes de transparência e conformidade com a LGPD (Lei 13.709/2018).
              </span>
              <div className="flex items-center gap-1 text-[10px] text-zinc-400 font-mono">
                <ShieldCheck className="w-3 h-3 text-emerald-500" />
                <span>Zero-Training Ativo</span>
              </div>
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
