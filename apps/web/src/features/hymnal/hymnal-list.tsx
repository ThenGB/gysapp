import { Link } from 'react-router-dom';
import { MusicNotes } from '@phosphor-icons/react';
import './song-viewer.css';

/** Daftar pujian demo. Versi final: katalog dari index JSON + asset manager. */
const DEMO_SONGS = [{ book: 'KR', number: '001', title: 'Pujilah Allah Yang Maha Esa' }];

export function HymnalListPage() {
  return (
    <div className="content-shell song-page">
      <h1 className="section-title">Pujian</h1>
      <ul className="hymnal-list">
        {DEMO_SONGS.map((s) => (
          <li key={`${s.book}:${s.number}`}>
            <Link to={`/hymnal/${s.book}/${s.number}`} className="hymnal-item">
              <MusicNotes size={24} aria-hidden="true" />
              <span className="hymnal-item-title">
                {s.number} — {s.title}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="song-empty-sub">
        Paket demo: 1 lagu. Katalog penuh menyusul bersama asset manager.
      </p>
    </div>
  );
}
