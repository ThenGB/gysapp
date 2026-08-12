import {
  ArrowSquareOut,
  GlobeHemisphereWest,
  IdentificationCard,
  ShieldCheck,
} from '@phosphor-icons/react';
import { useT } from '../../i18n';
import { openExternalUrl } from '../../platform/open-external';
import './account.css';

export const EGYS_EXTERNAL_URL = 'https://e.gys.or.id/login';

export function AccountPage() {
  const { t } = useT();

  return (
    <div className="content-shell account-page">
      <header className="account-header">
        <div>
          <p className="account-eyebrow">{t('churchService')}</p>
          <h1 className="section-title">e-GYS</h1>
          <p className="account-lead">{t('egysExternalLead')}</p>
        </div>
        <IdentificationCard size={38} weight="duotone" aria-hidden="true" />
      </header>

      <section className="account-external-card" aria-labelledby="egys-external-title">
        <div className="account-login-icon">
          <GlobeHemisphereWest size={42} weight="duotone" aria-hidden="true" />
        </div>
        <div className="account-external-copy">
          <h2 id="egys-external-title">{t('openEgys')}</h2>
          <p>{t('egysOpenLead')}</p>
        </div>
        <button
          type="button"
          className="btn-primary account-login-action"
          onClick={() => void openExternalUrl(EGYS_EXTERNAL_URL)}
        >
          <ArrowSquareOut size={20} aria-hidden="true" /> {t('openEgysSite')}
        </button>
      </section>

      <aside className="account-privacy-note">
        <ShieldCheck size={24} weight="duotone" aria-hidden="true" />
        <div>
          <strong>{t('egysOwnLogin')}</strong>
          <p>{t('egysPrivacyLead')}</p>
        </div>
      </aside>
    </div>
  );
}
