import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowSquareOut,
  Buildings,
  CheckCircle,
  IdentificationCard,
  SignIn,
  SignOut,
  UserCircle,
} from '@phosphor-icons/react';
import type { EgysProfile } from '@gysapp/contracts';
import {
  clearEgysToken,
  EGYS_EXTERNAL_LOGIN_URL,
  EGYS_GOOGLE_CLIENT_ID,
  exchangeGoogleCredentialForEgysToken,
  fetchEgysProfile,
  isTauriRuntime,
  listenForTauriEgysToken,
  loadGoogleIdentity,
  openTauriEgysLogin,
  readEgysToken,
  restoreEgysProfile,
  writeEgysToken,
} from './egys-session';
import './account.css';

function openExternal(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer');
}

function currentTheme(): 'light' | 'dark' {
  const explicit = document.documentElement.dataset.theme;
  if (explicit === 'dark') return 'dark';
  if (explicit === 'light') return 'light';
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function AccountPage() {
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const [profile, setProfile] = useState<EgysProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleReady, setGoogleReady] = useState(false);
  const native = isTauriRuntime();

  const acceptToken = useCallback(async (token: string) => {
    setAuthBusy(true);
    setError(null);
    try {
      const nextProfile = await fetchEgysProfile(token);
      writeEgysToken(token);
      setProfile(nextProfile);
    } catch {
      clearEgysToken();
      setProfile(null);
      setError('Login berhasil, tetapi profil e-GYS belum dapat dibaca. Silakan coba lagi.');
    } finally {
      setAuthBusy(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void restoreEgysProfile({ signal: controller.signal })
      .then(setProfile)
      .catch(() => setError('Profil e-GYS belum dapat dimuat. Periksa koneksi internet.'))
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!native) return;
    let dispose = () => undefined;
    void listenForTauriEgysToken((token) => void acceptToken(token)).then((unlisten) => {
      dispose = unlisten;
    });
    return () => dispose();
  }, [acceptToken, native]);

  useEffect(() => {
    if (native || profile || loading) return;
    let cancelled = false;
    void loadGoogleIdentity()
      .then((google) => {
        if (cancelled || !googleButtonRef.current) return;
        google.initialize({
          client_id: EGYS_GOOGLE_CLIENT_ID,
          auto_select: false,
          cancel_on_tap_outside: true,
          callback: (response) => {
            const credential = response.credential?.trim();
            if (!credential) {
              setError('Google tidak mengembalikan kredensial login.');
              return;
            }
            setAuthBusy(true);
            setError(null);
            void exchangeGoogleCredentialForEgysToken(credential)
              .then(acceptToken)
              .catch(() => {
                setError(
                  'Login Google belum dapat ditukar menjadi sesi e-GYS. Gunakan tombol buka e-GYS bila diperlukan.',
                );
                setAuthBusy(false);
              });
          },
        });
        googleButtonRef.current.replaceChildren();
        google.renderButton(googleButtonRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text: 'continue_with',
          width: 300,
        });
        setGoogleReady(true);
      })
      .catch(() => {
        if (!cancelled) {
          setGoogleReady(false);
          setError('Google Sign-In tidak dapat dimuat pada browser ini.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [acceptToken, loading, native, profile]);

  const loginNative = useCallback(async () => {
    setAuthBusy(true);
    setError(null);
    try {
      await openTauriEgysLogin(currentTheme());
      // Window auth berjalan terpisah; event token akan menyelesaikan loading.
      setAuthBusy(false);
    } catch {
      setAuthBusy(false);
      setError('Jendela login e-GYS belum dapat dibuka.');
    }
  }, []);

  const logout = useCallback(() => {
    clearEgysToken();
    setProfile(null);
    setError(null);
    setGoogleReady(false);
  }, []);

  if (loading) {
    return (
      <div className="content-shell account-page" aria-busy="true">
        <div className="account-loading-card">Memuat akun e-GYS…</div>
      </div>
    );
  }

  return (
    <div className="content-shell account-page">
      <header className="account-header">
        <div>
          <p className="account-eyebrow">e-GYS</p>
          <h1 className="section-title">Akun & Keanggotaan</h1>
          <p className="account-lead">
            Login langsung ke e-GYS. GYSApp hanya memakai sesi tersebut untuk membaca profil,
            status jemaat, dan cabang/wilayah gereja.
          </p>
        </div>
        <IdentificationCard size={38} weight="duotone" aria-hidden="true" />
      </header>

      {error && (
        <div className="account-alert" role="alert">
          {error}
        </div>
      )}

      {profile ? (
        <ProfileCard profile={profile} onLogout={logout} />
      ) : (
        <section className="account-login-card" aria-label="Login e-GYS">
          <div className="account-login-icon">
            <UserCircle size={44} weight="duotone" aria-hidden="true" />
          </div>
          <div>
            <h2>Masuk dengan akun e-GYS</h2>
            <p>
              Tidak ada akun GYSApp terpisah. Autentikasi dan data keanggotaan tetap berasal dari
              e-GYS.
            </p>
          </div>

          {native ? (
            <button
              type="button"
              className="btn-primary account-login-action"
              disabled={authBusy}
              onClick={() => void loginNative()}
            >
              <SignIn size={20} aria-hidden="true" /> {authBusy ? 'Membuka…' : 'Masuk ke e-GYS'}
            </button>
          ) : (
            <div className="account-google-wrap">
              <div
                ref={googleButtonRef}
                className="account-google-button"
                aria-label="Masuk dengan Google"
              />
              {!googleReady && !error && <span className="account-muted">Memuat Google Sign-In…</span>}
              {authBusy && <span className="account-muted">Menghubungkan ke e-GYS…</span>}
            </div>
          )}

          <button
            type="button"
            className="btn-secondary account-login-action"
            onClick={() => openExternal(EGYS_EXTERNAL_LOGIN_URL)}
          >
            <ArrowSquareOut size={20} aria-hidden="true" /> Buka situs e-GYS
          </button>

          <p className="account-security-note">
            Pada web, token hanya disimpan selama sesi tab/browser dan tidak ditulis ke localStorage.
          </p>
        </section>
      )}
    </div>
  );
}

function ProfileCard({ profile, onLogout }: { profile: EgysProfile; onLogout: () => void }) {
  return (
    <section className="account-profile-card">
      <div className="account-profile-top">
        {profile.profilePicture ? (
          <img className="account-avatar" src={profile.profilePicture} alt="" referrerPolicy="no-referrer" />
        ) : (
          <div className="account-avatar account-avatar-fallback">
            <UserCircle size={42} weight="duotone" aria-hidden="true" />
          </div>
        )}
        <div className="account-profile-copy">
          <div className="account-name-row">
            <h2>{profile.name ?? 'Pengguna e-GYS'}</h2>
            {profile.memberType && (
              <span className={`account-member-badge member-${profile.memberType.toLowerCase()}`}>
                <CheckCircle size={16} weight="fill" aria-hidden="true" /> {profile.memberType}
              </span>
            )}
          </div>
          {profile.email && <p className="account-muted">{profile.email}</p>}
        </div>
      </div>

      <div className="account-facts">
        <div className="account-fact">
          <Buildings size={24} weight="duotone" aria-hidden="true" />
          <div>
            <span>Cabang / Wilayah</span>
            <strong>{profile.branchName ?? 'Belum tersedia di profil e-GYS'}</strong>
          </div>
        </div>
        <div className="account-fact">
          <IdentificationCard size={24} weight="duotone" aria-hidden="true" />
          <div>
            <span>Status Keanggotaan</span>
            <strong>{profile.memberType ?? 'Belum dapat ditentukan'}</strong>
          </div>
        </div>
      </div>

      {profile.accountStatus && (
        <p className="account-status-line">Status akun e-GYS: {profile.accountStatus}</p>
      )}

      <div className="account-actions">
        <button type="button" className="btn-secondary" onClick={() => openExternal(EGYS_EXTERNAL_LOGIN_URL)}>
          <ArrowSquareOut size={19} aria-hidden="true" /> Buka e-GYS
        </button>
        <button type="button" className="btn-danger" onClick={onLogout}>
          <SignOut size={19} aria-hidden="true" /> Keluar dari GYSApp
        </button>
      </div>
    </section>
  );
}

export function hasStoredEgysSession(): boolean {
  return readEgysToken() !== null;
}
