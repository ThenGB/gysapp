import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { BiblePage } from './bible-page';
import { BibleSearchPage } from './bible-search';

const FIXTURES = resolve(process.cwd(), '..', '..', 'tests', 'fixtures', 'bible');

function fixtureFetch() {
  return vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    const chapter = url.match(/bible\/b_tb\/chapters\/(\d+_\d+)\.json$/);
    if (chapter) {
      return new Response(await readFile(`${FIXTURES}/chapters/${chapter[1]}.json`), {
        status: 200,
      });
    }
    const pericope = url.match(/bible\/b_tb\/pericopes\/(\d+_\d+)\.json$/);
    if (pericope) {
      return new Response(await readFile(`${FIXTURES}/pericopes/${pericope[1]}.json`), {
        status: 200,
      });
    }
    const file = [
      'books.json',
      'chapter_counts.json',
      'refs_by_bc.json',
      'pericope_paralels_by_bc.json',
    ].find((f) => url.endsWith(`/${f}`));
    if (file) {
      return new Response(await readFile(`${FIXTURES}/${file}`), { status: 200 });
    }
    if (url.includes('/search-index.json')) {
      const chapters = ['1_1', '1_2', '43_1', '43_3'];
      const entries: Array<{ id: number; t: string }> = [];
      for (const ch of chapters) {
        const verses = JSON.parse(
          await readFile(`${FIXTURES}/chapters/${ch}.json`, 'utf8'),
        ) as Array<{
          id: number;
          t: string;
        }>;
        for (const v of verses) {
          entries.push({ id: v.id, t: v.t.replace(/<[^>]*>/g, ' ') });
        }
      }
      return new Response(JSON.stringify(entries), { status: 200 });
    }
    return new Response('not found', { status: 404 });
  });
}

function renderBible(path: string, element: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>{element}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('BiblePage (data lengkap via fetch)', () => {
  beforeAll(() => {
    vi.stubGlobal('fetch', fixtureFetch());
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  afterAll(() => {
    vi.unstubAllGlobals();
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
    expect(screen.getByText('Allah menciptakan langit dan bumi serta isinya')).toBeInTheDocument();
    expect(screen.queryByText(/catatan kaki/i)).not.toBeInTheDocument();
  });

  it('shows empty state when a chapter is missing', async () => {
    renderBible(
      '/bible/10/1',
      <Routes>
        <Route path="/bible/:book/:chapter" element={<BiblePage />} />
      </Routes>,
    );
    expect(await screen.findByText('Pasal ini tidak ditemukan.')).toBeInTheDocument();
  });
});

describe('BibleSearchPage (index penuh)', () => {
  beforeAll(() => {
    vi.stubGlobal('fetch', fixtureFetch());
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it('finds verses via search index with testament filter', async () => {
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
