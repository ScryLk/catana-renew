import { FC, useState, useEffect } from 'react';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import { FiPlus, FiEdit2, FiTrash2, FiFolder, FiChevronRight, FiChevronDown, FiList, FiGitBranch } from 'react-icons/fi';
import { CategoryModal } from '../components/products/CategoryModal';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { categoryService, Category } from '../services/categoryService';
import { LoadingScreen } from '../components/common/LoadingScreen';

export const Categories: FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | undefined>();
  const [viewMode, setViewMode] = useState<'list' | 'tree'>('tree');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  // Fetch categories on mount
  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    setIsLoading(true);
    try {
      const data = await categoryService.getCategories();
      setCategories(data);
    } catch (error) {
      console.error('Error fetching categories:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveCategory = async (categoryData: { name: string; description: string; parent: string | null }) => {
    try {
      if (editingCategory) {
        // Update existing category
        await categoryService.updateCategory(editingCategory.id, {
          name: categoryData.name,
          description: categoryData.description || undefined,
          parent: categoryData.parent || null,
        });
        setEditingCategory(undefined);
      } else {
        // Create new category
        await categoryService.createCategory({
          name: categoryData.name,
          description: categoryData.description || undefined,
          parent: categoryData.parent || null,
        });
      }
      // Refresh categories
      await fetchCategories();
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error saving category:', error);
      alert('Erro ao salvar categoria. Por favor, tente novamente.');
    }
  };

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
    setIsModalOpen(true);
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (confirm('Tem certeza que deseja excluir esta categoria?')) {
      try {
        await categoryService.deleteCategory(categoryId);
        await fetchCategories();
      } catch (error) {
        console.error('Error deleting category:', error);
        alert('Erro ao excluir categoria. Verifique se não há subcategorias ou produtos vinculados.');
      }
    }
  };

  const getRootCategories = () => {
    return categories.filter((cat) => !cat.parent);
  };

  const getSubcategories = (parentId: string) => {
    return categories.filter((cat) => cat.parent === parentId);
  };

  const getCategoryPath = (category: Category): string => {
    if (!category.parent) return category.name;
    const parent = categories.find((cat) => cat.id === category.parent);
    return parent ? `${getCategoryPath(parent)} > ${category.name}` : category.name;
  };

  const toggleCategory = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const renderCategoryTree = (category: Category, level: number = 0) => {
    const subcategories = getSubcategories(category.id);
    const hasSubcategories = subcategories.length > 0;
    const isExpanded = expandedCategories.has(category.id);

    return (
      <div key={category.id}>
        <div
          className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group"
          style={{ marginLeft: `${level * 24}px` }}
        >
          <div className="flex items-center gap-3 flex-1">
            {/* Expand/Collapse Button */}
            {hasSubcategories && (
              <button
                onClick={() => toggleCategory(category.id)}
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
              >
                {isExpanded ? (
                  <FiChevronDown className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                ) : (
                  <FiChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                )}
              </button>
            )}
            {!hasSubcategories && <div className="w-6" />}

            {/* Folder Icon */}
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#b88971]/10 flex-shrink-0">
              <FiFolder className="w-4 h-4 text-[#b88971]" />
            </div>

            {/* Category Info */}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                {category.name}
              </h3>
              {category.description && (
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {category.description}
                </p>
              )}
            </div>

            {/* Subcategories Count */}
            {hasSubcategories && (
              <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-1 rounded-full">
                {subcategories.length}
              </span>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
            <button
              onClick={() => handleEditCategory(category)}
              className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg transition-colors"
            >
              <FiEdit2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleDeleteCategory(category.id)}
              className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg transition-colors"
            >
              <FiTrash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Render Subcategories */}
        {hasSubcategories && isExpanded && (
          <div>
            {subcategories.map((subcat) => renderCategoryTree(subcat, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const renderCategory = (category: Category, level: number = 0) => {
    const subcategories = getSubcategories(category.id);
    const hasSubcategories = subcategories.length > 0;

    return (
      <div key={category.id}>
        <div
          className="flex items-center justify-between p-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group"
          style={{ marginLeft: `${level * 24}px` }}
        >
          <div className="flex items-center gap-4 flex-1">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[#b88971]/10 flex-shrink-0">
              <FiFolder className="w-5 h-5 text-[#b88971]" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {category.name}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                {category.description}
              </p>
              {category.parent && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  📁 {getCategoryPath(category)}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span className="bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full">
                {subcategories.length} subcategoria{subcategories.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => handleEditCategory(category)}
              className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg transition-colors"
            >
              <FiEdit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleDeleteCategory(category.id)}
              className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg transition-colors"
            >
              <FiTrash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        {hasSubcategories && (
          <div className="ml-6">
            {subcategories.map((subcat) => renderCategory(subcat, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <Sidebar />
      <Header />

      <main className="ml-16 pt-20">
        <div className="p-8 max-w-[1400px] mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Categorias de Produtos
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Gerencie as categorias e subcategorias do seu catálogo
              </p>
            </div>
            <Button
              onClick={() => {
                setEditingCategory(undefined);
                setIsModalOpen(true);
              }}
              className="h-11 px-6 bg-[#b88971] hover:bg-[#a67860] text-white"
            >
              <FiPlus className="w-4 h-4 mr-2" />
              Nova Categoria
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card className="border-0 shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Total de Categorias</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                      {categories.length}
                    </p>
                  </div>
                  <div className="p-3 bg-blue-500/10 rounded-xl">
                    <FiFolder className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Categorias Raiz</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                      {getRootCategories().length}
                    </p>
                  </div>
                  <div className="p-3 bg-green-500/10 rounded-xl">
                    <FiFolder className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Subcategorias</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                      {categories.length - getRootCategories().length}
                    </p>
                  </div>
                  <div className="p-3 bg-purple-500/10 rounded-xl">
                    <FiFolder className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Categories List */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Todas as Categorias</CardTitle>
                  <CardDescription>
                    Visualize e gerencie sua hierarquia de categorias
                  </CardDescription>
                </div>
                {categories.length > 0 && (
                  <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                    <button
                      onClick={() => setViewMode('tree')}
                      className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-2 ${
                        viewMode === 'tree'
                          ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      <FiGitBranch className="w-4 h-4" />
                      <span className="text-sm font-medium">Árvore</span>
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-2 ${
                        viewMode === 'list'
                          ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      <FiList className="w-4 h-4" />
                      <span className="text-sm font-medium">Lista</span>
                    </button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <LoadingScreen message="Carregando categorias..." size="md" />
              ) : categories.length === 0 ? (
                <div className="text-center py-12">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
                    <FiFolder className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Nenhuma categoria cadastrada
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-6">
                    Comece criando sua primeira categoria
                  </p>
                  <Button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-[#b88971] hover:bg-[#a67860] text-white"
                  >
                    <FiPlus className="w-4 h-4 mr-2" />
                    Criar Primeira Categoria
                  </Button>
                </div>
              ) : (
                <div className="space-y-1">
                  {viewMode === 'tree'
                    ? getRootCategories().map((category) => renderCategoryTree(category))
                    : getRootCategories().map((category) => renderCategory(category))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Category Modal */}
      <CategoryModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingCategory(undefined);
        }}
        onSave={handleSaveCategory}
        categories={categories}
        editCategory={editingCategory}
      />
    </div>
  );
};
