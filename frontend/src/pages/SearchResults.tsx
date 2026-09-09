import { FC, useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import { LoadingScreen } from '../components/common/LoadingScreen';
import { globalSearchService, GlobalSearchResults } from '../services/globalSearchService';
import { User, BookOpen, Package, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export const SearchResults: FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';

  const [results, setResults] = useState<GlobalSearchResults | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'profiles' | 'catalogs' | 'products'>('all');

  useEffect(() => {
    if (query.trim().length >= 2) {
      searchAll();
    }
  }, [query]);

  const searchAll = async () => {
    setIsLoading(true);
    try {
      const data = await globalSearchService.search(query, 50); // Get more results for full page
      setResults(data);
    } catch (error) {
      console.error('Erro na busca:', error);
      setResults({ profiles: [], catalogs: [], products: [], total: 0 });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredResults = () => {
    if (!results) return { profiles: [], catalogs: [], products: [] };

    switch (activeTab) {
      case 'profiles':
        return { profiles: results.profiles, catalogs: [], products: [] };
      case 'catalogs':
        return { profiles: [], catalogs: results.catalogs, products: [] };
      case 'products':
        return { profiles: [], catalogs: [], products: results.products };
      default:
        return results;
    }
  };

  const filtered = filteredResults();

  return (
    <div className="min-h-screen bg-zinc-950">
      <Sidebar />
      <Header />

      <main className="ml-16 pt-20">
        <div className="p-8 max-w-[1400px] mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-zinc-100 mb-2">
              Resultados da busca
            </h1>
            {query && (
              <p className="text-zinc-400">
                Resultados para <span className="text-zinc-100 font-medium">"{query}"</span>
                {results && <span className="ml-2">• {results.total} resultados</span>}
              </p>
            )}
          </div>

          {/* Tabs */}
          {results && results.total > 0 && (
            <div className="flex gap-2 mb-6 border-b border-zinc-800">
              <button
                onClick={() => setActiveTab('all')}
                className={cn(
                  "px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                  activeTab === 'all'
                    ? "border-blue-500 text-blue-500"
                    : "border-transparent text-zinc-400 hover:text-zinc-100"
                )}
              >
                Todos ({results.total})
              </button>
              {results.profiles.length > 0 && (
                <button
                  onClick={() => setActiveTab('profiles')}
                  className={cn(
                    "px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2",
                    activeTab === 'profiles'
                      ? "border-blue-500 text-blue-500"
                      : "border-transparent text-zinc-400 hover:text-zinc-100"
                  )}
                >
                  <User className="w-4 h-4" />
                  Perfis ({results.profiles.length})
                </button>
              )}
              {results.catalogs.length > 0 && (
                <button
                  onClick={() => setActiveTab('catalogs')}
                  className={cn(
                    "px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2",
                    activeTab === 'catalogs'
                      ? "border-blue-500 text-blue-500"
                      : "border-transparent text-zinc-400 hover:text-zinc-100"
                  )}
                >
                  <BookOpen className="w-4 h-4" />
                  Catálogos ({results.catalogs.length})
                </button>
              )}
              {results.products.length > 0 && (
                <button
                  onClick={() => setActiveTab('products')}
                  className={cn(
                    "px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2",
                    activeTab === 'products'
                      ? "border-blue-500 text-blue-500"
                      : "border-transparent text-zinc-400 hover:text-zinc-100"
                  )}
                >
                  <Package className="w-4 h-4" />
                  Produtos ({results.products.length})
                </button>
              )}
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <LoadingScreen message="Buscando resultados..." />
          )}

          {/* Empty Query */}
          {!isLoading && query.trim().length < 2 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-12 text-center">
              <Search className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-zinc-100 mb-2">
                Digite algo para buscar
              </h3>
              <p className="text-zinc-400">
                Pesquise por perfis, catálogos ou produtos
              </p>
            </div>
          )}

          {/* No Results */}
          {!isLoading && query.trim().length >= 2 && results && results.total === 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-12 text-center">
              <Search className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-zinc-100 mb-2">
                Nenhum resultado encontrado
              </h3>
              <p className="text-zinc-400">
                Tente buscar com outros termos
              </p>
            </div>
          )}

          {/* Results */}
          {!isLoading && results && results.total > 0 && (
            <div className="space-y-8">
              {/* Profiles Section */}
              {filtered.profiles.length > 0 && (
                <div>
                  <h2 className="text-xl font-semibold text-zinc-100 mb-4 flex items-center gap-2">
                    <User className="w-5 h-5" />
                    Perfis
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.profiles.map((profile) => (
                      <button
                        key={profile.id}
                        onClick={() => navigate(`/profiles/${profile.username}`)}
                        className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 hover:bg-zinc-800 transition-colors text-left group"
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center overflow-hidden flex-shrink-0">
                            {profile.avatar ? (
                              <img src={profile.avatar} alt={profile.name} className="w-full h-full object-cover" />
                            ) : (
                              <User className="w-6 h-6 text-zinc-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-zinc-100 truncate group-hover:text-blue-400 transition-colors">
                              {profile.name}
                            </p>
                            <p className="text-sm text-zinc-500">@{profile.username}</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs text-zinc-400">
                          <span className="capitalize px-2 py-1 bg-zinc-800 rounded">{profile.type}</span>
                          {profile.followers_count > 0 && (
                            <span>{profile.followers_count} seguidores</span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Catalogs Section */}
              {filtered.catalogs.length > 0 && (
                <div>
                  <h2 className="text-xl font-semibold text-zinc-100 mb-4 flex items-center gap-2">
                    <BookOpen className="w-5 h-5" />
                    Catálogos
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.catalogs.map((catalog) => (
                      <button
                        key={catalog.id}
                        onClick={() => navigate(`/catalogs/${catalog.id}/view`)}
                        className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 hover:bg-zinc-800 transition-colors text-left group"
                      >
                        <div className="flex gap-3 mb-3">
                          <div className="w-16 h-20 rounded bg-zinc-800 flex items-center justify-center overflow-hidden flex-shrink-0">
                            {catalog.cover_image ? (
                              <img src={catalog.cover_image} alt={catalog.title} className="w-full h-full object-cover" />
                            ) : (
                              <BookOpen className="w-6 h-6 text-zinc-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium text-zinc-100 truncate group-hover:text-blue-400 transition-colors">
                                {catalog.title}
                              </p>
                              {catalog.is_sponsored && (
                                <span className="px-1.5 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-xs font-medium rounded">
                                  Patrocinado
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-zinc-500 truncate">por {catalog.author}</p>
                          </div>
                        </div>
                        <div className="text-xs text-zinc-400">
                          {catalog.pages_count} páginas
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Products Section */}
              {filtered.products.length > 0 && (
                <div>
                  <h2 className="text-xl font-semibold text-zinc-100 mb-4 flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    Produtos
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filtered.products.map((product) => (
                      <button
                        key={product.id}
                        onClick={() => navigate(`/products/${product.id}`)}
                        className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 hover:bg-zinc-800 transition-colors text-left group"
                      >
                        <div className="w-full aspect-square rounded bg-zinc-800 flex items-center justify-center overflow-hidden mb-3">
                          {product.image_url ? (
                            <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                          ) : (
                            <Package className="w-12 h-12 text-zinc-400" />
                          )}
                        </div>
                        <p className="font-medium text-zinc-100 truncate group-hover:text-blue-400 transition-colors mb-1">
                          {product.name}
                        </p>
                        <p className="text-xs text-zinc-500 mb-2">{product.category}</p>
                        {product.price && (
                          <p className="text-sm font-semibold text-zinc-100">
                            {new Intl.NumberFormat('pt-BR', {
                              style: 'currency',
                              currency: product.currency || 'BRL',
                            }).format(product.price)}
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
