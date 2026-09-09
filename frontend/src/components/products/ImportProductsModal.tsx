import { useState, useCallback } from 'react';
import type { FC } from 'react';

import { Upload, X, CheckCircle2, Loader2, Download, AlertCircle } from 'lucide-react';
// FRG-07: fork mantido do SheetJS (xlsx oficial tem prototype pollution + ReDoS sem fix).
import * as XLSX from '@e965/xlsx';
import { productService } from '@/services/productService';

interface ImportProductsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type ImportStep = 'upload' | 'preview' | 'processing';

interface ColumnMapping {
  [key: string]: string; // CSV column -> system field
}

interface ProductRow {
  [key: string]: any;
  _rowNumber: number;
  _isValid: boolean;
  _errors: string[];
}

interface ValidationSummary {
  total: number;
  valid: number;
  invalid: number;
  duplicateSKUs: string[];
}

const REQUIRED_FIELDS = ['name', 'sku'];

export const ImportProductsModal: FC<ImportProductsModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [step, setStep] = useState<ImportStep>('upload');
  const [, setFile] = useState<File | null>(null);
  const [, setCsvHeaders] = useState<string[]>([]);
  const [, setCsvData] = useState<any[]>([]);
  const [, setColumnMapping] = useState<ColumnMapping>({});
  const [validatedProducts, setValidatedProducts] = useState<ProductRow[]>([]);
  const [validationSummary, setValidationSummary] = useState<ValidationSummary | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: number;
    failed: number;
    errors: string[];
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleReset = () => {
    setStep('upload');
    setFile(null);
    setCsvHeaders([]);
    setCsvData([]);
    setColumnMapping({});
    setValidatedProducts([]);
    setValidationSummary(null);
    setIsProcessing(false);
    setImportResult(null);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleFileSelect = useCallback((selectedFile: File) => {
    if (!selectedFile) return;

    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
    ];

    if (!validTypes.includes(selectedFile.type) && !selectedFile.name.match(/\.(xlsx|xls|csv)$/i)) {
      alert('Formato de arquivo inválido. Use XLSX ou CSV.');
      return;
    }

    setFile(selectedFile);
    parseFile(selectedFile);
  }, []);

  const parseFile = async (file: File) => {
    setIsProcessing(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];

      if (jsonData.length < 2) {
        alert('A planilha precisa ter pelo menos um cabeçalho e uma linha de dados.');
        setFile(null);
        setIsProcessing(false);
        return;
      }

      const headers = jsonData[0].map((h: any) => String(h).trim());
      const rows = jsonData.slice(1).filter((row) => row.some((cell) => cell !== null && cell !== ''));

      setCsvHeaders(headers);
      setCsvData(rows);

      // Auto-detect mapping
      const autoMapping: ColumnMapping = {};
      headers.forEach((header) => {
        const normalized = header.toLowerCase().replace(/[_\s]/g, '');

        if (normalized.includes('nome') || normalized === 'name' || normalized === 'produto') {
          autoMapping[header] = 'name';
        } else if (normalized.includes('sku') || normalized.includes('codigo') || normalized === 'code') {
          autoMapping[header] = 'sku';
        } else if (normalized.includes('preco') || normalized === 'price' || normalized === 'valor') {
          autoMapping[header] = 'price';
        } else if (normalized.includes('descricao') || normalized === 'description' || normalized === 'desc') {
          autoMapping[header] = 'description';
        } else if (normalized.includes('categoria') || normalized === 'category' || normalized === 'cat') {
          autoMapping[header] = 'category';
        } else if (normalized.includes('imagemmain') || normalized === 'imagemain' || normalized.includes('imagemprincipal') || normalized.includes('capa') || normalized.includes('cover')) {
          autoMapping[header] = 'image_main';
        } else if (normalized.includes('imagegallery') || normalized === 'imagegallery' || normalized.includes('galeria') || normalized.includes('imagensadicionais')) {
          autoMapping[header] = 'image_gallery';
        } else if (normalized.includes('imagem') || normalized.includes('image') || normalized === 'foto') {
          autoMapping[header] = 'image_main';
        } else if (normalized.includes('estoque') || normalized === 'stock' || normalized === 'qty') {
          autoMapping[header] = 'stock';
        } else if (normalized.includes('moeda') || normalized === 'currency') {
          autoMapping[header] = 'currency';
        }
      });

      setColumnMapping(autoMapping);

      // Auto-validate after parsing
      validateDataFromParsedFile(headers, rows, autoMapping);
    } catch (error) {
      console.error('Erro ao processar arquivo:', error);
      alert('Erro ao processar arquivo. Verifique o formato.');
      setFile(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const validateDataFromParsedFile = (headers: string[], rows: any[][], mapping: ColumnMapping) => {
    setIsProcessing(true);

    try {
      const products: ProductRow[] = rows.map((row, index) => {
        const product: ProductRow = {
          _rowNumber: index + 2,
          _isValid: true,
          _errors: [],
        };

        // Map columns to fields
        headers.forEach((header, colIndex) => {
          const systemField = mapping[header];
          if (systemField) {
            product[systemField] = row[colIndex];
          }
        });

        // Validate required fields
        REQUIRED_FIELDS.forEach(field => {
          if (!product[field] || String(product[field]).trim() === '') {
            product._isValid = false;
            product._errors.push(`Campo obrigatório "${field}" está vazio`);
          }
        });

        // Validate price format if exists
        if (product.price && isNaN(Number(product.price))) {
          product._isValid = false;
          product._errors.push('Preço inválido');
        }

        // Validate image URLs
        const isValidUrl = (url: string): boolean => {
          if (!url || url.trim() === '') return true;
          try {
            const urlObj = new URL(url.trim());
            return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
          } catch {
            return false;
          }
        };

        if (product.image_main && !isValidUrl(product.image_main)) {
          product._errors.push('URL da imagem principal inválida (use HTTP/HTTPS)');
        }

        if (product.image_gallery) {
          const galleryUrls = String(product.image_gallery).split('|').map(u => u.trim()).filter(u => u);
          const invalidUrls = galleryUrls.filter(url => !isValidUrl(url));
          if (invalidUrls.length > 0) {
            product._errors.push(`${invalidUrls.length} URL(s) inválida(s) na galeria`);
          }
        }

        // Normalize data
        if (product.name) product.name = String(product.name).trim();
        if (product.sku) product.sku = String(product.sku).trim();
        if (product.price) product.price = Number(product.price);
        if (product.stock) product.stock = Number(product.stock) || 0;
        if (!product.currency) product.currency = 'BRL';
        if (product.image_main) product.image_main = String(product.image_main).trim();
        if (product.image_gallery) product.image_gallery = String(product.image_gallery).trim();

        return product;
      });

      // Check for duplicate SKUs
      const skuCounts = new Map<string, number>();
      products.forEach(p => {
        if (p.sku) {
          skuCounts.set(p.sku, (skuCounts.get(p.sku) || 0) + 1);
        }
      });

      const duplicates: string[] = [];
      products.forEach(p => {
        if (p.sku && skuCounts.get(p.sku)! > 1) {
          p._isValid = false;
          p._errors.push('SKU duplicado no arquivo');
          duplicates.push(p.sku);
        }
      });

      const summary: ValidationSummary = {
        total: products.length,
        valid: products.filter(p => p._isValid).length,
        invalid: products.filter(p => !p._isValid).length,
        duplicateSKUs: Array.from(new Set(duplicates)),
      };

      setValidatedProducts(products);
      setValidationSummary(summary);
      setStep('preview');
    } catch (error) {
      console.error('Erro na validação:', error);
      alert('Erro ao validar dados');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  };

  const handleImport = async () => {
    setIsProcessing(true);
    setStep('processing');

    try {
      const validProducts = validatedProducts.filter(p => p._isValid);

      // Get context
      const storedSede = localStorage.getItem('active_sede');
      const storedOrg = localStorage.getItem('active_organization');

      let sedeId: number | undefined;
      let orgId: number | undefined;

      try {
        sedeId = storedSede ? JSON.parse(storedSede).id : undefined;
        orgId = storedOrg ? JSON.parse(storedOrg).id : undefined;
      } catch (e) {
        console.error('Erro ao parsear contexto:', e);
      }

      // Validate context
      if (!sedeId || !orgId) {
        throw new Error('Por favor, selecione uma sede e organização antes de importar produtos.');
      }

      // Clean products: remove validation fields before sending to API
      const cleanProducts = validProducts.map(product => {
        const { _rowNumber, _isValid, _errors, ...cleanProduct } = product;
        return cleanProduct;
      });

      // Import products using the API
      const results = await productService.bulkImport(cleanProducts, {
        sede: sedeId,
        organization: orgId,
      });

      setImportResult(results);
    } catch (error: any) {
      console.error('Erro na importação:', error);

      let errorMessage = error.message || 'Erro desconhecido';

      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error.response?.status === 400) {
        errorMessage = 'Dados inválidos. Verifique se o endpoint /api/products/bulk_import/ está implementado no backend.';
      } else if (error.response?.status === 401) {
        errorMessage = 'Você não está autenticado. Faça login novamente.';
      } else if (error.response?.status === 403) {
        errorMessage = 'Você não tem permissão para importar produtos.';
      } else if (error.response?.status === 404) {
        errorMessage = 'Endpoint de importação não encontrado. O backend precisa implementar /api/products/bulk_import/';
      }

      setImportResult({
        success: 0,
        failed: validatedProducts.filter(p => p._isValid).length,
        errors: [errorMessage],
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadTemplate = () => {
    const products = [
      ['name', 'sku', 'price', 'description', 'category', 'stock', 'currency', 'image_main', 'image_gallery'],
      ['Produto Exemplo 1', 'SKU-001', 99.90, 'Descrição do produto 1', 'Eletrônicos', 100, 'BRL', 'https://picsum.photos/800/600?random=1', 'https://picsum.photos/800/600?random=2|https://picsum.photos/800/600?random=3'],
      ['Produto Exemplo 2', 'SKU-002', 149.90, 'Descrição do produto 2', 'Móveis', 50, 'BRL', 'https://picsum.photos/800/600?random=4', 'https://picsum.photos/800/600?random=5'],
    ];

    const instructions = [
      ['📋 INSTRUÇÕES DE IMPORTAÇÃO'],
      [''],
      ['CAMPOS OBRIGATÓRIOS:'],
      ['• name - Nome do produto'],
      ['• sku - Código único do produto'],
      [''],
      ['CAMPOS OPCIONAIS:'],
      ['• price, description, category, stock, currency'],
      ['• image_main - URL da imagem principal'],
      ['• image_gallery - URLs separadas por | (pipe)'],
    ];

    const wb = XLSX.utils.book_new();
    const wsProducts = XLSX.utils.aoa_to_sheet(products);
    const wsInstructions = XLSX.utils.aoa_to_sheet(instructions);

    XLSX.utils.book_append_sheet(wb, wsProducts, 'Produtos');
    XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instruções');

    XLSX.writeFile(wb, 'template_importacao_produtos.xlsx');
  };

  // Get context for display
  const storedSede = localStorage.getItem('active_sede');
  const storedOrg = localStorage.getItem('active_organization');
  let contextSede: any = null;
  let contextOrg: any = null;

  try {
    contextSede = storedSede ? JSON.parse(storedSede) : null;
    contextOrg = storedOrg ? JSON.parse(storedOrg) : null;
  } catch (e) {
    console.error('Erro ao parsear contexto:', e);
  }

  const hasContext = contextSede && contextOrg;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
              <Upload className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                Importar Produtos
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Carregue um arquivo XLSX, CSV ou JSON de produtos
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Content Area */}
        <div>
          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div className="p-8">
              <div className="w-full max-w-xl space-y-6">
                {/* Drag and Drop Area */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`
                    border border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer
                    ${isDragging
                      ? 'border-zinc-400 bg-zinc-50 dark:bg-zinc-800/50'
                      : 'border-zinc-300 dark:border-zinc-700 hover:border-zinc-400'
                    }
                  `}
                  onClick={() => document.getElementById('file-upload')?.click()}
                >
                  <Upload className={`w-12 h-12 mx-auto mb-4 ${isDragging ? 'text-zinc-600' : 'text-zinc-400'}`} />

                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                    {isDragging ? 'Solte o arquivo aqui' : 'Arraste um arquivo XLSX, CSV ou JSON aqui'}
                  </h3>

                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
                    ou clique para selecionar
                  </p>

                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                    className="hidden"
                    id="file-upload"
                    disabled={!hasContext}
                  />
                </div>

                {/* Secondary Action */}
                <div className="flex justify-center">
                  <button
                    onClick={(e) => { e.stopPropagation(); downloadTemplate(); }}
                    className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
                  >
                    <Download className="h-4 w-4" />
                    Baixar modelo de planilha
                  </button>
                </div>

                {!hasContext && (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900/50 rounded-lg p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-500 mt-0.5" />
                    <p className="text-sm text-yellow-700 dark:text-yellow-400">
                      Selecione uma organização e sede para habilitar a importação.
                    </p>
                  </div>
                )}

                {isProcessing && (
                  <div className="flex items-center justify-center gap-3 py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-zinc-600" />
                    <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">
                      Processando arquivo...
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Preview */}
          {step === 'preview' && validationSummary && (
            <div className="p-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg p-4">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Total de Produtos
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {validationSummary.total}
                  </p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900/50 rounded-lg p-4">
                  <p className="text-sm font-medium text-green-700 dark:text-green-400 mb-1">
                    Válidos
                  </p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-500">
                    {validationSummary.valid}
                  </p>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-lg p-4">
                  <p className="text-sm font-medium text-red-700 dark:text-red-400 mb-1">
                    Com Erros
                  </p>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-500">
                    {validationSummary.invalid}
                  </p>
                </div>
              </div>

              {/* Warning Banner */}
              {validationSummary.invalid > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/50 rounded-lg p-4 flex items-center gap-2 mb-6">
                  <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-500 flex-shrink-0" />
                  <p className="text-sm text-amber-700 dark:text-amber-400 font-medium">
                    {validationSummary.invalid} produto(s) contêm erros e não serão importados.
                  </p>
                </div>
              )}

              {/* Products Table */}
              <div className="border border-gray-200 dark:border-zinc-700 rounded-lg overflow-hidden flex flex-col">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-zinc-800 sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                          #
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                          Nome
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                          SKU
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-zinc-900 divide-y divide-gray-200 dark:divide-zinc-700">
                      {validatedProducts.map((product, index) => (
                        <tr
                          key={index}
                          className={!product._isValid ? 'bg-red-50 dark:bg-red-900/10' : 'hover:bg-gray-50 dark:hover:bg-zinc-800/50'}
                        >
                          <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                            {product._rowNumber}
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                            {product.name || <span className="text-gray-400 italic">Sem nome</span>}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
                            {product.sku || '-'}
                          </td>
                          <td className="px-4 py-3">
                            {product._isValid ? (
                              <div className="flex items-center gap-1.5 text-green-600 dark:text-green-500">
                                <CheckCircle2 className="h-4 w-4" />
                                <span className="font-medium">Válido</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 text-red-600 dark:text-red-500">
                                <X className="h-4 w-4 flex-shrink-0" />
                                <span className="truncate max-w-[300px]" title={product._errors.join(', ')}>
                                  {product._errors[0]}
                                </span>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Processing */}
          {step === 'processing' && !importResult && (
            <div className="py-12 flex items-center justify-center">
              <div className="flex flex-col items-center">
                <div className="h-16 w-16 mb-6">
                  <Loader2 className="h-full w-full animate-spin text-zinc-600" />
                </div>
                <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
                  Importando produtos...
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Por favor, aguarde enquanto processamos os dados.
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Results */}
          {step === 'processing' && importResult && (
            <div className="p-8">
              <div className="w-full max-w-xl space-y-6">
                {/* Result Header */}
                <div className="flex flex-col items-center text-center">
                  {importResult.success > 0 ? (
                    <>
                      <div className="h-16 w-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                        <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-500" />
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                        Importação Concluída
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400">
                        O processo de importação foi finalizado.
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="h-16 w-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
                        <X className="h-8 w-8 text-red-600 dark:text-red-500" />
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                        Falha na Importação
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400">
                        Nenhum produto foi importado com sucesso.
                      </p>
                    </>
                  )}
                </div>

                {/* Results Summary */}
                {(importResult.success > 0 || importResult.failed > 0) && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900/50 rounded-lg p-5 text-center">
                      <p className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase tracking-wider mb-1">
                        Sucesso
                      </p>
                      <p className="text-3xl font-bold text-green-600 dark:text-green-500">
                        {importResult.success}
                      </p>
                    </div>
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-lg p-5 text-center">
                      <p className="text-xs font-semibold text-red-700 dark:text-red-400 uppercase tracking-wider mb-1">
                        Falhas
                      </p>
                      <p className="text-3xl font-bold text-red-600 dark:text-red-500">
                        {importResult.failed}
                      </p>
                    </div>
                  </div>
                )}

                {/* Errors List */}
                {importResult.errors.length > 0 && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-lg p-4">
                    <h4 className="font-semibold text-red-900 dark:text-red-300 mb-3 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      Detalhes dos Erros
                    </h4>
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                      {importResult.errors.map((error, i) => (
                        <div
                          key={i}
                          className="text-sm text-red-700 dark:text-red-400 bg-white dark:bg-red-950/40 rounded px-3 py-2 border border-red-100 dark:border-red-900/30"
                        >
                          {error}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {(step === 'preview' || (step === 'processing' && importResult)) && (
          <div className="px-6 py-4 border-t border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/50 flex items-center justify-end gap-3">
            {step === 'preview' && validationSummary && (
              <>
                <button
                  onClick={handleReset}
                  className="px-4 py-2 border border-gray-300 dark:border-zinc-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-white dark:hover:bg-zinc-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleImport}
                  disabled={validationSummary.valid === 0 || !hasContext}
                  className="px-6 py-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Importar {validationSummary.valid} Produtos
                </button>
              </>
            )}
            {step === 'processing' && importResult && (
              <>
                <button
                  onClick={handleReset}
                  className="px-4 py-2 border border-gray-300 dark:border-zinc-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-white dark:hover:bg-zinc-800 transition-colors"
                >
                  Nova Importação
                </button>
                {importResult.success > 0 ? (
                  <button
                    onClick={() => {
                      onSuccess();
                      handleClose();
                    }}
                    className="px-6 py-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition-colors font-medium"
                  >
                    Concluir e Ver Produtos
                  </button>
                ) : (
                  <button
                    onClick={handleClose}
                    className="px-6 py-2 border border-gray-300 dark:border-zinc-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-white dark:hover:bg-zinc-800 transition-colors"
                  >
                    Fechar
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
