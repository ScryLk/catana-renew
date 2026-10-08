import { useState } from 'react';
import { useStudioStore, type TextStyleChoice } from '../../store/studioStore';

const weights = new Set([400, 600, 700, 800]);
function safeChoices(raw: unknown): TextStyleChoice[] {
  if (!Array.isArray(raw) || raw.length > 4) return [];
  return raw.filter((value): value is TextStyleChoice => {
    if (!value || typeof value !== 'object') return false;
    const choice = value as TextStyleChoice;
    return weights.has(choice.fontWeight) && typeof choice.label === 'string' && choice.label.length <= 60
      && typeof choice.expectedText === 'string' && choice.expectedText.length > 0 && choice.expectedText.length <= 2000
      && typeof choice.elementId === 'string' && choice.elementId.length <= 100 && Number.isInteger(choice.page) && choice.page > 0
      && choice.target === `page:${choice.page}/element:${choice.elementId}` && Number.isInteger(choice.expectedFontWeight)
      && Number.isInteger(choice.catalog_id) && typeof choice.catalog_revision === 'string' && choice.catalog_revision.length > 0 && choice.catalog_revision.length <= 128
      && choice.command === `defina o peso de ${JSON.stringify(choice.expectedText)} para ${choice.fontWeight} na página ${choice.page}`;
  });
}

/** Explicit choices produce another server-resolved turn; they never apply a client patch. */
export function TextStyleChoices({choices: raw}: {choices: unknown}) {
  const catalog = useStudioStore(state => state.activeCatalogId);
  const organization = useStudioStore(state => state.activeOrganizationId);
  const user = useStudioStore(state => state.activeUserId);
  const thread = useStudioStore(state => state.activeThreadId);
  const agentStatus = useStudioStore(state => state.agentStatus);
  const [used, setUsed] = useState(false);
  const choices = safeChoices(raw).filter(choice => String(choice.catalog_id) === catalog);
  if (!choices.length || used) return null;
  const choose = async (choice: TextStyleChoice) => {
    const state = useStudioStore.getState();
    if (used || state.agentStatus !== 'idle' || state.activeCatalogId !== catalog || state.activeOrganizationId !== organization || state.activeUserId !== user || state.activeThreadId !== thread) return;
    setUsed(true);
    state.setSelectedElementId(choice.elementId);
    await state.sendMessageToAgent(choice.command, undefined, choice);
  };
  return <div className="mt-2 flex flex-wrap gap-2" aria-label="Escolher peso tipográfico">
    {choices.map(choice => <button key={choice.fontWeight} type="button" className="min-h-11 rounded border px-3" disabled={agentStatus !== 'idle'} onClick={() => void choose(choice)}>{choice.label}</button>)}
  </div>;
}
