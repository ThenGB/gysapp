import { useCallback, useState } from 'react';
import { PaperPlaneTilt } from '@phosphor-icons/react';
import { apiFetch } from '../../api/client';
import '../settings/settings.css';

export function ReportPage() {
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
      <h1 className="section-title">Kirim Masukan</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="settings-row">
          <label htmlFor="report-subject">Perihal</label>
          <input
            id="report-subject"
            className="faith-search"
            value={subject}
            maxLength={200}
            onChange={(e) => setSubject(e.target.value)}
            required
          />
        </div>
        <div className="settings-row">
          <label htmlFor="report-message">Pesan</label>
          <textarea
            id="report-message"
            className="faith-search report-message"
            rows={6}
            value={message}
            maxLength={5000}
            onChange={(e) => setMessage(e.target.value)}
            required
          />
        </div>
        <div className="settings-row">
          <label htmlFor="report-contact">Kontak (opsional)</label>
          <input
            id="report-contact"
            type="email"
            className="faith-search"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
          />
        </div>
        <div className="settings-row">
          <label htmlFor="report-anon">Kirim anonim</label>
          <button
            id="report-anon"
            type="button"
            role="switch"
            aria-checked={anonymous}
            className={`switch${anonymous ? ' switch-on' : ''}`}
            onClick={() => setAnonymous((v) => !v)}
          >
            <span className="switch-thumb" />
          </button>
        </div>
        <div className="settings-row">
          <button type="submit" className="btn-primary" disabled={!canSend}>
            <PaperPlaneTilt size={20} aria-hidden="true" /> Kirim
          </button>
        </div>
        {status === 'sent' && (
          <p className="settings-feedback" role="status">
            Terima kasih, masukan Anda telah terkirim.
          </p>
        )}
        {status === 'error' && (
          <p className="midi-error" role="alert">
            Gagal mengirim: {error}
          </p>
        )}
      </form>
    </div>
  );
}
