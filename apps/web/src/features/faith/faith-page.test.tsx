import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FaithPage } from './faith-page';

describe('FaithPage', () => {
  it('renders all ten points in Indonesian by default', () => {
    render(<FaithPage />);
    expect(screen.getByRole('heading', { name: 'Dasar Kepercayaan' })).toBeInTheDocument();
    expect(screen.getByText(/Percaya bahwa Yesus adalah Firman/)).toBeInTheDocument();
    const points = document.querySelectorAll('.faith-item');
    expect(points.length).toBe(10);
  });

  it('switches language and searches points', () => {
    render(<FaithPage />);
    fireEvent.click(screen.getByRole('button', { name: 'EN' }));
    fireEvent.change(screen.getByRole('searchbox', { name: 'Cari pokok iman' }), {
      target: { value: 'Holy Spirit' },
    });
    expect(screen.getAllByText(/Holy Spirit/i).length).toBeGreaterThan(0);
  });
});
