import type { FC } from 'react';
import { ChevronRight, Home } from 'lucide-react';
import type { MediaFolder } from '@/types/api';

interface FolderBreadcrumbsProps {
    currentFolder: MediaFolder | null;
    folderPath: MediaFolder[];
    onNavigate: (folderId: number | null) => void;
}

export const FolderBreadcrumbs: FC<FolderBreadcrumbsProps> = ({
    currentFolder,
    folderPath,
    onNavigate,
}) => {
    return (
        <div className="flex items-center gap-1 text-sm text-muted-foreground mb-6 overflow-x-auto pb-2">
            <button
                onClick={() => onNavigate(null)}
                className="flex items-center hover:text-foreground transition-colors"
            >
                <Home className="h-4 w-4 mr-1" />
                <span className="font-medium">Início</span>
            </button>

            {folderPath.map((folder) => (
                <div key={folder.id} className="flex items-center gap-1 whitespace-nowrap">
                    <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                    <button
                        onClick={() => onNavigate(folder.id)}
                        className="hover:text-foreground transition-colors font-medium"
                    >
                        {folder.name}
                    </button>
                </div>
            ))}

            {currentFolder && (
                <div className="flex items-center gap-1 whitespace-nowrap">
                    <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                    <span className="font-semibold text-foreground">{currentFolder.name}</span>
                </div>
            )}
        </div>
    );
};
