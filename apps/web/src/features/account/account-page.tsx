import { useCallback, useEffect, useState } from 'react';
import { SignOut, UserCircle } from '@phosphor-icons/react';
import type { AccountProfile } from '@gysapp/contracts';
import { apiFetch } from '../../api/client';
import '../settings/settings.css';

export function AccountPage() {
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try { setProfile(await apiFetch<AccountProfile>('/auth/me')); } catch { setProfile(null); } finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const login = useCallback(async () => {
    try {
      const redirectTarget = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}/account`;
      const { url } = await apiFetch<{ url: string }>(`/auth/oauth/google/start?redirect=${encodeURIComponent(redirectTarget)}`);
      window.location.assign(url);
    } catch { setError('Login Google belum dikonfigurasi di server.'); }
  }, []);

  const logout = useCallback(async () => {
    try { await apiFetch<{ ok: boolean }>('/auth/logout', { method: 'POST' }); } finally { setProfile(null); }
  }, []);

  if (loading) return <div className="content-shell settings-page">Memuat…</div>;
  return (
    <div className="content-shell settings-page">
      <h1 className="section-title">Akun</h1>
      {error && <p className="midi-error" role="alert">{error}</p>}
      {profile ? (
        <div className="settings-row">
          <div className="account-profile">
            {profile.picture ? <img className="account-avatar" src={profile.picture} alt="" /> : <UserCircle size={48} aria-hidden="true" />}
            <div><p className="account-name">{profile.name ?? profile.email ?? profile.sub}</p>{profile.email && <p className="account-email">{profile.email}</p>}</div>
          </div>
          <button type="button" className="btn-danger" onClick={() => void logout()}><SignOut size={20} aria-hidden="true" /> Keluar</button>
        </div>
      ) : (
        <div className="settings-row"><p>Masuk untuk menyinkronkan data Anda.</p><button type="button" className="btn-primary" onClick={() => void login()}>Masuk dengan Google</button></div>
      )}
      <p className="settings-hint">Login memakai OAuth Google melalui BFF. State diverifikasi server-side dan sesi disimpan hanya dalam cookie HttpOnly.</p>
    </div>
  );
}
