import { useState, useEffect } from 'react';
import type { FC } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Upload as UploadIcon, Loader2, Image as ImageIcon } from 'lucide-react';
import { mediaService, type MediaFilters } from '@/services/mediaService';
import { MediaUpload } from './MediaUpload';
import type { Media, MediaType } from '@/types/api';
import { cn } from '@/lib/utils';

interface MediaPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (media: Media) => void;
  mediaType?: MediaType;
  title?: string;
}

export const MediaPicker: FC<MediaPickerProps> = ({
  open,
  onClose,
  onSelect,
  mediaType = 'image',
  title = 'Selecionar Imagem',
}) => {
  const [media, setMedia] = useState<Media[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [activeTab, setActiveTab] = useState<'library' | 'upload'>('library');

  useEffect(() => {
    if (open) {
      loadMedia();
    }
  }, [open, searchTerm, mediaType]);

  const loadMedia = async () => {
    try {
      setIsLoading(true);
      const filters: MediaFilters = {
        media_type: mediaType,
      };

      if (searchTerm) {
        filters.search = searchTerm;
      }

      const data = await mediaService.getMedia(filters);
      setMedia(data);
    } catch (error) {
      console.error('Erro ao carregar mídia:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelect = () => {
    if (selectedMedia) {
      onSelect(selectedMedia);
      setSelectedMedia(null);
      onClose();
    }
  };

  const handleUploadComplete = () => {
    loadMedia();
    setActiveTab('library');
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'library' | 'upload')} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="library">Biblioteca</TabsTrigger>
            <TabsTrigger value="upload">Upload</TabsTrigger>
          </TabsList>

          {/* Tab: Biblioteca */}
          <TabsContent value="library" className="flex-1 flex flex-col overflow-hidden mt-4">
            {/* Busca */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar arquivos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Grid de mídia */}
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : media.length === 0 ? (
                <div className="text-center py-20">
                  <div className="bg-muted rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                    <ImageIcon className="h-10 w-10 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    Nenhuma imagem encontrada
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    {searchTerm ? 'Tente buscar por outro termo' : 'Faça upload de imagens para começar'}
                  </p>
                  <Button onClick={() => setActiveTab('upload')} className="gap-2">
                    <UploadIcon className="h-4 w-4" />
                    Fazer Upload
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                  {media.map((item) => (
                    <div
                      key={item.id}
                      className={cn(
                        'relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all hover:scale-105',
                        selectedMedia?.id === item.id
                          ? 'border-primary ring-2 ring-primary'
                          : 'border-transparent hover:border-primary/50'
                      )}
                      onClick={() => setSelectedMedia(item)}
                    >
                      {item.media_type === 'image' ? (
                        <img
                          src={item.file_url}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-muted">
                          <ImageIcon className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}

                      {/* Overlay de seleção */}
                      {selectedMedia?.id === item.id && (
                        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                          <div className="bg-primary text-primary-foreground rounded-full p-2">
                            <svg
                              className="h-6 w-6"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          </div>
                        </div>
                      )}

                      {/* Badge de tipo */}
                      <div className="absolute top-1 left-1">
                        <Badge variant="secondary" className="text-xs capitalize">
                          {item.media_type}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Informações do selecionado */}
            {selectedMedia && (
              <div className="mt-4 p-3 bg-muted rounded-lg">
                <p className="text-sm font-medium truncate">{selectedMedia.name}</p>
                <p className="text-xs text-muted-foreground">
                  {selectedMedia.file_size_formatted}
                  {selectedMedia.width && selectedMedia.height && (
                    <> • {selectedMedia.width} × {selectedMedia.height}</>
                  )}
                </p>
              </div>
            )}

            {/* Botões de ação */}
            <div className="flex gap-2 mt-4 pt-4 border-t">
              <Button variant="outline" onClick={onClose} className="flex-1">
                Cancelar
              </Button>
              <Button
                onClick={handleSelect}
                disabled={!selectedMedia}
                className="flex-1"
              >
                Selecionar
              </Button>
            </div>
          </TabsContent>

          {/* Tab: Upload */}
          <TabsContent value="upload" className="flex-1 overflow-y-auto mt-4">
            <MediaUpload onUploadComplete={handleUploadComplete} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
