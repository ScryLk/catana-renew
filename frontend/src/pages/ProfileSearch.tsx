/**
 * 🔍 Profile Search Page
 *
 * Página de busca e descoberta de perfis públicos
 */

import { type FC, useState, useEffect, useCallback } from 'react';
import { Search, Filter, X, Loader2, TrendingUp, Users } from 'lucide-react';
import { ProfileCard } from '../components/profile/ProfileCard';
import { publicProfileService } from '../services/publicProfileService';
import type { ProfileCardData, ProfileSearchFilters } from '../types/profile';
import { AVAILABLE_SEGMENTS } from '../types/profile';

export const ProfileSearch: FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [profiles, setProfiles] = useState<ProfileCardData[]>([]);
  const [featuredProfiles, setFeaturedProfiles] = useState<ProfileCardData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  // Filtros
  const [filters, setFilters] = useState<ProfileSearchFilters>({
    profileType: undefined,
    segments: [],
    city: undefined,
  });

  // Busca perfis em destaque ao carregar
  useEffect(() => {
    loadFeaturedProfiles();
  }, []);

  const loadFeaturedProfiles = async () => {
    try {
      const data = await publicProfileService.getFeaturedProfiles(8);
      setFeaturedProfiles(data as ProfileCardData[]);
    } catch (error) {
      console.error('Erro ao carregar perfis em destaque:', error);
    }
  };

  // Buscar perfis
  const searchProfiles = useCallback(
    async (resetPage: boolean = false) => {
      setIsLoading(true);
      const currentPage = resetPage ? 1 : page;

      try {
        const result = await publicProfileService.searchProfiles(
          {
            query: searchQuery || undefined,
            ...filters,
          },
          currentPage,
          20
        );

        const profileCards: ProfileCardData[] = result.profiles.map((p) => ({
          id: p.id,
          displayName: p.displayName,
          bio: p.bio,
          avatar: p.avatar,
          profileType: p.profileType,
          segments: p.segments,
          catalogCount: p.catalogCount,
          followersCount: p.followersCount,
          isFollowing: p.isFollowing,
        }));

        if (resetPage) {
          setProfiles(profileCards);
          setPage(1);
        } else {
          setProfiles((prev) => [...prev, ...profileCards]);
        }

        setHasMore(result.hasMore);
      } catch (error) {
        console.error('Erro ao buscar perfis:', error);
      } finally {
        setIsLoading(false);
      }
    },
    [searchQuery, filters, page]
  );

  // Trigger busca quando query ou filtros mudarem
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery || Object.values(filters).some((v) => v !== undefined && (Array.isArray(v) ? v.length > 0 : true))) {
        searchProfiles(true);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery, filters]);

  const handleLoadMore = () => {
    setPage((prev) => prev + 1);
    searchProfiles(false);
  };

  const handleFilterChange = (key: keyof ProfileSearchFilters, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleSegmentToggle = (segment: string) => {
    setFilters((prev) => {
      const segments = prev.segments || [];
      const newSegments = segments.includes(segment)
        ? segments.filter((s) => s !== segment)
        : [...segments, segment];
      return { ...prev, segments: newSegments };
    });
  };

  const clearFilters = () => {
    setFilters({
      profileType: undefined,
      segments: [],
      city: undefined,
    });
    setSearchQuery('');
  };

  const hasActiveFilters =
    searchQuery ||
    filters.profileType ||
    (filters.segments && filters.segments.length > 0) ||
    filters.city;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
            Descobrir Perfis
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            Encontre criadores, empresas e oportunidades de negócio
          </p>
        </div>

        {/* Search Bar */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
              <input
                type="text"
                placeholder="Buscar por nome, empresa ou palavra-chave..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900 dark:text-zinc-100"
              />
            </div>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`
                px-4 py-3 rounded-lg font-medium transition-colors flex items-center gap-2
                ${
                  showFilters
                    ? 'bg-blue-600 text-white'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }
              `}
            >
              <Filter className="w-5 h-5" />
              Filtros
            </button>

            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="px-4 py-3 bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400 rounded-lg font-medium hover:bg-red-200 dark:hover:bg-red-950/50 transition-colors flex items-center gap-2"
              >
                <X className="w-5 h-5" />
                Limpar
              </button>
            )}
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800 grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Tipo de Perfil */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Tipo de Perfil
                </label>
                <select
                  value={filters.profileType || ''}
                  onChange={(e) =>
                    handleFilterChange('profileType', e.target.value || undefined)
                  }
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900 dark:text-zinc-100"
                >
                  <option value="">Todos</option>
                  <option value="empresa">Empresa</option>
                  <option value="criador">Criador</option>
                  <option value="revendedor">Revendedor</option>
                </select>
              </div>

              {/* Cidade */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Cidade
                </label>
                <input
                  type="text"
                  placeholder="Ex: São Paulo"
                  value={filters.city || ''}
                  onChange={(e) => handleFilterChange('city', e.target.value || undefined)}
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900 dark:text-zinc-100"
                />
              </div>

              {/* Segmentos */}
              <div className="md:col-span-3">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Segmentos
                </label>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_SEGMENTS.slice(0, 10).map((segment) => (
                    <button
                      key={segment}
                      onClick={() => handleSegmentToggle(segment)}
                      className={`
                        px-3 py-1.5 text-sm rounded-lg transition-colors
                        ${
                          filters.segments?.includes(segment)
                            ? 'bg-blue-600 text-white'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                        }
                      `}
                    >
                      {segment}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Results */}
        {isLoading && profiles.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <>
            {/* Perfis em Destaque (quando não há busca ativa) */}
            {!hasActiveFilters && featuredProfiles.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                  <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                    Em Destaque
                  </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {featuredProfiles.map((profile) => (
                    <ProfileCard key={profile.id} profile={profile} />
                  ))}
                </div>
              </div>
            )}

            {/* Resultados da Busca */}
            {hasActiveFilters && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Users className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
                  <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                    Resultados ({profiles.length})
                  </h2>
                </div>

                {profiles.length === 0 ? (
                  <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-12 text-center">
                    <Search className="w-16 h-16 text-zinc-300 dark:text-zinc-700 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-2">
                      Nenhum perfil encontrado
                    </h3>
                    <p className="text-zinc-600 dark:text-zinc-400">
                      Tente ajustar os filtros ou buscar por outros termos
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {profiles.map((profile) => (
                        <ProfileCard key={profile.id} profile={profile} />
                      ))}
                    </div>

                    {/* Load More */}
                    {hasMore && (
                      <div className="mt-8 text-center">
                        <button
                          onClick={handleLoadMore}
                          disabled={isLoading}
                          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {isLoading ? (
                            <span className="flex items-center gap-2">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Carregando...
                            </span>
                          ) : (
                            'Carregar mais'
                          )}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
