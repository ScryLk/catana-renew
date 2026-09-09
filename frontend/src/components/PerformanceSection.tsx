import type { FC } from 'react';

import { TrendingUp, Eye } from 'lucide-react';

import { useCatalogStats } from '../hooks/useCatalogStats';

export const PerformanceSection: FC = () => {
  const { timeRange, setTimeRange, chartData, topCatalogs, loading } = useCatalogStats();

  if (loading) {
    return (
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-6">Visão Geral de Performance</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm h-[400px] flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-900 dark:border-zinc-100" />
          </div>
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm h-[400px] flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-900 dark:border-zinc-100" />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-8">
      <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-6">Visão Geral de Performance</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-medium text-zinc-900 dark:text-zinc-100">Visualizações dos Catálogos</h3>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as any)}
              className="px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-200 dark:focus:ring-zinc-700"
            >
              <option value="7d">Últimos 7 dias</option>
              <option value="30d">Últimos 30 dias</option>
              <option value="90d">Últimos 90 dias</option>
            </select>
          </div>
          <div className="space-y-4">
            {chartData.map((item) => (
              <div key={item.day} className="flex items-center gap-3">
                <span className="text-sm text-zinc-500 dark:text-zinc-400 w-12 font-medium">{item.day}</span>
                <div className="flex-1 bg-zinc-100 dark:bg-zinc-800 rounded-full h-8 overflow-hidden">
                  <div
                    className="bg-zinc-900 dark:bg-zinc-100 h-full rounded-full flex items-center justify-end px-3 transition-all duration-500 hover:bg-zinc-800 dark:hover:bg-zinc-200"
                    style={{ width: `${item.value}%` }}
                  >
                    <span className="text-white dark:text-zinc-900 text-xs font-medium">{item.label}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Catalogs */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="h-5 w-5 text-zinc-500 dark:text-zinc-400" />
            <h3 className="font-medium text-zinc-900 dark:text-zinc-100">Top Catálogos por Visualização</h3>
          </div>
          <div className="space-y-4">
            {topCatalogs.map((catalog) => (
              <div
                key={catalog.rank}
                className="flex items-center gap-4 p-3 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors border border-transparent hover:border-zinc-100 dark:hover:border-zinc-700"
              >
                <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center font-semibold text-sm text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700">
                  {catalog.rank}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-zinc-900 dark:text-zinc-100">{catalog.name}</div>
                  <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
                    <Eye className="h-3.5 w-3.5" />
                    {catalog.views.toLocaleString()} visualizações
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-full border border-emerald-100 dark:border-emerald-800">
                  <TrendingUp className="h-3 w-3" />
                  +{catalog.trend}%
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
