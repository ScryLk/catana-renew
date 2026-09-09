import { logger } from '../utils/logger';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';

export interface PDFExportOptions {
  fileName?: string;
  quality?: number;
  scale?: number;
  compress?: boolean;
  pageIds?: string[]; // Export only specific pages
  onProgress?: (progress: number) => void; // Progress callback
}

class PDFExportService {
  async generatePDF(containerId: string, options: PDFExportOptions = {}): Promise<void> {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`Container with id ${containerId} not found`);
      throw new Error('Elemento não encontrado para exportação');
    }

    // Encontrar todas as páginas individuais dentro do container
    const allPageElements = Array.from(container.getElementsByClassName('pdf-page-content')) as HTMLElement[];
    if (allPageElements.length === 0) {
      throw new Error('Nenhuma página encontrada para gerar o PDF');
    }

    const {
      fileName = 'catalogo.pdf',
      quality = 1.0,
      scale = 2,
      compress = true,
      pageIds = [],
      onProgress
    } = options;

    try {
      // Garante que as webfonts terminaram de carregar ANTES do snapshot —
      // sem isso o html2canvas pode rasterizar o fallback do sistema no PDF.
      await document.fonts.ready;

      // Filter pages if pageIds is specified
      let pageElements = allPageElements;
      if (pageIds.length > 0) {
        pageElements = allPageElements.filter(el => {
          const pageId = el.getAttribute('data-page-id');
          return pageId && pageIds.includes(pageId);
        });

        if (pageElements.length === 0) {
          throw new Error('Nenhuma página selecionada encontrada');
        }
      }

      // Criar PDF (A4 vertical, medidas em mm)
      const pdf = new jsPDF('p', 'mm', 'a4', compress);
      const pdfWidth = 210;
      const pdfHeight = 297;

      const totalPages = pageElements.length;

      for (let i = 0; i < totalPages; i++) {
        const pageElement = pageElements[i];

        // Report progress
        if (onProgress) {
          const progress = Math.round(((i + 1) / totalPages) * 100);
          onProgress(progress);
        }

        // Adicionar nova página no PDF (exceto para a primeira)
        if (i > 0) {
          pdf.addPage();
        }

        // Gerar canvas da página específica
        const canvas = await html2canvas(pageElement, {
          scale: scale,
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
          }
        });

        const imgData = canvas.toDataURL('image/jpeg', quality);

        // Adicionar imagem preenchendo a página A4
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);

        // Liberar memória
        canvas.remove();
      }

      // Salvar PDF final
      pdf.save(fileName);

      // Report 100% completion
      if (onProgress) {
        onProgress(100);
      }

    } catch (error) {
      console.error('Error generating PDF:', error);
      throw new Error('Falha ao gerar o PDF. Tente novamente.');
    }
  }

  // Helper to export specific pages (future implementation)
  async generateMultiPagePDF(pageIds: string[], options: PDFExportOptions = {}): Promise<void> {
    // TODO: Implement logic to render each page individually and add to PDF
    logger.debug('Multi-page export not yet implemented', pageIds, options);
  }
}

export const pdfExportService = new PDFExportService();
