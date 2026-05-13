const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz8q3K4tba6iBTGztbl8675EOyMYop7tWYeF1TUxHw4kxAsQB5KiRMlIqomBjPSx7vv/exec";

// Envoyer des données vers une feuille spécifique
async function saveData(sheetName, arrayValues) {
    try {
        const response = await fetch(SCRIPT_URL, {
            method: "POST",
            body: JSON.stringify({
                sheet: sheetName,
                values: arrayValues
            })
        });
        return true;
    } catch (error) {
        console.error("Erreur d'envoi:", error);
        return false;
    }
}

// Récupérer les données d'une feuille
async function fetchData(sheetName) {
    try {
        const response = await fetch(`${SCRIPT_URL}?sheet=${sheetName}`);
        return await response.json();
    } catch (error) {
        console.error("Erreur de récupération:", error);
        return [];
    }
}