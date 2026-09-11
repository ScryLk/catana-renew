import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Cpu,
  Layers,
  Sparkles,
  Send,
  Loader2,
  CheckCircle2,
  Code2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Copy,
  Check,
  Terminal,
  History,
  ShieldCheck,
  Clock,
  Users,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { API_BASE_URL } from '../store/studioStore';

type TabKey = 'playground' | 'architecture' | 'api-docs';
type AgentFilterKey = 'all' | 'system' | 'custom';

interface AgentProfile {
  id?: number;
  role: string;
  name: string;
  title: string;
  department: string;
  mission: string;
  key_responsibilities?: string[];
  decision_scope: string;
  scope_constraints: string;
  evaluation_keywords: string[];
  sample_prompts: string[];
  is_custom?: boolean;
  is_active?: boolean;
  owner_user?: string;
  user_id?: number;
  system_prompt?: string;
}

interface UserItem {
  id: number;
  username: string;
  email: string;
  name: string;
  role: string;
  custom_agents_count: number;
  active_custom_agents_count: number;
}

interface SystemDesignData {
  system_name: string;
  version: string;
  architecture_paradigm: string;
  design_standards: {
    page_dimensions: {
      format: string;
      page_width_px: number;
      page_height_px: number;
      spread_width_px: number;
      spread_height_px: number;
      standard_margins_px: string;
      screen_ppi: number;
      print_dpi: number;
    };
    visual_hierarchy: Record<string, string>;
    editorial_principles: string[];
  };
  pipeline_stages: Array<{
    stage: number;
    name: string;
    description: string;
    components: string[];
  }>;
  protocol: {
    name: string;
    format: string;
    purpose: string;
  };
}

interface TestRunHistoryItem {
  id: string;
  role: string;
  agentName: string;
  prompt: string;
  response: string;
  duration_ms: number;
  zero_emojis_compliant: boolean;
  matched_keywords: string[];
  fidelity_percentage?: number;
  status?: string;
  is_custom?: boolean;
  timestamp: string;
}

export const SystemDesignPage: React.FC = () => {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<TabKey>('playground');
  const [systemData, setSystemData] = useState<SystemDesignData | null>(null);
  const [agentsList, setAgentsList] = useState<AgentProfile[]>([]);
  const [isLoadingSpec, setIsLoadingSpec] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Users & Filtering State
  const [usersList, setUsersList] = useState<UserItem[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('all');
  const [agentFilter, setAgentFilter] = useState<AgentFilterKey>('all');

  // Custom Agent Creation Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreatingAgent, setIsCreatingAgent] = useState(false);
  const [isDeletingAgentId, setIsDeletingAgentId] = useState<number | null>(null);

  const [formName, setFormName] = useState('');
  const [formRole, setFormRole] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formDepartment, setFormDepartment] = useState('Especialidades');
  const [formMission, setFormMission] = useState('');
  const [formDecisionScope, setFormDecisionScope] = useState('');
  const [formScopeConstraints, setFormScopeConstraints] = useState('');
  const [formKeywords, setFormKeywords] = useState('');
  const [formPrompts, setFormPrompts] = useState('');

  // Playground State
  const [selectedRole, setSelectedRole] = useState<string>('director');
  const [testPrompt, setTestPrompt] = useState<string>(
    'Como diagramar uma pagina dupla para apresentar 4 modelos de embalagens plasticas descartaveis?'
  );
  const [temperature, setTemperature] = useState<number>(0.4);
  const [isExecutingTest, setIsExecutingTest] = useState(false);
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const [testResult, setTestResult] = useState<{
    response: string;
    duration_ms: number;
    matched_keywords: string[];
    zero_emojis_compliant: boolean;
    fidelity_percentage?: number;
    status?: string;
    is_custom?: boolean;
    owner_user?: string;
  } | null>(null);

  // Test History
  const [history, setHistory] = useState<TestRunHistoryItem[]>([]);

  useEffect(() => {
    fetchUsers();
    fetchSystemDesign('all');
  }, []);

  const fetchUsers = async () => {
    try {
      const resp = await axios.get(`${API_BASE_URL}/api/v2/studio/system-design/users/`);
      if (resp.data && resp.data.users) {
        setUsersList(resp.data.users);
      }
    } catch {
      // Falha silenciosa
    }
  };

  const fetchSystemDesign = async (userId: string = 'all') => {
    setIsLoadingSpec(true);
    try {
      const url =
        userId && userId !== 'all'
          ? `${API_BASE_URL}/api/v2/studio/system-design/?user_id=${userId}`
          : `${API_BASE_URL}/api/v2/studio/system-design/`;
      const resp = await axios.get(url);
      if (resp.data) {
        setSystemData(resp.data.system_design);
        const loadedAgents = resp.data.agents || resp.data.registered_agents || [];
        setAgentsList(loadedAgents);

        if (!loadedAgents.some((a: AgentProfile) => a.role === selectedRole) && loadedAgents.length > 0) {
          setSelectedRole(loadedAgents[0].role);
        }
      }
    } catch {
      toast.error('Nao foi possivel carregar as especificacoes de System Design.');
    } finally {
      setIsLoadingSpec(false);
    }
  };

  const handleUserChange = (userId: string) => {
    setSelectedUserId(userId);
    fetchSystemDesign(userId);
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    toast.success(`${label} copiado para a area de transferencia!`);
    setTimeout(() => {
      setCopiedText(null);
    }, 2000);
  };

  const currentAgent = agentsList.find((a) => a.role === selectedRole) || agentsList[0];

  const filteredAgents = agentsList.filter((agent) => {
    if (agentFilter === 'system') return !agent.is_custom;
    if (agentFilter === 'custom') return agent.is_custom;
    return true;
  });

  const handleExecuteAgentTest = async () => {
    if (!testPrompt.trim()) {
      toast.error('Informe um prompt para o agente.');
      return;
    }

    setIsExecutingTest(true);
    setTestResult(null);

    try {
      const resp = await axios.post(`${API_BASE_URL}/api/v2/studio/system-design/test-agent/`, {
        agent_role: selectedRole,
        prompt: testPrompt,
        temperature: temperature,
        user_id: currentAgent?.user_id || (selectedUserId !== 'all' ? selectedUserId : undefined),
      });

      if (resp.data && resp.data.response) {
        const audit = resp.data.audit_metrics || {};
        const resData = {
          response: resp.data.response,
          duration_ms: audit.duration_ms ?? resp.data.duration_ms ?? 0,
          matched_keywords: audit.matched_keywords || [],
          zero_emojis_compliant: audit.zero_emojis_compliant ?? true,
          fidelity_percentage: audit.fidelity_percentage,
          status: audit.status,
          is_custom: resp.data.agent?.is_custom ?? currentAgent?.is_custom,
          owner_user: resp.data.agent?.owner_user ?? currentAgent?.owner_user,
        };
        setTestResult(resData);

        const newHistoryItem: TestRunHistoryItem = {
          id: Date.now().toString(),
          role: selectedRole,
          agentName: currentAgent?.name || selectedRole,
          prompt: testPrompt,
          response: resData.response,
          duration_ms: resData.duration_ms,
          zero_emojis_compliant: resData.zero_emojis_compliant,
          matched_keywords: resData.matched_keywords,
          fidelity_percentage: resData.fidelity_percentage,
          status: resData.status,
          is_custom: resData.is_custom,
          timestamp: new Date().toLocaleTimeString(),
        };
        setHistory((prev) => [newHistoryItem, ...prev.slice(0, 9)]);
        toast.success(`Resposta de '${currentAgent?.name}' recebida em ${resData.duration_ms}ms.`);
      } else {
        toast.error(resp.data?.error || 'Falha ao executar teste do agente.');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro na comunicacao com o agente via Gemini.');
    } finally {
      setIsExecutingTest(false);
    }
  };

  const handleCreateCustomAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formRole.trim() || !formMission.trim()) {
      toast.error('Preencha os campos obrigatorios: Nome, Slug de Cargo e Missao.');
      return;
    }

    setIsCreatingAgent(true);
    try {
      const payload = {
        name: formName.trim(),
        role: formRole.trim().toLowerCase().replace(/\s+/g, '_'),
        title: formTitle.trim() || formName.trim(),
        department: formDepartment.trim() || 'Especialidades',
        mission: formMission.trim(),
        decision_scope: formDecisionScope.trim(),
        scope_constraints: formScopeConstraints.trim(),
        evaluation_keywords: formKeywords
          .split(',')
          .map((k) => k.trim())
          .filter(Boolean),
        sample_prompts: formPrompts
          .split('\n')
          .map((p) => p.trim())
          .filter(Boolean),
        user_id: selectedUserId !== 'all' ? parseInt(selectedUserId, 10) : undefined,
      };

      const resp = await axios.post(`${API_BASE_URL}/api/v2/studio/system-design/custom-agents/`, payload);

      if (resp.data && resp.data.success) {
        toast.success(`Agente '${payload.name}' criado com sucesso!`);
        setIsCreateModalOpen(false);
        setFormName('');
        setFormRole('');
        setFormTitle('');
        setFormMission('');
        setFormDecisionScope('');
        setFormScopeConstraints('');
        setFormKeywords('');
        setFormPrompts('');

        await fetchUsers();
        await fetchSystemDesign(selectedUserId);
        setSelectedRole(payload.role);
        if (payload.sample_prompts.length > 0) {
          setTestPrompt(payload.sample_prompts[0]);
        }
      } else {
        toast.error(resp.data?.error || 'Erro ao criar agente personalizado.');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao criar agente.');
    } finally {
      setIsCreatingAgent(false);
    }
  };

  const handleDeleteCustomAgent = async (agentId: number, agentName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Deseja remover o agente personalizado '${agentName}'?`)) {
      return;
    }

    setIsDeletingAgentId(agentId);
    try {
      await axios.delete(`${API_BASE_URL}/api/v2/studio/system-design/custom-agents/${agentId}/`);
      toast.success(`Agente '${agentName}' removido com sucesso.`);
      await fetchUsers();
      await fetchSystemDesign(selectedUserId);
      if (selectedRole === currentAgent?.role) {
        setSelectedRole('director');
      }
    } catch {
      toast.error('Erro ao remover agente personalizado.');
    } finally {
      setIsDeletingAgentId(null);
    }
  };

  // Pre-generate cURL
  const curlGetCommand = `curl -X GET "${API_BASE_URL}/api/v2/studio/system-design/${
    selectedUserId !== 'all' ? `?user_id=${selectedUserId}` : ''
  }" \
  -H "Accept: application/json"`;

  const curlPostCommand = `curl -X POST "${API_BASE_URL}/api/v2/studio/system-design/test-agent/" \
  -H "Content-Type: application/json" \
  -d '{\n    "agent_role": "${selectedRole}",\n    "prompt": "${testPrompt.replace(
    /"/g,
    '\"'
  )}",\n    "temperature": ${temperature}${
    currentAgent?.user_id ? `,\n    "user_id": ${currentAgent.user_id}` : ''
  }\n  }'`;

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 font-sans selection:bg-zinc-800 flex flex-col">
      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-[#09090b]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 shrink-0">
            <button
              onClick={() => navigate('/studio')}
              className="p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 transition-colors cursor-pointer"
              title="Voltar ao Katana Studio"
            >
              <ArrowLeft className="size-4" />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-md bg-zinc-800 border border-zinc-700">
                <Cpu className="size-4 text-zinc-300" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm tracking-tight text-white">KATANA STUDIO</span>
                  <span className="text-zinc-600 text-xs">/</span>
                  <span className="text-xs text-zinc-400 font-medium">System Design & Agentes</span>
                </div>
                <div className="text-[10px] text-zinc-500 font-mono">
                  Multi-Agent Cognitive Framework v2.6.0
                </div>
              </div>
            </div>
          </div>

          {/* Center Tabs Navigation */}
          <div className="hidden lg:flex items-center bg-zinc-900 border border-zinc-800 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('playground')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'playground'
                  ? 'bg-zinc-100 text-zinc-950 font-semibold shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Sparkles className="size-3.5" />
              Laboratorio de Agentes
            </button>
            <button
              onClick={() => setActiveTab('architecture')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'architecture'
                  ? 'bg-zinc-100 text-zinc-950 font-semibold shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Layers className="size-3.5" />
              Arquitetura & Pipeline
            </button>
            <button
              onClick={() => setActiveTab('api-docs')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'api-docs'
                  ? 'bg-zinc-100 text-zinc-950 font-semibold shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Terminal className="size-3.5" />
              Console de API & cURL
            </button>
          </div>

          {/* Right Status & User Workspace Selector */}
          <div className="flex items-center gap-3">
            {/* User Workspace Selector */}
            <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-xl">
              <Users className="size-3.5 text-zinc-400 shrink-0" />
              <select
                value={selectedUserId}
                onChange={(e) => handleUserChange(e.target.value)}
                className="bg-transparent text-xs text-zinc-200 font-medium focus:outline-none cursor-pointer pr-1"
                title="Filtrar por usuario e workspace"
              >
                <option value="all" className="bg-zinc-900 text-zinc-200">
                  Todos os Usuarios
                </option>
                {usersList.map((u) => (
                  <option key={u.id} value={u.id.toString()} className="bg-zinc-900 text-zinc-200">
                    {u.name || u.username} ({u.active_custom_agents_count} custom)
                  </option>
                ))}
              </select>
            </div>

            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-mono">
              <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
              API 200 OK
            </div>

            <button
              onClick={() => {
                fetchUsers();
                fetchSystemDesign(selectedUserId);
              }}
              disabled={isLoadingSpec}
              className="p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 transition-colors cursor-pointer disabled:opacity-50"
              title="Recarregar especificacoes do backend"
            >
              <RefreshCw className={`size-4 ${isLoadingSpec ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => navigate('/studio')}
              className="px-3 py-1.5 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white rounded-lg border border-zinc-700 transition-colors cursor-pointer"
            >
              Studio
            </button>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
        {isLoadingSpec && !systemData ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3 text-zinc-500">
            <Loader2 className="size-7 animate-spin text-zinc-400" />
            <span className="text-xs font-mono">Carregando especificacoes do System Design...</span>
          </div>
        ) : (
          <>
            {/* TAB 1: LABORATORIO DE AGENTES (PLAYGROUND) */}
            {activeTab === 'playground' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Column: Agent Selector & Profile (5 cols) */}
                <div className="lg:col-span-5 space-y-6">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-sm font-semibold text-white tracking-tight">Conselho Editorial de Agentes</h2>
                        <p className="text-xs text-zinc-400">
                          {selectedUserId === 'all'
                            ? 'Exibindo todos os agentes do sistema e workspaces'
                            : 'Exibindo agentes vinculados ao usuario selecionado'}
                        </p>
                      </div>
                      <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="px-2.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                      >
                        <Plus className="size-3.5" />
                        Criar Agente
                      </button>
                    </div>

                    {/* Filter Tabs: Todos, Sistema, Personalizados */}
                    <div className="flex items-center gap-1 bg-zinc-900/80 border border-zinc-800 p-1 rounded-xl text-xs">
                      <button
                        onClick={() => setAgentFilter('all')}
                        className={`flex-1 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                          agentFilter === 'all' ? 'bg-zinc-800 text-white font-semibold' : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        Todos ({agentsList.length})
                      </button>
                      <button
                        onClick={() => setAgentFilter('system')}
                        className={`flex-1 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                          agentFilter === 'system' ? 'bg-zinc-800 text-white font-semibold' : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        Sistema ({agentsList.filter((a) => !a.is_custom).length})
                      </button>
                      <button
                        onClick={() => setAgentFilter('custom')}
                        className={`flex-1 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                          agentFilter === 'custom' ? 'bg-zinc-800 text-white font-semibold' : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        Personalizados ({agentsList.filter((a) => a.is_custom).length})
                      </button>
                    </div>
                  </div>

                  {/* Agent Selection Cards */}
                  <div className="grid grid-cols-1 gap-2.5 max-h-[560px] overflow-y-auto pr-1">
                    {filteredAgents.length === 0 ? (
                      <div className="p-8 text-center rounded-xl border border-zinc-800/80 bg-zinc-900/30 text-zinc-500 text-xs">
                        Nenhum agente encontrado neste filtro.
                      </div>
                    ) : (
                      filteredAgents.map((agent) => {
                        const isSelected = agent.role === selectedRole;
                        return (
                          <div
                            key={agent.role}
                            onClick={() => {
                              setSelectedRole(agent.role);
                              if (agent.sample_prompts && agent.sample_prompts.length > 0) {
                                setTestPrompt(agent.sample_prompts[0]);
                              }
                              setTestResult(null);
                            }}
                            className={`w-full p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-start justify-between gap-3 ${
                              isSelected
                                ? 'bg-zinc-800/90 border-zinc-600 shadow-md ring-1 ring-zinc-500/20'
                                : 'bg-zinc-900/50 border-zinc-800/80 hover:bg-zinc-800/50 hover:border-zinc-700'
                            }`}
                          >
                            <div className="space-y-1 min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-semibold text-white">{agent.name}</span>
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                                  {agent.role}
                                </span>
                                {agent.is_custom ? (
                                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-600">
                                    Personalizado • @{agent.owner_user}
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
                                    Sistema
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-zinc-400 leading-tight">
                                {agent.department} • {agent.title}
                              </div>
                              <div className="text-[11px] text-zinc-400 line-clamp-2 pt-1">
                                {agent.mission}
                              </div>
                            </div>
                            <div className="shrink-0 flex items-center gap-2 mt-1">
                              {agent.is_custom && agent.id && (
                                <button
                                  onClick={(e) => handleDeleteCustomAgent(agent.id!, agent.name, e)}
                                  disabled={isDeletingAgentId === agent.id}
                                  className="p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors cursor-pointer"
                                  title="Remover agente personalizado"
                                >
                                  {isDeletingAgentId === agent.id ? (
                                    <Loader2 className="size-3.5 animate-spin" />
                                  ) : (
                                    <Trash2 className="size-3.5" />
                                  )}
                                </button>
                              )}
                              <div
                                className={`size-2 rounded-full ${
                                  isSelected ? 'bg-zinc-100 ring-4 ring-zinc-600' : 'bg-zinc-700'
                                }`}
                              />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Detailed Agent Dossier */}
                  {currentAgent && (
                    <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-4">
                      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="size-4 text-zinc-400" />
                          <span className="text-xs font-semibold text-zinc-200">Dossie de Governanca</span>
                        </div>
                        <span className="text-[10px] font-mono text-zinc-400">
                          {currentAgent.is_custom ? `Agente de @${currentAgent.owner_user}` : 'Agente Canonico'}
                        </span>
                      </div>

                      <div className="space-y-3 text-xs">
                        <div>
                          <span className="text-[11px] text-zinc-400 block font-medium">Escopo de Decisao:</span>
                          <p className="text-zinc-300 mt-0.5 leading-relaxed">{currentAgent.decision_scope || 'Nao delimitado.'}</p>
                        </div>

                        <div>
                          <span className="text-[11px] text-zinc-400 block font-medium">Linhas Vermelhas (O que NAO pode fazer):</span>
                          <p className="text-zinc-400 mt-0.5 leading-relaxed">{currentAgent.scope_constraints || 'Sem restricoes adicionais registradas.'}</p>
                        </div>

                        {currentAgent.evaluation_keywords && currentAgent.evaluation_keywords.length > 0 && (
                          <div>
                            <span className="text-[11px] text-zinc-400 block font-medium">Palavras-chave de Validacao:</span>
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {currentAgent.evaluation_keywords.map((kw) => (
                                <span
                                  key={kw}
                                  className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800/80 border border-zinc-700 text-zinc-300"
                                >
                                  {kw}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Expandable System Prompt */}
                        <div className="pt-2 border-t border-zinc-800">
                          <button
                            type="button"
                            onClick={() => setShowSystemPrompt((prev) => !prev)}
                            className="w-full flex items-center justify-between text-xs text-zinc-400 hover:text-zinc-200 py-1 cursor-pointer"
                          >
                            <span className="flex items-center gap-1.5">
                              <Code2 className="size-3.5" />
                              System Prompt Oficial do Cargo
                            </span>
                            {showSystemPrompt ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                          </button>

                          {showSystemPrompt && (
                            <div className="mt-2 p-3 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-[10px] text-zinc-300 space-y-2 max-h-48 overflow-y-auto leading-relaxed">
                              {currentAgent.system_prompt ? (
                                <div className="whitespace-pre-wrap">{currentAgent.system_prompt}</div>
                              ) : (
                                <>
                                  <div>{`Voce e o ${currentAgent.name} (${currentAgent.title}) no Katana Studio.`}</div>
                                  <div>{`Missao: ${currentAgent.mission}`}</div>
                                  <div>{`Escopo: ${currentAgent.decision_scope}`}</div>
                                  <div>{`Restricoes: ${currentAgent.scope_constraints}`}</div>
                                  <div>Regra inegociavel: ZERO EMOJIS em qualquer resposta.</div>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Column: Interactive Test Console & Execution (7 cols) */}
                <div className="lg:col-span-7 space-y-6">
                  {/* Console Card */}
                  <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/60 shadow-xl space-y-4">
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                      <div className="flex items-center gap-2">
                        <Terminal className="size-4 text-zinc-400" />
                        <span className="text-xs font-semibold text-white">
                          Console de Teste • {currentAgent?.name}
                        </span>
                        {currentAgent?.is_custom && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                            Customizado (@{currentAgent.owner_user})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-zinc-400">Temperatura: {temperature}</span>
                        <input
                          type="range"
                          min="0.0"
                          max="1.0"
                          step="0.1"
                          value={temperature}
                          onChange={(e) => setTemperature(parseFloat(e.target.value))}
                          className="w-20 accent-zinc-100 cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* Quick Presets */}
                    {currentAgent?.sample_prompts && currentAgent.sample_prompts.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
                          Prompts Sugeridos para {currentAgent.role}:
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {currentAgent.sample_prompts.map((sample, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setTestPrompt(sample)}
                              className="text-[11px] px-2.5 py-1 rounded-lg bg-zinc-800/80 hover:bg-zinc-700/80 border border-zinc-700 text-zinc-300 hover:text-white transition-colors text-left cursor-pointer"
                            >
                              {sample}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Prompt Textarea */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-medium text-zinc-300">
                        Prompt de Teste para o Agente:
                      </label>
                      <textarea
                        rows={4}
                        value={testPrompt}
                        onChange={(e) => setTestPrompt(e.target.value)}
                        placeholder={`Pergunte algo ao ${currentAgent?.name}...`}
                        className="w-full p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs font-mono focus:outline-none focus:border-zinc-500 resize-none transition-colors"
                      />
                    </div>

                    {/* Trigger Button */}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-zinc-400 font-mono">
                        Validacao direta com Google Gemini 2.5
                      </span>
                      <button
                        type="button"
                        onClick={handleExecuteAgentTest}
                        disabled={isExecutingTest || !testPrompt.trim()}
                        className="px-5 py-2.5 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-semibold text-xs flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 shadow-sm"
                      >
                        {isExecutingTest ? (
                          <>
                            <Loader2 className="size-3.5 animate-spin" />
                            Consultando Persona...
                          </>
                        ) : (
                          <>
                            <Send className="size-3.5" />
                            Testar Agente em Tempo Real
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Output Display */}
                  {testResult && (
                    <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/80 shadow-xl space-y-4 animate-in fade-in duration-200">
                      {/* Output Metrics Bar */}
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5 text-xs text-zinc-300">
                            <Clock className="size-3.5 text-zinc-400" />
                            <span className="font-mono">{testResult.duration_ms} ms</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs">
                            <CheckCircle2 className="size-3.5 text-emerald-400" />
                            <span className="text-emerald-400 font-mono text-[11px]">Zero Emojis OK</span>
                          </div>
                          {testResult.fidelity_percentage !== undefined && (
                            <div className="flex items-center gap-1.5 text-xs font-mono">
                              <span className="text-zinc-400">Aderencia de Cargo:</span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
                                  testResult.fidelity_percentage >= 25
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                }`}
                              >
                                {testResult.fidelity_percentage}% ({testResult.status || 'AVALIADO'})
                              </span>
                            </div>
                          )}
                        </div>

                        <button
                          onClick={() => handleCopy(testResult.response, 'Resposta')}
                          className="px-2.5 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          {copiedText === 'Resposta' ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                          Copiar Resposta
                        </button>
                      </div>

                      {/* Keywords Detected */}
                      {testResult.matched_keywords && testResult.matched_keywords.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
                            Termos Caracteristicos do Cargo Detectados:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {testResult.matched_keywords.map((kw, idx) => (
                              <span
                                key={idx}
                                className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                              >
                                {kw}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Raw Response Text */}
                      <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 leading-relaxed whitespace-pre-wrap font-sans">
                        {testResult.response}
                      </div>
                    </div>
                  )}

                  {/* Session Test History */}
                  {history.length > 0 && (
                    <div className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 space-y-3">
                      <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                        <div className="flex items-center gap-2">
                          <History className="size-3.5 text-zinc-400" />
                          <span className="text-xs font-semibold text-zinc-300">Historico de Testes na Sessao</span>
                        </div>
                        <span className="text-[10px] font-mono text-zinc-400">{history.length} execucoes</span>
                      </div>

                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {history.map((item) => (
                          <div
                            key={item.id}
                            onClick={() => {
                              setSelectedRole(item.role);
                              setTestPrompt(item.prompt);
                              setTestResult({
                                response: item.response,
                                duration_ms: item.duration_ms,
                                matched_keywords: item.matched_keywords,
                                zero_emojis_compliant: item.zero_emojis_compliant,
                                fidelity_percentage: item.fidelity_percentage,
                                status: item.status,
                                is_custom: item.is_custom,
                              });
                            }}
                            className="p-2.5 rounded-lg border border-zinc-800 bg-zinc-950/60 hover:bg-zinc-800/40 transition-colors cursor-pointer flex items-center justify-between gap-3 text-xs"
                          >
                            <div className="space-y-0.5 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[10px] px-1.5 rounded bg-zinc-800 text-zinc-300">
                                  {item.agentName}
                                </span>
                                {item.is_custom && (
                                  <span className="text-[9px] font-mono px-1 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
                                    custom
                                  </span>
                                )}
                                <span className="text-[10px] text-zinc-500">{item.timestamp}</span>
                              </div>
                              <div className="text-zinc-400 text-[11px] truncate">{item.prompt}</div>
                            </div>
                            <div className="shrink-0 text-right">
                              <span className="text-[10px] font-mono text-zinc-400">{item.duration_ms} ms</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: ARQUITETURA & PIPELINE */}
            {activeTab === 'architecture' && systemData && (
              <div className="space-y-8">
                {/* Hardware & Print Specifications */}
                <div>
                  <h2 className="text-base font-semibold text-white tracking-tight">
                    Padroes de Diagramacao & Especificacoes de Engenharia
                  </h2>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Parametros de precisao grafica utilizados pelo diretor de arte e pelo motor de renderizacao.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-1">
                    <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
                      Dimensoes Pagina Unica
                    </span>
                    <div className="text-lg font-bold text-white font-mono">
                      {systemData.design_standards.page_dimensions.page_width_px} x{' '}
                      {systemData.design_standards.page_dimensions.page_height_px} px
                    </div>
                    <span className="text-[11px] text-zinc-400 block">
                      Formato {systemData.design_standards.page_dimensions.format} (Vertical)
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-1">
                    <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
                      Dimensoes Lamina Dupla
                    </span>
                    <div className="text-lg font-bold text-white font-mono">
                      {systemData.design_standards.page_dimensions.spread_width_px} x{' '}
                      {systemData.design_standards.page_dimensions.spread_height_px} px
                    </div>
                    <span className="text-[11px] text-zinc-400 block">Spread duplo panoramico</span>
                  </div>

                  <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-1">
                    <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
                      Resolucao Grafica
                    </span>
                    <div className="text-lg font-bold text-white font-mono">
                      {systemData.design_standards.page_dimensions.print_dpi} DPI
                    </div>
                    <span className="text-[11px] text-zinc-400 block">
                      {systemData.design_standards.page_dimensions.screen_ppi} PPI em tela / 300 para offset
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-1">
                    <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
                      Protocolo de Estado
                    </span>
                    <div className="text-lg font-bold text-white font-mono">JSON Delta Patch</div>
                    <span className="text-[11px] text-zinc-400 block">Modificacoes cirurgicas atomicas</span>
                  </div>
                </div>

                {/* 6-Stage Pipeline Sequence */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-white tracking-tight">
                    Pipeline Sequencial de 6 Estagios
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {systemData.pipeline_stages.map((stg) => (
                      <div
                        key={stg.stage}
                        className="p-5 rounded-xl bg-zinc-900/40 border border-zinc-800 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono font-bold text-zinc-400 px-2 py-0.5 rounded bg-zinc-800">
                            Estagio 0{stg.stage}
                          </span>
                          <span className="text-[10px] font-mono text-zinc-500">Automacao IA</span>
                        </div>
                        <h4 className="text-sm font-semibold text-white">{stg.name}</h4>
                        <p className="text-xs text-zinc-400 leading-relaxed">{stg.description}</p>
                        <div className="flex flex-wrap gap-1 pt-2 border-t border-zinc-800/80">
                          {stg.components.map((comp) => (
                            <span
                              key={comp}
                              className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300"
                            >
                              {comp}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Editorial Principles */}
                <div className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800 space-y-4">
                  <h3 className="text-sm font-semibold text-white tracking-tight">
                    Principios Editoriais Inegociaveis
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-zinc-300">
                    {systemData.design_standards.editorial_principles.map((principle, idx) => (
                      <div key={idx} className="flex items-start gap-2.5">
                        <CheckCircle2 className="size-4 text-zinc-400 shrink-0 mt-0.5" />
                        <span>{principle}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: CONSOLE DE API & CURL */}
            {activeTab === 'api-docs' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-base font-semibold text-white tracking-tight">
                    Documentacao de Endpoints & Terminal cURL
                  </h2>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Utilize estes comandos para consultar a arquitetura ou integrar testes automatizados via terminal ou CI/CD.
                  </p>
                </div>

                {/* Endpoint 1: GET System Design */}
                <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        GET
                      </span>
                      <span className="font-mono text-xs text-zinc-200">/api/v2/studio/system-design/</span>
                    </div>
                    <button
                      onClick={() => handleCopy(curlGetCommand, 'cURL GET')}
                      className="px-2.5 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      {copiedText === 'cURL GET' ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                      Copiar cURL
                    </button>
                  </div>
                  <p className="text-xs text-zinc-400">
                    Retorna a especificacao completa de arquitetura, estagios de pipeline e perfis de agentes registrados.
                  </p>
                  <pre className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 text-[11px] font-mono text-zinc-300 overflow-x-auto">
                    {curlGetCommand}
                  </pre>
                </div>

                {/* Endpoint 2: POST Test Agent */}
                <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        POST
                      </span>
                      <span className="font-mono text-xs text-zinc-200">/api/v2/studio/system-design/test-agent/</span>
                    </div>
                    <button
                      onClick={() => handleCopy(curlPostCommand, 'cURL POST')}
                      className="px-2.5 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      {copiedText === 'cURL POST' ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                      Copiar cURL
                    </button>
                  </div>
                  <p className="text-xs text-zinc-400">
                    Dispara uma requisicao direta ao Google Gemini com o papel do agente selecionado e audita a fidelidade do cargo.
                  </p>
                  <pre className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 text-[11px] font-mono text-zinc-300 overflow-x-auto">
                    {curlPostCommand}
                  </pre>
                </div>

                {/* Raw JSON Spec Viewer */}
                {systemData && (
                  <div className="p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-zinc-300">Resposta JSON Completa (Live)</span>
                      <button
                        onClick={() => handleCopy(JSON.stringify(systemData, null, 2), 'JSON Completo')}
                        className="px-2.5 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        {copiedText === 'JSON Completo' ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                        Copiar JSON
                      </button>
                    </div>
                    <pre className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 text-[11px] font-mono text-zinc-400 max-h-96 overflow-y-auto leading-relaxed">
                      {JSON.stringify(systemData, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* Modal: Criar Novo Agente Personalizado */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-6 space-y-5 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Plus className="size-4 text-zinc-200" />
                <h3 className="text-sm font-semibold text-white">Criar Novo Agente Especialista</h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomAgent} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-zinc-300 font-medium">Nome do Especialista *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Consultor de Embalagens"
                    value={formName}
                    onChange={(e) => {
                      setFormName(e.target.value);
                      if (!formRole) {
                        setFormRole(e.target.value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''));
                      }
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-zinc-300 font-medium">Slug de Cargo (ID) *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: cold_packaging_expert"
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 font-mono placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-zinc-300 font-medium">Titulo Executivo</label>
                  <input
                    type="text"
                    placeholder="Ex: Head de Engenharia Termica"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-zinc-300 font-medium">Departamento</label>
                  <input
                    type="text"
                    placeholder="Ex: Conservacao & Logistica"
                    value={formDepartment}
                    onChange={(e) => setFormDepartment(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-zinc-300 font-medium">Missao Principal do Agente *</label>
                <textarea
                  required
                  rows={2}
                  placeholder="Ex: Avaliar a resistencia termica e a durabilidade dos materiais para delivery..."
                  value={formMission}
                  onChange={(e) => setFormMission(e.target.value)}
                  className="w-full p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-zinc-300 font-medium">Escopo de Decisao</label>
                  <input
                    type="text"
                    placeholder="Ex: Materiais, espessura, isolamento"
                    value={formDecisionScope}
                    onChange={(e) => setFormDecisionScope(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-zinc-300 font-medium">Linhas Vermelhas (O que NAO pode)</label>
                  <input
                    type="text"
                    placeholder="Ex: Nao altera tabelas de precos"
                    value={formScopeConstraints}
                    onChange={(e) => setFormScopeConstraints(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-zinc-300 font-medium">Palavras-chave de Validacao (separadas por virgula)</label>
                <input
                  type="text"
                  placeholder="termica, biodegradavel, protecao, resistencia"
                  value={formKeywords}
                  onChange={(e) => setFormKeywords(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 font-mono placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-zinc-300 font-medium">Prompts de Teste Sugeridos (um por linha)</label>
                <textarea
                  rows={2}
                  placeholder="Qual a embalagem ideal para conservar sorvete por 2 horas no delivery?"
                  value={formPrompts}
                  onChange={(e) => setFormPrompts(e.target.value)}
                  className="w-full p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white font-medium transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isCreatingAgent}
                  className="px-4 py-2 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 font-semibold flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isCreatingAgent ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Criando Agente...
                    </>
                  ) : (
                    'Salvar e Ativar Agente'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SystemDesignPage;
