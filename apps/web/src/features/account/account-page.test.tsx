import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { openExternalUrl } = vi.hoisted(() => ({
  openExternalUrl: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../platform/open-external', () => ({ openExternalUrl }));

import { AccountPage, EGYS_EXTERNAL_URL } from './account-page';

describe('AccountPage', () => {
  beforeEach(() => {
    openExternalUrl.mockClear();
  });

  it('explains that e-GYS authentication remains external', () => {
    render(<AccountPage />);
    expect(screen.getByRole('heading', { name: 'e-GYS' })).toBeInTheDocument();
    expect(screen.getByText(/GYSApp tidak meminta, menerima, atau menyimpan password/)).toBeInTheDocument();
  });

  it('opens the official e-GYS login in the system/browser opener', () => {
    render(<AccountPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Buka situs e-GYS' }));
    expect(openExternalUrl).toHaveBeenCalledWith(EGYS_EXTERNAL_URL);
  });
});
