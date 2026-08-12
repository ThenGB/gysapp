# ADR-0003 — Backendless-first + optional content gateway

Status: Accepted (revised 2026-08-12)

## Konteks

GYSApp adalah aplikasi web-first/local-first. Mayoritas fitur tidak membutuhkan backend milik GYSApp:

- chord dan manifest dapat dibaca langsung dari `gyschordweb`/GitHub;
- e-GYS adalah layanan eksternal dan autentikasi dilakukan langsung di `https://e.gys.or.id`;
- PDF, buku, media, eRhema, dan situs TJC lain dapat dibuka langsung saat sumber mendukung akses browser/native opener;
- data lokal, playlist, notes, settings, backup, Alkitab, MIDI, dan cache tidak memerlukan server.

Beberapa halaman TJC masih membutuhkan parsing HTML/normalisasi server-side karena CORS atau struktur markup. Kirim masukan juga membutuhkan gateway bila webhook harus dirahasiakan.

## Keputusan

- Prinsip utama: **no backend unless necessary**.
- Cloudflare Worker bukan backend akun dan bukan dependency untuk fitur inti.
- Worker hanya menjadi **optional content gateway** untuk:
  - `/api/content/*` yang memang membutuhkan parsing/CORS workaround;
  - `/api/report` bila report diteruskan ke webhook rahasia.
- Tidak ada `/api/auth/*`, session GYSApp, Google OAuth, Apple OAuth, atau token e-GYS di Worker.
- Tidak ada `/api/chords/*`; chord diambil langsung dari sumber publik `gyschordweb` dan dicache content-addressed di perangkat.
- e-GYS dibuka sebagai layanan eksternal. GYSApp tidak mengekstrak, menyalin, atau menyimpan credential/session e-GYS.
- Bila endpoint publik TJC kemudian mendukung CORS dan format stabil, route gateway tersebut boleh dihapus dan frontend beralih ke akses langsung.
- Semua secret yang tersisa hanya secret integrasi server-side yang benar-benar diperlukan, misalnya `REPORT_WEBHOOK_URL`.

## Konsekuensi

- Fitur inti tetap berjalan walau Worker tidak tersedia.
- Surface area backend, secret, cookie, dan auth berkurang drastis.
- Chord tidak melakukan hop tambahan melalui Cloudflare.
- Login e-GYS mengikuti implementasi resmi situs e-GYS dan tidak diduplikasi di GYSApp.
- Gateway dapat diperkecil atau dihapus bertahap jika seluruh sumber online sudah aman diakses langsung.
