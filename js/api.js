const SCRIPT_URL ="https://script.google.com/macros/s/AKfycbw_liNSDAoQkXqFMwgj4xX0Tmf3zvVCQzAAPNgvmC5qhjp0Y_HnmqffaPW7LfxatXEm/exec";

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
