import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CaretRight } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import { parseTrueVoiceFeed, type TrueVoiceFeed } from '@gysapp/contracts';
import { apiFetch } from '../../api/client';
import { contentSource, fetchStaticContent } from '../../api/static-content';
import { useT, type TranslationKey } from '../../i18n';
import { openExternalUrl } from '../../platform/open-external';
import '../more/more.css';

const KINDS = ['kesaksian', 'warta', 'renungan', 'panduan'] as const;
export type LiteratureKind = (typeof KINDS)[number];

const KIND_TITLES: Record<LiteratureKind, TranslationKey> = {
  kesaksian: 'literatureWitness',
  warta: 'literatureWarta',
  renungan: 'literatureDevotion',
  panduan: 'literatureGuide',
};

export function useLiterature(kind: LiteratureKind, enabled: boolean) {
  return useQuery<TrueVoiceFeed>({
    queryKey: ['literature', kind, contentSource()],
    queryFn: async ({ signal }) => {
      const raw =
        contentSource() === 'gateway'
          ? await apiFetch<TrueVoiceFeed>(`/content/${kind}`, { signal })
          : await fetchStaticContent<TrueVoiceFeed>(kind);
      return parseTrueVoiceFeed(raw);
    },
    staleTime: 10 * 60 * 1000,
    retry: 1,
    enabled,
  });
}

export function LiteratureFeedPage() {
  const { t } = useT();
  const { kind = 'kesaksian' } = useParams();
  const isKnown = (KINDS as readonly string[]).includes(kind);
  const literatureKind = isKnown ? (kind as LiteratureKind) : null;
  const { data, isLoading, isError, refetch } = useLiterature(
    (literatureKind ?? 'kesaksian') as LiteratureKind,
    isKnown,
  );
  const title = literatureKind ? t(KIND_TITLES[literatureKind]) : t('more');

  return (
    <div className="content-shell more-page">
      <div className="bible-toolbar">
        <Link to="/more" className="icon-btn" aria-label={t('back')}>
          <ArrowLeft size={22} aria-hidden="true" />
        </Link>
        <h1 className="bible-search-title">{title}</h1>
      </div>

      {!isKnown && <p className="faith-empty">{t('unknownLiterature')}</p>}

      {isLoading && <p aria-busy="true">{t('loading')}</p>}

      {isError && (
        <div className="feed-error" role="alert">
          <p>{t('literatureUnavailable')}</p>
          <button type="button" className="btn-primary" onClick={() => void refetch()}>
            {t('retry')}
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
                <button
                  type="button"
                  className="btn-text"
                  onClick={() => void openExternalUrl(item.url)}
                >
                  {t('open')} <CaretRight size={18} aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {data && data.items.length === 0 && <p className="faith-empty">{t('noContent')}</p>}
    </div>
  );
}
