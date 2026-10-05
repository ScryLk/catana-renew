import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { MobileSheet } from '../components/mobile/MobileSheet';
import { StudioResponsiveProvider } from '../components/studio/StudioResponsiveProvider';
import { useStudioResponsive } from '../hooks/useStudioResponsive';
import { StudioMobileNavigation } from '../components/studio/StudioMobileNavigation';
import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { PanelLeftOpen, Plus } from 'lucide-react';
import { StudioSidebar } from '../components/studio/StudioSidebar';
import { AgentCoPilot } from '../components/studio/AgentCoPilot';
import { CatalogCanvasWorkspace } from '../components/studio/CatalogCanvasWorkspace';
import { StudioHomeChat } from '../components/studio/StudioHomeChat';
import { CatalogGenerationExperience } from '../components/studio/CatalogGenerationExperience';
import { KatanaSplashScreen } from '../components/studio/KatanaSplashScreen';
import { AccountSettingsModal } from '../components/studio/AccountSettingsModal';
import { ExportCatalogModal } from '../components/studio/ExportCatalogModal';
import { ProductDrawer } from '../components/studio/ProductDrawer';
import { StudioExcelImportModal } from '../components/studio/StudioExcelImportModal';
import { StudioSystemDesignModal } from '../components/studio/StudioSystemDesignModal';
import { NewCatalogModal } from '../components/studio/NewCatalogModal';
import { BrandModal } from '../components/studio/BrandModal';
import { AuthModal } from '../components/auth/AuthModal';
import { useStudioStore } from '../store/studioStore';
import { useAuthStore, isAutoLoginSettled, isClerkConfigured } from '../store/authStore';
import { toast } from 'sonner';
import { billingService } from '../services/billingService';

const StudioLayout: React.FC = () => {
  const { isPhone, isTablet, isCompact } = useResponsiveLayout();
  const { pane, setPane } = useStudioResponsive();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const location = useLocation();
  const [showSplash, setShowSplash] = useState(() => {
    if (typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    const search = window.location.search || '';
    const hash = window.location.hash || '';
    // Nao exibe a tela de apresentacao caso o usuario esteja retornando de fluxo de autenticacao
    if (search.includes('__clerk') || hash.includes('__clerk') || search.includes('auth=')) {
      return false;
    }
    // Exibe no maximo uma vez por sessao de navegacao
    return !sessionStorage.getItem('catana_splash_shown');
  });

  const {
    user,
    isAuthenticated,
    isAuthModalOpen,
    openAuthModal,
    closeAuthModal,
    checkAuth,
    autoLogin,
  } = useAuthStore();

  const [checkingAuth, setCheckingAuth] = useState(() => {
    if (isClerkConfigured) return !isAuthenticated;
    return !isAutoLoginSettled();
  });

  const handleSplashComplete = () => {
    setShowSplash(false);
    try {
      sessionStorage.setItem('catana_splash_shown', 'true');
    } catch {
      // Silencioso
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      setCheckingAuth(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    checkAuth();
    if (isAutoLoginSettled()) {
      setCheckingAuth(false);
    } else if (!isClerkConfigured) {
      autoLogin().finally(() => setCheckingAuth(false));
    } else {
      const timer = setTimeout(() => setCheckingAuth(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [checkAuth, autoLogin]);

  // Se acessar /login, /register, /forgot-password ou via query param ?auth=..., abre a respectiva visao no modal
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const authParam = searchParams.get('auth');

    if (location.pathname === '/login' || authParam === 'login') {
      openAuthModal('login');
    } else if (location.pathname === '/register' || authParam === 'register') {
      openAuthModal('register');
    } else if (location.pathname === '/forgot-password' || authParam === 'forgot-password') {
      openAuthModal('forgot-password');
    }
  }, [location.pathname, location.search, openAuthModal]);

  const {
    hasStartedSession,
    isGeneratingCatalog,
    isStudioSidebarOpen,
    toggleStudioSidebar,
    isCoPilotOpen,
    toggleCoPilot,
    openNewCatalogModal,
    theme,
    isAccountSettingsOpen,
    openAccountSettings,
    closeAccountSettings,
    toggleProductDrawer,
    loadExistingCatalog,
    syncUserCatalogs,
    syncBrands,
    setActiveUserId,
  } = useStudioStore();

  const isDark = theme === 'dark';

  // Sincroniza os catalogos do usuario do banco de dados na inicializacao
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      setActiveUserId(user.id);
      syncBrands().then(() => syncUserCatalogs());
    }
  }, [isAuthenticated, user?.id, setActiveUserId, syncUserCatalogs, syncBrands]);

  // Trata retorno de checkout do AbacatePay (?billing=success ou ?billing=canceled)
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const billingParam = searchParams.get('billing');

    if (billingParam === 'success') {
      // Reconciliacao ativa imediata com o backend
      billingService.syncBilling()
        .then((res) => {
          if (res.synced) {
            toast.success(`Assinatura confirmada! Seu ${res.plan_name} ja esta ativo.`);
          } else {
            toast.success('Assinatura confirmada com sucesso! Seu plano ja esta ativo.');
          }
          billingService.notifySubscriptionUpdated();
        })
        .catch(() => {
          toast.success('Assinatura confirmada com sucesso!');
          billingService.notifySubscriptionUpdated();
        });
      window.history.replaceState({}, document.title, location.pathname);
    } else if (billingParam === 'canceled') {
      toast.info('Checkout cancelado.', {
        description: 'Nenhuma cobranca foi realizada.',
      });
      window.history.replaceState({}, document.title, location.pathname);
    }
  }, [location.search, location.pathname]);

  // Listener para abrir modal de faturamento remotamente (ex: cota excedida)
  useEffect(() => {
    const handleOpenBilling = () => {
      openAccountSettings();
    };
    window.addEventListener('catana:open-billing-modal', handleOpenBilling);
    return () => window.removeEventListener('catana:open-billing-modal', handleOpenBilling);
  }, [openAccountSettings]);

  // Restaura projeto ativo apos recarregar a pagina (F5) estritamente para o usuario autenticado
  useEffect(() => {
    try {
      if (!isAuthenticated || !user?.id) return;
      const lastActiveCatalogId = localStorage.getItem(`katana_studio_last_active_catalog:${user.id}`);
      if (lastActiveCatalogId && !useStudioStore.getState().hasStartedSession) {
        loadExistingCatalog(lastActiveCatalogId);
      }
    } catch (e) {
      console.warn('Erro ao restaurar sessao do catalogo:', e);
    }
  }, [isAuthenticated, user?.id, loadExistingCatalog]);

  // Global shortcut Ctrl+B / Cmd+B to toggle global sidebar, Ctrl+J / Cmd+J to toggle AI CoPilot
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);
      if (isInput) return;

      if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        if (isCompact) setMobileSidebarOpen((open) => !open); else toggleStudioSidebar();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'j' || e.key === 'J')) {
        e.preventDefault();
        if (isPhone) setPane(pane === 'assistant' ? 'catalog' : 'assistant'); else toggleCoPilot();
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        toggleProductDrawer();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleStudioSidebar, toggleCoPilot, toggleProductDrawer, isCompact, isPhone, pane, setPane]);

  return (
    <div className="studio-shell flex bg-[#09090b] text-zinc-100 overflow-hidden font-sans antialiased relative">
      {/* Splash Screen with signature drawing animation from usecatana.com.br */}
      {showSplash && (
        <KatanaSplashScreen
          durationMs={isCompact ? 600 : 3400}
          onComplete={handleSplashComplete}
        />
      )}

      {/* Experiência Cinematográfica de Geração de Catálogo (Lovable style) */}
      {isGeneratingCatalog && <CatalogGenerationExperience />}

      {/* Floating Sidebar Open Toggle Button when closed (ChatGPT style) */}
      {!isCompact && !isStudioSidebarOpen && !hasStartedSession && (
        <div className="hidden md:flex fixed top-3.5 left-3.5 z-40 flex items-center gap-1.5 animate-in fade-in duration-200">
          <button
            type="button"
            onClick={toggleStudioSidebar}
            className={`p-2 rounded-xl border transition-all cursor-pointer shadow-md flex items-center justify-center ${
              isDark
                ? 'bg-[#0b0b0e]/95 hover:bg-zinc-800 border-zinc-800 text-zinc-300 hover:text-white backdrop-blur-md'
                : 'bg-white/95 hover:bg-zinc-100 border-zinc-200 text-zinc-700 hover:text-zinc-950 backdrop-blur-md'
            }`}
            title="Abrir barra lateral (Ctrl+B)"
            aria-label="Abrir barra lateral"
          >
            <PanelLeftOpen className="size-4" />
          </button>

          <button
            type="button"
            onClick={openNewCatalogModal}
            className={`p-2 rounded-xl border transition-all cursor-pointer shadow-md flex items-center justify-center ${
              isDark
                ? 'bg-[#0b0b0e]/95 hover:bg-zinc-800 border-zinc-800 text-zinc-300 hover:text-white backdrop-blur-md'
                : 'bg-white/95 hover:bg-zinc-100 border-zinc-200 text-zinc-700 hover:text-zinc-950 backdrop-blur-md'
            }`}
            title="Novo Catálogo"
            aria-label="Novo Catálogo"
          >
            <Plus className="size-4" />
          </button>
        </div>
      )}

      {/* ChatGPT-style Collapsible Sidebar */}
      {isCompact ? <MobileSheet open={mobileSidebarOpen} onClose={() => setMobileSidebarOpen(false)} title="Catana Studio" side="left">
        <StudioSidebar mobile onNavigate={() => setMobileSidebarOpen(false)} />
      </MobileSheet> : <StudioSidebar compact={isTablet} /> }

      {/* Main Workspace: Either Home Chat or Split-Screen (Agent Studio + Living Canvas) */}
      <main className="min-w-0 min-h-0 flex-1 flex flex-col h-full overflow-hidden relative">
        <StudioMobileNavigation onMenu={() => setMobileSidebarOpen(true)} />
        {!hasStartedSession ? (
          <section id="studio-assistant" role={isPhone ? 'tabpanel' : undefined} aria-label="Assistente" className="min-h-0 flex flex-1"><StudioHomeChat /></section>
        ) : (
          <div className="min-h-0 flex-1 w-full flex overflow-hidden animate-in fade-in duration-300">
            {/* Left: AI Agent Studio */}
            <section id="studio-assistant" role={isPhone ? 'tabpanel' : undefined} aria-label="Assistente"
              hidden={isPhone ? pane !== 'assistant' : !isCoPilotOpen}
              className={`studio-primary-pane ${isPhone ? 'w-full' : 'shrink-0'}`}><AgentCoPilot /></section>

            {/* Right: Living Catalog Canvas & Artifact Preview */}
            <section id="studio-catalog" role={isPhone ? 'tabpanel' : undefined} aria-label="Catálogo"
              hidden={isPhone && pane !== 'catalog'} className="studio-primary-pane flex-1"><CatalogCanvasWorkspace /></section>
          </div>
        )}
      </main>

      {/* Modal de Criação de Novo Catálogo */}
      <NewCatalogModal />

      {/* Modal de Gerenciamento de Marca & Brand Kit */}
      <BrandModal />

      {/* Modal de Configuracoes da Conta */}
      <AccountSettingsModal
        isOpen={isAccountSettingsOpen}
        onClose={closeAccountSettings}
      />

      {/* Modal de Exportação Editorial e Distribuição Multiformato */}
      <ExportCatalogModal />

      {/* Gaveta de Produtos & Acervo Editorial */}
      <ProductDrawer />

      {/* Modal de Importação de Produtos via Planilha Excel / CSV */}
      <StudioExcelImportModal />

      {/* Modal de System Design e Laboratório de Teste de Agentes */}
      <StudioSystemDesignModal />

      {/* Modal de Autenticacao In-Context (Light/Dark Mode) */}
      <AuthModal
        isOpen={!checkingAuth && (isAuthModalOpen || !isAuthenticated)}
        onClose={closeAuthModal}
        canDismiss={isAuthenticated}
      />
    </div>
  );
};

export const KatanaStudio: React.FC = () => <StudioResponsiveProvider><StudioLayout /></StudioResponsiveProvider>;
