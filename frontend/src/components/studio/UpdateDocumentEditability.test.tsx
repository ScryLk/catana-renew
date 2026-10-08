import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import api from '../../services/api';
import { documentImportService } from '../../services/documentImportService';
import { UpdateDocumentEditability } from './UpdateDocumentEditability';

const mocked = vi.hoisted(() => ({
  state: {activeCatalogId: '17', activeOrganizationId: 1, activeUserId: 101,
    flushSaveSpread: vi.fn(), loadExistingCatalog: vi.fn()},
}));
vi.mock('../../store/studioStore', () => ({
  useStudioStore: Object.assign((select: (value: typeof mocked.state) => unknown) => select(mocked.state), {getState: () => mocked.state}),
}));
vi.mock('../mobile/ResponsiveModal', () => ({ResponsiveModal: ({children}: {children: React.ReactNode}) => <div role="dialog">{children}</div>}));
vi.mock('./DocumentPageRenderer', () => ({DocumentPageRenderer: () => <div>Prévia reconciliada</div>}));

let container: HTMLDivElement;
let root: Root;
const analysis = (conflicts: {code: string; pageNumber?: number; elementId?: string}[] = []) => ({
  import_id: 'preview-1', report: {reanalysis: {preservedTextEdits: 2, preservedStyleEdits: 1,
    preservedAuthoredPages: 1, canConfirm: !conflicts.length, conflicts, reviewPages: []}}, pages: [],
});
const button = (text: string) => [...container.querySelectorAll('button')].find(value => value.textContent?.includes(text))!;
const click = async (text: string) => {await act(async () => {button(text).click();});};

beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  mocked.state.activeOrganizationId = 1;
  mocked.state.flushSaveSpread.mockResolvedValue(undefined);
  mocked.state.loadExistingCatalog.mockResolvedValue(undefined);
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => {root.render(<UpdateDocumentEditability />);});
});
afterEach(async () => {
  await act(async () => {root.unmount();}); container.remove();
  vi.restoreAllMocks(); vi.clearAllMocks(); vi.unstubAllGlobals();
});

it('uses explicit edit preservation for both reanalysis requests', async () => {
  const post = vi.spyOn(api, 'post').mockResolvedValue({data: analysis()});
  await documentImportService.reanalyze('17');
  await documentImportService.confirmReanalysis('17', 'preview-1');
  expect(post.mock.calls[0][1]).toEqual({action: 'reanalyze', catalog_id: '17', preserve_edits: true});
  expect(post.mock.calls[1][1]).toEqual({action: 'confirm_reanalysis', catalog_id: '17', import_id: 'preview-1', replace_reconstruction: true, preserve_edits: true});
});

it('never reanalyzes automatically and requires a reviewed confirmation', async () => {
  const post = vi.spyOn(api, 'post').mockResolvedValue({data: analysis()});
  expect(post).not.toHaveBeenCalled();
  await click('Atualizar editabilidade');
  expect(mocked.state.flushSaveSpread).toHaveBeenCalledOnce();
  expect(post).toHaveBeenCalledOnce();
  expect(container.textContent).toContain('2 edições de texto, 1 edições de peso tipográfico e 1 páginas adicionadas');
  expect(mocked.state.loadExistingCatalog).not.toHaveBeenCalled();
  await click('Confirmar atualização');
  expect(post).toHaveBeenCalledTimes(2);
  expect(mocked.state.loadExistingCatalog).toHaveBeenCalledWith('17');
  expect(container.querySelector('[role="dialog"]')).toBeNull();
});

it('shows unresolved targets and prevents replacement even after a preview exists', async () => {
  const post = vi.spyOn(api, 'post').mockResolvedValue({data: analysis([{code: 'edited_target_mapping_conflict', pageNumber: 2, elementId: 'p2-o16'}])});
  await click('Atualizar editabilidade');
  expect(container.querySelector('[role="alert"]')?.textContent).toContain('Página 2: elemento p2-o16');
  expect(container.textContent).toContain('associar a edição a um único elemento');
  expect(button('Confirmar atualização').disabled).toBe(true);
  await click('Confirmar atualização');
  expect(post).toHaveBeenCalledOnce();
  expect(mocked.state.loadExistingCatalog).not.toHaveBeenCalled();
});

it('retains the review on a stale save conflict and does not reload a replacement', async () => {
  vi.spyOn(api, 'post').mockResolvedValueOnce({data: analysis()}).mockRejectedValueOnce({response: {status: 400, data: {code: 'reanalysis_conflict', error: 'O catálogo mudou. Prepare uma nova prévia.'}}});
  await click('Atualizar editabilidade');
  await click('Confirmar atualização');
  expect(container.querySelector('[role="alert"]')?.textContent).toContain('O catálogo mudou');
  expect(container.querySelector('[role="dialog"]')).not.toBeNull();
  expect(mocked.state.loadExistingCatalog).not.toHaveBeenCalled();
});

it('ignores a pending preview after switching organization', async () => {
  let resolve!: (value: {data: ReturnType<typeof analysis>}) => void;
  const pending = new Promise<{data: ReturnType<typeof analysis>}>(yes => {resolve = yes;});
  vi.spyOn(api, 'post').mockReturnValue(pending);
  await click('Atualizar editabilidade');
  await act(async () => {mocked.state.activeOrganizationId = 2; root.render(<UpdateDocumentEditability />);});
  await act(async () => {resolve({data: analysis()});});
  expect(container.querySelector('[role="dialog"]')).toBeNull();
  expect(mocked.state.loadExistingCatalog).not.toHaveBeenCalled();
});
