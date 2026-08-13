const CLOUDFLARE_WEB_ANALYTICS_SRC = 'https://static.cloudflareinsights.com/beacon.min.js';
export const WEB_ANALYTICS_SCRIPT_ID = 'gysapp-cloudflare-web-analytics';

type TauriWindow = Window & { __TAURI__?: unknown };

export interface WebAnalyticsOptions {
  token?: string;
  prod?: boolean;
  windowObj?: Window;
  documentObj?: Document;
}

/**
 * Installs Cloudflare Web Analytics only for an explicitly configured production web build.
 * Native/Tauri builds always remain telemetry-free, even if a token leaks into the build env.
 */
export function installOptionalWebAnalytics(options: WebAnalyticsOptions = {}): boolean {
  const token = options.token?.trim();
  const prod = options.prod ?? import.meta.env.PROD;
  const windowObj = options.windowObj ?? window;
  const documentObj = options.documentObj ?? document;

  if (!prod || !token || (windowObj as TauriWindow).__TAURI__) return false;
  if (documentObj.getElementById(WEB_ANALYTICS_SCRIPT_ID)) return false;

  const script = documentObj.createElement('script');
  script.id = WEB_ANALYTICS_SCRIPT_ID;
  script.defer = true;
  script.src = CLOUDFLARE_WEB_ANALYTICS_SRC;
  script.setAttribute('data-cf-beacon', JSON.stringify({ token }));
  documentObj.head.appendChild(script);
  return true;
}
