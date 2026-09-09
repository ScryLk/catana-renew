import { type FC, useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sidebar
} from '../components/Sidebar';
import { Header } from '../components/Header';
import { productService, Product } from '../services/productService';
import { categoryService, Category } from '../services/categoryService';
import { Checkbox } from '../components/ui/checkbox';
import {
  Loader2,
  Plus,
  Search,
  Filter,
  Eye,
  FileEdit,
  Trash2,
  Package,
  Upload,
  Download
} from 'lucide-react';
import { ImportProductsModal } from '../components/products/ImportProductsModal';
import { ExportProductsModal } from '../components/products/ExportProductsModal';

export const Products: FC = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedProducts, setSelectedProducts] = useState<Set<number>>(new Set());
  const [showCategoryFilter, setShowCategoryFilter] = useState(false);
  const [showStatusFilter, setShowStatusFilter] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState<number | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  const isFirstRender = useRef(true);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const delayDebounceFn = setTimeout(() => {
      const fetchFilteredProducts = async () => {
        setLoading(true);
        try {
          await loadProducts();
        } finally {
          setLoading(false);
        }
      };

      fetchFilteredProducts();
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, selectedCategory, selectedStatus]);

  useEffect(() => {
    const handleStorageChange = () => {
      loadData();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('local-storage-update', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('local-storage-update', handleStorageChange);
    };
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadCategories(),
        loadProducts() // loadProducts no longer handles loading state internally
      ]);
    } catch (error) {
      console.error('Failed to load initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const storedSede = localStorage.getItem('active_sede');
      const storedOrg = localStorage.getItem('active_organization');
      const sedeId = storedSede ? JSON.parse(storedSede).id : undefined;
      const orgId = storedOrg ? JSON.parse(storedOrg).id : undefined;

      const data = await categoryService.getCategories({
        organization: orgId,
        sede: sedeId,
      });
      setCategories(data);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const loadProducts = async () => {
    // setLoading(true); // RESPONSIBILITY MOVED UP
    try {
      const storedSede = localStorage.getItem('active_sede');
      const storedOrg = localStorage.getItem('active_organization');
      const sedeId = storedSede ? JSON.parse(storedSede).id : undefined;
      const orgId = storedOrg ? JSON.parse(storedOrg).id : undefined;

      const { products: data } = await productService.getProducts({
        search: searchTerm || undefined,
        category: selectedCategory || undefined,
        sede: sedeId,
        organization: orgId,
      });

      // Filter by status if selected
      let filteredData = data;
      if (selectedStatus === 'active') {
        filteredData = data.filter(p => p.stock > 0);
      } else if (selectedStatus === 'inactive') {
        filteredData = data.filter(p => p.stock === 0);
      }

      setProducts(filteredData);
    } catch (error) {
      console.error('Failed to load products:', error);
    } finally {
      // setLoading(false); // RESPONSIBILITY MOVED UP
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await productService.deleteProduct(id);
      setProducts(products.filter(p => p.id !== id));
      setShowDeleteModal(null);
    } catch (error) {
      console.error('Failed to delete product', error);
      alert('Erro ao excluir produto');
    }
  };

  const toggleSelectAll = () => {
    if (selectedProducts.size === products.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(products.map(p => p.id)));
    }
  };

  const toggleSelectProduct = (id: number) => {
    const newSelected = new Set(selectedProducts);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedProducts(newSelected);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatPrice = (price: number, currency: string) => {
    return `${currency} ${price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const clearFilters = () => {
    setSelectedCategory('');
    setSelectedStatus('');
    setSearchTerm('');
  };

  const hasActiveFilters = selectedCategory || selectedStatus || searchTerm;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950">
      <Sidebar />
      <Header />

      <main className="ml-16 pt-20">
        <div className="p-8 max-w-[1600px] mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
              <div>
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Produtos</h1>
                <p className="text-zinc-500 dark:text-zinc-400 mt-1">
                  Gerencie e organize seus produtos
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowExportModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors font-medium text-sm"
                >
                  <Download className="w-4 h-4" />
                  Exportar
                </button>
                <button
                  onClick={() => setShowImportModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors font-medium text-sm"
                >
                  <Upload className="w-4 h-4" />
                  Importar
                </button>
                <button
                  onClick={() => navigate('/products/new')}
                  className="flex items-center gap-2 px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors font-medium text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Novo Produto
                </button>
              </div>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <div className="flex-1 relative min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Buscar produto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
              />
            </div>

            {/* Category Filter */}
            <div className="relative">
              <button
                onClick={() => setShowCategoryFilter(!showCategoryFilter)}
                className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors text-sm ${selectedCategory
                  ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-zinc-900 dark:border-white'
                  : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                  }`}
              >
                <Filter className="w-4 h-4" />
                Categoria
                <span className="text-xs ml-1">▼</span>
              </button>
              {showCategoryFilter && (
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-lg z-10 max-h-80 overflow-y-auto">
                  <div className="p-1">
                    <button
                      onClick={() => {
                        setSelectedCategory('');
                        setShowCategoryFilter(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm ${!selectedCategory
                        ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium'
                        : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                        }`}
                    >
                      Todas as categorias
                    </button>
                    {categories.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => {
                          setSelectedCategory(cat.id);
                          setShowCategoryFilter(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-md text-sm ${selectedCategory === cat.id
                          ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium'
                          : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                          }`}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Status Filter */}
            <div className="relative">
              <button
                onClick={() => setShowStatusFilter(!showStatusFilter)}
                className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors text-sm ${selectedStatus
                  ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-zinc-900 dark:border-white'
                  : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                  }`}
              >
                Status
                <span className="text-xs ml-1">▼</span>
              </button>
              {showStatusFilter && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-lg z-10">
                  <div className="p-1">
                    <button
                      onClick={() => {
                        setSelectedStatus('');
                        setShowStatusFilter(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm ${!selectedStatus
                        ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium'
                        : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                        }`}
                    >
                      Todos
                    </button>
                    <button
                      onClick={() => {
                        setSelectedStatus('active');
                        setShowStatusFilter(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm ${selectedStatus === 'active'
                        ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium'
                        : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                        }`}
                    >
                      Ativo
                    </button>
                    <button
                      onClick={() => {
                        setSelectedStatus('inactive');
                        setShowStatusFilter(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm ${selectedStatus === 'inactive'
                        ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium'
                        : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                        }`}
                    >
                      Inativo
                    </button>
                  </div>
                </div>
              )}
            </div>

            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 text-sm font-medium"
              >
                Limpar filtros
              </button>
            )}
          </div>

          {/* Products Table */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
            {loading ? (
              <div className="p-8 flex items-center justify-center h-64">
                <div className="text-center">
                  <Loader2 className="h-12 w-12 animate-spin text-zinc-400 mx-auto mb-4" />
                  <p className="text-zinc-500 dark:text-zinc-400">Carregando produtos...</p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[calc(100vh-300px)] overflow-y-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-10">
                    <tr>
                      <th className="w-12 px-6 py-4">
                        <Checkbox
                          checked={products.length > 0 && selectedProducts.size === products.length}
                          onCheckedChange={toggleSelectAll}
                        />
                      </th>
                      <th className="px-6 py-4 font-medium text-zinc-700 dark:text-zinc-300">Produto</th>
                      <th className="px-6 py-4 font-medium text-zinc-700 dark:text-zinc-300">Categoria</th>
                      <th className="px-6 py-4 font-medium text-zinc-700 dark:text-zinc-300">Preço</th>
                      <th className="px-6 py-4 font-medium text-zinc-700 dark:text-zinc-300">Status</th>
                      <th className="px-6 py-4 font-medium text-zinc-700 dark:text-zinc-300">Atualizado em</th>
                      <th className="px-6 py-4 font-medium text-zinc-700 dark:text-zinc-300 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {products.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-zinc-500 dark:text-zinc-400">
                          <div className="flex flex-col items-center justify-center">
                            <Package className="w-12 h-12 text-zinc-200 dark:text-zinc-700 mb-3" strokeWidth={1.5} />
                            <p className="text-base font-medium text-zinc-900 dark:text-zinc-100">Nenhum produto encontrado</p>
                            <p className="text-sm mt-1 mb-4">Comece adicionando seu primeiro produto ao catálogo.</p>
                            <button
                              onClick={() => navigate('/products/new')}
                              className="px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors font-medium text-sm"
                            >
                              Criar Produto
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      products.map((product) => {
                        const category = categories.find(c => c.id === product.category);
                        const isActive = product.stock > 0;

                        return (
                          <tr
                            key={product.id}
                            className="group hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors"
                          >
                            <td className="px-6 py-4">
                              <Checkbox
                                checked={selectedProducts.has(product.id)}
                                onCheckedChange={() => toggleSelectProduct(product.id)}
                              />
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-zinc-100 dark:bg-zinc-800 rounded-lg flex-shrink-0 overflow-hidden border border-zinc-200 dark:border-zinc-700 flex items-center justify-center">
                                  {product.image_url ? (
                                    <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <Package className="w-6 h-6 text-zinc-300 dark:text-zinc-600" />
                                  )}
                                </div>
                                <div>
                                  <div className="font-medium text-zinc-900 dark:text-zinc-100 text-sm">{product.name}</div>
                                  <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                                    SKU: {product.sku}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-zinc-600 dark:text-zinc-300">
                              {category?.name || '-'}
                            </td>
                            <td className="px-6 py-4 text-sm text-zinc-900 dark:text-zinc-100 font-medium">
                              {formatPrice(Number(product.price), product.currency)}
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${isActive
                                  ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/10 dark:text-green-400 dark:border-green-900/20'
                                  : 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700'
                                  }`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${isActive ? 'bg-green-500' : 'bg-zinc-400'}`} />
                                {isActive ? 'Ativo' : 'Inativo'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-zinc-500 dark:text-zinc-400">
                              {formatDate(product.updated_at || product.created_at)}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => navigate(`/products/${product.id}`)}
                                  title="Visualizar"
                                  className="p-2 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                                >
                                  <Eye className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => navigate(`/products/edit/${product.id}`)} // Or reuse /products/new? Usually specific edit route is better.
                                  title="Editar"
                                  className="p-2 text-zinc-500 hover:text-blue-600 dark:text-zinc-400 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                >
                                  <FileEdit className="h-4 w-4" />
                                </button>
                                <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-700 mx-1" />
                                <button
                                  onClick={() => setShowDeleteModal(product.id)}
                                  title="Excluir"
                                  className="p-2 text-zinc-500 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-xl max-w-md w-full p-6 shadow-xl border border-zinc-200 dark:border-zinc-800 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-2">Excluir Produto?</h3>
            <p className="text-zinc-500 dark:text-zinc-400 mb-6">
              Esta ação não pode ser desfeita. O produto será removido permanentemente.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowDeleteModal(null)}
                className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors font-medium text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(showDeleteModal)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium text-sm"
              >
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      <ImportProductsModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={() => {
          loadProducts();
          setShowImportModal(false);
        }}
      />

      {/* Export Modal */}
      <ExportProductsModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        selectedProducts={selectedProducts}
        totalProducts={products.length}
        currentFilters={{
          search: searchTerm || undefined,
          category: selectedCategory ? Number(selectedCategory) : undefined,
        }}
      />
    </div>
  );
};
