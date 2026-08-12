import { useCallback, useEffect, useState } from 'react';
import { Trash } from '@phosphor-icons/react';
import { offlineMediaCache, type OfflineMediaStats } from '../../platform/offline-media-cache';

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 MB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
}

export function OfflineMediaSettings() {
  const [stats, setStats] = useState<OfflineMediaStats | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setStats(await offlineMediaCache.stats());
    } catch {
      setStats(null);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const clear = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await offlineMediaCache.clear();
      await refresh();
      setMessage('Media offline berhasil dihapus.');
    } catch {
      setMessage('Media offline belum dapat dihapus. Coba lagi.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="settings-row settings-row-stack">
      <div className="settings-row-main">
        <strong>Media offline Pujian</strong>
        <span>
          Soundfont, MIDI, dan PDF yang pernah dibuka disimpan lokal agar lebih cepat dan tetap
          tersedia setelah tersimpan. File lama dibersihkan otomatis saat cache mencapai batasnya.
        </span>
        <small>
          {stats
            ? `${formatBytes(stats.sizeBytes)} • ${stats.count} file (PDF ${stats.byKind.pdf.count}, MIDI ${stats.byKind.midi.count}, soundfont ${stats.byKind.soundfont.count})`
            : 'Ukuran cache belum dapat dibaca.'}
        </small>
        <small>Menghapus media ini tidak menghapus Alkitab, bookmark, riwayat, atau catatan.</small>
      </div>
      <button
        type="button"
        className="btn-text settings-danger-action"
        disabled={busy || stats?.count === 0}
        onClick={() => void clear()}
      >
        <Trash size={18} aria-hidden="true" />
        {busy ? 'Menghapus…' : 'Hapus media offline'}
      </button>
      {message && (
        <span className="settings-action-status" role="status" aria-live="polite">
          {message}
        </span>
      )}
    </div>
  );
}
