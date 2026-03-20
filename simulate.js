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
  // Type filter: card must have ALL specified types
  if (cond.types && cond.types.length > 0) {
    for (var i = 0; i < cond.types.length; i++) {
      if (card.types.indexOf(cond.types[i]) === -1) {
        return false;
      }
    }
  }

  // Max CMC filter
  if (cond.maxCmc != null) {
    var cmc = parseCmc(card.manaCost || "");
    if (cmc > cond.maxCmc) {
      return false;
    }
  }

  return true;
}

// Parse converted mana cost from a mana cost string like {2}{G}{G}
function parseCmc(manaCost) {
  if (!manaCost) { return 0; }
  var total = 0;
  var regex = /\{([^}]+)\}/g;
  var match;
  while ((match = regex.exec(manaCost)) !== null) {
    var sym = match[1];
    if (sym === "X" || sym === "x") {
      // X counts as 0
    } else if (!isNaN(parseInt(sym))) {
      total += parseInt(sym);
    } else {
      // Single color/hybrid symbol counts as 1
      total += 1;
    }
  }
  return total;
}

function shuffle(array) {
  for (var i = array.length - 1; i > 0; i--) {
    var j   = Math.floor(Math.random() * (i + 1));
    var tmp = array[i];
    array[i] = array[j];
    array[j] = tmp;
  }
}
