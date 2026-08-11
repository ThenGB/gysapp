import { useDeferredValue, useMemo, useState } from 'react';
import { CopySimple, Check } from '@phosphor-icons/react';
import { parseFaithData, type FaithLanguage } from '@gysapp/contracts';
import { searchFaith } from '@gysapp/core';
import faithRaw from '../../data/faith.json';
import './faith.css';

const DATA = parseFaithData(faithRaw);

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="icon-btn faith-copy"
      aria-label="Salin pokok iman"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          // clipboard tidak tersedia (http): fallback seleksi manual
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
  const [lang, setLang] = useState('ID');
  const [term, setTerm] = useState('');
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

  return (
    <div className="content-shell faith-page">
      <h1 className="section-title">{language?.title}</h1>

      <div className="faith-toolbar">
        <div className="faith-lang-tabs" role="group" aria-label="Bahasa">
          {DATA.faith.map((f) => (
            <button
              key={f.language}
              type="button"
              className={`chip${lang === f.language ? ' chip-active' : ''}`}
              aria-pressed={lang === f.language}
              onClick={() => setLang(f.language)}
            >
              {f.language}
            </button>
          ))}
        </div>
        <input
          className="faith-search"
          type="search"
          value={term}
          placeholder="Cari pokok iman…"
          aria-label="Cari pokok iman"
          onChange={(e) => setTerm(e.target.value)}
        />
      </div>

      <ol className="faith-list">
        {points.map((point) => (
          <li key={point.number} className="faith-item">
            <span className="faith-number">{point.number}</span>
            <p className="faith-text">{point.text}</p>
            <CopyButton text={`${point.number}. ${point.text}`} />
          </li>
        ))}
      </ol>
      {points.length === 0 && deferredTerm.trim() !== '' && (
        <p className="faith-empty">Tidak ditemukan pokok iman yang cocok.</p>
      )}
    </div>
  );
}
