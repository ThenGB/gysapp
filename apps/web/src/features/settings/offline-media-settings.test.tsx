import 'fake-indexeddb/auto';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearChordCache } from '../hymnal/chord-cache';
import { IndexedDbBlobStore } from '../../platform/blob-stores/indexeddb';
import { offlineMediaCache } from '../../platform/offline-media-cache';
import { OfflineMediaSettings } from './offline-media-settings';

const encoder = new TextEncoder();
const chordStore = new IndexedDbBlobStore('gysapp-chords');

describe('OfflineMediaSettings', () => {
  beforeEach(async () => {
    await Promise.all([offlineMediaCache.clear(), clearChordCache()]);
  });

  it('shows media/chord stats and clears only Pujian cache on request', async () => {
    await offlineMediaCache.put('/song.pdf', 'pdf', encoder.encode('pdf'));
    await offlineMediaCache.put('/song.mid', 'midi', encoder.encode('midi'));
    await chordStore.write('chord/blobs/aa/example.chord.json', encoder.encode('{"pages":{}}'));

    render(<OfflineMediaSettings />);

    expect(await screen.findByText(/2 file \(PDF 1, MIDI 1, soundfont 0\)/)).toBeInTheDocument();
    expect(screen.getByText(/1 blob/)).toBeInTheDocument();
    expect(
      screen.getByText(/tidak menghapus versi Alkitab, bookmark, riwayat, playlist/i),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Bersihkan cache Pujian' }));

    expect(await screen.findByText('Cache Pujian berhasil dibersihkan.')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/0 file \(PDF 0, MIDI 0, soundfont 0\)/)).toBeVisible();
      expect(screen.getByText(/0 blob/)).toBeVisible();
    });
    expect(await offlineMediaCache.get('/song.pdf', 'pdf')).toBeNull();
    expect(await offlineMediaCache.get('/song.mid', 'midi')).toBeNull();
    expect(await chordStore.read('chord/blobs/aa/example.chord.json')).toBeNull();
  });
});
