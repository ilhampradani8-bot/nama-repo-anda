// index.js - Unified Client-side SPA Logic for Catalog and Checkout
document.addEventListener('DOMContentLoaded', () => {
    console.log('EasyMarket SPA Catalog Initialized');
    initSPA();
});

let allProducts = [];
let allCategories = [];
let showAllProducts = false;
let selectedProduct = null;
let statusPollingInterval = null;

// Determine API base URL dynamically for static files, Live Server, and native Flask environment
let API_BASE_URL = '';
if (window.location.port !== '5002' && window.location.protocol !== 'file:') {
    API_BASE_URL = 'http://139.59.122.230:5002';
} else if (window.location.protocol === 'file:') {
    API_BASE_URL = 'http://139.59.122.230:5002';
}

// Load external HTML templates dynamically to keep files separated
async function loadTemplates() {
    // Load WhatsApp floating bubble
    try {
        const waBubbleContainer = document.createElement('div');
        waBubbleContainer.id = 'waBubbleContainer';
        document.body.appendChild(waBubbleContainer);
        const waRes = await fetch('/ecom/components/include/buble.html');
        if (waRes.ok) {
            waBubbleContainer.innerHTML = await waRes.text();
        }
    } catch (e) {
        console.error('Failed to load WhatsApp bubble:', e);
    }
}

// Initialize SPA application
async function initSPA() {
    try {
        // Load templates first so elements exist in DOM when needed
        await loadTemplates();

        const response = await fetch('/ecom/js/products.json');
        if (!response.ok) {
            throw new Error('Gagal memuat data produk');
        }
        const data = await response.json();
        allProducts = data.products || [];
        allCategories = data.categories || [];
        
        renderCategories();
        setupHeaderActions();
        setupFooterActions();

        // Trigger initial product rendering on page load
        const urlParams = new URLSearchParams(window.location.search);
        const searchParam = urlParams.get('search') || '';
        showAllProducts = false;
        renderProducts('all', searchParam);

        // Listen for SPA hash routing
        window.addEventListener('hashchange', handleRouting);
        handleRouting(); // Trigger on first load
        
    } catch (error) {
        console.error('SPA Initialization error:', error);
        const grid = document.getElementById('productsGrid');
        if (grid) {
            grid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: #ff4d4f;">
                    ❌ Gagal memuat katalog produk. Silakan coba segarkan halaman.
                </div>
            `;
        }
    }
}

// Router to handle Single Page App views
function handleRouting() {
    const hash = window.location.hash;
    
    // Handle scroll position based on hash
    if (hash === '#products') {
        const el = document.getElementById('products');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
    } else if (hash === '#services') {
        const el = document.getElementById('services');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
}

// Product view and catalog state controllers are located in productview.js

// Helper to format currency
function formatRupiah(num) {
    return new Intl.NumberFormat('id-ID').format(num);
}

// Recommendations and item layouts are rendered via productview.js

function getCategoryIcon(slug) {
    const icons = {
        'all': `<svg class="filter-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16" style="margin-right: 4px; display: inline-block; vertical-align: middle;"><path d="M0 1.5A1.5 1.5 0 0 1 1.5 0h13A1.5 1.5 0 0 1 16 1.5v13a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 0 14.5zM1.5 1a.5.5 0 0 0-.5.5v3h14v-3a.5.5 0 0 0-.5-.5zm14 4h-14v5h14zm0 6h-14v3.5a.5.5 0 0 0 .5.5h13a.5.5 0 0 0 .5-.5z"/></svg>`,
        'digital': `<svg class="filter-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16" style="margin-right: 4px; display: inline-block; vertical-align: middle;"><path d="M5 0a.5.5 0 0 1 .5.5V2h1V.5a.5.5 0 0 1 1 0V2h1V.5a.5.5 0 0 1 1 0V2h1V.5a.5.5 0 0 1 .5-.5h.5a1.5 1.5 0 0 1 1.5 1.5v.5h1.5a.5.5 0 0 1 0 1H14v1h1.5a.5.5 0 0 1 0 1H14v1h1.5a.5.5 0 0 1 0 1H14v1h1.5a.5.5 0 0 1 0 1H14v.5a1.5 1.5 0 0 1-1.5 1.5h-.5v1.5a.5.5 0 0 1-1 0V14h-1v1.5a.5.5 0 0 1-1 0V14h-1v1.5a.5.5 0 0 1-1 0V14h-.5a1.5 1.5 0 0 1-1.5-1.5V12H.5a.5.5 0 0 1 0-1H2v-1H.5a.5.5 0 0 1 0-1H2V8H.5a.5.5 0 0 1 0-1H2V6H.5a.5.5 0 0 1 0-1H2v-.5A1.5 1.5 0 0 1 3.5 3H4V.5a.5.5 0 0 1 .5-.5zm7 12a.5.5 0 0 0 .5-.5v-7a.5.5 0 0 0-.5-.5h-7a.5.5 0 0 0-.5.5v7a.5.5 0 0 0 .5.5z"/></svg>`,
        'game': `<svg class="filter-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16" style="margin-right: 4px; display: inline-block; vertical-align: middle;"><path d="M2.758 11.586l-.004-.004A1.5 1.5 0 0 1 2 10.514V5.486a1.5 1.5 0 0 1 .754-1.068l.004-.004c.244-.127.512-.2.785-.21l3.057-.102a.5.5 0 0 1-.033 1l-3.057.102a.5.5 0 0 0-.262.07L2.558 5.72a.5.5 0 0 0-.251.356v4.848a.5.5 0 0 0 .251.356l.756.446a.5.5 0 0 0 .262.07l3.057.102a.5.5 0 0 1-.033 1l-3.057-.102a1.5 1.5 0 0 1-.785-.21M13.242 4.414A1.5 1.5 0 0 1 14 5.486v5.028a1.5 1.5 0 0 1-.754 1.068l-.004.004a1.5 1.5 0 0 1-.785.21l-3.057.102a.5.5 0 0 1-.033-1l3.057-.102a.5.5 0 0 0 .262-.07l.756-.446a.5.5 0 0 0 .251-.356V6.076a.5.5 0 0 0-.251-.356l-.756-.446a.5.5 0 0 0-.262-.07l-3.057-.102a.5.5 0 0 1 .033-1l3.057.102a1.5 1.5 0 0 1 .785.21zM5 6a1 1 0 1 0 0 2 1 1 0 0 0 0-2m0 3a1 1 0 1 0 0 2 1 1 0 0 0 0-2m5-3a1 1 0 1 0 0 2 1 1 0 0 0 0-2m0 3a1 1 0 1 0 0 2 1 1 0 0 0 0-2"/></svg>`,
        'pulsa': `<svg class="filter-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16" style="margin-right: 4px; display: inline-block; vertical-align: middle;"><path d="M11 1a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1zM5 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2z"/><path d="M8 14a1 1 0 1 0 0-2 1 1 0 0 0 0 2"/></svg>`,
        'data': `<svg class="filter-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16" style="margin-right: 4px; display: inline-block; vertical-align: middle;"><path d="M15.384 6.115a.485.485 0 0 0-.047-.736A12.44 12.44 0 0 0 8 3 12.44 12.44 0 0 0 .663 5.379a.485.485 0 0 0-.048.736.518.518 0 0 0 .668.05A11.45 11.45 0 0 1 8 4c2.507 0 4.827.802 6.716 2.164a.52.52 0 0 0 .668-.049m-1.927 1.93a.48.48 0 0 0-.05-.72A8.97 8.97 0 0 0 8 5.5a8.97 8.97 0 0 0-5.407 1.825c-.2.155-.218.44-.05.72.166.276.518.33.722.188A7.97 7.97 0 0 1 8 6.5a7.97 7.97 0 0 1 4.735 1.543.52.52 0 0 0 .722-.188M10.925 9.94a.477.477 0 0 0-.053-.693A5.97 5.97 0 0 0 8 8c-1.396 0-2.673.477-3.69 1.272a.478.478 0 0 0-.052.693c.18.252.533.279.728.132A4.97 4.97 0 0 1 8 9c1.077 0 2.062.34 2.872.915a.48.48 0 0 0 .728-.131m-1.921 1.936a.475.475 0 0 0-.063-.64A2.99 2.99 0 0 0 8 10.5c-.716 0-1.378.251-1.902.67c-.201.161-.205.467-.063.64.148.18.423.213.63.076A1.99 1.99 0 0 1 8 11.5c.484 0 .927.172 1.274.462a.42.42 0 0 0 .63-.076M8 12a1 1 0 1 1 0 2 1 1 0 0 1 0-2"/></svg>`,
        'pln': `<svg class="filter-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16" style="margin-right: 4px; display: inline-block; vertical-align: middle;"><path d="M11.251.068a.5.5 0 0 1 .227.58L9.677 6.5H13a.5.5 0 0 1 .364.843l-8 8.5a.5.5 0 0 1-.842-.49L6.323 9.5H3a.5.5 0 0 1-.364-.843l8-8.5a.5.5 0 0 1 .615-.09zM4.157 8.5H7a.5.5 0 0 1 .478.647L6.11 13.59l5.733-6.09H9a.5.5 0 0 1-.478-.647L9.89 2.41z"/></svg>`,
        'ssl': `<svg class="filter-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16" style="margin-right: 4px; display: inline-block; vertical-align: middle;"><path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2m3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2M5 8h6a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1"/></svg>`
    };
    return icons[slug] || '';
}

// Render dynamic filter categories in homepage
function renderCategories() {
    const filterContainer = document.getElementById('categoryFilterContainer');
    if (!filterContainer) return;
    
    filterContainer.innerHTML = `<button type="button" class="filter-btn active" data-category="all">${getCategoryIcon('all')} Semua</button>`;
    
    allCategories.forEach(cat => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'filter-btn';
        btn.dataset.category = cat.slug;
        btn.innerHTML = `${getCategoryIcon(cat.slug)} ${cat.name}`;
        
        btn.addEventListener('click', () => {
            filterContainer.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const searchInput = document.getElementById('headerSearchInput');
            const searchVal = searchInput ? searchInput.value : '';
            showAllProducts = false;
            renderProducts(cat.slug, searchVal);
        });
        
        filterContainer.appendChild(btn);
    });
    
    const allBtn = filterContainer.querySelector('[data-category="all"]');
    if (allBtn) {
        allBtn.addEventListener('click', () => {
            filterContainer.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            allBtn.classList.add('active');
            const searchInput = document.getElementById('headerSearchInput');
            const searchVal = searchInput ? searchInput.value : '';
            showAllProducts = false;
            renderProducts('all', searchVal);
        });
    }
}

function getBadgeClass(badge) {
    const b = badge.toLowerCase();
    if (b.includes('promo')) return 'badge-promo';
    if (b.includes('terlaris') || b.includes('populer')) return 'badge-popular';
    if (b.includes('instan') || b.includes('24 jam')) return 'badge-instant';
    return 'badge-secure';
}

// Populate product grid list in homepage
function renderProducts(categorySlug = 'all', searchQuery = '') {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;
    
    let filtered = allProducts;
    if (categorySlug !== 'all') {
        filtered = filtered.filter(p => p.category_slug === categorySlug);
    }
    
    if (searchQuery) {
        const query = searchQuery.toLowerCase().trim();
        filtered = filtered.filter(p => 
            p.name.toLowerCase().includes(query) || 
            (p.description && p.description.toLowerCase().includes(query))
        );
    }
    
    if (filtered.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 4rem; color: var(--text-muted);">
                🔍 Tidak ada produk yang sesuai dengan filter/pencarian Anda.
            </div>
        `;
        const learnMoreContainer = document.getElementById('learnMoreContainer');
        if (learnMoreContainer) learnMoreContainer.style.display = 'none';
        return;
    }

    // Limit initial display to 3 rows (approx 12 products)
    const learnMoreContainer = document.getElementById('learnMoreContainer');
    const btnLearnMore = document.getElementById('btnLearnMore');
    const limit = 12;
    const needsLimit = filtered.length > limit;

    let displayProducts = filtered;
    if (needsLimit && !showAllProducts) {
        displayProducts = filtered.slice(0, limit);
        if (learnMoreContainer) {
            learnMoreContainer.style.display = 'block';
            if (btnLearnMore) {
                btnLearnMore.onclick = () => {
                    showAllProducts = true;
                    renderProducts(categorySlug, searchQuery);
                };
            }
        }
    } else {
        if (learnMoreContainer) {
            learnMoreContainer.style.display = 'none';
        }
    }
    
    grid.innerHTML = '';
    
    displayProducts.forEach(p => {
        const cat = allCategories.find(c => c.slug === p.category_slug);
        const iconEmoji = `<img src="gambar/logoeasyfast.png" alt="${p.name}" style="height: 70px; width: auto; object-fit: contain;">`;
        
        const originalPrice = Math.round(p.price * 1.15);
        
        const card = document.createElement('div');
        card.className = 'card product-card';
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
                    <button type="button" class="btn btn-buy" style="font-size: 0.7rem; padding: 0.25rem 0.5rem; border-radius: 4px;">Beli</button>
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
        
        grid.appendChild(card);
    });
}

// Bind header actions for static layout
function setupHeaderActions() {
    const searchInput = document.getElementById('headerSearchInput');
    const searchBtn = document.getElementById('headerSearchBtn');
    const loginBtn = document.getElementById('loginBtn');
    const cartBtn = document.getElementById('headerCartBtn');
    
    const logoLink = document.getElementById('headerLogoLink');
    const homeLink = document.getElementById('headerHomeLink');
    const productsLink = document.getElementById('headerProductsLink');
    const servicesLink = document.getElementById('headerServicesLink');

    if (cartBtn) {
        cartBtn.onclick = () => {
            alert('Keranjang Belanja Anda kosong.\nPlatform ini menggunakan sistem Instant Checkout (Beli Langsung) demi kenyamanan transaksi Anda.');
        };
    }

    const isHomePage = window.location.pathname === '/' || window.location.pathname.endsWith('/index.html') || window.location.pathname === '';

    if (logoLink) logoLink.onclick = (e) => {
        if (!isHomePage) {
            window.location.href = '/';
            return;
        }
        e.preventDefault();
        window.location.hash = '';
    };
    if (homeLink) homeLink.onclick = (e) => {
        if (!isHomePage) {
            window.location.href = '/';
            return;
        }
        e.preventDefault();
        window.location.hash = '';
    };
    if (productsLink) productsLink.onclick = (e) => {
        if (!isHomePage) {
            window.location.href = '/#products';
            return;
        }
        e.preventDefault();
        window.location.hash = '#products';
    };
    if (servicesLink) servicesLink.onclick = (e) => {
        if (!isHomePage) {
            window.location.href = '/#services';
            return;
        }
        e.preventDefault();
        window.location.hash = '#services';
    };

    if (searchInput) {
        const filterProductsSearch = () => {
            const query = searchInput.value.trim();
            if (!isHomePage || window.location.hash.startsWith('#/product/')) {
                // If not on homepage or in details view, navigate back with query param
                window.location.href = `/?search=${encodeURIComponent(query)}`;
            } else {
                const activeFilter = document.querySelector('.filter-btn.active');
                const category = activeFilter ? activeFilter.dataset.category : 'all';
                showAllProducts = false;
                renderProducts(category, query);
            }
        };
        
        searchInput.addEventListener('input', () => {
            if (isHomePage && !window.location.hash.startsWith('#/product/')) {
                filterProductsSearch();
            }
        });
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                filterProductsSearch();
            }
        });
        if (searchBtn) {
            searchBtn.onclick = filterProductsSearch;
        }
    }
    
    if (loginBtn) {
        const loginUrl = API_BASE_URL ? `${API_BASE_URL}/login` : '/login';
        const dashboardUrl = API_BASE_URL ? `${API_BASE_URL}/dashboard` : '/dashboard';

        loginBtn.onclick = () => { window.location.href = loginUrl; };
        
        // Dynamically detect auth status (handles gracefully if local/file:// or API offline)
        fetch(`${API_BASE_URL}/api/auth/status`)
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
                // Graceful fallback for standalone frontend hosting
                loginBtn.textContent = 'Login';
                loginBtn.onclick = () => { window.location.href = loginUrl; };
            });
    }

    // Read URL search parameter if any
    const urlParams = new URLSearchParams(window.location.search);
    const searchParam = urlParams.get('search') || '';
    if (searchParam && searchInput) {
        searchInput.value = searchParam;
    }
}

// Bind footer actions
function setupFooterActions() {
    const footerSearchInput = document.getElementById('footerSearchInput');
    const footerSearchBtn = document.getElementById('footerSearchBtn');
    
    if (footerSearchInput && footerSearchBtn) {
        const triggerFooterSearch = () => {
            const val = footerSearchInput.value.trim();
            const mainSearch = document.getElementById('headerSearchInput');
            if (mainSearch) {
                mainSearch.value = val;
            }
            window.location.hash = ''; // Back to catalog
            setTimeout(() => {
                renderProducts('all', val);
                const section = document.getElementById('products');
                if (section) section.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        };
        
        footerSearchBtn.onclick = triggerFooterSearch;
        footerSearchInput.onkeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                triggerFooterSearch();
            }
        };
    }
}

// Programmatic category selection from footer
window.footerFilterCategory = function(category) {
    window.location.hash = ''; // Back to catalog
    setTimeout(() => {
        const btn = document.querySelector(`.filter-btn[data-category="${category}"]`);
        if (btn) btn.click();
        const section = document.getElementById('products');
        if (section) section.scrollIntoView({ behavior: 'smooth' });
    }, 100);
};

// Footer categories and search actions are handled dynamically above
