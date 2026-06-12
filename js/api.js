const SCRIPT_URL ="https://script.google.com/macros/s/AKfycbztXxU6nuuIEkCL2sBxU6QNFvcDLv1nWiVU7Woa_6Mc7iXbkcC2jxdVhxGwTVQaQ8Iv/exec";

// Session TTL must match Google Apps Script cache duration (see Code.gs createSession_()).
// Currently: 21600 seconds = 6 hours.
const SESSION_TTL_MS = 21600 * 1000;
// Expose for other scripts (login.js / interface pages)
try {
    window.SESSION_TTL_MS = SESSION_TTL_MS;
} catch {}

function getCurrentUser() {
    try {
        const raw = localStorage.getItem('currentUser');
        if (!raw) return null;
        const u = JSON.parse(raw);
        return u && typeof u === 'object' ? u : null;
    } catch {
        return null;
    }
}

function getToken() {
    const u = getCurrentUser();
    return u && u.token ? String(u.token) : '';
}

function getSessionExpiresAt() {
    const u = getCurrentUser();
    const v = u && u.sessionExpiresAt != null ? Number(u.sessionExpiresAt) : NaN;
    return Number.isFinite(v) ? v : null;
}

function isSessionExpired() {
    const exp = getSessionExpiresAt();
    return exp != null ? Date.now() >= exp : false;
}

function rememberPostLoginRedirect() {
    try {
        const file = String(window.location.pathname || '').split('/').pop() || '';
        // Only remember real app pages (avoid redirecting back to login itself)
        if (file && file.endsWith('.html') && file !== 'index.html') {
            localStorage.setItem('postLoginRedirect', file);
        }
    } catch {}
}

function logoutToLogin() {
    // When the session expires, return the user to the page they were on after re-login.
    rememberPostLoginRedirect();
    try {
        localStorage.removeItem('currentUser');
    } catch {}
    window.location.href = 'index.html';
}

function scheduleAutoLogout() {
    const exp = getSessionExpiresAt();
    if (exp == null) return;
    const delay = exp - Date.now();
    if (delay <= 0) {
        logoutToLogin();
        return;
    }
    // Avoid multiple timers per page.
    try {
        if (window.__autoLogoutTimer) clearTimeout(window.__autoLogoutTimer);
        window.__autoLogoutTimer = setTimeout(logoutToLogin, delay);
    } catch {
        setTimeout(logoutToLogin, delay);
    }
}

// Expose helpers
try {
    window.getSessionExpiresAt = getSessionExpiresAt;
    window.isSessionExpired = isSessionExpired;
    window.logoutToLogin = logoutToLogin;
    window.scheduleAutoLogout = scheduleAutoLogout;
} catch {}

/**
 * Client navigateur — ne pas mettre de code Google Apps Script (doPost/doGet) ici.
 * Le serveur est dans google-apps-script/Code.gs (à coller dans Apps Script + redéployer).
 */
async function saveData(sheetName, arrayValues) {
    try {
        const body = JSON.stringify({
            sheet: sheetName,
            values: arrayValues,
            token: getToken(),
        });
        const response = await fetch(SCRIPT_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain" },
            body,
        });
        if (!response.ok) {
            console.error("Enregistrement HTTP:", response.status, await response.text().catch(() => ""));
            return false;
        }
        const text = await response.text().catch(() => "");
        if (text && String(text).toLowerCase().indexOf("erreur") !== -1) {
            console.error("Enregistrement API:", text);
            return false;
        }
        return true;
    } catch (error) {
        console.error("Erreur d'envoi:", error);
        return false;
    }
}

async function postAction(action, payload = {}) {
    try {
        const body = JSON.stringify({ action, token: getToken(), ...payload });
        const response = await fetch(SCRIPT_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain" },
            body,
        });
        if (!response.ok) {
            console.error("Action HTTP:", response.status, await response.text().catch(() => ""));
            return { ok: false, error: "http_error" };
        }
        const text = await response.text();
        try {
            const data = JSON.parse(text);
            return data && typeof data === "object" ? data : { ok: false, error: "bad_response" };
        } catch {
            return { ok: false, error: "bad_json" };
        }
    } catch (error) {
        console.error("Erreur action:", error);
        return { ok: false, error: "network_error" };
    }
}

async function fetchData(sheetName) {
    try {
        if (sheetName === 'Programmes' || sheetName === 'Resultats') {
            const res = await postAction('getSheet', { sheet: sheetName });
            return res && res.ok && Array.isArray(res.rows) ? res.rows : [];
        }
        const response = await fetch(`${SCRIPT_URL}?sheet=${encodeURIComponent(sheetName)}`);
        if (!response.ok) {
            console.error("Lecture HTTP:", response.status, sheetName);
            return [];
        }
        const data = await response.json();
        return Array.isArray(data) ? data : [];
    } catch (error) {
        console.error("Erreur de récupération:", error);
        return [];
    }
}
