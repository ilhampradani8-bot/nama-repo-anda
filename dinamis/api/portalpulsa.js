// api/portalpulsa.js
require('dotenv').config();

const PORTALPULSA_USERID = process.env.PORTALPULSA_USERID;
const PORTALPULSA_KEY = process.env.PORTALPULSA_KEY;
const PORTALPULSA_SECRET = process.env.PORTALPULSA_SECRET;
const PORTALPULSA_BASE_URL = process.env.PORTALPULSA_BASE_URL || "https://portalpulsa.com/api/connect/";

async function makeRequestWithRetry(url, payload, retries = 3) {
    const headers = {
        "Content-Type": "application/x-www-form-urlencoded",
        "portal-userid": PORTALPULSA_USERID,
        "portal-key": PORTALPULSA_KEY,
        "portal-secret": PORTALPULSA_SECRET
    };

    // Convert object payload to URLSearchParams for application/x-www-form-urlencoded
    const body = new URLSearchParams(payload);

    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: headers,
                body: body
            });

            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            if (attempt === retries - 1) {
                console.error(`[Portal Pulsa API Connection Error] Gagal setelah ${retries} percobaan:`, error);
                throw error;
            }
            await new Promise(resolve => setTimeout(resolve, 1500));
        }
    }
}

/**
 * Mengurai teks respon dari Portal Pulsa untuk mengambil nominal unik transfer,
 * nomor rekening bank tujuan, dan nama pemilik rekening.
 * @param {string} message 
 */
function parseDepositInfo(message) {
    const info = {
        amount: null,
        bank_account: null,
        bank_holder: null
    };

    // 1. Mengambil nominal transfer (misal: "100.972" -> 100972)
    const nominalMatch = message.match(/sebesar Rp\s*([\d\.]+)/);
    if (nominalMatch) {
        info.amount = parseInt(nominalMatch[1].replace(/\./g, ''), 10);
    }

    // 2. Mengambil nomor rekening (misal: "0770520207")
    const rekeningMatch = message.match(/no\.\s*(\d+)/);
    if (rekeningMatch) {
        info.bank_account = rekeningMatch[1];
    }

    // 3. Mengambil nama pemilik rekening (a.n. BENY ARIF L)
    const anMatch = message.match(/a\.n\.\s*([^.]+)/);
    if (anMatch) {
        info.bank_holder = anMatch[1].trim();
    }

    return info;
}

/**
 * Mengajukan tiket/request deposit saldo ke Portal Pulsa.
 * @param {number} amount 
 * @param {string} bank (options: 'bca', 'bni', 'mandiri', 'bri', 'muamalat')
 */
async function createDeposit(amount, bank) {
    if (!PORTALPULSA_USERID || !PORTALPULSA_KEY || !PORTALPULSA_SECRET) {
        throw new Error("Kredensial PORTALPULSA tidak diatur di .env!");
    }

    const payload = {
        inquiry: "D",
        bank: bank.toLowerCase(),
        nominal: amount.toString()
    };

    try {
        const data = await makeRequestWithRetry(PORTALPULSA_BASE_URL, payload);
        if (data.result === "success") {
            const msg = data.message || "";
            data.parsed_data = parseDepositInfo(msg);
            return { success: true, data };
        } else {
            return { success: false, message: data.message || "Gagal mengajukan deposit." };
        }
    } catch (error) {
        return { success: false, message: error.message };
    }
}

/**
 * Mengecek sisa saldo deposit akun Portal Pulsa.
 */
async function checkBalance() {
    if (!PORTALPULSA_USERID || !PORTALPULSA_KEY || !PORTALPULSA_SECRET) {
        throw new Error("Kredensial PORTALPULSA tidak diatur di .env!");
    }

    const payload = { inquiry: "S" };

    try {
        const data = await makeRequestWithRetry(PORTALPULSA_BASE_URL, payload);
        if (data.result === "success") {
            return { success: true, data };
        } else {
            return { success: false, message: data.message || "Gagal mengecek saldo." };
        }
    } catch (error) {
        return { success: false, message: error.message };
    }
}

/**
 * Mengecek daftar harga produk.
 * @param {string} code (options: 'PLN', 'PULSA', 'GAME')
 */
async function getPrices(code) {
    if (!PORTALPULSA_USERID || !PORTALPULSA_KEY || !PORTALPULSA_SECRET) {
        throw new Error("Kredensial PORTALPULSA tidak diatur di .env!");
    }

    const payload = {
        inquiry: "HARGA",
        code: code.toUpperCase()
    };

    try {
        const data = await makeRequestWithRetry(PORTALPULSA_BASE_URL, payload);
        if (data.result === "success") {
            return { success: true, prices: data.message || [] };
        } else {
            return { success: false, message: data.message || "Gagal mengambil daftar harga." };
        }
    } catch (error) {
        return { success: false, message: error.message };
    }
}

/**
 * Melakukan transaksi pengisian pulsa/data/game/voucher.
 */
async function createTransaction(productCode, phone, trxidApi, idcust = "", index = 1) {
    if (!PORTALPULSA_USERID || !PORTALPULSA_KEY || !PORTALPULSA_SECRET) {
        throw new Error("Kredensial PORTALPULSA tidak diatur di .env!");
    }

    const payload = {
        inquiry: "I",
        code: productCode,
        phone: phone,
        trxid_api: trxidApi,
        no: index.toString()
    };
    if (idcust) {
        payload.idcust = idcust;
    }

    try {
        const data = await makeRequestWithRetry(PORTALPULSA_BASE_URL, payload);
        if (data.result === "success") {
            return { success: true, data };
        } else {
            return { success: false, message: data.message || "Gagal memproses transaksi." };
        }
    } catch (error) {
        return { success: false, message: error.message };
    }
}

/**
 * Melakukan transaksi pembelian Token PLN Prabayar.
 */
async function createPlnTransaction(productCode, phone, idcust, trxidApi, index = 1) {
    if (!PORTALPULSA_USERID || !PORTALPULSA_KEY || !PORTALPULSA_SECRET) {
        throw new Error("Kredensial PORTALPULSA tidak diatur di .env!");
    }

    const payload = {
        inquiry: "PLN",
        code: productCode,
        phone: phone,
        idcust: idcust,
        trxid_api: trxidApi,
        no: index.toString()
    };

    try {
        const data = await makeRequestWithRetry(PORTALPULSA_BASE_URL, payload);
        if (data.result === "success") {
            return { success: true, data };
        } else {
            return { success: false, message: data.message || "Gagal memproses transaksi token PLN." };
        }
    } catch (error) {
        return { success: false, message: error.message };
    }
}

/**
 * Mengecek status transaksi berdasarkan trxidApi.
 */
async function checkTransactionStatus(trxidApi) {
    if (!PORTALPULSA_USERID || !PORTALPULSA_KEY || !PORTALPULSA_SECRET) {
        throw new Error("Kredensial PORTALPULSA tidak diatur di .env!");
    }

    const payload = {
        inquiry: "STATUS",
        trxid_api: trxidApi
    };

    try {
        const data = await makeRequestWithRetry(PORTALPULSA_BASE_URL, payload);
        if (data.result === "success") {
            return { success: true, dataList: data.message || [] };
        } else {
            return { success: false, message: data.message || "Gagal mengecek status transaksi." };
        }
    } catch (error) {
        return { success: false, message: error.message };
    }
}

module.exports = {
    createDeposit,
    checkBalance,
    getPrices,
    createTransaction,
    createPlnTransaction,
    checkTransactionStatus
};
