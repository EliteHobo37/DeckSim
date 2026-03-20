// main.js
import { simulate } from './simulate.js';

// Tracks the current condition filters (type → {min, max})
let currentConditions = {};

document.addEventListener("DOMContentLoaded", () => {
    updateDeckSelector();
    populateTypeDropdown();

    const deckInput = document.getElementById("deckInput");

    // ── Run Simulation ──────────────────────────────────────────────
    document.getElementById("runSimBtn").addEventListener("click", () => {
        const deck          = parseDeck(deckInput.value);
        const conditions    = getConditions();
        const mulligans     = parseInt(document.getElementById("mulligans").value);
        const fastThreshold = parseInt(document.getElementById("fast-threshold").value);
        const slowThreshold = parseInt(document.getElementById("slow-threshold").value);

        const results = simulate(deck, conditions, mulligans, fastThreshold, 10000);
        displayResults(results, fastThreshold, slowThreshold);

        // Get canvas context here so it is never null at startup
        const chartCanvas = document.getElementById("chart").getContext("2d");
        renderChart(results, chartCanvas);
    });

    // ── Paste from Clipboard ─────────────────────────────────────────
    document.getElementById("pasteClipboard").addEventListener("click", async () => {
        try {
            const text = await navigator.clipboard.readText();
            deckInput.value = text;
        } catch (err) {
            alert("Clipboard access denied. Please paste manually.");
        }
    });

    // ── Deck Management ──────────────────────────────────────────────
    document.getElementById("saveDeckBtn").addEventListener("click", saveCurrentDeck);
    document.getElementById("loadDeckBtn").addEventListener("click", loadSelectedDeck);

    // ── Condition Management ─────────────────────────────────────────
    document.getElementById("addConditionBtn").addEventListener("click", addCondition);
    document.getElementById("addConditionSetBtn").addEventListener("click", addConditionSet);
    document.getElementById("deleteSetBtn").addEventListener("click", deleteConditionSets);
    document.getElementById("saveSetBtn").addEventListener("click", saveConditionSets);
    document.getElementById("loadSetBtn").addEventListener("click", loadConditionSets);

    // ── Exit ─────────────────────────────────────────────────────────
    document.getElementById("exitBtn").addEventListener("click", () => window.close());

    // ── Update Cache ──────────────────────────────────────────────────
    document.getElementById("updateCacheBtn").addEventListener("click", async () => {
        try {
            // Delete all caches
            const keys = await caches.keys();
            await Promise.all(keys.map(key => caches.delete(key)));

            // Unregister all service workers so the new one installs fresh
            const registrations = await navigator.serviceWorker.getRegistrations();
            await Promise.all(registrations.map(reg => reg.unregister()));

            alert("Cache cleared! Reloading with fresh files...");
            location.reload(true);
        } catch (err) {
            alert("Failed to clear cache: " + err.message);
        }
    });
});

// ── Deck Functions ────────────────────────────────────────────────────

function saveCurrentDeck() {
    const name     = document.getElementById("deckNameInput").value.trim();
    const deckText = document.getElementById("deckInput").value.trim();

    if (!name || !deckText) {
        alert("Please enter a deck name and paste your deck list.");
        return;
    }

    const allDecks = JSON.parse(localStorage.getItem("savedDecks") || "{}");
    allDecks[name] = deckText;
    localStorage.setItem("savedDecks", JSON.stringify(allDecks));
    alert(`Deck "${name}" saved.`);
    updateDeckSelector();
}

function loadSelectedDeck() {
    const select       = document.getElementById("deckSelector");
    const selectedName = select.value;
    if (!selectedName) return;

    const allDecks = JSON.parse(localStorage.getItem("savedDecks") || "{}");
    const deckText = allDecks[selectedName];

    if (deckText) {
        const deckInput = document.getElementById("deckInput");
        deckInput.value = deckText;
        document.getElementById("deckNameInput").value = selectedName;

        const cardTypes = extractCardTypes(parseDeck(deckInput.value));
        populateTypeDropdown(cardTypes);
        alert(`Loaded deck: ${selectedName}`);
    } else {
        alert("Deck not found.");
    }
}

function updateDeckSelector() {
    const decks    = JSON.parse(localStorage.getItem("savedDecks") || "{}");
    const selector = document.getElementById("deckSelector");
    selector.innerHTML = "";

    const placeholder       = document.createElement("option");
    placeholder.textContent = "-- Select a Deck --";
    placeholder.value       = "";
    selector.appendChild(placeholder);

    for (const name in decks) {
        const option       = document.createElement("option");
        option.value       = name;
        option.textContent = name;
        selector.appendChild(option);
    }
}

// ── Parsing ───────────────────────────────────────────────────────────

function parseDeck(text) {
    const lines = text.trim().split("\n");
    const deck  = [];

    for (const line of lines) {
        const [count, name, ...typeParts] = line.split(",");
        const qty   = parseInt(count.trim());
        const types = typeParts.join(",").trim().split(",").map(t => t.trim());

        for (let i = 0; i < qty; i++) {
            deck.push({ name: name.trim(), types });
        }
    }
    return deck;
}

function extractCardTypes(deck) {   // ← fixed: removed invalid `const` from param
    const typeSet = new Set();

    for (const card of deck) {
        for (const type of card.types) {
            typeSet.add(type.trim());
        }
    }

    return Array.from(typeSet).sort();
}

// ── Condition Functions ────────────────────────────────────────────────

function addCondition() {
    const type     = document.getElementById("typeSelect").value;
    const min      = parseInt(document.getElementById("minInput").value, 10);
    const maxRaw   = document.getElementById("maxInput").value.trim();
    const maxValue = maxRaw === "" ? Infinity : parseInt(maxRaw, 10);

    if (!type) return;

    currentConditions[type] = { min, max: maxValue };
    updateConditionsDisplay();
}

function updateConditionsDisplay() {
    const list = document.getElementById("conditionsList");
    list.innerHTML = "";

    for (const [type, { min, max }] of Object.entries(currentConditions)) {
        const li       = document.createElement("li");
        li.textContent = `${type} → Min: ${min}, Max: ${max === Infinity ? "∞" : max}`;
        list.appendChild(li);
    }
}

function getConditions() {
    // Returns currentConditions as an array for simulate.js
    return Object.entries(currentConditions).map(([type, { min, max }]) => ({
        type, min, max
    }));
}

function addConditionSet() {
    const deckInput = document.getElementById("deckInput");
    const cardTypes = extractCardTypes(parseDeck(deckInput.value));

    const container = document.getElementById("conditionsContainer");
    const nameInput = document.getElementById("condition-name");
    const setName   = nameInput.value.trim() || "New Set";

    const div       = document.createElement("div");
    div.className   = "condition-set";
    div.innerHTML   = `
        <label>Set Name: <input type="text" class="setName" value="${setName}" /></label><br/>
        <div class="typesContainer">
            ${cardTypes.map(type => `
                <label>${type} →
                    Min: <input type="number" class="min" data-type="${type}" value="0" />
                    Max: <input type="number" class="max" data-type="${type}" value="" placeholder="∞" />
                </label><br/>
            `).join("")}
        </div>
        <hr/>
    `;
    container.appendChild(div);
    nameInput.value = "";
}

function deleteConditionSets() {
    if (confirm("Delete all condition sets?")) {
        document.getElementById("conditionsContainer").innerHTML = "";
    }
}

function saveConditionSets() {
    const sets    = [];
    const setDivs = document.querySelectorAll("#conditionsContainer .condition-set");

    setDivs.forEach(div => {
        const name            = div.querySelector(".setName").value;
        const card_type_counts = {};
        const minInputs       = div.querySelectorAll(".min");
        const maxInputs       = div.querySelectorAll(".max");

        minInputs.forEach((minEl, i) => {
            const type = minEl.dataset.type;
            const min  = parseInt(minEl.value) || 0;
            const max  = maxInputs[i].value.trim() === "" ? Infinity : parseInt(maxInputs[i].value);
            card_type_counts[type] = { min, max };
        });

        sets.push({ name, card_type_counts });
    });

    localStorage.setItem("conditionsList", JSON.stringify(sets));
    alert("Condition sets saved.");
}

function loadConditionSets() {
    const saved = localStorage.getItem("conditionsList");
    if (!saved) return alert("No saved condition sets.");

    const parsed = JSON.parse(saved);
    document.getElementById("conditionsContainer").innerHTML = "";
    parsed.forEach(set => {
        const deckInput = document.getElementById("deckInput");
        const cardTypes = extractCardTypes(parseDeck(deckInput.value));

        const container = document.getElementById("conditionsContainer");
        const div       = document.createElement("div");
        div.className   = "condition-set";
        div.innerHTML   = `
            <label>Set Name: <input type="text" class="setName" value="${set.name}" /></label><br/>
            <div class="typesContainer">
                ${cardTypes.map(type => {
                    const saved = set.card_type_counts[type] || { min: 0, max: "" };
                    return `
                        <label>${type} →
                            Min: <input type="number" class="min" data-type="${type}" value="${saved.min}" />
                            Max: <input type="number" class="max" data-type="${type}" value="${saved.max === Infinity ? "" : saved.max}" placeholder="∞" />
                        </label><br/>
                    `;
                }).join("")}
            </div>
            <hr/>
        `;
        container.appendChild(div);
    });
}

// ── Dropdown ──────────────────────────────────────────────────────────

function populateTypeDropdown(typeList = []) {
    const dropdown = document.getElementById("typeSelect");
    dropdown.innerHTML = "";

    const placeholder       = document.createElement("option");
    placeholder.textContent = "-- Select a Type --";
    placeholder.value       = "";
    dropdown.appendChild(placeholder);

    if (typeList.length === 0) return;   // ← fixed: was `if (typeList = {})` (assignment bug)

    for (const type of typeList) {
        const option       = document.createElement("option");
        option.value       = type;
        option.textContent = type;
        dropdown.appendChild(option);
    }
}

// ── Results & Chart ───────────────────────────────────────────────────

function displayResults(results, fastThreshold, slowThreshold) {
    // results keys are numeric turn counts: { 7: 0.82, 8: 0.91, ... }
    const fastVal = results[fastThreshold];
    const slowVal = results[slowThreshold];
    const fastPct = fastVal != null ? (fastVal * 100).toFixed(1) : "N/A";
    const slowPct = slowVal != null ? (slowVal * 100).toFixed(1) : "N/A";

    document.getElementById("fast-label").textContent =
        `Fast (≤${fastThreshold} turns): ${fastPct}%`;
    document.getElementById("slow-label").textContent =
        `Slow (≤${slowThreshold} turns): ${slowPct}%`;
}

function renderChart(results, ctx) {
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(results),
            datasets: [{
                label: 'Success Rate (%)',
                data: Object.values(results).map(x => (x * 100).toFixed(2)),
                backgroundColor: 'rgba(0, 255, 127, 0.6)',
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
    });

    // ── Deck Management ──────────────────────────────────────────────
    document.getElementById("saveDeckBtn").addEventListener("click", saveCurrentDeck);
    document.getElementById("loadDeckBtn").addEventListener("click", loadSelectedDeck);

    // ── Condition Management ─────────────────────────────────────────
    document.getElementById("addConditionBtn").addEventListener("click", addCondition);
    document.getElementById("addConditionSetBtn").addEventListener("click", addConditionSet);
    document.getElementById("deleteSetBtn").addEventListener("click", deleteConditionSets);
    document.getElementById("saveSetBtn").addEventListener("click", saveConditionSets);
    document.getElementById("loadSetBtn").addEventListener("click", loadConditionSets);

    // ── Exit ─────────────────────────────────────────────────────────
    document.getElementById("exitBtn").addEventListener("click", () => window.close());

    // ── Update Cache ──────────────────────────────────────────────────
    document.getElementById("updateCacheBtn").addEventListener("click", async () => {
        try {
            // Delete all caches
            const keys = await caches.keys();
            await Promise.all(keys.map(key => caches.delete(key)));

            // Unregister all service workers so the new one installs fresh
            const registrations = await navigator.serviceWorker.getRegistrations();
            await Promise.all(registrations.map(reg => reg.unregister()));

            alert("Cache cleared! Reloading with fresh files...");
            location.reload(true);
        } catch (err) {
            alert("Failed to clear cache: " + err.message);
        }
    });
});

// ── Deck Functions ────────────────────────────────────────────────────

function saveCurrentDeck() {
    const name     = document.getElementById("deckNameInput").value.trim();
    const deckText = document.getElementById("deckInput").value.trim();

    if (!name || !deckText) {
        alert("Please enter a deck name and paste your deck list.");
        return;
    }

    const allDecks = JSON.parse(localStorage.getItem("savedDecks") || "{}");
    allDecks[name] = deckText;
    localStorage.setItem("savedDecks", JSON.stringify(allDecks));
    alert(`Deck "${name}" saved.`);
    updateDeckSelector();
}

function loadSelectedDeck() {
    const select       = document.getElementById("deckSelector");
    const selectedName = select.value;
    if (!selectedName) return;

    const allDecks = JSON.parse(localStorage.getItem("savedDecks") || "{}");
    const deckText = allDecks[selectedName];

    if (deckText) {
        const deckInput = document.getElementById("deckInput");
        deckInput.value = deckText;
        document.getElementById("deckNameInput").value = selectedName;

        const cardTypes = extractCardTypes(parseDeck(deckInput.value));
        populateTypeDropdown(cardTypes);
        alert(`Loaded deck: ${selectedName}`);
    } else {
        alert("Deck not found.");
    }
}

function updateDeckSelector() {
    const decks    = JSON.parse(localStorage.getItem("savedDecks") || "{}");
    const selector = document.getElementById("deckSelector");
    selector.innerHTML = "";

    const placeholder       = document.createElement("option");
    placeholder.textContent = "-- Select a Deck --";
    placeholder.value       = "";
    selector.appendChild(placeholder);

    for (const name in decks) {
        const option       = document.createElement("option");
        option.value       = name;
        option.textContent = name;
        selector.appendChild(option);
    }
}

// ── Parsing ───────────────────────────────────────────────────────────

function parseDeck(text) {
    const lines = text.trim().split("\n");
    const deck  = [];

    for (const line of lines) {
        const [count, name, ...typeParts] = line.split(",");
        const qty   = parseInt(count.trim());
        const types = typeParts.join(",").trim().split(",").map(t => t.trim());

        for (let i = 0; i < qty; i++) {
            deck.push({ name: name.trim(), types });
        }
    }
    return deck;
}

function extractCardTypes(deck) {   // ← fixed: removed invalid `const` from param
    const typeSet = new Set();

    for (const card of deck) {
        for (const type of card.types) {
            typeSet.add(type.trim());
        }
    }

    return Array.from(typeSet).sort();
}

// ── Condition Functions ────────────────────────────────────────────────

function addCondition() {
    const type     = document.getElementById("typeSelect").value;
    const min      = parseInt(document.getElementById("minInput").value, 10);
    const maxRaw   = document.getElementById("maxInput").value.trim();
    const maxValue = maxRaw === "" ? Infinity : parseInt(maxRaw, 10);

    if (!type) return;

    currentConditions[type] = { min, max: maxValue };
    updateConditionsDisplay();
}

function updateConditionsDisplay() {
    const list = document.getElementById("conditionsList");
    list.innerHTML = "";

    for (const [type, { min, max }] of Object.entries(currentConditions)) {
        const li       = document.createElement("li");
        li.textContent = `${type} → Min: ${min}, Max: ${max === Infinity ? "∞" : max}`;
        list.appendChild(li);
    }
}

function getConditions() {
    // Returns currentConditions as an array for simulate.js
    return Object.entries(currentConditions).map(([type, { min, max }]) => ({
        type, min, max
    }));
}

function addConditionSet() {
    const deckInput = document.getElementById("deckInput");
    const cardTypes = extractCardTypes(parseDeck(deckInput.value));

    const container = document.getElementById("conditionsContainer");
    const nameInput = document.getElementById("condition-name");
    const setName   = nameInput.value.trim() || "New Set";

    const div       = document.createElement("div");
    div.className   = "condition-set";
    div.innerHTML   = `
        <label>Set Name: <input type="text" class="setName" value="${setName}" /></label><br/>
        <div class="typesContainer">
            ${cardTypes.map(type => `
                <label>${type} →
                    Min: <input type="number" class="min" data-type="${type}" value="0" />
                    Max: <input type="number" class="max" data-type="${type}" value="" placeholder="∞" />
                </label><br/>
            `).join("")}
        </div>
        <hr/>
    `;
    container.appendChild(div);
    nameInput.value = "";
}

function deleteConditionSets() {
    if (confirm("Delete all condition sets?")) {
        document.getElementById("conditionsContainer").innerHTML = "";
    }
}

function saveConditionSets() {
    const sets    = [];
    const setDivs = document.querySelectorAll("#conditionsContainer .condition-set");

    setDivs.forEach(div => {
        const name            = div.querySelector(".setName").value;
        const card_type_counts = {};
        const minInputs       = div.querySelectorAll(".min");
        const maxInputs       = div.querySelectorAll(".max");

        minInputs.forEach((minEl, i) => {
            const type = minEl.dataset.type;
            const min  = parseInt(minEl.value) || 0;
            const max  = maxInputs[i].value.trim() === "" ? Infinity : parseInt(maxInputs[i].value);
            card_type_counts[type] = { min, max };
        });

        sets.push({ name, card_type_counts });
    });

    localStorage.setItem("conditionsList", JSON.stringify(sets));
    alert("Condition sets saved.");
}

function loadConditionSets() {
    const saved = localStorage.getItem("conditionsList");
    if (!saved) return alert("No saved condition sets.");

    const parsed = JSON.parse(saved);
    document.getElementById("conditionsContainer").innerHTML = "";
    parsed.forEach(set => {
        const deckInput = document.getElementById("deckInput");
        const cardTypes = extractCardTypes(parseDeck(deckInput.value));

        const container = document.getElementById("conditionsContainer");
        const div       = document.createElement("div");
        div.className   = "condition-set";
        div.innerHTML   = `
            <label>Set Name: <input type="text" class="setName" value="${set.name}" /></label><br/>
            <div class="typesContainer">
                ${cardTypes.map(type => {
                    const saved = set.card_type_counts[type] || { min: 0, max: "" };
                    return `
                        <label>${type} →
                            Min: <input type="number" class="min" data-type="${type}" value="${saved.min}" />
                            Max: <input type="number" class="max" data-type="${type}" value="${saved.max === Infinity ? "" : saved.max}" placeholder="∞" />
                        </label><br/>
                    `;
                }).join("")}
            </div>
            <hr/>
        `;
        container.appendChild(div);
    });
}

// ── Dropdown ──────────────────────────────────────────────────────────

function populateTypeDropdown(typeList = []) {
    const dropdown = document.getElementById("typeSelect");
    dropdown.innerHTML = "";

    const placeholder       = document.createElement("option");
    placeholder.textContent = "-- Select a Type --";
    placeholder.value       = "";
    dropdown.appendChild(placeholder);

    if (typeList.length === 0) return;   // ← fixed: was `if (typeList = {})` (assignment bug)

    for (const type of typeList) {
        const option       = document.createElement("option");
        option.value       = type;
        option.textContent = type;
        dropdown.appendChild(option);
    }
}

// ── Results & Chart ───────────────────────────────────────────────────

function displayResults(results, fastThreshold, slowThreshold) {
    // results keys are numeric turn counts: { 7: 0.82, 8: 0.91, ... }
    const fastVal = results[fastThreshold];
    const slowVal = results[slowThreshold];
    const fastPct = fastVal != null ? (fastVal * 100).toFixed(1) : "N/A";
    const slowPct = slowVal != null ? (slowVal * 100).toFixed(1) : "N/A";

    document.getElementById("fast-label").textContent =
        `Fast (≤${fastThreshold} turns): ${fastPct}%`;
    document.getElementById("slow-label").textContent =
        `Slow (≤${slowThreshold} turns): ${slowPct}%`;
}

function renderChart(results, ctx) {
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(results),
            datasets: [{
                label: 'Success Rate (%)',
                data: Object.values(results).map(x => (x * 100).toFixed(2)),
                backgroundColor: 'rgba(0, 255, 127, 0.6)',
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
        deckInput.value = deckText;
        document.getElementById("deckNameInput").value = selectedName;

        const cardTypes = extractCardTypes(parseDeck(deckInput.value));
        populateTypeDropdown(cardTypes);
        alert(`Loaded deck: ${selectedName}`);
    } else {
        alert("Deck not found.");
    }
}

function updateDeckSelector() {
    const decks    = JSON.parse(localStorage.getItem("savedDecks") || "{}");
    const selector = document.getElementById("deckSelector");
    selector.innerHTML = "";

    const placeholder       = document.createElement("option");
    placeholder.textContent = "-- Select a Deck --";
    placeholder.value       = "";
    selector.appendChild(placeholder);

    for (const name in decks) {
        const option       = document.createElement("option");
        option.value       = name;
        option.textContent = name;
        selector.appendChild(option);
    }
}

// ── Parsing ───────────────────────────────────────────────────────────

function parseDeck(text) {
    const lines = text.trim().split("\n");
    const deck  = [];

    for (const line of lines) {
        const [count, name, ...typeParts] = line.split(",");
        const qty   = parseInt(count.trim());
        const types = typeParts.join(",").trim().split(",").map(t => t.trim());

        for (let i = 0; i < qty; i++) {
            deck.push({ name: name.trim(), types });
        }
    }
    return deck;
}

function extractCardTypes(deck) {   // ← fixed: removed invalid `const` from param
    const typeSet = new Set();

    for (const card of deck) {
        for (const type of card.types) {
            typeSet.add(type.trim());
        }
    }

    return Array.from(typeSet).sort();
}

// ── Condition Functions ────────────────────────────────────────────────

function addCondition() {
    const type     = document.getElementById("typeSelect").value;
    const min      = parseInt(document.getElementById("minInput").value, 10);
    const maxRaw   = document.getElementById("maxInput").value.trim();
    const maxValue = maxRaw === "" ? Infinity : parseInt(maxRaw, 10);

    if (!type) return;

    currentConditions[type] = { min, max: maxValue };
    updateConditionsDisplay();
}

function updateConditionsDisplay() {
    const list = document.getElementById("conditionsList");
    list.innerHTML = "";

    for (const [type, { min, max }] of Object.entries(currentConditions)) {
        const li       = document.createElement("li");
        li.textContent = `${type} → Min: ${min}, Max: ${max === Infinity ? "∞" : max}`;
        list.appendChild(li);
    }
}

function getConditions() {
    // Returns currentConditions as an array for simulate.js
    return Object.entries(currentConditions).map(([type, { min, max }]) => ({
        type, min, max
    }));
}

function addConditionSet() {
    const deckInput = document.getElementById("deckInput");
    const cardTypes = extractCardTypes(parseDeck(deckInput.value));

    const container = document.getElementById("conditionsContainer");
    const nameInput = document.getElementById("condition-name");
    const setName   = nameInput.value.trim() || "New Set";

    const div       = document.createElement("div");
    div.className   = "condition-set";
    div.innerHTML   = `
        <label>Set Name: <input type="text" class="setName" value="${setName}" /></label><br/>
        <div class="typesContainer">
            ${cardTypes.map(type => `
                <label>${type} →
                    Min: <input type="number" class="min" data-type="${type}" value="0" />
                    Max: <input type="number" class="max" data-type="${type}" value="" placeholder="∞" />
                </label><br/>
            `).join("")}
        </div>
        <hr/>
    `;
    container.appendChild(div);
    nameInput.value = "";
}

function deleteConditionSets() {
    if (confirm("Delete all condition sets?")) {
        document.getElementById("conditionsContainer").innerHTML = "";
    }
}

function saveConditionSets() {
    const sets    = [];
    const setDivs = document.querySelectorAll("#conditionsContainer .condition-set");

    setDivs.forEach(div => {
        const name            = div.querySelector(".setName").value;
        const card_type_counts = {};
        const minInputs       = div.querySelectorAll(".min");
        const maxInputs       = div.querySelectorAll(".max");

        minInputs.forEach((minEl, i) => {
            const type = minEl.dataset.type;
            const min  = parseInt(minEl.value) || 0;
            const max  = maxInputs[i].value.trim() === "" ? Infinity : parseInt(maxInputs[i].value);
            card_type_counts[type] = { min, max };
        });

        sets.push({ name, card_type_counts });
    });

    localStorage.setItem("conditionsList", JSON.stringify(sets));
    alert("Condition sets saved.");
}

function loadConditionSets() {
    const saved = localStorage.getItem("conditionsList");
    if (!saved) return alert("No saved condition sets.");

    const parsed = JSON.parse(saved);
    document.getElementById("conditionsContainer").innerHTML = "";
    parsed.forEach(set => {
        const deckInput = document.getElementById("deckInput");
        const cardTypes = extractCardTypes(parseDeck(deckInput.value));

        const container = document.getElementById("conditionsContainer");
        const div       = document.createElement("div");
        div.className   = "condition-set";
        div.innerHTML   = `
            <label>Set Name: <input type="text" class="setName" value="${set.name}" /></label><br/>
            <div class="typesContainer">
                ${cardTypes.map(type => {
                    const saved = set.card_type_counts[type] || { min: 0, max: "" };
                    return `
                        <label>${type} →
                            Min: <input type="number" class="min" data-type="${type}" value="${saved.min}" />
                            Max: <input type="number" class="max" data-type="${type}" value="${saved.max === Infinity ? "" : saved.max}" placeholder="∞" />
                        </label><br/>
                    `;
                }).join("")}
            </div>
            <hr/>
        `;
        container.appendChild(div);
    });
}

// ── Dropdown ──────────────────────────────────────────────────────────

function populateTypeDropdown(typeList = []) {
    const dropdown = document.getElementById("typeSelect");
    dropdown.innerHTML = "";

    const placeholder       = document.createElement("option");
    placeholder.textContent = "-- Select a Type --";
    placeholder.value       = "";
    dropdown.appendChild(placeholder);

    if (typeList.length === 0) return;   // ← fixed: was `if (typeList = {})` (assignment bug)

    for (const type of typeList) {
        const option       = document.createElement("option");
        option.value       = type;
        option.textContent = type;
        dropdown.appendChild(option);
    }
}

// ── Results & Chart ───────────────────────────────────────────────────

function displayResults(results, fastThreshold, slowThreshold) {
    // results keys are numeric turn counts: { 7: 0.82, 8: 0.91, ... }
    const fastVal = results[fastThreshold];
    const slowVal = results[slowThreshold];
    const fastPct = fastVal != null ? (fastVal * 100).toFixed(1) : "N/A";
    const slowPct = slowVal != null ? (slowVal * 100).toFixed(1) : "N/A";

    document.getElementById("fast-label").textContent =
        `Fast (≤${fastThreshold} turns): ${fastPct}%`;
    document.getElementById("slow-label").textContent =
        `Slow (≤${slowThreshold} turns): ${slowPct}%`;
}

function renderChart(results, ctx) {
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(results),
            datasets: [{
                label: 'Success Rate (%)',
                data: Object.values(results).map(x => (x * 100).toFixed(2)),
                backgroundColor: 'rgba(0, 255, 127, 0.6)',
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

        const cardTypes = extractCardTypes(parseDeck(deckInput.value));
        populateTypeDropdown(cardTypes);
        alert(`Loaded deck: ${selectedName}`);
    } else {
        alert("Deck not found.");
    }
}

function updateDeckSelector() {
    const decks    = JSON.parse(localStorage.getItem("savedDecks") || "{}");
    const selector = document.getElementById("deckSelector");
    selector.innerHTML = "";

    const placeholder       = document.createElement("option");
    placeholder.textContent = "-- Select a Deck --";
    placeholder.value       = "";
    selector.appendChild(placeholder);

    for (const name in decks) {
        const option       = document.createElement("option");
        option.value       = name;
        option.textContent = name;
        selector.appendChild(option);
    }
}

// ── Parsing ───────────────────────────────────────────────────────────

function parseDeck(text) {
    const lines = text.trim().split("\n");
    const deck  = [];

    for (const line of lines) {
        const [count, name, ...typeParts] = line.split(",");
        const qty   = parseInt(count.trim());
        const types = typeParts.join(",").trim().split(",").map(t => t.trim());

        for (let i = 0; i < qty; i++) {
            deck.push({ name: name.trim(), types });
        }
    }
    return deck;
}

function extractCardTypes(deck) {   // ← fixed: removed invalid `const` from param
    const typeSet = new Set();

    for (const card of deck) {
        for (const type of card.types) {
            typeSet.add(type.trim());
        }
    }

    return Array.from(typeSet).sort();
}

// ── Condition Functions ────────────────────────────────────────────────

function addCondition() {
    const type     = document.getElementById("typeSelect").value;
    const min      = parseInt(document.getElementById("minInput").value, 10);
    const maxRaw   = document.getElementById("maxInput").value.trim();
    const maxValue = maxRaw === "" ? Infinity : parseInt(maxRaw, 10);

    if (!type) return;

    currentConditions[type] = { min, max: maxValue };
    updateConditionsDisplay();
}

function updateConditionsDisplay() {
    const list = document.getElementById("conditionsList");
    list.innerHTML = "";

    for (const [type, { min, max }] of Object.entries(currentConditions)) {
        const li       = document.createElement("li");
        li.textContent = `${type} → Min: ${min}, Max: ${max === Infinity ? "∞" : max}`;
        list.appendChild(li);
    }
}

function getConditions() {
    // Returns currentConditions as an array for simulate.js
    return Object.entries(currentConditions).map(([type, { min, max }]) => ({
        type, min, max
    }));
}

function addConditionSet() {
    const deckInput = document.getElementById("deckInput");
    const cardTypes = extractCardTypes(parseDeck(deckInput.value));

    const container = document.getElementById("conditionsContainer");
    const nameInput = document.getElementById("condition-name");
    const setName   = nameInput.value.trim() || "New Set";

    const div       = document.createElement("div");
    div.className   = "condition-set";
    div.innerHTML   = `
        <label>Set Name: <input type="text" class="setName" value="${setName}" /></label><br/>
        <div class="typesContainer">
            ${cardTypes.map(type => `
                <label>${type} →
                    Min: <input type="number" class="min" data-type="${type}" value="0" />
                    Max: <input type="number" class="max" data-type="${type}" value="" placeholder="∞" />
                </label><br/>
            `).join("")}
        </div>
        <hr/>
    `;
    container.appendChild(div);
    nameInput.value = "";
}

function deleteConditionSets() {
    if (confirm("Delete all condition sets?")) {
        document.getElementById("conditionsContainer").innerHTML = "";
    }
}

function saveConditionSets() {
    const sets    = [];
    const setDivs = document.querySelectorAll("#conditionsContainer .condition-set");

    setDivs.forEach(div => {
        const name            = div.querySelector(".setName").value;
        const card_type_counts = {};
        const minInputs       = div.querySelectorAll(".min");
        const maxInputs       = div.querySelectorAll(".max");

        minInputs.forEach((minEl, i) => {
            const type = minEl.dataset.type;
            const min  = parseInt(minEl.value) || 0;
            const max  = maxInputs[i].value.trim() === "" ? Infinity : parseInt(maxInputs[i].value);
            card_type_counts[type] = { min, max };
        });

        sets.push({ name, card_type_counts });
    });

    localStorage.setItem("conditionsList", JSON.stringify(sets));
    alert("Condition sets saved.");
}

function loadConditionSets() {
    const saved = localStorage.getItem("conditionsList");
    if (!saved) return alert("No saved condition sets.");

    const parsed = JSON.parse(saved);
    document.getElementById("conditionsContainer").innerHTML = "";
    parsed.forEach(set => {
        const deckInput = document.getElementById("deckInput");
        const cardTypes = extractCardTypes(parseDeck(deckInput.value));

        const container = document.getElementById("conditionsContainer");
        const div       = document.createElement("div");
        div.className   = "condition-set";
        div.innerHTML   = `
            <label>Set Name: <input type="text" class="setName" value="${set.name}" /></label><br/>
            <div class="typesContainer">
                ${cardTypes.map(type => {
                    const saved = set.card_type_counts[type] || { min: 0, max: "" };
                    return `
                        <label>${type} →
                            Min: <input type="number" class="min" data-type="${type}" value="${saved.min}" />
                            Max: <input type="number" class="max" data-type="${type}" value="${saved.max === Infinity ? "" : saved.max}" placeholder="∞" />
                        </label><br/>
                    `;
                }).join("")}
            </div>
            <hr/>
        `;
        container.appendChild(div);
    });
}

// ── Dropdown ──────────────────────────────────────────────────────────

function populateTypeDropdown(typeList = []) {
    const dropdown = document.getElementById("typeSelect");
    dropdown.innerHTML = "";

    const placeholder       = document.createElement("option");
    placeholder.textContent = "-- Select a Type --";
    placeholder.value       = "";
    dropdown.appendChild(placeholder);

    if (typeList.length === 0) return;   // ← fixed: was `if (typeList = {})` (assignment bug)

    for (const type of typeList) {
        const option       = document.createElement("option");
        option.value       = type;
        option.textContent = type;
        dropdown.appendChild(option);
    }
}

// ── Results & Chart ───────────────────────────────────────────────────

function displayResults(results, fastThreshold, slowThreshold) {
    const fastPct = results.fast != null ? (results.fast * 100).toFixed(1) : "N/A";
    const slowPct = results.slow != null ? (results.slow * 100).toFixed(1) : "N/A";

    document.getElementById("fast-label").textContent =
        `Fast (≤${fastThreshold} turns): ${fastPct}%`;
    document.getElementById("slow-label").textContent =
        `Slow (≤${slowThreshold} turns): ${slowPct}%`;
}

function renderChart(results, ctx) {
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(results),
            datasets: [{
                label: 'Success Rate (%)',
                data: Object.values(results).map(x => (x * 100).toFixed(2)),
                backgroundColor: 'rgba(0, 255, 127, 0.6)',
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
  const lines = csvText.trim().split("\n");
  const deck = [];

  for (let line of lines) {
    // Match CSV fields, including quoted text with commas
    const regex = /(".*?"|[^",\s]+)(?=\s*,|\s*$)/g;
    const matches = [...line.matchAll(regex)].map(m => m[0]);

    const name = matches[1].replace(/^"|"$/g, ""); // Remove outer quotes
    const types = matches[4]
      .replace(/^"|"$/g, "") // Remove quotes
      .split(",")
      .map(t => t.trim());

    const qty = parseInt(matches[0]);

    for (let i = 0; i < qty; i++) {
      deck.push({
        name,
        types,
      });
    }
  }

  return deck;
}

function parseDeck(text) {
    const lines = text.trim().split("\n");
    let deck = [];

    for (let line of lines) {
        const [count, name, ...typeParts] = line.split(",");
        const qty = parseInt(count.trim());
        const types = typeParts.join(",").trim().split(",");

        for (let i = 0; i < qty; i++) {
            deck.push({ name: name.trim(), types });
        }
    }
    return deck;
}

function extractCardTypes(const deck) {
  const typeSet = new Set();

  for (const card of deck) {
    // Each card is expected to be an array of card types
    // e.g., ["Ramp", "Artifact"] or ["Land"] or ["Creature", "Draw"]
    for (const type of card.types) {
      typeSet.add(type.trim());
    }
  }
  //console.log(typeSet);
  return Array.from(typeSet.values()).sort();
}

function addConditionSet(name = "New Set", cardTypes = {}) {
  const container = document.getElementById("conditionsList");
  const deckInput = document.getElementById("deckInput");
  cardTypes = extractCardTypes(parseDeck(deckInput.value))

  const div = document.createElement("div");
  div.className = "condition-set";
  div.innerHTML = `
    <label>Set Name: <input type="text" class="setName" value="${name}" /></label><br/>
    <div class="typesContainer">
      ${Object.entries(cardTypes).map(([type, {min, max}]) => `
        <label>${type} → 
          Min: <input type="number" class="min" data-type="${type}" value="${min}" />
          Max: <input type="number" class="max" data-type="${type}" value="${max}" />
        </label><br/>
      `).join("")}
    </div>
    <hr/>
  `;
  container.appendChild(div);
}

function saveConditionSets() {
  const sets = [];
  const setDivs = document.querySelectorAll("#conditionsContainer > div");
  setDivs.forEach(div => {
    const name = div.querySelector(".setName").value;
    const typeInputs = div.querySelectorAll(".min, .max");
    const card_type_counts = {};

    for (let i = 0; i < typeInputs.length; i += 2) {
      const type = typeInputs[i].dataset.type;
      const min = parseInt(typeInputs[i].value);
      const max = parseInt(typeInputs[i + 1].value);
      card_type_counts[type] = { min, max };
    }

    sets.push({ name, card_type_counts });
  });

  localStorage.setItem("conditionsList", JSON.stringify(sets));
  alert("Condition sets saved.");
}

function loadConditionSets() {
  const saved = localStorage.getItem("conditionsList");
  if (!saved) return alert("No saved condition sets.");
  const parsed = JSON.parse(saved);
  document.getElementById("conditionsContainer").innerHTML = "";
  parsed.forEach(set => addConditionSet(set.name, set.card_type_counts));
}

function getConditions() {
    const conditionList = document.getElementById("conditionList");
    const conditions = [];

    for (let child of conditionList.children) {
        const type = child.querySelector(".ctype").value;
        const min = parseInt(child.querySelector(".cmin").value);
        const max = parseInt(child.querySelector(".cmax").value);
        conditions.push({ type, min, max });
    }

    return conditions;
}

function addCondition() {
  const type = document.getElementById("typeSelect").value;
  const min = parseInt(document.getElementById("minInput").value, 10);
  const max = document.getElementById("maxInput").value.trim();
  const maxValue = max === "" ? Infinity : parseInt(max, 10);

  if (!type) return;

  currentConditions[type] = { min, max: maxValue };

  updateConditionsDisplay();
}

function updateConditionsDisplay() {
  const list = document.getElementById("conditionsList");
  list.innerHTML = "";

  for (const [type, { min, max }] of Object.entries(currentConditions)) {
    const li = document.createElement("li");
    li.textContent = `${type} → Min: ${min}, Max: ${max === Infinity ? "∞" : max}`;
    list.appendChild(li);
  }
}

function populateTypeDropdown(typeList = {}) {
    
  console.log(typeList)
  const dropdown = document.getElementById("typeSelect");
  dropdown.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.textContent = "-- Select a Type --";
  placeholder.value = "";
  dropdown.appendChild(placeholder);

  if (typeList = {}) {
      return;
  }  
    
  for (const key in typeList) {
    console.log(typeList[key]);
    const option = document.createElement("option");
    option.value = typeList[key];
    option.textContent = typeList[key];
    dropdown.appendChild(option);
  }
}

function displayResults(results, container) {
    container.innerHTML = "<h3>Simulation Results:</h3>";
    for (let key in results) {
        const percent = (results[key] * 100).toFixed(2);
        container.innerHTML += `<p>After ${key} cards: ${percent}%</p>`;
    }
}

function renderChart(results, ctx) {
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(results),
            datasets: [{
                label: 'Success Rate',
                data: Object.values(results).map(x => (x * 100).toFixed(2)),
                backgroundColor: 'rgba(0, 255, 127, 0.6)',
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100
                }
            }
        }
    });
}

window.addConditionSet = addConditionSet;
window.saveConditionSets = saveConditionSets;
window.loadConditionSets = loadConditionSets;
window.saveCurrentDeck = saveCurrentDeck;
window.loadSelectedDeck = loadSelectedDeck;
window.addCondition = addCondition;
