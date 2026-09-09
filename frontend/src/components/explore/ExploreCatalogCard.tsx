import { logger } from '../../utils/logger';
import type { FC } from 'react';
import { Heart, MessageCircle, Bookmark, Eye, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { catalogService } from '../../services/catalogService';
import { chatService } from '../../services/chatService';

export interface ExploreCatalog {
    id: string;
    title: string;
    author: string;
    authorAvatar?: string;
    coverImage: string;
    productCount: number;
    description?: string;
    likes: number;
    comments: number;
    views: number;
    isLiked?: boolean;
    isSaved?: boolean;
}

interface ExploreCatalogCardProps {
    catalog: ExploreCatalog;
    onSelect: (catalog: ExploreCatalog) => void;
}

export const ExploreCatalogCard: FC<ExploreCatalogCardProps> = ({ catalog, onSelect }) => {
    const [isLiked, setIsLiked] = useState(catalog.isLiked);
    const [isSaved, setIsSaved] = useState(catalog.isSaved);
    const [likesCount, setLikesCount] = useState(catalog.likes);

    const handleLike = async (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            const result = await catalogService.toggleLike(Number(catalog.id));
            setIsLiked(result.liked);
            setLikesCount(result.count);
        } catch (error) {
            console.error("Failed to like catalog", error);
        }
    };

    const handleSave = async (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            const result = await catalogService.toggleSave(Number(catalog.id));
            setIsSaved(result.saved);
        } catch (error) {
            console.error("Failed to save catalog", error);
        }
    };

    const handleChat = async (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            const conversation = await chatService.startConversation('catalog', Number(catalog.id));
            logger.debug('Conversation started:', conversation);
            // TODO: Navigate to chat or open chat modal
            alert(`Chat started! ID: ${conversation.id}`);
        } catch (error) {
            console.error("Failed to start conversation", error);
            alert("Failed to start conversation");
        }
    };

    return (
        <div
            onClick={() => onSelect(catalog)}
            className="group bg-white dark:bg-zinc-800 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col h-full"
        >
            {/* Cover Image */}
            <div className="relative aspect-[4/3] overflow-hidden bg-zinc-100 dark:bg-zinc-900">
                <img
                    src={catalog.coverImage}
                    alt={catalog.title}
                    className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={handleSave}
                        className={cn(
                            "p-2 rounded-full backdrop-blur-md transition-colors",
                            isSaved
                                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                                : "bg-white/90 text-zinc-900 hover:bg-white dark:bg-zinc-900/90 dark:text-white"
                        )}
                    >
                        <Bookmark className={cn("w-4 h-4", isSaved && "fill-current")} />
                    </button>
                </div>
                <div className="absolute bottom-3 left-3 px-2 py-1 bg-black/50 backdrop-blur-sm rounded text-xs font-medium text-white flex items-center gap-1.5">
                    <Eye className="w-3 h-3" />
                    {catalog.views.toLocaleString()}
                </div>
            </div>

            {/* Content */}
            <div className="p-4 flex-1 flex flex-col">
                <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                        <h3 className="font-semibold text-zinc-900 dark:text-white line-clamp-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {catalog.title}
                        </h3>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">
                            {catalog.author}
                        </p>
                    </div>
                    {catalog.authorAvatar && (
                        <img src={catalog.authorAvatar} alt={catalog.author} className="w-8 h-8 rounded-full border border-zinc-200 dark:border-zinc-700" />
                    )}
                </div>

                <div className="mt-auto pt-4 flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center gap-4 text-sm text-zinc-500 dark:text-zinc-400">
                        <button
                            onClick={handleLike}
                            className={cn("flex items-center gap-1.5 hover:text-red-500 transition-colors", isLiked && "text-red-500")}
                        >
                            <Heart className={cn("w-4 h-4", isLiked && "fill-current")} />
                            <span>{likesCount}</span>
                        </button>
                        <div className="flex items-center gap-1.5">
                            <MessageCircle className="w-4 h-4" />
                            <span>{catalog.comments}</span>
                        </div>
                    </div>

                    <button
                        onClick={handleChat}
                        className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
                        <MessageSquare className="w-3.5 h-3.5" />
                        Conversar
                    </button>
                </div>
            </div>
        </div>
    );
};
