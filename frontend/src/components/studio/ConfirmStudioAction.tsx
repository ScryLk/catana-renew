import { useState } from 'react';
import api from '../../services/api';
import { useStudioStore } from '../../store/studioStore';
import { executionFeedback } from '../../utils/textCommandExecution';

/** Confirmation grants only the server-signed proposal for this catalog revision. */
export function ConfirmStudioAction({token}: {token:string}) {
  const catalog = useStudioStore(s=>s.activeCatalogId);
  const org = useStudioStore(s=>s.activeOrganizationId);
  const user = useStudioStore(s=>s.activeUserId);
  const [busy,setBusy]=useState(false);
  const [done,setDone]=useState(false);
  const [feedback,setFeedback]=useState('');
  const confirm=async()=>{
    if (busy || !catalog) return;
    setBusy(true);
    const current=()=>{const s=useStudioStore.getState();return s.activeCatalogId===catalog && s.activeOrganizationId===org && s.activeUserId===user;};
    try {
      const response=await api.post(`/api/v2/studio/catalogs/${catalog}/actions/confirm/`,{confirmation_token:token});
      if (!current()) return;
      const results=useStudioStore.getState().applySpreadPatch(response.data.patch);
      await useStudioStore.getState().flushSaveSpread();
      if (!current()) return;
      setFeedback(useStudioStore.getState().saveStatus==='saved' ? executionFeedback(results) : 'Não foi possível salvar a alteração.');
      setDone(true);
    } catch {if(current()) setFeedback('O catálogo mudou ou a confirmação expirou. Solicite uma nova proposta.');}
    finally {setBusy(false);}
  };
  if(done) return <p role="status">{feedback}</p>;
  return <div className="mt-2 flex flex-wrap gap-2" aria-label="Confirmar alteração de páginas">
    <p className="w-full">Remover da sequência atual? A origem continuará preservada.</p>
    <button type="button" className="min-h-11 rounded border px-3" disabled={busy} onClick={()=>void confirm()}>Remover do catálogo</button>
    <button type="button" className="min-h-11 rounded border px-3" disabled={busy} onClick={()=>setDone(true)}>Cancelar</button>
    {feedback && <p role="alert">{feedback}</p>}
  </div>;
}
