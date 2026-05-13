document.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('form-programme');
    const tableBody = document.getElementById('table-body');
    const reveal = document.getElementById('form-campagne-reveal');
    const panel = document.getElementById('form-campagne-panel');
    const btnOpenForm = document.getElementById('btn-open-campagne-form');
    const typeCampagne = document.getElementById('type_campagne');
    const zoneBlock = document.getElementById('zone-activite-block');
    const wrapSectorielle = document.getElementById('zone-sectorielle-wrap');
    const wrapGeographique = document.getElementById('zone-geographique-wrap');
    const activiteSectorielle = document.getElementById('activite_sectorielle');
    const activiteZoneGeo = document.getElementById('activite_zone_geo');
    const inputDateDebut = document.getElementById('date_debut');
    const inputDateFin = document.getElementById('date_fin');

    const choiceSelectOpts = {
        searchEnabled: false,
        shouldSort: false,
        itemSelectText: '',
        allowHTML: false,
        position: 'bottom',
    };

    const fpLocale =
        typeof flatpickr !== 'undefined' && flatpickr.l10ns && flatpickr.l10ns.fr
            ? flatpickr.l10ns.fr
            : undefined;

    let choicesCampagne = null;
    let choicesSector = null;
    let fpDebut = null;
    let fpFin = null;
    let formPickersReady = false;

    function destroySectorChoices() {
        if (!choicesSector) return;
        choicesSector.destroy();
        choicesSector = null;
    }

    function initSectorChoices() {
        if (choicesSector) return;
        choicesSector = new Choices(activiteSectorielle, choiceSelectOpts);
    }

    function updateZoneActiviteUI() {
        const type = typeCampagne.value;
        destroySectorChoices();
        activiteSectorielle.removeAttribute('required');
        activiteZoneGeo.removeAttribute('required');
        activiteSectorielle.disabled = true;
        activiteZoneGeo.disabled = true;
        wrapSectorielle.classList.add('d-none');
        wrapGeographique.classList.add('d-none');
        zoneBlock.hidden = true;

        if (type === 'قطاعية') {
            zoneBlock.hidden = false;
            wrapSectorielle.classList.remove('d-none');
            activiteSectorielle.disabled = false;
            activiteSectorielle.setAttribute('required', 'required');
            initSectorChoices();
        } else if (type === 'جغرافية') {
            zoneBlock.hidden = false;
            wrapGeographique.classList.remove('d-none');
            activiteZoneGeo.disabled = false;
            activiteZoneGeo.setAttribute('required', 'required');
        }
    }

    function initFormPickersOnce() {
        if (formPickersReady) return;
        formPickersReady = true;

        choicesCampagne = new Choices(typeCampagne, choiceSelectOpts);

        fpDebut = flatpickr(inputDateDebut, {
            locale: fpLocale,
            dateFormat: 'Y-m-d',
            disableMobile: true,
            allowInput: false,
            onChange: (dates) => {
                if (dates[0]) {
                    fpFin.set('minDate', dates[0]);
                } else {
                    fpFin.set('minDate', null);
                }
            },
        });

        fpFin = flatpickr(inputDateFin, {
            locale: fpLocale,
            dateFormat: 'Y-m-d',
            disableMobile: true,
            allowInput: false,
        });

        typeCampagne.addEventListener('change', updateZoneActiviteUI);
        updateZoneActiviteUI();
    }

    function getZoneActiviteValue() {
        const type = typeCampagne.value;
        if (type === 'قطاعية') return activiteSectorielle.value;
        if (type === 'جغرافية') return activiteZoneGeo.value.trim();
        return '';
    }

    function validateProgrammeForm() {
        const type = typeCampagne.value;
        if (!type) return false;
        if (type === 'قطاعية' && !activiteSectorielle.value) return false;
        if (type === 'جغرافية' && !activiteZoneGeo.value.trim()) return false;
        if (!inputDateDebut.value || !inputDateFin.value) return false;
        const nb = document.getElementById('nb_controleurs').value;
        if (!nb || Number(nb) < 1) return false;
        return true;
    }

    btnOpenForm.addEventListener('click', () => {
        initFormPickersOnce();
        reveal.hidden = true;
        panel.hidden = false;
        btnOpenForm.setAttribute('aria-expanded', 'true');

        requestAnimationFrame(() => {
            if (typeof choicesCampagne?.refresh === 'function') choicesCampagne.refresh();
            if (typeof choicesSector?.refresh === 'function') choicesSector.refresh();
            if (typeof fpDebut?.redraw === 'function') fpDebut.redraw();
            if (typeof fpFin?.redraw === 'function') fpFin.redraw();
        });
    });

    const user = JSON.parse(localStorage.getItem('currentUser')) || { code: 'BR01', nom: 'Bureau Tunis' };
    document.getElementById('bureau-info').textContent = `Bureau : ${user.nom}`;

    async function loadTable() {
        tableBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Chargement...</td></tr>';
        const allData = await fetchData('Programmes');
        const myData = allData.filter((row) => row[1] === user.code);

        tableBody.innerHTML = '';
        myData.forEach((row) => {
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

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        initFormPickersOnce();
        if (!validateProgrammeForm()) {
            alert('Veuillez compléter tous les champs obligatoires.');
            return;
        }

        const btnText = document.getElementById('btn-text');
        btnText.textContent = 'Envoi en cours...';

        const newEntry = [
            'P' + Date.now(),
            user.code,
            typeCampagne.value,
            getZoneActiviteValue(),
            inputDateDebut.value,
            inputDateFin.value,
            document.getElementById('nb_controleurs').value,
        ];

        const success = await saveData('Programmes', newEntry);

        if (success) {
            form.reset();
            fpDebut.clear();
            fpFin.clear();
            fpFin.set('minDate', null);
            choicesCampagne.setChoiceByValue(typeCampagne.value);
            updateZoneActiviteUI();
            btnText.textContent = 'Ajouter au programme';
            await loadTable();
        } else {
            alert('Erreur lors de l\'enregistrement.');
            btnText.textContent = 'Ajouter au programme';
        }
    });
});
