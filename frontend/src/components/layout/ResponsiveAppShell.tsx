import { Outlet, useLocation } from 'react-router-dom';
import { Header } from '../Header';
import { Sidebar } from '../Sidebar';
import { MobileBottomNavigation } from '../mobile/MobileBottomNavigation';

export function ResponsiveAppShell() {
  const { pathname } = useLocation();
  return <div className={`management-shell ${pathname === '/inbox' ? 'management-shell-inbox' : ''}`}>
    <Sidebar /><Header /><MobileBottomNavigation />
    <div className="management-content"><Outlet /></div>
  </div>;
}
