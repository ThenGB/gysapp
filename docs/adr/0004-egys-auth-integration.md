# ADR-0004 — e-GYS sebagai layanan web eksternal

Status: Accepted, revised (2026-08-12)

## Konteks

Migrasi awal sempat membawa pola autentikasi GYSAPP-Fork ke aplikasi web/Tauri: Google Identity pada frontend, token e-GYS, pembacaan profil `/users/profile`, serta webview login khusus pada native. Setelah batas produk diklarifikasi, integrasi tersebut tidak diperlukan: e-GYS adalah situs eksternal yang dapat dibuka pengguna ketika membutuhkan layanan keanggotaan.

Mempertahankan session/token e-GYS di GYSApp akan menambah surface keamanan, dependency terhadap kontrak API eksternal, dan kode native khusus tanpa memberi manfaat pada fitur inti GYSApp.

## Keputusan

- e-GYS diperlakukan sebagai **external service** di `https://e.gys.or.id`.
- GYSApp tidak melakukan login e-GYS, pertukaran Google credential, profile fetch, token handoff, atau session persistence.
- GYSApp tidak menyimpan password, bearer token, cookie, atau profil e-GYS.
- Web membuka e-GYS di tab/browser eksternal.
- Tauri membuka e-GYS menggunakan `tauri-plugin-opener`, sehingga halaman remote tidak pernah dimuat sebagai auth webview yang memiliki lifecycle khusus di GYSApp.
- Tidak ada Cloudflare Worker, OAuth callback, Google client ID, atau secret yang diperlukan untuk login e-GYS.
- CSP main webview tidak memberikan `connect-src` ke e-GYS karena aplikasi tidak melakukan request ke API tersebut.

## Konsekuensi

### Positif

- trust boundary sangat jelas: kredensial tetap berada di e-GYS;
- tidak ada token sensitif yang harus diamankan, di-refresh, di-backup, atau dihapus;
- native shell lebih kecil dan tidak membutuhkan compatibility bridge Flutter;
- web/PWA tidak memuat Google Identity SDK;
- perubahan API/profile e-GYS tidak dapat merusak fungsi inti GYSApp;
- Cloudflare tetap terpisah dan hanya dipakai bila fitur content/report memang memerlukannya.

### Trade-off

- profil/cabang/status anggota tidak ditampilkan di GYSApp;
- pengguna berpindah ke browser sistem untuk menggunakan e-GYS;
- bila suatu hari fitur inti benar-benar membutuhkan data e-GYS, integrasi baru harus dirancang sebagai ADR baru berdasarkan API resmi dan requirement yang konkret, bukan dengan menghidupkan kembali token bridge lama.

## Security invariants

1. Jangan meminta atau menangkap password, provider credential, bearer token, atau cookie e-GYS.
2. Jangan memuat e-GYS ke main webview GYSApp.
3. Jangan meneruskan autentikasi e-GYS melalui Cloudflare/BFF.
4. Gunakan system/browser opener untuk URL eksternal.
5. Bila kebutuhan integrasi berubah, lakukan threat model dan ADR baru sebelum menambah akses API.
