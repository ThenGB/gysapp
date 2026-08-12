import { lazy, Suspense, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { AppShell } from './ui/shell';
import { HomePage } from './features/home/home-page';
import { BiblePage } from './features/bible/bible-page';
import { BibleSearchPage } from './features/bible/bible-search';
import { loadBibleReadingState } from './features/bible/bible-reading-store';
import { HymnalListPage } from './features/hymnal/hymnal-list';
import { FaithPage } from './features/faith/faith-page';
import { MorePage } from './features/more/more-page';
import { LiteratureFeedPage } from './features/more/literature-feed';
import { SettingsPage } from './features/settings/settings-page';
import { ReportPage } from './features/account/report-page';
import { NotesPage } from './features/notes/notes-page';
import {
  applySettings,
  loadSettings,
  subscribeSettings as subscribeVisualSettings,
} from './features/settings/settings-store';
import { subscribeSettings as subscribeLocaleSettings } from './i18n';

const FaithPdfViewerPage = lazy(() =>
  import('./features/faith/faith-pdf-viewer').then((m) => ({ default: m.FaithPdfViewerPage })),
);
const SongViewer = lazy(() =>
  import('./features/hymnal/song-viewer').then((m) => ({ default: m.SongViewer })),
);
const AccountPage = lazy(() =>
  import('./features/account/account-page').then((m) => ({ default: m.AccountPage })),
);

function LazyPage({ element }: { element: React.ReactNode }) {
  return <Suspense fallback={<div className="content-shell">Memuat…</div>}>{element}</Suspense>;
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
            { path: 'search', element: <BibleSearchPage /> },
            { path: ':book/:chapter', element: <BiblePage /> },
          ],
        },
        {
          path: 'hymnal',
          children: [
            { index: true, element: <HymnalListPage /> },
            { path: ':book/:song', element: <LazyPage element={<SongViewer />} /> },
          ],
        },
        { path: 'faith', element: <FaithPage /> },
        { path: 'faith/:number/pdf', element: <LazyPage element={<FaithPdfViewerPage />} /> },
        { path: 'more', element: <MorePage /> },
        { path: 'literature/:kind', element: <LiteratureFeedPage /> },
        { path: 'settings', element: <SettingsPage /> },
        { path: 'account', element: <LazyPage element={<AccountPage />} /> },
        { path: 'report', element: <ReportPage /> },
        { path: 'notes/:kind', element: <NotesPage /> },
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
    sync();
    const unsubscribeVisual = subscribeVisualSettings(sync);
    const unsubscribeLocale = subscribeLocaleSettings(sync);
    return () => {
      unsubscribeVisual();
      unsubscribeLocale();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
