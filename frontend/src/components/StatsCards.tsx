import { useState, useEffect } from 'react';
import type { FC } from 'react';
import { BookOpen, Package, Loader2 } from 'lucide-react';
import { dashboardService } from '@/services/dashboardService';
import type { DashboardStats } from '@/types/api';

export const StatsCards: FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await dashboardService.getStats();
        setStats(data);
      } catch (err) {
        console.error('Erro ao carregar estatísticas:', err);
        setError('Não foi possível carregar as estatísticas');
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-card rounded-xl border p-6 flex items-center justify-center h-32"
          >
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ))}
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-6 text-center">
        <p className="text-destructive font-medium">
          {error || 'Erro ao carregar dados'}
        </p>
      </div>
    );
  }

  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat('pt-BR').format(num);
  };

  const statsConfig = [
    {
      title: 'Total de Catálogos',
      value: formatNumber(stats.catalogs),
      badge: 'Publicado',
      badgeColor: 'emerald',
      icon: BookOpen,
      iconBg: 'bg-blue-500/10',
      iconColor: 'text-blue-500',
    },
    {
      title: 'Publicados',
      value: formatNumber(stats.products),
      badge: 'Publicado',
      badgeColor: 'emerald',
      icon: Package,
      iconBg: 'bg-emerald-500/10',
      iconColor: 'text-emerald-500',
    },
    {
      title: 'Rascunhos',
      value: formatNumber(stats.library),
      badge: 'Rascunho',
      badgeColor: 'gray',
      icon: BookOpen,
      iconBg: 'bg-zinc-500/10',
      iconColor: 'text-zinc-400',
    },
    {
      title: 'Arquivados',
      value: formatNumber(stats.history),
      badge: 'Arquivado',
      badgeColor: 'orange',
      icon: BookOpen,
      iconBg: 'bg-orange-500/10',
      iconColor: 'text-orange-500',
    },
  ];

  const getBadgeClasses = (color: string) => {
    switch (color) {
      case 'emerald':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'orange':
        return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
      case 'gray':
      default:
        return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20';
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
      {statsConfig.map((stat) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.title}
            className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 hover:border-zinc-700 transition-colors"
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`rounded-lg p-3 ${stat.iconBg}`}>
                <Icon className={`w-5 h-5 ${stat.iconColor}`} />
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getBadgeClasses(stat.badgeColor)}`}>
                {stat.badge}
              </span>
            </div>
            <p className="text-zinc-400 text-sm mb-2">{stat.title}</p>
            <p className="text-3xl font-bold text-zinc-100">{stat.value}</p>
          </div>
        );
      })}
    </div>
  );
};
