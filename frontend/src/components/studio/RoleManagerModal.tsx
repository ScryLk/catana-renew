import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  Check,
  ShieldCheck,
  UserCheck,
  FileText,
  Volume2,
  CornerDownRight,
  Users,
} from 'lucide-react';
import { useStudioStore } from '../../store/studioStore';
import { toast } from 'sonner';

export const RoleManagerModal: React.FC = () => {
  const {
    roles,
    activeRoleId,
    isRoleManagerOpen,
    setIsRoleManagerOpen,
    setActiveRole,
    createCustomRole,
    updateRole,
    deleteRole,
    toggleRoleEnabled,
    theme,
  } = useStudioStore();

  const isDark = theme === 'dark';

  const [selectedRoleId, setSelectedRoleId] = useState<string>(activeRoleId);
  const [isCreatingNew, setIsCreatingNew] = useState<boolean>(false);

  // Form state
  const [formData, setFormData] = useState<{
    name: string;
    badge: string;
    description: string;
    toneOfVoice: string;
    instructions: string;
    starterChipsText: string;
  }>({
    name: '',
    badge: '',
    description: '',
    toneOfVoice: '',
    instructions: '',
    starterChipsText: '',
  });

  const selectedRole = roles.find((r) => r.id === selectedRoleId) || roles[0];

  // Synchronize form when selected role or creating state changes
  useEffect(() => {
    if (isCreatingNew) {
      setFormData({
        name: '',
        badge: 'Personalizado',
        description: '',
        toneOfVoice: '',
        instructions: '',
        starterChipsText: '',
      });
    } else if (selectedRole) {
      setFormData({
        name: selectedRole.name,
        badge: selectedRole.badge,
        description: selectedRole.description,
        toneOfVoice: selectedRole.toneOfVoice,
        instructions: selectedRole.instructions,
        starterChipsText: (selectedRole.starterChips || []).join('\n'),
      });
    }
  }, [selectedRoleId, isCreatingNew, selectedRole]);

  // Keep selectedRoleId synced with activeRoleId if opened
  useEffect(() => {
    if (isRoleManagerOpen && !isCreatingNew) {
      setSelectedRoleId(activeRoleId);
    }
  }, [isRoleManagerOpen, activeRoleId]);

  if (!isRoleManagerOpen) return null;

  const handleStartCreate = () => {
    setIsCreatingNew(true);
    setFormData({
      name: '',
      badge: 'Personalizado',
      description: '',
      toneOfVoice: '',
      instructions: '',
      starterChipsText: '',
    });
  };

  const handleSelectRole = (roleId: string) => {
    setIsCreatingNew(false);
    setSelectedRoleId(roleId);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('Informe o nome do cargo.');
      return;
    }

    if (!formData.instructions.trim()) {
      toast.error('Informe as diretrizes e instruções de atuação do cargo.');
      return;
    }

    const parsedChips = formData.starterChipsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    if (isCreatingNew) {
      const newId = createCustomRole({
        name: formData.name.trim(),
        badge: formData.badge.trim() || 'Personalizado',
        description: formData.description.trim() || 'Cargo customizado pelo usuário',
        toneOfVoice: formData.toneOfVoice.trim() || 'Profissional e técnico',
        instructions: formData.instructions.trim(),
        starterChips: parsedChips.length > 0 ? parsedChips : undefined,
      });

      toast.success(`Cargo "${formData.name.trim()}" criado com sucesso!`);
      setIsCreatingNew(false);
      setSelectedRoleId(newId);
    } else if (selectedRole && selectedRole.isCustom) {
      updateRole(selectedRole.id, {
        name: formData.name.trim(),
        badge: formData.badge.trim() || 'Personalizado',
        description: formData.description.trim(),
        toneOfVoice: formData.toneOfVoice.trim(),
        instructions: formData.instructions.trim(),
        starterChips: parsedChips,
      });

      toast.success(`Cargo "${formData.name.trim()}" atualizado!`);
    }
  };

  const handleDelete = () => {
    if (!selectedRole || !selectedRole.isCustom) return;

    if (confirm(`Deseja excluir o cargo "${selectedRole.name}"?`)) {
      deleteRole(selectedRole.id);
      toast.success(`Cargo "${selectedRole.name}" excluído.`);
      setSelectedRoleId(roles[0].id);
      setIsCreatingNew(false);
    }
  };

  const handleActivateRole = (roleId: string) => {
    setActiveRole(roleId);
    toast.success('Cargo ativado no assistente!');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className={`w-full max-w-4xl h-[640px] rounded-2xl border shadow-2xl flex flex-col overflow-hidden transition-colors ${
          isDark
            ? 'bg-[#111114] border-zinc-800 text-zinc-100 shadow-[0_25px_60px_rgba(0,0,0,0.9)]'
            : 'bg-white border-zinc-200 text-zinc-900 shadow-[0_20px_50px_rgba(0,0,0,0.15)]'
        }`}
      >
        {/* Header */}
        <div
          className={`px-6 py-4 border-b flex items-center justify-between shrink-0 ${
            isDark ? 'border-zinc-800 bg-[#16161a]' : 'border-zinc-200 bg-zinc-50'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-xl border ${
                isDark
                  ? 'bg-zinc-900 border-zinc-800 text-zinc-200'
                  : 'bg-white border-zinc-200 text-zinc-800 shadow-2xs'
              }`}
            >
              <Users className="size-4.5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-tight">
                Cargos e Diretrizes do Assistente
              </h2>
              <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                Defina perfis especializados com instruções que moldam o raciocínio e as decisões do agente
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsRoleManagerOpen(false)}
            className={`p-2 rounded-lg transition-colors cursor-pointer ${
              isDark
                ? 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                : 'hover:bg-zinc-200 text-zinc-500 hover:text-zinc-900'
            }`}
            aria-label="Fechar modal"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Content Body: Split View */}
        <div className="flex-1 flex min-h-0">
          {/* Left Pane: Role List */}
          <div
            className={`w-72 border-r flex flex-col shrink-0 ${
              isDark ? 'border-zinc-800 bg-[#0d0d10]' : 'border-zinc-200 bg-zinc-50/50'
            }`}
          >
            <div className="p-3 border-b border-inherit">
              <button
                type="button"
                onClick={handleStartCreate}
                className={`w-full py-2 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                  isCreatingNew
                    ? isDark
                      ? 'bg-white text-zinc-950 border-white font-semibold'
                      : 'bg-zinc-900 text-white border-zinc-900 font-semibold'
                    : isDark
                    ? 'bg-zinc-900/80 border-zinc-800 hover:border-zinc-700 text-zinc-200 hover:bg-zinc-800'
                    : 'bg-white border-zinc-200 hover:border-zinc-300 text-zinc-800 hover:bg-zinc-100 shadow-2xs'
                }`}
              >
                <Plus className="size-3.5" />
                <span>Novo Cargo Personalizado</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1.5">
              <div className="px-2 py-1">
                <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-500 font-semibold">
                  Cargos Disponíveis ({roles.length})
                </span>
              </div>

              {roles.map((role) => {
                const isSelected = !isCreatingNew && role.id === selectedRoleId;
                const isActive = role.id === activeRoleId;

                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => handleSelectRole(role.id)}
                    className={`w-full text-left p-2.5 rounded-xl border transition-all cursor-pointer relative group ${
                      isSelected
                        ? isDark
                          ? 'bg-zinc-800/90 border-zinc-700 text-white shadow-sm'
                          : 'bg-white border-zinc-300 text-zinc-950 shadow-xs'
                        : isDark
                        ? 'bg-transparent border-transparent hover:bg-zinc-900/80 text-zinc-300'
                        : 'bg-transparent border-transparent hover:bg-zinc-100/80 text-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className={`text-xs font-medium truncate ${role.enabled === false ? 'text-zinc-500 line-through decoration-zinc-600' : ''}`}>
                        {role.name}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        {role.enabled === false ? (
                          <span
                            className={`text-[8.5px] font-mono px-1 py-0.2 rounded uppercase ${
                              isDark
                                ? 'bg-zinc-800 text-zinc-500 border border-zinc-700'
                                : 'bg-zinc-200 text-zinc-500'
                            }`}
                          >
                            Desativado
                          </span>
                        ) : isActive ? (
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded font-medium shrink-0 flex items-center gap-1 ${
                              isDark
                                ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            <Check className="size-2.5" /> Em uso
                          </span>
                        ) : (
                          <span
                            className={`text-[8.5px] font-mono px-1 py-0.2 rounded uppercase ${
                              isDark
                                ? 'bg-emerald-950/50 text-emerald-400/80 border border-emerald-800/40'
                                : 'bg-emerald-50 text-emerald-700/80 border border-emerald-200'
                            }`}
                          >
                            Ativo
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider font-mono ${
                          role.isCustom
                            ? isDark
                              ? 'bg-purple-950/60 text-purple-300 border border-purple-800/50'
                              : 'bg-purple-50 text-purple-700 border border-purple-200'
                            : isDark
                            ? 'bg-zinc-900 text-zinc-400 border border-zinc-800'
                            : 'bg-zinc-200 text-zinc-600'
                        }`}
                      >
                        {role.badge}
                      </span>
                      <span
                        className={`text-[10px] truncate ${
                          isDark ? 'text-zinc-500' : 'text-zinc-400'
                        }`}
                      >
                        {role.isCustom ? 'Personalizado' : 'Padrão'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Pane: Role Form / Detail */}
          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto custom-scrollbar p-6">
            {isCreatingNew || (selectedRole && selectedRole.isCustom) ? (
              <form onSubmit={handleSave} className="space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-inherit">
                  <div>
                    <h3 className="text-sm font-semibold">
                      {isCreatingNew ? 'Criar Novo Cargo' : `Editar Cargo: ${selectedRole.name}`}
                    </h3>
                    <p className={`text-xs mt-0.5 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                      Instruções personalizadas orientam a tomada de decisão e o racional editorial do assistente.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {!isCreatingNew && selectedRole && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleActivateRole(selectedRole.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-colors cursor-pointer ${
                            selectedRole.id === activeRoleId
                              ? isDark
                                ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
                                : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                              : isDark
                              ? 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-zinc-300'
                              : 'bg-zinc-100 border-zinc-200 hover:border-zinc-300 text-zinc-700'
                          }`}
                        >
                          <UserCheck className="size-3.5" />
                          <span>{selectedRole.id === activeRoleId ? 'Cargo Ativo' : 'Ativar Cargo'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleDelete}
                          className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                            isDark
                              ? 'border-zinc-800 text-zinc-400 hover:text-red-400 hover:border-red-900/60 hover:bg-red-950/30'
                              : 'border-zinc-200 text-zinc-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50'
                          }`}
                          title="Excluir Cargo"
                          aria-label="Excluir Cargo"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {!isCreatingNew && selectedRole && (
                  <div
                    className={`p-3 rounded-xl border flex items-center justify-between transition-colors ${
                      selectedRole.enabled === false
                        ? isDark
                          ? 'bg-zinc-950/60 border-zinc-800'
                          : 'bg-zinc-100/80 border-zinc-200'
                        : isDark
                        ? 'bg-zinc-900/60 border-zinc-800'
                        : 'bg-zinc-50 border-zinc-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold">Status do Agente</span>
                        <span
                          className={`text-[9px] font-mono uppercase px-1.5 py-0.2 rounded font-medium ${
                            selectedRole.enabled !== false
                              ? isDark
                                ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : isDark
                              ? 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                              : 'bg-zinc-200 text-zinc-600'
                          }`}
                        >
                          {selectedRole.enabled !== false ? 'Ativado' : 'Desativado'}
                        </span>
                      </div>
                      <p className={`text-[11px] mt-0.5 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                        {selectedRole.enabled !== false
                          ? 'O agente está ativo para receber delegações e debater no conselho.'
                          : 'O agente está desativado e não participará de automações ou da Mesa Redonda.'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        toggleRoleEnabled(selectedRole.id);
                        if (selectedRole.enabled !== false) {
                          toast.info(`Cargo "${selectedRole.name}" foi desativado.`);
                        } else {
                          toast.success(`Cargo "${selectedRole.name}" ativado com sucesso!`);
                        }
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium border transition-colors cursor-pointer shrink-0 ${
                        selectedRole.enabled !== false
                          ? isDark
                            ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700'
                            : 'bg-zinc-200 hover:bg-zinc-300 text-zinc-800 border-zinc-300'
                          : isDark
                          ? 'bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border-emerald-800'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 shadow-2xs'
                      }`}
                    >
                      {selectedRole.enabled !== false ? 'Desativar Agente' : 'Ativar Agente'}
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  {/* Role Name */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium block">
                      Nome do Cargo <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Estrategista de Luxo"
                      value={formData.name}
                      onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                      className={`w-full px-3 py-2 text-xs rounded-lg border outline-none transition-colors ${
                        isDark
                          ? 'bg-zinc-900/80 border-zinc-800 focus:border-zinc-600 text-zinc-100 placeholder-zinc-600'
                          : 'bg-white border-zinc-200 focus:border-zinc-400 text-zinc-900 placeholder-zinc-400'
                      }`}
                    />
                  </div>

                  {/* Badge */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium block">Etiqueta / Badge</label>
                    <input
                      type="text"
                      placeholder="Ex: Estratégia, Copy, Luxo"
                      value={formData.badge}
                      onChange={(e) => setFormData((prev) => ({ ...prev, badge: e.target.value }))}
                      className={`w-full px-3 py-2 text-xs rounded-lg border outline-none transition-colors ${
                        isDark
                          ? 'bg-zinc-900/80 border-zinc-800 focus:border-zinc-600 text-zinc-100 placeholder-zinc-600'
                          : 'bg-white border-zinc-200 focus:border-zinc-400 text-zinc-900 placeholder-zinc-400'
                      }`}
                    />
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium block">Resumo do Cargo</label>
                  <input
                    type="text"
                    placeholder="Ex: Foco em curadoria de marcas de alto padrão e composições refinadas"
                    value={formData.description}
                    onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                    className={`w-full px-3 py-2 text-xs rounded-lg border outline-none transition-colors ${
                      isDark
                        ? 'bg-zinc-900/80 border-zinc-800 focus:border-zinc-600 text-zinc-100 placeholder-zinc-600'
                        : 'bg-white border-zinc-200 focus:border-zinc-400 text-zinc-900 placeholder-zinc-400'
                    }`}
                  />
                </div>

                {/* Tone of Voice */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Volume2 className="size-3.5 text-zinc-400" />
                    <label className="text-xs font-medium">Tom de Voz e Linguagem</label>
                  </div>
                  <input
                    type="text"
                    placeholder="Ex: Sóbrio, assertivo, poético, focado em acabamentos nobres"
                    value={formData.toneOfVoice}
                    onChange={(e) => setFormData((prev) => ({ ...prev, toneOfVoice: e.target.value }))}
                    className={`w-full px-3 py-2 text-xs rounded-lg border outline-none transition-colors ${
                      isDark
                        ? 'bg-zinc-900/80 border-zinc-800 focus:border-zinc-600 text-zinc-100 placeholder-zinc-600'
                        : 'bg-white border-zinc-200 focus:border-zinc-400 text-zinc-900 placeholder-zinc-400'
                    }`}
                  />
                </div>

                {/* Instructions Textarea */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <FileText className="size-3.5 text-zinc-400" />
                      <label className="text-xs font-medium">
                        Diretrizes e Regras de Decisão do Agente <span className="text-red-500">*</span>
                      </label>
                    </div>
                    <span className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                      Injetado no prompt do sistema
                    </span>
                  </div>

                  <textarea
                    rows={5}
                    required
                    placeholder="Ex: Priorize contrastes sutis, tipografia serifada Cormorant, espaçamento amplo entre blocos. Ao sugerir alterações de preços, mantenha margens de 3x e destaque acabamentos em ouro e seda."
                    value={formData.instructions}
                    onChange={(e) => setFormData((prev) => ({ ...prev, instructions: e.target.value }))}
                    className={`w-full p-3 text-xs font-mono rounded-lg border outline-none leading-relaxed transition-colors resize-none ${
                      isDark
                        ? 'bg-zinc-900/80 border-zinc-800 focus:border-zinc-600 text-zinc-200 placeholder-zinc-600'
                        : 'bg-white border-zinc-200 focus:border-zinc-400 text-zinc-800 placeholder-zinc-400'
                    }`}
                  />
                  <p className={`text-[11px] leading-relaxed ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                    O assistente usará estas instruções como guia para responder às solicitações e justificar o{' '}
                    <span className="font-semibold">Racional Editorial</span> nas mensagens.
                  </p>
                </div>

                {/* Starter Prompt Chips */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <CornerDownRight className="size-3.5 text-zinc-400" />
                    <label className="text-xs font-medium">
                      Sugestões Rápidas de Prompt (Uma por linha)
                    </label>
                  </div>
                  <textarea
                    rows={3}
                    placeholder="Ajustar contraste da capa&#10;Criar manifesto para coleção de inverno&#10;Harmonizar fólio e monogramas"
                    value={formData.starterChipsText}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, starterChipsText: e.target.value }))
                    }
                    className={`w-full p-2.5 text-xs rounded-lg border outline-none transition-colors resize-none ${
                      isDark
                        ? 'bg-zinc-900/80 border-zinc-800 focus:border-zinc-600 text-zinc-200 placeholder-zinc-600'
                        : 'bg-white border-zinc-200 focus:border-zinc-400 text-zinc-800 placeholder-zinc-400'
                    }`}
                  />
                </div>

                {/* Save Button */}
                <div className="pt-2 flex justify-end gap-2.5">
                  {isCreatingNew && (
                    <button
                      type="button"
                      onClick={() => setIsCreatingNew(false)}
                      className={`px-4 py-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                        isDark
                          ? 'border-zinc-800 hover:bg-zinc-800 text-zinc-300'
                          : 'border-zinc-200 hover:bg-zinc-100 text-zinc-700'
                      }`}
                    >
                      Cancelar
                    </button>
                  )}
                  <button
                    type="submit"
                    className={`px-5 py-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer shadow-sm ${
                      isDark
                        ? 'bg-white text-zinc-950 border-white hover:bg-zinc-200'
                        : 'bg-zinc-900 text-white border-zinc-900 hover:bg-zinc-800'
                    }`}
                  >
                    {isCreatingNew ? 'Criar Cargo' : 'Salvar Alterações'}
                  </button>
                </div>
              </form>
            ) : (
              /* Built-in Role Readonly View */
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-3 border-b border-inherit">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold">{selectedRole.name}</h3>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-medium ${
                          isDark
                            ? 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                            : 'bg-zinc-200 text-zinc-700'
                        }`}
                      >
                        {selectedRole.badge}
                      </span>
                    </div>
                    <p className={`text-xs mt-0.5 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                      {selectedRole.description}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleActivateRole(selectedRole.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-colors cursor-pointer ${
                      selectedRole.id === activeRoleId
                        ? isDark
                          ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
                          : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : isDark
                        ? 'bg-white text-zinc-950 border-white hover:bg-zinc-200 font-semibold'
                        : 'bg-zinc-900 text-white border-zinc-900 hover:bg-zinc-800 font-semibold'
                    }`}
                  >
                    <UserCheck className="size-3.5" />
                    <span>{selectedRole.id === activeRoleId ? 'Cargo Ativo' : 'Ativar Este Cargo'}</span>
                  </button>
                </div>

                <div
                  className={`p-3 rounded-xl border flex items-center justify-between transition-colors ${
                    selectedRole.enabled === false
                      ? isDark
                        ? 'bg-zinc-950/60 border-zinc-800'
                        : 'bg-zinc-100/80 border-zinc-200'
                      : isDark
                      ? 'bg-zinc-900/60 border-zinc-800'
                      : 'bg-zinc-50 border-zinc-200'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold">Status do Agente</span>
                      <span
                        className={`text-[9px] font-mono uppercase px-1.5 py-0.2 rounded font-medium ${
                          selectedRole.enabled !== false
                            ? isDark
                              ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : isDark
                            ? 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                            : 'bg-zinc-200 text-zinc-600'
                        }`}
                      >
                        {selectedRole.enabled !== false ? 'Ativado' : 'Desativado'}
                      </span>
                    </div>
                    <p className={`text-[11px] mt-0.5 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                      {selectedRole.enabled !== false
                        ? 'O agente está ativo para receber delegações e debater no conselho.'
                        : 'O agente está desativado e não participará de automações ou da Mesa Redonda.'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      toggleRoleEnabled(selectedRole.id);
                      if (selectedRole.enabled !== false) {
                        toast.info(`Cargo "${selectedRole.name}" foi desativado.`);
                      } else {
                        toast.success(`Cargo "${selectedRole.name}" ativado com sucesso!`);
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium border transition-colors cursor-pointer shrink-0 ${
                      selectedRole.enabled !== false
                        ? isDark
                          ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700'
                          : 'bg-zinc-200 hover:bg-zinc-300 text-zinc-800 border-zinc-300'
                        : isDark
                        ? 'bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border-emerald-800'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 shadow-2xs'
                    }`}
                  >
                    {selectedRole.enabled !== false ? 'Desativar Agente' : 'Ativar Agente'}
                  </button>
                </div>

                <div
                  className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs ${
                    isDark
                      ? 'bg-zinc-900/50 border-zinc-800 text-zinc-400'
                      : 'bg-zinc-50 border-zinc-200 text-zinc-600'
                  }`}
                >
                  <ShieldCheck className="size-4 shrink-0 text-zinc-400 mt-0.5" />
                  <div>
                    <span className="font-semibold text-zinc-200 block mb-0.5">Cargo Padrão do Sistema</span>
                    <span>
                      Este perfil é calibrado pelo Katana Studio para garantir rigor estético e editorial. Para
                      definir regras personalizadas, clique em <strong>"Novo Cargo Personalizado"</strong>.
                    </span>
                  </div>
                </div>

                {/* Tone of voice */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Volume2 className="size-3.5 text-zinc-400" />
                    <span className="text-xs font-semibold">Tom de Voz e Linguagem</span>
                  </div>
                  <div
                    className={`p-3 rounded-lg border text-xs ${
                      isDark ? 'bg-zinc-900/60 border-zinc-800 text-zinc-300' : 'bg-white border-zinc-200 text-zinc-800'
                    }`}
                  >
                    {selectedRole.toneOfVoice}
                  </div>
                </div>

                {/* Instructions */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <FileText className="size-3.5 text-zinc-400" />
                    <span className="text-xs font-semibold">Diretrizes e Instruções de Decisão</span>
                  </div>
                  <div
                    className={`p-3.5 rounded-lg border text-xs font-mono leading-relaxed ${
                      isDark
                        ? 'bg-zinc-900/60 border-zinc-800 text-zinc-300'
                        : 'bg-zinc-50 border-zinc-200 text-zinc-800'
                    }`}
                  >
                    {selectedRole.instructions}
                  </div>
                </div>

                {/* Starter chips */}
                {selectedRole.starterChips && selectedRole.starterChips.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <CornerDownRight className="size-3.5 text-zinc-400" />
                      <span className="text-xs font-semibold">Sugestões Rápidas de Prompt</span>
                    </div>
                    <div className="space-y-1.5">
                      {selectedRole.starterChips.map((chip, idx) => (
                        <div
                          key={idx}
                          className={`p-2.5 rounded-lg border text-xs ${
                            isDark
                              ? 'bg-zinc-900/40 border-zinc-800 text-zinc-400'
                              : 'bg-white border-zinc-200 text-zinc-600'
                          }`}
                        >
                          {chip}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
