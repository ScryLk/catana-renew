import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import html2canvas from 'html2canvas-pro';
import {pdfExportService} from './pdfExportService';

const captured = vi.hoisted(() => ({output: ''}));
vi.mock('jspdf', async importOriginal => {
  const actual = await importOriginal<typeof import('jspdf')>();
  return {...actual, default: class {
    constructor(options: ConstructorParameters<typeof actual.jsPDF>[0]) {
      const pdf = new actual.jsPDF(options);
      pdf.save = () => {captured.output = pdf.output(); return pdf;};
      return pdf;
    }
  }};
});
vi.mock('html2canvas-pro', () => ({default: vi.fn()}));

describe('imported document PDF export', () => {
  beforeEach(() => {
    captured.output = '';
    vi.mocked(html2canvas).mockClear();
    Object.defineProperty(document, 'fonts', {configurable: true, value: {ready: Promise.resolve()}});
    vi.mocked(html2canvas).mockImplementation(async () => ({
      width: 1, height: 1, remove: vi.fn(),
      toDataURL: () => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4//8/AAX+Av4N70a4AAAAAElFTkSuQmCC',
    }) as unknown as HTMLCanvasElement);
  });
  afterEach(() => {document.body.replaceChildren(); vi.restoreAllMocks();});

  it('serializes mixed physical source sizes and seven actual pages, without an eighth blank', async () => {
    const sizes = [[612, 792], [400, 400], [792, 612], [300, 900], [900, 300], [595.276, 841.89], [612, 792]];
    const container = document.createElement('div'); container.id = 'source-export';
    for (const [width, height] of sizes) {
      const page = document.createElement('div'); page.className = 'pdf-page-content';
      page.dataset.sourceWidth = String(width); page.dataset.sourceHeight = String(height); page.dataset.sourceUnit = 'pt';
      container.append(page);
    }
    document.body.append(container);
    await pdfExportService.generatePDF(container.id, {dpi: 72});
    const boxes = [...captured.output.matchAll(/\/MediaBox \[([^\]]+)\]/g)].map(match => match[1].trim().split(/\s+/).map(Number));
    expect(boxes).toHaveLength(7);
    boxes.forEach((box, index) => {
      expect(box.slice(0, 2)).toEqual([0, 0]);
      expect(box[2]).toBeCloseTo(sizes[index][0], 3);
      expect(box[3]).toBeCloseTo(sizes[index][1], 3);
    });
  });

  it('refuses a PDF whose private source image failed to load', async () => {
    const container = document.createElement('div'); container.id = 'source-export';
    container.innerHTML = '<div class="pdf-page-content"><div data-document-asset-state="error"></div></div>';
    document.body.append(container);
    await expect(pdfExportService.generatePDF(container.id)).rejects.toThrow();
    expect(html2canvas).not.toHaveBeenCalled();
    expect(captured.output).toBe('');
  });

  it('rejects an accepted large source page before allocating an unsafe export canvas', async () => {
    const container = document.createElement('div'); container.id = 'source-export';
    container.innerHTML = '<div class="pdf-page-content" data-source-width="14400" data-source-height="14400" data-source-unit="pt"></div>';
    document.body.append(container);
    await expect(pdfExportService.generatePDF(container.id, {dpi: 300})).rejects.toThrow('limite seguro de exportação');
    expect(html2canvas).not.toHaveBeenCalled();
    expect(captured.output).toBe('');
    await expect(pdfExportService.generatePNG(container.firstElementChild as HTMLElement)).rejects.toThrow('limite seguro de exportação');
    expect(html2canvas).not.toHaveBeenCalled();
  });
});
