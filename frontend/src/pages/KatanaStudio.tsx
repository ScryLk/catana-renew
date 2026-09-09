import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { PanelLeftOpen, Plus } from 'lucide-react';
import { StudioSidebar } from '../components/studio/StudioSidebar';
import { AgentCoPilot } from '../components/studio/AgentCoPilot';
import { CatalogCanvasWorkspace } from '../components/studio/CatalogCanvasWorkspace';
import { StudioHomeChat } from '../components/studio/StudioHomeChat';
import { KatanaSplashScreen } from '../components/studio/KatanaSplashScreen';
import { AccountSettingsModal } from '../components/studio/AccountSettingsModal';
import { AuthModal } from '../components/auth/AuthModal';
import { useStudioStore } from '../store/studioStore';
import { useAuthStore, isAutoLoginSettled } from '../store/authStore';

export const KatanaStudio: React.FC = () => {
  const location = useLocation();
  const [showSplash, setShowSplash] = useState(true);
  const {
    isAuthenticated,
    isAuthModalOpen,
    openAuthModal,
    closeAuthModal,
    checkAuth,
    autoLogin,
  } = useAuthStore();

  const [checkingAuth, setCheckingAuth] = useState(!isAutoLoginSettled());

  useEffect(() => {
    checkAuth();
    if (isAutoLoginSettled()) {
      setCheckingAuth(false);
    } else {
      autoLogin().finally(() => setCheckingAuth(false));
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
    isStudioSidebarOpen,
    toggleStudioSidebar,
    resetToHome,
    theme,
    isAccountSettingsOpen,
    closeAccountSettings,
  } = useStudioStore();

  const isDark = theme === 'dark';

  // Global shortcut Ctrl+B / Cmd+B to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        toggleStudioSidebar();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleStudioSidebar]);

  return (
    <div className="h-screen w-screen flex bg-[#09090b] text-zinc-100 overflow-hidden font-sans antialiased relative">
      {/* Splash Screen with signature drawing animation from usecatana.com.br */}
      {showSplash && (
        <KatanaSplashScreen
          durationMs={3400}
          onComplete={() => setShowSplash(false)}
        />
      )}

      {/* Floating Sidebar Open Toggle Button when closed (ChatGPT style) */}
      {!isStudioSidebarOpen && !hasStartedSession && (
        <div className="fixed top-3.5 left-3.5 z-40 flex items-center gap-1.5 animate-in fade-in duration-200">
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
            onClick={resetToHome}
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
      <StudioSidebar />

      {/* Main Workspace: Either Home Chat or Split-Screen (Agent Studio + Living Canvas) */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {!hasStartedSession ? (
          <StudioHomeChat />
        ) : (
          <div className="flex-1 w-full flex overflow-hidden animate-in fade-in duration-300">
            {/* Left: AI Agent Studio */}
            <AgentCoPilot />

            {/* Right: Living Catalog Canvas & Artifact Preview */}
            <CatalogCanvasWorkspace />
          </div>
        )}
      </main>

      {/* Modal de Configuracoes da Conta */}
      <AccountSettingsModal
        isOpen={isAccountSettingsOpen}
        onClose={closeAccountSettings}
      />

      {/* Modal de Autenticacao In-Context (Light/Dark Mode) */}
      <AuthModal
        isOpen={!checkingAuth && (isAuthModalOpen || !isAuthenticated)}
        onClose={closeAuthModal}
        canDismiss={isAuthenticated}
      />
    </div>
  );
};
