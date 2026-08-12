# ADR-0004 — Integrasi autentikasi dan profil e-GYS tanpa backend akun GYSApp

Status: Accepted (2026-08-12)

## Konteks

GYSAPP-Fork sudah mengintegrasikan login e-GYS dan menggunakan profil e-GYS untuk mengenali cabang/wilayah serta status keanggotaan Jemaat/Simpatisan. Migrasi web/Tauri tetap membutuhkan kemampuan tersebut, tetapi membuat OAuth/session backend kedua di Cloudflare akan menduplikasi identity system e-GYS dan menambah secret, cookie cross-site, deployment, serta failure mode yang tidak perlu.

API e-GYS yang dipakai aplikasi lama berada di `https://e.gys.or.id/api/v1`. Setelah autentikasi, profil dibaca dari `/users/profile`. Bentuk response e-GYS pernah berubah sehingga domain GYSApp membutuhkan normalizer yang stabil.

## Keputusan

### Identity owner

- e-GYS tetap menjadi **identity + member service**.
- GYSApp tidak mempunyai database akun, password, OAuth callback server, JWT session, atau session cookie sendiri.
- Cloudflare optional content gateway **tidak pernah menerima token e-GYS**.

### Web/PWA

- Google Identity menghasilkan provider credential pada browser.
- Credential tersebut ditukar **langsung ke e-GYS** melalui `/auth/google/callbackgis`, sama seperti alur web pada GYSAPP-Fork.
- Token aplikasi e-GYS disimpan hanya di `sessionStorage`; tidak ke `localStorage`, IndexedDB, backup `.gysapp`, analytics, atau log.
- Production deployment boleh override public Google client ID melalui `VITE_EGYS_GOOGLE_CLIENT_ID` bila e-GYS memakai client terpisah untuk origin baru.
- Google Identity SDK adalah pengecualian executable third-party yang dibatasi hanya untuk proses identity; business logic aplikasi tetap bundled/local.

### Native Tauri

- Login menggunakan webview terpisah yang memuat halaman resmi e-GYS.
- Remote auth window **tidak masuk capability Tauri** dan tidak memperoleh akses IPC/native API umum.
- Compatibility bridge hanya menangani protokol login `mobile` yang sudah digunakan halaman e-GYS terhadap Flutter (`googlelogin`, `applelogin`, `googlelogged`, `applelogged`).
- Token hasil login di-handoff satu kali ke window utama lalu auth window ditutup.
- Top-level navigation dibatasi ke e-GYS serta domain identity Google/Apple yang diperlukan.
- Persistensi token native lintas restart harus memakai OS-backed secure storage pada tahap berikutnya; jangan memakai general-purpose Tauri Store untuk bearer token.

### Profil dan membership

`packages/core` menormalisasi variasi profile e-GYS menjadi kontrak canonical:

- nama/email/foto/telepon;
- `branchId` dan `branchName` dari alias branch/wilayah/region/congregation;
- `memberType` hanya `Jemaat | Simpatisan | null`;
- baptism boolean/number/string dapat menjadi sumber status keanggotaan;
- generic account status seperti `ACTIVE`/`VERIFIED` tidak boleh ditampilkan sebagai jenis anggota.

Bila suatu deployment e-GYS tidak lagi mengirim semantic branch/member data dari `/users/profile`, fallback enrichment harus didesain terpisah tanpa mengirim bearer token melalui optional content gateway.

## Konsekuensi

### Positif

- tidak ada backend auth GYSApp yang harus dioperasikan;
- tidak ada `SESSION_SECRET`, Google client secret, Apple secret, atau e-GYS credential di Worker;
- profil cabang dan keanggotaan tetap terintegrasi ke UI;
- web dan native berbagi kontrak + normalizer yang sama;
- token tidak menjadi bagian backup/general application state.

### Trade-off

- web production bergantung pada origin yang diizinkan konfigurasi Google/e-GYS;
- native secure persistence lintas restart memerlukan adapter secure storage tambahan;
- kontrak API e-GYS tetap eksternal sehingga contract/regression tests perlu dipertahankan.

## Security invariants

1. Jangan log token/provider credential/cookie.
2. Jangan persist token ke localStorage/IndexedDB/general Tauri store.
3. Jangan mengirim token e-GYS ke Cloudflare content gateway.
4. Jangan memberi remote e-GYS webview capability Tauri umum.
5. Clear session lokal saat `/users/profile` mengembalikan 401/403.
