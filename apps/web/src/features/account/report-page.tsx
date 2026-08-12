import { useCallback, useState } from 'react';
import { PaperPlaneTilt } from '@phosphor-icons/react';
import { apiFetch } from '../../api/client';
import { useT } from '../../i18n';
import '../settings/settings.css';

export function ReportPage() {
  const { t } = useT();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [contact, setContact] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async () => {
    setStatus('sending');
    setError(null);
    try {
      await apiFetch<{ ok: boolean }>('/report', {
        method: 'POST',
        body: {
          subject: subject.trim(),
          message: message.trim(),
          contact: contact.trim() || undefined,
          anonymous,
        },
      });
      setStatus('sent');
      setSubject('');
      setMessage('');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [subject, message, contact, anonymous]);

  const canSend = subject.trim().length > 0 && message.trim().length > 0 && status !== 'sending';

  return (
    <div className="content-shell settings-page">
      <h1 className="section-title">{t('sendFeedback')}</h1>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="settings-row">
          <label htmlFor="report-subject">{t('subject')}</label>
          <input
            id="report-subject"
            className="faith-search"
            value={subject}
            maxLength={200}
            onChange={(event) => setSubject(event.target.value)}
            required
          />
        </div>
        <div className="settings-row">
          <label htmlFor="report-message">{t('message')}</label>
          <textarea
            id="report-message"
            className="faith-search report-message"
            rows={6}
            value={message}
            maxLength={5000}
            onChange={(event) => setMessage(event.target.value)}
            required
          />
        </div>
        <div className="settings-row">
          <label htmlFor="report-contact">{t('optionalContact')}</label>
          <input
            id="report-contact"
            type="email"
            className="faith-search"
            value={contact}
            onChange={(event) => setContact(event.target.value)}
          />
        </div>
        <div className="settings-row">
          <label htmlFor="report-anon">{t('sendAnonymous')}</label>
          <button
            id="report-anon"
            type="button"
            role="switch"
            aria-checked={anonymous}
            className={`switch${anonymous ? ' switch-on' : ''}`}
            onClick={() => setAnonymous((value) => !value)}
          >
            <span className="switch-thumb" />
          </button>
        </div>
        <div className="settings-row">
          <button type="submit" className="btn-primary" disabled={!canSend}>
            <PaperPlaneTilt size={20} aria-hidden="true" /> {t('send')}
          </button>
        </div>
        {status === 'sent' && (
          <p className="settings-feedback" role="status">
            {t('feedbackSent')}
          </p>
        )}
        {status === 'error' && (
          <p className="midi-error" role="alert">
            {t('sendFailed')} {error}
          </p>
        )}
      </form>
    </div>
  );
}
