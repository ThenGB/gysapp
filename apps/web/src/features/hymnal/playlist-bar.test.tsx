import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { PlaylistBar } from './playlist-bar';

const song = { book: 'KR', number: '001', title: 'Pujilah Allah Yang Maha Esa' };

describe('PlaylistBar', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('creates playlist and adds the current song', async () => {
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
      expect(screen.getByText('Ibadah Pagi (0)')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Tambah lagu ini/ }));
    await waitFor(() => {
      expect(screen.getByText(/001 — Pujilah Allah Yang Maha Esa/)).toBeInTheDocument();
    });
    expect(localStorage.getItem('gysapp.playlists.v1')).toContain('Ibadah Pagi');
  });

  it('cycles loop mode on repeat button', () => {
    render(
      <MemoryRouter>
        <PlaylistBar />
      </MemoryRouter>,
    );
    const loop = screen.getByRole('button', { name: /Mode ulang/ });
    expect(loop).toHaveTextContent('off');
    fireEvent.click(loop);
    expect(loop).toHaveTextContent('playlist');
  });
});
