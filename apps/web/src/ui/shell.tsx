import { Link, Outlet, useLocation } from 'react-router-dom';
import { House, BookOpenText, MusicNotes, Sparkle, SquaresFour } from '@phosphor-icons/react';
import { useT } from '../i18n';
import './shell.css';

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
  const { t } = useT();

  const NAV_ITEMS = [
    { to: '/home', label: t('home'), icon: House },
    { to: '/bible', label: t('bible'), icon: BookOpenText },
    { to: '/hymnal', label: t('hymnal'), icon: MusicNotes },
    { to: '/faith', label: t('faith'), icon: Sparkle },
    { to: '/more', label: t('more'), icon: SquaresFour },
  ] as const;

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
