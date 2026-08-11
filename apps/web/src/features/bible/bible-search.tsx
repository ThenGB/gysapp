import { useDeferredValue, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, MagnifyingGlass } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import type { BibleVerse } from '@gysapp/contracts';
import { matchesTestamentFilter, searchChapter } from '@gysapp/core';
import { FIXTURE_CHAPTERS, fixtureBiblePort } from '../../data/bible/fixture-bible-port';
import './bible.css';

const TESTAMENTS = [
  { value: 'all', label: 'Semua' },
  { value: 'ot', label: 'Perjanjian Lama' },
  { value: 'nt', label: 'Perjanjian Baru' },
] as const;

export function BibleSearchPage() {
  const [term, setTerm] = useState('');
  const [testament, setTestament] = useState<'all' | 'ot' | 'nt'>('all');
  const deferredTerm = useDeferredValue(term);

  const catalogQuery = useQuery({
    queryKey: ['bible-catalog', fixtureBiblePort.code],
    queryFn: () => fixtureBiblePort.loadCatalog(),
    staleTime: Infinity,
  });

  // Paket demo: scan pasal yang tersedia. Versi final memakai index di worker.
  const results = useMemo(() => {
    const query = deferredTerm.trim();
    if (!query || !catalogQuery.data) return [];
    const out: Array<{
      bookId: number;
      chapterId: number;
      verseId: number;
      title: string;
      text: string;
      ranges: Array<{ start: number; end: number }>;
    }> = [];
    for (const entry of catalogQuery.data.chapterCounts) {
      if (!matchesTestamentFilter(entry.b, testament)) continue;
      const chapter = FIXTURE_CHAPTERS[`${entry.b}:${entry.c}`];
      if (!chapter) continue;
      const book = catalogQuery.data.books.find((b) => b.id === entry.b);
      for (const hit of searchChapter(chapter as BibleVerse[], { term: query, testament: 'all' })) {
        out.push({
          bookId: entry.b,
          chapterId: entry.c,
          verseId: hit.verse.v,
          title: `${book?.bl} ${entry.c}:${hit.verse.v}`,
          text: hit.text,
          ranges: hit.ranges,
        });
      }
    }
    return out.slice(0, 100);
  }, [deferredTerm, testament, catalogQuery.data]);

  return (
    <div className="content-shell bible-page">
      <div className="bible-toolbar">
        <Link to="/bible" className="icon-btn" aria-label="Kembali ke Alkitab">
          <ArrowLeft size={22} aria-hidden="true" />
        </Link>
        <h1 className="bible-search-title">Cari Ayat</h1>
      </div>

      <div className="bible-search-form" role="search">
        <MagnifyingGlass size={22} aria-hidden="true" />
        <input
          className="bible-search-input"
          type="search"
          value={term}
          placeholder="Cari kata atau frasa…"
          onChange={(e) => setTerm(e.target.value)}
          autoFocus
        />
      </div>

      <div className="bible-testament-tabs" role="group" aria-label="Filter bagian kitab">
        {TESTAMENTS.map((t) => (
          <button
            key={t.value}
            type="button"
            className={`chip${testament === t.value ? ' chip-active' : ''}`}
            aria-pressed={testament === t.value}
            onClick={() => setTestament(t.value)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <p className="bible-search-hint">Pencarian berjalan pada paket demo (4 pasal).</p>

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
        deferredTerm.trim() !== '' && (
          <p className="bible-empty">Tidak ditemukan ayat yang cocok.</p>
        )
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
