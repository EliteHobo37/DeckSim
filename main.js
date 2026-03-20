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

function addMulliganConditionRow(savedCondition) {
    var list     = document.getElementById("mulliganConditionsList");
    var deckData = getDeckData();
    var row      = document.createElement("div");
    row.className = "condition-row";
    row.style.cssText = "border:1px solid #444;border-radius:6px;margin-bottom:8px;overflow:hidden;";

    var savedCats  = savedCondition ? (savedCondition.categories || []) : [];
    var savedTypes = savedCondition ? (savedCondition.types || [])      : [];

    var catSelect  = buildMultiSelect("catSelect",  deckData.categories, savedCats,  "Any category");
    var typeSelect = buildMultiSelect("typeSelect",  deckData.types,      savedTypes, "Any type");

    var noDeckhint = (!catSelect && !typeSelect)
        ? "<p style='font-size:12px;opacity:0.6;margin:0 0 8px;'>Load a deck to enable category/type filters.</p>"
        : "";

    var mvMinVal = (savedCondition && savedCondition.mvMin != null) ? savedCondition.mvMin : "";
    var mvMaxVal = (savedCondition && savedCondition.mvMax != null) ? savedCondition.mvMax : "";
    var minVal   = (savedCondition && savedCondition.min  != null)  ? savedCondition.min   : 1;
    var maxVal   = (savedCondition && savedCondition.max  != null && savedCondition.max !== Infinity) ? savedCondition.max : "";

    var selectRow = "";
    if (catSelect || typeSelect) {
        selectRow =
            "<div style='display:flex;gap:16px;flex-wrap:wrap;margin-bottom:10px;'>" +
            (catSelect  ? "<div style='flex:1;min-width:140px;'><label style='font-size:11px;opacity:0.7;display:block;margin-bottom:3px;text-transform:uppercase;letter-spacing:0.5px;'>Categories</label>" + catSelect  + "</div>" : "") +
            (typeSelect ? "<div style='flex:1;min-width:140px;'><label style='font-size:11px;opacity:0.7;display:block;margin-bottom:3px;text-transform:uppercase;letter-spacing:0.5px;'>Types</label>"      + typeSelect + "</div>" : "") +
            "</div>";
    }

    var detailHtml =
        "<div class='condDetail' style='padding:10px;'>" +
        noDeckhint + selectRow +
        "<div style='display:grid;grid-template-columns:1fr 1fr;gap:8px;'>" +
        "<label style='font-size:13px;'>MV min<br/><input type='number' class='condMvMin' value='" + mvMinVal + "' placeholder='any' style='width:100%;box-sizing:border-box;' /></label>" +
        "<label style='font-size:13px;'>MV max<br/><input type='number' class='condMvMax' value='" + mvMaxVal + "' placeholder='any' style='width:100%;box-sizing:border-box;' /></label>" +
        "<label style='font-size:13px;'>Count min<br/><input type='number' class='condMin' value='" + minVal + "' min='0' style='width:100%;box-sizing:border-box;' /></label>" +
        "<label style='font-size:13px;'>Count max<br/><input type='number' class='condMax' value='" + maxVal + "' placeholder='any' style='width:100%;box-sizing:border-box;' /></label>" +
        "</div>" +
        "</div>";

    // Build header via DOM so inline styles are never stripped by style.css
    var header  = document.createElement("div");
    header.style.cssText = "display:flex;align-items:center;padding:8px 10px;background:#2a2a2a;cursor:pointer;gap:8px;user-select:none;";

    var icon = document.createElement("span");
    icon.style.cssText = "font-size:11px;opacity:0.6;width:12px;";
    icon.innerHTML = "&#9660;";

    var summary = document.createElement("span");
    summary.style.cssText = "flex:1;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";

    var removeBtn = document.createElement("button");
    removeBtn.textContent = "Remove";
    removeBtn.style.cssText = "font-size:12px;padding:2px 8px;flex-shrink:0;";

    header.appendChild(icon);
    header.appendChild(summary);
    header.appendChild(removeBtn);

    // Parse detail from html string then insert both into row
    var tmp = document.createElement("div");
    tmp.innerHTML = detailHtml;
    var detail = tmp.firstChild;

    row.appendChild(header);
    row.appendChild(detail);

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
        if (e.target.classList.contains("removeCondBtn")) { return; }
        if (detail.style.display === "none") { expand(); } else { collapse(); }
    });

    removeBtn.addEventListener("click", function() {
        list.removeChild(row);
    });

    list.appendChild(row);

    // Start collapsed if restoring a saved condition, expanded if brand new
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
