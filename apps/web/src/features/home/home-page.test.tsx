import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HomePage } from './home-page';
import { rememberBibleLocation } from '../bible/bible-reading-store';
import { clearHymnalRecent, rememberHymnalSong } from '../hymnal/hymnal-recent-store';
import type { SauhResult, TrueVoiceFeed } from '@gysapp/contracts';

const sauhResult: SauhResult = {
  isToday: true,
  fetchedAt: '2026-08-11T12:00:00.000Z',
  items: [
    {
      slug: 'sbj260811',
      title: 'Firman hari ini',
      url: 'https://tjc.org/id/sauh/hari-ini',
      imageUrl: 'https://tjc.org/img.jpg',
      excerpt: 'Ayat pilihan untuk hari ini.',
      publishedAt: '2026-08-11T00:00:00.000Z',
    },
  ],
};

const trueVoiceFeed: TrueVoiceFeed = {
  fetchedAt: '2026-08-11T12:00:00.000Z',
  items: [
    {
      title: 'Kesaksian Sdr. Budi',
      url: 'https://tjc.org/id/suarasejati/kesaksian-budi',
      imageUrl: null,
      description: 'Sebuah kesaksian.',
      author: null,
    },
  ],
};

vi.mock('../../api/content', () => ({
  useSauh: vi.fn(),
  useSuaraSejati: vi.fn(),
}));

import { useSauh, useSuaraSejati } from '../../api/content';

const mockUseSauh = vi.mocked(useSauh);
const mockUseSuaraSejati = vi.mocked(useSuaraSejati);

function renderHome() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('HomePage', () => {
  beforeEach(() => {
    localStorage.clear();
    clearHymnalRecent();
    mockUseSauh.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    } as never);
    mockUseSuaraSejati.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    } as never);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows greeting with date', () => {
    renderHome();
    expect(screen.getByRole('heading', { name: 'Shalom' })).toBeInTheDocument();
  });

  it('renders Sauh card and Suara Sejati items on success', async () => {
    mockUseSauh.mockReturnValue({
      data: sauhResult,
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    } as never);
    mockUseSuaraSejati.mockReturnValue({
      data: trueVoiceFeed,
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    } as never);

    renderHome();
    expect(await screen.findByText('Firman hari ini')).toBeInTheDocument();
    expect(screen.getByText('Ayat pilihan untuk hari ini.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Suara Sejati' })).toBeInTheDocument();
    expect(screen.getByText('Kesaksian Sdr. Budi')).toBeInTheDocument();
  });

  it('shows retry button and refetches on error', async () => {
    const refetch = vi.fn().mockResolvedValue(undefined);
    mockUseSauh.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      isFetching: false,
      refetch,
    } as never);

    renderHome();
    const retry = await screen.findByRole('button', { name: 'Coba lagi' });
    expect(screen.getByRole('alert')).toBeInTheDocument();
    fireEvent.click(retry);
    await waitFor(() => expect(refetch).toHaveBeenCalledTimes(1));
  });

  it('shows human-readable Bible resume and the persisted recent hymn', () => {
    rememberBibleLocation({ version: 'b_tb', bookId: 43, chapter: 3, verse: 16 }, 'Yohanes 3');
    rememberHymnalSong({ book: 'KR', song: '010', title: 'KR 010 — Sukacita' });

    renderHome();

    const bibleResume = screen.getByRole('link', { name: 'Lanjutkan bacaan: Yohanes 3' });
    expect(bibleResume).toHaveAttribute('href', '/bible/43/3?v=16');
    const hymnResume = screen.getByRole('link', {
      name: 'Lanjutkan pujian: KR 010 — Sukacita',
    });
    expect(hymnResume).toHaveAttribute('href', '/hymnal/KR/010');
  });
});
