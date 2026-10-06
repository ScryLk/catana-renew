import { GENERATIVE_CONTRACT } from '../generated/generativeContract.generated';
import type { CatalogPageData } from '../data/editorialCatalog.mock';
import { isEditableDocumentText, validDocumentSnapshot } from '../types/documentImport';

export type ActionStatus = 'applied' | 'not_found' | 'ambiguous' | 'not_editable' | 'blocked_by_integrity' | 'invalid_target' | 'unchanged';
export interface ActionResult { action_id: string; target: string; status: ActionStatus; reason?: string; value?: string }

/** Retain offsets so normalization never rewrites typography or unrelated text. */
function normalizedOffsets(text: string) {
  let value = '';
  const starts: number[] = [], ends: number[] = [];
  for (let i = 0; i < text.length;) {
    const char = String.fromCodePoint(text.codePointAt(i)!);
    const normalized = char.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt-BR');
    for (const c of normalized) {
      if (/\s/u.test(c)) {
        if (value.endsWith(' ')) { ends[ends.length - 1] = i + char.length; continue; }
        value += ' ';
      } else value += c;
      starts.push(i); ends.push(i + char.length);
    }
    i += char.length;
  }
  return { value, starts, ends };
}

export function replaceNormalized(text: string, find: string, replacement: string): string | null {
  const source = normalizedOffsets(text), needle = normalizedOffsets(find.trim()).value;
  if (!needle) return null;
  const start = source.value.indexOf(needle);
  if (start < 0 || source.value.indexOf(needle, start + needle.length) >= 0) return null;
  return text.slice(0, source.starts[start]) + replacement + text.slice(source.ends[start + needle.length - 1]);
}

function editablePage(page: CatalogPageData): boolean {
  const document = page.documentPage;
  return Boolean(document && document.visibility !== 'source_only' && validDocumentSnapshot(document.fallbackSnapshot)
    && document.elements.filter(element => element.editable && element.type === 'text').every(element => isEditableDocumentText(element) && (element.appearance || element.snapshot)));
}

export function commercialText(text: string, pages: CatalogPageData[]): boolean {
  // Generic edits cannot change a number, SKU, specification or a known authoritative value.
  if (/\d|\b(?:SKU|MOQ|estoque|pre[cç]o|especifica[cç][aã]o)\b|R\$/iu.test(text)) return true;
  const values = (value: unknown): string[] => typeof value === 'string' ? [value] : value && typeof value === 'object' ? Object.values(value).flatMap(values) : [];
  return pages.some(page => page.products?.some(product => GENERATIVE_CONTRACT.commercialProtectedFields.filter(field => field !== 'id').flatMap(field => values(product[field as keyof typeof product])).some(value => value.length > 2 && text.includes(value))));
}

export function editableTextIndex(pages: CatalogPageData[], visible: number[], selected?: string | null) {
  type Entry = {id: string; target: string; text: string; editable: boolean; commercial: boolean; visible: boolean};
  const result: Entry[] = [];
  let budget = 32000;
  const ordered = [...pages].sort((a, b) => {
    const priority = (page: CatalogPageData) => page.documentPage?.elements.some(element => element.id === selected) ? 2 : visible.includes(page.pageNumber) ? 1 : 0;
    return priority(b) - priority(a);
  });
  const append = (entry: Entry) => {
    const cost = JSON.stringify(entry).length;
    if (cost <= budget && result.length < 500) { result.push(entry); budget -= cost; }
  };
  for (const page of ordered) {
    if (budget < 200 || result.length >= 500) break;
    const isVisible = visible.includes(page.pageNumber);
    if (page.documentPage) {
      const safe = editablePage(page);
      const elements = [...page.documentPage.elements].sort((a, b) => Number(b.id === selected) - Number(a.id === selected));
      for (const element of elements) {
        if (budget < 200 || result.length >= 500) break;
        if (element.type !== 'text' || typeof element.text !== 'string') continue;
        append({id: element.id, target: `page:${page.pageNumber}/element:${element.id}`, text: element.text.slice(0, 2000), editable: safe && isEditableDocumentText(element), commercial: commercialText(element.text, pages), visible: isVisible});
      }
    } else {
      for (const field of ['title', 'quote', 'content', 'subtitle', 'label'] as const) {
        if (typeof page[field] !== 'string' || !page[field]) continue;
        append({id: `page:${page.pageNumber}/${field}`, target: `page:${page.pageNumber}/field:${field}`, text: String(page[field]).slice(0, 2000), editable: true, commercial: commercialText(String(page[field]), pages), visible: isVisible});
      }
    }
  }
  return result;
}

export function executeTextAction(pages: CatalogPageData[], target: string, params: Record<string, unknown>): {result: ActionResult; pages: CatalogPageData[]} {
  const result: ActionResult = {action_id: target, target, status: 'invalid_target'};
  const match = /^(?:page:(\d+)\/)?element:(.+)$/.exec(target);
  const fieldMatch = /^page:(\d+)\/field:(title|quote|content|subtitle|label)$/.exec(target);
  if (!match && !fieldMatch) return {result, pages};
  const candidates = match ? pages.filter(page => (!match[1] || page.pageNumber === Number(match[1])) && page.documentPage?.elements.some(element => element.id === match[2])) : pages.filter(page => page.pageNumber === Number(fieldMatch![1]));
  if (candidates.length !== 1) return {result: {...result, status: candidates.length ? 'ambiguous' : 'not_found'}, pages};
  const page = candidates[0], element = match ? page.documentPage!.elements.find(item => item.id === match[2])! : undefined;
  if (element && (!editablePage(page) || !isEditableDocumentText(element))) return {result: {...result, status: 'not_editable'}, pages};
  const field = fieldMatch?.[2] as 'title' | undefined;
  const text = element ? element.text ?? element.content ?? '' : String(page[field!] ?? '');
  if (typeof params.expectedText === 'string' && params.expectedText !== text) return {result: {...result, status: 'not_found', reason: 'stale_text'}, pages};
  const replacement = typeof params.find === 'string' && typeof params.replacement === 'string'
    ? replaceNormalized(text, params.find, params.replacement) : typeof params.text === 'string' ? params.text : null;
  if (replacement === null) return {result: {...result, status: 'not_found'}, pages};
  if (replacement.length > 20000) return {result, pages};
  if (replacement === text) return {result: {...result, status: 'unchanged'}, pages};
  if (element && ['price', 'sku', 'quantity', 'technical_specs', 'product_name', 'product_description', 'material', 'dimensions', 'reference_code', 'commercial_condition'].includes(String(element.role || ''))) return {result: {...result, status: 'blocked_by_integrity'}, pages};
  if (commercialText(text, pages) || commercialText(replacement, pages)) return {result: {...result, status: 'blocked_by_integrity'}, pages};
  const updated = element ? {...page, documentPage: {...page.documentPage!, elements: page.documentPage!.elements.map(item => item.id === element.id ? {...item, text: replacement, edited: replacement !== item.provenance?.sourceText} : item)}} : {...page, [field!]: replacement};
  return {result: {...result, status: 'applied', value: replacement}, pages: pages.map(item => item === page ? updated : item)};
}


export function executionFeedback(results: ActionResult[]): string {
  const applied = results.filter(result => result.status === 'applied');
  const messages: Record<ActionStatus, string> = {
    applied: '', not_found: 'Texto ou destino não encontrado; selecione o trecho novamente.',
    ambiguous: 'Há mais de uma ocorrência; selecione um único texto ou indique a página.',
    not_editable: 'Texto preservado na imagem original; use reconstrução ou redesign para editar com segurança.',
    blocked_by_integrity: 'Edição bloqueada pela integridade dos dados comerciais.',
    invalid_target: 'Destino inválido; selecione um elemento de texto editável.',
    unchanged: 'Nenhuma mudança confirmada para esta ação.',
  };
  const success = applied.length === 1 && applied[0].value ? `Texto da página atualizado para '${applied[0].value.slice(0, 160)}'.` : applied.length ? `${applied.length} alteração(ões) aplicada(s) na prancheta.` : 'Nenhuma alteração aplicada.';
  return [success, ...new Set(results.filter(result => result.status !== 'applied').map(result => messages[result.status]))].join(' ');
}
