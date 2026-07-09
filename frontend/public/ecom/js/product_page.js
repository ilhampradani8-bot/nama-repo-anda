// product_page.js - Unified Client-side Logic for Product details, checkout, and QRIS status polling
window.showModernCartModal = function(onConfirm) {
    const existing = document.getElementById('modern-cart-modal');
    if (existing) existing.remove();

    let style = document.getElementById('modern-cart-modal-style');
    if (!style) {
        style = document.createElement('style');
        style.id = 'modern-cart-modal-style';
        style.textContent = `
            .modal-overlay {
                position: fixed;
                top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(33, 37, 41, 0.5);
                display: flex; justify-content: center; align-items: center;
                z-index: 9999;
                backdrop-filter: blur(2px);
            }
            .modal-card {
                background: #ffffff;
                border-radius: 8px;
                box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
                width: 90%;
                max-width: 400px;
                padding: 1.5rem;
                display: flex;
                flex-direction: column;
                gap: 1rem;
            }
            .modal-header h3 {
                margin: 0;
                font-size: 1.15rem;
                font-weight: 700;
                color: #212529;
            }
            .modal-body p {
                font-size: 0.9rem;
                color: #495057;
                line-height: 1.5;
                margin: 0;
            }
            .modal-footer {
                display: flex;
                justify-content: flex-end;
                gap: 0.75rem;
            }
            .modal-btn {
                padding: 8px 16px;
                border-radius: 4px;
                font-weight: 600;
                font-size: 0.88rem;
                cursor: pointer;
                border: none;
                transition: all 0.1s ease;
            }
            .modal-btn.cancel {
                background: #e9ecef;
                color: #495057;
            }
            .modal-btn.cancel:hover {
                background: #dee2e6;
            }
            .modal-btn.confirm {
                background: #0d6efd;
                color: #ffffff;
            }
            .modal-btn.confirm:hover {
                background: #0b5ed7;
            }
        `;
        document.head.appendChild(style);
    }

    const modal = document.createElement('div');
    modal.id = 'modern-cart-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-card">
            <div class="modal-header">
                <h3>🛒 Konfirmasi Keranjang</h3>
            </div>
            <div class="modal-body">
                <p><strong>Ketentuan Penyimpanan:</strong></p>
                <p>Produk ini akan bertahan maksimal <strong>24 jam</strong> di keranjang belanja Anda jika tidak dilakukan pembayaran.</p>
            </div>
            <div class="modal-footer">
                <button class="modal-btn cancel" id="modern-modal-cancel">Batal</button>
                <button class="modal-btn confirm" id="modern-modal-confirm">Ya, Masukkan</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#modern-modal-cancel').onclick = () => {
        modal.remove();
    };

    modal.querySelector('#modern-modal-confirm').onclick = () => {
        modal.remove();
        onConfirm();
    };
};

document.addEventListener('DOMContentLoaded', () => {
    console.log('EasyMall Product Page Initialized');
    initProductPage();
});

let selectedProduct = null;
let statusPollingInterval = null;
let loggedInUserEmail = "";

// Determine API base URL dynamically for static files, Live Server, and native Flask environment
let API_BASE_URL = '';
if (window.location.port !== '5002' && window.location.protocol !== 'file:') {
    API_BASE_URL = 'https://api.ilhampradani.me';
} else if (window.location.protocol === 'file:') {
    API_BASE_URL = 'https://api.ilhampradani.me';
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
        // Fetch Auth Status first
        try {
            const authRes = await fetch(`${API_BASE_URL}/api/auth/status`, { credentials: 'include' });
            if (authRes.ok) {
                const authData = await authRes.json();
                if (authData.logged_in) {
                    loggedInUserEmail = authData.email || "";
                }
            }
        } catch (e) {
            console.error("Auth check error:", e);
        }

        const response = await fetch(`${API_BASE_URL}/api/products`);
        if (!response.ok) {
            throw new Error('Gagal memuat database produk');
        }
        const data = await response.json();
        const apiProducts = data.products || [];
        const allCategories = data.categories || [];

        // Fetch DB products publicly
        let dbProducts = [];
        try {
            const dbRes = await fetch(`${API_BASE_URL}/api/db-products`);
            if (dbRes.ok) {
                const dbData = await dbRes.json();
                dbProducts = (dbData.products || []).map(p => ({
                    code: p.id ? `DB-${p.id}` : '',
                    raw_code: p.id ? `DB-${p.id}` : '',
                    name: p.product_name,
                    price: p.price,
                    description: p.description || '',
                    category_slug: p.category || 'digital',
                    provider: 'mymall',
                    badge: 'Rekomendasi',
                    sold_count: '500+',
                    email: p.email,
                    variants: p.variants && p.variants.length > 0 ? p.variants.map(v => ({
                        code: v.code || `DB-${p.id}-${v.name}`,
                        name: v.name,
                        price: v.price,
                        original_price: Math.round(v.price * 1.15)
                    })) : [
                        {
                            code: p.id ? `DB-${p.id}` : '',
                            name: p.variant_name || p.product_name,
                            price: p.price,
                            original_price: Math.round(p.price * 1.15)
                        }
                    ],
                    images: p.images || []
                }));
            }
        } catch (e) {
            console.error('Failed to fetch public DB products:', e);
        }

        const allProducts = [...apiProducts, ...dbProducts];

        const product = allProducts.find(p => p.code === productCode);
        if (!product) {
            renderError(`Produk dengan kode "${productCode}" tidak ditemukan.`);
            return;
        }

        selectedProduct = product;
        const category = allCategories.find(c => c.slug === product.category_slug);

        // Fetch store details if product has email (local database product)
        let storeInfo = null;
        if (product.email) {
            try {
                const storeRes = await fetch(`${API_BASE_URL}/api/store/info/${encodeURIComponent(product.email)}`);
                if (storeRes.ok) {
                    storeInfo = await storeRes.json();
                }
            } catch (err) {
                console.error("Error fetching store info for product details:", err);
            }
        }

        renderProductDetails(product, category, storeInfo);
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

function renderProductDetails(product, category, storeInfo) {
    const layout = document.getElementById('productViewLayout');
    if (!layout) return;

    const imageUrl = product.images && product.images[0] ? product.images[0] : '/gambar/logo/easymall-logo.png';
    const iconEmoji = `<img src="${imageUrl}" alt="${product.name}" style="width: 100%; height: auto; border-radius: 6px; object-fit: contain;">`;
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

    let storeHtml = '';
    const storeName = (storeInfo && storeInfo.store && storeInfo.store.store_name) 
        || (product.email ? `Mall milik ${product.email.split('@')[0]}` : 'EasyMall Official Store');
    const storeDesc = (storeInfo && storeInfo.store && storeInfo.store.description) 
        || (product.email ? 'Selamat datang di lapak digital premium saya. Temukan layanan terbaik di sini!' : 'Layanan resmi EasyMall untuk top up instant, pengiriman otomatis dan bantuan CS 24 jam.');
    const storeCat = (storeInfo && storeInfo.store && storeInfo.store.store_category) 
        || (product.email ? 'Lapak Digital' : 'Official Support');
    const isVerified = (storeInfo && storeInfo.store && storeInfo.store.verified === 1) || !product.email;
    const phone = storeInfo && storeInfo.phone;
    
    let chatUrl = product.email ? `mailto:${product.email}` : 'https://wa.me/6281234567890?text=Halo%20Admin%20EasyMall';
    let chatText = product.email ? 'Kirim Email' : 'Chat Admin';
    if (phone) {
        const cleanPhone = phone.replace(/[^0-9]/g, '');
        let waPhone = cleanPhone;
        if (waPhone.startsWith('0')) {
            waPhone = '62' + waPhone.slice(1);
        }
        chatUrl = `https://wa.me/${waPhone}?text=Halo%20${encodeURIComponent(storeName)},%20saya%20tertarik%20dengan%20produk%20Anda%20"${encodeURIComponent(product.name)}"%20di%20EasyMall.`;
        chatText = 'Chat Toko';
    }

    const storeIdOrEmail = (storeInfo && storeInfo.store && (storeInfo.store.slug || storeInfo.store.id))
        ? (storeInfo.store.slug || storeInfo.store.id)
        : product.email;

    const storeLinkHtml = product.email 
        ? `<a href="/viewstore/${encodeURIComponent(storeIdOrEmail)}" style="padding: 6px 14px; background: transparent; border: 1px solid var(--primary); color: var(--primary); font-weight: 700; font-size: 0.85rem; border-radius: var(--radius); text-decoration: none; display: inline-flex; align-items: center; transition: all 0.2s; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">Lihat Toko</a>`
        : '';

    const showStoreEmail = storeInfo && storeInfo.store 
        ? (storeInfo.store.show_email !== false && storeInfo.store.show_email !== 0)
        : true;
    const storeEmailDisplay = showStoreEmail && product.email 
        ? `<div style="font-size: 0.8rem; color: var(--text-muted); font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">${product.email}</div>`
        : '';

    const showStoreButtons = storeInfo && storeInfo.store 
        ? (storeInfo.store.show_buttons !== false && storeInfo.store.show_buttons !== 0)
        : true;

    let storeButtonsHtml = '';
    if (showStoreButtons) {
        storeButtonsHtml = `
            <div style="display: flex; gap: 8px;">
                <a href="${chatUrl}" target="_blank" style="padding: 6px 14px; background: #25d366; color: #ffffff; font-weight: 700; font-size: 0.85rem; border-radius: var(--radius); text-decoration: none; display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.907h.004c4.368 0 7.926-3.558 7.93-7.93a7.896 7.896 0 0 0-2.327-5.545zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592z"/></svg>
                    ${chatText}
                </a>
                <a href="/pesan.html?chat=${encodeURIComponent(product.email || '')}" style="padding: 6px 14px; background: var(--primary); color: #ffffff; font-weight: 700; font-size: 0.85rem; border-radius: var(--radius); text-decoration: none; display: inline-flex; align-items: center; transition: all 0.2s; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">Chat Toko</a>
                ${storeLinkHtml}
            </div>
        `;
    }

    storeHtml = `
        <div class="store-card" style="margin-top: 3rem; border: 1px solid var(--border-color); border-radius: var(--radius); padding: 1.5rem; background: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.02); display: flex; flex-direction: column; gap: 1rem;">
            <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; border-bottom: 1px solid #f1f3f5; padding-bottom: 1rem;">
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <img src="/gambar/logo/easymall-logo.png" alt="Avatar" style="width: 50px; height: 50px; border-radius: 50%; border: 1px solid var(--border-color); object-fit: cover;">
                    <div>
                        <div style="font-size: 0.75rem; text-transform: uppercase; font-weight: 700; color: var(--primary); font-family: 'Marcellus SC', serif;">${storeCat}</div>
                        <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--text-main); font-family: 'Marcellus SC', serif; margin: 2px 0; display: inline-flex; align-items: center; gap: 6px;">
                            ${storeName}
                            ${isVerified ? '<span style="font-size: 0.85rem;" title="Merchant Terverifikasi">🛡️</span>' : ''}
                        </h3>
                        ${storeEmailDisplay}
                    </div>
                </div>
                ${storeButtonsHtml}
            </div>
            <div style="font-size: 0.9rem; color: var(--text-muted); line-height: 1.5; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
                ${storeDesc}
            </div>
        </div>
    `;

    layout.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 8px; background: #ffffff; width: 100%; overflow: hidden;">
            ${iconEmoji}
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
            ${storeHtml}
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
    const isSpecialCategory = ['game', 'pulsa', 'data', 'pln', 'ssl'].includes(slug);
    
    if (isSpecialCategory) {
        if (targetInput.parentElement) targetInput.parentElement.style.display = 'block';
        targetInput.setAttribute('required', 'true');
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
        }
    } else {
        if (targetInput.parentElement) targetInput.parentElement.style.display = 'none';
        targetInput.removeAttribute('required');
        targetInput.value = loggedInUserEmail || '';
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

    const addToCartBtn = document.getElementById('addToCartBtn');
    if (addToCartBtn) {
        addToCartBtn.onclick = () => {
            window.showModernCartModal(async () => {
                const selectedOption = variantSelect.options[variantSelect.selectedIndex];
                if (!selectedOption) {
                    alert('Mohon pilih varian produk terlebih dahulu!');
                    return;
                }

                const productCode = product.code;
                const productName = product.name;
                const variantCode = selectedOption.value;
                const variantName = selectedOption.textContent.split(' - ')[0];
                const price = parseInt(selectedOption.dataset.price);

                try {
                    // First check if user is logged in
                    const authRes = await fetch(`${API_BASE_URL}/api/auth/status`, { credentials: 'include' });
                    const authData = await authRes.json();
                    if (!authData.logged_in) {
                        alert("Silakan login/masuk terlebih dahulu untuk menggunakan fitur keranjang!");
                        window.location.href = '/login.html';
                        return;
                    }

                    const payload = {
                        product_code: productCode,
                        product_name: productName,
                        variant_code: variantCode,
                        variant_name: variantName,
                        price: price,
                        quantity: 1
                    };

                    const res = await fetch(`${API_BASE_URL}/api/cart`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(payload),
                        credentials: 'include'
                    });

                    if (res.ok) {
                        alert('Produk berhasil dimasukkan ke keranjang!');
                        window.location.href = '/dashboard_keranjang.html';
                    } else {
                        alert('Gagal memasukkan ke keranjang. Silakan coba lagi.');
                    }
                } catch (err) {
                    console.error(err);
                    alert('Terjadi kesalahan koneksi.');
                }
            });
        };
    }
}

async function submitCheckout() {
    const confirmBuyBtn = document.getElementById('confirmBuyBtn');
    const variantSelect = document.getElementById('variantSelect');
    const targetInput = document.getElementById('targetInput');
    
    const slug = selectedProduct ? selectedProduct.category_slug : '';
    const isSpecialCategory = ['game', 'pulsa', 'data', 'pln', 'ssl'].includes(slug);
    
    let targetVal = targetInput.value.trim();
    if (!targetVal) {
        if (!isSpecialCategory) {
            alert('Silakan login terlebih dahulu untuk melanjutkan pembayaran!');
            window.location.href = '/login.html';
            return;
        } else {
            alert('Mohon lengkapi ID Pengguna / Nomor Tujuan Anda terlebih dahulu!');
            targetInput.focus();
            return;
        }
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
            body: JSON.stringify(payload),
            credentials: 'include'
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

    // Limit to 4 items
    const recs = sameCat.slice(0, 4);

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
                <img src="/gambar/logo/easymall-logo.png" alt="${p.name}" style="height: 60px; width: auto; object-fit: contain;">
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

// Bind header search actions on this page to redirect to hasil_pencarian.html
function setupSearchActions() {
    const searchInput = document.getElementById('headerSearchInput');
    const searchBtn = document.getElementById('headerSearchBtn');
    
    if (searchInput) {
        const triggerSearch = () => {
            const val = searchInput.value.trim();
            if (val.length > 0) {
                window.location.href = `/hasil_pencarian.html?query=${encodeURIComponent(val)}`;
            }
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
            window.location.href = '/dashboard_keranjang.html';
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
        const loginUrl = '/login.html';
        const dashboardUrl = API_BASE_URL ? `${API_BASE_URL}/dashboard.html` : '/dashboard.html';

        loginBtn.onclick = () => { window.location.href = loginUrl; };
        
        fetch(`${API_BASE_URL}/api/auth/status`, { credentials: 'include' })
            .then(res => res.json())
            .then(data => {
                if (data.logged_in) {
                    loginBtn.textContent = 'Dashboard';
                    loginBtn.onclick = () => { window.location.href = dashboardUrl; };
                } else {
                    loginBtn.textContent = 'Login';
                    loginBtn.onclick = () => { window.location.href = loginUrl; };
                }
            })
            .catch(() => {
                loginBtn.textContent = 'Login';
                loginBtn.onclick = () => { window.location.href = loginUrl; };
            });
    }
}
