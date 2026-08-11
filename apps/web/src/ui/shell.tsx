import { Link, Outlet, useLocation } from 'react-router-dom';
import { House, BookOpenText, MusicNotes, Sparkle, SquaresFour } from '@phosphor-icons/react';
import './shell.css';

const NAV_ITEMS = [
  { to: '/home', label: 'Beranda', icon: House },
  { to: '/bible', label: 'Alkitab', icon: BookOpenText },
  { to: '/hymnal', label: 'Pujian', icon: MusicNotes },
  { to: '/faith', label: 'Iman', icon: Sparkle },
  { to: '/more', label: 'Lainnya', icon: SquaresFour },
] as const;

function useNavActive(pathname: string, to: string): boolean {
  if (to === '/home') return pathname === '/home';
  return pathname === to || pathname.startsWith(`${to}/`);
}

/**
 * App shell responsif: bottom nav <600px, rail 600-959px, sidebar >=960px.
 * Navigasi TIDAK pernah auto-hide (kebutuhan pengguna lanjut usia).
 */
export function AppShell() {
  const { pathname } = useLocation();

  const renderNavItem = (item: (typeof NAV_ITEMS)[number], variant: 'nav' | 'dock') => {
    const isActive = useNavActive(pathname, item.to);
    const Icon = item.icon;
    const className = `${variant}-item${isActive ? ` ${variant}-item-active` : ''}`;
    return (
      <Link
        key={item.to}
        to={item.to}
        className={className}
        aria-current={isActive ? 'page' : undefined}
      >
        <Icon size={variant === 'dock' ? 28 : 26} weight="regular" aria-hidden="true" />
        <span>{item.label}</span>
      </Link>
    );
  };

  return (
    <div className="app-shell">
      <aside className="shell-sidebar" aria-label="Navigasi utama">
        <nav className="shell-nav">{NAV_ITEMS.map((item) => renderNavItem(item, 'nav'))}</nav>
      </aside>

      <main className="shell-content">
        <Outlet />
      </main>

      <nav className="shell-dock" aria-label="Navigasi utama">
        {NAV_ITEMS.map((item) => renderNavItem(item, 'dock'))}
      </nav>
    </div>
  );
}
