import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';

export interface PDFExportOptions {
  fileName?: string;
  quality?: number;
  scale?: number;
  compress?: boolean;
  pageIds?: string[]; // Export only specific pages
  onProgress?: (progress: number, stage?: string) => void; // Progress callback
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
      if (onProgress) {
        onProgress(5, 'Carregando tipografias e recursos...');
      }

      // Garante que as webfonts terminaram de carregar ANTES do snapshot
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
          const progress = Math.round(5 + ((i) / totalPages) * 85);
          onProgress(progress, `Renderizando lâmina ${i + 1} de ${totalPages}...`);
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

      if (onProgress) {
        onProgress(95, 'Finalizando compressão e salvando arquivo...');
      }

      // Salvar PDF final
      pdf.save(fileName);

      // Report 100% completion
      if (onProgress) {
        onProgress(100, 'Download concluído!');
      }

    } catch (error) {
      console.error('Error generating PDF:', error);
      throw new Error('Falha ao gerar o PDF. Tente novamente.');
    }
  }

  // Gera snapshot de imagem PNG de alta resolução de um elemento DOM
  async generatePNG(element: HTMLElement, scale: number = 2): Promise<string> {
    await document.fonts.ready;
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
      }
    });

    const dataUrl = canvas.toDataURL('image/png');
    canvas.remove();
    return dataUrl;
  }
}

export const pdfExportService = new PDFExportService();
