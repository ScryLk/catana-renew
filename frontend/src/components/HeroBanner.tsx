import type { FC } from 'react';

import { Calendar, Clock } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

export const HeroBanner: FC = () => {
  const user = useAuthStore((state) => state.user);
  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long'
  });
  const timeStr = now.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
            Bem-vindo de volta, {user?.name || 'Usuário'}! 👋
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400">
            Aqui está um resumo do seu catálogo hoje
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-6 text-zinc-600 dark:text-zinc-400">
          <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-800/50 px-3 py-1.5 rounded-lg border border-zinc-100 dark:border-zinc-800">
            <Calendar className="w-4 h-4" />
            <span className="text-sm font-medium">Hoje, {dateStr}</span>
          </div>

          <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-800/50 px-3 py-1.5 rounded-lg border border-zinc-100 dark:border-zinc-800">
            <Clock className="w-4 h-4" />
            <span className="text-sm font-medium">Última sincronização: {timeStr}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
