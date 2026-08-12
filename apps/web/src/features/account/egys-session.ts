import type { EgysProfile } from '@gysapp/contracts';
import { normalizeEgysProfile } from '@gysapp/core';

const EGYS_ORIGIN = 'https://e.gys.or.id';
const EGYS_API_BASE = `${EGYS_ORIGIN}/api/v1`;
const SESSION_KEY = 'gysapp.egys.session.v1';
const LEGACY_PUBLIC_GOOGLE_CLIENT_ID =
  '705603488262-70g3bcfan59307rrk610m32n4uhf2tge.apps.googleusercontent.com';

export const EGYS_GOOGLE_CLIENT_ID =
  import.meta.env.VITE_EGYS_GOOGLE_CLIENT_ID || LEGACY_PUBLIC_GOOGLE_CLIENT_ID;

export class EgysAuthError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'EgysAuthError';
  }
}

export function readEgysToken(): string | null {
  try {
    const value = sessionStorage.getItem(SESSION_KEY)?.trim() ?? '';
    return value || null;
  } catch {
    return null;
  }
}

export function writeEgysToken(token: string): void {
  const normalized = token.trim();
  if (!normalized) return;
  try {
    // Deliberately session-only on web. Native persistence should use an OS-backed
    // secure store rather than localStorage/IndexedDB.
    sessionStorage.setItem(SESSION_KEY, normalized);
  } catch {
    // Memory-only login still works for the current render when storage is blocked.
  }
}

export function clearEgysToken(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // no-op
  }
}

function tokenFromExchangePayload(input: unknown): string | null {
  if (!input || typeof input !== 'object') return null;
  const root = input as Record<string, unknown>;
  const direct = typeof root.token === 'string' ? root.token.trim() : '';
  if (direct) return direct;
  if (root.data && typeof root.data === 'object') {
    const nested = (root.data as Record<string, unknown>).token;
    if (typeof nested === 'string' && nested.trim()) return nested.trim();
  }
  return null;
}

export async function exchangeGoogleCredentialForEgysToken(
  credential: string,
  options: { clientId?: string; fetchImpl?: typeof fetch; signal?: AbortSignal } = {},
): Promise<string> {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const clientId = options.clientId ?? EGYS_GOOGLE_CLIENT_ID;
  const body = new URLSearchParams({
    credential,
    select_by: 'btn',
    client_id: clientId,
  });
  const response = await fetchImpl(`${EGYS_ORIGIN}/auth/google/callbackgis`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
    },
    body: body.toString(),
    signal: options.signal,
  });
  if (!response.ok) throw new EgysAuthError('egys-google-exchange-failed', response.status);
  const token = tokenFromExchangePayload(await response.json());
  if (!token) throw new EgysAuthError('egys-token-missing');
  return token;
}

export async function fetchEgysProfile(
  token: string,
  options: { fetchImpl?: typeof fetch; signal?: AbortSignal } = {},
): Promise<EgysProfile> {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const response = await fetchImpl(`${EGYS_API_BASE}/users/profile`, {
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${token}`,
    },
    signal: options.signal,
  });
  if (!response.ok) throw new EgysAuthError('egys-profile-failed', response.status);
  return normalizeEgysProfile(await response.json());
}

export async function restoreEgysProfile(
  options: { fetchImpl?: typeof fetch; signal?: AbortSignal } = {},
): Promise<EgysProfile | null> {
  const token = readEgysToken();
  if (!token) return null;
  try {
    return await fetchEgysProfile(token, options);
  } catch (error) {
    if (error instanceof EgysAuthError && (error.status === 401 || error.status === 403)) {
      clearEgysToken();
      return null;
    }
    throw error;
  }
}

type TauriEvent<T> = { payload: T };
type TauriApi = {
  core: { invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> };
  event: {
    listen<T>(event: string, handler: (event: TauriEvent<T>) => void): Promise<() => void>;
  };
};

function getTauriApi(): TauriApi | null {
  return (
    (window as unknown as { __TAURI__?: TauriApi }).__TAURI__ ?? null
  );
}

export function isTauriRuntime(): boolean {
  return getTauriApi() !== null;
}

export async function openTauriEgysLogin(theme: 'light' | 'dark'): Promise<void> {
  const tauri = getTauriApi();
  if (!tauri) throw new EgysAuthError('tauri-not-available');
  await tauri.core.invoke('open_egys_login', { theme });
}

export async function listenForTauriEgysToken(
  onToken: (token: string) => void,
): Promise<() => void> {
  const tauri = getTauriApi();
  if (!tauri) return () => undefined;
  return tauri.event.listen<string>('egys-auth-token', (event) => {
    const token = String(event.payload ?? '').trim();
    if (token) onToken(token);
  });
}

export type GoogleIdentityApi = {
  initialize(options: {
    client_id: string;
    callback: (response: { credential?: string }) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
  }): void;
  renderButton(
    element: HTMLElement,
    options: {
      type?: 'standard' | 'icon';
      theme?: 'outline' | 'filled_blue' | 'filled_black';
      size?: 'large' | 'medium' | 'small';
      shape?: 'rectangular' | 'pill' | 'circle' | 'square';
      text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
      width?: number;
    },
  ): void;
  disableAutoSelect(): void;
};

type GoogleGlobal = { accounts?: { id?: GoogleIdentityApi } };

export function currentGoogleIdentity(): GoogleIdentityApi | null {
  return (window as unknown as { google?: GoogleGlobal }).google?.accounts?.id ?? null;
}

let googleScriptPromise: Promise<GoogleIdentityApi> | null = null;

/** Google Identity Services is the only runtime script exception for web auth. */
export function loadGoogleIdentity(): Promise<GoogleIdentityApi> {
  const existing = currentGoogleIdentity();
  if (existing) return Promise.resolve(existing);
  if (googleScriptPromise) return googleScriptPromise;

  googleScriptPromise = new Promise<GoogleIdentityApi>((resolve, reject) => {
    const already = document.querySelector<HTMLScriptElement>('script[data-gysapp-google-identity]');
    const script = already ?? document.createElement('script');
    const finish = () => {
      const api = currentGoogleIdentity();
      if (api) resolve(api);
      else reject(new EgysAuthError('google-identity-unavailable'));
    };
    const fail = () => reject(new EgysAuthError('google-identity-load-failed'));

    script.addEventListener('load', finish, { once: true });
    script.addEventListener('error', fail, { once: true });
    if (!already) {
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.dataset.gysappGoogleIdentity = 'true';
      document.head.appendChild(script);
    }
  }).catch((error) => {
    googleScriptPromise = null;
    throw error;
  });

  return googleScriptPromise;
}

export const EGYS_EXTERNAL_LOGIN_URL = `${EGYS_ORIGIN}/login`;
