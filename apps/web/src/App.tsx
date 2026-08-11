import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { useState } from 'react';
import { AppShell } from './ui/shell';
import { HomePage } from './features/home/home-page';
import { PlaceholderPage } from './ui/placeholder';

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/home" replace /> },
      { path: 'home', element: <HomePage /> },
      { path: 'bible', element: <PlaceholderPage title="Alkitab" /> },
      { path: 'hymnal', element: <PlaceholderPage title="Pujian" /> },
      { path: 'faith', element: <PlaceholderPage title="Iman" /> },
      { path: 'more', element: <PlaceholderPage title="Lainnya" /> },
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
