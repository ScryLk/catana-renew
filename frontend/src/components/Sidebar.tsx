import { FC, useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { chatService } from '../services/chatService';
import {
  LayoutDashboard,
  Package,
  BookOpen,
  Image,
  MessageSquare,
  Settings,
  HelpCircle,
  Building2,
  Globe,
} from 'lucide-react';

interface MenuItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  path: string;
}

const menuItems: MenuItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { id: 'explorar', label: 'Explorar', icon: Globe, path: '/explore' },
  { id: 'produtos', label: 'Produtos', icon: Package, path: '/products' },
  { id: 'catalogos', label: 'Catálogos', icon: BookOpen, path: '/catalogs' },
  { id: 'midia', label: 'Mídia', icon: Image, path: '/media' },
  { id: 'mensagens', label: 'Mensagens', icon: MessageSquare, badge: 0, path: '/inbox' },
];

const bottomMenuItems: MenuItem[] = [
  { id: 'organizacoes', label: 'Organizações', icon: Building2, path: '/organizations' },
  { id: 'configuracoes', label: 'Configurações', icon: Settings, path: '#' },
  { id: 'suporte', label: 'Suporte', icon: HelpCircle, path: '#' },
];

export const Sidebar: FC = () => {
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const data = await chatService.getUnreadCount();
        setUnreadCount(data.count);
      } catch (e: any) {
        // Silenciar erros 404 (endpoint ainda não implementado)
        if (e?.response?.status !== 404) {
          console.error(e);
        }
      }
    };

    fetchUnread(); // Initial fetch

    const interval = setInterval(() => {
      if (document.hidden) return;
      fetchUnread();
    }, 5000); // Poll every 5s

    return () => clearInterval(interval);
  }, []);

  return (
    <aside className="w-16 h-screen bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex flex-col fixed left-0 top-0 z-50">
      {/* Logo */}
      <div className="flex items-center justify-center h-20 border-b border-zinc-200 dark:border-zinc-800">
        <Link to="/" className="flex items-center justify-center">
          <img
            src="/logo/logo.png"
            alt="Catana Logo"
            className="w-10 h-10 object-contain cursor-pointer hover:opacity-80 transition-opacity"
          />
        </Link>
      </div>

      {/* Main Menu */}
      <nav className="flex-1 py-4 flex flex-col items-center gap-2">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          const showBadge = item.id === 'mensagens' && unreadCount > 0;

          return (
            <Link key={item.id} to={item.path} title={item.label} className="relative group">
              <div
                className={cn(
                  'w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200',
                  isActive
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-sm'
                    : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'
                )}
              >
                <Icon className={cn("w-5 h-5", showBadge && !isActive && "text-zinc-700 dark:text-zinc-300")} />
              </div>
              {showBadge && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white dark:border-zinc-900">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}

              {/* Tooltip */}
              <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-zinc-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                {item.label}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Bottom Menu */}
      <nav className="pb-4 pt-4 border-t border-zinc-200 dark:border-zinc-800 flex flex-col items-center gap-2">
        {bottomMenuItems.map((item) => {
          const Icon = item.icon;

          return (
            <Link key={item.id} to={item.path} title={item.label} className="relative group">
              <div className="w-10 h-10 flex items-center justify-center rounded-xl text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 transition-all duration-200">
                <Icon className="w-5 h-5" />
              </div>
              {/* Tooltip */}
              <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-zinc-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                {item.label}
              </div>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
};