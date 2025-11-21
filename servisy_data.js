// Load JSON data for contractual services and render searchable table
// Comments are in English as requested.

(function () {
    const DATA_URL = 'data_output.json';

    const searchInput = document.getElementById('searchInput');
    const tableHeaderRow = document.getElementById('tableHeaderRow');
    const tableBody = document.getElementById('tableBody');
    const metaInfo = document.getElementById('metaInfo');
    const noResults = document.getElementById('noResults');
    const serviceModal = document.getElementById('serviceModal');
    const serviceModalClose = document.getElementById('serviceModalClose');
    const serviceModalTitle = document.getElementById('serviceModalTitle');
    const serviceModalSubtitle = document.getElementById('serviceModalSubtitle');
    const serviceModalMetaLine = document.getElementById('serviceModalMetaLine');
    const serviceModalBranches = document.getElementById('serviceModalBranches');
    const serviceModalBranchDetail = document.getElementById('serviceModalBranchDetail');

    let rawRecords = [];       // original flat list from JSON
    let groupedRecords = [];   // records grouped by [KAM, Likvidace, KAPU]
    let columns = [];      // columns visible in main table (overview)
    let allColumns = [];   // all columns from dataset (for searching + detail)
    let columnDisplayNames = {}; // human-friendly labels loaded from header row
    let currentTypeFilter = 'auta'; // auta | bus | skla

    // Mapping of technical column names to human-friendly labels for visible columns
    const DISPLAY_COLUMNS_ORDER = ['KAM', 'Likvidace', 'KAPU'];
    const COLUMN_LABELS = {
        KAM: 'Číslo smlouvy (KAM)',
        Likvidace: 'IČ (Likvidace)',
        KAPU: 'Název servisu (KAPU)'
    };

    // Known address-related columns from Excel header row
    const STREET_COL = 'Unnamed: 5'; // Ulice
    const ZIP_COL = 'Unnamed: 6';    // PSČ
    const CITY_COL = 'Unnamed: 7';   // Obec

    // Helper: safely read nested data structure
    function isObject(value) {
        return value !== null && typeof value === 'object' && !Array.isArray(value);
    }

    // Helper: normalize text for searching (lowercase, basic trim)
    function normalize(value) {
        if (value == null) {
            return '';
        }
        return String(value).toLowerCase();
    }

    // Classify service into category: "auta", "bus", "skla"
    function classifyType(record) {
        const druh = normalize(record['Unnamed: 11']);      // column "Druh"
        const opravuje = normalize(record['Unnamed: 12']);  // column "Opravuje značky aut"
        const name = normalize(record['KAPU']);             // company name

        // Skla – anything clearly autosklo (in type, in brands or in name)
        const isGlass =
            (druh && druh.indexOf('autosklo') !== -1) ||
            (opravuje && opravuje.indexOf('autosklo') !== -1) ||
            (name && name.indexOf('autosklo') !== -1);

        if (isGlass) {
            return 'skla';
        }

        // BUS – services explicitly working on buses / trucks & buses
        const isBus =
            (opravuje && (
                opravuje.indexOf('autobusy') !== -1 ||
                opravuje.indexOf('bus') !== -1
            ));

        if (isBus) {
            return 'bus';
        }

        // Default – everything else is treated as "Auta"
        return 'auta';
    }

    // Render table header from columns
    function renderHeader() {
        tableHeaderRow.innerHTML = '';
        columns.forEach(function (col) {
            const th = document.createElement('th');
            th.textContent = COLUMN_LABELS[col] || col;
            tableHeaderRow.appendChild(th);
        });
    }

    // Get human-friendly label for column for details
    function getDetailLabel(col) {
        if (columnDisplayNames && Object.prototype.hasOwnProperty.call(columnDisplayNames, col)) {
            return columnDisplayNames[col];
        }
        if (COLUMN_LABELS[col]) {
            return COLUMN_LABELS[col];
        }
        return col;
    }

    // Build inner HTML with all remaining columns for a single branch (record)
    function buildBranchDetailContent(record) {
        // Show all non-empty fields except the three overview columns and technical legend
        const excluded = new Set(DISPLAY_COLUMNS_ORDER.concat(['Legenda:']));

        const items = [];
        allColumns.forEach(function (col) {
            if (excluded.has(col)) {
                return;
            }
            const value = record[col];
            if (value == null || String(value).trim() === '') {
                return;
            }
            items.push({
                label: getDetailLabel(col),
                value: value
            });
        });

        if (items.length === 0) {
            return '<div class="detail-content">Žádné další údaje k zobrazení.</div>';
        }

        const parts = ['<div class="detail-content"><div class="detail-grid">'];
        items.forEach(function (item) {
            parts.push(
                '<div class="detail-item">' +
                '<span class="detail-item-label">' + String(item.label) + ':</span>' +
                '<span class="detail-item-value">' + String(item.value) + '</span>' +
                '</div>'
            );
        });
        parts.push('</div></div>');
        return parts.join('');
    }

    // Render table body from grouped records (one row per IČ/smlouva/název)
    function renderBody(groups) {
        tableBody.innerHTML = '';

        if (!groups || groups.length === 0) {
            noResults.style.display = 'block';
            return;
        }

        noResults.style.display = 'none';

        groups.forEach(function (group) {
            const baseRecord = group.displayRecord || (group.records && group.records[0]) || {};

            const tr = document.createElement('tr');
            tr.classList.add('main-row');

            columns.forEach(function (col) {
                const td = document.createElement('td');
                td.textContent = baseRecord[col] != null ? baseRecord[col] : '';
                tr.appendChild(td);
            });

            // Open modal with grouped detail on click
            tr.addEventListener('click', function () {
                openServiceModal(group);
            });

            tableBody.appendChild(tr);
        });
    }

    // Apply search filter across all columns + current tab (Auta / BUS / Skla)
    function applyFilter() {
        const term = normalize(searchInput.value);

        // First apply type (tab) filter on grouped records
        let base = groupedRecords.filter(function (group) {
            const type = group.type || 'auta';

            if (currentTypeFilter === 'bus') {
                return type === 'bus';
            }
            if (currentTypeFilter === 'skla') {
                return type === 'skla';
            }

            // Default tab "Auta"
            return type === 'auta';
        });

        // Then apply search filter inside selected type
        if (!term) {
            renderBody(base);
            return;
        }

        const filtered = base.filter(function (group) {
            // Match if ANY branch in the group matches search term in ANY column
            return group.records.some(function (record) {
                return allColumns.some(function (col) {
                    const value = record[col];
                    if (value == null) {
                        return false;
                    }
                    return normalize(value).indexOf(term) !== -1;
                });
            });
        });

        renderBody(filtered);
    }

    // Render meta information about dataset
    function renderMeta(meta) {
        if (!metaInfo) return;

        if (!meta || !isObject(meta)) {
            metaInfo.textContent = '';
            return;
        }

        var parts = [];
        if (typeof meta.record_count === 'number') {
            parts.push('Počet záznamů: ' + meta.record_count);
        }
        if (meta.last_updated) {
            parts.push('Poslední aktualizace: ' + meta.last_updated);
        }

        metaInfo.textContent = parts.join(' · ');
    }

    // Build groupedRecords from rawRecords (group by KAM + Likvidace + KAPU)
    function buildGroupsFromRawRecords() {
        const map = new Map();

        rawRecords.forEach(function (record, index) {
            const legend = record['Legenda:'];

            // First row is header / legend row (contains labels like "Stav")
            if (legend === 'Stav' && index === 0) {
                return;
            }

            const keyParts = DISPLAY_COLUMNS_ORDER.map(function (col) {
                return record[col] != null ? String(record[col]) : '';
            });
            const key = keyParts.join('||');

            if (!map.has(key)) {
                const type = classifyType(record);
                map.set(key, {
                    key: key,
                    type: type,
                    displayRecord: record,
                    records: [record]
                });
            } else {
                const group = map.get(key);
                group.records.push(record);
            }
        });

        groupedRecords = Array.from(map.values());
    }

    // Render modal content for selected group and branch
    function renderServiceModal(group, selectedIndex) {
        if (!serviceModal || !serviceModalBranches || !serviceModalBranchDetail) {
            return;
        }

        const records = Array.isArray(group && group.records) ? group.records : [];
        if (!records.length) {
            return;
        }

        const baseRecord = group.displayRecord || records[0];

        // Header texts
        if (serviceModalTitle) {
            serviceModalTitle.textContent = baseRecord['KAPU'] || 'Detail smluvního servisu';
        }
        if (serviceModalSubtitle) {
            const parts = [];
            if (baseRecord['Likvidace']) {
                parts.push('IČ: ' + String(baseRecord['Likvidace']));
            }
            if (baseRecord['KAM']) {
                parts.push('Smlouva: ' + String(baseRecord['KAM']));
            }
            serviceModalSubtitle.textContent = parts.join(' · ');
        }
        if (serviceModalMetaLine) {
            const region = baseRecord['Unnamed: 17'] || ''; // Kraj
            const city = baseRecord[CITY_COL] || '';
            const parts = [];
            if (city) parts.push(String(city));
            if (region) parts.push(String(region));
            serviceModalMetaLine.textContent = parts.join(' · ');
        }

        // Branch list
        serviceModalBranches.innerHTML = '';
        records.forEach(function (record, index) {
            const li = document.createElement('li');
            li.className = 'branches-list-item';
            li.dataset.index = String(index);

            const street = record[STREET_COL] != null ? record[STREET_COL] : '';
            const city = record[CITY_COL] != null ? record[CITY_COL] : '';
            const zip = record[ZIP_COL] != null ? record[ZIP_COL] : '';

            const label = document.createElement('span');
            label.className = 'service-modal-branch-label';
            label.textContent = street ? String(street) : 'Provozovna ' + (index + 1);

            const sub = document.createElement('span');
            sub.className = 'service-modal-branch-sub';
            sub.textContent = [zip, city].filter(Boolean).join(' ');

            li.appendChild(label);
            li.appendChild(sub);

            li.addEventListener('click', function () {
                const idx = parseInt(this.dataset.index || '0', 10) || 0;
                renderServiceModal(group, idx);
            });

            serviceModalBranches.appendChild(li);
        });

        // Highlight selected branch and render its detail
        const safeIndex = typeof selectedIndex === 'number' && selectedIndex >= 0 && selectedIndex < records.length
            ? selectedIndex
            : 0;

        const items = serviceModalBranches.querySelectorAll('.branches-list-item');
        items.forEach(function (item, idx) {
            if (idx === safeIndex) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        const selectedRecord = records[safeIndex];
        serviceModalBranchDetail.innerHTML = buildBranchDetailContent(selectedRecord);
    }

    function openServiceModal(group) {
        if (!serviceModal) return;
        renderServiceModal(group, 0);
        serviceModal.classList.add('visible');
        document.body.classList.add('modal-open');
    }

    function closeServiceModal() {
        if (!serviceModal) return;
        serviceModal.classList.remove('visible');
        document.body.classList.remove('modal-open');
    }

    // Fetch data_output.json and initialize table
    function loadData() {
        fetch(DATA_URL, { cache: 'no-cache' })
            .then(function (response) {
                if (!response.ok) {
                    throw new Error('Failed to load ' + DATA_URL + ': ' + response.status);
                }
                return response.json();
            })
            .then(function (json) {
                if (!json) {
                    throw new Error('Empty JSON response');
                }

                const meta = json.meta || {};
                const data = Array.isArray(json.data) ? json.data : [];
                const metaColumns = Array.isArray(meta.columns) ? meta.columns : [];

                rawRecords = data;

                // Store full list of columns for searching + detail view
                allColumns = metaColumns.length > 0 && data.length > 0
                    ? metaColumns
                    : (data.length > 0 ? Object.keys(data[0]) : []);

                // Load human-readable column labels from first row, if present
                if (rawRecords.length > 0 && rawRecords[0]['Legenda:'] === 'Stav') {
                    var headerRow = rawRecords[0];
                    columnDisplayNames = {};
                    allColumns.forEach(function (col) {
                        var headerVal = headerRow[col];
                        if (headerVal != null && String(headerVal).trim() !== '') {
                            columnDisplayNames[col] = headerVal;
                        }
                    });
                }

                // Determine which columns will be visible in main table
                var visible = DISPLAY_COLUMNS_ORDER.filter(function (c) {
                    return allColumns.indexOf(c) !== -1;
                });

                // Fallback: if none of the preferred columns are present, show first 3
                if (visible.length === 0) {
                    visible = allColumns.slice(0, 3);
                }

                columns = visible;

                // Build grouped view and render
                buildGroupsFromRawRecords();

                renderMeta(meta);
                renderHeader();
                // Initial render respects default tab (Auta) and empty search
                applyFilter();
            })
            .catch(function (error) {
                console.error(error);
                if (noResults) {
                    noResults.style.display = 'block';
                    noResults.textContent = 'Nepodařilo se načíst data ze souboru data_output.json.';
                }
                if (metaInfo) {
                    metaInfo.textContent = '';
                }
            });
    }

    // Init on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            if (searchInput) {
                searchInput.addEventListener('input', applyFilter);
            }

            // Modal close handlers
            if (serviceModalClose) {
                serviceModalClose.addEventListener('click', closeServiceModal);
            }
            if (serviceModal) {
                serviceModal.addEventListener('click', function (event) {
                    if (event.target === serviceModal) {
                        closeServiceModal();
                    }
                });
            }

            // Tab switching for Auta / BUS / Skla
            const tabButtons = document.querySelectorAll('.tab-button[data-type]');
            tabButtons.forEach(function (btn) {
                btn.addEventListener('click', function () {
                    const type = this.getAttribute('data-type') || 'auta';
                    currentTypeFilter = type;

                    tabButtons.forEach(function (b) { b.classList.remove('active'); });
                    this.classList.add('active');

                    applyFilter();
                });
            });

            loadData();
        });
    } else {
        if (searchInput) {
            searchInput.addEventListener('input', applyFilter);
        }
        if (serviceModalClose) {
            serviceModalClose.addEventListener('click', closeServiceModal);
        }
        if (serviceModal) {
            serviceModal.addEventListener('click', function (event) {
                if (event.target === serviceModal) {
                    closeServiceModal();
                }
            });
        }

        const tabButtons = document.querySelectorAll('.tab-button[data-type]');
        tabButtons.forEach(function (btn) {
            btn.addEventListener('click', function () {
                const type = this.getAttribute('data-type') || 'auta';
                currentTypeFilter = type;

                tabButtons.forEach(function (b) { b.classList.remove('active'); });
                this.classList.add('active');

                applyFilter();
            });
        });

        loadData();
    }
})();


