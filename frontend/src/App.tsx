import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { KatanaStudio } from './pages/KatanaStudio';
import { Dashboard } from './pages/Dashboard';
import { MediaLibrary } from './pages/MediaLibrary';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
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
import { Toaster } from 'sonner';

function App() {
  const { checkAuth } = useAuthStore();
  const [selectedProductCode, setSelectedProductCode] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
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
      <Toaster position="top-right" theme="dark" richColors />
      <Router>
        <Routes>
          {/* Public Auth Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/showcase/:id" element={<CatalogShowcase />} />

          {/* Katana 2.0 AI Studio: Primary Experience */}
          <Route
            path="/"
            element={
              <PrivateRoute>
                <KatanaStudio />
              </PrivateRoute>
            }
          />
          <Route
            path="/studio"
            element={
              <PrivateRoute>
                <KatanaStudio />
              </PrivateRoute>
            }
          />
          <Route path="/studio-demo" element={<KatanaStudio />} />

          {/* Management Hubs */}
          <Route
            path="/dashboard"
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/catalogs"
            element={
              <PrivateRoute>
                <UserCatalogs />
              </PrivateRoute>
            }
          />
          <Route
            path="/products"
            element={
              <PrivateRoute>
                <Products />
              </PrivateRoute>
            }
          />
          <Route
            path="/products/new"
            element={
              <PrivateRoute>
                <CreateProduct />
              </PrivateRoute>
            }
          />
          <Route
            path="/products/:id"
            element={
              <PrivateRoute>
                <CreateProduct />
              </PrivateRoute>
            }
          />
          <Route
            path="/products/edit/:id"
            element={
              <PrivateRoute>
                <CreateProduct />
              </PrivateRoute>
            }
          />
          <Route
            path="/categories"
            element={
              <PrivateRoute>
                <Categories />
              </PrivateRoute>
            }
          />
          <Route
            path="/media"
            element={
              <PrivateRoute>
                <MediaLibrary />
              </PrivateRoute>
            }
          />
          <Route
            path="/organizations"
            element={
              <PrivateRoute>
                <Organizations />
              </PrivateRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <PrivateRoute>
                <Profile />
              </PrivateRoute>
            }
          />
          <Route
            path="/profiles/:username"
            element={
              <PrivateRoute>
                <PublicProfilePage />
              </PrivateRoute>
            }
          />
          <Route
            path="/explore"
            element={
              <PrivateRoute>
                <Explore />
              </PrivateRoute>
            }
          />
          <Route
            path="/search"
            element={
              <PrivateRoute>
                <SearchResults />
              </PrivateRoute>
            }
          />
          <Route
            path="/inbox"
            element={
              <PrivateRoute>
                <Inbox />
              </PrivateRoute>
            }
          />
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
