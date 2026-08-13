import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../api/client';
import { ReportPage, reportErrorKey } from './report-page';

describe('ReportPage', () => {
  it('explains the optional gateway instead of sending to a broken /api fallback', () => {
    const submitReport = vi.fn();
    render(<ReportPage gatewayAvailable={false} submitReport={submitReport} />);

    expect(screen.getByText('Pengiriman masukan belum diaktifkan')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kirim' })).toBeDisabled();
    expect(submitReport).not.toHaveBeenCalled();
  });

  it('sends a normalized payload when the gateway is configured', async () => {
    const submitReport = vi.fn().mockResolvedValue(undefined);
    render(<ReportPage gatewayAvailable submitReport={submitReport} />);

    fireEvent.change(screen.getByLabelText('Perihal'), {
      target: { value: '  Masukan aplikasi  ' },
    });
    fireEvent.change(screen.getByLabelText('Pesan'), {
      target: { value: '  Mohon perbaiki tampilan.  ' },
    });
    fireEvent.change(screen.getByLabelText('Kontak (opsional)'), {
      target: { value: 'user@example.com' },
    });
    fireEvent.click(screen.getByRole('switch', { name: 'Kirim anonim' }));
    fireEvent.click(screen.getByRole('button', { name: 'Kirim' }));

    await waitFor(() =>
      expect(submitReport).toHaveBeenCalledWith({
        subject: 'Masukan aplikasi',
        message: 'Mohon perbaiki tampilan.',
        contact: 'user@example.com',
        anonymous: true,
      }),
    );
    expect(await screen.findByText(/masukan Anda telah terkirim/)).toBeInTheDocument();
  });

  it('maps gateway status codes to recovery copy', () => {
    expect(reportErrorKey(new ApiError('rate-limited', 429))).toBe('feedbackRateLimited');
    expect(reportErrorKey(new ApiError('not-configured', 503))).toBe('feedbackNotConfigured');
    expect(reportErrorKey(new ApiError('delivery-failed', 502))).toBe('feedbackDeliveryFailed');
  });
});
