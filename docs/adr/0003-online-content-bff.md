# ADR-0003 — Backendless-first, static-snapshot-first, optional content gateway

Status: Accepted (revised 2026-08-12)

## Konteks

GYSApp adalah aplikasi web-first/local-first. Mayoritas fitur tidak membutuhkan backend milik GYSApp:

- chord dan manifest dibaca langsung dari `gyschordweb`/GitHub;
- e-GYS adalah layanan eksternal dan autentikasi dilakukan langsung di `https://e.gys.or.id`;
- PDF, MIDI, soundfont, Alkitab, playlist, notes, settings, dan backup berada di client/local storage;
- situs dan dokumen eksternal dibuka melalui browser/system opener;
- konten TJC yang perlu parsing sudah dapat dinormalisasi menjadi snapshot JSON saat build/scheduled sync, sehingga browser tidak perlu mem-parsing HTML lintas-origin.

Sumber TJC saat ini terdiri dari WordPress REST untuk Sauh dan halaman HTML untuk Suara Sejati/literatur. Halaman HTML tetap merupakan upstream yang cocok diproses di lingkungan server/CI karena struktur markup dan kebijakan CORS dapat berubah. GYSApp tidak perlu menjadikan akses live tersebut sebagai dependency cold-start.

## Keputusan

- Prinsip utama: **no backend unless necessary**.
- Runtime web memakai **snapshot statis sebagai default**. `sync-content.yml` memperbarui Sauh, Suara Sejati, Kesaksian, Warta, dan Renungan dari `tjc.org` setiap 6 jam dan menyimpan hasil normalisasi di `apps/web/public/data/content`.
- Snapshot menggunakan parser yang sama dengan `apps/edge`, sehingga kontrak parsing tetap satu sumber dan teruji.
- Cloudflare Worker bukan backend akun dan bukan dependency fitur inti.
- Worker hanya menjadi **optional content/report gateway** untuk:
  - near-live content bila suatu deployment sengaja mengaktifkan `VITE_CONTENT_GATEWAY_BASE`;
  - HTML/CORS normalization ketika snapshot berkala tidak cukup;
  - `/api/report` bila laporan diteruskan ke webhook rahasia.
- Tidak ada `/api/auth/*`, session GYSApp, Google OAuth, Apple OAuth, atau token e-GYS di Worker.
- Tidak ada `/api/chords/*`; chord diambil langsung dari sumber publik `gyschordweb` dan dicache content-addressed di perangkat.
- e-GYS dibuka sebagai layanan eksternal. GYSApp tidak mengekstrak, menyalin, atau menyimpan credential/session e-GYS.
- Browser tidak perlu melakukan direct fetch ke halaman HTML TJC untuk journey normal. Jika di masa depan endpoint publik menyediakan API/CORS yang stabil, scheduled sync atau optional gateway boleh disederhanakan lagi.
- Secret yang tersisa hanya secret integrasi server-side yang benar-benar dipakai, misalnya `REPORT_WEBHOOK_URL` serta credential deployment Cloudflare bila gateway diaktifkan.

## Konsekuensi

- Fitur inti dan konten snapshot tetap tersedia walau Worker tidak pernah dideploy.
- Cold-start dan navigasi konten tidak bergantung pada CORS/availability `tjc.org` saat itu.
- Konten normal dapat tertinggal paling lama kira-kira satu interval sinkronisasi, dengan stale local cache sebagai fallback tambahan.
- Surface area backend, secret, cookie, dan auth berkurang drastis.
- Chord/PDF/MIDI tidak melakukan hop tambahan melalui Cloudflare.
- Login e-GYS mengikuti implementasi resmi situs e-GYS dan tidak diduplikasi di GYSApp.
- Worker dapat dihapus sepenuhnya dari suatu deployment jika report webhook dan near-live content tidak diperlukan.
