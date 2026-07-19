# logs/

Folder ini disediakan untuk konsistensi struktur folder sesuai spesifikasi produk.

Pada **Versi 1 (Personal Mode)**, seluruh log aplikasi disimpan di `localStorage`
browser lewat `assets/js/utils/logger.util.js` (bisa dilihat lewat DevTools →
Application → Local Storage → key `ponti_sheets.logs`) — bukan di file fisik,
karena aplikasi ini tidak memiliki server/backend sendiri.

Folder ini disiapkan agar pada **Versi 2 (Cloud Sync)** ke atas, log dapat dialihkan
ke penyimpanan file/terpusat tanpa mengubah struktur project.
