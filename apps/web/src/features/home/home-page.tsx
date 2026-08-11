import { useQueryErrorResetBoundary } from '@tanstack/react-query';
import { CaretRight, CloudSlash, Newspaper } from '@phosphor-icons/react';
import { useSauh, useSuaraSejati } from '../../api/content';
import './home-page.css';

function openExternal(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer');
}

function Greeting({ date }: { date: Date }) {
  const formatted = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
  return (
    <header className="home-greeting">
      <h1>Shalom</h1>
      <p>{formatted}</p>
    </header>
  );
}

function SauhCard({ date }: { date: Date }) {
  const { data, isLoading, isError, isFetching, refetch } = useSauh(date);
  const { reset } = useQueryErrorResetBoundary();

  if (isLoading) {
    return (
      <section className="sauh-card" aria-busy="true">
        <div className="skeleton sauh-skeleton-title" />
        <div className="skeleton sauh-skeleton-line" />
        <div className="skeleton sauh-skeleton-line short" />
      </section>
    );
  }

  if (isError || !data?.items.length) {
    return (
      <section className="sauh-card sauh-error" role="alert">
        <CloudSlash size={28} aria-hidden="true" />
        <p>Sauh Bagi Jiwa belum dapat dimuat.</p>
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            reset();
            void refetch();
          }}
        >
          Coba lagi
        </button>
      </section>
    );
  }

  const today = data.items[0];
  return (
    <section className="sauh-card" aria-label="Sauh Bagi Jiwa">
      {isFetching && <span className="refreshing-badge">memperbarui…</span>}
      <p className="sauh-kicker">SAUH BAGI JIWA</p>
      {today?.imageUrl && <img className="sauh-image" src={today.imageUrl} alt="" loading="lazy" />}
      <h2 className="sauh-title">{today?.title}</h2>
      <p className="sauh-excerpt">{today?.excerpt}</p>
      {today && (
        <button type="button" className="btn-text" onClick={() => openExternal(today.url)}>
          Baca selengkapnya <CaretRight size={18} aria-hidden="true" />
        </button>
      )}
    </section>
  );
}

function SuaraSejatiSection({ date }: { date: Date }) {
  void date;
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
          <p>Suara Sejati belum dapat dimuat.</p>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              reset();
              void refetch();
            }}
          >
            Coba lagi
          </button>
        </div>
      )}
      {data && (
        <>
          {isFetching && <span className="refreshing-badge">memperbarui…</span>}
          <ul className="truevoice-list">
            {data.items.map((item) => (
              <li key={item.url} className="truevoice-item">
                {item.imageUrl && (
                  <img className="truevoice-thumb" src={item.imageUrl} alt="" loading="lazy" />
                )}
                <div className="truevoice-body">
                  <h3 className="truevoice-title">{item.title}</h3>
                  {item.description && <p className="truevoice-desc">{item.description}</p>}
                  <button type="button" className="btn-text" onClick={() => openExternal(item.url)}>
                    Buka <CaretRight size={18} aria-hidden="true" />
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
  const today = new Date();
  return (
    <div className="content-shell home-page">
      <Greeting date={today} />
      <SauhCard date={today} />
      <SuaraSejatiSection date={today} />
      <p className="home-offline-note">
        <Newspaper size={16} aria-hidden="true" />
        Konten terbaru otomatis disimpan untuk dibaca saat offline.
      </p>
    </div>
  );
}
