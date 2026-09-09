import { FC, useState } from 'react';
import { FiFolder, FiChevronRight, FiChevronDown, FiPlus, FiCheck } from 'react-icons/fi';
import { Button } from '../ui/button';

interface Category {
  id: string;
  name: string;
  description: string;
  parent: string | null;
}

interface CategoryTreeSelectProps {
  categories: Category[];
  selectedCategoryId: string;
  onSelect: (categoryId: string) => void;
  onCreateNew: () => void;
}

export const CategoryTreeSelect: FC<CategoryTreeSelectProps> = ({
  categories,
  selectedCategoryId,
  onSelect,
  onCreateNew,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const getRootCategories = () => {
    return categories.filter((cat) => !cat.parent);
  };

  const getSubcategories = (parentId: string) => {
    return categories.filter((cat) => cat.parent === parentId);
  };

  const getCategoryPath = (categoryId: string): string => {
    const category = categories.find((c) => c.id === categoryId);
    if (!category) return '';
    if (!category.parent) return category.name;
    const parent = categories.find((c) => c.id === category.parent);
    return parent ? `${getCategoryPath(parent.id)} > ${category.name}` : category.name;
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

  const handleSelect = (categoryId: string) => {
    onSelect(categoryId);
    setIsOpen(false);
  };

  const renderCategoryTree = (category: Category, level: number = 0) => {
    const subcategories = getSubcategories(category.id);
    const hasSubcategories = subcategories.length > 0;
    const isExpanded = expandedCategories.has(category.id);
    const isSelected = category.id === selectedCategoryId;

    return (
      <div key={category.id}>
        <div
          className={`flex items-center justify-between p-2 rounded-md transition-colors group cursor-pointer ${isSelected
              ? 'bg-[#b88971] text-white'
              : 'hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          style={{ marginLeft: `${level * 20}px` }}
          onClick={() => handleSelect(category.id)}
        >
          <div className="flex items-center gap-2 flex-1">
            {/* Expand/Collapse Button */}
            {hasSubcategories && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleCategory(category.id);
                }}
                className={`p-0.5 rounded transition-colors ${isSelected
                    ? 'hover:bg-[#a67860] text-white/80'
                    : 'hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
              >
                {isExpanded ? (
                  <FiChevronDown className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-gray-600 dark:text-gray-400'}`} />
                ) : (
                  <FiChevronRight className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-gray-600 dark:text-gray-400'}`} />
                )}
              </button>
            )}
            {!hasSubcategories && <div className="w-4" />}

            {/* Folder Icon */}
            <div className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-white/20' : 'bg-[#b88971]/10'
              }`}>
              <FiFolder className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-[#b88971]'}`} />
            </div>

            {/* Category Name */}
            <div className="flex-1 min-w-0">
              <p className={`text-sm truncate ${isSelected ? 'font-semibold text-white' : 'text-gray-900 dark:text-white'}`}>
                {category.name}
              </p>
              {category.description && (
                <p className={`text-xs truncate ${isSelected ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'}`}>
                  {category.description}
                </p>
              )}
            </div>

            {/* Selected Indicator */}
            {isSelected && (
              <FiCheck className="w-4 h-4 text-white flex-shrink-0" />
            )}
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

  if (categories.length === 0) {
    return (
      <Button
        type="button"
        variant="outline"
        onClick={onCreateNew}
        className="w-full h-11 justify-start text-gray-500"
      >
        <FiPlus className="w-4 h-4 mr-2" />
        Criar primeira categoria
      </Button>
    );
  }

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-11 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {selectedCategory ? (
            <>
              <FiFolder className="w-4 h-4 text-[#b88971] flex-shrink-0" />
              <span className="truncate">{getCategoryPath(selectedCategoryId)}</span>
            </>
          ) : (
            <span className="text-gray-500">Selecione uma categoria</span>
          )}
        </div>
        <FiChevronDown className={`h-4 w-4 opacity-50 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown Content */}
          <div className="absolute z-50 mt-2 w-full max-h-96 overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md">
            <div className="p-2">
              {/* Tree View */}
              <div className="space-y-0.5 mb-2">
                {getRootCategories().map((category) => renderCategoryTree(category))}
              </div>

              {/* Divider */}
              <div className="h-px bg-gray-200 dark:bg-gray-700 my-2" />

              {/* New Category Button */}
              <button
                onClick={() => {
                  setIsOpen(false);
                  onCreateNew();
                }}
                className="w-full flex items-center gap-2 px-2 py-2 text-sm text-[#b88971] hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              >
                <FiPlus className="w-4 h-4" />
                <span className="font-medium">Nova categoria</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
