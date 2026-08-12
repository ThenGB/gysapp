export type NoteKind = 'bible' | 'faith' | 'song';

export interface AppNote {
  id: string;
  kind: NoteKind;
  target: string;
  title: string;
  text: string;
  updatedAt: number;
}

const KEY = 'gysapp.notes.v1';

function isNote(value: unknown): value is AppNote {
  if (typeof value !== 'object' || value === null) return false;
  const n = value as Partial<AppNote>;
  return (
    typeof n.id === 'string' &&
    (n.kind === 'bible' || n.kind === 'faith' || n.kind === 'song') &&
    typeof n.title === 'string' &&
    typeof n.text === 'string'
  );
}

export function loadNotes(): AppNote[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isNote).sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

function persist(notes: AppNote[]): void {
  localStorage.setItem(KEY, JSON.stringify(notes));
}

export function addNote(note: Omit<AppNote, 'id' | 'updatedAt'>): AppNote {
  const created: AppNote = { ...note, id: crypto.randomUUID(), updatedAt: Date.now() };
  persist([created, ...loadNotes()]);
  return created;
}

export function findContextNote(kind: NoteKind, target: string): AppNote | null {
  const normalized = target.trim().toLocaleLowerCase();
  return (
    loadNotes().find(
      (note) => note.kind === kind && note.target.trim().toLocaleLowerCase() === normalized,
    ) ?? null
  );
}

/**
 * Catatan contextual (mis. satu ayat) memakai satu record per kind+target.
 * Catatan lama dari halaman Notes tetap kompatibel; record terbaru untuk target
 * yang sama diperbarui dan duplikat contextual lama dibersihkan.
 */
export function saveContextNote(
  note: Omit<AppNote, 'id' | 'updatedAt'>,
): AppNote {
  const notes = loadNotes();
  const normalized = note.target.trim().toLocaleLowerCase();
  const existing = notes.find(
    (item) => item.kind === note.kind && item.target.trim().toLocaleLowerCase() === normalized,
  );
  const saved: AppNote = {
    ...note,
    id: existing?.id ?? crypto.randomUUID(),
    updatedAt: Date.now(),
  };
  persist([
    saved,
    ...notes.filter(
      (item) =>
        !(
          item.kind === note.kind && item.target.trim().toLocaleLowerCase() === normalized
        ),
    ),
  ]);
  return saved;
}

export function deleteNote(id: string): void {
  persist(loadNotes().filter((n) => n.id !== id));
}
