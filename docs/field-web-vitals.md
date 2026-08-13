# Field Web Vitals / RUM

GYSApp menyiapkan field Web Vitals sebagai **opt-in deployment capability**, bukan dependency runtime wajib.

## Default behavior

Tanpa `VITE_CLOUDFLARE_WEB_ANALYTICS_TOKEN`, aplikasi tidak menyisipkan beacon analytics dan tidak membuat request telemetry. Fitur inti, PWA, dan native build tetap bekerja normal.

Walaupun token tersedia di environment, runtime Tauri selalu menolak instalasi beacon. Field analytics ini hanya ditujukan untuk deployment web production.

## Mengaktifkan pada GitHub Pages

1. Buat Web Analytics site/token untuk deployment GYSApp yang akan diukur.
2. Tambahkan repository/environment variable GitHub Pages:
   - `VITE_CLOUDFLARE_WEB_ANALYTICS_TOKEN`
3. Deploy ulang `main` melalui workflow `deploy-pages`.
4. Verifikasi di browser production bahwa `gysapp-cloudflare-web-analytics` muncul setelah page `load` dan tidak muncul pada Tauri/native app.

Token ini sengaja diperlakukan sebagai konfigurasi deployment. Jangan hard-code token ke source atau mengubah native CSP hanya untuk analytics.

## Privacy boundary

GYSApp tidak menambahkan user id, e-GYS identity, email, note content, Bible search term, atau payload custom lain ke beacon. Loader hanya memberikan token Web Analytics kepada script provider.

Sebelum mengaktifkan analytics pada deployment publik, tetap review kebutuhan privacy/consent yang berlaku untuk deployment tersebut. Bila analytics tidak diperlukan, biarkan variable kosong.

## CSP bila web deployment menambahkan policy sendiri

Native/Tauri CSP tidak perlu diubah. Untuk deployment web yang memasang CSP terpisah, ikuti domain yang disyaratkan oleh dokumentasi provider untuk script beacon dan endpoint pengumpulan data.

## Release evidence

Field gate dinilai dari traffic nyata setelah beta cukup stabil. Catat:

- periode observasi;
- sample size;
- desktop/mobile mix;
- network/device mix bila tersedia;
- route dengan outlier;
- LCP p75;
- INP p75;
- CLS p75.

Target PR #4 / release:

- LCP p75 < 2.5 s;
- INP p75 < 200 ms;
- CLS p75 < 0.1.

Satu Lighthouse atau production-preview run bukan pengganti field p75. Automated Playwright tetap berfungsi sebagai lab regression guard, sedangkan dokumen ini mengatur evidence dari real-user beta traffic.
