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
        var parts    = parseCsvLine(line);
        var qty      = parseInt(parts[0]);
        var name     = parts[1] || "";
        var manaCost = parts[2] || "";
        var types    = [];
        if (parts[3]) {
            var typeWords = parts[3].split(",");
            for (var t = 0; t < typeWords.length; t++) {
                var word = typeWords[t].trim();
                if (word) { types.push(word); }
            }
        }
        if (isNaN(qty) || qty <= 0 || !name) { continue; }
        for (var k = 0; k < qty; k++) {
            deck.push({ name: name, manaCost: manaCost, types: types });
        }
    }
    return deck;
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

function getAvailableTypes() {
    var deckText = document.getElementById("deckInput").value;
    if (!deckText.trim()) { return []; }
    return extractCardTypes(parseDeck(deckText));
}

function addMulliganConditionRow(savedCondition) {
    var list     = document.getElementById("mulliganConditionsList");
    var types    = getAvailableTypes();
    var row      = document.createElement("div");
    row.className = "condition-row";
    row.style.cssText = "border:1px solid #444;border-radius:6px;padding:10px;margin-bottom:8px;";

    // Build type checkboxes
    var typeHtml = "";
    if (types.length > 0) {
        typeHtml = "<div style='margin-bottom:6px;'><label style='font-size:12px;opacity:0.7;'>Types (optional - card must have ALL checked):</label><br/>";
        for (var i = 0; i < types.length; i++) {
            var checked = "";
            if (savedCondition && savedCondition.types && savedCondition.types.indexOf(types[i]) !== -1) {
                checked = " checked";
            }
            typeHtml += "<label style='margin-right:10px;font-size:13px;'><input type='checkbox' class='typeCheck' value='" + types[i] + "'" + checked + "> " + types[i] + "</label>";
        }
        typeHtml += "</div>";
    } else {
        typeHtml = "<p style='font-size:12px;opacity:0.5;'>Load a deck to filter by type.</p>";
    }

    var maxCmcVal = (savedCondition && savedCondition.maxCmc != null) ? savedCondition.maxCmc : "";
    var minVal    = (savedCondition && savedCondition.min != null)    ? savedCondition.min    : 1;
    var maxVal    = (savedCondition && savedCondition.max != null && savedCondition.max !== Infinity) ? savedCondition.max : "";

    row.innerHTML =
        typeHtml +
        "<div style='display:flex;gap:12px;align-items:center;flex-wrap:wrap;'>" +
        "<label style='font-size:13px;'>Max CMC: <input type='number' class='condMaxCmc' value='" + maxCmcVal + "' placeholder='any' style='width:55px;' /></label>" +
        "<label style='font-size:13px;'>Min count: <input type='number' class='condMin' value='" + minVal + "' min='0' style='width:45px;' /></label>" +
        "<label style='font-size:13px;'>Max count: <input type='number' class='condMax' value='" + maxVal + "' placeholder='any' style='width:45px;' /></label>" +
        "<button class='removeCondBtn' style='margin-left:auto;'>Remove</button>" +
        "</div>";

    row.querySelector(".removeCondBtn").addEventListener("click", function() {
        list.removeChild(row);
    });

    list.appendChild(row);
}

function getMulliganConditions() {
    var rows       = document.querySelectorAll("#mulliganConditionsList .condition-row");
    var conditions = [];

    for (var i = 0; i < rows.length; i++) {
        var row      = rows[i];
        var checks   = row.querySelectorAll(".typeCheck:checked");
        var types    = [];
        for (var j = 0; j < checks.length; j++) {
            types.push(checks[j].value);
        }

        var maxCmcRaw = row.querySelector(".condMaxCmc").value.trim();
        var minRaw    = row.querySelector(".condMin").value.trim();
        var maxRaw    = row.querySelector(".condMax").value.trim();

        conditions.push({
            types:  types,
            maxCmc: maxCmcRaw !== "" ? parseInt(maxCmcRaw) : null,
            min:    minRaw !== "" ? parseInt(minRaw) : 1,
            max:    maxRaw !== "" ? parseInt(maxRaw) : Infinity
        });
    }
    return conditions;
}

function saveMulliganConditions() {
    var conditions = getMulliganConditions();
    // Serialize Infinity as null for JSON
    var toSave = conditions.map(function(c) {
        return {
            types:  c.types,
            maxCmc: c.maxCmc,
            min:    c.min,
            max:    c.max === Infinity ? null : c.max
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
                }
            },
            scales: {
                y: { beginAtZero: true, max: 100, title: { display: true, text: '% of games' } },
                x: { title: { display: true, text: 'Mulligans taken to meet conditions' } }
            }
        }
    });
}
