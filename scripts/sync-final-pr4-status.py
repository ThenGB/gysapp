from pathlib import Path


def rep(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"missing {label}: {old[:100]!r}")
    return text.replace(old, new, 1)

roadmap = Path("docs/implementation-roadmap.md")
text = roadmap.read_text()
text = rep(
    text,
    "- encrypted backup, settings/i18n, 10 Pokok Iman + multi-select/copy/share, literature/content surfaces;",
    "- encrypted backup, settings/i18n ID/EN/ZH untuk journey utama, 10 Pokok Iman + multi-select/copy/share, literature/content surfaces;",
    "roadmap i18n",
)
text = rep(
    text,
    "- optional Cloudflare near-live content/report gateway;",
    "- optional Cloudflare near-live content/report gateway; Kirim Masukan mendeteksi gateway yang tidak dikonfigurasi dan tidak mencoba `/api/report` yang rusak;",
    "roadmap report",
)
text = rep(
    text,
    "- iOS Xcode simulator compile gate pada macOS;\n- CI Playwright menjalankan artefak production `dist` melalui `vite preview`, dengan lab guard Home LCP <=2.5s dan CLS <=0.1.",
    "- iOS Xcode simulator compile gate pada macOS;\n- semua external URL feature melewati `openExternalUrl()`; browser memakai `noopener,noreferrer`, Tauri memakai system opener;\n- pengingat Sabat Jumat 17:00 + pengingat baca Alkitab per-hari/waktu memakai scheduled native notification, persisted di Settings v2 dan ikut encrypted backup;\n- CI Playwright menjalankan artefak production `dist` melalui `vite preview`, dengan lab guard Home LCP <=2.5s dan CLS <=0.1.",
    "roadmap native",
)
text = rep(
    text,
    "### Literature / Faith / More\n\n- i18n ID/EN/ZH sudah mencakup Home, Faith, Literatur/Panduan, Lainnya, Settings/backup/cache, e-GYS, Kirim Masukan, Catatan, dan daftar Pujian; lanjutkan hanya generic chrome yang masih hard-coded;\n- audit external links dengan platform opener yang sama.",
    "### Literature / Faith / More\n\n- i18n ID/EN/ZH sudah mencakup journey utama termasuk Home, Bible chrome/context/search, Faith, Literatur/Panduan, Lainnya, Settings/backup/cache/reminder, e-GYS, Kirim Masukan, Catatan, serta daftar/playlist/viewer Pujian;\n- external links Home/Literatur/Lainnya/e-GYS memakai satu platform opener adapter;\n- Kirim Masukan adalah capability gateway opsional: deployment backendless menampilkan unavailable state yang eksplisit; deployment gateway menangani success serta 429/502/503 dengan recovery copy.",
    "roadmap more",
)
text = rep(
    text,
    "- Worker tetap opsional untuk near-live content dan `/api/report` bila webhook perlu dirahasiakan.",
    "- Worker tetap opsional untuk near-live content dan `/api/report` bila webhook perlu dirahasiakan; tanpa gateway, UI Kirim Masukan dinonaktifkan secara eksplisit alih-alih jatuh ke `/api` lokal/404.",
    "roadmap gateway",
)
text = rep(
    text,
    "- real-device light/dark/system contrast/accessibility soak;\n- real-device long-song MIDI/PDF performance soak;\n- field/RUM Web Vitals (terutama INP dan p75) setelah deployment beta stabil;",
    "- real-device light/dark/system contrast/accessibility soak;\n- real-device delivery/timing pengingat Sabat dan baca Alkitab pada OS target;\n- real-device long-song MIDI/PDF performance soak;\n- field/RUM Web Vitals (terutama INP dan p75) setelah deployment beta stabil;",
    "roadmap manual",
)
text = rep(
    text,
    "1. Lanjutkan i18n hanya pada generic chrome Alkitab/Pujian yang masih hard-coded.\n2. Jalankan real-device light/dark/system accessibility dan MIDI/PDF long-song soak.\n3. Kumpulkan field/RUM Web Vitals setelah deployment beta stabil; production-preview lab regression sudah otomatis.\n4. Jalankan Android production signed upgrade smoke setelah legacy keystore + fingerprint tersedia.\n5. Tambahkan signed iOS distribution setelah provisioning/signing Apple tersedia.",
    "1. Jalankan real-device light/dark/system accessibility, scheduled-notification delivery, dan MIDI/PDF long-song soak.\n2. Kumpulkan field/RUM Web Vitals setelah deployment beta stabil; production-preview lab regression sudah otomatis.\n3. Jalankan Android production signed upgrade smoke setelah legacy keystore + fingerprint tersedia.\n4. Tambahkan signed iOS distribution setelah provisioning/signing Apple tersedia.",
    "roadmap order",
)
roadmap.write_text(text)

parity = Path("docs/parity-matrix.md")
text = parity.read_text()
text = rep(
    text,
    "| i18n id/en/zh foundation                | done   | Journey utama + Settings/e-GYS/Notes/Hymnal list sudah localized |",
    "| i18n id/en/zh foundation                | done   | Journey utama termasuk Bible/Hymnal/Settings/e-GYS/Notes localized |",
    "parity i18n",
)
text = rep(
    text,
    "| Podcast / social media            | done   | Facebook / Instagram / YouTube / Spotify                    |",
    "| Podcast / social media            | done   | Facebook / Instagram / YouTube / Spotify                    |\n| Unified external platform opener | done   | Browser noopener/noreferrer; Tauri system opener; tidak ada direct window.open di feature code |",
    "parity opener",
)
text = rep(
    text,
    "| Kirim masukan via gateway     | in-progress | Hanya bila webhook perlu disembunyikan                               |",
    "| Kirim masukan via gateway     | done        | Gateway opsional; backendless state eksplisit, 429/502/503 punya recovery copy |",
    "parity report",
)
text = rep(
    text,
    "| Sabat/reminder native    | todo        |                                                                                    |",
    "| Sabat/reminder native    | done        | Sabat Jumat 17:00 + baca Alkitab per hari/waktu; Settings v2/backup; browser graceful native-only |",
    "parity reminder",
)
text = rep(
    text,
    "| Unit/component tests                | done        | Bible context, notes, media cache, MIDI lifecycle, race guards            |",
    "| Unit/component tests                | done        | Bible context, notes, media cache, MIDI lifecycle, race guards, reminders, feedback capability |",
    "parity tests",
)
text = rep(
    text,
    "3. Cloudflare account/token hanya jika optional near-live content/report gateway dipakai production.\n4. Report webhook secret hanya bila Kirim Masukan memakai webhook server-side.",
    "3. Cloudflare account/token hanya jika optional near-live content/report gateway dipakai production.\n4. Report webhook secret hanya bila Kirim Masukan diaktifkan untuk delivery server-side; tanpa itu deployment backendless tetap valid.",
    "parity blockers",
)
parity.write_text(text)
