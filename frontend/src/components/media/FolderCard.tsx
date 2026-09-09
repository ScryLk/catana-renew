import type { FC } from 'react';
import { Folder } from 'lucide-react';
import type { MediaFolder } from '@/types/api';
import { cn } from '@/lib/utils';

interface FolderCardProps {
  folder: MediaFolder;
  onOpen: (folderId: number) => void;
  onRename?: (folderId: number) => void;
  onDelete?: (folderId: number) => void;
}

export const FolderCard: FC<FolderCardProps> = ({
  folder,
  onOpen,
}) => {
  const handleCardClick = () => {
    onOpen(folder.id);
  };

  return (
    <div
      onClick={handleCardClick}
      className={cn(
        'group relative bg-card border rounded-xl p-4',
        'hover:shadow-md hover:border-primary/50 transition-all cursor-pointer',
        'flex flex-col items-center gap-3'
      )}
    >
      {/* Ícone da pasta */}
      <div className="w-full aspect-square bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg flex items-center justify-center">
        <Folder className="h-16 w-16 text-primary" />
      </div>

      {/* Nome da pasta */}
      <div className="w-full">
        <p className="text-sm font-medium text-foreground truncate text-center">
          {folder.name}
        </p>
      </div>
    </div>
  );
};
