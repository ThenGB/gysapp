import { Link } from 'react-router-dom';
import {
  BookOpenText,
  Newspaper,
  BookBookmark,
  Feather,
  DownloadSimple,
  Gear,
  PaperPlaneTilt,
  PencilLine,
  Broadcast,
  Headphones,
  InstagramLogo,
  FacebookLogo,
  YoutubeLogo,
  SpotifyLogo,
  GlobeHemisphereWest,
  UserCircle,
} from '@phosphor-icons/react';
import { useT, type TranslationKey } from '../../i18n';
import { openExternalUrl } from '../../platform/open-external';
import './more.css';

type IconComponent = typeof BookOpenText;

type LiteratureItem = {
  kind: string;
  labelKey: TranslationKey;
  icon: IconComponent;
};

type ExternalItem = {
  href: string;
  icon: IconComponent;
  label?: string;
  labelKey?: TranslationKey;
};

const LITERATURE: LiteratureItem[] = [
  { kind: 'kesaksian', labelKey: 'literatureWitness', icon: BookOpenText },
  { kind: 'warta', labelKey: 'literatureWarta', icon: Newspaper },
  { kind: 'renungan', labelKey: 'literatureDevotion', icon: Feather },
  { kind: 'panduan', labelKey: 'literatureGuide', icon: BookBookmark },
];

const EXTERNAL: ExternalItem[] = [
  { href: 'https://Bible.tjc.org', label: 'eRhema', icon: GlobeHemisphereWest },
  { href: 'https://pelitakecil.com/', label: 'Pelita Kecil', icon: BookOpenText },
  {
    href: 'https://tjc.org/id/pujian/pujian-padus',
    labelKey: 'worshipChoir',
    icon: Broadcast,
  },
  { href: 'https://tjc.org/id/literatur/buku', labelKey: 'books', icon: BookOpenText },
  { href: 'https://tjc.org/id/sabat/', labelKey: 'onlineService', icon: Broadcast },
  {
    href: 'https://tjc.org/id/audio-khotbah/',
    labelKey: 'sermonAudio',
    icon: Headphones,
  },
  {
    href: 'https://tjc.org/id/video-khotbah/',
    labelKey: 'sermonVideo',
    icon: YoutubeLogo,
  },
  {
    href: 'https://www.youtube.com/channel/UCnKhYlQA5iJJvobPF4IYJFQ',
    label: 'Podcast',
    icon: YoutubeLogo,
  },
  { href: 'https://www.facebook.com/gerejayesussejati/', label: 'Facebook', icon: FacebookLogo },
  { href: 'https://www.instagram.com/gerejayesussejati/', label: 'Instagram', icon: InstagramLogo },
  {
    href: 'https://www.youtube.com/channel/UCAHSLvPBcg2M-_N1VQfhxrg',
    label: 'YouTube',
    icon: YoutubeLogo,
  },
  {
    href: 'https://open.spotify.com/show/4edDo52t3IlkgiWhBnk1GK',
    label: 'Spotify',
    icon: SpotifyLogo,
  },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title}>
      <h2 className="section-title">{title}</h2>
      {children}
    </section>
  );
}

export function MorePage() {
  const { t } = useT();
  const notes = [
    { to: '/notes/bible', label: t('bibleNotes'), icon: PencilLine },
    { to: '/notes/song', label: t('hymnNotes'), icon: PencilLine },
    { to: '/notes/faith', label: t('faithNotes'), icon: PencilLine },
  ];

  return (
    <div className="content-shell more-page">
      <h1 className="section-title">{t('more')}</h1>

      <Section title={t('accountEgys')}>
        <ul className="more-grid">
          <li>
            <Link to="/account" className="more-card">
              <UserCircle size={26} weight="duotone" aria-hidden="true" />
              <span>{t('accountMembership')}</span>
            </Link>
          </li>
          <li>
            <button
              type="button"
              className="more-card"
              onClick={() => void openExternalUrl('https://e.gys.or.id')}
            >
              <GlobeHemisphereWest size={26} aria-hidden="true" />
              <span>{t('openEgysSite')}</span>
            </button>
          </li>
        </ul>
      </Section>

      <Section title={t('literatureAndReading')}>
        <ul className="more-grid">
          {LITERATURE.map((item) => (
            <li key={item.kind}>
              <Link to={`/literature/${item.kind}`} className="more-card">
                <item.icon size={26} aria-hidden="true" />
                <span>{t(item.labelKey)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={t('mediaAndLinks')}>
        <ul className="more-grid">
          {EXTERNAL.map((item) => (
            <li key={item.href}>
              <button
                type="button"
                className="more-card"
                onClick={() => void openExternalUrl(item.href)}
              >
                <item.icon size={26} aria-hidden="true" />
                <span>{item.labelKey ? t(item.labelKey) : item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={t('notesAndCollections')}>
        <ul className="more-grid">
          {notes.map((item) => (
            <li key={item.to}>
              <Link to={item.to} className="more-card">
                <item.icon size={26} aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={t('downloadsAndSettings')}>
        <ul className="more-grid">
          <li>
            <Link to="/settings" className="more-card">
              <DownloadSimple size={26} aria-hidden="true" />
              <span>{t('downloadsAndStorage')}</span>
            </Link>
          </li>
          <li>
            <Link to="/settings" className="more-card">
              <Gear size={26} aria-hidden="true" />
              <span>{t('settings')}</span>
            </Link>
          </li>
          <li>
            <Link to="/report" className="more-card">
              <PaperPlaneTilt size={26} aria-hidden="true" />
              <span>{t('sendFeedback')}</span>
            </Link>
          </li>
        </ul>
      </Section>
    </div>
  );
}
