import { lazy, Suspense } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { House, BookOpenText, MusicNotes, Sparkle, SquaresFour } from '@phosphor-icons/react';
import { useHymnalPlayerState } from '../features/hymnal/hymnal-player-store';
import { useT } from '../i18n';
import { assetUrl } from '../lib/asset-url';
import { useRouteMotion } from './use-route-motion';
import './shell.css';

const GlobalMidiPlayerDock = lazy(() =>
  import('../features/hymnal/global-midi-player').then((module) => ({
    default: module.GlobalMidiPlayerDock,
  })),
);

const SHELL_A11Y = {
  id: {
    skip: 'Lewati ke konten utama',
    navigation: 'Navigasi utama',
    home: 'GYSApp Beranda',
  },
  en: {
    skip: 'Skip to main content',
    navigation: 'Main navigation',
    home: 'GYSApp Home',
  },
  zh: {
    skip: '跳到主要内容',
    navigation: '主导航',
    home: 'GYSApp 首页',
  },
} as const;

const MORE_CHILD_ROUTES = ['/literature', '/settings', '/account', '/report', '/notes'] as const;

function belongsToRoute(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}

function useNavActive(pathname: string, to: string): boolean {
  if (to === '/home') return pathname === '/home';
  if (to === '/more') {
    return (
      pathname === '/more' || MORE_CHILD_ROUTES.some((route) => belongsToRoute(pathname, route))
    );
  }
  return belongsToRoute(pathname, to);
}

export function AppShell() {
  const { pathname } = useLocation();
  const { locale, t } = useT();
  const player = useHymnalPlayerState();
  const a11y = SHELL_A11Y[locale];
  useRouteMotion(pathname);

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
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById('main-content')?.focus();
        }}
      >
        {a11y.skip}
      </a>

      <aside className="shell-sidebar" aria-label={a11y.navigation}>
        <Link to="/home" className="shell-brand" aria-label={a11y.home}>
          <img src={assetUrl('/brand/tjc-logo-indonesia-color.png')} alt="" />
          <span>
            <strong>GYSApp</strong>
            <small>Gereja Yesus Sejati</small>
          </span>
        </Link>
        <nav className="shell-nav">{NAV_ITEMS.map((item) => renderNavItem(item, 'nav'))}</nav>
      </aside>

      <main
        id="main-content"
        tabIndex={-1}
        className={`shell-content${player.track ? ' shell-content-with-player' : ''}`}
      >
        <Outlet />
      </main>

      {player.track && (
        <Suspense fallback={null}>
          <GlobalMidiPlayerDock />
        </Suspense>
      )}

      <nav className="shell-dock" aria-label={a11y.navigation}>
        {NAV_ITEMS.map((item) => renderNavItem(item, 'dock'))}
      </nav>
    </div>
  );
}
