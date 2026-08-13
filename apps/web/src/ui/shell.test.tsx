import { render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AppShell } from './shell';

function PathProbe() {
  const { pathname } = useLocation();
  return <output data-testid="path">{pathname}</output>;
}

function renderShell(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <PathProbe />
      <AppShell />
    </MemoryRouter>,
  );
}

describe('AppShell', () => {
  it('renders all five main menu items', () => {
    renderShell('/home');
    for (const label of ['Beranda', 'Alkitab', 'Pujian', 'Iman', 'Lainnya']) {
      expect(screen.getAllByRole('link', { name: new RegExp(label) }).length).toBeGreaterThan(0);
    }
  });

  it('marks the active tab with aria-current=page', () => {
    renderShell('/hymnal');
    expect(screen.getByTestId('path')).toHaveTextContent('/hymnal');
    const active = screen.getAllByRole('link', { current: 'page' });
    expect(active.length).toBe(2);
    for (const link of active) {
      expect(link).toHaveAttribute('aria-current', 'page');
      expect(link).toHaveAttribute('href', '/hymnal');
    }
  });

  it.each(['/settings', '/notes/bible', '/literature/renungan', '/account', '/report'])(
    'keeps Lainnya active for secondary route %s',
    (path) => {
      renderShell(path);
      const active = screen.getAllByRole('link', { current: 'page' });
      expect(active).toHaveLength(2);
      for (const link of active) expect(link).toHaveAttribute('href', '/more');
    },
  );
});
