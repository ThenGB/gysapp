import { ArrowSquareOut, GlobeHemisphereWest, IdentificationCard, ShieldCheck } from '@phosphor-icons/react';
import { openExternalUrl } from '../../platform/open-external';
import './account.css';

export const EGYS_EXTERNAL_URL = 'https://e.gys.or.id/login';

export function AccountPage() {
  return (
    <div className="content-shell account-page">
      <header className="account-header">
        <div>
          <p className="account-eyebrow">Layanan Gereja</p>
          <h1 className="section-title">e-GYS</h1>
          <p className="account-lead">
            e-GYS adalah layanan web terpisah. Login, profil, dan data keanggotaan tetap dikelola
            langsung oleh situs e-GYS.
          </p>
        </div>
        <IdentificationCard size={38} weight="duotone" aria-hidden="true" />
      </header>

      <section className="account-external-card" aria-labelledby="egys-external-title">
        <div className="account-login-icon">
          <GlobeHemisphereWest size={42} weight="duotone" aria-hidden="true" />
        </div>
        <div className="account-external-copy">
          <h2 id="egys-external-title">Buka e-GYS</h2>
          <p>
            GYSApp akan membuka e-GYS di browser sistem. Anda masuk dan menggunakan layanan tersebut
            langsung di situs resminya.
          </p>
        </div>
        <button
          type="button"
          className="btn-primary account-login-action"
          onClick={() => void openExternalUrl(EGYS_EXTERNAL_URL)}
        >
          <ArrowSquareOut size={20} aria-hidden="true" /> Buka situs e-GYS
        </button>
      </section>

      <aside className="account-privacy-note">
        <ShieldCheck size={24} weight="duotone" aria-hidden="true" />
        <div>
          <strong>Login tetap milik e-GYS</strong>
          <p>
            GYSApp tidak meminta, menerima, atau menyimpan password, token login, cookie sesi,
            maupun profil e-GYS.
          </p>
        </div>
      </aside>
    </div>
  );
}
