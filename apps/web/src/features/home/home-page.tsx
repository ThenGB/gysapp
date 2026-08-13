import { useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import { useQueryErrorResetBoundary } from '@tanstack/react-query';
import {
  BookOpenText,
  CaretRight,
  CloudSlash,
  GlobeHemisphereWest,
  MusicNotes,
  Newspaper,
} from '@phosphor-icons/react';
import { useSauh, useSuaraSejati } from '../../api/content';
import { useT } from '../../i18n';
import { assetUrl } from '../../lib/asset-url';
import { openExternalUrl } from '../../platform/open-external';
import { getBibleReadingSnapshot, subscribeBibleReading } from '../bible/bible-reading-store';
import { useHymnalRecent } from '../hymnal/hymnal-recent-store';
import './home-page.css';

const DATE_LOCALE = {
  id: 'id-ID',
  en: 'en-US',
  zh: 'zh-CN',
} as const;

function Greeting({ date }: { date: Date }) {
  const { locale, t } = useT();
  const formatted = new Intl.DateTimeFormat(DATE_LOCALE[locale], {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
  return (
    <header className="home-greeting">
      <div className="home-brand-mark">
        <img src={assetUrl('/brand/tjc-logo-indonesia-color.png')} alt="" />
      </div>
      <div>
        <h1>{t('shalom')}</h1>
        <p>{formatted}</p>
      </div>
    </header>
  );
}

function QuickStart() {
  const { t } = useT();
  const reading = useSyncExternalStore(
    subscribeBibleReading,
    getBibleReadingSnapshot,
    getBibleReadingSnapshot,
  );
  const recentHymns = useHymnalRecent();
  const last = reading.last;
  const matchingHistory = reading.history.find(
    (entry) =>
      entry.version === last.version &&
      entry.bookId === last.bookId &&
      entry.chapter === last.chapter,
  );
  const bibleLabel =
    matchingHistory?.label ??
    (last.bookId === 1
      ? `Kejadian ${last.chapter}`
      : `${t('book')} ${last.bookId} • ${t('chapter')} ${last.chapter}`);
  const bibleTarget = `/bible/${last.bookId}/${last.chapter}${last.verse ? `?v=${last.verse}` : ''}`;
  const recentHymn = recentHymns[0] ?? null;

  return (
    <section className="home-start" aria-label={t('quickAccess')}>
      <div className="home-section-head">
        <div>
          <span>{t('continueLast')}</span>
          <h2>{t('readingAndHymns')}</h2>
        </div>
      </div>
      <div className="home-continue-list">
        <Link
          className="continue-card"
          to={bibleTarget}
          aria-label={`${t('continueReading')}: ${bibleLabel}`}
        >
          <BookOpenText size={30} aria-hidden="true" />
          <span>
            <strong>{t('continueReading')}</strong>
            <small>{bibleLabel}</small>
          </span>
          <CaretRight size={21} aria-hidden="true" />
        </Link>
        {recentHymn && (
          <Link
            className="continue-card"
            to={`/hymnal/${encodeURIComponent(recentHymn.book)}/${encodeURIComponent(recentHymn.song)}`}
            aria-label={`${t('continueHymn')}: ${recentHymn.title}`}
          >
            <MusicNotes size={30} aria-hidden="true" />
            <span>
              <strong>{t('continueHymn')}</strong>
              <small>{recentHymn.title}</small>
            </span>
            <CaretRight size={21} aria-hidden="true" />
          </Link>
        )}
      </div>
      <div className="home-shortcuts">
        <Link to={bibleTarget}>
          <BookOpenText size={27} />
          <span>{t('bible')}</span>
        </Link>
        <Link to="/hymnal">
          <MusicNotes size={27} />
          <span>{t('hymnal')}</span>
        </Link>
        <Link to="/account">
          <GlobeHemisphereWest size={27} />
          <span>e-GYS</span>
        </Link>
      </div>
    </section>
  );
}

function SauhCard({ date }: { date: Date }) {
  const { t } = useT();
  const { data, isLoading, isError, isFetching, refetch } = useSauh(date);
  const { reset } = useQueryErrorResetBoundary();
  if (isLoading)
    return (
      <section className="sauh-card" aria-busy="true">
        <div className="skeleton sauh-skeleton-title" />
        <div className="skeleton sauh-skeleton-line" />
        <div className="skeleton sauh-skeleton-line short" />
      </section>
    );
  if (isError || !data?.items.length)
    return (
      <section className="sauh-card sauh-error" role="alert">
        <CloudSlash size={28} />
        <p>{t('sauhUnavailable')}</p>
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            reset();
            void refetch();
          }}
        >
          {t('retry')}
        </button>
      </section>
    );
  const today = data.items[0];
  return (
    <section className="sauh-card" aria-label="Sauh Bagi Jiwa">
      {isFetching && <span className="refreshing-badge">{t('refreshing')}</span>}
      <p className="sauh-kicker">SAUH BAGI JIWA</p>
      {today?.imageUrl && <img className="sauh-image" src={today.imageUrl} alt="" loading="lazy" />}
      <h2 className="sauh-title">{today?.title}</h2>
      <p className="sauh-excerpt">{today?.excerpt}</p>
      {today && (
        <button type="button" className="btn-text" onClick={() => void openExternalUrl(today.url)}>
          {t('readMore')} <CaretRight size={18} />
        </button>
      )}
    </section>
  );
}

function SuaraSejatiSection() {
  const { t } = useT();
  const { data, isLoading, isError, isFetching, refetch } = useSuaraSejati();
  const { reset } = useQueryErrorResetBoundary();
  return (
    <section aria-label="Suara Sejati">
      <h2 className="section-title">Suara Sejati</h2>
      {isLoading && (
        <ul className="truevoice-list" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <li key={i} className="truevoice-item">
              <div className="skeleton thumb" />
              <div className="truevoice-body">
                <div className="skeleton line" />
                <div className="skeleton line short" />
              </div>
            </li>
          ))}
        </ul>
      )}
      {isError && !data && (
        <div className="feed-error" role="alert">
          <p>{t('trueVoiceUnavailable')}</p>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              reset();
              void refetch();
            }}
          >
            {t('retry')}
          </button>
        </div>
      )}
      {data && (
        <>
          {isFetching && <span className="refreshing-badge">{t('refreshing')}</span>}
          <ul className="truevoice-list">
            {data.items.map((item) => (
              <li key={item.url} className="truevoice-item">
                {item.imageUrl && (
                  <img className="truevoice-thumb" src={item.imageUrl} alt="" loading="lazy" />
                )}
                <div className="truevoice-body">
                  <h3 className="truevoice-title">{item.title}</h3>
                  {item.description && <p className="truevoice-desc">{item.description}</p>}
                  <button
                    type="button"
                    className="btn-text"
                    onClick={() => void openExternalUrl(item.url)}
                  >
                    {t('open')} <CaretRight size={18} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

export function HomePage() {
  const { t } = useT();
  const today = new Date();
  return (
    <div className="content-shell home-page">
      <Greeting date={today} />
      <QuickStart />
      <h2 className="section-title">{t('todayDevotion')}</h2>
      <SauhCard date={today} />
      <SuaraSejatiSection />
      <p className="home-offline-note">
        <Newspaper size={16} />
        {t('offlineContentNote')}
      </p>
    </div>
  );
}
