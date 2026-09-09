/**
 * ⚙️ Profile Settings Modal
 *
 * Modal para gerenciar configurações de privacidade do perfil público
 */

import { type FC, useState, useEffect } from 'react';
import { Lock, Eye, MessageCircle, Users, Save, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { publicProfileService } from '../../services/publicProfileService';
import type { ProfileSettings, ProfileVisibility } from '../../types/profile';

interface ProfileSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (settings: ProfileSettings) => void;
}

export const ProfileSettingsModal: FC<ProfileSettingsModalProps> = ({
  isOpen,
  onClose,
  onSave,
}) => {
  const [settings, setSettings] = useState<ProfileSettings>({
    visibility: 'publico',
    showInSearch: true,
    allowMessages: true,
    allowFollows: true,
    showFollowersCount: true,
    showCatalogCount: true,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadCurrentSettings();
    }
  }, [isOpen]);

  const loadCurrentSettings = async () => {
    setIsLoading(true);
    try {
      const profile = await publicProfileService.getMyPublicProfile();
      setSettings({
        visibility: profile.visibility,
        showInSearch: profile.showInSearch,
        allowMessages: profile.allowMessages,
        allowFollows: true, // Assumindo que não está no tipo PublicProfile ainda
        showFollowersCount: true,
        showCatalogCount: true,
      });
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updatedSettings = await publicProfileService.updateSettings(settings);
      onSave?.(updatedSettings);
      onClose();
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      // TODO: Mostrar toast de erro
    } finally {
      setIsSaving(false);
    }
  };

  const handleSettingChange = (key: keyof ProfileSettings, value: any) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden bg-white dark:bg-zinc-900">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Lock className="h-5 w-5 text-zinc-700 dark:text-zinc-300" />
            Configurações de Privacidade
          </DialogTitle>
          <DialogDescription className="text-sm text-zinc-600 dark:text-zinc-400">
            Controle quem pode ver e interagir com seu perfil
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="px-6 py-6 space-y-6">
            {/* Visibilidade do Perfil */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-3">
                <Eye className="w-4 h-4" />
                Visibilidade do Perfil
              </label>
              <div className="space-y-2">
                <label className="flex items-start gap-3 p-4 border border-zinc-200 dark:border-zinc-800 rounded-lg cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                  <input
                    type="radio"
                    name="visibility"
                    value="publico"
                    checked={settings.visibility === 'publico'}
                    onChange={(e) => handleSettingChange('visibility', e.target.value as ProfileVisibility)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-zinc-900 dark:text-zinc-100">Público</div>
                    <div className="text-sm text-zinc-600 dark:text-zinc-400">
                      Qualquer pessoa pode ver seu perfil e catálogos públicos
                    </div>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-4 border border-zinc-200 dark:border-zinc-800 rounded-lg cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                  <input
                    type="radio"
                    name="visibility"
                    value="semi-publico"
                    checked={settings.visibility === 'semi-publico'}
                    onChange={(e) => handleSettingChange('visibility', e.target.value as ProfileVisibility)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-zinc-900 dark:text-zinc-100">Semi-Público</div>
                    <div className="text-sm text-zinc-600 dark:text-zinc-400">
                      Apenas pessoas com o link direto podem ver seu perfil
                    </div>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-4 border border-zinc-200 dark:border-zinc-800 rounded-lg cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                  <input
                    type="radio"
                    name="visibility"
                    value="privado"
                    checked={settings.visibility === 'privado'}
                    onChange={(e) => handleSettingChange('visibility', e.target.value as ProfileVisibility)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-zinc-900 dark:text-zinc-100">Privado</div>
                    <div className="text-sm text-zinc-600 dark:text-zinc-400">
                      Seu perfil está oculto e ninguém pode vê-lo
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Aparecer na Busca */}
            <div className="flex items-start gap-3 p-4 border border-zinc-200 dark:border-zinc-800 rounded-lg">
              <input
                type="checkbox"
                id="showInSearch"
                checked={settings.showInSearch}
                onChange={(e) => handleSettingChange('showInSearch', e.target.checked)}
                disabled={settings.visibility === 'privado'}
                className="mt-1"
              />
              <label htmlFor="showInSearch" className="flex-1 cursor-pointer">
                <div className="font-medium text-zinc-900 dark:text-zinc-100">
                  Aparecer nos resultados de busca
                </div>
                <div className="text-sm text-zinc-600 dark:text-zinc-400">
                  Outras pessoas podem encontrar seu perfil através da busca
                </div>
              </label>
            </div>

            {/* Permitir Mensagens */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-3">
                <MessageCircle className="w-4 h-4" />
                Interações
              </label>

              <div className="space-y-2">
                <div className="flex items-start gap-3 p-4 border border-zinc-200 dark:border-zinc-800 rounded-lg">
                  <input
                    type="checkbox"
                    id="allowMessages"
                    checked={settings.allowMessages}
                    onChange={(e) => handleSettingChange('allowMessages', e.target.checked)}
                    className="mt-1"
                  />
                  <label htmlFor="allowMessages" className="flex-1 cursor-pointer">
                    <div className="font-medium text-zinc-900 dark:text-zinc-100">
                      Permitir mensagens
                    </div>
                    <div className="text-sm text-zinc-600 dark:text-zinc-400">
                      Outras pessoas podem enviar mensagens para você
                    </div>
                  </label>
                </div>

                <div className="flex items-start gap-3 p-4 border border-zinc-200 dark:border-zinc-800 rounded-lg">
                  <input
                    type="checkbox"
                    id="allowFollows"
                    checked={settings.allowFollows}
                    onChange={(e) => handleSettingChange('allowFollows', e.target.checked)}
                    className="mt-1"
                  />
                  <label htmlFor="allowFollows" className="flex-1 cursor-pointer">
                    <div className="font-medium text-zinc-900 dark:text-zinc-100">
                      Permitir seguidores
                    </div>
                    <div className="text-sm text-zinc-600 dark:text-zinc-400">
                      Outras pessoas podem seguir seu perfil
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Exibir Estatísticas */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-3">
                <Users className="w-4 h-4" />
                Estatísticas Públicas
              </label>

              <div className="space-y-2">
                <div className="flex items-start gap-3 p-4 border border-zinc-200 dark:border-zinc-800 rounded-lg">
                  <input
                    type="checkbox"
                    id="showFollowersCount"
                    checked={settings.showFollowersCount}
                    onChange={(e) => handleSettingChange('showFollowersCount', e.target.checked)}
                    className="mt-1"
                  />
                  <label htmlFor="showFollowersCount" className="flex-1 cursor-pointer">
                    <div className="font-medium text-zinc-900 dark:text-zinc-100">
                      Mostrar número de seguidores
                    </div>
                    <div className="text-sm text-zinc-600 dark:text-zinc-400">
                      Exibir quantos seguidores você tem
                    </div>
                  </label>
                </div>

                <div className="flex items-start gap-3 p-4 border border-zinc-200 dark:border-zinc-800 rounded-lg">
                  <input
                    type="checkbox"
                    id="showCatalogCount"
                    checked={settings.showCatalogCount}
                    onChange={(e) => handleSettingChange('showCatalogCount', e.target.checked)}
                    className="mt-1"
                  />
                  <label htmlFor="showCatalogCount" className="flex-1 cursor-pointer">
                    <div className="font-medium text-zinc-900 dark:text-zinc-100">
                      Mostrar número de catálogos
                    </div>
                    <div className="text-sm text-zinc-600 dark:text-zinc-400">
                      Exibir quantos catálogos públicos você tem
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Aviso de Privacidade */}
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Lock className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-900 dark:text-blue-300">
                  <strong className="block mb-1">Sua privacidade é importante</strong>
                  Nunca compartilharemos seu e-mail, telefone ou dados pessoais sem sua permissão.
                  Você pode alterar essas configurações a qualquer momento.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-between">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Salvar Alterações
              </>
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
