import { useState, type FC } from 'react';
import { X, Loader2, Sparkles, Crown } from 'lucide-react';
import { catalogService, type DemoTema, type DemoEstrutura } from '../../services/catalogService';
import { toast } from 'sonner';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (catalogId: number) => void;
}

// Espelho das personas curadas do backend (nome + cores para o card).
const TEMAS: Array<{ id: DemoTema; nome: string; ramo: string; cores: [string, string, string] }> = [
  { id: 'padaria', nome: 'Pão Dourado', ramo: 'Padaria', cores: ['#8B5E3C', '#D9A05B', '#C8902F'] },
  { id: 'acougue', nome: 'Corte Nobre', ramo: 'Açougue', cores: ['#7A1F2B', '#B23A48', '#E0A458'] },
  { id: 'mercado', nome: 'Hortifruti Verde', ramo: 'Mercado', cores: ['#2E7D32', '#F57C00', '#FBC02D'] },
  { id: 'restaurante', nome: 'Casa Bordô', ramo: 'Restaurante', cores: ['#6B2737', '#A8763E', '#D4AF37'] },
  { id: 'festas', nome: 'Confete & Cia', ramo: 'Festas', cores: ['#E5328A', '#2EA6E5', '#FFC400'] },
  { id: 'boutique', nome: 'Linho & Co', ramo: 'Boutique', cores: ['#1A1A1A', '#9C8E80', '#C9B79C'] },
];

const SECOES: Array<{ id: string; label: string }> = [
  { id: 'capa', label: 'Capa' },
  { id: 'apresentacao', label: 'Apresentação' },
  { id: 'sobre', label: 'Sobre a empresa' },
  { id: 'indice', label: 'Índice' },
  { id: 'divisores', label: 'Divisores de categoria' },
  { id: 'produtos', label: 'Produtos' },
  { id: 'especiais', label: 'Seções especiais' },
  { id: 'precos', label: 'Tabela de preços' },
  { id: 'como_comprar', label: 'Como comprar' },
  { id: 'termos', label: 'Termos' },
  { id: 'contracapa', label: 'Contracapa' },
];

const ESTRUTURAS: Array<{ id: DemoEstrutura; label: string; desc: string }> = [
  { id: 'completo', label: 'Completo', desc: 'Todas as 11 seções' },
  { id: 'essencial', label: 'Essencial', desc: 'Capa, apresentação, produtos, como comprar, contracapa' },
  { id: 'custom', label: 'Personalizado', desc: 'Escolha as seções' },
];

export const GerarDemoModal: FC<Props> = ({ isOpen, onClose, onSuccess }) => {
  const [tema, setTema] = useState<DemoTema | null>(null);
  const [estrutura, setEstrutura] = useState<DemoEstrutura>('completo');
  const [secoes, setSecoes] = useState<string[]>(SECOES.map((s) => s.id));
  const [b2b, setB2b] = useState(false);
  const [premium, setPremium] = useState(true);
  const [gerando, setGerando] = useState(false);

  if (!isOpen) return null;

  const toggleSecao = (id: string) => {
    setSecoes((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  };

  const handleGerar = async () => {
    if (!tema) {
      toast.error('Escolha um ramo para o catálogo demonstração.');
      return;
    }
    setGerando(true);
    try {
      const result = await catalogService.gerarDemo({
        tema,
        estrutura,
        secoes: estrutura === 'custom' ? secoes : undefined,
        b2b,
        identidade_premium: premium,
      });
      toast.success(`Catálogo "${result.title}" gerado (${result.pages} páginas).`);
      onSuccess(result.catalog_id);
    } catch {
      toast.error('Não foi possível gerar o catálogo demonstração.');
    } finally {
      setGerando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-900 rounded-xl max-w-2xl w-full shadow-xl border border-zinc-200 dark:border-zinc-800 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-500" />
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Criar catálogo demonstração</h3>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200" disabled={gerando}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-4 overflow-y-auto space-y-6">
          {/* Temas */}
          <div>
            <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">Escolha o ramo</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {TEMAS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTema(t.id)}
                  className={`text-left rounded-lg border p-3 transition-all ${
                    tema === t.id
                      ? 'border-indigo-500 ring-2 ring-indigo-500/30'
                      : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                  }`}
                >
                  <div className="flex gap-1 mb-2">
                    {t.cores.map((c, i) => (
                      <span key={i} className="w-5 h-5 rounded-full border border-white dark:border-zinc-900" style={{ background: c }} />
                    ))}
                  </div>
                  <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{t.ramo}</div>
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400">{t.nome}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Identidade visual premium */}
          <label className="flex items-start gap-3 p-3 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/60 dark:bg-indigo-950/30 cursor-pointer">
            <input
              type="checkbox"
              checked={premium}
              onChange={(e) => setPremium(e.target.checked)}
              className="mt-1 h-4 w-4 accent-indigo-600"
            />
            <div>
              <div className="flex items-center gap-1.5 text-sm font-medium text-indigo-900 dark:text-indigo-200">
                <Crown className="h-4 w-4 text-indigo-500" />
                Identidade visual premium (showcase)
              </div>
              <div className="text-xs text-indigo-700/80 dark:text-indigo-300/80">
                Adiciona logo, identidade de marca coesa e capa/contracapa caprichadas. Pronto pra divulgação.
              </div>
            </div>
          </label>

          {/* Estrutura */}
          <div>
            <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">Estrutura</h4>
            <div className="space-y-2">
              {ESTRUTURAS.map((e) => (
                <label key={e.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer">
                  <input
                    type="radio"
                    name="estrutura"
                    checked={estrutura === e.id}
                    onChange={() => setEstrutura(e.id)}
                    className="mt-1"
                  />
                  <div>
                    <div className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{e.label}</div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">{e.desc}</div>
                  </div>
                </label>
              ))}
            </div>

            {estrutura === 'custom' && (
              <div className="mt-3 grid grid-cols-2 gap-2 pl-2">
                {SECOES.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer">
                    <input type="checkbox" checked={secoes.includes(s.id)} onChange={() => toggleSecao(s.id)} />
                    {s.label}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* B2B */}
          <label className="flex items-center justify-between p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 cursor-pointer">
            <div>
              <div className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Incluir atacado (B2B)</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">Adiciona tabela de preços por quantidade.</div>
            </div>
            <input type="checkbox" checked={b2b} onChange={(e) => setB2b(e.target.checked)} className="h-4 w-4" />
          </label>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-200 dark:border-zinc-800">
          <button
            onClick={onClose}
            disabled={gerando}
            className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors font-medium text-sm disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleGerar}
            disabled={gerando || !tema}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm disabled:opacity-50"
          >
            {gerando ? <><Loader2 className="h-4 w-4 animate-spin" /> Gerando...</> : <><Sparkles className="h-4 w-4" /> Gerar catálogo</>}
          </button>
        </div>
      </div>
    </div>
  );
};
