import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { BiblePage } from './bible-page';
import { BibleSearchPage } from './bible-search';

function renderBible(path: string, element: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>{element}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('BiblePage', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders chapter 1 of Kejadian with verses and pericope', async () => {
    renderBible(
      '/bible/1/1',
      <Routes>
        <Route path="/bible/:book/:chapter" element={<BiblePage />} />
      </Routes>,
    );
    expect(await screen.findByRole('heading', { name: 'Kejadian 1' })).toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.getByText(/Pada mulanya Allah menciptakan langit dan bumi/),
      ).toBeInTheDocument();
    });
    // Perikop pasal 1 ada di fixture.
    expect(screen.getByText('Allah menciptakan langit dan bumi serta isinya')).toBeInTheDocument();
    // Footnote <f> tidak boleh tampil.
    expect(screen.queryByText(/catatan kaki/i)).not.toBeInTheDocument();
  });

  it('shows empty state for chapters outside the demo pack', async () => {
    renderBible(
      '/bible/10/1',
      <Routes>
        <Route path="/bible/:book/:chapter" element={<BiblePage />} />
      </Routes>,
    );
    expect(
      await screen.findByText('Pasal ini belum tersedia pada paket demo (4 pasal).'),
    ).toBeInTheDocument();
  });
});

describe('BibleSearchPage', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('finds verses across fixture chapters with testament filter', async () => {
    renderBible(
      '/bible/search',
      <Routes>
        <Route path="/bible/search" element={<BibleSearchPage />} />
      </Routes>,
    );
    const input = await screen.findByRole('searchbox');
    input.focus();
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, 'terang');
    input.dispatchEvent(new Event('input', { bubbles: true }));

    await waitFor(() => {
      const results = screen.queryAllByRole('link', { name: /Kejadian 1:/ });
      expect(results.length).toBeGreaterThan(0);
    });
  });
});
