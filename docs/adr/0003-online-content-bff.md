# ADR-0003 — Konten online via BFF & remote catalog

Status: Accepted (2026-08-11)

## Konteks

Sauh, Suara Sejati, Kesaksian, Warta, Renungan, Panduan, dan menu dinamis
bersumber dari tjc.org (WP REST + HTML scrape) yang tidak bisa di-scrape
aman dari browser (CORS). Report memakai SMTP dengan kredensial di client.

## Keputusan

- Satu Cloudflare Worker BFF (Hono) mengekspos konten ternormalisasi.
- `/api/content/*` + `/api/chords/manifest` + `/api/report` + `/api/auth/*`.
- Catalog online (`/api/content/catalog`) dengan fallback bundel; URL di allowlist.
- Feed stale-while-revalidate; cache per tanggal slug sbjYYMMDD.
- Parser HTML server-side dengan fixture tests; perubahan markup terdeteksi CI.
- Semua URL eksternal terekam di registry terverifikasi (tidak tersebar di komponen).

## Konsekuensi

- Frontend tidak pernah tahu URL scraper/CSS selector.
- Item baru muncul tanpa update aplikasi.
