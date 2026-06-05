/* Сетка плей-офф ЧМ-2026 (32 команды: 1/16 → 1/8 → 1/4 → 1/2 → финал + матч за 3-е).
   Команды в 1/16 подставляются АВТОМАТИЧЕСКИ из таблиц групп (см. groups.js):
     1X — победитель группы X, 2X — 2-е место группы X (когда группа доиграна);
     3[буквы] — одно из 3-х мест перечисленных групп (рейтинг лучших третьих, топ-8).
   Дальше победитель матча автоматически проходит в следующий раунд,
   проигравшие полуфиналов — в матч за 3-е место.

   Счёт матчей плей-офф хранится отдельно в localStorage (см. store.js).
   Пока команда не определена — в ячейке показывается метка слота (1E, 3ABCDF, A01…). */
(function () {
  "use strict";

  function pad2(n) { return n < 10 ? "0" + n : "" + n; }

  // --- Слоты 1/16 финала (32 шт.) по официальной сетке ЧМ-2026 -----------------
  // grp.rank+group → место в группе; grp.third → 3-е место одной из групп списка.
  function g1(group) { return { label: "1" + group, grp: { rank: 1, group: group } }; }
  function g2(group) { return { label: "2" + group, grp: { rank: 2, group: group } }; }
  function g3() {
    var groups = [].slice.call(arguments);
    return { label: "3" + groups.join(""), grp: { third: groups } };
  }

  // Порядок: пары сверху вниз. Матч 1/16 №k = слоты [2k-2] (верх) и [2k-1] (низ).
  var R32_SLOTS = [
    g1("E"), g3("A", "B", "C", "D", "F"),   // М1
    g1("I"), g3("C", "D", "F", "G", "H"),   // М2
    g2("A"), g2("B"),                       // М3
    g1("F"), g2("C"),                       // М4
    g2("K"), g2("L"),                       // М5
    g1("H"), g2("J"),                       // М6
    g1("D"), g3("B", "E", "F", "I", "J"),   // М7
    g1("G"), g3("A", "E", "H", "I", "J"),   // М8
    g1("C"), g2("F"),                       // М9
    g2("E"), g2("I"),                       // М10
    g1("A"), g3("C", "E", "F", "H", "I"),   // М11
    g1("L"), g3("E", "H", "I", "J", "K"),   // М12
    g1("J"), g2("H"),                       // М13
    g2("D"), g2("G"),                       // М14
    g1("B"), g3("E", "F", "G", "I", "J"),   // М15
    g1("K"), g3("D", "E", "I", "J", "L")    // М16
  ];

  // --- Даты матчей по id ("ДД.ММ") --------------------------------------------
  var DATES = {
    "r32-1": "29.06", "r32-2": "01.07", "r32-3": "28.06", "r32-4": "30.06",
    "r32-5": "03.07", "r32-6": "02.07", "r32-7": "02.07", "r32-8": "01.07",
    "r32-9": "29.06", "r32-10": "30.06", "r32-11": "01.07", "r32-12": "01.07",
    "r32-13": "04.07", "r32-14": "03.07", "r32-15": "03.07", "r32-16": "04.07",
    "r16-1": "05.07", "r16-2": "04.07", "r16-3": "06.07", "r16-4": "07.07",
    "r16-5": "05.07", "r16-6": "06.07", "r16-7": "07.07", "r16-8": "07.07",
    "qf-1": "09.07", "qf-2": "10.07", "qf-3": "12.07", "qf-4": "12.07",
    "sf-1": "14.07", "sf-2": "15.07",
    "final": "19.07", "third": "19.07"
  };

  // --- Построение раундов и связей --------------------------------------------
  // Источник слота: {seed:i} | {win:"id"} | {lose:"id"}.
  function pairWinners(prevIds, prefix) {
    var out = [];
    for (var k = 0; k < prevIds.length / 2; k++) {
      out.push({ id: prefix + "-" + (k + 1), a: { win: prevIds[2 * k] }, b: { win: prevIds[2 * k + 1] } });
    }
    return out;
  }
  function ids(matches) { return matches.map(function (m) { return m.id; }); }

  var r32 = [];
  for (var i = 0; i < 16; i++) {
    r32.push({ id: "r32-" + (i + 1), a: { seed: 2 * i }, b: { seed: 2 * i + 1 } });
  }
  var r16 = pairWinners(ids(r32), "r16");
  var qf = pairWinners(ids(r16), "qf");
  var sf = pairWinners(ids(qf), "sf");
  var sfIds = ids(sf);
  var fin = [{ id: "final", a: { win: sfIds[0] }, b: { win: sfIds[1] } }];
  var third = [{ id: "third", a: { lose: sfIds[0] }, b: { lose: sfIds[1] } }];

  var ROUNDS = [
    { key: "r32", title: "1/16 финала", matches: r32 },
    { key: "r16", title: "1/8 финала", matches: r16 },
    { key: "qf", title: "1/4 финала", matches: qf },
    { key: "sf", title: "1/2 финала", matches: sf },
    { key: "final", title: "Финал", matches: fin },
    { key: "third", title: "Матч за 3-е место", matches: third }
  ];

  var BY_ID = {};
  ROUNDS.forEach(function (r) { r.matches.forEach(function (m) { BY_ID[m.id] = m; }); });

  // Индексы слотов 3-х мест: { index в R32_SLOTS, allowed:[группы] }.
  var THIRD_SLOTS = [];
  R32_SLOTS.forEach(function (slot, idx) {
    if (slot.grp.third) THIRD_SLOTS.push({ index: idx, allowed: slot.grp.third });
  });

  // --- Метка слота (показываем, пока команда не определена) --------------------
  function slotLabel(src) {
    if (src.seed !== undefined) return R32_SLOTS[src.seed].label;
    var ref = src.win || src.lose;
    var m = /^(r32|r16|qf|sf)-(\d+)$/.exec(ref || "");
    if (!m) return "";
    var n = +m[2];
    if (src.win) {
      if (m[1] === "r32") return "A" + pad2(n);   // победитель матча 1/16
      if (m[1] === "r16") return "B" + pad2(n);   // победитель матча 1/8
      if (m[1] === "qf") return "QF" + n;         // победитель 1/4
      if (m[1] === "sf") return "SF" + n;         // победитель 1/2
    } else if (m[1] === "sf") {
      return "LSF" + n;                           // проигравший 1/2
    }
    return "";
  }

  // --- Подстановка команд в 1/16 из таблиц групп -------------------------------
  function groupComplete(grp, gstate) {
    return window.WC_GROUPS.allMatches(grp).every(function (m) {
      var r = gstate.results[m.key];
      return r && r.h !== null && r.h !== undefined && r.h !== "" &&
                  r.a !== null && r.a !== undefined && r.a !== "";
    });
  }

  // Рейтинг 12 третьих мест: очки, разница, забитые, затем буква группы.
  function rankThirds(standings) {
    var arr = window.WC_GROUPS.list.map(function (grp) {
      var r = standings[grp.letter][2];
      return { group: grp.letter, id: r.id, pts: r.pts, gd: r.gf - r.ga, gf: r.gf };
    });
    arr.sort(function (a, b) {
      return (b.pts - a.pts) || (b.gd - a.gd) || (b.gf - a.gf) || (a.group < b.group ? -1 : 1);
    });
    return arr;
  }

  // Распределяем 8 прошедших третьих по слотам (каждый слот принимает только
  // свои группы). Двудольное паросочетание (алгоритм Куна) — детерминированно.
  function assignThirds(qualifiedGroups) {
    var qset = qualifiedGroups.slice().sort();   // фикс. порядок для детерминизма
    var slots = THIRD_SLOTS;
    var groupToSlot = {};                        // группа -> позиция слота в slots[]
    function tryKuhn(si, visited) {
      for (var gi = 0; gi < qset.length; gi++) {
        var g = qset[gi];
        if (slots[si].allowed.indexOf(g) === -1 || visited[g]) continue;
        visited[g] = true;
        if (groupToSlot[g] === undefined || tryKuhn(groupToSlot[g], visited)) {
          groupToSlot[g] = si;
          return true;
        }
      }
      return false;
    }
    for (var si = 0; si < slots.length; si++) tryKuhn(si, {});
    var res = {};                                // индекс слота в R32_SLOTS -> группа
    Object.keys(groupToSlot).forEach(function (g) { res[slots[groupToSlot[g]].index] = g; });
    return res;
  }

  // Возвращает массив [32] id команд (или null), подставленных из групп.
  function resolveSeeds(gstate) {
    var G = window.WC_GROUPS;
    var seeds = new Array(32);
    var standings = {}, complete = {};
    G.list.forEach(function (grp) {
      standings[grp.letter] = G.compute(grp, gstate.results).rows;
      complete[grp.letter] = groupComplete(grp, gstate);
    });

    // 1-е и 2-е места — как только группа доиграна.
    R32_SLOTS.forEach(function (slot, idx) {
      var s = slot.grp;
      if (s.rank && complete[s.group]) seeds[idx] = standings[s.group][s.rank - 1].id;
    });

    // 3-и места — только когда доиграны ВСЕ группы (нужен полный рейтинг третьих).
    var allComplete = G.list.every(function (grp) { return complete[grp.letter]; });
    if (allComplete) {
      var top8 = rankThirds(standings).slice(0, 8);
      var thirdById = {};
      top8.forEach(function (t) { thirdById[t.group] = t.id; });
      var assign = assignThirds(top8.map(function (t) { return t.group; }));
      THIRD_SLOTS.forEach(function (ts) {
        var g = assign[ts.index];
        if (g) seeds[ts.index] = thirdById[g];
      });
    }
    return seeds;
  }

  // --- Расчёт сетки -----------------------------------------------------------
  function played(r) {
    return r && r.h !== null && r.h !== undefined && r.h !== "" &&
                r.a !== null && r.a !== undefined && r.a !== "";
  }

  function resolveSlot(src, results, memo, seeds) {
    if (!src) return null;
    if (src.seed !== undefined) return seeds[src.seed] || null;
    if (src.win) return resolveMatch(src.win, results, memo, seeds).winner;
    if (src.lose) return resolveMatch(src.lose, results, memo, seeds).loser;
    return null;
  }

  function resolveMatch(id, results, memo, seeds) {
    if (memo[id]) return memo[id];
    memo[id] = { id: id, a: null, b: null, sa: null, sb: null, winner: null, loser: null };
    var def = BY_ID[id];
    var a = resolveSlot(def.a, results, memo, seeds);
    var b = resolveSlot(def.b, results, memo, seeds);
    var r = results[id] || {};
    var sa = (r.h !== undefined && r.h !== "") ? r.h : null;
    var sb = (r.a !== undefined && r.a !== "") ? r.a : null;

    var winner = null, loser = null;
    if (a && b && played(r) && +sa !== +sb) {
      if (+sa > +sb) { winner = a; loser = b; } else { winner = b; loser = a; }
    }
    var out = {
      id: id, a: a, b: b, sa: sa, sb: sb, winner: winner, loser: loser,
      labelA: slotLabel(def.a), labelB: slotLabel(def.b), date: DATES[id] || null
    };
    memo[id] = out;
    return out;
  }

  // Резолвит всю сетку. gstate — результаты групп (для подстановки 1/16). { id -> resolved }.
  function resolveAll(results, gstate) {
    var seeds = resolveSeeds(gstate || { results: {} });
    var memo = {};
    ROUNDS.forEach(function (r) {
      r.matches.forEach(function (m) { resolveMatch(m.id, results, memo, seeds); });
    });
    return memo;
  }

  function team(id) { return window.WC_GROUPS.team(id); }

  window.WC_PLAYOFF = {
    rounds: ROUNDS,
    byId: BY_ID,
    dates: DATES,
    team: team,
    resolveSeeds: resolveSeeds,
    resolveAll: resolveAll
  };
})();
