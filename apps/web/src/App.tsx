import { lazy, Suspense, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { AppShell } from './ui/shell';
import { HomePage } from './features/home/home-page';
import { loadBibleReadingState } from './features/bible/bible-reading-store';
import { applySettings, loadSettings, subscribeSettings } from './features/settings/settings-store';
import { useT } from './i18n';

const BiblePage = lazy(() =>
  import('./features/bible/bible-page').then((m) => ({ default: m.BiblePage })),
);
const BibleSearchPage = lazy(() =>
  import('./features/bible/bible-search').then((m) => ({ default: m.BibleSearchPage })),
);
const HymnalListPage = lazy(() =>
  import('./features/hymnal/hymnal-list').then((m) => ({ default: m.HymnalListPage })),
);
const SongViewer = lazy(() =>
  import('./features/hymnal/song-viewer').then((m) => ({ default: m.SongViewer })),
);
const FaithPage = lazy(() =>
  import('./features/faith/faith-page').then((m) => ({ default: m.FaithPage })),
);
const FaithPdfViewerPage = lazy(() =>
  import('./features/faith/faith-pdf-viewer').then((m) => ({ default: m.FaithPdfViewerPage })),
);
const MorePage = lazy(() =>
  import('./features/more/more-page').then((m) => ({ default: m.MorePage })),
);
const LiteratureFeedPage = lazy(() =>
  import('./features/more/literature-feed').then((m) => ({ default: m.LiteratureFeedPage })),
);
const SettingsPage = lazy(() =>
  import('./features/settings/settings-page').then((m) => ({ default: m.SettingsPage })),
);
const AccountPage = lazy(() =>
  import('./features/account/account-page').then((m) => ({ default: m.AccountPage })),
);
const ReportPage = lazy(() =>
  import('./features/account/report-page').then((m) => ({ default: m.ReportPage })),
);
const NotesPage = lazy(() =>
  import('./features/notes/notes-page').then((m) => ({ default: m.NotesPage })),
);

function LazyPage({ element }: { element: React.ReactNode }) {
  const { t } = useT();
  return (
    <Suspense fallback={<div className="content-shell">{t('loading')}</div>}>{element}</Suspense>
  );
}

function BibleResumeRedirect() {
  const last = loadBibleReadingState().last;
  return <Navigate to={`/bible/${last.bookId}/${last.chapter}`} replace />;
}

const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <AppShell />,
      children: [
        { index: true, element: <Navigate to="/home" replace /> },
        { path: 'home', element: <HomePage /> },
        {
          path: 'bible',
          children: [
            { index: true, element: <BibleResumeRedirect /> },
            { path: 'search', element: <LazyPage element={<BibleSearchPage />} /> },
            { path: ':book/:chapter', element: <LazyPage element={<BiblePage />} /> },
          ],
        },
        {
          path: 'hymnal',
          children: [
            { index: true, element: <LazyPage element={<HymnalListPage />} /> },
            { path: ':book/:song', element: <LazyPage element={<SongViewer />} /> },
          ],
        },
        { path: 'faith', element: <LazyPage element={<FaithPage />} /> },
        { path: 'faith/:number/pdf', element: <LazyPage element={<FaithPdfViewerPage />} /> },
        { path: 'more', element: <LazyPage element={<MorePage />} /> },
        { path: 'literature/:kind', element: <LazyPage element={<LiteratureFeedPage />} /> },
        { path: 'settings', element: <LazyPage element={<SettingsPage />} /> },
        { path: 'account', element: <LazyPage element={<AccountPage />} /> },
        { path: 'report', element: <LazyPage element={<ReportPage />} /> },
        { path: 'notes/:kind', element: <LazyPage element={<NotesPage />} /> },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL.replace(/\/$/, '') },
);

export function App() {
  const [queryClient] = useState(
    () =>
      new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } }),
  );

  useEffect(() => {
    const sync = () => applySettings(loadSettings());
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const syncSystemTheme = () => {
      if (loadSettings().theme === 'system') sync();
    };

    sync();
    const unsubscribe = subscribeSettings(sync);
    media.addEventListener('change', syncSystemTheme);
    return () => {
      unsubscribe();
      media.removeEventListener('change', syncSystemTheme);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
