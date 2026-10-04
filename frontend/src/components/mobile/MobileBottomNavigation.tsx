import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Package, BookOpen, MessageSquare, Menu } from 'lucide-react';
import { MobileSheet } from './MobileSheet';

const destinations = [
  ['/dashboard', 'Início', LayoutDashboard], ['/products', 'Produtos', Package],
  ['/catalogs', 'Catálogos', BookOpen], ['/inbox', 'Mensagens', MessageSquare],
] as const;
const more = [['/studio', 'Catana Studio'], ['/explore', 'Explorar'], ['/media', 'Mídia'],
  ['/categories', 'Categorias'], ['/organizations', 'Organizações'], ['/profile', 'Configurações'],
  ['/transparency', 'Suporte e transparência']] as const;

export function MobileBottomNavigation() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  return <>
    <nav aria-label="Navegação principal" className="mobile-bottom-navigation lg:hidden">
      {destinations.map(([path, label, Icon]) => <Link key={path} to={path}
        aria-current={location.pathname.startsWith(path) ? 'page' : undefined}
        className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[10px] aria-[current=page]:bg-zinc-200 dark:aria-[current=page]:bg-zinc-800">
        <Icon className="size-5" /><span>{label}</span>
      </Link>)}
      <button type="button" onClick={() => setOpen(true)} aria-expanded={open} aria-label="Mais destinos"
        className="flex flex-col items-center justify-center gap-1 text-[10px]"><Menu className="size-5" />Mais</button>
    </nav>
    <MobileSheet open={open} onClose={() => setOpen(false)} title="Mais destinos">
      <div className="grid gap-1">{more.map(([path, label]) => <Link key={path} to={path}
        onClick={() => setOpen(false)} className="flex min-h-12 items-center rounded-lg px-3 hover:bg-zinc-100 dark:hover:bg-zinc-800">{label}</Link>)}</div>
    </MobileSheet>
  </>;
}
