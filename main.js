
// main.js
import { simulate } from './simulate.js';

document.addEventListener("DOMContentLoaded", () => {
    const deckInput = document.getElementById("deckInput");
    const runBtn = document.getElementById("runSimBtn");
    const resultDiv = document.getElementById("results");
    const chartCanvas = document.getElementById("chart").getContext("2d");

    runBtn.addEventListener("click", () => {
        const deck = parseDeck(deckInput.value);
        const conditions = getConditions();
        const results = simulate(deck, conditions, [1, 1, 1], 7, 10000);
        displayResults(results, resultDiv);
        renderChart(results, chartCanvas);
    });

    document.getElementById("pasteClipboard").addEventListener("click", async () => {
        const text = await navigator.clipboard.readText();
        deckInput.value = text;
    });
});

function parseDeck(text) {
    const lines = text.trim().split("\n");
    let deck = [];

    for (let line of lines) {
        const [count, name, ...typeParts] = line.split(",");
        const qty = parseInt(count.trim());
        const types = typeParts.join(",").trim().split(/\s+/);

        for (let i = 0; i < qty; i++) {
            deck.push({ name: name.trim(), types });
        }
    }

    return deck;
}

function addConditionSet(name = "New Set", cardTypes = {}) {
  const container = document.getElementById("conditionsList");

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
