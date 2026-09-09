import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { Sidebar } from '../../components/Sidebar';
import { Header } from '../../components/Header';
import { ExploreHeader } from '../../components/explore/ExploreHeader';
import { ExploreCatalogCard, ExploreCatalog } from '../../components/explore/ExploreCatalogCard';
import { ExploreProductCard, ExploreProduct } from '../../components/explore/ExploreProductCard';
import { ExploreCatalogModal } from '../../components/explore/ExploreCatalogModal';
import { BookOpen, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { catalogService } from '../../services/catalogService';
import { productService } from '../../services/productService';
import { LoadingScreen } from '../../components/common/LoadingScreen';
import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from '@/components/ui/pagination';


export const Explore: FC = () => {
    const [activeTab, setActiveTab] = useState<'catalogs' | 'products'>('catalogs');
    const [searchQuery, setSearchQuery] = useState('');
    const [filters, setFilters] = useState<any>({});
    const [catalogs, setCatalogs] = useState<ExploreCatalog[]>([]);
    const [products, setProducts] = useState<ExploreProduct[]>([]);
    const [loading, setLoading] = useState(true);

    // Paginação para produtos E catálogos
    const [allProducts, setAllProducts] = useState<any[]>([]);
    const [allCatalogs, setAllCatalogs] = useState<any[]>([]);
    const [productsCount, setProductsCount] = useState(0);
    const [catalogsCount, setCatalogsCount] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const pageSize = 24;

    const [selectedCatalog, setSelectedCatalog] = useState<ExploreCatalog | null>(null);

    // Carregar contagens iniciais das tabs (uma única vez no mount)
    useEffect(() => {
        loadCounts();
    }, []);

    // Buscar dados quando tab, filtros ou busca mudam (mas NÃO quando só muda a página)
    useEffect(() => {
        fetchData();
    }, [activeTab, filters, searchQuery]);

    // Atualizar produtos ou catálogos exibidos quando a página muda (sem refazer a busca)
    useEffect(() => {
        if (activeTab === 'products' && allProducts.length > 0) {
            paginateProducts();
        } else if (activeTab === 'catalogs' && allCatalogs.length > 0) {
            paginateCatalogs();
        }
    }, [currentPage, activeTab]);

    // Carregar apenas as contagens (para as tabs)
    const loadCounts = async () => {
        try {
            // Buscar contagem de catálogos (pegando todos sem paginação)
            const catalogsData = await catalogService.getExploreCatalogs('', {});
            setCatalogsCount(catalogsData.length);

            // Buscar contagem de produtos - fazer uma requisição com page_size=1 apenas para pegar o total
            const { total: productsTotal } = await productService.getPublicProducts({ page: 1, limit: 1 });
            setProductsCount(productsTotal);
        } catch (error) {
            console.error('Error loading counts:', error);
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            if (activeTab === 'catalogs') {
                const data = await catalogService.getExploreCatalogs(searchQuery, filters);

                // Armazenar todos os catálogos
                setAllCatalogs(data);
                const total = data.length;
                setCatalogsCount(total);
                setTotalPages(Math.ceil(total / pageSize));

                // Resetar para primeira página ao buscar novos dados
                setCurrentPage(1);

                // Paginar os catálogos
                paginateCatalogs(data, 1);
            } else {
                try {
                    // Buscar produtos com page_size grande para pegar todos de uma vez
                    // A API aceita page_size como parâmetro (max 100 por requisição)
                    // Vamos buscar com limit=10000 para ter certeza de pegar todos
                    const { products: fetchedProducts, total } = await productService.getPublicProducts({
                        search: searchQuery,
                        ...filters,
                        limit: 10000 // Buscar todos os produtos de uma vez
                    });

                    // Armazenar todos os produtos e contagem
                    setAllProducts(fetchedProducts);
                    setProductsCount(total || fetchedProducts.length);
                    setTotalPages(Math.ceil((total || fetchedProducts.length) / pageSize));

                    // Resetar para primeira página ao buscar novos dados
                    setCurrentPage(1);

                    // Paginar os produtos
                    paginateProducts(fetchedProducts, 1);
                } catch (err) {
                    console.error("Failed to fetch products", err);
                    setProducts([]);
                    setAllProducts([]);
                    setProductsCount(0);
                }
            }
        } catch (error) {
            console.error('Error fetching explore data:', error);
        } finally {
            setLoading(false);
        }
    };

    const paginateCatalogs = (catalogsArray: any[] = allCatalogs, page: number = currentPage) => {
        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const paginatedCatalogs = catalogsArray.slice(startIndex, endIndex);

        const mappedCatalogs: ExploreCatalog[] = paginatedCatalogs.map(c => ({
            id: c.id.toString(),
            title: c.title,
            author: c.author_name || 'Desconhecido',
            authorAvatar: c.author_avatar,
            coverImage: c.cover_image || 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b',
            productCount: c.pages_count || 0,
            description: c.description,
            likes: c.likes_count || 0,
            comments: 0,
            views: 0,
            isLiked: c.is_liked,
            isSaved: c.is_saved,
        }));
        setCatalogs(mappedCatalogs);
    };

    const paginateProducts = (productsArray: any[] = allProducts, page: number = currentPage) => {
        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const paginatedProducts = productsArray.slice(startIndex, endIndex);

        const mappedProducts: ExploreProduct[] = paginatedProducts.map(p => ({
            id: p.public_slug || p.id.toString(),
            name: p.name,
            sku: '',
            image: p.image_url || 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9',
            price: typeof p.price === 'string' ? parseFloat(p.price) : p.price,
            currency: p.currency || 'BRL',
            category: p.category_name || '',
            author: p.organization_name || '',
            rating: 0,
            reviewCount: 0,
            savedCount: 0,
            isSaved: false,
        }));
        setProducts(mappedProducts);
    };

    const handleFilterChange = (newFilters: any) => {
        setFilters(newFilters);
    };

    const goToPage = (page: number) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
            // Scroll to top quando mudar de página
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    // Gerar array de páginas para mostrar na paginação
    const getPageNumbers = () => {
        const pages: (number | string)[] = [];
        const maxVisible = 7; // Número máximo de botões de página visíveis

        if (totalPages <= maxVisible) {
            // Mostrar todas as páginas se forem poucas
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        } else {
            // Lógica para mostrar páginas com ellipsis
            if (currentPage <= 3) {
                for (let i = 1; i <= 5; i++) pages.push(i);
                pages.push('ellipsis');
                pages.push(totalPages);
            } else if (currentPage >= totalPages - 2) {
                pages.push(1);
                pages.push('ellipsis');
                for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
            } else {
                pages.push(1);
                pages.push('ellipsis');
                for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
                pages.push('ellipsis');
                pages.push(totalPages);
            }
        }

        return pages;
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-zinc-900">
            <Sidebar />
            <div className="flex-1 ml-16">
                <Header />

                <main className="pt-20">
                    <div className="max-w-[1400px] mx-auto p-4 md:p-8">
                        {/* Header Section */}
                        <div className="mb-8">
                            <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-2">
                                Explorar
                            </h1>
                            <p className="text-zinc-500 dark:text-zinc-400">
                                Descubra novos catálogos, produtos e oportunidades.
                            </p>
                        </div>

                        {/* Navigation Tabs */}
                        <div className="flex items-center gap-1 mb-6 border-b border-zinc-200 dark:border-zinc-800">
                            <button
                                onClick={() => {
                                    setActiveTab('catalogs');
                                    setCurrentPage(1);
                                }}
                                className={cn(
                                    "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                                    activeTab === 'catalogs'
                                        ? "border-zinc-900 text-zinc-900 dark:border-white dark:text-white"
                                        : "border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
                                )}
                            >
                                <BookOpen className="w-4 h-4" />
                                Catálogos
                                <span className="ml-1 text-xs bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full text-zinc-600 dark:text-zinc-400">
                                    {catalogsCount.toLocaleString()}
                                </span>
                            </button>
                            <button
                                onClick={() => {
                                    setActiveTab('products');
                                    setCurrentPage(1);
                                }}
                                className={cn(
                                    "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                                    activeTab === 'products'
                                        ? "border-zinc-900 text-zinc-900 dark:border-white dark:text-white"
                                        : "border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
                                )}
                            >
                                <Package className="w-4 h-4" />
                                Produtos
                                <span className="ml-1 text-xs bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full text-zinc-600 dark:text-zinc-400">
                                    {productsCount.toLocaleString()}
                                </span>
                            </button>
                        </div>

                        {/* Search & Filters */}
                        <ExploreHeader
                            activeTab={activeTab}
                            searchQuery={searchQuery}
                            onSearchChange={setSearchQuery}
                            onFilterChange={handleFilterChange}
                        />

                        {/* Content Area */}
                        <div className="min-h-[400px]">
                            {loading ? (
                                <LoadingScreen message={activeTab === 'catalogs' ? 'Carregando catálogos...' : 'Carregando produtos...'} />
                            ) : activeTab === 'catalogs' ? (
                                catalogs.length > 0 ? (
                                    <>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                            {catalogs.map(catalog => (
                                                <ExploreCatalogCard
                                                    key={catalog.id}
                                                    catalog={catalog}
                                                    onSelect={setSelectedCatalog}
                                                />
                                            ))}
                                        </div>

                                        {/* Paginação para Catálogos */}
                                        {totalPages > 1 && (
                                            <div className="mt-8">
                                                <Pagination>
                                                    <PaginationContent>
                                                        {/* Botão Anterior */}
                                                        <PaginationItem>
                                                            <PaginationPrevious
                                                                onClick={() => goToPage(currentPage - 1)}
                                                                className={cn(
                                                                    currentPage === 1 && 'pointer-events-none opacity-50'
                                                                )}
                                                            />
                                                        </PaginationItem>

                                                        {/* Números das páginas */}
                                                        {getPageNumbers().map((page, index) => (
                                                            <PaginationItem key={index}>
                                                                {page === 'ellipsis' ? (
                                                                    <PaginationEllipsis />
                                                                ) : (
                                                                    <PaginationLink
                                                                        onClick={() => goToPage(page as number)}
                                                                        isActive={currentPage === page}
                                                                    >
                                                                        {page}
                                                                    </PaginationLink>
                                                                )}
                                                            </PaginationItem>
                                                        ))}

                                                        {/* Botão Próxima */}
                                                        <PaginationItem>
                                                            <PaginationNext
                                                                onClick={() => goToPage(currentPage + 1)}
                                                                className={cn(
                                                                    currentPage === totalPages && 'pointer-events-none opacity-50'
                                                                )}
                                                            />
                                                        </PaginationItem>
                                                    </PaginationContent>
                                                </Pagination>

                                                {/* Informação de catálogos */}
                                                <div className="text-center mt-4 text-sm text-zinc-500 dark:text-zinc-400">
                                                    Mostrando {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, catalogsCount)} de {catalogsCount.toLocaleString()} catálogos
                                                </div>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="text-center py-20 text-zinc-500">
                                        <p>Nenhum catálogo encontrado.</p>
                                    </div>
                                )
                            ) : (
                                products.length > 0 ? (
                                    <>
                                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                                            {products.map(product => (
                                                <ExploreProductCard key={product.id} product={product} />
                                            ))}
                                        </div>

                                        {/* Paginação */}
                                        {totalPages > 1 && (
                                            <div className="mt-8">
                                                <Pagination>
                                                    <PaginationContent>
                                                        {/* Botão Anterior */}
                                                        <PaginationItem>
                                                            <PaginationPrevious
                                                                onClick={() => goToPage(currentPage - 1)}
                                                                className={cn(
                                                                    currentPage === 1 && 'pointer-events-none opacity-50'
                                                                )}
                                                            />
                                                        </PaginationItem>

                                                        {/* Números das páginas */}
                                                        {getPageNumbers().map((page, index) => (
                                                            <PaginationItem key={index}>
                                                                {page === 'ellipsis' ? (
                                                                    <PaginationEllipsis />
                                                                ) : (
                                                                    <PaginationLink
                                                                        onClick={() => goToPage(page as number)}
                                                                        isActive={currentPage === page}
                                                                    >
                                                                        {page}
                                                                    </PaginationLink>
                                                                )}
                                                            </PaginationItem>
                                                        ))}

                                                        {/* Botão Próxima */}
                                                        <PaginationItem>
                                                            <PaginationNext
                                                                onClick={() => goToPage(currentPage + 1)}
                                                                className={cn(
                                                                    currentPage === totalPages && 'pointer-events-none opacity-50'
                                                                )}
                                                            />
                                                        </PaginationItem>
                                                    </PaginationContent>
                                                </Pagination>

                                                {/* Informação de produtos */}
                                                <div className="text-center mt-4 text-sm text-zinc-500 dark:text-zinc-400">
                                                    Mostrando {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, productsCount)} de {productsCount.toLocaleString()} produtos
                                                </div>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="text-center py-20 text-zinc-500">
                                        <p>Nenhum produto encontrado.</p>
                                    </div>
                                )
                            )}
                        </div>
                    </div>
                </main>
            </div>

            {/* Catalog Modal */}
            {selectedCatalog && (
                <ExploreCatalogModal
                    catalog={selectedCatalog}
                    isOpen={!!selectedCatalog}
                    onClose={() => setSelectedCatalog(null)}
                />
            )}
        </div>
    );
};
