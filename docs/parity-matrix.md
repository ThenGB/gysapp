# Parity Matrix GYSApp

Sumber kontrak: `ThenGB/GYSAPP-Fork` (Flutter) dan `gyspnk/gyschordweb` (web chord/MIDI). Audit terakhir: **12 Agustus 2026**. Detail urutan implementasi ada di `docs/implementation-roadmap.md`.

Status: `todo | in-progress | done | n/a`.

## Shell & Navigasi

| Fitur                                   | Status      | Catatan                                                                              |
| --------------------------------------- | ----------- | ------------------------------------------------------------------------------------ |
| 5 menu utama                            | done        | Beranda / Alkitab / Pujian / Iman / Lainnya                                          |
| Bottom nav / rail / sidebar responsif   | done        | Navigasi selalu tersedia                                                             |
| i18n id/en/zh foundation                | done        | Copy feature masih terus diperluas                                                   |
| Floating/bubble mobile dock             | done        | Label tetap terlihat, active indicator restrained                                    |
| Global player tidak menutupi konten/nav | in-progress | App-level dock + reserved content space sudah masuk; menunggu CI/E2E viewport matrix |
| Reduced motion                          | done        | Design system menghormati preference OS                                              |

## Beranda

| Fitur                          | Status      | Catatan                                                              |
| ------------------------------ | ----------- | -------------------------------------------------------------------- |
| Greeting + tanggal             | done        | Tidak membutuhkan akun/network untuk cold start                      |
| Sauh Bagi Jiwa                 | done        | Optional content gateway + fallback                                  |
| Suara Sejati                   | done        | Optional content gateway + fallback                                  |
| Task-first mobile Home         | done        | Prioritas aksi utama, dekorasi dikurangi                             |
| Lanjut membaca / pujian        | in-progress | State reader/hymnal sudah tersimpan; surface Home masih dipoles      |
| Greeting berbasis profil e-GYS | n/a         | e-GYS sengaja menjadi layanan eksternal; GYSApp tidak membaca profil |

## Alkitab

| Fitur                                    | Status      | Catatan                                                 |
| ---------------------------------------- | ----------- | ------------------------------------------------------- |
| TB lengkap SQLite                        | done        | 66 kitab / 1.189 pasal                                  |
| Search seluruh Alkitab                   | done        | SQLite/search index                                     |
| Multi-version TB/KJV/CUV                 | done        | Manifest + install/update/delete + hot-load             |
| Bundled TB fallback                      | done        | Tetap dapat membaca tanpa download awal                 |
| Download progress/cancel/retry           | done        | Range resume bila source mendukung                      |
| SHA-256 verification + atomic activation | done        | Pack rusak tidak mengganti versi aktif                  |
| Reader 1/2 panel                         | done        | Layout responsif mobile/tablet/desktop                  |
| Optional sync scroll                     | done        | Secondary version reader                                |
| Bookmark/history/last position           | done        | Persistensi lokal                                       |
| Ref silang / paralel                     | in-progress | Metadata SQLite tersedia; UX detail masih dipoles       |
| System TTS                               | done        | Voice matching bahasa + controller                      |
| Rich contextual notes                    | in-progress | Notes dasar tersedia; editor/context action belum final |
| Visual/accessibility regression          | in-progress | Perlu matrix 320–1920 + zoom 200%                       |

## Pujian

| Fitur                          | Status      | Catatan                                                                    |
| ------------------------------ | ----------- | -------------------------------------------------------------------------- |
| Katalog buku kidung            | done        | Katalog penuh + fallback lirik                                             |
| KR PDF 533                     | done        | Aset lengkap                                                               |
| KR MIDI                        | done        | WebAudio/WASM                                                              |
| MIDI seek/tempo/transpose      | done        | Stress/perf gate masih diperlukan                                          |
| PDF 1/2 halaman                | in-progress | True container/viewport autofit sudah masuk; menunggu CI/visual regression |
| Fit page / fit width / zoom    | in-progress | DPR-aware canvas render, zoom 70–200%                                      |
| Landscape hint 2 halaman       | done        | Layar kecil portrait                                                       |
| Mode teks + chord              | in-progress | Centered + multi-page extraction; text autofit lanjutan masih perlu        |
| Sharp/flat viewer + player     | done        | State tersinkron                                                           |
| Transpose MIDI -> chord text   | done        | Formatter core sama dengan jalur chord web                                 |
| Restore viewer per lagu        | in-progress | Mode/page/fit/zoom/transpose/scroll disimpan; menunggu regression gate     |
| Chord lazy immutable cache     | done        | Direct `gyschordweb`, SHA-addressed, check-on-open                         |
| Chord melalui Worker           | n/a         | Tidak diperlukan untuk sumber publik                                       |
| Persistent app-level MIDI dock | in-progress | Player lintas route sudah masuk; menunggu CI/E2E                           |
| Playlist persistence           | done        | Local persisted state                                                      |
| Playlist rename/dedup/reorder  | in-progress | Shared store + Naik/Turun accessible sudah masuk; menunggu CI              |
| Loop/shuffle controls          | done        | Label UI sudah manusiawi/Indonesia                                         |

## Iman

| Fitur                        | Status      | Catatan                                                  |
| ---------------------------- | ----------- | -------------------------------------------------------- |
| 10 Pokok Iman id/en/zh       | done        |                                                          |
| Search                       | done        |                                                          |
| PDF lanjutan + resume        | done        | Manifest + SHA verification                              |
| Multi-select/copy/share/note | in-progress | Copy/search tersedia; selection/share parity belum final |

## Literatur & layanan eksternal

| Item                              | Status      | Catatan                                                   |
| --------------------------------- | ----------- | --------------------------------------------------------- |
| Kesaksian                         | done        | Optional gateway + static fallback                        |
| Warta/Manna Sejati                | done        | Optional gateway + static fallback                        |
| Kumpulan Renungan                 | done        | Optional gateway + static fallback                        |
| Panduan Alkitab                   | in-progress | Route ada; katalog masih diperkaya                        |
| e-GYS external launcher           | in-progress | Browser/system opener sudah masuk; menunggu CI            |
| App-owned e-GYS login/session     | n/a         | Sengaja dihapus                                           |
| Google Identity / token exchange  | n/a         | Sengaja dihapus                                           |
| e-GYS profile/member/branch fetch | n/a         | Sengaja dihapus                                           |
| Native e-GYS auth webview bridge  | n/a         | Sengaja dihapus; remote service dibuka via system browser |
| Secure e-GYS token storage        | n/a         | Tidak ada token yang dimiliki GYSApp                      |
| Pujian/Paduan Suara               | done        | External access                                           |
| Buku                              | done        | External access                                           |
| Ibadah Online                     | done        | External access                                           |
| Audio/Video Khotbah               | done        | External access                                           |
| eRhema / Pelita Kecil             | done        | Dipertahankan dari menu legacy                            |
| Podcast / social media            | done        | Facebook / Instagram / YouTube / Spotify                  |

## Backendless-first & optional gateway

| Fitur                         | Status      | Catatan                                           |
| ----------------------------- | ----------- | ------------------------------------------------- |
| GYSApp account backend        | n/a         | Tidak ada account backend                         |
| OAuth di Worker               | n/a         | Tidak diperlukan                                  |
| e-GYS token melalui Worker    | n/a         | Tidak ada token e-GYS di GYSApp                   |
| Chord proxy Worker            | n/a         | Direct public source                              |
| Kirim masukan via gateway     | in-progress | Berguna bila webhook harus disembunyikan          |
| TJC HTML/CORS content gateway | done        | Hanya endpoint yang memerlukan parsing/CORS       |
| Cloudflare deployment         | done        | Optional `gysapp-content-gateway`                 |
| Direct-source audit           | in-progress | Worker dipangkas jika endpoint dapat direct fetch |

## Settings & Data

| Fitur                    | Status      | Catatan                                                |
| ------------------------ | ----------- | ------------------------------------------------------ |
| Light/dark/system        | done        |                                                        |
| UI scale 5% step         | done        | Lebih halus untuk accessibility                        |
| Reader comfort modes     | in-progress | Nyaman/Sangat Besar terus diuji lintas viewport        |
| Backup `.gysapp` AES-GCM | done        |                                                        |
| PWA/offline shell        | done        |                                                        |
| Asset manager terpadu    | in-progress | Bible selesai; hymnal/soundfont konsolidasi berikutnya |
| Reset cache/download     | todo        |                                                        |
| Sabat/reminder native    | todo        |                                                        |

## Native / Distribution

| Target                     | Status      | Catatan                                     |
| -------------------------- | ----------- | ------------------------------------------- |
| Tauri Windows              | in-progress | PR native CI gate aktif                     |
| Tauri Android              | in-progress | `id.sch.kanaan.egys`, versionCode 134       |
| Android signing continuity | in-progress | Harus memakai keystore release Flutter lama |
| Tauri iOS compile gate     | todo        | Runner macOS diperlukan                     |
| iOS signed distribution    | todo        | Memerlukan Apple signing/provisioning       |
| Public release CI          | todo        | Setelah signing material tersedia           |

## Kualitas

| Gate                                | Status      | Catatan                                                         |
| ----------------------------------- | ----------- | --------------------------------------------------------------- |
| TypeScript strict                   | done        | Strictness tidak dilonggarkan saat memperbaiki CI               |
| Unit/component tests                | done        | CI source of truth                                              |
| Native Rust/Tauri PR build          | in-progress | Windows gate aktif                                              |
| Playwright desktop/mobile           | done        | Matrix viewport lanjutan masih perlu                            |
| Secret scan                         | done        | Credential legacy tidak dimigrasikan                            |
| Runtime third-party executable code | done        | Google Identity SDK sudah dihapus; app logic bundled/local      |
| Bundle <250KB gzip initial shell    | in-progress | Global player dilazy-load; PDF/MIDI splitting masih dilanjutkan |
| WCAG 2.2 AA journey utama           | in-progress | Touch target/keyboard/reduced-motion sudah menjadi contract     |
| Production web vitals               | todo        | Diukur setelah deployment stabil                                |

## Blocker eksternal tersisa

1. **Keystore release Android lama** untuk mempertahankan upgrade path aplikasi `id.sch.kanaan.egys`.
2. macOS + Apple signing/provisioning untuk signed iOS release.
3. Cloudflare account/token hanya jika optional content gateway akan dipakai production.
4. Report webhook secret hanya bila Kirim Masukan memakai webhook server-side.

Tidak ada kebutuhan Google OAuth client/secret, Apple auth secret, `SESSION_SECRET`, atau e-GYS credential untuk fungsi e-GYS di GYSApp.
