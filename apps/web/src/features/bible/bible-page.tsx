import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowsOutLineHorizontal,
  BookmarkSimple,
  Books,
  CaretLeft,
  CaretRight,
  DownloadSimple,
  MagnifyingGlass,
  Pause,
  Play,
  SpeakerHigh,
  Stop,
  Trash,
  X,
} from '@phosphor-icons/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { chapterKey, decodeVerseId, stripBibleTags, type BiblePackCode } from '@gysapp/core';
import {
  biblePackManager,
  type BibleDownloadTask,
  type BiblePackStatus,
} from '../../data/bible/bible-pack-manager';
import { getBiblePortForVersion, invalidateBiblePort } from '../../data/bible/sqlite-bible-port';
import {
  getBibleReadingSnapshot,
  isBibleBookmarked,
  rememberBibleLocation,
  subscribeBibleReading,
  toggleBibleBookmark,
  updateBibleReadingSettings,
  type BibleLocation,
} from './bible-reading-store';
import { bibleTts } from './bible-tts';
import './bible.css';

const VERSION_SHORT: Record<BiblePackCode, string> = {
  b_tb: 'TB',
  b_kjv: 'KJV',
  b_cuv: 'CUV',
};

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function usePackTask(code: BiblePackCode): BibleDownloadTask | null {
  return useSyncExternalStore(
    biblePackManager.subscribe,
    () => biblePackManager.getTaskSnapshot(code),
    () => null,
  );
}

function PackCard({
  status,
  onChanged,
}: {
  status: BiblePackStatus;
  onChanged: () => Promise<void>;
}) {
  const task = usePackTask(status.code);
  const busy = task && ['downloading', 'verifying', 'installing'].includes(task.phase);
  const progress = task?.totalBytes
    ? Math.min(100, Math.round((task.receivedBytes / task.totalBytes) * 100))
    : 0;

  const install = async () => {
    try {
      await biblePackManager.install(status.code);
      invalidateBiblePort(status.code);
      await onChanged();
    } catch {
      // Error is rendered from the task snapshot.
    }
  };

  const remove = async () => {
    await biblePackManager.remove(status.code);
    invalidateBiblePort(status.code);
    await onChanged();
  };

  return (
    <article className="bible-pack-card">
      <div className="bible-pack-copy">
        <strong>{status.label}</strong>
        <span>
          {status.builtIn && !status.installed
            ? 'Tersedia bawaan'
            : status.installed
              ? `Terpasang ${status.installed.version}`
              : 'Belum terpasang'}
        </span>
        {status.remote && (
          <small>{formatBytes(status.remote.sizeBytes)} • SHA-256 terverifikasi</small>
        )}
      </div>

      {busy && (
        <div className="bible-download-progress" aria-live="polite">
          <div className="bible-progress-track" aria-hidden="true">
            <span style={{ width: `${progress}%` }} />
          </div>
          <span>
            {task.phase === 'downloading'
              ? `${progress}%${task.resumable ? ' • dapat dilanjutkan' : ''}`
              : task.phase === 'verifying'
                ? 'Memverifikasi…'
                : 'Memasang…'}
          </span>
          {task.phase === 'downloading' && (
            <button
              type="button"
              className="btn-text"
              onClick={() => biblePackManager.cancel(status.code)}
            >
              Stop
            </button>
          )}
        </div>
      )}

      {task?.phase === 'error' && (
        <p className="bible-pack-error" role="alert">
          {task.error}
        </p>
      )}

      <div className="bible-pack-actions">
        {!busy && status.availability === 'not-installed' && (
          <button type="button" className="btn-primary" onClick={() => void install()}>
            <DownloadSimple size={19} aria-hidden="true" /> Unduh
          </button>
        )}
        {!busy && status.availability === 'update-available' && (
          <button type="button" className="btn-primary" onClick={() => void install()}>
            Perbarui
          </button>
        )}
        {!busy && task?.phase === 'error' && (
          <button type="button" className="btn-primary" onClick={() => void install()}>
            Coba lagi
          </button>
        )}
        {!busy && status.installed && (
          <button type="button" className="btn-text" onClick={() => void remove()}>
            <Trash size={18} aria-hidden="true" />
            {status.builtIn ? 'Hapus update' : 'Hapus'}
          </button>
        )}
      </div>
    </article>
  );
}

function BibleLibraryDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const statuses = useQuery({
    queryKey: ['bible-pack-statuses'],
    queryFn: () => biblePackManager.statuses(true),
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['bible-pack-statuses'] });
    await queryClient.invalidateQueries({ queryKey: ['bible-catalog'] });
    await queryClient.invalidateQueries({ queryKey: ['bible-chapter'] });
  };

  return (
    <div className="dialog-backdrop" role="dialog" aria-modal="true" aria-label="Kelola Alkitab">
      <section className="bible-library-dialog">
        <header>
          <div>
            <p className="bible-dialog-kicker">Perpustakaan offline</p>
            <h2>Versi Alkitab</h2>
          </div>
          <button type="button" className="icon-btn" aria-label="Tutup" onClick={onClose}>
            <X size={22} aria-hidden="true" />
          </button>
        </header>
        <p className="bible-dialog-hint">
          File baru baru diaktifkan setelah SHA-256 cocok. Unduhan yang dihentikan akan dilanjutkan
          bila server mendukung resume.
        </p>
        {statuses.isLoading && <p>Memeriksa versi…</p>}
        {statuses.isError && (
          <div className="feed-error" role="alert">
            <p>Daftar versi belum dapat diperbarui.</p>
            <button type="button" className="btn-primary" onClick={() => void statuses.refetch()}>
              Coba lagi
            </button>
          </div>
        )}
        <div className="bible-pack-list">
          {statuses.data?.map((status) => (
            <PackCard key={status.code} status={status} onChanged={refresh} />
          ))}
        </div>
      </section>
    </div>
  );
}

interface ReaderPaneProps {
  paneId: 'primary' | 'secondary';
  version: BiblePackCode;
  bookId: number;
  chapterId: number;
  readerScale: number;
  onScroll?: (source: HTMLElement, paneId: 'primary' | 'secondary') => void;
}

function ReaderPane({
  paneId,
  version,
  bookId,
  chapterId,
  readerScale,
  onScroll,
}: ReaderPaneProps) {
  const port = getBiblePortForVersion(version);
  const catalogQuery = useQuery({
    queryKey: ['bible-catalog', version],
    queryFn: () => port.loadCatalog(),
    staleTime: Infinity,
  });
  const chapterQuery = useQuery({
    queryKey: ['bible-chapter', version, bookId, chapterId],
    queryFn: () => port.loadChapter(bookId, chapterId),
    staleTime: Infinity,
  });
  const pericopeQuery = useQuery({
    queryKey: ['bible-pericopes', version, bookId, chapterId],
    queryFn: () => port.loadPericopes(bookId, chapterId),
    staleTime: Infinity,
  });
  const [selectedVerse, setSelectedVerse] = useState<number | null>(null);
  const book = catalogQuery.data?.books.find((item) => item.id === bookId);
  const selected = chapterQuery.data?.find((item) => item.v === selectedVerse);
  const catalogKey = chapterKey(bookId, chapterId);
  const refs = catalogQuery.data?.refs[catalogKey] ?? [];
  const paralels = catalogQuery.data?.paralels[catalogKey] ?? [];
  const related = selectedVerse
    ? refs.filter((item) => selectedVerse >= item.sv && selectedVerse <= item.ev)
    : [];

  if (chapterQuery.isError) {
    return (
      <article className="bible-reader bible-reader-error">
        <p>
          {chapterQuery.error instanceof Error
            ? chapterQuery.error.message
            : 'Versi belum tersedia.'}
        </p>
      </article>
    );
  }

  return (
    <article
      className="bible-reader"
      data-pane={paneId}
      onScroll={(event) => onScroll?.(event.currentTarget, paneId)}
      style={{ '--bible-reader-scale': readerScale } as React.CSSProperties}
    >
      <header className="bible-pane-heading">
        <div>
          <p>{VERSION_SHORT[version]}</p>
          <h1 className="bible-reader-title">
            {book?.bl ?? 'Alkitab'} {chapterId}
          </h1>
        </div>
        <button
          type="button"
          className="bible-listen-button"
          disabled={!chapterQuery.data?.length}
          onClick={() =>
            bibleTts.speak(
              (chapterQuery.data ?? []).map((verse) => stripBibleTags(verse.t)).join('. '),
              version,
            )
          }
        >
          <SpeakerHigh size={20} aria-hidden="true" /> Dengarkan
        </button>
      </header>

      {chapterQuery.isLoading && <p className="bible-empty">Memuat pasal…</p>}
      {pericopeQuery.data?.map((pericope) => (
        <p key={pericope.id} className="bible-pericope">
          {pericope.t}
        </p>
      ))}
      {chapterQuery.data?.map((verse) => {
        const location: BibleLocation = { version, bookId, chapter: chapterId, verse: verse.v };
        const bookmarked = isBibleBookmarked(location);
        return (
          <div key={verse.id} className="bible-verse-wrap" data-verse={verse.v}>
            <button
              type="button"
              className={`bible-verse${selectedVerse === verse.v ? ' bible-verse-selected' : ''}`}
              aria-pressed={selectedVerse === verse.v}
              onClick={() => setSelectedVerse(selectedVerse === verse.v ? null : verse.v)}
            >
              <sup className="bible-verse-num">{verse.v}</sup>
              {stripBibleTags(verse.t)}
              {bookmarked && (
                <BookmarkSimple
                  className="bible-bookmark-mark"
                  weight="fill"
                  aria-label="Ditandai"
                />
              )}
            </button>
          </div>
        );
      })}

      {selected && (
        <aside className="bible-verse-actions" aria-label={`Aksi ayat ${selected.v}`}>
          <button
            type="button"
            className="btn-text"
            onClick={() => {
              toggleBibleBookmark({
                version,
                bookId,
                chapter: chapterId,
                verse: selected.v,
                label: `${book?.bl ?? 'Alkitab'} ${chapterId}:${selected.v}`,
                text: stripBibleTags(selected.t),
              });
              setSelectedVerse(null);
            }}
          >
            <BookmarkSimple size={19} aria-hidden="true" />
            {isBibleBookmarked({ version, bookId, chapter: chapterId, verse: selected.v })
              ? 'Hapus tanda'
              : 'Tandai'}
          </button>
          <button
            type="button"
            className="btn-text"
            onClick={() => bibleTts.speak(stripBibleTags(selected.t), version)}
          >
            <SpeakerHigh size={19} aria-hidden="true" /> Baca ayat
          </button>
          {(related.length > 0 || paralels.length > 0) && (
            <details className="bible-related">
              <summary>Referensi terkait ({related.length + paralels.length})</summary>
              <div>
                {related.map((reference, index) => {
                  const target = decodeVerseId(reference.id);
                  return (
                    <Link
                      key={`${reference.id}-${index}`}
                      to={`/bible/${target.bookId}/${target.chapterId}`}
                    >
                      {target.bookId}:{target.chapterId}:{target.verseId}
                    </Link>
                  );
                })}
                {paralels.map((parallel) => {
                  const target = decodeVerseId(parallel.id2 || parallel.id1);
                  return (
                    <Link key={parallel.id} to={`/bible/${target.bookId}/${target.chapterId}`}>
                      {parallel.t || `${target.bookId}:${target.chapterId}:${target.verseId}`}
                    </Link>
                  );
                })}
              </div>
            </details>
          )}
        </aside>
      )}
    </article>
  );
}

export function BiblePage() {
  const params = useParams();
  const navigate = useNavigate();
  const reading = useSyncExternalStore(
    subscribeBibleReading,
    getBibleReadingSnapshot,
    getBibleReadingSnapshot,
  );
  const tts = useSyncExternalStore(bibleTts.subscribe, bibleTts.getSnapshot, bibleTts.getSnapshot);
  const bookId = Number(params.book ?? reading.last.bookId ?? 1);
  const chapterId = Number(params.chapter ?? reading.last.chapter ?? 1);
  const [version, setVersion] = useState<BiblePackCode>(reading.last.version ?? 'b_tb');
  const [libraryOpen, setLibraryOpen] = useState(false);
  const primaryPort = getBiblePortForVersion(version);
  const primaryCatalog = useQuery({
    queryKey: ['bible-catalog', version],
    queryFn: () => primaryPort.loadCatalog(),
    staleTime: Infinity,
  });
  const statuses = useQuery({
    queryKey: ['bible-pack-statuses'],
    queryFn: () => biblePackManager.statuses(),
  });
  const primaryRef = useRef<HTMLElement | null>(null);
  const secondaryRef = useRef<HTMLElement | null>(null);
  const scrollFrame = useRef<number | null>(null);
  const scrollLock = useRef<'primary' | 'secondary' | null>(null);

  const book = primaryCatalog.data?.books.find((item) => item.id === bookId);
  const chapterCount = book?.c ?? 0;
  const availableVersions = useMemo(
    () => (statuses.data ?? []).filter((status) => status.builtIn || Boolean(status.installed)),
    [statuses.data],
  );

  useEffect(() => {
    if (!book) return;
    rememberBibleLocation({ version, bookId, chapter: chapterId }, `${book.bl} ${chapterId}`);
  }, [version, bookId, chapterId, book]);

  useEffect(() => () => bibleTts.stop(), []);

  const changeBook = (nextBookId: number) => navigate(`/bible/${nextBookId}/1`);
  const changeChapter = (nextChapter: number) => navigate(`/bible/${bookId}/${nextChapter}`);

  const syncScroll = useCallback(
    (source: HTMLElement, paneId: 'primary' | 'secondary') => {
      if (!reading.settings.split || !reading.settings.syncScroll) return;
      if (scrollLock.current && scrollLock.current !== paneId) return;
      if (scrollFrame.current !== null) cancelAnimationFrame(scrollFrame.current);
      scrollFrame.current = requestAnimationFrame(() => {
        const sourceTop = source.getBoundingClientRect().top;
        const verses = Array.from(source.querySelectorAll<HTMLElement>('[data-verse]'));
        const nearest = verses.find((node) => node.getBoundingClientRect().bottom > sourceTop + 24);
        const verse = nearest?.dataset.verse;
        if (!verse) return;
        const target = paneId === 'primary' ? secondaryRef.current : primaryRef.current;
        const targetVerse = target?.querySelector<HTMLElement>(`[data-verse="${verse}"]`);
        if (!target || !targetVerse) return;
        scrollLock.current = paneId === 'primary' ? 'secondary' : 'primary';
        target.scrollTop = targetVerse.offsetTop - target.offsetTop;
        requestAnimationFrame(() => {
          scrollLock.current = null;
        });
      });
    },
    [reading.settings.split, reading.settings.syncScroll],
  );

  return (
    <div className="content-shell bible-page">
      <header className="bible-mobile-header">
        <div className="bible-title-block">
          <span>Alkitab</span>
          <strong>
            {book?.bl ?? 'Memuat…'} {chapterId}
          </strong>
        </div>
        <div className="bible-header-actions">
          <Link to="/bible/search" className="icon-btn" aria-label="Cari ayat">
            <MagnifyingGlass size={21} aria-hidden="true" />
          </Link>
          <button
            type="button"
            className="icon-btn"
            aria-label="Kelola versi Alkitab"
            onClick={() => setLibraryOpen(true)}
          >
            <Books size={21} aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="bible-toolbar bible-toolbar-modern">
        <label>
          <span className="visually-hidden">Pilih kitab</span>
          <select
            className="bible-book-select"
            value={bookId}
            onChange={(event) => changeBook(Number(event.target.value))}
          >
            {primaryCatalog.data?.books.map((item) => (
              <option key={item.id} value={item.id}>
                {item.bl}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="visually-hidden">Pilih pasal</span>
          <select
            className="bible-book-select bible-chapter-select"
            value={chapterId}
            onChange={(event) => changeChapter(Number(event.target.value))}
          >
            {Array.from({ length: chapterCount || 1 }, (_, index) => index + 1).map((chapter) => (
              <option key={chapter} value={chapter}>
                Pasal {chapter}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="visually-hidden">Versi utama</span>
          <select
            className="bible-book-select bible-version-select"
            value={version}
            onChange={(event) => setVersion(event.target.value as BiblePackCode)}
          >
            {availableVersions.length === 0 && <option value="b_tb">TB</option>}
            {availableVersions.map((status) => (
              <option key={status.code} value={status.code}>
                {VERSION_SHORT[status.code]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="bible-reader-controls" aria-label="Kontrol pembaca">
        <button
          type="button"
          className={`reader-control${reading.settings.split ? ' reader-control-active' : ''}`}
          aria-pressed={reading.settings.split}
          onClick={() => updateBibleReadingSettings({ split: !reading.settings.split })}
        >
          <ArrowsOutLineHorizontal size={19} aria-hidden="true" /> Dua panel
        </button>
        {reading.settings.split && (
          <label className="bible-secondary-version">
            <span>Panel 2</span>
            <select
              value={reading.settings.secondaryVersion}
              onChange={(event) =>
                updateBibleReadingSettings({
                  secondaryVersion: event.target.value as BiblePackCode,
                })
              }
            >
              {availableVersions.map((status) => (
                <option key={status.code} value={status.code}>
                  {VERSION_SHORT[status.code]}
                </option>
              ))}
            </select>
          </label>
        )}
        {reading.settings.split && (
          <label className="bible-sync-toggle">
            <input
              type="checkbox"
              checked={reading.settings.syncScroll}
              onChange={(event) => updateBibleReadingSettings({ syncScroll: event.target.checked })}
            />
            Sinkron ayat
          </label>
        )}
        <div className="bible-font-controls" role="group" aria-label="Ukuran teks Alkitab">
          <button
            type="button"
            aria-label="Perkecil teks Alkitab"
            disabled={reading.settings.readerScale <= 0.9}
            onClick={() =>
              updateBibleReadingSettings({
                readerScale: Math.max(
                  0.9,
                  Math.round((reading.settings.readerScale - 0.1) * 10) / 10,
                ),
              })
            }
          >
            A−
          </button>
          <button
            type="button"
            aria-label="Perbesar teks Alkitab"
            disabled={reading.settings.readerScale >= 1.6}
            onClick={() =>
              updateBibleReadingSettings({
                readerScale: Math.min(
                  1.6,
                  Math.round((reading.settings.readerScale + 0.1) * 10) / 10,
                ),
              })
            }
          >
            A+
          </button>
        </div>
      </div>

      <div
        className={`bible-reader-grid${reading.settings.split ? ' bible-reader-grid-split' : ''}`}
      >
        <div
          ref={(node) => {
            primaryRef.current = node?.querySelector('[data-pane="primary"]') ?? null;
          }}
        >
          <ReaderPane
            paneId="primary"
            version={version}
            bookId={bookId}
            chapterId={chapterId}
            readerScale={reading.settings.readerScale}
            onScroll={syncScroll}
          />
        </div>
        {reading.settings.split && (
          <div
            ref={(node) => {
              secondaryRef.current = node?.querySelector('[data-pane="secondary"]') ?? null;
            }}
          >
            <ReaderPane
              paneId="secondary"
              version={reading.settings.secondaryVersion}
              bookId={bookId}
              chapterId={chapterId}
              readerScale={reading.settings.readerScale}
              onScroll={syncScroll}
            />
          </div>
        )}
      </div>

      <nav className="bible-bottom-pager" aria-label="Navigasi pasal">
        <button
          type="button"
          disabled={chapterId <= 1}
          onClick={() => changeChapter(chapterId - 1)}
        >
          <CaretLeft size={20} aria-hidden="true" /> Sebelumnya
        </button>
        <span>
          {book?.bl} {chapterId}
        </span>
        <button
          type="button"
          disabled={chapterId >= chapterCount}
          onClick={() => changeChapter(chapterId + 1)}
        >
          Berikutnya <CaretRight size={20} aria-hidden="true" />
        </button>
      </nav>

      {tts.speaking && (
        <div className="bible-tts-bar" role="status">
          <SpeakerHigh size={20} aria-hidden="true" />
          <span>Alkitab sedang dibacakan</span>
          <button
            type="button"
            className="icon-btn"
            aria-label={tts.paused ? 'Lanjutkan' : 'Jeda'}
            onClick={() => bibleTts.togglePause()}
          >
            {tts.paused ? <Play size={19} /> : <Pause size={19} />}
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label="Stop pembacaan"
            onClick={() => bibleTts.stop()}
          >
            <Stop size={18} />
          </button>
        </div>
      )}

      {libraryOpen && <BibleLibraryDialog onClose={() => setLibraryOpen(false)} />}
    </div>
  );
}
