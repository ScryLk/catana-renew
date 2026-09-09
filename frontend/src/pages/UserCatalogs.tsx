import { useState, useEffect } from 'react';
import type { FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import { catalogService } from '../services/catalogService';
import { Catalog } from '@/types/api';
import {
    Loader2,
    Plus,
    BookOpen,
    FileEdit,
    Trash2,
    Calendar,
    Search,
    LayoutTemplate,
    Sparkles,
    Download,
    ChevronUp,
    ChevronDown,
    ChevronsUpDown
} from 'lucide-react';
import { toast } from 'sonner';

import { CreateCatalogModal } from '../components/catalog/CreateCatalogModal';
import { EditCatalogModal } from '../components/catalog/EditCatalogModal';
import { GerarDemoModal } from '../components/catalog/GerarDemoModal';
import { loadImportedCatalog } from '../services/catalogLoader.service';
import { exportCatalog, downloadCatalogJSON } from '../services/catalogIO.service';

export const UserCatalogs: FC = () => {
    const navigate = useNavigate();
    const [catalogs, setCatalogs] = useState<Catalog[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showDeleteModal, setShowDeleteModal] = useState<number | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showDemoModal, setShowDemoModal] = useState(false);
    const [editingCatalog, setEditingCatalog] = useState<Catalog | null>(null);
    const [exportingId, setExportingId] = useState<number | null>(null);
    const [sortField, setSortField] = useState<'title' | 'created_at'>('created_at');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

    useEffect(() => {
        loadCatalogs();
    }, []);

    const handleOpenStudio = (catalog: Catalog) => {
        navigate(`/studio?catalog=${catalog.id}`, {
            state: {
                catalogId: catalog.id,
                catalogName: catalog.title
            }
        });
    };

    const handleExport = async (catalog: Catalog) => {
        setExportingId(catalog.id);
        try {
            const loaded = await loadImportedCatalog(catalog.id);
            if (!loaded.pages || loaded.pages.length === 0) {
                toast.error('Este catálogo não tem conteúdo para exportar.');
                return;
            }
            const envelope = exportCatalog(loaded.pages, catalog.title || 'Catalogo', { description: catalog.description || '' });
            const slug = (catalog.title || 'catalogo').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
            downloadCatalogJSON(envelope, `${slug}.catana.json`);
            toast.success(`"${catalog.title}" exportado (JSON).`);
        } catch (err) {
            console.error('[UserCatalogs] export JSON falhou:', err);
            toast.error('Erro ao exportar catálogo.');
        } finally {
            setExportingId(null);
        }
    };

    const loadCatalogs = async () => {
        setLoading(true);
        try {
            const storedSede = localStorage.getItem('active_sede');
            const storedOrg = localStorage.getItem('active_organization');

            const getId = (item: string | null) => {
                if (!item) return undefined;
                try {
                    const parsed = JSON.parse(item);
                    return parsed.id ? Number(parsed.id) : Number(item);
                } catch {
                    return Number(item);
                }
            };

            const sedeId = getId(storedSede);
            const orgId = getId(storedOrg);
            const params: { sede?: number; organization?: number } = {};

            if (sedeId && !isNaN(sedeId)) {
                params.sede = sedeId;
            } else if (orgId && !isNaN(orgId)) {
                params.organization = orgId;
            }

            const data = await catalogService.getAllCatalogs(params);
            setCatalogs(data);
        } catch (error) {
            console.error('Erro ao carregar catálogos:', error);
            toast.error('Erro ao carregar catálogos');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: number) => {
        try {
            await catalogService.deleteCatalog(id);
            toast.success('Catálogo excluído com sucesso');
            setCatalogs(catalogs.filter(c => c.id !== id));
            setShowDeleteModal(null);
        } catch (error) {
            console.error('Erro ao excluir catálogo:', error);
            toast.error('Erro ao excluir catálogo');
        }
    };

    const handleTogglePublic = async (catalog: Catalog) => {
        const newStatus = !catalog.is_public;
        try {
            setCatalogs(prev => prev.map(c => c.id === catalog.id ? { ...c, is_public: newStatus } : c));
            await catalogService.updateCatalog(catalog.id, { is_public: newStatus });
            toast.success(newStatus ? 'Catálogo visível no Explorer' : 'Catálogo ocultado do Explorer');
        } catch (error) {
            console.error('Erro ao alterar visibilidade:', error);
            toast.error('Erro ao alterar visibilidade');
            setCatalogs(prev => prev.map(c => c.id === catalog.id ? { ...c, is_public: !newStatus } : c));
        }
    };

    const handleSort = (field: 'title' | 'created_at') => {
        if (sortField === field) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const filteredCatalogs = catalogs
        .filter(catalog => catalog.title.toLowerCase().includes(searchTerm.toLowerCase()) || (catalog.description && catalog.description.toLowerCase().includes(searchTerm.toLowerCase())))
        .sort((a, b) => {
            if (sortField === 'title') {
                return sortDirection === 'asc' ? a.title.localeCompare(b.title) : b.title.localeCompare(a.title);
            } else {
                const dateA = new Date(a.created_at).getTime();
                const dateB = new Date(b.created_at).getTime();
                return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
            }
        });

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex">
            <Sidebar />
            <div className="flex-1 ml-16 flex flex-col min-w-0">
                <Header />
                <main className="flex-1 p-8 pt-20 max-w-7xl mx-auto w-full">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">Meus Catálogos</h1>
                            <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
                                Gerencie e acesse seus catálogos no Katana 2.0 AI Studio
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setShowDemoModal(true)}
                                className="flex items-center gap-2 px-4 py-2 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                            >
                                <Sparkles className="h-4 w-4 text-amber-500" />
                                <span>Gerar Demonstração</span>
                            </button>
                            <button
                                onClick={() => setShowCreateModal(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-950 rounded-lg text-sm font-medium transition-colors cursor-pointer shadow-sm"
                            >
                                <Plus className="h-4 w-4" />
                                <span>Novo Catálogo</span>
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 mb-6">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                            <input
                                type="text"
                                placeholder="Buscar catálogos..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 transition-shadow"
                            />
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <Loader2 className="h-8 w-8 animate-spin text-zinc-400 mb-4" />
                            <p className="text-zinc-500 text-sm">Carregando seus catálogos...</p>
                        </div>
                    ) : filteredCatalogs.length === 0 ? (
                        <div className="text-center py-16 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl p-8">
                            <BookOpen className="h-10 w-10 text-zinc-400 mx-auto mb-4" />
                            <h3 className="text-base font-semibold mb-1">Nenhum catálogo encontrado</h3>
                            <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-6 max-w-sm mx-auto">
                                {searchTerm ? 'Tente ajustar sua busca para encontrar o catálogo desejado.' : 'Crie seu primeiro catálogo comercial com inteligência artificial.'}
                            </p>
                            <button
                                onClick={() => setShowCreateModal(true)}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-950 rounded-lg text-sm font-medium transition-colors"
                            >
                                <Plus className="h-4 w-4" />
                                <span>Criar Catálogo</span>
                            </button>
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-xs">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                        <tr>
                                            <th className="px-6 py-3 cursor-pointer hover:text-zinc-700 dark:hover:text-zinc-200" onClick={() => handleSort('title')}>
                                                <div className="flex items-center gap-1.5">
                                                    <span>Título</span>
                                                    {sortField === 'title' ? (sortDirection === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />) : <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />}
                                                </div>
                                            </th>
                                            <th className="px-6 py-3">Explorer</th>
                                            <th className="px-6 py-3 cursor-pointer hover:text-zinc-700 dark:hover:text-zinc-200" onClick={() => handleSort('created_at')}>
                                                <div className="flex items-center gap-1.5">
                                                    <span>Data</span>
                                                    {sortField === 'created_at' ? (sortDirection === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />) : <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />}
                                                </div>
                                            </th>
                                            <th className="px-6 py-3 text-right">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                                        {filteredCatalogs.map((catalog) => (
                                            <tr
                                                key={catalog.id}
                                                onClick={() => handleOpenStudio(catalog)}
                                                className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors"
                                            >
                                                <td className="px-6 py-4 font-medium">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-9 w-9 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 shrink-0">
                                                            <BookOpen className="h-4 w-4" />
                                                        </div>
                                                        <div>
                                                            <div className="font-semibold text-zinc-900 dark:text-zinc-100">{catalog.title}</div>
                                                            {catalog.description && (
                                                                <div className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-1">{catalog.description}</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => handleTogglePublic(catalog)}
                                                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${catalog.is_public ? 'bg-zinc-900 dark:bg-zinc-100' : 'bg-zinc-200 dark:bg-zinc-800'}`}
                                                            title={catalog.is_public ? "Visível no Explorer" : "Oculto no Explorer"}
                                                        >
                                                            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white dark:bg-zinc-950 transition-transform ${catalog.is_public ? 'translate-x-4.5' : 'translate-x-1'}`} />
                                                        </button>
                                                        <span className="text-xs text-zinc-500">
                                                            {catalog.is_public ? 'Visível' : 'Oculto'}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-xs text-zinc-500">
                                                    <div className="flex items-center gap-1.5">
                                                        <Calendar className="h-3.5 w-3.5 text-zinc-400" />
                                                        <span>{new Date(catalog.created_at).toLocaleDateString('pt-BR')}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                                                    <div className="flex items-center justify-end gap-1">
                                                        <button
                                                            onClick={() => handleOpenStudio(catalog)}
                                                            title="Abrir no Katana Studio"
                                                            className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                                                        >
                                                            <LayoutTemplate className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleExport(catalog)}
                                                            disabled={exportingId === catalog.id}
                                                            title="Exportar JSON"
                                                            className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                                                        >
                                                            {exportingId === catalog.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                                                        </button>
                                                        <button
                                                            onClick={() => setEditingCatalog(catalog)}
                                                            title="Editar Informações"
                                                            className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                                                        >
                                                            <FileEdit className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => setShowDeleteModal(catalog.id)}
                                                            title="Excluir"
                                                            className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-colors cursor-pointer"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </main>
            </div>

            {/* Modals */}
            <CreateCatalogModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onSuccess={() => {
                    setShowCreateModal(false);
                    loadCatalogs();
                }}
            />

            {editingCatalog && (
                <EditCatalogModal
                    isOpen={!!editingCatalog}
                    catalog={editingCatalog}
                    onClose={() => setEditingCatalog(null)}
                    onSuccess={() => {
                        setEditingCatalog(null);
                        loadCatalogs();
                        toast.success('Catálogo atualizado');
                    }}
                />
            )}

            <GerarDemoModal
                isOpen={showDemoModal}
                onClose={() => setShowDemoModal(false)}
                onSuccess={() => {
                    setShowDemoModal(false);
                    navigate('/studio-demo');
                }}
            />

            {showDeleteModal && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 max-w-sm w-full">
                        <h3 className="text-base font-semibold mb-2">Excluir Catálogo?</h3>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-6">
                            Esta ação é permanente e removerá todas as páginas e configurações associadas a este catálogo.
                        </p>
                        <div className="flex items-center justify-end gap-3">
                            <button
                                onClick={() => setShowDeleteModal(null)}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => handleDelete(showDeleteModal)}
                                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium"
                            >
                                Confirmar Exclusão
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
