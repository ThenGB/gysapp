type TauriOpenerGlobal = Window & {
  __TAURI__?: {
    opener?: {
      openUrl?: (url: string) => Promise<void>;
    };
  };
};

function assertExternalUrl(rawUrl: string): URL {
  const url = new URL(rawUrl);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`Unsupported external URL protocol: ${url.protocol}`);
  }
  return url;
}

/**
 * Buka URL menggunakan browser/aplikasi sistem pada Tauri, dan tab baru pada web.
 * Tidak pernah memuat dokumen remote ke main webview GYSApp.
 */
export async function openExternalUrl(rawUrl: string): Promise<void> {
  const url = assertExternalUrl(rawUrl).toString();
  const tauriWindow = window as TauriOpenerGlobal;
  const openUrl = tauriWindow.__TAURI__?.opener?.openUrl;
  if (openUrl) {
    await openUrl(url);
    return;
  }

  const opened = window.open(url, '_blank', 'noopener,noreferrer');
  if (opened) opened.opener = null;
}
