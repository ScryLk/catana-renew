import { Check } from 'lucide-react';
import { Link } from 'react-router-dom';

export function PricingSection() {
  return (
    <section
      id="pricing"
      className="relative w-full bg-[#F5F1EA] text-[#18181B] px-6 md:px-12 py-24 md:py-36 border-b border-[#E4E0D6] select-none"
    >
      {/* Section Header */}
      <div className="max-w-6xl mb-16 md:mb-24">
        <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.25em] uppercase text-[#71717A] mb-3">
          <span className="w-1.5 h-1.5 bg-[#B08D57]" />
          <span>MEMBERSHIPS & PLANOS · STUDIO ACCESS</span>
        </div>
        <h2 className="font-editorial text-3xl sm:text-5xl md:text-6xl font-light tracking-[-0.02em] leading-tight text-[#18181B]">
          Acesso ao{' '}
          <em className="font-normal italic text-[#B08D57]">atelier</em> digital.
        </h2>
        <p className="font-jost text-sm md:text-base text-[#52525B] mt-4 max-w-xl">
          Preços transparentes desenhados para marcas autorais, estúdios de design
          e indústrias que exigem o mais alto padrão estético.
        </p>
      </div>

      {/* 3 Memberships Cards */}
      <div className="w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
        {/* Tier 1: Free Atelier */}
        <div className="p-8 md:p-10 bg-[#EBE7DE] border border-[#D8D4CC] flex flex-col justify-between">
          <div>
            <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-[#71717A]">
              EXPERIMENTAÇÃO AUTORAL
            </div>
            <h3 className="font-editorial text-3xl font-light text-[#18181B] mt-2">
              Free Atelier
            </h3>
            <p className="font-jost text-xs text-[#52525B] mt-2 leading-relaxed">
              Ideal para testar o potencial dos agentes e criar suas primeiras publicações.
            </p>

            <div className="mt-8 pb-6 border-b border-[#D8D4CC]">
              <span className="font-editorial text-4xl font-light text-[#18181B]">
                R$ 0
              </span>
              <span className="font-mono text-xs text-[#71717A] ml-2">/ sempre</span>
            </div>

            <ul className="mt-6 space-y-3 font-jost text-xs text-[#52525B]">
              <li className="flex items-center gap-2.5">
                <Check className="w-3.5 h-3.5 text-[#B08D57]" />
                <span>Até 5 catálogos ativos</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-3.5 h-3.5 text-[#B08D57]" />
                <span>Digital Flipbook instantâneo (`/c/:id`)</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-3.5 h-3.5 text-[#B08D57]" />
                <span>Exportação em PDF digital</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-3.5 h-3.5 text-[#B08D57]" />
                <span>Templates canônicos incluídos</span>
              </li>
            </ul>
          </div>

          <Link
            to="/studio"
            className="mt-10 w-full py-3 px-6 text-center font-jost text-xs uppercase tracking-[0.2em] font-medium border border-[#18181B] text-[#18181B] hover:bg-[#18181B] hover:text-[#F5F1EA] transition-colors duration-300"
          >
            Começar Gratuitamente
          </Link>
        </div>

        {/* Tier 2: Pro Studio (Featured) */}
        <div className="p-8 md:p-10 bg-[#18181B] text-[#F5F1EA] border border-[#18181B] flex flex-col justify-between shadow-2xl relative overflow-hidden">
          {/* Subtle Top Badge */}
          <div className="absolute top-0 right-0 py-1.5 px-4 bg-[#B08D57] text-[#18181B] font-mono text-[9px] tracking-[0.2em] uppercase font-bold">
            MAIS ESCOLHIDO
          </div>

          <div>
            <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-[#B08D57]">
              PRODUÇÃO PROFISSIONAL
            </div>
            <h3 className="font-editorial text-3xl font-light text-[#F5F1EA] mt-2">
              Pro Studio
            </h3>
            <p className="font-jost text-xs text-[#A1A1AA] mt-2 leading-relaxed">
              O ecossistema completo para marcas que publicam catálogos de alta performance.
            </p>

            <div className="mt-8 pb-6 border-b border-white/15">
              <span className="font-editorial text-4xl font-light text-[#F5F1EA]">
                R$ 97
              </span>
              <span className="font-mono text-xs text-[#A1A1AA] ml-2">/ mês</span>
            </div>

            <ul className="mt-6 space-y-3 font-jost text-xs text-[#D4D4D8]">
              <li className="flex items-center gap-2.5">
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-medium text-white">Catálogos ilimitados</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Conselho de 5 Agentes Autônomos de IA</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Exportação gráfica 300 DPI vetorial para impressão</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Ingestão ilimitada de planilhas Excel / CSV</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Remoção automática de fundo de fotos com IA</span>
              </li>
            </ul>
          </div>

          <Link
            to="/studio"
            className="mt-10 w-full py-3.5 px-6 text-center font-jost text-xs uppercase tracking-[0.2em] font-medium bg-[#B08D57] text-[#18181B] hover:bg-white transition-colors duration-300"
          >
            Assinar Pro Studio
          </Link>
        </div>

        {/* Tier 3: Maison Enterprise */}
        <div className="p-8 md:p-10 bg-[#EBE7DE] border border-[#D8D4CC] flex flex-col justify-between">
          <div>
            <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-[#71717A]">
              INDÚSTRIAS & REDES B2B
            </div>
            <h3 className="font-editorial text-3xl font-light text-[#18181B] mt-2">
              Maison Enterprise
            </h3>
            <p className="font-jost text-xs text-[#52525B] mt-2 leading-relaxed">
              Infraestrutura sob medida com integrações PIM/ERP e governança corporativa.
            </p>

            <div className="mt-8 pb-6 border-b border-[#D8D4CC]">
              <span className="font-editorial text-3xl font-light text-[#18181B]">
                Sob Consulta
              </span>
              <span className="font-mono text-xs text-[#71717A] ml-2">/ anual</span>
            </div>

            <ul className="mt-6 space-y-3 font-jost text-xs text-[#52525B]">
              <li className="flex items-center gap-2.5">
                <Check className="w-3.5 h-3.5 text-[#B08D57]" />
                <span>Domínio personalizado (`catalogo.suaempresa.com`)</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-3.5 h-3.5 text-[#B08D57]" />
                <span>Integração com ERPs (SAP, Totvs, Shopify, Linx)</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-3.5 h-3.5 text-[#B08D57]" />
                <span>Agentes de IA treinados no tom de voz exclusivo</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-3.5 h-3.5 text-[#B08D57]" />
                <span>SLA dedicado e suporte de curadoria</span>
              </li>
            </ul>
          </div>

          <a
            href="mailto:contato@catana.dev?subject=Catana%20Maison%20Enterprise"
            className="mt-10 w-full py-3 px-6 text-center font-jost text-xs uppercase tracking-[0.2em] font-medium border border-[#18181B] text-[#18181B] hover:bg-[#18181B] hover:text-[#F5F1EA] transition-colors duration-300"
          >
            Falar com Curadoria
          </a>
        </div>
      </div>
    </section>
  );
}
