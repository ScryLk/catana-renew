// Normalizador de Linguagem e Tolerância a Erros para o Catana Studio 2.0
// Regra Estrita: ZERO EMOJIS em todo o arquivo.

/**
 * Remove acentos e diacríticos de uma string Unicode (ex: 'página' -> 'pagina', 'preço' -> 'preco').
 */
export function removeAccents(text: string): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * Reduz repetições enfáticas de caracteres comuns em chats (ex: 'pagiiina' -> 'pagina', 'tiraaa' -> 'tira').
 * Preserva dígrafos legítimos como 'ss' e 'rr'.
 */
export function deduplicateChars(text: string): string {
  if (!text) return '';
  // Reduz 3 ou mais caracteres repetidos para 1
  return text.replace(/(.)\1{2,}/gi, '$1');
}

/**
 * Calcula a distância de edição Levenshtein entre duas palavras.
 */
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1, // deleção
        dp[i][j - 1] + 1, // inserção
        dp[i - 1][j - 1] + cost // substituição
      );
    }
  }

  return dp[m][n];
}

/**
 * Avalia se um token é similar a uma palavra-alvo com base em distância Levenshtein.
 */
export function isFuzzyMatch(token: string, target: string, maxDistance?: number): boolean {
  const cleanToken = removeAccents(deduplicateChars(token.trim().toLowerCase()));
  const cleanTarget = removeAccents(target.trim().toLowerCase());

  if (cleanToken === cleanTarget) return true;
  if (cleanToken.includes(cleanTarget) || cleanTarget.includes(cleanToken)) return true;

  const threshold = maxDistance !== undefined
    ? maxDistance
    : cleanTarget.length >= 6
    ? 2
    : cleanTarget.length >= 4
    ? 1
    : 0;

  return levenshteinDistance(cleanToken, cleanTarget) <= threshold;
}

/**
 * Mapeamento robusto de numerais por extenso, ordinais e gírias regionais (como 'meia' = 6).
 */
export const NUMBER_WORD_MAP: Record<string, number> = {
  um: 1,
  uma: 1,
  primeira: 1,
  primeiro: 1,
  '1a': 1,
  '1o': 1,
  dois: 2,
  duas: 2,
  segunda: 2,
  segundo: 2,
  '2a': 2,
  '2o': 2,
  tres: 3,
  terceira: 3,
  terceiro: 3,
  '3a': 3,
  '3o': 3,
  quatro: 4,
  quarta: 4,
  quarto: 4,
  '4a': 4,
  '4o': 4,
  cinco: 5,
  quinta: 5,
  quinto: 5,
  '5a': 5,
  '5o': 5,
  seis: 6,
  meia: 6, // Regional brasileiro frequente
  sexta: 6,
  sexto: 6,
  '6a': 6,
  '6o': 6,
  sete: 7,
  setima: 7,
  setimo: 7,
  '7a': 7,
  '7o': 7,
  oito: 8,
  oitava: 8,
  oitavo: 8,
  '8a': 8,
  '8o': 8,
  nove: 9,
  nona: 9,
  nono: 9,
  '9a': 9,
  '9o': 9,
  dez: 10,
  decima: 10,
  decimo: 10,
  '10a': 10,
  '10o': 10,
};

/**
 * Extrai número de página com tolerância a palavras por extenso ou dígitos.
 */
export function parseSpelledNumber(raw: string): number | null {
  if (!raw) return null;
  const clean = removeAccents(raw.trim().toLowerCase());
  const num = parseInt(clean, 10);
  if (!isNaN(num)) return num;

  if (NUMBER_WORD_MAP[clean] !== undefined) {
    return NUMBER_WORD_MAP[clean];
  }

  // Tenta encontrar dentro da string se houver preposição (ex: 'da segunda')
  for (const [word, val] of Object.entries(NUMBER_WORD_MAP)) {
    if (new RegExp(`\\b${word}\\b`, 'i').test(clean)) {
      return val;
    }
  }

  return null;
}

/**
 * Dicionário de sinônimos e dialetos para páginas e lâminas.
 */
export const PAGE_TERMS = [
  'pagina',
  'pag',
  'pagna',
  'pagnia',
  'pajina',
  'lamina',
  'folha',
  'folhinha',
  'prancha',
  'prancheta',
  'lado',
];

export function matchesPageTerm(word: string): boolean {
  const clean = removeAccents(deduplicateChars(word.toLowerCase()));
  return PAGE_TERMS.some((target) => isFuzzyMatch(clean, target, 1));
}

/**
 * Dicionário de dialetos para verbos de remoção / exclusão.
 */
export const REMOVE_VERBS = [
  'remover',
  'retirar',
  'apagar',
  'excluir',
  'deletar',
  'eliminar',
  'tirar',
  'arrancar',
  'limpar',
  'sumir',
  'cortar',
  'escluir',
  'exclue',
  'remova',
  'retire',
  'tira',
  'arranca',
  'apague',
  'delete',
  'elimine',
];

export function matchesRemoveVerb(word: string): boolean {
  const clean = removeAccents(deduplicateChars(word.toLowerCase()));
  return REMOVE_VERBS.some((target) => isFuzzyMatch(clean, target, 1));
}

/**
 * Dicionário de dialetos para verbos de adição / inserção.
 */
export const ADD_VERBS = [
  'adicionar',
  'criar',
  'inserir',
  'acrescentar',
  'botar',
  'tacar',
  'meter',
  'incluir',
  'colocar',
  'por',
  'adicione',
  'crie',
  'insira',
  'acrescente',
  'bota',
  'taca',
  'põe',
  'adiciona',
  'adisionar',
  'inceri',
];

export function matchesAddVerb(word: string): boolean {
  const clean = removeAccents(deduplicateChars(word.toLowerCase()));
  return ADD_VERBS.some((target) => isFuzzyMatch(clean, target, 1));
}

/**
 * Dicionário de dialetos para verbos de resumo / síntese.
 */
export const SUMMARIZE_VERBS = [
  'resumir',
  'sintetizar',
  'encurtar',
  'condensar',
  'enxugar',
  'cortar',
  'diminuir',
  'podar',
  'simplificar',
  'resuma',
  'sintetize',
  'encurte',
  'condense',
  'enxuga',
  'poda',
  'rezumir',
  'rezuma',
];

export function matchesSummarizeVerb(word: string): boolean {
  const clean = removeAccents(deduplicateChars(word.toLowerCase()));
  return SUMMARIZE_VERBS.some((target) => isFuzzyMatch(clean, target, 1));
}

/**
 * Dicionário de termos de produtos e inventário comercial.
 */
export const PRODUCT_TERMS = [
  'produto',
  'poduto',
  'prroduto',
  'prodto',
  'item',
  'itens',
  'peça',
  'peca',
  'artigo',
  'mercadoria',
  'referencia',
];

export function matchesProductTerm(word: string): boolean {
  const clean = removeAccents(deduplicateChars(word.toLowerCase()));
  return PRODUCT_TERMS.some((target) => isFuzzyMatch(clean, target, 1));
}

/**
 * Normaliza layouts solicitados com tolerância ortográfica e coloquialismos.
 */
export function normalizeLayoutType(raw: string): 'hero' | 'duo' | 'grid_4' | 'single' | 'manifesto' | 'divider' | 'cover' {
  const clean = removeAccents(raw.toLowerCase());
  if (clean.includes('duo') || clean.includes('dupla') || clean.includes('split') || clean.includes('dois')) return 'duo';
  if (clean.includes('grid') || clean.includes('grade') || clean.includes('quad') || clean.includes('quatro') || clean.includes('tabela')) return 'grid_4';
  if (clean.includes('single') || clean.includes('simples') || clean.includes('um produto') || clean.includes('individual')) return 'single';
  if (clean.includes('divis') || clean.includes('divider') || clean.includes('secao') || clean.includes('abertura')) return 'divider';
  if (clean.includes('manifesto') || clean.includes('editorial') || clean.includes('poetico') || clean.includes('texto')) return 'manifesto';
  if (clean.includes('capa') || clean.includes('cover')) return 'cover';
  return 'hero';
}

/**
 * Pipeline de normalização integral do prompt do usuário.
 * Retorna uma versão limpa e sem acentos, com tokens dedupados e termos coloquiais mapeados.
 */
export interface NormalizedCommand {
  raw: string;
  normalized: string;
  tokens: string[];
}

export function preprocessUserCommand(command: string): NormalizedCommand {
  const raw = command || '';
  const noAccents = removeAccents(raw);
  const deduped = deduplicateChars(noAccents);

  // Normalizações fonéticas pontuais comuns em português
  const phoneticallyCleaned = deduped
    .replace(/\bpresos\b/g, 'precos')
    .replace(/\bpreso\b/g, 'preco')
    .replace(/\bdisconto\b/g, 'desconto')
    .replace(/\bpalheta\b/g, 'paleta')
    .replace(/\blaiout\b/g, 'layout')
    .replace(/\blayot\b/g, 'layout')
    .replace(/\bgred\b/g, 'grid')
    .replace(/\bprroduto\b/g, 'produto')
    .replace(/\bpagna\b/g, 'pagina')
    .replace(/\bpagnia\b/g, 'pagina')
    .replace(/\bpajina\b/g, 'pagina')
    .replace(/\bpag\b/g, 'pagina')
    .replace(/\bpags\b/g, 'paginas')
    .replace(/\bfolhinha\b/g, 'pagina')
    .replace(/\bfolha\b/g, 'pagina')
    .replace(/\blamina\b/g, 'pagina')
    .replace(/\bprancha\b/g, 'pagina')
    .replace(/\bprancheta\b/g, 'pagina')
    .replace(/\bsobe\s+os\s+precos?\b/g, 'aumentar precos')
    .replace(/\bbaixa\s+os\s+precos?\b/g, 'reduzir precos')
    .replace(/\bda\s+um\s+desconto\b/g, 'reduzir precos')
    .replace(/\benxuga\b/g, 'resumir')
    .replace(/\benxugada\b/g, 'resumo')
    .replace(/\bpoda\b/g, 'resumir')
    .replace(/\bbota\b/g, 'adicionar')
    .replace(/\btaca\b/g, 'adicionar')
    .replace(/\bmete\b/g, 'adicionar')
    .replace(/\bpoe\b/g, 'adicionar')
    .replace(/\btira\b/g, 'remover')
    .replace(/\barranca\b/g, 'remover')
    .replace(/\barranca\s+fora\b/g, 'remover')
    .replace(/\bsome\s+com\b/g, 'remover')
    .replace(/\bpassa\s+a\s+regua\b/g, 'remover')
    .replace(/\bda\s+um\s+grau\b/g, 'alterar layout')
    .replace(/\bpintura\b/g, 'paleta')
    .replace(/\btinta\b/g, 'paleta')
    .replace(/\bconto\b/g, 'reais')
    .replace(/\bpau\b/g, 'reais');

  const tokens = phoneticallyCleaned
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);

  return {
    raw,
    normalized: phoneticallyCleaned.trim(),
    tokens,
  };
}
