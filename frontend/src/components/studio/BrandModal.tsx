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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeBrandModal();
      }}
    >
      <div
        className={`w-full max-w-xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-all animate-in zoom-in-95 duration-200 ${
          isDark
            ? 'bg-[#121215] border-zinc-800 text-zinc-100'
            : 'bg-white border-zinc-200 text-zinc-900'
        }`}
      >
        {/* Header */}
        <div
          className={`px-6 py-4 border-b flex items-center justify-between shrink-0 ${
            isDark ? 'border-zinc-800/80 bg-zinc-900/40' : 'border-zinc-100 bg-zinc-50/60'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`size-9 rounded-xl flex items-center justify-center border ${
                isDark
                  ? 'bg-zinc-800 border-zinc-700 text-[#D4AF37]'
                  : 'bg-amber-50 border-amber-200 text-[#B08D57]'
              }`}
            >
              <Building2 className="size-4.5" />
            </div>
            <div>
              <h2 id="brand-modal-title" className="text-sm font-semibold tracking-tight">
                {editingBrand ? 'Editar Marca & Brand Kit' : 'Nova Marca / Empresa'}
              </h2>
              <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                Configure logotipo, paleta e contatos para reutilização automática em todos os catálogos.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeBrandModal}
            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
              isDark
                ? 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                : 'bg-zinc-100 border-zinc-200 text-zinc-600 hover:text-zinc-950'
            }`}
            aria-label="Fechar"
            title="Fechar (Esc)"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-5 text-xs">
          {/* Nome da Marca */}
          <div>
            <label className="block font-medium mb-1.5 text-zinc-300">
              Nome da Marca / Razão Social <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Maison Éthérée, Nexus Hardware B2B, Atelier Sucré..."
              className={`w-full px-3.5 py-2 rounded-xl text-xs outline-none border transition-all ${
                isDark
                  ? 'bg-zinc-900/70 border-zinc-800 text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-600 focus:bg-zinc-900'
                  : 'bg-white border-zinc-300 text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400'
              }`}
            />
          </div>

          {/* Segmento Comercial */}
          <div>
            <label className="block font-medium mb-1.5 text-zinc-300">
              Segmento de Atuação
            </label>
            <div className="flex flex-wrap gap-1.5">
              {SEGMENTS.map((seg) => {
                const isSelected = segment === seg;
                return (
                  <button
                    key={seg}
                    type="button"
                    onClick={() => setSegment(seg)}
                    className={`px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer text-xs ${
                      isSelected
                        ? isDark
                          ? 'bg-zinc-800 border-[#B08D57] text-[#D4AF37] font-semibold'
                          : 'bg-amber-50 border-[#B08D57] text-[#9A7B4C] font-semibold'
                        : isDark
                          ? 'bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                          : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:text-zinc-900'
                    }`}
                  >
                    {seg}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Logotipo */}
          <div>
            <label className="block font-medium mb-1.5 text-zinc-300">
              Logotipo Oficial (PNG Transparente ou SVG)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".png,.svg,.webp,.jpg,.jpeg"
              onChange={handleLogoUpload}
              className="hidden"
            />
            <div className="flex items-center gap-3">
              {logoUrl ? (
                <div className="relative size-14 rounded-xl border border-zinc-700/80 bg-zinc-900 p-1 flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
                  <img src={logoUrl} alt="Logo preview" className="max-h-full max-w-full object-contain" />
                  <button
                    type="button"
                    onClick={() => setLogoUrl('')}
                    className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-black/70 text-zinc-300 hover:text-white"
                    title="Remover logotipo"
                  >
                    <X className="size-2.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`size-14 rounded-xl border border-dashed flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer shrink-0 ${
                    isDark
                      ? 'border-zinc-700 bg-zinc-900/40 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                      : 'border-zinc-300 bg-zinc-50 hover:bg-zinc-100 text-zinc-500 hover:text-zinc-800'
                  }`}
                  title="Upload do logotipo"
                >
                  <Upload className="size-4 text-zinc-400" />
                  <span className="text-[9px]">Logo</span>
                </button>
              )}

              <div className="flex-1 min-w-0">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`px-3 py-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${
                    isDark
                      ? 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800'
                      : 'bg-white border-zinc-300 text-zinc-700 hover:bg-zinc-50'
                  }`}
                >
                  {logoUrl ? 'Substituir Logotipo' : 'Selecionar Arquivo'}
                </button>
                <p className="text-[11px] text-zinc-500 mt-1">
                  Recomendado: imagem com fundo transparente em alta resolução.
                </p>
              </div>
            </div>
          </div>

          {/* Paleta Institucional */}
          <div>
            <label className="block font-medium mb-1.5 text-zinc-300 flex items-center gap-1.5">
              <Palette className="size-3.5 text-zinc-400" />
              <span>Paleta Cromática Institucional</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {STUDIO_PALETTE_PRESETS.slice(0, 4).map((p) => {
                const isSelected = paletteName === p.name;
                return (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => setPaletteName(p.name)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? isDark
                          ? 'bg-zinc-800/90 border-[#B08D57] text-zinc-100 shadow-xs'
                          : 'bg-amber-50/60 border-[#B08D57] text-zinc-900 shadow-xs'
                        : isDark
                          ? 'bg-zinc-900/40 border-zinc-800/80 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                          : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:text-zinc-900'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="font-medium truncate">{p.name}</div>
                      <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                        Contraste {p.contrastRatio || 'AA'}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span
                        className="size-3.5 rounded-full border border-black/20"
                        style={{ backgroundColor: p.primary }}
                        title="Dominante"
                      />
                      <span
                        className="size-3.5 rounded-full border border-black/20"
                        style={{ backgroundColor: p.accent }}
                        title="Acento"
                      />
                      <span
                        className="size-3.5 rounded-full border border-black/20"
                        style={{ backgroundColor: p.background }}
                        title="Fundo"
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dados Comerciais para Contracapa */}
          <div className="space-y-2.5 pt-2 border-t border-inherit">
            <label className="block font-medium text-zinc-300">
              Dados Comerciais (Preenchimento automático da contracapa)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-3 text-zinc-500 pointer-events-none" />
                <input
                  type="text"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="WhatsApp Comercial"
                  className={`w-full pl-8 pr-3 py-1.5 rounded-lg text-xs outline-none border transition-all ${
                    isDark
                      ? 'bg-zinc-900/60 border-zinc-800 text-zinc-200 placeholder:text-zinc-500 focus:border-zinc-600'
                      : 'bg-white border-zinc-300 text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400'
                  }`}
                />
              </div>

              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-3 text-zinc-500 pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="E-mail de Vendas"
                  className={`w-full pl-8 pr-3 py-1.5 rounded-lg text-xs outline-none border transition-all ${
                    isDark
                      ? 'bg-zinc-900/60 border-zinc-800 text-zinc-200 placeholder:text-zinc-500 focus:border-zinc-600'
                      : 'bg-white border-zinc-300 text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400'
                  }`}
                />
              </div>

              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 size-3 text-zinc-500 pointer-events-none" />
                <input
                  type="text"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="Website / Catálogo Online"
                  className={`w-full pl-8 pr-3 py-1.5 rounded-lg text-xs outline-none border transition-all ${
                    isDark
                      ? 'bg-zinc-900/60 border-zinc-800 text-zinc-200 placeholder:text-zinc-500 focus:border-zinc-600'
                      : 'bg-white border-zinc-300 text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400'
                  }`}
                />
              </div>

              <div className="relative">
                <Instagram className="absolute left-3 top-1/2 -translate-y-1/2 size-3 text-zinc-500 pointer-events-none" />
                <input
                  type="text"
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  placeholder="Instagram (@suamarca)"
                  className={`w-full pl-8 pr-3 py-1.5 rounded-lg text-xs outline-none border transition-all ${
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
            className={`pt-4 border-t flex items-center justify-between shrink-0 ${
              isDark ? 'border-zinc-800' : 'border-zinc-200'
            }`}
          >
            <div>
              {editingBrand && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="px-3 py-1.5 rounded-lg text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 transition-colors flex items-center gap-1.5 cursor-pointer"
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
                className={`px-4 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                  isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                Cancelar
              </button>

              <button
                type="submit"
                className="px-5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 bg-[#B08D57] hover:bg-[#9A7B4C] text-white shadow-md transition-all cursor-pointer"
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
