import type { FC } from 'react';
import { Search, Filter, X } from 'lucide-react';
import { Input } from '../ui/input';

interface ExploreHeaderProps {
    activeTab: 'catalogs' | 'products';
    searchQuery: string;
    onSearchChange: (value: string) => void;
    onFilterChange: (filters: any) => void;
}

export const ExploreHeader: FC<ExploreHeaderProps> = ({
    activeTab,
    searchQuery,
    onSearchChange,

}) => {
    return (
        <div className="mb-8 space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
                {/* Search Bar */}
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-5 h-5" />
                    <Input
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder={
                            activeTab === 'catalogs'
                                ? "Buscar catálogos ou marcas..."
                                : "Buscar produtos ou códigos..."
                        }
                        className="pl-10 h-12 text-base bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 w-full rounded-xl transition-all focus:ring-2 ring-zinc-900 dark:ring-zinc-100 placeholder:text-zinc-400"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => onSearchChange('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 p-1"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {/* Quick Filters */}
                <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
                    <select
                        className="h-12 px-4 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-medium text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 cursor-pointer min-w-[140px]"
                        defaultValue=""
                    >
                        <option value="" disabled>Categoria</option>
                        <option value="tech">Tecnologia</option>
                        <option value="fashion">Moda</option>
                        <option value="home">Casa & Decoração</option>
                    </select>

                    <select
                        className="h-12 px-4 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-medium text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 cursor-pointer min-w-[140px]"
                        defaultValue=""
                    >
                        <option value="" disabled>Avaliação</option>
                        <option value="4">4+ Estrelas</option>
                        <option value="5">5 Estrelas</option>
                    </select>

                    <button className="h-12 w-12 flex items-center justify-center bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors flex-shrink-0">
                        <Filter className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
};
