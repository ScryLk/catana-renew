import { useState, useEffect } from 'react';
import type { FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { BookOpen, Trash2 } from 'lucide-react';
import { dashboardService } from '@/services/dashboardService';
import type { Catalog } from '@/types/api';

export const RecentCatalogs: FC = () => {
  const navigate = useNavigate();
  const [catalogs, setCatalogs] = useState<Catalog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCatalogs = async () => {
      try {
        setIsLoading(true);

        // Get context from localStorage
        const storedSede = localStorage.getItem('active_sede');
        const storedOrg = localStorage.getItem('active_organization');

        // Helper to extract ID
        const getId = (item: string | null) => {
          if (!item) return undefined;
          try {
            const parsed = JSON.parse(item);
            return parsed.id ? Number(parsed.id) : Number(item);
          } catch {
            return Number(item);
          }
        };

        const params = {
          sede: getId(storedSede),
          organization: getId(storedOrg)
        };

        const data = await dashboardService.getRecentCatalogs(params);
        setCatalogs(data);
      } catch (error) {
        console.error('Failed to fetch recent catalogs:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCatalogs();

    // Add event listener for context changes
    const handleStorageChange = () => fetchCatalogs();
    window.addEventListener('storage', handleStorageChange);
    // Custom event dispatch is common in SPAs for local storage updates within same tab
    window.addEventListener('local-storage-update', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('local-storage-update', handleStorageChange);
    };
  }, []);

  if (isLoading) {
    return (
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-zinc-100">Meus Catálogos</h2>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-100 mx-auto mb-4"></div>
            <p className="text-zinc-400">Carregando catálogos...</p>
          </div>
        </div>
      </section>
    );
  }

  if (catalogs.length === 0) {
    return (
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-zinc-100">Meus Catálogos</h2>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
          <BookOpen className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
          <h3 className="text-zinc-100 font-medium mb-1">Você ainda não possui catálogos cadastrados</h3>
          <p className="text-zinc-400 mb-6">Crie seu primeiro catálogo para começar.</p>
          <Button
            onClick={() => navigate('/editor')}
            variant="default"
            className="bg-zinc-100 hover:bg-zinc-200 text-zinc-900 cursor-pointer"
          >
            Criar catálogo
          </Button>
        </div>
      </section>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Publicado
          </span>
        );
      case 'draft':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
            Rascunho
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Publicado
          </span>
        );
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

    if (diffInHours < 1) {
      const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
      return `Há ${diffInMinutes} minutos`;
    } else if (diffInHours < 24) {
      return `Há ${diffInHours} ${diffInHours === 1 ? 'hora' : 'horas'}`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      return `Há ${diffInDays} ${diffInDays === 1 ? 'dia' : 'dias'}`;
    }
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-zinc-100">Meus Catálogos</h2>
        <div className="flex items-center gap-3">
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar..."
              className="w-64 h-9 pl-9 pr-4 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-700 focus:border-transparent"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <button className="p-2 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer">
            <svg className="w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
          </button>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-zinc-800">
              <tr>
                <th className="text-left py-4 px-6 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Nome do Catálogo
                </th>
                <th className="text-left py-4 px-6 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left py-4 px-6 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Última Atualização
                </th>
                <th className="text-left py-4 px-6 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {catalogs.map((catalog, index) => {
                const iconColors = [
                  { bg: 'bg-blue-500/10', text: 'text-blue-500' },
                  { bg: 'bg-emerald-500/10', text: 'text-emerald-500' },
                  { bg: 'bg-orange-500/10', text: 'text-orange-500' },
                ];
                const colorIndex = index % iconColors.length;
                const color = iconColors[colorIndex];

                return (
                  <tr
                    key={catalog.id}
                    onClick={() => navigate(`/editor/${catalog.id}`)}
                    className="hover:bg-zinc-800/50 transition-colors cursor-pointer"
                  >
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg ${color.bg} flex items-center justify-center`}>
                          <BookOpen className={`w-5 h-5 ${color.text}`} />
                        </div>
                        <div>
                          <p className="font-medium text-zinc-100">{catalog.title}</p>
                          <p className="text-sm text-zinc-400">{catalog.pages_count || 0} páginas</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      {getStatusBadge(catalog.status || 'published')}
                    </td>
                    <td className="py-4 px-6 text-zinc-400">
                      {formatDate(catalog.updated_at)}
                    </td>
                    <td className="py-4 px-6">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm('Tem certeza que deseja excluir este catálogo?')) {
                            dashboardService.deleteCatalog(catalog.id)
                              .then(() => {
                                setCatalogs(catalogs.filter(c => c.id !== catalog.id));
                              })
                              .catch((err: any) => console.error('Erro ao excluir:', err));
                          }
                        }}
                        className="p-2 hover:bg-red-900/20 rounded-lg transition-colors cursor-pointer group"
                        title="Excluir catálogo"
                      >
                        <Trash2 className="w-5 h-5 text-zinc-400 group-hover:text-red-400" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
