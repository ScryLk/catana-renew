import { type FC, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, Check, Loader2, MessageSquare, Info, AlertTriangle,
  ChevronDown, User as UserIcon, Building2, Settings, HelpCircle, LogOut
} from 'lucide-react';
import { notificationService, Notification } from '../services/notificationService';
import { useAuthStore } from '../store/authStore';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { ContextSelector } from './ContextSelector';
import { GlobalSearchDropdown } from './search/GlobalSearchDropdown';

interface HeaderProps {
  title?: string;
  badge?: string;
}

export const Header: FC<HeaderProps> = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  // Notification State
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isNotifLoading, setIsNotifLoading] = useState(false);
  const notifPopoverRef = useRef<HTMLDivElement>(null);

  // Profile State
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Search State
  const [searchValue, setSearchValue] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Close popovers when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifPopoverRef.current && !notifPopoverRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchNotifications = async (silent = false) => {
    try {
      if (!silent) setIsNotifLoading(true);
      const [data, count] = await Promise.all([
        notificationService.getNotifications(),
        notificationService.getUnreadCount()
      ]);
      setNotifications(data);
      setUnreadCount(count);
    } catch (error) {
      console.error('Failed to fetch notifications', error);
    } finally {
      if (!silent) setIsNotifLoading(false);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const count = await notificationService.getUnreadCount();
      setUnreadCount(count);
    } catch (error: any) {
      // Silenciar erros 404 (endpoint ainda não implementado)
      if (error?.response?.status !== 404) {
        console.error('Failed to fetch unread count', error);
      }
    }
  };

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(() => {
      if (!isNotifOpen && !document.hidden) {
        fetchUnreadCount();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [isNotifOpen]);

  useEffect(() => {
    if (isNotifOpen) {
      fetchNotifications();
    }
  }, [isNotifOpen]);

  const handleNotificationClick = async (notification: Notification) => {
    try {
      if (!notification.read_at) {
        await notificationService.markRead(notification.id);
        setUnreadCount(prev => Math.max(0, prev - 1));
        setNotifications(prev => prev.map(n =>
          n.id === notification.id ? { ...n, read_at: new Date().toISOString() } : n
        ));
      }

      if (notification.link) {
        navigate(notification.link);
        setIsNotifOpen(false);
      }
    } catch (error) {
      console.error('Failed to mark read', error);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllRead();
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, read_at: new Date().toISOString() })));
      toast.success('Todas as notificações marcadas como lidas');
    } catch (error) {
      toast.error('Erro ao marcar como lidas');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
    toast.success('Logout realizado com sucesso');
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'message': return <MessageSquare className="w-4 h-4 text-blue-500" />;
      case 'alert': return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      default: return <Info className="w-4 h-4 text-zinc-500" />;
    }
  };

  return (
    <header className="h-20 bg-zinc-900 border-b border-zinc-800 fixed top-0 right-0 left-16 z-10 w-[calc(100%-4rem)]">
      <div className="h-full flex items-center justify-between px-8">
        {/* Left Side: Context Selector */}
        <ContextSelector />

        <div className="flex items-center gap-4">
          {/* Global Search with Dropdown */}
          <div className="relative">
            <input
              ref={searchInputRef}
              type="text"
              value={searchValue}
              onChange={(e) => {
                setSearchValue(e.target.value);
                setIsSearchOpen(true);
              }}
              onFocus={() => setIsSearchOpen(true)}
              placeholder="Buscar perfis, catálogos, produtos..."
              className="w-96 h-11 pl-11 pr-4 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-600 focus:border-transparent"
            />
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <GlobalSearchDropdown
              isOpen={isSearchOpen}
              onClose={() => setIsSearchOpen(false)}
              inputValue={searchValue}
              inputRef={searchInputRef}
            />
          </div>

          {/* Notifications */}
          <div className="relative" ref={notifPopoverRef}>
            <button
              onClick={() => setIsNotifOpen(!isNotifOpen)}
              className={cn(
                "relative p-2 rounded-lg transition-colors outline-none cursor-pointer",
                isNotifOpen ? "bg-zinc-800 text-zinc-100" : "hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100"
              )}
            >
              <Bell className="w-6 h-6" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-blue-600 border-2 border-zinc-900 rounded-full animate-in zoom-in duration-300" />
              )}
            </button>

            {isNotifOpen && (
              <div className="absolute top-full right-0 mt-2 w-96 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden animate-in slide-in-from-top-2 fade-in duration-200 z-50">
                <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50 backdrop-blur-sm">
                  <h3 className="font-semibold text-zinc-100">Notificações</h3>
                  {unreadCount > 0 && (
                    <button onClick={handleMarkAllRead} className="text-xs text-blue-500 hover:text-blue-400 font-medium transition-colors flex items-center gap-1 cursor-pointer">
                      <Check className="w-3 h-3" />
                      Marcar todas como lidas
                    </button>
                  )}
                </div>
                <div className="max-h-[400px] overflow-y-auto">
                  {isNotifLoading && notifications.length === 0 ? (
                    <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-zinc-500" /></div>
                  ) : notifications.length > 0 ? (
                    <div className="divide-y divide-zinc-800/50">
                      {notifications.map((notification) => (
                        <button
                          key={notification.id}
                          onClick={() => handleNotificationClick(notification)}
                          className={cn(
                            "w-full text-left p-4 hover:bg-zinc-800/50 transition-colors flex gap-3 group relative cursor-pointer",
                            !notification.read_at && "bg-zinc-800/20"
                          )}
                        >
                          {!notification.read_at && <span className="absolute left-0 top-4 bottom-4 w-0.5 bg-blue-500 rounded-r-full" />}
                          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border border-zinc-800 group-hover:border-zinc-700 transition-colors", !notification.read_at ? "bg-zinc-800" : "bg-zinc-900")}>
                            {getIcon(notification.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={cn("text-sm mb-0.5 truncate pr-4", !notification.read_at ? "text-zinc-100 font-medium" : "text-zinc-400")}>{notification.title}</p>
                            <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed mb-1.5">{notification.content}</p>
                            <span className="text-[10px] text-zinc-600 block">{new Date(notification.created_at).toLocaleDateString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="p-12 text-center">
                      <div className="w-12 h-12 bg-zinc-800/50 rounded-full flex items-center justify-center mx-auto mb-3"><Bell className="w-5 h-5 text-zinc-600" /></div>
                      <p className="text-zinc-500 text-sm">Nenhuma notificação por enquanto</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Profile Dropdown */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center gap-3 hover:bg-zinc-800 rounded-lg p-2 transition-colors group outline-none cursor-pointer"
            >
              <img
                src={user?.avatar || `https://ui-avatars.com/api/?name=${user?.name || 'User'}&background=8b5cf6&color=fff`}
                alt={user?.name || "User"}
                className="w-8 h-8 rounded-full border border-zinc-700"
              />
              <ChevronDown className={cn(
                "w-4 h-4 text-zinc-500 transition-transform duration-200",
                isProfileOpen && "rotate-180 text-zinc-100"
              )} />
            </button>

            {isProfileOpen && (
              <div className="absolute top-full right-0 mt-2 w-64 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden animate-in slide-in-from-top-2 fade-in duration-200 z-50">
                {/* Header */}
                <div className="p-4 border-b border-zinc-800 bg-zinc-900/50">
                  <div className="flex items-center gap-3 mb-3">
                    <img
                      src={user?.avatar || `https://ui-avatars.com/api/?name=${user?.name || 'User'}&background=8b5cf6&color=fff`}
                      alt={user?.name}
                      className="w-12 h-12 rounded-full border border-zinc-700"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-100 truncate">{user?.name}</p>
                      <p className="text-xs text-zinc-500 truncate">{user?.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {user?.role === 'admin' && (
                      <div className="px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-[10px] font-medium text-blue-400">
                        Admin
                      </div>
                    )}
                    {user?.role === 'editor' && (
                      <div className="px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 text-[10px] font-medium text-green-400">
                        Editor
                      </div>
                    )}
                    {user?.role === 'viewer' && (
                      <div className="px-2 py-0.5 rounded-full bg-zinc-500/10 border border-zinc-500/20 text-[10px] font-medium text-zinc-400">
                        Visualizador
                      </div>
                    )}
                  </div>
                </div>

                {/* Menu Items */}
                <div className="p-2 space-y-1">
                  <button
                    onClick={() => { navigate('/profile'); setIsProfileOpen(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                  >
                    <UserIcon className="w-4 h-4" />
                    <span>Meu Perfil</span>
                  </button>
                  <button
                    onClick={() => { navigate('/organizations'); setIsProfileOpen(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                  >
                    <Building2 className="w-4 h-4" />
                    <span>Minha Empresa</span>
                  </button>
                </div>

                <div className="h-px bg-zinc-800 mx-2 my-1" />

                <div className="p-2 space-y-1">
                  <button className="w-full flex items-center gap-3 px-3 py-2 text-sm text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer">
                    <Settings className="w-4 h-4" />
                    <span>Preferências</span>
                  </button>
                  <button className="w-full flex items-center gap-3 px-3 py-2 text-sm text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer">
                    <HelpCircle className="w-4 h-4" />
                    <span>Ajuda</span>
                  </button>
                </div>

                <div className="h-px bg-zinc-800 mx-2 my-1" />

                <div className="p-2">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sair</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
