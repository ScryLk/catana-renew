import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  PanelLeftClose,
  Search,
  BookOpen,
  Sun,
  Moon,
  Settings,
  Image as ImageIcon,
  LogOut,
  ChevronUp,
  Sparkles,
} from 'lucide-react';
import { useStudioStore } from '../../store/studioStore';
import { useAuthStore } from '../../store/authStore';
import api from '../../services/api';

export interface RecentCatalogItem {
  id: string;
  title: string;
  totalPages: number;
  category: string;
  updatedAt: string;
}

const RECENT_CATALOGS: RecentCatalogItem[] = [
  {
    id: 'aurea-2026',
    title: 'ÁUREA — Coleção Inverno 2026',
    totalPages: 10,
    category: 'Alta-Costura',
    updatedAt: 'Hoje',
  },
  {
    id: 'techgear-2026',
    title: 'TechGear — Setup & Tech',
    totalPages: 6,
    category: 'Tecnologia',
    updatedAt: 'Ontem',
  },
  {
    id: 'confeitaria-artesanal',
    title: 'Confeitaria Artesanal — Festas',
    totalPages: 4,
    category: 'Gastronomia',
    updatedAt: '3 dias atrás',
  },
  {
    id: 'cristallo-joias',
    title: 'Cristallo — Joalheria & Gemas',
    totalPages: 8,
    category: 'Alta Joalheria',
    updatedAt: 'Semana passada',
  },
];

export const StudioSidebar: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout, isAuthenticated, openAuthModal } = useAuthStore();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  const [quotaData, setQuotaData] = useState<{
    tier: string;
    plan_name: string;
    tokens_used_this_month: number;
    monthly_token_quota: number;
    percentage_used: number;
  } | null>(null);

  const {
    isStudioSidebarOpen,
    toggleStudioSidebar,
    hasStartedSession,
    resetToHome,
    activeCatalogId,
    loadExistingCatalog,
    agentStatus,
    theme,
    toggleTheme,
    openAccountSettings,
  } = useStudioStore();

  const isDark = theme === 'dark';
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    let isMounted = true;
    const fetchQuota = async () => {
      try {
        const res = await api.get('/api/v2/studio/quotas/');
        if (res.data && isMounted) {
          setQuotaData(res.data);
        }
      } catch {
        // Usa valores padrao se o backend estiver fora
      }
    };
    fetchQuota();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsProfileMenuOpen(false);
      }
    };
    if (isProfileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isProfileMenuOpen]);

  const handleLogout = () => {
    logout();
    setIsProfileMenuOpen(false);
  };

  const filteredCatalogs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return RECENT_CATALOGS;
    return RECENT_CATALOGS.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const handleSelectCatalog = (catalogId: string) => {
    loadExistingCatalog(catalogId);
  };

  const handleNewCatalog = () => {
    resetToHome();
  };

  if (!isStudioSidebarOpen) return null;

  return (
    <aside
      className={`w-64 sm:w-68 h-dvh flex flex-col shrink-0 border-r select-none z-30 transition-all duration-200 ${
        isDark
          ? 'bg-[#0b0b0e] border-zinc-800 text-zinc-300'
          : 'bg-[#f9f9fb] border-zinc-200 text-zinc-700'
      }`}
    >
      {/* Top Header: Brand & Collapse Toggle */}
      <div className="h-13 px-3.5 flex items-center justify-between border-b border-inherit shrink-0">
        <button
          type="button"
          onClick={handleNewCatalog}
          className="flex items-center gap-2 cursor-pointer group bg-transparent border-none p-0"
          title="Ir para o início"
        >
          <svg
            viewBox="40 10 640 170"
            className={`h-4.5 fill-none stroke-current group-hover:opacity-80 transition-opacity ${
              isDark ? 'text-white' : 'text-zinc-950'
            }`}
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path
              d="M 132 96 C 124 82 104 76 88 86 C 70 97 62 122 74 138 C 84 150 104 148 116 136 C 128 148 146 142 158 120 C 170 100 190 90 206 90 C 194 78 172 80 160 94 C 148 108 148 128 160 140 C 170 149 186 145 196 132 C 202 124 206 108 208 92 C 206 112 206 130 214 142 C 222 152 236 146 244 128 C 256 102 270 66 282 44 C 280 70 276 110 278 132 C 280 148 294 152 308 138 C 322 124 344 100 384 90 C 370 78 348 80 336 94 C 324 108 324 128 336 140 C 346 149 362 145 372 132 C 378 124 382 108 384 92 C 382 112 382 130 390 142 C 398 152 412 146 420 128 C 428 110 438 96 446 88 C 448 106 446 128 448 142 C 458 116 472 94 486 88 C 494 84 498 92 498 104 C 498 120 496 132 502 142 C 508 150 520 146 528 128 C 536 112 560 92 592 90 C 578 78 556 80 544 94 C 532 108 532 128 544 140 C 554 149 570 145 580 132 C 586 124 590 108 592 92 C 590 112 590 130 598 142 C 608 154 626 148 640 124"
            />
            <path d="M 250 76 C 272 68 300 64 328 70" />
          </svg>
          <span
            className={`text-[9px] font-mono font-semibold px-1 py-0.2 rounded border ${
              isDark
                ? 'bg-zinc-800/80 border-zinc-700 text-zinc-300'
                : 'bg-zinc-200/80 border-zinc-300 text-zinc-700'
            }`}
          >
            2.0
          </span>
        </button>

        <button
          type="button"
          onClick={toggleStudioSidebar}
          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
            isDark
              ? 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100'
              : 'hover:bg-zinc-200 text-zinc-500 hover:text-zinc-900'
          }`}
          title="Recolher barra lateral (Ctrl+B)"
          aria-label="Recolher barra lateral"
        >
          <PanelLeftClose className="size-4" />
        </button>
      </div>

      {/* Action Button: New Catalog (ChatGPT style) */}
      <div className="p-3 pb-2 shrink-0">
        <button
          type="button"
          onClick={handleNewCatalog}
          className={`w-full py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-between transition-all cursor-pointer border shadow-xs ${
            isDark
              ? 'bg-zinc-900/80 hover:bg-zinc-800/90 border-zinc-700/80 text-zinc-100'
              : 'bg-white hover:bg-zinc-100 border-zinc-300 text-zinc-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <Plus className="size-3.5" />
            <span>Novo Catálogo</span>
          </div>
          <span className="text-[10px] font-mono text-zinc-500">IA</span>
        </button>
      </div>

      {/* Search Input */}
      <div className="px-3 py-1.5 shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-zinc-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar catálogo..."
            className={`w-full pl-7 pr-2.5 py-1.5 rounded-lg text-xs outline-none border transition-all ${
              isDark
                ? 'bg-zinc-900/50 border-zinc-800/80 text-zinc-200 placeholder:text-zinc-500 focus:border-zinc-600 focus:bg-zinc-900'
                : 'bg-white border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400'
            }`}
          />
        </div>
      </div>

      {/* Recent Catalogs List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-2 py-2 space-y-1">
        <div className="px-2 py-1 flex items-center justify-between text-[10px] uppercase font-mono tracking-wider text-zinc-500 font-semibold">
          <span>Catálogos Recentes</span>
          <span>{filteredCatalogs.length}</span>
        </div>

        {filteredCatalogs.map((catalog) => {
          const isActive = hasStartedSession && activeCatalogId === catalog.id;

          return (
            <button
              key={catalog.id}
              type="button"
              onClick={() => handleSelectCatalog(catalog.id)}
              className={`w-full text-left p-2 rounded-xl transition-all flex items-start justify-between gap-2 group cursor-pointer border ${
                isActive
                  ? isDark
                    ? 'bg-zinc-800/80 border-zinc-700 text-white font-medium shadow-2xs'
                    : 'bg-white border-zinc-300 text-zinc-950 font-medium shadow-2xs'
                  : isDark
                  ? 'border-transparent hover:bg-zinc-900/70 hover:border-zinc-800/60 text-zinc-300 hover:text-white'
                  : 'border-transparent hover:bg-zinc-200/60 hover:border-zinc-300/60 text-zinc-700 hover:text-zinc-950'
              }`}
            >
              <div className="flex items-start gap-2 min-w-0 flex-1">
                <BookOpen
                  className={`size-3.5 shrink-0 mt-0.5 ${
                    isActive
                      ? isDark
                        ? 'text-white'
                        : 'text-zinc-900'
                      : 'text-zinc-500 group-hover:text-zinc-300'
                  }`}
                />
                <div className="truncate flex-1">
                  <div className="text-xs truncate font-medium">{catalog.title}</div>
                  <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 mt-0.5">
                    <span>{catalog.totalPages} págs</span>
                    <span>·</span>
                    <span className="truncate">{catalog.category}</span>
                  </div>
                </div>
              </div>

              {isActive ? (
                <span className="size-1.5 rounded-full bg-emerald-400 shrink-0 mt-1.5 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
              ) : (
                <span className="text-[10px] text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5">
                  Abrir
                </span>
              )}
            </button>
          );
        })}
      </div>


      {/* Footer: Status, Theme & Account */}
      {(() => {
        const displayName = user?.name || user?.username || 'Lucas';
        const displayEmail = user?.email || 'lucas@catana.com.br';
        const displayInitial = displayName.charAt(0).toUpperCase() || 'L';
        const planName = quotaData?.plan_name || 'Plano Gratuito';
        const tokensUsed = quotaData?.tokens_used_this_month || 0;
        const tokenQuota = quotaData?.monthly_token_quota || 100000;
        const percentageUsed = quotaData?.percentage_used || 0;

        return (
          <div className="p-3 border-t border-inherit shrink-0 space-y-2.5 relative" ref={profileMenuRef}>
            {/* Status Pill & Theme Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                <span
                  className={`size-1.5 rounded-full ${
                    agentStatus === 'thinking' || agentStatus === 'generating'
                      ? 'bg-amber-400 animate-pulse'
                      : 'bg-emerald-400'
                  }`}
                />
                <span className="capitalize">
                  {agentStatus === 'thinking'
                    ? 'Agente pensando'
                    : agentStatus === 'generating'
                    ? 'Gerando'
                    : 'Aguardando instrução'}
                </span>
              </div>

              <button
                type="button"
                onClick={toggleTheme}
                className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                  isDark
                    ? 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
                    : 'bg-white border-zinc-200 text-zinc-600 hover:text-zinc-950 hover:border-zinc-300'
                }`}
                title={isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
                aria-label="Alternar tema"
              >
                {isDark ? <Sun className="size-3" /> : <Moon className="size-3" />}
              </button>
            </div>

            {/* Profile Dropdown Menu (Opens Upwards) */}
            {isProfileMenuOpen && (
              <div
                className={`absolute bottom-full left-2 right-2 mb-2 rounded-2xl border shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150 backdrop-blur-xl transition-all ${
                  isDark
                    ? 'bg-[#121215]/98 border-zinc-800 text-zinc-200 shadow-[0_16px_48px_rgba(0,0,0,0.8)]'
                    : 'bg-white/98 border-zinc-200 text-zinc-800 shadow-[0_12px_36px_rgba(0,0,0,0.15)]'
                }`}
              >
                {/* Header: User Info & Plan Badge */}
                <div className="p-2 flex items-center gap-2.5 border-b border-inherit pb-2.5">
                  <div className="size-9 rounded-full bg-zinc-800 border border-zinc-700 text-white flex items-center justify-center font-bold text-sm shrink-0">
                    {displayInitial}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <div className="text-xs font-semibold truncate leading-tight">{displayName}</div>
                      <span
                        className={`text-[9px] font-mono px-1.5 py-0.2 rounded-full border shrink-0 ${
                          isDark
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}
                      >
                        {planName}
                      </span>
                    </div>
                    <div className="text-[11px] text-zinc-400 truncate leading-tight mt-0.5">{displayEmail}</div>
                  </div>
                </div>

                {/* AI Tokens Quota Widget */}
                <div className="p-2 my-1 rounded-xl bg-zinc-500/5 border border-inherit">
                  <div className="flex items-center justify-between text-[10px] text-zinc-400 font-medium mb-1.5">
                    <span className="flex items-center gap-1">
                      <Sparkles className="size-2.5 text-indigo-400" />
                      <span>Consumo de IA</span>
                    </span>
                    <span className="font-mono">
                      {tokensUsed.toLocaleString('pt-BR')} / {tokenQuota.toLocaleString('pt-BR')}
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-zinc-700/30 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.max(2, percentageUsed))}%` }}
                    />
                  </div>
                </div>

                {/* Navigation Actions */}
                <div className="space-y-0.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      openAccountSettings();
                    }}
                    className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2.5 transition-colors cursor-pointer text-left ${
                      isDark
                        ? 'hover:bg-zinc-800/80 hover:text-white text-zinc-300'
                        : 'hover:bg-zinc-100 hover:text-zinc-950 text-zinc-700'
                    }`}
                  >
                    <Settings className="size-3.5 text-zinc-400" />
                    <span className="flex-1">Configurações da Conta</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      navigate('/media');
                    }}
                    className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2.5 transition-colors cursor-pointer text-left ${
                      isDark
                        ? 'hover:bg-zinc-800/80 hover:text-white text-zinc-300'
                        : 'hover:bg-zinc-100 hover:text-zinc-950 text-zinc-700'
                    }`}
                  >
                    <ImageIcon className="size-3.5 text-zinc-400" />
                    <span className="flex-1">Biblioteca de Mídias</span>
                  </button>
                </div>

                {/* Separator */}
                <div className="my-1.5 border-t border-inherit" />

                {/* Logout Action */}
                <button
                  type="button"
                  onClick={handleLogout}
                  className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2.5 transition-colors cursor-pointer text-left ${
                    isDark
                      ? 'text-red-400 hover:bg-red-500/10 hover:text-red-300'
                      : 'text-red-600 hover:bg-red-50 hover:text-red-700'
                  }`}
                >
                  <LogOut className="size-3.5" />
                  <span>Sair da Conta</span>
                </button>
              </div>
            )}

            {/* User Account Trigger Button */}
            <button
              type="button"
              onClick={() => {
                if (!isAuthenticated) {
                  openAuthModal('login');
                } else {
                  setIsProfileMenuOpen((prev) => !prev);
                }
              }}
              className={`w-full p-2 rounded-xl flex items-center justify-between border transition-all cursor-pointer text-left ${
                isProfileMenuOpen
                  ? isDark
                    ? 'bg-zinc-800 border-zinc-700 text-white'
                    : 'bg-zinc-100 border-zinc-300 text-zinc-950'
                  : isDark
                  ? 'bg-zinc-900/50 hover:bg-zinc-800/60 border-zinc-800/80 text-zinc-200'
                  : 'bg-white hover:bg-zinc-50 border-zinc-200 text-zinc-900'
              }`}
              aria-expanded={isProfileMenuOpen}
              aria-haspopup="true"
              title={isAuthenticated ? 'Opções de perfil e configurações' : 'Entrar na sua conta'}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="size-7 rounded-full bg-zinc-800 border border-zinc-700 text-white flex items-center justify-center font-semibold text-xs shrink-0">
                  {displayInitial}
                </div>
                <div className="truncate">
                  <div className="text-xs font-semibold truncate leading-tight">
                    {isAuthenticated ? displayName : 'Entrar na Conta'}
                  </div>
                  <div className="text-[10px] text-zinc-500 truncate leading-tight mt-0.5">
                    {isAuthenticated ? 'Workspace Pessoal' : 'Clique para autenticar'}
                  </div>
                </div>
              </div>
              <ChevronUp
                className={`size-3.5 text-zinc-400 transition-transform duration-200 shrink-0 ml-1 ${
                  isProfileMenuOpen ? 'rotate-180' : ''
                }`}
              />
            </button>
          </div>
        );
      })()}
    </aside>
  );
};
