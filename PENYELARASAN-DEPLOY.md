# Penyelarasan Poket Harian ke deploy

Lokasi perubahan: D:/Poket-Harian-Deploy sahaja. D:/Poket Harian dibaca sahaja. Perbandingan menggunakan kandungan bait, bukan tarikh. Tiada perubahan runtime unik deploy ditemui dalam fail yang berbeza; perubahan sumber digabung secara fail terpilih. Fail runtime lain sama, termasuk server, config, index, phase1-app, core, finance-analysis, PWA dan ikon.

## Fail berubah berbanding deploy asal / muat naik ke GitHub
- `PANDUAN-RENDER.md`
- `backend/deepseek.mjs`
- `backend/owner-auth.mjs`
- `css/phase1.css`
- `js/chat-auto.js`
- `js/chat-contract.js`
- `render.yaml`
- `tests/purchase-chat.test.cjs`

## Fail baharu / muat naik ke GitHub
- `backend/remember-device.mjs`
- `tests/analysis-integration.test.cjs`
- `tests/analysis-table.test.cjs`
- `tests/auto-chat.test.cjs`
- `tests/backend.test.cjs`
- `tests/budget-clarify.test.cjs`
- `tests/budget-copy.test.cjs`
- `tests/category-pwa.test.cjs`
- `tests/chat-home.test.cjs`
- `tests/chat-ui.test.cjs`
- `tests/compact-table.test.cjs`
- `tests/diagnostics.test.cjs`
- `tests/forecast-chat.test.cjs`
- `tests/missing-budget.test.cjs`
- `tests/multi-period.test.cjs`
- `tests/phase1.test.cjs`
- `tests/phase2.test.cjs`
- `tests/post-save.test.cjs`
- `tests/remember-device.test.cjs`
- `tests/render-auth.test.cjs`
- `tests/routing.test.cjs`
- `tests/schema-session.test.cjs`
- `PENYELARASAN-DEPLOY.md` (laporan ini)

## Skop dan keputusan
Login 30 hari memerlukan SESSION_SECRET, SESSION_STORE_URL dan SESSION_STORE_TOKEN. Render Blueprint menyediakan generateValue untuk secret; servis sedia ada perlu konfigurasi dashboard sendiri. Storan Redis REST luaran diperlukan; tiada provisioning/panggilan storan sebenar dibuat. Login biasa tidak memerlukan konfigurasi baharu. Logout Profil membatalkan token peranti dan API AI terus dilindungi.

Aliran 7e rm14 -> Shopping mengekalkan RM14, satu simpanan, kategori aktif penuh termasuk kedudukan ketujuh, typo ketegori/dlm, berbilang item, retry, Undo dan jadual bajet. CSS font/margin, lima kolum dan jarak Chat/+ diselaraskan. Resit kekal dinyahaktifkan pada UI, allowlist dan backend; modul resit sumber tidak dibawa. Aset PWA awam sebelum login; aset aplikasi dilindungi. Service worker tidak memintas rangkaian dan hanya membuang cache aplikasi lama.

58/58 ujian automatik lulus melalui node --test tests/*.test.cjs dalam folder deploy. Startup HTTP sebenar setempat, modul HTML melalui HTTP, semua aset runtime tempatan selepas login, aset PWA sebelum login, auth/logout, restart dan TTL sesi menggunakan storan rekaan, AI tanpa sesi ditolak, Shopping/typo/multi-item/Undo/bajet dan regresi kewangan diuji. Ujian phase1 disesuaikan supaya tiada pergantungan backup: perbandingan fungsi dengan fail backup sejarah dibuang, assertion kewangan fixture dikekalkan.

Ini bukan semakan visual telefon sebenar. Pemasangan PWA pada Android/iOS, susun atur fizikal/keyboard, CDN luaran, HTTPS/cold start Render dan Redis sebenar belum disahkan. Tiada API berbayar, push atau deploy dibuat. Tiada .env, backup, log, rekod kewangan atau data pengguna disalin. Ujian live dan utiliti sync sumber tidak dibawa. Fail dokumentasi sejarah sumber tidak disalin untuk mengelakkan tuntutan QA lama dianggap keputusan terkini.
