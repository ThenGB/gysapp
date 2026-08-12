import { useCallback, useEffect, useState } from 'react';
import { Trash } from '@phosphor-icons/react';
import {
  clearChordCache,
  getChordCacheStats,
  type ChordCacheStats,
} from '../hymnal/chord-cache';
import { offlineMediaCache, type OfflineMediaStats } from '../../platform/offline-media-cache';

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 MB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
}

export function OfflineMediaSettings() {
  const [stats, setStats] = useState<OfflineMediaStats | null>(null);
  const [chordStats, setChordStats] = useState<ChordCacheStats | null>(null);
  const [busy, setBusy] = useState<'media' | 'chord' | 'all' | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [nextMedia, nextChord] = await Promise.allSettled([
      offlineMediaCache.stats(),
      getChordCacheStats(),
    ]);
    setStats(nextMedia.status === 'fulfilled' ? nextMedia.value : null);
    setChordStats(nextChord.status === 'fulfilled' ? nextChord.value : null);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const runCleanup = async (target: 'media' | 'chord' | 'all') => {
    setBusy(target);
    setMessage(null);
    try {
      if (target === 'media' || target === 'all') await offlineMediaCache.clear();
      if (target === 'chord' || target === 'all') await clearChordCache();
      await refresh();
      setMessage(
        target === 'all'
          ? 'Cache Pujian berhasil dibersihkan.'
          : target === 'media'
            ? 'Media offline berhasil dihapus.'
            : 'Cache chord berhasil dihapus.',
      );
    } catch {
      setMessage('Cache belum dapat dibersihkan. Coba lagi.');
    } finally {
      setBusy(null);
    }
  };

  const mediaCount = stats?.count ?? 0;
  const chordCount = chordStats?.blobs ?? 0;
  const hasAnyCache = mediaCount + chordCount > 0;

  return (
    <div className="settings-row settings-row-stack">
      <div className="settings-row-main">
        <strong>Penyimpanan offline Pujian</strong>
        <span>
          Soundfont, MIDI, PDF, dan chord yang pernah dibuka disimpan lokal agar lebih cepat dan
          tetap tersedia setelah tersimpan. Media besar dibatasi dengan LRU; chord tetap
          content-addressed dan dapat diunduh ulang saat lagu dibuka.
        </span>
        <small>
          {stats
            ? `${formatBytes(stats.sizeBytes)} media • ${stats.count} file (PDF ${stats.byKind.pdf.count}, MIDI ${stats.byKind.midi.count}, soundfont ${stats.byKind.soundfont.count})`
            : 'Ukuran media belum dapat dibaca.'}
        </small>
        <small>
          {chordStats
            ? `${formatBytes(chordStats.sizeBytes)} chord • ${chordStats.blobs} blob`
            : 'Ukuran cache chord belum dapat dibaca.'}
        </small>
        <small>
          Pembersihan cache Pujian tidak menghapus versi Alkitab, bookmark, riwayat, playlist,
          pengaturan, atau catatan.
        </small>
      </div>
      <div className="settings-data-actions settings-cache-actions">
        <button
          type="button"
          className="btn-text settings-danger-action"
          disabled={busy !== null || mediaCount === 0}
          onClick={() => void runCleanup('media')}
        >
          <Trash size={18} aria-hidden="true" />
          {busy === 'media' ? 'Menghapus…' : 'Hapus media'}
        </button>
        <button
          type="button"
          className="btn-text settings-danger-action"
          disabled={busy !== null || chordCount === 0}
          onClick={() => void runCleanup('chord')}
        >
          <Trash size={18} aria-hidden="true" />
          {busy === 'chord' ? 'Menghapus…' : 'Hapus chord'}
        </button>
        <button
          type="button"
          className="btn-danger"
          disabled={busy !== null || !hasAnyCache}
          onClick={() => void runCleanup('all')}
        >
          <Trash size={18} aria-hidden="true" />
          {busy === 'all' ? 'Membersihkan…' : 'Bersihkan cache Pujian'}
        </button>
      </div>
      {message && (
        <span className="settings-action-status" role="status" aria-live="polite">
          {message}
        </span>
      )}
    </div>
  );
}
