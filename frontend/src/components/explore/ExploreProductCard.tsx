import type { FC } from 'react';
import { Star, Bookmark, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { productService } from '../../services/productService';

export interface ExploreProduct {
    id: string;
    name: string;
    sku: string;
    image: string;
    price: number;
    currency: string;
    category: string;
    rating: number;
    reviewCount: number;
    savedCount: number;
    isSaved?: boolean;
}

interface ExploreProductCardProps {
    product: ExploreProduct;
}

export const ExploreProductCard: FC<ExploreProductCardProps> = ({ product }) => {
    const [isSaved, setIsSaved] = useState(product.isSaved);

    const handleSave = async (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            const result = await productService.toggleSave(Number(product.id));
            setIsSaved(result.saved);
        } catch (error) {
            console.error("Failed to save product", error);
        }
    };

    const formattedPrice = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: product.currency,
    }).format(product.price);

    return (
        <div className="group bg-white dark:bg-zinc-800 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col h-full relative">
            <div className="absolute top-3 right-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                <button
                    onClick={handleSave}
                    className={cn(
                        "p-2 rounded-full backdrop-blur-md transition-colors shadow-sm",
                        isSaved
                            ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                            : "bg-white/90 text-zinc-900 hover:bg-white dark:bg-zinc-900/90 dark:text-white"
                    )}
                    title="Salvar produto"
                >
                    <Bookmark className={cn("w-4 h-4", isSaved && "fill-current")} />
                </button>
            </div>

            {/* Image */}
            <div className="aspect-square bg-zinc-50 dark:bg-zinc-900 overflow-hidden relative p-4 flex items-center justify-center">
                {product.image ? (
                    <img
                        src={product.image}
                        alt={product.name}
                        className="w-full h-full object-contain mix-blend-multiply dark:mix-blend-normal transform group-hover:scale-105 transition-transform duration-500"
                    />
                ) : (
                    <Package className="w-12 h-12 text-zinc-300 dark:text-zinc-600" />
                )}
            </div>

            {/* Content */}
            <div className="p-4 flex-1 flex flex-col">
                <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-1 bg-zinc-100 dark:bg-zinc-700/50 text-zinc-600 dark:text-zinc-400 text-[10px] font-medium uppercase tracking-wider rounded">
                        {product.category}
                    </span>
                    <div className="flex items-center gap-1 text-amber-400 text-xs font-medium ml-auto">
                        <Star className="w-3.5 h-3.5 fill-current" />
                        <span>{product.rating.toFixed(1)}</span>
                        <span className="text-zinc-400 font-normal">({product.reviewCount})</span>
                    </div>
                </div>

                <h3 className="font-semibold text-zinc-900 dark:text-white text-sm line-clamp-2 mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {product.name}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">SKU: {product.sku}</p>

                <div className="mt-auto pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                    <div className="font-bold text-zinc-900 dark:text-white">
                        {formattedPrice}
                    </div>

                    <div className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                        <Bookmark className="w-3 h-3" />
                        {product.savedCount} salvos
                    </div>
                </div>
            </div>
        </div>
    );
};
