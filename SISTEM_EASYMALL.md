# 📘 DOKUMENTASI LENGKAP SISTEM EASYMALL
> File ini adalah sumber kebenaran tunggal (Single Source of Truth) untuk seluruh sistem EasyMall.
> Selalu update file ini setiap ada perubahan besar.
> Terakhir diperbarui: 2026-07-04

---

## 🗂️ STRUKTUR FOLDER UTAMA

```
/root/ecommerce/                        ← ROOT PROJECT
├── .env                                ← Semua kredensial & konfigurasi rahasia
├── .gitignore                          ← Mengabaikan .env, dist/, target/
├── api.ilhampradani.me.conf            ← Konfigurasi Apache (Reverse Proxy → port 5002)
├── SISTEM_EASYMALL.md                  ← 📌 File ini (dokumentasi master)
├── frontend/                           ← Kode sumber tampilan website (Astro)
└── dinamis/                            ← Kode backend server (Rust)
    ├── ecom_api/                       ← ⭐ Backend utama (Rust/Axum)
    │   ├── src/main.rs                 ← SATU-SATUNYA file kode backend (2100+ baris)
    │   ├── Cargo.toml                  ← Dependensi Rust
    │   └── target/release/ecom_api    ← Binary yang dijalankan oleh PM2
    ├── dashboard/
    │   └── ecommerce.db               ← ⭐ Database SQLite utama (semua data)
    ├── api_docs/                       ← Dokumen API eksternal (BuatQRIS, dll)
    ├── mesin_include.py                ← Script Python pembantu (terpisah)
    └── update_info_product.py          ← Script update produk (terpisah)
```

---

## 🖥️ CARA MENJALANKAN & MENGELOLA SERVER

### Server API Backend (Rust)
Server dikelola oleh **PM2** dengan nama proses **`easymall-api`**.

```bash
# Cek status server
pm2 list

# Restart server (misal setelah update kode)
pm2 restart easymall-api

# Lihat log live
pm2 logs easymall-api

# Lihat 20 baris log terakhir
pm2 logs easymall-api --lines 20 --nostream

# Stop server
pm2 stop easymall-api
```

> ⚠️ **JANGAN gunakan `kill` manual!** PM2 akan langsung menghidupkan kembali prosesnya dan menyebabkan bentrokan port.

### Alur Deploy Perubahan Backend (Rust)
Setiap kali mengubah `src/main.rs`:
```bash
# 1. Compile ulang binary
cd /root/ecommerce/dinamis/ecom_api
cargo build --release

# 2. Restart via PM2 (gunakan binary baru secara otomatis)
pm2 restart easymall-api
```

### Alur Deploy Perubahan Frontend (Astro)
Setiap kali mengubah file di `frontend/src/`:
```bash
# 1. Build ulang halaman statis
cd /root/ecommerce/frontend
npm run build

# 2. Tidak perlu restart PM2 — backend langsung serve dari frontend/dist/
```

---

## 🌐 INFRASTRUKTUR & DOMAIN

| Domain | Arah | Keterangan |
|--------|------|------------|
| `easymall.ilhampradani.me` | → Vercel | Frontend statis (build dari `frontend/dist/`) |
| `api.ilhampradani.me` | → Apache → port 5002 | Backend Rust via Reverse Proxy |

### Konfigurasi Reverse Proxy Apache
File: `/root/ecommerce/api.ilhampradani.me.conf`
- Meneruskan semua traffic `api.ilhampradani.me` ke `http://127.0.0.1:5002`
- Backend berjalan di port `5002` (hanya bisa diakses dari lokal server)

---

## 🔧 BACKEND: `dinamis/ecom_api/src/main.rs`

### Semua API Endpoint

#### Auth & Session
| Method | Endpoint | Fungsi |
|--------|----------|--------|
| `GET` | `/api/auth/status` | Cek status login user saat ini |
| `POST` | `/login` | Login admin (username/password) |
| `POST` | `/login/google` | Login via Google OAuth |
| `GET` | `/login/discord` | Redirect ke Discord OAuth |
| `GET` | `/login/discord/callback` | Callback dari Discord OAuth |
| `GET` | `/logout` | Hapus sesi & cookie |

#### Produk
| Method | Endpoint | Fungsi |
|--------|----------|--------|
| `GET` | `/api/products` | Ambil semua produk (dari KoalaStore + MiracleGaming, sudah di-markup) |

#### Keranjang (Cart)
| Method | Endpoint | Fungsi |
|--------|----------|--------|
| `GET` | `/api/cart` | Ambil isi keranjang user |
| `POST` | `/api/cart` | Tambah item ke keranjang |
| `DELETE` | `/api/cart` | Kosongkan semua keranjang |
| `DELETE` | `/api/cart/:id` | Hapus satu item keranjang |

#### Checkout & Pembayaran
| Method | Endpoint | Fungsi |
|--------|----------|--------|
| `POST` | `/api/checkout` | Proses checkout, generate QRIS (via BuatQRIS) |
| `GET` | `/api/order/status/:transaction_id` | Cek status pembayaran transaksi |

#### Dashboard (Admin/Reseller)
| Method | Endpoint | Fungsi |
|--------|----------|--------|
| `GET` | `/api/dashboard/data` | Ambil statistik & transaksi dashboard |

#### API Key Partner/Reseller (BARU)
| Method | Endpoint | Fungsi |
|--------|----------|--------|
| `GET` | `/api/reseller/api-keys` | Lihat semua API Key milik reseller yang login |
| `POST` | `/api/reseller/api-keys/generate` | Buat API Key baru (body: `{label, duration_days}`) |
| `POST` | `/api/reseller/api-keys/toggle` | Aktifkan/nonaktifkan API Key (body: `{id, is_active}`) |
| `DELETE` | `/api/reseller/api-keys/:id` | Hapus API Key permanen |

### Halaman HTML (dilayani backend langsung)
Backend Rust juga melayani file HTML dari `frontend/dist/`:
`/`, `/login.html`, `/dashboard`, `/about`, `/service`, `/term`, `/condition`, `/security`, `/legalitas`, `/dokumentasi`, `/product/:code`, `/product`, dll.

---

## 🗄️ DATABASE SQLite

**Path:** `/root/ecommerce/dinamis/dashboard/ecommerce.db`

### Daftar Tabel

| Tabel | Isi |
|-------|-----|
| `admins` | Akun admin login (username, password plaintext — ⚠️ perlu di-hash) |
| `users` | Akun user (email, nama, avatar, provider OAuth) |
| `resellers` | Data reseller aktif (kode aktivasi, WhatsApp, nama toko, markup) |
| `reseller_api_keys` | API Key partner reseller (hash SHA-256, label, expired_at, is_active) |
| `sessions` | Sesi login aktif (session_id, email, nama, created_at) |
| `keranjang` | Keranjang belanja user (email, product_code, qty, dll) |
| `sslstore_orders` | Order dari The SSL Store (dibuat saat checkout) |
| `miraclegaming_orders` | Order dari Miracle Gaming (dibuat saat checkout) |

### Struktur Tabel `reseller_api_keys` (Baru)
```sql
CREATE TABLE reseller_api_keys (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    reseller_email  TEXT NOT NULL,          -- email reseller pemilik key
    api_key_hash    TEXT UNIQUE NOT NULL,   -- SHA-256 hash dari raw key
    key_preview     TEXT NOT NULL,          -- cuplikan: em_live_xxxxxxxx...****
    label           TEXT NOT NULL,          -- nama/label key (misal: "Web Whitelabel")
    is_active       INTEGER DEFAULT 1,      -- 1=aktif, 0=nonaktif
    expires_at      TIMESTAMP NOT NULL,     -- tanggal kedaluwarsa
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

> 🔒 **Keamanan:** Raw API Key TIDAK pernah disimpan di database. Hanya hash SHA-256-nya. Raw key hanya ditampilkan SEKALI saat generate.

---

## 🔑 KONFIGURASI ENVIRONMENT (`.env`)

File: `/root/ecommerce/.env`

| Variable | Keterangan |
|----------|------------|
| `KOALASTORE_API_KEY` | API Key produk digital dari KoalaStore |
| `KOALASTORE_WEBHOOK_SECRET` | Secret verifikasi webhook KoalaStore |
| `MIRACLE_GAMING_API_KEY` | API Key produk game dari Miracle Gaming |
| `PRICE_MARKUP_NOMINAL` | Markup harga nominal (Rp) untuk semua produk |
| `PRICE_MARKUP_PERCENT` | Markup harga persentase (%) — saat ini: `25%` |
| `BUATQRIS_ACCOUNT_ID` | ID akun BuatQRIS untuk generate QRIS pembayaran |
| `BUATQRIS_SECRET_TOKEN` | Secret token BuatQRIS |
| `BUATQRIS_BASE_URL` | `https://app.buatqris.site/api.php` |
| `PORTALPULSA_USERID` | User ID Portal Pulsa (`P251797`) |
| `PORTALPULSA_KEY` | API Key Portal Pulsa |
| `PORTALPULSA_SECRET` | Secret Portal Pulsa |
| `PORTALPULSA_BASE_URL` | `https://portalpulsa.com/api/connect/` |
| `DIGIFLAZZ_USERNAME` | Username Digiflazz (belum aktif) |
| `DIGIFLAZZ_API_KEY` | API Key Digiflazz (belum aktif) |
| `THESSLSTORE_PARTNER_CODE` | Kode partner The SSL Store (`83304555`) |
| `THESSLSTORE_AUTH_TOKEN` | Token autentikasi The SSL Store |
| `THESSLSTORE_EMAIL` | Email akun SSL Store |
| `THESSLSTORE_MODE` | `LIVE` |
| `GOOGLE_CLIENT_ID` | Client ID Google OAuth |
| `GOOGLE_CLIENT_SECRET` | Client Secret Google OAuth |
| `DISCORD_CLIENT_ID` | Client ID Discord OAuth |
| `DISCORD_CLIENT_SECRET` | Client Secret Discord OAuth |
| `ADMINER_*` | Konfigurasi akses Adminer (tools admin database) |

---

## 🎨 FRONTEND: `frontend/`

**Framework:** Astro (SSG — output file statis)
**Build output:** `frontend/dist/` ← inilah yang dilayani oleh backend Rust

### Semua Halaman

| File Astro | URL | Keterangan |
|-----------|-----|------------|
| `index.astro` | `/` | Beranda, katalog produk, filter kategori |
| `product.astro` | `/product/:code` | Detail produk, checkout, QRIS, salin link |
| `login.astro` | `/login.html` | Portal login (Google, Discord, Demo) |
| `dashboard.astro` | `/dashboard` | Gateway — redirect ke reseller/user dashboard |
| `dashboard_reseller.astro` | `/dashboard_reseller.html` | Dashboard admin/reseller (statistik, transaksi, API Key) |
| `dashboard_user.astro` | `/dashboard_user.html` | Dashboard user biasa |
| `dashboard_keranjang.astro` | `/dashboard_keranjang.html` | Keranjang belanja |
| `dashboard_pesanan.astro` | `/dashboard_pesanan.html` | Riwayat pesanan |
| `dashboard_produk.astro` | `/dashboard_produk.html` | Katalog produk dashboard |
| `dashboard_pengaturan.astro` | `/dashboard_pengaturan.html` | Pengaturan akun |
| `reseller_koneksi.astro` | `/reseller_koneksi.html` | Koneksi reseller/toko |
| `reseller_penjualan.astro` | `/reseller_penjualan.html` | Laporan penjualan reseller |
| `reseller_laporan.astro` | `/reseller_laporan.html` | Laporan lengkap reseller |
| `reseller_keuntungan.astro` | `/reseller_keuntungan.html` | Kalkulasi keuntungan reseller |
| `dokumentasi.astro` | `/dokumentasi` | Dokumentasi API publik (White Label) |
| `hasil_pencarian.astro` | `/hasil_pencarian.html` | Halaman hasil pencarian produk |
| `404.astro` | `/404.html` | Halaman error 404 kustom |
| `about.astro` | `/about` | Tentang EasyMall |
| `service.astro` | `/service` | Layanan |
| `term.astro` | `/term` | Syarat & Ketentuan |
| `condition.astro` | `/condition` | Kondisi layanan |
| `security.astro` | `/security` | Kebijakan keamanan |
| `legalitas.astro` | `/legalitas` | Legalitas |

### File JavaScript Penting (`frontend/public/ecom/js/`)

| File | Fungsi |
|------|--------|
| `products.json` | Source data produk statis (fallback) |
| `index.js` | Logika beranda: fetch produk, filter kategori, animasi loading |
| `product_page.js` | Logika detail produk: checkout QRIS, polling status, rekomendasi |
| `hasil_pencarian.js` | Logika halaman pencarian |

---

## 🔌 VENDOR & INTEGRASI EKSTERNAL

| Vendor | Status | Untuk | Catatan |
|--------|--------|-------|---------|
| **KoalaStore** | ✅ Aktif | Produk digital (langganan, software) | Checkout via BuatQRIS, fulfillment otomatis |
| **Miracle Gaming** | ✅ Aktif | Produk game (top-up game) | Checkout via BuatQRIS, display saja |
| **Portal Pulsa** | ✅ Aktif | Pulsa & data internet | Checkout via BuatQRIS |
| **BuatQRIS** | ✅ Aktif | Payment gateway QRIS | Semua checkout melewati sini |
| **The SSL Store** | 🟡 Tampilan | SSL & Domain | Produk ada, checkout belum terhubung penuh |
| **Digiflazz** | ❌ Belum aktif | Alternatif pulsa | Konfigurasi ada di .env, belum diimplementasi |
| **Google OAuth** | ✅ Aktif | Login user | |
| **Discord OAuth** | ✅ Aktif | Login user | |

---

## ⚠️ CATATAN KEAMANAN (TODO)

| Item | Status | Prioritas |
|------|--------|-----------|
| Password admin di DB masih **plaintext** | ❌ Belum | 🔴 Tinggi |
| Hash password admin dengan **bcrypt/argon2** | ❌ Belum | 🔴 Tinggi |
| API Key reseller → sudah pakai **SHA-256** | ✅ Aman | - |
| Semua query DB pakai **parameterized query** (anti SQL Injection) | ✅ Aman | - |
| Backend hanya terekspos via **Reverse Proxy** (tidak expose langsung) | ✅ Aman | - |
| Transfer data dienkripsi via **HTTPS** | ✅ Aman | - |

---

## 🚀 QUICK REFERENCE — PERINTAH PALING SERING DIPAKAI

```bash
# ── BACKEND ──────────────────────────────────────────────
# Compile ulang backend setelah ubah main.rs
cd /root/ecommerce/dinamis/ecom_api && cargo build --release

# Restart server backend
pm2 restart easymall-api

# Lihat log backend
pm2 logs easymall-api --lines 30 --nostream

# Cek server jalan
curl -s http://localhost:5002/api/auth/status

# ── FRONTEND ─────────────────────────────────────────────
# Build ulang frontend setelah ubah file Astro/JS
cd /root/ecommerce/frontend && npm run build

# Dev server lokal (akses di http://localhost:5002 via backend)
# atau via Astro dev: npm run dev → http://localhost:4321

# ── DATABASE ─────────────────────────────────────────────
# Buka database SQLite
sqlite3 /root/ecommerce/dinamis/dashboard/ecommerce.db

# Lihat semua tabel
sqlite3 /root/ecommerce/dinamis/dashboard/ecommerce.db ".tables"
```

---

## ⚠️ GOTCHAS & TROUBLESHOOTING DEPLOYMENT VERCEL

Jika setelah push ke GitHub halaman Vercel (`https://easymall.ilhampradani.me/`) melempar error **404 Not Found** saat memanggil API `/api/products` (dan endpoint `/api/...` lainnya):
* **Penyebab**: Konfigurasi `vercel.json` di folder `frontend/` sempat menggunakan properti legacy `"routes"` bersamaan dengan `"rewrites"`. Di Vercel, jika properti `"routes"` didefinisikan, properti `"rewrites"` akan **diabaikan secara total**.
* **Solusi/Aturan**: Jangan pernah menggabungkan `"routes"` dan `"rewrites"` di file `vercel.json`. Gunakan hanya format `"rewrites"` dan `"cleanUrls"` seperti di bawah ini:
  ```json
  {
    "cleanUrls": true,
    "rewrites": [
      { "source": "/api/(.*)", "destination": "https://api.ilhampradani.me/api/$1" },
      { "source": "/product/:code", "destination": "/product" }
    ]
  }
  ```
* **Penting**: Pastikan file `vercel.json` berada di dalam folder `/root/ecommerce/frontend/` karena Vercel melakukan build dari sub-direktori tersebut.

