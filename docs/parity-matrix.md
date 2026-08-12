# Parity Matrix GYSApp

Sumber kontrak: `ThenGB/GYSAPP-Fork` (Flutter) dan `gyspnk/gyschordweb` (web chord/MIDI). Audit terakhir: **12 Agustus 2026**. Detail urutan implementasi ada di `docs/implementation-roadmap.md`.

Status: `todo | in-progress | done | n/a`.

## Shell & Navigasi

| Fitur                                 | Status      | Catatan                                     |
| ------------------------------------- | ----------- | ------------------------------------------- |
| 5 menu utama                          | done        | Beranda / Alkitab / Pujian / Iman / Lainnya |
| Bottom nav / rail / sidebar responsif | done        | Navigasi selalu tersedia                    |
| i18n id/en/zh foundation              | done        | Perlu meluaskan copy semua feature          |
| Global player tidak menutupi konten   | in-progress | Perlu viewport E2E matrix                   |
| Floating/bubble dock + motion final   | in-progress | Redesign dimulai di PR parity hardening     |

## Beranda

| Fitur                          | Status | Catatan                                        |
| ------------------------------ | ------ | ---------------------------------------------- |
| Greeting + tanggal             | done   | Tidak bergantung akun untuk cold start         |
| Profile-aware greeting         | todo   | Gunakan profil e-GYS bila sesi tersedia        |
| Sauh Bagi Jiwa                 | done   | Optional content gateway + static fallback     |
| Suara Sejati                   | done   | Optional content gateway + static fallback     |
| Ayat hari ini                  | todo   | Gunakan sumber remote -> mapping Alkitab lokal |
| Lanjut membaca / lanjut pujian | todo   | Restore posisi/history                         |

## Alkitab

| Fitur                           | Status      | Catatan                                     |
| ------------------------------- | ----------- | ------------------------------------------- |
| TB lengkap SQLite 1 file        | done        | 66 kitab / 1.189 pasal                      |
| Search seluruh Alkitab          | done        | PL/PB + phrase flow tersedia                |
| Reader + perikop                | done        | Dasar reader tersedia                       |
| Split view + scroll sync        | in-progress | Belum parity Flutter                        |
| Ref silang + paralel            | todo        | Data ada, UI belum lengkap                  |
| Multi-version asset manager     | todo        | TB/KJV/CUV install/update/delete            |
| Bookmark/history                | todo        |                                             |
| Catatan                         | in-progress | Notes dasar ada, rich contextual note belum |
| Download manager cancel/refresh | todo        |                                             |
| TTS system/cloud                | todo        |                                             |

## Pujian

| Fitur                                | Status      | Catatan                                                                                    |
| ------------------------------------ | ----------- | ------------------------------------------------------------------------------------------ |
| Katalog buku kidung                  | done        | Katalog penuh + fallback lirik                                                             |
| KR PDF 533                           | done        | Aset lengkap                                                                               |
| KR MIDI                              | done        | Engine WebAudio/WASM tersedia                                                              |
| MIDI seek/tempo/transpose/instrument | done        | Perlu stress/perf gate                                                                     |
| Playlist + loop/shuffle              | done        | Persisten                                                                                  |
| PDF viewer dasar                     | done        |                                                                                            |
| 1/2 halaman, zoom, fit modes         | in-progress | UI + persistence sudah masuk; perlu visual regression lintas viewport                      |
| Landscape hint 2 halaman             | done        | Muncul pada portrait layar kecil                                                           |
| Mode teks + chord                    | in-progress | Centered horizontal/vertical + multi-page extraction masuk; autofit lanjutan masih perlu   |
| Chord note-aligned                   | in-progress | Golden drift gate belum final                                                              |
| Sharp/flat toggle di viewer + player | done        | Satu state accidental; display chord menggunakan formatter `gyschordweb`                   |
| Transpose MIDI -> chord text sync    | done        | Perubahan transpose player langsung mengubah display chord teks                            |
| Chord lazy cache                     | done        | Direct `gyschordweb`; install awal nol chord; check-on-open; SHA sama tidak download ulang |
| Chord melalui Cloudflare Worker      | n/a         | Sengaja dihapus; tidak ada alasan melakukan proxy untuk sumber publik                      |
| Catatan/history pujian               | in-progress | Notes dasar tersedia                                                                       |

## Iman

| Fitur                        | Status      | Catatan                                       |
| ---------------------------- | ----------- | --------------------------------------------- |
| 10 Pokok Iman id/en/zh       | done        |                                               |
| Search                       | done        |                                               |
| PDF lanjutan + resume        | done        | Manifest + SHA verification                   |
| Multi-select/copy/share/note | in-progress | Copy/search ada; selection/share parity belum |

## Literatur & e-GYS

| Item                                               | Status      | Catatan                                                                                    |
| -------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------ |
| Kesaksian                                          | done        | Optional gateway + static fallback                                                         |
| Warta/Manna Sejati                                 | done        | Optional gateway + static fallback                                                         |
| Kumpulan Renungan                                  | done        | Optional gateway + static fallback                                                         |
| Panduan Alkitab                                    | in-progress | Route ada; catalog remote/config masih perlu diperkaya                                     |
| e-GYS integrated account                           | in-progress | Direct ke e-GYS; tidak ada akun/session backend GYSApp                                     |
| Google -> e-GYS web exchange                       | in-progress | Adapter + tests masuk; perlu validasi origin OAuth pada deployment production              |
| Native hosted e-GYS login                          | in-progress | Isolated Tauri auth webview + compatibility bridge; native CI menjadi gate                 |
| Profil e-GYS                                       | done        | Kontrak canonical + `/api/v1/users/profile`                                                |
| Deteksi Jemaat / Simpatisan                        | done        | Alias member/baptism dinormalisasi; generic `ACTIVE` tidak dianggap membership             |
| Deteksi Cabang / Wilayah                           | done        | `branchname/branch/wilayah/region/...` dinormalisasi                                       |
| Secure persistence token web                       | done        | `sessionStorage` only; bukan localStorage/IndexedDB                                        |
| Secure persistence token native                    | todo        | Tambahkan OS-backed secure store; jangan memakai general Tauri store                       |
| Legacy HTML profile enrichment                     | todo        | Hanya jika API e-GYS deployment tertentu masih tidak mengembalikan branch/member semantics |
| Pujian/Paduan Suara                                | done        | Akses eksternal dipertahankan                                                              |
| Buku                                               | done        | Akses eksternal dipertahankan                                                              |
| Ibadah Online                                      | done        |                                                                                            |
| Audio Khotbah                                      | done        |                                                                                            |
| Video Khotbah                                      | done        |                                                                                            |
| eRhema                                             | done        | Dipulihkan dari app_menu Flutter                                                           |
| Pelita Kecil                                       | done        | Dipulihkan dari app_menu Flutter                                                           |
| Podcast / Facebook / Instagram / YouTube / Spotify | done        | Dipulihkan dari app_menu Flutter                                                           |
| Remote catalog/menu config                         | todo        | Saat ini daftar aman dibundel sebagai fallback                                             |

## Backendless-first & optional gateway

| Fitur                              | Status      | Catatan                                                             |
| ---------------------------------- | ----------- | ------------------------------------------------------------------- |
| GYSApp account backend             | n/a         | Tidak dibuat; e-GYS tetap identity/member service                   |
| Google/Apple OAuth di Worker       | n/a         | Tidak diperlukan; Worker tidak memiliki sesi pengguna               |
| e-GYS token melalui Worker         | n/a         | Dilarang oleh arsitektur; token langsung client <-> e-GYS           |
| Kirim masukan via optional gateway | in-progress | Implementasi ada; webhook production opsional                       |
| TJC HTML/CORS content gateway      | done        | Hanya untuk endpoint yang tidak aman/praktis diakses langsung       |
| Cloudflare Worker config/workflow  | done        | Worker diperkecil menjadi `gysapp-content-gateway`                  |
| Direct-source audit                | in-progress | Hapus route gateway bila sumber publik kelak dapat diakses langsung |
| Deep link/openaction               | todo        |                                                                     |

## Settings & Data

| Fitur                    | Status | Catatan                    |
| ------------------------ | ------ | -------------------------- |
| Light/dark/system        | done   |                            |
| Font scaling             | done   |                            |
| Backup `.gysapp` AES-GCM | done   |                            |
| PWA/offline shell        | done   |                            |
| Asset manager terpadu    | todo   | Bible/hymnal/soundfont/pdf |
| Reset cache/download     | todo   |                            |
| Sabat/reminder native    | todo   |                            |

## Native / Distribution

| Target                     | Status      | Catatan                                                                                    |
| -------------------------- | ----------- | ------------------------------------------------------------------------------------------ |
| Tauri Windows              | in-progress | Wrapper + PR native CI gate                                                                |
| Tauri Android              | in-progress | Package id `id.sch.kanaan.egys`, versionCode 134; native login bridge memakai shared Rust  |
| Android signing continuity | in-progress | Harus memakai keystore release Flutter lama; secret material perlu dipasang pada repo baru |
| Tauri iOS                  | todo        | Memerlukan runner macOS untuk build/signing release                                        |
| Public release CI          | todo        | Setelah signing material/platform credential tersedia                                      |

## Kualitas

| Gate                                      | Status      | Catatan                                                          |
| ----------------------------------------- | ----------- | ---------------------------------------------------------------- |
| TypeScript strict                         | done        |                                                                  |
| Unit/component tests                      | done        | CI menjadi source of truth                                       |
| e-GYS normalization/session tests         | done        | Alias membership/branch + invalid-session path                   |
| Native Rust/Tauri PR build gate           | in-progress | `native-windows` sekarang berjalan pada PR                       |
| Playwright desktop/mobile smoke           | done        | Perlu perluasan viewport matrix                                  |
| Secret scan                               | done        | Jangan migrasikan credential legacy Flutter                      |
| Runtime executable third-party code       | in-progress | App logic lokal; Google Identity SDK menjadi auth-only exception |
| Coverage target core >=85%, feature >=70% | in-progress |                                                                  |
| Bundle <250KB gzip initial shell          | in-progress | Code splitting sudah dimulai                                     |
| WCAG 2.2 AA journey utama                 | in-progress | Design system sudah mengarah ke target ini                       |
| LCP/INP/CLS production budget             | todo        | Ukur setelah deploy frontend production stabil                   |

## Blocker eksternal tersisa

1. Google OAuth **authorized web origin** untuk domain deployment GYSApp perlu cocok dengan client e-GYS; tidak membutuhkan client secret di GYSApp.
2. Cloudflare account/token **hanya bila optional content gateway akan dideploy**.
3. Report webhook secret **hanya bila fitur Kirim Masukan memakai webhook server-side**.
4. **Keystore release lama** untuk mempertahankan Android upgrade path (bukan membuat signing key baru).
5. macOS + Apple signing/provisioning untuk iOS release.

Tidak ada kebutuhan `SESSION_SECRET`, Google OAuth secret, Apple OAuth secret, atau e-GYS credential di Cloudflare Worker.
