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
import { assetUrl } from '../../lib/asset-url';
import {
  getBibleReadingSnapshot,
  subscribeBibleReading,
} from '../bible/bible-reading-store';
import './home-page.css';

function openExternal(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer');
}

function Greeting({ date }: { date: Date }) {
  const formatted = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(date);
  return (
    <header className="home-greeting">
      <div className="home-brand-mark"><img src={assetUrl('/brand/tjc-logo-indonesia-color.png')} alt="" /></div>
      <div><h1>Shalom</h1><p>{formatted}</p></div>
    </header>
  );
}

function QuickStart() {
  const reading = useSyncExternalStore(
    subscribeBibleReading,
    getBibleReadingSnapshot,
    getBibleReadingSnapshot,
  );
  const last = reading.last;
  return (
    <section className="home-start" aria-label="Akses cepat">
      <div className="home-section-head"><div><span>Lanjutkan terakhir</span><h2>Alkitab</h2></div></div>
      <Link className="continue-card" to={`/bible/${last.bookId}/${last.chapter}`}>
        <BookOpenText size={30} aria-hidden="true" />
        <span><strong>Lanjutkan bacaan</strong><small>Kitab {last.bookId} • Pasal {last.chapter}</small></span>
        <CaretRight size={21} aria-hidden="true" />
      </Link>
      <div className="home-shortcuts">
        <Link to={`/bible/${last.bookId}/${last.chapter}`}><BookOpenText size={27} /><span>Alkitab</span></Link>
        <Link to="/hymnal"><MusicNotes size={27} /><span>Pujian</span></Link>
        <Link to="/account"><GlobeHemisphereWest size={27} /><span>e-GYS</span></Link>
      </div>
    </section>
  );
}

function SauhCard({ date }: { date: Date }) {
  const { data, isLoading, isError, isFetching, refetch } = useSauh(date);
  const { reset } = useQueryErrorResetBoundary();
  if (isLoading) return <section className="sauh-card" aria-busy="true"><div className="skeleton sauh-skeleton-title" /><div className="skeleton sauh-skeleton-line" /><div className="skeleton sauh-skeleton-line short" /></section>;
  if (isError || !data?.items.length) return (
    <section className="sauh-card sauh-error" role="alert"><CloudSlash size={28} /><p>Sauh Bagi Jiwa belum dapat dimuat.</p>
      <button type="button" className="btn-primary" onClick={() => { reset(); void refetch(); }}>Coba lagi</button></section>
  );
  const today = data.items[0];
  return (
    <section className="sauh-card" aria-label="Sauh Bagi Jiwa">
      {isFetching && <span className="refreshing-badge">memperbarui…</span>}
      <p className="sauh-kicker">SAUH BAGI JIWA</p>
      {today?.imageUrl && <img className="sauh-image" src={today.imageUrl} alt="" loading="lazy" />}
      <h2 className="sauh-title">{today?.title}</h2><p className="sauh-excerpt">{today?.excerpt}</p>
      {today && <button type="button" className="btn-text" onClick={() => openExternal(today.url)}>Baca selengkapnya <CaretRight size={18} /></button>}
    </section>
  );
}

function SuaraSejatiSection() {
  const { data, isLoading, isError, isFetching, refetch } = useSuaraSejati();
  const { reset } = useQueryErrorResetBoundary();
  return (
    <section aria-label="Suara Sejati">
      <h2 className="section-title">Suara Sejati</h2>
      {isLoading && <ul className="truevoice-list" aria-busy="true">{[0, 1, 2].map((i) => <li key={i} className="truevoice-item"><div className="skeleton thumb" /><div className="truevoice-body"><div className="skeleton line" /><div className="skeleton line short" /></div></li>)}</ul>}
      {isError && !data && <div className="feed-error" role="alert"><p>Suara Sejati belum dapat dimuat.</p><button type="button" className="btn-primary" onClick={() => { reset(); void refetch(); }}>Coba lagi</button></div>}
      {data && <>{isFetching && <span className="refreshing-badge">memperbarui…</span>}<ul className="truevoice-list">{data.items.map((item) => <li key={item.url} className="truevoice-item">{item.imageUrl && <img className="truevoice-thumb" src={item.imageUrl} alt="" loading="lazy" />}<div className="truevoice-body"><h3 className="truevoice-title">{item.title}</h3>{item.description && <p className="truevoice-desc">{item.description}</p>}<button type="button" className="btn-text" onClick={() => openExternal(item.url)}>Buka <CaretRight size={18} /></button></div></li>)}</ul></>}
    </section>
  );
}

export function HomePage() {
  const today = new Date();
  return <div className="content-shell home-page"><Greeting date={today} /><QuickStart /><h2 className="section-title">Renungan hari ini</h2><SauhCard date={today} /><SuaraSejatiSection /><p className="home-offline-note"><Newspaper size={16} />Konten terbaru otomatis disimpan untuk dibaca saat offline.</p></div>;
}
