# GYSApp

Web-first companion aplikasi Gereja Yesus Sejati. Satu basis kode TypeScript
berjalan sebagai PWA dan dibungkus Tauri 2 untuk Android, Windows, dan iOS.

## Struktur

```text
apps/web        Web app (React 19 + Vite + PWA)
apps/edge       Cloudflare Worker BFF (rencana)
apps/native     Wrapper Tauri 2 (rencana, setelah Web GA)
packages/core   Domain murni tanpa React/DOM/IO (chord, cache, dll.)
packages/contracts  Schema dan kontrak (zod) yang dipakai semua target
tests/fixtures  Fixture data untuk contract tests
```

## Perintah

```text
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

## Sumber referensi

- Aplikasi Flutter lama: `gyspnk`/GYSAPP-Fork (commit `4f0d39b`)
- Chord/MIDI web produksi: `gyspnk`/gyschordweb (commit `cbc7d386`)

Lihat `docs/parity-matrix.md` dan `docs/adr/` untuk kontrak dan keputusan arsitektur.
