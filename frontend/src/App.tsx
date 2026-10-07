import { useResponsiveLayout } from './hooks/useResponsiveLayout';
import { ResponsiveAppShell } from './components/layout/ResponsiveAppShell';
import { ViewportFoundation } from './components/layout/ViewportFoundation';
import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { KatanaStudio } from './pages/KatanaStudio';
import { Dashboard } from './pages/Dashboard';
import { MediaLibrary } from './pages/MediaLibrary';
import { UserCatalogs } from './pages/UserCatalogs';
import { Organizations } from './pages/Organizations';
import { Profile } from './pages/Profile';
import { PrivateRoute } from './components/auth/PrivateRoute';
import { useAuthStore } from './store/authStore';
import { CatalogShowcase } from './pages/CatalogShowcase';
import { ProductModal } from './components/catalog/ProductModal';
import { allProducts } from './lib/products';
import { Explore } from './pages/explore/Explore';
import { Products } from './pages/Products';
import { CreateProduct } from './pages/CreateProduct';
import { Categories } from './pages/Categories';
import { Inbox } from './pages/Inbox';
import { SearchResults } from './pages/SearchResults';
import { PublicProfilePage } from './pages/PublicProfile';
import { ResetPassword } from './pages/ResetPassword';
import { Transparency } from './pages/Transparency';
import { SystemDesignPage } from './pages/SystemDesignPage';
import { PublicCatalogReader } from './pages/PublicCatalogReader';
import { LandingPage } from './pages/LandingPage';
import { Toaster } from 'sonner';
import { useStudioStore } from './store/studioStore';
import { ClerkAuthSync } from './components/auth/ClerkAuthSync';
import { isClerkConfigured } from './store/authStore';
import { authProviderMode } from './services/authConfig';
import { ClerkAuthCallback } from './components/auth/ClerkAuthCallback';

function App() {
  const { isPhone } = useResponsiveLayout();
  const { checkAuth } = useAuthStore();
  const theme = useStudioStore((s) => s.theme);
  const [selectedProductCode, setSelectedProductCode] = useState<string | null>(null);

  useEffect(() => {
    if (authProviderMode === 'legacy') void checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash && allProducts.some((p) => p.code === hash)) {
        setSelectedProductCode(hash);
      } else {
        setSelectedProductCode(null);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  const handleCloseModal = () => {
    setSelectedProductCode(null);
    window.history.pushState('', document.title, window.location.pathname + window.location.search);
  };

  return (
    <>
      <ViewportFoundation />
      {isClerkConfigured && <ClerkAuthSync />}
      <Toaster
        position={isPhone ? 'top-center' : 'top-right'}
        offset={isPhone ? { top: 'calc(var(--safe-top) + 104px)', left: 12, right: 12 } : undefined}
        mobileOffset={{ top: 'calc(var(--safe-top) + 104px)', left: 12, right: 12 }}
        theme={theme}
        richColors
        closeButton
        toastOptions={{
          closeButton: true,
          closeButtonAriaLabel: 'Fechar notificação',
        }}
      />
      <Router>
        <Routes>
          {/* Public Auth Routes & AI Studio Experience */}
          <Route path="/auth/callback" element={<ClerkAuthCallback />} />
          <Route path="/login" element={<KatanaStudio />} />
          <Route path="/register" element={<KatanaStudio />} />
          <Route path="/forgot-password" element={<KatanaStudio />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/showcase/:id" element={<CatalogShowcase />} />

          {/* Public Catalog Reader (Digital Flipbook - Prioridade 5) */}
          <Route path="/view/:id" element={<PublicCatalogReader />} />
          <Route path="/c/:id" element={<PublicCatalogReader />} />

          {/* Landing Page & Showcase Experience (Arquivada / Acessível em /landing) */}
          <Route path="/landing" element={<LandingPage />} />

          {/* Katana 2.0 AI Studio: Conversa com o Assistente como Página Inicial */}
          <Route path="/" element={<KatanaStudio />} />
          <Route path="/studio" element={<KatanaStudio />} />
          <Route path="/studio-demo" element={<KatanaStudio />} />

          {/* Transparencia & Governanca de IA */}
          <Route path="/transparency" element={<Transparency />} />
          <Route path="/transparencia" element={<Transparency />} />

          {/* Katana System Design & Laboratorio de Agentes */}
          <Route path="/system-design" element={<SystemDesignPage />} />
          <Route path="/studio/system-design" element={<SystemDesignPage />} />

          {/* Management Hubs */}
          <Route element={<PrivateRoute><ResponsiveAppShell /></PrivateRoute>}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/catalogs" element={<UserCatalogs />} />
          <Route path="/products" element={<Products />} />
          <Route path="/products/new" element={<CreateProduct />} />
          <Route path="/products/:id" element={<CreateProduct />} />
          <Route path="/products/edit/:id" element={<CreateProduct />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/media" element={<MediaLibrary />} />
          <Route path="/organizations" element={<Organizations />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/profiles/:username" element={<PublicProfilePage />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/search" element={<SearchResults />} />
          <Route path="/inbox" element={<Inbox />} />

          </Route>
          {/* Wildcard Fallback Route */}
          <Route path="*" element={<KatanaStudio />} />
        </Routes>
      </Router>

      {selectedProductCode && (
        <ProductModal
          isOpen={!!selectedProductCode}
          productCode={selectedProductCode}
          onClose={handleCloseModal}
        />
      )}
    </>
  );
}

export default App;
