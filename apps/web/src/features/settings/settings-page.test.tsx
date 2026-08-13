import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { SettingsPage } from './settings-page';

function renderSettings() {
  return render(
    <MemoryRouter>
      <SettingsPage />
    </MemoryRouter>,
  );
}

describe('SettingsPage', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.removeProperty('--font-scale');
  });

  it('renders theme, font, locale and data sections', () => {
    renderSettings();
    expect(screen.getByRole('button', { name: 'Terang' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gelap' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Perbesar huruf' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Bahasa' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ekspor backup/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Kelola versi Alkitab/ })).toHaveAttribute(
      'href',
      '/bible?library=1',
    );
    expect(screen.getByRole('button', { name: /Reset semua data/ })).toBeInTheDocument();
    expect(screen.getByText(/aplikasi native Android, Windows, dan iOS/)).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Pengingat Sabat (Jumat 17:00)' })).toBeDisabled();
    expect(screen.getByRole('switch', { name: 'Pengingat baca Alkitab Senin' })).toBeDisabled();
  });

  it('applies theme to document element on toggle', async () => {
    renderSettings();
    fireEvent.click(screen.getByRole('button', { name: 'Gelap' }));
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('dark'));
    fireEvent.click(screen.getByRole('button', { name: 'Terang' }));
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('light'));
  });

  it('increases font scale on A+', async () => {
    renderSettings();
    fireEvent.click(screen.getByRole('button', { name: 'Perbesar huruf' }));
    await waitFor(() =>
      expect(document.documentElement.style.getPropertyValue('--font-scale')).toBe('1.05'),
    );
    expect(screen.getByText('105%')).toBeInTheDocument();
  });

  it('traps focus in the backup dialog, closes with Escape and restores the trigger focus', async () => {
    renderSettings();
    const trigger = screen.getByRole('button', { name: /Ekspor backup/ });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = screen.getByRole('dialog', { name: 'Ekspor backup terenkripsi' });
    const password = screen.getByLabelText('Kata sandi backup');
    const cancel = screen.getByRole('button', { name: 'Batal' });
    expect(password).toHaveFocus();

    cancel.focus();
    fireEvent.keyDown(cancel, { key: 'Tab' });
    expect(password).toHaveFocus();

    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });
});
