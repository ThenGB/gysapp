# Real-device beta soak runbook

Dokumen ini memindahkan sisa gate PR #4 dari daftar abstrak menjadi prosedur yang dapat diulang. Automated CI tetap menjadi source of truth untuk compile/regression; hasil di bawah ini adalah bukti manual yang memang tidak dapat digantikan emulator/Playwright.

## Prinsip

- Uji artifact dari **SHA PR yang sama** dengan CI hijau.
- Verifikasi `SHA256SUMS.txt` sebelum menjalankan artifact hasil Actions.
- Android debug APK memakai package id production `id.sch.kanaan.egys`, tetapi ditandatangani debug key. **Jangan uninstall aplikasi production di perangkat yang berisi data penting hanya untuk memasang debug APK.** Gunakan perangkat uji/spare device atau profile yang aman.
- Upgrade smoke terhadap aplikasi lama hanya sah bila artifact production ditandatangani dengan legacy production keystore yang sama dan fingerprint sudah diverifikasi oleh workflow release.
- Jangan menandai gate sebagai lulus bila hanya diuji di browser desktop atau simulator.

## Artifact CI untuk soak

### Android

Workflow `native-android` menghasilkan:

- `GYSApp-android-debug-arm64.apk`
- `SHA256SUMS.txt`

Artifact disimpan 14 hari agar satu SHA dapat dipakai untuk rangkaian soak yang sama.

### Windows

Workflow `native-windows` menghasilkan portable binary dari release no-bundle build:

- `GYSApp-windows-x64-portable.exe`
- `SHA256SUMS.txt`

Artifact ini unsigned dan hanya ditujukan untuk internal beta/soak. Gunakan hanya artifact Actions dari repository ini dan cocokkan SHA-256 sebelum menjalankannya.

## A. Accessibility + light/dark/system soak

Lakukan minimal pada satu Android mid-range nyata dan satu Windows 10/11 machine. Bila iOS provisioning tersedia, ulangi journey yang sama pada iPhone/iPad nyata.

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

Gate lulus bila:

- tidak ada teks/action penting yang terpotong atau tidak dapat diakses;
- focus/reading order masuk akal;
- control utama tetap dapat disentuh/dioperasikan pada UI besar;
- theme system mengikuti perubahan OS setelah relaunch atau refresh state yang relevan;
- tidak ada low-contrast regression yang terlihat pada state enabled/disabled/focus/error;
- tidak ada modal/dock/player yang menutup navigation atau primary action.

## B. Scheduled notification soak

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
3. Bila pengujian delivery penuh belum dapat dilakukan pada hari tersebut, jangan menandai gate delivery sebagai lulus hanya dari unit test; catat sebagai pending real-time observation.

### Acceptance

- tidak ada duplicate notification;
- reschedule mengganti schedule lama;
- disable benar-benar cancel;
- timezone/local-time behavior konsisten setelah restart;
- permission denied menghasilkan recovery state, bukan silent failure.

## C. Long-song MIDI/PDF soak

Pilih lagu dengan PDF relatif panjang/berat dan MIDI berdurasi panjang dari catalog nyata.

1. Buka PDF, ganti fit page/width, zoom, 1/2 page, rotate beberapa kali.
2. Rapid-switch minimal 10 kali di antara beberapa lagu PDF lalu kembali ke lagu awal.
3. Putar MIDI minimal 15 menit pada perangkat nyata.
4. Selama playback: seek berkali-kali, ubah tempo, pause/resume, next/previous, loop/shuffle.
5. Pindah ke Alkitab/Settings/Lainnya dan kembali ke Pujian.
6. Background aplikasi beberapa menit lalu foreground kembali.
7. Ulangi satu siklus saat media sudah cached/offline.

### Acceptance

- tidak ada crash, freeze panjang, audio ganda, stale song, atau canvas salah lagu;
- seek/tempo state tetap masuk akal setelah route/background transition;
- memory pressure tidak membuat UI terus memburuk sepanjang sesi;
- cached/offline replay bekerja tanpa network untuk asset yang sudah tersimpan;
- player tidak overlap navigation/content pada orientation/layout yang diuji.

## D. Field Web Vitals setelah beta stabil

Automated production-preview guard tetap menangkap regression lab LCP/CLS. Field gate baru dinilai setelah beta memiliki traffic nyata.

Target release:

- LCP p75 < 2.5 s
- INP p75 < 200 ms
- CLS p75 < 0.1

Catat source data, periode observasi, sample size, device/network mix, dan route dengan outlier. Jangan menyamakan satu Lighthouse run dengan field p75.

## E. Android signed upgrade smoke

Gate ini **blocked** sampai legacy production keystore dan `ANDROID_CERT_SHA256` yang benar tersedia.

Setelah tersedia:

1. Jalankan signed Android workflow dan pastikan fingerprint validation lulus.
2. Ambil device yang memiliki versi production lama dengan data yang boleh diuji.
3. Backup data yang diperlukan.
4. Install artifact baru sebagai upgrade tanpa uninstall versi lama.
5. Pastikan application data penting tetap tersedia dan aplikasi dapat dibuka normal.
6. Verifikasi package `id.sch.kanaan.egys` dan versionCode 134.

Jika install hanya berhasil setelah uninstall, upgrade continuity **gagal** dan release tidak boleh dianggap kompatibel dengan aplikasi lama.

## F. iOS signed distribution smoke

Tetap blocked sampai Apple signing/provisioning tersedia. Simulator compile CI bukan pengganti signed-device/App Store/TestFlight smoke.

## Evidence template

Untuk setiap sesi, catat:

- commit SHA;
- platform + OS version;
- device model;
- artifact SHA-256;
- theme/font/display configuration;
- journey yang diuji;
- pass/fail;
- screenshot/video/log untuk failure;
- issue/commit perbaikan bila ada.

PR #4 dapat tetap Draft sampai gate manual/release prerequisite yang relevan memiliki evidence atau dinyatakan blocked oleh credential/provisioning eksternal.
