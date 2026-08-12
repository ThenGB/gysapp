# GYSApp Web/Tauri — Implementation Roadmap

Audit: 12 Agustus 2026

## Target produk

GYSApp menjadi satu codebase web-native yang dapat berjalan sebagai PWA serta dibungkus Tauri untuk Windows, Android, iOS, dan desktop lain tanpa mengulang business logic per platform. Flutter lama (`GYSAPP-Fork`) dipakai sebagai kontrak fitur dan sumber aset; `gyschordweb` dipakai sebagai referensi utama untuk chord/PDF/MIDI karena sudah web-native.

## Prinsip arsitektur

1. **Web-first, wrapper-thin.** Semua feature utama berada di `apps/web` + `packages/core`; `apps/native` hanya bridge platform.
2. **Backendless-first.** Tidak ada backend GYSApp untuk fitur yang dapat bekerja langsung/local. Cloudflare hanya optional content gateway untuk parsing/CORS/report yang benar-benar memerlukan server.
3. **Pure core.** Parser, cache policy, search, transpose, playlist, backup, dan transformasi data harus berupa fungsi/port TypeScript yang dapat dites tanpa DOM.
4. **Ports/adapters.** IndexedDB untuk web, filesystem/SQLite Tauri untuk native, tetapi kontrak sama.
5. **Tidak ada secret di client.** Hanya integrasi server-side yang benar-benar membutuhkan secret yang boleh memakai gateway.
6. **Tidak ada runtime CDN untuk executable code.** Library/worker/font penting dibundel lokal; konten publik tetap dapat berasal dari tjc.org/e-GYS/GitHub.
7. **Progressive data.** Instalasi awal ringan; aset besar dipasang atau dicache saat dibutuhkan.

## Status audit saat ini

### Sudah ada dan perlu dipertahankan

- Monorepo pnpm: `apps/web`, `apps/edge`, `apps/native`, `packages/core`, `packages/contracts`.
- React + TypeScript strict, Vite, Vitest, Playwright.
- Shell responsif bottom-nav / rail / sidebar.
- PWA + GitHub Pages.
- Alkitab TB SQLite 1 file + pencarian seluruh Alkitab.
- Katalog pujian penuh, PDF/MIDI KR, fallback lirik buku lain.
- Chord lazy cache content-addressed langsung dari `gyschordweb`.
- Parser PDF/chord web-native dan mode teks/chord.
- MIDI engine WebAudio/WASM, seek, tempo, transpose, instrument.
- Playlist, loop, shuffle.
- 10 Pokok Iman + PDF lanjutan.
- Snapshot Sauh/Suara Sejati/konten literatur dengan fallback offline.
- Settings, tema, skala font, i18n dasar, backup terenkripsi.
- Report route + optional content gateway foundation.
- Tauri Windows dan Android foundation.

### P0 — parity dan keamanan sebelum beta publik

1. **Backendless-first / content gateway minim**
   - Audit tiap source online: direct browser fetch/open lebih dulu; Worker hanya jika CORS/parsing/secret memang memerlukan server.
   - Worker tidak memiliki login, session, Google OAuth, Apple OAuth, atau token e-GYS.
   - Chord tidak melewati Worker; manifest/file publik diambil langsung dari `gyschordweb`.
   - e-GYS dibuka langsung ke `https://e.gys.or.id/login`; autentikasi sepenuhnya milik e-GYS.
   - Gateway yang tersisa hanya `/api/content/*` yang perlu normalisasi dan `/api/report` bila webhook rahasia dipakai.
   - GitHub Pages memakai `VITE_BFF_BASE` hanya untuk feature gateway tersebut; fitur inti tidak boleh tergantung gateway.

2. **Android continuity**
   - Pertahankan application id Flutter lama: `id.sch.kanaan.egys`.
   - Version code berikutnya minimal 134 (Flutter terakhir `2.1.0+133`).
   - Gunakan **keystore release yang sama** dengan Flutter lama agar APK/AAB baru dapat meng-update instalasi yang sudah ada.
   - Jangan membuat key baru kecuali sengaja memutus upgrade path.
   - Secret GitHub repo lama tidak dapat dibaca/copy otomatis oleh workflow; material keystore yang sama harus dipasang sebagai secret di repo baru.

3. **Chord update policy**
   - Instalasi baru: nol file chord lokal.
   - Saat lagu dibuka: conditional check manifest `gyschordweb` langsung dari sumber publik.
   - Jika SHA sama: tidak download ulang.
   - Jika SHA berubah: download blob baru, validasi size/SHA/schema, baru pindahkan pointer aktif.
   - Blob lama tidak ditimpa; GC dilakukan idle/LRU setelah grace period.
   - Offline selalu memakai pointer aktif terakhir yang valid.

4. **e-GYS + media parity**
   - e-GYS / Area Anggota adalah external service, bukan akun internal GYSApp.
   - GYSApp tidak mengekstrak credential, cookie, session, atau token e-GYS.
   - Wajib ada akses eRhema, Pelita Kecil, Pujian/Paduan Suara, Buku, Ibadah Online, Audio Khotbah, Video Khotbah, Podcast, Facebook, Instagram, YouTube, Spotify.
   - Link online dibuka via adapter platform; pada Tauri gunakan opener native bila diperlukan.

5. **Security cleanup legacy**
   - Konfigurasi Flutter lama mengandung credential legacy yang pernah tersimpan di source.
   - Jangan menyalin nilainya ke GYSApp.
   - Rotasi credential lama yang masih aktif.
   - Jangan mempertahankan backend/auth hanya demi meniru implementasi Flutter bila web eksternal resmi sudah menangani autentikasi.

## P1 — reader dan worship parity

### Alkitab

- Multi-version asset manager: TB/KJV/CUV dengan manifest size + SHA-256.
- Install/update/delete pack tanpa reload aplikasi.
- Split view 1/2 pane, header swipe/tahan pilih kitab, sinkron scroll opsional.
- Ref silang, perikop paralel, bookmark, history.
- Notes rich text dengan backup/export.
- Bacaan harian dan restore posisi terakhir.
- TTS system/native terlebih dahulu; cloud TTS hanya melalui gateway bila benar-benar dibutuhkan.
- Download manager dengan progress, cancel, retry, dan refresh library otomatis setelah selesai.

### Pujian

- Viewer PDF: 1 halaman / 2 halaman, vertical, fit width/page, zoom, restore setting per device.
- Landscape hint untuk mode 2 halaman pada layar kecil.
- Mode teks harus menjadi first-class viewer, bukan fallback PDF.
- Default teks centered horizontal + vertical dengan pilihan alignment eksplisit.
- Chord sharp/flat toggle berada di toolbar viewer **dan** MIDI player.
- Transpose/key/tempo/instrument tidak mereset posisi playback.
- Global mini-player tidak boleh menutupi konten dan tetap konsisten lintas route.
- Playlist editor lengkap: rename, reorder drag + tombol accessible, loop/shuffle.

## P1 — UI/UX redesign

Arah: **minimal worship utility**, bukan dashboard SaaS generik.

- Warna utama GYS blue; dark mode menggunakan navy/charcoal, bukan hitam pekat.
- Surface sederhana, shadow sangat halus, tanpa glassmorphism berlebihan.
- Phosphor Icons regular/duotone untuk identifikasi cepat.
- Touch target minimal 48px dan label teks tetap tersedia untuk pengguna lanjut usia.
- Navigasi tidak auto-hide.
- Mobile: floating dock/bubble yang stabil, tidak mengganggu reader/player.
- Tablet: navigation rail + contextual side panel.
- Desktop: sidebar kompak + content canvas; reader dapat menjadi 2/3 pane pada >=1440px.
- Motion 160–260ms, spring ringan hanya untuk dock/player; `prefers-reduced-motion` wajib dihormati.
- Skeleton hanya untuk konten remote; data lokal harus tampil instan.
- Semua state error memiliki aksi `Coba lagi` dan state download memiliki `Batalkan`.

### Motion contract

- Route transition: opacity + translate 6–10px, <=220ms.
- Dock active indicator: transform/size, tidak layout-thrashing.
- Mini player expand/collapse: shared geometry sederhana, tidak blur berat.
- Reader toolbar: sticky dan tidak menyebabkan content jump.
- Chord update/download: progress non-blocking; viewer lama tetap usable selama update.

## P2 — multi-platform compositor

### Web/PWA

- GitHub Pages atau static hosting lain untuk frontend.
- Service Worker hanya cache shell/data yang sesuai; PDF/MIDI/soundfont besar dikelola IndexedDB/asset manager agar tidak dobel cache.
- Content gateway boleh berada di Cloudflare Worker, tetapi tidak menjadi dependency shell/local feature.

### Windows

- Tauri MSI/NSIS.
- Native filesystem untuk export/import backup dan asset packs.
- CI Windows tetap menjadi build gate.

### Android

- Tauri Android dengan application id `id.sch.kanaan.egys`.
- Release signing memakai keystore Flutter lama.
- AAB untuk Play Store, APK universal/arm64 untuk sideload test.
- Native notification/reminder dan external opener melalui plugin Tauri.

### iOS

- Source dapat di-init/build dengan Tauri iOS, tetapi final IPA/App Store signing tetap memerlukan runner macOS + Apple signing identity/provisioning.
- CI awal cukup compile/simulator gate; release workflow ditambahkan setelah credential Apple tersedia.

## Optional content gateway deployment contract

Worker name: `gysapp-content-gateway`.

Secret aplikasi minimum:

- `REPORT_WEBHOOK_URL` — hanya diperlukan bila fitur Kirim Masukan meneruskan pesan ke webhook rahasia.

GitHub Actions deployment membutuhkan:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Repository variable frontend bila gateway digunakan:

- `VITE_BFF_BASE=https://<worker-domain>/api`

Tidak ada `SESSION_SECRET`, Google OAuth secret, Apple auth secret, atau e-GYS credential di GYSApp. Tidak ada secret yang boleh masuk `wrangler.jsonc`, `.env` ter-commit, frontend bundle, atau Tauri config.

## Testing gates

### Per commit/PR

- TypeScript strict, nol `any` baru tanpa justifikasi.
- Unit test core/cache/parser.
- Component tests route yang berubah.
- Edge tests hanya untuk report/content yang masih memerlukan gateway.
- Direct-source contract tests untuk chord manifest/fixtures.
- Playwright Chromium desktop + mobile.
- Format/lint.

### Sebelum beta

- Viewport matrix: 320, 360, 390, 600, 768, 1024, 1440, 1920.
- Zoom browser 200%.
- Keyboard-only journey desktop.
- Reduced motion.
- Offline cold/warm states.
- Cache corruption + interrupted update fixtures.
- MIDI long-song stress test.
- PDF 1/2-page fit regression screenshots.
- e-GYS external link flow pada web, Android, Windows, dan iOS wrapper tanpa token interception.

### Performance budgets

- Initial JS route shell <250KB gzip target.
- Heavy PDF/MIDI modules lazy-loaded.
- Local navigation interactive tanpa network.
- Search warm p95 <100ms pada device mid-range target.
- LCP <2.5s p75, INP <200ms, CLS <0.1 untuk web production.

## Urutan eksekusi

1. Sederhanakan gateway: hapus auth/chord proxy dan audit direct-source vs gateway.
2. Android identifier/version/signing continuity.
3. Restore seluruh entry e-GYS/media dan external opener lintas platform.
4. Chord manifest check-on-open + cache observability langsung dari `gyschordweb`.
5. Redesign shell/dock/player berdasarkan design system baru.
6. Hymnal viewer parity penuh.
7. Bible reader/download/TTS parity.
8. Notes/history/download manager.
9. iOS compile gate dan native-specific integrations.
10. Performance/a11y/security release gates.

## Definition of done

Migrasi dianggap selesai ketika seluruh menu utama Flutter lama mempunyai ekuivalen web/Tauri yang berfungsi atau keputusan `n/a` terdokumentasi; fitur inti tidak membutuhkan backend GYSApp; tidak ada credential legacy di client; e-GYS login tetap sepenuhnya milik situs e-GYS; chord/MIDI/PDF dapat bekerja offline setelah pernah dibuka/diunduh; web dan native memakai business logic yang sama; Android dapat mempertahankan upgrade path aplikasi lama; serta seluruh journey utama lolos test desktop/mobile dan aksesibilitas minimum WCAG 2.2 AA.
