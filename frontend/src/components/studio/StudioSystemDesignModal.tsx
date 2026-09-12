import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
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
  Eye,
  Maximize2,
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { useStudioStore, API_BASE_URL } from '../../store/studioStore';

type TabKey = 'architecture' | 'playground';

interface AgentProfile {
  role: string;
  name: string;
  title: string;
  department: string;
  mission: string;
  key_responsibilities: string[];
  decision_scope: string;
  scope_constraints: string;
  evaluation_keywords: string[];
  sample_prompts: string[];
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

export const StudioSystemDesignModal: React.FC = () => {
  const {
    isSystemDesignModalOpen,
    closeSystemDesignModal,
    theme,
  } = useStudioStore();
  const navigate = useNavigate();

  const isDark = theme === 'dark';

  const [activeTab, setActiveTab] = useState<TabKey>('architecture');
  const [systemData, setSystemData] = useState<SystemDesignData | null>(null);
  const [agentsList, setAgentsList] = useState<AgentProfile[]>([]);
  const [isLoadingSpec, setIsLoadingSpec] = useState(false);

  // Playground State
  const [selectedRole, setSelectedRole] = useState<string>('director');
  const [testPrompt, setTestPrompt] = useState<string>(
    'Como diagramar uma pagina dupla para apresentar 4 modelos de embalagens plasticas descartaveis?'
  );
  const [isExecutingTest, setIsExecutingTest] = useState(false);
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  useEffect(() => {
    if (isSystemDesignModalOpen) {
      fetchSystemDesign();
    }
  }, [isSystemDesignModalOpen]);

  const fetchSystemDesign = async () => {
    setIsLoadingSpec(true);
    try {
      const resp = await axios.get(`${API_BASE_URL}/api/v2/studio/system-design/`);
      if (resp.data) {
        setSystemData(resp.data.system_design);
        setAgentsList(resp.data.agents || []);
      }
    } catch (err) {
      console.warn('[StudioSystemDesignModal] Falha ao carregar system design do backend:', err);
    } finally {
      setIsLoadingSpec(false);
    }
  };

  const handleSelectRole = (role: string) => {
    setSelectedRole(role);
    const profile = agentsList.find((a) => a.role === role);
    if (profile && profile.sample_prompts?.length > 0) {
      setTestPrompt(profile.sample_prompts[0]);
    }
    setTestResult(null);
  };

  const handleRunAgentTest = async () => {
    if (!testPrompt.trim()) {
      toast.error('Digite um prompt para testar o agente.');
      return;
    }

    setIsExecutingTest(true);
    setTestResult(null);

    try {
      const resp = await axios.post(`${API_BASE_URL}/api/v2/studio/system-design/test-agent/`, {
        agent_role: selectedRole,
        prompt: testPrompt,
        context: {
          brand_name: 'Catana Embalagens',
          style_preset: 'editorial_clean',
        },
      });

      setTestResult(resp.data);
      toast.success(`Parecer do ${resp.data?.agent?.name || 'Agente'} gerado com sucesso!`);
    } catch (err: any) {
      console.error('[handleRunAgentTest] Falha ao testar agente:', err);
      toast.error('Erro ao comunicar com o agente no backend.');
    } finally {
      setIsExecutingTest(false);
    }
  };

  if (!isSystemDesignModalOpen) return null;

  const currentAgent = agentsList.find((a) => a.role === selectedRole) || agentsList[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs select-none">
      <div
        className={`w-full max-w-5xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[92vh] transition-all animate-in fade-in zoom-in-95 ${
          isDark
            ? 'bg-[#0e0e11] border-zinc-800 text-zinc-100 shadow-[0_0_50px_rgba(0,0,0,0.85)]'
            : 'bg-white border-zinc-200 text-zinc-900 shadow-2xl'
        }`}
      >
        {/* Modal Header */}
        <div
          className={`px-6 py-4 border-b flex items-center justify-between shrink-0 ${
            isDark ? 'border-zinc-800/80 bg-zinc-900/40' : 'border-zinc-100 bg-zinc-50'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-xl border ${
                isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-300' : 'bg-zinc-100 border-zinc-200 text-zinc-700'
              }`}
            >
              <Cpu className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold tracking-tight">System Design & Conselho Multi-Agentes</h2>
                <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700 font-semibold">
                  v2.5.0
                </span>
              </div>
              <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                Especificacao viva da arquitetura do Katana Studio e laboratorio de teste de fidelidade de cargos.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                closeSystemDesignModal();
                navigate('/system-design');
              }}
              className={`px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-medium ${
                isDark
                  ? 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800'
                  : 'bg-zinc-100 border-zinc-200 text-zinc-700 hover:text-zinc-950'
              }`}
              title="Abrir em pagina inteira"
              aria-label="Abrir em pagina inteira"
            >
              <Maximize2 className="size-3.5" />
              <span className="hidden sm:inline">Tela Cheia</span>
            </button>

            <button
              type="button"
              onClick={closeSystemDesignModal}
              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                isDark
                  ? 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                  : 'bg-zinc-100 border-zinc-200 text-zinc-600 hover:text-zinc-950'
              }`}
              aria-label="Fechar"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div
          className={`px-6 py-2.5 border-b flex items-center justify-between shrink-0 ${
            isDark ? 'border-zinc-800/60 bg-zinc-900/20' : 'border-zinc-100 bg-zinc-50/60'
          }`}
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('architecture')}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'architecture'
                  ? 'bg-zinc-100 text-zinc-950 shadow-xs'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
              }`}
            >
              <Layers className="size-3.5" />
              <span>Arquitetura & System Design</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('playground')}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'playground'
                  ? 'bg-zinc-100 text-zinc-950 shadow-xs'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
              }`}
            >
              <Sparkles className="size-3.5" />
              <span>Laboratorio de Agentes (Playground)</span>
            </button>
          </div>

          <button
            type="button"
            onClick={fetchSystemDesign}
            disabled={isLoadingSpec}
            className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer disabled:opacity-50"
            title="Atualizar especificacao do backend"
          >
            <RefreshCw className={`size-3.5 ${isLoadingSpec ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          {/* TAB 1: ARCHITECTURE & SYSTEM DESIGN */}
          {activeTab === 'architecture' && (
            <div className="space-y-6">
              {/* Architecture Overview Banner */}
              <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">
                    Paradigma de Engenharia
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400 bg-zinc-800/80 px-2 py-0.5 rounded border border-zinc-700/60">
                    Engine: Google Gemini
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-zinc-100">
                  {systemData?.system_name || 'Katana Studio 2.0 - Multi-Agent Editorial Intelligence Platform'}
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Sistema orquestrado composto por 6 agentes especialistas que atuam de forma coordenada para converter dados brutos de planilhas e briefings em catalogos de luxo diagramados com fidelidade matematica ao padrao A4.
                </p>
              </div>

              {/* Design Standards Grid */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3 font-mono">
                  Parametros Graficos e Padroes Editoriais (A4 Spreads)
                </h4>
                <div className="grid grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl border border-zinc-800 bg-zinc-900/30">
                    <span className="text-[10px] font-mono uppercase text-zinc-500 block">Dimensoes Pagina</span>
                    <span className="text-sm font-semibold font-mono text-zinc-200 mt-0.5 block">794 x 1123 px</span>
                    <span className="text-[10.5px] text-zinc-500 mt-1 block">Padrao A4 Retrato (72 PPI tela / 300 DPI print)</span>
                  </div>

                  <div className="p-3 rounded-xl border border-zinc-800 bg-zinc-900/30">
                    <span className="text-[10px] font-mono uppercase text-zinc-500 block">Laminas Duplas</span>
                    <span className="text-sm font-semibold font-mono text-zinc-200 mt-0.5 block">1588 x 1123 px</span>
                    <span className="text-[10.5px] text-zinc-500 mt-1 block">Composicao Verso/Reto com ritmo visual</span>
                  </div>

                  <div className="p-3 rounded-xl border border-zinc-800 bg-zinc-900/30">
                    <span className="text-[10px] font-mono uppercase text-zinc-500 block">Respiro & Margens</span>
                    <span className="text-sm font-semibold font-mono text-zinc-200 mt-0.5 block">32px a 48px</span>
                    <span className="text-[10.5px] text-zinc-500 mt-1 block">Espaco negativo rigoroso para estetica nobre</span>
                  </div>

                  <div className="p-3 rounded-xl border border-zinc-800 bg-zinc-900/30">
                    <span className="text-[10px] font-mono uppercase text-zinc-500 block">Acessibilidade</span>
                    <span className="text-sm font-semibold font-mono text-zinc-200 mt-0.5 block">WCAG AAA</span>
                    <span className="text-[10.5px] text-zinc-500 mt-1 block">Contraste minimo certificado de 7:1</span>
                  </div>
                </div>
              </div>

              {/* Pipeline Stages */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3 font-mono">
                  Pipeline Editorial em 6 Etapas
                </h4>
                <div className="space-y-2">
                  {(systemData?.pipeline_stages || [
                    { stage: 1, name: 'Ingestao de Planilhas & Normalizacao', description: 'Leitura de arquivos Excel (.xlsx, .xls) e CSV com deteccao heuristica multi-criterio de colunas.', components: ['StudioExcelImportModal', 'SheetJS'] },
                    { stage: 2, name: 'Inteligencia Semantica & Deteccao de Utilidade', description: 'O Gemini investiga o nome e especificacoes do produto para entender sua funcao e utilidade comercial.', components: ['Google Gemini', 'Semantic Reasoning'] },
                    { stage: 3, name: 'RAG de Blueprints Editoriais', description: 'Recuperacao vetorial de gabaritos homologados com base na categoria e numero de itens.', components: ['TemplateRAGService', 'Cosine Similarity'] },
                    { stage: 4, name: 'Sintese Multi-Agente do Conselho', description: 'Orquestracao entre Direcao de Arte, Redacao, Comercial B2B e Auditoria de Branding.', components: ['Multi-Agent Council'] },
                    { stage: 5, name: 'Renderizacao do Canvas A4 em Tempo Real', description: 'Renderizacao fluida com edicao inline WYSIWYG e alocacao por drag-and-drop da gaveta.', components: ['SpreadViewport', 'ProductDrawer'] },
                    { stage: 6, name: 'Exportacao de Alta Fidelidade', description: 'Compilacao grafica para impressao em PDF de alta resolucao no padrao A4.', components: ['html2canvas', 'jsPDF'] },
                  ]).map((stg) => (
                    <div
                      key={stg.stage}
                      className="p-3 rounded-xl border border-zinc-800/80 bg-zinc-900/30 flex items-start gap-3.5"
                    >
                      <span className="size-6 rounded-lg bg-zinc-800 text-zinc-300 flex items-center justify-center text-xs font-mono font-bold shrink-0 mt-0.5">
                        {stg.stage}
                      </span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h5 className="text-xs font-semibold text-zinc-200">{stg.name}</h5>
                          <div className="flex items-center gap-1.5">
                            {stg.components?.map((c, i) => (
                              <span key={i} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-zinc-800/60 text-zinc-400 border border-zinc-700/40">
                                {c}
                              </span>
                            ))}
                          </div>
                        </div>
                        <p className="text-[11.5px] text-zinc-400 mt-1 leading-relaxed">{stg.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Protocol JSON Patch Info */}
              <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/20 flex items-start gap-3">
                <Code2 className="size-4 text-zinc-400 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <span className="font-semibold text-zinc-200 block">Protocolo de Modificacao do Canvas (JSON Delta Patch):</span>
                  <p className="text-zinc-400 leading-relaxed">
                    Os agentes comunicam mutacoes nas pranchetas atraves de blocos estruturados <code className="text-zinc-300 font-mono text-[11px] bg-zinc-800 px-1 rounded">json:patch</code>, garantindo atualizacoes cirurgicas e reversibilidade das alteracoes.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: AGENT PLAYGROUND */}
          {activeTab === 'playground' && (
            <div className="space-y-6">
              {/* Agent Selector Ribbon */}
              <div>
                <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 mb-2 block">
                  Selecione o Agente para Auditar a Resposta do Cargo:
                </span>
                <div className="grid grid-cols-6 gap-2">
                  {(agentsList.length > 0
                    ? agentsList
                    : [
                        { role: 'orchestrator', name: 'Editor-Chefe', title: 'Head de Estrategia Editorial' },
                        { role: 'director', name: 'Diretor de Arte', title: 'Head de Design Editorial' },
                        { role: 'copywriter', name: 'Redator Publicitario', title: 'Senior Copywriter' },
                        { role: 'commercial', name: 'Tabela Comercial', title: 'Especialista B2B' },
                        { role: 'branding', name: 'Auditor de Branding', title: 'Brand Compliance' },
                        { role: 'council', name: 'Conselho Editorial', title: 'Mesa Redonda' },
                      ]
                  ).map((ag: any) => {
                    const isSelected = selectedRole === ag.role;
                    return (
                      <button
                        key={ag.role}
                        type="button"
                        onClick={() => handleSelectRole(ag.role)}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'bg-zinc-800/90 border-zinc-600 text-white shadow-sm ring-1 ring-zinc-500/30'
                            : 'bg-zinc-900/40 border-zinc-800/80 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                        }`}
                      >
                        <span className="text-xs font-semibold block truncate">{ag.name}</span>
                        <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 truncate block mt-1">
                          {ag.role}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Selected Agent Card */}
              {currentAgent && (
                <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/50 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold text-zinc-100">{currentAgent.name}</h4>
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                          {currentAgent.title}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{currentAgent.mission}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowSystemPrompt(!showSystemPrompt)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-zinc-800 text-zinc-300 border border-zinc-700/60 hover:bg-zinc-700/70 transition-colors cursor-pointer shrink-0"
                    >
                      <Eye className="size-3" />
                      <span>{showSystemPrompt ? 'Ocultar Prompt de Sistema' : 'Inspecionar Prompt de Sistema'}</span>
                      {showSystemPrompt ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                    </button>
                  </div>

                  {/* System Prompt Inspector */}
                  {showSystemPrompt && (
                    <div className="p-3 rounded-xl bg-black/60 border border-zinc-800 text-[11px] font-mono text-zinc-300 max-h-48 overflow-y-auto custom-scrollbar whitespace-pre-wrap leading-relaxed">
                      {testResult?.system_prompt_used ||
                        `Prompt de sistema oficial configurado no backend para ${currentAgent.name}. Execute um teste para inspecionar a versao compilada em tempo real.`}
                    </div>
                  )}

                  {/* Key Responsibilities & Scope */}
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-zinc-800/80 text-xs">
                    <div>
                      <span className="font-semibold text-zinc-300 block mb-1">Escopo de Decisao:</span>
                      <p className="text-zinc-400 leading-relaxed text-[11.5px]">{currentAgent.decision_scope}</p>
                    </div>
                    <div>
                      <span className="font-semibold text-zinc-300 block mb-1">Restricao de Cargo (Nao faz):</span>
                      <p className="text-zinc-400 leading-relaxed text-[11.5px]">{currentAgent.scope_constraints}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Sample Prompts */}
              {currentAgent?.sample_prompts?.length > 0 && (
                <div>
                  <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 mb-2 block">
                    Cenários de Teste Rápidos do Cargo (Clique para Carregar):
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {currentAgent.sample_prompts.map((sPrompt, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setTestPrompt(sPrompt)}
                        className="p-2.5 rounded-xl border border-zinc-800/80 bg-zinc-900/30 hover:bg-zinc-800/60 text-left text-xs text-zinc-300 transition-colors cursor-pointer line-clamp-2"
                        title={sPrompt}
                      >
                        {sPrompt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Prompt Input & Execute */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="test-prompt-input" className="text-xs font-semibold text-zinc-300">
                    Mensagem de Teste para o Agente:
                  </label>
                  <span className="text-[11px] font-mono text-zinc-500">
                    Dispara o prompt diretamente via Google Gemini
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    id="test-prompt-input"
                    type="text"
                    value={testPrompt}
                    onChange={(e) => setTestPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !isExecutingTest) {
                        handleRunAgentTest();
                      }
                    }}
                    placeholder="Digite uma instrucao ou cenario de teste para o especialista..."
                    className="flex-1 bg-zinc-900/90 border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-zinc-500 transition-colors"
                  />

                  <button
                    type="button"
                    onClick={handleRunAgentTest}
                    disabled={isExecutingTest || !testPrompt.trim()}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-zinc-100 hover:bg-white text-zinc-950 transition-all cursor-pointer shadow-sm disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                  >
                    {isExecutingTest ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" />
                        <span>Avaliando...</span>
                      </>
                    ) : (
                      <>
                        <Send className="size-3.5" />
                        <span>Testar Agente</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Response & Audit Results */}
              {testResult && (
                <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/60 space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="size-4 text-zinc-300" />
                      <span className="text-xs font-semibold text-zinc-200">
                        Parecer do {testResult.agent?.name} ({testResult.agent?.title})
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700">
                        Tempo: {testResult.audit_metrics?.duration_ms} ms
                      </span>
                      <span className="text-[10px] font-mono text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700">
                        Zero Emojis: {testResult.audit_metrics?.zero_emojis_compliant ? 'Conforme' : 'Nao Conforme'}
                      </span>
                    </div>
                  </div>

                  {/* Generated Response */}
                  <div className="text-xs text-zinc-200 leading-relaxed whitespace-pre-wrap font-sans bg-black/30 p-3.5 rounded-xl border border-zinc-800/70 max-h-72 overflow-y-auto custom-scrollbar">
                    {testResult.response}
                  </div>

                  {/* Matched Keywords */}
                  {testResult.audit_metrics?.matched_keywords?.length > 0 && (
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-[10.5px] font-mono uppercase text-zinc-500">
                        Termos do Cargo Detectados:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {testResult.audit_metrics.matched_keywords.map((kw: string, idx: number) => (
                          <span
                            key={idx}
                            className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700/60"
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          className={`px-6 py-3.5 border-t flex items-center justify-between shrink-0 ${
            isDark ? 'border-zinc-800/80 bg-zinc-900/40' : 'border-zinc-100 bg-zinc-50'
          }`}
        >
          <span className="text-[11px] font-mono text-zinc-500">
            Katana Studio Architecture &copy; 2026 · Certificado de Conformidade Editorial
          </span>

          <button
            type="button"
            onClick={closeSystemDesignModal}
            className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-zinc-100 hover:bg-white text-zinc-950 transition-all cursor-pointer shadow-sm"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
