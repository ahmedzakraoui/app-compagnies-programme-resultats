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
    const paginationWrap = document.getElementById('programmes-pagination');
    const btnPrevPage = document.getElementById('prog-prev');
    const btnNextPage = document.getElementById('prog-next');
    const pageInfoEl = document.getElementById('prog-page-info');
    const progPages = document.getElementById('prog-pages');
    const progTotal = document.getElementById('prog-total');
    const programmesLoaderRow = document.getElementById('programmes-loader-row');

    if (document.body) {
        document.querySelectorAll('.modal-backdrop').forEach((el) => el.remove());
        document.body.classList.remove('modal-open');
        document.body.style.removeProperty('overflow');
        document.body.style.removeProperty('padding-right');
    }

    // Debug: Check for any overlays that might block interaction
    function checkOverlays() {
        const overlays = document.querySelectorAll('body *');
        overlays.forEach(el => {
            const style = getComputedStyle(el);
            const zIndex = parseInt(style.zIndex);
            const pointerEvents = style.pointerEvents;
            const rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0 && (zIndex >= 0 || pointerEvents !== 'none')) {
                console.log('Potential overlay:', el.id || el.className, 
                    'z-index:', zIndex, 
                    'pointer-events:', pointerEvents,
                    'rect:', rect);
            }
        });
    }
    // Run check on load
    setTimeout(checkOverlays, 1000);
    // Also check after modal opens
    if (statsModal) {
        statsModalEl.addEventListener('shown.bs.modal', checkOverlays);
    }



    let currentProgrammeRow = null;
    let currentResultatId = null;
    const resultatsCache = new Map();

    const PROGRAMMES_PAGE_SIZE = 7;
    let programmesAllRows = [];
    let programmeIdsWithResultats = new Set();
    let programmesPage = 1;
    let goToLastPageOnce = false;
    let programmesMessage = '';

    function setProgrammesLoading(isLoading) {
        if (programmesLoaderRow) programmesLoaderRow.style.display = isLoading ? '' : 'none';
    }

    function setProgrammesMessage(msg) {
        programmesMessage = msg ? String(msg) : '';
        programmesAllRows = [];
        programmeIdsWithResultats = new Set();
        if (paginationWrap) paginationWrap.classList.add('d-none');
        if (progTotal) progTotal.textContent = programmesMessage;
        if (tableBody) {
            tableBody.innerHTML = programmesMessage
                ? `<tr><td colspan="4" class="text-center text-danger fw-semibold">${programmesMessage}</td></tr>`
                : '';
        }
    }

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
    if (programmesMessage) {
        if (paginationWrap) paginationWrap.classList.add('d-none');
        if (progTotal) progTotal.textContent = programmesMessage;
        return;
    }
    const pages = totalProgrammesPages();
    const show = programmesAllRows.length > PROGRAMMES_PAGE_SIZE;
    if (paginationWrap) paginationWrap.classList.toggle('d-none', !show);
    // Update page info text
    if (pageInfoEl) {
        pageInfoEl.textContent = `Page ${programmesPage} / ${pages} • ${programmesAllRows.length} campagnes`;
    }
    // Enable/disable prev/next buttons
    if (btnPrevPage) btnPrevPage.disabled = programmesPage <= 1;
    if (btnNextPage) btnNextPage.disabled = programmesPage >= pages;
    // Render clickable page numbers
    if (progPages) {
        progPages.innerHTML = '';
        for (let i = 1; i <= pages; i++) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'programmes-page-number' + (i === programmesPage ? ' is-active' : '');
            btn.textContent = i;
            btn.addEventListener('click', () => renderProgrammesPage(i));
            progPages.appendChild(btn);
        }
    }
    if (progTotal) {
        const total = programmesAllRows.length;
        progTotal.textContent = `${total} ${total > 1 ? 'حملات' : 'حملة'}`;
    }
}

    function renderProgrammesPage(page) {
        if (programmesMessage) return;
        const pages = totalProgrammesPages();
        programmesPage = Math.min(Math.max(1, page), pages);
        const start = (programmesPage - 1) * PROGRAMMES_PAGE_SIZE;
        const slice = programmesAllRows.slice(start, start + PROGRAMMES_PAGE_SIZE);

        tableBody.innerHTML = '';
        if (!slice.length) {
            tableBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">قائمة فارغة</td></tr>';
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
                <td><small>${row[5]} ⟻ ${row[4]}</small></td>
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

    function sanitizeAmountText(v) {
        const raw = String(v === undefined || v === null ? '' : v);
        const normalizedSep = raw.replace(/[.;:،؛'"’‘“”]/g, ',');
        const kept = normalizedSep.replace(/[^\d,]/g, '');
        return kept.replace(/,{2,}/g, ',').replace(/^,/, '');
    }

    function initAmountInputs() {
        const ids = ['res-manq-tot', 'res-manq-ok', 'res-manq-nok'];
        ids.forEach((id) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('input', () => {
                const next = sanitizeAmountText(el.value);
                if (el.value !== next) el.value = next;
            });
            el.addEventListener('blur', () => {
                const next = sanitizeAmountText(el.value);
                if (el.value !== next) el.value = next;
            });
        });
    }

    function populateModalFromCache(progRow) {
        currentResultatId = null;
        const pid = String(progRow[0] ?? '').trim();
        const data = resultatsCache.get(pid) || null;

        setStatVal('res-type-hamla', progRow[2]);
        setStatVal('res-activite-zone', progRow[3]);

        if (data && data.length >= 2) {
            currentResultatId = data[0] != null && String(data[0]).trim() !== "" ? String(data[0]).trim() : null;
            setStatVal('res-w-in', data[2]);
            setStatVal('res-w-ni', data[3]);
            setStatVal('res-nw-in', data[4]);
            setStatVal('res-nw-ni', data[5]);
            setStatVal('res-emp-dec', data[6]);
            setStatVal('res-emp-ndec', data[7]);
            if (data.length >= 12) {
                setStatVal('res-manq-tot', sanitizeAmountText(data[8]));
                setStatVal('res-manq-ok', sanitizeAmountText(data[9]));
                setStatVal('res-manq-nok', sanitizeAmountText(data[10]));
                setStatVal('res-participants', data[11]);
            } else {
                setStatVal('res-manq-tot', '');
                setStatVal('res-manq-ok', sanitizeAmountText(data[8]));
                setStatVal('res-manq-nok', sanitizeAmountText(data[9]));
                setStatVal('res-participants', data.length > 10 ? data[10] : '');
            }
        } else {
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

    function openStatsModal(programmeRow) {
        if (!statsModal) {
            alert('Interface modal indisponible (Bootstrap JS).');
            return;
        }
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
        if (elPeriod) elPeriod.textContent = `${programmeRow[4] ?? ''} ⟻ ${programmeRow[5] ?? ''}`;
        if (elEff) elEff.textContent = programmeRow[6] != null ? String(programmeRow[6]) : '';
        populateModalFromCache(programmeRow);
        statsModal.show();
    }

    function buildResultatsRow() {
        if (!currentProgrammeRow) return null;
        const nz = (v) => (v === '' || v === undefined ? '0' : v);
        const amountVal = (id) => statVal(id).replace(/,/g, '');
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
            nz(amountVal('res-manq-tot')),
            nz(amountVal('res-manq-ok')),
            nz(amountVal('res-manq-nok')),
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



    initAmountInputs();

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
                alert("Erreur lors de l'enregistrement des statistiques");
            }
        });
    }

    let user = null;
    try {
        user = JSON.parse(localStorage.getItem('currentUser'));
    } catch {}
    if (!user || !user.codeBr || !user.token) {
        try {
            localStorage.setItem('postLoginRedirect', 'interface1.html');
        } catch {}
        window.location.href = 'index.html';
        return;
    }

    // Auto logout when session TTL is reached (token expires server-side after ~6h)
    if (typeof window !== 'undefined' && typeof window.isSessionExpired === 'function' && window.isSessionExpired()) {
        if (typeof window.logoutToLogin === 'function') window.logoutToLogin();
        else window.location.href = 'index.html';
        return;
    }
    if (typeof window !== 'undefined' && typeof window.scheduleAutoLogout === 'function') window.scheduleAutoLogout();
    const userInfoEl = document.getElementById('user-info');
    if (userInfoEl) {
        const name = user.frName || user.arName || '';
        userInfoEl.textContent = name ? String(name).trim() : '--';
    }
    const logoutBtn = document.getElementById('btn-logout');
    logoutBtn?.addEventListener('click', () => {
        try {
            localStorage.removeItem('currentUser');
        } catch {}
        window.location.href = 'index.html';
    });

    async function loadTable() {
        programmesMessage = '';
        programmesAllRows = [];
        programmeIdsWithResultats = new Set();
        if (paginationWrap) paginationWrap.classList.add('d-none');
        if (progTotal) progTotal.textContent = '';
        tableBody.innerHTML = '';
        const loaderTr = document.createElement('tr');
        loaderTr.id = 'programmes-loader-row';
        loaderTr.innerHTML = '<td colspan="4" class="text-center py-4"><div class="spinner-border text-success" role="status" aria-label="Chargement"></div></td>';
        tableBody.appendChild(loaderTr);
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            setProgrammesMessage('Pas de connexion internet');
            return;
        }

        const [progRes, resultatsRes] = await Promise.all([
            postAction('getSheet', { sheet: 'Programmes' }),
            postAction('getSheet', { sheet: 'Resultats' }),
        ]);

        if (!progRes || !progRes.ok || !Array.isArray(progRes.rows)) {
            if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                setProgrammesMessage('Pas de connexion internet');
                return;
            }
            // Some browsers keep navigator.onLine=true even when internet is down.
            // postAction() reports it as network/http error in that case.
            if (!progRes) {
                setProgrammesMessage('Pas de connexion internet');
                return;
            }
            if (progRes && (progRes.error === 'network_error' || progRes.error === 'http_error')) {
                setProgrammesMessage('Pas de connexion internet');
                return;
            }
            // Token session côté Apps Script peut expirer (cache ~ 6h) => logout auto
            if (progRes && progRes.error === 'unauthorized') {
                if (typeof window !== 'undefined' && typeof window.logoutToLogin === 'function') window.logoutToLogin();
                else window.location.href = 'index.html';
                return;
            }
            setProgrammesMessage('Impossible de charger les programmes (API)');
            return;
        }

        const allData = progRes.rows;
        const resultatsRows = resultatsRes && resultatsRes.ok && Array.isArray(resultatsRes.rows) ? resultatsRes.rows : [];
        const myData = allData.filter((row) => row && String(row[1]).trim() === String(user.codeBr).trim());

        programmeIdsWithResultats = new Set();
        resultatsCache.clear();
        const resList = Array.isArray(resultatsRows) ? resultatsRows : [];
        for (const r of resList) {
            if (!r || isResultatsHeaderRow(r) || r.length < 2) continue;
            if (r.length >= 13 && String(r[12]).trim() !== String(user.codeBr).trim()) continue;
            const pid = String(r[1]).trim();
            if (pid) {
                programmeIdsWithResultats.add(pid);
                resultatsCache.set(pid, r);
            }
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
            alert('Veuillez compléter tous les champs obligatoires');
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
            alert('Erreur lors de l\'enregistrement');
            btnText.textContent = 'Ajouter au programme';
        }
    });
});
