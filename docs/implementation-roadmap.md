# GYSApp Web/Tauri — Implementation Roadmap

Audit: 12 Agustus 2026

## Target produk

GYSApp menjadi satu codebase web-native yang dapat berjalan sebagai PWA serta dibungkus Tauri untuk Windows, Android, iOS, dan desktop lain tanpa mengulang business logic per platform. Flutter lama (`GYSAPP-Fork`) dipakai sebagai kontrak fitur dan sumber aset; `gyschordweb` dipakai sebagai referensi utama untuk chord/PDF/MIDI karena sudah web-native.

## Prinsip arsitektur

1. **Web-first, wrapper-thin.** Semua feature utama berada di `apps/web` + `packages/core`; `apps/native` hanya bridge platform.
2. **Backendless-first, bukan auth-less.** Fitur inti lokal tidak membutuhkan backend GYSApp. e-GYS tetap identity/member service resmi dan diakses langsung melalui adapter client.
3. **Pure core.** Parser, cache policy, search, transpose, playlist, backup, profile normalization, dan transformasi data berupa fungsi/port TypeScript yang dapat dites tanpa DOM.
4. **Ports/adapters.** IndexedDB untuk aset web, filesystem/SQLite Tauri untuk native; kontrak business logic sama.
5. **Tidak ada secret di client.** Public OAuth client ID boleh berada di client; client secret, password, webhook, dan credential rahasia tidak boleh.
6. **Token e-GYS tidak melewati Cloudflare.** Optional content gateway hanya untuk parsing/CORS konten publik dan report webhook.
7. **Executable code lokal by default.** Google Identity SDK adalah pengecualian sempit khusus identity web; business logic aplikasi tetap dibundel lokal.
8. **Progressive data.** Instalasi awal ringan; aset besar dipasang atau dicache saat dibutuhkan.

## Status audit saat ini

### Sudah ada dan perlu dipertahankan

- Monorepo pnpm: `apps/web`, `apps/edge`, `apps/native`, `packages/core`, `packages/contracts`.
- React + TypeScript strict, Vite, Vitest, Playwright.
- Shell responsif bottom-nav / rail / sidebar dan redesign floating dock berjalan.
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
- e-GYS profile contract + normalization untuk Jemaat/Simpatisan dan Cabang/Wilayah.
- Report route + optional content gateway foundation.
- Tauri Windows dan Android foundation.

## P0 — parity dan keamanan sebelum beta publik

### 1. Integrasi e-GYS langsung

- e-GYS adalah identity/member service; jangan membuat database akun atau session backend GYSApp.
- Web: Google Identity credential ditukar langsung ke endpoint e-GYS yang digunakan GYSAPP-Fork.
- Web token hanya `sessionStorage`, tidak `localStorage`, IndexedDB, backup, analytics, atau log.
- Profil dibaca langsung dari `https://e.gys.or.id/api/v1/users/profile` dengan bearer e-GYS.
- Normalizer canonical wajib menangani variasi `member_type`, `jenis_anggota`, `baptized`, `branchname`, `wilayah`, `region`, dan nested profile variants.
- `ACTIVE`, `VERIFIED`, atau status akun generik tidak boleh dianggap sebagai jenis anggota.
- Native: login melalui isolated e-GYS auth webview; remote auth window tidak mendapat capability Tauri umum.
- Tambahkan secure persistence native menggunakan OS-backed secret storage setelah auth handoff terbukti stabil. Sampai itu selesai, sesi native bersifat session-only.
- Production web perlu memvalidasi bahwa deployed origin diizinkan oleh konfigurasi Google/e-GYS; `VITE_EGYS_GOOGLE_CLIENT_ID` dapat override public client ID bila diperlukan.
- Apple tetap mengikuti hosted flow e-GYS pada native; web Apple dapat ditambahkan hanya bila e-GYS memberi konfigurasi web yang resmi.

### 2. Backendless-first / content gateway minim

- Audit tiap source online: direct browser fetch/open lebih dulu; Worker hanya jika CORS/parsing/secret memang memerlukan server.
- Worker tidak memiliki login, session, Google OAuth, Apple OAuth, atau token e-GYS.
- Chord tidak melewati Worker; manifest/file publik diambil langsung dari `gyschordweb`.
- Gateway yang tersisa hanya `/api/content/*` yang perlu normalisasi dan `/api/report` bila webhook rahasia dipakai.
- GitHub Pages memakai `VITE_CONTENT_GATEWAY_BASE` hanya untuk feature gateway tersebut; fitur inti tidak boleh tergantung gateway.

### 3. Android continuity

- Pertahankan application id Flutter lama: `id.sch.kanaan.egys`.
- Version code berikutnya minimal 134 (Flutter terakhir `2.1.0+133`).
- Gunakan **keystore release yang sama** dengan Flutter lama agar APK/AAB baru dapat meng-update instalasi yang sudah ada.
- Jangan membuat key baru kecuali sengaja memutus upgrade path.
- Secret GitHub repo lama tidak dapat dibaca/copy otomatis oleh workflow; material keystore yang sama harus dipasang sebagai secret di repo baru.

### 4. Chord update policy

- Instalasi baru: nol file chord lokal.
- Saat lagu dibuka: conditional check manifest `gyschordweb` langsung dari sumber publik.
- Jika SHA sama: tidak download ulang.
- Jika SHA berubah: download blob baru, validasi size/SHA/schema, baru pindahkan pointer aktif.
- Blob lama tidak ditimpa; GC dilakukan idle/LRU setelah grace period.
- Offline selalu memakai pointer aktif terakhir yang valid.

### 5. e-GYS + media parity

- Akun e-GYS mempunyai halaman terintegrasi untuk nama, cabang/wilayah, dan status Jemaat/Simpatisan.
- Tetap sediakan tombol membuka situs e-GYS penuh.
- Wajib ada akses eRhema, Pelita Kecil, Pujian/Paduan Suara, Buku, Ibadah Online, Audio Khotbah, Video Khotbah, Podcast, Facebook, Instagram, YouTube, Spotify.
- Link online dibuka via adapter platform; pada Tauri gunakan opener/native webview hanya sesuai kebutuhan.

### 6. Security cleanup legacy

- Credential rahasia legacy yang pernah tersimpan di source Flutter tidak boleh disalin.
- Public OAuth client ID bukan secret, tetapi harus dapat dioverride melalui build config.
- Rotasi credential rahasia lama yang masih aktif.
- Token/provider credential tidak boleh masuk log.

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

### Pujian — status setelah batch ini

Sudah masuk pada PR:

- PDF 1 halaman / 2 halaman.
- fit page / fit width.
- zoom 70–200% dan preferensi viewer tersimpan.
- landscape hint untuk 2 halaman pada layar kecil.
- mode teks centered horizontal + vertical.
- extraction chord/lyric lintas halaman PDF.
- sharp/mol di toolbar viewer **dan** MIDI player.
- transpose MIDI disinkronkan ke display chord text menggunakan formatter core dari `gyschordweb`.

Masih perlu:

- visual regression screenshots untuk fit 1/2 page pada semua viewport utama.
- autofit teks agar ukuran font memaksimalkan ruang tanpa overflow.
- restore posisi halaman/scroll per lagu.
- global mini-player/shared player state lintas route.
- stress test ganti lagu cepat, MIDI preload, dan PDF cancellation.
- playlist editor lengkap: rename, reorder drag + tombol accessible, loop/shuffle.

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
- Google Identity SDK dimuat hanya pada halaman akun saat login diperlukan.
- Content gateway boleh berada di Cloudflare Worker, tetapi tidak menjadi dependency shell/local feature atau pemilik sesi e-GYS.

### Windows

- Tauri MSI/NSIS.
- Native filesystem untuk export/import backup dan asset packs.
- Isolated e-GYS auth webview.
- CI Windows PR menjalankan frontend build + Cargo check + Tauri no-bundle build.

### Android

- Tauri Android dengan application id `id.sch.kanaan.egys`.
- Release signing memakai keystore Flutter lama.
- AAB untuk Play Store, APK universal/arm64 untuk sideload test.
- Shared Rust auth bridge untuk hosted e-GYS login.
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

- `VITE_CONTENT_GATEWAY_BASE=https://<worker-domain>/api`

Tidak ada `SESSION_SECRET`, Google OAuth secret, Apple auth secret, atau e-GYS credential di GYSApp gateway. Tidak ada secret yang boleh masuk `wrangler.jsonc`, `.env` ter-commit, frontend bundle, atau Tauri config.

## Testing gates

### Per commit/PR

- TypeScript strict, nol `any` baru tanpa justifikasi.
- Unit test core/cache/parser/profile normalization.
- Component tests route yang berubah.
- e-GYS direct-session adapter tests dengan mocked network; tidak pernah menyimpan credential test production.
- Edge tests hanya untuk report/content yang masih memerlukan gateway.
- Direct-source contract tests untuk chord manifest/fixtures.
- Playwright Chromium desktop + mobile.
- Native Windows: Cargo check + Tauri no-bundle build pada PR.
- Format/lint + secret scan.

### Sebelum beta

- Viewport matrix: 320, 360, 390, 600, 768, 1024, 1440, 1920.
- Zoom browser 200%.
- Keyboard-only journey desktop.
- Reduced motion.
- Offline cold/warm states.
- Cache corruption + interrupted update fixtures.
- MIDI long-song stress test.
- PDF 1/2-page fit regression screenshots.
- Real e-GYS login smoke test dengan account QA pada deployed web origin dan native wrapper.
- Invalid/expired e-GYS token harus membersihkan sesi lokal tanpa merusak data offline lain.

### Performance budgets

- Initial JS route shell <250KB gzip target.
- Heavy PDF/MIDI/account identity modules lazy-loaded.
- Local navigation interactive tanpa network.
- Search warm p95 <100ms pada device mid-range target.
- LCP <2.5s p75, INP <200ms, CLS <0.1 untuk web production.

## Urutan eksekusi terbarui

1. Integrasi e-GYS direct session + canonical member profile + native auth bridge.
2. Hymnal viewer parity: 1/2 page, fit, zoom, sharp/mol, transpose sync, lalu visual regression/autofit.
3. Android identifier/version/signing continuity + native PR build gate.
4. Bible multi-version asset manager + download manager cancel/retry/refresh.
5. Bible split view/history/bookmark/ref silang/TTS.
6. Global mini-player + playlist editor/history.
7. Secure native persistence e-GYS + iOS compile gate.
8. Performance bundle splitting + a11y/security release gates.

## Definition of done

Migrasi dianggap selesai ketika seluruh menu utama Flutter lama mempunyai ekuivalen web/Tauri yang berfungsi atau keputusan `n/a` terdokumentasi; fitur inti tidak membutuhkan backend GYSApp; integrasi e-GYS tetap langsung dan tidak melewati optional gateway; profil cabang/wilayah serta Jemaat/Simpatisan tersedia saat user login; tidak ada credential rahasia legacy di client; chord/MIDI/PDF dapat bekerja offline setelah pernah dibuka/diunduh; web dan native memakai business logic yang sama; Android dapat mempertahankan upgrade path aplikasi lama; serta seluruh journey utama lolos test desktop/mobile dan aksesibilitas minimum WCAG 2.2 AA.
