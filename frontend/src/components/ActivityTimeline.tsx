import { useState, useEffect } from 'react';
import type { FC } from 'react';
import { PlusCircle, Image as ImageIcon, Palette, Clock, Trash, FileText, Loader2 } from 'lucide-react';
import { dashboardService } from '@/services/dashboardService';
import type { Activity } from '@/types/api';

export const ActivityTimeline: FC = () => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        setIsLoading(true);
        const data = await dashboardService.getActivities();
        setActivities(data);
      } catch (error) {
        console.error('Failed to fetch activities:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchActivities();
  }, []);

  const getActivityIcon = (action: string) => {
    const lowerAction = action.toLowerCase();
    if (lowerAction.includes('create') || lowerAction.includes('add')) return PlusCircle;
    if (lowerAction.includes('update') || lowerAction.includes('edit')) return Palette;
    if (lowerAction.includes('delete') || lowerAction.includes('remove')) return Trash;
    if (lowerAction.includes('upload')) return ImageIcon;
    return FileText;
  };

  const getActivityType = (action: string) => {
    const lowerAction = action.toLowerCase();
    if (lowerAction.includes('create') || lowerAction.includes('add')) return 'create';
    if (lowerAction.includes('update') || lowerAction.includes('edit')) return 'update';
    if (lowerAction.includes('delete') || lowerAction.includes('remove')) return 'delete';
    return 'info';
  };

  if (isLoading) {
    return (
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-6">Atividade Recente</h2>
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm">
          <div className="flex items-center justify-center h-40">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
          </div>
        </div>
      </section>
    );
  }

  if (activities.length === 0) {
    return (
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-6">Atividade Recente</h2>
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm text-center">
          <p className="text-zinc-500 dark:text-zinc-400">Nenhuma atividade recente.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-8">
      <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-6">Atividade Recente</h2>

      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-6">
          <Clock className="h-5 w-5 text-zinc-500 dark:text-zinc-400" />
          <h3 className="font-medium text-zinc-900 dark:text-zinc-100">Últimas Atualizações</h3>
        </div>

        <div className="relative space-y-8">
          {/* Timeline line */}
          <div className="absolute left-5 top-2 bottom-2 w-px bg-zinc-200 dark:bg-zinc-800" />

          {activities.map((activity) => {
            const Icon = getActivityIcon(activity.action);
            const type = getActivityType(activity.action);

            return (
              <div key={activity.id} className="relative flex items-start gap-4 group">
                <div
                  className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 group-hover:border-zinc-300 dark:group-hover:border-zinc-700 transition-colors`}
                >
                  <Icon className={`h-4 w-4 text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 transition-colors`} />
                </div>
                <div className="flex-1 min-w-0 pt-2">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{activity.action}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {new Date(activity.timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 uppercase tracking-wide font-medium">
                      {type}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 pt-4 border-t border-zinc-100 dark:border-zinc-800">
          <button className="w-full text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 font-medium transition-colors text-center">
            Ver todas as atividades →
          </button>
        </div>
      </div>
    </section>
  );
};
