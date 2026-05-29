document.addEventListener('DOMContentLoaded', async () => {
    const tableBody = document.getElementById('results-table-body');
    const resultsTotalEl = document.getElementById('results-total');

    const filterSearchEl = document.getElementById('filter-search');
    const filterTypeEl = document.getElementById('filter-type');
    const filterZoneEl = document.getElementById('filter-zone');
    const btnResetEl = document.getElementById('btn-filters-reset');
    const filtersGridEl = document.getElementById('filters-grid');

    const statsModalEl = document.getElementById('modal-stats-campagne');
    const statsModal = typeof bootstrap !== 'undefined' ? bootstrap.Modal.getOrCreateInstance(statsModalEl) : null;
    const btnStatsSave = document.getElementById('modal-stats-save');
    const statsTablePanel = document.getElementById('stats-table-panel');
    const statsModalLoader = document.getElementById('stats-modal-loader');

    // Cleanup any leftover bootstrap modal artifacts (from back/forward navigation)
    if (document.body) {
        document.querySelectorAll('.modal-backdrop').forEach((el) => el.remove());
        document.body.classList.remove('modal-open');
        document.body.style.removeProperty('overflow');
        document.body.style.removeProperty('padding-right');
    }

    function setStatsModalLoading(isLoading) {
        if (statsTablePanel) statsTablePanel.classList.toggle('is-stats-loading', Boolean(isLoading));
        if (statsModalLoader) statsModalLoader.setAttribute('aria-hidden', isLoading ? 'false' : 'true');
        if (btnStatsSave) btnStatsSave.disabled = Boolean(isLoading);
    }

    function isResultatsHeaderRow(r) {
        if (!Array.isArray(r) || r.length < 2) return false;
        const c0 = String(r[0]).trim();
        const c1 = String(r[1]).trim();
        return c0 === 'ID_Resultat' || c1 === 'ID_Programme';
    }

    // Auth guard
    let user = null;
    try {
        user = JSON.parse(localStorage.getItem('currentUser'));
    } catch {}
    if (!user || !user.codeBr || !user.token) {
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

    // ----- Modal helpers (same field IDs as interface1)
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
    initAmountInputs();

    let currentProgrammeRow = null;
    let currentResultatId = null;
    let statsModalOpenGeneration = 0;

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
                (r.length < 13 || String(r[12]).trim() === String(user.codeBr).trim()),
        );
        const data = matches.length ? matches[matches.length - 1] : null;

        setStatVal('res-type-hamla', prog[2]);
        setStatVal('res-activite-zone', prog[3]);

        if (data && data.length >= 2) {
            currentResultatId = data[0] != null && String(data[0]).trim() !== '' ? String(data[0]).trim() : null;
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
                // legacy format
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
            if (elPeriod) elPeriod.textContent = `${programmeRow[4] ?? ''} ↤ ${programmeRow[5] ?? ''}`;
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

    // ----- Table + filters + sort
    const FILTER_NUM_DEFS = [
        { key: 'salAff', label: 'الأجراء / منخرطين' },
        { key: 'salNonAff', label: 'الأجراء / غير منخرطين' },
        { key: 'nonSalAff', label: 'غير الأجراء / منخرطين' },
        { key: 'nonSalNonAff', label: 'غير الأجراء / غير منخرطين' },
        { key: 'travDeclares', label: 'مصرح بهم' },
        { key: 'travNonDeclares', label: 'غير مصرح بهم' },
        { key: 'insuffTotale', label: 'النقص الإجمالي' },
        { key: 'mtReconnu', label: 'معترف به' },
        { key: 'mtNonReconnu', label: 'غير معترف به' },
        { key: 'controleursParticipants', label: 'المراقبين' },
    ];

    const numericFilterEls = {};

    function buildNumericFiltersUI() {
        if (!filtersGridEl) return;
        filtersGridEl.innerHTML = '';
        FILTER_NUM_DEFS.forEach((def) => {
            const wrap = document.createElement('div');
            wrap.className = 'results-filter-field';
            const id = `filter-num-${def.key}`;
            wrap.innerHTML = `
                <label for="${id}">${def.label}</label>
                <input type="number" class="form-control form-control-sm" id="${id}" min="0" step="1" placeholder="≥" />
            `;
            filtersGridEl.appendChild(wrap);
            const el = wrap.querySelector(`#${CSS.escape(id)}`);
            if (el) {
                numericFilterEls[def.key] = el;
                el.addEventListener('input', applyFiltersAndRender);
            }
        });
    }
    buildNumericFiltersUI();

    function toKeyText(v) {
        return String(v ?? '').trim();
    }

    function parseMaybeNumber(v) {
        const s = String(v ?? '').trim();
        if (!s) return null;
        const cleaned = s.replace(/[^\d.-]/g, '');
        if (!cleaned) return null;
        const n = Number(cleaned);
        return Number.isFinite(n) ? n : null;
    }

    function parseMaybeAmount(v) {
        const s = String(v ?? '').trim();
        if (!s) return null;
        const cleaned = s.replace(/[^\d]/g, '');
        if (!cleaned) return null;
        const n = Number(cleaned);
        return Number.isFinite(n) ? n : null;
    }

    function formatCell(v) {
        const s = String(v ?? '').trim();
        return s === '' ? '—' : s;
    }

    let programmesById = new Map();
    let rowsAll = [];
    let sortKey = 'typeCampagne';
    let sortDir = 'asc';

    function setTableMessage(msg) {
        if (!tableBody) return;
        tableBody.innerHTML = `<tr><td colspan="12" class="text-center ${msg ? 'text-muted' : 'text-danger'}">${msg || ''}</td></tr>`;
        if (resultsTotalEl) resultsTotalEl.textContent = '';
    }

    function updateTotalUI(countAll, countFiltered) {
        if (!resultsTotalEl) return;
        if (countAll === 0) {
            resultsTotalEl.textContent = '';
            return;
        }
        resultsTotalEl.textContent =
            countAll === countFiltered ? `${countAll} campagne${countAll > 1 ? 's' : ''}` : `${countFiltered} / ${countAll} campagnes`;
    }

    function applySort(rows) {
        const dir = sortDir === 'desc' ? -1 : 1;
        const numKeys = new Set([
            'salAff',
            'salNonAff',
            'nonSalAff',
            'nonSalNonAff',
            'travDeclares',
            'travNonDeclares',
            'insuffTotale',
            'mtReconnu',
            'mtNonReconnu',
            'controleursParticipants',
        ]);
        return [...rows].sort((a, b) => {
            const va = a[sortKey];
            const vb = b[sortKey];
            if (numKeys.has(sortKey)) {
                const isAmount = sortKey === 'insuffTotale' || sortKey === 'mtReconnu' || sortKey === 'mtNonReconnu';
                const na = isAmount ? parseMaybeAmount(va) ?? 0 : parseMaybeNumber(va) ?? 0;
                const nb = isAmount ? parseMaybeAmount(vb) ?? 0 : parseMaybeNumber(vb) ?? 0;
                return na === nb ? 0 : na > nb ? dir : -dir;
            }
            const sa = toKeyText(va).toLowerCase();
            const sb = toKeyText(vb).toLowerCase();
            return sa.localeCompare(sb, 'fr', { sensitivity: 'base' }) * dir;
        });
    }

    function updateSortUI() {
        document.querySelectorAll('.results-table thead th.sortable').forEach((th) => {
            th.classList.remove('is-sorted-asc', 'is-sorted-desc');
            const k = th.getAttribute('data-key') || '';
            if (k === sortKey) th.classList.add(sortDir === 'desc' ? 'is-sorted-desc' : 'is-sorted-asc');
        });
    }

    function matchesFilters(row) {
        const search = (filterSearchEl?.value || '').trim().toLowerCase();
        const type = (filterTypeEl?.value || '').trim();
        const zone = (filterZoneEl?.value || '').trim().toLowerCase();

        if (type && String(row.typeCampagne).trim() !== type) return false;
        if (zone && !String(row.zone || '').toLowerCase().includes(zone)) return false;

        if (search) {
            const hay = [
                row.programmeId,
                row.typeCampagne,
                row.zone,
                row.salAff,
                row.salNonAff,
                row.nonSalAff,
                row.nonSalNonAff,
                row.travDeclares,
                row.travNonDeclares,
                row.insuffTotale,
                row.mtReconnu,
                row.mtNonReconnu,
                row.controleursParticipants,
            ]
                .map((v) => String(v ?? '').toLowerCase())
                .join(' ');
            if (!hay.includes(search)) return false;
        }

        for (const def of FILTER_NUM_DEFS) {
            const el = numericFilterEls[def.key];
            if (!el) continue;
            const minV = el.value === '' ? null : Number(el.value);
            if (minV === null || !Number.isFinite(minV)) continue;
            const isAmount = def.key === 'insuffTotale' || def.key === 'mtReconnu' || def.key === 'mtNonReconnu';
            const value = isAmount ? parseMaybeAmount(row[def.key]) ?? 0 : parseMaybeNumber(row[def.key]) ?? 0;
            if (value < minV) return false;
        }
        return true;
    }

    function renderTable(rowsFiltered) {
        if (!tableBody) return;
        tableBody.innerHTML = '';

        if (!rowsFiltered.length) {
            tableBody.innerHTML = `<tr><td colspan="12" class="text-center text-muted">Aucun résultat.</td></tr>`;
            return;
        }

        rowsFiltered.forEach((row) => {
            const tr = document.createElement('tr');
            tr.className = 'results-row-clickable';
            tr.setAttribute('role', 'button');
            tr.tabIndex = 0;
            tr.dataset.programmeId = row.programmeId;

            tr.innerHTML = `
                <td>
                    <div class="results-type-cell">
                        <span class="results-type-main">${formatCell(row.typeCampagne)}</span>
                        <span class="results-type-sub">${formatCell(row.programmeId)}</span>
                    </div>
                </td>
                <td>${formatCell(row.zone)}</td>
                <td class="text-center">${formatCell(row.salAff)}</td>
                <td class="text-center">${formatCell(row.salNonAff)}</td>
                <td class="text-center">${formatCell(row.nonSalAff)}</td>
                <td class="text-center">${formatCell(row.nonSalNonAff)}</td>
                <td class="text-center">${formatCell(row.travDeclares)}</td>
                <td class="text-center">${formatCell(row.travNonDeclares)}</td>
                <td class="text-center">${formatCell(row.insuffTotale)}</td>
                <td class="text-center">${formatCell(row.mtReconnu)}</td>
                <td class="text-center">${formatCell(row.mtNonReconnu)}</td>
                <td class="text-center">${formatCell(row.controleursParticipants)}</td>
            `;

            const progRow = programmesById.get(String(row.programmeId).trim());
            const open = () => {
                if (progRow) openStatsModal(progRow);
            };
            tr.addEventListener('click', open);
            tr.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    open();
                }
            });
            tableBody.appendChild(tr);
        });
    }

    function applyFiltersAndRender() {
        const filtered = rowsAll.filter(matchesFilters);
        const sorted = applySort(filtered);
        updateSortUI();
        updateTotalUI(rowsAll.length, sorted.length);
        renderTable(sorted);
    }

    function bindSortHandlers() {
        document.querySelectorAll('.results-table thead th.sortable').forEach((th) => {
            const key = th.getAttribute('data-key');
            if (!key) return;
            const activate = () => {
                if (sortKey === key) {
                    sortDir = sortDir === 'asc' ? 'desc' : 'asc';
                } else {
                    sortKey = key;
                    sortDir = 'asc';
                }
                applyFiltersAndRender();
            };
            th.addEventListener('click', activate);
            th.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    activate();
                }
            });
        });
    }
    bindSortHandlers();

    filterSearchEl?.addEventListener('input', applyFiltersAndRender);
    filterTypeEl?.addEventListener('change', applyFiltersAndRender);
    filterZoneEl?.addEventListener('input', applyFiltersAndRender);

    btnResetEl?.addEventListener('click', () => {
        if (filterSearchEl) filterSearchEl.value = '';
        if (filterTypeEl) filterTypeEl.value = '';
        if (filterZoneEl) filterZoneEl.value = '';
        Object.values(numericFilterEls).forEach((el) => {
            el.value = '';
        });
        sortKey = 'typeCampagne';
        sortDir = 'asc';
        applyFiltersAndRender();
    });

    async function loadTable() {
        if (!tableBody) return;
        tableBody.innerHTML = '<tr><td colspan="12" class="text-center text-muted">Chargement...</td></tr>';
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            setTableMessage('Pas de connexion internet');
            return;
        }

        const [progRes, resultatsRes] = await Promise.all([
            postAction('getSheet', { sheet: 'Programmes' }),
            postAction('getSheet', { sheet: 'Resultats' }),
        ]);

        if (!progRes || !progRes.ok || !Array.isArray(progRes.rows)) {
            if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                setTableMessage('Pas de connexion internet');
                return;
            }
            if (!progRes) {
                setTableMessage('Pas de connexion internet');
                return;
            }
            if (progRes && (progRes.error === 'network_error' || progRes.error === 'http_error')) {
                setTableMessage('Pas de connexion internet');
                return;
            }
            if (progRes && progRes.error === 'unauthorized') {
                if (typeof window !== 'undefined' && typeof window.logoutToLogin === 'function') window.logoutToLogin();
                else window.location.href = 'index.html';
                return;
            }
            setTableMessage('Impossible de charger les programmes (API).');
            return;
        }

        const programmesRows = progRes.rows;
        programmesById = new Map();
        programmesRows.forEach((r) => {
            if (!r || !r.length) return;
            const id = String(r[0] ?? '').trim();
            if (id) programmesById.set(id, r);
        });

        const resultatsRows = resultatsRes && resultatsRes.ok && Array.isArray(resultatsRes.rows) ? resultatsRes.rows : [];
        const latestByProgramme = new Map();

        const resList = Array.isArray(resultatsRows) ? resultatsRows : [];
        for (const r of resList) {
            if (!r || isResultatsHeaderRow(r) || r.length < 2) continue;
            if (r.length >= 13 && String(r[12]).trim() !== String(user.codeBr).trim()) continue;
            const pid = String(r[1]).trim();
            if (!pid) continue;
            if (!programmesById.has(pid)) continue;
            latestByProgramme.set(pid, r);
        }

        rowsAll = [];
        for (const [pid, r] of latestByProgramme.entries()) {
            const prog = programmesById.get(pid);
            if (!prog) continue;
            const modern = r.length >= 12;
            rowsAll.push({
                programmeId: pid,
                resultatId: String(r[0] ?? '').trim(),
                programmeRow: prog,
                typeCampagne: prog[2] ?? '',
                zone: prog[3] ?? '',
                salAff: r[2] ?? '',
                salNonAff: r[3] ?? '',
                nonSalAff: r[4] ?? '',
                nonSalNonAff: r[5] ?? '',
                travDeclares: r[6] ?? '',
                travNonDeclares: r[7] ?? '',
                insuffTotale: modern ? r[8] ?? '' : '',
                mtReconnu: modern ? r[9] ?? '' : r[8] ?? '',
                mtNonReconnu: modern ? r[10] ?? '' : r[9] ?? '',
                controleursParticipants: modern ? r[11] ?? '' : r[10] ?? '',
            });
        }

        applyFiltersAndRender();
    }

    await loadTable();
    updateSortUI();
});
