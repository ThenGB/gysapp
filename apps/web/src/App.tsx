import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { useState } from 'react';
import { AppShell } from './ui/shell';
import { HomePage } from './features/home/home-page';
import { BiblePage } from './features/bible/bible-page';
import { BibleSearchPage } from './features/bible/bible-search';
import { HymnalListPage } from './features/hymnal/hymnal-list';
import { SongViewer } from './features/hymnal/song-viewer';
import { FaithPage } from './features/faith/faith-page';
import { MorePage } from './features/more/more-page';
import { LiteratureFeedPage } from './features/more/literature-feed';

const router = createBrowserRouter([
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
      { path: 'more', element: <MorePage /> },
      { path: 'literature/:kind', element: <LiteratureFeedPage /> },
    ],
  },
]);

export function App() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, refetchOnWindowFocus: false },
        },
      }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
