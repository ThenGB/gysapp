import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import 'fake-indexeddb/auto';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { BiblePage } from './bible-page';
import { BibleSearchPage } from './bible-search';
import { SqliteBiblePort, setBiblePort } from '../../data/bible/sqlite-bible-port';

const DB_FILE = resolve(
  process.cwd(),
  '..',
  '..',
  'apps',
  'web',
  'public',
  'data',
  'bible',
  'b_tb',
  'b_tb.db',
);
const WASM_FILE = resolve(
  process.cwd(),
  '..',
  '..',
  'node_modules',
  'sql.js',
  'dist',
  'sql-wasm.wasm',
);

function dbFetch() {
  return vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes('b_tb.db')) {
      return new Response(await readFile(DB_FILE), { status: 200 });
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

describe('BiblePage (SQLite b_tb.db)', () => {
  beforeAll(() => {
    setBiblePort(new SqliteBiblePort({ locateFile: () => WASM_FILE }));
    vi.stubGlobal('fetch', dbFetch());
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
  });

  it('renders a New Testament chapter (Yohanes 3)', async () => {
    renderBible(
      '/bible/43/3',
      <Routes>
        <Route path="/bible/:book/:chapter" element={<BiblePage />} />
      </Routes>,
    );
    expect(await screen.findByRole('heading', { name: 'Yohanes 3' })).toBeInTheDocument();
  });

  it('opens the Bible library from the Settings deep-link', async () => {
    renderBible(
      '/bible?library=1',
      <Routes>
        <Route path="/bible" element={<BiblePage />} />
        <Route path="/bible/:book/:chapter" element={<BiblePage />} />
      </Routes>,
    );

    expect(await screen.findByRole('dialog', { name: 'Kelola Alkitab' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Versi Alkitab' })).toBeInTheDocument();
  });
});

describe('BibleSearchPage (search table dari DB)', () => {
  beforeAll(() => {
    setBiblePort(new SqliteBiblePort({ locateFile: () => WASM_FILE }));
    vi.stubGlobal('fetch', dbFetch());
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it('finds verses across the whole bible', async () => {
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
