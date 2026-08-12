import { useDeferredValue, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpenText, Check, CopySimple, ShareNetwork, X } from '@phosphor-icons/react';
import { parseFaithData, type FaithLanguage } from '@gysapp/contracts';
import { searchFaith } from '@gysapp/core';
import { useT } from '../../i18n';
import faithRaw from '../../data/faith.json';
import './faith.css';

const DATA = parseFaithData(faithRaw);

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="icon-btn faith-copy"
      aria-label={label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          // Clipboard tidak selalu tersedia (mis. non-secure context); seleksi manual tetap mungkin.
        }
      }}
    >
      {copied ? (
        <Check size={18} aria-hidden="true" />
      ) : (
        <CopySimple size={18} aria-hidden="true" />
      )}
    </button>
  );
}

export function FaithPage() {
  const { t } = useT();
  const [lang, setLang] = useState('ID');
  const [term, setTerm] = useState('');
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [selectionStatus, setSelectionStatus] = useState<string | null>(null);
  const deferredTerm = useDeferredValue(term);

  const language: FaithLanguage | undefined = useMemo(
    () => DATA.faith.find((f) => f.language === lang) ?? DATA.faith[0],
    [lang],
  );

  const hits = useMemo(
    () => (language ? searchFaith(language.content, deferredTerm) : []),
    [language, deferredTerm],
  );

  const points = deferredTerm.trim() ? hits.map((h) => h.point) : (language?.content ?? []);
  const selectedPoints = useMemo(
    () => language?.content.filter((point) => selected.has(point.number)) ?? [],
    [language, selected],
  );
  const selectionText = selectedPoints
    .map((point) => `${point.number}. ${point.text}`)
    .join('\n\n');
  const allVisibleSelected =
    points.length > 0 && points.every((point) => selected.has(point.number));

  const togglePoint = (number: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(number)) next.delete(number);
      else next.add(number);
      return next;
    });
    setSelectionStatus(null);
  };

  const toggleVisible = () => {
    setSelected((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        for (const point of points) next.delete(point.number);
      } else {
        for (const point of points) next.add(point.number);
      }
      return next;
    });
    setSelectionStatus(null);
  };

  const copySelection = async () => {
    if (!selectionText) return;
    try {
      await navigator.clipboard.writeText(selectionText);
      setSelectionStatus(`${selectedPoints.length} ${t('faithPointsCopied')}`);
    } catch {
      setSelectionStatus(t('clipboardUnavailable'));
    }
  };

  const shareSelection = async () => {
    if (!selectionText) return;
    const title = language?.title ?? t('faith');
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, text: selectionText });
        setSelectionStatus(`${selectedPoints.length} ${t('faithPointsShared')}`);
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }
    await copySelection();
  };

  return (
    <div className="content-shell faith-page">
      <h1 className="section-title">{language?.title}</h1>

      <div className="faith-toolbar">
        <div className="faith-lang-tabs" role="group" aria-label={t('language')}>
          {DATA.faith.map((f) => (
            <button
              key={f.language}
              type="button"
              className={`chip${lang === f.language ? ' chip-active' : ''}`}
              aria-pressed={lang === f.language}
              onClick={() => {
                setLang(f.language);
                setSelected(new Set());
                setSelectionStatus(null);
              }}
            >
              {f.language}
            </button>
          ))}
        </div>
        <input
          className="faith-search"
          type="search"
          value={term}
          placeholder={`${t('searchFaith')}…`}
          aria-label={t('searchFaith')}
          onChange={(e) => setTerm(e.target.value)}
        />
      </div>

      <div className="faith-selection-toolbar" aria-label={t('faithSelection')}>
        <button
          type="button"
          className="btn-text"
          onClick={toggleVisible}
          disabled={points.length === 0}
        >
          {allVisibleSelected ? t('clearResultSelection') : t('selectAllResults')}
        </button>
        {selectedPoints.length > 0 && (
          <div className="faith-selection-actions">
            <strong>
              {selectedPoints.length} {t('selected')}
            </strong>
            <button type="button" className="btn-text" onClick={() => void copySelection()}>
              <CopySimple size={18} aria-hidden="true" /> {t('copySelection')}
            </button>
            <button type="button" className="btn-text" onClick={() => void shareSelection()}>
              <ShareNetwork size={18} aria-hidden="true" /> {t('share')}
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label={t('clearAllSelection')}
              onClick={() => {
                setSelected(new Set());
                setSelectionStatus(null);
              }}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
      {selectionStatus && (
        <p className="faith-selection-status" role="status" aria-live="polite">
          {selectionStatus}
        </p>
      )}

      <ol className="faith-list">
        {points.map((point) => {
          const isSelected = selected.has(point.number);
          return (
            <li
              key={point.number}
              className={`faith-item${isSelected ? ' faith-item-selected' : ''}`}
            >
              <label className="faith-select">
                <input
                  type="checkbox"
                  checked={isSelected}
                  aria-label={`${t('faithSelection')} ${point.number}`}
                  onChange={() => togglePoint(point.number)}
                />
              </label>
              <span className="faith-number">{point.number}</span>
              <div className="faith-body">
                <p className="faith-text">{point.text}</p>
                <Link to={`/faith/${point.number}/pdf`} className="btn-text">
                  <BookOpenText size={18} aria-hidden="true" /> {t('readMoreFaith')}
                </Link>
              </div>
              <CopyButton text={`${point.number}. ${point.text}`} label={t('copyFaith')} />
            </li>
          );
        })}
      </ol>
      {points.length === 0 && deferredTerm.trim() !== '' && (
        <p className="faith-empty">{t('noFaithResults')}</p>
      )}
    </div>
  );
}
