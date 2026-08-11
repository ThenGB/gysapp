# ADR-0002 — Chord lazy cache content-addressed

Status: Accepted (2026-08-11)

## Konteks

Flutter lama mengunduh seluruh delta katalog chord saat fitur pujian pertama
dibuka, dan chord yang sudah ada tidak pernah dicek update. Di web,
lookup chord memakai `dart:io` sehingga chord tidak pernah tampil. Persyaratan
baru: tidak ada chord tersimpan saat instalasi; saat lagu dibuka cek update
gyschordweb; unduh hanya chord baru/berubah; file lama tidak ditimpa.

## Keputusan

- Cache immutable content-addressed: `blobs/{sha256[0:2]}/{sha256}.chord.json`.
- `index.json` sebagai active pointer (commit point) yang ditulis atomik.
- Pemeriksaan manifest via BFF `/api/chords/manifest` (ETag + 304), short-circuit
  berdasarkan `manifestSha256`/`sourceCommit`; dedup 60s.
- Download file hanya untuk ID lagu yang dibuka, dari URL immutable
  `raw.githubusercontent.com/gyspnk/gyschordweb/{sourceCommit}/{path}`.
- Validasi size + SHA-256 + schema v2 sebelum blob aktif.
- Blob lama dipertahankan >=14 hari (rollback); GC hanya unreferenced saat idle;
  byte limit chord 25-50MB.
- Negative-cache per `sourceCommit` untuk lagu tanpa chord.
- Web dan Tauri berbagi contract test yang sama.

## Konsekuensi

- First-open hanya 1 request manifest + 1 file chord.
- Reset chord hanya menghapus pointer/entry lagu.
