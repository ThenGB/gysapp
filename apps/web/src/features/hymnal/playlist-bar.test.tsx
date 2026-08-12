import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { PlaylistBar } from './playlist-bar';
import { refreshPlaylistState } from './playlist-store';

const song = { book: 'KR', number: '001', title: 'Pujilah Allah Yang Maha Esa' };

describe('PlaylistBar', () => {
  beforeEach(() => {
    localStorage.clear();
    refreshPlaylistState();
  });

  it('creates and activates a playlist before adding the current song', async () => {
    render(
      <MemoryRouter>
        <PlaylistBar song={song} />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'Nama playlist baru' }), {
      target: { value: 'Ibadah Pagi' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Buat playlist' }));

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Playlist aktif' })).toHaveValue(
        expect.stringMatching(/.+/),
      );
      expect(screen.getByText('0 lagu')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Tambah lagu ini/ }));
    await waitFor(() => {
      expect(screen.getByText('Pujilah Allah Yang Maha Esa')).toBeInTheDocument();
      expect(screen.getByText('1 lagu')).toBeInTheDocument();
    });
    expect(localStorage.getItem('gysapp.playlists.v1')).toContain('Ibadah Pagi');
    expect(screen.getByRole('button', { name: 'Sudah ada' })).toBeDisabled();
  });

  it('cycles loop mode with readable labels', () => {
    render(
      <MemoryRouter>
        <PlaylistBar />
      </MemoryRouter>,
    );
    const loop = screen.getByRole('button', { name: 'Mode putar: Tanpa ulang' });
    expect(loop).toHaveTextContent('Tanpa ulang');
    fireEvent.click(loop);
    expect(screen.getByRole('button', { name: 'Mode putar: Ulang playlist' })).toBeInTheDocument();
  });

  it('reorders songs using touch and keyboard accessible controls', () => {
    localStorage.setItem(
      'gysapp.playlists.v1',
      JSON.stringify({
        playlists: [
          {
            id: 'p1',
            name: 'Ibadah',
            createdAt: 1,
            songs: [
              song,
              { book: 'KR', number: '002', title: 'Pujilah Yang Mahakudus' },
            ],
          },
        ],
        activeId: 'p1',
        loopMode: 'off',
      }),
    );
    refreshPlaylistState();

    render(
      <MemoryRouter>
        <PlaylistBar />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Naikkan Pujilah Yang Mahakudus' }));
    const links = screen.getAllByRole('link');
    expect(links[0]).toHaveTextContent('002');
    expect(links[1]).toHaveTextContent('001');
  });
});
