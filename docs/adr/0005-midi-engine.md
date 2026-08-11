# ADR-0005 — MIDI engine: parser murni + render worker lokal

Status: Accepted (2026-08-11)

## Konteks

Risk spike S1 (MIDI): playback tanpa crackling, seek cepat, cache terbatas.
gyschordweb memakai FluidSynth WASM offline-render di worker; CDN tidak boleh.

## Hasil spike

- Parser SMF murni di core (header, track, running status, VLQ) — diverifikasi
  terhadap MIDI KR 001 asli (format 1, multi-track) + round-trip writer.
- `scaleTempo` (rewrite 0x51 MPQN, rate 0.25..4, file tanpa tempo = null) dan
  `transposeNotes` (skip channel 9, clamp 0..127) + instrument override
  di-port sebagai fungsi murni, diuji golden.
- Render smoke di Node: MIDI asli -> transpose +2 -> serialize ->
  js-synthesizer (libfluidsynth-2.4.6 WASM) -> PCM dengan peak > 0.001.
  LULUS.
- Worker klasik lokal (public/js) + vendor di public/vendor (nol CDN);
  soundfont di-cache IndexedDB worker, tidak pernah ganda di Cache API.

## Keputusan

- Semua transformasi di main thread via parser murni; worker hanya render PCM.
- Cache engine per (url, transpose, instrument), tempo-neutral, byte cap 96MB.
- Normalisasi puncak 0.94, trim silent, tail reverb 2s (kontrak gyschordweb).
- AudioWorklet streaming tetap di belakang flag (belum diperlukan).

## Konsekuensi

- Seluruh logika MIDI dapat diuji tanpa browser/WASM.
- Upgrade js-synthesizer = ganti file vendor + sync-vendor.mjs.
