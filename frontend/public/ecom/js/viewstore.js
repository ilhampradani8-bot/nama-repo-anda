// viewstore.js - Client-side Logic for Customer Storefront View
document.addEventListener('DOMContentLoaded', () => {
    console.log('EasyMall ViewStore Page Initialized');
    initViewStorePage();
});

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

function getStoreEmail() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('email')) {
        return urlParams.get('email');
    }
    const pathParts = window.location.pathname.split('/');
    let lastPart = pathParts[pathParts.length - 1] || "";
    return lastPart.replace('.html', '');
}

async function initViewStorePage() {
    const email = getStoreEmail();
    if (!email) {
        renderError("Parameter email merchant tidak ditemukan.");
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/store/info/${encodeURIComponent(email)}`);
        if (!response.ok) {
            throw new Error('Gagal memuat profil toko');
        }
        const data = await response.json();
        if (data.success) {
            renderStorefront(data.store, data.products, data.phone, data.email || email);
        } else {
            renderError(data.error || "Gagal memuat profil toko.");
        }
    } catch (err) {
        console.error("Initialization error:", err);
        renderError("Terjadi kesalahan saat menghubungi server.");
    }
}

function renderError(message) {
    const nameEl = document.getElementById('storeName');
    const taglineEl = document.getElementById('storeTagline');
    const gridEl = document.getElementById('storeProductsGrid');
    
    if (nameEl) nameEl.textContent = "Error";
    if (taglineEl) taglineEl.textContent = message;
    if (gridEl) {
        gridEl.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 4rem; color: #e03131; font-weight: 600;">
                ❌ ${message}
            </div>
        `;
    }
}

function renderStorefront(store, products, phone, email) {
    document.getElementById('storeName').textContent = store.store_name || `Mall milik ${email.split('@')[0]}`;
    document.getElementById('storeCategory').textContent = store.store_category || "Lapak Digital";
    document.getElementById('storeTagline').textContent = store.description || "Selamat datang di lapak digital premium saya. Temukan layanan terbaik di sini!";
    document.getElementById('storeTotalProducts').textContent = products.length;

    // Verified badge
    const verifiedBadge = document.getElementById('storeVerifiedBadge');
    if (store.verified === 1) {
        verifiedBadge.style.display = 'inline-flex';
    } else {
        verifiedBadge.style.display = 'none';
    }

    // Join badge / date (Email)
    const joinBadge = document.getElementById('storeJoinBadge');
    if (store.show_email !== false && store.show_email !== 0) {
        joinBadge.textContent = `✉️ Kontak: ${email}`;
        joinBadge.style.display = 'inline-flex';
    } else {
        joinBadge.style.display = 'none';
    }

    // Chat button
    const chatBtn = document.getElementById('storeChatBtn');
    const storeActions = document.querySelector('.store-actions');

    // Add pesan/chat button
    let pesanBtn = document.getElementById('storePesanBtn');
    if (!pesanBtn && storeActions) {
        pesanBtn = document.createElement('a');
        pesanBtn.id = 'storePesanBtn';
        pesanBtn.className = 'store-btn';
        pesanBtn.style.background = 'var(--primary)';
        pesanBtn.style.color = '#ffffff';
        pesanBtn.style.border = '1px solid var(--primary)';
        pesanBtn.textContent = 'Kirim Pesan';
        pesanBtn.href = `/pesan.html?chat=${encodeURIComponent(email)}`;
        storeActions.appendChild(pesanBtn);
    }

    if (store.show_buttons === false || store.show_buttons === 0) {
        if (chatBtn) chatBtn.style.display = 'none';
        if (pesanBtn) pesanBtn.style.display = 'none';
    } else {
        if (chatBtn) {
            chatBtn.style.display = 'inline-flex';
            if (phone) {
                const cleanPhone = phone.replace(/[^0-9]/g, '');
                let waPhone = cleanPhone;
                if (waPhone.startsWith('0')) {
                    waPhone = '62' + waPhone.slice(1);
                }
                chatBtn.href = `https://wa.me/${waPhone}?text=Halo%20${encodeURIComponent(store.store_name || 'Merchant')},%20saya%20tertarik%20dengan%20produk%20di%20EasyMall.`;
            } else {
                chatBtn.href = `mailto:${email}?subject=Tanya%20Produk%20EasyMall`;
                chatBtn.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M.05 3.555A2 2 0 0 1 2 2h12a2 2 0 0 1 1.95 1.555L8 8.414.05 3.555zM0 4.697v7.104l5.803-3.558L0 4.697zM6.761 8.83l-6.57 4.027A2 2 0 0 0 2 14h12a2 2 0 0 0 1.808-1.144l-6.57-4.027L8 9.586l-.239-.756zM13.239 8.83l-5.803-3.558V11.8L13.239 8.83z"/>
                    </svg>
                    Kirim Email
                `;
                chatBtn.className = 'store-btn';
                chatBtn.style.background = '#0269a1';
                chatBtn.style.borderColor = '#0269a1';
                chatBtn.style.color = '#ffffff';
            }
        }
        if (pesanBtn) pesanBtn.style.display = 'inline-flex';
    }

    // Render products grid
    const grid = document.getElementById('storeProductsGrid');
    if (products.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 4rem; color: var(--text-muted);">
                ✨ Toko ini belum menerbitkan produk rekomendasi apa pun saat ini.
            </div>
        `;
        return;
    }

    grid.innerHTML = '';
    products.forEach(p => {
        const originalPrice = Math.round(p.price * 1.15);
        const imageUrl = p.images && p.images[0] ? p.images[0] : '/gambar/logo/easymall-logo.png';
        const card = document.createElement('div');
        card.className = 'card product-card';
        card.style.cursor = 'pointer';

        card.innerHTML = `
            <div class="card-image-wrapper" style="height: 160px; width: 100%; overflow: hidden; position: relative;">
                <img src="${imageUrl}" alt="${p.product_name}" style="width: 100%; height: 100%; object-fit: cover; display: block;">
                <span class="badge badge-promo">Rekomendasi</span>
            </div>
            <div class="card-body" style="padding: 0.65rem 0.75rem;">
                <span class="product-category" style="font-size: 0.68rem; margin-bottom: 2px;">${p.category || 'digital'}</span>
                <h3 class="card-title" style="font-size: 0.85rem; margin-bottom: 4px; line-height: 1.2; height: 32px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">${p.product_name}</h3>
                <p class="card-desc" style="font-size: 0.75rem; margin-bottom: 8px; line-height: 1.3; height: 36px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">${p.description || ''}</p>
                <div class="product-rating" style="display: flex; align-items: center; gap: 4px; font-size: 0.7rem; margin-bottom: 8px;">
                    <span class="stars" style="color: #ff9f43; display: flex; align-items: center; gap: 2px;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M3.612 15.443c-.386.198-.824-.149-.746-.592l.83-4.73L.173 6.765c-.329-.314-.158-.888.283-.95l4.898-.696L7.538.792c.197-.39.73-.39.927 0l2.184 4.327 4.898.696c.441.062.612.636.282.95l-3.522 3.356.83 4.73c.078.443-.36.79-.746.592L8 13.187l-4.389 2.256z"/>
                        </svg>
                        5.0
                    </span>
                    <span class="sold-count" style="color: var(--text-muted); padding-left: 4px; border-left: 1px solid var(--border-color);">100+ terjual</span>
                </div>
                <div class="product-footer" style="padding-top: 6px;">
                    <div class="price-container">
                        <span class="price-label" style="font-size: 0.65rem;">Harga terbaik</span>
                        <div class="price-row" style="display: flex; align-items: center; flex-wrap: wrap; gap: 2px;">
                            <span class="price-value" style="font-size: 0.88rem; color: #e03131; font-weight: 700;">Rp${formatRupiah(p.price)}</span>
                            <span class="original-price" style="text-decoration: line-through; color: var(--text-muted); font-size: 0.68rem;">Rp${formatRupiah(originalPrice)}</span>
                        </div>
                    </div>
                    <button type="button" class="btn btn-buy" style="font-size: 0.7rem; padding: 0.25rem 0.5rem; border-radius: 4px;">Detail</button>
                </div>
            </div>
        `;

        card.onclick = () => {
            window.location.href = `/product/DB-${p.id}`;
        };
        grid.appendChild(card);
    });
}

window.copyStoreLink = function() {
    navigator.clipboard.writeText(window.location.href);
    const btnSpan = document.querySelector('.copy-link-btn span');
    if (btnSpan) {
        btnSpan.textContent = 'Link Disalin! ✓';
        setTimeout(() => {
            btnSpan.textContent = 'Salin Link Toko';
        }, 2000);
    }
};
