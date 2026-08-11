import { useCallback, useState, useSyncExternalStore } from 'react';
import { Check, DownloadSimple, UploadSimple, Trash } from '@phosphor-icons/react';
import { decryptBackup, encryptBackup, type BackupEnvelope } from '@gysapp/core';
import {
  applySettings,
  getSettingsSnapshot,
  loadSettings,
  subscribeSettings,
  updateSettings,
  type AppSettings,
  type Locale,
  type ThemeMode,
} from './settings-store';
import { useLocale, useT } from '../../i18n';
import './settings.css';

const THEMES: Array<{ value: ThemeMode; label: string }> = [
  { value: 'system', label: 'Sistem' },
  { value: 'light', label: 'Terang' },
  { value: 'dark', label: 'Gelap' },
];

const LOCALES: Array<{ value: Locale; label: string }> = [
  { value: 'id', label: 'Bahasa Indonesia' },
  { value: 'en', label: 'English' },
  { value: 'zh', label: '中文' },
];

function PasswordDialog({
  title,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  confirmLabel: string;
  onConfirm: (password: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async () => {
    if (!password) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm(password);
      onCancel();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [password, onConfirm, onCancel]);

  return (
    <div className="dialog-backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <div className="dialog-card">
        <h3>{title}</h3>
        <input
          type="password"
          className="faith-search"
          value={password}
          placeholder="Kata sandi backup"
          aria-label="Kata sandi backup"
          autoFocus
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submit();
          }}
        />
        {error && (
          <p className="midi-error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button type="button" className="btn-text" onClick={onCancel} disabled={busy}>
            Batal
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => void submit()}
            disabled={busy || !password}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function SettingsPage() {
  const { t } = useT();
  const locale = useLocale();
  const settings = useSyncExternalStore(subscribeSettings, getSettingsSnapshot);
  const [dialog, setDialog] = useState<'export' | 'import' | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const applyAndSave = useCallback((partial: Partial<AppSettings>) => {
    const next = { ...loadSettings(), ...partial };
    updateSettings(partial);
    applySettings(next);
  }, []);

  const exportBackup = useCallback(async (password: string) => {
    const envelope: BackupEnvelope = {
      schemaVersion: 1,
      appVersion: '0.1.0',
      exportedAt: new Date().toISOString(),
      data: { settings: loadSettings() },
    };
    const bytes = await encryptBackup(password, envelope);
    const blob = new Blob([bytes as BlobPart], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gysapp-backup-${new Date().toISOString().slice(0, 10)}.gysapp`;
    a.click();
    URL.revokeObjectURL(url);
    setFeedback('Backup berhasil diunduh.');
  }, []);

  const importBackup = useCallback(
    async (password: string) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.gysapp';
      const file = await new Promise<File | null>((resolve) => {
        input.onchange = () => resolve(input.files?.[0] ?? null);
        input.click();
      });
      if (!file) return;
      const bytes = new Uint8Array(await file.arrayBuffer());
      const { envelope } = await decryptBackup(bytes, password);
      const data = envelope.data as { settings?: Partial<AppSettings> };
      if (data.settings) {
        applyAndSave(data.settings);
        setFeedback('Backup berhasil dipulihkan.');
      }
    },
    [applyAndSave],
  );

  const resetAll = useCallback(() => {
    if (!window.confirm('Hapus semua data lokal dan kembali ke awal?')) return;
    localStorage.clear();
    location.reload();
  }, []);

  return (
    <div className="content-shell settings-page">
      <h1 className="section-title">{t('settings')}</h1>

      <section aria-label="Tampilan">
        <h2 className="settings-heading">Tampilan</h2>
        <div className="settings-row">
          <label id="theme-label">Tema</label>
          <div className="faith-lang-tabs" role="group" aria-labelledby="theme-label">
            {THEMES.map((theme) => (
              <button
                key={theme.value}
                type="button"
                className={`chip${settings.theme === theme.value ? ' chip-active' : ''}`}
                aria-pressed={settings.theme === theme.value}
                onClick={() => applyAndSave({ theme: theme.value })}
              >
                {theme.label}
              </button>
            ))}
          </div>
        </div>

        <div className="settings-row">
          <label id="font-label">Ukuran huruf</label>
          <div className="font-control" role="group" aria-labelledby="font-label">
            <button
              type="button"
              className="icon-btn"
              aria-label="Perkecil huruf"
              disabled={settings.fontSize <= 0.9}
              onClick={() =>
                applyAndSave({ fontSize: Math.round((settings.fontSize - 0.1) * 10) / 10 })
              }
            >
              A−
            </button>
            <span className="font-value">{Math.round(settings.fontSize * 100)}%</span>
            <button
              type="button"
              className="icon-btn"
              aria-label="Perbesar huruf"
              disabled={settings.fontSize >= 1.5}
              onClick={() =>
                applyAndSave({ fontSize: Math.round((settings.fontSize + 0.1) * 10) / 10 })
              }
            >
              A+
            </button>
          </div>
        </div>

        <div className="settings-row">
          <label id="locale-label">Bahasa</label>
          <select
            className="bible-book-select"
            aria-labelledby="locale-label"
            value={locale}
            onChange={(e) => {
              updateSettings({ locale: e.target.value as Locale });
              applySettings(loadSettings());
            }}
          >
            {LOCALES.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section aria-label="Notifikasi">
        <h2 className="settings-heading">Notifikasi</h2>
        <div className="settings-row">
          <label htmlFor="sabat-toggle">Pengingat Sabat (Jumat 17:00)</label>
          <button
            id="sabat-toggle"
            type="button"
            role="switch"
            aria-checked={settings.sabatReminder}
            className={`switch${settings.sabatReminder ? ' switch-on' : ''}`}
            onClick={() => {
              applyAndSave({ sabatReminder: !settings.sabatReminder });
              if (!settings.sabatReminder) {
                void Notification.requestPermission();
              }
            }}
          >
            <span className="switch-thumb" />
          </button>
        </div>
        <p className="settings-hint">
          Pengingat OS penuh (bahkan saat aplikasi tertutup) tersedia pada versi Android/Windows
          melalui wrapper Tauri.
        </p>
      </section>

      <section aria-label="Data">
        <h2 className="settings-heading">Data</h2>
        <div className="settings-row">
          <button type="button" className="btn-primary" onClick={() => setDialog('export')}>
            <DownloadSimple size={20} aria-hidden="true" /> Ekspor backup
          </button>
          <button type="button" className="btn-text" onClick={() => setDialog('import')}>
            <UploadSimple size={20} aria-hidden="true" /> Pulihkan backup
          </button>
        </div>
        <div className="settings-row">
          <button type="button" className="btn-danger" onClick={resetAll}>
            <Trash size={20} aria-hidden="true" /> Reset semua data
          </button>
        </div>
        {feedback && (
          <p className="settings-feedback" role="status">
            <Check size={16} aria-hidden="true" /> {feedback}
          </p>
        )}
      </section>

      {dialog === 'export' && (
        <PasswordDialog
          title="Ekspor backup terenkripsi"
          confirmLabel="Ekspor"
          onConfirm={exportBackup}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog === 'import' && (
        <PasswordDialog
          title="Pulihkan backup"
          confirmLabel="Pulihkan"
          onConfirm={importBackup}
          onCancel={() => setDialog(null)}
        />
      )}
    </div>
  );
}
