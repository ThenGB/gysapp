import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { MorePage } from './more-page';

describe('MorePage', () => {
  it('renders literature, notes, Bible management and settings navigation', () => {
    render(
      <MemoryRouter>
        <MorePage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Literatur & Bacaan' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Catatan & Koleksi' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Unduhan & Pengaturan' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Kesaksian/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Manna \/ Warta Sejati/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Kumpulan Renungan/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Kelola versi Alkitab' })).toHaveAttribute(
      'href',
      '/bible?library=1',
    );
    expect(screen.getByRole('link', { name: 'Pengaturan' })).toHaveAttribute(
      'href',
      '/settings',
    );
  });
});
