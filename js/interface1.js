document.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('form-programme');
    const tableBody = document.getElementById('table-body');
    
    // 1. Récupérer les infos du bureau (simulé ou via localStorage après login)
    const user = JSON.parse(localStorage.getItem('currentUser')) || { code: "BR01", nom: "Bureau Tunis" };
    document.getElementById('bureau-info').textContent = `Bureau : ${user.nom}`;

    // 2. Charger les données existantes au démarrage
    async function loadTable() {
        tableBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Chargement...</td></tr>';
        const allData = await fetchData('Programmes');
        // Filtrer pour ne voir que les programmes de MON bureau
        const myData = allData.filter(row => row[1] === user.code);
        
        tableBody.innerHTML = '';
        myData.forEach(row => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><span class="badge bg-info text-dark">${row[2]}</span></td>
                <td>${row[3]}</td>
                <td><small>${row[4]} ⟼ ${row[5]}</small></td>
                <td class="text-center">${row[6]}</td>
            `;
            tableBody.appendChild(tr);
        });
    }

    await loadTable();

    // 3. Gestion de l'envoi du formulaire
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btnText = document.getElementById('btn-text');
        btnText.textContent = "Envoi en cours...";

        const newEntry = [
            "P" + Date.now(), // ID_Programme
            user.code,        // Code_Bureau
            document.getElementById('type_campagne').value,
            document.getElementById('activite_zone').value,
            document.getElementById('date_debut').value,
            document.getElementById('date_fin').value,
            document.getElementById('nb_controleurs').value
        ];

        const success = await saveData('Programmes', newEntry);

        if (success) {
            form.reset();
            btnText.textContent = "Ajouter au Programme";
            await loadTable(); // Rafraîchir le tableau
        } else {
            alert("Erreur lors de l'enregistrement.");
            btnText.textContent = "Ajouter au Programme";
        }
    });
});