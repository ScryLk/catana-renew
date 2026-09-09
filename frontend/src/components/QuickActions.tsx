import type { FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, BookOpen } from 'lucide-react';
import { useState } from 'react';
import { CreateCatalogModal } from './catalog/CreateCatalogModal';

export const QuickActions: FC = () => {
  const navigate = useNavigate();
  const [showCreateModal, setShowCreateModal] = useState(false);

  return (
    <section>
      <h2 className="text-xl font-semibold text-zinc-100 mb-4">Ações Rápidas</h2>

      <div className="space-y-3">
        <button
          onClick={() => navigate('/editor')}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 font-medium rounded-lg transition-colors cursor-pointer"
        >
          <BookOpen className="w-5 h-5" />
          Criar novo catálogo
        </button>

        <button
          onClick={() => navigate('/media')}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-zinc-900 hover:bg-zinc-800 text-zinc-100 font-medium rounded-lg border border-zinc-800 transition-colors cursor-pointer"
        >
          <Upload className="w-5 h-5" />
          Gerenciar mídia
        </button>

        <div className="pt-4">
          <button
            disabled
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-zinc-900 text-zinc-100 font-medium rounded-lg border border-zinc-800 opacity-60 cursor-not-allowed"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Relatórios
            <span className="ml-auto px-2 py-0.5 bg-blue-500/10 text-blue-400 text-xs font-medium rounded border border-blue-500/20">
              Em breve
            </span>
          </button>
        </div>
      </div>

      <CreateCatalogModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} />
    </section>
  );
};
