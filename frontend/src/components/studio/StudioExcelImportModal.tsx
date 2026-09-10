import React, { useState, useRef } from 'react';
import {
  Upload,
  FileSpreadsheet,
  X,
  ArrowRight,
  ArrowLeft,
  Check,
  Sparkles,
  AlertCircle,
  Download,
  Loader2,
  Layers,
  HelpCircle,
} from 'lucide-react';
import * as XLSX from '@e965/xlsx';
import axios from 'axios';
import { toast } from 'sonner';
import { useStudioStore, API_BASE_URL } from '../../store/studioStore';

export type TargetFieldKey =
  | 'name'
  | 'price'
  | 'category'
  | 'sku'
  | 'description'
  | 'image'
  | 'tag'
  | 'ignore';

interface TargetFieldDef {
  key: TargetFieldKey;
  label: string;
  required: boolean;
  synonyms: string[];
}

const TARGET_FIELDS: TargetFieldDef[] = [
  {
    key: 'name',
    label: 'Nome do Produto',
    required: true,
    synonyms: ['nome', 'produto', 'titulo', 'item', 'descricao_item', 'desc_produto', 'name', 'product', 'denominacao', 'mercadoria'],
  },
  {
    key: 'price',
    label: 'Preço de Venda',
    required: true,
    synonyms: ['preco', 'preço', 'valor', 'vlr_venda', 'preco_venda', 'price', 'custo', 'tabela', 'unitario', 'valor_unitario'],
  },
  {
    key: 'category',
    label: 'Categoria / Linha',
    required: false,
    synonyms: ['categoria', 'departamento', 'grupo', 'secao', 'seção', 'familia', 'família', 'linha', 'tipo', 'category'],
  },
  {
    key: 'sku',
    label: 'Código / SKU',
    required: false,
    synonyms: ['sku', 'codigo', 'código', 'ref', 'referencia', 'referência', 'cod', 'id', 'code'],
  },
  {
    key: 'description',
    label: 'Descrição Detalhada',
    required: false,
    synonyms: ['descricao', 'descrição', 'detalhes', 'especificacao', 'especificação', 'obs', 'observacao', 'observação', 'description'],
  },
  {
    key: 'image',
    label: 'Link da Imagem / URL',
    required: false,
    synonyms: ['imagem', 'foto', 'url_imagem', 'image', 'link_foto', 'foto_principal', 'picture', 'photo'],
  },
  {
    key: 'tag',
    label: 'Tag / Selo Comercial',
    required: false,
    synonyms: ['tag', 'destaque', 'selo', 'lancamento', 'lançamento', 'novidade', 'badge'],
  },
];

type Step = 'upload' | 'mapping' | 'preview' | 'importing';

interface ParsedProductItem {
  name: string;
  price: string;
  category?: string;
  sku?: string;
  description?: string;
  image?: string;
  tag?: string;
}

export const StudioExcelImportModal: React.FC = () => {
  const {
    isExcelImportModalOpen,
    closeExcelImportModal,
    importProductsFromExcel,
    theme,
  } = useStudioStore();

  const isDark = theme === 'dark';

  const [step, setStep] = useState<Step>('upload');
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);

  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<any[][]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, TargetFieldKey>>({});

  const [generateAIPhotos, setGenerateAIPhotos] = useState(true);
  const [importProgress, setImportProgress] = useState(0);
  const [importStatusText, setImportStatusText] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleReset = () => {
    setStep('upload');
    setFileName('');
    setFileSize('');
    setRawHeaders([]);
    setRawRows([]);
    setColumnMapping({});
    setGenerateAIPhotos(true);
    setImportProgress(0);
    setImportStatusText('');
  };

  const handleClose = () => {
    handleReset();
    closeExcelImportModal();
  };

  const detectAutoMapping = (headers: string[]) => {
    const mapping: Record<string, TargetFieldKey> = {};
    const usedTargets = new Set<TargetFieldKey>();

    headers.forEach((header) => {
      const normalized = header
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '');

      let matchedKey: TargetFieldKey = 'ignore';

      for (const field of TARGET_FIELDS) {
        if (usedTargets.has(field.key)) continue;

        const isMatch = field.synonyms.some((synonym) => {
          const normSyn = synonym
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/g, '');
          return normalized.includes(normSyn) || normSyn.includes(normalized);
        });

        if (isMatch) {
          matchedKey = field.key;
          usedTargets.add(field.key);
          break;
        }
      }

      mapping[header] = matchedKey;
    });

    return mapping;
  };

  const processFile = async (file: File) => {
    setIsParsing(true);
    setFileName(file.name);
    setFileSize(`${(file.size / 1024).toFixed(1)} KB`);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

      if (data.length < 2) {
        toast.error('A planilha deve conter ao menos a linha de cabeçalho e uma linha de produtos.');
        setIsParsing(false);
        return;
      }

      const headers = (data[0] || []).map((h, i) => (h ? String(h).trim() : `Coluna ${i + 1}`));
      const rows = data.slice(1).filter((r) => r.some((cell) => cell !== null && cell !== undefined && String(cell).trim() !== ''));

      if (rows.length === 0) {
        toast.error('Nenhum dado de produto encontrado na planilha.');
        setIsParsing(false);
        return;
      }

      setRawHeaders(headers);
      setRawRows(rows);

      const autoMap = detectAutoMapping(headers);
      setColumnMapping(autoMap);
      setStep('mapping');
      toast.success(`Planilha processada: ${rows.length} itens encontrados.`);
    } catch (err) {
      console.error('[ExcelImport] Falha ao ler arquivo:', err);
      toast.error('Erro ao ler a planilha. Certifique-se de que o arquivo é um .xlsx, .xls ou .csv válido.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.name.match(/\.(xlsx|xls|csv)$/i)) {
        processFile(file);
      } else {
        toast.error('Formato não suportado. Envie um arquivo .xlsx, .xls ou .csv.');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const handleDownloadSample = () => {
    const sampleData = [
      ['Nome do Produto', 'Preço', 'Categoria', 'Código SKU', 'Descrição', 'Tag'],
      ['Bolo Red Velvet Supreme', 'R$ 145,00', 'Confeitaria Artesanal', 'CF-001', 'Massa aveludada com recheio de cream cheese e frutas vermelhas frescas', 'Mais Vendido'],
      ['Pote Trufado Pistache Puro', 'R$ 38,00', 'Linha Potes Gourmet', 'CF-002', 'Brigadeiro cremoso de pistache siciliano com crocante artesanal', 'Exclusivo'],
      ['Torta Folhada de Maçã', 'R$ 98,00', 'Pâtisserie Fina', 'CF-003', 'Massa folhada caramelizada com canela do Ceilão e fatias finas', 'Lançamento'],
      ['Box Degustação Mini Doces', 'R$ 180,00', 'Linha Festa & Eventos', 'CF-004', 'Seleção com 24 unidades dos doces mais premiados do atelier', 'Edição Limitada'],
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(sampleData);
    XLSX.utils.book_append_sheet(wb, ws, 'Produtos');
    XLSX.writeFile(wb, 'modelo_produtos_katana.xlsx');
    toast.success('Modelo de planilha baixado com sucesso!');
  };

  const isNameMapped = Object.values(columnMapping).includes('name');
  const isPriceMapped = Object.values(columnMapping).includes('price');

  const parsedProducts: ParsedProductItem[] = rawRows.map((row) => {
    const item: Record<string, string> = {};

    rawHeaders.forEach((header, colIdx) => {
      const targetField = columnMapping[header];
      if (targetField && targetField !== 'ignore') {
        const val = row[colIdx];
        item[targetField] = val !== null && val !== undefined ? String(val).trim() : '';
      }
    });

    return {
      name: item.name || '',
      price: item.price || 'R$ 0,00',
      category: item.category || 'COLEÇÃO 2026',
      sku: item.sku || '',
      description: item.description || '',
      image: item.image || '',
      tag: item.tag || '',
    };
  }).filter((p) => p.name.length > 0);

  const totalItems = parsedProducts.length;
  const itemsWithImage = parsedProducts.filter((p) => p.image && p.image.length > 0).length;
  const itemsWithoutImage = totalItems - itemsWithImage;

  const handleFinalizeImport = async (generateCatalogImmediately = false) => {
    setStep('importing');
    setImportProgress(10);
    setImportStatusText('Estruturando dados dos produtos...');

    const preparedProducts = [...parsedProducts];

    if (generateAIPhotos && itemsWithoutImage > 0) {
      setImportStatusText(`Processando fotografias de estúdio para ${itemsWithoutImage} produtos...`);
      for (let i = 0; i < preparedProducts.length; i++) {
        const p = preparedProducts[i];
        if (!p.image || p.image.trim() === '') {
          try {
            const resp = await axios.post(`${API_BASE_URL}/api/v2/studio/products/generate-image/`, {
              name: p.name,
              category: p.category || '',
              description: p.description || '',
            });
            if (resp.data?.image_url) {
              p.image = resp.data.image_url;
            }
          } catch (err) {
            console.warn('[ExcelImport] Falha ao gerar foto para item:', p.name, err);
          }
        }
        setImportProgress(Math.min(95, 20 + Math.round(((i + 1) / preparedProducts.length) * 70)));
      }
    }

    setImportProgress(100);
    setImportStatusText('Concluindo cadastro no acervo do Katana Studio...');

    setTimeout(() => {
      importProductsFromExcel(preparedProducts, {
        openDrawer: !generateCatalogImmediately,
        generateCatalog: generateCatalogImmediately,
      });
      handleClose();
    }, 400);
  };

  if (!isExcelImportModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs select-none">
      <div
        className={`w-full max-w-3xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-all animate-in fade-in zoom-in-95 ${
          isDark
            ? 'bg-[#0e0e11] border-zinc-800 text-zinc-100 shadow-[0_0_50px_rgba(0,0,0,0.8)]'
            : 'bg-white border-zinc-200 text-zinc-900 shadow-xl'
        }`}
      >
        {/* Modal Header */}
        <div
          className={`px-6 py-4 border-b flex items-center justify-between shrink-0 ${
            isDark ? 'border-zinc-800/80 bg-zinc-900/40' : 'border-zinc-100 bg-zinc-50/70'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-xl border ${
                isDark
                  ? 'bg-zinc-900 border-zinc-800 text-emerald-400'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-600'
              }`}
            >
              <FileSpreadsheet className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold tracking-tight">Importador Inteligente de Produtos</h2>
                <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                  Excel & CSV
                </span>
              </div>
              <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                Importe planilhas de qualquer formato, confirme as colunas e gere imagens com IA.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
              isDark
                ? 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                : 'bg-zinc-100 border-zinc-200 text-zinc-600 hover:text-zinc-950'
            }`}
            aria-label="Fechar modal"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Stepper Progress Bar */}
        <div
          className={`px-6 py-2.5 border-b flex items-center justify-between text-xs font-medium ${
            isDark ? 'border-zinc-800/60 bg-zinc-900/20' : 'border-zinc-100 bg-zinc-50'
          }`}
        >
          <div className="flex items-center gap-6">
            <div
              className={`flex items-center gap-2 ${
                step === 'upload'
                  ? 'text-white font-semibold'
                  : 'text-zinc-400'
              }`}
            >
              <span className={`size-5 rounded-full flex items-center justify-center text-[10px] font-mono ${
                step === 'upload' ? 'bg-zinc-100 text-zinc-950' : 'bg-zinc-800 text-zinc-400'
              }`}>1</span>
              <span>Upload do Arquivo</span>
            </div>

            <div className="w-4 h-px bg-zinc-800" />

            <div
              className={`flex items-center gap-2 ${
                step === 'mapping'
                  ? 'text-white font-semibold'
                  : 'text-zinc-400'
              }`}
            >
              <span className={`size-5 rounded-full flex items-center justify-center text-[10px] font-mono ${
                step === 'mapping' ? 'bg-zinc-100 text-zinc-950' : 'bg-zinc-800 text-zinc-400'
              }`}>2</span>
              <span>Confirmar Colunas</span>
            </div>

            <div className="w-4 h-px bg-zinc-800" />

            <div
              className={`flex items-center gap-2 ${
                step === 'preview' || step === 'importing'
                  ? 'text-white font-semibold'
                  : 'text-zinc-400'
              }`}
            >
              <span className={`size-5 rounded-full flex items-center justify-center text-[10px] font-mono ${
                step === 'preview' || step === 'importing' ? 'bg-zinc-100 text-zinc-950' : 'bg-zinc-800 text-zinc-400'
              }`}>3</span>
              <span>Prévia & IA</span>
            </div>
          </div>

          {step === 'upload' && (
            <button
              type="button"
              onClick={handleDownloadSample}
              className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
              title="Baixar planilha de exemplo para testes"
            >
              <Download className="size-3.5" />
              <span>Baixar Modelo (.xlsx)</span>
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          {/* STEP 1: UPLOAD */}
          {step === 'upload' && (
            <div className="space-y-6">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="hidden"
              />

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-zinc-400 bg-zinc-800/40 ring-4 ring-zinc-600/20'
                    : isDark
                    ? 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/30 hover:bg-zinc-900/50'
                    : 'border-zinc-200 hover:border-zinc-300 bg-zinc-50 hover:bg-zinc-100/70'
                }`}
              >
                {isParsing ? (
                  <div className="flex flex-col items-center gap-3 py-6">
                    <Loader2 className="size-8 text-zinc-400 animate-spin" />
                    <span className="text-xs text-zinc-300 font-medium">Lendo dados da planilha...</span>
                  </div>
                ) : (
                  <>
                    <div
                      className={`size-14 rounded-2xl border flex items-center justify-center mb-4 ${
                        isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-300' : 'bg-white border-zinc-200 text-zinc-700 shadow-sm'
                      }`}
                    >
                      <Upload className="size-6" />
                    </div>
                    <h3 className="text-sm font-semibold mb-1">
                      Arraste e solte seu arquivo Excel ou clique para selecionar
                    </h3>
                    <p className={`text-xs max-w-sm mb-4 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                      Suporta formatos .xlsx, .xls e .csv exportados de qualquer ERP ou gerados manualmente.
                    </p>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800/80 text-zinc-300 border border-zinc-700/60">
                      <FileSpreadsheet className="size-3.5 text-emerald-400" />
                      Selecionar Arquivo
                    </span>
                  </>
                )}
              </div>

              {/* Informative Hint */}
              <div
                className={`p-4 rounded-xl border flex items-start gap-3 ${
                  isDark ? 'bg-zinc-900/40 border-zinc-800/70' : 'bg-zinc-50 border-zinc-200'
                }`}
              >
                <HelpCircle className="size-4 text-zinc-400 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <span className="font-semibold text-zinc-200 block">Não se preocupe com o formato da planilha:</span>
                  <p className="text-zinc-400 leading-relaxed">
                    Na etapa seguinte, você poderá mapear quais colunas correspondem ao Nome, Preço, Categoria e Código dos seus produtos.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: COLUMN MAPPING */}
          {step === 'mapping' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">Mapeamento de Colunas</h3>
                  <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                    Arquivo: <span className="font-mono text-zinc-200 font-medium">{fileName}</span> ({fileSize}) · {rawRows.length} linhas detectadas.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded border font-mono ${
                    isNameMapped && isPriceMapped
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  }`}>
                    {isNameMapped && isPriceMapped ? 'Campos obrigatórios definidos' : 'Defina Nome e Preço'}
                  </span>
                </div>
              </div>

              {/* Mapping Table */}
              <div className="border border-zinc-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className={`border-b ${isDark ? 'bg-zinc-900/60 border-zinc-800' : 'bg-zinc-100 border-zinc-200'}`}>
                      <th className="py-2.5 px-4 font-semibold text-zinc-400">Coluna na Planilha</th>
                      <th className="py-2.5 px-4 font-semibold text-zinc-400">Amostra (Linha 1)</th>
                      <th className="py-2.5 px-4 font-semibold text-zinc-400">Campo no Katana Studio</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {rawHeaders.map((header, idx) => {
                      const sampleVal = rawRows[0]?.[idx] !== undefined ? String(rawRows[0][idx]) : '-';
                      const currentMapped = columnMapping[header] || 'ignore';

                      return (
                        <tr
                          key={header}
                          className={`${
                            currentMapped !== 'ignore'
                              ? isDark
                                ? 'bg-zinc-900/20'
                                : 'bg-zinc-50/50'
                              : ''
                          } hover:bg-zinc-800/30 transition-colors`}
                        >
                          <td className="py-2.5 px-4">
                            <span className="font-mono font-medium text-zinc-200 bg-zinc-800/60 px-2 py-1 rounded border border-zinc-700/60 text-[11px]">
                              {header}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 max-w-[200px] truncate text-zinc-400 font-mono text-[11px]">
                            {sampleVal || <span className="italic text-zinc-600">vazio</span>}
                          </td>
                          <td className="py-2.5 px-4">
                            <select
                              value={currentMapped}
                              onChange={(e) => {
                                const newKey = e.target.value as TargetFieldKey;
                                setColumnMapping((prev) => ({ ...prev, [header]: newKey }));
                              }}
                              className={`w-full text-xs font-medium px-2.5 py-1.5 rounded-lg border outline-none cursor-pointer transition-colors ${
                                currentMapped !== 'ignore'
                                  ? 'bg-zinc-900 border-zinc-700 text-zinc-100 font-semibold'
                                  : 'bg-zinc-900/40 border-zinc-800 text-zinc-500'
                              }`}
                            >
                              <option value="ignore">Ignorar esta coluna</option>
                              <optgroup label="Campos Obrigatórios">
                                <option value="name">Nome do Produto *</option>
                                <option value="price">Preço de Venda *</option>
                              </optgroup>
                              <optgroup label="Campos Complementares">
                                <option value="category">Categoria / Linha</option>
                                <option value="sku">Código / SKU</option>
                                <option value="description">Descrição</option>
                                <option value="image">Link da Imagem / Foto</option>
                                <option value="tag">Tag / Selo</option>
                              </optgroup>
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {(!isNameMapped || !isPriceMapped) && (
                <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-xl">
                  <AlertCircle className="size-4 shrink-0" />
                  <span>Para continuar, associe ao menos as colunas de Nome do Produto e Preço de Venda.</span>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: PREVIEW & AI OPTIONS */}
          {step === 'preview' && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/40 flex flex-col">
                  <span className="text-[11px] font-mono uppercase text-zinc-400">Total Identificado</span>
                  <span className="text-xl font-semibold font-mono text-zinc-100 mt-1">{totalItems} itens</span>
                </div>

                <div className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/40 flex flex-col">
                  <span className="text-[11px] font-mono uppercase text-zinc-400">Com Link de Foto</span>
                  <span className="text-xl font-semibold font-mono text-emerald-400 mt-1">{itemsWithImage}</span>
                </div>

                <div className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/40 flex flex-col">
                  <span className="text-[11px] font-mono uppercase text-zinc-400">Sem Foto Fornecida</span>
                  <span className="text-xl font-semibold font-mono text-amber-400 mt-1">{itemsWithoutImage}</span>
                </div>
              </div>

              {/* AI Image Generation Option Banner */}
              <div
                className={`p-4 rounded-xl border flex items-start justify-between gap-4 transition-all ${
                  generateAIPhotos
                    ? 'bg-zinc-900 border-zinc-700'
                    : 'bg-zinc-900/30 border-zinc-800 opacity-80'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-black/40 border border-zinc-700 text-zinc-200 shrink-0">
                    <Sparkles className="size-4 text-amber-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-semibold text-zinc-100">
                        Gerar fotos de estúdio com Inteligência Artificial
                      </h4>
                      <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold">
                        Google Gemini
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                      Para os {itemsWithoutImage} produtos sem imagem na planilha, a IA sintetiza prompts fotográficos de alta fidelidade e atribui imagens de estúdio com iluminação comercial.
                    </p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                  <input
                    type="checkbox"
                    checked={generateAIPhotos}
                    onChange={(e) => setGenerateAIPhotos(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-zinc-100 peer-checked:after:bg-zinc-950" />
                </label>
              </div>

              {/* Preview Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-zinc-300">
                    Amostra dos produtos prontos para cadastramento ({Math.min(8, totalItems)} de {totalItems})
                  </span>
                </div>

                <div className="border border-zinc-800 rounded-xl overflow-hidden max-h-56 overflow-y-auto custom-scrollbar">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b bg-zinc-900/80 border-zinc-800 text-zinc-400 font-mono text-[11px]">
                        <th className="py-2 px-3">Produto</th>
                        <th className="py-2 px-3">Categoria</th>
                        <th className="py-2 px-3">Código</th>
                        <th className="py-2 px-3">Preço</th>
                        <th className="py-2 px-3">Status Imagem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60">
                      {parsedProducts.slice(0, 8).map((item, idx) => (
                        <tr key={idx} className="hover:bg-zinc-800/20">
                          <td className="py-2 px-3 font-semibold text-zinc-200">{item.name}</td>
                          <td className="py-2 px-3 text-zinc-400">{item.category}</td>
                          <td className="py-2 px-3 font-mono text-zinc-400 text-[11px]">{item.sku || '-'}</td>
                          <td className="py-2 px-3 font-mono text-zinc-200 font-bold">{item.price}</td>
                          <td className="py-2 px-3">
                            {item.image ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-400">
                                <Check className="size-3" /> Link Fornecido
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-mono text-amber-400">
                                <Sparkles className="size-3" /> Síntese IA
                              </span>
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

          {/* STEP 4: IMPORTING PROGRESS */}
          {step === 'importing' && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
              <div className="size-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shadow-inner">
                <Loader2 className="size-6 text-zinc-300 animate-spin" />
              </div>

              <div>
                <h3 className="text-sm font-semibold text-white">Importando e Processando Produtos</h3>
                <p className="text-xs text-zinc-400 mt-1">{importStatusText}</p>
              </div>

              <div className="w-64 h-1.5 bg-zinc-800 rounded-full overflow-hidden mt-2">
                <div
                  className="h-full bg-zinc-100 transition-all duration-300"
                  style={{ width: `${importProgress}%` }}
                />
              </div>
              <span className="text-[11px] font-mono text-zinc-500">{importProgress}%</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        {step !== 'importing' && (
          <div
            className={`px-6 py-4 border-t flex items-center justify-between shrink-0 ${
              isDark ? 'border-zinc-800/80 bg-zinc-900/40' : 'border-zinc-100 bg-zinc-50'
            }`}
          >
            <div>
              {step !== 'upload' && (
                <button
                  type="button"
                  onClick={() => setStep(step === 'preview' ? 'mapping' : 'upload')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  <ArrowLeft className="size-3.5" />
                  <span>Voltar</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClose}
                className="px-3.5 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
              >
                Cancelar
              </button>

              {step === 'mapping' && (
                <button
                  type="button"
                  disabled={!isNameMapped || !isPriceMapped}
                  onClick={() => setStep('preview')}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-100 hover:bg-white text-zinc-950 transition-all shadow-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span>Avançar para Prévia</span>
                  <ArrowRight className="size-3.5" />
                </button>
              )}

              {step === 'preview' && (
                <>
                  <button
                    type="button"
                    onClick={() => handleFinalizeImport(false)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-900 border border-zinc-700 text-zinc-100 hover:bg-zinc-800 transition-all cursor-pointer shadow-sm"
                  >
                    <Layers className="size-3.5" />
                    <span>Salvar na Gaveta de Produtos</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleFinalizeImport(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-100 hover:bg-white text-zinc-950 transition-all cursor-pointer shadow-sm"
                  >
                    <Sparkles className="size-3.5" />
                    <span>Gerar Catálogo com esses Produtos</span>
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
