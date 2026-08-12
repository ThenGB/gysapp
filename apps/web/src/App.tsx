import { lazy, Suspense, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { AppShell } from './ui/shell';
import { HomePage } from './features/home/home-page';
import { BiblePage } from './features/bible/bible-page';
import { BibleSearchPage } from './features/bible/bible-search';
import { HymnalListPage } from './features/hymnal/hymnal-list';
import { SongViewer } from './features/hymnal/song-viewer';
import { FaithPage } from './features/faith/faith-page';
import { MorePage } from './features/more/more-page';
import { LiteratureFeedPage } from './features/more/literature-feed';
import { SettingsPage } from './features/settings/settings-page';
import { ReportPage } from './features/account/report-page';
import { NotesPage } from './features/notes/notes-page';
import { applySettings, loadSettings } from './features/settings/settings-store';
import { subscribeSettings } from './i18n';

// Route yang memuat pdfjs/midi-engine di-split agar bundle awal kecil.
const FaithPdfViewerPage = lazy(() =>
  import('./features/faith/faith-pdf-viewer').then((m) => ({ default: m.FaithPdfViewerPage })),
);

function LazyPage({ element }: { element: React.ReactNode }) {
  return <Suspense fallback={<div className="content-shell">Memuat…</div>}>{element}</Suspense>;
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
            { index: true, element: <Navigate to="/bible/1/1" replace /> },
            { path: 'search', element: <BibleSearchPage /> },
            { path: ':book/:chapter', element: <BiblePage /> },
          ],
        },
        {
          path: 'hymnal',
          children: [
            { index: true, element: <HymnalListPage /> },
            { path: ':book/:song', element: <SongViewer /> },
          ],
        },
        { path: 'faith', element: <FaithPage /> },
        { path: 'faith/:number/pdf', element: <LazyPage element={<FaithPdfViewerPage />} /> },
        { path: 'more', element: <MorePage /> },
        { path: 'literature/:kind', element: <LiteratureFeedPage /> },
        { path: 'settings', element: <SettingsPage /> },
        { path: 'report', element: <ReportPage /> },
        { path: 'notes/:kind', element: <NotesPage /> },
      ],
    },
  ],
  {
    basename: import.meta.env.BASE_URL.replace(/\/$/, ''),
  },
);

export function App() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, refetchOnWindowFocus: false },
        },
      }),
  );

  useEffect(() => {
    applySettings(loadSettings());
    const unsubscribe = subscribeSettings(() => applySettings(loadSettings()));
    return unsubscribe;
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
