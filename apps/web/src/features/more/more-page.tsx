import { Link } from 'react-router-dom';
import {
  BookOpenText,
  Newspaper,
  BookBookmark,
  Feather,
  DownloadSimple,
  Gear,
  PaperPlaneTilt,
  PencilLine,
  UserCircle,
} from '@phosphor-icons/react';
import './more.css';

const LITERATURE = [
  { kind: 'kesaksian', label: 'Kesaksian', icon: BookOpenText },
  { kind: 'warta', label: 'Manna / Warta Sejati', icon: Newspaper },
  { kind: 'renungan', label: 'Kumpulan Renungan', icon: Feather },
  { kind: 'panduan', label: 'Panduan Alkitab', icon: BookBookmark },
];

const EXTERNAL = [
  { href: 'https://tjc.org/id/pujian/pujian-padus', label: 'Pujian / Paduan Suara' },
  { href: 'https://tjc.org/id/literatur/buku', label: 'Buku' },
  { href: 'https://tjc.org/id/sabat/', label: 'Ibadah Online' },
  { href: 'https://tjc.org/id/audio-khotbah/', label: 'Audio Khotbah' },
  { href: 'https://tjc.org/id/video-khotbah/', label: 'Video Khotbah' },
];

function openExternal(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer');
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title}>
      <h2 className="section-title">{title}</h2>
      {children}
    </section>
  );
}

export function MorePage() {
  return (
    <div className="content-shell more-page">
      <h1 className="section-title">Lainnya</h1>

      <Section title="Literatur & Bacaan">
        <ul className="more-grid">
          {LITERATURE.map((item) => (
            <li key={item.kind}>
              <Link to={`/literature/${item.kind}`} className="more-card">
                <item.icon size={26} aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
        <ul className="more-grid">
          {EXTERNAL.map((item) => (
            <li key={item.href}>
              <button type="button" className="more-card" onClick={() => openExternal(item.href)}>
                <BookOpenText size={26} aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Catatan & Koleksi">
        <ul className="more-grid">
          {[
            { to: '/notes/bible', label: 'Catatan Alkitab', icon: PencilLine },
            { to: '/notes/song', label: 'Catatan Pujian', icon: PencilLine },
            { to: '/notes/faith', label: 'Catatan Iman', icon: PencilLine },
          ].map((item) => (
            <li key={item.to}>
              <Link to={item.to} className="more-card">
                <item.icon size={26} aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Unduhan & Pengaturan">
        <ul className="more-grid">
          <li>
            <button type="button" className="more-card" disabled>
              <DownloadSimple size={26} aria-hidden="true" />
              <span>Versi Alkitab & Buku Kidung</span>
            </button>
          </li>
          <li>
            <Link to="/settings" className="more-card">
              <Gear size={26} aria-hidden="true" />
              <span>Pengaturan</span>
            </Link>
          </li>
          <li>
            <Link to="/account" className="more-card">
              <UserCircle size={26} aria-hidden="true" />
              <span>Akun</span>
            </Link>
          </li>
          <li>
            <Link to="/report" className="more-card">
              <PaperPlaneTilt size={26} aria-hidden="true" />
              <span>Kirim Masukan</span>
            </Link>
          </li>
        </ul>
      </Section>
    </div>
  );
}
