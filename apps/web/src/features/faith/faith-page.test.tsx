import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FaithPage } from './faith-page';

function renderFaith() {
  return render(
    <MemoryRouter>
      <FaithPage />
    </MemoryRouter>,
  );
}

describe('FaithPage', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn(async () => undefined) },
    });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: vi.fn(async () => undefined),
    });
  });

  it('renders all ten points in Indonesian by default', () => {
    renderFaith();
    expect(screen.getByRole('heading', { name: 'Dasar Kepercayaan' })).toBeInTheDocument();
    expect(screen.getByText(/Percaya bahwa Yesus adalah Firman/)).toBeInTheDocument();
    const points = document.querySelectorAll('.faith-item');
    expect(points.length).toBe(10);
  });

  it('switches language and searches points', () => {
    renderFaith();
    fireEvent.click(screen.getByRole('button', { name: 'EN' }));
    fireEvent.change(screen.getByRole('searchbox', { name: 'Cari pokok iman' }), {
      target: { value: 'Holy Spirit' },
    });
    expect(screen.getAllByText(/Holy Spirit/i).length).toBeGreaterThan(0);
  });

  it('copies multiple selected faith points as one readable block', async () => {
    renderFaith();
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]!);
    fireEvent.click(checkboxes[1]!);

    expect(screen.getByText('2 dipilih')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Salin pilihan' }));

    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledOnce());
    const copied = vi.mocked(navigator.clipboard.writeText).mock.calls[0]?.[0] ?? '';
    expect(copied).toContain('1.');
    expect(copied).toContain('2.');
    expect(copied).toContain('\n\n');
    expect(await screen.findByText('2 pokok iman disalin.')).toBeInTheDocument();
  });

  it('shares the selected points through Web Share when available', async () => {
    renderFaith();
    fireEvent.click(screen.getAllByRole('checkbox')[0]!);
    fireEvent.click(screen.getByRole('button', { name: 'Bagikan' }));

    await waitFor(() => expect(navigator.share).toHaveBeenCalledOnce());
    expect(navigator.share).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Dasar Kepercayaan',
        text: expect.stringContaining('1.'),
      }),
    );
    expect(await screen.findByText('1 pokok iman dibagikan.')).toBeInTheDocument();
  });
});
