# Parity Matrix GYSApp

Sumber kontrak: `ThenGB/GYSAPP-Fork` (Flutter) dan `gyspnk/gyschordweb` (web chord/MIDI). Audit terakhir: **12 Agustus 2026**. Detail urutan implementasi ada di `docs/implementation-roadmap.md`.

Status: `todo | in-progress | done | n/a`.

## Shell & Navigasi

| Fitur                                   | Status | Catatan                                                   |
| --------------------------------------- | ------ | --------------------------------------------------------- |
| 5 menu utama                            | done   | Beranda / Alkitab / Pujian / Iman / Lainnya               |
| Bottom nav / rail / sidebar responsif   | done   | Navigasi selalu tersedia                                  |
| i18n id/en/zh foundation                | done   | Copy feature masih terus diperluas                        |
| Floating/bubble mobile dock             | done   | Label tetap terlihat, active indicator restrained         |
| Global player tidak menutupi konten/nav | done   | App-level dock + reserved space lolos regression mobile   |
| Reduced motion                          | done   | OS preference + deep-link Bible scroll dihormati          |

## Beranda

| Fitur                          | Status      | Catatan                                                  |
| ------------------------------ | ----------- | -------------------------------------------------------- |
| Greeting + tanggal             | done        | Tidak membutuhkan akun/network untuk cold start          |
| Sauh Bagi Jiwa                 | done        | Static snapshot default + optional gateway               |
| Suara Sejati                   | done        | Static snapshot default + optional gateway               |
| Task-first mobile Home         | done        | Prioritas aksi utama, dekorasi dikurangi                 |
| Lanjut membaca / pujian        | in-progress | State reader/hymnal tersedia; surface Home masih dipoles |
| Greeting berbasis profil e-GYS | n/a         | e-GYS adalah layanan eksternal                           |

## Alkitab

| Fitur                                    | Status | Catatan                                                                    |
| ---------------------------------------- | ------ | -------------------------------------------------------------------------- |
| TB lengkap SQLite                        | done   | 66 kitab / 1.189 pasal                                                     |
| Search seluruh Alkitab                   | done   | SQLite/search index                                                        |
| Multi-version TB/KJV/CUV                 | done   | Manifest + install/update/delete + hot-load                                |
| Bundled TB fallback                      | done   | Tetap dapat membaca tanpa download awal                                    |
| Download progress/cancel/retry           | done   | Range resume bila source mendukung                                         |
| SHA-256 verification + atomic activation | done   | Pack rusak tidak mengganti versi aktif                                     |
| Reader 1/2 panel                         | done   | Layout responsif mobile/tablet/desktop                                     |
| Optional sync scroll                     | done   | Secondary version reader                                                   |
| Bookmark/history/last position           | done   | Persistensi lokal                                                          |
| Ref silang / paralel                     | done   | Nama kitab manusiawi, dedup, deep-link langsung ke target ayat             |
| System TTS                               | done   | Voice matching bahasa + controller                                         |
| Rich contextual notes                    | done   | Inline create/update/delete; satu contextual note per target               |
| Responsive regression                    | done   | 320px + tablet landscape + split reader invariant                          |
| Full accessibility matrix                | done   | 320–1920, effective 200% zoom reflow, keyboard-only, reduced-motion        |

## Pujian

| Fitur                          | Status      | Catatan                                                                    |
| ------------------------------ | ----------- | -------------------------------------------------------------------------- |
| Katalog buku kidung            | done        | Katalog penuh + fallback lirik                                             |
| KR PDF 533                     | done        | Aset lengkap                                                               |
| KR MIDI                        | done        | WebAudio/WASM; AudioBufferSourceNode benar-benar dimulai                   |
| MIDI seek/tempo/transpose      | done        | Pause/resume/seek + tempo reset + stale-load guard dites                   |
| PDF 1/2 halaman                | done        | True container/viewport autofit + orientation regression                   |
| Fit page / fit width / zoom    | done        | DPR-aware canvas render, zoom 70–200%                                      |
| Landscape hint 2 halaman       | done        | Layar kecil portrait                                                       |
| Mode teks + chord              | in-progress | Centered + multi-page extraction; optional text autofit lanjut             |
| Sharp/flat viewer + player     | done        | State tersinkron                                                           |
| Transpose MIDI -> chord text   | done        | Formatter core sama dengan jalur chord web                                 |
| Restore viewer per lagu        | done        | Mode/page/fit/zoom/transpose/scroll disimpan dan diuji                     |
| Chord lazy immutable cache     | done        | Direct `gyschordweb`, SHA-addressed, check-on-open                         |
| Chord melalui Worker           | n/a         | Tidak diperlukan untuk sumber publik                                       |
| Persistent app-level MIDI dock | done        | Lintas route, tidak overlap nav, regression Playwright                     |
| Playlist persistence           | done        | Local persisted state                                                      |
| Playlist rename/dedup/reorder  | done        | Shared store + Naik/Turun keyboard/touch accessible                        |
| Previous/next playlist         | done        | Mengikuti active playlist dan boundary loop                                |
| Loop/shuffle controls          | done        | Label Indonesia + deterministic core semantics                             |
| Auto-advance MIDI              | done        | Track berikutnya otomatis saat ended                                       |
| Rapid MIDI switch safety       | done        | Request lama tidak mengaktifkan deck setelah track baru/stop               |
| Rapid PDF switch safety        | done        | Loading task stale dibatalkan; stale doc tidak mengambil alih viewer       |
| Offline soundfont/MIDI cache   | done        | IndexedDB bounded cache; soundfont pinned, media LRU                        |
| Offline PDF cache              | done        | Cache-first bytes + AbortController tanpa melemahkan PDF race guard         |
| Hapus media offline            | done        | Settings menghapus hanya PDF/MIDI/soundfont, bukan Bible/bookmark/notes     |

## Iman

| Fitur                        | Status      | Catatan                                                  |
| ---------------------------- | ----------- | -------------------------------------------------------- |
| 10 Pokok Iman id/en/zh       | done        |                                                          |
| Search                       | done        |                                                          |
| PDF lanjutan + resume        | done        | Manifest + SHA verification                              |
| Multi-select/copy/share/note | in-progress | Copy/search tersedia; selection/share parity belum final |

## Literatur & layanan eksternal

| Item                              | Status      | Catatan                                           |
| --------------------------------- | ----------- | ------------------------------------------------- |
| Kesaksian                         | done        | Snapshot statis + optional near-live gateway      |
| Warta/Manna Sejati                | done        | Snapshot statis + optional near-live gateway      |
| Kumpulan Renungan                 | done        | Snapshot statis + optional near-live gateway      |
| Panduan Alkitab                   | in-progress | Route ada; katalog masih diperkaya                |
| e-GYS external launcher           | done        | Browser/system opener + E2E boundary verified     |
| App-owned e-GYS login/session     | n/a         | Sengaja dihapus                                   |
| Google Identity / token exchange  | n/a         | Sengaja dihapus                                   |
| e-GYS profile/member/branch fetch | n/a         | Sengaja dihapus                                   |
| Native e-GYS auth webview bridge  | n/a         | Remote service dibuka via system browser          |
| Secure e-GYS token storage        | n/a         | Tidak ada token milik GYSApp                      |
| Pujian/Paduan Suara               | done        | External access                                   |
| Buku                              | done        | External access                                   |
| Ibadah Online                     | done        | External access                                   |
| Audio/Video Khotbah               | done        | External access                                   |
| eRhema / Pelita Kecil             | done        | Dipertahankan dari menu legacy                    |
| Podcast / social media            | done        | Facebook / Instagram / YouTube / Spotify          |

## Backendless-first & optional gateway

| Fitur                         | Status      | Catatan                                                              |
| ----------------------------- | ----------- | -------------------------------------------------------------------- |
| GYSApp account backend        | n/a         | Tidak ada account backend                                            |
| OAuth di Worker               | n/a         | Tidak diperlukan                                                     |
| e-GYS token melalui Worker    | n/a         | Tidak ada token e-GYS di GYSApp                                      |
| Chord proxy Worker            | n/a         | Direct public source                                                 |
| Snapshot konten statis        | done        | Default runtime; GitHub Actions sync TJC setiap 6 jam                 |
| Kirim masukan via gateway     | in-progress | Hanya bila webhook perlu disembunyikan                               |
| TJC HTML/CORS content gateway | done        | Opsional untuk near-live/normalization; bukan dependency runtime     |
| Cloudflare deployment         | done        | Optional `gysapp-content-gateway`; credentials boleh tidak tersedia  |
| Direct-source/gateway audit   | done        | Browser normal memakai snapshot; HTML live tetap di CI/optional edge |

## Settings & Data

| Fitur                    | Status      | Catatan                                                                  |
| ------------------------ | ----------- | ------------------------------------------------------------------------ |
| Light/dark/system        | done        |                                                                          |
| UI scale 5% step         | done        | Lebih halus untuk accessibility                                          |
| Reader comfort modes     | in-progress | Automated reflow lolos; final visual/contrast soak tetap dilakukan       |
| Backup `.gysapp` AES-GCM | done        |                                                                          |
| PWA/offline shell        | done        |                                                                          |
| Bible asset manager      | done        | Install/update/remove + verification                                     |
| Media cache manager      | done        | Soundfont/MIDI/PDF bounded LRU + safe cleanup surface                     |
| Unified reset/cache      | in-progress | Bible remove + media clear tersedia; chord/unified one-stop reset tersisa |
| Sabat/reminder native    | todo        |                                                                          |

## Native / Distribution

| Target                           | Status      | Catatan                                                           |
| -------------------------------- | ----------- | ----------------------------------------------------------------- |
| Tauri Windows compile gate       | done        | Frontend + Cargo check + Tauri release no-bundle hijau            |
| Tauri Android compile gate       | done        | Debug ARM64 APK, `id.sch.kanaan.egys`, versionCode 134 verified   |
| Android signing continuity guard | done        | Signed workflow menolak cert SHA-256 yang tidak sesuai            |
| Android production upgrade smoke | in-progress | Menunggu keystore production lama + expected fingerprint          |
| Tauri iOS compile gate           | done        | Xcode simulator build di macOS hijau                              |
| iOS signed distribution          | todo        | Memerlukan Apple signing/provisioning                             |
| Public signed release CI         | in-progress | Android workflow siap; material signing production belum tersedia |

## Kualitas

| Gate                                | Status      | Catatan                                                                      |
| ----------------------------------- | ----------- | ---------------------------------------------------------------------------- |
| TypeScript strict                   | done        | Strictness tidak dilonggarkan                                                |
| Unit/component tests                | done        | Bible context, notes, media cache, MIDI lifecycle, race guards               |
| Native PR compile                   | done        | Windows + Android + iOS                                                      |
| Playwright desktop/mobile           | done        | 320–1920 matrix + Bible/Hymnal orientation + player/nav + e-GYS             |
| Browser zoom/reflow                 | done        | Effective CSS viewport equivalent 200% browser zoom                          |
| Keyboard-only/focus visibility      | done        | Primary navigation journey + focus-ring regression                           |
| Reduced motion                      | done        | Motion-duration regression + Bible deep-link auto-scroll                     |
| Secret scan                         | done        | Credential legacy tidak dimigrasikan                                         |
| Runtime third-party executable code | done        | App logic bundled/local                                                      |
| Initial shell <250KB gzip           | done        | Route-level lazy loading menurunkan main shell ke sekitar 130KB gzip         |
| WCAG 2.2 AA journey utama           | in-progress | Automated reflow/keyboard/motion lolos; final contrast/real-device soak      |
| Production web vitals               | todo        | Diukur setelah deployment stabil                                             |

## Blocker eksternal tersisa

1. **Keystore production Android lama + fingerprint sertifikat yang benar** (dari keystore/Play Console) untuk signed upgrade smoke aplikasi `id.sch.kanaan.egys`; APK debug legacy bukan bukti fingerprint production.
2. **Apple signing/provisioning** untuk signed IPA/App Store. macOS compile runner sudah tersedia dan hijau.
3. Cloudflare account/token hanya jika optional near-live content/report gateway dipakai production.
4. Report webhook secret hanya bila Kirim Masukan memakai webhook server-side.

Tidak ada kebutuhan Google OAuth client/secret, Apple auth secret, `SESSION_SECRET`, atau credential e-GYS untuk fungsi e-GYS di GYSApp.
