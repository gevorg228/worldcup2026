/* Отчёт по коллекции: что ЕСТЬ, чего НЕТ, какие ПОВТОРКИ (на обмен).
   Чистый модуль: строит структуру из каталога (WC_DATA) и состояния (store.js),
   затем сериализует её в табличный .csv (для Excel). Все выгрузки — таблицы.
   Модель счётчиков та же, что в progress.js:
     count>=1 — «есть»; повторки (на обмен) = count-1 при count>=2. */
(function () {
  "use strict";

  // Структурированный отчёт из каталога + состояния.
  // sets[i] = { id, name, kind, total, have, missing, dupes(=лишних копий),
  //             items[] (все наклейки набора по порядку), haveItems, missingItems, dupeItems }.
  function build(data, state) {
    var counts = (state && state.counts) || {};
    var sets = data.sets.map(function (set) {
      var items = [], have = [], missing = [], dupeItems = [], spareTotal = 0;
      set.stickers.forEach(function (s) {
        var n = counts[s.code] || 0;
        var spare = n >= 2 ? n - 1 : 0;
        var item = { code: s.code, label: s.label || "", count: n, has: n >= 1, spare: spare };
        items.push(item);
        if (item.has) have.push(item); else missing.push(item);
        if (spare > 0) { dupeItems.push(item); spareTotal += spare; }
      });
      return {
        id: set.id, name: set.name, kind: set.kind,
        total: set.stickers.length,
        have: have.length, missing: missing.length, dupes: spareTotal,
        items: items, haveItems: have, missingItems: missing, dupeItems: dupeItems
      };
    });
    var totals = sets.reduce(function (a, s) {
      a.total += s.total; a.have += s.have; a.missing += s.missing; a.dupes += s.dupes; return a;
    }, { total: 0, have: 0, missing: 0, dupes: 0 });
    totals.pct = totals.total ? Math.round(totals.have / totals.total * 100) : 0;
    return { generatedAt: new Date(), totals: totals, sets: sets };
  }

  // --- Табличный CSV (.csv) ---------------------------------------------------
  // Все выгрузки — таблицы. Сетка: строка = страна, колонки 1..20 (наклейки).
  // Разделитель «;» и BOM — чтобы Excel с русской локалью открыл корректно.

  var BOM = "﻿";

  function csvCell(v) {
    v = String(v == null ? "" : v);
    if (/[";\n\r]/.test(v)) v = '"' + v.replace(/"/g, '""') + '"';
    return v;
  }

  // Сетка «страна × 20 клеток»; cellFn(item) задаёт содержимое клетки.
  function gridCSV(rep, cellFn) {
    var header = ["Страна"];
    for (var n = 1; n <= 20; n++) header.push(n);
    var rows = [header.join(";")];
    rep.sets.forEach(function (s) {
      var row = [csvCell(s.name)];
      s.items.forEach(function (i) { row.push(csvCell(cellFn(i))); });
      rows.push(row.join(";"));
    });
    return BOM + rows.join("\r\n");
  }

  // Полная таблица: «есть» / «повтор» / пусто.
  function toCSV(rep) {
    return gridCSV(rep, function (i) {
      return i.count >= 2 ? "повтор" : (i.count >= 1 ? "есть" : "");
    });
  }

  // Секции — тоже таблицы. Сводка — статистика по наборам;
  // остальные — та же сетка 20 клеток, но только со своими отметками.
  var SECTIONS = {
    summary: {
      file: "сводка",
      csv: function (rep) {
        var rows = ["Страна;Есть;Всего;%;Повторки"];
        rep.sets.forEach(function (s) {
          var pc = s.total ? Math.round(s.have / s.total * 100) : 0;
          rows.push([csvCell(s.name), s.have, s.total, pc, s.dupes].join(";"));
        });
        return BOM + rows.join("\r\n");
      }
    },
    missing: {
      file: "нужные",
      csv: function (rep) { return gridCSV(rep, function (i) { return i.has ? "" : "нужно"; }); }
    },
    dup: {
      file: "на-обмен",
      // в клетке — сколько лишних копий (на обмен)
      csv: function (rep) { return gridCSV(rep, function (i) { return i.spare > 0 ? i.spare : ""; }); }
    },
    have: {
      file: "есть",
      csv: function (rep) { return gridCSV(rep, function (i) { return i.has ? "есть" : ""; }); }
    }
  };

  function sectionCSV(rep, kind) {
    var s = SECTIONS[kind];
    return s ? s.csv(rep) : "";
  }

  // --- Скачивание файла -------------------------------------------------------

  function download(filename, content, mime) {
    var blob = new Blob([content], { type: (mime || "text/csv") + ";charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 0);
  }

  function stamp() { return new Date().toISOString().slice(0, 10); } // YYYY-MM-DD

  function downloadCSV(rep) {
    download("wc2026-наклейки-" + stamp() + ".csv", toCSV(rep), "text/csv");
  }
  function downloadSection(rep, kind) {
    var s = SECTIONS[kind];
    if (!s) return;
    download("wc2026-" + s.file + "-" + stamp() + ".csv", s.csv(rep), "text/csv");
  }

  window.WC_REPORT = {
    build: build,
    toCSV: toCSV,
    sectionCSV: sectionCSV,
    download: download,
    downloadCSV: downloadCSV,
    downloadSection: downloadSection
  };
})();
