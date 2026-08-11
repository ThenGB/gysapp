# ADR-0001 — Stack & struktur GYSApp

Status: Accepted (2026-08-11)

## Konteks

Aplikasi Flutter sulit dimaintain dan ditest; chord/MIDI sudah terbukti di
`gyschordweb` (web produksi). GYSApp harus web-first, dapat diexport ke
Android/Windows/iOS dengan satu basis kode, dan tidak menyimpan aset besar
di history git.

## Keputusan

- Frontend: React 19 + TypeScript strict + Vite PWA.
- Wrapper: Tauri 2 (satu shell untuk Android/Windows/iOS), dibangun setelah Web GA.
- Monorepo pnpm: `apps/*`, `packages/*`.
- Domain murni di `packages/core` tanpa React/DOM/fetch/IndexedDB.
- Schema/kontrak di `packages/contracts` (zod), dipakai semua target.
- Aset besar di CDN/GitHub Releases + manifest SHA-256, bukan di git.
- Tidak ada migrasi data Flutter lama; state baru.
- Bundle/minified gyschordweb tidak disalin; perilaku dipertahankan via golden tests.

## Konsekuensi

- Satu bahasa untuk web + native; domain dapat diuji tanpa browser.
- Tauri Android/iOS memerlukan pipeline tambahan di fase akhir.
- Semua logika yang diambil dari Flutter/gyschordweb wajib contract test.
