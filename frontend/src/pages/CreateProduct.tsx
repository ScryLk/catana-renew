import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import { FiSave, FiUpload, FiX } from 'react-icons/fi'; // Using react-icons for consistency within this file initially, or use lucide
import { Image as ImageIcon } from 'lucide-react'; // Mixing is fine if needed
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';

import { CategoryModal } from '../components/products/CategoryModal';
import { CategoryTreeSelect } from '../components/products/CategoryTreeSelect';
import { categoryService, Category } from '../services/categoryService';
import { productService } from '../services/productService';
import { mediaService } from '../services/mediaService';

export const CreateProduct: FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditMode = Boolean(id);

  const [isDropshipping, setIsDropshipping] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Image State
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    description: '',
    category: '',
    price: '',
    stock: '',
    currency: 'BRL',
    badge: '',
    image: null as number | null,
    // Dropshipping fields
    weight: '',
    width: '',
    height: '',
    depth: '',
    supplier: '',
    supplierSku: '',
    leadTime: '',
    shippingCost: '',
  });

  useEffect(() => {
    fetchCategories();
    if (isEditMode && id) {
      loadProduct(parseInt(id));
    }
  }, [id]);

  const fetchCategories = async () => {
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
      console.error('Error fetching categories:', error);
    }
  };

  const loadProduct = async (productId: number) => {
    setLoading(true);
    try {
      const product = await productService.getProductById(productId);

      const dropshippingInfo = product.dropshipping_info || {};
      const hasDropshipping = Object.keys(dropshippingInfo).length > 0;

      if (hasDropshipping) {
        setIsDropshipping(true);
      }

      setPreviewUrl(product.image_url);

      setFormData({
        name: product.name,
        sku: product.sku || '',
        description: product.description || '',
        category: product.category ? String(product.category) : '',
        price: product.price.toString(),
        stock: product.stock.toString(),
        currency: product.currency,
        badge: product.badge || '',
        image: product.image,

        // Dropshipping fields
        weight: dropshippingInfo.weight || '',
        width: dropshippingInfo.width || '',
        height: dropshippingInfo.height || '',
        depth: dropshippingInfo.depth || '',
        supplier: dropshippingInfo.supplier || '',
        supplierSku: dropshippingInfo.supplierSku || '',
        leadTime: dropshippingInfo.leadTime || '',
        shippingCost: dropshippingInfo.shippingCost || '',
      });

    } catch (error) {
      console.error('Error loading product:', error);
      alert('Erro ao carregar produto.');
      navigate('/products');
    } finally {
      setLoading(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);

      // Clear previous image ID since we have a new file to upload
      // logic handles this by prioritizing selectedFile
    }
  };

  const handleRemoveImage = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setFormData({ ...formData, image: null });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const storedSede = localStorage.getItem('active_sede');
      const storedOrg = localStorage.getItem('active_organization');
      const sedeId = storedSede ? JSON.parse(storedSede).id : undefined;
      const orgId = storedOrg ? JSON.parse(storedOrg).id : undefined;

      // Handle Image Upload
      let imageId = formData.image;
      if (selectedFile) {
        // Ensure folder structure: Produtos > [Product Name]
        const folderName = formData.name || 'Sem Nome';
        const folderId = await mediaService.ensureFolderHierarchy(['Produtos', folderName]);

        // Upload logic
        const uploadedMedia = await mediaService.uploadMedia({
          file: selectedFile,
          name: formData.name || selectedFile.name,
          folder: folderId || undefined,
          sede: sedeId
        });
        imageId = uploadedMedia.id;
      }

      const dropshippingInfo = isDropshipping ? {
        weight: formData.weight,
        width: formData.width,
        height: formData.height,
        depth: formData.depth,
        supplier: formData.supplier,
        supplierSku: formData.supplierSku,
        leadTime: formData.leadTime,
        shippingCost: formData.shippingCost,
      } : {};

      const productPayload = {
        name: formData.name,
        sku: formData.sku,
        description: formData.description,
        price: parseFloat(formData.price),
        stock: parseInt(formData.stock) || 0,
        currency: formData.currency,
        category: formData.category ? formData.category : null,
        badge: formData.badge,
        dropshipping_info: dropshippingInfo,
        organization: orgId,
        sede: sedeId,
        image: imageId,
      };

      if (isEditMode && id) {
        await productService.updateProduct(Number(id), productPayload as any);
      } else {
        await productService.createProduct(productPayload as any);
      }

      navigate('/products');
    } catch (error) {
      console.error('Error saving product:', error);
      alert('Erro ao salvar produto. Verifique os dados e tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSaveCategory = async (categoryData: { name: string; description: string; parent: string | null }) => {
    try {
      const storedSede = localStorage.getItem('active_sede');
      const storedOrg = localStorage.getItem('active_organization');
      const sedeId = storedSede ? JSON.parse(storedSede).id : undefined;
      const orgId = storedOrg ? JSON.parse(storedOrg).id : undefined;

      const newCategory = await categoryService.createCategory({
        name: categoryData.name,
        description: categoryData.description || undefined,
        parent: categoryData.parent || null,
        organization: orgId,
        sede: sedeId,
      });

      await fetchCategories();
      setFormData({ ...formData, category: newCategory.id });
      setIsCategoryModalOpen(false);
    } catch (error) {
      console.error('Error creating category:', error);
      alert('Erro ao criar categoria. Por favor, tente novamente.');
    }
  };

  const handleCategoryChange = (value: string) => {
    setFormData({
      ...formData,
      category: value,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="w-8 h-8 border-4 border-zinc-300 border-t-zinc-900 dark:border-t-white rounded-full animate-spin mb-4" />
          <p className="text-zinc-500 dark:text-zinc-400">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      <Sidebar />
      <Header />

      <main className="ml-16 pt-20">
        <div className="p-8 max-w-[1200px] mx-auto">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 mb-6">
            <span>Catana</span>
            <span>›</span>
            <button onClick={() => navigate('/products')} className="hover:text-zinc-900 dark:hover:text-white">
              Produtos
            </button>
            <span>›</span>
            <span className="text-zinc-900 dark:text-white font-medium">{isEditMode ? 'Editar' : 'Novo'}</span>
          </div>

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-2">{isEditMode ? 'Editar Produto' : 'Novo Produto'}</h1>
              <p className="text-zinc-500 dark:text-zinc-400">
                {isEditMode ? 'Atualize as informações do produto.' : 'Cadastre um produto para usar em catálogos e materiais.'}
              </p>
            </div>
            {/* Botão de preencher dados fictícios removido temporariamente */}
          </div>


          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information Card */}
            <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
              <div className="border-b border-zinc-200 dark:border-zinc-700 px-6 py-4">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Informações básicas</h2>
              </div>
              <div className="p-6 space-y-6">
                {/* Image Upload Section */}
                <div>
                  <Label className="text-sm font-medium text-zinc-900 dark:text-white mb-2 block">
                    Imagem do Produto
                  </Label>
                  <div className="flex items-start gap-6">
                    <div className="w-32 h-32 bg-zinc-50 dark:bg-zinc-900 rounded-lg border-2 border-dashed border-zinc-300 dark:border-zinc-600 flex items-center justify-center overflow-hidden relative group">
                      {previewUrl ? (
                        <>
                          <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={handleRemoveImage}
                            className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <FiX className="text-white w-6 h-6" />
                          </button>
                        </>
                      ) : (
                        <ImageIcon className="w-8 h-8 text-zinc-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-col gap-2">
                        <label className="inline-flex">
                          <span className="px-4 py-2 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded-lg text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 cursor-pointer flex items-center gap-2 transition-colors">
                            <FiUpload className="w-4 h-4" />
                            Escolher imagem
                          </span>
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*"
                            onChange={handleImageChange}
                          />
                        </label>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                          JPG, PNG ou WEBP. Máximo 5MB.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Nome do Produto */}
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-medium text-zinc-900 dark:text-white">
                    Nome do produto <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="name"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Ex: Notebook Dell Inspiron 15"
                    className="h-11 bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700"
                  />
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    Use um nome claro e descritivo para facilitar a busca.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* SKU */}
                  <div className="space-y-2">
                    <Label htmlFor="sku" className="text-sm font-medium text-zinc-900 dark:text-white">
                      Código / SKU
                    </Label>
                    <Input
                      id="sku"
                      name="sku"
                      required
                      value={formData.sku}
                      onChange={handleChange}
                      placeholder="Ex: PROD-001"
                      className="h-11 bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700"
                    />
                  </div>

                  {/* Categoria */}
                  <div className="space-y-2">
                    <Label htmlFor="category" className="text-sm font-medium text-zinc-900 dark:text-white">
                      Categoria <span className="text-red-500">*</span>
                    </Label>
                    <CategoryTreeSelect
                      categories={categories}
                      selectedCategoryId={formData.category}
                      onSelect={handleCategoryChange}
                      onCreateNew={() => setIsCategoryModalOpen(true)}
                    />
                  </div>
                </div>

                {/* Descrição */}
                <div className="space-y-2">
                  <Label htmlFor="description" className="text-sm font-medium text-zinc-900 dark:text-white">
                    Descrição curta
                  </Label>
                  <Textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    placeholder="Breve descrição do produto (máx. 200 caracteres)"
                    rows={3}
                    maxLength={200}
                    className="resize-none bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700"
                  />
                  <div className="flex justify-between items-center">
                    <p className="text-xs text-zinc-400"></p>
                    <p className="text-xs text-zinc-400">{formData.description.length}/200</p>
                  </div>
                </div>

                {/* Status Toggle */}
                <div className="flex items-center justify-between pt-4 border-t border-zinc-200 dark:border-zinc-700">
                  <div>
                    <h3 className="text-sm font-medium text-zinc-900 dark:text-white">Status</h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">Produto visível no catálogo</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.stock !== '0'}
                      onChange={(e) => setFormData({ ...formData, stock: e.target.checked ? '1' : '0' })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-zinc-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>
            </div>

            {/* Pricing & Inventory Card */}
            <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
              <div className="border-b border-zinc-200 dark:border-zinc-700 px-6 py-4">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Preço e estoque</h2>
              </div>
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Preço */}
                  <div className="space-y-2">
                    <Label htmlFor="price" className="text-sm font-medium text-zinc-900 dark:text-white">
                      Preço <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">R$</span>
                      <Input
                        id="price"
                        name="price"
                        type="number"
                        step="0.01"
                        required
                        value={formData.price}
                        onChange={handleChange}
                        placeholder="0,00"
                        className="h-11 pl-10 bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700"
                      />
                    </div>
                  </div>

                  {/* Moeda */}
                  <div className="space-y-2">
                    <Label htmlFor="currency" className="text-sm font-medium text-zinc-900 dark:text-white">
                      Moeda
                    </Label>
                    <select
                      id="currency"
                      name="currency"
                      value={formData.currency}
                      onChange={handleChange}
                      className="flex h-11 w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-white ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 dark:focus-visible:ring-white focus-visible:ring-offset-2"
                    >
                      <option value="BRL">BRL (R$)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                    </select>
                  </div>

                  {/* Estoque */}
                  <div className="space-y-2">
                    <Label htmlFor="stock" className="text-sm font-medium text-zinc-900 dark:text-white">
                      Estoque
                    </Label>
                    <Input
                      id="stock"
                      name="stock"
                      type="number"
                      value={formData.stock}
                      onChange={handleChange}
                      placeholder="0"
                      className="h-11 bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Dropshipping Card */}
            <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
              <div className="border-b border-zinc-200 dark:border-zinc-700 px-6 py-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Dropshipping</h2>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor="isDropshipping"
                      className="text-sm font-medium text-zinc-900 dark:text-white cursor-pointer mr-2"
                    >
                      Ativar dropshipping
                    </label>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        id="isDropshipping"
                        type="checkbox"
                        checked={isDropshipping}
                        onChange={(e) => setIsDropshipping(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-zinc-600 peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>
              </div>

              {isDropshipping && (
                <div className="p-6 grid gap-6">
                  {/* Dimensões */}
                  <div>
                    <h4 className="font-medium text-sm text-zinc-900 dark:text-white mb-3">Dimensões da Embalagem</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="width" className="text-sm text-zinc-700 dark:text-zinc-300">
                          Largura (cm)
                        </Label>
                        <Input
                          id="width"
                          name="width"
                          type="number"
                          step="0.01"
                          value={formData.width}
                          onChange={handleChange}
                          placeholder="0"
                          className="h-10 bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="height" className="text-sm text-zinc-700 dark:text-zinc-300">
                          Altura (cm)
                        </Label>
                        <Input
                          id="height"
                          name="height"
                          type="number"
                          step="0.01"
                          value={formData.height}
                          onChange={handleChange}
                          placeholder="0"
                          className="h-10 bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="depth" className="text-sm text-zinc-700 dark:text-zinc-300">
                          Profundidade (cm)
                        </Label>
                        <Input
                          id="depth"
                          name="depth"
                          type="number"
                          step="0.01"
                          value={formData.depth}
                          onChange={handleChange}
                          placeholder="0"
                          className="h-10 bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="weight" className="text-sm text-zinc-700 dark:text-zinc-300">
                          Peso (kg)
                        </Label>
                        <Input
                          id="weight"
                          name="weight"
                          type="number"
                          step="0.01"
                          value={formData.weight}
                          onChange={handleChange}
                          placeholder="0"
                          className="h-10 bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Informações do Fornecedor */}
                  <div>
                    <h4 className="font-medium text-sm text-zinc-900 dark:text-white mb-3">Informações do Fornecedor</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="supplier" className="text-sm text-zinc-700 dark:text-zinc-300">
                          Nome do Fornecedor
                        </Label>
                        <Input
                          id="supplier"
                          name="supplier"
                          value={formData.supplier}
                          onChange={handleChange}
                          placeholder="Ex: Fornecedor XYZ"
                          className="h-10 bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="supplierSku" className="text-sm text-zinc-700 dark:text-zinc-300">
                          SKU do Fornecedor
                        </Label>
                        <Input
                          id="supplierSku"
                          name="supplierSku"
                          value={formData.supplierSku}
                          onChange={handleChange}
                          placeholder="Ex: FORN-123"
                          className="h-10 bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Envio */}
                  <div>
                    <h4 className="font-medium text-sm text-zinc-900 dark:text-white mb-3">Informações de Envio</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="leadTime" className="text-sm text-zinc-700 dark:text-zinc-300">
                          Prazo de Entrega (dias)
                        </Label>
                        <Input
                          id="leadTime"
                          name="leadTime"
                          type="number"
                          value={formData.leadTime}
                          onChange={handleChange}
                          placeholder="Ex: 7"
                          className="h-10 bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="shippingCost" className="text-sm text-zinc-700 dark:text-zinc-300">
                          Custo de Envio (R$)
                        </Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">R$</span>
                          <Input
                            id="shippingCost"
                            name="shippingCost"
                            type="number"
                            step="0.01"
                            value={formData.shippingCost}
                            onChange={handleChange}
                            placeholder="0,00"
                            className="h-10 pl-10 bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 pb-8">
              <button
                type="button"
                onClick={() => navigate('/products')}
                disabled={saving}
                className="px-6 py-2.5 text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors font-medium disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors font-medium flex items-center gap-2 disabled:opacity-50"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <FiSave className="w-4 h-4" />
                )}
                {isEditMode ? 'Atualizar Produto' : 'Salvar Produto'}
              </button>
            </div>
          </form>
        </div>
      </main >

      {/* Category Modal */}
      < CategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        onSave={handleSaveCategory}
        categories={categories}
      />
    </div >
  );
};
