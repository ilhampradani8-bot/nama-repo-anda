# EasyMarket E-Commerce System Documentation

Dokumentasi komprehensif ini dibuat untuk memandu developer maupun AI Agent agar dapat memahami arsitektur, rute, konfigurasi port, file penting, dan struktur database EasyMarket secara instan tanpa perlu memindai (scan) seluruh isi folder proyek.

---

## 1. Ikhtisar & Arsitektur Utama

Sistem EasyMarket telah dimodernisasi menggunakan arsitektur **Single Page Application (SPA)** yang terpisah antara frontend statis dengan backend API.

*   **Frontend**: Berjalan sepenuhnya di sisi klien (Client-Side) menggunakan HTML5, CSS3 murni, dan Vanilla Javascript. Mendukung eksekusi file lokal (`file://`), VS Code Live Server, serta deployment statis seperti Vercel dan Netlify.
*   **Routing**: Menggunakan **Hash-based Routing** (`window.location.hash`, contoh: `/#/product/PROD_CODE`) untuk menampilkan katalog dan detail produk tanpa memicu muat ulang halaman (page refresh).
*   **Backend API**: Dilayani oleh aplikasi Flask (`ecom_app.py`) pada port `5002`. Menyediakan endpoint autentikasi, checkout produk, integrasi payment gateway QRIS, dan polling status transaksi.
*   **Dashboard Admin**: Dilayani oleh aplikasi Flask terpisah di direktori `/dashboard` pada port `5003`.

---

## 2. Peta Port & Layanan PM2 (VPS Host: `139.59.122.230`)

Semua layanan dikelola menggunakan **PM2** di latar belakang server dan dikonfigurasi dengan `pm2 startup` agar menyala otomatis saat server melakukan reboot/restart.

| Nama Proses PM2 | Port | Fungsi Utama | Lokasi Direktori |
| :--- | :--- | :--- | :--- |
| **`botpulsa-ecom`** | `5002` | API Backend E-Commerce Flask | `/root/botpulsa/` |
| **`botpulsa-dashboard`** | `5003` | Dasbor Admin E-Commerce | `/root/botpulsa/dashboard/` |
| **`botpulsa-adminer`** | `5009` | Pengelola Database SQLite (Adminer PHP) | `/root/botpulsa/adminer/` |
| **`botpulsa-wa`** | - | Bot WhatsApp Layanan Utama | `/root/botpulsa/bot-wa/` |
| **`botpulsa-wa-group`** | - | Bot WhatsApp Layanan Grup | `/root/botpulsa/bot-wa-group/` |

---

## 3. Berkas-Berkas Utama

*   [`/root/botpulsa/index.html`](file:///root/botpulsa/index.html): Berkas *entry point* tunggal (SPA). Menyediakan tata letak halaman utama, kategori produk, kontainer kosong untuk detail tampilan produk (`#productDetailView`), dan kontainer kosong untuk laci pembayaran (`#paykonfirmasiDrawer`).
*   [`/root/botpulsa/ecom/js/index.js`](file:///root/botpulsa/ecom/js/index.js): Otak pengendali sisi klien. Mengatur inisialisasi awal, pemfilteran produk secara dinamis, integrasi status masuk dengan API, memuat berkas template dinamis (`loadTemplates`), dan mengarahkan router hash.
*   [`/root/botpulsa/ecom/include_index/productview.html`](file:///root/botpulsa/ecom/include_index/productview.html): Template terpisah berisi struktur HTML untuk tampilan spesifikasi detail produk dan produk rekomendasi serupa.
*   [`/root/botpulsa/ecom/include_index/productview.js`](file:///root/botpulsa/ecom/include_index/productview.js): Logic JavaScript terpisah untuk menampilkan detail produk dan rekomendasi produk (`showProductDetail`, `renderProductMainDetail`, `renderRecommendations`).
*   [`/root/botpulsa/ecom/include_index/paykonfirmasi.html`](file:///root/botpulsa/ecom/include_index/paykonfirmasi.html): Template terpisah berisi struktur HTML untuk formulir checkout pemesanan, laci pembayaran (drawer), rincian harga total, serta area scan QRIS otomatis.
*   [`/root/botpulsa/ecom/include_index/paykonfirmasi.js`](file:///root/botpulsa/ecom/include_index/paykonfirmasi.js): Logic JavaScript terpisah untuk mengurus drawer checkout, memproses submit pesanan ke API, dan status polling pembayaran QRIS (`openCheckoutDrawer`, `submitCheckout`, `checkPaymentStatus`, `stopCheckoutPolling`).
*   [`/root/botpulsa/ecom/js/products.json`](file:///root/botpulsa/ecom/js/products.json): Berkas data statis yang bertindak sebagai *source of truth* untuk seluruh produk dan kategorinya.
*   [`/root/botpulsa/ecom_app.py`](file:///root/botpulsa/ecom_app.py): Layanan API Flask E-Commerce. Menangani endpoint `/api/checkout`, `/api/order/status/<id>`, `/api/auth/status`, login OAuth Google/Discord, dan melampirkan header **CORS** kustom.
*   [`/root/botpulsa/login.html`](file:///root/botpulsa/login.html): Halaman login admin dengan desain *split-screen full-width* modern yang mendukung OAuth Google, Discord, dan demo akun.
*   [`/root/botpulsa/.env`](file:///root/botpulsa/.env): File konfigurasi variabel lingkungan yang berisi API keys, token, rahasia OAuth, kredensial Adminer, dan konfigurasi mark-up harga.

---

## 4. Konfigurasi & Akses Database (SQLite)

Semua database menggunakan SQLite 3 (file `.db`).

### Berkas Database
1.  **Database E-Commerce Web**:
    *   Path: `/root/botpulsa/dashboard/ecommerce.db`
    *   Berisi tabel `admins` (pengguna admin), `transactions` (pesanan e-commerce web), `reseller_profits` (keuntungan reseller), dan `order_metadata`.
2.  **Database WhatsApp Bot**:
    *   Path: `/root/botpulsa/bot-wa/bot_memory.db`
    *   Berisi data transaksi bot, log interaksi chat, memori asisten AI, dan logs WhatsApp.
3.  **Database Reseller**:
    *   Path: `/root/botpulsa/reseller/reseller.db`

### Manajemen Database via Web (Adminer)
Akses Adminer telah disiapkan untuk melihat, mengubah, dan mengueri database secara langsung dari web browser.
*   **URL**: [http://139.59.122.230:5009/](http://139.59.122.230:5009/)
*   **Sistem**: `SQLite 3`
*   **Username**: `admin`
*   **Password**: `admin123` (Disinkronkan dari `.env`)
*   **Database**: Masukkan path absolut file `.db` yang ingin dibuka (contoh: `/root/botpulsa/dashboard/ecommerce.db` atau `/root/botpulsa/bot-wa/bot_memory.db`).

*Catatan: Adminer menggunakan konfigurasi wrapper kustom di `/root/botpulsa/adminer/index.php` yang menjembatani kata sandi masuk sehingga database SQLite (yang aslinya tanpa sandi) dapat diakses dengan aman tanpa memicu error.*

---

## 5. Fitur Penting & Integrasi Logika

### A. Dynamic API Base URL (CORS)
Pada `ecom/js/index.js`, sistem akan memeriksa port browser:
```javascript
let API_BASE_URL = '';
if (window.location.port !== '5002' && window.location.protocol !== 'file:') {
    API_BASE_URL = 'http://139.59.122.230:5002';
} else if (window.location.protocol === 'file:') {
    API_BASE_URL = 'http://139.59.122.230:5002';
}
```
Jika file frontend dibuka via VS Code Live Server (port 5500), Vercel, atau protokol lokal, URL pemanggilan API secara otomatis diarahkan ke port `5002` VPS. Di sisi Flask (`ecom_app.py`), respons dilengkapi dengan header CORS berikut agar tidak diblokir browser:
```python
@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization'
    response.headers['Access-Control-Allow-Methods'] = 'GET,PUT,POST,DELETE,OPTIONS'
    return response
```

### B. Alur Checkout QRIS
1. Klien mengirim data checkout dalam format JSON ke `/api/checkout`.
2. Flask memproses pesanan, membuat transaksi baru di database `ecommerce.db`, dan menghubungi BuatQRIS API untuk mendapatkan URL gambar QRIS (`qr_image_url`).
3. Klien menampilkan QRIS di antarmuka (drawer checkout) dan memulai polling otomatis setiap 6 detik ke `/api/order/status/<transaction_id>` untuk memverifikasi apakah pembayaran telah sukses dilakukan oleh pelanggan.

### C. Modular Template & Logic Loading
Tata letak detail produk dan laci formulir pemesanan dipisah secara modular ke dalam subfolder `/ecom/include_index/`:

1. **HTML Template**: Diambil secara dinamis saat inisialisasi SPA dengan fungsi `loadTemplates()` di `index.js` menggunakan API `fetch` lokal.
2. **Logic JavaScript**: Dimuat langsung melalui tag `<script>` pada halaman `index.html` secara berurutan:
   ```html
   <script src="ecom/js/index.js"></script>
   <script src="ecom/include_index/productview.js"></script>
   <script src="ecom/include_index/paykonfirmasi.js"></script>
   ```
   Variabel global dan *state* (seperti `allProducts`, `selectedProduct`, `formatRupiah`, dll.) secara otomatis terbagi secara global dan dapat saling diakses secara mulus.
