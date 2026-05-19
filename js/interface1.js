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

    const statsModalEl = document.getElementById('modal-stats-campagne');
    const statsModal = typeof bootstrap !== 'undefined' ? bootstrap.Modal.getOrCreateInstance(statsModalEl) : null;
    const btnStatsSave = document.getElementById('modal-stats-save');
    const statsTablePanel = document.getElementById('stats-table-panel');
    const statsModalLoader = document.getElementById('stats-modal-loader');
    const paginationWrap = document.getElementById('programmes-pagination');
    const btnPrevPage = document.getElementById('prog-prev');
    const btnNextPage = document.getElementById('prog-next');
    const pageInfoEl = document.getElementById('prog-page-info');

    function setStatsModalLoading(isLoading) {
        if (statsTablePanel) statsTablePanel.classList.toggle('is-stats-loading', Boolean(isLoading));
        if (statsModalLoader) statsModalLoader.setAttribute('aria-hidden', isLoading ? 'false' : 'true');
        if (btnStatsSave) btnStatsSave.disabled = Boolean(isLoading);
    }

    let currentProgrammeRow = null;
    /** Dernière ligne Resultats chargée : col. A (ID_Resultat), pour ré-enregistrer la même ligne si besoin */
    let currentResultatId = null;
    /** Évite qu’un `finally` d’une ouverture précédente enlève le loader pendant une ouverture plus récente */
    let statsModalOpenGeneration = 0;

    const PROGRAMMES_PAGE_SIZE = 8;
    let programmesAllRows = [];
    let programmeIdsWithResultats = new Set();
    let programmesPage = 1;
    let goToLastPageOnce = false;

    function isResultatsHeaderRow(r) {
        if (!Array.isArray(r) || r.length < 2) return false;
        const c0 = String(r[0]).trim();
        const c1 = String(r[1]).trim();
        return c0 === "ID_Resultat" || c1 === "ID_Programme";
    }

    function totalProgrammesPages() {
        return Math.max(1, Math.ceil(programmesAllRows.length / PROGRAMMES_PAGE_SIZE));
    }

    function updatePaginationUI() {
        if (!paginationWrap) return;
        const pages = totalProgrammesPages();
        const show = programmesAllRows.length > PROGRAMMES_PAGE_SIZE;
        paginationWrap.classList.toggle('d-none', !show);
        if (pageInfoEl) {
            pageInfoEl.textContent = `Page ${programmesPage} / ${pages} • ${programmesAllRows.length} campagnes`;
        }
        if (btnPrevPage) btnPrevPage.disabled = programmesPage <= 1;
        if (btnNextPage) btnNextPage.disabled = programmesPage >= pages;
    }

    function renderProgrammesPage(page) {
        const pages = totalProgrammesPages();
        programmesPage = Math.min(Math.max(1, page), pages);
        const start = (programmesPage - 1) * PROGRAMMES_PAGE_SIZE;
        const slice = programmesAllRows.slice(start, start + PROGRAMMES_PAGE_SIZE);

        tableBody.innerHTML = '';
        if (!slice.length) {
            tableBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Aucune campagne.</td></tr>';
            updatePaginationUI();
            return;
        }

        slice.forEach((row) => {
            const tr = document.createElement('tr');
            tr.className = 'programme-row-clickable';
            tr.dataset.programmeId = row[0];
            const programmeId = String(row[0]).trim();
            const hasResultats = programmeIdsWithResultats.has(programmeId);
            if (hasResultats) {
                tr.classList.add('programme-row-with-resultats');
                tr.setAttribute('aria-label', 'Ouvrir les statistiques — résultats déjà enregistrés pour cette campagne');
            } else {
                tr.setAttribute('aria-label', 'Ouvrir les statistiques de cette campagne');
            }
            tr.setAttribute('role', 'button');
            tr.tabIndex = 0;
            tr.innerHTML = `
                <td><span class="badge bg-info text-dark programme-type-badge">${row[2]}</span></td>
                <td>${row[3]}</td>
                <td><small>${row[4]} ⟼ ${row[5]}</small></td>
                <td class="text-center">${row[6]}</td>
            `;
            tr.addEventListener('click', () => openStatsModal(row));
            tr.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openStatsModal(row);
                }
            });
            tableBody.appendChild(tr);
        });

        updatePaginationUI();
    }

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

    function statVal(id) {
        const el = document.getElementById(id);
        return el ? el.value.trim() : '';
    }

    function setStatVal(id, v) {
        const el = document.getElementById(id);
        if (el) el.value = v === undefined || v === null ? '' : String(v);
    }

    /**
     * Feuille Resultats (colonnes) :
     * ID_Resultat, ID_Programme, Sal_Aff, Sal_NonAff, NonSal_Aff, NonSal_NonAff,
     * Trav_Declares, Trav_NonDeclares, Mt_Reconnu, Mt_NonReconnu, Controleurs_participants
     * عدد المراقبين المشاركين (res-participants) : indépendant de l’effectif du programme.
     */
    async function loadStatsFromSheet(programmeId, prog) {
        currentResultatId = null;
        const rows = await fetchData('Resultats');
        if (String(currentProgrammeRow?.[0]) !== String(programmeId)) return;
        const list = Array.isArray(rows) ? rows : [];
        const matches = list.filter(
            (r) =>
                r &&
                !isResultatsHeaderRow(r) &&
                r.length >= 2 &&
                String(r[1]).trim() === String(programmeId).trim() &&
                (r.length < 13 || String(r[12]).trim() === String(user.codeBr).trim())
        );
        const data = matches.length ? matches[matches.length - 1] : null;

        if (data && data.length >= 2) {
            currentResultatId = data[0] != null && String(data[0]).trim() !== "" ? String(data[0]).trim() : null;
            setStatVal('res-type-hamla', prog[2]);
            setStatVal('res-activite-zone', prog[3]);
            setStatVal('res-w-in', data[2]);
            setStatVal('res-w-ni', data[3]);
            setStatVal('res-nw-in', data[4]);
            setStatVal('res-nw-ni', data[5]);
            setStatVal('res-emp-dec', data[6]);
            setStatVal('res-emp-ndec', data[7]);
            if (data.length >= 12) {
                setStatVal('res-manq-tot', data[8]);
                setStatVal('res-manq-ok', data[9]);
                setStatVal('res-manq-nok', data[10]);
                setStatVal('res-participants', data[11]);
            } else {
                setStatVal('res-manq-tot', '');
                setStatVal('res-manq-ok', data[8]);
                setStatVal('res-manq-nok', data[9]);
                setStatVal('res-participants', data.length > 10 ? data[10] : '');
            }
        } else {
            setStatVal('res-type-hamla', prog[2]);
            setStatVal('res-activite-zone', prog[3]);
            setStatVal('res-w-in', '');
            setStatVal('res-w-ni', '');
            setStatVal('res-nw-in', '');
            setStatVal('res-nw-ni', '');
            setStatVal('res-emp-dec', '');
            setStatVal('res-emp-ndec', '');
            setStatVal('res-manq-tot', '');
            setStatVal('res-manq-ok', '');
            setStatVal('res-manq-nok', '');
            setStatVal('res-participants', '');
        }
    }

    async function openStatsModal(programmeRow) {
        if (!statsModal) {
            alert('Interface modal indisponible (Bootstrap JS).');
            return;
        }
        const openGen = ++statsModalOpenGeneration;
        setStatsModalLoading(true);
        try {
            currentProgrammeRow = programmeRow;
            const pid = String(programmeRow[0] ?? '').trim();
            document.querySelectorAll('.modal-stats-pid').forEach((el) => {
                el.textContent = pid;
            });
            const elType = document.getElementById('modal-prog-type');
            const elZone = document.getElementById('modal-prog-zone');
            const elPeriod = document.getElementById('modal-prog-period');
            const elEff = document.getElementById('modal-prog-effectif');
            if (elType) elType.textContent = programmeRow[2] ?? '';
            if (elZone) elZone.textContent = programmeRow[3] ?? '';
            if (elPeriod) elPeriod.textContent = `${programmeRow[4] ?? ''} ⟼ ${programmeRow[5] ?? ''}`;
            if (elEff) elEff.textContent = programmeRow[6] != null ? String(programmeRow[6]) : '';
            statsModal.show();
            await loadStatsFromSheet(programmeRow[0], programmeRow);
        } finally {
            if (openGen === statsModalOpenGeneration) setStatsModalLoading(false);
        }
    }

    function buildResultatsRow() {
        if (!currentProgrammeRow) return null;
        const nz = (v) => (v === '' || v === undefined ? '0' : v);
        const idResultat = currentResultatId && String(currentResultatId).trim() !== '' ? String(currentResultatId).trim() : `R${Date.now()}`;
        return [
            idResultat,
            String(currentProgrammeRow[0]).trim(),
            nz(statVal('res-w-in')),
            nz(statVal('res-w-ni')),
            nz(statVal('res-nw-in')),
            nz(statVal('res-nw-ni')),
            nz(statVal('res-emp-dec')),
            nz(statVal('res-emp-ndec')),
            nz(statVal('res-manq-tot')),
            nz(statVal('res-manq-ok')),
            nz(statVal('res-manq-nok')),
            nz(statVal('res-participants')),
            String(user.codeBr).trim(),
        ];
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

    if (statsModalEl) {
        statsModalEl.addEventListener('hidden.bs.modal', () => {
            statsModalOpenGeneration += 1;
            setStatsModalLoading(false);
        });
    }

    if (btnStatsSave) {
        btnStatsSave.addEventListener('click', async () => {
            const payload = buildResultatsRow();
            if (!payload) return;
            btnStatsSave.disabled = true;
            const ok = await saveData('Resultats', payload);
            btnStatsSave.disabled = false;
            if (ok) {
                statsModal?.hide();
                await loadTable();
            } else {
                alert("Erreur lors de l'enregistrement des statistiques.");
            }
        });
    }

    let user = null;
    try {
        user = JSON.parse(localStorage.getItem('currentUser'));
    } catch {}
    if (!user || !user.codeBr || !user.token) {
        window.location.href = 'index.html';
        return;
    }
    const userInfoEl = document.getElementById('user-info');
    if (userInfoEl) {
        const name = user.frName || user.arName || '';
        const matricule = user.matricule ? String(user.matricule).trim() : '';
        const grade = user.grade ? String(user.grade).trim() : '';
        const parts = [];
        if (name) parts.push(name);
        if (matricule) parts.push(matricule);
        if (grade) parts.push(grade);
        userInfoEl.textContent = parts.length ? parts.join(' • ') : '--';
    }
    const bureauLabel = user.bureauName || user.codeBr;
    document.getElementById('bureau-info').textContent = `Bureau : ${bureauLabel}`;
    const logoutBtn = document.getElementById('btn-logout');
    logoutBtn?.addEventListener('click', () => {
        try {
            localStorage.removeItem('currentUser');
        } catch {}
        window.location.href = 'index.html';
    });

    async function loadTable() {
        tableBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Chargement...</td></tr>';
        const [allData, resultatsRows] = await Promise.all([fetchData('Programmes'), fetchData('Resultats')]);
        if (!Array.isArray(allData)) {
            tableBody.innerHTML =
                '<tr><td colspan="4" class="text-center text-danger">Impossible de charger les programmes (API).</td></tr>';
            return;
        }
        const myData = allData.filter((row) => row && String(row[1]).trim() === String(user.codeBr).trim());

        programmeIdsWithResultats = new Set();
        const resList = Array.isArray(resultatsRows) ? resultatsRows : [];
        for (const r of resList) {
            if (!r || isResultatsHeaderRow(r) || r.length < 2) continue;
            if (r.length >= 13 && String(r[12]).trim() !== String(user.codeBr).trim()) continue;
            const pid = String(r[1]).trim();
            if (pid) programmeIdsWithResultats.add(pid);
        }
        programmesAllRows = myData;
        if (goToLastPageOnce) {
            programmesPage = totalProgrammesPages();
            goToLastPageOnce = false;
        }
        renderProgrammesPage(programmesPage);
    }

    await loadTable();

    btnPrevPage?.addEventListener('click', () => renderProgrammesPage(programmesPage - 1));
    btnNextPage?.addEventListener('click', () => renderProgrammesPage(programmesPage + 1));

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
            user.codeBr,
            typeCampagne.value,
            getZoneActiviteValue(),
            inputDateDebut.value,
            inputDateFin.value,
            document.getElementById('nb_controleurs').value,
        ];

        const success = await saveData('Programmes', newEntry);

        if (success) {
            goToLastPageOnce = true;
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
