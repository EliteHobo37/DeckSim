export function simulate(deck, mulliganConditions, maxMulligans) {
  maxMulligans = maxMulligans || 1;

  var NUM_TRIALS = 100000;

  // results[n] = number of trials where conditions were first met after n mulligans
  // results[-1] = never met (stored as "never" key)
  var results = { never: 0 };
  for (var m = 0; m <= maxMulligans; m++) {
    results[m] = 0;
  }

  for (var trial = 0; trial < NUM_TRIALS; trial++) {
    var d   = deck.slice();
    var met = false;

    for (var m = 0; m <= maxMulligans; m++) {
      shuffle(d);
      var hand = d.slice(0, 7 - m);

      if (checkConditions(hand, mulliganConditions)) {
        results[m]++;
        met = true;
        break;
      }
    }

    if (!met) {
      results.never++;
    }
  }

  // Convert to percentages
  for (var k in results) {
    results[k] = results[k] / NUM_TRIALS;
  }

  return results;
}

// Check if a hand satisfies all mulligan conditions
function checkConditions(hand, conditions) {
  for (var i = 0; i < conditions.length; i++) {
    var cond  = conditions[i];
    var count = 0;

    for (var j = 0; j < hand.length; j++) {
      if (cardMatchesCondition(hand[j], cond)) {
        count++;
      }
    }

    var min = cond.min || 0;
    var max = cond.max != null ? cond.max : Infinity;
    if (count < min || count > max) {
      return false;
    }
  }
  return true;
}

// A card matches a condition if it satisfies ALL specified filters
function cardMatchesCondition(card, cond) {
  // Category filter: card must have ALL specified categories
  if (cond.categories && cond.categories.length > 0) {
    for (var i = 0; i < cond.categories.length; i++) {
      if ((card.categories || []).indexOf(cond.categories[i]) === -1) {
        return false;
      }
    }
  }

  // Type filter: card must have ALL specified types
  if (cond.types && cond.types.length > 0) {
    for (var i = 0; i < cond.types.length; i++) {
      if ((card.types || []).indexOf(cond.types[i]) === -1) {
        return false;
      }
    }
  }

  // Mana value range filter (mv is stored as a plain integer on the card)
  if (cond.mvMin != null || cond.mvMax != null) {
    var mv = card.mv != null ? card.mv : Infinity;
    if (cond.mvMin != null && mv < cond.mvMin) { return false; }
    if (cond.mvMax != null && mv > cond.mvMax) { return false; }
  }

  return true;
}

function shuffle(array) {
  for (var i = array.length - 1; i > 0; i--) {
    var j   = Math.floor(Math.random() * (i + 1));
    var tmp = array[i];
    array[i] = array[j];
    array[j] = tmp;
  }
}
