import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';

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

      // Criar documento PDF no padrao A4 (210 x 297 mm)
      const pdf = new jsPDF('p', 'mm', 'a4', compress);
      const pdfWidth = 210;
      const pdfHeight = 297;
      const totalPages = pageElements.length;

      // Calculo de DPI: A4 tem 8.2677 polegadas de largura
      const targetPixelWidth = (210 / 25.4) * dpi; // 2480.3 px para 300 DPI, 1240.1 px para 150 DPI

      for (let i = 0; i < totalPages; i++) {
        const pageElement = pageElements[i];

        if (onProgress) {
          const progress = Math.round(10 + (i / totalPages) * 80);
          onProgress(progress, `Renderizando lâmina ${i + 1} de ${totalPages} em alta resolução (${dpi} DPI)...`);
        }

        if (i > 0) {
          pdf.addPage();
        }

        const currentWidth = pageElement.offsetWidth || 490;
        const computedScale = Math.max(2, targetPixelWidth / currentWidth);

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
      console.error('Error generating PDF:', error);
      throw new Error('Falha ao gerar o PDF em alta resolução. Tente novamente.');
    }
  }

  // Gera snapshot de imagem PNG de alta resolução de um elemento DOM
  async generatePNG(element: HTMLElement, scale: number = 3): Promise<string> {
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
