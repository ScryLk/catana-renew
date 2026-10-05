import { StudioPalette } from '../data/editorialCatalog.mock';
import type { BrandRule } from '../services/brandService';

export interface ParsedBrandData {
  name?: string;
  segment?: string;
  toneOfVoice?: string;
  palette?: Partial<StudioPalette>;
  commercialContact: {
    whatsapp?: string;
    email?: string;
    website?: string;
    instagram?: string;
  };
  rawMarkdown: string;
  guidelines: Array<Omit<BrandRule, 'id'> & {source_text: string}>;
}

/**
 * Analisa o conteudo de um arquivo BRAND.md ou texto de diretrizes da empresa.
 * Extrai informacoes cadastrais, tom de voz, paleta cromatica e contatos comerciais.
 */
export const parseBrandMarkdown = (markdown: string): ParsedBrandData => {
  const lines = markdown.split('\n');
  const result: ParsedBrandData = {
    commercialContact: {},
    rawMarkdown: markdown,
    guidelines: [],
  };

  let currentSection = '';
  const toneLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();
    const guideline = line.match(/^\s*[-*]?\s*\*{0,2}(MUST|PREFER|AVOID)\*{0,2}\s+(?:\[([a-z]+)\]\s*)?:?\s*(.+)$/i);
    if (guideline) {
      const category = guideline[2]?.toLowerCase() || 'other';
      result.guidelines.push({type: guideline[1].toUpperCase() as BrandRule['type'], category, rule: guideline[3].trim(), source: 'brand_markdown', status: 'inferred', source_text: rawLine});
      continue;
    }

    // Deteccao de secoes H1 / H2 / H3
    if (line.startsWith('# ')) {
      const title = line.replace(/^#\s+/, '').trim();
      if (!result.name && !title.toLowerCase().includes('brand') && !title.toLowerCase().includes('diretrizes')) {
        result.name = title;
      }
      currentSection = title.toLowerCase();
      continue;
    } else if (line.startsWith('## ') || line.startsWith('### ')) {
      currentSection = line.replace(/^#+\s+/, '').trim().toLowerCase();
      continue;
    }

    // Extracao chave: valor
    const match = line.match(/^\s*[-*]?\s*\*{0,2}([^:*]+)\*{0,2}\s*:\s*(.+)$/);
    if (match) {
      const key = match[1].trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const val = match[2].replace(/^\*{0,2}/, '').replace(/\*{0,2}$/, '').trim();

      if (key.includes('marca') || key.includes('nome') || key.includes('empresa') || key.includes('razao')) {
        if (!result.name) result.name = val;
      } else if (key.includes('segmento') || key.includes('setor') || key.includes('nicho')) {
        result.segment = val;
      } else if (key.includes('whatsapp') || key.includes('telefone') || key.includes('celular')) {
        result.commercialContact.whatsapp = val;
      } else if (key.includes('email') || key.includes('e-mail')) {
        result.commercialContact.email = val;
      } else if (key.includes('site') || key.includes('website') || key.includes('url')) {
        result.commercialContact.website = val;
      } else if (key.includes('instagram') || key.includes('insta')) {
        result.commercialContact.instagram = val.startsWith('@') ? val : `@${val}`;
      } else if (key.includes('tom de voz') || key.includes('tom') || key.includes('voice')) {
        result.toneOfVoice = val;
      } else if (key.includes('primaria') || key.includes('primary')) {
        const hexMatch = val.match(/#[0-9a-fA-F]{6}/);
        if (hexMatch) {
          result.palette = result.palette || {};
          result.palette.primary = hexMatch[0].toUpperCase();
        }
      } else if (key.includes('secundaria') || key.includes('secondary')) {
        const hexMatch = val.match(/#[0-9a-fA-F]{6}/);
        if (hexMatch) {
          result.palette = result.palette || {};
          result.palette.secondary = hexMatch[0].toUpperCase();
        }
      } else if (key.includes('terciaria') || key.includes('tertiary') || key.includes('acento') || key.includes('accent') || key.includes('destaque')) {
        const hexMatch = val.match(/#[0-9a-fA-F]{6}/);
        if (hexMatch) {
          result.palette = result.palette || {};
          result.palette.accent = hexMatch[0].toUpperCase();
        }
      } else if (key.includes('fundo') || key.includes('background')) {
        const hexMatch = val.match(/#[0-9a-fA-F]{6}/);
        if (hexMatch) {
          result.palette = result.palette || {};
          result.palette.background = hexMatch[0].toUpperCase();
        }
      }
      continue;
    }

    // Coleta contexto de tom de voz se estiver na secao de tom de voz
    if (currentSection.includes('tom') || currentSection.includes('voz') || currentSection.includes('editorial')) {
      if (line.length > 0 && !line.startsWith('#')) {
        toneLines.push(line);
      }
    }
  }

  if (!result.toneOfVoice && toneLines.length > 0) {
    result.toneOfVoice = toneLines.join(' ').trim();
  }

  return result;
};

/**
 * Gera um modelo padrão de BRAND.md para download pelo usuario
 */
export const generateBrandTemplateMarkdown = (brandName = 'Minha Marca'): string => {
  return `# ${brandName}
## Diretrizes de Marca e Identidade Editorial

**Marca**: ${brandName}
**Segmento**: Moda & Luxo
**WhatsApp**: +55 (11) 98765-4321
**E-mail**: contato@suaempresa.com.br
**Website**: https://suaempresa.com.br
**Instagram**: @suaempresa

## Cores Institucionais
- **Cor Primária**: #18181B
- **Cor Secundária**: #52525B
- **Cor Terciária**: #B08D57
- **Cor de Fundo**: #FAFAFA

## Tom de Voz Editorial
Sóbrio, sofisticado e contemporâneo. Comunicação precisa, focada na qualidade dos materiais, exclusividade e durabilidade. Evitar hipérboles vazias ou superlativos promocionais agressivos.

## Regras de Apresentação de Produtos
- MUST [logo]: Preservar as proporções do logo.
- PREFER [composition]: Composições visuais com respiro negativo generoso.
- AVOID [voice]: Hipérboles promocionais agressivas.
- Sempre incluir referência SKU legível.
- Nomes de produtos em versalete ou caixa alta discreta.
- Composições visuais com respiro negativo generoso.
`;
};
