import { useState, useEffect } from 'react';
import type { FC } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Search,
  Upload as UploadIcon,
  Grid3x3,
  List,
  Heart,
  FolderPlus,
  Image as ImageIcon,
  Film,
  FileText,
} from 'lucide-react';
import { MediaCard } from '@/components/media/MediaCard';
import { MediaUpload } from '@/components/media/MediaUpload';
import { FolderCard } from '@/components/media/FolderCard';
import { FolderBreadcrumbs } from '@/components/media/FolderBreadcrumbs';
import { CreateFolderDialog } from '@/components/media/CreateFolderDialog';
import { MediaPreviewDialog } from '@/components/media/MediaPreviewDialog';
import { mediaService, type MediaFilters } from '@/services/mediaService';
import type { Media, MediaType, MediaStats, MediaFolder } from '@/types/api';
import { cn } from '@/lib/utils';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { LoadingScreen } from '@/components/common/LoadingScreen';

export const MediaLibrary: FC = () => {
  const [media, setMedia] = useState<Media[]>([]);
  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [currentFolder, setCurrentFolder] = useState<MediaFolder | null>(null);
  const [folderPath, setFolderPath] = useState<MediaFolder[]>([]);
  const [stats, setStats] = useState<MediaStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [previewMedia, setPreviewMedia] = useState<Media | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<MediaFilters>({ folder: null });

  // Carregar mídia e estatísticas
  useEffect(() => {
    loadMedia();
    loadFolders();
    loadStats();
  }, [filters]);

  // Listen for organization/sede changes
  useEffect(() => {
    const handleStorageChange = () => {
      // Reload everything when context changes
      loadMedia();
      loadFolders();
      loadStats();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('local-storage-update', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('local-storage-update', handleStorageChange);
    };
  }, []);

  const loadMedia = async () => {
    try {
      setIsLoading(true);
      const data = await mediaService.getMedia(filters);
      setMedia(data);
    } catch (error) {
      console.error('Erro ao carregar mídia:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadFolders = async () => {
    try {
      const allFolders = await mediaService.getFolders();

      // Filter folders for current view (root or current folder)
      const currentFolderId = filters.folder || null;
      const currentViewFolders = allFolders.filter(f => f.parent === currentFolderId);
      setFolders(currentViewFolders);

      // Build breadcrumbs path
      if (currentFolderId) {
        const path: MediaFolder[] = [];
        let folderId: number | null = currentFolderId;
        const visitedIds = new Set<number>(); // Prevent infinite loops

        while (folderId && !visitedIds.has(folderId)) {
          visitedIds.add(folderId);
          const folder = allFolders.find(f => f.id === folderId);
          if (folder) {
            path.unshift(folder);
            folderId = folder.parent;
          } else {
            break;
          }
        }

        // The last item in path is the current folder
        if (path.length > 0) {
          const current = path.pop();
          setFolderPath(path);
          setCurrentFolder(current || null);
        }
      } else {
        setFolderPath([]);
        setCurrentFolder(null);
      }
    } catch (error) {
      console.error('Erro ao carregar pastas:', error);
    }
  };

  const loadStats = async () => {
    try {
      const data = await mediaService.getStats(filters.folder);
      setStats(data);
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    }
  };

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    if (value.trim()) {
      // When searching, we might want to search everywhere, but for now keeping current folder context
      // to avoid confusion or complex UI state. 
      // If global search is desired, we would set folder: undefined here.
      setFilters((prev) => ({ ...prev, search: value.trim() }));
    } else {
      const { search, ...rest } = filters;
      setFilters(rest);
    }
  };

  const handleFilterByType = (type?: MediaType | 'folder') => {
    if (type) {
      // @ts-ignore - 'folder' is a UI construct, handling it locally
      setFilters((prev) => ({ ...prev, media_type: type }));
    } else {
      const { media_type, ...rest } = filters;
      setFilters(rest);
    }
  };

  const handleFilterFavorites = () => {
    if (filters.is_favorite) {
      const { is_favorite, ...rest } = filters;
      setFilters(rest);
    } else {
      setFilters((prev) => ({ ...prev, is_favorite: true }));
    }
  };

  const handleToggleFavorite = async (id: number) => {
    try {
      await mediaService.toggleFavorite(id);
      await loadMedia();
      await loadStats();
    } catch (error) {
      console.error('Erro ao marcar favorito:', error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Tem certeza que deseja deletar este arquivo?')) return;

    try {
      await mediaService.deleteMedia(id);
      await loadMedia();
      await loadStats();
    } catch (error) {
      console.error('Erro ao deletar arquivo:', error);
    }
  };

  const handleUploadComplete = () => {
    loadMedia();
    loadStats();
  };

  const handleNavigateToFolder = (folderId: number | null) => {
    setFilters((prev) => ({ ...prev, folder: folderId }));
  };

  const handleCreateFolder = async (name: string) => {
    try {
      await mediaService.createFolder(name, filters.folder);
      await loadFolders();
    } catch (error) {
      console.error('Erro ao criar pasta:', error);
      throw error;
    }
  };

  const handleDeleteFolder = async (folderId: number) => {
    if (!confirm('Tem certeza que deseja deletar esta pasta? Todos os arquivos dentro dela serão movidos para a raiz.')) return;

    try {
      await mediaService.deleteFolder(folderId);
      await loadFolders();
      await loadMedia();
    } catch (error) {
      console.error('Erro ao deletar pasta:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950">
      <Sidebar />
      <Header />

      <main className="ml-16 pt-20">
        <div className="p-6 max-w-[1600px] mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Biblioteca de Mídia</h1>
            <p className="text-muted-foreground">Gerencie suas imagens, vídeos e documentos</p>
          </div>

          {/* Estatísticas */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
              <div className="bg-card rounded-xl p-4 border">
                <p className="text-sm text-muted-foreground mb-1">Total de Arquivos</p>
                <p className="text-2xl font-bold text-foreground">{stats.total_files}</p>
              </div>
              <div className="bg-card rounded-xl p-4 border">
                <p className="text-sm text-muted-foreground mb-1">Espaço Usado</p>
                <p className="text-2xl font-bold text-foreground">{stats.total_size_formatted}</p>
              </div>
              <div className="bg-card rounded-xl p-4 border">
                <p className="text-sm text-muted-foreground mb-1">Pastas</p>
                <p className="text-2xl font-bold text-foreground">{stats.folders_count}</p>
              </div>
              <div className="bg-card rounded-xl p-4 border">
                <p className="text-sm text-muted-foreground mb-1">Imagens</p>
                <p className="text-2xl font-bold text-foreground">{stats.images_count}</p>
              </div>
              <div className="bg-card rounded-xl p-4 border">
                <p className="text-sm text-muted-foreground mb-1">Favoritos</p>
                <p className="text-2xl font-bold text-foreground">{stats.favorites_count}</p>
              </div>
            </div>
          )}

          {/* Barra de ferramentas */}
          <div className="flex flex-wrap gap-4 mb-6">
            {/* Busca */}
            <div className="relative flex-1 min-w-[300px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar arquivos..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10 bg-background"
              />
            </div>

            {/* Botões de ação */}
            <div className="flex gap-2">
              <Button onClick={() => setShowUpload(!showUpload)} className="gap-2">
                <UploadIcon className="h-4 w-4" />
                Upload
              </Button>

              <Button
                variant="outline"
                className="gap-2 bg-background"
                onClick={() => setShowCreateFolder(true)}
              >
                <FolderPlus className="h-4 w-4" />
                Nova Pasta
              </Button>

              {/* View mode toggle */}
              <div className="flex border rounded-lg overflow-hidden bg-background">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className="rounded-none"
                >
                  <Grid3x3 className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="rounded-none"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap gap-2 mb-6">
            <Button
              variant={!filters.media_type ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => handleFilterByType()}
              className={cn(
                "transition-all duration-200",
                !filters.media_type && "bg-white text-black hover:bg-gray-100 font-bold shadow-md scale-105 ring-0 border-none"
              )}
            >
              Todos
            </Button>
            <Button
              // @ts-ignore
              variant={filters.media_type === 'folder' ? 'secondary' : 'outline'}
              size="sm"
              // @ts-ignore
              onClick={() => handleFilterByType('folder')}
              className={cn(
                "gap-2 transition-all duration-200",
                filters.media_type === 'folder' && "bg-white text-black hover:bg-gray-100 font-bold shadow-md scale-105 ring-0 border-none"
              )}
            >
              <FolderPlus className="h-4 w-4" />
              Pastas {stats && `(${stats.folders_count})`}
            </Button>
            <Button
              variant={filters.media_type === 'image' ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => handleFilterByType('image')}
              className={cn(
                "gap-2 transition-all duration-200",
                filters.media_type === 'image' && "bg-white text-black hover:bg-gray-100 font-bold shadow-md scale-105 ring-0 border-none"
              )}
            >
              <ImageIcon className="h-4 w-4" />
              Imagens {stats && `(${stats.images_count})`}
            </Button>
            <Button
              variant={filters.media_type === 'video' ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => handleFilterByType('video')}
              className={cn(
                "gap-2 transition-all duration-200",
                filters.media_type === 'video' && "bg-white text-black hover:bg-gray-100 font-bold shadow-md scale-105 ring-0 border-none"
              )}
            >
              <Film className="h-4 w-4" />
              Vídeos {stats && `(${stats.videos_count})`}
            </Button>
            <Button
              variant={filters.media_type === 'document' ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => handleFilterByType('document')}
              className={cn(
                "gap-2 transition-all duration-200",
                filters.media_type === 'document' && "bg-white text-black hover:bg-gray-100 font-bold shadow-md scale-105 ring-0 border-none"
              )}
            >
              <FileText className="h-4 w-4" />
              Documentos {stats && `(${stats.documents_count})`}
            </Button>
            <Button
              variant={filters.is_favorite ? 'secondary' : 'outline'}
              size="sm"
              onClick={handleFilterFavorites}
              className={cn(
                "gap-2 transition-all duration-200",
                filters.is_favorite && "bg-white text-red-600 hover:bg-gray-100 font-bold shadow-md scale-105 ring-0 border-none"
              )}
            >
              <Heart className={cn("h-4 w-4", filters.is_favorite && "fill-current")} />
              Favoritos {stats && `(${stats.favorites_count})`}
            </Button>
          </div>

          {/* Breadcrumbs de navegação */}
          {(currentFolder || folderPath.length > 0) && (
            <FolderBreadcrumbs
              currentFolder={currentFolder}
              folderPath={folderPath}
              onNavigate={handleNavigateToFolder}
            />
          )}

          {/* Área de upload */}
          {showUpload && (
            <div className="mb-6">
              <MediaUpload
                onUploadComplete={handleUploadComplete}
                onClose={() => setShowUpload(false)}
                folderId={currentFolder?.id}
              />
            </div>
          )}

          {/* Diálogo de criar pasta */}
          <CreateFolderDialog
            open={showCreateFolder}
            onOpenChange={setShowCreateFolder}
            onCreateFolder={handleCreateFolder}
            parentFolderName={currentFolder?.name}
          />

          {/* Diálogo de preview */}
          <MediaPreviewDialog
            media={previewMedia}
            open={!!previewMedia}
            onOpenChange={(open) => !open && setPreviewMedia(null)}
          />

          {/* Grid de mídia */}
          {isLoading ? (
            <LoadingScreen message="Carregando biblioteca de mídia..." />
          ) : folders.length === 0 && media.length === 0 ? (
            <div className="text-center py-20">
              <div className="bg-muted rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                <ImageIcon className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Nenhum arquivo encontrado
              </h3>
              <p className="text-muted-foreground mb-4">
                {filters.search
                  ? 'Tente buscar por outro termo'
                  : 'Faça upload de arquivos para começar'}
              </p>
              {!showUpload && (
                <Button onClick={() => setShowUpload(true)} className="gap-2">
                  <UploadIcon className="h-4 w-4" />
                  Fazer Upload
                </Button>
              )}
            </div>
          ) : (
            <div
              className={cn(
                viewMode === 'grid'
                  ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4'
                  : 'space-y-2'
              )}
            >
              {/* Renderizar pastas - Show if 'folder' or 'all' (no type selected) */}
              {/* @ts-ignore */}
              {(!filters.media_type || filters.media_type === 'folder') && folders.map((folder) => (
                <FolderCard
                  key={`folder-${folder.id}`}
                  folder={folder}
                  onOpen={handleNavigateToFolder}
                  onDelete={handleDeleteFolder}
                />
              ))}

              {/* Renderizar arquivos - Show if correct type or 'all' (AND NOT 'folder' filter) */}
              {/* @ts-ignore */}
              {filters.media_type !== 'folder' && media.map((item) => (
                <MediaCard
                  key={`media-${item.id}`}
                  media={item}
                  onToggleFavorite={handleToggleFavorite}
                  onDelete={handleDelete}
                  onDoubleClick={(item) => setPreviewMedia(item)}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
