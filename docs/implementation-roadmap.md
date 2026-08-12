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

Sudah tersedia dan terverifikasi:

- pnpm monorepo `apps/web`, `apps/edge`, `apps/native`, `packages/core`, `packages/contracts`;
- React + TypeScript strict, Vite, Vitest, Playwright;
- shell responsif mobile dock / tablet rail / desktop sidebar;
- route-level lazy loading; initial main shell sekitar **130 KB gzip**, di bawah budget 250 KB;
- PWA + GitHub Pages;
- Bible SQLite + TB/KJV/CUV asset manager, SHA-256, cancel/retry/resume, split reader, history/bookmark, TTS;
- full Hymnal catalog, KR PDF/MIDI, web-native chord extraction, lazy immutable chord cache;
- app-level MIDI player + playlist previous/next, loop/shuffle, auto-advance;
- Web Audio lifecycle nyata (`AudioBufferSourceNode.start`) + rapid-load guard;
- PDF rapid-switch guard + stale loading-task cancellation;
- encrypted backup, settings/i18n, 10 Pokok Iman, literature/content surfaces;
- optional Cloudflare content/report gateway;
- Windows Tauri compile gate;
- Android ARM64 APK compile gate yang memverifikasi `id.sch.kanaan.egys` dan versionCode 134;
- iOS Xcode simulator compile gate pada macOS.

## P0 — milestone PR #4

### A. Bible/mobile stability — verified core

Sudah lolos gate:

- fixture/typecheck/unit/build/format/Playwright/secret scan;
- reader 1/2 panel pada mobile/tablet landscape;
- state reader, history/bookmark/last-location;
- download pack cancel/retry/resume + atomic activation;
- TTS voice matching/controller;
- 320px navigation and overflow invariant.

Masih dilanjutkan pada release polish:

- full viewport matrix 320–1920;
- browser zoom 200%;
- keyboard-only journey;
- final contextual refs/notes UX.

### B. Hymnal finishing — verified

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
- Playwright viewport/orientation/player persistence regression.

Sisa Hymnal untuk P1:

- optional text/chord autofit bila golden screenshot menunjukkan overflow;
- real-device long-song/performance soak;
- offline soundfont/media cache cleanup policy;
- current-song/history surface di Home.

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

- production signed AAB/APK + upgrade/install smoke membutuhkan keystore production lama dan fingerprint sertifikat yang benar dari keystore/Play Console.
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

### Bible

- final ref silang/paralel contextual UI;
- rich notes/context actions;
- unified asset/cache management surface;
- full accessibility/visual regression.

### Hymnal

- optional text autofit algorithm dengan minimum readable size;
- current-song/history surface di Home;
- offline soundfont/media cache policy dan cleanup;
- real-device long-song/performance soak.

### Literature / Faith / More

- perluas i18n copy;
- audit external links dengan platform opener yang sama;
- sempurnakan Panduan Alkitab/remote catalog;
- direct-source audit untuk mengurangi optional gateway bila CORS/source memungkinkan.

## Optional content gateway

Worker bukan auth backend. Fungsinya dibatasi pada kebutuhan server-side konkret:

- HTML/CORS normalization untuk source publik yang tidak praktis di-fetch browser;
- report webhook proxy bila URL/credential webhook harus disembunyikan.

Tidak diperlukan untuk e-GYS login, chord manifest/file, local Bible/Hymnal feature, atau app account/session.

## Quality gates

### Per PR — aktif

- TypeScript strict;
- unit/component tests;
- fixture integrity;
- production frontend build;
- Prettier;
- Playwright Chromium desktop/mobile;
- secret scan;
- Windows Tauri compile;
- Android Tauri APK compile + identity verification;
- iOS Xcode simulator compile.

### Sebelum beta

- viewport: 320, 360, 390, 600, 768, 1024, 1440, 1920;
- portrait/landscape mobile/tablet;
- browser zoom 200%;
- keyboard-only desktop journey;
- reduced motion;
- light/dark/system;
- offline cold/warm state;
- corrupted/interrupted asset update fixtures;
- PDF 1/2-page golden screenshots;
- MIDI long-song real-device soak;
- Android signed upgrade/install smoke menggunakan signing identity lama.

### Performance budgets

- initial shell <250KB gzip — **achieved (~130KB gzip)**;
- PDF/MIDI/account-heavy code lazy-loaded;
- local navigation tidak menunggu network;
- warm local search p95 <100ms pada target mid-range;
- production target LCP <2.5s p75, INP <200ms, CLS <0.1.

## Urutan eksekusi berikutnya

1. Finalisasi contextual Bible refs/notes.
2. Jalankan full accessibility matrix: 320–1920, zoom 200%, keyboard-only, reduced-motion.
3. Konsolidasikan offline soundfont/media cache + cleanup/reset surface.
4. Audit optional gateway endpoint per endpoint untuk direct-source simplification.
5. Jalankan Android production signed upgrade smoke setelah legacy keystore + fingerprint tersedia.
6. Tambahkan signed iOS distribution setelah provisioning/signing Apple tersedia.
7. Production Web Vitals + final beta regression.

## Definition of done

Migrasi selesai ketika semua menu utama Flutter memiliki ekuivalen web/Tauri atau keputusan `n/a` yang terdokumentasi; fitur inti berjalan tanpa backend GYSApp; e-GYS tetap di luar trust boundary aplikasi; chord/PDF/MIDI dan Bible dapat dipakai offline setelah aset tersedia; Android mempertahankan upgrade identity lama; web/native memakai core logic yang sama; dan journey utama lulus desktop/mobile/native, accessibility, security, serta release gates.
