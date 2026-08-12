# ADR-0006 — Wrapper native (Tauri 2)

Status: Accepted (2026-08-12) — skeleton Windows terkompilasi (cargo check OK)

## Konteks

Web-first selesai; GYSApp perlu diekspor ke Android, Windows, iOS dengan satu
basis kode.

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
