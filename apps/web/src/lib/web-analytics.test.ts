import { afterEach, describe, expect, it } from 'vitest';
import { installOptionalWebAnalytics, WEB_ANALYTICS_SCRIPT_ID } from './web-analytics';

type MutableTauriWindow = Window & { __TAURI__?: unknown };

function resetAnalyticsDom() {
  document.getElementById(WEB_ANALYTICS_SCRIPT_ID)?.remove();
  delete (window as MutableTauriWindow).__TAURI__;
}

afterEach(resetAnalyticsDom);

describe('installOptionalWebAnalytics', () => {
  it('does nothing without explicit production opt-in', () => {
    expect(installOptionalWebAnalytics({ token: 'test-token', prod: false })).toBe(false);
    expect(installOptionalWebAnalytics({ prod: true })).toBe(false);
    expect(document.getElementById(WEB_ANALYTICS_SCRIPT_ID)).toBeNull();
  });

  it('never installs inside a Tauri runtime', () => {
    (window as MutableTauriWindow).__TAURI__ = {};
    expect(installOptionalWebAnalytics({ token: 'test-token', prod: true })).toBe(false);
    expect(document.getElementById(WEB_ANALYTICS_SCRIPT_ID)).toBeNull();
  });

  it('installs the configured Cloudflare beacon only once on production web', () => {
    expect(installOptionalWebAnalytics({ token: '  test-token  ', prod: true })).toBe(true);

    const script = document.getElementById(WEB_ANALYTICS_SCRIPT_ID) as HTMLScriptElement | null;
    expect(script).not.toBeNull();
    expect(script?.src).toBe('https://static.cloudflareinsights.com/beacon.min.js');
    expect(script?.defer).toBe(true);
    expect(script?.getAttribute('data-cf-beacon')).toBe('{"token":"test-token"}');

    expect(installOptionalWebAnalytics({ token: 'test-token', prod: true })).toBe(false);
    expect(document.querySelectorAll(`#${WEB_ANALYTICS_SCRIPT_ID}`)).toHaveLength(1);
  });
});
