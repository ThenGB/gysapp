# Design System — Quiet Liturgical Editorial

Arah visual GYSApp: minimalis-editorial dengan nuansa liturgis, ramah
pengguna lanjut usia, responsif di semua layout.

## Prinsip

1. Latar ivory hangat (bukan putih polos), teks charcoal hangat.
2. GYS blue untuk aksi; gold hanya penanda kecil.
3. Hierarchy via border tipis + surface tone, bukan shadow tebal.
4. Tanpa glassmorphism, gradient neon, atau grid kartu generik.
5. Section header memakai aksen bar vertikal tipis.
6. Ikon Phosphor regular; duotone hanya untuk highlight.
7. Animasi menghormati `prefers-reduced-motion`.

## Tipografi

| Peran         | Font                        | Catatan              |
| ------------- | --------------------------- | -------------------- |
| UI            | Atkinson Hyperlegible Next  | legible, open-source |
| Konten/reader | Literata                    | serif editorial, OFL |
| Aset font     | WOFF2 lokal subset id/en/zh | nol runtime CDN      |

Floor ukuran: UI 16px, label sekunder 14px, konten baca 20px default 21px,
line-height reader 1.65-1.8.

## Breakpoint

| Lebar     | Shell             |
| --------- | ----------------- |
| <600px    | Bottom navigation |
| 600-959px | Navigation rail   |
| >=960px   | Sidebar + content |
| >=1440px  | Reader 3 pane     |

Aturan: navigasi tidak pernah auto-hide; zoom browser 200% tetap reflow;
setiap gesture punya tombol alternatif; focus ring selalu terlihat;
dialog destruktif memakai label aksi (Hapus/Reset); error selalu punya
Coba lagi; bottom sheet -> dialog di desktop; touch target >=48px.

## Tokens

Token didefinisikan sebagai CSS custom properties di `apps/web/src/ui/tokens/`
dengan satu sumber kebenaran, dikonsumsi CSS Modules.
