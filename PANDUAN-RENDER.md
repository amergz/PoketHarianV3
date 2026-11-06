# Deployment Render Free — Poket Harian

## Konfigurasi sebenar
Satu Node24 Web Service melayan aset frontend allowlist dan backend pada origin sama. Tiada dependency npm luaran; gunakan fetch, crypto, http dan process.loadEnvFile Node terbina dalam. package.json menetapkan Node>=24<25. PORT daripada Render, fallback8787; bind0.0.0.0. Frontend fetch /api relatif.
Build command: `node --check backend/server.mjs`
Start command: `npm start`
Health check: `/health` (hanya status ok, tiada key/DeepSeek).
Blueprint: render.yaml, plan free, auto deploy off. Tiada install dependency diperlukan.

## Dashboard Render (belum dilakukan)
1. Semak repository bersih daripada rahsia/data, kemudian push sendiri apabila bersedia. Tiada push dibuat oleh agen.
2. Render ? New ? Web Service ? pilih repository; runtime Node, plan Free, root direktori projek, build/start di atas. Atau gunakan Blueprint render.yaml.
3. Environment wajib: NODE_ENV=production; NODE_VERSION=24.11.0; APP_ORIGIN=https://nama-servis.onrender.com (tanpa slash hujung); OWNER_PASSWORD kata laluan unik sekurang-kurangnya16 aksara, maksimum256; DEEPSEEK_API_KEY masukkan melalui dashboard sahaja; DEEPSEEK_BASE_URL=https://api.deepseek.com; DEEPSEEK_MODEL=deepseek-flash; DEEPSEEK_MAX_ATTEMPTS=1. Jangan tetapkan POKET_KEY_SOURCE=backend/.env di hosting. PORT disediakan Render.
4. backend/.env tidak dibaca dalam production. Jangan upload fail itu. .env.example hanya contoh tanpa rahsia.
5. Selepas pengguna deploy: semak /health, buka origin, log masuk satu pemilik. Tiada pendaftaran. Jangan uji DeepSeek sehingga bersedia menggunakan kredit.

## Akses dan sesi
Aset aplikasi dan /api dilindungi backend dalam production. /health, borang login dan allowlist aset PWA (manifest, ikon, service-worker.js, pwa-login.js) awam untuk pemasangan sebelum login. Password disemak scrypt+timingSafeEqual di backend. Cookie sesi rawak HttpOnly, SameSiteStrict, Secure production, tamat12jam. Sesi dalam memori; restart/sleep Render memerlukan login semula. Had login5percubaan/15min global (satu pemilik), AI20mesej/hari proses. Rate/sesi reset apabila proses restart; bukan kawalan kuota tahan restart. API probe production dinyahaktifkan. Origin/Host ikut APP_ORIGIN dan POST memerlukan origin sama. Konfigurasi akses hilang ?503 fail closed, bukan API awam.
Log keluar melalui butang dalam Profil. Logout tidak memadam data kewangan pelayar. Cookie Secure diuji atas HTTP simulasi dengan cookie header manual; TLS Render sebenar belum diuji.

## PWA dan data
Service worker baharu tiada fetch interception/cache aset supaya cache tidak memintas auth; menghapus cache poket-harian-cache-* sahaja. Tiada localStorage/IndexedDB dipadam. Offline app lama tidak lagi disediakan oleh worker baharu; halaman yang sudah terbuka tidak boleh ditarik balik secara remote, API tetap disekat sesi. Tutup tab lama sebelum guna versi baru.
Transaksi kekal localStorage per origin/per profil. URL Render baharu tidak mempunyai data localhost secara automatik. Eksport backup secara lokal dan import sendiri di origin Render jika dikehendaki; agen tidak memindahkan data. Jangan simpan data pengguna pada filesystem Render; tiada DB/sync. Free service boleh tidur/cold start; log/sesi memori tidak kekal. Lakukan backup kewangan berkala.
Resit dinyahaktifkan: tiada butang/script lampiran, aset resit404, payload image ditolak server. Teks/rekod/Undo/analisis/bajet/ramalan dikekalkan.

## Git dan laluan berisiko
.gitignore mengecualikan .env/.env.*, backups/, test-results/, *.log, logs/, secrets/, *backup*.json, qa-private/, tests/live-*.cjs. .env.example dibenarkan. Jangan tambah fail dengan git add -f.
Laluan berisiko: backend/.env; backups/; test-results/ (diagnostik/fixture/panggilan live); fail eksport backup JSON; secrets/; logs/. Kandungan tidak dipaparkan. Git CLI tidak ditemui pada PATH/lokasi lazim dan .git tidak tersedia dalam semakan ini; tracked files dan sejarah rahsia BELUM dapat disahkan. Sebelum push jalankan git ls-files dan git status sendiri; ignore tidak membuang fail yang sudah tracked atau sejarah Git. Jangan commit backup/diagnostik walaupun tanpa key.

## Ujian sebenar dijalankan
51/51 ujian Node mock/regresi lulus. Production child server tanpa membaca backend/.env: health200, rootredirect login, AI401 tanpa login, login303 dan cookieHttpOnly/Secure/SameSite, aset200 selepas login, receipt asset404, logout membatalkan sesi. Service worker tiada fetch handler dan hanya cache sendiri dipadam. Mock adapter chat dan frontend integrasi/regresi kewangan lulus tanpa kredit. Tiada API berbayar/push/deploy. Production host tidak dihubungi; Render dashboard/HTTPS/coldstart dan visual pelayar belum disahkan. Tiada restart server lokal sedia ada dibuat; restart diperlukan untuk menggunakan kod backend baharu lokal.
Backup bertarikh -render sebelum perubahan. Fail utama: backend/owner-auth.mjs, server/config, package.json, render.yaml, index, service-worker, .env.example, ujian render-auth/phase1.


## Penyelarasan 6 November 2026
Pilihan Ingat peranti ini selama 30 hari kosong secara lalai. Sesi biasa kekal 12 jam dalam memori. Sesi peranti menggunakan cookie HttpOnly, SameSite=Strict, Secure production, tandatangan HMAC dan storan Redis REST dengan TTL tetap 30 hari. Logout Profil membatalkan token peranti itu tanpa memadam data kewangan. Kegagalan storan menolak akses sesi kekal.

Environment baharu: SESSION_SECRET (rahsia rawak sekurang-kurangnya 32 aksara), SESSION_STORE_URL (endpoint HTTPS Redis REST), SESSION_STORE_TOKEN (token akses storan). Blueprint menjana SESSION_SECRET; isikan dua nilai storan sendiri. Servis sedia ada melalui dashboard perlu menetapkan ketiga-tiganya sendiri. Tanpa konfigurasi ini, login biasa berfungsi tetapi pilihan 30 hari mendapat 503. Tiada nilai rahsia dimasukkan dalam repository.

Pengesahan terkini: node --test tests/*.test.cjs, 58/58 lulus menggunakan data rekaan dan mock provider/storan sahaja. Startup HTTP, aset tempatan, auth production simulasi, restart sesi, Shopping, Undo, bajet dan service worker diuji. Ujian ini menggantikan angka ujian sejarah di atas. Tiada API berbayar, push atau deploy.

CDN Tailwind, Google Fonts, Font Awesome dan Chart.js masih dirujuk. Kebolehcapaian CDN, rupa telefon, pemasangan PWA sebenar, HTTPS/cold start Render dan Redis sebenar belum diuji. Service worker tiada fetch interception/cache offline supaya auth tidak dipintas.
