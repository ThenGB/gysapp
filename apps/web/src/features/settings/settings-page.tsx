import { useCallback, useState, useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import {
  Books,
  Check,
  DownloadSimple,
  Eye,
  HandTap,
  MoonStars,
  UploadSimple,
  Trash,
  WaveSine,
} from '@phosphor-icons/react';
import { decryptBackup, encryptBackup, type BackupEnvelope } from '@gysapp/core';
import {
  applyComfortPreset,
  applySettings,
  getSettingsSnapshot,
  loadSettings,
  subscribeSettings,
  updateSettings,
  type AppSettings,
  type ComfortPreset,
  type Locale,
  type ThemeMode,
} from './settings-store';
import { useLocale, useT } from '../../i18n';
import { OfflineMediaSettings } from './offline-media-settings';
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

const PRESETS: Array<{ value: ComfortPreset; label: string; hint: string; sample: string }> = [
  { value: 'standard', label: 'Standar', hint: 'Seimbang', sample: 'Aa' },
  { value: 'comfortable', label: 'Nyaman', hint: 'Lebih besar', sample: 'Aa' },
  { value: 'large', label: 'Sangat Besar', hint: 'Paling mudah dibaca', sample: 'Aa' },
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
          onChange={(event) => setPassword(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && void submit()}
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

function SettingSwitch({
  id,
  label,
  checked,
  icon,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  icon: React.ReactNode;
  onChange: () => void;
}) {
  return (
    <div className="settings-comfort-row">
      <span className="settings-row-icon" aria-hidden="true">
        {icon}
      </span>
      <label htmlFor={id}>{label}</label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        className={`switch${checked ? ' switch-on' : ''}`}
        onClick={onChange}
      >
        <span className="switch-thumb" />
      </button>
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

  const selectPreset = useCallback((preset: ComfortPreset) => {
    applySettings(applyComfortPreset(preset));
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
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `gysapp-backup-${new Date().toISOString().slice(0, 10)}.gysapp`;
    anchor.click();
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
      const { envelope } = await decryptBackup(new Uint8Array(await file.arrayBuffer()), password);
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
      <header className="settings-header">
        <p>Personalisasi</p>
        <h1>{t('settings')}</h1>
        <span>Sesuaikan agar aplikasi nyaman dibaca dan digunakan.</span>
      </header>

      <section className="settings-section" aria-label="Tampilan nyaman">
        <div className="settings-section-title">
          <div>
            <h2>Tampilan yang nyaman untuk Anda</h2>
            <p>Pilih preset, lalu sesuaikan bila perlu.</p>
          </div>
        </div>
        <div className="comfort-presets" role="group" aria-label="Preset tampilan">
          {PRESETS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              className={`comfort-preset${settings.comfortPreset === preset.value ? ' comfort-preset-active' : ''}`}
              aria-pressed={settings.comfortPreset === preset.value}
              onClick={() => selectPreset(preset.value)}
            >
              <span className={`comfort-sample comfort-sample-${preset.value}`}>
                {preset.sample}
              </span>
              <strong>{preset.label}</strong>
              <small>{preset.hint}</small>
            </button>
          ))}
        </div>
        <div className="comfort-preview" aria-label="Pratinjau teks">
          <span>Pratinjau</span>
          <p>Tuhan adalah terangku dan keselamatanku; siapakah yang harus kutakuti?</p>
          <small>Mazmur 27:1</small>
        </div>
      </section>

      <section className="settings-section" aria-label="Kenyamanan membaca">
        <h2 className="settings-heading">Kenyamanan membaca</h2>
        <div className="settings-slider-row">
          <label id="ui-scale-label">Ukuran antarmuka</label>
          <div className="font-control" role="group" aria-labelledby="ui-scale-label">
            <button
              type="button"
              className="icon-btn"
              aria-label="Perkecil huruf"
              disabled={settings.uiScale <= 0.9}
              onClick={() =>
                applyAndSave({
                  comfortPreset: 'standard',
                  uiScale: Math.round((settings.uiScale - 0.05) * 100) / 100,
                })
              }
            >
              A−
            </button>
            <span className="font-value">{Math.round(settings.uiScale * 100)}%</span>
            <button
              type="button"
              className="icon-btn"
              aria-label="Perbesar huruf"
              disabled={settings.uiScale >= 1.3}
              onClick={() =>
                applyAndSave({
                  comfortPreset: 'standard',
                  uiScale: Math.round((settings.uiScale + 0.05) * 100) / 100,
                })
              }
            >
              A+
            </button>
          </div>
        </div>
        <div className="settings-slider-row">
          <label id="reader-scale-label">Ukuran teks bacaan</label>
          <div className="font-control" role="group" aria-labelledby="reader-scale-label">
            <button
              type="button"
              className="icon-btn"
              aria-label="Perkecil teks bacaan"
              disabled={settings.readerScale <= 0.9}
              onClick={() =>
                applyAndSave({ readerScale: Math.round((settings.readerScale - 0.1) * 10) / 10 })
              }
            >
              A−
            </button>
            <span className="font-value">{Math.round(settings.readerScale * 100)}%</span>
            <button
              type="button"
              className="icon-btn"
              aria-label="Perbesar teks bacaan"
              disabled={settings.readerScale >= 1.6}
              onClick={() =>
                applyAndSave({ readerScale: Math.round((settings.readerScale + 0.1) * 10) / 10 })
              }
            >
              A+
            </button>
          </div>
        </div>
        <SettingSwitch
          id="contrast-toggle"
          label="Kontras tinggi"
          checked={settings.highContrast}
          icon={<Eye size={20} />}
          onChange={() => applyAndSave({ highContrast: !settings.highContrast })}
        />
        <SettingSwitch
          id="targets-toggle"
          label="Tombol & area sentuh lebih besar"
          checked={settings.largeTargets}
          icon={<HandTap size={20} />}
          onChange={() => applyAndSave({ largeTargets: !settings.largeTargets })}
        />
        <SettingSwitch
          id="motion-toggle"
          label="Kurangi gerakan dan animasi"
          checked={settings.reduceMotion}
          icon={<WaveSine size={20} />}
          onChange={() => applyAndSave({ reduceMotion: !settings.reduceMotion })}
        />
      </section>

      <section className="settings-section" aria-label="Tema dan bahasa">
        <h2 className="settings-heading">Tema & bahasa</h2>
        <div className="settings-row">
          <label id="theme-label">
            <MoonStars size={20} aria-hidden="true" /> Tema
          </label>
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
          <label id="locale-label">Bahasa</label>
          <select
            className="bible-book-select"
            aria-labelledby="locale-label"
            value={locale}
            onChange={(event) => {
              updateSettings({ locale: event.target.value as Locale });
              applySettings(loadSettings());
            }}
          >
            {LOCALES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="settings-section" aria-label="Notifikasi">
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
              if (!settings.sabatReminder) void Notification.requestPermission();
            }}
          >
            <span className="switch-thumb" />
          </button>
        </div>
      </section>

      <section className="settings-section" aria-label="Data">
        <h2 className="settings-heading">Data</h2>
        <OfflineMediaSettings />
        <div className="settings-data-actions">
          <Link className="btn-text" to="/bible?library=1">
            <Books size={20} aria-hidden="true" /> Kelola versi Alkitab
          </Link>
          <button type="button" className="btn-primary" onClick={() => setDialog('export')}>
            <DownloadSimple size={20} /> Ekspor backup
          </button>
          <button type="button" className="btn-text" onClick={() => setDialog('import')}>
            <UploadSimple size={20} /> Pulihkan backup
          </button>
          <button type="button" className="btn-danger" onClick={resetAll}>
            <Trash size={20} /> Reset semua data
          </button>
        </div>
        {feedback && (
          <p className="settings-feedback" role="status">
            <Check size={16} /> {feedback}
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
