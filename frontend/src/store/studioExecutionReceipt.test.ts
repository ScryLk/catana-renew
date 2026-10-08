import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import api from '../services/api';
import { configureAuthProvider, clearAuthRuntime, setInMemoryAccessToken, setTokenReady } from '../services/authTokenProvider';
import { useStudioStore } from './studioStore';
import type { CatalogPageData } from '../data/editorialCatalog.mock';

const source = (): CatalogPageData => ({id:'source-1',pageNumber:1,type:'hero',products:[],backgroundColor:'#fff',textColor:'#000',accentColor:'#000',documentPage:{pageNumber:1,width:612,height:792,unit:'pt',visibility:'hybrid',sourceSnapshot:{url:'/media/source.png',hash:'source',widthPixels:612,heightPixels:792},fallbackSnapshot:{url:'/media/clean.png',hash:'clean',widthPixels:612,heightPixels:792},elements:[{id:'t1',type:'text',editable:true,text:'ITENS DE',edited:true,fontWeight:300,fontSize:18,resolvedFont:'Arial',x:.1,y:.1,width:.6,height:.1,snapshot:{url:'/media/crop.png',hash:'crop',widthPixels:300,heightPixels:80},provenance:{sourceText:'CATÁLOGO DE'}}]}});
const patch = {actions:[{action:'update_text',target:'page:1/element:t1',params:{expectedText:'ITENS DE',find:'ITENS',replacement:'PRODUTOS'}}]};
function stream(messageId: number | undefined = 42) {
  const events = [{event:'token',text:'Proposta validada; aguardando execução.'},{event:'patch',patch},{event:'done',patch,message_id:messageId,metadata:{provider:'controlled'}}];
  const read = vi.fn().mockResolvedValueOnce({done:false,value:new TextEncoder().encode(events.map(event=>`data: ${JSON.stringify(event)}\n`).join(''))}).mockResolvedValue({done:true});
  const fetch = vi.fn().mockResolvedValue({ok:true,status:200,body:{getReader:()=>({read,cancel:vi.fn()})}});
  vi.stubGlobal('fetch',fetch);
  return fetch;
}
beforeEach(()=>{
  vi.useFakeTimers();
  vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({font:'',measureText:(text:string)=>({width:text.length*7})} as unknown as CanvasRenderingContext2D);
  useStudioStore.getState().resetStudioState();
  useStudioStore.setState({activeCatalogId:'12',pages:[source()],totalPages:1,currentSpread:[1,1],activeThreadId:'thread-9',threads:[{id:'thread-9',title:'Origem',mode:'orchestrator',messages:[],createdAt:'00:00'}],messages:[],saveStatus:'saved',historyStack:[],redoStack:[]});
  configureAuthProvider('legacy');setInMemoryAccessToken('controlled');setTokenReady(true);
});
afterEach(()=>{useStudioStore.getState().resetStudioState();clearAuthRuntime();vi.clearAllTimers();vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllGlobals();});

describe('server-confirmed chat execution',()=>{
  it('flushes manual revisions first, executes patch/done once and uses the correlated server receipt',async()=>{
    useStudioStore.setState({saveStatus:'unsaved'});
    const fetch=stream();
    const execution=vi.spyOn(useStudioStore.getState(),'applySpreadPatch');
    const post=vi.spyOn(api,'post').mockImplementation(async(url)=>({data:String(url).endsWith('/chat/execution/')?{message_id:42,content:'Texto da página atualizado para \'PRODUTOS DE\'.',execution_results:[{action_id:'0',target:'page:1/element:t1',status:'applied',value:'PRODUTOS DE'}],execution_receipt:{status:'confirmed',revision_before:'before',revision_after:'after'}}:{}}));
    await useStudioStore.getState().sendMessageToAgent('altere de ITENS para PRODUTOS');
    expect(execution).toHaveBeenCalledTimes(1);expect(useStudioStore.getState().historyStack).toHaveLength(1);
    expect(post.mock.invocationCallOrder[0]).toBeLessThan(fetch.mock.invocationCallOrder[0]);
    const body=JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.editable_text_index).toEqual([]);expect(body.thread_id).toBe(9);
    const saving=post.mock.calls.find(call=>(call[1] as {execution?:unknown}).execution);
    expect(saving?.[1]).toMatchObject({execution:{client_request_id:body.client_request_id,message_id:42}});
    expect(post.mock.calls.find(call=>String(call[0]).endsWith('/chat/execution/'))?.[1]).toMatchObject({client_request_id:body.client_request_id,message_id:42});
    const message=useStudioStore.getState().messages.at(-1)!;
    expect(message.content).toContain('PRODUTOS DE');expect(message.executionReceipt?.status).toBe('confirmed');
    expect(message.proposal?.content).toBe('Proposta validada; aguardando execução.');
    expect(useStudioStore.getState().pages[0].documentPage!.elements[0].provenance?.sourceText).toBe('CATÁLOGO DE');
  });
  it('never promotes a successful local application when save fails',async()=>{
    stream();
    vi.spyOn(console,'warn').mockImplementation(()=>{});
    const post=vi.spyOn(api,'post').mockImplementation(async(url)=>{
      if(String(url).endsWith('/chat/execution/'))return {data:{content:'Não foi possível salvar a alteração.',execution_results:[{action_id:'0',target:'page:1/element:t1',status:'failed'}],execution_receipt:{status:'unverified'}}};
      throw new Error('controlled save failure');
    });
    await useStudioStore.getState().sendMessageToAgent('altere de ITENS para PRODUTOS');
    const message=useStudioStore.getState().messages.at(-1)!;
    expect(message.content).toBe('Não foi possível salvar a alteração.');expect(message.executionResults?.[0].status).toBe('failed');expect(message.actions).toBeUndefined();
    expect(post.mock.calls.find(call=>String(call[0]).endsWith('/chat/execution/'))?.[1]).toMatchObject({results:[{status:'failed'}]});
  });
  it('keeps saved edits unverified when the receipt endpoint is unavailable',async()=>{
    stream();
    vi.spyOn(api,'post').mockImplementation(async(url)=>{if(String(url).endsWith('/chat/execution/'))throw new Error('receipt offline');return {data:{}};});
    await useStudioStore.getState().sendMessageToAgent('altere de ITENS para PRODUTOS');
    const message=useStudioStore.getState().messages.at(-1)!;
    expect(message.executionResults?.[0].status).toBe('unverified');expect(message.content).toContain('não pôde ser confirmado');expect(message.actions).toBeUndefined();
  });
  it('does not request a canonical proposal when pending manual edits cannot be saved',async()=>{
    useStudioStore.setState({saveStatus:'unsaved'});
    const fetch=stream();vi.spyOn(api,'post').mockRejectedValue(new Error('save offline'));vi.spyOn(console,'warn').mockImplementation(()=>{});
    await useStudioStore.getState().sendMessageToAgent('altere de ITENS para PRODUTOS');
    expect(fetch).not.toHaveBeenCalled();expect(useStudioStore.getState().pages[0].documentPage!.elements[0].text).toBe('ITENS DE');
  });
});
