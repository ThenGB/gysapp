import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import type { BibleBook, BibleParalel, BibleRef, BibleVerse } from '@gysapp/contracts';
import { encodeVerseId } from '@gysapp/core';
import { BibleVerseContext } from './bible-verse-context';
import { findContextNote } from '../notes/notes-store';

const books: BibleBook[] = [
  { id: 1, bs: 'Kej', bl: 'Kejadian', c: 50 },
  { id: 43, bs: 'Yoh', bl: 'Yohanes', c: 21 },
];

const verse: BibleVerse = {
  id: encodeVerseId(1, 1, 1),
  b: 1,
  c: 1,
  v: 1,
  t: 'Pada mulanya Allah menciptakan langit dan bumi.',
  r: null,
  c1: null,
  v1: null,
};

const joh316 = encodeVerseId(43, 3, 16);
const relatedRefs: BibleRef[] = [{ id: joh316, sv: 1, ev: 1 }];
const parallels: BibleParalel[] = [
  {
    id: 1,
    id1: verse.id,
    id2: joh316,
    t: '',
  },
];

function renderContext(overrides: Partial<React.ComponentProps<typeof BibleVerseContext>> = {}) {
  const onToggleBookmark = vi.fn();
  const onRead = vi.fn();
  const onClose = vi.fn();

  render(
    <MemoryRouter>
      <BibleVerseContext
        version="b_tb"
        bookId={1}
        chapterId={1}
        bookLabel="Kejadian"
        verse={verse}
        books={books}
        relatedRefs={relatedRefs}
        parallels={parallels}
        bookmarked={false}
        onToggleBookmark={onToggleBookmark}
        onRead={onRead}
        onClose={onClose}
        {...overrides}
      />
    </MemoryRouter>,
  );

  return { onToggleBookmark, onRead, onClose };
}

describe('BibleVerseContext', () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn(async () => undefined) },
    });
  });

  it('renders human-readable deduplicated references with a verse deep-link', () => {
    renderContext();

    expect(screen.getByText('Kejadian 1:1')).toBeInTheDocument();
    const references = screen.getAllByRole('link', { name: /Yohanes 3:16/ });
    expect(references).toHaveLength(1);
    expect(references[0]).toHaveAttribute('href', '/bible/43/3?v=16');
  });

  it('wires bookmark, read, close, and clipboard actions', async () => {
    const { onToggleBookmark, onRead, onClose } = renderContext();

    fireEvent.click(screen.getByRole('button', { name: 'Tandai' }));
    fireEvent.click(screen.getByRole('button', { name: 'Baca' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tutup aksi ayat' }));
    fireEvent.click(screen.getByRole('button', { name: 'Salin' }));

    expect(onToggleBookmark).toHaveBeenCalledOnce();
    expect(onRead).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'Kejadian 1:1 (TB)\nPada mulanya Allah menciptakan langit dan bumi.',
    );
    expect(await screen.findByRole('button', { name: 'Tersalin' })).toBeInTheDocument();
  });

  it('creates, updates, and deletes one contextual note for the selected verse', () => {
    const view = renderContext();

    fireEvent.click(screen.getByRole('button', { name: 'Catatan' }));
    const textarea = screen.getByRole('textbox', { name: 'Isi catatan ayat' });
    fireEvent.change(textarea, { target: { value: 'Catatan pertama' } });
    fireEvent.click(screen.getByRole('button', { name: 'Simpan catatan' }));

    expect(findContextNote('bible', 'Kejadian 1:1')?.text).toBe('Catatan pertama');

    fireEvent.change(textarea, { target: { value: 'Catatan diperbarui' } });
    fireEvent.click(screen.getByRole('button', { name: 'Perbarui catatan' }));
    expect(findContextNote('bible', 'Kejadian 1:1')?.text).toBe('Catatan diperbarui');

    fireEvent.click(screen.getByRole('button', { name: 'Hapus catatan' }));
    expect(findContextNote('bible', 'Kejadian 1:1')).toBeNull();

    view.onToggleBookmark.mockClear();
  });
});
