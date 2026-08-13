import { useCallback, useState } from 'react';
import { Info, PaperPlaneTilt } from '@phosphor-icons/react';
import { ApiError, apiFetch } from '../../api/client';
import { contentSource } from '../../api/static-content';
import { useT, type TranslationKey } from '../../i18n';
import '../settings/settings.css';

type ReportPayload = {
  subject: string;
  message: string;
  contact?: string;
  anonymous: boolean;
};

export interface ReportPageProps {
  gatewayAvailable?: boolean;
  submitReport?: (payload: ReportPayload) => Promise<void>;
}

async function submitReportToGateway(payload: ReportPayload): Promise<void> {
  await apiFetch<{ ok: boolean }>('/report', {
    method: 'POST',
    body: payload,
  });
}

export function reportErrorKey(error: unknown): TranslationKey {
  if (error instanceof ApiError) {
    if (error.status === 429) return 'feedbackRateLimited';
    if (error.status === 503) return 'feedbackNotConfigured';
    if (error.status === 502) return 'feedbackDeliveryFailed';
  }
  return 'feedbackUnexpectedError';
}

export function ReportPage({
  gatewayAvailable = contentSource() === 'gateway',
  submitReport = submitReportToGateway,
}: ReportPageProps = {}) {
  const { t } = useT();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [contact, setContact] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorKey, setErrorKey] = useState<TranslationKey | null>(null);

  const submit = useCallback(async () => {
    if (!gatewayAvailable) return;
    setStatus('sending');
    setErrorKey(null);
    try {
      await submitReport({
        subject: subject.trim(),
        message: message.trim(),
        contact: contact.trim() || undefined,
        anonymous,
      });
      setStatus('sent');
      setSubject('');
      setMessage('');
    } catch (error) {
      setStatus('error');
      setErrorKey(reportErrorKey(error));
    }
  }, [anonymous, contact, gatewayAvailable, message, subject, submitReport]);

  const canSend =
    gatewayAvailable &&
    subject.trim().length > 0 &&
    message.trim().length > 0 &&
    status !== 'sending';

  return (
    <div className="content-shell settings-page">
      <h1 className="section-title">{t('sendFeedback')}</h1>
      {!gatewayAvailable && (
        <div className="settings-info-panel" role="status">
          <Info size={20} aria-hidden="true" />
          <div>
            <strong>{t('feedbackGatewayUnavailable')}</strong>
            <p>{t('feedbackGatewayUnavailableLead')}</p>
          </div>
        </div>
      )}
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
            <PaperPlaneTilt size={20} aria-hidden="true" />{' '}
            {status === 'sending' ? t('sending') : t('send')}
          </button>
        </div>
        {status === 'sent' && (
          <p className="settings-feedback" role="status">
            {t('feedbackSent')}
          </p>
        )}
        {status === 'error' && errorKey && (
          <p className="midi-error" role="alert">
            {t(errorKey)}
          </p>
        )}
      </form>
    </div>
  );
}
