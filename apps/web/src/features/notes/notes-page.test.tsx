import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { NotesPage } from './notes-page';

function renderNotes() {
  return render(
    <MemoryRouter initialEntries={['/notes/bible']}>
      <NotesPage />
    </MemoryRouter>,
  );
}

describe('NotesPage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('adds and lists a note', async () => {
    renderNotes();
    fireEvent.change(screen.getByRole('textbox', { name: 'Judul catatan' }), {
      target: { value: 'Ayat penting' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Isi catatan' }), {
      target: { value: 'Kejadian 1:1 menciptakan langit dan bumi.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Simpan catatan' }));
    await waitFor(() => {
      expect(screen.getByText('Ayat penting')).toBeInTheDocument();
    });
    expect(localStorage.getItem('gysapp.notes.v1')).toContain('Kejadian 1:1');
  });

  it('deletes a note', async () => {
    localStorage.setItem(
      'gysapp.notes.v1',
      JSON.stringify([
        { id: 'x', kind: 'bible', target: '', title: 'Hapus ini', text: 'isi', updatedAt: 1 },
      ]),
    );
    renderNotes();
    expect(screen.getByText('Hapus ini')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Hapus catatan Hapus ini/ }));
    await waitFor(() => {
      expect(screen.queryByText('Hapus ini')).not.toBeInTheDocument();
    });
  });
});
