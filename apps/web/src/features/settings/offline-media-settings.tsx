import { useCallback, useEffect, useState } from 'react';
import { DownloadSimple, Trash, X } from '@phosphor-icons/react';
import { useT } from '../../i18n';
import {
  hymnalPackManager,
  type HymnalPackCode,
  type HymnalPackStatus,
} from '../../data/hymnal/hymnal-pack-manager';
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
  const [packs, setPacks] = useState<HymnalPackStatus[] | null>(null);
  const [packError, setPackError] = useState(false);
  const [, setTaskVersion] = useState(0);
  const [busy, setBusy] = useState<'media' | 'chord' | 'all' | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refreshPacks = useCallback(async (force = false) => {
    try {
      setPacks(await hymnalPackManager.statuses(force));
      setPackError(false);
    } catch {
      setPackError(true);
    }
  }, []);

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
    void refreshPacks();
  }, [refresh, refreshPacks]);

  useEffect(
    () => hymnalPackManager.subscribe(() => setTaskVersion((value) => value + 1)),
    [],
  );

  const installPack = async (code: HymnalPackCode) => {
    try {
      await hymnalPackManager.install(code);
      await refreshPacks();
    } catch {
      // Task snapshot renders the error and retry action.
    }
  };

  const removePack = async (code: HymnalPackCode) => {
    await hymnalPackManager.remove(code);
    await refreshPacks();
  };

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
        <div className="settings-hymnal-packs" aria-label={t('hymnalOfflineStorage')}>
          {packError && (
            <div className="settings-pack-error" role="alert">
              <span>{t('versionListUnavailable')}</span>
              <button type="button" className="btn-text" onClick={() => void refreshPacks(true)}>
                {t('retry')}
              </button>
            </div>
          )}
          {packs?.map((pack) => {
            const task = hymnalPackManager.getTaskSnapshot(pack.code);
            const taskBusy = Boolean(
              task && ['downloading', 'verifying', 'installing'].includes(task.phase),
            );
            const progress = task?.totalBytes
              ? Math.min(100, Math.round((task.receivedBytes / task.totalBytes) * 100))
              : 0;
            return (
              <article key={pack.code} className="settings-hymnal-pack-card">
                <div className="settings-pack-copy">
                  <strong>{pack.label}</strong>
                  <span>
                    {pack.installed
                      ? `${t('installed')} ${pack.installed.version}`
                      : t('notInstalled')}
                  </span>
                  {pack.remote && <small>{formatBytes(pack.remote.sizeBytes)} • SHA-256</small>}
                </div>
                {taskBusy && task && (
                  <div className="settings-pack-progress" aria-live="polite">
                    <div className="settings-pack-progress-track" aria-hidden="true">
                      <span style={{ width: `${progress}%` }} />
                    </div>
                    <span>
                      {task.phase === 'downloading'
                        ? `${progress}%`
                        : task.phase === 'verifying'
                          ? t('verifying')
                          : t('installing')}
                    </span>
                    {task.phase === 'downloading' && (
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`${t('stop')} ${pack.label}`}
                        onClick={() => hymnalPackManager.cancel(pack.code)}
                      >
                        <X size={18} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                )}
                {task?.phase === 'error' && (
                  <p className="settings-pack-task-error" role="alert">
                    {task.error}
                  </p>
                )}
                <div className="settings-pack-actions">
                  {!taskBusy && pack.availability !== 'installed' && (
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => void installPack(pack.code)}
                    >
                      <DownloadSimple size={18} aria-hidden="true" />
                      {task?.phase === 'error' ? t('retry') : t('download')}
                    </button>
                  )}
                  {!taskBusy && pack.installed && (
                    <button
                      type="button"
                      className="btn-text settings-danger-action"
                      onClick={() => void removePack(pack.code)}
                    >
                      <Trash size={18} aria-hidden="true" /> {t('remove')}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
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
