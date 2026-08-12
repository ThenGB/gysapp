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

export function deleteNote(id: string): void {
  persist(loadNotes().filter((n) => n.id !== id));
}
