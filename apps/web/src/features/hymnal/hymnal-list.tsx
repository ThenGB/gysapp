import { useDeferredValue, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MusicNotes, MagnifyingGlass } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import { hymnalCatalog } from '../../data/hymnal/hymnal-catalog';
import { PlaylistBar } from './playlist-bar';
import './song-viewer.css';

export function HymnalListPage() {
  const [book, setBook] = useState('KR');
  const [term, setTerm] = useState('');
  const deferredTerm = useDeferredValue(term);

  const booksQuery = useQuery({
    queryKey: ['hymnal-books'],
    queryFn: () => hymnalCatalog.loadBooks(),
  });
  const songsQuery = useQuery({
    queryKey: ['hymnal-songs', book],
    queryFn: () => hymnalCatalog.loadSongs(book),
    staleTime: Infinity,
  });

  const songs = useMemo(() => {
    const query = deferredTerm.trim().toLowerCase();
    if (!songsQuery.data) return [];
    if (!query) return songsQuery.data;
    return songsQuery.data.filter(
      (s) =>
        s.number.includes(query) ||
        (s.number2 ?? '').includes(query) ||
        s.title.toLowerCase().includes(query),
    );
  }, [songsQuery.data, deferredTerm]);

  return (
    <div className="content-shell song-page">
      <h1 className="section-title">Pujian</h1>

      <div className="bible-testament-tabs" role="group" aria-label="Pilih buku kidung">
        {booksQuery.data?.map((b) => (
          <button
            key={b.code}
            type="button"
            className={`chip${book === b.code ? ' chip-active' : ''}`}
            aria-pressed={book === b.code}
            onClick={() => setBook(b.code)}
          >
            {b.code}
          </button>
        ))}
      </div>

      <div className="bible-search-form" role="search">
        <MagnifyingGlass size={22} aria-hidden="true" />
        <input
          className="bible-search-input"
          type="search"
          value={term}
          placeholder={`Cari di ${book} (nomor / judul / lirik)…`}
          aria-label="Cari pujian"
          onChange={(e) => setTerm(e.target.value)}
        />
      </div>

      <ul className="hymnal-list">
        {songs.map((s) => (
          <li key={`${book}:${s.number}`}>
            <Link to={`/hymnal/${book}/${s.number}`} className="hymnal-item">
              <MusicNotes size={24} aria-hidden="true" />
              <span className="hymnal-item-title">
                {s.number}
                {s.number2 ? `/${s.number2}` : ''} — {s.title}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {songs.length === 0 && <p className="faith-empty">Tidak ditemukan pujian yang cocok.</p>}

      {booksQuery.data && (
        <PlaylistBar
          song={
            songs.length === 1
              ? { book, number: songs[0]?.number ?? '', title: songs[0]?.title ?? '' }
              : undefined
          }
        />
      )}
    </div>
  );
}
