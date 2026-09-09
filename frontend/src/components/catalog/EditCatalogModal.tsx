import { useState, useEffect, FC } from 'react';
import { Loader2, X, Save } from 'lucide-react';
import { catalogService } from '../../services/catalogService';
import { Catalog } from '@/types/api';

interface EditCatalogModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    catalog: Catalog | null;
}

export const EditCatalogModal: FC<EditCatalogModalProps> = ({ isOpen, onClose, onSuccess, catalog }) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (catalog) {
            setName(catalog.title);
            setDescription(catalog.description || '');
        }
    }, [catalog]);

    if (!isOpen || !catalog) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        setLoading(true);
        setError('');

        try {
            await catalogService.updateCatalog(catalog.id, {
                title: name,
                description: description
            });

            onSuccess();
            onClose();
        } catch (err: any) {
            console.error('Failed to update catalog:', err);
            const errorMessage = err.response?.data?.error || 'Erro ao atualizar catálogo. Tente novamente.';
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-zinc-900 rounded-xl max-w-md w-full p-6 shadow-xl border border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Editar Catálogo</h2>
                    <button
                        onClick={onClose}
                        className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="mb-6">
                        <label htmlFor="edit-catalog-name" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                            Nome do Catálogo
                        </label>
                        <input
                            id="edit-catalog-name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Ex: Coleção Verão 2025"
                            className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 transition-all mb-4"
                            autoFocus
                        />

                        <label htmlFor="edit-catalog-description" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                            Descrição (Opcional)
                        </label>
                        <textarea
                            id="edit-catalog-description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Adicione uma breve descrição..."
                            className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 transition-all resize-none h-24"
                        />
                        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
                    </div>

                    <div className="flex items-center justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors font-medium text-sm"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !name.trim()}
                            className="flex items-center gap-2 px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Salvar Alterações
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
