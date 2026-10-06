import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';
import { pdfGeometryFromElement } from '../utils/pageGeometry';

class PDFExportError extends Error {}
function assertCaptureBudget(width: number, height: number, scale: number) {
  const pixelWidth = Math.ceil(width * scale);
  const pixelHeight = Math.ceil(height * scale);
  if (![pixelWidth, pixelHeight].every(value => Number.isFinite(value) && value > 0)
    || Math.max(pixelWidth, pixelHeight) > 32767 || pixelWidth * pixelHeight > 16_000_000) {
    throw new PDFExportError('Esta página excede o limite seguro de exportação nesta resolução. Use uma resolução menor.');
  }
}

async function waitForSourceAssets(container: HTMLElement) {
  const deadline = Date.now() + 15000;
  while (container.querySelector('[data-document-asset-state="pending"]')) {
    if (Date.now() > deadline) throw new PDFExportError('As páginas originais ainda não carregaram. Tente exportar novamente.');
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  if (container.querySelector('[data-document-asset-state="error"]')) {
    throw new PDFExportError('Uma página original não está disponível. A exportação foi interrompida.');
  }
}

export interface PDFExportOptions {
  fileName?: string;
  quality?: number;
  scale?: number;
  dpi?: number;
  compress?: boolean;
  pageIds?: string[];
  onProgress?: (progress: number, stage?: string) => void;
}

class PDFExportService {
  async generatePDF(containerId: string, options: PDFExportOptions = {}): Promise<void> {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`Container with id ${containerId} not found`);
      throw new Error('Elemento não encontrado para exportação');
    }

    const allPageElements = Array.from(container.getElementsByClassName('pdf-page-content')) as HTMLElement[];
    if (allPageElements.length === 0) {
      throw new Error('Nenhuma página encontrada para gerar o PDF');
    }

    const {
      fileName = 'catalogo.pdf',
      quality = 0.98,
      dpi = 300,
      compress = true,
      pageIds = [],
      onProgress,
    } = options;

    try {
      if (onProgress) {
        onProgress(5, 'Carregando tipografias e ativos editoriais...');
      }

      // Garante que as webfonts terminaram de carregar antes da captura
      await document.fonts.ready;
      await waitForSourceAssets(container);

      // Pre-carrega todas as imagens no container com timeout de protecao
      const allImages = Array.from(container.getElementsByTagName('img'));
      await Promise.all(
        allImages.map((img) => {
          if (img.complete && img.naturalHeight !== 0) return Promise.resolve(true);
          return new Promise((resolve) => {
            const handleDone = () => resolve(true);
            img.addEventListener('load', handleDone, { once: true });
            img.addEventListener('error', handleDone, { once: true });
            setTimeout(handleDone, 4000);
          });
        })
      );

      // Filtra páginas selecionadas
      let pageElements = allPageElements;
      if (pageIds.length > 0) {
        pageElements = allPageElements.filter((el) => {
          const pageId = el.getAttribute('data-page-id');
          return pageId && pageIds.includes(pageId);
        });

        if (pageElements.length === 0) {
          throw new Error('Nenhuma página selecionada encontrada');
        }
      }

      const firstGeometry = pdfGeometryFromElement(pageElements[0]);
      const pdf = new jsPDF({orientation: firstGeometry.pdfWidthMm > firstGeometry.pdfHeightMm ? 'landscape' : 'portrait',
        unit: 'mm', format: [firstGeometry.pdfWidthMm, firstGeometry.pdfHeightMm], compress});
      const totalPages = pageElements.length;

      for (let i = 0; i < totalPages; i++) {
        const pageElement = pageElements[i];
        const geometry = pdfGeometryFromElement(pageElement);
        const pdfWidth = geometry.pdfWidthMm;
        const pdfHeight = geometry.pdfHeightMm;
        const targetPixelWidth = (pdfWidth / 25.4) * dpi;

        if (onProgress) {
          const progress = Math.round(10 + (i / totalPages) * 80);
          onProgress(progress, `Renderizando lâmina ${i + 1} de ${totalPages} em alta resolução (${dpi} DPI)...`);
        }

        if (i > 0) {
          pdf.addPage([pdfWidth, pdfHeight], pdfWidth > pdfHeight ? 'landscape' : 'portrait');
        }

        const currentWidth = pageElement.offsetWidth || 490;
        const computedScale = Math.max(2, targetPixelWidth / currentWidth);
        const currentHeight = pageElement.offsetHeight || currentWidth * geometry.height / geometry.width;
        assertCaptureBudget(currentWidth, currentHeight, computedScale);

        const canvas = await html2canvas(pageElement, {
          scale: computedScale,
          useCORS: true,
          logging: false,
          allowTaint: true,
          backgroundColor: '#ffffff',
          imageTimeout: 15000,
          onclone: (clonedDoc) => {
            const images = clonedDoc.getElementsByTagName('img');
            for (let j = 0; j < images.length; j++) {
              images[j].crossOrigin = 'Anonymous';
            }
          },
        });

        const imgData = canvas.toDataURL('image/jpeg', quality);

        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');

        // Limpeza de memoria no canvas
        canvas.width = 0;
        canvas.height = 0;
        canvas.remove();
      }

      if (onProgress) {
        onProgress(95, 'Finalizando compressão e salvando documento...');
      }

      pdf.save(fileName);

      if (onProgress) {
        onProgress(100, 'Download concluído com sucesso!');
      }
    } catch (error) {
      if (error instanceof PDFExportError) throw error;
      console.error('Error generating PDF:', error);
      throw new Error('Falha ao gerar o PDF em alta resolução. Tente novamente.');
    }
  }

  // Gera snapshot de imagem PNG de alta resolução de um elemento DOM
  async generatePNG(element: HTMLElement, scale: number = 3): Promise<string> {
    await document.fonts.ready;
    await waitForSourceAssets(element);
    const geometry = pdfGeometryFromElement(element);
    const width = element.offsetWidth || geometry.width;
    const height = element.offsetHeight || geometry.height;
    assertCaptureBudget(width, height, scale);
    const canvas = await html2canvas(element, {
      scale,
      useCORS: true,
      logging: false,
      allowTaint: true,
      backgroundColor: null,
      imageTimeout: 15000,
      onclone: (clonedDoc) => {
        const images = clonedDoc.getElementsByTagName('img');
        for (let j = 0; j < images.length; j++) {
          images[j].crossOrigin = 'Anonymous';
        }
      },
    });

    const dataUrl = canvas.toDataURL('image/png');
    canvas.width = 0;
    canvas.height = 0;
    canvas.remove();
    return dataUrl;
  }
}

export const pdfExportService = new PDFExportService();
