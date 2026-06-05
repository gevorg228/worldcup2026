/* Группы турнира: состав, расписание (круговой турнир) и расчёт таблицы.
   Данные команд (имя, флаг) берём из WC_DATA по id. Результаты матчей
   хранятся отдельно в localStorage (см. store.js: loadGroupResults и т.д.). */
(function () {
  "use strict";

  // Состав групп (порядок — как в альбоме; при равенстве очков служит тай-брейком).
  // dates — даты 6 матчей в порядке PAIRS (см. ниже): t0-t1, t2-t3, t0-t2, t3-t1, t0-t3, t1-t2.
  var GROUPS = [
    { letter: "A", teams: ["MEX", "RSA", "KOR", "CZE"], dates: ["11.06", "12.06", "19.06", "18.06", "25.06", "25.06"] },
    { letter: "B", teams: ["CAN", "BIH", "QAT", "SUI"], dates: ["12.06", "13.06", "19.06", "18.06", "24.06", "24.06"] },
    { letter: "C", teams: ["BRA", "MAR", "HAI", "SCO"], dates: ["14.06", "14.06", "20.06", "20.06", "25.06", "25.06"] },
    { letter: "D", teams: ["USA", "PAR", "AUS", "TUR"], dates: ["13.06", "14.06", "19.06", "20.06", "26.06", "26.06"] },
    { letter: "E", teams: ["GER", "CUW", "CIV", "ECU"], dates: ["14.06", "15.06", "20.06", "21.06", "25.06", "25.06"] },
    { letter: "F", teams: ["NED", "JPN", "SWE", "TUN"], dates: ["14.06", "15.06", "20.06", "21.06", "26.06", "26.06"] },
    { letter: "G", teams: ["BEL", "EGY", "IRN", "NZL"], dates: ["15.06", "16.06", "21.06", "22.06", "27.06", "27.06"] },
    { letter: "H", teams: ["ESP", "CPV", "KSA", "URU"], dates: ["15.06", "16.06", "21.06", "22.06", "27.06", "27.06"] },
    { letter: "I", teams: ["FRA", "SEN", "IRQ", "NOR"], dates: ["16.06", "17.06", "23.06", "23.06", "26.06", "26.06"] },
    { letter: "J", teams: ["ARG", "ALG", "AUT", "JOR"], dates: ["17.06", "17.06", "22.06", "23.06", "28.06", "28.06"] },
    { letter: "K", teams: ["POR", "COD", "UZB", "COL"], dates: ["17.06", "18.06", "23.06", "24.06", "28.06", "28.06"] },
    { letter: "L", teams: ["ENG", "CRO", "GHA", "PAN"], dates: ["17.06", "18.06", "23.06", "24.06", "28.06", "28.06"] }
  ];

  var byLetter = {};
  GROUPS.forEach(function (g) { byLetter[g.letter] = g; });

  function team(id) {
    var sets = window.WC_DATA.sets;
    for (var i = 0; i < sets.length; i++) if (sets[i].id === id) return sets[i];
    return { id: id, name: id, flag: null };
  }

  function matchKey(letter, home, away) { return letter + ":" + home + "-" + away; }

  // 6 матчей (круговой метод на 4 командах). Дата берётся из group.dates по индексу.
  var PAIRS = [[0, 1], [2, 3], [0, 2], [3, 1], [0, 3], [1, 2]];
  function allMatches(group) {
    return PAIRS.map(function (p, i) {
      var home = group.teams[p[0]], away = group.teams[p[1]];
      return { home: home, away: away, key: matchKey(group.letter, home, away), date: group.dates[i] };
    });
  }
  // "ДД.ММ" → число для сортировки по дате
  function dateKey(d) {
    var p = String(d).split(".");
    return (+p[1]) * 100 + (+p[0]);
  }
  function matchesByDate(group) {
    return allMatches(group).slice().sort(function (a, b) { return dateKey(a.date) - dateKey(b.date); });
  }

  function played(r) {
    return r && r.h !== null && r.h !== undefined && r.h !== "" &&
                r.a !== null && r.a !== undefined && r.a !== "";
  }

  // Расчёт таблицы из результатов. Возвращает { rows: [...отсортировано], anyPlayed }.
  // Каждая строка: { id, g, w, d, l, gf, ga, pts, form:[W/D/L...], next:oppId|null }.
  function compute(group, results) {
    var row = {};
    group.teams.forEach(function (id) {
      row[id] = { id: id, g: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, form: [], next: null };
    });
    var anyPlayed = false;

    // по датам — чтобы «форма» и «след. соперник» шли в хронологическом порядке
    matchesByDate(group).forEach(function (m) {
      var r = results[m.key];
      if (played(r)) {
        anyPlayed = true;
        var h = row[m.home], a = row[m.away], hs = +r.h, as = +r.a;
        h.g++; a.g++; h.gf += hs; h.ga += as; a.gf += as; a.ga += hs;
        if (hs > as) { h.w++; a.l++; h.pts += 3; h.form.push("W"); a.form.push("L"); }
        else if (hs < as) { a.w++; h.l++; a.pts += 3; h.form.push("L"); a.form.push("W"); }
        else { h.d++; a.d++; h.pts++; a.pts++; h.form.push("D"); a.form.push("D"); }
      } else {
        if (row[m.home].next === null) row[m.home].next = m.away;
        if (row[m.away].next === null) row[m.away].next = m.home;
      }
    });

    var arr = group.teams.map(function (id) { return row[id]; });
    arr.sort(function (x, y) {
      return (y.pts - x.pts) ||
        ((y.gf - y.ga) - (x.gf - x.ga)) ||
        (y.gf - x.gf) ||
        (group.teams.indexOf(x.id) - group.teams.indexOf(y.id));
    });
    return { rows: arr, anyPlayed: anyPlayed };
  }

  window.WC_GROUPS = {
    list: GROUPS,
    byLetter: byLetter,
    team: team,
    matchKey: matchKey,
    allMatches: allMatches,
    matchesByDate: matchesByDate,
    dateKey: dateKey,
    compute: compute
  };
})();
