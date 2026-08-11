import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CaretRight } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import { parseTrueVoiceFeed, type TrueVoiceFeed } from '@gysapp/contracts';
import { apiFetch } from '../../api/client';
import '../more/more.css';

const KINDS = ['kesaksian', 'warta', 'renungan', 'panduan'] as const;
export type LiteratureKind = (typeof KINDS)[number];

export function useLiterature(kind: LiteratureKind, enabled: boolean) {
  return useQuery<TrueVoiceFeed>({
    queryKey: ['literature', kind],
    queryFn: async ({ signal }) =>
      parseTrueVoiceFeed(await apiFetch<TrueVoiceFeed>(`/content/${kind}`, { signal })),
    staleTime: 10 * 60 * 1000,
    retry: 1,
    enabled,
  });
}

function openExternal(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer');
}

export function LiteratureFeedPage() {
  const { kind = 'kesaksian' } = useParams();
  const isKnown = (KINDS as readonly string[]).includes(kind);
  const { data, isLoading, isError, refetch } = useLiterature(kind as LiteratureKind, isKnown);

  return (
    <div className="content-shell more-page">
      <div className="bible-toolbar">
        <Link to="/more" className="icon-btn" aria-label="Kembali">
          <ArrowLeft size={22} aria-hidden="true" />
        </Link>
        <h1 className="bible-search-title">{kind}</h1>
      </div>

      {!isKnown && <p className="faith-empty">Jenis literatur tidak dikenal.</p>}

      {isLoading && <p aria-busy="true">Memuat…</p>}

      {isError && (
        <div className="feed-error" role="alert">
          <p>Literatur belum dapat dimuat.</p>
          <button type="button" className="btn-primary" onClick={() => void refetch()}>
            Coba lagi
          </button>
        </div>
      )}

      {data && (
        <ul className="truevoice-list">
          {data.items.map((item) => (
            <li key={item.url} className="truevoice-item">
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
      )}
      {data && data.items.length === 0 && <p className="faith-empty">Belum ada konten.</p>}
    </div>
  );
}
