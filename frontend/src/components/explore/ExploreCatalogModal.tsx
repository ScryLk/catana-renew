import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { X, Heart, Bookmark, MessageSquare, ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ExploreCatalog } from './ExploreCatalogCard';
import * as Dialog from '@radix-ui/react-dialog';
import { catalogService } from '../../services/catalogService';
import type { Page } from '@/types/api';

interface ExploreCatalogModalProps {
    catalog: ExploreCatalog;
    isOpen: boolean;
    onClose: () => void;
}

export const ExploreCatalogModal: FC<ExploreCatalogModalProps> = ({ catalog, isOpen, onClose }) => {
    const [currentPage, setCurrentPage] = useState(0);
    const [isLiked, setIsLiked] = useState(catalog.isLiked);
    const [isSaved, setIsSaved] = useState(catalog.isSaved);
    const [likesCount, setLikesCount] = useState(catalog.likes);

    const [pages, setPages] = useState<Page[]>([]);
    const [loading, setLoading] = useState(true);

    const [showInfo, setShowInfo] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setCurrentPage(0);
            setShowInfo(false);
            loadCatalogDetails();
        }
    }, [isOpen, catalog.id]);

    const loadCatalogDetails = async () => {
        setLoading(true);
        try {
            const detailedCatalog = await catalogService.getCatalog(parseInt(catalog.id));
            if (detailedCatalog.pages) {
                // Sort pages by order just in case
                const sortedPages = detailedCatalog.pages.sort((a: Page, b: Page) => a.order - b.order);
                setPages(sortedPages);
            } else {
                setPages([]);
            }
        } catch (error) {
            console.error("Failed to load catalog details", error);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const handleNext = () => {
        if (currentPage < pages.length - 1) setCurrentPage(p => p + 1);
    };

    const handlePrev = () => {
        if (currentPage > 0) setCurrentPage(p => p - 1);
    };

    const toggleLike = async () => {
        try {
            const result = await catalogService.toggleLike(Number(catalog.id));
            setIsLiked(result.liked);
            setLikesCount(result.count);
        } catch (error) {
            console.error("Failed to like catalog", error);
        }
    };

    const toggleSave = async () => {
        try {
            // Assuming toggleSave exists on catalogService and returns structure like { saved: boolean; count: number }
            // But ExploreCatalogModal is slightly different UI (just bookmark icon)
            const result = await catalogService.toggleSave(Number(catalog.id));
            setIsSaved(result.saved);
        } catch (error) {
            console.error("Failed to save catalog", error);
        }
    };

    // Fallback image if page has no background
    const getPageImage = (page: Page) => {
        return page.background_image_url || 'https://via.placeholder.com/800x1200?text=Sem+Imagem';
    };

    return (
        <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/80 z-50 animate-in fade-in duration-200" />
                <Dialog.Content className="fixed inset-4 md:inset-10 z-50 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 focus:outline-none">

                    {/* Header */}
                    <div className="flex bg-white dark:bg-zinc-900 items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 z-10 shrink-0">
                        <div className="flex items-center gap-4">
                            {/* Info Button */}
                            <button
                                onClick={() => setShowInfo(!showInfo)}
                                className={cn(
                                    "p-2 rounded-lg transition-colors",
                                    showInfo
                                        ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                                        : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                                )}
                                title="Informações do catálogo"
                            >
                                <Info className="w-5 h-5" />
                            </button>

                            {!showInfo && (
                                <div className="flex items-center gap-4 animate-in fade-in slide-in-from-left-2 duration-300">
                                    {catalog.authorAvatar && (
                                        <img src={catalog.authorAvatar} alt={catalog.author} className="w-10 h-10 rounded-full border border-zinc-200 dark:border-zinc-700" />
                                    )}
                                    <div>
                                        <h2 className="text-lg font-bold text-zinc-900 dark:text-white leading-tight line-clamp-1">
                                            {catalog.title}
                                        </h2>
                                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                                            por <span className="font-medium text-zinc-700 dark:text-zinc-300">{catalog.author}</span> • {pages.length} páginas
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-2 md:gap-4">
                            {/* ... (Actions) */}
                            <button
                                onClick={toggleLike}
                                className={cn(
                                    "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                                    isLiked
                                        ? "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400"
                                        : "hover:bg-zinc-100 text-zinc-600 dark:hover:bg-zinc-800 dark:text-zinc-400"
                                )}
                            >
                                <Heart className={cn("w-4 h-4", isLiked && "fill-current")} />
                                <span className="hidden md:inline">{likesCount}</span>
                            </button>

                            <button
                                onClick={toggleSave}
                                title="Salvar catálogo"
                                className={cn(
                                    "p-2 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors",
                                    isSaved && "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20"
                                )}
                            >
                                <Bookmark className={cn("w-5 h-5", isSaved && "fill-current")} />
                            </button>

                            <button className="hidden md:flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
                                <MessageSquare className="w-4 h-4" />
                                Falar com vendedor
                            </button>

                            <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-700 mx-1 md:mx-0" />

                            <button
                                onClick={onClose}
                                className="p-2 rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 transition-colors"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                    </div>

                    {/* Body */}
                    <div className="flex-1 flex overflow-hidden relative">

                        {/* Info Panel Overlay */}
                        {showInfo && (
                            <div className="absolute left-0 top-0 bottom-0 w-80 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 z-30 p-6 overflow-y-auto animate-in slide-in-from-left duration-300 shadow-2xl">
                                <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-2 leading-tight">
                                    {catalog.title}
                                </h2>
                                <div className="flex items-center gap-3 mb-6 pb-6 border-b border-zinc-100 dark:border-zinc-800">
                                    {catalog.authorAvatar && (
                                        <img src={catalog.authorAvatar} alt={catalog.author} className="w-10 h-10 rounded-full border border-zinc-200 dark:border-zinc-700" />
                                    )}
                                    <div>
                                        <p className="font-semibold text-zinc-900 dark:text-white">{catalog.author}</p>
                                        <p className="text-xs text-zinc-500 dark:text-zinc-400">Vendedor</p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-1">Sobre</h3>
                                        <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                                            {catalog.description || "Sem descrição disponível."}
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 py-4">
                                        <div className="bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-lg text-center">
                                            <span className="block text-lg font-bold text-zinc-900 dark:text-white">{pages.length}</span>
                                            <span className="text-xs text-zinc-500 dark:text-zinc-400">Páginas</span>
                                        </div>
                                        <div className="bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-lg text-center">
                                            <span className="block text-lg font-bold text-zinc-900 dark:text-white">{catalog.productCount}</span>
                                            <span className="text-xs text-zinc-500 dark:text-zinc-400">Produtos</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Main Viewer */}
                        <div className="flex-1 bg-zinc-100 dark:bg-black/50 relative flex items-center justify-center p-4 md:p-8 overflow-hidden group/viewer">
                            {loading ? (
                                <div className="flex flex-col items-center gap-4 text-zinc-500">
                                    <div className="w-8 h-8 border-4 border-zinc-200 border-t-zinc-900 rounded-full animate-spin"></div>
                                    <p>Carregando páginas...</p>
                                </div>
                            ) : pages.length > 0 ? (
                                <>
                                    {/* Navigation Buttons (Overlay) */}
                                    <button
                                        onClick={handlePrev}
                                        disabled={currentPage === 0}
                                        className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/80 dark:bg-zinc-800/80 shadow-lg backdrop-blur text-zinc-800 dark:text-zinc-200 disabled:opacity-0 hover:bg-white dark:hover:bg-zinc-700 transition-all z-20"
                                    >
                                        <ChevronLeft className="w-6 h-6" />
                                    </button>
                                    <button
                                        onClick={handleNext}
                                        disabled={currentPage === pages.length - 1}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/80 dark:bg-zinc-800/80 shadow-lg backdrop-blur text-zinc-800 dark:text-zinc-200 disabled:opacity-0 hover:bg-white dark:hover:bg-zinc-700 transition-all z-20"
                                    >
                                        <ChevronRight className="w-6 h-6" />
                                    </button>

                                    {/* Page Image */}
                                    <div className="relative h-full max-w-full aspect-[1/1.414] shadow-2xl bg-white transition-all duration-300">
                                        <img
                                            src={getPageImage(pages[currentPage])}
                                            alt={`Página ${pages[currentPage].order}`}
                                            className="w-full h-full object-contain md:object-cover bg-white"
                                        />
                                    </div>

                                    {/* Bottom Page Indicator */}
                                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur-md text-white text-xs font-medium px-3 py-1.5 rounded-full z-20 pointer-events-none">
                                        Página {currentPage + 1} de {pages.length}
                                    </div>
                                </>
                            ) : (
                                <div className="text-zinc-500 dark:text-zinc-400">
                                    <p>Este catálogo não possui páginas.</p>
                                </div>
                            )}
                        </div>

                        {/* Sidebar Thumbnails */}
                        <div className="hidden md:flex w-64 border-l border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex-col shrink-0">
                            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
                                <h3 className="font-semibold text-sm text-zinc-900 dark:text-white">Páginas</h3>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                                {loading ? (
                                    <div className="animate-pulse space-y-4">
                                        {[1, 2, 3].map(i => (
                                            <div key={i} className="aspect-[1/1.414] bg-zinc-200 dark:bg-zinc-800 rounded-lg"></div>
                                        ))}
                                    </div>
                                ) : (
                                    pages.map((page, index) => (
                                        <button
                                            key={page.id}
                                            onClick={() => setCurrentPage(index)}
                                            className={cn(
                                                "w-full text-left group transition-all duration-200",
                                                currentPage === index ? "opacity-100" : "opacity-60 hover:opacity-100"
                                            )}
                                        >
                                            <div className={cn(
                                                "relative aspect-[1/1.414] rounded-lg overflow-hidden border-2 mb-2 transition-all",
                                                currentPage === index
                                                    ? "border-blue-600 shadow-md ring-2 ring-blue-600/20"
                                                    : "border-zinc-200 dark:border-zinc-700 group-hover:border-zinc-400"
                                            )}>
                                                <img src={getPageImage(page)} className="w-full h-full object-cover" loading="lazy" />
                                            </div>
                                            <span className={cn(
                                                "text-xs font-medium text-center block",
                                                currentPage === index ? "text-blue-600" : "text-zinc-500"
                                            )}>
                                                Página {page.order}
                                            </span>
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
};
