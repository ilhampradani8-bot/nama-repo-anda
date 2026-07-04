// about.js - Logic for About page
document.addEventListener('DOMContentLoaded', () => {
    console.log('About Page Initialized');
    
    let API_BASE_URL = '';
    if (window.location.port !== '5002' && window.location.protocol !== 'file:') {
        API_BASE_URL = 'https://api.ilhampradani.me';
    } else if (window.location.protocol === 'file:') {
        API_BASE_URL = 'https://api.ilhampradani.me';
    }

    const searchInput = document.getElementById('headerSearchInput');
    const searchBtn = document.getElementById('headerSearchBtn');
    const loginBtn = document.getElementById('loginBtn');
    const cartBtn = document.getElementById('headerCartBtn');
    const logoLink = document.getElementById('headerLogoLink');
    const homeLink = document.getElementById('headerHomeLink');
    const productsLink = document.getElementById('headerProductsLink');
    
    if (cartBtn) {
        cartBtn.onclick = () => {
            alert('Keranjang Belanja Anda kosong.\nPlatform ini menggunakan sistem Instant Checkout (Beli Langsung) demi kenyamanan transaksi Anda.');
        };
    }

    if (logoLink) logoLink.onclick = () => { window.location.href = '/'; };
    if (homeLink) homeLink.onclick = () => { window.location.href = '/'; };
    if (productsLink) productsLink.onclick = () => { window.location.href = '/#products'; };

    if (searchInput) {
        const handleSearch = () => {
            const query = searchInput.value.trim();
            window.location.href = `/?search=${encodeURIComponent(query)}`;
        };
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleSearch();
            }
        });
        if (searchBtn) searchBtn.onclick = handleSearch;
    }

    if (loginBtn) {
        const loginUrl = '/login.html';
        const dashboardUrl = '/dashboard.html';

        loginBtn.onclick = () => { window.location.href = loginUrl; };
        
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
                loginBtn.textContent = 'Login';
                loginBtn.onclick = () => { window.location.href = loginUrl; };
            });
    }

    const footerSearchInput = document.getElementById('footerSearchInput');
    const footerSearchBtn = document.getElementById('footerSearchBtn');
    if (footerSearchInput && footerSearchBtn) {
        const handleFooterSearch = () => {
            const query = footerSearchInput.value.trim();
            window.location.href = `/?search=${encodeURIComponent(query)}`;
        };
        footerSearchBtn.onclick = handleFooterSearch;
        footerSearchInput.onkeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleFooterSearch();
            }
        };
    }
});

window.footerFilterCategory = function(category) {
    window.location.href = '/';
};
