# GYSApp Web/Tauri — Implementation Roadmap

Audit: 13 Agustus 2026

## Target produk

GYSApp menjadi satu codebase web-native untuk PWA, Windows, Android, dan iOS. React/TypeScript menjadi product surface utama; Tauri hanya menyediakan bridge platform. `GYSAPP-Fork` adalah kontrak parity/asset legacy, sedangkan `gyspnk/gyschordweb` menjadi referensi web-native untuk PDF/chord/MIDI.

## Prinsip arsitektur

1. **Web-first, wrapper-thin.** Feature utama berada di `apps/web` + `packages/core`.
2. **Backendless-first.** Local reading/worship feature tidak bergantung server GYSApp.
3. **Static-snapshot-first untuk konten online.** Runtime normal membaca JSON lokal; sync server-side memperbarui konten berkala.
4. **Remote services stay remote.** e-GYS dibuka sebagai situs eksternal; GYSApp tidak memiliki token/profile/session e-GYS.
5. **Pure core.** Parser, cache, search, transpose, playlist, backup, dan transformasi data dapat dites tanpa DOM.
6. **Ports/adapters.** IndexedDB/filesystem/SQLite/platform opener disembunyikan di adapter.
7. **Progressive assets.** Aset besar dipasang/cached saat dibutuhkan dan diverifikasi sebelum aktivasi.
8. **No legacy secrets.** Credential rahasia Flutter lama tidak boleh disalin ke source baru.
9. **Accessibility is product behavior.** Target sentuh, keyboard, contrast, reduced motion, dan large UI bukan add-on.

## Status fondasi

Sudah tersedia dan terverifikasi:

- pnpm monorepo `apps/web`, `apps/edge`, `apps/native`, `packages/core`, `packages/contracts`;
- React + TypeScript strict, Vite, Vitest, Playwright;
- shell responsif mobile dock / tablet rail / desktop sidebar;
- route-level lazy loading; initial production JavaScript sekitar **134 KiB gzip**, dipagari hard budget 250 KiB;
- PWA + GitHub Pages;
- Bible SQLite + TB/KJV/CUV asset manager, SHA-256, cancel/retry/resume, split reader, history/bookmark, TTS;
- contextual Bible refs/paralel dengan nama kitab, dedup, deep-link ayat, copy/bookmark/read actions, dan inline contextual notes;
- accessibility regression: 320–1920, effective 200% browser-zoom reflow, keyboard focus, reduced motion, serta automated light/dark WCAG contrast checks;
- full Hymnal catalog, KR PDF/MIDI, web-native chord extraction, lazy immutable chord cache;
- app-level MIDI player + playlist previous/next, loop/shuffle, auto-advance;
- Web Audio lifecycle nyata (`AudioBufferSourceNode.start`) + rapid-load guard;
- PDF rapid-switch guard + stale loading-task cancellation;
- persistent offline soundfont/MIDI/PDF cache dengan bounded LRU dan safe cleanup di Settings;
- shared chord-cache cleanup + Settings storage navigation tanpa menghapus Bible/bookmark/history/playlist/notes;
- Home resume untuk ayat terakhir dan recent hymn yang persisted;
- encrypted backup, settings/i18n ID/EN/ZH untuk journey utama, 10 Pokok Iman + multi-select/copy/share, literature/content surfaces;
- snapshot konten TJC default termasuk 14 Panduan Alkitab yang disinkronkan GitHub Actions setiap 6 jam;
- optional Cloudflare near-live content/report gateway; Kirim Masukan mendeteksi gateway yang tidak dikonfigurasi dan tidak mencoba `/api/report` yang rusak;
- Windows Tauri compile gate;
- Android ARM64 APK compile gate yang memverifikasi `id.sch.kanaan.egys` dan versionCode 134;
- iOS Xcode simulator compile gate pada macOS;
- semua external URL feature melewati `openExternalUrl()`; browser memakai `noopener,noreferrer`, Tauri memakai system opener;
- pengingat Sabat Jumat 17:00 + pengingat baca Alkitab per-hari/waktu memakai scheduled native notification, persisted di Settings v2 dan ikut encrypted backup;
- CI Playwright menjalankan artefak production `dist` melalui `vite preview`, dengan lab guard Home LCP <=2.5s dan CLS <=0.1.

## P0 — milestone PR #4

### A. Bible/mobile stability — verified

Sudah lolos gate:

- fixture/typecheck/unit/build/format/Playwright/secret scan;
- reader 1/2 panel pada mobile/tablet landscape;
- state reader, history/bookmark/last-location;
- download pack cancel/retry/resume + atomic activation;
- TTS voice matching/controller;
- contextual refs/paralel dengan deep-link langsung ke target ayat;
- contextual note create/update/delete tanpa duplikasi target;
- viewport matrix 320, 360, 390, 600, 768, 1024, 1440, 1920;
- effective CSS viewport equivalent browser zoom 200%;
- keyboard-only primary navigation + visible focus ring;
- reduced-motion regression dan deep-link scroll tanpa forced smooth animation.

Masih untuk P1/release polish:

- real-device light/dark/system accessibility/WCAG soak. Automated contrast regression sudah aktif dan hijau.

### B. Hymnal finishing — verified core

Sudah masuk dan lolos regression gate:

- true PDF autofit berdasarkan container + viewport;
- DPR-aware canvas rendering;
- 1/2 page + fit page/width + zoom 70–200%;
- portrait/landscape guidance;
- restore per lagu: mode/page/fit/zoom/transpose/scroll;
- chord extraction terpisah dari canvas rerender;
- sharp/mol + transpose sync viewer/player;
- app-level MIDI dock lintas route tanpa overlap nav/content;
- playlist shared state, create/activate/rename/dedup/add/remove/reorder;
- previous/next mengikuti active playlist;
- loop/shuffle semantics + auto-advance;
- actual Web Audio source playback, pause/resume/seek;
- tempo reset antartrack dan stale MIDI load guard;
- stale PDF loading task cancellation saat rapid song switch;
- Playwright viewport/orientation/player persistence regression;
- persistent soundfont + MIDI cache;
- persistent PDF cache yang tetap abortable saat rapid song switch;
- 192 MB media budget dengan LRU untuk MIDI/PDF dan pinned soundfont;
- Settings menampilkan ukuran/cache count dan dapat menghapus media + chord offline tanpa menyentuh Bible/bookmark/history/playlist/notes;
- mode teks/chord dipagari narrow-width regression 320px: chord badge di-clamp ke baris, emergency wrapping tersedia, dan font lirik tetap >=16px.

Sisa Hymnal untuk P1:

- real-device long-song MIDI/PDF performance soak. Automated narrow-width text/chord fitting sudah selesai tanpa aggressive font shrinking.

### C. e-GYS boundary — final

- e-GYS = external service di `https://e.gys.or.id`;
- GYSApp tidak melakukan Google Identity, token exchange, profile fetch, atau session persistence;
- tidak ada auth webview bridge pada Tauri;
- web membuka external surface; Tauri memakai system browser melalui opener;
- tidak ada kebutuhan Cloudflare/OAuth/secure-token storage untuk e-GYS;
- E2E memastikan surface e-GYS tetap berada di luar app-owned auth boundary.

Jika suatu hari fitur inti membutuhkan API e-GYS, integrasi harus dimulai dengan requirement dan ADR baru.

### D. Android continuity

Sudah:

- identifier `id.sch.kanaan.egys`;
- versionCode 134 setelah Flutter `+133`;
- PR compile gate menghasilkan debug ARM64 APK dan memverifikasi identity/versionCode;
- signed-release workflow hanya menerima keystore/password melalui GitHub Secrets;
- signed-release workflow mewajibkan `ANDROID_CERT_SHA256` dan menolak keystore dengan sertifikat berbeda.

Masih eksternal-blocked:

- production signed AAB/APK + upgrade/install smoke membutuhkan keystore production lama dan fingerprint sertifikat yang benar dari keystore/Play Console;
- jangan membuat signing key baru kecuali sengaja memutus application identity.

### E. Native CI — verified compile gates

- **Windows:** frontend build -> Cargo check -> Tauri release no-bundle;
- **Android:** Tauri debug ARM64 APK -> verify package/versionCode -> short-lived CI artifact;
- **iOS:** Tauri `ios init` -> verify bundle identity -> Xcode simulator build;
- signed IPA/App Store tetap menunggu Apple signing/provisioning.

## P1 — UI/UX release polish

Arah visual: **minimal worship utility**, bukan dashboard SaaS.

- GYS blue sebagai accent, bukan memenuhi semua surface;
- hierarchy melalui typography, whitespace, thin border, dan grouping;
- shadow ringan; hindari dekorasi berlebihan;
- logo resmi GYS/TJC sebagai anchor identitas;
- mobile floating dock stabil dan selalu berlabel;
- tablet rail/desktop sidebar konsisten;
- touch target minimum 48px;
- reader comfort modes feature kelas satu;
- motion 160–260ms + `prefers-reduced-motion`;
- loading/error/download state selalu memiliki feedback/recovery.

## P1 — feature parity tersisa

### Bible / Settings

- real-device light/dark/system accessibility soak; automated contrast/reflow/keyboard/reduced-motion gates sudah aktif.

### Hymnal

- real-device long-song MIDI/PDF performance soak; narrow-width text/chord readability sudah dipagari otomatis.

### Literature / Faith / More

- i18n ID/EN/ZH sudah mencakup journey utama termasuk Home, Bible chrome/context/search, Faith, Literatur/Panduan, Lainnya, Settings/backup/cache/reminder, e-GYS, Kirim Masukan, Catatan, serta daftar/playlist/viewer Pujian;
- external links Home/Literatur/Lainnya/e-GYS memakai satu platform opener adapter;
- Kirim Masukan adalah capability gateway opsional: deployment backendless menampilkan unavailable state yang eksplisit; deployment gateway menangani success serta 429/502/503 dengan recovery copy.

## Online content architecture — audited

Runtime normal **tidak membutuhkan Cloudflare Worker** untuk membaca konten TJC.

- `contentSource()` memakai snapshot statis bila `VITE_CONTENT_GATEWAY_BASE` tidak diset;
- `sync-content.yml` mengambil Sauh, Suara Sejati, Kesaksian, Warta, Renungan, dan Panduan Alkitab dari `tjc.org` setiap 6 jam;
- parser snapshot sama dengan parser edge;
- browser tidak perlu mem-fetch/parse HTML TJC lintas-origin untuk cold-start/journey normal;
- Worker tetap opsional untuk near-live content dan `/api/report` bila webhook perlu dirahasiakan; tanpa gateway, UI Kirim Masukan dinonaktifkan secara eksplisit alih-alih jatuh ke `/api` lokal/404.

Konsekuensinya, deployment tanpa Cloudflare tetap merupakan konfigurasi production yang valid. Detail keputusan ada di ADR-0003.

## Quality gates

### Per PR — aktif dan hijau pada milestone current head

- TypeScript strict;
- unit/component tests;
- fixture integrity;
- production frontend build;
- Prettier;
- Playwright Chromium production-preview desktop/mobile/accessibility matrix;
- initial JavaScript gzip budget 250 KiB;
- lab Web Vitals guard Home LCP <=2.5s / CLS <=0.1;
- secret scan;
- Windows Tauri compile;
- Android Tauri APK compile + identity verification;
- iOS Xcode simulator compile.

### Sebelum beta/release signed

Sudah otomatis:

- viewport 320, 360, 390, 600, 768, 1024, 1440, 1920;
- portrait/landscape mobile/tablet journey utama;
- effective reflow equivalent browser zoom 200%;
- keyboard-only primary navigation;
- reduced motion;
- corrupted/interrupted Bible asset update fixtures;
- PDF rapid-switch cancellation;
- MIDI source/seek/load race regression.

Masih manual/real-device:

- real-device light/dark/system contrast/accessibility soak;
- real-device delivery/timing pengingat Sabat dan baca Alkitab pada OS target;
- real-device long-song MIDI/PDF performance soak;
- field/RUM Web Vitals (terutama INP dan p75) setelah deployment beta stabil;
- Android signed upgrade/install smoke menggunakan signing identity lama;
- iOS signed distribution smoke setelah provisioning tersedia.

### Performance budgets

- initial JS <250 KiB gzip — **achieved (~134 KiB gzip)**;
- PDF/MIDI/heavy feature code lazy-loaded;
- local navigation tidak menunggu network;
- warm local search p95 <100ms pada target mid-range;
- production target LCP <2.5s p75, INP <200ms, CLS <0.1.

## Urutan eksekusi berikutnya

1. Jalankan real-device light/dark/system accessibility, scheduled-notification delivery, dan MIDI/PDF long-song soak.
2. Kumpulkan field/RUM Web Vitals setelah deployment beta stabil; production-preview lab regression sudah otomatis.
3. Jalankan Android production signed upgrade smoke setelah legacy keystore + fingerprint tersedia.
4. Tambahkan signed iOS distribution setelah provisioning/signing Apple tersedia.

## Definition of done

Migrasi selesai ketika semua menu utama Flutter memiliki ekuivalen web/Tauri atau keputusan `n/a` yang terdokumentasi; fitur inti berjalan tanpa backend GYSApp; e-GYS tetap di luar trust boundary aplikasi; chord/PDF/MIDI dan Bible dapat dipakai offline setelah aset tersedia; Android mempertahankan upgrade identity lama; web/native memakai core logic yang sama; dan journey utama lulus desktop/mobile/native, accessibility, security, serta release gates.
