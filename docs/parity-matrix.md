# Parity Matrix GYSApp

Sumber kontrak: GYSAPP-Fork commit `4f0d39b` (Flutter) dan gyschordweb commit
`cbc7d386`. Kolom status diisi saat fitur lolos acceptance criteria.

Status: `todo | in-progress | done | n/a`

## Shell & Navigasi

| Fitur                                              | Status      | Acceptance                      |
| -------------------------------------------------- | ----------- | ------------------------------- |
| 5 menu utama (Beranda/Alkitab/Pujian/Iman/Lainnya) | in-progress | Semua route dapat di-deep-link  |
| Bottom nav <600px, rail 600-959, sidebar >=960     | done        | Navigasi tidak pernah auto-hide |
| Player global tidak menutupi konten                | todo        | E2E viewport matrix             |
| i18n id/en/zh                                      | todo        | Switch bahasa tanpa reload data |

## Beranda

| Fitur                                     | Status      | Acceptance                                   |
| ----------------------------------------- | ----------- | -------------------------------------------- |
| Greeting + tanggal + nama akun            | in-progress | Fallback bila offline                        |
| Sauh Bagi Jiwa (slug sbjYYMMDD + feed 6)  | in-progress | Cache per tanggal, invalidasi lintas hari    |
| Suara Sejati (tampil kembali di UI)       | in-progress | Feed + detail author, stale-while-revalidate |
| Ayat hari ini (OurManna -> Alkitab lokal) | todo        | Sanitasi HTML, cache per hari per versi      |
| Lanjutkan membaca / lanjut pujian         | todo        | Restore posisi                               |

## Alkitab

| Fitur                                     | Status      | Acceptance                                   |
| ----------------------------------------- | ----------- | -------------------------------------------- |
| Offline pack per versi                    | todo        | Checksum + install/delete/update (port siap) |
| Reader perikop + split view + scroll sync | in-progress | Parity di 320px dan 1440px                   |
| Cari ayat (phrase, filter PL/PB/buku)     | in-progress | Search warm <100ms p95                       |
| Ref silang, perikop paralel               | todo        | Golden fixtures                              |
| Bookmark + catatan rich text + histori    | todo        | Ekspor/impor via backup                      |
| Bacaan hari ini + reminder                | todo        | Notifikasi saat app tidak aktif              |
| TTS (system + cloud)                      | todo        | Range ayat, auto-next                        |

## Pujian

| Fitur                                                | Status      | Acceptance                       |
| ---------------------------------------------------- | ----------- | -------------------------------- |
| Katalog 6 buku kidung + search                       | todo        | Ordered-match nomor/judul/lirik  |
| PDF viewer (1/2 halaman, vertikal, zoom)             | todo        | pdfjs-dist lokal, offline        |
| Mode teks + wrap + autofit                           | todo        | Chord tetap sejajar saat wrap    |
| Chord v2 note-aligned + transpose + key              | in-progress | Golden fixtures, max 4px drift   |
| MIDI player (tempo/transpose/instrumen/seek)         | todo        | Benchmark audio, no crackle      |
| Playlist (create/rename/delete/reorder/loop/shuffle) | todo        | Persisten lintas sesi            |
| Chord lazy cache (lihat ADR-0002)                    | in-progress | Nol chord saat instalasi pertama |
| Catatan pujian + histori                             | todo        |                                  |

## Iman

| Fitur                            | Status | Acceptance              |
| -------------------------------- | ------ | ----------------------- |
| 10 pokok id/en/zh + search       | todo   |                         |
| Multi-select + copy/share + note | todo   |                         |
| PDF lanjutan per topik + resume  | todo   | Manifest GitHub release |

## Literatur & Media Online

Semua item wajib dari audit e-GYS/tjc.org (tidak boleh hilang):

| Item                               | Sumber                         | Status | Acceptance                      |
| ---------------------------------- | ------------------------------ | ------ | ------------------------------- |
| Kesaksian (feed)                   | tjc.org via BFF                | todo   | Selector dari remote config     |
| Manna/Warta Sejati (grid cover)    | tjc.org via BFF                | todo   | Long-press preview              |
| Panduan Pemahaman Alkitab (PDF)    | config + tjc.org               | todo   | List dari remote config         |
| Kumpulan Renungan                  | tjc.org via BFF                | todo   |                                 |
| Pujian/Paduan Suara (webview)      | tjc.org/id/pujian/pujian-padus | todo   | Jika iframe diblok, tombol Buka |
| Buku (webview)                     | tjc.org/id/literatur/buku      | todo   |                                 |
| Ibadah Online                      | tjc.org/id/sabat/              | todo   |                                 |
| Audio Khotbah                      | tjc.org/id/audio-khotbah/      | todo   |                                 |
| Video Khotbah                      | tjc.org/id/video-khotbah/      | todo   |                                 |
| eRhema, Pelita Kecil, sosial media | app_menu config                | todo   | Remote catalog                  |

## Akun & e-GYS

| Fitur                       | Status | Acceptance                  |
| --------------------------- | ------ | --------------------------- |
| OAuth Google + Apple (PKCE) | todo   | Web + Tauri custom scheme   |
| Profile + enrich legacy     | todo   | Token tidak di localStorage |
| Terjemahan dari e.gys.or.id | todo   | Merge key + cache           |
| Deep link /openaction/*     | todo   | Validasi route              |
| Kirim masukan via BFF       | todo   | Tanpa SMTP client-side      |

## Settings & Data

| Fitur                                      | Status | Acceptance              |
| ------------------------------------------ | ------ | ----------------------- |
| Tema light/dark/system + aksen + font      | todo   | Kontras AA semua aksen  |
| Asset manager (bible/hymnal/soundfont/pdf) | todo   | Verifikasi size+SHA-256 |
| Backup .gysapp (AES-GCM)                   | todo   | Round-trip test         |
| Reset penuh + hapus cache                  | todo   |                         |
| Notifikasi Sabat + reminder                | todo   | Config-driven           |

## Kualitas

| Metrik                              | Target   | Status           |
| ----------------------------------- | -------- | ---------------- |
| TypeScript strict, nol `any`        | gate     | done (bootstrap) |
| Coverage core >=85%, feature >=70%  | gate     | in-progress      |
| Bundle utama <250KB gzip            | perf     | todo             |
| LCP <2.5s p75, INP <200ms, CLS <0.1 | perf     | todo             |
| WCAG 2.2 AA journey utama           | a11y     | todo             |
| Secret scan 0 temuan                | security | done (CI gate)   |
| Nol runtime CDN                     | security | done (bootstrap) |
