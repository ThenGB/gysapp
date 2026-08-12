import 'fake-indexeddb/auto';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { offlineMediaCache } from '../../platform/offline-media-cache';
import { OfflineMediaSettings } from './offline-media-settings';

const encoder = new TextEncoder();

describe('OfflineMediaSettings', () => {
  beforeEach(async () => {
    await offlineMediaCache.clear();
  });

  it('shows cache stats and clears only offline media on request', async () => {
    await offlineMediaCache.put('/song.pdf', 'pdf', encoder.encode('pdf'));
    await offlineMediaCache.put('/song.mid', 'midi', encoder.encode('midi'));

    render(<OfflineMediaSettings />);

    expect(await screen.findByText(/2 file \(PDF 1, MIDI 1, soundfont 0\)/)).toBeInTheDocument();
    expect(screen.getByText(/tidak menghapus Alkitab, bookmark, riwayat, atau catatan/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Hapus media offline' }));

    expect(await screen.findByText('Media offline berhasil dihapus.')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/0 file \(PDF 0, MIDI 0, soundfont 0\)/)).toBeVisible());
    expect(await offlineMediaCache.get('/song.pdf', 'pdf')).toBeNull();
    expect(await offlineMediaCache.get('/song.mid', 'midi')).toBeNull();
  });
});
