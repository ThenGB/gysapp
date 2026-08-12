# Bible + Mobile Parity Milestone

## Bible asset lifecycle

- Source of truth: `ThenGB/GYSApp-Data/latest/bibles-manifest.json`.
- Supported packs: `b_tb`, `b_kjv`, `b_cuv`.
- TB remains bundled as a safe offline fallback; downloaded TB is an overlay/update.
- Downloaded packages are never activated before package SHA-256 verification succeeds.
- `GYSPKG1` compatibility exists only to decode the legacy distribution package. Its static key is obfuscation-only; integrity comes from HTTPS + SHA-256.
- IndexedDB stores installed SQLite bytes and resumable partial package bytes.
- Cancellation uses `AbortController`; retry reuses partial bytes when the server accepts HTTP Range.
- Updating is atomic: the old installed database remains usable until the replacement verifies, decodes, and is committed.

## Reader state

- Reader state is non-sensitive and local: last location, history, bookmarks, split mode, sync-scroll preference, secondary version, and reader scale.
- Split mode reads the same book/chapter from two independently installed versions.
- TTS defaults to system voices through the Web Speech API and uses language matching per Bible version.
- Cross-reference and parallel metadata come from the SQLite catalog; no generated references are invented.

## Mobile design direction

The mobile UI follows the approved comfort-first concept: warm neutral surfaces, restrained GYS/brand accents, thin 1px separators, large readable typography, permanently labelled primary navigation, and 48px minimum targets (56px for comfort presets/primary actions where practical).

Official True Jesus Church Indonesia logo assets are sourced from `gyspnk/gyschordweb/docs/assets/logo`; the application does not redraw or reinterpret the church mark.
