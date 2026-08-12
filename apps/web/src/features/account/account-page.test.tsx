import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountPage } from './account-page';
import { clearEgysToken, writeEgysToken } from './egys-session';

describe('AccountPage', () => {
  beforeEach(() => {
    writeEgysToken('egys-test-token');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            data: {
              id: 22,
              name: 'Budi',
              email: 'budi@example.com',
              status: 'ACTIVE',
              baptized: 1,
              branchname: 'Pontianak',
            },
          }),
          { status: 200 },
        ),
      ),
    );
  });

  afterEach(() => {
    clearEgysToken();
    vi.unstubAllGlobals();
  });

  it('shows canonical membership and church branch from e-GYS', async () => {
    render(<AccountPage />);
    expect(await screen.findByRole('heading', { name: 'Budi' })).toBeInTheDocument();
    expect(screen.getAllByText('Jemaat').length).toBeGreaterThan(0);
    expect(screen.getByText('Pontianak')).toBeInTheDocument();
    expect(screen.getByText('budi@example.com')).toBeInTheDocument();
  });
});
