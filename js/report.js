/* Отчёт по коллекции: что ЕСТЬ, чего НЕТ, какие ПОВТОРКИ (на обмен).
   Чистый модуль: строит структуру из каталога (WC_DATA) и состояния (store.js),
   затем сериализует её в человекочитаемый .txt и в .csv (для таблиц/Excel).
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

  // --- Текстовый отчёт (.txt) -------------------------------------------------

  var RULE = "────────────────────────────────────────────────";

  function codeList(items) {
    return items.map(function (i) { return i.code; }).join(", ");
  }
  function padEnd(str, len) {
    str = String(str);
    while (str.length < len) str += " ";
    return str;
  }
  function setPct(s) { return s.total ? Math.round(s.have / s.total * 100) : 0; }

  // Каждая секция — отдельная функция (возвращает массив строк),
  // чтобы её можно было выгрузить и целиком, и по отдельности.
  function headerLines(rep) {
    var t = rep.totals;
    return [
      "Альбом ЧМ-2026 — отчёт по наклейкам",
      "Сформировано: " + rep.generatedAt.toLocaleString("ru-RU"),
      "",
      "ИТОГО: " + t.total + " наклеек",
      "  ✓ Есть:    " + padEnd(t.have, 4) + " (" + t.pct + "%)",
      "  ✗ Нужно:   " + t.missing,
      "  ⇄ На обмен (повторки): " + t.dupes
    ];
  }
  function summaryLines(rep) {
    var L = [RULE, "СВОДКА ПО НАБОРАМ", RULE];
    rep.sets.forEach(function (s) {
      L.push(padEnd(s.name, 24) + padEnd(s.have + "/" + s.total, 8) +
        padEnd("(" + setPct(s) + "%)", 7) + "повт. " + s.dupes);
    });
    return L;
  }
  function missingLines(rep) {
    var t = rep.totals, L = [RULE, "НУЖНЫЕ — нет в наличии (" + t.missing + ")", RULE];
    if (!t.missing) { L.push("— всё собрано! 🎉"); return L; }
    rep.sets.forEach(function (s) {
      if (s.missingItems.length) {
        L.push(s.name + " (" + s.missingItems.length + "): " + codeList(s.missingItems));
      }
    });
    return L;
  }
  function dupLines(rep) {
    var t = rep.totals, L = [RULE, "НА ОБМЕН — повторки (× = сколько лишних копий) — всего " + t.dupes, RULE];
    var any = false;
    rep.sets.forEach(function (s) {
      if (!s.dupeItems.length) return;
      any = true;
      L.push(s.name + ": " + s.dupeItems.map(function (i) {
        return i.code + "×" + i.spare;
      }).join(", "));
    });
    if (!any) L.push("— повторок нет.");
    return L;
  }
  function haveLines(rep) {
    var t = rep.totals, L = [RULE, "ЕСТЬ В НАЛИЧИИ (" + t.have + ")", RULE];
    if (!t.have) { L.push("— пока ничего не отмечено."); return L; }
    rep.sets.forEach(function (s) {
      if (s.haveItems.length) {
        L.push(s.name + " (" + s.haveItems.length + "): " + codeList(s.haveItems));
      }
    });
    return L;
  }

  function toText(rep) {
    return headerLines(rep).concat(
      [""], summaryLines(rep),
      [""], missingLines(rep),
      [""], dupLines(rep),
      [""], haveLines(rep)
    ).join("\r\n");
  }

  // Описание секций для выгрузки по отдельности.
  var SECTIONS = {
    summary: { lines: summaryLines, file: "сводка" },
    missing: { lines: missingLines, file: "нужные" },
    dup: { lines: dupLines, file: "на-обмен" },
    have: { lines: haveLines, file: "есть" }
  };

  // Текст одной секции — с короткой шапкой (дата), чтобы файл был самодостаточным.
  function sectionText(rep, kind) {
    var s = SECTIONS[kind];
    if (!s) return "";
    return ["Альбом ЧМ-2026 — " + rep.generatedAt.toLocaleString("ru-RU"), ""]
      .concat(s.lines(rep)).join("\r\n");
  }

  // --- Таблица CSV (.csv) — строка = страна, 20 клеток (наклейки 1..20) -------
  // В клетке: «есть» (1 шт.), «повтор» (есть + лишние), пусто (нет).
  // Разделитель «;» и BOM — чтобы Excel с русской локалью открыл корректно.

  function csvCell(v) {
    v = String(v == null ? "" : v);
    if (/[";\n\r]/.test(v)) v = '"' + v.replace(/"/g, '""') + '"';
    return v;
  }
  function toCSV(rep) {
    var header = ["Страна"];
    for (var n = 1; n <= 20; n++) header.push(n);
    var rows = [header.join(";")];
    rep.sets.forEach(function (s) {
      var row = [csvCell(s.name)];
      s.items.forEach(function (i) {
        row.push(i.count >= 2 ? "повтор" : (i.count >= 1 ? "есть" : ""));
      });
      rows.push(row.join(";"));
    });
    return "﻿" + rows.join("\r\n");
  }

  // --- Скачивание файла -------------------------------------------------------

  function download(filename, content, mime) {
    var blob = new Blob([content], { type: (mime || "text/plain") + ";charset=utf-8" });
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

  function downloadText(rep) {
    download("wc2026-наклейки-" + stamp() + ".txt", toText(rep), "text/plain");
  }
  function downloadCSV(rep) {
    download("wc2026-наклейки-" + stamp() + ".csv", toCSV(rep), "text/csv");
  }
  function downloadSection(rep, kind) {
    var s = SECTIONS[kind];
    if (!s) return;
    download("wc2026-" + s.file + "-" + stamp() + ".txt", sectionText(rep, kind), "text/plain");
  }

  window.WC_REPORT = {
    build: build,
    toText: toText,
    toCSV: toCSV,
    sectionText: sectionText,
    download: download,
    downloadText: downloadText,
    downloadCSV: downloadCSV,
    downloadSection: downloadSection
  };
})();
