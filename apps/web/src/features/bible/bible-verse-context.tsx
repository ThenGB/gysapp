import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookmarkSimple,
  Check,
  Copy,
  NotePencil,
  SpeakerHigh,
  Trash,
  X,
} from '@phosphor-icons/react';
import type { BibleBook, BibleParalel, BibleRef, BibleVerse } from '@gysapp/contracts';
import { decodeVerseId, encodeVerseId, stripBibleTags, type BiblePackCode } from '@gysapp/core';
import { deleteNote, findContextNote, saveContextNote, type AppNote } from '../notes/notes-store';
import { useT } from '../../i18n';
import './bible-verse-context.css';

interface BibleVerseContextProps {
  version: BiblePackCode;
  bookId: number;
  chapterId: number;
  bookLabel: string;
  verse: BibleVerse;
  books: BibleBook[];
  relatedRefs: BibleRef[];
  parallels: BibleParalel[];
  bookmarked: boolean;
  onToggleBookmark: () => void;
  onRead: () => void;
  onClose: () => void;
}

type RelatedTarget = {
  key: string;
  id: number;
  label: string;
  kind: 'ref' | 'parallel';
};

function formatVerseTarget(id: number, books: BibleBook[]): string {
  const target = decodeVerseId(id);
  const book = books.find((item) => item.id === target.bookId);
  return `${book?.bl ?? `Kitab ${target.bookId}`} ${target.chapterId}:${target.verseId}`;
}

function targetHref(id: number): string {
  const target = decodeVerseId(id);
  return `/bible/${target.bookId}/${target.chapterId}?v=${target.verseId}`;
}

function buildRelatedTargets({
  version,
  bookId,
  chapterId,
  verse,
  books,
  relatedRefs,
  parallels,
}: Pick<
  BibleVerseContextProps,
  'version' | 'bookId' | 'chapterId' | 'verse' | 'books' | 'relatedRefs' | 'parallels'
>): RelatedTarget[] {
  void version;
  const currentId = encodeVerseId(bookId, chapterId, verse.v);
  const targets: RelatedTarget[] = relatedRefs.map((reference, index) => ({
    key: `ref-${reference.id}-${index}`,
    id: reference.id,
    label: formatVerseTarget(reference.id, books),
    kind: 'ref',
  }));

  for (const parallel of parallels) {
    let targetId: number | null = null;
    if (parallel.id1 === currentId) targetId = parallel.id2;
    else if (parallel.id2 === currentId) targetId = parallel.id1;
    if (!targetId || targetId === currentId) continue;
    targets.push({
      key: `parallel-${parallel.id}-${targetId}`,
      id: targetId,
      label: parallel.t?.trim() || formatVerseTarget(targetId, books),
      kind: 'parallel',
    });
  }

  const seen = new Set<number>();
  return targets.filter((target) => {
    if (seen.has(target.id)) return false;
    seen.add(target.id);
    return true;
  });
}

export function BibleVerseContext({
  version,
  bookId,
  chapterId,
  bookLabel,
  verse,
  books,
  relatedRefs,
  parallels,
  bookmarked,
  onToggleBookmark,
  onRead,
  onClose,
}: BibleVerseContextProps) {
  const { t } = useT();
  const target = `${bookLabel} ${chapterId}:${verse.v}`;
  const verseText = stripBibleTags(verse.t);
  const [note, setNote] = useState<AppNote | null>(() => findContextNote('bible', target));
  const [noteOpen, setNoteOpen] = useState(Boolean(note));
  const [noteText, setNoteText] = useState(note?.text ?? '');
  const [copyState, setCopyState] = useState<'idle' | 'done' | 'error'>('idle');
  const [noteState, setNoteState] = useState<'idle' | 'saved'>('idle');
  const related = useMemo(
    () =>
      buildRelatedTargets({
        version,
        bookId,
        chapterId,
        verse,
        books,
        relatedRefs,
        parallels,
      }),
    [bookId, books, chapterId, parallels, relatedRefs, verse, version],
  );

  const copyVerse = async () => {
    const copyText = `${target} (${version.replace('b_', '').toUpperCase()})\n${verseText}`;
    try {
      await navigator.clipboard.writeText(copyText);
      setCopyState('done');
    } catch {
      setCopyState('error');
    }
  };

  const persistNote = () => {
    const trimmed = noteText.trim();
    if (!trimmed) return;
    const saved = saveContextNote({
      kind: 'bible',
      target,
      title: target,
      text: trimmed,
    });
    setNote(saved);
    setNoteText(saved.text);
    setNoteState('saved');
  };

  const removeNote = () => {
    if (note) deleteNote(note.id);
    setNote(null);
    setNoteText('');
    setNoteState('idle');
    setNoteOpen(false);
  };

  return (
    <aside
      className="bible-verse-actions bible-context"
      aria-label={`${t('verseActions')} ${target}`}
    >
      <header className="bible-context-header">
        <div>
          <strong>{target}</strong>
          <span>{version.replace('b_', '').toUpperCase()}</span>
        </div>
        <button
          type="button"
          className="icon-btn mini"
          aria-label={t('closeVerseActions')}
          onClick={onClose}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </header>

      <div className="bible-context-actions">
        <button type="button" className="btn-text" onClick={onToggleBookmark}>
          <BookmarkSimple size={19} weight={bookmarked ? 'fill' : 'regular'} aria-hidden="true" />
          {bookmarked ? t('removeBookmark') : t('bookmark')}
        </button>
        <button type="button" className="btn-text" onClick={onRead}>
          <SpeakerHigh size={19} aria-hidden="true" /> {t('read')}
        </button>
        <button type="button" className="btn-text" onClick={() => void copyVerse()}>
          {copyState === 'done' ? (
            <Check size={19} aria-hidden="true" />
          ) : (
            <Copy size={19} aria-hidden="true" />
          )}
          {copyState === 'done' ? t('copied') : t('copy')}
        </button>
        <button
          type="button"
          className={`btn-text${note ? ' bible-context-note-active' : ''}`}
          aria-expanded={noteOpen}
          onClick={() => {
            setNoteOpen((value) => !value);
            setNoteState('idle');
          }}
        >
          <NotePencil size={19} aria-hidden="true" /> {t('verseNote')}
        </button>
      </div>

      {copyState === 'error' && (
        <p className="bible-context-status" role="status">
          {t('clipboardManual')}
        </p>
      )}

      {noteOpen && (
        <section className="bible-context-note" aria-label={`${t('verseNote')} ${target}`}>
          <textarea
            rows={4}
            value={noteText}
            aria-label={t('verseNoteBody')}
            placeholder={t('verseNotePlaceholder')}
            onChange={(event) => {
              setNoteText(event.target.value);
              setNoteState('idle');
            }}
          />
          <div>
            <button
              type="button"
              className="btn-primary"
              disabled={!noteText.trim()}
              onClick={persistNote}
            >
              {noteState === 'saved' ? t('saved') : note ? t('updateNote') : t('saveNote')}
            </button>
            {note && (
              <button type="button" className="btn-text" onClick={removeNote}>
                <Trash size={18} aria-hidden="true" /> {t('deleteNote')}
              </button>
            )}
          </div>
        </section>
      )}

      {related.length > 0 && (
        <section className="bible-context-related" aria-label={t('relatedReferences')}>
          <strong>{t('relatedReferences')}</strong>
          <div className="bible-context-related-list">
            {related.map((item) => (
              <Link key={item.key} to={targetHref(item.id)} className="bible-context-reference">
                <span>{item.kind === 'parallel' ? t('parallelLabel') : t('referenceLabel')}</span>
                {item.label}
              </Link>
            ))}
          </div>
        </section>
      )}
    </aside>
  );
}
