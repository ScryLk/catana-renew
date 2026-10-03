import { Printer, Smartphone, Table, Sparkles, Check, X } from 'lucide-react';

export function CapabilitiesSection() {
  return (
    <section
      id="craft"
      className="relative w-full bg-[#F5F1EA] text-[#18181B] px-6 md:px-12 py-24 md:py-36 border-b border-[#E4E0D6] select-none"
    >
      {/* Section Header */}
      <div className="max-w-6xl mb-16 md:mb-24">
        <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.25em] uppercase text-[#71717A] mb-3">
          <span className="w-1.5 h-1.5 bg-[#B08D57]" />
          <span>PRECISÃO DE ENGENHARIA · EDITORIAL CRAFT</span>
        </div>
        <h2 className="font-editorial text-3xl sm:text-5xl md:text-6xl font-light tracking-[-0.02em] leading-tight text-[#18181B]">
          A anatomia da perfeição{' '}
          <em className="font-normal italic text-[#B08D57]">editorial</em>.
        </h2>
        <p className="font-jost text-sm md:text-base text-[#52525B] mt-4 max-w-xl">
          Construído para atender tanto aos padrões exigentes de um parque gráfico
          industrial quanto à fluidez instantânea de um lookbook digital para WhatsApp
          e web.
        </p>
      </div>

      {/* Direct Comparison: Old PDF vs Catana Publication */}
      <div className="w-full max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 mb-24 md:mb-36">
        {/* The Outdated PDF */}
        <div className="p-8 md:p-10 bg-[#EAE6DE] border border-[#D8D4CC] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-[#D8D4CC] font-mono text-[11px] tracking-wider uppercase text-[#71717A]">
              <span>O PDF CORPORATIVO TRADICIONAL</span>
              <span className="text-red-700/80 font-medium flex items-center gap-1">
                <X className="w-3.5 h-3.5" /> OBSOLETO
              </span>
            </div>

            <h3 className="font-editorial text-2xl md:text-3xl font-light text-[#52525B] mt-6">
              Ruído visual, tabelas genéricas e zero emoção de marca.
            </h3>

            <ul className="mt-6 space-y-3 font-jost text-xs md:text-sm text-[#71717A]">
              <li className="flex items-start gap-2.5">
                <span className="text-red-600">✕</span>
                <span>Arquivos de 80MB difíceis de abrir em dispositivos móveis.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-red-600">✕</span>
                <span>Diagramação estática que quebra ao adicionar um novo produto.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-red-600">✕</span>
                <span>Semanas de vaivém com designers gráficos para alterar um único preço.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-red-600">✕</span>
                <span>Sem suporte nativo a leitura digital imersiva.</span>
              </li>
            </ul>
          </div>

          <div className="pt-6 mt-8 border-t border-[#D8D4CC] font-mono text-[10px] text-[#71717A] uppercase tracking-wider">
            RESULTADO: BAIXA CONVERSÃO E PERCEPÇÃO ORDINÁRIA DE VALOR
          </div>
        </div>

        {/* The Catana Publication */}
        <div className="p-8 md:p-10 bg-[#18181B] text-[#F5F1EA] border border-[#18181B] flex flex-col justify-between shadow-lg">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-white/15 font-mono text-[11px] tracking-wider uppercase text-[#B08D57]">
              <span>A PUBLICAÇÃO CATANA EDITORIAL</span>
              <span className="text-emerald-400 font-medium flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> PADRÃO LUXO
              </span>
            </div>

            <h3 className="font-editorial text-2xl md:text-3xl font-light text-[#F5F1EA] mt-6">
              Proporção áurea, tipografia editorial e impacto imediato.
            </h3>

            <ul className="mt-6 space-y-3 font-jost text-xs md:text-sm text-[#D4D4D8]">
              <li className="flex items-start gap-2.5">
                <span className="text-emerald-400">✓</span>
                <span>Link público instantâneo (`/c/:id`) com virada tátil de páginas.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-emerald-400">✓</span>
                <span>Exportação em 300 DPI vetorial pronta para parque gráfico offset.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-emerald-400">✓</span>
                <span>Ingestão de planilha Excel: 50 produtos diagramados em 12 segundos.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-emerald-400">✓</span>
                <span>Design tokens protegidos: nunca perca a identidade visual.</span>
              </li>
            </ul>
          </div>

          <div className="pt-6 mt-8 border-t border-white/15 font-mono text-[10px] text-[#B08D57] uppercase tracking-wider">
            RESULTADO: VALOR PERCEBIDO DE GRIFE E ALTA TAXA DE FECHAMENTO B2B
          </div>
        </div>
      </div>

      {/* 4 Pillars Grid */}
      <div className="w-full max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="p-6 bg-[#EBE7DE] border border-[#E0DCD2]">
          <div className="w-8 h-8 rounded-none border border-[#18181B]/20 flex items-center justify-center mb-4 text-[#B08D57]">
            <Printer className="w-4 h-4" />
          </div>
          <h4 className="font-editorial text-xl font-normal text-[#18181B]">
            300 DPI Vector Print
          </h4>
          <p className="font-jost text-xs text-[#52525B] mt-2 leading-relaxed">
            Arquivos PDF prontos para gráfica, com separação de cores, marcas de corte
            e curvas de tipografia perfeitas.
          </p>
        </div>

        <div className="p-6 bg-[#EBE7DE] border border-[#E0DCD2]">
          <div className="w-8 h-8 rounded-none border border-[#18181B]/20 flex items-center justify-center mb-4 text-[#B08D57]">
            <Smartphone className="w-4 h-4" />
          </div>
          <h4 className="font-editorial text-xl font-normal text-[#18181B]">
            Digital Flipbook
          </h4>
          <p className="font-jost text-xs text-[#52525B] mt-2 leading-relaxed">
            Compartilhe links protegidos com virada de página imersiva que rodam
            instantaneamente em qualquer smartphone.
          </p>
        </div>

        <div className="p-6 bg-[#EBE7DE] border border-[#E0DCD2]">
          <div className="w-8 h-8 rounded-none border border-[#18181B]/20 flex items-center justify-center mb-4 text-[#B08D57]">
            <Table className="w-4 h-4" />
          </div>
          <h4 className="font-editorial text-xl font-normal text-[#18181B]">
            Excel / CSV Ingestion
          </h4>
          <p className="font-jost text-xs text-[#52525B] mt-2 leading-relaxed">
            Arraste sua planilha com códigos, preços e fotos. A IA mapeia as colunas e
            monta os spreads automaticamente.
          </p>
        </div>

        <div className="p-6 bg-[#EBE7DE] border border-[#E0DCD2]">
          <div className="w-8 h-8 rounded-none border border-[#18181B]/20 flex items-center justify-center mb-4 text-[#B08D57]">
            <Sparkles className="w-4 h-4" />
          </div>
          <h4 className="font-editorial text-xl font-normal text-[#18181B]">
            Design Tokens DNA
          </h4>
          <p className="font-jost text-xs text-[#52525B] mt-2 leading-relaxed">
            Trave cores primárias, secundárias, fontes e margens. A consistência da
            marca se mantém rígida em todas as edições.
          </p>
        </div>
      </div>
    </section>
  );
}
