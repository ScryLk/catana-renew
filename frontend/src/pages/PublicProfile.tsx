/**
 * 👤 Public Profile Page
 *
 * Página de visualização de perfil público com catálogos e interações
 */

import { logger } from '../utils/logger';
import { type FC, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  User,
  MapPin,
  Heart,
  MessageCircle,
  Bookmark,
  BookmarkCheck,
  Eye,
  Grid,
  Share2,
  Loader2,
  ArrowLeft,
} from 'lucide-react';
import { publicProfileService } from '../services/publicProfileService';
import type { PublicProfile, PublicCatalog } from '../types/profile';

export const PublicProfilePage: FC = () => {
  const { profileId, username } = useParams<{ profileId?: string; username?: string }>();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [catalogs, setCatalogs] = useState<PublicCatalog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [catalogsLoading, setCatalogsLoading] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [catalogSortBy, setCatalogSortBy] = useState<'recent' | 'popular' | 'views'>('recent');

  useEffect(() => {
    loadProfile();
  }, [profileId, username]);

  useEffect(() => {
    if (profile) {
      loadCatalogs();
    }
  }, [profile, catalogSortBy]);

  const loadProfile = async () => {
    setIsLoading(true);
    try {
      let profileData: PublicProfile | null = null;

      if (username) {
        profileData = await publicProfileService.getPublicProfileByUsername(username);
      } else if (profileId) {
        profileData = await publicProfileService.getPublicProfile(Number(profileId));
      } else {
        throw new Error('Profile ID or username required');
      }

      // Se profileData for null (404 do endpoint não implementado), profile permanece null
      if (profileData) {
        setProfile(profileData);
        setIsFollowing(profileData.isFollowing || false);
        setIsSaved(profileData.isSaved || false);
      }
    } catch (error: any) {
      // Log apenas para erros inesperados (não 404)
      console.error('Erro ao carregar perfil:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadCatalogs = async () => {
    if (!profile) return;

    setCatalogsLoading(true);
    try {
      const result = await publicProfileService.getProfileCatalogs(profile.id, {
        page: 1,
        pageSize: 12,
        sortBy: catalogSortBy,
      });

      setCatalogs(result.catalogs);
    } catch (error) {
      console.error('Erro ao carregar catálogos:', error);
    } finally {
      setCatalogsLoading(false);
    }
  };

  const handleFollowToggle = async () => {
    if (!profile) return;

    try {
      if (isFollowing) {
        await publicProfileService.unfollowProfile(profile.id);
        setIsFollowing(false);
      } else {
        await publicProfileService.followProfile(profile.id);
        setIsFollowing(true);
      }
    } catch (error) {
      console.error('Erro ao seguir/deixar de seguir:', error);
    }
  };

  const handleSaveToggle = async () => {
    if (!profile) return;

    try {
      if (isSaved) {
        await publicProfileService.unsaveProfile(profile.id);
        setIsSaved(false);
      } else {
        await publicProfileService.saveProfile(profile.id);
        setIsSaved(true);
      }
    } catch (error) {
      console.error('Erro ao salvar perfil:', error);
    }
  };

  const handleCatalogLike = async (catalogId: number) => {
    try {
      const catalog = catalogs.find((c) => c.id === catalogId);
      if (!catalog) return;

      if (catalog.isLiked) {
        const result = await publicProfileService.unlikeCatalog(catalogId);
        setCatalogs((prev) =>
          prev.map((c) =>
            c.id === catalogId
              ? { ...c, isLiked: false, likeCount: result.likeCount }
              : c
          )
        );
      } else {
        const result = await publicProfileService.likeCatalog(catalogId);
        setCatalogs((prev) =>
          prev.map((c) =>
            c.id === catalogId
              ? { ...c, isLiked: true, likeCount: result.likeCount }
              : c
          )
        );
      }
    } catch (error) {
      console.error('Erro ao curtir catálogo:', error);
    }
  };

  const handleShareProfile = () => {
    if (!profile) return;
    const url = publicProfileService.getProfilePublicUrl(profile.username);
    navigator.clipboard.writeText(url);
    // TODO: Mostrar toast de sucesso
  };

  const handleOpenChat = () => {
    if (!profile) return;
    // TODO: Abrir chat com o usuário
    logger.debug('Abrir chat com:', profile.id);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <User className="w-16 h-16 text-zinc-300 dark:text-zinc-700 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
            Perfil não encontrado
          </h2>
          <button
            onClick={() => navigate('/discover')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Voltar para descoberta
          </button>
        </div>
      </div>
    );
  }

  const getProfileTypeColor = (type: string): string => {
    const colors: Record<string, string> = {
      empresa: 'bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400',
      criador: 'bg-purple-100 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400',
      revendedor: 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400',
    };
    return colors[type] || 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400';
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Cover Image */}
      <div className="relative h-64 bg-gradient-to-br from-blue-600 to-purple-600">
        {profile.coverImage && (
          <img
            src={profile.coverImage}
            alt="Cover"
            className="w-full h-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />

        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 p-2 bg-white/10 backdrop-blur-sm text-white rounded-lg hover:bg-white/20 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Profile Header */}
        <div className="relative -mt-20 mb-8">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-lg">
            <div className="flex flex-col md:flex-row gap-6">
              {/* Avatar */}
              <div className="flex-shrink-0 -mt-16">
                {profile.avatar ? (
                  <img
                    src={profile.avatar}
                    alt={profile.displayName}
                    className="w-32 h-32 rounded-full object-cover ring-4 ring-white dark:ring-zinc-900"
                  />
                ) : (
                  <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center ring-4 ring-white dark:ring-zinc-900">
                    <User className="w-16 h-16 text-white" />
                  </div>
                )}
              </div>

              {/* Profile Info */}
              <div className="flex-1">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div>
                    <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
                      {profile.displayName}
                    </h1>
                    <div className="flex flex-wrap items-center gap-3 mb-3">
                      <span className={`px-3 py-1 text-sm font-medium rounded-lg ${getProfileTypeColor(profile.profileType)}`}>
                        {profile.profileType.charAt(0).toUpperCase() + profile.profileType.slice(1)}
                      </span>
                      {(profile.city || profile.state) && (
                        <div className="flex items-center gap-1 text-zinc-600 dark:text-zinc-400">
                          <MapPin className="w-4 h-4" />
                          <span className="text-sm">
                            {[profile.city, profile.state].filter(Boolean).join(', ')}
                          </span>
                        </div>
                      )}
                    </div>
                    <p className="text-zinc-600 dark:text-zinc-400 max-w-2xl">
                      {profile.bio}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleShareProfile}
                      className="p-3 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                      title="Compartilhar perfil"
                    >
                      <Share2 className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
                    </button>
                    <button
                      onClick={handleSaveToggle}
                      className={`p-3 border rounded-lg transition-colors ${
                        isSaved
                          ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800'
                          : 'border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      }`}
                      title={isSaved ? 'Remover dos salvos' : 'Salvar perfil'}
                    >
                      {isSaved ? (
                        <BookmarkCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      ) : (
                        <Bookmark className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
                      )}
                    </button>
                    {profile.allowMessages && (
                      <button
                        onClick={handleOpenChat}
                        className="px-6 py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors flex items-center gap-2 font-medium"
                      >
                        <MessageCircle className="w-5 h-5" />
                        Conversar
                      </button>
                    )}
                    <button
                      onClick={handleFollowToggle}
                      className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                        isFollowing
                          ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {isFollowing ? 'Seguindo' : 'Seguir'}
                    </button>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-6 mt-6 pt-6 border-t border-zinc-200 dark:border-zinc-800">
                  <div>
                    <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                      {profile.catalogCount}
                    </div>
                    <div className="text-sm text-zinc-600 dark:text-zinc-400">Catálogos</div>
                  </div>
                  {profile.followersCount !== undefined && (
                    <div>
                      <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                        {profile.followersCount}
                      </div>
                      <div className="text-sm text-zinc-600 dark:text-zinc-400">Seguidores</div>
                    </div>
                  )}
                </div>

                {/* Segments */}
                {profile.segments.length > 0 && (
                  <div className="mt-4">
                    <div className="flex flex-wrap gap-2">
                      {profile.segments.map((segment, index) => (
                        <span
                          key={index}
                          className="px-3 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm rounded-md"
                        >
                          {segment}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* About Section */}
        {profile.description && (
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 mb-6">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
              Sobre
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">
              {profile.description}
            </p>
          </div>
        )}

        {/* Catalogs Section */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Grid className="w-5 h-5" />
              Catálogos Públicos
            </h2>

            <select
              value={catalogSortBy}
              onChange={(e) => setCatalogSortBy(e.target.value as any)}
              className="px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900 dark:text-zinc-100"
            >
              <option value="recent">Mais recentes</option>
              <option value="popular">Mais populares</option>
              <option value="views">Mais visualizados</option>
            </select>
          </div>

          {catalogsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : catalogs.length === 0 ? (
            <div className="text-center py-12">
              <Grid className="w-16 h-16 text-zinc-300 dark:text-zinc-700 mx-auto mb-4" />
              <p className="text-zinc-600 dark:text-zinc-400">
                Nenhum catálogo público ainda
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {catalogs.map((catalog) => (
                <div
                  key={catalog.id}
                  className="group border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-700 transition-all cursor-pointer"
                  onClick={() => navigate(`/catalog/${catalog.id}`)}
                >
                  {/* Cover */}
                  <div className="relative h-48 bg-zinc-100 dark:bg-zinc-800">
                    {catalog.coverImage ? (
                      <img
                        src={catalog.coverImage}
                        alt={catalog.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Grid className="w-12 h-12 text-zinc-300 dark:text-zinc-700" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-4">
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {catalog.title}
                    </h3>
                    {catalog.description && (
                      <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2 mb-3">
                        {catalog.description}
                      </p>
                    )}

                    {/* Stats */}
                    <div className="flex items-center justify-between pt-3 border-t border-zinc-200 dark:border-zinc-800">
                      <div className="flex items-center gap-3 text-sm text-zinc-600 dark:text-zinc-400">
                        <div className="flex items-center gap-1">
                          <Eye className="w-4 h-4" />
                          {catalog.viewCount}
                        </div>
                        <div className="flex items-center gap-1">
                          <Heart className={catalog.isLiked ? 'w-4 h-4 fill-red-500 text-red-500' : 'w-4 h-4'} />
                          {catalog.likeCount}
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCatalogLike(catalog.id);
                        }}
                        className={`p-2 rounded-lg transition-colors ${
                          catalog.isLiked
                            ? 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400'
                            : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                        }`}
                      >
                        <Heart className={catalog.isLiked ? 'w-4 h-4 fill-current' : 'w-4 h-4'} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
