import { describe, it, expect } from 'vitest';
import {
  removeAccents,
  deduplicateChars,
  levenshteinDistance,
  isFuzzyMatch,
  parseSpelledNumber,
  normalizeLayoutType,
  preprocessUserCommand,
  matchesPageTerm,
  matchesRemoveVerb,
  matchesAddVerb,
  matchesSummarizeVerb,
  matchesProductTerm,
} from './textNormalizer';

describe('textNormalizer Utility Suite', () => {
  describe('removeAccents', () => {
    it('removes accents from Portuguese words correctly', () => {
      expect(removeAccents('Página')).toBe('pagina');
      expect(removeAccents('Atenção')).toBe('atencao');
      expect(removeAccents('Lâmina')).toBe('lamina');
      expect(removeAccents('Preço')).toBe('preco');
    });

    it('handles empty strings and falsy values without crashing', () => {
      expect(removeAccents('')).toBe('');
      // @ts-expect-error testing falsy
      expect(removeAccents(null)).toBe('');
      // @ts-expect-error testing falsy
      expect(removeAccents(undefined)).toBe('');
    });

    it('preserves numbers and standard punctuation', () => {
      expect(removeAccents('Spread 01: Preço R$ 1.500')).toBe('spread 01: preco r$ 1.500');
    });
  });

  describe('deduplicateChars', () => {
    it('collapses 3 or more repeated letters into a single character', () => {
      expect(deduplicateChars('pagiiina')).toBe('pagina');
      expect(deduplicateChars('tiraaa')).toBe('tira');
      expect(deduplicateChars('muuuuito')).toBe('muito');
    });

    it('preserves valid double consonants like rr and ss', () => {
      expect(deduplicateChars('carro')).toBe('carro');
      expect(deduplicateChars('passo')).toBe('passo');
    });

    it('handles empty and single character strings', () => {
      expect(deduplicateChars('')).toBe('');
      expect(deduplicateChars('a')).toBe('a');
      expect(deduplicateChars('aaa')).toBe('a');
    });
  });

  describe('levenshteinDistance', () => {
    it('calculates correct distance between strings', () => {
      expect(levenshteinDistance('gato', 'gato')).toBe(0);
      expect(levenshteinDistance('gato', 'gata')).toBe(1);
      expect(levenshteinDistance('casa', 'casas')).toBe(1);
      expect(levenshteinDistance('livro', '')).toBe(5);
      expect(levenshteinDistance('', 'livro')).toBe(5);
      expect(levenshteinDistance('', '')).toBe(0);
    });
  });

  describe('isFuzzyMatch', () => {
    it('matches identical and accented words', () => {
      expect(isFuzzyMatch('página', 'pagina')).toBe(true);
      expect(isFuzzyMatch('preço', 'preco')).toBe(true);
    });

    it('matches typos within allowable edit distance', () => {
      expect(isFuzzyMatch('prodduto', 'produto')).toBe(true);
      expect(isFuzzyMatch('catalgo', 'catalogo')).toBe(true);
    });

    it('rejects completely different words', () => {
      expect(isFuzzyMatch('elefante', 'catalogo')).toBe(false);
      expect(isFuzzyMatch('azul', 'amarelo')).toBe(false);
    });
  });

  describe('parseSpelledNumber', () => {
    it('parses direct numeric strings', () => {
      expect(parseSpelledNumber('5')).toBe(5);
      expect(parseSpelledNumber('12')).toBe(12);
    });

    it('parses spelled-out Portuguese numbers and ordinals', () => {
      expect(parseSpelledNumber('um')).toBe(1);
      expect(parseSpelledNumber('primeira')).toBe(1);
      expect(parseSpelledNumber('dois')).toBe(2);
      expect(parseSpelledNumber('segunda')).toBe(2);
      expect(parseSpelledNumber('quatro')).toBe(4);
      expect(parseSpelledNumber('meia')).toBe(6);
    });

    it('returns null for unparseable input', () => {
      expect(parseSpelledNumber('invalido')).toBeNull();
      expect(parseSpelledNumber('')).toBeNull();
    });
  });

  describe('normalizeLayoutType', () => {
    it('identifies cover layouts from Portuguese expressions', () => {
      expect(normalizeLayoutType('capa')).toBe('cover');
      expect(normalizeLayoutType('cover')).toBe('cover');
    });

    it('identifies hero and duo layouts', () => {
      expect(normalizeLayoutType('destaque')).toBe('hero');
      expect(normalizeLayoutType('duo')).toBe('duo');
      expect(normalizeLayoutType('dois produtos')).toBe('duo');
      expect(normalizeLayoutType('dupla')).toBe('duo');
    });

    it('identifies grids and tables', () => {
      expect(normalizeLayoutType('grid')).toBe('grid_4');
      expect(normalizeLayoutType('grade')).toBe('grid_4');
      expect(normalizeLayoutType('tabela')).toBe('grid_4');
    });

    it('identifies section dividers and manifestos', () => {
      expect(normalizeLayoutType('divisor')).toBe('divider');
      expect(normalizeLayoutType('secao')).toBe('divider');
      expect(normalizeLayoutType('abertura')).toBe('divider');
      expect(normalizeLayoutType('manifesto')).toBe('manifesto');
      expect(normalizeLayoutType('poetico')).toBe('manifesto');
    });

    it('defaults to hero when no recognized layout matches', () => {
      expect(normalizeLayoutType('desconhecido')).toBe('hero');
    });
  });

  describe('term matchers', () => {
    it('matches page terms with typos and colloquialisms', () => {
      expect(matchesPageTerm('pag')).toBe(true);
      expect(matchesPageTerm('pagina')).toBe(true);
      expect(matchesPageTerm('lamina')).toBe(true);
      expect(matchesPageTerm('prancheta')).toBe(true);
      expect(matchesPageTerm('sapato')).toBe(false);
    });

    it('matches remove verbs', () => {
      expect(matchesRemoveVerb('tira')).toBe(true);
      expect(matchesRemoveVerb('remover')).toBe(true);
      expect(matchesRemoveVerb('apaga')).toBe(true);
      expect(matchesRemoveVerb('adicionar')).toBe(false);
    });

    it('matches add verbs', () => {
      expect(matchesAddVerb('bota')).toBe(true);
      expect(matchesAddVerb('adicionar')).toBe(true);
      expect(matchesAddVerb('insira')).toBe(true);
      expect(matchesAddVerb('inserir')).toBe(true);
      expect(matchesAddVerb('excluir')).toBe(false);
    });

    it('matches summarize verbs', () => {
      expect(matchesSummarizeVerb('resuma')).toBe(true);
      expect(matchesSummarizeVerb('enxuga')).toBe(true);
      expect(matchesSummarizeVerb('sintetiza')).toBe(true);
      expect(matchesSummarizeVerb('ampliar')).toBe(false);
    });

    it('matches product terms', () => {
      expect(matchesProductTerm('produto')).toBe(true);
      expect(matchesProductTerm('item')).toBe(true);
      expect(matchesProductTerm('peca')).toBe(true);
      expect(matchesProductTerm('casa')).toBe(false);
    });
  });

  describe('preprocessUserCommand', () => {
    it('normalizes common chat abbreviations and slang', () => {
      const result = preprocessUserCommand('pfv muda a pag 2 pra capa');
      expect(result.normalized).toContain('pagina');
      expect(result.tokens).toContain('pagina');
      expect(result.raw).toBe('pfv muda a pag 2 pra capa');
    });

    it('handles phonetic slang replacements like conto/pau/bota/tira', () => {
      const result = preprocessUserCommand('bota 50 conto no preso do produto');
      expect(result.normalized).toContain('adicionar');
      expect(result.normalized).toContain('reais');
      expect(result.normalized).toContain('preco');
    });

    it('handles empty commands gracefully', () => {
      const empty = preprocessUserCommand('');
      expect(empty.raw).toBe('');
      expect(empty.normalized).toBe('');
      expect(empty.tokens).toEqual([]);

      // @ts-expect-error testing falsy
      const nullCmd = preprocessUserCommand(null);
      expect(nullCmd.raw).toBe('');
      expect(nullCmd.tokens).toEqual([]);
    });
  });
});
