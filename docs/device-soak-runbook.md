# Real-device beta soak runbook

Dokumen ini memindahkan sisa gate PR #4 dari daftar abstrak menjadi prosedur yang dapat diulang. Automated CI tetap menjadi source of truth untuk compile/regression; hasil di bawah ini adalah bukti real-device yang memang tidak dapat digantikan emulator/Playwright.

Identity aplikasi baru mengikuti ADR-0007: Android/iOS menggunakan `com.gysid.gysapp`. GYSApp baru **bukan** upgrade package `id.sch.kanaan.egys`.

## Prinsip

- Uji artifact dari **SHA PR yang sama** dengan CI hijau.
- Verifikasi `SOURCE_SHA.txt` dan `SHA256SUMS.txt` sebelum menjalankan artifact Actions.
- Android debug APK memakai package `com.gysid.gysapp` dan debug signing; ia dapat hidup berdampingan dengan package legacy.
- Jangan menandai gate lulus bila hanya diuji di browser desktop atau simulator.
- Dedicated real-device automation dijelaskan di `docs/android-device-lab.md`.

## Perimeter device utama

Redmi Note 10 Pro dengan Snapdragon 732G dipakai sebagai baseline low-to-mid-range yang sengaja cukup tua untuk menangkap regression performa yang mungkin tidak terlihat di flagship baru.

Baseline pertama minimal tiga run yang sebanding sebelum menetapkan budget hard untuk startup/memory/thermal.

## Artifact CI untuk soak

### Android

Workflow `native-android` menghasilkan:

- `GYSApp-android-debug-arm64.apk`
- `SHA256SUMS.txt`
- `SOURCE_SHA.txt`

Artifact disimpan 14 hari agar satu SHA dapat dipakai untuk rangkaian soak yang sama.

### Windows

Workflow `native-windows` menghasilkan portable binary release no-bundle:

- `GYSApp-windows-x64-portable.exe`
- `SHA256SUMS.txt`
- `SOURCE_SHA.txt`

Artifact ini unsigned dan hanya untuk internal beta/soak.

## A. Automated real-device baseline

Setelah self-hosted runner `android-device-lab` tersedia, jalankan workflow manual `android-device-lab`.

Harness akan:

1. build ARM64 debug APK dari SHA yang dipilih;
2. install/reinstall `com.gysid.gysapp` pada device lab;
3. melakukan force-stop + cold-launch berulang;
4. sampling memory/CPU/thermal/battery;
5. mengambil `gfxinfo`, package/activity dump, dan logcat;
6. menandai package-scoped FATAL EXCEPTION / ANR;
7. meng-upload evidence artifact 14 hari.

`reset_app_data` default **false** dan hanya boleh diaktifkan secara sengaja pada dedicated test device.

## B. Accessibility + light/dark/system soak

Lakukan minimal pada Redmi Note 10 Pro nyata dan satu Windows 10/11 machine. Bila iOS provisioning tersedia, ulangi journey yang sama pada iPhone/iPad nyata.

### Matrix minimum

1. Theme: Light, Dark, System-light, System-dark.
2. Android font size: default dan satu tingkat besar.
3. Android display size: default dan satu tingkat besar.
4. Portrait dan landscape untuk reader/viewer yang mendukung orientasi.
5. Keyboard-only pada Windows untuk primary navigation.
6. Screen reader smoke: TalkBack Android atau Narrator Windows untuk navigation label dan primary actions.

### Journey yang harus diuji

- Home -> resume ayat terakhir.
- Alkitab: buka kitab/pasal, cari ayat, contextual refs/paralel, bookmark, notes, TTS.
- Alkitab 2 panel pada layout/orientasi yang mendukung.
- Pujian: daftar -> Partitur -> Teks & Chord -> 1/2 halaman -> fit/zoom -> transpose/sharp-flat.
- MIDI dock: play/pause/seek/tempo/previous/next dan pindah route saat audio tetap berjalan.
- Settings: language ID/EN/ZH, theme, cache, backup, reminder.
- Literatur/Panduan/Lainnya dan external opener.

### Acceptance

- tidak ada teks/action penting yang terpotong atau tidak dapat diakses;
- focus/reading order masuk akal;
- control utama tetap dapat disentuh/dioperasikan pada UI besar;
- theme system mengikuti perubahan OS tanpa stale state;
- tidak ada low-contrast regression yang terlihat;
- tidak ada modal/dock/player yang menutup navigation atau primary action.

## C. Scheduled notification soak

Prioritaskan Android nyata karena browser/PWA memang tidak menjadwalkan recurring OS reminder.

### Bible reminder

1. Aktifkan reminder baca Alkitab untuk waktu dekat pada hari pengujian.
2. Izinkan notification permission saat diminta.
3. Background-kan aplikasi lalu lock device.
4. Pastikan notifikasi muncul pada waktu target dengan toleransi OS yang wajar.
5. Ubah hari/waktu, lalu pastikan schedule lama tidak ikut firing.
6. Nonaktifkan reminder, lalu pastikan schedule berikutnya dibatalkan.
7. Restart device dan pastikan setting persisted serta tidak membuat duplicate schedule.

### Sabbath reminder

1. Verifikasi setting Sabat tersimpan sebagai Jumat 17:00 lokal.
2. Lakukan delivery test pada Jumat bila memungkinkan.
3. Bila pengujian delivery penuh belum dapat dilakukan pada hari tersebut, catat sebagai pending real-time observation.

### Acceptance

- tidak ada duplicate notification;
- reschedule mengganti schedule lama;
- disable benar-benar cancel;
- timezone/local-time behavior konsisten setelah restart;
- permission denied menghasilkan recovery state, bukan silent failure.

## D. Long-song MIDI/PDF soak

Pilih lagu dengan PDF relatif panjang/berat dan MIDI berdurasi panjang dari catalog nyata.

1. Buka PDF, ganti fit page/width, zoom, 1/2 page, rotate beberapa kali.
2. Rapid-switch minimal 10 kali di antara beberapa lagu PDF lalu kembali ke lagu awal.
3. Putar MIDI minimal 15 menit pada perangkat nyata.
4. Selama playback: seek berkali-kali, ubah tempo, pause/resume, next/previous, loop/shuffle.
5. Pindah ke Alkitab/Settings/Lainnya dan kembali ke Pujian.
6. Background aplikasi beberapa menit lalu foreground kembali.
7. Ulangi satu siklus saat media sudah cached/offline.

### Acceptance

- tidak ada crash, ANR, freeze panjang, audio ganda, stale song, atau canvas salah lagu;
- seek/tempo state tetap masuk akal setelah route/background transition;
- memory pressure tidak terus memburuk sepanjang sesi;
- cached/offline replay bekerja tanpa network untuk asset yang sudah tersimpan;
- player tidak overlap navigation/content pada orientation/layout yang diuji.

## E. Field Web Vitals setelah beta stabil

Automated production-preview guard tetap menangkap regression lab LCP/CLS. Field gate baru dinilai setelah beta memiliki traffic nyata dan analytics memang sengaja diaktifkan.

Target release:

- LCP p75 < 2.5 s
- INP p75 < 200 ms
- CLS p75 < 0.1

Catat source data, periode observasi, sample size, device/network mix, dan route dengan outlier.

## F. Android new-app signing smoke

Tidak ada lagi requirement legacy install-over-production. Sebelum publikasi pertama `com.gysid.gysapp`:

1. siapkan dedicated GYSApp release/upload keystore di GitHub Secrets;
2. set `ANDROID_CERT_SHA256` ke fingerprint certificate key baru tersebut;
3. jalankan signed Android workflow;
4. pastikan workflow memverifikasi fingerprint input dan final APK/AAB;
5. install signed APK pada clean/dedicated device dan pastikan seluruh journey utama normal;
6. first Play Console upload dilakukan sebagai aplikasi baru.

Jika migrasi data user legacy diperlukan, validasi backup/export-import `.gysapp` secara eksplisit. Package baru tidak mewarisi private app data package lama secara otomatis.

## G. iOS signed distribution smoke

Tetap blocked sampai Apple signing/provisioning tersedia. Simulator compile CI bukan pengganti signed-device/App Store/TestFlight smoke. Bundle identifier target adalah `com.gysid.gysapp`.

## Evidence template

Untuk setiap sesi, catat:

- commit SHA;
- platform + OS version;
- device model;
- artifact SHA-256;
- package/bundle identifier;
- theme/font/display configuration;
- journey yang diuji;
- pass/fail;
- screenshot/video/log untuk failure;
- issue/commit perbaikan bila ada.

PR #4 dapat tetap Draft sampai gate manual/release prerequisite yang relevan memiliki evidence atau dinyatakan blocked oleh credential/provisioning eksternal.
