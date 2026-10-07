import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStudioStore } from './studioStore';
import api from '../services/api';
import { executionFeedback } from '../utils/textCommandExecution';
import type { CatalogPageData } from '../data/editorialCatalog.mock';

const sources=()=>Array.from({length:8},(_,i)=>({id:`import-page-${i+1}`,pageNumber:i+1,type:'hero',pageOrigin:'imported_source',sourcePageNumber:i+1,products:[],backgroundColor:'#fff',textColor:'#000',accentColor:'#000'} as CatalogPageData));
beforeEach(()=>{vi.useFakeTimers();useStudioStore.getState().resetStudioState();useStudioStore.setState({historyStack:[],redoStack:[],canUndo:false,canRedo:false});});
afterEach(()=>{vi.clearAllTimers();vi.useRealTimers();vi.restoreAllMocks();});

describe('mixed catalog structural action execution',()=>{
  it('adds closing page with one history snapshot, persists nine pages, undo and redo',async()=>{
    const original=sources();
    const post=vi.spyOn(api,'post').mockResolvedValue({data:{}});
    useStudioStore.setState({pages:original,totalPages:8,currentSpread:[7,8],activeCatalogId:'1'});
    const result=useStudioStore.getState().applySpreadPatch({actions:[{action:'add_page',target:'catalog:pages',params:{afterPage:8,type:'backcover',contentRole:'closing',pageId:'closing-page',title:'Obrigado por conhecer nossas soluções.',pageColors:{backgroundColor:'#003366',accentColor:'#FFFF00'}}}]});
    let state=useStudioStore.getState();
    expect(result[0].status).toBe('applied');
    expect(executionFeedback(result)).toBe('Página de finalização adicionada após a página 8.');
    expect(state.pages).toHaveLength(9);
    expect(state.pages.slice(0,8).map(p=>p.id)).toEqual(original.map(p=>p.id));
    expect(state.pages[8]).toMatchObject({id:'closing-page',pageOrigin:'catana_authored',contentRole:'closing',type:'backcover',backgroundColor:'#003366'});
    expect(state.historyStack).toHaveLength(1);
    expect(state.currentSpread).toEqual([9,9]);
    await state.flushSaveSpread();
    const body=post.mock.calls.at(-1)![1] as {total_pages:number;spreads:{right_page_elements:unknown[]}[]};
    expect(body.total_pages).toBe(9);
    expect(body.spreads).toHaveLength(5);
    expect(body.spreads[4].right_page_elements).toEqual([]);
    state.undo();
    expect(useStudioStore.getState().totalPages).toBe(8);
    useStudioStore.getState().redo();
    state=useStudioStore.getState();
    expect(state.totalPages).toBe(9);
    expect(state.pages[8].id).toBe('closing-page');
  });

  it('inserts, moves and duplicates without rewriting lineage',()=>{
    useStudioStore.setState({pages:sources(),totalPages:8,currentSpread:[1,2]});
    useStudioStore.getState().applySpreadPatch({actions:[{action:'add_page',target:'catalog:pages',params:{afterPage:3,pageId:'editorial'}}]});
    expect(useStudioStore.getState().pages[4].sourcePageNumber).toBe(4);
    useStudioStore.getState().applySpreadPatch({actions:[{action:'move_page',target:'page:8',params:{afterPage:2}}]});
    expect(useStudioStore.getState().pages[2].sourcePageNumber).toBe(7);
    useStudioStore.getState().applySpreadPatch({actions:[{action:'duplicate_page',target:'page:2',params:{afterPage:9,pageId:'copy'}}]});
    // Actual imported fixtures contain documentPage; lineage metadata must remain stable regardless of sequence.
    expect(useStudioStore.getState().pages.at(-1)?.sourcePageNumber).toBe(2);
    expect(useStudioStore.getState().pages.at(-1)?.id).toBe('copy');
    expect(useStudioStore.getState().pages.at(-1)?.pageOrigin).toBe('derived_from_import');
  });

  it('rejects unknown actions and stale catalog proposals before mutation',()=>{
    useStudioStore.setState({pages:sources(),totalPages:8});
    expect(useStudioStore.getState().applySpreadPatch({actions:[{action:'destroy_entire_database',target:'global',params:{}}]})[0].status).toBe('unsupported');
    expect(useStudioStore.getState().applySpreadPatch({actions:[{action:'__proto__',target:'global',params:{}}]})[0].status).toBe('unsupported');
    expect(useStudioStore.getState().applySpreadPatch({expectedPageIds:['foreign'],actions:[{action:'add_page',target:'catalog:pages',params:{}}]})[0].status).toBe('invalid_target');
    expect(useStudioStore.getState().pages).toHaveLength(8);
    expect(useStudioStore.getState().historyStack).toHaveLength(0);
  });
});
