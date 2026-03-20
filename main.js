// main.js
import { simulate } from './simulate.js';

const BUILD_TIME = "__BUILD_TIME__";
console.log("%c DeckSim build: " + BUILD_TIME, "color: #0f0; font-weight: bold;");
console.log("%c Type forceRebuild() in console to clear cache and reload", "color: #aaa;");

window.forceRebuild = async function() {
    var keys = await caches.keys();
    await Promise.all(keys.map(function(k) { return caches.delete(k); }));
    var regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map(function(r) { return r.unregister(); }));
    console.log("Cache cleared, reloading...");
    location.reload(true);
};

// Global chart instance so we can destroy before re-rendering
var chartInstance = null;

document.addEventListener("DOMContentLoaded", function() {
    updateDeckSelector();

    var deckInput = document.getElementById("deckInput");

    // Run Simulation
    document.getElementById("runSimBtn").addEventListener("click", function() {
        var deck       = parseDeck(deckInput.value);
        var conditions = getMulliganConditions();
        var mulligans  = parseInt(document.getElementById("mulligans").value);

        if (deck.length === 0) {
            alert("Please load a deck first.");
            return;
        }

        var results = simulate(deck, conditions, mulligans);
        displayResults(results, mulligans);

        var ctx = document.getElementById("chart").getContext("2d");
        renderChart(results, ctx, mulligans);
    });

    // Paste from Clipboard
    document.getElementById("pasteClipboard").addEventListener("click", async function() {
        try {
            var text = await navigator.clipboard.readText();
            deckInput.value = text;
        } catch (err) {
            alert("Clipboard access denied. Please paste manually.");
        }
    });

    // Deck Management
    document.getElementById("saveDeckBtn").addEventListener("click", saveCurrentDeck);
    document.getElementById("loadDeckBtn").addEventListener("click", loadSelectedDeck);

    // Mulligan Conditions
    document.getElementById("addMulliganConditionBtn").addEventListener("click", function() {
        addMulliganConditionRow();
    });
    document.getElementById("saveMulliganBtn").addEventListener("click", saveMulliganConditions);
    document.getElementById("loadMulliganBtn").addEventListener("click", loadMulliganConditions);
    document.getElementById("clearMulliganBtn").addEventListener("click", function() {
        if (confirm("Clear all mulligan conditions?")) {
            document.getElementById("mulliganConditionsList").innerHTML = "";
        }
    });

    // CSV Example
    document.getElementById("csvExampleBtn").addEventListener("click", function() {
        document.getElementById("csvExampleModal").style.display = "flex";
    });
    document.getElementById("csvExampleClose").addEventListener("click", function() {
        document.getElementById("csvExampleModal").style.display = "none";
    });
    document.getElementById("csvExampleModal").addEventListener("click", function(e) {
        if (e.target === document.getElementById("csvExampleModal")) {
            document.getElementById("csvExampleModal").style.display = "none";
        }
    });

    // Exit
    document.getElementById("exitBtn").addEventListener("click", function() { window.close(); });

    // Update Cache
    document.getElementById("updateCacheBtn").addEventListener("click", async function() {
        try {
            var keys = await caches.keys();
            await Promise.all(keys.map(function(key) { return caches.delete(key); }));
            var registrations = await navigator.serviceWorker.getRegistrations();
            await Promise.all(registrations.map(function(reg) { return reg.unregister(); }));
            alert("Cache cleared! Reloading with fresh files...");
            location.reload(true);
        } catch (err) {
            alert("Failed to clear cache: " + err.message);
        }
    });
});

// Deck Functions

function saveCurrentDeck() {
    var name     = document.getElementById("deckNameInput").value.trim();
    var deckText = document.getElementById("deckInput").value.trim();

    if (!name || !deckText) {
        alert("Please enter a deck name and paste your deck list.");
        return;
    }

    var allDecks = JSON.parse(localStorage.getItem("savedDecks") || "{}");
    allDecks[name] = deckText;
    localStorage.setItem("savedDecks", JSON.stringify(allDecks));
    alert("Deck saved: " + name);
    updateDeckSelector();
}

function loadSelectedDeck() {
    var select       = document.getElementById("deckSelector");
    var selectedName = select.value;
    if (!selectedName) { return; }

    var allDecks = JSON.parse(localStorage.getItem("savedDecks") || "{}");
    var deckText = allDecks[selectedName];

    if (deckText) {
        var deckInput = document.getElementById("deckInput");
        deckInput.value = deckText;
        document.getElementById("deckNameInput").value = selectedName;
        alert("Loaded deck: " + selectedName);
    } else {
        alert("Deck not found.");
    }
}

function updateDeckSelector() {
    var decks    = JSON.parse(localStorage.getItem("savedDecks") || "{}");
    var selector = document.getElementById("deckSelector");
    selector.innerHTML = "";

    var placeholder = document.createElement("option");
    placeholder.textContent = "-- Select a Deck --";
    placeholder.value = "";
    selector.appendChild(placeholder);

    for (var name in decks) {
        var option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        selector.appendChild(option);
    }
}

// Parsing

function parseCsvLine(line) {
    var fields   = [];
    var current  = "";
    var inQuotes = false;
    for (var i = 0; i < line.length; i++) {
        var ch = line[i];
        if (ch === '"' && !inQuotes) {
            inQuotes = true;
        } else if (ch === '"' && inQuotes) {
            if (i + 1 < line.length && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = false;
            }
        } else if (ch === ',' && !inQuotes) {
            fields.push(current.trim());
            current = "";
        } else {
            current += ch;
        }
    }
    fields.push(current.trim());
    return fields;
}

function parseDeck(text) {
    var lines = text.trim().split("\n");
    var deck  = [];

    for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (!line) { continue; }
        var parts      = parseCsvLine(line);
        var qty        = parseInt(parts[0]);
        var name       = parts[1] || "";
        // col 3: comma-separated categories e.g. "Ramp,Draw"
        var categories = [];
        if (parts[2]) {
            var catWords = parts[2].split(",");
            for (var c = 0; c < catWords.length; c++) {
                var cat = catWords[c].trim();
                if (cat) { categories.push(cat); }
            }
        }
        // col 4: numeric mana value e.g. 3
        var mv = parts[3] ? parseInt(parts[3]) : null;
        if (isNaN(mv)) { mv = null; }
        // col 5: comma-separated types e.g. "Legendary,Creature"
        var types = [];
        if (parts[4]) {
            var typeWords = parts[4].split(",");
            for (var t = 0; t < typeWords.length; t++) {
                var word = typeWords[t].trim();
                if (word) { types.push(word); }
            }
        }
        if (isNaN(qty) || qty <= 0 || !name) { continue; }
        for (var k = 0; k < qty; k++) {
            deck.push({ name: name, categories: categories, mv: mv, types: types });
        }
    }
    return deck;
}

function extractCardCategories(deck) {
    var set = {};
    for (var i = 0; i < deck.length; i++) {
        for (var j = 0; j < deck[i].categories.length; j++) {
            set[deck[i].categories[j].trim()] = true;
        }
    }
    return Object.keys(set).sort();
}

function extractCardTypes(deck) {
    var typeSet = {};
    for (var i = 0; i < deck.length; i++) {
        for (var j = 0; j < deck[i].types.length; j++) {
            typeSet[deck[i].types[j].trim()] = true;
        }
    }
    return Object.keys(typeSet).sort();
}

// Mulligan Condition Rows

function getDeckData() {
    var deckText = document.getElementById("deckInput").value;
    if (!deckText.trim()) { return { categories: [], types: [] }; }
    var deck       = parseDeck(deckText);
    var types      = extractCardTypes(deck);
    var typeSet    = {};
    for (var i = 0; i < types.length; i++) { typeSet[types[i]] = true; }
    var categories = extractCardCategories(deck).filter(function(c) { return !typeSet[c]; });
    return { categories: categories, types: types };
}

function buildMultiSelect(cssClass, items, savedList, placeholder) {
    if (items.length === 0) { return ""; }
    var html = "<select class='" + cssClass + "' multiple style='width:100%;min-width:120px;max-height:120px;'>";
    html += "<option value='' disabled>" + placeholder + "</option>";
    for (var i = 0; i < items.length; i++) {
        var sel = (savedList && savedList.indexOf(items[i]) !== -1) ? " selected" : "";
        html += "<option value='" + items[i] + "'" + sel + ">" + items[i] + "</option>";
    }
    html += "</select>";
    return html;
}

function getSelectValues(select) {
    var values = [];
    for (var i = 0; i < select.options.length; i++) {
        if (select.options[i].selected && select.options[i].value !== "") {
            values.push(select.options[i].value);
        }
    }
    return values;
}

function buildConditionSummary(row) {
    var catEl    = row.querySelector(".catSelect");
    var typeEl   = row.querySelector(".typeSelect");
    var cats     = catEl  ? getSelectValues(catEl)  : [];
    var types    = typeEl ? getSelectValues(typeEl) : [];
    var mvMin    = row.querySelector(".condMvMin").value.trim();
    var mvMax    = row.querySelector(".condMvMax").value.trim();
    var cntMin   = row.querySelector(".condMin").value.trim();
    var cntMax   = row.querySelector(".condMax").value.trim();

    var parts = [];
    if (cats.length)  { parts.push("Cat: " + cats.join(", ")); }
    if (types.length) { parts.push("Type: " + types.join(", ")); }
    if (mvMin || mvMax) {
        parts.push("MV: " + (mvMin || "0") + "-" + (mvMax || "any"));
    }
    var countPart = "x" + (cntMin || "1");
    if (cntMax) { countPart += "-" + cntMax; }
    parts.push(countPart);

    return parts.length ? parts.join("  |  ") : "Any card x1";
}

function makeDomLabel(text, input) {
    var lbl = document.createElement("label");
    lbl.style.cssText = "font-size:13px;display:block;";
    lbl.appendChild(document.createTextNode(text));
    lbl.appendChild(document.createElement("br"));
    lbl.appendChild(input);
    return lbl;
}

function makeNumberInput(cssClass, val, placeholder) {
    var inp = document.createElement("input");
    inp.type = "number";
    inp.className = cssClass;
    inp.value = val;
    inp.placeholder = placeholder || "any";
    inp.style.cssText = "width:100%;box-sizing:border-box;";
    return inp;
}

function addMulliganConditionRow(savedCondition) {
    var list     = document.getElementById("mulliganConditionsList");
    var deckData = getDeckData();

    var savedCats  = savedCondition ? (savedCondition.categories || []) : [];
    var savedTypes = savedCondition ? (savedCondition.types || [])      : [];
    var mvMinVal   = (savedCondition && savedCondition.mvMin != null) ? savedCondition.mvMin : "";
    var mvMaxVal   = (savedCondition && savedCondition.mvMax != null) ? savedCondition.mvMax : "";
    var minVal     = (savedCondition && savedCondition.min  != null)  ? savedCondition.min   : 1;
    var maxVal     = (savedCondition && savedCondition.max  != null && savedCondition.max !== Infinity) ? savedCondition.max : "";

    // Outer row - no className to avoid style.css interference
    var row = document.createElement("div");
    row.style.cssText = "display:block;border:1px solid #444;border-radius:6px;margin-bottom:8px;overflow:hidden;";

    // - Header -
    var header = document.createElement("div");
    header.style.cssText = "display:flex;flex-direction:row;align-items:center;padding:7px 10px;background:#2a2a2a;cursor:pointer;gap:8px;user-select:none;box-sizing:border-box;width:100%;";

    var icon = document.createElement("span");
    icon.style.cssText = "font-size:11px;opacity:0.6;flex-shrink:0;width:14px;text-align:center;";
    icon.innerHTML = "&#9660;";

    var removeBtn = document.createElement("button");
    removeBtn.innerHTML = "&#10005;";
    removeBtn.title = "Remove condition";
    removeBtn.style.cssText = "display:inline-block;width:24px;height:24px;min-width:0;max-width:24px;padding:0;line-height:24px;text-align:center;font-size:13px;flex-shrink:0;cursor:pointer;border-radius:4px;";

    var summary = document.createElement("span");
    summary.style.cssText = "flex:1;font-size:13px;opacity:0.85;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;";

    header.appendChild(icon);
    header.appendChild(removeBtn);
    header.appendChild(summary);

    // - Detail panel -
    var detail = document.createElement("div");
    detail.style.cssText = "display:block;padding:10px;box-sizing:border-box;";

    // Dropdowns row
    if (deckData.categories.length > 0 || deckData.types.length > 0) {
        var dropRow = document.createElement("div");
        dropRow.style.cssText = "display:flex;flex-direction:row;gap:16px;flex-wrap:wrap;margin-bottom:10px;";

        if (deckData.categories.length > 0) {
            var catWrap = document.createElement("div");
            catWrap.style.cssText = "flex:1;min-width:130px;";
            var catLbl = document.createElement("label");
            catLbl.style.cssText = "font-size:11px;opacity:0.7;display:block;margin-bottom:3px;text-transform:uppercase;letter-spacing:0.5px;";
            catLbl.textContent = "Categories";
            var catSel = document.createElement("select");
            catSel.className = "catSelect";
            catSel.multiple = true;
            catSel.style.cssText = "width:100%;min-width:0;max-height:110px;";
            for (var i = 0; i < deckData.categories.length; i++) {
                var opt = document.createElement("option");
                opt.value = deckData.categories[i];
                opt.textContent = deckData.categories[i];
                opt.selected = savedCats.indexOf(deckData.categories[i]) !== -1;
                catSel.appendChild(opt);
            }
            catWrap.appendChild(catLbl);
            catWrap.appendChild(catSel);
            dropRow.appendChild(catWrap);
        }

        if (deckData.types.length > 0) {
            var typeWrap = document.createElement("div");
            typeWrap.style.cssText = "flex:1;min-width:130px;";
            var typeLbl = document.createElement("label");
            typeLbl.style.cssText = "font-size:11px;opacity:0.7;display:block;margin-bottom:3px;text-transform:uppercase;letter-spacing:0.5px;";
            typeLbl.textContent = "Types";
            var typeSel = document.createElement("select");
            typeSel.className = "typeSelect";
            typeSel.multiple = true;
            typeSel.style.cssText = "width:100%;min-width:0;max-height:110px;";
            for (var j = 0; j < deckData.types.length; j++) {
                var topt = document.createElement("option");
                topt.value = deckData.types[j];
                topt.textContent = deckData.types[j];
                topt.selected = savedTypes.indexOf(deckData.types[j]) !== -1;
                typeSel.appendChild(topt);
            }
            typeWrap.appendChild(typeLbl);
            typeWrap.appendChild(typeSel);
            dropRow.appendChild(typeWrap);
        }

        detail.appendChild(dropRow);
    } else {
        var hint = document.createElement("p");
        hint.style.cssText = "font-size:12px;opacity:0.6;margin:0 0 8px;";
        hint.textContent = "Load a deck to enable category/type filters.";
        detail.appendChild(hint);
    }

    // Number inputs grid
    var grid = document.createElement("div");
    grid.style.cssText = "display:grid;grid-template-columns:1fr 1fr;gap:8px;";

    var mvMinInp  = makeNumberInput("condMvMin",  mvMinVal, "any");
    var mvMaxInp  = makeNumberInput("condMvMax",  mvMaxVal, "any");
    var cntMinInp = makeNumberInput("condMin",    minVal,   "");
    var cntMaxInp = makeNumberInput("condMax",    maxVal,   "any");
    cntMinInp.min = "0";

    grid.appendChild(makeDomLabel("MV min",    mvMinInp));
    grid.appendChild(makeDomLabel("MV max",    mvMaxInp));
    grid.appendChild(makeDomLabel("Count min", cntMinInp));
    grid.appendChild(makeDomLabel("Count max", cntMaxInp));
    detail.appendChild(grid);

    row.appendChild(header);
    row.appendChild(detail);

    // - Collapse / expand -
    function collapse() {
        detail.style.display = "none";
        icon.innerHTML = "&#9654;";
        summary.textContent = buildConditionSummary(row);
    }
    function expand() {
        detail.style.display = "block";
        icon.innerHTML = "&#9660;";
        summary.textContent = "";
    }

    header.addEventListener("click", function(e) {
        if (e.target === removeBtn) { return; }
        if (detail.style.display === "none") { expand(); } else { collapse(); }
    });

    removeBtn.addEventListener("click", function(e) {
        e.stopPropagation();
        list.removeChild(row);
    });

    list.appendChild(row);
    if (savedCondition) { collapse(); } else { expand(); }
}

function getMulliganConditions() {
    var rows       = document.querySelectorAll("#mulliganConditionsList .condition-row");
    var conditions = [];

    for (var i = 0; i < rows.length; i++) {
        var row = rows[i];

        var catEl  = row.querySelector(".catSelect");
        var typeEl = row.querySelector(".typeSelect");

        var categories = catEl  ? getSelectValues(catEl)  : [];
        var types      = typeEl ? getSelectValues(typeEl) : [];

        var mvMinRaw = row.querySelector(".condMvMin").value.trim();
        var mvMaxRaw = row.querySelector(".condMvMax").value.trim();
        var minRaw   = row.querySelector(".condMin").value.trim();
        var maxRaw   = row.querySelector(".condMax").value.trim();

        conditions.push({
            categories: categories,
            types:      types,
            mvMin:      mvMinRaw !== "" ? parseInt(mvMinRaw) : null,
            mvMax:      mvMaxRaw !== "" ? parseInt(mvMaxRaw) : null,
            min:        minRaw !== "" ? parseInt(minRaw) : 1,
            max:        maxRaw !== "" ? parseInt(maxRaw) : Infinity
        });
    }
    return conditions;
}

function saveMulliganConditions() {
    var conditions = getMulliganConditions();
    var toSave = conditions.map(function(c) {
        return {
            categories: c.categories,
            types:      c.types,
            mvMin:      c.mvMin,
            mvMax:      c.mvMax,
            min:        c.min,
            max:        c.max === Infinity ? null : c.max
        };
    });
    localStorage.setItem("mulliganConditions", JSON.stringify(toSave));
    alert("Mulligan conditions saved.");
}

function loadMulliganConditions() {
    var saved = localStorage.getItem("mulliganConditions");
    if (!saved) { alert("No saved mulligan conditions."); return; }

    var parsed = JSON.parse(saved);
    document.getElementById("mulliganConditionsList").innerHTML = "";
    for (var i = 0; i < parsed.length; i++) {
        var c = parsed[i];
        if (c.max === null) { c.max = Infinity; }
        if (!c.categories) { c.categories = []; }
        addMulliganConditionRow(c);
    }
}

// Results & Chart

function displayResults(results, maxMulligans) {
    var fastLabel = document.getElementById("fast-label");
    var slowLabel = document.getElementById("slow-label");

    var keepPct   = results[0] != null ? (results[0] * 100).toFixed(1) : "0.0";
    var neverPct  = results.never != null ? (results.never * 100).toFixed(1) : "0.0";

    fastLabel.textContent = "Kept opening hand (0 mulligans): " + keepPct + "%";
    slowLabel.textContent = "Never met conditions: " + neverPct + "%";
}

function renderChart(results, ctx, maxMulligans) {
    // Build ordered labels: 0, 1, 2 ... maxMulligans, never
    var labels = [];
    var data   = [];

    for (var m = 0; m <= maxMulligans; m++) {
        labels.push(m === 0 ? "0 (keep)" : m + " mulligan" + (m > 1 ? "s" : ""));
        data.push(((results[m] || 0) * 100).toFixed(2));
    }
    labels.push("Never met");
    data.push(((results.never || 0) * 100).toFixed(2));

    // Destroy previous chart instance to avoid canvas reuse error
    if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
    }

    chartInstance = new Chart(ctx, {
        type: 'bar',
        plugins: [ChartDataLabels],
        data: {
            labels: labels,
            datasets: [{
                label: '% of games',
                data: data,
                backgroundColor: labels.map(function(l) {
                    return l.indexOf("Never") !== -1 ? 'rgba(255,80,80,0.6)' : 'rgba(0,200,120,0.6)';
                })
            }]
        },
        options: {
            responsive: true,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(ctx) { return ctx.raw + "%"; }
                    }
                },
                datalabels: {
                    anchor: 'end',
                    align: 'end',
                    formatter: function(value) {
                        return parseFloat(value) > 0 ? value + "%" : "";
                    },
                    font: { size: 11, weight: 'bold' },
                    color: '#eee'
                }
            },
            scales: {
                y: { beginAtZero: true, max: 100, title: { display: true, text: '% of games' } },
                x: { title: { display: true, text: 'Mulligans taken to meet conditions' } }
            },
            layout: { padding: { top: 20 } }
        }
    });
}
