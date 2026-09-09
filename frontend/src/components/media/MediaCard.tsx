import { useState } from 'react';
import type { FC } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Heart,

  Download,
  Trash2,
  FolderInput,
  FileText,
  Film,
  FileImage,
} from 'lucide-react';
import type { Media } from '@/types/api';
import { cn } from '@/lib/utils';

interface MediaCardProps {
  media: Media;
  onToggleFavorite?: (id: number) => void;
  onDelete?: (id: number) => void;
  onMove?: (id: number) => void;
  onClick?: (media: Media) => void;
  onDoubleClick?: (media: Media) => void;
  selected?: boolean;
}

export const MediaCard: FC<MediaCardProps> = ({
  media,
  onToggleFavorite,
  onDelete,
  onMove,
  onClick,
  onDoubleClick,
  selected = false,
}) => {
  const [showActions, setShowActions] = useState(false);
  const [imageError, setImageError] = useState(false);

  const getMediaIcon = () => {
    switch (media.media_type) {
      case 'image':
        return FileImage;
      case 'video':
        return Film;
      case 'document':
        return FileText;
      default:
        return FileText;
    }
  };

  const MediaIcon = getMediaIcon();

  const handleDownload = async () => {
    try {
      const response = await fetch(media.file);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = media.name || `download-${media.id}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      // Fallback
      window.open(media.file, '_blank');
    }
  };

  const handleImageError = () => {
    console.error('Erro ao carregar imagem:', media.file);
    setImageError(true);
  };

  return (
    <Card
      className={cn(
        'group relative overflow-hidden cursor-pointer transition-all hover:shadow-lg hover:border-primary/50',
        selected && 'ring-2 ring-primary border-primary'
      )}
      onClick={() => onClick?.(media)}
      onDoubleClick={() => onDoubleClick?.(media)}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Thumbnail */}
      <div className="aspect-square bg-muted relative overflow-hidden">
        {media.media_type === 'image' && !imageError ? (
          <img
            src={media.file}
            alt={media.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={handleImageError}
            crossOrigin="anonymous"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
            <MediaIcon className="h-16 w-16 text-muted-foreground/30" />
            {imageError && (
              <div className="absolute bottom-2 left-0 right-0 text-center">
                <p className="text-xs text-muted-foreground">Erro ao carregar</p>
              </div>
            )}
          </div>
        )}

        {/* Overlay com ações */}
        {showActions && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center gap-2 transition-opacity">
            <Button
              size="sm"
              variant="ghost"
              className="text-white hover:bg-white/20"
              onClick={(e) => {
                e.stopPropagation();
                handleDownload();
              }}
            >
              <Download className="h-4 w-4" />
            </Button>

            {onMove && (
              <Button
                size="sm"
                variant="ghost"
                className="text-white hover:bg-white/20"
                onClick={(e) => {
                  e.stopPropagation();
                  onMove(media.id);
                }}
              >
                <FolderInput className="h-4 w-4" />
              </Button>
            )}

            {onDelete && (
              <Button
                size="sm"
                variant="ghost"
                className="text-white hover:bg-destructive/80"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(media.id);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}

        {/* Badge de tipo */}
        <div className="absolute top-2 left-2">
          <Badge variant="secondary" className="text-xs capitalize bg-card/90 backdrop-blur-sm">
            {media.media_type}
          </Badge>
        </div>

        {/* Botão de favorito */}
        {onToggleFavorite && (
          <Button
            size="sm"
            variant="ghost"
            className={cn(
              'absolute top-2 right-2 p-1 h-8 w-8',
              media.is_favorite ? 'text-red-500' : 'text-white hover:text-red-500'
            )}
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(media.id);
            }}
          >
            <Heart className={cn('h-4 w-4', media.is_favorite && 'fill-current')} />
          </Button>
        )}
      </div>

      {/* Informações */}
      <CardContent className="p-3">
        <h3 className="font-medium text-sm text-foreground truncate mb-1">{media.name}</h3>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{media.file_size_formatted}</span>
          {media.width && media.height && (
            <span>
              {media.width} × {media.height}
            </span>
          )}
        </div>

        {/* Tags */}
        {media.tags && media.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {media.tags.slice(0, 2).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
            {media.tags.length > 2 && (
              <Badge variant="outline" className="text-xs">
                +{media.tags.length - 2}
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
