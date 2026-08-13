import { afterEach, describe, expect, it, vi } from 'vitest';
import { openExternalUrl } from './open-external';

type TestTauriWindow = Window & {
  __TAURI__?: {
    opener?: {
      openUrl?: (url: string) => Promise<void>;
    };
  };
};

describe('openExternalUrl', () => {
  afterEach(() => {
    delete (window as TestTauriWindow).__TAURI__;
    vi.restoreAllMocks();
  });

  it('uses the browser fallback with noopener and noreferrer', async () => {
    const popup = { opener: window } as unknown as Window;
    const browserOpen = vi.spyOn(window, 'open').mockReturnValue(popup);

    await openExternalUrl('https://example.com/article');

    expect(browserOpen).toHaveBeenCalledWith(
      'https://example.com/article',
      '_blank',
      'noopener,noreferrer',
    );
    expect(popup.opener).toBeNull();
  });

  it('uses the Tauri system opener when available', async () => {
    const systemOpen = vi.fn().mockResolvedValue(undefined);
    (window as TestTauriWindow).__TAURI__ = { opener: { openUrl: systemOpen } };
    const browserOpen = vi.spyOn(window, 'open').mockReturnValue(null);

    await openExternalUrl('https://e.gys.or.id/login');

    expect(systemOpen).toHaveBeenCalledWith('https://e.gys.or.id/login');
    expect(browserOpen).not.toHaveBeenCalled();
  });

  it('rejects non-http protocols', async () => {
    await expect(openExternalUrl('javascript:alert(1)')).rejects.toThrow(
      'Unsupported external URL protocol',
    );
  });
});
