import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CaretLeft, CaretRight } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import { stripBibleTags } from '@gysapp/core';
import { fixtureBiblePort } from '../../data/bible/fixture-bible-port';
import './bible.css';

export function BiblePage() {
  const params = useParams();
  const navigate = useNavigate();
  const bookId = Number(params.book ?? '1');
  const chapterId = Number(params.chapter ?? '1');

  const catalogQuery = useQuery({
    queryKey: ['bible-catalog', fixtureBiblePort.code],
    queryFn: () => fixtureBiblePort.loadCatalog(),
    staleTime: Infinity,
  });

  const chapterQuery = useQuery({
    queryKey: ['bible-chapter', fixtureBiblePort.code, bookId, chapterId],
    queryFn: () => fixtureBiblePort.loadChapter(bookId, chapterId),
    staleTime: Infinity,
  });

  const pericopeQuery = useQuery({
    queryKey: ['bible-pericopes', fixtureBiblePort.code, bookId, chapterId],
    queryFn: () => fixtureBiblePort.loadPericopes(bookId, chapterId),
    staleTime: Infinity,
  });

  const book = useMemo(
    () => catalogQuery.data?.books.find((b) => b.id === bookId),
    [catalogQuery.data, bookId],
  );
  const chapterCount = catalogQuery.data?.chapterCounts.filter((e) => e.b === bookId).length ?? 0;

  if (catalogQuery.isLoading) return <div className="content-shell">Memuat katalog…</div>;

  const chapter = chapterQuery.data;
  const pericopes = pericopeQuery.data;

  return (
    <div className="content-shell bible-page">
      <div className="bible-toolbar">
        <label>
          <span className="visually-hidden">Pilih kitab</span>
          <select
            className="bible-book-select"
            value={bookId}
            onChange={(e) => navigate(`/bible/${e.target.value}/1`)}
          >
            {catalogQuery.data?.books.map((b) => (
              <option key={b.id} value={b.id}>
                {b.bl}
              </option>
            ))}
          </select>
        </label>
        <div className="bible-chapter-nav" role="group" aria-label="Navigasi pasal">
          <button
            type="button"
            className="icon-btn"
            aria-label="Pasal sebelumnya"
            disabled={chapterId <= 1}
            onClick={() => navigate(`/bible/${bookId}/${chapterId - 1}`)}
          >
            <CaretLeft size={22} aria-hidden="true" />
          </button>
          <span className="bible-chapter-label">
            {book?.bl} {chapterId}
          </span>
          <button
            type="button"
            className="icon-btn"
            aria-label="Pasal berikutnya"
            disabled={chapterId >= chapterCount}
            onClick={() => navigate(`/bible/${bookId}/${chapterId + 1}`)}
          >
            <CaretRight size={22} aria-hidden="true" />
          </button>
        </div>
        <Link to="/bible/search" className="btn-text">
          Cari ayat
        </Link>
      </div>

      <article className="bible-reader">
        <h1 className="bible-reader-title">
          {book?.bl} {chapterId}
        </h1>
        {pericopes?.map((p) => (
          <p key={p.id} className="bible-pericope">
            {p.t}
          </p>
        ))}
        {chapter?.map((verse) => (
          <p key={verse.id} className="bible-verse">
            <sup className="bible-verse-num">{verse.v}</sup>
            {stripBibleTags(verse.t)}
          </p>
        ))}
        {chapter === null && chapterQuery.isSuccess && (
          <p className="bible-empty">Pasal ini belum tersedia pada paket demo (4 pasal).</p>
        )}
      </article>
    </div>
  );
}
