import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  Scale,
  Database,
  Lock,
  ArrowLeft,
  FileCheck2,
  FileText,
  Server,
  Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export const Transparency: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 font-sans selection:bg-zinc-800">
      {/* Barra de Navegacao Superior */}
      <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-[#09090b]/80 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/studio')}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 transition-colors cursor-pointer"
              title="Voltar ao Studio"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm tracking-tight text-white">CATANA</span>
              <span className="text-zinc-600 text-xs">/</span>
              <span className="text-xs text-zinc-400 font-medium">Transparência & IA</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Badge
              variant="outline"
              className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[11px] font-mono"
            >
              LGPD Compliant
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/studio')}
              className="h-8 text-xs border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 hover:text-white cursor-pointer"
            >
              Voltar ao Studio
            </Button>
          </div>
        </div>
      </header>

      {/* Conteudo Principal */}
      <main className="max-w-5xl mx-auto px-6 py-12 space-y-12">
        {/* Cabecalho Editorial */}
        <section className="space-y-4 text-center max-w-2xl mx-auto">
          <Badge
            variant="outline"
            className="bg-zinc-900 border-zinc-800 text-zinc-400 text-xs font-mono px-3 py-1"
          >
            Governança de IA & Privacidade de Dados
          </Badge>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white">
            Transparência, Segurança e Ética Editorial
          </h1>
          <p className="text-sm md:text-base text-zinc-400 leading-relaxed">
            Entenda como seus catálogos, imagens de produtos e ativos de marca são protegidos no Catana Studio.
            Nossa arquitetura foi construída com foco em isolamento estrito, soberania do cliente e conformidade jurídica.
          </p>
        </section>

        {/* Badges de Confianca Rapidos */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-900/40 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Zero-Training</span>
            </div>
            <p className="text-[11px] text-zinc-500">Seus dados nunca treinam modelos públicos.</p>
          </div>

          <div className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-900/40 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200">
              <Scale className="w-4 h-4 text-zinc-400" />
              <span>100% Titular</span>
            </div>
            <p className="text-[11px] text-zinc-500">Direitos patrimoniais integrais sobre suas peças.</p>
          </div>

          <div className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-900/40 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200">
              <Lock className="w-4 h-4 text-zinc-400" />
              <span>Criptografia AES-256</span>
            </div>
            <p className="text-[11px] text-zinc-500">Proteção de arquivos em trânsito e em repouso.</p>
          </div>

          <div className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-900/40 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200">
              <FileCheck2 className="w-4 h-4 text-zinc-400" />
              <span>Portabilidade LGPD</span>
            </div>
            <p className="text-[11px] text-zinc-500">Exportação completa de dados em JSON em 1 clique.</p>
          </div>
        </section>

        {/* 4 Capitulos Detalhados */}
        <section className="space-y-6">
          {/* Capitulo 1 */}
          <article className="p-6 rounded-2xl border border-zinc-800/80 bg-zinc-900/30 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-zinc-800 border border-zinc-700/60 text-zinc-200">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-white">1. Política Zero-Training de IA</h2>
                <p className="text-xs text-zinc-400">Compromisso irrevogável de privacidade com ativos corporativos</p>
              </div>
            </div>
            <p className="text-xs md:text-sm text-zinc-300 leading-relaxed">
              O maior receio de marcas ao utilizar inteligência artificial é a possibilidade de fotos de novos produtos,
              catálogos confidenciais ou listas de preços serem absorvidas para enriquecer modelos públicos. No Catana Studio:
            </p>
            <ul className="space-y-2 text-xs text-zinc-400 pl-4 list-disc marker:text-zinc-600">
              <li>
                <strong className="text-zinc-200">Não alimentamos modelos públicos:</strong> Nenhum dado, imagem ou texto
                fornecido pelo usuário é compartilhado ou utilizado para treinar ou aprimorar os modelos gerais do Google Gemini.
              </li>
              <li>
                <strong className="text-zinc-200">Contratos Corporativos Seguros:</strong> O acesso às APIs de IA é realizado
                sob acordos corporativos com cláusula estrita de não-retenção de dados para treinamento de terceiros.
              </li>
              <li>
                <strong className="text-zinc-200">Isolamento Multitenant:</strong> Cada organização no Catana Studio opera em
                um ambiente criptografado e isolado, impedindo qualquer vazamento de dados entre clientes.
              </li>
            </ul>
          </article>

          {/* Capitulo 2 */}
          <article className="p-6 rounded-2xl border border-zinc-800/80 bg-zinc-900/30 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-zinc-800 border border-zinc-700/60 text-zinc-200">
                <Scale className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-white">2. Propriedade Intelectual & Soberania Comercial</h2>
                <p className="text-xs text-zinc-400">Direitos autorais e de distribuição pertencem 100% a você</p>
              </div>
            </div>
            <p className="text-xs md:text-sm text-zinc-300 leading-relaxed">
              Todas as obras editoriais, catálogos, folhetos, lookbooks e composições geradas ou diagramadas no Catana Studio
              possuem cessão e titularidade comercial exclusiva da empresa ou usuário criador:
            </p>
            <ul className="space-y-2 text-xs text-zinc-400 pl-4 list-disc marker:text-zinc-600">
              <li>
                <strong className="text-zinc-200">Livre de Royalties:</strong> Você pode comercializar, imprimir, distribuir
                e veicular seus catálogos sem nenhuma taxa, royalty ou cobrança adicional por exemplar distribuído.
              </li>
              <li>
                <strong className="text-zinc-200">Arquivos Prontos para Indústria Gráfica:</strong> Você pode exportar PDFs
                em alta resolução (300 DPI CMYK) com marcas de corte e enviar para qualquer gráfica de sua preferência.
              </li>
              <li>
                <strong className="text-zinc-200">Sem Marcas Obrigatórias no Plano Pago:</strong> Assinantes dos planos Pro
                e Enterprise possuem liberdade total para veicular seus catálogos sem nenhuma marca d'água do Catana.
              </li>
            </ul>
          </article>

          {/* Capitulo 3 */}
          <article className="p-6 rounded-2xl border border-zinc-800/80 bg-zinc-900/30 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-zinc-800 border border-zinc-700/60 text-zinc-200">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-white">3. Stack Tecnológica e Motores Transparentes</h2>
                <p className="text-xs text-zinc-400">Total clareza sobre quais algoritmos e pipelines processam seus dados</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
              <div className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-950/40 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200">
                  <Server className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Google Gemini</span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Motor de orquestração e redação multi-agente (Conselho Editorial). Conexão segura sob TLS 1.3.
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-950/40 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200">
                  <Layers className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Visão Computacional & Recorte</span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Remoção de fundo de produtos processada em pipeline isolada, sem retenção nem envio a redes sociais.
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-950/40 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200">
                  <FileText className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Motor Gráfico 300 DPI</span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Compilação vetorial local em formato CMYK/RGB com curvas exatas para impressão e reprodução digital.
                </p>
              </div>
            </div>
          </article>

          {/* Capitulo 4 */}
          <article className="p-6 rounded-2xl border border-zinc-800/80 bg-zinc-900/30 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-zinc-800 border border-zinc-700/60 text-zinc-200">
                <FileCheck2 className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-white">4. Conformidade LGPD & Direitos do Titular</h2>
                <p className="text-xs text-zinc-400">Atendimento integral aos direitos previstos na Lei 13.709/2018</p>
              </div>
            </div>
            <p className="text-xs md:text-sm text-zinc-300 leading-relaxed">
              O Catana Studio cumpre rigorosamente as determinações da Lei Geral de Proteção de Dados (LGPD) e do regulamento
              europeu (GDPR). Garantimos os seguintes direitos a você:
            </p>
            <ul className="space-y-2 text-xs text-zinc-400 pl-4 list-disc marker:text-zinc-600">
              <li>
                <strong className="text-zinc-200">Direito à Portabilidade (Art. 18, V):</strong> Você pode exportar
                todos os dados da sua conta, sedes, catálogos e faturas a qualquer momento em formato JSON estruturado direto no painel de configurações.
              </li>
              <li>
                <strong className="text-zinc-200">Direito ao Esquecimento / Exclusão:</strong> Ao solicitar a exclusão de sua conta,
                todos os catálogos, imagens salvas e históricos de interações com IA são permanentemente removidos de nossos servidores.
              </li>
              <li>
                <strong className="text-zinc-200">Retenção de Arquivos Temporários:</strong> Documentos PDF ou Word carregados
                para extração automática de paletas ou layouts são processados em memória volátil e purgados após a criação do catálogo.
              </li>
            </ul>
          </article>
        </section>

        {/* Rodape de Contato e DPO */}
        <section className="p-6 rounded-2xl border border-zinc-800 bg-zinc-950/60 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-white">Dúvidas sobre Segurança ou Tratamento de Dados?</p>
            <p className="text-xs text-zinc-400">
              Nossa equipe de segurança e encarregado de dados (DPO) está disponível para responder a auditorias e prestar esclarecimentos.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/studio')}
            className="h-9 px-4 text-xs border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 hover:text-white shrink-0 cursor-pointer"
          >
            Voltar ao Catana Studio
          </Button>
        </section>
      </main>
    </div>
  );
};
