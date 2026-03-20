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

var currentConditions = {};

document.addEventListener("DOMContentLoaded", function() {
    updateDeckSelector();
    populateTypeDropdown();

    var deckInput = document.getElementById("deckInput");

    // Run Simulation
    document.getElementById("runSimBtn").addEventListener("click", function() {
        var deck          = parseDeck(deckInput.value);
        var conditions    = getConditions();
        var mulligans     = parseInt(document.getElementById("mulligans").value);
        var fastThreshold = parseInt(document.getElementById("fast-threshold").value);
        var slowThreshold = parseInt(document.getElementById("slow-threshold").value);

        var results = simulate(deck, conditions, mulligans);
        displayResults(results, fastThreshold, slowThreshold);

        var chartCanvas = document.getElementById("chart").getContext("2d");
        renderChart(results, chartCanvas);
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

    // Condition Management
    document.getElementById("addConditionBtn").addEventListener("click", addCondition);
    document.getElementById("addConditionSetBtn").addEventListener("click", addConditionSet);
    document.getElementById("deleteSetBtn").addEventListener("click", deleteConditionSets);
    document.getElementById("saveSetBtn").addEventListener("click", saveConditionSets);
    document.getElementById("loadSetBtn").addEventListener("click", loadConditionSets);

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
        var cardTypes = extractCardTypes(parseDeck(deckInput.value));
        populateTypeDropdown(cardTypes);
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

function parseDeck(text) {
    var lines = text.trim().split("\n");
    var deck  = [];

    for (var i = 0; i < lines.length; i++) {
        var parts = lines[i].split(",");
        var qty   = parseInt(parts[0].trim());
        var name  = parts[1].trim();
        var types = [];
        for (var j = 2; j < parts.length; j++) {
            types.push(parts[j].trim());
        }
        for (var k = 0; k < qty; k++) {
            deck.push({ name: name, types: types });
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

// Condition Functions

function addCondition() {
    var type     = document.getElementById("typeSelect").value;
    var min      = parseInt(document.getElementById("minInput").value, 10);
    var maxRaw   = document.getElementById("maxInput").value.trim();
    var maxValue = maxRaw === "" ? Infinity : parseInt(maxRaw, 10);

    if (!type) { return; }

    currentConditions[type] = { min: min, max: maxValue };
    updateConditionsDisplay();
}

function updateConditionsDisplay() {
    var list  = document.getElementById("conditionsList");
    list.innerHTML = "";

    var types = Object.keys(currentConditions);
    for (var i = 0; i < types.length; i++) {
        var type = types[i];
        var min  = currentConditions[type].min;
        var max  = currentConditions[type].max;
        var li   = document.createElement("li");
        li.textContent = type + " - Min: " + min + ", Max: " + (max === Infinity ? "any" : max);
        list.appendChild(li);
    }
}

function getConditions() {
    var result = [];
    var types  = Object.keys(currentConditions);
    for (var i = 0; i < types.length; i++) {
        result.push({
            type: types[i],
            min:  currentConditions[types[i]].min,
            max:  currentConditions[types[i]].max
        });
    }
    return result;
}

function addConditionSet() {
    var deckInput = document.getElementById("deckInput");
    var cardTypes = extractCardTypes(parseDeck(deckInput.value));
    var container = document.getElementById("conditionsContainer");
    var nameInput = document.getElementById("condition-name");
    var setName   = nameInput.value.trim() || "New Set";

    var div = document.createElement("div");
    div.className = "condition-set";

    var html = "<label>Set Name: <input type='text' class='setName' value='" + setName + "' /></label><br/><div class='typesContainer'>";
    for (var i = 0; i < cardTypes.length; i++) {
        var t = cardTypes[i];
        html += "<label>" + t + " - Min: <input type='number' class='min' data-type='" + t + "' value='0' />";
        html += " Max: <input type='number' class='max' data-type='" + t + "' value='' placeholder='any' /></label><br/>";
    }
    html += "</div><hr/>";
    div.innerHTML = html;

    container.appendChild(div);
    nameInput.value = "";
}

function deleteConditionSets() {
    if (confirm("Delete all condition sets?")) {
        document.getElementById("conditionsContainer").innerHTML = "";
    }
}

function saveConditionSets() {
    var sets    = [];
    var setDivs = document.querySelectorAll("#conditionsContainer .condition-set");

    for (var i = 0; i < setDivs.length; i++) {
        var div              = setDivs[i];
        var name             = div.querySelector(".setName").value;
        var card_type_counts = {};
        var minInputs        = div.querySelectorAll(".min");
        var maxInputs        = div.querySelectorAll(".max");

        for (var j = 0; j < minInputs.length; j++) {
            var type = minInputs[j].dataset.type;
            var min  = parseInt(minInputs[j].value) || 0;
            var max  = maxInputs[j].value.trim() === "" ? Infinity : parseInt(maxInputs[j].value);
            card_type_counts[type] = { min: min, max: max };
        }
        sets.push({ name: name, card_type_counts: card_type_counts });
    }

    localStorage.setItem("conditionsList", JSON.stringify(sets));
    alert("Condition sets saved.");
}

function loadConditionSets() {
    var saved = localStorage.getItem("conditionsList");
    if (!saved) { alert("No saved condition sets."); return; }

    var parsed    = JSON.parse(saved);
    var deckInput = document.getElementById("deckInput");
    var cardTypes = extractCardTypes(parseDeck(deckInput.value));
    var container = document.getElementById("conditionsContainer");
    container.innerHTML = "";

    for (var i = 0; i < parsed.length; i++) {
        var set = parsed[i];
        var div = document.createElement("div");
        div.className = "condition-set";

        var html = "<label>Set Name: <input type='text' class='setName' value='" + set.name + "' /></label><br/><div class='typesContainer'>";
        for (var j = 0; j < cardTypes.length; j++) {
            var t      = cardTypes[j];
            var saved_t = set.card_type_counts[t] || { min: 0, max: "" };
            var maxVal = saved_t.max === Infinity ? "" : saved_t.max;
            html += "<label>" + t + " - Min: <input type='number' class='min' data-type='" + t + "' value='" + saved_t.min + "' />";
            html += " Max: <input type='number' class='max' data-type='" + t + "' value='" + maxVal + "' placeholder='any' /></label><br/>";
        }
        html += "</div><hr/>";
        div.innerHTML = html;
        container.appendChild(div);
    }
}

// Dropdown

function populateTypeDropdown(typeList) {
    typeList = typeList || [];
    var dropdown = document.getElementById("typeSelect");
    dropdown.innerHTML = "";

    var placeholder = document.createElement("option");
    placeholder.textContent = "-- Select a Type --";
    placeholder.value = "";
    dropdown.appendChild(placeholder);

    for (var i = 0; i < typeList.length; i++) {
        var option = document.createElement("option");
        option.value = typeList[i];
        option.textContent = typeList[i];
        dropdown.appendChild(option);
    }
}

// Results & Chart

function displayResults(results, fastThreshold, slowThreshold) {
    var fastVal = results[fastThreshold];
    var slowVal = results[slowThreshold];
    var fastPct = fastVal != null ? (fastVal * 100).toFixed(1) : "N/A";
    var slowPct = slowVal != null ? (slowVal * 100).toFixed(1) : "N/A";

    document.getElementById("fast-label").textContent = "Fast (" + fastThreshold + " turns or fewer): " + fastPct + "%";
    document.getElementById("slow-label").textContent = "Slow (" + slowThreshold + " turns or fewer): " + slowPct + "%";
}

function renderChart(results, ctx) {
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(results),
            datasets: [{
                label: 'Success Rate (%)',
                data: Object.values(results).map(function(x) { return (x * 100).toFixed(2); }),
                backgroundColor: 'rgba(0, 255, 127, 0.6)'
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: { beginAtZero: true, max: 100 }
            }
        }
    });
}
