# GYSApp Web/Tauri — Implementation Roadmap

Audit: 12 Agustus 2026

## Target produk

GYSApp menjadi satu codebase web-native untuk PWA, Windows, Android, dan iOS. React/TypeScript menjadi product surface utama; Tauri hanya menyediakan bridge platform. `GYSAPP-Fork` adalah kontrak parity/asset legacy, sedangkan `gyspnk/gyschordweb` menjadi referensi web-native untuk PDF/chord/MIDI.

## Prinsip arsitektur

1. **Web-first, wrapper-thin.** Feature utama berada di `apps/web` + `packages/core`.
2. **Backendless-first.** Local reading/worship feature tidak bergantung server GYSApp.
3. **Remote services stay remote.** e-GYS dibuka sebagai situs eksternal; GYSApp tidak memiliki token/profile/session e-GYS.
4. **Pure core.** Parser, cache, search, transpose, playlist, backup, dan transformasi data dapat dites tanpa DOM.
5. **Ports/adapters.** IndexedDB/filesystem/SQLite/platform opener disembunyikan di adapter.
6. **Progressive assets.** Aset besar dipasang/cached saat dibutuhkan dan diverifikasi sebelum aktivasi.
7. **No legacy secrets.** Credential rahasia Flutter lama tidak boleh disalin ke source baru.
8. **Accessibility is product behavior.** Target sentuh, keyboard, contrast, reduced motion, dan large UI bukan add-on.

## Status fondasi

Sudah tersedia:

- pnpm monorepo `apps/web`, `apps/edge`, `apps/native`, `packages/core`, `packages/contracts`;
- React + TypeScript strict, Vite, Vitest, Playwright;
- shell responsif mobile dock / tablet rail / desktop sidebar;
- PWA + GitHub Pages;
- Bible SQLite + TB/KJV/CUV asset manager, SHA-256, cancel/retry/resume, split reader, history/bookmark, TTS;
- full Hymnal catalog, KR PDF/MIDI, web-native chord extraction, lazy immutable chord cache;
- playlist, loop/shuffle, encrypted backup, settings/i18n;
- 10 Pokok Iman + literature/content surfaces;
- optional Cloudflare content/report gateway;
- Tauri Windows/Android foundation dengan identifier Android legacy `id.sch.kanaan.egys`.

## P0 — milestone PR #4

### A. Bible/mobile stability

- seluruh fixture/typecheck/unit/build/format gate hijau;
- reader tetap nyaman pada 320–1920px dan browser zoom 200%;
- 1/2 pane tidak kehilangan state saat rotate/resize;
- download pack dapat cancel/retry dan library refresh tanpa restart;
- history/bookmark/last-location tahan reload;
- TTS voice matching tidak mengunci UI setelah drag/navigation.

### B. Hymnal finishing

Implementasi yang sudah masuk dan masih harus melewati regression gate:

- true PDF autofit berdasarkan container + viewport, bukan hanya CSS `max-width`;
- DPR-aware canvas rendering untuk partitur tajam tanpa bitmap berlebihan;
- 1/2 page + fit page/width + zoom 70–200%;
- restore per lagu: mode, page mode, fit, zoom, transpose, dan scroll;
- chord extraction dipisahkan dari canvas rerender supaya resize/zoom tidak mengulang kerja mahal;
- sharp/mol + transpose tersinkron dengan display chord;
- app-level MIDI dock yang tetap hidup lintas route dan lazy-loaded;
- shell memberi ruang kepada player supaya tidak menutupi konten/nav;
- playlist state bersama, create/activate, rename, case-insensitive name dedup, add/remove;
- reorder memakai tombol Naik/Turun yang keyboard/touch accessible, bukan drag-only;
- loop/shuffle memakai label UI yang dapat dipahami pengguna.

Masih wajib sebelum milestone Hymnal dianggap selesai:

- CI current head hijau;
- Playwright viewport/orientation regression;
- rapid song-switch + PDF render cancellation stress;
- MIDI long-song/seek/tempo/transpose stress;
- text/chord autofit lanjutan bila golden screenshots menunjukkan overflow.

### C. e-GYS boundary

Keputusan final:

- e-GYS = external service di `https://e.gys.or.id`;
- GYSApp tidak melakukan Google Identity, token exchange, profile fetch, atau session persistence;
- tidak ada auth webview bridge pada Tauri;
- web membuka tab eksternal; Tauri memakai system browser melalui opener;
- main webview tidak membutuhkan `connect-src` e-GYS;
- tidak ada kebutuhan Cloudflare/OAuth/secure-token storage untuk e-GYS.

Jika di masa depan fitur inti benar-benar membutuhkan API e-GYS, integrasi harus dimulai dengan requirement dan ADR baru, bukan menghidupkan bridge lama.

### D. Android continuity

- identifier tetap `id.sch.kanaan.egys`;
- versionCode minimal 134 setelah Flutter `2.1.0+133`;
- release **harus memakai keystore lama** agar update path Play Store/sideload tidak putus;
- workflow hanya menerima keystore/password melalui GitHub Secrets;
- jangan membuat signing key baru kecuali sengaja membuat application identity baru.

### E. Native CI

- Windows PR: frontend build -> Cargo check -> Tauri no-bundle build;
- Android: compile gate dulu; signed AAB/APK hanya ketika keystore lama tersedia;
- iOS: compile/simulator gate memerlukan macOS runner;
- signed IPA/App Store gate baru aktif setelah Apple signing/provisioning tersedia.

## P1 — UI/UX release polish

Arah visual: **minimal worship utility**, bukan dashboard SaaS.

- GYS blue sebagai accent, bukan memenuhi semua surface;
- hierarchy dibentuk typography, whitespace, thin border, dan grouping;
- shadow ringan; hindari glassmorphism/dekorasi berlebihan;
- logo resmi GYS/TJC menjadi anchor identitas;
- mobile floating dock stabil dan selalu berlabel;
- tablet rail dan desktop sidebar memakai bahasa visual yang sama;
- touch target minimum 48px untuk aksi utama;
- reader comfort modes dianggap feature kelas satu;
- motion 160–260ms dan `prefers-reduced-motion` wajib;
- semua loading/error/download state mempunyai feedback dan recovery action.

## P1 — feature parity tersisa

### Bible

- final ref silang/paralel contextual UI;
- rich notes/context actions;
- unified asset/cache management surface;
- final accessibility/visual regression.

### Hymnal

- playlist quick-add dari viewer/list yang konsisten;
- previous/next berdasarkan active playlist bila playback source playlist;
- optional text autofit algorithm dengan minimum readable size;
- current-song/history surface di Home;
- offline soundfont/media cache policy dan cleanup.

### Literature / Faith / More

- perluas i18n copy;
- audit external links dengan platform opener yang sama;
- sempurnakan Panduan Alkitab/remote catalog;
- direct-source audit untuk mengurangi gateway bila CORS/source memungkinkan.

## Optional content gateway

Worker bukan auth backend. Fungsinya dibatasi pada kebutuhan server-side yang konkret:

- HTML/CORS normalization untuk source publik yang tidak praktis di-fetch browser;
- report webhook proxy bila URL/credential webhook harus disembunyikan.

Tidak diperlukan untuk:

- e-GYS login;
- chord manifest/file;
- local Bible/Hymnal feature;
- app account/session.

Production secret yang mungkin dibutuhkan hanya `REPORT_WEBHOOK_URL`, ditambah credential deployment `CLOUDFLARE_API_TOKEN` dan `CLOUDFLARE_ACCOUNT_ID` bila Worker benar-benar dideploy.

## Quality gates

### Per PR

- TypeScript strict;
- unit/component tests;
- fixture integrity;
- production frontend build;
- Prettier/format;
- Playwright Chromium desktop/mobile;
- secret scan;
- Windows Rust/Tauri build gate.

### Sebelum beta

- viewport: 320, 360, 390, 600, 768, 1024, 1440, 1920;
- portrait/landscape untuk mobile/tablet;
- browser zoom 200%;
- keyboard-only desktop journey;
- reduced motion;
- light/dark/system;
- offline cold/warm state;
- corrupted/interrupted asset update fixtures;
- PDF 1/2-page golden screenshots;
- MIDI long-song stress;
- Android upgrade/install smoke menggunakan signing identity lama.

### Performance budgets

- initial shell target <250KB gzip;
- PDF/MIDI/player/account-heavy code lazy-loaded;
- local navigation tidak menunggu network;
- warm local search p95 <100ms pada target mid-range;
- web production target LCP <2.5s p75, INP <200ms, CLS <0.1.

## Urutan eksekusi

1. Pastikan current Hymnal/player/playlist head lulus CI + Windows native gate.
2. Tambahkan viewport/orientation E2E untuk Bible dan Hymnal.
3. Finalisasi Android signing workflow dengan keystore lama ketika secret tersedia.
4. Tambahkan iOS compile gate pada macOS runner.
5. Selesaikan contextual Bible refs/notes dan Hymnal playlist playback semantics.
6. Audit/sederhanakan optional gateway endpoint per endpoint.
7. Bundle splitting + performance profiling.
8. WCAG 2.2 AA journey audit + release regression suite.

## Definition of done

Migrasi selesai ketika semua menu utama Flutter memiliki ekuivalen web/Tauri atau keputusan `n/a` yang terdokumentasi; fitur inti dapat berjalan tanpa backend GYSApp; e-GYS tetap di luar trust boundary aplikasi; chord/PDF/MIDI dan Bible dapat dipakai offline setelah aset tersedia; Android mempertahankan upgrade identity lama; web/native memakai core logic yang sama; dan journey utama lulus desktop/mobile/native, accessibility, security, serta release gates.
