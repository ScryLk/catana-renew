import { logger } from '../utils/logger';
import { removeBackground } from '@imgly/background-removal';

class ImageProcessingService {
  private isModelLoaded = false;

  /**
   * Remove o fundo de uma imagem
   * @param imageUrl URL da imagem original
   * @returns URL (blob) da imagem sem fundo
   */
  async removeBackground(imageUrl: string): Promise<string> {
    try {
      logger.debug('[ImageProcessingService] Iniciando remoção de fundo para:', imageUrl);

      // Configuração opcional pode ser passada aqui
      const config = {
        progress: (key: string, current: number, total: number) => {
          logger.debug(`[ImageProcessingService] Progresso (${key}): ${current}/${total}`);
        },
        debug: true
      };

      const blob = await removeBackground(imageUrl, config);
      const processedUrl = URL.createObjectURL(blob);

      this.isModelLoaded = true;
      logger.debug('[ImageProcessingService] Fundo removido com sucesso:', processedUrl);

      return processedUrl;
    } catch (error) {
      console.error('[ImageProcessingService] Erro ao remover fundo:', error);
      throw new Error('Falha ao remover o fundo da imagem.');
    }
  }

  /**
   * Verifica se o modelo já foi carregado (para UI feedback)
   */
  isReady(): boolean {
    return this.isModelLoaded;
  }
}

export const imageProcessingService = new ImageProcessingService();
