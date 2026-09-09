import { FC, useState } from 'react';
import { FiX, FiSave, FiFolder } from 'react-icons/fi';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Button } from '../ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import type { Category as APICategory } from '../../services/categoryService';

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (category: { name: string; description: string; parent: string | null }) => void;
  categories: APICategory[];
  editCategory?: { id: string; name: string; description: string; parent: string | null };
}

export const CategoryModal: FC<CategoryModalProps> = ({
  isOpen,
  onClose,
  onSave,
  categories,
  editCategory,
}) => {
  const [formData, setFormData] = useState({
    name: editCategory?.name || '',
    description: editCategory?.description || '',
    parent: editCategory?.parent || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      parent: formData.parent || null,
    });
    handleClose();
  };

  const handleClose = () => {
    setFormData({
      name: '',
      description: '',
      parent: '',
    });
    onClose();
  };

  const getCategoryPath = (categoryId: string): string => {
    const category = categories.find((c) => c.id === categoryId);
    if (!category) return '';
    if (!category.parent) return category.name;
    return `${getCategoryPath(category.parent)} > ${category.name}`;
  };

  const getPreviewPath = (): string => {
    if (!formData.name) return 'Nome da categoria';
    if (!formData.parent || formData.parent === 'none') return formData.name;
    const parentPath = getCategoryPath(formData.parent);
    return `${parentPath} > ${formData.name}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#b88971]/10 rounded-lg">
              <FiFolder className="w-5 h-5 text-[#b88971]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {editCategory ? 'Editar Categoria' : 'Nova Categoria'}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {editCategory ? 'Atualize as informações da categoria' : 'Adicione uma nova categoria ao sistema'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <FiX className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* Nome da Categoria */}
          <div className="space-y-2">
            <Label htmlFor="categoryName" className="text-base">
              Nome da Categoria <span className="text-red-500">*</span>
            </Label>
            <Input
              id="categoryName"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ex: Embalagens de Papelão"
              className="h-11"
            />
          </div>

          {/* Categoria Pai */}
          <div className="space-y-2">
            <Label htmlFor="parentCategory" className="text-base">
              Categoria Pai (opcional)
            </Label>
            <Select value={formData.parent || 'none'} onValueChange={(value) => setFormData({ ...formData, parent: value === 'none' ? '' : value })}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Selecione uma categoria pai" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhuma (Categoria raiz)</SelectItem>
                {categories
                  .filter((cat) => cat.id !== editCategory?.id)
                  .map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Selecione uma categoria pai para criar uma subcategoria
            </p>
          </div>

          {/* Preview */}
          <div className="space-y-2">
            <Label className="text-base">Pré-visualização da Hierarquia</Label>
            <div className="p-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900">
              <div className="flex items-center gap-2">
                <FiFolder className="w-5 h-5 text-[#b88971]" />
                <p className="font-medium text-gray-900 dark:text-white">
                  {getPreviewPath()}
                </p>
              </div>
              {formData.description && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  {formData.description}
                </p>
              )}
            </div>
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-base">
              Descrição
            </Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Descreva o propósito desta categoria..."
              rows={3}
              className="resize-none"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <Button type="button" variant="outline" onClick={handleClose} className="h-11 px-6">
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            className="h-11 px-6 bg-[#b88971] hover:bg-[#a67860] text-white"
          >
            <FiSave className="w-4 h-4 mr-2" />
            {editCategory ? 'Atualizar' : 'Criar'} Categoria
          </Button>
        </div>
      </div>
    </div>
  );
};
