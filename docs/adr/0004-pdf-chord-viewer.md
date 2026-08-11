# ADR-0004 — PDF/chord viewer: port murni + pdfjs-dist lokal

Status: Accepted (2026-08-11)

## Konteks

Risk spike PDF/chord (S1/S2 plan): viewer partitur + chord note-aligned harus
bekerja di web tanpa CDN runtime dan dapat diuji tanpa browser.

## Hasil spike

- `extractPageNotes` (gyschordweb) diport murni: dominant font-size,
  split multi-char "1 . . 1", grouping baris yTol 2.0, minimal 2 digit.
- `extractLyricLines` + `buildChordedLines` + `findChordedLine` (lyrics-viewer)
  diport murni; posisi chord 0..1 via proyeksi xPct terhadap startPct/widthPct.
- Smoke test dengan PDF asli KR 001 + fixture chord: text layer -> not -> baris
  lirik -> >=1 baris ber-chord. LULUS di Node via pdfjs-dist legacy.
- Viewer web: pdfjs-dist v5 (worker lokal via `?url`), render halaman 1 ke
  canvas, ekstraksi di halaman, mode Teks & Chord dengan badge posisi %.

## Keputusan

- Logika ekstraksi/proyeksi hidup di `packages/core` (murni, tanpa pdfjs).
- pdfjs-dist hanya di apps/web; worker dibundel lokal, nol CDN.
- Layout wrap/autofit dan overlay PDF di atas partitur dikerjakan di fase
  Hymnal penuh (masih memakai kontrak modul ini).
- Fallback chord lintas bait (melodi sama) menyusul bersama editor.

## Konsekuensi

- Kontrak ekstraksi terlindungi test sintetis + smoke PDF asli.
- Upgrade pdfjs-dist aman: hanya satu titik impor di web.
