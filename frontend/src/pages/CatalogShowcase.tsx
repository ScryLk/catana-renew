import type { FC } from 'react';
import { allProducts } from '../lib/products';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const CatalogShowcase: FC = () => {
  const navigate = useNavigate();

  return (
    <div className="bg-zinc-950 text-zinc-100 min-h-screen p-6 sm:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Showcase de Produtos</h1>
            <p className="text-zinc-400 text-sm mt-1">Coleção cadastrada para abastecimento de spreads</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/studio')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 font-medium text-xs transition-colors cursor-pointer"
          >
            <ArrowLeft className="size-3.5" />
            <span>Voltar ao Studio</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {allProducts.map((p) => (
            <div key={p.code} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <div className="aspect-square bg-zinc-800 rounded-lg overflow-hidden mb-3 flex items-center justify-center">
                  <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                </div>
                <div className="text-[10px] font-mono text-zinc-400 mb-1">{p.code}</div>
                <h3 className="text-sm font-semibold text-zinc-200">{p.name}</h3>
                {p.description && <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{p.description}</p>}
              </div>
              <div className="mt-4 pt-3 border-t border-zinc-800 flex items-center justify-between">
                <span className="text-xs text-zinc-400">Caixa: {p.caixa || '1 un'}</span>
                <span className="text-xs font-mono font-medium text-zinc-300">{p.material || p.category}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
