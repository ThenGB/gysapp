import { useCallback, useEffect, useState } from 'react';
import { Trash } from '@phosphor-icons/react';
import { useT } from '../../i18n';
import { clearChordCache, getChordCacheStats, type ChordCacheStats } from '../hymnal/chord-cache';
import { offlineMediaCache, type OfflineMediaStats } from '../../platform/offline-media-cache';

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 MB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
}

export function OfflineMediaSettings() {
  const { t } = useT();
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
          ? t('hymnalCacheCleared')
          : target === 'media'
            ? t('offlineMediaDeleted')
            : t('chordCacheDeleted'),
      );
    } catch {
      setMessage(t('cacheCleanupFailed'));
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
        <strong>{t('hymnalOfflineStorage')}</strong>
        <span>{t('hymnalOfflineStorageLead')}</span>
        <small>
          {stats
            ? `${formatBytes(stats.sizeBytes)} ${t('mediaUnit')} • ${stats.count} ${t('fileUnit')} (PDF ${stats.byKind.pdf.count}, MIDI ${stats.byKind.midi.count}, soundfont ${stats.byKind.soundfont.count})`
            : t('mediaSizeUnavailable')}
        </small>
        <small>
          {chordStats
            ? `${formatBytes(chordStats.sizeBytes)} ${t('chordUnit')} • ${chordStats.blobs} ${t('blobUnit')}`
            : t('chordSizeUnavailable')}
        </small>
        <small>{t('cacheCleanupNote')}</small>
      </div>
      <div className="settings-data-actions settings-cache-actions">
        <button
          type="button"
          className="btn-text settings-danger-action"
          disabled={busy !== null || mediaCount === 0}
          onClick={() => void runCleanup('media')}
        >
          <Trash size={18} aria-hidden="true" />
          {busy === 'media' ? t('deleting') : t('deleteMedia')}
        </button>
        <button
          type="button"
          className="btn-text settings-danger-action"
          disabled={busy !== null || chordCount === 0}
          onClick={() => void runCleanup('chord')}
        >
          <Trash size={18} aria-hidden="true" />
          {busy === 'chord' ? t('deleting') : t('deleteChord')}
        </button>
        <button
          type="button"
          className="btn-danger"
          disabled={busy !== null || !hasAnyCache}
          onClick={() => void runCleanup('all')}
        >
          <Trash size={18} aria-hidden="true" />
          {busy === 'all' ? t('clearing') : t('clearHymnalCache')}
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
