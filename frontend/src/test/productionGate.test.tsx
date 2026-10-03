import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import { normalizeCatalogDocument, validateGenerativeBlock, type CatalogPageData, type ProductItem } from '../data/editorialCatalog.mock';
import { GenerativePageRenderer } from '../components/studio/GenerativePageRenderer';
import { GenerativeBlockRenderer } from '../components/studio/GenerativeBlockRenderer';
import { EditorialPageSnapshot } from '../components/studio/EditorialPageSnapshot';
import { SafeImage } from '../components/studio/SafeImage';
import { adjustSuppliedPrice, manualProduct } from '../utils/commercialProduct';
import { ALL_VERIFIED_FONTS, resolveSafeFontFamily } from '../utils/fontRegistry';
import { useStudioStore } from '../store/studioStore';

const product: ProductItem = {id:'p1', name:null, category:'', index:'01', price:null, sku:null, image:null, description:null, quantity:'5'};
const block = {id:'b1', type:'price' as const, productId:'p1', content:undefined, x:.1,y:.1,width:.3,height:.1};
const page: CatalogPageData = {id:'page',pageNumber:1,type:'single',renderMode:'generative',products:[product],blocks:[block],backgroundColor:'#FFFFFF',textColor:'#000000',accentColor:'#000000'};

describe('production boundaries', () => {
  it('omits absent commercial values and images without null/undefined text', () => {
    const html = renderToStaticMarkup(<GenerativePageRenderer page={page}/>);
    expect(html).not.toContain('R$ 0,00');
    expect(html).not.toContain('null');
    expect(html).not.toContain('undefined');
    expect(html).not.toContain('<img');
    expect(renderToStaticMarkup(<SafeImage src={null}/>)).toBe('');
    expect(renderToStaticMarkup(<SafeImage src=""/>)).toBe('');
  });
  it('refuses fabricated price content and resolves genuine product data', () => {
    expect(normalizeCatalogDocument({pages:[{...page,blocks:[{...block,content:'R$ 900'}]}]}).qualityGate?.publishable).toBe(false);
    expect(renderToStaticMarkup(<GenerativeBlockRenderer page={{...page,products:[{...product,price:'R$ 9'}]}} block={block}/>)).toContain('R$ 9');
  });
  it('blocks percentage adjustment without a supplied price; parses cents correctly', () => {
    expect(adjustSuppliedPrice(null,10)).toBeNull();
    expect(adjustSuppliedPrice(undefined,10)).toBeNull();
    expect(adjustSuppliedPrice('invalid',10)).toBeNull();
    expect(adjustSuppliedPrice('R$ 1.234,50',10)).toBe('R$ 1.357,95');
    expect(adjustSuppliedPrice('R$ 0,00',10)).toBe('R$ 0,00'); // explicitly provided zero
  });
  it('manual drawer products contain no commercial defaults', () => {
    const result=manualProduct({name:'Provided'});
    for (const field of ['price','sku','image','description','tag'] as const) expect(result[field]).toBeNull();
  });
  it('rejects malformed and malicious blocks at normalization, store and final renderer', () => {
    for (const changes of [{x:NaN},{height:Infinity},{width:4},{imageUrl:'javascript:alert(1)'},{nested:{onError:'evil'}},{nested:{rawHtml:'evil'}},{imageUrl:'data:image/svg+xml;base64,abc'}]) {
      const raw={...block,type:'image' as const,...changes};
      expect(validateGenerativeBlock(raw)).toBeNull();
      const normalized=normalizeCatalogDocument({pages:[{...page,blocks:[raw]}]});
      expect(normalized.pages[0].blocks).toEqual([]);
      useStudioStore.getState().setPages([{...page,blocks:[raw]}]);
      expect(useStudioStore.getState().pages[0].blocks).toEqual([]);
      expect(renderToStaticMarkup(<GenerativeBlockRenderer block={raw} page={page}/>)).toBe('');
    }
  });
  it('legacy never renders root generative blocks and normalizes old drafts', () => {
    const legacy={...page,renderMode:'legacy' as const,blocks:[{...block,type:'text' as const,content:'GHOST'}]};
    expect(normalizeCatalogDocument({pages:[legacy]}).pages[0].blocks).toEqual([]);
    expect(renderToStaticMarkup(<GenerativePageRenderer page={legacy}/>)).not.toContain('GHOST');
    expect(renderToStaticMarkup(<EditorialPageSnapshot page={legacy}/>)).not.toContain('GHOST');
    expect(normalizeCatalogDocument({pages:[{...legacy,generativeDraft:[block] as any}]}).pages[0].generativeDraft?.blocks).toEqual([block]);
  });
  it('retains rejection after storing pages and reopening, and rejects inconsistent quality metadata', () => {
    const normalized=normalizeCatalogDocument({pages:[{...page,blocks:[{...block,content:'Fabrication'}]}]});
    expect(normalized.pages[0].qualityGate?.publishable).toBe(false);
    expect(normalizeCatalogDocument({pages:normalized.pages}).qualityGate?.publishable).toBe(false);
    expect(normalizeCatalogDocument({pages:[page],qualityGate:{passed:false,publishable:true,status:'passed',reasons:[]}}).qualityGate?.publishable).toBe(false);
  });
  it('blocks publication of an explicitly failed document without affecting legacy documents', () => {
    useStudioStore.setState({qualityGate:{passed:false,publishable:false,status:'blocked',reasons:['TEST_FAILURE']}, isExportModalOpen:false});
    useStudioStore.getState().openExportModal();
    expect(useStudioStore.getState().isExportModalOpen).toBe(false);
    useStudioStore.setState({qualityGate:undefined});
    useStudioStore.getState().openExportModal();
    expect(useStudioStore.getState().isExportModalOpen).toBe(true);
    useStudioStore.setState({isExportModalOpen:false});
  });
  it('generative renderer excludes legacy content and verifies fonts' , () => {
    const generated={...page,title:'LEGACY_TITLE',blocks:[{...block,type:'text' as const,productId:undefined,content:'GENERATIVE_TEXT'}]};
    const html=renderToStaticMarkup(<GenerativePageRenderer page={generated}/>);
    expect(html).toContain('GENERATIVE_TEXT');
    expect(html).not.toContain('LEGACY_TITLE');
    expect(ALL_VERIFIED_FONTS).toHaveLength(17);
    expect(resolveSafeFontFamily('Invalid','body')).toContain('Inter');
  });
});
