import { QualityGate, CatalogPageData, StudioPalette, STUDIO_PALETTE_PRESETS } from '../data/editorialCatalog.mock';
import { ChatAttachment } from '../store/studioStore';

export interface GeneratedCatalogResult {
  qualityGate?: QualityGate;
  catalogId: string;
  title: string;
  category: string;
  palette: StudioPalette;
  pages: CatalogPageData[];
  totalPages: number;
  initialPrompt: string;
  summary: string;
  reasoning: string;
  councilDelegations: Array<{
    roleId: string;
    roleName: string;
    badge: string;
    action: string;
  }>;
}

export function extractRequestedPageCount(prompt: string): number | null {
  if (!prompt) return null;
  const pLower = prompt.toLowerCase();

  // 1 página (expressões comuns em português e inglês)
  if (/\b(?:1|uma|um|single|one)\s*(?:p[aá]gina|pag\b|p[aá]g\b|folha|l[aâ]mina|prancheta|spread|one[- ]?page|onepager|single[- ]?page)\b/i.test(pLower)) {
    return 1;
  }
  if (/\b(?:one[- ]?page|onepager|single[- ]?page|folha\s*[uú]nica|l[aâ]mina\s*[uú]nica|p[aá]gina\s*[uú]nica)\b/i.test(pLower)) {
    return 1;
  }

  const wordMap: Record<string, number> = {
    duas: 2, dois: 2, two: 2,
    tres: 3, três: 3, three: 3,
    quatro: 4, four: 4,
    cinco: 5, five: 5,
    seis: 6, six: 6,
    sete: 7, seven: 7,
    oito: 8, eight: 8,
    nove: 9, nine: 9,
    dez: 10, ten: 10,
    doze: 12, twelve: 12,
    dezesseis: 16, sixteen: 16,
  };

  const matchDigit = pLower.match(/\b(\d+)\s*(?:p[aá]ginas?|pags?\b|p[aá]gs?\b|folhas?|l[aâ]minas?|pranchetas?)\b/i);
  if (matchDigit && matchDigit[1]) {
    const val = parseInt(matchDigit[1], 10);
    if (val >= 1 && val <= 32) return val;
  }

  for (const [word, num] of Object.entries(wordMap)) {
    if (new RegExp(`\\b${word}\\s*(?:p[aá]ginas?|pags?\\b|p[aá]gs?\\b|folhas?|l[aâ]minas?|pranchetas?)\\b`, 'i').test(pLower)) {
      return num;
    }
  }

  return null;
}

export function generateCatalogFromPrompt(
  prompt: string,
  attachments?: ChatAttachment[]
): GeneratedCatalogResult {
  const pLower = (prompt || '').toLowerCase();
  const catalogId = `cat-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const requestedPages = extractRequestedPageCount(prompt);

  // 1. Deteccao de Dominio / Niche
  const isConfeitaria = /confeit|doce|bolo|p[aâ]tisserie|padaria|sobremesa|pote|torta|gastronom|chocolate/i.test(pLower);
  const isTech = /tech|tecnolog|gadget|setup|computad|hardware|eletr[oô]nic|software|b2b|industrial|perif[eé]ric/i.test(pLower);
  const isJoias = /joia|joalher|ouro|prata|diamante|gema|colar|anel|brinco|cristal|relog/i.test(pLower);
  const isModa = /moda|lookbook|roupa|vestu[aá]rio|inverno|ver[aã]o|alfaiat|couture|estilo|acess[oó]rio/i.test(pLower);
  const isPlantas = /planta|botan|jardim|flor|verde|paisagismo/i.test(pLower);

  // CASO ESPECIAL: 1 Página Solicitada (One-Pager Editorial / Ficha de Apresentação)
  if (requestedPages === 1) {
    const palette = isConfeitaria
      ? (STUDIO_PALETTE_PRESETS.find((p) => p.name.includes('Terracotta')) || STUDIO_PALETTE_PRESETS[3])
      : isTech
      ? (STUDIO_PALETTE_PRESETS.find((p) => p.name.includes('Slate')) || STUDIO_PALETTE_PRESETS[4])
      : isJoias
      ? (STUDIO_PALETTE_PRESETS.find((p) => p.name.includes('Argent')) || STUDIO_PALETTE_PRESETS[1])
      : isPlantas
      ? (STUDIO_PALETTE_PRESETS.find((p) => p.name.includes('Emerald')) || STUDIO_PALETTE_PRESETS[5])
      : STUDIO_PALETTE_PRESETS[0];

    const inferredTitle = prompt
      ? prompt.slice(0, 40).replace(/^(crie|criar|fa[cç]a|gerar|um|uma|cat[aá]logo|de|sobre)\s+/i, '').trim()
      : 'Catálogo Editorial';
    const cleanTitle = inferredTitle
      ? inferredTitle.charAt(0).toUpperCase() + inferredTitle.slice(1)
      : 'Coleção Editorial 2026';

    const logoAttachment = attachments?.find((a) => a.type === 'image');

    const pages: CatalogPageData[] = [
      {
        id: `${catalogId}-p1`,
        pageNumber: 1,
        type: 'cover',
        title: cleanTitle.toUpperCase(),
        subtitle: 'LOOKBOOK & EDIÇÃO ÚNICA · 2026',
        label: 'CATÁLOGO DE PÁGINA ÚNICA',
        content: `Síntese editorial calibrada a partir do briefing: "${prompt}".\nDiagramação em proporção harmônica A4 com respiro equilibrado e direção de arte sob medida.`,
        quote: 'A simplicidade depurada é a mais alta expressão de excelência editorial.',
        backgroundColor: palette.primary,
        textColor: palette.background,
        accentColor: palette.accent,
        editorialImage: logoAttachment ? (logoAttachment.previewUrl || logoAttachment.url) : undefined,
        folio: '01 · EDIÇÃO ÚNICA',
      },
    ];

    return {
      catalogId,
      title: cleanTitle,
      category: isConfeitaria ? 'Gastronomia & Confeitaria' : isTech ? 'Tecnologia & Hardware' : isJoias ? 'Alta Joalheria & Luxo' : 'Moda & Editorial',
      palette,
      pages,
      totalPages: 1,
      initialPrompt: prompt,
      summary: `Catálogo editorial de página única diagramado com sucesso para "${cleanTitle}".`,
      reasoning: 'Racional do Orquestrador: Estrutura calibrada para apresentação sintética em página única (One-Pager), integrando monograma da marca, tipografia nobre e proporção áurea.',
      councilDelegations: [
        { roleId: 'director', roleName: 'Diretor de Arte', badge: 'Design', action: `Definiu prancheta única A4 com a paleta ${palette.name}.` },
        { roleId: 'copywriter', roleName: 'Redator Publicitário', badge: 'Redação', action: 'Sintetizou manifesto e chamadas de alto impacto em espaço condensado.' },
        { roleId: 'commercial', roleName: 'Especialista B2B', badge: 'Comercial', action: 'Estruturou apresentação direta com foco em valor perceptual.' },
        { roleId: 'branding', roleName: 'Auditor de Branding', badge: 'Auditoria', action: 'Homologou o contraste cromático AAA e margens de proteção do logotipo.' },
      ],
    };
  }

  if (isConfeitaria) {
    const palette = STUDIO_PALETTE_PRESETS.find((p) => p.name.includes('Terracotta')) || STUDIO_PALETTE_PRESETS[3];
    const pages: CatalogPageData[] = [
      {
        id: `${catalogId}-p1`,
        pageNumber: 1,
        type: 'cover',
        title: 'ATELIER SUCRÉ',
        subtitle: 'PÂTISSERIE ARTISANALE · COLEÇÃO GOURMET 2026',
        label: 'CATÁLOGO DE PRODUTOS & ENCOMENDAS',
        backgroundColor: palette.primary,
        textColor: palette.background,
        accentColor: palette.accent,
      },
      {
        id: `${catalogId}-p2`,
        pageNumber: 2,
        type: 'manifesto',
        title: 'A Arte do Doce',
        subtitle: 'INGREDIENTES SELECIONADOS & FEITURA MANUAL',
        content:
          'Nossa pâtisserie nasceu do compromisso inegociável com a pureza dos sabores. Cada receita equilibra técnicas clássicas francesas com ingredientes frescos e cacau de origem controlada.\n\nMais do que sobremesas, entregamos momentos de contemplação e celebração gastronômica.',
        quote: 'O equilíbrio perfeito entre delicadeza estética e explosão de sabor.',
        backgroundColor: palette.background,
        textColor: palette.primary,
        accentColor: palette.accent,
        folio: '02 · MANIFESTO ATELIER SUCRÉ',
      },
      {
        id: `${catalogId}-p3`,
        pageNumber: 3,
        type: 'hero',
        title: 'Potes Gourmet & Sobremesas Individuais',
        subtitle: 'A linha de porções perfeitas para degustação imediata e eventos.',
        label: 'COLEÇÃO ASSINATURA',
        backgroundColor: palette.background,
        textColor: palette.primary,
        accentColor: palette.accent,
        folio: '03 · LINHA POTE GOURMET',
        products: [
          {
            id: `${catalogId}-prod-1`,
            category: 'Potes Gourmet',
            index: '01',
            name: 'Pote Redondo Velvet Belga',
            sku: 'SUCRE-PF10',
            price: 'R$ 28,00',
            description: 'Camadas de bolo red velvet aveludado com mousse de mascarpone e compota de frutas vermelhas silvestres.',
            image: '/catalogos/produtosConfeitaria/pf-10.png',
            tag: 'Mais Vendido',
            details: ['250g', 'Cacau 70%', 'Frutas Vermelhas'],
          },
        ],
      },
      {
        id: `${catalogId}-p4`,
        pageNumber: 4,
        type: 'duo',
        title: 'Mousses & Panna Cottas',
        subtitle: 'Cremas leves de infusão botânica e favas de baunilha de Madagascar.',
        label: 'LINHA CRISTAL',
        backgroundColor: palette.background,
        textColor: palette.primary,
        accentColor: palette.accent,
        folio: '04 · DUO GOURMET',
        products: [
          {
            id: `${catalogId}-prod-2`,
            category: 'Potes Gourmet',
            index: '02',
            name: 'Taça Mousse Pistache & Flor de Sal',
            sku: 'SUCRE-PF13',
            price: 'R$ 32,50',
            description: 'Pistache siciliano integral com ganache de chocolate branco e finalização em praliné crocante.',
            image: '/catalogos/produtosConfeitaria/pf-13.png',
            tag: 'Assinatura',
            details: ['180g', 'Pistache Puro', 'Sem Glúten'],
          },
          {
            id: `${catalogId}-prod-3`,
            category: 'Potes Gourmet',
            index: '03',
            name: 'Pote Brigadeiro Fondant Noir',
            sku: 'SUCRE-PF20',
            price: 'R$ 26,00',
            description: 'Brigadeiro cremoso de colher feito com cacau nobre da Bahia e granulado de puro chocolate amargo.',
            image: '/catalogos/produtosConfeitaria/pf-20.png',
            tag: 'Clássico',
            details: ['220g', 'Chocolate de Origem'],
          },
        ],
      },
      {
        id: `${catalogId}-p5`,
        pageNumber: 5,
        type: 'divider',
        title: 'Linha Festa & Recepções',
        subtitle: 'COMPOSIÇÕES ESPECIAIS PARA MESAS DE DOCES E BRINDES CORPORATIVOS',
        label: 'VOLUME II',
        backgroundColor: palette.primary,
        textColor: palette.background,
        accentColor: palette.accent,
        folio: '05 · LINHA FESTA',
      },
      {
        id: `${catalogId}-p6`,
        pageNumber: 6,
        type: 'duo',
        title: 'Estojos & Embalagens Diamante',
        subtitle: 'Apresentação nobre em recipientes transparentes de alta pureza visual.',
        label: 'ALTA CONFEITARIA',
        backgroundColor: palette.background,
        textColor: palette.primary,
        accentColor: palette.accent,
        folio: '06 · EMBALAGENS',
        products: [
          {
            id: `${catalogId}-prod-4`,
            category: 'Linha Festa',
            index: '04',
            name: 'Estojo Pote Cristal Diamante',
            sku: 'SUCRE-LF01',
            price: 'R$ 48,00',
            description: 'Embalagem multifacetada estilo gema com trufas sortidas de maracujá, framboesa e café arábica.',
            image: '/catalogos/linhaFestaSemFundo/lf-01.png',
            tag: 'Presenteável',
            details: ['6 Unidades', 'Fita de Seda'],
          },
          {
            id: `${catalogId}-prod-5`,
            category: 'Linha Festa',
            index: '05',
            name: 'Mini Dome Degustação Festiva',
            sku: 'SUCRE-LF03',
            price: 'R$ 36,00',
            description: 'Domo de cristal para doces finos individuais, ideal para lembranças e boas-vindas executivas.',
            image: '/catalogos/linhaFestaSemFundo/lf-03.png',
            tag: 'Eventos',
            details: ['Caixa com 4', 'Base Dourada'],
          },
        ],
      },
      {
        id: `${catalogId}-p7`,
        pageNumber: 7,
        type: 'single',
        title: 'Encomendas Personalizadas & Prazos',
        subtitle: 'Condições de atendimento para eventos corporativos e casamentos.',
        label: 'TABELA COMERCIAL B2B',
        content:
          '• Antecedência mínima: 5 dias úteis para pedidos acima de 50 unidades.\n• Degustação para noivos e eventos corporativos sob agendamento.\n• Entregas refrigeradas em São Paulo e região metropolitana.\n• Personalização de rótulos e fitas cromáticas sob consulta.',
        backgroundColor: palette.background,
        textColor: palette.primary,
        accentColor: palette.accent,
        folio: '07 · INFORMAÇÕES COMERCIAIS',
      },
      {
        id: `${catalogId}-p8`,
        pageNumber: 8,
        type: 'backcover',
        title: 'ATELIER SUCRÉ',
        subtitle: 'PÂTISSERIE ARTISANALE',
        content: 'ATELIER CENTRAL · JARDINS · SÃO PAULO\nWHATSAPP: (11) 98765-4321 · ATENDIMENTO@ATELIERSUCRE.COM.BR\nWWW.ATELIERSUCRE.COM.BR',
        backgroundColor: palette.primary,
        textColor: palette.background,
        accentColor: palette.accent,
        folio: '08 · CONTRACAPA',
      },
    ];

    return {
      catalogId,
      title: 'Atelier Sucré — Confeitaria & Pâtisserie Artesanal',
      category: 'Gastronomia & Confeitaria',
      palette,
      pages,
      totalPages: pages.length,
      initialPrompt: prompt,
      summary: 'Catálogo de confeitaria de alta gastronomia com 8 páginas, diagramação limpa de potes gourmet, sobremesas e linha festa.',
      reasoning: 'Racional do Orquestrador: Estrutura calibrada para confeitaria artesanal com paleta Terracotta & Sable, valorizando a textura dos doces e proporcionando leitura comercial clara.',
      councilDelegations: [
        { roleId: 'director', roleName: 'Diretor de Arte', badge: 'Design', action: 'Aplicou a paleta quente Terracotta com fundo Sable #FAF6F0 de alto acolhimento visual.' },
        { roleId: 'copywriter', roleName: 'Redator Publicitário', badge: 'Redação', action: 'Redigiu manifesto focado em ingredientes nobres e nomes de sobremesas gourmet.' },
        { roleId: 'commercial', roleName: 'Especialista B2B', badge: 'Comercial', action: 'Estruturou preços unitários, tags promocionais e regras de encomenda corporativa.' },
        { roleId: 'branding', roleName: 'Auditor de Branding', badge: 'Auditoria', action: 'Verificou legibilidade de rótulos e conformidade WCAG AA nas tabelas.' },
      ],
    };
  }

  if (isTech) {
    const palette = STUDIO_PALETTE_PRESETS.find((p) => p.name.includes('Slate')) || STUDIO_PALETTE_PRESETS[4];
    const pages: CatalogPageData[] = [
      {
        id: `${catalogId}-p1`,
        pageNumber: 1,
        type: 'cover',
        title: 'NEXUS CORE',
        subtitle: 'WORKSPACE HARDWARE & PERFORMANCE GEAR · 2026',
        label: 'CATÁLOGO CORPORATIVO & TECNOLOGIA',
        backgroundColor: palette.primary,
        textColor: palette.background,
        accentColor: palette.accent,
      },
      {
        id: `${catalogId}-p2`,
        pageNumber: 2,
        type: 'manifesto',
        title: 'Arquitetura de Precisão',
        subtitle: 'PRODUTIVIDADE RADICAL PARA TIMES DE ENGENHARIA E CRIAÇÃO',
        content:
          'Projetamos ferramentas para quem constrói o futuro digital. Cada componente do ecossistema Nexus é forjado em alumínio aeroespacial e calibrado ergonomicamente para sessões ininterruptas de alto rendimento.\n\nElimine gargalos operacionais com tecnologia de padrão industrial.',
        quote: 'A fusão definitiva entre estética industrial austera e rendimento implacável.',
        backgroundColor: palette.background,
        textColor: palette.primary,
        accentColor: palette.accent,
        folio: '02 · VISÃO TECNOLÓGICA',
      },
      {
        id: `${catalogId}-p3`,
        pageNumber: 3,
        type: 'hero',
        title: 'Estação Central & Monitores UltraWide',
        subtitle: 'Painéis Nano-IPS 5K calibrados para designers e desenvolvedores.',
        label: 'HARDWARE FLAGSHIP',
        backgroundColor: palette.background,
        textColor: palette.primary,
        accentColor: palette.accent,
        folio: '03 · WORKSPACE ESSENTIALS',
        products: [
          {
            id: `${catalogId}-prod-1`,
            category: 'Monitores',
            index: '01',
            name: 'Nexus Vision Pro 40" 5K2K Curved',
            sku: 'NEX-V40-5K',
            price: 'R$ 7.890,00',
            description: 'Painel antirreflexo de 120Hz com Thunderbolt 4 integrado (96W PD) e cobertura 98% DCI-P3.',
            image: '/catalogos/foodServiceSemFundo/fs-01.png',
            tag: 'Top de Linha',
            details: ['5120x2160', '120Hz', 'Thunderbolt 4'],
          },
        ],
      },
      {
        id: `${catalogId}-p4`,
        pageNumber: 4,
        type: 'duo',
        title: 'Periféricos Mecânicos & Áudio de Estúdio',
        subtitle: 'Precisão acústica e resposta tátil customizável por tecla.',
        label: 'CONTROLE & FOCO',
        backgroundColor: palette.background,
        textColor: palette.primary,
        accentColor: palette.accent,
        folio: '04 · INTERFACES',
        products: [
          {
            id: `${catalogId}-prod-2`,
            category: 'Teclados',
            index: '02',
            name: 'Nexus Keyset Alumínio CNC 75%',
            sku: 'NEX-KB75',
            price: 'R$ 1.250,00',
            description: 'Chassi usinado em bloco sólido de alumínio, switches magnéticos de atuação rápida e amortecimento triplo.',
            image: '/catalogos/foodServiceSemFundo/fs-02.png',
            tag: 'Custom',
            details: ['Gasket Mount', 'QMK/VIA', 'Wireless 2.4G'],
          },
          {
            id: `${catalogId}-prod-3`,
            category: 'Áudio',
            index: '03',
            name: 'Headset Planar Magnético Studio',
            sku: 'NEX-HP10',
            price: 'R$ 2.190,00',
            description: 'Drivers planares de 100mm com microfone condensador direcional e cancelamento ativo híbrido.',
            image: '/catalogos/foodServiceSemFundo/fs-03.png',
            tag: 'Gravação',
            details: ['DAC 32-bit', 'Microfone Pro', 'Zero Latência'],
          },
        ],
      },
      {
        id: `${catalogId}-p5`,
        pageNumber: 5,
        type: 'single',
        title: 'Tabela de Aquisição Corporativa B2B',
        subtitle: 'Planos de leasing, faturamento direto e garantia de 3 anos on-site.',
        label: 'ESPECIFICAÇÕES B2B',
        content:
          '• Faturamento direto para CNPJ com prazos em 30/60/90 dias.\n• Substituição preventiva de equipamentos em menos de 24 horas úteis.\n• Descontos escalonados por volume a partir de 15 estações de trabalho.\n• Suporte técnico dedicado com SLA de resposta de 2 horas.',
        backgroundColor: palette.background,
        textColor: palette.primary,
        accentColor: palette.accent,
        folio: '05 · CONDIÇÕES B2B',
      },
      {
        id: `${catalogId}-p6`,
        pageNumber: 6,
        type: 'backcover',
        title: 'NEXUS CORE',
        subtitle: 'HARDWARE LABS',
        content: 'NEXUS TECH HUB · AV. FARIA LIMA · SÃO PAULO\nCONTATO CORPORATIVO: EMPRESAS@NEXUSCORE.TECH\nWWW.NEXUSCORE.TECH',
        backgroundColor: palette.primary,
        textColor: palette.background,
        accentColor: palette.accent,
        folio: '06 · CONTRACAPA',
      },
    ];

    return {
      catalogId,
      title: 'Nexus Core — Equipamentos & Workspace 2026',
      category: 'Tecnologia & Hardware',
      palette,
      pages,
      totalPages: pages.length,
      initialPrompt: prompt,
      summary: 'Catálogo técnico e corporativo de 6 páginas voltado a hardware e estações de alta performance com design minimalista.',
      reasoning: 'Racional do Orquestrador: Layout de alta densidade técnica com paleta Slate & Pure Ivory, códigos SKU em destaque e seções dedicadas a faturamento corporativo B2B.',
      councilDelegations: [
        { roleId: 'director', roleName: 'Diretor de Arte', badge: 'Design', action: 'Configurou grid de 12 colunas com estética industrial austera e cinzas slate.' },
        { roleId: 'copywriter', roleName: 'Redator Técnico', badge: 'Redação', action: 'Definiu especificações técnicas detalhadas e vocabulário voltado a TI/Engenharia.' },
        { roleId: 'commercial', roleName: 'Consultor B2B', badge: 'Comercial', action: 'Criou diretrizes de compra em lote corporativo e políticas de garantia.' },
        { roleId: 'branding', roleName: 'Auditor de Branding', badge: 'Auditoria', action: 'Garantiu contraste AAA para leitura técnica sem fadiga visual.' },
      ],
    };
  }

  if (isJoias) {
    const palette = STUDIO_PALETTE_PRESETS.find((p) => p.name.includes('Argent')) || STUDIO_PALETTE_PRESETS[1];
    const pages: CatalogPageData[] = [
      {
        id: `${catalogId}-p1`,
        pageNumber: 1,
        type: 'cover',
        title: 'CRISTALLO',
        subtitle: 'ALTA JOALHERIA & GEMAS RARAS · EDIÇÃO 2026',
        label: 'LOOKBOOK PRIVÉ',
        backgroundColor: palette.primary,
        textColor: palette.background,
        accentColor: palette.accent,
      },
      {
        id: `${catalogId}-p2`,
        pageNumber: 2,
        type: 'manifesto',
        title: 'A Poética das Gemas',
        subtitle: 'OURIVESARIA AUTORAL & LAPIDAÇÃO SOB MEDIDA',
        content:
          'Desde a seleção de gemas nobres de procedência ética até a cravação artesanal em ouro 18k e platina pura, cada peça da Cristallo é concebida como uma escultura eterna.\n\nCelebramos a luz, a geometria mineral e a história de quem as veste.',
        quote: 'Uma gema rara não é esculpida para o efêmero: ela atravessa gerações como legado.',
        backgroundColor: palette.background,
        textColor: palette.primary,
        accentColor: palette.accent,
        folio: '02 · MANIFESTO DE ATELIER',
      },
      {
        id: `${catalogId}-p3`,
        pageNumber: 3,
        type: 'hero',
        title: 'Anel Solitário Brilhante Imperial',
        subtitle: 'Diamante central de 2.4 quilates lapidação brilhante com pavê de diamantes laterais.',
        label: 'PEÇA CENTRAL',
        backgroundColor: palette.background,
        textColor: palette.primary,
        accentColor: palette.accent,
        folio: '03 · ALTA JOALHERIA',
        products: [
          {
            id: `${catalogId}-prod-1`,
            category: 'Anéis',
            index: '01',
            name: 'Solitário Diamante Imperial 2.4ct',
            sku: 'CRI-AN01',
            price: 'R$ 48.500,00',
            description: 'Montado em platina 950 com cravação em garras de precisão e certificação GIA internacional.',
            image: '/catalogos/linhaFestaSemFundo/PoteDiamantePotecristal.png',
            tag: 'Peça Única',
            details: ['Platina 950', 'Diamante GIA', 'Gravação Inclusa'],
          },
        ],
      },
      {
        id: `${catalogId}-p4`,
        pageNumber: 4,
        type: 'duo',
        title: 'Colares & Pingentes de Estação',
        subtitle: 'Esmeraldas colombianas e safiras nobres sobre correntes venezianas.',
        label: 'COLEÇÃO LUXO',
        backgroundColor: palette.background,
        textColor: palette.primary,
        accentColor: palette.accent,
        folio: '04 · COLARES',
        products: [
          {
            id: `${catalogId}-prod-2`,
            category: 'Colares',
            index: '02',
            name: 'Gargantilha Esmeralda Muzo em Ouro 18k',
            sku: 'CRI-CL02',
            price: 'R$ 32.000,00',
            description: 'Esmeralda natural de 1.8ct com halo de brilhantes e fecho oculto com trava de segurança.',
            image: '/catalogos/linhaFestaSemFundo/lf-06.png',
            tag: 'Exclusivo',
            details: ['Ouro Amarelo 18k', 'Esmeralda Natural'],
          },
          {
            id: `${catalogId}-prod-3`,
            category: 'Brincos',
            index: '03',
            name: 'Brincos Cascata de Diamantes Flutuantes',
            sku: 'CRI-BR03',
            price: 'R$ 24.800,00',
            description: 'Design contemporâneo articulado que acompanha o movimento com máxima dispersão de luz.',
            image: '/catalogos/linhaFestaSemFundo/lf-08.png',
            tag: 'Destaque',
            details: ['Ouro Branco 18k', '3.1ct Total'],
          },
        ],
      },
      {
        id: `${catalogId}-p5`,
        pageNumber: 5,
        type: 'backcover',
        title: 'CRISTALLO',
        subtitle: 'HAUTE JOAILLERIE',
        content: 'ATELIER PRIVADO · ALAMEDA LORENA · SÃO PAULO\nATENDIMENTO EXCLUSIVO COM CONCIERGE: (11) 3088-0000\nWWW.CRISTALLOJOIAS.COM.BR',
        backgroundColor: palette.primary,
        textColor: palette.background,
        accentColor: palette.accent,
        folio: '05 · CONTRACAPA',
      },
    ];

    return {
      catalogId,
      title: 'Cristallo — Alta Joalheria & Gemas Raras',
      category: 'Alta Joalheria & Luxo',
      palette,
      pages,
      totalPages: pages.length,
      initialPrompt: prompt,
      summary: 'Catálogo de alta joalheria com diagramação nobre, tipografia refinada e acabamento monocromático prateado.',
      reasoning: 'Racional do Orquestrador: Estrutura voltada ao mercado de ultra-luxo, utilizando proporção harmônica e respiros amplos para enaltecer as joias e certificações gemológicas.',
      councilDelegations: [
        { roleId: 'director', roleName: 'Diretor de Arte', badge: 'Design', action: 'Definiu paleta Noir & Argent 925 com contraste luminoso.' },
        { roleId: 'copywriter', roleName: 'Redator de Luxo', badge: 'Redação', action: 'Criou descrições detalhando pureza, peso em quilates e herança de atelier.' },
        { roleId: 'commercial', roleName: 'Concierge Comercial', badge: 'Comercial', action: 'Formatou atendimento privé e agendamento presencial.' },
        { roleId: 'branding', roleName: 'Auditor de Branding', badge: 'Auditoria', action: 'Homologou o alinhamento central e filetes de corte de 1px.' },
      ],
    };
  }

  // Fallback inteligente para Moda, Gastronomia Geral ou Briefing Aberto
  const defaultPalette = isPlantas
    ? (STUDIO_PALETTE_PRESETS.find((p) => p.name.includes('Emerald')) || STUDIO_PALETTE_PRESETS[5])
    : isModa
    ? STUDIO_PALETTE_PRESETS[0]
    : STUDIO_PALETTE_PRESETS[2];

  const inferredTitle = prompt
    ? prompt.slice(0, 40).replace(/^(crie|criar|fa[cç]a|gerar|um|uma|cat[aá]logo|de|sobre)\s+/i, '').trim()
    : 'Catálogo Editorial de Produtos';
  const cleanTitle = inferredTitle
    ? inferredTitle.charAt(0).toUpperCase() + inferredTitle.slice(1)
    : 'Coleção Editorial 2026';

  const pages: CatalogPageData[] = [
    {
      id: `${catalogId}-p1`,
      pageNumber: 1,
      type: 'cover',
      title: cleanTitle.toUpperCase(),
      subtitle: 'LOOKBOOK & CATÁLOGO EXECUTIVO · EDIÇÃO 2026',
      label: 'PORTFÓLIO DE PRODUTOS',
      backgroundColor: defaultPalette.primary,
      textColor: defaultPalette.background,
      accentColor: defaultPalette.accent,
    },
    {
      id: `${catalogId}-p2`,
      pageNumber: 2,
      type: 'manifesto',
      title: 'Identidade & Excelência',
      subtitle: 'POSICIONAMENTO E DIRETRIZES DE CRIAÇÃO',
      content:
        `Criado a partir da sua solicitação: "${prompt || 'Criação editorial de alta performance'}".\n\nNossa equipe editorial estruturou este catálogo sob os mais rigorosos padrões de diagramação editorial: equilíbrio cromático, tipografia calibrada para leitura fluida e valorização máxima de cada produto apresentado.`,
      quote: 'O design não decora o produto: ele estabelece a autoridade e o valor perceptível da marca.',
      backgroundColor: defaultPalette.background,
      textColor: defaultPalette.primary,
      accentColor: defaultPalette.accent,
      folio: '02 · MANIFESTO EDITORIAL',
    },
    {
      id: `${catalogId}-p3`,
      pageNumber: 3,
      type: 'hero',
      title: 'Linha Principal em Destaque',
      subtitle: 'Composição de impacto para o produto âncora da coleção.',
      label: 'FLAGSHIP',
      backgroundColor: defaultPalette.background,
      textColor: defaultPalette.primary,
      accentColor: defaultPalette.accent,
      folio: '03 · DESTAQUES',
      products: [
        {
          id: `${catalogId}-prod-1`,
          category: 'Coleção Principal',
          index: '01',
          name: `${cleanTitle} — Peça de Assinatura`,
          sku: 'EDT-001',
          price: 'R$ 380,00',
          description: 'Desenvolvido com materiais selecionados, acabamento manual impecável e garantia de durabilidade superior.',
          image: '/catalogos/linhaFestaSemFundo/lf-01.png',
          tag: 'Edição Limitada',
          details: ['Produção Artesanal', 'Pronta Entrega'],
        },
      ],
    },
    {
      id: `${catalogId}-p4`,
      pageNumber: 4,
      type: 'duo',
      title: 'Variações & Linha Complementar',
      subtitle: 'Opções selecionadas para atender diferentes perfis de clientes.',
      label: 'SELEÇÃO EDITORIAL',
      backgroundColor: defaultPalette.background,
      textColor: defaultPalette.primary,
      accentColor: defaultPalette.accent,
      folio: '04 · CATÁLOGO DE ITENS',
      products: [
        {
          id: `${catalogId}-prod-2`,
          category: 'Complementos',
          index: '02',
          name: 'Item Complementar Serie A',
          sku: 'EDT-002',
          price: 'R$ 195,00',
          description: 'Equilíbrio funcional para integrar à rotina ou compor kits presenteáveis.',
          image: '/catalogos/linhaFestaSemFundo/lf-04.png',
          tag: 'Destaque',
          details: ['Versão Standard'],
        },
        {
          id: `${catalogId}-prod-3`,
          category: 'Complementos',
          index: '03',
          name: 'Item Complementar Serie B',
          sku: 'EDT-003',
          price: 'R$ 240,00',
          description: 'Design contemporâneo com detalhes sutis e alta aceitação comercial.',
          image: '/catalogos/linhaFestaSemFundo/lf-05.png',
          tag: 'Novo',
          details: ['Versão Premium'],
        },
      ],
    },
    {
      id: `${catalogId}-p5`,
      pageNumber: 5,
      type: 'single',
      title: 'Tabela Comercial & Especificações',
      subtitle: 'Diretrizes de faturamento, prazos e canais de aquisição.',
      label: 'INFORMAÇÕES B2B',
      content:
        (attachments && attachments.length > 0)
          ? `Catálogo gerado com assimilação direta dos seguintes documentos anexados:\n${attachments.map((a) => `• ${a.name} (${a.size})`).join('\n')}\n\nTodos os parâmetros técnicos e preços foram alinhados às pranchetas de impressão A4.`
          : '• Entregas para todo o território nacional.\n• Faturamento facilitado com parcelamento ou desconto à vista no PIX.\n• Atendimento comercial dedicado para empresas e revendedores.',
      backgroundColor: defaultPalette.background,
      textColor: defaultPalette.primary,
      accentColor: defaultPalette.accent,
      folio: '05 · COMERCIAL',
    },
    {
      id: `${catalogId}-p6`,
      pageNumber: 6,
      type: 'backcover',
      title: cleanTitle.toUpperCase(),
      subtitle: 'ATELIER & DESIGN',
      content: 'ATENDIMENTO CENTRAL & SUPORTE\nEMAIL: CONTATO@CATANASTUDIO.COM.BR\nWWW.CATANASTUDIO.COM.BR',
      backgroundColor: defaultPalette.primary,
      textColor: defaultPalette.background,
      accentColor: defaultPalette.accent,
      folio: '06 · ENCERRAMENTO',
    },
  ];

  // Se o usuário solicitou uma contagem específica de páginas:
  let finalPages = pages;
  if (requestedPages && requestedPages > 1 && requestedPages !== pages.length) {
    if (requestedPages < pages.length) {
      const keepPages = [pages[0]];
      const middleNeeded = Math.max(0, requestedPages - 2);
      const middlePages = pages.slice(1, -1);
      keepPages.push(...middlePages.slice(0, middleNeeded));
      if (requestedPages > 1) {
        keepPages.push(pages[pages.length - 1]);
      }
      finalPages = keepPages.map((p, idx) => ({
        ...p,
        pageNumber: idx + 1,
        folio: `${String(idx + 1).padStart(2, '0')}`,
      }));
    } else if (requestedPages > pages.length) {
      finalPages = [...pages];
      while (finalPages.length < requestedPages) {
        const nextNum = finalPages.length + 1;
        finalPages.push({
          id: `${catalogId}-p${nextNum}`,
          pageNumber: nextNum,
          type: nextNum % 2 === 1 ? 'hero' : 'duo',
          title: `Destaque Editorial · Seção ${String(nextNum).padStart(2, '0')}`,
          subtitle: 'Apresentação e diferenciais',
          label: 'EXPANSÃO EDITORIAL',
          folio: `${String(nextNum).padStart(2, '0')}`,
          backgroundColor: defaultPalette.background,
          textColor: defaultPalette.primary,
          accentColor: defaultPalette.accent,
        });
      }
    }
  }

  return {
    catalogId,
    title: cleanTitle,
    category: 'Geral & Editorial',
    palette: defaultPalette,
    pages: finalPages,
    totalPages: finalPages.length,
    initialPrompt: prompt,
    summary: `Catálogo editorial diagramado com sucesso para "${cleanTitle}" com ${finalPages.length} página(s).`,
    reasoning: 'Racional do Orquestrador: Diagramação equilibrada com base nas diretrizes do briefing, organizando capas, spreads de produtos e contracapa.',
    councilDelegations: [
      { roleId: 'director', roleName: 'Diretor de Arte', badge: 'Design', action: `Definiu a paleta ${defaultPalette.name} e proporções A4.` },
      { roleId: 'copywriter', roleName: 'Redator Publicitário', badge: 'Redação', action: 'Estruturou títulos e chamadas editoriais.' },
      { roleId: 'commercial', roleName: 'Especialista de Vendas', badge: 'Comercial', action: 'Organizou precificação e tabela de especificações.' },
      { roleId: 'branding', roleName: 'Auditor de Branding', badge: 'Auditoria', action: 'Validou contraste e diagramação de pranchetas.' },
    ],
  };
}
