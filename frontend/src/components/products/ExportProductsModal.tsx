import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Download, FileJson, FileSpreadsheet, FileText, Loader2, Check } from 'lucide-react';
import api from '../../services/api';

interface ExportProductsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProducts: Set<number>;
  totalProducts: number;
  currentFilters: {
    search?: string;
    category?: number;
    organization?: number;
    sede?: number;
  };
}

type ExportFormat = 'json' | 'xlsx' | 'csv';
type ExportScope = 'selected' | 'filtered';

export function ExportProductsModal({
  isOpen,
  onClose,
  selectedProducts,
  totalProducts,
  currentFilters,
}: ExportProductsModalProps) {
  const selectedCount = selectedProducts.size;
  const canExportSelected = selectedCount > 0;

  const [format, setFormat] = useState<ExportFormat>('json');
  const [scope, setScope] = useState<ExportScope>(canExportSelected ? 'selected' : 'filtered');
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    setIsExporting(true);
    setError(null);

    try {
      const exportData = {
        format,
        scope,
        ids: scope === 'selected' ? Array.from(selectedProducts) : undefined,
        filters: scope === 'filtered' ? currentFilters : undefined,
      };

      const response = await api.post('/api/products/export/', exportData, {
        responseType: 'blob', // Importante para download de arquivo
      });

      // Criar URL do blob e fazer download
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      // Extrair nome do arquivo do header Content-Disposition
      const contentDisposition = response.headers['content-disposition'];
      let filename = `produtos_${Date.now()}.${format}`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      // Fechar modal após sucesso
      onClose();
    } catch (err: any) {
      console.error('Erro ao exportar produtos:', err);
      if (err.response?.data) {
        // Se o erro vier como blob, converter para texto
        if (err.response.data instanceof Blob) {
          const text = await err.response.data.text();
          try {
            const errorData = JSON.parse(text);
            setError(errorData.error || 'Erro ao exportar produtos');
          } catch {
            setError('Erro ao exportar produtos');
          }
        } else {
          setError(err.response.data.error || 'Erro ao exportar produtos');
        }
      } else {
        setError('Erro ao exportar produtos. Tente novamente.');
      }
    } finally {
      setIsExporting(false);
    }
  };

  const getFormatIcon = (fmt: ExportFormat) => {
    switch (fmt) {
      case 'json':
        return <FileJson className="w-5 h-5" />;
      case 'xlsx':
        return <FileSpreadsheet className="w-5 h-5" />;
      case 'csv':
        return <FileText className="w-5 h-5" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[580px] bg-zinc-50 dark:bg-zinc-900">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5 text-2xl font-bold">
            <Download className="w-6 h-6 text-primary-600 dark:text-primary-500" />
            Exportar Produtos
          </DialogTitle>
          <DialogDescription className="text-base">
            Escolha o formato e os produtos que deseja exportar
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-8 py-6">
          {/* Seção 1: Formato do arquivo */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wide">
              Formato do arquivo
            </h3>
            <div className="grid grid-cols-3 gap-3">
              {(['json', 'xlsx', 'csv'] as ExportFormat[]).map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => setFormat(fmt)}
                  className={`
                    group relative flex flex-col items-center justify-center gap-3 p-5 rounded-xl transition-all duration-200 cursor-pointer
                    ${format === fmt
                      ? 'bg-primary-600 shadow-lg border-4 border-white dark:border-zinc-900'
                      : 'bg-white dark:bg-zinc-800 border-2 border-zinc-200 dark:border-zinc-700 hover:border-primary-400 dark:hover:border-primary-600 hover:shadow-md'
                    }
                  `}
                >
                  {/* Check icon for selected */}
                  {format === fmt && (
                    <div className="absolute top-2 right-2 bg-white dark:bg-zinc-900 rounded-full p-0.5 shadow-sm">
                      <Check className="w-3 h-3 text-primary-600 dark:text-primary-500" />
                    </div>
                  )}

                  {/* Icon */}
                  <div className={`
                    p-3 rounded-lg transition-colors
                    ${format === fmt
                      ? 'bg-white dark:bg-zinc-900 text-primary-600 dark:text-primary-500'
                      : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 group-hover:bg-primary-50 dark:group-hover:bg-primary-950/30 group-hover:text-primary-600'
                    }
                  `}>
                    {getFormatIcon(fmt)}
                  </div>

                  {/* Label */}
                  <div className={`
                    text-sm font-bold uppercase tracking-wide
                    ${format === fmt
                      ? 'text-white dark:text-white'
                      : 'text-zinc-900 dark:text-zinc-100'
                    }
                  `}>
                    {fmt}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Seção 2: Escopo da exportação */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wide">
              Produtos a exportar
            </h3>
            <div className="space-y-3">
              {/* Produtos selecionados */}
              <button
                onClick={() => canExportSelected && setScope('selected')}
                disabled={!canExportSelected}
                className={`
                  w-full group relative flex items-start gap-4 p-4 rounded-xl text-left transition-all duration-200
                  ${scope === 'selected' && canExportSelected
                    ? 'bg-primary-600 shadow-lg ring-4 ring-white dark:ring-zinc-900 cursor-pointer'
                    : canExportSelected
                      ? 'bg-white dark:bg-zinc-800 border-2 border-zinc-200 dark:border-zinc-700 hover:border-primary-400 dark:hover:border-primary-600 hover:shadow-md cursor-pointer'
                      : 'bg-zinc-100 dark:bg-zinc-900/50 border-2 border-zinc-200 dark:border-zinc-800 opacity-50 cursor-not-allowed'
                  }
                `}
              >
                {/* Check icon for selected */}
                {scope === 'selected' && canExportSelected && (
                  <div className="absolute top-3 right-3 bg-white dark:bg-zinc-900 rounded-full p-1 shadow-sm">
                    <Check className="w-3.5 h-3.5 text-primary-600 dark:text-primary-500" />
                  </div>
                )}

                <div className={`
                  flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-colors
                  ${scope === 'selected' && canExportSelected
                    ? 'bg-white dark:bg-zinc-900 text-primary-600 dark:text-primary-500'
                    : canExportSelected
                      ? 'bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 group-hover:bg-primary-50 dark:group-hover:bg-primary-950/30 group-hover:text-primary-600'
                      : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600'
                  }
                `}>
                  <span className="text-lg font-bold">{selectedCount}</span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className={`
                    text-sm font-semibold mb-1
                    ${scope === 'selected' && canExportSelected
                      ? 'text-white dark:text-white'
                      : canExportSelected
                        ? 'text-zinc-900 dark:text-zinc-100'
                        : 'text-zinc-500 dark:text-zinc-600'
                    }
                  `}>
                    Produtos selecionados
                  </div>
                  <div className={`
                    text-xs
                    ${scope === 'selected' && canExportSelected
                      ? 'text-white/80 dark:text-white/80'
                      : canExportSelected
                        ? 'text-zinc-600 dark:text-zinc-400'
                        : 'text-zinc-400 dark:text-zinc-600'
                    }
                  `}>
                    {canExportSelected
                      ? `${selectedCount} produto${selectedCount !== 1 ? 's' : ''}`
                      : 'Selecione produtos na tabela para exportá-los'
                    }
                  </div>
                </div>
              </button>

              {/* Todos do filtro */}
              <button
                onClick={() => setScope('filtered')}
                className={`
                  w-full group relative flex items-start gap-4 p-4 rounded-xl text-left transition-all duration-200 cursor-pointer
                  ${scope === 'filtered'
                    ? 'bg-primary-600 shadow-lg ring-4 ring-white dark:ring-zinc-900'
                    : 'bg-white dark:bg-zinc-800 border-2 border-zinc-200 dark:border-zinc-700 hover:border-primary-400 dark:hover:border-primary-600 hover:shadow-md'
                  }
                `}
              >
                {/* Check icon for selected */}
                {scope === 'filtered' && (
                  <div className="absolute top-3 right-3 bg-white dark:bg-zinc-900 rounded-full p-1 shadow-sm">
                    <Check className="w-3.5 h-3.5 text-primary-600 dark:text-primary-500" />
                  </div>
                )}

                <div className={`
                  flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-colors
                  ${scope === 'filtered'
                    ? 'bg-white dark:bg-zinc-900 text-primary-600 dark:text-primary-500'
                    : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 group-hover:bg-primary-50 dark:group-hover:bg-primary-950/30 group-hover:text-primary-600'
                  }
                `}>
                  <span className="text-lg font-bold">{totalProducts}</span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className={`
                    text-sm font-semibold mb-1
                    ${scope === 'filtered'
                      ? 'text-white dark:text-white'
                      : 'text-zinc-900 dark:text-zinc-100'
                    }
                  `}>
                    Todos os produtos {Object.keys(currentFilters).length > 0 && 'do filtro atual'}
                  </div>
                  <div className={`
                    text-xs
                    ${scope === 'filtered'
                      ? 'text-white/80 dark:text-white/80'
                      : 'text-zinc-600 dark:text-zinc-400'
                    }
                  `}>
                    {totalProducts} produto{totalProducts !== 1 ? 's' : ''} no total
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Erro */}
          {error && (
            <div className="rounded-xl bg-red-50 dark:bg-red-950/30 border-2 border-red-200 dark:border-red-800 p-4">
              <p className="text-sm font-medium text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-3 pt-6 border-t border-zinc-200 dark:border-zinc-800">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isExporting}
            className="flex-1 h-12 text-base font-semibold border-2 border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 transition-all"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleExport}
            disabled={isExporting || (scope === 'selected' && !canExportSelected)}
            className="flex-1 h-12 text-base bg-primary-600 hover:bg-primary-700 text-white font-bold shadow-lg shadow-primary-600/40 hover:shadow-xl hover:shadow-primary-600/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Exportando...
              </>
            ) : (
              <>
                <Download className="w-5 h-5 mr-2" />
                Baixar arquivo
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
