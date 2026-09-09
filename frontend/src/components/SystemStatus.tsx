import type { FC } from 'react';

import { Server, Database, Cloud, FileText, Video, Headphones, ArrowRight } from 'lucide-react';

const systemItems = [
  {
    id: 'servers',
    title: 'Servidores',
    status: 'Operacional',
    detail: '99.9% uptime',
    icon: Server,
    statusVariant: 'success' as const,
  },
  {
    id: 'database',
    title: 'Banco de Dados',
    status: 'Sincronizado',
    detail: 'Última sync: 14:35',
    icon: Database,
    statusVariant: 'default' as const,
  },
  {
    id: 'cdn',
    title: 'CDN',
    status: 'Otimizado',
    detail: 'Latência: 45ms',
    icon: Cloud,
    statusVariant: 'secondary' as const,
  },
];

const resources = [
  {
    id: 'docs',
    title: 'Documentação',
    description: 'Guias completos sobre como usar o Catana',
    icon: FileText,
  },
  {
    id: 'tutorials',
    title: 'Tutoriais',
    description: 'Vídeos passo a passo para iniciantes',
    icon: Video,
  },
  {
    id: 'support',
    title: 'Suporte',
    description: 'Fale conosco para tirar suas dúvidas',
    icon: Headphones,
  },
];

export const SystemStatus: FC = () => {
  return (
    <div className="space-y-8 mb-8">
      {/* System Status */}
      <section>
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-6">Status do Sistema</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {systemItems.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.id} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 text-center shadow-sm">
                <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-4 text-zinc-600 dark:text-zinc-400">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="font-medium text-zinc-900 dark:text-zinc-100 mb-2">{item.title}</h3>
                <span
                  className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium border mb-2 ${item.status === 'Operacional'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800'
                    : item.status === 'Sincronizado'
                      ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800'
                      : 'bg-zinc-50 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700'
                    }`}
                >
                  {item.status}
                </span>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">{item.detail}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Help & Resources */}
      <section>
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-6">Ajuda & Recursos</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {resources.map((resource) => {
            const Icon = resource.icon;
            return (
              <div
                key={resource.id}
                className="group bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-md transition-all cursor-pointer"
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center group-hover:bg-zinc-900 group-hover:text-white dark:group-hover:bg-zinc-100 dark:group-hover:text-zinc-900 transition-colors duration-200">
                    <Icon className="h-5 w-5 text-zinc-600 dark:text-zinc-400 group-hover:text-white dark:group-hover:text-zinc-900 transition-colors duration-200" />
                  </div>
                  <h3 className="font-medium text-zinc-900 dark:text-zinc-100 text-lg">{resource.title}</h3>
                </div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6 min-h-[40px]">{resource.description}</p>
                <button className="w-full flex items-center justify-center gap-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors py-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                  Acessar <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
