export function simulate(deck, conditions, maxMulligans, fastThreshold, slowThreshold) {
  maxMulligans   = maxMulligans   || 1;
  fastThreshold  = fastThreshold  || 8;
  slowThreshold  = slowThreshold  || 9;

  var minTurn = Math.max(1, fastThreshold - 5);
  var maxTurn = slowThreshold + 5;

  // Build results map for every turn in range
  var results = {};
  for (var t = minTurn; t <= maxTurn; t++) {
    results[t] = 0;
  }

  var NUM_TRIALS = 100000;

  // Convert conditions array to lookup map
  var typeCounts = {};
  for (var c = 0; c < conditions.length; c++) {
    typeCounts[conditions[c].type] = { min: conditions[c].min, max: conditions[c].max };
  }

  function checkConditions(hand) {
    var counts = {};
    for (var type in typeCounts) { counts[type] = 0; }

    for (var i = 0; i < hand.length; i++) {
      for (var j = 0; j < hand[i].types.length; j++) {
        var t = hand[i].types[j];
        if (counts.hasOwnProperty(t)) { counts[t]++; }
      }
    }

    for (var type in typeCounts) {
      var min = typeCounts[type].min;
      var max = typeCounts[type].max;
      if (counts[type] < min || counts[type] > max) { return false; }
    }
    return true;
  }

  for (var trial = 0; trial < NUM_TRIALS; trial++) {
    var d = deck.slice();
    var won = false;

    for (var m = 0; m <= maxMulligans && !won; m++) {
      shuffle(d);
      var handSize = 7 - m;
      var hand     = d.slice(0, handSize);

      if (checkConditions(hand)) {
        // Opening hand met conditions on turn (7 - m) = card count seen
        // Mark success for every turn >= the hand size, up to maxTurn
        for (var seen = handSize; seen <= maxTurn; seen++) {
          if (results.hasOwnProperty(seen)) { results[seen]++; }
        }
        won = true;
      }
    }
  }

  for (var k in results) {
    results[k] = results[k] / NUM_TRIALS;
  }

  return results;
}

function shuffle(array) {
  for (var i = array.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = array[i];
    array[i] = array[j];
    array[j] = tmp;
  }
}
