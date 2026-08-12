# ADR-0006 — Wrapper native (Tauri 2)

Status: Accepted (2026-08-12) — skeleton Windows terkompilasi (cargo check OK)

## Konteks

Web-first selesai; GYSApp perlu diekspor ke Android, Windows, iOS dengan satu
basis kode.

## Hasil (2026-08-12)

- Windows: `gysapp.exe` release 20.8 MB — cargo check + tauri build LULUS.
- Android: `tauri android init` + build APK LULUS
  (`GYSApp-0.1.0.apk` 24.5 MB, universal release) dan terverifikasi
  apksigner (SHA-256 cert 7c8b70ba…). Keystore `gysapp-release.keystore`
  TIDAK di-commit (digenerate ulang via CI secrets untuk rilis sungguhan).
- stronghold DITANGGUHKAN: libsodium butuh cross-C compiler (zigbuild) untuk
  Android; secret storage native dijadwalkan ulang (keystore/Keychain).
- iOS: tetap butuh host macOS + signing (di luar mesin Windows).

## Keputusan

- `apps/native/src-tauri` (Tauri 2 + Rust) memakai frontend build yang sama
  (`apps/web/dist`), bukan fork UI.
- Plugin: store (settings), sql/sqlite (data), fs (blob/aset), notification
  (reminder), opener (link eksternal), stronghold (secret/token native).
- CSP ketat untuk WebView; connect-src hanya host konten GYSApp.
- Identifier `org.gyspnk.gysapp` (aplikasi baru terpisah dari Flutter).
- Android: `tauri android init` + keystore di CI (fase berikutnya, butuh
  Android SDK). iOS: butuh host macOS + signing (di luar mesin Windows).

## Konsekuensi

- Semua plugin yang dipakai punya padanan contract test web (port interface).
- Build Windows diverifikasi di CI (native-windows.yml).
