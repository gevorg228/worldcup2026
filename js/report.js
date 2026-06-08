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

  function toText(rep) {
    var t = rep.totals, L = [];
    L.push("Альбом ЧМ-2026 — отчёт по наклейкам");
    L.push("Сформировано: " + rep.generatedAt.toLocaleString("ru-RU"));
    L.push("");
    L.push("ИТОГО: " + t.total + " наклеек");
    L.push("  ✓ Есть:    " + padEnd(t.have, 4) + " (" + t.pct + "%)");
    L.push("  ✗ Нужно:   " + t.missing);
    L.push("  ⇄ На обмен (повторки): " + t.dupes);
    L.push("");

    L.push(RULE);
    L.push("СВОДКА ПО НАБОРАМ");
    L.push(RULE);
    rep.sets.forEach(function (s) {
      L.push(padEnd(s.name, 24) + padEnd(s.have + "/" + s.total, 8) +
        padEnd("(" + setPct(s) + "%)", 7) + "повт. " + s.dupes);
    });
    L.push("");

    L.push(RULE);
    L.push("НУЖНЫЕ — нет в наличии (" + t.missing + ")");
    L.push(RULE);
    if (!t.missing) {
      L.push("— всё собрано! 🎉");
    } else {
      rep.sets.forEach(function (s) {
        if (s.missingItems.length) {
          L.push(s.name + " (" + s.missingItems.length + "): " + codeList(s.missingItems));
        }
      });
    }
    L.push("");

    L.push(RULE);
    L.push("НА ОБМЕН — повторки (× = сколько лишних копий) — всего " + t.dupes);
    L.push(RULE);
    var anyDup = false;
    rep.sets.forEach(function (s) {
      if (!s.dupeItems.length) return;
      anyDup = true;
      L.push(s.name + ": " + s.dupeItems.map(function (i) {
        return i.code + "×" + i.spare;
      }).join(", "));
    });
    if (!anyDup) L.push("— повторок нет.");
    L.push("");

    L.push(RULE);
    L.push("ЕСТЬ В НАЛИЧИИ (" + t.have + ")");
    L.push(RULE);
    if (!t.have) {
      L.push("— пока ничего не отмечено.");
    } else {
      rep.sets.forEach(function (s) {
        if (s.haveItems.length) {
          L.push(s.name + " (" + s.haveItems.length + "): " + codeList(s.haveItems));
        }
      });
    }

    return L.join("\r\n");
  }

  // --- Таблица CSV (.csv) — по одной строке на наклейку ----------------------
  // Разделитель «;» и BOM — чтобы Excel с русской локалью открыл корректно.

  function csvCell(v) {
    v = String(v == null ? "" : v);
    if (/[";\n\r]/.test(v)) v = '"' + v.replace(/"/g, '""') + '"';
    return v;
  }
  function toCSV(rep) {
    var rows = ["Набор;Код;Подпись;Статус;Всего копий;Повторки"];
    rep.sets.forEach(function (s) {
      s.items.forEach(function (i) {
        rows.push([
          csvCell(s.name), csvCell(i.code), csvCell(i.label),
          i.has ? "есть" : "нет", i.count, i.spare
        ].join(";"));
      });
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

  window.WC_REPORT = {
    build: build,
    toText: toText,
    toCSV: toCSV,
    download: download,
    downloadText: downloadText,
    downloadCSV: downloadCSV
  };
})();
