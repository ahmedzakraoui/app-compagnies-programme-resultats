const TableCore = (typeof window !== 'undefined' && window.TableCore) ? window.TableCore : null;
if (!TableCore) {
    console.error('TanStack TableCore is not loaded. Check network access to unpkg.com.');
}

const {
    createColumnHelper,
    createTable,
    getCoreRowModel,
    getFilteredRowModel,
    getSortedRowModel,
} = TableCore || {};

function flexRender(comp, props) {
    if (typeof comp === 'function') return comp(props);
    return comp ?? '';
}

function parseMaybeNumber(v) {
    const s = String(v ?? '').trim();
    if (!s) return null;
    const cleaned = s.replace(/[^\d.-]/g, '');
    if (!cleaned) return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
}

function isHeaderRow(r) {
    if (!Array.isArray(r) || r.length < 1) return false;
    const c0 = String(r[0]).trim().toLowerCase();
    return c0 === 'id_programme' || c0.indexOf('id_') === 0;
}

function findColumnIndex(headers, names) {
    for (let i = 0; i < headers.length; i++) {
        const h = String(headers[i] || '').trim().toLowerCase().replace(/\s+/g, '_');
        for (const n of names) {
            if (h === n || h.indexOf(n) !== -1) return i;
        }
    }
    return -1;
}

document.addEventListener('DOMContentLoaded', async () => {
    if (!TableCore) return;
    const postAction = window.postAction;
    const bootstrap = window.bootstrap;

    const theadEl = document.getElementById('results-thead');
    const tbodyEl = document.getElementById('results-tbody');
    const resultsTotalEl = document.getElementById('results-total');
    const resultsTableWrap = document.getElementById('results-table-wrap');
    const resultsTableLoader = document.getElementById('results-table-loader');

    const filterTypeEl = document.getElementById('filter-type');
    const filterBrEl = document.getElementById('filter-br');
    const filterZoneEl = document.getElementById('filter-zone');
    const btnResetEl = document.getElementById('btn-filters-reset');
    const btnExportXlsx = document.getElementById('btn-export-xlsx');
    const btnExportPdf = document.getElementById('btn-export-pdf');
    const paginationWrap = document.getElementById('results-pagination');
    const btnPrevPage = document.getElementById('res-prev');
    const btnNextPage = document.getElementById('res-next');
    const resPages = document.getElementById('res-pages');

    let user = null;
    try {
        user = JSON.parse(localStorage.getItem('currentUser'));
    } catch {}
    if (!user || !user.token) {
        try {
            localStorage.setItem('postLoginRedirect', 'interface3.html');
        } catch {}
        window.location.href = 'index.html';
        return;
    }

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
    document.getElementById('btn-logout')?.addEventListener('click', () => {
        try {
            localStorage.removeItem('currentUser');
        } catch {}
        window.location.href = 'index.html';
    });

    function setResultsLoading(isLoading) {
        if (resultsTableWrap) resultsTableWrap.classList.toggle('is-loading', Boolean(isLoading));
        if (resultsTableLoader) resultsTableLoader.setAttribute('aria-hidden', isLoading ? 'false' : 'true');
    }

    let bureauMap = new Map();

    const choiceSelectOpts = {
        searchEnabled: false,
        shouldSort: false,
        itemSelectText: '',
        allowHTML: false,
        position: 'bottom',
    };
    if (filterTypeEl && typeof window !== 'undefined' && window.Choices) {
        try {
            new window.Choices(filterTypeEl, choiceSelectOpts);
        } catch {}
    }

    function populateBrFilter() {
        if (!filterBrEl) return;
        filterBrEl.value = '';
    }

    const columnHelper = createColumnHelper();

    const columns = [
        columnHelper.accessor('programmeId', {
            id: 'programmeId',
            header: () => 'ID',
            cell: (info) => String(info.getValue() ?? '—'),
            filterFn: 'includesString',
            sortingFn: (a, b) => (parseMaybeNumber(a.getValue('programmeId')) ?? 0) - (parseMaybeNumber(b.getValue('programmeId')) ?? 0),
        }),
        columnHelper.accessor('br', {
            id: 'br',
            header: () => 'BR',
            cell: (info) => String(info.getValue() ?? '—'),
            filterFn: 'includesString',
        }),
        columnHelper.accessor('typeCampagne', {
            id: 'typeCampagne',
            header: () => 'نوع الحملة',
            cell: (info) => String(info.getValue() ?? '—'),
            filterFn: 'includesString',
        }),
        columnHelper.accessor('zone', {
            id: 'zone',
            header: () => 'نوع النشاط / المنطقة الجغرافية',
            cell: (info) => String(info.getValue() ?? '—'),
            filterFn: 'includesString',
        }),
        columnHelper.accessor('periode', {
            id: 'periode',
            header: () => 'الفترة الزمنية',
            cell: (info) => String(info.getValue() ?? '—'),
            filterFn: 'includesString',
        }),
        columnHelper.accessor('effectif', {
            id: 'effectif',
            header: () => 'عدد المراقبين',
            cell: (info) => String(info.getValue() ?? '—'),
            filterFn: (row, columnId, filterValue) => {
                const min = filterValue === '' || filterValue == null ? null : Number(filterValue);
                if (min == null || !Number.isFinite(min)) return true;
                const v = parseMaybeNumber(row.getValue(columnId)) ?? 0;
                return v >= min;
            },
            sortingFn: (a, b) => (parseMaybeNumber(a.getValue('effectif')) ?? 0) - (parseMaybeNumber(b.getValue('effectif')) ?? 0),
        }),
    ];

    const TABLE_COLS = 6;

    let table = null;
    let tableState = null;
    let rowsAll = [];
    const RESULTS_PAGE_SIZE = 5;
    let resultsPage = 1;

    function totalResultsPages(totalRows) {
        return Math.max(1, Math.ceil((totalRows || 0) / RESULTS_PAGE_SIZE));
    }

    function renderResultsPage(page) {
        if (!table) return;
        const totalRows = (table.getRowModel()?.rows || []).length;
        const pages = totalResultsPages(totalRows);
        resultsPage = Math.min(Math.max(1, page), pages);
        renderTanstackTable();
    }

    function updateResultsPaginationUI(totalRows) {
        const pages = totalResultsPages(totalRows);
        const show = (totalRows || 0) > RESULTS_PAGE_SIZE;
        if (paginationWrap) paginationWrap.classList.toggle('d-none', !show);
        if (btnPrevPage) btnPrevPage.disabled = resultsPage <= 1;
        if (btnNextPage) btnNextPage.disabled = resultsPage >= pages;
        if (resPages) {
            resPages.innerHTML = '';
            if (show) {
                for (let i = 1; i <= pages; i++) {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'programmes-page-number' + (i === resultsPage ? ' is-active' : '');
                    btn.textContent = i;
                    btn.addEventListener('click', () => renderResultsPage(i));
                    resPages.appendChild(btn);
                }
            }
        }
    }

    btnPrevPage?.addEventListener('click', () => renderResultsPage(resultsPage - 1));
    btnNextPage?.addEventListener('click', () => renderResultsPage(resultsPage + 1));

    function updateTotalUI(countAll, countFiltered) {
        if (!resultsTotalEl) return;
        if (countAll === 0) {
            resultsTotalEl.textContent = '';
            return;
        }
        resultsTotalEl.textContent =
            countAll === countFiltered ? `${countAll} ${countAll > 1 ? 'حملات' : 'حملة'}` : `${countFiltered} / ${countAll} حملات`;
    }

    function renderTanstackTable() {
        if (!table || !theadEl || !tbodyEl) return;

        const getSortingState = () => {
            try {
                const s = table.getState ? table.getState().sorting : (table.options?.state?.sorting ?? []);
                return Array.isArray(s) ? s : [];
            } catch {
                return [];
            }
        };
        const setSortingState = (next) => {
            tableState = { ...(tableState || {}), sorting: next };
            table.setOptions((prev) => ({
                ...prev,
                state: {
                    ...(prev.state || {}),
                    sorting: next,
                },
            }));
        };

        theadEl.innerHTML = '';
        const headerGroups = table.getHeaderGroups();

        headerGroups.forEach((hg) => {
            const tr = document.createElement('tr');
            tr.className = 'results-head-top';
            hg.headers.forEach((header) => {
                const th = document.createElement('th');
                th.colSpan = header.colSpan;
                th.rowSpan = header.rowSpan || 1;
                th.className = header.isPlaceholder ? 'is-placeholder' : '';
                if (!header.isPlaceholder) {
                    const canSort = header.column.getCanSort();
                    const div = document.createElement('div');
                    div.className = canSort ? 'results-th-sortable' : 'results-th-static';
                    if (canSort) {
                        div.setAttribute('role', 'button');
                        div.tabIndex = 0;
                        const toggle = () => {
                            const id = header.column.id;
                            const cur = getSortingState();
                            const curEntry = cur.find((x) => x && x.id === id);
                            let next = [];
                            if (!curEntry) next = [{ id, desc: false }];
                            else next = [{ id, desc: !curEntry.desc }];
                            setSortingState(next);
                            resultsPage = 1;
                            renderTanstackTable();
                        };
                        div.addEventListener('click', toggle);
                        div.addEventListener('keydown', (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                toggle();
                            }
                        });
                    }
                    div.innerHTML = flexRender(header.column.columnDef.header, header.getContext());
                    const s = header.column.getIsSorted();
                    if (s) {
                        const badge = document.createElement('span');
                        badge.className = 'results-sort-indicator';
                        badge.textContent = s === 'asc' ? '▼' : '▲';
                        div.appendChild(badge);
                    }
                    th.appendChild(div);
                }
                tr.appendChild(th);
            });
            theadEl.appendChild(tr);
        });

        const rowModel = table.getRowModel();
        tbodyEl.innerHTML = '';
        if (!rowModel.rows.length) {
            tbodyEl.innerHTML = `<tr><td colspan="${TABLE_COLS}" class="text-center text-muted">Aucun résultat.</td></tr>`;
            updateTotalUI(rowsAll.length, 0);
            updateResultsPaginationUI(0);
            return;
        }
        updateTotalUI(rowsAll.length, rowModel.rows.length);

        const totalFiltered = rowModel.rows.length;
        const pages = totalResultsPages(totalFiltered);
        if (resultsPage > pages) resultsPage = pages;
        updateResultsPaginationUI(totalFiltered);

        const start = (resultsPage - 1) * RESULTS_PAGE_SIZE;
        const pageRows = rowModel.rows.slice(start, start + RESULTS_PAGE_SIZE);

        pageRows.forEach((row) => {
            const tr = document.createElement('tr');
            tr.className = 'results-row-clickable';
            tr.setAttribute('role', 'button');
            tr.tabIndex = 0;

            row.getVisibleCells().forEach((cell) => {
                const td = document.createElement('td');
                td.innerHTML = flexRender(cell.column.columnDef.cell, cell.getContext());
                tr.appendChild(td);
            });
            tbodyEl.appendChild(tr);
        });
    }

    function applyFiltersToState() {
        if (!table) return;

        const type = (filterTypeEl?.value || '').trim();
        const br = (filterBrEl?.value || '').trim();
        const zone = (filterZoneEl?.value || '').trim();

        const nextColumnFilters = [];
        if (type) nextColumnFilters.push({ id: 'typeCampagne', value: type });
        if (br) nextColumnFilters.push({ id: 'br', value: br });
        if (zone) nextColumnFilters.push({ id: 'zone', value: zone });

        table.setOptions((prev) => ({
            ...prev,
            state: {
                ...prev.state,
                globalFilter: '',
                columnFilters: nextColumnFilters,
            },
        }));
        resultsPage = 1;
        renderTanstackTable();
    }

    function bindFilterHandlers() {
        filterTypeEl?.addEventListener('change', applyFiltersToState);
        filterBrEl?.addEventListener('input', applyFiltersToState);
        filterZoneEl?.addEventListener('input', applyFiltersToState);
        btnResetEl?.addEventListener('click', () => {
            if (filterTypeEl) filterTypeEl.value = '';
            if (filterBrEl) filterBrEl.value = '';
            if (filterZoneEl) filterZoneEl.value = '';
            table?.setOptions((prev) => ({
                ...prev,
                state: {
                    ...prev.state,
                    globalFilter: '',
                    columnFilters: [],
                    sorting: [{ id: 'programmeId', desc: false }],
                },
            }));
            resultsPage = 1;
            renderTanstackTable();
        });
    }
    bindFilterHandlers();

    function buildExportRowsFromTable() {
        if (!table) return [];
        const rowModel = table.getRowModel();
        const rows = rowModel?.rows || [];
        return rows.map((r) => r.original || {});
    }

    function exportToXlsx() {
        const XLSX = typeof window !== 'undefined' ? window.XLSX : null;
        if (!XLSX) {
            alert('XLSX library not loaded.');
            return;
        }
        const data = buildExportRowsFromTable();
        const headers = [
            'ID',
            'BR',
            'نوع الحملة',
            'نوع النشاط / المنطقة الجغرافية',
            'الفترة الزمنية',
            'عدد المراقبين',
        ];
        const aoa = [
            headers,
            ...data.map((r) => [
                r.programmeId ?? '',
                r.br ?? '',
                r.typeCampagne ?? '',
                r.zone ?? '',
                r.periode ?? '',
                r.effectif ?? '',
            ]),
        ];

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        ws['!rtl'] = true;
        XLSX.utils.book_append_sheet(wb, ws, 'Campagnes');
        wb.Workbook = wb.Workbook || {};
        wb.Workbook.Views = [{ RTL: true }];
        const filename = `campagnes_${new Date().toISOString().slice(0, 10)}.xlsx`;
        XLSX.writeFile(wb, filename);
    }

    function exportToPdf() {
        const tableEl = document.querySelector('.page-admin .results-table');
        if (!tableEl || !table) return;

        const filenameBase = `campagnes_${new Date().toISOString().slice(0, 10)}`;

        const theadSrc = tableEl.querySelector('thead');
        const theadClone = theadSrc ? theadSrc.cloneNode(true) : null;
        if (theadClone) theadClone.querySelectorAll('.results-sort-indicator').forEach((el) => el.remove());
        const theadHtml = theadClone ? theadClone.outerHTML : '';

        const rowModel = table.getRowModel();
        const rows = rowModel?.rows || [];
        const tbodyHtml =
            rows.length === 0
                ? `<tbody><tr><td colspan="${TABLE_COLS}" style="text-align:center;color:#777;">Aucun résultat.</td></tr></tbody>`
                : `<tbody>${rows
                      .map((row) => {
                          const tds = row
                              .getVisibleCells()
                              .map((cell) => `<td>${flexRender(cell.column.columnDef.cell, cell.getContext())}</td>`)
                              .join('');
                          return `<tr>${tds}</tr>`;
                      })
                      .join('')}</tbody>`;

        const tableHtml = `<table class="${tableEl.className}" dir="rtl">${theadHtml}${tbodyHtml}</table>`;

        const totalCount = rows.length;
        const totalLabel = totalCount === 1 ? 'حملة' : 'حملات';
        const totalBadge = `<span style="position:absolute;left:10mm;font-size:14pt;font-weight:700;">${totalCount} ${totalLabel}</span>`;

        const html = `<!doctype html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <title>${filenameBase}</title>
    <style>
      @page { size: A4 landscape; margin: 10mm; }
      body { font-family: Arial, "Segoe UI", Tahoma, sans-serif; direction: rtl; color: #111; }
      h1 { text-align: center; font-size: 18pt; margin: 0 0 10mm 0; position: relative; }
      table { width: 100%; border-collapse: collapse; table-layout: fixed; }
      thead th { background: #f2f2f2; font-weight: 700; }
      th, td { border: 1px solid #999; padding: 4px 6px; font-size: 9pt; text-align: center; word-wrap: break-word; }
      tr { page-break-inside: avoid; break-inside: avoid; }
    </style>
  </head>
  <body>
    <h1>${totalBadge}جميع الحملات</h1>
    ${tableHtml}
    <script>
      (function () {
        try { document.title = "${filenameBase}"; } catch (e) {}
        var hasInvokedPrint = false;
        function closeMeSoon() {
          setTimeout(function () {
            try { window.close(); } catch (e) {}
          }, 120);
        }
        window.onafterprint = closeMeSoon;
        if (window.matchMedia) {
          var mql = window.matchMedia('print');
          var handler = function (e) {
            if (hasInvokedPrint && e && e.matches === false) closeMeSoon();
          };
          if (mql && typeof mql.addEventListener === 'function') mql.addEventListener('change', handler);
          else if (mql && typeof mql.addListener === 'function') mql.addListener(handler);
        }
        window.addEventListener('focus', function () {
          if (hasInvokedPrint) closeMeSoon();
        });
        window.onload = function () {
          setTimeout(function () {
            window.focus();
            hasInvokedPrint = true;
            window.print();
          }, 200);
        };
      })();
    <\/script>
  </body>
</html>`;

        const win = window.open('', '_blank');
        if (!win) {
            alert('Popup blocked. Please allow popups to export PDF.');
            return;
        }
        win.document.open();
        win.document.write(html);
        win.document.close();
    }

    btnExportXlsx?.addEventListener('click', exportToXlsx);
    btnExportPdf?.addEventListener('click', exportToPdf);

    async function loadAndBuildTable() {
        setResultsLoading(true);
        if (tbodyEl) tbodyEl.innerHTML = '';
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            setResultsLoading(false);
            if (tbodyEl) tbodyEl.innerHTML = `<tr><td colspan="${TABLE_COLS}" class="text-center text-muted">Pas de connexion internet</td></tr>`;
            return;
        }

        let progRes = null;
        let bureauxRes = null;
        try {
            [progRes, bureauxRes] = await Promise.all([
                postAction('getAdminSheet', { sheet: 'Programmes' }),
                postAction('getAdminSheet', { sheet: 'Bureaux' }),
            ]);
        } catch (e) {
            setResultsLoading(false);
            if (tbodyEl) tbodyEl.innerHTML = `<tr><td colspan="${TABLE_COLS}" class="text-center text-muted">Erreur réseau</td></tr>`;
            return;
        }

        if (!progRes || !progRes.ok || !Array.isArray(progRes.rows)) {
            if (progRes && progRes.error === 'unauthorized') {
                if (typeof window !== 'undefined' && typeof window.logoutToLogin === 'function') window.logoutToLogin();
                else window.location.href = 'index.html';
                return;
            }
            setResultsLoading(false);
            const isOffline =
                (typeof navigator !== 'undefined' && navigator.onLine === false) ||
                !progRes ||
                (progRes && (progRes.error === 'network_error' || progRes.error === 'http_error'));
            if (tbodyEl) {
                tbodyEl.innerHTML = `<tr><td colspan="${TABLE_COLS}" class="text-center text-muted">${
                    isOffline ? 'Pas de connexion internet' : 'Impossible de charger les programmes (API).'
                }</td></tr>`;
            }
            return;
        }

        bureauMap = new Map();
        if (bureauxRes && bureauxRes.ok && Array.isArray(bureauxRes.rows)) {
            const bHeaders = bureauxRes.rows[0] || [];
            const bData = bureauxRes.rows.slice(1);
            const codeIdx = findColumnIndex(bHeaders, ['code_bureau', 'code_br', 'code', 'bureau_code']);
            const nameIdx = findColumnIndex(bHeaders, ['nom_bureau', 'bureau_name', 'name']);
            for (const r of bData) {
                if (!r) continue;
                const code = codeIdx >= 0 ? String(r[codeIdx] || '').trim() : '';
                const name = nameIdx >= 0 ? String(r[nameIdx] || '').trim() : code;
                if (code) bureauMap.set(code, name);
            }
        }
        populateBrFilter();

        rowsAll = [];
        progRes.rows.forEach((r) => {
            if (!r || !r.length || isHeaderRow(r)) return;
            const id = String(r[0] ?? '').trim();
            if (!id) return;
            const brCode = String(r[1] ?? '').trim();
            const brName = bureauMap.get(brCode) || '';
            const brLabel = brName ? `${brCode} - ${brName}` : brCode;
            rowsAll.push({
                programmeId: id,
                br: brLabel,
                programmeRow: r,
                typeCampagne: r[2] ?? '',
                zone: r[3] ?? '',
                periode: `${r[4] ?? ''} ⟻ ${r[5] ?? ''}`,
                effectif: r[6] ?? '',
            });
        });

        const resolvedOptions = {
            data: rowsAll,
            columns,
            globalFilterFn: (row, columnId, filterValue) => {
                const q = String(filterValue ?? '').trim().toLowerCase();
                if (!q) return true;
                const r = row.original;
                const hay = [r.programmeId, r.br, r.typeCampagne, r.zone, r.periode, r.effectif]
                    .map((v) => String(v ?? '').toLowerCase())
                    .join(' ');
                return hay.includes(q);
            },
            getCoreRowModel: getCoreRowModel(),
            getFilteredRowModel: getFilteredRowModel(),
            getSortedRowModel: getSortedRowModel(),
            state: {},
            onStateChange: () => {},
            renderFallbackValue: null,
        };

        table = createTable(resolvedOptions);
        tableState = table.initialState;
        table.setOptions((prev) => ({
            ...prev,
            ...resolvedOptions,
            state: {
                ...tableState,
                sorting: [{ id: 'programmeId', desc: false }],
                columnFilters: [],
                globalFilter: '',
            },
            onStateChange: (updater) => {
                if (typeof updater === 'function') {
                    tableState = updater(tableState);
                } else {
                    tableState = updater;
                }
                table.setOptions((p2) => ({ ...p2, state: { ...tableState, ...p2.state } }));
                renderTanstackTable();
            },
        }));

        applyFiltersToState();
        renderTanstackTable();
        setResultsLoading(false);
    }

    await loadAndBuildTable();
});
