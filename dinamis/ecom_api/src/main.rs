// ecom_api/src/main.rs
use axum::{
    extract::{Path, Query, State},
    http::{header, HeaderMap, HeaderValue, Method, StatusCode},
    response::{IntoResponse, Redirect},
    routing::{get, post, delete},
    Json, Router,
};
use tower_http::services::ServeDir;
use axum_extra::extract::cookie::{Cookie, CookieJar};
use rand::{distributions::Alphanumeric, Rng};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use time::Duration;
use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
};
use tower_http::cors::{AllowOrigin, CorsLayer};
use url::Url;
use urlencoding::encode;
use sha2::{Sha256, Digest};

#[derive(Clone)]
struct AppState {
    sessions: Arc<Mutex<HashMap<String, SessionData>>>,
    transactions_db_path: String,
    bot_memory_db_path: String,
    http_client: reqwest::Client,
    google_client_id: String,
    discord_client_id: String,
    discord_client_secret: String,
}

#[derive(Clone, Serialize, Deserialize)]
struct SessionData {
    email: String,
    name: String,
}

#[derive(Serialize)]
struct AuthStatus {
    logged_in: bool,
    email: String,
    name: String,
}

#[derive(Deserialize)]
struct LoginPayload {
    username: Option<String>,
    password: Option<String>,
}

#[derive(Deserialize)]
struct GoogleLoginPayload {
    credential: Option<String>,
}

#[derive(Deserialize)]
struct DiscordCallbackQuery {
    code: Option<String>,
}

#[derive(Serialize)]
struct DashboardData {
    success: bool,
    total_orders: i64,
    total_sales: i64,
    total_profit: i64,
    transactions: Vec<Transaction>,
    profits: Vec<Profit>,
    resellers: Vec<Reseller>,
}

#[derive(Serialize)]
struct Transaction {
    transaction_id: String,
    whatsapp_id: Option<String>,
    product_name: Option<String>,
    variant_name: Option<String>,
    amount: i64,
    created_at: String,
}

#[derive(Serialize)]
struct Profit {
    transaction_id: String,
    reseller_wa: Option<String>,
    profit_amount: i64,
    created_at: String,
}

#[derive(Serialize)]
struct Reseller {
    activation_code: Option<String>,
    whatsapp_id: Option<String>,
    store_name: Option<String>,
    markup: i64,
    is_active: i64,
    created_at: Option<String>,
}

#[derive(Deserialize)]
struct CheckoutPayload {
    provider: String,
    product_code: Option<String>,
    variant_code: String,
    product_name: Option<String>,
    variant_name: Option<String>,
    target: String,
    amount: i64,
    whatsapp_id: Option<String>,
}

#[derive(Serialize)]
struct CheckoutResponse {
    success: bool,
    transaction_id: String,
    qr_image_url: String,
    amount: i64,
    provider: String,
}

#[derive(Serialize)]
struct StatusResponse {
    success: bool,
    status: String,
    message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    sn: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    link: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    stock_data: Option<String>,
    amount: i64,
}

fn init_db(db_path: &str) {
    let conn = Connection::open(db_path).expect("Failed to open ecommerce database");
    conn.execute(
        "CREATE TABLE IF NOT EXISTS admins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            email TEXT,
            role TEXT DEFAULT 'admin',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )
    .expect("Failed to create admins table");

    let admin_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM admins WHERE username = 'admin'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    if admin_count == 0 {
        conn.execute(
            "INSERT INTO admins (username, password, email, role) VALUES ('admin', 'admin123', 'admin@easymarket.com', 'admin')",
            [],
        )
        .expect("Failed to insert default admin");
    }

    let demo_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM admins WHERE username = 'demo'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    if demo_count == 0 {
        conn.execute(
            "INSERT INTO admins (username, password, email, role) VALUES ('demo', 'demo', 'demo@easymarket.com', 'admin')",
            [],
        )
        .expect("Failed to insert demo admin");
    }

    conn.execute(
        "CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            name TEXT,
            avatar TEXT,
            provider TEXT,
            provider_id TEXT,
            role TEXT DEFAULT 'user',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )
    .expect("Failed to create users table");

    conn.execute(
        "CREATE TABLE IF NOT EXISTS resellers (
            activation_code TEXT PRIMARY KEY,
            whatsapp_id TEXT NOT NULL,
            store_name TEXT NOT NULL,
            markup INTEGER DEFAULT 0,
            is_active INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )
    .expect("Failed to create resellers table");

    conn.execute(
        "CREATE TABLE IF NOT EXISTS reseller_api_keys (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            reseller_email TEXT NOT NULL,
            api_key_hash TEXT UNIQUE NOT NULL,
            key_preview TEXT NOT NULL,
            label TEXT NOT NULL,
            is_active INTEGER DEFAULT 1,
            expires_at TIMESTAMP NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )
    .expect("Failed to create reseller_api_keys table");

    conn.execute(
        "CREATE TABLE IF NOT EXISTS sessions (
            session_id TEXT PRIMARY KEY,
            email TEXT NOT NULL,
            name TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )
    .expect("Failed to create sessions table");

    let reseller_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM resellers", [], |row| row.get(0))
        .unwrap_or(0);

    if reseller_count == 0 {
        let demo_resellers = vec![
            ("ACT-1001", "6281234567890", "Easy Fast Cell", 1000, 1),
            ("ACT-1002", "6289876543210", "Bintang Pulsa", 500, 1),
            ("ACT-1003", "6285555555555", "Pojok Voucher", 0, 0),
        ];
        for (code, wa, store, markup, active) in demo_resellers {
            let _ = conn.execute(
                "INSERT INTO resellers (activation_code, whatsapp_id, store_name, markup, is_active) VALUES (?, ?, ?, ?, ?)",
                params![code, wa, store, markup, active],
            );
        }
    }

    conn.execute(
        "CREATE TABLE IF NOT EXISTS keranjang (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL,
            product_code TEXT NOT NULL,
            product_name TEXT NOT NULL,
            variant_code TEXT,
            variant_name TEXT,
            price INTEGER NOT NULL,
            quantity INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )
    .expect("Failed to create keranjang table");
}

fn get_redirect_target(headers: &HeaderMap, _default_url: &str) -> String {
    // Determine the correct frontend origin from the Referer header.
    // The API lives on api.ilhampradani.me (port 5002), but the frontend lives
    // on ilhampradani.me. We must always redirect back to the FRONTEND domain.
    if let Some(referer) = headers.get(header::REFERER) {
        if let Ok(referer_str) = referer.to_str() {
            if let Ok(parsed_url) = Url::parse(referer_str) {
                if let Some(host) = parsed_url.host_str() {
                    // Localhost dev — redirect back to the same host (dev server)
                    if host.contains("localhost") || host.contains("127.0.0.1") {
                        return format!(
                            "{}://{}/dashboard",
                            parsed_url.scheme(),
                            parsed_url.authority()
                        );
                    }
                    // Vercel preview deployments
                    if host.contains("vercel.app") {
                        return format!(
                            "{}://{}/dashboard",
                            parsed_url.scheme(),
                            parsed_url.authority()
                        );
                    }
                    // Production: always redirect to the main frontend domain,
                    // NOT the api subdomain the form was submitted to.
                    if host.contains("easymall.ilhampradani.me") || host.contains("ilhampradani.me") || host.contains("mijdigital.my") {
                        return "https://easymall.ilhampradani.me/dashboard".to_string();
                    }
                }
            }
        }
    }
    // Absolute fallback: production frontend
    "https://easymall.ilhampradani.me/dashboard".to_string()
}

fn verify_session(state: &AppState, sid: &str) -> Option<SessionData> {
    // 1. Check in memory
    {
        let sessions = state.sessions.lock().unwrap();
        if let Some(sess) = sessions.get(sid) {
            return Some(sess.clone());
        }
    }
    // 2. Check DB
    if let Ok(conn) = Connection::open(&state.transactions_db_path) {
        let db_query = conn.query_row(
            "SELECT email, name FROM sessions WHERE session_id = ?",
            params![sid],
            |row| Ok(SessionData {
                email: row.get(0)?,
                name: row.get(1)?,
            }),
        );
        if let Ok(sess) = db_query {
            // sync back to memory cache
            state.sessions.lock().unwrap().insert(sid.to_string(), sess.clone());
            return Some(sess);
        }
    }
    None
}

fn insert_session(state: &AppState, session_id: String, email: String, name: String) {
    // 1. Insert in memory
    state.sessions.lock().unwrap().insert(
        session_id.clone(),
        SessionData {
            email: email.clone(),
            name: name.clone(),
        },
    );
    // 2. Insert in SQLite DB
    if let Ok(conn) = Connection::open(&state.transactions_db_path) {
        let _ = conn.execute(
            "INSERT OR REPLACE INTO sessions (session_id, email, name) VALUES (?, ?, ?)",
            params![session_id, email, name],
        );
    }
}

fn remove_session(state: &AppState, session_id: &str) {
    // 1. Remove from memory
    state.sessions.lock().unwrap().remove(session_id);
    // 2. Remove from DB
    if let Ok(conn) = Connection::open(&state.transactions_db_path) {
        let _ = conn.execute("DELETE FROM sessions WHERE session_id = ?", params![session_id]);
    }
}

// Handler: Check auth status
async fn auth_status(
    jar: CookieJar,
    State(state): State<AppState>,
) -> impl IntoResponse {
    let session_id = jar.get("session_id").map(|c| c.value().to_string());
    if let Some(sid) = session_id {
        if let Some(sess) = verify_session(&state, &sid) {
            return Json(AuthStatus {
                logged_in: true,
                email: sess.email,
                name: sess.name,
            });
        }
    }
    Json(AuthStatus {
        logged_in: false,
        email: "".to_string(),
        name: "".to_string(),
    })
}

// Handler: Classic Login (Form & JSON support)
async fn login_admin(
    jar: CookieJar,
    State(state): State<AppState>,
    headers: HeaderMap,
    body_str: String,
) -> impl IntoResponse {
    let content_type = headers
        .get(header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    let (username, password) = if content_type.contains("application/json") {
        if let Ok(payload) = serde_json::from_str::<LoginPayload>(&body_str) {
            (payload.username.unwrap_or_default(), payload.password.unwrap_or_default())
        } else {
            ("".to_string(), "".to_string())
        }
    } else {
        if let Ok(payload) = serde_urlencoded::from_str::<LoginPayload>(&body_str) {
            (payload.username.unwrap_or_default(), payload.password.unwrap_or_default())
        } else {
            ("".to_string(), "".to_string())
        }
    };

    let conn = match Connection::open(&state.transactions_db_path) {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Database Connection Error").into_response(),
    };

    let admin_query = conn.query_row(
        "SELECT email FROM admins WHERE username = ? AND password = ?",
        params![username, password],
        |row| row.get::<_, String>(0),
    );

    match admin_query {
        Ok(email) => {
            let session_id: String = rand::thread_rng()
                .sample_iter(&Alphanumeric)
                .take(32)
                .map(char::from)
                .collect();

            insert_session(&state, session_id.clone(), email.clone(), username.clone());

            let redirect_target = get_redirect_target(&headers, "https://easymall.ilhampradani.me/dashboard");
            let cookie = Cookie::build(("session_id", session_id))
                .path("/")
                .max_age(Duration::days(30))
                .same_site(axum_extra::extract::cookie::SameSite::Lax)
                .http_only(true)
                .build();

            (jar.add(cookie), Redirect::to(&redirect_target)).into_response()
        }
        Err(_) => (StatusCode::UNAUTHORIZED, "Login gagal. Periksa username dan password.").into_response(),
    }
}

// Handler: Google OAuth Login (Form & JSON support)
#[derive(Deserialize)]
struct GoogleTokenInfo {
    email: Option<String>,
    name: Option<String>,
    picture: Option<String>,
    sub: Option<String>,
    aud: Option<String>,
}

async fn login_google_route(
    jar: CookieJar,
    State(state): State<AppState>,
    headers: HeaderMap,
    body_str: String,
) -> impl IntoResponse {
    let content_type = headers
        .get(header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    let token = if content_type.contains("application/json") {
        serde_json::from_str::<GoogleLoginPayload>(&body_str)
            .ok()
            .and_then(|p| p.credential)
    } else {
        serde_urlencoded::from_str::<GoogleLoginPayload>(&body_str)
            .ok()
            .and_then(|p| p.credential)
    };

    let token = match token {
        Some(t) => t,
        None => return (StatusCode::BAD_REQUEST, "Token Google tidak valid.").into_response(),
    };

    let url = format!("https://oauth2.googleapis.com/tokeninfo?id_token={}", token);
    let res = match state.http_client.get(&url).send().await {
        Ok(r) => r,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Gagal verifikasi token Google.").into_response(),
    };

    if res.status() != reqwest::StatusCode::OK {
        return (StatusCode::BAD_REQUEST, "Google token verification failed.").into_response();
    }

    let info: GoogleTokenInfo = match res.json().await {
        Ok(i) => i,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Gagal mengurai respon Google.").into_response(),
    };

    if info.aud.as_deref() != Some(&state.google_client_id) {
        return (StatusCode::BAD_REQUEST, "Client ID tidak cocok.").into_response();
    }

    let email = info.email.unwrap_or_default();
    let name = info.name.unwrap_or_default();
    let avatar = info.picture.unwrap_or_default();
    let provider_id = info.sub.unwrap_or_default();

    let conn = match Connection::open(&state.transactions_db_path) {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Database Connection Error").into_response(),
    };

    // Check or insert user
    let user_exists: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM users WHERE email = ?",
            params![email],
            |row| row.get(0),
        )
        .unwrap_or(0);

    if user_exists > 0 {
        let _ = conn.execute(
            "UPDATE users SET name = ?, avatar = ?, provider = ?, provider_id = ? WHERE email = ?",
            params![name, avatar, "google", provider_id, email],
        );
    } else {
        let _ = conn.execute(
            "INSERT INTO users (email, name, avatar, provider, provider_id, role) VALUES (?, ?, ?, ?, ?, ?)",
            params![email, name, avatar, "google", provider_id, "user"],
        );
    }

    let session_id: String = rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(32)
        .map(char::from)
        .collect();

    insert_session(&state, session_id.clone(), email.clone(), name.clone());

    let redirect_target = get_redirect_target(&headers, "https://easymall.ilhampradani.me/dashboard");
    let cookie = Cookie::build(("session_id", session_id))
        .path("/")
        .max_age(Duration::days(30))
        .same_site(axum_extra::extract::cookie::SameSite::Lax)
        .http_only(true)
        .build();

    (jar.add(cookie), Redirect::to(&redirect_target)).into_response()
}

// Handler: Discord Redirect
async fn login_discord_route(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let client_secret = &state.discord_client_secret;

    // Graceful fallback for mock login
    if client_secret == "GANTI_DENGAN_CLIENT_SECRET_DISCORD_ANDA" || client_secret.is_empty() {
        let session_id: String = rand::thread_rng()
            .sample_iter(&Alphanumeric)
            .take(32)
            .map(char::from)
            .collect();

        insert_session(&state, session_id.clone(), "discord_demo_user@discord.com".to_string(), "Discord Demo".to_string());

        let redirect_target = get_redirect_target(&headers, "/dashboard.html");
        let cookie = Cookie::build(("session_id", session_id))
            .path("/")
            .max_age(Duration::days(30))
            .same_site(axum_extra::extract::cookie::SameSite::Lax)
            .http_only(true)
            .build();

        return (CookieJar::new().add(cookie), Redirect::to(&redirect_target)).into_response();
    }

    let host = headers
        .get(header::HOST)
        .and_then(|h| h.to_str().ok())
        .unwrap_or("139.59.122.230:5002");

    let redirect_uri = format!("http://{}/login/discord/callback", host);
    let encoded_redirect = encode(&redirect_uri);
    let discord_auth_url = format!(
        "https://discord.com/api/oauth2/authorize?client_id={}&redirect_uri={}&response_type=code&scope=identify+email",
        state.discord_client_id, encoded_redirect
    );

    Redirect::to(&discord_auth_url).into_response()
}

// Handler: Discord Callback
#[derive(Deserialize)]
struct DiscordTokenResponse {
    access_token: String,
}

#[derive(Deserialize)]
struct DiscordUserResponse {
    id: String,
    username: String,
    email: Option<String>,
    avatar: Option<String>,
}

async fn login_discord_callback_route(
    jar: CookieJar,
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<DiscordCallbackQuery>,
) -> impl IntoResponse {
    let code = match query.code {
        Some(c) => c,
        None => return (StatusCode::BAD_REQUEST, "Otorisasi Discord dibatalkan.").into_response(),
    };

    let host = headers
        .get(header::HOST)
        .and_then(|h| h.to_str().ok())
        .unwrap_or("139.59.122.230:5002");

    let redirect_uri = format!("http://{}/login/discord/callback", host);

    let client_id_str = state.discord_client_id.clone();
    let client_secret_str = state.discord_client_secret.clone();
    let grant_type_str = "authorization_code".to_string();

    let mut params = HashMap::new();
    params.insert("client_id", &client_id_str);
    params.insert("client_secret", &client_secret_str);
    params.insert("grant_type", &grant_type_str);
    params.insert("code", &code);
    params.insert("redirect_uri", &redirect_uri);

    let token_res = match state
        .http_client
        .post("https://discord.com/api/oauth2/token")
        .form(&params)
        .send()
        .await
    {
        Ok(r) => r,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Gagal bertukar token Discord.").into_response(),
    };

    if token_res.status() != reqwest::StatusCode::OK {
        return (StatusCode::BAD_REQUEST, "Discord token exchange failed.").into_response();
    }

    let token_data: DiscordTokenResponse = match token_res.json().await {
        Ok(t) => t,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Gagal mengurai token Discord.").into_response(),
    };

    let user_res = match state
        .http_client
        .get("https://discord.com/api/users/@me")
        .bearer_auth(token_data.access_token)
        .send()
        .await
    {
        Ok(r) => r,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Gagal mengambil data user dari Discord.").into_response(),
    };

    if user_res.status() != reqwest::StatusCode::OK {
        return (StatusCode::BAD_REQUEST, "Gagal mengambil data pengguna dari Discord.").into_response();
    }

    let user_info: DiscordUserResponse = match user_res.json().await {
        Ok(u) => u,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Gagal mengurai user info Discord.").into_response(),
    };

    let email = user_info.email.unwrap_or_else(|| format!("{}@discord.com", user_info.username));
    let name = user_info.username;
    let provider_id = user_info.id;
    let avatar_hash = user_info.avatar.unwrap_or_default();
    let avatar = if !avatar_hash.is_empty() {
        format!("https://cdn.discordapp.com/avatars/{}/{}.png", provider_id, avatar_hash)
    } else {
        "".to_string()
    };

    let conn = match Connection::open(&state.transactions_db_path) {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Database Connection Error").into_response(),
    };

    // Check or insert user
    let user_exists: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM users WHERE email = ?",
            params![email],
            |row| row.get(0),
        )
        .unwrap_or(0);

    if user_exists > 0 {
        let _ = conn.execute(
            "UPDATE users SET name = ?, avatar = ?, provider = ?, provider_id = ? WHERE email = ?",
            params![name, avatar, "discord", provider_id, email],
        );
    } else {
        let _ = conn.execute(
            "INSERT INTO users (email, name, avatar, provider, provider_id, role) VALUES (?, ?, ?, ?, ?, ?)",
            params![email, name, avatar, "discord", provider_id, "user"],
        );
    }

    let session_id: String = rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(32)
        .map(char::from)
        .collect();

    insert_session(&state, session_id.clone(), email.clone(), name.clone());

    let redirect_target = get_redirect_target(&headers, "/dashboard.html");
    let cookie = Cookie::build(("session_id", session_id))
        .path("/")
        .max_age(Duration::days(30))
        .same_site(axum_extra::extract::cookie::SameSite::Lax)
        .http_only(true)
        .build();

    (jar.add(cookie), Redirect::to(&redirect_target)).into_response()
}

// Handler: Logout
async fn logout_route(
    jar: CookieJar,
    State(state): State<AppState>,
) -> impl IntoResponse {
    let session_id = jar.get("session_id").map(|c| c.value().to_string());
    if let Some(sid) = session_id {
        remove_session(&state, &sid);
    }
    let cookie = Cookie::build(("session_id", ""))
        .path("/")
        .max_age(Duration::seconds(0))
        .build();

    (jar.add(cookie), Redirect::to("/login.html"))
}

// Handler: Dashboard Data API
async fn dashboard_data_route(
    jar: CookieJar,
    State(state): State<AppState>,
) -> impl IntoResponse {
    let session_id = jar.get("session_id").map(|c| c.value().to_string());
    let authorized = if let Some(sid) = session_id {
        verify_session(&state, &sid).is_some()
    } else {
        false
    };

    if !authorized {
        return (
            StatusCode::UNAUTHORIZED,
            Json(DashboardData {
                success: false,
                total_orders: 0,
                total_sales: 0,
                total_profit: 0,
                transactions: vec![],
                profits: vec![],
                resellers: vec![],
            }),
        )
            .into_response();
    }

    let conn_tx = match Connection::open(&state.transactions_db_path) {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Database Connection Error").into_response(),
    };

    let mut transactions = vec![];
    let mut profits = vec![];

    if let Ok(mut stmt) = conn_tx.prepare("SELECT transaction_id, whatsapp_id, product_name, variant_name, amount, created_at FROM transactions ORDER BY created_at DESC") {
        if let Ok(rows) = stmt.query_map([], |row| {
            Ok(Transaction {
                transaction_id: row.get(0)?,
                whatsapp_id: row.get(1)?,
                product_name: row.get(2)?,
                variant_name: row.get(3)?,
                amount: row.get(4)?,
                created_at: row.get(5)?,
            })
        }) {
            for r in rows.flatten() {
                transactions.push(r);
            }
        }
    }

    let total_orders = transactions.len() as i64;
    let total_sales = conn_tx
        .query_row("SELECT SUM(amount) FROM transactions", [], |row| {
            row.get::<_, Option<i64>>(0)
        })
        .unwrap_or(None)
        .unwrap_or(0);

    let total_profit = conn_tx
        .query_row("SELECT SUM(profit_amount) FROM reseller_profits", [], |row| {
            row.get::<_, Option<i64>>(0)
        })
        .unwrap_or(None)
        .unwrap_or(0);

    if let Ok(mut stmt) = conn_tx.prepare("SELECT transaction_id, reseller_wa, profit_amount, created_at FROM reseller_profits ORDER BY created_at DESC") {
        if let Ok(rows) = stmt.query_map([], |row| {
            Ok(Profit {
                transaction_id: row.get(0)?,
                reseller_wa: row.get(1)?,
                profit_amount: row.get(2)?,
                created_at: row.get(3)?,
            })
        }) {
            for r in rows.flatten() {
                profits.push(r);
            }
        }
    }

    let mut resellers = vec![];
    if let Ok(mut stmt) = conn_tx.prepare("SELECT activation_code, whatsapp_id, store_name, markup, is_active, created_at FROM resellers ORDER BY created_at DESC") {
        if let Ok(rows) = stmt.query_map([], |row| {
            Ok(Reseller {
                activation_code: row.get(0)?,
                whatsapp_id: row.get(1)?,
                store_name: row.get(2)?,
                markup: row.get(3)?,
                is_active: row.get(4)?,
                created_at: row.get(5)?,
            })
        }) {
            for r in rows.flatten() {
                resellers.push(r);
            }
        }
    }

    Json(DashboardData {
        success: true,
        total_orders,
        total_sales,
        total_profit,
        transactions,
        profits,
        resellers,
    })
    .into_response()
}

// Reseller API Key structs & handlers
#[derive(Serialize, Deserialize, Clone)]
struct ResellerApiKey {
    id: i64,
    reseller_email: String,
    key_preview: String,
    label: String,
    is_active: i32,
    expires_at: String,
    created_at: String,
}

#[derive(Deserialize)]
struct GenerateKeyRequest {
    label: String,
    duration_days: i32,
}

#[derive(Serialize)]
struct GenerateKeyResponse {
    success: bool,
    raw_key: String,
    expires_at: String,
}

#[derive(Deserialize)]
struct ToggleKeyRequest {
    id: i64,
    is_active: i32,
}

// Handler: GET /api/reseller/api-keys
async fn get_api_keys_route(
    jar: CookieJar,
    State(state): State<AppState>,
) -> impl IntoResponse {
    let session_id = jar.get("session_id").map(|c| c.value().to_string());
    let sess = if let Some(sid) = session_id {
        verify_session(&state, &sid)
    } else {
        None
    };

    if sess.is_none() {
        return (StatusCode::UNAUTHORIZED, "Unauthorized").into_response();
    }
    let user_sess = sess.unwrap();

    let conn = match Connection::open(&state.transactions_db_path) {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Database connection error").into_response(),
    };

    let mut keys = vec![];
    let mut stmt = match conn.prepare("SELECT id, reseller_email, key_preview, label, is_active, expires_at, created_at FROM reseller_api_keys WHERE reseller_email = ? ORDER BY created_at DESC") {
        Ok(s) => s,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Database error").into_response(),
    };

    let rows = stmt.query_map(params![user_sess.email], |row| {
        Ok(ResellerApiKey {
            id: row.get(0)?,
            reseller_email: row.get(1)?,
            key_preview: row.get(2)?,
            label: row.get(3)?,
            is_active: row.get(4)?,
            expires_at: row.get(5)?,
            created_at: row.get(6)?,
        })
    });

    if let Ok(r_rows) = rows {
        for r in r_rows.flatten() {
            keys.push(r);
        }
    }

    Json(keys).into_response()
}

// Handler: POST /api/reseller/api-keys/generate
async fn generate_api_key_route(
    jar: CookieJar,
    State(state): State<AppState>,
    Json(payload): Json<GenerateKeyRequest>,
) -> impl IntoResponse {
    let session_id = jar.get("session_id").map(|c| c.value().to_string());
    let sess = if let Some(sid) = session_id {
        verify_session(&state, &sid)
    } else {
        None
    };

    if sess.is_none() {
        return (StatusCode::UNAUTHORIZED, "Unauthorized").into_response();
    }
    let user_sess = sess.unwrap();

    let conn = match Connection::open(&state.transactions_db_path) {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Database connection error").into_response(),
    };

    // Generate random secure token
    let random_str: String = rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(32)
        .map(char::from)
        .collect();
    let raw_key = format!("em_live_{}", random_str);

    // Hash the token using SHA-256 for secure storage
    let mut hasher = Sha256::new();
    hasher.update(raw_key.as_bytes());
    let hash_result = format!("{:x}", hasher.finalize());

    let key_preview = format!("em_live_{}...****", &random_str[0..8]);

    // Calculate expiry modifier for SQLite
    let modifier = format!("+{} days", payload.duration_days);

    let insert_result = conn.execute(
        "INSERT INTO reseller_api_keys (reseller_email, api_key_hash, key_preview, label, is_active, expires_at) VALUES (?, ?, ?, ?, ?, datetime('now', ?))",
        params![user_sess.email, hash_result, key_preview, payload.label, 1, modifier],
    );

    if insert_result.is_err() {
        return (StatusCode::INTERNAL_SERVER_ERROR, "Failed to save key").into_response();
    }

    // Get the calculated expires_at time back
    let expires_at: String = conn.query_row(
        "SELECT expires_at FROM reseller_api_keys WHERE api_key_hash = ?",
        params![hash_result],
        |row| row.get(0),
    ).unwrap_or_else(|_| "".to_string());

    Json(GenerateKeyResponse {
        success: true,
        raw_key,
        expires_at,
    }).into_response()
}

// Handler: POST /api/reseller/api-keys/toggle
async fn toggle_api_key_route(
    jar: CookieJar,
    State(state): State<AppState>,
    Json(payload): Json<ToggleKeyRequest>,
) -> impl IntoResponse {
    let session_id = jar.get("session_id").map(|c| c.value().to_string());
    let sess = if let Some(sid) = session_id {
        verify_session(&state, &sid)
    } else {
        None
    };

    if sess.is_none() {
        return (StatusCode::UNAUTHORIZED, "Unauthorized").into_response();
    }
    let user_sess = sess.unwrap();

    let conn = match Connection::open(&state.transactions_db_path) {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Database connection error").into_response(),
    };

    let result = conn.execute(
        "UPDATE reseller_api_keys SET is_active = ? WHERE id = ? AND reseller_email = ?",
        params![payload.is_active, payload.id, user_sess.email],
    );

    match result {
        Ok(_) => Json(serde_json::json!({ "success": true })).into_response(),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Failed to update status").into_response(),
    }
}

// Handler: DELETE /api/reseller/api-keys/:id
async fn delete_api_key_route(
    jar: CookieJar,
    State(state): State<AppState>,
    axum::extract::Path(id): axum::extract::Path<i64>,
) -> impl IntoResponse {
    let session_id = jar.get("session_id").map(|c| c.value().to_string());
    let sess = if let Some(sid) = session_id {
        verify_session(&state, &sid)
    } else {
        None
    };

    if sess.is_none() {
        return (StatusCode::UNAUTHORIZED, "Unauthorized").into_response();
    }
    let user_sess = sess.unwrap();

    let conn = match Connection::open(&state.transactions_db_path) {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Database connection error").into_response(),
    };

    let result = conn.execute(
        "DELETE FROM reseller_api_keys WHERE id = ? AND reseller_email = ?",
        params![id, user_sess.email],
    );

    match result {
        Ok(_) => Json(serde_json::json!({ "success": true })).into_response(),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Failed to delete key").into_response(),
    }
}

// Handler: API Checkout
#[derive(Deserialize)]
struct KoalaCheckoutResponse {
    success: bool,
    message: Option<String>,
    data: Option<KoalaCheckoutData>,
}

#[derive(Deserialize)]
struct KoalaCheckoutData {
    transaction_id: Option<String>,
    total_amount: Option<f64>,
    qr_code_url: Option<String>,
}

#[derive(Serialize, Deserialize)]
struct CartItem {
    id: i64,
    email: String,
    product_code: String,
    product_name: String,
    variant_code: Option<String>,
    variant_name: Option<String>,
    price: i64,
    quantity: i64,
    created_at: String,
}

#[derive(Deserialize)]
struct AddCartPayload {
    product_code: String,
    product_name: String,
    variant_code: Option<String>,
    variant_name: Option<String>,
    price: i64,
    quantity: Option<i64>,
}

async fn get_cart(
    jar: CookieJar,
    State(state): State<AppState>,
) -> impl IntoResponse {
    let session_id = jar.get("session_id").map(|c| c.value().to_string());
    let email = match session_id.and_then(|sid| verify_session(&state, &sid)) {
        Some(sess) => sess.email,
        None => return (StatusCode::UNAUTHORIZED, "Unauthorized").into_response(),
    };

    let conn = match Connection::open(&state.transactions_db_path) {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Database Connection Error").into_response(),
    };

    // Auto-prune cart items older than 24 hours
    let _ = conn.execute("DELETE FROM keranjang WHERE created_at < datetime('now', '-1 day')", []);

    let mut stmt = match conn.prepare(
        "SELECT id, email, product_code, product_name, variant_code, variant_name, price, quantity, created_at FROM keranjang WHERE email = ?"
    ) {
        Ok(s) => s,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Failed to prepare query").into_response(),
    };

    let cart_items = stmt.query_map(params![email], |row| {
        Ok(CartItem {
            id: row.get(0)?,
            email: row.get(1)?,
            product_code: row.get(2)?,
            product_name: row.get(3)?,
            variant_code: row.get(4)?,
            variant_name: row.get(5)?,
            price: row.get(6)?,
            quantity: row.get(7)?,
            created_at: row.get(8)?,
        })
    });

    let items: Vec<CartItem> = match cart_items {
        Ok(mapped) => mapped.filter_map(|r| r.ok()).collect(),
        Err(_) => Vec::new(),
    };

    Json(items).into_response()
}

async fn add_to_cart(
    jar: CookieJar,
    State(state): State<AppState>,
    Json(payload): Json<AddCartPayload>,
) -> impl IntoResponse {
    let session_id = jar.get("session_id").map(|c| c.value().to_string());
    let email = match session_id.and_then(|sid| verify_session(&state, &sid)) {
        Some(sess) => sess.email,
        None => return (StatusCode::UNAUTHORIZED, "Unauthorized").into_response(),
    };

    let conn = match Connection::open(&state.transactions_db_path) {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Database Connection Error").into_response(),
    };

    let qty = payload.quantity.unwrap_or(1);

    let existing_id: Option<i64> = conn
        .query_row(
            "SELECT id FROM keranjang WHERE email = ? AND product_code = ? AND COALESCE(variant_code, '') = ?",
            params![email, payload.product_code, payload.variant_code.as_deref().unwrap_or("")],
            |row| row.get(0),
        )
        .ok();

    if let Some(id) = existing_id {
        let _ = conn.execute(
            "UPDATE keranjang SET quantity = quantity + ? WHERE id = ?",
            params![qty, id],
        );
    } else {
        let _ = conn.execute(
            "INSERT INTO keranjang (email, product_code, product_name, variant_code, variant_name, price, quantity) VALUES (?, ?, ?, ?, ?, ?, ?)",
            params![
                email,
                payload.product_code,
                payload.product_name,
                payload.variant_code,
                payload.variant_name,
                payload.price,
                qty
            ],
        );
    }

    Json(serde_json::json!({ "success": true, "message": "Item added/updated in cart" })).into_response()
}

async fn delete_cart_item(
    jar: CookieJar,
    Path(id): Path<i64>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    let session_id = jar.get("session_id").map(|c| c.value().to_string());
    let email = match session_id.and_then(|sid| verify_session(&state, &sid)) {
        Some(sess) => sess.email,
        None => return (StatusCode::UNAUTHORIZED, "Unauthorized").into_response(),
    };

    let conn = match Connection::open(&state.transactions_db_path) {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Database Connection Error").into_response(),
    };

    let result = conn.execute(
        "DELETE FROM keranjang WHERE id = ? AND email = ?",
        params![id, email],
    );

    match result {
        Ok(_) => Json(serde_json::json!({ "success": true, "message": "Item deleted from cart" })).into_response(),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Failed to delete item").into_response(),
    }
}

async fn clear_cart(
    jar: CookieJar,
    State(state): State<AppState>,
) -> impl IntoResponse {
    let session_id = jar.get("session_id").map(|c| c.value().to_string());
    let email = match session_id.and_then(|sid| verify_session(&state, &sid)) {
        Some(sess) => sess.email,
        None => return (StatusCode::UNAUTHORIZED, "Unauthorized").into_response(),
    };

    let conn = match Connection::open(&state.transactions_db_path) {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Database Connection Error").into_response(),
    };

    let _ = conn.execute(
        "DELETE FROM keranjang WHERE email = ?",
        params![email],
    );

    Json(serde_json::json!({ "success": true, "message": "Cart cleared" })).into_response()
}

#[derive(Deserialize)]
struct BuatQrisResponse {
    success: bool,
    message: Option<String>,
    data: Option<BuatQrisData>,
}

#[derive(Deserialize)]
struct BuatQrisData {
    transaction_id: Option<String>,
    qr_url: Option<String>,
    total_amount: Option<f64>,
}

async fn checkout_route(
    State(state): State<AppState>,
    Json(payload): Json<CheckoutPayload>,
) -> impl IntoResponse {
    let provider = payload.provider.clone();
    let product_code = payload.product_code.unwrap_or_default();
    let variant_code = payload.variant_code;
    let product_name = payload.product_name.unwrap_or_default();
    let variant_name = payload.variant_name.unwrap_or_default();
    let target = payload.target;
    let amount = payload.amount;
    let whatsapp_id = payload.whatsapp_id.unwrap_or_else(|| target.clone());

    if provider.is_empty() || variant_code.is_empty() || amount <= 0 || target.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({
                "success": false,
                "message": "Provider, variant_code, target, and amount are required"
            })),
        )
            .into_response();
    }

    if provider == "koalastore" {
        let key = std::env::var("KOALASTORE_API_KEY")
            .unwrap_or_else(|_| "kb_live_af0475f0cd12d8ff9ceb5b087a8977ef09303d9f".to_string());
        
        let client = state.http_client.clone();
        
        let body = serde_json::json!({
            "payment_type": "qris",
            "items": [
                {
                    "variant_code": variant_code,
                    "quantity": 1
                }
            ],
            "customer_amount": amount
        });

        let res = match client
            .post("https://koalastore.digital/api/v1/checkout")
            .header("X-API-KEY", &key)
            .json(&body)
            .send()
            .await
        {
            Ok(r) => r,
            Err(e) => {
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(serde_json::json!({ "success": false, "message": e.to_string() })),
                )
                    .into_response()
            }
        };

        let data: KoalaCheckoutResponse = match res.json().await {
            Ok(d) => d,
            Err(_) => {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(serde_json::json!({ "success": false, "message": "Failed to parse KoalaStore response" })),
                )
                    .into_response()
            }
        };

        if data.success && data.data.is_some() {
            let checkout_data = data.data.unwrap();
            let transaction_id = checkout_data.transaction_id.unwrap_or_default();
            let total_amount = checkout_data.total_amount.unwrap_or(amount as f64) as i64;
            let raw_qris = checkout_data.qr_code_url.unwrap_or_default();

            // Log transaction to transactions.db
            if let Ok(conn) = Connection::open(&state.transactions_db_path) {
                let _ = conn.execute(
                    "INSERT INTO transactions (transaction_id, whatsapp_id, product_name, variant_name, amount) VALUES (?, ?, ?, ?, ?)",
                    params![transaction_id, whatsapp_id, product_name, variant_name, total_amount],
                );
            }

            let mut qr_image_url = "".to_string();
            if !raw_qris.is_empty() {
                qr_image_url = format!(
                    "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data={}",
                    encode(&raw_qris)
                );
            }

            Json(CheckoutResponse {
                success: true,
                transaction_id,
                qr_image_url,
                amount: total_amount,
                provider: "koalastore".to_string(),
            })
            .into_response()
        } else {
            let msg = data.message.unwrap_or_else(|| "Failed to checkout from KoalaStore".to_string());
            (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "success": false, "message": msg }))).into_response()
        }
    } else if provider == "portalpulsa" || provider == "sslstore" || provider == "miraclegaming" {
        let account_id = match std::env::var("BUATQRIS_ACCOUNT_ID") {
            Ok(v) => v,
            Err(_) => {
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(serde_json::json!({
                        "success": false,
                        "message": "BUATQRIS_ACCOUNT_ID is not configured in .env"
                    })),
                )
                    .into_response()
            }
        };

        let secret_token = match std::env::var("BUATQRIS_SECRET_TOKEN") {
            Ok(v) => v,
            Err(_) => {
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(serde_json::json!({
                        "success": false,
                        "message": "BUATQRIS_SECRET_TOKEN is not configured in .env"
                    })),
                )
                    .into_response()
            }
        };

        let base_url = std::env::var("BUATQRIS_BASE_URL")
            .unwrap_or_else(|_| "https://app.buatqris.site/api.php".to_string());

        let description = format!("WEB-{}-{}", product_code, target);

        let amount_str = amount.to_string();
        let mut form_data = HashMap::new();
        form_data.insert("action", "api_create_qris");
        form_data.insert("account_id", &account_id);
        form_data.insert("secret_token", &secret_token);
        form_data.insert("amount", &amount_str);
        form_data.insert("description", &description);
        form_data.insert("qris_method", &"qris_two");

        let res = match state
            .http_client
            .post(&base_url)
            .form(&form_data)
            .send()
            .await
        {
            Ok(r) => r,
            Err(e) => {
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(serde_json::json!({ "success": false, "message": e.to_string() })),
                )
                    .into_response()
            }
        };

        let data: BuatQrisResponse = match res.json().await {
            Ok(d) => d,
            Err(_) => {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(serde_json::json!({ "success": false, "message": "Failed to parse BuatQRIS response" })),
                )
                    .into_response()
            }
        };

        if data.success && data.data.is_some() {
            let qris_data = data.data.unwrap();
            let transaction_id = qris_data.transaction_id.unwrap_or_default();
            let raw_qris = qris_data.qr_url.unwrap_or_default();
            let total_amount = qris_data.total_amount.unwrap_or(amount as f64) as i64;

            // 1. Log transaction to transactions.db
            if let Ok(conn) = Connection::open(&state.transactions_db_path) {
                let _ = conn.execute(
                    "INSERT INTO transactions (transaction_id, whatsapp_id, product_name, variant_name, amount) VALUES (?, ?, ?, ?, ?)",
                    params![transaction_id, whatsapp_id, product_name, variant_name, total_amount],
                );
            }

            // 2. Log order details to bot_memory.db
            if let Ok(conn_bot) = Connection::open(&state.bot_memory_db_path) {
                if provider == "portalpulsa" {
                    let _ = conn_bot.execute(
                        "INSERT OR REPLACE INTO portalpulsa_orders (transaction_id, whatsapp_id, product_code, product_name, target_id, amount, payment_status, fulfillment_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                        params![transaction_id, whatsapp_id, variant_code, product_name, target, total_amount, "pending", "pending"],
                    );
                } else if provider == "sslstore" {
                    let _ = conn_bot.execute(
                        "CREATE TABLE IF NOT EXISTS sslstore_orders (transaction_id TEXT PRIMARY KEY, whatsapp_id TEXT, product_code TEXT, product_name TEXT, email TEXT, validity_period INTEGER, amount INTEGER, payment_status TEXT, fulfillment_status TEXT)",
                        [],
                    );
                    let _ = conn_bot.execute(
                        "INSERT OR REPLACE INTO sslstore_orders (transaction_id, whatsapp_id, product_code, product_name, email, validity_period, amount, payment_status, fulfillment_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                        params![transaction_id, whatsapp_id, variant_code, product_name, target, 12, total_amount, "pending", "pending"],
                    );
                } else if provider == "miraclegaming" {
                    let _ = conn_bot.execute(
                        "CREATE TABLE IF NOT EXISTS miraclegaming_orders (transaction_id TEXT PRIMARY KEY, whatsapp_id TEXT, product_code TEXT, product_name TEXT, target_id TEXT, amount INTEGER, payment_status TEXT, fulfillment_status TEXT)",
                        [],
                    );
                    let _ = conn_bot.execute(
                        "INSERT OR REPLACE INTO miraclegaming_orders (transaction_id, whatsapp_id, product_code, product_name, target_id, amount, payment_status, fulfillment_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                        params![transaction_id, whatsapp_id, variant_code, product_name, target, total_amount, "pending", "pending"],
                    );
                }
            }

            let mut qr_image_url = "".to_string();
            if !raw_qris.is_empty() {
                qr_image_url = format!(
                    "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data={}",
                    encode(&raw_qris)
                );
            }

            Json(CheckoutResponse {
                success: true,
                transaction_id,
                qr_image_url,
                amount: total_amount,
                provider: provider.clone(),
            })
            .into_response()
        } else {
            let msg = data.message.unwrap_or_else(|| "Failed to generate QRIS".to_string());
            (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "success": false, "message": msg }))).into_response()
        }
    } else {
        (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "success": false, "message": "Unknown provider" }))).into_response()
    }
}

// Handler: API Order Status Check
#[derive(Deserialize)]
struct KoalaOrderResponse {
    success: bool,
    message: Option<String>,
    data: Option<Vec<KoalaOrderData>>,
}

#[derive(Deserialize)]
struct KoalaOrderData {
    transaction_id: Option<String>,
    status: Option<String>,
    items: Option<Vec<KoalaOrderItem>>,
}

#[derive(Deserialize)]
struct KoalaOrderItem {
    stock_data: Option<Vec<KoalaStockData>>,
}

#[derive(Deserialize)]
struct KoalaStockData {
    #[serde(rename = "dataStock")]
    data_stock: Option<String>,
}

async fn order_status_route(
    Path(transaction_id): Path<String>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    // 1. Check transaction in ecommerce.db first
    let conn_tx = match Connection::open(&state.transactions_db_path) {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "success": false, "message": "Database Connection Error" }))).into_response(),
    };

    let tx_query = conn_tx.query_row(
        "SELECT whatsapp_id, amount FROM transactions WHERE transaction_id = ?",
        params![transaction_id],
        |row| {
            let wa_id: String = row.get(0)?;
            let amt: i64 = row.get(1)?;
            Ok((wa_id, amt))
        },
    );

    let (whatsapp_id, amount) = match tx_query {
        Ok((wa_id, amt)) => (wa_id, amt),
        _ => return (StatusCode::NOT_FOUND, Json(serde_json::json!({ "success": false, "message": "Transaction not found" }))).into_response(),
    };

    // 2. Check if order is portalpulsa or sslstore in bot_memory.db
    let conn_bot = match Connection::open(&state.bot_memory_db_path) {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "success": false, "message": "Database Connection Error" }))).into_response(),
    };

    let is_pp: bool = conn_bot
        .query_row(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name='portalpulsa_orders'",
            [],
            |_| Ok(true),
        )
        .unwrap_or(false)
        && conn_bot
            .query_row(
                "SELECT 1 FROM portalpulsa_orders WHERE transaction_id = ?",
                params![transaction_id],
                |_| Ok(true),
            )
            .unwrap_or(false);

    let is_ssl: bool = conn_bot
        .query_row(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name='sslstore_orders'",
            [],
            |_| Ok(true),
        )
        .unwrap_or(false)
        && conn_bot
            .query_row(
                "SELECT 1 FROM sslstore_orders WHERE transaction_id = ?",
                params![transaction_id],
                |_| Ok(true),
            )
            .unwrap_or(false);

    if is_pp {
        // Execute Python status check runner for Portal Pulsa
        let py_cmd = format!(
            "import asyncio, sys\nsys.path.insert(0, '/root/botpulsa')\nsys.path.insert(0, '/root/botpulsa/bot-wa')\nfrom show_portalpulsa import check_portalpulsa_trx_status_wa\nprint(asyncio.run(check_portalpulsa_trx_status_wa('{}', '{}')))",
            transaction_id, whatsapp_id
        );

        let output = std::process::Command::new("python3")
            .arg("-c")
            .arg(&py_cmd)
            .output();

        match output {
            Ok(out) => {
                let msg_text = String::from_utf8_lossy(&out.stdout).trim().to_string();
                let mut status = "pending".to_string();
                let mut sn = None;

                if msg_text.contains("𝗣𝗘𝗠𝗕𝗔𝗬𝗔𝗥𝗔𝗡 𝗗𝗜𝗧𝗘𝗥𝗜𝗠𝗔 & 𝗦𝗨𝗞𝗦𝗘𝗦") || msg_text.contains("CAPTION:") {
                    status = "paid".to_string();
                    // Extract Serial Number
                    if let Some(start_idx) = msg_text.find("— 𝘀 𝗻 / 𝘃 𝗼 𝘂 𝗰 𝗵 𝗲 𝗲 𝗿 🌟 :") {
                        let sub = &msg_text[start_idx..];
                        if let Some(sn_line) = sub.lines().nth(1) {
                            sn = Some(sn_line.replace("*", "").trim().to_string());
                        }
                    }
                    if sn.is_none() {
                        sn = Some("Sukses dikirim!".to_string());
                    }
                } else if msg_text.contains("[x] Transaksi Gagal") {
                    status = "failed".to_string();
                } else if msg_text.contains("[*] Transaksi Sedang Diproses") {
                    status = "processing".to_string();
                }

                let clean_msg = msg_text.split("CAPTION:").last().unwrap_or(&msg_text).to_string();

                Json(StatusResponse {
                    success: true,
                    status,
                    message: clean_msg,
                    sn,
                    link: None,
                    stock_data: None,
                    amount,
                })
                .into_response()
            }
            Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "success": false, "message": e.to_string() }))).into_response(),
        }
    } else if is_ssl {
        // Execute Python status check runner for SSLStore
        let py_cmd = format!(
            "import asyncio, sys\nsys.path.insert(0, '/root/botpulsa')\nsys.path.insert(0, '/root/botpulsa/bot-wa')\nfrom show_sslstore import check_sslstore_trx_status_wa\nprint(asyncio.run(check_sslstore_trx_status_wa('{}', '{}')))",
            transaction_id, whatsapp_id
        );

        let output = std::process::Command::new("python3")
            .arg("-c")
            .arg(&py_cmd)
            .output();

        match output {
            Ok(out) => {
                let msg_text = String::from_utf8_lossy(&out.stdout).trim().to_string();
                let mut status = "pending".to_string();
                let mut link = None;

                if msg_text.contains("𝗣𝗘𝗠𝗕𝗔𝗬𝗔𝗥𝗔𝗡 𝗗𝗜𝗧𝗘𝗥𝗜𝗠𝗔") || msg_text.contains("CAPTION:") {
                    status = "paid".to_string();
                    // Extract link
                    for word in msg_text.split_whitespace() {
                        if word.starts_with("http://") || word.starts_with("https://") {
                            link = Some(word.to_string());
                            break;
                        }
                    }
                } else if msg_text.contains("[x] Transaksi Gagal") {
                    status = "failed".to_string();
                } else if msg_text.contains("[*] Transaksi Sedang Diproses") {
                    status = "processing".to_string();
                }

                let clean_msg = msg_text.split("CAPTION:").last().unwrap_or(&msg_text).to_string();

                Json(StatusResponse {
                    success: true,
                    status,
                    message: clean_msg,
                    sn: None,
                    link,
                    stock_data: None,
                    amount,
                })
                .into_response()
            }
            Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "success": false, "message": e.to_string() }))).into_response(),
        }
    } else {
        // KoalaStore
        let key = std::env::var("KOALASTORE_API_KEY")
            .unwrap_or_else(|_| "kb_live_af0475f0cd12d8ff9ceb5b087a8977ef09303d9f".to_string());

        let url = format!("https://koalastore.digital/api/v1/orders?search={}", transaction_id);
        
        let res = match state
            .http_client
            .get(&url)
            .header("X-API-KEY", &key)
            .send()
            .await
        {
            Ok(r) => r,
            Err(e) => {
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(serde_json::json!({ "success": false, "message": e.to_string() })),
                )
                    .into_response()
            }
        };

        let data: KoalaOrderResponse = match res.json().await {
            Ok(d) => d,
            Err(_) => {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(serde_json::json!({ "success": false, "message": "Failed to parse KoalaStore response" })),
                )
                    .into_response()
            }
        };

        if data.success && data.data.is_some() {
            let orders = data.data.unwrap();
            let mut status = "pending".to_string();
            let mut stock_data = None;

            if let Some(order) = orders.iter().find(|o| o.transaction_id.as_deref() == Some(&transaction_id)) {
                let raw_status = order.status.as_deref().unwrap_or("pending");
                if raw_status == "paid" {
                    status = "paid".to_string();
                    if let Some(items) = &order.items {
                        if !items.is_empty() {
                            if let Some(stock_list) = &items[0].stock_data {
                                if !stock_list.is_empty() {
                                    stock_data = stock_list[0].data_stock.clone();
                                }
                            }
                        }
                    }
                } else if raw_status == "pending" {
                    status = "pending".to_string();
                } else {
                    status = "failed".to_string();
                }
            }

            Json(StatusResponse {
                success: true,
                status,
                message: "Order data retrieved successfully".to_string(),
                sn: None,
                link: None,
                stock_data,
                amount,
            })
            .into_response()
        } else {
            let msg = data.message.unwrap_or_else(|| "Failed to retrieve order status".to_string());
            (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "success": false, "message": msg }))).into_response()
        }
    }
}

#[derive(Deserialize)]
struct ProductQuery {
    code: Option<String>,
}

async fn product_query_route(Query(query): Query<ProductQuery>) -> Redirect {
    if let Some(code) = query.code {
        if !code.is_empty() {
            return Redirect::to(&format!("/product/{}", code));
        }
    }
    Redirect::to("/")
}

#[derive(Deserialize)]
struct ProductViewQuery {
    product_code: Option<String>,
}

async fn product_view_route(Query(query): Query<ProductViewQuery>) -> Redirect {
    if let Some(code) = query.product_code {
        if !code.is_empty() {
            return Redirect::to(&format!("/product/{}", code));
        }
    }
    Redirect::to("/")
}

static PRODUCTS_CACHE: std::sync::OnceLock<Arc<tokio::sync::Mutex<Option<(std::time::Instant, serde_json::Value)>>>> = std::sync::OnceLock::new();

async fn get_products_route(State(state): State<AppState>) -> impl IntoResponse {
    let dotenv_path = "/root/ecommerce/.env";
    let _ = dotenvy::from_path(dotenv_path);

    let cache_lock = PRODUCTS_CACHE.get_or_init(|| Arc::new(tokio::sync::Mutex::new(None))).clone();
    let mut cache = cache_lock.lock().await;

    if let Some((time, data)) = &*cache {
        if time.elapsed() < std::time::Duration::from_secs(300) { // 5 minutes cache
            return Json(data.clone()).into_response();
        }
    }

    let markup_nominal: f64 = std::env::var("PRICE_MARKUP_NOMINAL")
        .ok()
        .and_then(|val| val.parse().ok())
        .unwrap_or(0.0);
    
    let markup_percent: f64 = std::env::var("PRICE_MARKUP_PERCENT")
        .ok()
        .and_then(|val| val.parse().ok())
        .unwrap_or(0.0);

    let koala_key = std::env::var("KOALASTORE_API_KEY").unwrap_or_default();
    let miracle_key = std::env::var("MIRACLE_GAMING_API_KEY").unwrap_or_default();

    let client = &state.http_client;
    
    let koala_future = client.get("https://koalastore.digital/api/v1/products")
        .header("X-API-KEY", koala_key)
        .send();

    let miracle_future = client.post("https://api.miraclegaming.store/service")
        .json(&serde_json::json!({"api_key": miracle_key}))
        .send();

    let (koala_res, miracle_res) = tokio::join!(koala_future, miracle_future);

    let mut final_products = vec![];

    if let Ok(res) = koala_res {
        if let Ok(json) = res.json::<serde_json::Value>().await {
            if let Some(data) = json.get("data").and_then(|d| d.as_array()) {
                for mut product in data.iter().cloned() {
                    if let Some(variants) = product.get_mut("variants").and_then(|v| v.as_array_mut()) {
                        for variant in variants {
                            if let Some(price_val) = variant.get_mut("price") {
                                if let Some(price) = price_val.as_f64() {
                                    *price_val = serde_json::Value::from(price + markup_nominal + (price * markup_percent / 100.0));
                                }
                            }
                            if let Some(orig_price_val) = variant.get_mut("original_price") {
                                if let Some(orig_price) = orig_price_val.as_f64() {
                                    *orig_price_val = serde_json::Value::from(orig_price + markup_nominal + (orig_price * markup_percent / 100.0));
                                }
                            }
                        }
                    }
                    let mut base_price = 0.0;
                    if let Some(variants) = product.get("variants").and_then(|v| v.as_array()) {
                        if !variants.is_empty() {
                            base_price = variants[0].get("price").and_then(|p| p.as_f64()).unwrap_or(0.0);
                        }
                    }
                    product["price"] = serde_json::Value::from(base_price);
                    product["provider"] = serde_json::Value::from("koalastore");
                    
                    // Assign category_slug
                    let mut slug = "digital".to_string();
                    if let Some(cat) = product.get("category").and_then(|c| c.as_str()) {
                        let cat_lower = cat.to_lowercase();
                        if cat_lower.contains("music") {
                            slug = "music".to_string();
                        } else if cat_lower.contains("productivity") {
                            slug = "productivity".to_string();
                        } else if cat_lower.contains("game") {
                            slug = "game".to_string();
                        }
                    }
                    product["category_slug"] = serde_json::Value::from(slug);
                    
                    final_products.push(product);
                }
            }
        }
    }

    if let Ok(res) = miracle_res {
        if let Ok(json) = res.json::<serde_json::Value>().await {
            if let Some(data) = json.get("data").and_then(|d| d.as_array()) {
                for item in data.iter().take(300) {
                    let base_price = item.get("harga").and_then(|p| p.as_f64()).unwrap_or(0.0);
                    let final_price = base_price + markup_nominal + (base_price * markup_percent / 100.0);
                    let code = item.get("id").unwrap_or(&serde_json::Value::Null);
                    let name = item.get("nama_layanan").unwrap_or(&serde_json::Value::Null);
                    let category = item.get("kategori").unwrap_or(&serde_json::Value::Null);
                    
                    let prod = serde_json::json!({
                        "code": code,
                        "name": name,
                        "category": category,
                        "category_slug": "game",
                        "price": final_price,
                        "provider": "miraclegaming",
                        "variants": [
                            {
                                "code_variant": code,
                                "name": name,
                                "price": final_price,
                                "original_price": base_price
                            }
                        ]
                    });
                    final_products.push(prod);
                }
            }
        }
    }

    // Fallback static products for Pulsa, Data, PLN, SSL since they don't have APIs implemented yet
    if let Ok(old_json_str) = tokio::fs::read_to_string("/root/ecommerce/dinamis/ecom_api/old_products.json").await {
        if let Ok(old_json) = serde_json::from_str::<serde_json::Value>(&old_json_str) {
            if let Some(old_products) = old_json.get("products").and_then(|p| p.as_array()) {
                for item in old_products {
                    if let Some(slug) = item.get("category_slug").and_then(|s| s.as_str()) {
                        if matches!(slug, "pulsa" | "data" | "pln" | "ssl") {
                            final_products.push(item.clone());
                        }
                    }
                }
            }
        }
    }

    let final_categories = vec![
        serde_json::json!({ "slug": "game", "name": "Game", "icon": "FaGamepad" }),
        serde_json::json!({ "slug": "pulsa", "name": "Pulsa", "icon": "FaMobileAlt" }),
        serde_json::json!({ "slug": "data", "name": "Data Internet", "icon": "FaWifi" }),
        serde_json::json!({ "slug": "pln", "name": "Token PLN", "icon": "FaBolt" }),
        serde_json::json!({ "slug": "ssl", "name": "SSL & Domain", "icon": "FaGlobe" }),
        serde_json::json!({ "slug": "digital", "name": "Produk Digital", "icon": "FaKey" }),
        serde_json::json!({ "slug": "music", "name": "Music Streaming", "icon": "FaMusic" }),
        serde_json::json!({ "slug": "productivity", "name": "Productivity Tools", "icon": "FaTools" }),
    ];

    let response = serde_json::json!({
        "success": true,
        "products": final_products,
        "categories": final_categories
    });

    *cache = Some((std::time::Instant::now(), response.clone()));
    
    Json(response).into_response()
}

async fn index_page() -> impl IntoResponse {
    match tokio::fs::read_to_string("/root/ecommerce/frontend/dist/index.html").await {
        Ok(html) => axum::response::Html(html).into_response(),
        Err(_) => (StatusCode::NOT_FOUND, "File index.html not found").into_response(),
    }
}

async fn login_page() -> impl IntoResponse {
    match tokio::fs::read_to_string("/root/ecommerce/frontend/dist/login.html").await {
        Ok(html) => axum::response::Html(html).into_response(),
        Err(_) => (StatusCode::NOT_FOUND, "File login.html not found").into_response(),
    }
}

async fn dashboard_page() -> impl IntoResponse {
    match tokio::fs::read_to_string("/root/ecommerce/frontend/dist/dashboard.html").await {
        Ok(html) => axum::response::Html(html).into_response(),
        Err(_) => (StatusCode::NOT_FOUND, "File dashboard.html not found").into_response(),
    }
}

async fn about_page() -> impl IntoResponse {
    match tokio::fs::read_to_string("/root/ecommerce/frontend/dist/about.html").await {
        Ok(html) => axum::response::Html(html).into_response(),
        Err(_) => (StatusCode::NOT_FOUND, "File about.html not found").into_response(),
    }
}

async fn service_page() -> impl IntoResponse {
    match tokio::fs::read_to_string("/root/ecommerce/frontend/dist/service.html").await {
        Ok(html) => axum::response::Html(html).into_response(),
        Err(_) => (StatusCode::NOT_FOUND, "File service.html not found").into_response(),
    }
}

async fn term_page() -> impl IntoResponse {
    match tokio::fs::read_to_string("/root/ecommerce/frontend/dist/term.html").await {
        Ok(html) => axum::response::Html(html).into_response(),
        Err(_) => (StatusCode::NOT_FOUND, "File term.html not found").into_response(),
    }
}

async fn condition_page() -> impl IntoResponse {
    match tokio::fs::read_to_string("/root/ecommerce/frontend/dist/condition.html").await {
        Ok(html) => axum::response::Html(html).into_response(),
        Err(_) => (StatusCode::NOT_FOUND, "File condition.html not found").into_response(),
    }
}

async fn security_page() -> impl IntoResponse {
    match tokio::fs::read_to_string("/root/ecommerce/frontend/dist/security.html").await {
        Ok(html) => axum::response::Html(html).into_response(),
        Err(_) => (StatusCode::NOT_FOUND, "File security.html not found").into_response(),
    }
}

async fn legalitas_page() -> impl IntoResponse {
    match tokio::fs::read_to_string("/root/ecommerce/frontend/dist/legalitas.html").await {
        Ok(html) => axum::response::Html(html).into_response(),
        Err(_) => (StatusCode::NOT_FOUND, "File legalitas.html not found").into_response(),
    }
}

async fn dokumentasi_page() -> impl IntoResponse {
    match tokio::fs::read_to_string("/root/ecommerce/frontend/dist/dokumentasi.html").await {
        Ok(html) => axum::response::Html(html).into_response(),
        Err(_) => (StatusCode::NOT_FOUND, "File dokumentasi.html not found").into_response(),
    }
}


async fn product_page() -> impl IntoResponse {
    match tokio::fs::read_to_string("/root/ecommerce/frontend/dist/product.html").await {
        Ok(html) => axum::response::Html(html).into_response(),
        Err(_) => (StatusCode::NOT_FOUND, "File product.html not found").into_response(),
    }
}

#[tokio::main]
async fn main() {
    // Load .env FIRST — must happen before any std::env::var() calls
    let _ = dotenvy::from_path("/root/ecommerce/.env");

    // Initialize databases
    let root_path = "/root/ecommerce";
    let transactions_db = format!("{}/dinamis/dashboard/ecommerce.db", root_path);
    let bot_memory_db = "/root/botpulsa/bot-wa/bot_memory.db".to_string();

    init_db(&transactions_db);

    let state = AppState {
        sessions: Arc::new(Mutex::new(HashMap::new())),
        transactions_db_path: transactions_db,
        bot_memory_db_path: bot_memory_db,
        http_client: reqwest::Client::new(),
        google_client_id: std::env::var("GOOGLE_CLIENT_ID").unwrap_or_default(),
        discord_client_id: std::env::var("DISCORD_CLIENT_ID").unwrap_or_default(),
        discord_client_secret: std::env::var("DISCORD_CLIENT_SECRET").unwrap_or_default(),
    };

    // Configure CORS
    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::predicate(|origin: &HeaderValue, _parts| {
            let s = origin.to_str().unwrap_or("");
            s.contains("localhost")
                || s.contains("vercel.app")
                || s.contains("mijdigital.my")
                || s.contains("easymall.ilhampradani.me")
                || s.contains("139.59.122.230")
                || s.contains("ilhampradani.me")
        }))
        .allow_headers(vec![header::CONTENT_TYPE, header::AUTHORIZATION])
        .allow_methods(vec![Method::GET, Method::POST, Method::OPTIONS])
        .allow_credentials(true);

    let app = Router::new()
        // API routes
        .route("/api/auth/status", get(auth_status))
        .route("/api/products", get(get_products_route))
        .route("/login", post(login_admin).get(login_page))
        .route("/login/google", post(login_google_route))
        .route("/login/discord", get(login_discord_route))
        .route("/login/discord/callback", get(login_discord_callback_route))
        .route("/logout", get(logout_route))
        .route("/api/dashboard/data", get(dashboard_data_route))
        .route("/api/reseller/api-keys", get(get_api_keys_route))
        .route("/api/reseller/api-keys/generate", post(generate_api_key_route))
        .route("/api/reseller/api-keys/toggle", post(toggle_api_key_route))
        .route("/api/reseller/api-keys/:id", delete(delete_api_key_route))
        .route("/api/checkout", post(checkout_route))
        .route("/api/order/status/:transaction_id", get(order_status_route))
        .route("/api/cart", get(get_cart).post(add_to_cart).delete(clear_cart))
        .route("/api/cart/:id", delete(delete_cart_item))
        
        // Static UI Pages
        .route("/", get(index_page))
        .route("/index.html", get(index_page))
        .route("/login.html", get(login_page))
        .route("/dashboard", get(dashboard_page))
        .route("/dashboard.html", get(dashboard_page))
        .route("/about", get(about_page))
        .route("/service", get(service_page))
        .route("/term", get(term_page))
        .route("/condition", get(condition_page))
        .route("/security", get(security_page))
        .route("/legalitas", get(legalitas_page))
        .route("/dokumentasi", get(dokumentasi_page))
        .route("/dokumentasi.html", get(dokumentasi_page))
        .route("/product/:product_code", get(product_page))
        .route("/product", get(product_query_route))
        .route("/paykonfirmasi", get(product_view_route))
        .route("/productview", get(product_view_route))
        
        .fallback_service(ServeDir::new("/root/ecommerce/frontend/dist"))
        .layer(cors)
        .with_state(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], 5002));
    println!("Rust Backend Server listening on http://{}", addr);
    
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
