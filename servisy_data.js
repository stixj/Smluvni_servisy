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
    const serviceModalFooterClose = document.getElementById('serviceModalFooterClose');
    const serviceModalTitle = document.getElementById('serviceModalTitle');
    const serviceModalSubtitle = document.getElementById('serviceModalSubtitle');
    const serviceModalMetaLine = document.getElementById('serviceModalMetaLine');
    const serviceModalBranches = document.getElementById('serviceModalBranches');
    const serviceModalBranchListContainer = document.getElementById('serviceModalBranchListContainer');
    const serviceModalBranchDetail = document.getElementById('serviceModalBranchDetail');
    const detailArea = document.querySelector('.fade-area');
    const pageTitle = document.querySelector('.page-title');

    let rawRecords = [];       // original flat list from JSON
    let groupedRecords = [];   // records grouped by [KAM, Likvidace, KAPU]
    let columns = [];      // columns visible in main table (overview)
    let allColumns = [];   // all columns from dataset (for searching + detail)
    let columnDisplayNames = {}; // human-friendly labels loaded from header row
    let currentTypeFilter = 'auta'; // auta | bus | moto | skla | pdr
    let currentSearchTerm = ''; // current search term (for highlighting)

    // Mapping of technical column names to human-friendly labels for visible columns
    // Order in main table: Název servisu, IČ, Číslo smlouvy
    const DISPLAY_COLUMNS_ORDER = ['KAPU', 'Likvidace', 'KAM'];
    const COLUMN_LABELS = {
        KAM: 'Číslo smlouvy',
        Likvidace: 'IČ',
        KAPU: 'Název servisu'
    };

    // Known address-related columns from Excel header row
    const STREET_COL = 'Unnamed: 5'; // Ulice
    const ZIP_COL = 'Unnamed: 6';    // PSČ
    const CITY_COL = 'Unnamed: 7';   // Obec

    // Simple loading skeleton for main table (used before JSON data is ready)
    function showTableSkeleton() {
        if (!tableHeaderRow || !tableBody) {
            return;
        }

        // Clear any existing content
        tableHeaderRow.innerHTML = '';
        tableBody.innerHTML = '';

        // Create three generic header placeholders
        for (var i = 0; i < 3; i++) {
            var th = document.createElement('th');
            var box = document.createElement('div');
            box.className = 'skeleton-box skeleton-header';
            th.appendChild(box);
            tableHeaderRow.appendChild(th);
        }

        // Create a few skeleton rows
        for (var r = 0; r < 6; r++) {
            var tr = document.createElement('tr');
            tr.className = 'skeleton-row';
            for (var c = 0; c < 3; c++) {
                var td = document.createElement('td');
                var cellBox = document.createElement('div');
                cellBox.className = 'skeleton-box skeleton-cell';
                td.appendChild(cellBox);
                tr.appendChild(td);
            }
            tableBody.appendChild(tr);
        }

        if (noResults) {
            noResults.style.display = 'none';
        }
    }

    function hideTableSkeleton() {
        if (!tableHeaderRow || !tableBody) {
            return;
        }
        tableHeaderRow.innerHTML = '';
        tableBody.innerHTML = '';
    }

    // Helper: replay underline animation under main page title
    function triggerPageTitleUnderline() {
        if (!pageTitle) {
            return;
        }

        pageTitle.classList.remove('animate-underline');
        // Force reflow so the browser restarts the animation when class is re-added
        // eslint-disable-next-line no-unused-expressions
        void pageTitle.offsetWidth;
        pageTitle.classList.add('animate-underline');
    }

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

    // Helper: remove diacritics for search (aligned with index.html behaviour)
    function removeDiacritics(str) {
        if (!str) return '';
        const diacriticsMap = {
            'à': 'a', 'á': 'a', 'â': 'a', 'ã': 'a', 'ä': 'a', 'å': 'a',
            'è': 'e', 'é': 'e', 'ê': 'e', 'ë': 'e',
            'ì': 'i', 'í': 'i', 'î': 'i', 'ï': 'i',
            'ò': 'o', 'ó': 'o', 'ô': 'o', 'õ': 'o', 'ö': 'o',
            'ù': 'u', 'ú': 'u', 'û': 'u', 'ü': 'u',
            'ý': 'y', 'ÿ': 'y',
            'ñ': 'n', 'ç': 'c',
            'À': 'A', 'Á': 'A', 'Â': 'A', 'Ã': 'A', 'Ä': 'A', 'Å': 'A',
            'È': 'E', 'É': 'E', 'Ê': 'E', 'Ë': 'E',
            'Ì': 'I', 'Í': 'I', 'Î': 'I', 'Ï': 'I',
            'Ò': 'O', 'Ó': 'O', 'Ô': 'O', 'Õ': 'O', 'Ö': 'O',
            'Ù': 'U', 'Ú': 'U', 'Û': 'U', 'Ü': 'U',
            'Ý': 'Y', 'Ÿ': 'Y',
            'Ñ': 'N', 'Ç': 'C',
            'č': 'c', 'Č': 'C',
            'ď': 'd', 'Ď': 'D',
            'ě': 'e', 'Ě': 'E',
            'ň': 'n', 'Ň': 'N',
            'ř': 'r', 'Ř': 'R',
            'š': 's', 'Š': 'S',
            'ť': 't', 'Ť': 'T',
            'ů': 'u', 'Ů': 'U',
            'ž': 'z', 'Ž': 'Z',
            'ë': 'e', 'Ë': 'E',
            'ö': 'o', 'Ö': 'O',
            'ü': 'u', 'Ü': 'U'
        };

        return String(str).replace(/[^\u0000-\u007E]/g, function (char) {
            return diacriticsMap[char] || char.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        });
    }

    // Escape HTML for safe innerHTML rendering
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text == null ? '' : String(text);
        return div.innerHTML;
    }

    // Highlight search term(s) in plain text – behaviour aligned s index.html
    function highlightTextPlain(text, searchTerm) {
        if (!searchTerm || !text) {
            return escapeHtml(text);
        }

        const escapedText = escapeHtml(text);
        const normalizedText = removeDiacritics(String(text).toLowerCase());
        const normalizedSearchTerm = removeDiacritics(String(searchTerm).toLowerCase());

        const searchWords = normalizedSearchTerm.split(/\s+/).filter(function (word) { return word.length > 0; });
        if (!searchWords.length) {
            return escapedText;
        }

        // Check if all words are present v textu
        const allWordsPresent = searchWords.every(function (word) {
            return normalizedText.indexOf(word) !== -1;
        });
        if (!allWordsPresent) {
            return escapedText;
        }

        // Helper: najdi původní pozici podle normalizované pozice
        function findOriginalPosition(normalizedPos) {
            let normalizedCount = 0;
            for (let i = 0; i < escapedText.length; i++) {
                const normalizedChar = removeDiacritics(escapedText[i].toLowerCase());
                if (normalizedChar && normalizedChar.length > 0) {
                    if (normalizedCount === normalizedPos) {
                        return i;
                    }
                    normalizedCount++;
                }
            }
            return escapedText.length;
        }

        const highlightedRanges = [];

        // Najdi a označ všechny výskyty slov
        searchWords.forEach(function (word) {
            let searchIndex = 0;
            while (true) {
                const matchIndex = normalizedText.indexOf(word, searchIndex);
                if (matchIndex === -1) break;

                const originalStart = findOriginalPosition(matchIndex);
                const originalEnd = findOriginalPosition(matchIndex + word.length);

                highlightedRanges.push({ start: originalStart, end: originalEnd });
                searchIndex = matchIndex + 1;
            }
        });

        // Seřaď podle začátku
        highlightedRanges.sort(function (a, b) { return a.start - b.start; });

        // Slouč překrývající se intervaly
        const mergedRanges = [];
        for (let i = 0; i < highlightedRanges.length; i++) {
            if (!mergedRanges.length || highlightedRanges[i].start > mergedRanges[mergedRanges.length - 1].end) {
                mergedRanges.push({ start: highlightedRanges[i].start, end: highlightedRanges[i].end });
            } else {
                mergedRanges[mergedRanges.length - 1].end = Math.max(
                    mergedRanges[mergedRanges.length - 1].end,
                    highlightedRanges[i].end
                );
            }
        }

        // Poskládej výsledek s <mark>
        let result = '';
        let lastIndex = 0;

        mergedRanges.forEach(function (range) {
            result += escapedText.substring(lastIndex, range.start);
            result += '<mark class="highlight">' + escapedText.substring(range.start, range.end) + '</mark>';
            lastIndex = range.end;
        });

        result += escapedText.substring(lastIndex);
        return result;
    }

    // Helper: final repair of broken Czech letters where a letter and its
    // diacritic variant were split by an extra space during import.
    // Example: "Ka čírek" -> "Kačírek", "Hlavn í m ěsto" -> "Hlavní město"
    function fixCombinedDiacriticsText(text) {
        if (text == null) {
            return '';
        }

        let s = String(text);

        const pairs = {
            'a á': 'á', 'e é': 'é', 'i í': 'í', 'o ó': 'ó', 'u ú': 'ú',
            'u ů': 'ů', 'y ý': 'ý', 'r ř': 'ř', 's š': 'š', 't ť': 'ť',
            'd ď': 'ď', 'n ň': 'ň', 'z ž': 'ž', 'c č': 'č', 'l í': 'lí',
            'A Á': 'Á', 'E É': 'É', 'I Í': 'Í', 'O Ó': 'Ó', 'U Ú': 'Ú',
            'U Ů': 'Ů', 'Y Ý': 'Ý', 'R Ř': 'Ř', 'S Š': 'Š', 'T Ť': 'Ť',
            'D Ď': 'Ď', 'N Ň': 'Ň', 'Z Ž': 'Ž', 'C Č': 'Č',

            // common inside-word combinations (remove stray space inside word)
            'i á': 'iá', 'á š': 'áš', 'ě s': 'ěs', 'm ě': 'mě',
            'n í': 'ní', 'č í': 'čí', 'š o': 'šo', 'ě l': 'ěl',
            'r á': 'rá', 'ě n': 'ěn', 'ž í': 'ží', 'k ý': 'ký',
            'k á': 'ká', 'v ý': 'vý', 't ř': 'tř', 'h ý': 'hý',
            't í': 'tí'
        };

        Object.keys(pairs).forEach(function (bad) {
            const good = pairs[bad];
            if (s.indexOf(bad) !== -1) {
                s = s.split(bad).join(good);
            }
        });

        // Targeted fixes for known broken phrases from Excel header / data.
        const phraseFixes = {
            'Domansk ý': 'Domanský',
            'zna čky': 'značky',
            // multiple broken variants of the same header
            'Opravuj ízna čkyaut': 'Opravují značky aut',
            'Opravuj íznačkyaut': 'Opravují značky aut',
            'Prohl ídkov ém ísto': 'Prohlídkové místo',
            'Prohlídkov ém ísto': 'Prohlídkové místo',
            'Prohl ídka': 'Prohlídka',
            'Limitprohl ídkyod 15.9.2022': 'Limit prohlídky od 15. 9. 2022',
            'Limitprohlídkyod 15.9.2022': 'Limit prohlídky od 15. 9. 2022',
            'Zeměd ělsk á': 'Zemědělská',
            'Petr Nelh ýbel': 'Petr Nelhýbel',
            'Praha-v ýchod': 'Praha-východ',
            'St ředo česk ý kraj': 'Středočeský kraj',
            'Kontaktníosoba': 'Kontaktní osoba',
            'Provoznídoba': 'Provozní doba',
            'Pozn ámky': 'Poznámky',
            'Č íslosmlouvy': 'Číslo smlouvy',
            'IČfirmy': 'IČ firmy',
            'Názevfirmy': 'Název firmy',
            'dal š ípraskliny': 'další praskliny',
            'Kalibracekamery': 'Kalibrace kamery',
            'Slevanan áhradnídilydle AVN': 'Sleva na náhradní díly dle AVN',
            // specific broken company / address names
            'Václav Ka čírek': 'Václav Kačírek',
            'Ka čírek': 'Kačírek',
            'AUTODRUŽ STVOPRAHA': 'AUTODRUŽSTVO Praha',
            'Spojovac í': 'Spojovací',
            'Neautorizovan ýservis DIRECT': 'Neautorizovaný servis DIRECT',
            'Neautorizovan ýservis SAG': 'Neautorizovaný servis SAG',
            'v šechnavozidla': 'všechna vozidla',
            'Náměst í': 'Náměstí',
            'Středo český kraj': 'Středočeský kraj',
            // header labels for repair types and discounts
            'Mechanickávozidlamimoavn': 'Mechanická vozidla mimo AVN',
            'Klemp í řskávozidlamimoavn': 'Klempířská vozidla mimo AVN',
            'Klemp í řská': 'Klempířská',
            'Lakýrnick épráce': 'Lakýrnické práce',
            'Meachanická HD': 'Mechanická HD',
            'Klep í řská HD': 'Klempířská HD',
            'metalick éaperle ťov élaky': 'metalické a perleťové laky',
            'Slevanan áhradníd ílyamateriál': 'Sleva na náhradní díly a materiál',
            'drobn ýrežijnímateriál': 'drobný režijní materiál',
            'origin álnín áhradníd ílyamateriál': 'originální náhradní díly a materiál',
            'aftermarketov én áhradníd ílyamateriál': 'aftermarketové náhradní díly a materiál',
            'slevanapráci': 'sleva na práci',
            'origin álnípoužit én áhradníd ílyamateriál': 'originální použité náhradní díly a materiál',
            'Dod ávky+SUVv še': 'Dodávky + SUV vše',
            // notes and common phrases
            'Od 1.9.2021 jižneexistuje': 'Od 1. 9. 2021 již neexistuje',

            // additional specific company / address / person fixes seen in UI
            'Karos á ř CZ, s. r. o.': 'Karosář CZ, s. r. o.',
            'Karos á ř CZ, s.r.o.': 'Karosář CZ, s. r. o.',
            'Karos á ř Centrum s.r.o.': 'Karosář Centrum s. r. o.',
            'Ho škovice': 'Hoškovice',
            'Mnichovo Hradi št ě': 'Mnichovo Hradiště',
            'Šulcov á': 'Šulcová',
            'p í.Šulcov á': 'pí Šulcová',
            'PO-NEDLEDOHODY': 'Po–Ne dle dohody',
            'Jiř í': 'Jiří',
            'Ji ří': 'Jiří',
            'Hlav á ček': 'Hlaváček',
            'MBSAUTOSLUŽ BAMě LNÍK': 'MBSAUTOSLUŽBA Mělník',
            'AUTOPAPOUŠ EK s.r.o.': 'AUTO PAPOUŠEK s. r. o.',

            // AUTOSKLO K+M – oprava rozbitých mezer v názvu
            'AUTOSKLOK+M': 'AUTOSKLO K+M'
        };

        Object.keys(phraseFixes).forEach(function (bad) {
            const good = phraseFixes[bad];
            if (s.indexOf(bad) !== -1) {
                s = s.split(bad).join(good);
            }
        });

        // Generic fix: remove stray spaces *inside words* that appear
        // before/after Czech accented letters (both vowels and consonants).
        // Example:
        //   "Ho škovice" -> "Hoškovice"
        //   "Mnichovo Hradí št ě" -> "Mnichovo Hradiště"
        //   "Karos á ř" -> "Karosář"
        s = s.replace(
            /([A-Za-zÁÉÍÓÚŮÝŘŠŤĎŇŽČĚáéíóúůýřšťďňžčě])\s+([ÁÉÍÓÚŮÝŘŠŤĎŇŽČĚáéíóúůýřšťďňžčě])/g,
            '$1$2'
        );

        // basic punctuation / spacing cleanup
        s = s
            // add space after comma / semicolon if missing
            .replace(/,\s*/g, ', ')
            .replace(/;\s*/g, '; ')
            // add space after period if followed by a letter or digit
            .replace(/\.([^\s\d])/g, '. $1')
            // collapse multiple spaces that may remain
            .replace(/\s{2,}/g, ' ')
            .trim();

        return s;
    }

    // Helper: normalize any text *for display* (does NOT affect searching).
    function normalizeDisplayText(value) {
        if (value == null) {
            return '';
        }
        return fixCombinedDiacriticsText(String(value));
    }

    // Helper: normalize email address – remove all whitespace inside value.
    // Example: "autosklo@firma. cz" -> "autosklo@firma.cz"
    function normalizeEmail(value) {
        if (value == null) {
            return '';
        }
        return String(value).replace(/\s+/g, '').trim();
    }

    // Helper: format Czech phone numbers stored in a single string.
    // Example raw values:
    //  - "725321989.725321"  -> "725 321 989, 725 321"
    //  - "222123456"        -> "222 123 456"
    function formatPhoneDisplay(value) {
        if (value == null) {
            return '';
        }
        var raw = String(value);

        // Split by anything that is clearly a separator (comma, semicolon, slash, pipe, space, dot)
        var parts = raw.split(/[,\.;\/\|\s]+/).filter(function (p) { return !!p; });
        if (!parts.length) {
            return '';
        }

        function formatOne(num) {
            // keep only digits
            var digits = num.replace(/\D/g, '');
            if (!digits) {
                return '';
            }
            // Czech-style grouping for 9-digit numbers: 3 3 3
            if (digits.length === 9) {
                return digits.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3');
            }
            // fallback – group into blocks of 3 from the start
            return digits.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
        }

        var formatted = parts.map(formatOne).filter(function (p) { return !!p; });
        return formatted.join(', ');
    }

    // Helper: format Czech postal code (PSČ) for display – "18100" -> "181 00"
    // Keeps existing spacing if already present; used only for UI, not for searching.
    function formatZipDisplay(value) {
        if (value == null) {
            return '';
        }
        var s = String(value).trim();
        if (!s) {
            return '';
        }
        // If already contains whitespace, just normalize diacritics/spaces
        if (/\s/.test(s)) {
            return normalizeDisplayText(s);
        }
        // If it's exactly 5 digits, insert space after third digit
        var digits = s.replace(/\D/g, '');
        if (digits.length === 5 && digits === s) {
            return digits.replace(/(\d{3})(\d{2})/, '$1 $2');
        }
        // Fallback – keep as-is but apply generic normalization
        return normalizeDisplayText(s);
    }

    // Helper: format opening hours encoded as pipe-separated values
    // Example: "7:00-17:30|7:00-17:30|7:00-17:30|7:00-17:30|7:00-17:30|-|-."
    // Result:  "Po–Pá 7:00–17:30; So–Ne zavřeno"
    function formatOpeningHoursDisplay(value) {
        if (value == null) {
            return '';
        }

        var raw = String(value).trim();
        if (!raw) {
            return '';
        }

        var days = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];
        var segments = raw.split('|').map(function (part) {
            var cleaned = part.replace(/\.+$/, '').trim();
            if (!cleaned || cleaned === '-' || cleaned === '–') {
                return '';
            }
            return cleaned.replace('-', '–');
        });

        // Fallback – if counts don't match, just show normalized original
        if (segments.length !== days.length) {
            return normalizeDisplayText(raw);
        }

        var groups = [];
        var currentValue = segments[0];
        var currentStart = 0;

        function pushGroup(endIndex) {
            var label;
            if (currentStart === endIndex) {
                label = days[currentStart];
            } else {
                label = days[currentStart] + '–' + days[endIndex];
            }
            groups.push({
                label: label,
                value: currentValue
            });
        }

        for (var i = 1; i < segments.length; i++) {
            if (segments[i] === currentValue) {
                continue;
            }
            pushGroup(i - 1);
            currentValue = segments[i];
            currentStart = i;
        }
        pushGroup(segments.length - 1);

        var mapped = groups.map(function (g) {
            if (!g.value) {
                return g.label + ' zavřeno';
            }
            return g.label + ' ' + g.value;
        });

        return mapped.join('; ');
    }

    // Classify service into category: "auta", "bus", "moto", "skla", "pdr"
    function classifyType(record) {
        const druh = normalize(record['Unnamed: 11']);      // column "Druh" – lowercased
        const opravuje = normalize(record['Unnamed: 12']);  // column "Opravuje značky aut"
        const name = normalize(record['KAPU']);             // company name
        // Compact variant of DRUH without any whitespace; used for strict matching
        const druhCompact = druh.replace(/\s+/g, '');
        // Normalized DRUH without diacritics + whitespace for exact matching rules
        const druhKey = removeDiacritics(druh).replace(/\s+/g, '');

        // PDR – dedicated tab for services with type "PDR opravy" (or containing "pdr")
        const isPdr =
            druh &&
            (druh.indexOf('pdr opravy') !== -1 || druh.indexOf('pdr') !== -1);
        if (isPdr) {
            return 'pdr';
        }

        // Skla – ONLY rows where column "Druh" is exactly AutoskloDIRECT or MobilníautoskloDIRECT
        // (after removing diacritics / spaces we match 'autosklodirect' a 'mobilniautosklodirect').
        const isGlassByExactDruh =
            druhKey === 'autosklodirect' ||
            druhKey === 'mobilniautosklodirect';
        if (isGlassByExactDruh) {
            return 'skla';
        }

        // MOTO – strictly by DRUH column:
        // all rows where DRUH corresponds to "Autorizovaný servis DIRECT motocykly"
        // (in this or a slightly different textual format) belong to MOTO.
        // We build a diacritics-free, compact key and test it using "contains"
        // logic to be robust against small variations.
        let isMotoByDruh = false;
        if (druh) {
            var motoKey = removeDiacritics(druh)
                .toLowerCase()
                .replace(/[^a-z0-9]/g, ''); // remove spaces, dashes, etc.
            isMotoByDruh =
                motoKey.indexOf('autorizovanyservisdirectmotocykly') !== -1 ||
                motoKey.indexOf('autorizovanyservisdirectmoto') !== -1 ||
                motoKey.indexOf('autorizovanyservismotocykly') !== -1;
        }

        if (isMotoByDruh) {
            return 'moto';
        }

        // BUS – strictly by DRUH column:
        // only rows where DRUH equals "AutorizovanýnákladníservisDIRECT"
        // or "NeautorizovanýNákladníservis" (as stored in Excel) belong to NA/BUS.
        // We compare against a "compact" version (no spaces), so it also works
        // if Excel contains spaces inside the value.
        const isBusByDruh =
            druhCompact === 'autorizovanýnákladníservisdirect' ||
            druhCompact === 'neautorizovanýnákladníservis';

        if (isBusByDruh) {
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
            th.textContent = normalizeDisplayText(COLUMN_LABELS[col] || col);
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

    // Helper: convert label text to sentence case for UI consistency
    function toSentenceCase(label) {
        if (!label) {
            return '';
        }
        var s = String(label).trim();
        if (!s) {
            return '';
        }
        return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
    }

    // Helper: build clickable mailto link for email values
    function buildEmailLink(value) {
        if (value == null) {
            return '';
        }
        var raw = normalizeEmail(value);
        if (!raw) {
            return '';
        }
        // For emails we *do not* pass through normalizeDisplayText, because that
        // function adds spaces after tečkas (.) which would break addresses
        // like "autosklo@firma.cz" -> "autosklo@firma. cz".
        return '<a href="mailto:' + raw + '">' + raw + '</a>';
    }

    // Helper: build clickable tel link using the first phone number
    function buildPhoneLink(raw) {
        if (raw == null) {
            return '';
        }
        var str = String(raw);
        var parts = str.split(/[,\.;\/\|\s]+/).filter(function (p) { return !!p; });
        if (!parts.length) {
            return '';
        }
        var first = parts[0];
        var digits = first.replace(/\D/g, '');
        if (!digits) {
            return '';
        }
        var display = formatPhoneDisplay(str);
        return '<a href="tel:' + digits + '">' + display + '</a>';
    }

        // Fade + slide animation area for branch detail.
        // Uses Framer Motion style animation via Motion One when available,
        // falls back to a simple CSS-based fade transition.
    function refreshDetail(contentHtml) {
        if (!detailArea) return;

        var motionAnimate = (typeof window !== 'undefined') ? window.motionAnimate : null;

        // Framer Motion-style transition using Motion One (fade + slide on Y axis)
        if (typeof motionAnimate === 'function') {
            // Jemný fade + slide na ose Y, 0.2s ease-in-out
            motionAnimate(
                detailArea,
                { opacity: 0, y: 8 },
                { duration: 0.2, easing: 'ease-in-out' }
            ).finished.then(function () {
                detailArea.innerHTML = contentHtml;
                motionAnimate(
                    detailArea,
                    { opacity: [0, 1], y: [-8, 0] },
                    { duration: 0.2, easing: 'ease-in-out' }
                );
            });
            return;
        }

        // Fallback: CSS-based fade + slide na ose Y
        detailArea.classList.add('is-updating');
        setTimeout(function () {
            detailArea.innerHTML = contentHtml;
            detailArea.classList.remove('is-updating');
        }, 200);
    }

    // Build inner HTML for the right-hand detail panel of a single branch (record)
    function buildBranchDetailContent(record) {
        if (!record) {
            return '';
        }

        // Local helper: find first column whose *header label* contains given substring
        function findColumnByHeaderSubstring(substring) {
            if (!columnDisplayNames || !allColumns || !allColumns.length) {
                return null;
            }
            var target = String(substring).toLowerCase();
            var found = null;
            allColumns.forEach(function (col) {
                if (found) {
                    return;
                }
                var headerVal = columnDisplayNames[col];
                if (headerVal == null) {
                    return;
                }
                var label = normalizeDisplayText(headerVal).toLowerCase();
                if (label.indexOf(target) !== -1) {
                    found = col;
                }
            });
            return found;
        }

        // Helper: find column whose *header label* exactly matches given label
        // (after diacritics/spacing normalization). Falls back to null if not found.
        function findColumnByHeaderLabel(label) {
            if (!label || !columnDisplayNames || !allColumns || !allColumns.length) {
                return null;
            }
            var target = normalizeDisplayText(label).toLowerCase();
            var found = null;
            allColumns.forEach(function (col) {
                if (found) {
                    return;
                }
                var headerVal = columnDisplayNames[col];
                if (headerVal == null) {
                    return;
                }
                var normalizedHeader = normalizeDisplayText(headerVal).toLowerCase();
                if (normalizedHeader === target) {
                    found = col;
                }
            });
            return found;
        }

        // Address block (street + ZIP + city)
        const street = record[STREET_COL] != null ? normalizeDisplayText(record[STREET_COL]) : '';
        const zipVal = record[ZIP_COL] != null ? formatZipDisplay(record[ZIP_COL]) : '';
        const city = record[CITY_COL] != null ? normalizeDisplayText(record[CITY_COL]) : '';
        var addressHtml = '';
        if (street || zipVal || city) {
            var addressLines = [];
            if (street) addressLines.push(street);
            if (zipVal || city) addressLines.push([zipVal, city].filter(Boolean).join(' '));
            addressHtml = addressLines.join('<br>');
        }

        // GPS coordinates (used for map link)
        const gpsLat = record['Unnamed: 18'];
        const gpsLng = record['Unnamed: 19'];
        var mapLinkHtml = '';
        if (gpsLat != null && gpsLng != null) {
            var latStr = String(gpsLat).trim();
            var lngStr = String(gpsLng).trim();
            if (latStr && lngStr) {
                var mapUrl = 'https://maps.google.com/?q=' + encodeURIComponent(latStr + ',' + lngStr);
                mapLinkHtml =
                    '<a class="map-link icon-fade-in" target="_blank" rel="noopener noreferrer" href="' + mapUrl + '"' +
                    ' aria-label="Zobrazit na mapě v Mapách Google">' +
                    '\ud83d\udccd <span>Zobrazit na map\u011b</span>' +
                    '</a>';
            }
        }

        // Kontakt – email + telefon sjednocené v jedné sekci
        const emailRaw = record['Unnamed: 9'];
        const phoneRaw = record['Unnamed: 10'];
        // Kontaktní osoba – podle hlavičky sloupce, aby bylo robustní vůči změnám pozic
        var contactName = '';
        var contactNameCol = findColumnByHeaderSubstring('Kontaktní osoba');
        if (contactNameCol && record[contactNameCol] != null) {
            contactName = normalizeDisplayText(record[contactNameCol]);
        }

        // Servisní údaje – konkrétní sloupce
        const druhVal = record['Unnamed: 11'] != null ? normalizeDisplayText(record['Unnamed: 11']) : '';
        const znackyVal = record['Unnamed: 12'] != null ? normalizeDisplayText(record['Unnamed: 12']) : '';

        var prohlidkoveMisto = '';
        var prohlidkoveMistoCol = findColumnByHeaderSubstring('Prohlídkové místo');
        if (prohlidkoveMistoCol && record[prohlidkoveMistoCol] != null) {
            prohlidkoveMisto = normalizeDisplayText(record[prohlidkoveMistoCol]);
        }

        const provozniDobaRaw = record['Unnamed: 14'];
        const provozniDoba = provozniDobaRaw != null ? formatOpeningHoursDisplay(provozniDobaRaw) : '';

        var limitProhlidky = '';
        var limitProhlidkyCol = findColumnByHeaderSubstring('Limit prohlídky');
        if (limitProhlidkyCol && record[limitProhlidkyCol] != null) {
            limitProhlidky = normalizeDisplayText(record[limitProhlidkyCol]);
        }

        // Repair rates and discounts – these were shown in the previous UI
        // and are important for users; we bring them back into the new layout.
        function getNumericFieldByHeaderLabel(primaryLabel, fallbackSubstring) {
            var col = findColumnByHeaderLabel(primaryLabel) ||
                (fallbackSubstring ? findColumnByHeaderSubstring(fallbackSubstring) : null);
            if (!col || record[col] == null) {
                return '';
            }
            var raw = String(record[col]).trim();
            if (!raw) {
                return '';
            }
            return normalizeDisplayText(raw);
        }

        var sazbaMechanicka = getNumericFieldByHeaderLabel('Mechanická', 'Mechanická');
        var sazbaKlempirska = getNumericFieldByHeaderLabel('Klempířská', 'Klempířská');
        var sazbaLakyrnicke = getNumericFieldByHeaderLabel('Lakýrnické práce', 'Lakýrnické práce');
        var slevaAztUni = getNumericFieldByHeaderLabel('AZT–UNIlaky', 'AZT–UNIlaky');
        var slevaMetalPerlet = getNumericFieldByHeaderLabel(
            'metalické a perleťové laky',
            'metalické a perleťové laky'
        );
        var slevaNahradniDily = getNumericFieldByHeaderLabel(
            'Sleva na náhradní díly a materiál',
            'Sleva na náhradní díly a materiál'
        );
        var slevaDrobnyRezijni = getNumericFieldByHeaderLabel(
            'drobný režijní materiál',
            'drobný režijní materiál'
        );
        var slevaAftermarket = getNumericFieldByHeaderLabel(
            'aftermarketové náhradní díly a materiál',
            'aftermarketové náhradní díly a materiál'
        );
        // Skla – specifické sazby a slevy z Excelu
        var avnSleva = getNumericFieldByHeaderLabel('AVNsleva', 'AVN');
        var cebiGlassGT = getNumericFieldByHeaderLabel('Cebi Glass GT', 'Cebi');
        var audaGlass = getNumericFieldByHeaderLabel('Auda Glass', 'Auda');
        var prvniPrasklina = getNumericFieldByHeaderLabel('Prvníprasklina', 'První prasklina');
        var dalsiPraskliny = getNumericFieldByHeaderLabel('další praskliny', 'praskliny');
        var kalibraceKamery = getNumericFieldByHeaderLabel('Kalibrace kamery', 'Kalibrace');

        // Formatting helpers for numeric values with units
        function formatCurrencyCZK(value) {
            if (value == null) {
                return '';
            }
            var s = String(value).trim();
            if (!s) {
                return '';
            }
            var lower = s.toLowerCase();
            // If already contains Kč, just normalize and return
            if (lower.indexOf('kč') !== -1) {
                return normalizeDisplayText(s);
            }
            // Extract digits for grouping
            var digits = s.replace(/\D/g, '');
            if (!digits) {
                // Fallback – non-numeric content, only append unit
                return normalizeDisplayText(s) + ' Kč';
            }
            var out = '';
            while (digits.length > 3) {
                out = ' ' + digits.slice(-3) + out;
                digits = digits.slice(0, -3);
            }
            out = digits + out;
            return out + ' Kč';
        }

        function formatPercent(value) {
            if (value == null) {
                return '';
            }
            var s = String(value).trim();
            if (!s) {
                return '';
            }
            var lower = s.toLowerCase();
            if (lower.indexOf('%') !== -1) {
                // Already contains percent sign – just normalize spaces
                return normalizeDisplayText(s);
            }
            var digits = s.replace(/[^\d,\.]/g, '');
            if (!digits) {
                return normalizeDisplayText(s) + ' %';
            }
            return digits + ' %';
        }

        // Helper: some Excel values for glass-related discounts are stored as fractions
        // (e.g. 0,05 instead of 5). For AVN sleva, CebiGlass GT a AudaGlass je přepočítáme na celé %.
        function normalizeFractionPercent(value) {
            if (value == null) {
                return value;
            }
            var s = String(value).trim();
            if (!s) {
                return s;
            }
            // strip percent sign and whitespace, unify decimal separator
            var cleaned = s.replace('%', '').replace(/\s+/g, '').replace(',', '.');
            var num = parseFloat(cleaned);
            if (!isFinite(num)) {
                return value;
            }
            // Only treat numbers between 0 and 1 (exclusive) as fractions to be scaled
            if (num > 0 && num < 1) {
                var scaled = num * 100;
                var rounded = Math.round(scaled * 100) / 100; // max 2 decimals
                var text = String(rounded);
                // remove trailing .0 / .00
                if (text.indexOf('.') !== -1) {
                    text = text
                        .replace(/\.0+$/, '')
                        .replace(/(\.\d*[1-9])0+$/, '$1');
                }
                return text;
            }
            return value;
        }

        // Přepočet frakčních hodnot na procenta pro AVN / CebiGlass / AudaGlass a slevu na ND
        avnSleva = normalizeFractionPercent(avnSleva);
        cebiGlassGT = normalizeFractionPercent(cebiGlassGT);
        audaGlass = normalizeFractionPercent(audaGlass);
        slevaNahradniDily = normalizeFractionPercent(slevaNahradniDily);

        // Lokalita – okres + kraj
        var okres = '';
        var okresCol = findColumnByHeaderSubstring('Okres');
        if (okresCol && record[okresCol] != null) {
            okres = normalizeDisplayText(record[okresCol]);
        }

        var kraj = '';
        // Preferujeme známý sloupec s krajem, případně jej hledáme podle hlavičky
        if (record['Unnamed: 17'] != null) {
            kraj = normalizeDisplayText(record['Unnamed: 17']);
        } else {
            var krajCol = findColumnByHeaderSubstring('Kraj');
            if (krajCol && record[krajCol] != null) {
                kraj = normalizeDisplayText(record[krajCol]);
            }
        }

        // Phone helpers – first number for tel: link, pretty display for text
        var phoneDigits = '';
        var phoneDisplay = '';
        if (phoneRaw != null && String(phoneRaw).trim() !== '') {
            var phoneStr = String(phoneRaw);
            var phoneParts = phoneStr.split(/[,\.;\/\|\s]+/).filter(function (p) { return !!p; });
            if (phoneParts.length) {
                phoneDigits = phoneParts[0].replace(/\D/g, '');
            }
            phoneDisplay = formatPhoneDisplay(phoneRaw);
        }

        // Header block for detail section – title + optional "Limit prohlídky" on the right
        var headerHtml = '<div class="detail-header"><h3>Detail vybrané provozovny</h3>';
        if (limitProhlidky) {
            headerHtml += '<span class="limit-info">Limit prohlídky: ' + formatCurrencyCZK(limitProhlidky) + '</span>';
        }
        headerHtml += '</div>';

        var hasAnyContent =
            !!(street || zipVal || city) ||
            !!mapLinkHtml ||
            !!(contactName || emailRaw || phoneDigits) ||
            !!(druhVal || znackyVal || prohlidkoveMisto || provozniDoba || limitProhlidky ||
                sazbaMechanicka || sazbaKlempirska || sazbaLakyrnicke ||
                slevaAztUni || slevaMetalPerlet ||
                slevaNahradniDily || slevaDrobnyRezijni || slevaAftermarket ||
                avnSleva || cebiGlassGT || audaGlass ||
                prvniPrasklina || dalsiPraskliny || kalibraceKamery) ||
            !!(okres || kraj);

        if (!hasAnyContent) {
            return headerHtml + '<p>Žádné údaje k zobrazení.</p>';
        }

        var parts = [];
        parts.push(headerHtml);

        // --- 1) Adresa a kontakt ve dvousloupcovém layoutu (info-row) ---
        var hasAddressBlock = !!(addressHtml || mapLinkHtml || okres || kraj);
        var hasContactBlock = !!(contactName || emailRaw || phoneDigits);

        if (hasAddressBlock || hasContactBlock) {
            parts.push('<section class="info-block info-block-address">');

            // Build tooltip content (Okres + Kraj) once and place icon next to main heading
            var locLines = [];
            if (okres) {
                locLines.push('Okres: ' + okres);
            }
            if (kraj) {
                // Show only the plain region name without "Kraj:" prefix,
                // e.g. "Středočeský kraj".
                locLines.push(kraj);
            }
            var tooltipContent = locLines.join('<br>');

            // Shared header row: "Adresa" on the left, optional "Kontakt" on the right
            var headingHtml = '<div class="info-row-header">';
            headingHtml += '<h4 class="info-row-title">Adresa';
            if (tooltipContent) {
                headingHtml +=
                    ' <button class="info-icon" type="button" tabindex="0" aria-label="Zobrazit informaci o okrese a kraji">' +
                    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="currentColor">' +
                    '<circle cx="12" cy="12" r="10" fill="#1f523f"></circle>' +
                    '<text x="12" y="17" text-anchor="middle" font-size="14" fill="#fff" font-family="Arial">i</text>' +
                    '</svg>' +
                    '<span class="tooltip">' + tooltipContent + '</span>' +
                    '</button>';
            }
            headingHtml += '</h4>';
            if (hasContactBlock) {
                headingHtml += '<h4 class="info-row-title info-row-title--contact">Kontakt</h4>';
            }
            headingHtml += '</div>';
            parts.push(headingHtml);

            parts.push('<div class="info-row">');

            // Left column – address
            if (hasAddressBlock) {
                parts.push('<div class="address-block">');
                if (addressHtml) {
                    parts.push('<p>' + addressHtml + '</p>');
                }
                if (mapLinkHtml) {
                    parts.push('<p>' + mapLinkHtml + '</p>');
                }
                parts.push('</div>');
            }

            // Right column – contact
            if (hasContactBlock) {
                parts.push('<div class="contact-block">');

                // Show contact person name above e‑mail/phone, if available
                if (contactName) {
                    parts.push('<p><b>' + contactName + '</b></p>');
                }

                var contactLines = [];
                if (emailRaw != null && String(emailRaw).trim() !== '') {
                    var emailStr = normalizeEmail(emailRaw);
                    // Display e-mail exactly as normalized (without inserting spaces
                    // after tečkas), so that we do not get " .cz" apod.
                    contactLines.push(
                        '<a href="mailto:' + emailStr + '" class="link link--email icon-fade-in" aria-label="Napsat e-mail na ' + emailStr + '">' +
                        emailStr +
                        '</a>'
                    );
                }
                if (phoneDigits) {
                    contactLines.push(
                        '<a href="tel:' + phoneDigits + '" class="link link--phone icon-fade-in" aria-label="Zavolat na ' + phoneDisplay + '">' +
                        phoneDisplay +
                        '</a>'
                    );
                }
                if (contactLines.length) {
                    parts.push('<p>' + contactLines.join('<br>') + '</p>');
                }

                parts.push('</div>');
            }

            parts.push('</div>'); // .info-row
            parts.push('</section>'); // .info-block.info-block-address
        }

        // --- 2) Servisní údaje – přehled základních parametrů servisu ---
        var hasServiceInfoBlock = !!(druhVal || znackyVal || prohlidkoveMisto || provozniDoba);

        if (hasServiceInfoBlock) {
            if (hasAddressBlock || hasContactBlock) {
                parts.push('<div class="detail-section-separator"></div>');
            }

            parts.push('<section class="info-block servisni-udaje">');
            parts.push('<h4>Servisní údaje</h4>');
            parts.push('<ul class="spec-list">');

            if (druhVal) {
                parts.push(
                    '<li><span class="label">Druh servisu:</span>' +
                    '<span class="value">' + druhVal + '</span></li>'
                );
            }
            if (znackyVal) {
                parts.push(
                    '<li><span class="label">Opravované značky:</span>' +
                    '<span class="value">' + znackyVal + '</span></li>'
                );
            }
            if (prohlidkoveMisto) {
                parts.push(
                    '<li><span class="label">Prohlídkové místo:</span>' +
                    '<span class="value">' + prohlidkoveMisto + '</span></li>'
                );
            }
            if (provozniDoba) {
                parts.push(
                    '<li><span class="label">Provozní doba:</span>' +
                    '<span class="value">' + provozniDoba + '</span></li>'
                );
            }

            parts.push('</ul>');
            parts.push('</section>');
        }

        // --- 3) Koeficienty – pracovní sazby a koeficienty lakování ---
        var hasRatesBlock = !!(sazbaMechanicka || sazbaKlempirska || sazbaLakyrnicke);
        var hasPaintCoeffsBlock = !!(slevaAztUni || slevaMetalPerlet);
        var hasDiscountsBlock = !!(slevaAftermarket || avnSleva || cebiGlassGT || audaGlass || slevaDrobnyRezijni);

        // Samostatný card-block pro "Hodinové sazby"
        if (hasRatesBlock) {
            if (hasAddressBlock || hasContactBlock || hasServiceInfoBlock) {
                parts.push('<div class="detail-section-separator"></div>');
            }

            parts.push('<section class="info-block servisni-udaje koeficienty-section rates-section">');
            parts.push('<h4>Hodinové sazby</h4>');
            parts.push('<ul class="spec-list">');

            if (sazbaMechanicka) {
                parts.push(
                    '<li><span class="label">Mechanická práce:</span>' +
                    '<span class="value">' + formatCurrencyCZK(sazbaMechanicka) + '</span></li>'
                );
            }
            if (sazbaKlempirska) {
                parts.push(
                    '<li><span class="label">Klempířská práce:</span>' +
                    '<span class="value">' + formatCurrencyCZK(sazbaKlempirska) + '</span></li>'
                );
            }
            if (sazbaLakyrnicke) {
                parts.push(
                    '<li><span class="label">Lakýrnická práce:</span>' +
                    '<span class="value">' + formatCurrencyCZK(sazbaLakyrnicke) + '</span></li>'
                );
            }

            parts.push('</ul>');
            parts.push('</section>');
        }

        // Samostatný card-block pro "Koeficienty lakování"
        if (hasPaintCoeffsBlock) {
            // Pokud před tím byl jiný obsah (např. Hodinové sazby), necháme sekce
            // oddělit pouze vertikálním whitespace definovaným v CSS (.info-block).
            if (!hasRatesBlock && (hasAddressBlock || hasContactBlock || hasServiceInfoBlock)) {
                parts.push('<div class="detail-section-separator"></div>');
            }

            parts.push('<section class="info-block servisni-udaje koeficienty-section paint-coeffs-section">');
            parts.push('<h4>Koeficienty lakování</h4>');
            parts.push('<ul class="spec-list">');

            if (slevaAztUni) {
                parts.push(
                    '<li><span class="label">AZT - UNILAK:</span>' +
                    '<span class="value">' + formatPercent(slevaAztUni) + '</span></li>'
                );
            }
            if (slevaMetalPerlet) {
                parts.push(
                    '<li><span class="label">Metalické a perleťové laky:</span>' +
                    '<span class="value">' + formatPercent(slevaMetalPerlet) + '</span></li>'
                );
            }

            parts.push('</ul>');
            parts.push('</section>');
        }

        // --- 4) Slevy – slevy na díly, skla a režijní náklady ---
        if (hasDiscountsBlock) {
            parts.push('<div class="detail-section-separator"></div>');
            parts.push('<section class="info-block servisni-udaje slevy-section">');
            parts.push('<h4>Slevy</h4>');
            parts.push('<ul class="spec-list">');

            // Sleva na náhradní díly a materiál – prioritně aftermarketové ND
            if (slevaAftermarket) {
                parts.push(
                    '<li><span class="label">Sleva na náhradní díly a materiál:</span>' +
                    '<span class="value">' + formatPercent(slevaAftermarket) + '</span></li>'
                );
            }

            // Slevy na skla – AVN / CebiGlass GT / AudaGlass
            if (avnSleva || cebiGlassGT || audaGlass) {
                var glassParts = [];
                if (avnSleva) {
                    glassParts.push('AVN ' + formatPercent(avnSleva));
                }
                if (cebiGlassGT) {
                    glassParts.push('CebiGlass GT ' + formatPercent(cebiGlassGT));
                }
                if (audaGlass) {
                    glassParts.push('AudaGlass ' + formatPercent(audaGlass));
                }
                parts.push(
                    '<li><span class="label">Sleva na skla:</span>' +
                    '<span class="value">' + glassParts.join(' \u00b7 ') + '</span></li>'
                );
            }

            if (slevaDrobnyRezijni) {
                parts.push(
                    '<li><span class="label">Drobné režijní náklady:</span>' +
                    '<span class="value">' + formatPercent(slevaDrobnyRezijni) + '</span></li>'
                );
            }

            parts.push('</ul>');
            parts.push('</section>');
        }

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
            tr.tabIndex = 0;
            tr.setAttribute('role', 'button');

            columns.forEach(function (col) {
                const td = document.createElement('td');
                const rawValue = baseRecord[col] != null ? normalizeDisplayText(baseRecord[col]) : '';

                // When searching, highlight matches like in index.html
                if (currentSearchTerm) {
                    td.innerHTML = highlightTextPlain(rawValue, currentSearchTerm);
                } else {
                    td.textContent = rawValue;
                }

                tr.appendChild(td);
            });

            // Open modal with grouped detail on click or keyboard
            tr.addEventListener('click', function () {
                openServiceModal(group);
            });
            tr.addEventListener('keydown', function (event) {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openServiceModal(group);
                }
            });

            tableBody.appendChild(tr);
        });
    }

    // Apply search filter across all columns + current tab (Auta / BUS / Skla)
    function applyFilter() {
        if (!searchInput) {
            renderBody(groupedRecords);
            return;
        }

        // Store original term for highlighting
        currentSearchTerm = (searchInput.value || '').trim();
        const normalizedSearchTerm = removeDiacritics(currentSearchTerm.toLowerCase());

        // First apply type (tab) filter on grouped records
        let base = groupedRecords.filter(function (group) {
            const type = group.type || 'auta';

            if (currentTypeFilter === 'bus') {
                return type === 'bus';
            }
            if (currentTypeFilter === 'moto') {
                return type === 'moto';
            }
            if (currentTypeFilter === 'skla') {
                return type === 'skla';
            }
            if (currentTypeFilter === 'pdr') {
                return type === 'pdr';
            }

            // Default tab "Auta"
            return type === 'auta';
        });

        // Then apply search filter inside selected type
        if (!normalizedSearchTerm) {
            renderBody(base);
            return;
        }

        // Split search term into words – all must be present (like in index.html)
        const searchWords = normalizedSearchTerm.split(/\s+/).filter(function (w) { return w.length > 0; });

        const filtered = base.filter(function (group) {
            // Match if ANY branch in the group matches search term across ANY column
            return group.records.some(function (record) {
                // Build combined searchable text from all columns for this record
                const combined = allColumns.map(function (col) {
                    const value = record[col];
                    if (value == null) return '';
                    return removeDiacritics(String(value).toLowerCase());
                }).join(' ');

                // All words must be present (AND logic)
                return searchWords.every(function (word) {
                    return combined.indexOf(word) !== -1;
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

    // Build groupedRecords from rawRecords.
    // We group *separately per tab type* (auta / bus / moto / skla / pdr),
    // so that one servis může mít různé pobočky v různých záložkách.
    function buildGroupsFromRawRecords() {
        // One map per type; keys are still based on (KAPU, Likvidace, KAM)
        const mapsByType = {
            auta: new Map(),
            bus: new Map(),
            moto: new Map(),
            skla: new Map(),
            pdr: new Map()
        };

        const groups = [];

        rawRecords.forEach(function (record, index) {
            const legend = record['Legenda:'];

            // First row is header / legend row (contains labels like "Stav")
            if (legend === 'Stav' && index === 0) {
                return;
            }

            const type = classifyType(record) || 'auta';
            const typeMap = mapsByType[type] || mapsByType.auta;

            const keyParts = DISPLAY_COLUMNS_ORDER.map(function (col) {
                return record[col] != null ? String(record[col]) : '';
            });
            const key = keyParts.join('||');

            if (!typeMap.has(key)) {
                const group = {
                    key: key,
                    type: type,
                    displayRecord: record,
                    records: [record]
                };
                typeMap.set(key, group);
                groups.push(group);
            } else {
                const group = typeMap.get(key);
                group.records.push(record);
            }
        });

        groupedRecords = groups;
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
            serviceModalTitle.textContent = normalizeDisplayText(baseRecord['KAPU'] || 'Detail smluvního servisu');
        }
        if (serviceModalSubtitle) {
            const subtitleParts = [];
            if (baseRecord['Likvidace']) {
                subtitleParts.push(
                    '<span class="service-meta-chip">IČ: ' +
                    normalizeDisplayText(baseRecord['Likvidace']) +
                    '</span>'
                );
            }
            if (baseRecord['KAM']) {
                subtitleParts.push(
                    '<span class="service-meta-chip">Smlouva: ' +
                    normalizeDisplayText(baseRecord['KAM']) +
                    '</span>'
                );
            }
            serviceModalSubtitle.innerHTML = subtitleParts.join('');
        }
        if (serviceModalMetaLine) {
            const region = baseRecord['Unnamed: 17'] || ''; // Kraj
            const city = baseRecord[CITY_COL] || '';
            const metaParts = [];
            if (region) {
                // Show only the region name itself (e.g. "Středočeský kraj"),
                // without an extra "Kraj:" label prefix.
                metaParts.push(
                    '<span class="service-meta-chip">' +
                    normalizeDisplayText(region) +
                    '</span>'
                );
            }
            if (city) {
                metaParts.push(
                    '<span class="service-meta-chip">' +
                    normalizeDisplayText(city) +
                    '</span>'
                );
            }
            serviceModalMetaLine.innerHTML = metaParts.join('');
        }

        // Branch list + optional mobile select
        serviceModalBranches.innerHTML = '';

        var branchSelect = document.getElementById('serviceModalBranchSelect');
        if (branchSelect) {
            branchSelect.innerHTML = '';
        }

        records.forEach(function (record, index) {
            const li = document.createElement('li');
            // Keep original class for backwards compatibility, add new .branch-item for updated UI
            li.className = 'branches-list-item branch-item';
            li.dataset.index = String(index);
            li.tabIndex = 0;
            li.setAttribute('role', 'button');

            const street = record[STREET_COL] != null ? normalizeDisplayText(record[STREET_COL]) : '';
            const city = record[CITY_COL] != null ? normalizeDisplayText(record[CITY_COL]) : '';
            const zip = record[ZIP_COL] != null ? formatZipDisplay(record[ZIP_COL]) : '';
            const hasStreet = !!street;
            const hasZipOrCity = !!zip || !!city;
            const secondLine = [zip, city].filter(Boolean).join(' ');

            const accent = document.createElement('span');
            accent.className = 'branch-item-accent';

            const label = document.createElement('span');
            label.className = 'service-modal-branch-label';
            // Dvouřádkový styl:
            //  - 1. řádek: ulice, nebo pokud chybí ulice a existuje PSČ/obec,
            //    tak "PSČ obec". Pokud není nic, použije se "Provozovna X".
            //  - 2. řádek: PSČ + obec, ale jen pokud máme zároveň ulici i
            //    další adresní info – tím se vyhneme duplikaci stejného textu.
            if (hasStreet) {
                label.textContent = street;
            } else if (hasZipOrCity) {
                label.textContent = [zip, city].filter(Boolean).join(' ');
            } else {
                label.textContent = 'Provozovna ' + (index + 1);
            }

            const sub = document.createElement('span');
            sub.className = 'service-modal-branch-sub';
            // 2. řádek: zobraz PSČ + obec všude tam, kde je k dispozici
            // alespoň jedna z těchto hodnot. Tím sjednotíme vzhled mezi
            // jednotlivými záložkami (Auta/BUS/Skla).
            sub.textContent = secondLine;

            li.appendChild(accent);
            li.appendChild(label);
            li.appendChild(sub);

            li.addEventListener('click', function () {
                const idx = parseInt(this.dataset.index || '0', 10) || 0;
                renderServiceModal(group, idx);
            });

            li.addEventListener('keydown', function (event) {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    const idx = parseInt(this.dataset.index || '0', 10) || 0;
                    renderServiceModal(group, idx);
                }
            });

            serviceModalBranches.appendChild(li);

            if (branchSelect) {
                var opt = document.createElement('option');
                opt.value = String(index);
                if (street && secondLine) {
                    opt.textContent = street + ' – ' + secondLine;
                } else if (street) {
                    opt.textContent = street;
                } else if (secondLine) {
                    opt.textContent = secondLine;
                } else {
                    opt.textContent = 'Provozovna ' + (index + 1);
                }
                branchSelect.appendChild(opt);
            }
        });

        // Highlight selected branch and render its detail
        const safeIndex = typeof selectedIndex === 'number' && selectedIndex >= 0 && selectedIndex < records.length
            ? selectedIndex
            : 0;

        const items = serviceModalBranches.querySelectorAll('.branches-list-item');
        items.forEach(function (item, idx) {
            if (idx === safeIndex) {
                item.classList.add('active', 'is-active');
            } else {
                item.classList.remove('active', 'is-active');
            }
        });

        // Hide / show left panel when there is only a single branch
        const columnsWrap = serviceModal.querySelector('.columns-wrap');
        const hasMultipleBranches = records.length > 1;
        if (columnsWrap) {
            if (hasMultipleBranches) {
                columnsWrap.classList.remove('single-branch');
            } else {
                columnsWrap.classList.add('single-branch');
            }
        }
        if (serviceModalBranchListContainer) {
            if (hasMultipleBranches) {
                serviceModalBranchListContainer.classList.remove('single-branch');
            } else {
                serviceModalBranchListContainer.classList.add('single-branch');
            }
        }

        if (branchSelect) {
            branchSelect.value = String(safeIndex);
            branchSelect.onchange = function () {
                var idx = parseInt(this.value || '0', 10) || 0;
                renderServiceModal(group, idx);
            };
        }

        const selectedRecord = records[safeIndex];
        refreshDetail(buildBranchDetailContent(selectedRecord));
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
        // Show lightweight skeleton while we wait for JSON response
        showTableSkeleton();

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

                // Replace skeleton with actual content
                hideTableSkeleton();

                renderMeta(meta);
                renderHeader();
                // Initial render respects default tab (Auta) and empty search
                applyFilter();
            })
            .catch(function (error) {
                console.error(error);
                hideTableSkeleton();
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
            if (serviceModalFooterClose) {
                serviceModalFooterClose.addEventListener('click', closeServiceModal);
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
                    triggerPageTitleUnderline();
                });
            });

            triggerPageTitleUnderline();
            loadData();
        });
    } else {
        if (searchInput) {
            searchInput.addEventListener('input', applyFilter);
        }
        if (serviceModalClose) {
            serviceModalClose.addEventListener('click', closeServiceModal);
        }
        if (serviceModalFooterClose) {
            serviceModalFooterClose.addEventListener('click', closeServiceModal);
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
                triggerPageTitleUnderline();
            });
        });

        triggerPageTitleUnderline();
        loadData();
    }
})();


