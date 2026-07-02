// product_page.js - Unified Client-side Logic for Product details, checkout, and QRIS status polling
document.addEventListener('DOMContentLoaded', () => {
    console.log('EasyMarket Product Page Initialized');
    initProductPage();
});

let selectedProduct = null;
let statusPollingInterval = null;

// Determine API base URL dynamically for static files, Live Server, and native Flask environment
let API_BASE_URL = '';
if (window.location.port !== '5002' && window.location.protocol !== 'file:') {
    API_BASE_URL = 'http://139.59.122.230:5002';
} else if (window.location.protocol === 'file:') {
    API_BASE_URL = 'http://139.59.122.230:5002';
}

function formatRupiah(num) {
    if (num === undefined || num === null) return '0';
    return parseInt(num).toLocaleString('id-ID');
}

// Extract product code from URL parameters or path
function getProductCode() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('code')) {
        return urlParams.get('code');
    }
    const pathParts = window.location.pathname.split('/');
    return pathParts[pathParts.length - 1];
}

async function initProductPage() {
    const productCode = getProductCode();
    if (!productCode) {
        renderError("Parameter kode produk tidak ditemukan.");
        return;
    }

    try {
        const response = await fetch('/ecom/js/products.json');
        if (!response.ok) {
            throw new Error('Gagal memuat database produk');
        }
        const data = await response.json();
        const allProducts = data.products || [];
        const allCategories = data.categories || [];

        const product = allProducts.find(p => p.code === productCode);
        if (!product) {
            renderError(`Produk dengan kode "${productCode}" tidak ditemukan.`);
            return;
        }

        selectedProduct = product;
        const category = allCategories.find(c => c.slug === product.category_slug);

        renderProductDetails(product, category);
        initCheckoutForm(product);
        renderRecommendations(product, allProducts, allCategories);
        setupSearchActions();
        setupHeaderActions();

    } catch (err) {
        console.error("Initialization error:", err);
        renderError("Terjadi kesalahan saat memuat detail produk. Silakan hubungi CS.");
    }
}

function renderError(message) {
    const layout = document.getElementById('productViewLayout');
    if (layout) {
        layout.innerHTML = `
            <div style="text-align: center; padding: 4rem; color: #e03131; font-weight: 600;">
                ❌ ${message}
            </div>
        `;
    }
}

function renderProductDetails(product, category) {
    const layout = document.getElementById('productViewLayout');
    if (!layout) return;

    const iconEmoji = `<img src="/gambar/logoeasyfast.png" alt="${product.name}" style="max-width: 100%; height: auto; max-height: 200px; object-fit: contain; margin-bottom: 1rem;">`;
    const originalPrice = Math.round(product.price * 1.15);

    let specHtml = '';
    if (product.variants && product.variants[0]) {
        const v = product.variants[0];
        if (v.terms) {
            specHtml += `
                <div style="font-weight: 700; font-size: 1.1rem; margin-top: 1.5rem; margin-bottom: 0.5rem; color: var(--text-main);">Ketentuan Lisensi & Penggunaan</div>
                <p style="white-space: pre-line; font-size: 0.9rem; color: var(--text-muted); background: #fafafa; padding: 1.2rem; border-radius: 6px; border: 1px solid var(--border-color); line-height: 1.6; margin-bottom: 1.5rem;">${v.terms}</p>
            `;
        }
        if (v.warranty) {
            specHtml += `
                <div style="font-weight: 700; font-size: 1.1rem; margin-top: 1.5rem; margin-bottom: 0.5rem; color: var(--text-main);">Garansi Produk</div>
                <p style="white-space: pre-line; font-size: 0.9rem; color: #cc3838; background: #fff5f5; padding: 1.2rem; border-radius: 6px; border: 1px solid #ffc9c9; line-height: 1.6; margin-bottom: 1.5rem;">${v.warranty}</p>
            `;
        }
    }

    layout.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; padding: 2rem; border: 1px solid var(--border-color); border-radius: 8px; background: #ffffff;">
            ${iconEmoji}
            <div style="font-size: 0.85rem; color: var(--text-muted); text-align: center; font-weight: 500;">
                Jaminan Transaksi Aman & Instan ⚡
            </div>
        </div>
        <div style="display: flex; flex-direction: column;">
            <span style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--primary); font-weight: 700; margin-bottom: 0.4rem;">${category ? category.name : product.category_slug}</span>
            <h1 style="font-size: 2rem; font-weight: 800; line-height: 1.2; color: var(--text-main); margin-bottom: 0.6rem;">${product.name}</h1>
            <div style="display: flex; align-items: center; gap: 0.8rem; font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1.2rem; border-bottom: 1px solid var(--border-color); padding-bottom: 1rem;">
                <span>⭐ 4.9 Rating</span>
                <span>•</span>
                <span>${product.sold_count || '100+'} Terjual</span>
                <span>•</span>
                <span style="color: #2b8a3e; font-weight: 600;">Stok Tersedia</span>
            </div>
            
            <div style="background: #fafafa; border: 1px solid var(--border-color); padding: 1.5rem; border-radius: var(--radius); margin-bottom: 2rem;">
                <span style="font-size: 0.8rem; color: var(--text-muted); display: block; margin-bottom: 0.25rem;">Harga Mulai</span>
                <div>
                    <span style="font-size: 2rem; font-weight: 800; color: #e03131;">Rp${formatRupiah(product.price)}</span>
                    <span style="text-decoration: line-through; color: var(--text-muted); font-size: 1.1rem; margin-left: 0.5rem;">Rp${formatRupiah(originalPrice)}</span>
                </div>
            </div>

            <div style="font-weight: 700; font-size: 1.1rem; margin-bottom: 0.5rem; color: var(--text-main);">Deskripsi Jasa / Produk</div>
            <div style="color: var(--text-muted); font-size: 0.95rem; line-height: 1.7; margin-bottom: 2rem;">
                ${product.description || 'Tidak ada deskripsi detail untuk produk ini.'}
            </div>

            ${specHtml}
        </div>
    `;
}

function initCheckoutForm(product) {
    const variantSelect = document.getElementById('variantSelect');
    const targetLabel = document.getElementById('targetInputLabel');
    const targetInput = document.getElementById('targetInput');
    const targetHelp = document.getElementById('targetInputHelp');
    const confirmBuyBtn = document.getElementById('confirmBuyBtn');
    const checkPaymentStatusBtn = document.getElementById('checkPaymentStatusBtn');
    
    if (!variantSelect) return;

    // Reset QRIS UI state
    document.getElementById('qrisPaymentArea').style.display = 'none';
    confirmBuyBtn.style.display = 'inline-block';
    confirmBuyBtn.disabled = false;
    confirmBuyBtn.textContent = 'Lanjutkan Pembayaran';
    targetInput.value = '';

    // Clear & Populate variants
    variantSelect.innerHTML = '';
    product.variants.forEach((v) => {
        const option = document.createElement('option');
        option.value = v.code;
        option.dataset.price = v.price;
        option.textContent = `${v.name} - Rp ${formatRupiah(v.price)}`;
        if (v.stock !== undefined && v.stock <= 0) {
            option.textContent += ' (Habis)';
            option.disabled = true;
        }
        variantSelect.appendChild(option);
    });

    // Update Price value on change
    variantSelect.onchange = () => {
        const selectedOption = variantSelect.options[variantSelect.selectedIndex];
        if (selectedOption) {
            const price = selectedOption.dataset.price;
            document.getElementById('modalPriceValue').textContent = `Rp ${formatRupiah(price)}`;
        }
    };
    
    // Trigger initial select value
    if (variantSelect.options.length > 0) {
        variantSelect.selectedIndex = 0;
        const initialPrice = variantSelect.options[0].dataset.price;
        document.getElementById('modalPriceValue').textContent = `Rp ${formatRupiah(initialPrice)}`;
    }

    // Configure target inputs based on category slug
    const slug = product.category_slug;
    if (slug === 'game') {
        targetLabel.textContent = 'ID Pengguna / Akun Game';
        targetInput.placeholder = 'Contoh: 12345678 (Zone ID)';
        targetHelp.textContent = '*Pastikan ID akun game Anda sudah sesuai untuk menghindari kesalahan top up.';
    } else if (slug === 'pulsa' || slug === 'data') {
        targetLabel.textContent = 'Nomor Handphone Tujuan';
        targetInput.placeholder = 'Contoh: 081234567890';
        targetHelp.textContent = '*Masukkan nomor handphone tujuan pengisian pulsa/data yang aktif.';
    } else if (slug === 'pln') {
        targetLabel.textContent = 'Nomor Meteran / ID Pelanggan';
        targetInput.placeholder = 'Contoh: 51234567890';
        targetHelp.textContent = '*Nomor meteran PLN tujuan pengisian Token.';
    } else if (slug === 'ssl') {
        targetLabel.textContent = 'Domain Utama (Common Name)';
        targetInput.placeholder = 'Contoh: domainanda.com';
        targetHelp.textContent = '*Masukkan nama domain utama tanpa http:// atau https://.';
    } else {
        targetLabel.textContent = 'Nomor WhatsApp / Email Kontak';
        targetInput.placeholder = 'Contoh: 081234567890 atau email@domain.com';
        targetHelp.textContent = '*Kontak detail untuk pengiriman detail kredensial akun.';
    }

    confirmBuyBtn.onclick = submitCheckout;
    
    targetInput.onkeydown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            submitCheckout();
        }
    };

    checkPaymentStatusBtn.onclick = () => {
        const txnId = checkPaymentStatusBtn.dataset.transactionId;
        if (txnId) {
            checkPaymentStatus(txnId, true);
        }
    };
}

async function submitCheckout() {
    const confirmBuyBtn = document.getElementById('confirmBuyBtn');
    const variantSelect = document.getElementById('variantSelect');
    const targetInput = document.getElementById('targetInput');
    
    const targetVal = targetInput.value.trim();
    if (!targetVal) {
        alert('Mohon lengkapi ID Pengguna / Nomor Tujuan Anda terlebih dahulu!');
        targetInput.focus();
        return;
    }
    
    const selectedOption = variantSelect.options[variantSelect.selectedIndex];
    if (!selectedOption) {
        alert('Mohon pilih varian produk!');
        return;
    }
    
    confirmBuyBtn.disabled = true;
    confirmBuyBtn.textContent = 'Memproses...';
    
    const payload = {
        provider: selectedProduct.provider,
        product_code: selectedProduct.raw_code,
        variant_code: selectedOption.value,
        product_name: selectedProduct.name,
        variant_name: selectedOption.textContent.split(' - ')[0],
        target: targetVal,
        amount: parseInt(selectedOption.dataset.price)
    };
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/checkout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        if (response.ok && data.success) {
            const qrisArea = document.getElementById('qrisPaymentArea');
            const qrisImg = document.getElementById('qrisImage');
            const checkBtn = document.getElementById('checkPaymentStatusBtn');
            const statusBox = document.getElementById('qrisStatusBox');
            
            qrisImg.src = data.qr_image_url;
            checkBtn.dataset.transactionId = data.transaction_id;
            
            statusBox.className = 'qris-status-box pending';
            statusBox.innerHTML = `Status: <b>MENUNGGU PEMBAYARAN</b><br><small>Ref ID: ${data.transaction_id}</small>`;
            
            qrisArea.style.display = 'block';
            confirmBuyBtn.style.display = 'none';
            
            if (statusPollingInterval) clearInterval(statusPollingInterval);
            statusPollingInterval = setInterval(() => {
                checkPaymentStatus(data.transaction_id, false);
            }, 6000);
            
        } else {
            alert(`Gagal membuat pesanan: ${data.message || 'Error tidak diketahui'}`);
        }
    } catch (error) {
        console.error('Checkout error:', error);
        alert('Terjadi kesalahan koneksi saat melakukan checkout. Silakan coba kembali.');
    } finally {
        confirmBuyBtn.disabled = false;
        confirmBuyBtn.textContent = 'Lanjutkan Pembayaran';
    }
}

async function checkPaymentStatus(transactionId, showAlertOnPending = false) {
    const statusBox = document.getElementById('qrisStatusBox');
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/order/status/${transactionId}`);
        const data = await response.json();
        
        if (response.ok && data.success) {
            if (data.status === 'paid') {
                stopCheckoutPolling();
                
                statusBox.className = 'qris-status-box';
                statusBox.style.backgroundColor = '#d3f9d8';
                statusBox.style.color = '#2b8a3e';
                statusBox.style.borderColor = '#b2f2bb';
                
                let successMsg = `🎉 <b>PEMBAYARAN DITERIMA & SUKSES!</b><br>`;
                
                if (data.sn) {
                    successMsg += `<br>🔑 <b>SN / Voucher Anda:</b><br><code style="font-size:1.15rem; background:#fff; padding:6px 12px; display:inline-block; border-radius:4px; border:1px solid #ced4da; margin-top:5px; word-break:break-all;">${data.sn}</code>`;
                } else if (data.link) {
                    successMsg += `<br>🔗 <b>Link Akses Sertifikat SSL Anda:</b><br><a href="${data.link}" target="_blank" class="btn btn-buy" style="margin-top:6px; display:inline-block;">Selesaikan Setup SSL</a>`;
                } else if (data.stock_data) {
                    successMsg += `<br>🔑 <b>Data Akun / Voucher:</b><br><code style="font-size:1rem; background:#fff; padding:6px 12px; display:inline-block; border-radius:4px; border:1px solid #ced4da; margin-top:5px; word-break:break-all;">${data.stock_data}</code><br><br><small>OTP verifikasi login akan dibantu oleh Admin jika diperlukan.</small>`;
                } else {
                    successMsg += `<br><small>Pesanan Anda sedang dikirim oleh system. Mohon cek WhatsApp Anda untuk info detail.</small>`;
                }
                
                statusBox.innerHTML = successMsg;
                document.getElementById('checkPaymentStatusBtn').style.display = 'none';
                
            } else if (data.status === 'failed') {
                stopCheckoutPolling();
                statusBox.className = 'qris-status-box';
                statusBox.style.backgroundColor = '#ffe3e3';
                statusBox.style.color = '#e03131';
                statusBox.style.borderColor = '#ffa8a8';
                statusBox.innerHTML = `❌ <b>TRANSAKSI GAGAL</b><br><small>${data.message || 'Silakan hubungi customer service kami.'}</small>`;
                
            } else {
                if (showAlertOnPending) {
                    alert('Pembayaran belum terdeteksi. Silakan selesaikan pembayaran QRIS Anda terlebih dahulu.');
                }
            }
        }
    } catch (error) {
        console.error('Status check error:', error);
    }
}

function stopCheckoutPolling() {
    if (statusPollingInterval) {
        clearInterval(statusPollingInterval);
        statusPollingInterval = null;
    }
}
window.addEventListener('beforeunload', stopCheckoutPolling);

// Render simple dynamic recommendations for the product
function renderRecommendations(currentProduct, allProducts, allCategories) {
    const grid = document.getElementById('recomGrid');
    if (!grid) return;

    // Filter same category products, excluding current
    let sameCat = allProducts.filter(p => p.category_slug === currentProduct.category_slug && p.code !== currentProduct.code);
    
    // Fallback to any products if none in same category
    if (sameCat.length === 0) {
        sameCat = allProducts.filter(p => p.code !== currentProduct.code);
    }

    // Limit to 2 items
    const recs = sameCat.slice(0, 2);

    if (recs.length === 0) {
        grid.innerHTML = '<div style="grid-column:1/-1; color:var(--text-muted);">Tidak ada rekomendasi lainnya.</div>';
        return;
    }

    grid.innerHTML = '';
    recs.forEach(p => {
        const cat = allCategories.find(c => c.slug === p.category_slug);
        const originalPrice = Math.round(p.price * 1.15);
        const card = document.createElement('div');
        card.className = 'card';
        card.style.cursor = 'pointer';
        card.innerHTML = `
            <div class="card-image-wrapper" style="height: 100px;">
                <img src="/gambar/logoeasyfast.png" alt="${p.name}" style="height: 60px; width: auto; object-fit: contain;">
            </div>
            <div class="card-body" style="padding: 0.6rem;">
                <span style="font-size: 0.65rem; color: var(--text-muted);">${cat ? cat.name : p.category_slug}</span>
                <h3 class="card-title" style="font-size: 0.8rem; margin: 2px 0; line-height: 1.2; height: 32px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">${p.name}</h3>
                <div style="display: flex; align-items: center; gap: 4px; font-size: 0.7rem; color: #e03131; font-weight: 700; margin-top: 4px;">
                    <span>Rp${formatRupiah(p.price)}</span>
                </div>
            </div>
        `;
        card.onclick = () => {
            window.location.href = `/product/${p.code}`;
        };
        grid.appendChild(card);
    });
}

// Bind header search actions on this page to redirect back to home page with query param
function setupSearchActions() {
    const searchInput = document.getElementById('headerSearchInput');
    const searchBtn = document.getElementById('headerSearchBtn');
    
    if (searchInput) {
        const triggerSearch = () => {
            const val = searchInput.value.trim();
            window.location.href = `/?search=${encodeURIComponent(val)}`;
        };
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                triggerSearch();
            }
        });
        if (searchBtn) {
            searchBtn.onclick = triggerSearch;
        }
    }
}

function setupHeaderActions() {
    const loginBtn = document.getElementById('loginBtn');
    const logoLink = document.getElementById('headerLogoLink');
    const homeLink = document.getElementById('headerHomeLink');
    const productsLink = document.getElementById('headerProductsLink');
    const servicesLink = document.getElementById('headerServicesLink');
    const cartBtn = document.getElementById('headerCartBtn');

    if (cartBtn) {
        cartBtn.onclick = () => {
            alert('Keranjang Belanja Anda kosong.\nPlatform ini menggunakan sistem Instant Checkout (Beli Langsung) demi kenyamanan transaksi Anda.');
        };
    }

    if (logoLink) logoLink.onclick = (e) => {
        window.location.href = '/';
    };
    if (homeLink) homeLink.onclick = (e) => {
        window.location.href = '/';
    };
    if (productsLink) productsLink.onclick = (e) => {
        window.location.href = '/#products';
    };
    if (servicesLink) servicesLink.onclick = (e) => {
        window.location.href = '/#services';
    };

    if (loginBtn) {
        loginBtn.onclick = () => { window.location.href = '/login'; };
        
        fetch(`${API_BASE_URL}/api/auth/status`)
            .then(res => res.json())
            .then(data => {
                if (data.logged_in) {
                    loginBtn.textContent = 'Dashboard';
                    loginBtn.onclick = () => { window.location.href = '/dashboard'; };
                } else {
                    loginBtn.textContent = 'Login';
                    loginBtn.onclick = () => { window.location.href = '/login'; };
                }
            })
            .catch(() => {
                loginBtn.textContent = 'Login';
                loginBtn.onclick = () => { window.location.href = '/login'; };
            });
    }
}
