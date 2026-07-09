# EasyMall E-Commerce - Frontend Documentation

Repositori ini berisi kode sumber untuk bagian **Frontend** dari sistem E-Commerce EasyMall. Proyek ini dibangun menggunakan framework **Astro (v7.0.6)** dengan pendekatan JAMstack modern, menggabungkan kecepatan kompilasi statis (Static Site Generation/SSG) dengan interaktivitas dinamis di sisi klien (Client-Side Rendering/CSR).

---

## 🚀 Fitur Utama & Arsitektur

1. **Static Site Generation (SSG) via Astro**: Halaman web statis di-render secara build-time untuk performa optimal dan SEO yang unggul.
2. **Client-Side Rendering (CSR) Modular**: Logika interaktif seperti fetching data produk statis (`products.json`), filter kategori, pencarian, checkout instan, dan integrasi QRIS dikelola menggunakan file JavaScript murni (Vanilla JS) di folder `public/ecom/js/`.
3. **Dynamic API Routing (CORS-friendly)**: Frontend secara dinamis berkomunikasi dengan Backend API Rust Axum (port `5002`). Endpoint yang digunakan meliputi autentikasi, checkout, status transaksi QRIS, dan OAuth.
4. **Desain Premium & Responsive**: Tata letak responsif menggunakan CSS murni (Vanilla CSS) yang hemat resource dan sangat cepat dimuat.
5. **Autentikasi Terintegrasi**: Halaman login mendukung Single-Sign-On (SSO) Google OAuth, Discord OAuth, dan Autentikasi Demo instan.
6. **Dashboard Khusus Role**: Pengalihan otomatis (gateway) ke dashboard pengguna biasa (`dashboard_user.astro`) atau dashboard reseller (`dashboard_reseller.astro`).
7. **Animasi Loading Premium**: Proses fetch data API dilengkapi animasi visual teks "LOADING" bergerak yang mewah (berputar 180 derajat) untuk menggantikan spinner tradisional.
8. **Halaman Error 404 Interaktif**: Penanganan rute tak dikenal dialihkan ke halaman 404 khusus bertema "Dribbble Lost Dog" yang terintegrasi dengan header & footer utama.
9. **Tombol Salin Link Produk Bulletproof**: Ditambahkan fitur "Salin Link Produk" di halaman detail yang otomatis memformat tautan ke domain resmi EasyMall. Menggunakan fallback `execCommand` agar tetap berfungsi di browser non-HTTPS / in-app browser.

---

## 📁 Struktur Proyek & File Penting

Peta struktur direktori di bawah ini merincikan file-file penting yang menyusun EasyMall Frontend:

```text
frontend/
├── public/
│   ├── ecom/
│   │   ├── css/
│   │   │   └── style.css           # File stylesheet utama seluruh halaman
│   │   └── js/
│   │       ├── products.json       # Source of Truth data katalog & kategori produk
│   │       ├── index.js            # Logika katalog, filter, pencarian, & animasi loading utama
│   │       ├── product_page.js     # Logika detail produk, checkout, status polling QRIS, & rekomendasi
│   │       └── [other_pages].js    # Logika JavaScript untuk halaman statis pendukung
│   └── gambar/                     # Aset gambar, logo, banner, dan ikon
├── src/
│   ├── components/
│   │   ├── Header.astro            # Komponen bilah navigasi atas (pencarian, keranjang, login)
│   │   ├── Footer.astro            # Komponen catatan kaki (informasi kontak, legalitas)
│   │   └── Sidebar.astro           # Komponen bilah samping khusus halaman dashboard
│   ├── layouts/
│   │   ├── PenggabungUtama.astro   # Tata letak global (menyertakan CSS, script global, header, footer)
│   │   └── penggabung_pageincludefooter.astro
│   └── pages/
│       ├── index.astro             # Halaman Beranda (Katalog Produk & Filter Kategori)
│       ├── product.astro           # Halaman Detail Produk & Formulir Checkout/QRIS + Salin Link
│       ├── login.astro             # Halaman Portal Autentikasi (Google, Discord, Demo)
│       ├── 404.astro               # Halaman error 404 kustom bertema Lost Dog
│       ├── dashboard.astro         # Gateway pengalihan rute dashboard berdasarkan sesi
│       ├── dashboard_user.astro    # Dasbor untuk Pelanggan/User
│       ├── dashboard_reseller.astro# Dasbor untuk Reseller
│       └── [legal_pages].astro     # Halaman legalitas (about, condition, term, security, dll.)
├── astro.config.mjs                 # Konfigurasi Astro (output format: file)
├── package.json                    # Dependensi NPM & skrip build
└── vercel.json                     # Konfigurasi deployment, routing kustom, Clean URLs & 404 fallback
```

---

## 🛠️ Perintah Pengembangan (Commands)

Semua perintah dijalankan menggunakan terminal dari dalam folder `frontend/`:

| Perintah | Deskripsi |
| :--- | :--- |
| `npm install` | Menginstal seluruh dependensi modul Node.js |
| `npm run dev` | Menjalankan server pengembangan lokal di `http://localhost:4321` |
| `npm run build` | Mengompilasi proyek menjadi aset statis produksi di direktori `./dist/` |
| `npm run preview` | Meninjau hasil kompilasi produksi secara lokal sebelum melakukan deploy |

> [!NOTE]
> Jika Anda bekerja sebagai AI Agent, Anda dapat menjalankan dev server di latar belakang menggunakan perintah `astro dev --background` untuk membebaskan terminal interaktif.

---

## 🔗 Integrasi Vercel & URL Rewrites
Proyek ini dilengkapi dengan `vercel.json` yang mengonfigurasi aturan routing sebagai berikut:
- **Clean URLs**: Menyembunyikan ekstensi `.html` pada URL browser (misal `/dokumentasi` menggantikan `/dokumentasi.html`).
- **404 Fallback**: Mengarahkan rute yang tidak terdaftar di sistem file Vercel secara otomatis ke `/404.html` dengan mengembalikan status HTTP 404.
- **Rewrites**: Mengarahkan rute dinamis detail produk (seperti `/product/PROD_CODE`) ke file statis `product.html` agar parameter kode produk dapat diekstrak dan di-render secara dinamis di sisi klien melalui `product_page.js`.

### ⚠️ Solusi Error "404: NOT_FOUND" di Vercel
Jika Anda baru pertama kali menghubungkan repositori Git ke Vercel dan menemui error **404: NOT_FOUND**, hal ini terjadi karena Vercel mencoba mencari file `index.html` langsung di root repositori, padahal proyek Astro kita terletak di dalam subfolder `frontend/`.

**Cara Mengatasi:**
1. Masuk ke **Vercel Dashboard** Anda.
2. Buka proyek Vercel Anda, lalu pilih tab **Settings** -> **General**.
3. Cari bagian **Root Directory** dan ubah nilainya menjadi **`frontend`** (bukan root `/`).
4. Klik **Save**.
5. Lakukan deploy ulang (**Redeploy**) dari tab Deployments. Vercel akan otomatis mengenali Astro, menginstal dependensi, menjalankan `npm run build`, dan mengarahkan rute deploy statis ke folder `frontend/dist/` dengan benar.

## 🌐 Panduan Hubungan API & Domain

Seluruh jalur komunikasi API pada aplikasi EasyMall secara konsisten menggunakan domain resmi:
* **Backend API**: **`https://api.ilhampradani.me`**
* **Frontend Site**: **`https://easymall.ilhampradani.me`**

### Arsitektur Aliran Data:
1. **Frontend**: Melayani file-file statis dan logika UI yang di-compile menggunakan Astro di bawah domain **`https://easymall.ilhampradani.me`**.
2. **API Backend**: Seluruh permintaan data (fetch data produk, autentikasi, pengaturan toko, checkout) dikirim langsung ke domain **`https://api.ilhampradani.me`**.
3. **Database**: Menggunakan SQLite di server produksi yang beralamat di `/root/ecommerce/dinamis/dashboard/ecommerce.db`.

### 🛠️ Cara Menjalankan & Membangun Proyek
1. **Menjalankan Server Pengembangan**:
   ```bash
   npm run dev
   ```
2. **Kompilasi Produksi**:
   ```bash
   npm run build
   ```
