import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
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
import { chapterKey, stripBibleTags, type BiblePackCode } from '@gysapp/core';
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
import { BibleVerseContext } from './bible-verse-context';
import { useT } from '../../i18n';
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
  const { t } = useT();
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
            ? t('builtInAvailable')
            : status.installed
              ? `${t('installed')} ${status.installed.version}`
              : t('notInstalled')}
        </span>
        {status.remote && (
          <small>
            {formatBytes(status.remote.sizeBytes)} • {t('shaVerified')}
          </small>
        )}
      </div>

      {busy && (
        <div className="bible-download-progress" aria-live="polite">
          <div className="bible-progress-track" aria-hidden="true">
            <span style={{ width: `${progress}%` }} />
          </div>
          <span>
            {task.phase === 'downloading'
              ? `${progress}%${task.resumable ? ` • ${t('resumable')}` : ''}`
              : task.phase === 'verifying'
                ? t('verifying')
                : t('installing')}
          </span>
          {task.phase === 'downloading' && (
            <button
              type="button"
              className="btn-text"
              onClick={() => biblePackManager.cancel(status.code)}
            >
              {t('stop')}
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
            <DownloadSimple size={19} aria-hidden="true" /> {t('download')}
          </button>
        )}
        {!busy && status.availability === 'update-available' && (
          <button type="button" className="btn-primary" onClick={() => void install()}>
            {t('updateBiblePack')}
          </button>
        )}
        {!busy && task?.phase === 'error' && (
          <button type="button" className="btn-primary" onClick={() => void install()}>
            {t('retry')}
          </button>
        )}
        {!busy && status.installed && (
          <button type="button" className="btn-text" onClick={() => void remove()}>
            <Trash size={18} aria-hidden="true" />
            {status.builtIn ? t('removeUpdate') : t('remove')}
          </button>
        )}
      </div>
    </article>
  );
}

function BibleLibraryDialog({ onClose }: { onClose: () => void }) {
  const { t } = useT();
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
    <div
      className="dialog-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={t('manageBibleLibrary')}
    >
      <section className="bible-library-dialog">
        <header>
          <div>
            <p className="bible-dialog-kicker">{t('offlineLibrary')}</p>
            <h2>{t('bibleVersions')}</h2>
          </div>
          <button type="button" className="icon-btn" aria-label={t('close')} onClick={onClose}>
            <X size={22} aria-hidden="true" />
          </button>
        </header>
        <p className="bible-dialog-hint">{t('bibleLibraryHint')}</p>
        {statuses.isLoading && <p>{t('checkingVersions')}</p>}
        {statuses.isError && (
          <div className="feed-error" role="alert">
            <p>{t('versionListUnavailable')}</p>
            <button type="button" className="btn-primary" onClick={() => void statuses.refetch()}>
              {t('retry')}
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
  focusVerse?: number;
  onScroll?: (source: HTMLElement, paneId: 'primary' | 'secondary') => void;
}

function ReaderPane({
  paneId,
  version,
  bookId,
  chapterId,
  readerScale,
  focusVerse,
  onScroll,
}: ReaderPaneProps) {
  const { t } = useT();
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

  useEffect(() => {
    if (!focusVerse || !chapterQuery.data?.some((verse) => verse.v === focusVerse)) return;
    setSelectedVerse(focusVerse);
    const frame = window.requestAnimationFrame(() => {
      const node = document.querySelector(
        `[data-pane=\"${paneId}\"] [data-verse=\"${focusVerse}\"]`,
      );
      const reduceMotion =
        window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
        document.documentElement.dataset.reduceMotion === 'true';
      node?.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [chapterQuery.data, focusVerse, paneId]);

  if (chapterQuery.isError) {
    return (
      <article className="bible-reader bible-reader-error">
        <p>
          {chapterQuery.error instanceof Error
            ? chapterQuery.error.message
            : t('versionUnavailable')}
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
            {book?.bl ?? t('bible')} {chapterId}
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
          <SpeakerHigh size={20} aria-hidden="true" /> {t('listen')}
        </button>
      </header>

      {chapterQuery.isLoading && <p className="bible-empty">{t('loadingChapter')}</p>}
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
                  aria-label={t('bookmarked')}
                />
              )}
            </button>
          </div>
        );
      })}

      {selected && (
        <BibleVerseContext
          version={version}
          bookId={bookId}
          chapterId={chapterId}
          bookLabel={book?.bl ?? t('bible')}
          verse={selected}
          books={catalogQuery.data?.books ?? []}
          relatedRefs={related}
          parallels={paralels}
          bookmarked={isBibleBookmarked({
            version,
            bookId,
            chapter: chapterId,
            verse: selected.v,
          })}
          onToggleBookmark={() =>
            toggleBibleBookmark({
              version,
              bookId,
              chapter: chapterId,
              verse: selected.v,
              label: `${book?.bl ?? t('bible')} ${chapterId}:${selected.v}`,
              text: stripBibleTags(selected.t),
            })
          }
          onRead={() => bibleTts.speak(stripBibleTags(selected.t), version)}
          onClose={() => setSelectedVerse(null)}
        />
      )}
    </article>
  );
}

export function BiblePage() {
  const { t } = useT();
  const params = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const focusVerseValue = Number(searchParams.get('v'));
  const focusVerse =
    Number.isInteger(focusVerseValue) && focusVerseValue > 0 ? focusVerseValue : undefined;
  const reading = useSyncExternalStore(
    subscribeBibleReading,
    getBibleReadingSnapshot,
    getBibleReadingSnapshot,
  );
  const tts = useSyncExternalStore(bibleTts.subscribe, bibleTts.getSnapshot, bibleTts.getSnapshot);
  const bookId = Number(params.book ?? reading.last.bookId ?? 1);
  const chapterId = Number(params.chapter ?? reading.last.chapter ?? 1);
  const [version, setVersion] = useState<BiblePackCode>(reading.last.version ?? 'b_tb');
  const libraryRequested = searchParams.get('library') === '1';
  const [libraryOpen, setLibraryOpen] = useState(libraryRequested);
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

  useEffect(() => {
    if (libraryRequested) setLibraryOpen(true);
  }, [libraryRequested]);

  const closeLibrary = () => {
    setLibraryOpen(false);
    if (!libraryRequested) return;
    const next = new URLSearchParams(searchParams);
    next.delete('library');
    setSearchParams(next, { replace: true });
  };

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
          <span>{t('bible')}</span>
          <strong>
            {book?.bl ?? t('loading')} {chapterId}
          </strong>
        </div>
        <div className="bible-header-actions">
          <Link to="/bible/search" className="icon-btn" aria-label={t('searchVerse')}>
            <MagnifyingGlass size={21} aria-hidden="true" />
          </Link>
          <button
            type="button"
            className="icon-btn"
            aria-label={t('manageBibleVersions')}
            onClick={() => setLibraryOpen(true)}
          >
            <Books size={21} aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="bible-toolbar bible-toolbar-modern">
        <label>
          <span className="visually-hidden">{t('selectBook')}</span>
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
          <span className="visually-hidden">{t('selectChapter')}</span>
          <select
            className="bible-book-select bible-chapter-select"
            value={chapterId}
            onChange={(event) => changeChapter(Number(event.target.value))}
          >
            {Array.from({ length: chapterCount || 1 }, (_, index) => index + 1).map((chapter) => (
              <option key={chapter} value={chapter}>
                {t('chapter')} {chapter}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="visually-hidden">{t('primaryVersion')}</span>
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

      <div className="bible-reader-controls" aria-label={t('readerControls')}>
        <button
          type="button"
          className={`reader-control${reading.settings.split ? ' reader-control-active' : ''}`}
          aria-pressed={reading.settings.split}
          onClick={() => updateBibleReadingSettings({ split: !reading.settings.split })}
        >
          <ArrowsOutLineHorizontal size={19} aria-hidden="true" /> {t('twoPanels')}
        </button>
        {reading.settings.split && (
          <label className="bible-secondary-version">
            <span>{t('secondPanel')}</span>
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
            {t('syncVerse')}
          </label>
        )}
        <div className="bible-font-controls" role="group" aria-label={t('bibleTextSize')}>
          <button
            type="button"
            aria-label={t('decreaseBibleText')}
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
            aria-label={t('increaseBibleText')}
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
            focusVerse={focusVerse}
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

      <nav className="bible-bottom-pager" aria-label={t('chapterNavigation')}>
        <button
          type="button"
          disabled={chapterId <= 1}
          onClick={() => changeChapter(chapterId - 1)}
        >
          <CaretLeft size={20} aria-hidden="true" /> {t('previous')}
        </button>
        <span>
          {book?.bl} {chapterId}
        </span>
        <button
          type="button"
          disabled={chapterId >= chapterCount}
          onClick={() => changeChapter(chapterId + 1)}
        >
          {t('next')} <CaretRight size={20} aria-hidden="true" />
        </button>
      </nav>

      {tts.speaking && (
        <div className="bible-tts-bar" role="status">
          <SpeakerHigh size={20} aria-hidden="true" />
          <span>{t('bibleReading')}</span>
          <button
            type="button"
            className="icon-btn"
            aria-label={tts.paused ? t('resume') : t('pause')}
            onClick={() => bibleTts.togglePause()}
          >
            {tts.paused ? <Play size={19} /> : <Pause size={19} />}
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label={t('stopReading')}
            onClick={() => bibleTts.stop()}
          >
            <Stop size={18} />
          </button>
        </div>
      )}

      {libraryOpen && <BibleLibraryDialog onClose={closeLibrary} />}
    </div>
  );
}
