// hasil_pencarian.js - Dedicated Client-side logic for search results page
document.addEventListener('DOMContentLoaded', () => {
    console.log('EasyMarket Search Results Initialized');
    initSearchResultsPage();
});

// Modern Cart Modal Helper
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

let allProducts = [];
let allCategories = [];

// Determine API base URL dynamically
let API_BASE_URL = '';
if (window.location.protocol === 'file:') {
    API_BASE_URL = 'https://api.ilhampradani.me';
}

function formatRupiah(num) {
    if (num === undefined || num === null) return '0';
    return parseInt(num).toLocaleString('id-ID');
}

function getBadgeClass(badge) {
    const b = badge.toLowerCase();
    if (b.includes('promo')) return 'badge-promo';
    if (b.includes('terlaris') || b.includes('populer')) return 'badge-popular';
    if (b.includes('instan') || b.includes('24 jam')) return 'badge-instant';
    return 'badge-secure';
}

async function initSearchResultsPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get('query') || '';
    
    const searchTitle = document.getElementById('searchTitle');
    const searchSub = document.getElementById('searchSub');
    const searchInput = document.getElementById('headerSearchInput');
    
    if (searchInput) {
        searchInput.value = query;
    }
    
    if (searchTitle) {
        searchTitle.textContent = `Hasil Pencarian: "${query}"`;
    }

    try {
        // Load data
        const res = await fetch(`${API_BASE_URL}/api/products`);
        if (!res.ok) throw new Error('Gagal mengambil data produk');
        const data = await res.json();
        
        allProducts = data.products || [];
        allCategories = data.categories || [];

        renderSearchResults(query);
    } catch (err) {
        console.error(err);
        const grid = document.getElementById('searchGrid');
        if (grid) {
            grid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: #e03131; font-weight: 600;">
                    Terjadi kesalahan saat memuat hasil pencarian.
                </div>
            `;
        }
    }
    
    setupHeaderActions();
}

function renderSearchResults(queryText) {
    const grid = document.getElementById('searchGrid');
    const searchSub = document.getElementById('searchSub');
    if (!grid) return;

    const query = queryText.toLowerCase().trim();
    if (!query) {
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 4rem; color: var(--text-muted);">
                Silakan ketikkan kata kunci di kolom pencarian.
            </div>
        `;
        if (searchSub) searchSub.textContent = 'Menunggu kata kunci...';
        return;
    }

    const filtered = allProducts.filter(p => 
        p.name.toLowerCase().includes(query) || 
        (p.description && p.description.toLowerCase().includes(query))
    );

    if (searchSub) {
        searchSub.textContent = `Menampilkan ${filtered.length} produk yang cocok dengan pencarian Anda.`;
    }

    if (filtered.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 4rem; color: var(--text-muted);">
                🔍 Tidak ada produk yang sesuai dengan "${queryText}".
            </div>
        `;
        return;
    }

    grid.innerHTML = '';
    filtered.forEach(p => {
        const cat = allCategories.find(c => c.slug === p.category_slug);
        const iconEmoji = `<img src="/gambar/logoeasyfast.png" alt="${p.name}" style="height: 70px; width: auto; object-fit: contain;">`;
        const originalPrice = Math.round(p.price * 1.15);
        
        const card = document.createElement('div');
        card.className = 'card product-card';
        card.style.cursor = 'pointer';
        card.innerHTML = `
            <div class="card-image-wrapper" style="height: 110px;">
                ${iconEmoji}
                ${p.badge ? `<span class="badge ${getBadgeClass(p.badge)}">${p.badge}</span>` : ''}
            </div>
            <div class="card-body" style="padding: 0.65rem 0.75rem;">
                <span class="product-category" style="font-size: 0.68rem; margin-bottom: 2px;">${cat ? cat.name : p.category_slug}</span>
                <h3 class="card-title" style="font-size: 0.85rem; margin-bottom: 4px; line-height: 1.2; height: 32px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">${p.name}</h3>
                <p class="card-desc" style="font-size: 0.75rem; margin-bottom: 8px; line-height: 1.3; height: 36px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">${p.description || ''}</p>
                <div class="product-rating" style="display: flex; align-items: center; gap: 4px; font-size: 0.7rem; margin-bottom: 8px;">
                    <span class="stars" style="color: #ff9f43; display: flex; align-items: center; gap: 2px;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M3.612 15.443c-.386.198-.824-.149-.746-.592l.83-4.73L.173 6.765c-.329-.314-.158-.888.283-.95l4.898-.696L7.538.792c.197-.39.73-.39.927 0l2.184 4.327 4.898.696c.441.062.612.636.282.95l-3.522 3.356.83 4.73c.078.443-.36.79-.746.592L8 13.187l-4.389 2.256z"/>
                        </svg>
                        4.9
                    </span>
                    <span class="sold-count" style="color: var(--text-muted); padding-left: 4px; border-left: 1px solid var(--border-color);">${p.sold_count || '100+'} terjual</span>
                </div>
                <div class="product-footer" style="padding-top: 6px;">
                    <div class="price-container">
                        <span class="price-label" style="font-size: 0.65rem;">Harga terbaik</span>
                        <div class="price-row" style="display: flex; align-items: center; flex-wrap: wrap; gap: 2px;">
                            <span class="price-value" style="font-size: 0.88rem; color: #e03131; font-weight: 700;">Rp${formatRupiah(p.price)}</span>
                            <span class="original-price" style="text-decoration: line-through; color: var(--text-muted); font-size: 0.68rem;">Rp${formatRupiah(originalPrice)}</span>
                        </div>
                    </div>
                    <div style="display: flex; gap: 4px; align-items: center;">
                        <button type="button" class="btn btn-buy" style="font-size: 0.7rem; padding: 0.25rem 0.5rem; border-radius: 4px;">Beli</button>
                        <button type="button" class="btn btn-cart-card" style="font-size: 0.7rem; padding: 0.25rem 0.5rem; border-radius: 4px; background: #e9ecef; color: #495057; border: 1px solid #ced4da; display: inline-flex; align-items: center; justify-content: center;" aria-label="Keranjang">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 16 16">
                                <path d="M0 1.5A.5.5 0 0 1 .5 1H2a.5.5 0 0 1 .485.379L2.89 3H14.5a.5.5 0 0 1 .491.592l-1.5 8A.5.5 0 0 1 13 12H4a.5.5 0 0 1-.491-.408L2.01 3.607 1.61 2H.5a.5.5 0 0 1-.5-.5zM3.102 4l1.313 7h8.17l1.313-7H3.102zM5 12a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm7 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-7 1a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm7 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        `;

        card.onclick = (e) => {
            if (e.target.tagName !== 'BUTTON') {
                window.location.href = `/product/${p.code}`;
            }
        };

        const buyBtn = card.querySelector('.btn-buy');
        buyBtn.onclick = (e) => {
            e.stopPropagation();
            window.location.href = `/product/${p.code}`;
        };

        const cartBtn = card.querySelector('.btn-cart-card');
        cartBtn.onclick = (e) => {
            e.stopPropagation();
            window.showModernCartModal(async () => {
                const baseVariant = p.variants && p.variants[0] ? p.variants[0] : null;
                const variantCode = baseVariant ? baseVariant.code : p.code;
                const variantName = baseVariant ? baseVariant.name : p.name;
                const price = baseVariant ? baseVariant.price : p.price;

                try {
                    const authRes = await fetch(`${API_BASE_URL}/api/auth/status`, { credentials: 'include' });
                    const authData = await authRes.json();
                    if (!authData.logged_in) {
                        alert("Silakan login/masuk terlebih dahulu untuk menggunakan fitur keranjang!");
                        window.location.href = '/login.html';
                        return;
                    }

                    const payload = {
                        product_code: p.code,
                        product_name: p.name,
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

        grid.appendChild(card);
    });
}

function setupHeaderActions() {
    const loginBtn = document.getElementById('loginBtn');
    const cartBtn = document.getElementById('headerCartBtn');
    const logoLink = document.getElementById('headerLogoLink');
    const homeLink = document.getElementById('headerHomeLink');
    const productsLink = document.getElementById('headerProductsLink');

    if (cartBtn) {
        cartBtn.onclick = () => {
            window.location.href = '/dashboard_keranjang.html';
        };
    }

    if (logoLink) logoLink.onclick = () => { window.location.href = '/'; };
    if (homeLink) homeLink.onclick = () => { window.location.href = '/'; };
    if (productsLink) productsLink.onclick = () => { window.location.href = '/#products'; };

    if (loginBtn) {
        const loginUrl = '/login.html';
        loginBtn.onclick = () => { window.location.href = loginUrl; };
        
        fetch(`${API_BASE_URL}/api/auth/status`)
            .then(res => res.json())
            .then(data => {
                if (data.logged_in) {
                    loginBtn.textContent = 'Dashboard';
                    loginBtn.onclick = () => {
                        window.location.href = `${API_BASE_URL}/dashboard.html`;
                    };
                }
            })
            .catch(err => console.error(err));
    }
}
