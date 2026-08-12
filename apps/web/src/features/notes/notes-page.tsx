import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Trash } from '@phosphor-icons/react';
import { addNote, deleteNote, loadNotes, type NoteKind } from './notes-store';
import '../settings/settings.css';

const KINDS: Array<{ value: NoteKind; label: string }> = [
  { value: 'bible', label: 'Catatan Alkitab' },
  { value: 'faith', label: 'Catatan Iman' },
  { value: 'song', label: 'Catatan Pujian' },
];

export function NotesPage() {
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
      title: title.trim() || 'Tanpa judul',
      text: text.trim(),
    });
    setNotes(loadNotes());
    setTitle('');
    setText('');
  };

  return (
    <div className="content-shell settings-page">
      <div className="bible-toolbar">
        <Link to="/more" className="icon-btn" aria-label="Kembali">
          <ArrowLeft size={22} aria-hidden="true" />
        </Link>
        <h1 className="bible-search-title">Catatan</h1>
      </div>

      <div className="faith-lang-tabs" role="group" aria-label="Jenis catatan">
        {KINDS.map((k) => (
          <Link
            key={k.value}
            to={`/notes/${k.value}`}
            className={`chip${active === k.value ? ' chip-active' : ''}`}
          >
            {k.label}
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
          placeholder="Rujukan (mis. Kejadian 1:1, KR 001)…"
          aria-label="Rujukan"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
        />
        <input
          className="faith-search"
          placeholder="Judul…"
          aria-label="Judul catatan"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          className="faith-search report-message"
          rows={4}
          placeholder="Isi catatan…"
          aria-label="Isi catatan"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" className="btn-primary">
          Simpan catatan
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
                aria-label={`Hapus catatan ${note.title}`}
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
      {filtered.length === 0 && <p className="faith-empty">Belum ada catatan.</p>}
    </div>
  );
}
