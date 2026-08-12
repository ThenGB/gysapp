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
import { useLocale, useT, type TranslationKey } from '../../i18n';
import { OfflineMediaSettings } from './offline-media-settings';
import './settings.css';

const THEMES: Array<{ value: ThemeMode; labelKey: TranslationKey }> = [
  { value: 'system', labelKey: 'themeSystem' },
  { value: 'light', labelKey: 'themeLight' },
  { value: 'dark', labelKey: 'themeDark' },
];

const LOCALES: Array<{ value: Locale; label: string }> = [
  { value: 'id', label: 'Bahasa Indonesia' },
  { value: 'en', label: 'English' },
  { value: 'zh', label: '中文' },
];

const PRESETS: Array<{
  value: ComfortPreset;
  labelKey: TranslationKey;
  hintKey: TranslationKey;
  sample: string;
}> = [
  { value: 'standard', labelKey: 'presetStandard', hintKey: 'presetBalanced', sample: 'Aa' },
  {
    value: 'comfortable',
    labelKey: 'presetComfortable',
    hintKey: 'presetLarger',
    sample: 'Aa',
  },
  { value: 'large', labelKey: 'presetLarge', hintKey: 'presetEasiestRead', sample: 'Aa' },
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
  const { t } = useT();
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
          placeholder={t('backupPassword')}
          aria-label={t('backupPassword')}
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
            {t('cancel')}
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

  const exportBackup = useCallback(
    async (password: string) => {
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
      setFeedback(t('backupDownloaded'));
    },
    [t],
  );

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
        setFeedback(t('backupRestored'));
      }
    },
    [applyAndSave, t],
  );

  const resetAll = useCallback(() => {
    if (!window.confirm(t('resetAllConfirm'))) return;
    localStorage.clear();
    location.reload();
  }, [t]);

  return (
    <div className="content-shell settings-page">
      <header className="settings-header">
        <p>{t('personalize')}</p>
        <h1>{t('settings')}</h1>
        <span>{t('settingsLead')}</span>
      </header>

      <section className="settings-section" aria-label={t('comfortableDisplay')}>
        <div className="settings-section-title">
          <div>
            <h2>{t('comfortableDisplay')}</h2>
            <p>{t('choosePresetHint')}</p>
          </div>
        </div>
        <div className="comfort-presets" role="group" aria-label={t('comfortableDisplay')}>
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
              <strong>{t(preset.labelKey)}</strong>
              <small>{t(preset.hintKey)}</small>
            </button>
          ))}
        </div>
        <div className="comfort-preview" aria-label={t('preview')}>
          <span>{t('preview')}</span>
          <p>{t('previewVerse')}</p>
          <small>{t('previewVerseReference')}</small>
        </div>
      </section>

      <section className="settings-section" aria-label={t('readingComfort')}>
        <h2 className="settings-heading">{t('readingComfort')}</h2>
        <div className="settings-slider-row">
          <label id="ui-scale-label">{t('interfaceSize')}</label>
          <div className="font-control" role="group" aria-labelledby="ui-scale-label">
            <button
              type="button"
              className="icon-btn"
              aria-label={t('decreaseFont')}
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
              aria-label={t('increaseFont')}
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
          <label id="reader-scale-label">{t('readerTextSize')}</label>
          <div className="font-control" role="group" aria-labelledby="reader-scale-label">
            <button
              type="button"
              className="icon-btn"
              aria-label={t('decreaseReaderText')}
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
              aria-label={t('increaseReaderText')}
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
          label={t('highContrast')}
          checked={settings.highContrast}
          icon={<Eye size={20} />}
          onChange={() => applyAndSave({ highContrast: !settings.highContrast })}
        />
        <SettingSwitch
          id="targets-toggle"
          label={t('largeTouchTargets')}
          checked={settings.largeTargets}
          icon={<HandTap size={20} />}
          onChange={() => applyAndSave({ largeTargets: !settings.largeTargets })}
        />
        <SettingSwitch
          id="motion-toggle"
          label={t('reduceMotion')}
          checked={settings.reduceMotion}
          icon={<WaveSine size={20} />}
          onChange={() => applyAndSave({ reduceMotion: !settings.reduceMotion })}
        />
      </section>

      <section className="settings-section" aria-label={t('themeAndLanguage')}>
        <h2 className="settings-heading">{t('themeAndLanguage')}</h2>
        <div className="settings-row">
          <label id="theme-label">
            <MoonStars size={20} aria-hidden="true" /> {t('theme')}
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
                {t(theme.labelKey)}
              </button>
            ))}
          </div>
        </div>
        <div className="settings-row">
          <label id="locale-label">{t('language')}</label>
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

      <section className="settings-section" aria-label={t('notifications')}>
        <h2 className="settings-heading">{t('notifications')}</h2>
        <div className="settings-row">
          <label htmlFor="sabat-toggle">{t('sabatReminder')}</label>
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

      <section className="settings-section" aria-label={t('data')}>
        <h2 className="settings-heading">{t('data')}</h2>
        <OfflineMediaSettings />
        <div className="settings-data-actions">
          <Link className="btn-text" to="/bible?library=1">
            <Books size={20} aria-hidden="true" /> {t('manageBibleVersions')}
          </Link>
          <button type="button" className="btn-primary" onClick={() => setDialog('export')}>
            <DownloadSimple size={20} /> {t('exportBackup')}
          </button>
          <button type="button" className="btn-text" onClick={() => setDialog('import')}>
            <UploadSimple size={20} /> {t('restoreBackup')}
          </button>
          <button type="button" className="btn-danger" onClick={resetAll}>
            <Trash size={20} /> {t('resetAllData')}
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
          title={t('encryptedBackupExport')}
          confirmLabel={t('export')}
          onConfirm={exportBackup}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog === 'import' && (
        <PasswordDialog
          title={t('restoreBackup')}
          confirmLabel={t('restore')}
          onConfirm={importBackup}
          onCancel={() => setDialog(null)}
        />
      )}
    </div>
  );
}
