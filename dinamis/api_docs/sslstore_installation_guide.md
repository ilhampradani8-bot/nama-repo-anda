# Panduan Pemasangan & Operasional Layanan SSL Store
**PT Easymall Software Development**

Dokumen ini menjelaskan alur operasional, petunjuk pengujian, serta konfigurasi teknis untuk fitur pemesanan otomatis Sertifikat SSL di Bot WhatsApp PT Easymall.

---

## 1. Alur Kerja Pengguna (User Journey)

Mekanisme pembelian SSL dirancang menggunakan metode **Invite Order** agar mempermudah pengguna melakukan validasi kepemilikan domain secara mandiri:

1. **Memilih Menu:** Pengguna mengirim chat `menu` ke Bot WA -> memilih opsi `6` (**Layanan IT**) -> memilih opsi `7` (**Sertifikat SSL (Otomatis)**).
2. **Memilih Produk:** Bot menampilkan daftar produk SSL beserta harga jual (dalam Rupiah) yang sudah dikonversi dan diberi markup secara otomatis. Pengguna memilih nomor produk.
3. **Input Email:** Pengguna diminta memasukkan email aktif (digunakan untuk keperluan pengiriman data SSL dan validasi oleh Certificate Authority).
4. **Konfirmasi & Pembayaran:** Bot menampilkan ringkasan pesanan dan menginstruksikan pengguna mengetik `BAYAR` untuk generate invoice QRIS (via API **BuatQRIS**).
5. **Pembayaran:** Pengguna scan dan membayar nominal tagihan QRIS yang dikirimkan bot.
6. **Fulfillment Otomatis:** Setelah pembayaran masuk, pengguna dapat mengetik opsi `8` (**Cek Status Transaksi**) -> memilih opsi `3` (**Sertifikat SSL**) -> memasukkan **Ref ID**.
7. **Penerimaan Link:** Sistem memproses pemesanan ke API The SSL Store, memotong saldo USD/debit kartu partner Anda, lalu mengirimkan **TinyOrderLink** langsung ke nomor WhatsApp pengguna.
8. **Validasi oleh Pelanggan:** Pelanggan mengeklik tautan tersebut untuk mengunggah CSR, memilih metode validasi (email, DNS, atau HTTP file), dan menerbitkan sertifikat SSL mereka sendiri.

---

## 2. Cara Uji Coba (Sandbox Mode vs Live Mode)

Sistem Anda mendukung pengujian penuh menggunakan lingkungan **Sandbox** dari The SSL Store agar tidak memotong saldo asli Anda saat melakukan test order.

### Langkah Mengubah Mode Pengujian:
Buka file konfigurasi `.env` di root direktori `/root/botpulsa/.env` lalu ubah variabel berikut:

* **Mode Sandbox (Uji Coba gratis):**
  ```env
  THESSLSTORE_MODE="TEST"
  ```
* **Mode Live (Produksi asli - memotong saldo/debit kartu):**
  ```env
  THESSLSTORE_MODE="LIVE"
  ```

---

## 3. Struktur File Tambahan dalam Proyek

Seluruh kode integrasi ditulis secara modular dan rapi sesuai arsitektur proyek Anda:

1. **`api/sslstore.py`**: Berisi wrapper API Python untuk komunikasi REST ke server The SSL Store (health check, query produk, invite order, dan check status).
2. **`bot-wa/show_sslstore.py`**: Mengelola state machine WhatsApp untuk memandu pengguna memilih produk, input email, konfirmasi QRIS, log transaksi database lokal `bot_memory.db` (`sslstore_orders`), serta trigger pemesanan API setelah pembayaran terverifikasi.
3. **`bot-wa/wa_logic.py`**: Diintegrasikan untuk me-route chat pengguna ke state machine SSL Store pada menu Layanan IT dan menu Cek Status Transaksi.

---

## 4. Cara Menjalankan & Restart Layanan

Setiap kali Anda mengubah pengaturan penting (misalnya beralih dari Sandbox ke Live di file `.env`), restart proses backend dan dashboard agar konfigurasi baru aktif.

### Perintah PM2:
Jalankan perintah berikut di terminal server Anda:

```bash
# Restart bot WhatsApp utama
pm2 restart botpulsa-wa

# Restart dashboard reseller/web
pm2 restart botpulsa-dashboard
```

Untuk memantau log aktivitas transaksi atau jika terjadi kendala koneksi:
```bash
# Melihat log realtime dari bot
pm2 logs botpulsa-wa
```
