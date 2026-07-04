# Panduan Integrasi REST API The SSL Store
**PT Easymall Software Development (NIB: 2506260085972)**

Dokumen ini merangkum cara kerja, kredensial, parameter, serta contoh implementasi REST API The SSL Store untuk mempermudah integrasi ke bot WhatsApp atau sistem transaksi digital EasyMall.

---

## 1. Kredensial & Lingkungan API
Kredensial Live API Anda telah diamankan di file `.env` sistem:
*   **API Partner Code:** `83304555`
*   **Authentication Token:** `E6F64ACF6D126D0E25955456C14ECC63`
*   **Registered Email:** `hello@ilhampradani.me`

### Endpoint Base URL
*   **Sandbox (Uji Coba):** `https://sandbox-wbapi.thesslstore.com/rest/`
*   **Live (Produksi):** `https://api.thesslstore.com/rest/`

Setiap request HTTP wajib menggunakan method **POST**, menyertakan header `"Accept: application/json"`, `"Content-Type: application/json"`, serta menyisipkan objek autentikasi `AuthRequest` di dalam request body.

---

## 2. Struktur Autentikasi Dasar (AuthRequest)
Semua request payload ke API ini wajib diawali dengan objek berikut:
```json
{
  "AuthRequest": {
    "PartnerCode": "83304555",
    "AuthToken": "E6F64ACF6D126D0E25955456C14ECC63"
  },
  ... [parameter spesifik perintah]
}
```

---

## 3. Fitur Utama & Struktur Parameter

Berikut adalah daftar API penting yang paling sering digunakan dalam siklus hidup sertifikat SSL:

### A. Health Check (Validasi Kredensial)
Digunakan untuk memastikan koneksi ke server The SSL Store berfungsi dan kredensial valid.
*   **Endpoint:** `/health/validatecredentials`
*   **Request Body:**
    ```json
    {
      "AuthRequest": {
        "PartnerCode": "83304555",
        "AuthToken": "E6F64ACF6D126D0E25955456C14ECC63"
      }
    }
    ```
*   **Response Sukses:**
    ```json
    {
      "AuthResponse": {
        "isSuccess": true
      }
    }
    ```

### B. Validasi CSR (CSR Validation)
Digunakan untuk mengecek apakah kode CSR yang dimasukkan pelanggan valid dan mengekstrak nama domain subjeknya sebelum memesan.
*   **Endpoint:** `/csr/validate`
*   **Request Body:**
    ```json
    {
      "AuthRequest": {
        "PartnerCode": "83304555",
        "AuthToken": "E6F64ACF6D126D0E25955456C14ECC63"
      },
      "CSR": "-----BEGIN CERTIFICATE REQUEST-----\n...",
      "ProductCode": "positivessl"
    }
    ```
*   **Response Penting:**
    *   `DomainName`: Nama domain utama yang diekstrak dari CSR.
    *   `DNSNames`: Daftar domain tambahan (SAN).
    *   `isValid`: Boolean status validitas CSR.

### C. Pemesanan Instan via Tautan (Invite Order)
*Metode terbaik untuk Bot WhatsApp.* Bot cukup mengirimkan tautan pendaftaran SSL ke pelanggan, dan pelanggan yang akan mengunggah CSR serta melakukan verifikasi domain sendiri di browser hp.
*   **Endpoint:** `/order/inviteorder`
*   **Request Body:**
    ```json
    {
      "AuthRequest": {
        "PartnerCode": "83304555",
        "AuthToken": "E6F64ACF6D126D0E25955456C14ECC63"
      },
      "ProductCode": "positivessl",
      "ValidityPeriod": 12,
      "CustomOrderID": "TRX-EASYMALL-100234",
      "RequestorEmail": "pembeli@email.com",
      "PreferVendorLink": false,
      "EmailLanguageCode": "EN"
    }
    ```
*   **Response Penting:**
    *   `TinyOrderLink`: URL putih (white-labeled) untuk diisi pelanggan.
    *   `TheSSLStoreOrderID`: ID Pesanan dari The SSL Store.

### D. Pemesanan Otomatis Penuh (New Order)
Digunakan jika sistem Anda mengumpulkan seluruh data (termasuk CSR, nama, email, dan alamat organisasi pembeli) secara penuh di sistem Anda.
*   **Endpoint:** `/order/neworder`
*   **Request Body:**
    ```json
    {
      "AuthRequest": {
        "PartnerCode": "83304555",
        "AuthToken": "E6F64ACF6D126D0E25955456C14ECC63"
      },
      "ProductCode": "positivessl",
      "ValidityPeriod": 12,
      "CustomOrderID": "TRX-EASYMALL-100234",
      "CSR": "-----BEGIN CERTIFICATE REQUEST-----\n...",
      "WebServerType": "Apache",
      "SignatureAlgorithm": "sha256",
      "AdminContact": {
        "FirstName": "John",
        "LastName": "Doe",
        "Phone": "08123456789",
        "Email": "admin@easymall.id",
        "OrganizationName": "PT Easymall Software Development",
        "AddressLine1": "Jl. Sudirman No. 12",
        "City": "Jakarta",
        "Region": "DKI Jakarta",
        "PostalCode": "10110",
        "Country": "ID"
      },
      "TechContact": {
        "FirstName": "John",
        "LastName": "Doe",
        "Phone": "08123456789",
        "Email": "admin@easymall.id",
        "OrganizationName": "PT Easymall Software Development",
        "AddressLine1": "Jl. Sudirman No. 12",
        "City": "Jakarta",
        "Region": "DKI Jakarta",
        "PostalCode": "10110",
        "Country": "ID"
      },
      "ApproverEmail": "admin@domainpelanggan.com",
      "isRenewalOrder": false
    }
    ```

### E. Mengecek Status Pesanan (Order Status)
Digunakan untuk memantau apakah sertifikat SSL sudah terbit atau masih ditahan (*pending*) oleh pihak CA.
*   **Endpoint:** `/order/status`
*   **Request Body:**
    ```json
    {
      "AuthRequest": {
        "PartnerCode": "83304555",
        "AuthToken": "E6F64ACF6D126D0E25955456C14ECC63"
      },
      "TheSSLStoreOrderID": "123456"
    }
    ```
*   **Response Penting:**
    *   `Status`: Status pesanan (misalnya: `PENDING_VETTING`, `ISSUED`, `CANCELLED`).
    *   `VendorStatus`: Status detail dari CA.

### F. Mengunduh Sertifikat (Download Certificate)
Digunakan saat status sertifikat sudah `ISSUED` untuk mengunduh file sertifikat asli.
*   **Endpoint:** `/order/download`
*   **Request Body:**
    ```json
    {
      "AuthRequest": {
        "PartnerCode": "83304555",
        "AuthToken": "E6F64ACF6D126D0E25955456C14ECC63"
      },
      "TheSSLStoreOrderID": "123456"
    }
    ```
*   **Response Penting:**
    *   `Certificate`: Kode teks sertifikat SSL utama.
    *   `IntermediateClass`: Rantai sertifikat intermediate (CA Bundle).

---

## 4. Contoh Implementasi Sederhana (Python)

Berikut adalah contoh skrip Python untuk melakukan integrasi cURL REST API secara langsung:

```python
import os
import requests
from dotenv import load_dotenv

# Load kredensial dari file .env
load_dotenv()

PARTNER_CODE = os.getenv("THESSLSTORE_PARTNER_CODE", "83304555")
AUTH_TOKEN = os.getenv("THESSLSTORE_AUTH_TOKEN", "E6F64ACF6D126D0E25955456C14ECC63")
BASE_URL = "https://api.thesslstore.com/rest"  # Ubah ke sandbox jika sedang testing

def make_invite_order(product_code, validity_months, custom_id, requestor_email):
    url = f"{BASE_URL}/order/inviteorder"
    
    payload = {
        "AuthRequest": {
            "PartnerCode": PARTNER_CODE,
            "AuthToken": AUTH_TOKEN
        },
        "ProductCode": product_code,
        "ValidityPeriod": validity_months,
        "CustomOrderID": custom_id,
        "RequestorEmail": requestor_email,
        "PreferVendorLink": False,
        "EmailLanguageCode": "EN"
    }
    
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json"
    }
    
    try:
        response = requests.post(url, json=payload, headers=headers)
        response_data = response.json()
        
        if response.status_code == 200 and response_data.get("AuthResponse", {}).get("isSuccess"):
            return {
                "success": True,
                "order_id": response_data.get("TheSSLStoreOrderID"),
                "invite_link": response_data.get("TinyOrderLink")
            }
        else:
            return {
                "success": False,
                "error": response_data.get("AuthResponse", {}).get("Message", "Unknown Error")
            }
    except Exception as e:
        return {"success": False, "error": str(e)}

# Contoh Penggunaan:
# res = make_invite_order("positivessl", 12, "TRX-99881", "hello@ilhampradani.me")
# print(res)
```
