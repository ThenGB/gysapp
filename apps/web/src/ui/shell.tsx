import { Link, Outlet, useLocation } from 'react-router-dom';
import { House, BookOpenText, MusicNotes, Sparkle, SquaresFour } from '@phosphor-icons/react';
import { useT } from '../i18n';
import { assetUrl } from '../lib/asset-url';
import './shell.css';

function useNavActive(pathname: string, to: string): boolean {
  if (to === '/home') return pathname === '/home';
  return pathname === to || pathname.startsWith(`${to}/`);
}

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
    return (
      <Link
        key={item.to}
        to={item.to}
        className={`${variant}-item${isActive ? ` ${variant}-item-active` : ''}`}
        aria-current={isActive ? 'page' : undefined}
      >
        <Icon size={variant === 'dock' ? 26 : 25} weight="regular" aria-hidden="true" />
        <span>{item.label}</span>
      </Link>
    );
  };

  return (
    <div className="app-shell">
      <aside className="shell-sidebar" aria-label="Navigasi utama">
        <Link to="/home" className="shell-brand" aria-label="GYSApp Beranda">
          <img src={assetUrl('/brand/tjc-logo-indonesia-color.png')} alt="" />
          <span>
            <strong>GYSApp</strong>
            <small>Gereja Yesus Sejati</small>
          </span>
        </Link>
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
