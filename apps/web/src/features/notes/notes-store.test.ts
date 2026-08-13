import { beforeEach, describe, expect, it } from 'vitest';
import { addNote, findContextNote, loadNotes, saveContextNote } from './notes-store';

describe('notes store contextual notes', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('upserts one contextual note per kind and target', () => {
    const first = saveContextNote({
      kind: 'bible',
      target: 'Kejadian 1:1',
      title: 'Kejadian 1:1',
      text: 'Catatan awal',
    });
    const updated = saveContextNote({
      kind: 'bible',
      target: ' kejadian 1:1 ',
      title: 'Kejadian 1:1',
      text: 'Catatan diperbarui',
    });

    expect(updated.id).toBe(first.id);
    expect(loadNotes()).toHaveLength(1);
    expect(findContextNote('bible', 'KEJADIAN 1:1')?.text).toBe('Catatan diperbarui');
  });

  it('does not merge notes from different kinds', () => {
    addNote({ kind: 'faith', target: 'Kejadian 1:1', title: 'Iman', text: 'A' });
    saveContextNote({ kind: 'bible', target: 'Kejadian 1:1', title: 'Ayat', text: 'B' });

    expect(loadNotes()).toHaveLength(2);
    expect(findContextNote('bible', 'Kejadian 1:1')?.text).toBe('B');
    expect(findContextNote('faith', 'Kejadian 1:1')?.text).toBe('A');
  });
});
