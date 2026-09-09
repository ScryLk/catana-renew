import { FC, useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { globalSearchService, type GlobalSearchResults } from '@/services/globalSearchService';
import { User, BookOpen, Package, Search, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GlobalSearchDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  inputValue: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

export const GlobalSearchDropdown: FC<GlobalSearchDropdownProps> = ({
  isOpen,
  onClose,
  inputValue,
  inputRef,
}) => {
  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [results, setResults] = useState<GlobalSearchResults | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const debounceTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Criar lista plana de todos os itens para navegação por teclado
  const getAllItems = useCallback(() => {
    if (!results) return [];

    const items: Array<{ type: 'profile' | 'catalog' | 'product'; id: string; url: string }> = [];

    results.profiles.forEach(p => items.push({ type: 'profile', id: p.id, url: `/profiles/${p.username}` }));
    results.catalogs.forEach(c => items.push({ type: 'catalog', id: c.id, url: `/catalogs/${c.id}/view` }));
    results.products.forEach(p => items.push({ type: 'product', id: p.id, url: `/products/${p.id}` }));

    return items;
  }, [results]);

  // Buscar com debounce
  useEffect(() => {
    // Limpar timer anterior
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Buscar apenas se tiver pelo menos 2 caracteres
    if (inputValue.trim().length < 2) {
      setResults(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setSelectedIndex(-1);

    // Debounce de 300ms
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const data = await globalSearchService.search(inputValue.trim());
        setResults(data);
      } catch (error) {
        console.error('Erro na busca global:', error);
        setResults({ profiles: [], catalogs: [], products: [], total: 0 });
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [inputValue]);

  // Fechar ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, inputRef]);

  // Navegação por teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      const items = getAllItems();
      const maxIndex = items.length - 1;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => (prev < maxIndex ? prev + 1 : 0));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => (prev > 0 ? prev - 1 : maxIndex));
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedIndex >= 0 && selectedIndex <= maxIndex) {
            const item = items[selectedIndex];
            navigate(item.url);
            onClose();
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, getAllItems, navigate, onClose]);

  // Navegar para item
  const handleItemClick = (url: string) => {
    navigate(url);
    onClose();
  };

  // Visualizar todos os resultados
  const handleViewAll = () => {
    navigate(`/search?q=${encodeURIComponent(inputValue)}`);
    onClose();
  };

  if (!isOpen) return null;

  // Estado: usuário ainda não digitou o suficiente
  if (inputValue.trim().length < 2) {
    return (
      <div
        ref={dropdownRef}
        className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-lg z-50 p-4"
      >
        <div className="flex items-center justify-center text-zinc-500 dark:text-zinc-400 text-sm">
          <Search className="w-4 h-4 mr-2" />
          Pesquise por perfis, catálogos ou produtos
        </div>
      </div>
    );
  }

  // Estado: carregando
  if (isLoading) {
    return (
      <div
        ref={dropdownRef}
        className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-lg z-50 p-4"
      >
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="w-10 h-10 bg-zinc-200 dark:bg-zinc-800 rounded-full" />
              <div className="flex-1">
                <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-3/4 mb-2" />
                <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Estado: sem resultados
  if (results && results.total === 0) {
    return (
      <div
        ref={dropdownRef}
        className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-lg z-50 p-8 text-center"
      >
        <Search className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mx-auto mb-3" />
        <p className="text-zinc-600 dark:text-zinc-400 font-medium">Nenhum resultado encontrado</p>
        <p className="text-zinc-500 dark:text-zinc-500 text-sm mt-1">
          Tente buscar com outros termos
        </p>
      </div>
    );
  }

  let currentItemIndex = 0;

  return (
    <div
      ref={dropdownRef}
      className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-xl z-50 max-h-[400px] overflow-y-auto"
    >
      {/* Perfis */}
      {results && results.profiles.length > 0 && (
        <div className="border-b border-zinc-100 dark:border-zinc-800">
          <div className="px-4 py-2 bg-zinc-50 dark:bg-zinc-800/50">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
              <User className="w-3.5 h-3.5" />
              Perfis
            </div>
          </div>
          <div className="py-1">
            {results.profiles.map((profile) => {
              const itemIndex = currentItemIndex++;
              const isSelected = selectedIndex === itemIndex;

              return (
                <button
                  key={profile.id}
                  onClick={() => handleItemClick(`/profiles/${profile.username}`)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 transition-colors text-left",
                    isSelected
                      ? "bg-blue-50 dark:bg-blue-900/20"
                      : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                  )}
                >
                  <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {profile.avatar ? (
                      <img src={profile.avatar} alt={profile.name} className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-5 h-5 text-zinc-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-zinc-900 dark:text-zinc-100 truncate">{profile.name}</p>
                    <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                      <span>@{profile.username}</span>
                      <span>•</span>
                      <span className="capitalize">{profile.type}</span>
                    </div>
                  </div>
                  {profile.followers_count > 0 && (
                    <div className="text-xs text-zinc-400">
                      {profile.followers_count} seguidores
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Catálogos */}
      {results && results.catalogs.length > 0 && (
        <div className="border-b border-zinc-100 dark:border-zinc-800">
          <div className="px-4 py-2 bg-zinc-50 dark:bg-zinc-800/50">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
              <BookOpen className="w-3.5 h-3.5" />
              Catálogos
            </div>
          </div>
          <div className="py-1">
            {results.catalogs.map((catalog) => {
              const itemIndex = currentItemIndex++;
              const isSelected = selectedIndex === itemIndex;

              return (
                <button
                  key={catalog.id}
                  onClick={() => handleItemClick(`/catalogs/${catalog.id}/view`)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 transition-colors text-left",
                    isSelected
                      ? "bg-blue-50 dark:bg-blue-900/20"
                      : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                  )}
                >
                  <div className="w-12 h-16 rounded bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {catalog.cover_image ? (
                      <img src={catalog.cover_image} alt={catalog.title} className="w-full h-full object-cover" />
                    ) : (
                      <BookOpen className="w-5 h-5 text-zinc-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-zinc-900 dark:text-zinc-100 truncate">{catalog.title}</p>
                      {catalog.is_sponsored && (
                        <span className="px-1.5 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-xs font-medium rounded">
                          Patrocinado
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                      por {catalog.author}
                    </p>
                  </div>
                  <div className="text-xs text-zinc-400">
                    {catalog.pages_count} páginas
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Produtos */}
      {results && results.products.length > 0 && (
        <div className="border-b border-zinc-100 dark:border-zinc-800">
          <div className="px-4 py-2 bg-zinc-50 dark:bg-zinc-800/50">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
              <Package className="w-3.5 h-3.5" />
              Produtos
            </div>
          </div>
          <div className="py-1">
            {results.products.map((product) => {
              const itemIndex = currentItemIndex++;
              const isSelected = selectedIndex === itemIndex;

              return (
                <button
                  key={product.id}
                  onClick={() => handleItemClick(`/products/${product.id}`)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 transition-colors text-left",
                    isSelected
                      ? "bg-blue-50 dark:bg-blue-900/20"
                      : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                  )}
                >
                  <div className="w-12 h-12 rounded bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <Package className="w-5 h-5 text-zinc-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-zinc-900 dark:text-zinc-100 truncate">{product.name}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{product.category}</p>
                  </div>
                  {product.price && (
                    <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                      {new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: product.currency || 'BRL',
                      }).format(product.price)}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Ver todos os resultados */}
      {results && results.total > 0 && (
        <div className="p-3">
          <button
            onClick={handleViewAll}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors font-medium text-sm"
          >
            <TrendingUp className="w-4 h-4" />
            Ver todos os {results.total} resultados
          </button>
        </div>
      )}
    </div>
  );
};
