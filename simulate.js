export function simulate(deck, conditions, maxMulligans = 1) {
  const results = { 7: 0, 8: 0, 9: 0, 10: 0 };
  const NUM_TRIALS = 100000;

  // conditions arrives as an array of { type, min, max } from main.js
  // Convert to a map for fast lookup: { "Land": { min, max }, ... }
  const typeCounts = {};
  for (const condition of conditions) {
    typeCounts[condition.type] = { min: condition.min, max: condition.max };
  }

  function checkConditions(hand) {
    // Count how many cards of each required type are in hand
    const counts = {};
    for (const type in typeCounts) counts[type] = 0;

    for (const card of hand) {
      for (const type of card.types) {  // ← fixed: was `for (let type of card)`
        if (counts.hasOwnProperty(type)) {
          counts[type]++;
        }
      }
    }

    for (const type in typeCounts) {
      const { min, max } = typeCounts[type];
      if (counts[type] < min || counts[type] > max) {
        return false;
      }
    }
    return true;
  }

  function draw(deck, count) {
    return deck.slice(0, count);
  }

  for (let trial = 0; trial < NUM_TRIALS; trial++) {
    const d = [...deck];
    for (let m = 0; m <= maxMulligans; m++) {
      shuffle(d);
      const hand = draw(d, 7 - m);
      if (checkConditions(hand)) {
        for (let seen = 7 - m; seen <= 10; seen++) {
          if (results.hasOwnProperty(seen)) results[seen]++;
        }
        break;
      }
    }
  }

  for (const k in results) {
    results[k] = results[k] / NUM_TRIALS;
  }

  return results;
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}
