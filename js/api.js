const SCRIPT_URL ="https://script.google.com/macros/s/AKfycbzNdOMKMx-w1lU0rgJWlDzCxt4X9T6fL7TfsEZFAI2CGU-IYG0wBuwQOjks3ikAbs5M/exec";

/**
 * Client navigateur — ne pas mettre de code Google Apps Script (doPost/doGet) ici.
 * Le serveur est dans google-apps-script/Code.gs (à coller dans Apps Script + redéployer).
 */
async function saveData(sheetName, arrayValues) {
    try {
        const body = JSON.stringify({
            sheet: sheetName,
            values: arrayValues,
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
        return true;
    } catch (error) {
        console.error("Erreur d'envoi:", error);
        return false;
    }
}

async function fetchData(sheetName) {
    try {
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
