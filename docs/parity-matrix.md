# Parity Matrix GYSApp

Sumber kontrak: `ThenGB/GYSAPP-Fork` (Flutter) dan `gyspnk/gyschordweb` (web chord/MIDI). Audit terakhir: **12 Agustus 2026**. Detail urutan implementasi ada di `docs/implementation-roadmap.md`.

Status: `todo | in-progress | done | n/a`.

## Shell & Navigasi

| Fitur | Status | Catatan |
| --- | --- | --- |
| 5 menu utama | done | Beranda / Alkitab / Pujian / Iman / Lainnya |
| Bottom nav / rail / sidebar responsif | done | Navigasi selalu tersedia |
| i18n id/en/zh foundation | done | Copy feature masih terus diperluas |
| Floating/bubble mobile dock | done | Label tetap terlihat, active indicator restrained |
| Global player tidak menutupi konten/nav | done | App-level dock + reserved space lolos regression mobile |
| Reduced motion | done | Design system menghormati preference OS |

## Beranda

| Fitur | Status | Catatan |
| --- | --- | --- |
| Greeting + tanggal | done | Tidak membutuhkan akun/network untuk cold start |
| Sauh Bagi Jiwa | done | Optional content gateway + fallback |
| Suara Sejati | done | Optional content gateway + fallback |
| Task-first mobile Home | done | Prioritas aksi utama, dekorasi dikurangi |
| Lanjut membaca / pujian | in-progress | State reader/hymnal tersedia; surface Home masih dipoles |
| Greeting berbasis profil e-GYS | n/a | e-GYS adalah layanan eksternal |

## Alkitab

| Fitur | Status | Catatan |
| --- | --- | --- |
| TB lengkap SQLite | done | 66 kitab / 1.189 pasal |
| Search seluruh Alkitab | done | SQLite/search index |
| Multi-version TB/KJV/CUV | done | Manifest + install/update/delete + hot-load |
| Bundled TB fallback | done | Tetap dapat membaca tanpa download awal |
| Download progress/cancel/retry | done | Range resume bila source mendukung |
| SHA-256 verification + atomic activation | done | Pack rusak tidak mengganti versi aktif |
| Reader 1/2 panel | done | Layout responsif mobile/tablet/desktop |
| Optional sync scroll | done | Secondary version reader |
| Bookmark/history/last position | done | Persistensi lokal |
| Ref silang / paralel | in-progress | Metadata tersedia; UX contextual masih dipoles |
| System TTS | done | Voice matching bahasa + controller |
| Rich contextual notes | in-progress | Notes dasar tersedia; editor/context action belum final |
| Responsive regression | done | 320px + tablet landscape + split reader invariant masuk Playwright |
| Full accessibility matrix | in-progress | Masih perlu 320–1920, browser zoom 200%, keyboard-only |

## Pujian

| Fitur | Status | Catatan |
| --- | --- | --- |
| Katalog buku kidung | done | Katalog penuh + fallback lirik |
| KR PDF 533 | done | Aset lengkap |
| KR MIDI | done | WebAudio/WASM; AudioBufferSourceNode benar-benar dimulai |
| MIDI seek/tempo/transpose | done | Pause/resume/seek + tempo reset + stale-load guard dites |
| PDF 1/2 halaman | done | True container/viewport autofit + orientation regression |
| Fit page / fit width / zoom | done | DPR-aware canvas render, zoom 70–200% |
| Landscape hint 2 halaman | done | Layar kecil portrait |
| Mode teks + chord | in-progress | Centered + multi-page extraction; optional text autofit lanjut |
| Sharp/flat viewer + player | done | State tersinkron |
| Transpose MIDI -> chord text | done | Formatter core sama dengan jalur chord web |
| Restore viewer per lagu | done | Mode/page/fit/zoom/transpose/scroll disimpan dan diuji |
| Chord lazy immutable cache | done | Direct `gyschordweb`, SHA-addressed, check-on-open |
| Chord melalui Worker | n/a | Tidak diperlukan untuk sumber publik |
| Persistent app-level MIDI dock | done | Lintas route, tidak overlap nav, regression Playwright |
| Playlist persistence | done | Local persisted state |
| Playlist rename/dedup/reorder | done | Shared store + Naik/Turun keyboard/touch accessible |
| Previous/next playlist | done | Mengikuti active playlist dan boundary loop |
| Loop/shuffle controls | done | Label Indonesia + deterministic core semantics |
| Auto-advance MIDI | done | Track berikutnya otomatis saat ended |
| Rapid MIDI switch safety | done | Request lama tidak boleh mengaktifkan deck setelah track baru/stop |
| Rapid PDF switch safety | done | Loading task stale dibatalkan; stale doc tidak dapat mengambil alih viewer |

## Iman

| Fitur | Status | Catatan |
| --- | --- | --- |
| 10 Pokok Iman id/en/zh | done | |
| Search | done | |
| PDF lanjutan + resume | done | Manifest + SHA verification |
| Multi-select/copy/share/note | in-progress | Copy/search tersedia; selection/share parity belum final |

## Literatur & layanan eksternal

| Item | Status | Catatan |
| --- | --- | --- |
| Kesaksian | done | Optional gateway + static fallback |
| Warta/Manna Sejati | done | Optional gateway + static fallback |
| Kumpulan Renungan | done | Optional gateway + static fallback |
| Panduan Alkitab | in-progress | Route ada; katalog masih diperkaya |
| e-GYS external launcher | done | Browser/system opener + E2E boundary verified |
| App-owned e-GYS login/session | n/a | Sengaja dihapus |
| Google Identity / token exchange | n/a | Sengaja dihapus |
| e-GYS profile/member/branch fetch | n/a | Sengaja dihapus |
| Native e-GYS auth webview bridge | n/a | Remote service dibuka via system browser |
| Secure e-GYS token storage | n/a | Tidak ada token milik GYSApp |
| Pujian/Paduan Suara | done | External access |
| Buku | done | External access |
| Ibadah Online | done | External access |
| Audio/Video Khotbah | done | External access |
| eRhema / Pelita Kecil | done | Dipertahankan dari menu legacy |
| Podcast / social media | done | Facebook / Instagram / YouTube / Spotify |

## Backendless-first & optional gateway

| Fitur | Status | Catatan |
| --- | --- | --- |
| GYSApp account backend | n/a | Tidak ada account backend |
| OAuth di Worker | n/a | Tidak diperlukan |
| e-GYS token melalui Worker | n/a | Tidak ada token e-GYS di GYSApp |
| Chord proxy Worker | n/a | Direct public source |
| Kirim masukan via gateway | in-progress | Dipakai hanya bila webhook perlu disembunyikan |
| TJC HTML/CORS content gateway | done | Hanya endpoint yang memerlukan parsing/CORS |
| Cloudflare deployment | done | Optional `gysapp-content-gateway` |
| Direct-source audit | in-progress | Worker dipangkas jika endpoint dapat direct fetch |

## Settings & Data

| Fitur | Status | Catatan |
| --- | --- | --- |
| Light/dark/system | done | |
| UI scale 5% step | done | Lebih halus untuk accessibility |
| Reader comfort modes | in-progress | Full viewport/zoom accessibility soak tersisa |
| Backup `.gysapp` AES-GCM | done | |
| PWA/offline shell | done | |
| Asset manager terpadu | in-progress | Bible selesai; soundfont/media cleanup berikutnya |
| Reset cache/download | todo | |
| Sabat/reminder native | todo | |

## Native / Distribution

| Target | Status | Catatan |
| --- | --- | --- |
| Tauri Windows compile gate | done | Frontend + Cargo check + Tauri release no-bundle hijau |
| Tauri Android compile gate | done | Debug ARM64 APK, `id.sch.kanaan.egys`, versionCode 134 verified |
| Android signing continuity guard | done | Signed workflow menolak cert SHA-256 yang tidak sesuai |
| Android production upgrade smoke | in-progress | Menunggu keystore production lama + expected fingerprint |
| Tauri iOS compile gate | done | Xcode simulator build di macOS hijau |
| iOS signed distribution | todo | Memerlukan Apple signing/provisioning |
| Public signed release CI | in-progress | Android workflow siap; material signing production belum tersedia |

## Kualitas

| Gate | Status | Catatan |
| --- | --- | --- |
| TypeScript strict | done | Strictness tidak dilonggarkan |
| Unit/component tests | done | Termasuk MIDI lifecycle + latest-request race guards |
| Native PR compile | done | Windows + Android + iOS |
| Playwright desktop/mobile | done | 320px, tablet landscape, Hymnal orientation, player/nav, e-GYS boundary |
| Secret scan | done | Credential legacy tidak dimigrasikan |
| Runtime third-party executable code | done | App logic bundled/local |
| Initial shell <250KB gzip | done | Route-level lazy loading menurunkan main shell ke sekitar 130KB gzip |
| WCAG 2.2 AA journey utama | in-progress | Touch target/reduced-motion ada; full zoom/keyboard audit tersisa |
| Production web vitals | todo | Diukur setelah deployment stabil |

## Blocker eksternal tersisa

1. **Keystore production Android lama + fingerprint sertifikat yang benar** (dari keystore/Play Console) untuk signed upgrade smoke aplikasi `id.sch.kanaan.egys`; APK debug legacy bukan bukti fingerprint production.
2. **Apple signing/provisioning** untuk signed IPA/App Store. macOS compile runner sudah tersedia dan hijau.
3. Cloudflare account/token hanya jika optional content gateway dipakai production.
4. Report webhook secret hanya bila Kirim Masukan memakai webhook server-side.

Tidak ada kebutuhan Google OAuth client/secret, Apple auth secret, `SESSION_SECRET`, atau credential e-GYS untuk fungsi e-GYS di GYSApp.
