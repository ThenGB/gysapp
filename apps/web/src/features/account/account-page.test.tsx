import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountPage } from './account-page';

describe('AccountPage', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () => new Response(JSON.stringify({ error: 'unauthenticated' }), { status: 401 }),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows login button when unauthenticated', async () => {
    render(<AccountPage />);
    expect(await screen.findByRole('button', { name: 'Masuk dengan Google' })).toBeInTheDocument();
  });

  it('shows profile when session is valid', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ sub: 'g-1', name: 'Budi', email: 'b@x.id', picture: null }),
            {
              status: 200,
            },
          ),
      ),
    );
    render(<AccountPage />);
    await waitFor(() => {
      expect(screen.getByText('Budi')).toBeInTheDocument();
    });
    expect(screen.getByText('b@x.id')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Keluar/ })).toBeInTheDocument();
  });
});
