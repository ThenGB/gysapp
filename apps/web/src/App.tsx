import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { AppShell } from './ui/shell';
import { PlaceholderPage } from './ui/placeholder';

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/home" replace /> },
      { path: 'home', element: <PlaceholderPage title="Beranda" /> },
      { path: 'bible', element: <PlaceholderPage title="Alkitab" /> },
      { path: 'hymnal', element: <PlaceholderPage title="Pujian" /> },
      { path: 'faith', element: <PlaceholderPage title="Iman" /> },
      { path: 'more', element: <PlaceholderPage title="Lainnya" /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
