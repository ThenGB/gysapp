import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { MorePage } from './more-page';

describe('MorePage', () => {
  it('links directly to Bible management and settings', () => {
    render(
      <MemoryRouter>
        <MorePage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Kelola versi Alkitab' })).toHaveAttribute(
      'href',
      '/bible?library=1',
    );
    expect(screen.getByRole('link', { name: 'Pengaturan' })).toHaveAttribute('href', '/settings');
  });
});
