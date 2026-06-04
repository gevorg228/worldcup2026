/* Чистая математика прогресса. Без DOM и без localStorage —
   только считает по каталогу (WC_DATA) и состоянию (state из store.js).
   Правила:
     - «собрано» = число наклеек со счётчиком >= 1;
     - «осталось» = всего − собрано;
     - «на обмен» (повторки) = сумма (count − 1) по наклейкам со счётчиком >= 2. */
(function () {
  "use strict";

  function pct(collected, total) {
    if (!total) return 0;
    return Math.round((collected / total) * 100);
  }

  // Прогресс одного набора: { collected, total, pct, dupes }.
  function setProgress(set, state) {
    var collected = 0, dupes = 0;
    set.stickers.forEach(function (s) {
      var n = state.counts[s.code] || 0;
      if (n >= 1) collected++;
      if (n >= 2) dupes += n - 1;
    });
    var total = set.stickers.length;
    return { collected: collected, total: total, pct: pct(collected, total), dupes: dupes };
  }

  // Общий прогресс по всем наборам: { collected, remaining, total, pct, dupes }.
  function overallProgress(data, state) {
    var collected = 0, total = 0, dupes = 0;
    data.sets.forEach(function (set) {
      var p = setProgress(set, state);
      collected += p.collected;
      total += p.total;
      dupes += p.dupes;
    });
    return {
      collected: collected,
      remaining: total - collected,
      total: total,
      pct: pct(collected, total),
      dupes: dupes
    };
  }

  function duplicatesTotal(data, state) {
    return overallProgress(data, state).dupes;
  }

  window.WC_PROGRESS = {
    pct: pct,
    setProgress: setProgress,
    overallProgress: overallProgress,
    duplicatesTotal: duplicatesTotal
  };
})();
