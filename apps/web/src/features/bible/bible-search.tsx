import { useDeferredValue, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, MagnifyingGlass } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import type { BibleIndexEntry } from '@gysapp/core';
import { decodeVerseId, searchBibleIndex } from '@gysapp/core';
import { getBiblePort } from '../../data/bible/sqlite-bible-port';
import { useT } from '../../i18n';
import './bible.css';

const TESTAMENTS = [
  { value: 'all', labelKey: 'allTestaments' },
  { value: 'ot', labelKey: 'oldTestament' },
  { value: 'nt', labelKey: 'newTestament' },
] as const;

function loadSearchIndex(): Promise<BibleIndexEntry[]> {
  const port = getBiblePort();
  if ('getSearchIndex' in port) {
    return (port as { getSearchIndex(): Promise<BibleIndexEntry[]> }).getSearchIndex();
  }
  return Promise.resolve([]);
}

export function BibleSearchPage() {
  const { t } = useT();
  const [term, setTerm] = useState('');
  const [testament, setTestament] = useState<'all' | 'ot' | 'nt'>('all');
  const deferredTerm = useDeferredValue(term);

  const catalogQuery = useQuery({
    queryKey: ['bible-catalog', getBiblePort().code],
    queryFn: () => getBiblePort().loadCatalog(),
    staleTime: Infinity,
  });

  // Index 31.172 ayat di-fetch lazily hanya saat halaman pencarian dibuka.
  const indexQuery = useQuery({
    queryKey: ['bible-search-index'],
    queryFn: loadSearchIndex,
    staleTime: Infinity,
  });

  const results = useMemo(() => {
    const query = deferredTerm.trim();
    if (!query || !indexQuery.data) return [];
    const hits = searchBibleIndex(indexQuery.data, { term: query, testament });
    return hits.slice(0, 100).map((hit) => {
      const { bookId, chapterId, verseId } = decodeVerseId(hit.entry.id);
      const book = catalogQuery.data?.books.find((b) => b.id === bookId);
      return {
        bookId,
        chapterId,
        verseId,
        title: `${book?.bl ?? bookId} ${chapterId}:${verseId}`,
        text: hit.entry.t,
        ranges: hit.ranges,
      };
    });
  }, [deferredTerm, testament, indexQuery.data, catalogQuery.data]);

  const searching = deferredTerm.trim() !== '' && indexQuery.isLoading;

  return (
    <div className="content-shell bible-page">
      <div className="bible-toolbar">
        <Link to="/bible" className="icon-btn" aria-label={t('returnToBible')}>
          <ArrowLeft size={22} aria-hidden="true" />
        </Link>
        <h1 className="bible-search-title">{t('searchVerseTitle')}</h1>
      </div>

      <div className="bible-search-form" role="search">
        <MagnifyingGlass size={22} aria-hidden="true" />
        <input
          className="bible-search-input"
          type="search"
          value={term}
          placeholder={t('searchWordsPlaceholder')}
          onChange={(e) => setTerm(e.target.value)}
          autoFocus
        />
      </div>

      <div className="bible-testament-tabs" role="group" aria-label={t('bibleSectionFilter')}>
        {TESTAMENTS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`chip${testament === option.value ? ' chip-active' : ''}`}
            aria-pressed={testament === option.value}
            onClick={() => setTestament(option.value)}
          >
            {t(option.labelKey)}
          </button>
        ))}
      </div>

      <p className="bible-search-hint">{t('bibleSearchScopeHint')}</p>

      {searching && <p aria-busy="true">{t('preparingSearchIndex')}</p>}

      {indexQuery.isError && (
        <div className="feed-error" role="alert">
          <p>{t('bibleIndexUnavailable')}</p>
        </div>
      )}

      {results.length > 0 ? (
        <ul className="bible-results">
          {results.map((r) => (
            <li key={`${r.bookId}:${r.chapterId}:${r.verseId}`}>
              <Link to={`/bible/${r.bookId}/${r.chapterId}`} className="bible-result">
                <strong>{r.title}</strong>
                <p>
                  <HighlightedText text={r.text} ranges={r.ranges} />
                </p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        !searching &&
        deferredTerm.trim() !== '' && <p className="bible-empty">{t('noMatchingVerses')}</p>
      )}
    </div>
  );
}

function HighlightedText({
  text,
  ranges,
}: {
  text: string;
  ranges: Array<{ start: number; end: number }>;
}) {
  const parts: Array<{ text: string; highlight: boolean }> = [];
  let cursor = 0;
  for (const range of ranges) {
    if (range.start > cursor)
      parts.push({ text: text.slice(cursor, range.start), highlight: false });
    parts.push({ text: text.slice(range.start, range.end), highlight: true });
    cursor = range.end;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), highlight: false });
  return (
    <>
      {parts.map((part, i) =>
        part.highlight ? <mark key={i}>{part.text}</mark> : <span key={i}>{part.text}</span>,
      )}
    </>
  );
}
