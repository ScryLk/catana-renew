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
} from 'lucide-react';
import { toast } from 'sonner';
import { useStudioStore } from '../../store/studioStore';
import { STUDIO_PALETTE_PRESETS } from '../../data/aureaCatalog.mock';

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

  const editingBrand = brandModalEditingId
    ? brands.find((b) => b.id === brandModalEditingId)
    : null;

  const [name, setName] = useState('');
  const [segment, setSegment] = useState(SEGMENTS[0]);
  const [paletteName, setPaletteName] = useState(STUDIO_PALETTE_PRESETS[0].name);
  const [logoUrl, setLogoUrl] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [instagram, setInstagram] = useState('');

  useEffect(() => {
    if (editingBrand) {
      setName(editingBrand.name);
      setSegment(editingBrand.segment || SEGMENTS[0]);
      setPaletteName(editingBrand.paletteName || STUDIO_PALETTE_PRESETS[0].name);
      setLogoUrl(editingBrand.logoUrl || '');
      setWhatsapp(editingBrand.commercialContact?.whatsapp || '');
      setEmail(editingBrand.commercialContact?.email || '');
      setWebsite(editingBrand.commercialContact?.website || '');
      setInstagram(editingBrand.commercialContact?.instagram || '');
    } else {
      setName('');
      setSegment(SEGMENTS[0]);
      setPaletteName(STUDIO_PALETTE_PRESETS[0].name);
      setLogoUrl('');
      setWhatsapp('');
      setEmail('');
      setWebsite('');
      setInstagram('');
    }
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
        setLogoUrl(reader.result);
        toast.success('Logotipo carregado com sucesso!');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const brandName = name.trim();
    if (!brandName) {
      toast.error('Por favor, informe o nome da marca.');
      return;
    }

    const brandData = {
      name: brandName,
      segment,
      paletteName,
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
        className={`w-full max-w-lg rounded-2xl border flex flex-col overflow-hidden transition-all animate-in zoom-in-95 duration-200 ${
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
              <select
                value={segment}
                onChange={(e) => setSegment(e.target.value)}
                className={`w-full px-3 py-1.5 rounded-lg text-xs outline-none border transition-all cursor-pointer ${
                  isDark
                    ? 'bg-zinc-900/60 border-zinc-800 text-zinc-100 focus:border-zinc-600 focus:bg-zinc-900'
                    : 'bg-white border-zinc-300 text-zinc-900 focus:border-zinc-400'
                }`}
              >
                {SEGMENTS.map((seg) => (
                  <option key={seg} value={seg} className={isDark ? 'bg-zinc-900 text-zinc-100' : 'bg-white text-zinc-900'}>
                    {seg}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Linha 2: Logotipo Oficial (Card horizontal minimalista) */}
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
                  <button
                    type="button"
                    onClick={() => setLogoUrl('')}
                    className="p-1.5 rounded-lg border border-transparent hover:border-zinc-800 hover:bg-zinc-800/60 text-zinc-400 hover:text-rose-400 transition-colors cursor-pointer"
                    title="Remover logotipo"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
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

          {/* Linha 3: Paleta Cromática Institucional (Cards compactos) */}
          <div>
            <label className="block font-medium mb-1.5 text-zinc-300 text-[11px] flex items-center gap-1.5">
              <Palette className="size-3 text-zinc-400" />
              <span>Paleta Cromática da Marca</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {STUDIO_PALETTE_PRESETS.slice(0, 4).map((p) => {
                const isSelected = paletteName === p.name;
                return (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => setPaletteName(p.name)}
                    className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-2 ${
                      isSelected
                        ? isDark
                          ? 'bg-zinc-800/80 border-zinc-500 text-zinc-100 shadow-xs ring-1 ring-zinc-600/40'
                          : 'bg-zinc-100 border-zinc-400 text-zinc-900 shadow-xs'
                        : isDark
                          ? 'bg-zinc-900/30 border-zinc-800/70 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                          : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:text-zinc-900'
                    }`}
                  >
                    <div className="truncate min-w-0 flex-1">
                      <div className="font-medium truncate text-[11px]">{p.name}</div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span
                        className="size-3 rounded-full border border-black/20"
                        style={{ backgroundColor: p.primary }}
                      />
                      <span
                        className="size-3 rounded-full border border-black/20"
                        style={{ backgroundColor: p.accent }}
                      />
                      <span
                        className="size-3 rounded-full border border-black/20"
                        style={{ backgroundColor: p.background }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Linha 4: Dados Comerciais da Contracapa */}
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
    </div>
  );
};
