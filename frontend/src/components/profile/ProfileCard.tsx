/**
 * 👤 Profile Card Component
 *
 * Card de perfil para exibição em listas e resultados de busca
 */

import { type FC, useState } from 'react';
import { User, Heart, Bookmark, BookmarkCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { ProfileCardData } from '../../types/profile';
import { publicProfileService } from '../../services/publicProfileService';

interface ProfileCardProps {
  profile: ProfileCardData;
  onFollowChange?: (profileId: number, isFollowing: boolean) => void;
  onSaveChange?: (profileId: number, isSaved: boolean) => void;
}

export const ProfileCard: FC<ProfileCardProps> = ({
  profile,
  onFollowChange,
  onSaveChange,
}) => {
  const navigate = useNavigate();
  const [isFollowing, setIsFollowing] = useState(profile.isFollowing || false);
  const [isSaved, setIsSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleFollowToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsLoading(true);

    try {
      if (isFollowing) {
        await publicProfileService.unfollowProfile(profile.id);
        setIsFollowing(false);
        onFollowChange?.(profile.id, false);
      } else {
        await publicProfileService.followProfile(profile.id);
        setIsFollowing(true);
        onFollowChange?.(profile.id, true);
      }
    } catch (error) {
      console.error('Erro ao seguir/deixar de seguir:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsLoading(true);

    try {
      if (isSaved) {
        await publicProfileService.unsaveProfile(profile.id);
        setIsSaved(false);
        onSaveChange?.(profile.id, false);
      } else {
        await publicProfileService.saveProfile(profile.id);
        setIsSaved(true);
        onSaveChange?.(profile.id, true);
      }
    } catch (error) {
      console.error('Erro ao salvar perfil:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCardClick = () => {
    navigate(`/profile/${profile.id}`);
  };

  const getProfileTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      empresa: 'Empresa',
      criador: 'Criador',
      revendedor: 'Revendedor',
    };
    return labels[type] || type;
  };

  const getProfileTypeColor = (type: string): string => {
    const colors: Record<string, string> = {
      empresa: 'bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400',
      criador: 'bg-purple-100 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400',
      revendedor: 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400',
    };
    return colors[type] || 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400';
  };

  return (
    <div
      onClick={handleCardClick}
      className="group bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-700 transition-all cursor-pointer"
    >
      {/* Header com Avatar e Ações */}
      <div className="flex items-start gap-4 mb-4">
        {/* Avatar */}
        <div className="flex-shrink-0">
          {profile.avatar ? (
            <img
              src={profile.avatar}
              alt={profile.displayName}
              className="w-16 h-16 rounded-full object-cover ring-2 ring-zinc-200 dark:ring-zinc-800"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center ring-2 ring-zinc-200 dark:ring-zinc-800">
              <User className="w-8 h-8 text-white" />
            </div>
          )}
        </div>

        {/* Info + Actions */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {profile.displayName}
              </h3>
              <span
                className={`inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded ${getProfileTypeColor(
                  profile.profileType
                )}`}
              >
                {getProfileTypeLabel(profile.profileType)}
              </span>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-1">
              <button
                onClick={handleSaveToggle}
                disabled={isLoading}
                className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                title={isSaved ? 'Remover dos salvos' : 'Salvar perfil'}
              >
                {isSaved ? (
                  <BookmarkCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                ) : (
                  <Bookmark className="w-4 h-4 text-zinc-400" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bio */}
      <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2 mb-4">
        {profile.bio || 'Sem descrição'}
      </p>

      {/* Segments */}
      {profile.segments && profile.segments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {profile.segments.slice(0, 3).map((segment, index) => (
            <span
              key={index}
              className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs rounded-md"
            >
              {segment}
            </span>
          ))}
          {profile.segments.length > 3 && (
            <span className="px-2 py-1 text-zinc-500 dark:text-zinc-400 text-xs">
              +{profile.segments.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="flex items-center justify-between pt-4 border-t border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-4 text-sm text-zinc-600 dark:text-zinc-400">
          <div className="flex items-center gap-1">
            <Heart className="w-4 h-4" />
            <span>{profile.catalogCount || 0} catálogos</span>
          </div>
          {profile.followersCount !== undefined && (
            <div className="flex items-center gap-1">
              <User className="w-4 h-4" />
              <span>{profile.followersCount} seguidores</span>
            </div>
          )}
        </div>

        {/* Follow Button */}
        <button
          onClick={handleFollowToggle}
          disabled={isLoading}
          className={`
            px-4 py-2 text-sm font-medium rounded-lg transition-all
            ${
              isFollowing
                ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
        >
          {isLoading ? 'Aguarde...' : isFollowing ? 'Seguindo' : 'Seguir'}
        </button>
      </div>
    </div>
  );
};
