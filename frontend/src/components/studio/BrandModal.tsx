import React, { useState, useEffect, useRef } from 'react';
import {
  Building2,
  X,
  Check,
  Upload,
  Palette,
  Globe,
  Mail,
  Phone,
  Instagram,
  Trash2,
  FileText,
  Download,
  Eye,
  Crop,
} from 'lucide-react';
import { toast } from 'sonner';
import { useStudioStore } from '../../store/studioStore';
import { StudioPalette, STUDIO_PALETTE_PRESETS } from '../../data/aureaCatalog.mock';
import { LogoAreaSelectorModal } from './LogoAreaSelectorModal';
import { parseBrandMarkdown, generateBrandTemplateMarkdown } from '../../utils/brandMarkdownParser';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const SEGMENTS = [
  'Moda & Luxo',
  'Gastronomia & Food Service',
  'Tecnologia B2B',
  'Alta Joalheria',
  'Arquitetura & Design',
  'Cosméticos & Bem-Estar',
  'Indústria & Embalagens',
  'Outro Segmento',
];

export const BrandModal: React.FC = () => {
  const {
    isBrandModalOpen,
    brandModalEditingId,
    closeBrandModal,
    brands,
    addBrand,
    updateBrand,
    deleteBrand,
    theme,
  } = useStudioStore();

  const isDark = theme === 'dark';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mdFileInputRef = useRef<HTMLInputElement>(null);
  const primaryColorRef = useRef<HTMLInputElement>(null);
  const secondaryColorRef = useRef<HTMLInputElement>(null);
  const tertiaryColorRef = useRef<HTMLInputElement>(null);

  const editingBrand = brandModalEditingId
    ? brands.find((b) => b.id === brandModalEditingId)
    : null;

  const [name, setName] = useState('');
  const [segment, setSegment] = useState(SEGMENTS[0]);
  const [logoUrl, setLogoUrl] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [instagram, setInstagram] = useState('');
  const [toneOfVoice, setToneOfVoice] = useState('');
  const [brandMarkdown, setBrandMarkdown] = useState('');
  const [showMarkdownPreview, setShowMarkdownPreview] = useState(false);
  const [isAreaSelectorOpen, setIsAreaSelectorOpen] = useState(false);

  // 3 Cores da Paleta da Marca
  const [primaryColor, setPrimaryColor] = useState('#18181B');
  const [secondaryColor, setSecondaryColor] = useState('#52525B');
  const [tertiaryColor, setTertiaryColor] = useState('#B08D57');

  useEffect(() => {
    if (editingBrand) {
      setName(editingBrand.name);
      setSegment(editingBrand.segment || SEGMENTS[0]);
      setLogoUrl(editingBrand.logoUrl || '');
      setWhatsapp(editingBrand.commercialContact?.whatsapp || '');
      setEmail(editingBrand.commercialContact?.email || '');
      setWebsite(editingBrand.commercialContact?.website || '');
      setInstagram(editingBrand.commercialContact?.instagram || '');
      setToneOfVoice(editingBrand.toneOfVoice || '');
      setBrandMarkdown(editingBrand.brandMarkdown || '');

      if (editingBrand.customPalette) {
        setPrimaryColor(editingBrand.customPalette.primary || '#18181B');
        setSecondaryColor(editingBrand.customPalette.secondary || '#52525B');
        setTertiaryColor(editingBrand.customPalette.accent || '#B08D57');
      } else {
        const preset =
          STUDIO_PALETTE_PRESETS.find((p) => p.name === editingBrand.paletteName) ||
          STUDIO_PALETTE_PRESETS[0];
        setPrimaryColor(preset.primary);
        setSecondaryColor(preset.secondary || '#52525B');
        setTertiaryColor(preset.accent);
      }
    } else {
      setName('');
      setSegment(SEGMENTS[0]);
      setLogoUrl('');
      setWhatsapp('');
      setEmail('');
      setWebsite('');
      setInstagram('');
      setToneOfVoice('');
      setBrandMarkdown('');
      setPrimaryColor('#18181B');
      setSecondaryColor('#52525B');
      setTertiaryColor('#B08D57');
    }
    setShowMarkdownPreview(false);
  }, [editingBrand, isBrandModalOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isBrandModalOpen) {
        closeBrandModal();
      }
    };
    if (isBrandModalOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isBrandModalOpen, closeBrandModal]);

  if (!isBrandModalOpen) return null;

  const handleApplyAreaSelection = (
    palette: { primary: string; secondary: string; accent: string },
    croppedDataUrl?: string
  ) => {
    setPrimaryColor(palette.primary);
    setSecondaryColor(palette.secondary);
    setTertiaryColor(palette.accent);
    if (croppedDataUrl) {
      setLogoUrl(croppedDataUrl);
    }
  };

  const handleExtractColors = (imageUrl?: string) => {
    const targetUrl = imageUrl || logoUrl;
    if (!targetUrl) {
      toast.info('Nenhum logotipo disponível para seleção.');
      return;
    }
    setIsAreaSelectorOpen(true);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      toast.error('O logotipo deve ter no máximo 3MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const dataUrl = reader.result;
        setLogoUrl(dataUrl);
        toast.success('Logotipo carregado com sucesso!');
        setIsAreaSelectorOpen(true);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleMarkdownUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const text = reader.result;
        const parsed = parseBrandMarkdown(text);
        setBrandMarkdown(text);

        if (parsed.name) setName(parsed.name);
        if (parsed.segment) {
          const matchSeg = SEGMENTS.find((s) => s.toLowerCase() === parsed.segment?.toLowerCase());
          setSegment(matchSeg || parsed.segment);
        }
        if (parsed.commercialContact.whatsapp) setWhatsapp(parsed.commercialContact.whatsapp);
        if (parsed.commercialContact.email) setEmail(parsed.commercialContact.email);
        if (parsed.commercialContact.website) setWebsite(parsed.commercialContact.website);
        if (parsed.commercialContact.instagram) setInstagram(parsed.commercialContact.instagram);
        if (parsed.toneOfVoice) setToneOfVoice(parsed.toneOfVoice);

        if (parsed.palette?.primary) setPrimaryColor(parsed.palette.primary);
        if (parsed.palette?.secondary) setSecondaryColor(parsed.palette.secondary);
        if (parsed.palette?.accent) setTertiaryColor(parsed.palette.accent);

        toast.success('Diretrizes da marca importadas com sucesso!');
      }
    };
    reader.readAsText(file);
  };

  const handleDownloadTemplate = () => {
    const template = generateBrandTemplateMarkdown(name.trim() || 'Minha Marca');
    const blob = new Blob([template], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const sanitizedName = (name.trim() || 'marca')
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    link.setAttribute('download', `${sanitizedName}-BRAND.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Modelo BRAND.md baixado com sucesso!');
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const brandName = name.trim();
    if (!brandName) {
      toast.error('Por favor, informe o nome da marca.');
      return;
    }

    const customPalette: StudioPalette = {
      name: `Paleta ${brandName}`,
      primary: primaryColor,
      secondary: secondaryColor,
      accent: tertiaryColor,
      background: '#F6F5F2',
      surface: '#FFFFFF',
      contrastRatio: '9.2:1 (AAA)',
      locked: true,
    };

    const brandData = {
      name: brandName,
      segment,
      paletteName: customPalette.name,
      customPalette,
      brandMarkdown: brandMarkdown.trim() || undefined,
      toneOfVoice: toneOfVoice.trim() || undefined,
      logoUrl: logoUrl || undefined,
      commercialContact: {
        whatsapp: whatsapp.trim() || undefined,
        email: email.trim() || undefined,
        website: website.trim() || undefined,
        instagram: instagram.trim() || undefined,
      },
    };

    if (editingBrand) {
      updateBrand(editingBrand.id, brandData);
    } else {
      addBrand(brandData);
    }
  };

  const handleDelete = () => {
    if (!editingBrand) return;
    if (confirm(`Deseja realmente remover a marca "${editingBrand.name}"?`)) {
      deleteBrand(editingBrand.id);
      closeBrandModal();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="brand-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeBrandModal();
      }}
    >
      <div
        className={`w-full max-w-lg rounded-2xl border flex flex-col overflow-hidden transition-all animate-in zoom-in-95 duration-200 max-h-[92vh] ${
          isDark
            ? 'bg-[#101013] border-zinc-800 text-zinc-100 shadow-[0_30px_70px_rgba(0,0,0,0.95)]'
            : 'bg-white border-zinc-200 text-zinc-900 shadow-[0_20px_50px_rgba(0,0,0,0.15)]'
        }`}
      >
        {/* Header - Minimalista com tokens institucionais */}
        <div
          className={`px-5 py-3.5 border-b flex items-center justify-between shrink-0 ${
            isDark ? 'border-zinc-800/80 bg-[#151518]' : 'border-zinc-200 bg-zinc-50'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2 rounded-xl border ${
                isDark
                  ? 'bg-zinc-900 border-zinc-800 text-zinc-300'
                  : 'bg-zinc-100 border-zinc-200 text-zinc-700'
              }`}
            >
              <Building2 className="size-4" />
            </div>
            <div>
              <h2 id="brand-modal-title" className="text-sm font-semibold tracking-tight">
                {editingBrand ? 'Editar Marca & Brand Kit' : 'Nova Marca'}
              </h2>
              <p className={`text-[11px] ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                Identidade visual e dados corporativos centralizados.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeBrandModal}
            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
              isDark
                ? 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
                : 'bg-zinc-100 border-zinc-200 text-zinc-600 hover:text-zinc-950 hover:border-zinc-300'
            }`}
            aria-label="Fechar modal"
            title="Fechar (Esc)"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Sub-Header: Barra de Ações BRAND.md */}
        <div
          className={`px-5 py-2 border-b flex items-center justify-between gap-2 shrink-0 ${
            isDark ? 'border-zinc-800/60 bg-zinc-950/40 text-zinc-400' : 'border-zinc-200 bg-zinc-100/50 text-zinc-600'
          }`}
        >
          <div className="flex items-center gap-1.5 text-[11px] truncate min-w-0">
            <FileText className="size-3.5 text-zinc-400 shrink-0" />
            <span className="font-medium truncate">Diretrizes (BRAND.md)</span>
            {brandMarkdown && (
              <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                Ativo
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <input
              ref={mdFileInputRef}
              type="file"
              accept=".md,.txt,.markdown"
              onChange={handleMarkdownUpload}
              className="hidden"
            />
            {brandMarkdown && (
              <button
                type="button"
                onClick={() => setShowMarkdownPreview(!showMarkdownPreview)}
                className={`px-2 py-1 rounded text-[11px] transition-colors cursor-pointer flex items-center gap-1 ${
                  isDark ? 'hover:text-zinc-200 text-zinc-400' : 'hover:text-zinc-950 text-zinc-600'
                }`}
              >
                <Eye className="size-3" />
                <span>{showMarkdownPreview ? 'Ocultar' : 'Ver'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className={`px-2 py-1 rounded text-[11px] transition-colors cursor-pointer flex items-center gap-1 ${
                isDark ? 'hover:text-zinc-200 text-zinc-400' : 'hover:text-zinc-950 text-zinc-600'
              }`}
              title="Baixar modelo padrão para preenchimento"
            >
              <Download className="size-3" />
              <span>Modelo</span>
            </button>
            <button
              type="button"
              onClick={() => mdFileInputRef.current?.click()}
              className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                isDark
                  ? 'bg-zinc-900 border-zinc-800 text-zinc-200 hover:bg-zinc-800 hover:border-zinc-700'
                  : 'bg-white border-zinc-200 text-zinc-800 hover:bg-zinc-50'
              }`}
            >
              <Upload className="size-3" />
              <span>Importar .md</span>
            </button>
          </div>
        </div>

        {/* Visualização de Pré-visualização do BRAND.md */}
        {showMarkdownPreview && brandMarkdown && (
          <div
            className={`mx-5 my-2 p-3 rounded-lg border text-[11px] font-mono max-h-36 overflow-y-auto custom-scrollbar whitespace-pre-wrap ${
              isDark
                ? 'bg-zinc-950/80 border-zinc-800/80 text-zinc-300'
                : 'bg-zinc-50 border-zinc-200 text-zinc-800'
            }`}
          >
            {brandMarkdown}
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-5 overflow-y-auto custom-scrollbar flex-1 space-y-4 text-xs">
          {/* Linha 1: Nome da Marca & Segmento lado a lado */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-medium mb-1 text-zinc-300 text-[11px]">
                Nome da Marca / Razão Social <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Cristallo, Maison Éthérée..."
                className={`w-full px-3 py-1.5 rounded-lg text-xs outline-none border transition-all ${
                  isDark
                    ? 'bg-zinc-900/60 border-zinc-800 text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-600 focus:bg-zinc-900'
                    : 'bg-white border-zinc-300 text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400'
                }`}
              />
            </div>

            <div>
              <label className="block font-medium mb-1 text-zinc-300 text-[11px]">
                Segmento de Atuação
              </label>
              <Select value={segment} onValueChange={(val) => setSegment(val)}>
                <SelectTrigger
                  className={`w-full h-[30px] px-3 py-1 rounded-lg text-xs border transition-all cursor-pointer ${
                    isDark
                      ? 'bg-zinc-900/60 border-zinc-800 text-zinc-100 hover:border-zinc-700 hover:bg-zinc-900 focus:border-zinc-600'
                      : 'bg-white border-zinc-300 text-zinc-900 hover:border-zinc-400 focus:border-zinc-400'
                  }`}
                >
                  <SelectValue placeholder="Selecione o segmento" />
                </SelectTrigger>
                <SelectContent
                  className={`rounded-xl border shadow-2xl p-1.5 z-[70] backdrop-blur-md min-w-[var(--radix-select-trigger-width)] ${
                    isDark
                      ? 'bg-[#141418]/95 border-zinc-800 text-zinc-100 shadow-black/80'
                      : 'bg-white/95 border-zinc-200 text-zinc-900 shadow-zinc-300/50'
                  }`}
                >
                  {SEGMENTS.map((seg) => (
                    <SelectItem
                      key={seg}
                      value={seg}
                      className={`text-xs rounded-lg py-2 pl-8 pr-3 cursor-pointer transition-colors ${
                        isDark
                          ? 'hover:bg-zinc-800/80 focus:bg-zinc-800 focus:text-white text-zinc-200'
                          : 'hover:bg-zinc-100 focus:bg-zinc-100 focus:text-zinc-950 text-zinc-800'
                      }`}
                    >
                      {seg}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Linha 2: Logotipo Oficial (Card horizontal minimalista com extração de cor) */}
          <div>
            <label className="block font-medium mb-1 text-zinc-300 text-[11px]">
              Logotipo Oficial (PNG transparente ou SVG)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".png,.svg,.webp,.jpg,.jpeg"
              onChange={handleLogoUpload}
              className="hidden"
            />
            <div
              className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 ${
                isDark ? 'bg-zinc-900/40 border-zinc-800/80' : 'bg-zinc-50 border-zinc-200'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`size-10 rounded-lg border flex items-center justify-center shrink-0 overflow-hidden ${
                    isDark ? 'bg-zinc-900 border-zinc-700/80' : 'bg-white border-zinc-200'
                  }`}
                >
                  {logoUrl ? (
                    <img src={logoUrl} alt="Logo" className="max-h-full max-w-full object-contain p-0.5" />
                  ) : (
                    <Upload className="size-4 text-zinc-500" />
                  )}
                </div>
                <div className="truncate">
                  <div className="font-medium text-xs truncate">
                    {logoUrl ? 'Logotipo definido' : 'Nenhum logotipo anexado'}
                  </div>
                  <div className="text-[10px] text-zinc-500">
                    Formatos recomendados: SVG ou PNG sem fundo
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {logoUrl && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleExtractColors(logoUrl)}
                      className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                        isDark
                          ? 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-300 hover:text-white'
                          : 'bg-white hover:bg-zinc-50 border-zinc-200 text-zinc-700 hover:text-zinc-950'
                      }`}
                      title="Selecionar área e extrair paleta cromática da logo"
                    >
                      <Crop className="size-3 text-zinc-400" />
                      <span>Extrair Cores</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setLogoUrl('')}
                      className="p-1.5 rounded-lg border border-transparent hover:border-zinc-800 hover:bg-zinc-800/60 text-zinc-400 hover:text-rose-400 transition-colors cursor-pointer"
                      title="Remover logotipo"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                    isDark
                      ? 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-200'
                      : 'bg-white hover:bg-zinc-50 border-zinc-200 text-zinc-800'
                  }`}
                >
                  {logoUrl ? 'Substituir' : 'Selecionar'}
                </button>
              </div>
            </div>
          </div>

          {/* Linha 3: Paleta Cromática da Marca (3 bolinhas separadas identificando primária, secundária e terciária) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="font-medium text-zinc-300 text-[11px] flex items-center gap-1.5">
                <Palette className="size-3 text-zinc-400" />
                <span>Paleta Cromática da Marca</span>
              </label>
              <span className="text-[10px] text-zinc-500">
                Clique nas amostras para personalizar
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {/* 1. Cor Primária */}
              <div
                className={`p-3 rounded-xl border flex flex-col items-center justify-center text-center gap-2 transition-all ${
                  isDark
                    ? 'bg-zinc-900/40 border-zinc-800/80 hover:border-zinc-700'
                    : 'bg-zinc-50 border-zinc-200 hover:border-zinc-300'
                }`}
              >
                <span className="text-[11px] font-medium text-zinc-300">
                  Cor Primária
                </span>

                <div
                  className="relative group cursor-pointer"
                  onClick={() => primaryColorRef.current?.click()}
                  title="Alterar Cor Primária"
                >
                  <div
                    className="size-10 rounded-full border-2 border-zinc-700 shadow-sm transition-transform group-hover:scale-105"
                    style={{ backgroundColor: primaryColor }}
                  />
                  <input
                    ref={primaryColorRef}
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value.toUpperCase())}
                    className="sr-only"
                  />
                </div>

                <input
                  type="text"
                  maxLength={7}
                  value={primaryColor}
                  onChange={(e) => {
                    let val = e.target.value;
                    if (!val.startsWith('#') && val.length > 0) val = '#' + val;
                    setPrimaryColor(val.toUpperCase());
                  }}
                  className={`w-20 px-1.5 py-0.5 rounded text-[11px] font-mono text-center outline-none border transition-colors ${
                    isDark
                      ? 'bg-zinc-900 border-zinc-800 text-zinc-200 focus:border-zinc-600'
                      : 'bg-white border-zinc-300 text-zinc-800 focus:border-zinc-400'
                  }`}
                />
              </div>

              {/* 2. Cor Secundária */}
              <div
                className={`p-3 rounded-xl border flex flex-col items-center justify-center text-center gap-2 transition-all ${
                  isDark
                    ? 'bg-zinc-900/40 border-zinc-800/80 hover:border-zinc-700'
                    : 'bg-zinc-50 border-zinc-200 hover:border-zinc-300'
                }`}
              >
                <span className="text-[11px] font-medium text-zinc-300">
                  Cor Secundária
                </span>

                <div
                  className="relative group cursor-pointer"
                  onClick={() => secondaryColorRef.current?.click()}
                  title="Alterar Cor Secundária"
                >
                  <div
                    className="size-10 rounded-full border-2 border-zinc-700 shadow-sm transition-transform group-hover:scale-105"
                    style={{ backgroundColor: secondaryColor }}
                  />
                  <input
                    ref={secondaryColorRef}
                    type="color"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value.toUpperCase())}
                    className="sr-only"
                  />
                </div>

                <input
                  type="text"
                  maxLength={7}
                  value={secondaryColor}
                  onChange={(e) => {
                    let val = e.target.value;
                    if (!val.startsWith('#') && val.length > 0) val = '#' + val;
                    setSecondaryColor(val.toUpperCase());
                  }}
                  className={`w-20 px-1.5 py-0.5 rounded text-[11px] font-mono text-center outline-none border transition-colors ${
                    isDark
                      ? 'bg-zinc-900 border-zinc-800 text-zinc-200 focus:border-zinc-600'
                      : 'bg-white border-zinc-300 text-zinc-800 focus:border-zinc-400'
                  }`}
                />
              </div>

              {/* 3. Cor Terciária */}
              <div
                className={`p-3 rounded-xl border flex flex-col items-center justify-center text-center gap-2 transition-all ${
                  isDark
                    ? 'bg-zinc-900/40 border-zinc-800/80 hover:border-zinc-700'
                    : 'bg-zinc-50 border-zinc-200 hover:border-zinc-300'
                }`}
              >
                <span className="text-[11px] font-medium text-zinc-300">
                  Cor Terciária
                </span>

                <div
                  className="relative group cursor-pointer"
                  onClick={() => tertiaryColorRef.current?.click()}
                  title="Alterar Cor Terciária"
                >
                  <div
                    className="size-10 rounded-full border-2 border-zinc-700 shadow-sm transition-transform group-hover:scale-105"
                    style={{ backgroundColor: tertiaryColor }}
                  />
                  <input
                    ref={tertiaryColorRef}
                    type="color"
                    value={tertiaryColor}
                    onChange={(e) => setTertiaryColor(e.target.value.toUpperCase())}
                    className="sr-only"
                  />
                </div>

                <input
                  type="text"
                  maxLength={7}
                  value={tertiaryColor}
                  onChange={(e) => {
                    let val = e.target.value;
                    if (!val.startsWith('#') && val.length > 0) val = '#' + val;
                    setTertiaryColor(val.toUpperCase());
                  }}
                  className={`w-20 px-1.5 py-0.5 rounded text-[11px] font-mono text-center outline-none border transition-colors ${
                    isDark
                      ? 'bg-zinc-900 border-zinc-800 text-zinc-200 focus:border-zinc-600'
                      : 'bg-white border-zinc-300 text-zinc-800 focus:border-zinc-400'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Linha 4: Tom de Voz Editorial da Marca */}
          <div>
            <label className="block font-medium mb-1 text-zinc-300 text-[11px]">
              Tom de Voz Editorial da Marca (Opcional)
            </label>
            <input
              type="text"
              value={toneOfVoice}
              onChange={(e) => setToneOfVoice(e.target.value)}
              placeholder="Ex: Sóbrio, sofisticado, contemporâneo e sem superlativos..."
              className={`w-full px-3 py-1.5 rounded-lg text-xs outline-none border transition-all ${
                isDark
                  ? 'bg-zinc-900/60 border-zinc-800 text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-600 focus:bg-zinc-900'
                  : 'bg-white border-zinc-300 text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400'
              }`}
            />
          </div>

          {/* Linha 5: Dados Comerciais da Contracapa */}
          <div className="pt-2 border-t border-zinc-800/60 space-y-2">
            <label className="block font-medium text-zinc-400 text-[11px]">
              Dados Comerciais (Preenchimento automático na contracapa)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="relative">
                <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-zinc-500 pointer-events-none" />
                <input
                  type="text"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="WhatsApp Comercial"
                  className={`w-full pl-7 pr-2.5 py-1.5 rounded-lg text-xs outline-none border transition-all ${
                    isDark
                      ? 'bg-zinc-900/60 border-zinc-800 text-zinc-200 placeholder:text-zinc-500 focus:border-zinc-600'
                      : 'bg-white border-zinc-300 text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400'
                  }`}
                />
              </div>

              <div className="relative">
                <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-zinc-500 pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="E-mail de Vendas"
                  className={`w-full pl-7 pr-2.5 py-1.5 rounded-lg text-xs outline-none border transition-all ${
                    isDark
                      ? 'bg-zinc-900/60 border-zinc-800 text-zinc-200 placeholder:text-zinc-500 focus:border-zinc-600'
                      : 'bg-white border-zinc-300 text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400'
                  }`}
                />
              </div>

              <div className="relative">
                <Globe className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-zinc-500 pointer-events-none" />
                <input
                  type="text"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="Website Institucional"
                  className={`w-full pl-7 pr-2.5 py-1.5 rounded-lg text-xs outline-none border transition-all ${
                    isDark
                      ? 'bg-zinc-900/60 border-zinc-800 text-zinc-200 placeholder:text-zinc-500 focus:border-zinc-600'
                      : 'bg-white border-zinc-300 text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400'
                  }`}
                />
              </div>

              <div className="relative">
                <Instagram className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-zinc-500 pointer-events-none" />
                <input
                  type="text"
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  placeholder="Instagram (@marca)"
                  className={`w-full pl-7 pr-2.5 py-1.5 rounded-lg text-xs outline-none border transition-all ${
                    isDark
                      ? 'bg-zinc-900/60 border-zinc-800 text-zinc-200 placeholder:text-zinc-500 focus:border-zinc-600'
                      : 'bg-white border-zinc-300 text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div
            className={`pt-3 border-t flex items-center justify-between shrink-0 ${
              isDark ? 'border-zinc-800/80' : 'border-zinc-200'
            }`}
          >
            <div>
              {editingBrand && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="px-2 py-1 rounded-lg text-xs text-zinc-500 hover:text-rose-400 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="size-3.5" />
                  <span>Excluir Marca</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={closeBrandModal}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                  isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-zinc-600 hover:text-zinc-950'
                }`}
              >
                Cancelar
              </button>

              <button
                type="submit"
                className={`px-4 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer ${
                  isDark
                    ? 'bg-zinc-100 hover:bg-white text-zinc-950'
                    : 'bg-zinc-900 hover:bg-zinc-800 text-white'
                }`}
              >
                <Check className="size-3.5" />
                <span>{editingBrand ? 'Salvar Alterações' : 'Cadastrar Marca'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {logoUrl && (
        <LogoAreaSelectorModal
          isOpen={isAreaSelectorOpen}
          onClose={() => setIsAreaSelectorOpen(false)}
          imageSrc={logoUrl}
          initialPalette={{
            primary: primaryColor,
            secondary: secondaryColor,
            accent: tertiaryColor,
          }}
          onApply={handleApplyAreaSelection}
          isDark={isDark}
        />
      )}
    </div>
  );
};
