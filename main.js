
// main.js
import { runSimulation } from './simulate.js';

document.addEventListener("DOMContentLoaded", () => {
    const deckInput = document.getElementById("deckInput");
    const runBtn = document.getElementById("runSimBtn");
    const resultDiv = document.getElementById("results");
    const chartCanvas = document.getElementById("resultsChart").getContext("2d");

    runBtn.addEventListener("click", () => {
        const deck = parseDeck(deckInput.value);
        const conditions = getConditions();
        const results = runSimulation(deck, conditions, [1, 1, 1], 7, 10000);
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
