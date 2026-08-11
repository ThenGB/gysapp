import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, beforeEach } from 'vitest';
import { SettingsPage } from './settings-page';

describe('SettingsPage', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.removeProperty('--font-scale');
  });

  it('renders theme, font, locale and data sections', () => {
    render(<SettingsPage />);
    expect(screen.getByRole('button', { name: 'Terang' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gelap' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Perbesar huruf' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Bahasa' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ekspor backup/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reset semua data/ })).toBeInTheDocument();
  });

  it('applies theme to document element on toggle', async () => {
    render(<SettingsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Gelap' }));
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('dark'));
    fireEvent.click(screen.getByRole('button', { name: 'Terang' }));
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('light'));
  });

  it('increases font scale on A+', async () => {
    render(<SettingsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Perbesar huruf' }));
    await waitFor(() =>
      expect(document.documentElement.style.getPropertyValue('--font-scale')).toBe('1.1'),
    );
    expect(screen.getByText('110%')).toBeInTheDocument();
  });
});
