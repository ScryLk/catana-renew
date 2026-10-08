import { afterEach, expect, it, vi } from 'vitest';
import { fitDocumentText } from './documentTextFit';

afterEach(() => vi.restoreAllMocks());

it('checks painted descenders even when CSS line height fits the source rectangle', () => {
  const context = {font:'',measureText(text:string) {
    const size=Number(this.font.split(' ')[1].replace('px',''));
    return {width:text.length*size*.5,fontBoundingBoxAscent:size*.9,fontBoundingBoxDescent:size*.3,
      actualBoundingBoxAscent:size*.7,actualBoundingBoxDescent:size*.4};
  }};
  vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
  const fit=fitDocumentText('glyph', 'Inter', 18, 200, 20, 700);
  expect(fit.size).toBeLessThan(18);
  expect(fit.overflow).toBe(false);
  expect(fitDocumentText('glyph','Inter',18,200,8,700).overflow).toBe(true);
});

it('does not reject capitals just because the font reserves unused descender space', () => {
  const context={font:'',measureText(text:string) {return {width:text.length*7,
    fontBoundingBoxAscent:17,fontBoundingBoxDescent:5,actualBoundingBoxAscent:13,actualBoundingBoxDescent:0};}};
  vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
  expect(fitDocumentText('TITLE','Inter',18,200,18,700)).toEqual({size:18,overflow:false});
});
