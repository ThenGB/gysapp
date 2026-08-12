import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Trash } from '@phosphor-icons/react';
import { useT, type TranslationKey } from '../../i18n';
import { addNote, deleteNote, loadNotes, type NoteKind } from './notes-store';
import '../settings/settings.css';

const KINDS: Array<{ value: NoteKind; labelKey: TranslationKey }> = [
  { value: 'bible', labelKey: 'bibleNotes' },
  { value: 'faith', labelKey: 'faithNotes' },
  { value: 'song', labelKey: 'hymnNotes' },
];

export function NotesPage() {
  const { t } = useT();
  const { kind = 'bible' } = useParams();
  const active = (KINDS.some((k) => k.value === kind) ? kind : 'bible') as NoteKind;
  const [notes, setNotes] = useState(loadNotes);
  const [target, setTarget] = useState('');
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');

  const filtered = notes.filter((n) => n.kind === active);

  const submit = () => {
    if (!title.trim() && !text.trim()) return;
    addNote({
      kind: active,
      target: target.trim(),
      title: title.trim() || t('untitled'),
      text: text.trim(),
    });
    setNotes(loadNotes());
    setTitle('');
    setText('');
  };

  return (
    <div className="content-shell settings-page">
      <div className="bible-toolbar">
        <Link to="/more" className="icon-btn" aria-label={t('back')}>
          <ArrowLeft size={22} aria-hidden="true" />
        </Link>
        <h1 className="bible-search-title">{t('notesTitle')}</h1>
      </div>

      <div className="faith-lang-tabs" role="group" aria-label={t('noteKind')}>
        {KINDS.map((k) => (
          <Link
            key={k.value}
            to={`/notes/${k.value}`}
            className={`chip${active === k.value ? ' chip-active' : ''}`}
          >
            {t(k.labelKey)}
          </Link>
        ))}
      </div>

      <form
        className="notes-form"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          className="faith-search"
          placeholder={t('noteReferencePlaceholder')}
          aria-label={t('noteReference')}
          value={target}
          onChange={(e) => setTarget(e.target.value)}
        />
        <input
          className="faith-search"
          placeholder={t('noteTitlePlaceholder')}
          aria-label={t('noteTitle')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          className="faith-search report-message"
          rows={4}
          placeholder={t('noteBodyPlaceholder')}
          aria-label={t('noteBody')}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" className="btn-primary">
          {t('saveNote')}
        </button>
      </form>

      <ul className="bible-results notes-list">
        {filtered.map((note) => (
          <li key={note.id} className="bible-result notes-item">
            <div className="notes-head">
              <strong>{note.title}</strong>
              {note.target && <span className="notes-target">{note.target}</span>}
              <button
                type="button"
                className="icon-btn playlist-remove"
                aria-label={`${t('deleteNote')} ${note.title}`}
                onClick={() => {
                  deleteNote(note.id);
                  setNotes(loadNotes());
                }}
              >
                <Trash size={18} aria-hidden="true" />
              </button>
            </div>
            <p>{note.text}</p>
          </li>
        ))}
      </ul>
      {filtered.length === 0 && <p className="faith-empty">{t('noNotes')}</p>}
    </div>
  );
}
