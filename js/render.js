/* Рендер HTML. Возвращает строки, которые app.js кладёт в #view.
   Данные (коды/имена/подписи) — из нашего каталога, доверенные;
   единственное, что вводит пользователь, — целые числа (счётчики). */
(function () {
  "use strict";

  var P = window.WC_PROGRESS;

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function progressBar(pctVal) {
    return '<div class="bar"><span style="width:' + pctVal + '%"></span></div>';
  }

  function flagImg(set) {
    return set.flag
      ? '<img class="flag" src="flags/' + esc(set.flag) + '.svg" alt="" loading="lazy">'
      : "";
  }

  // Одна карточка-наклейка. sticker: { code, label?, big? }, count: число.
  // Модель: count = всего копий. «Есть» (галочка) = count>=1; «повторки» = count-1.
  // В поле-числе показываем именно повторки (пусто, если их 0).
  function card(sticker, count, opts) {
    opts = opts || {};
    var has = count >= 1;
    var cls = "card" + (has ? " has" : "") + (sticker.big ? " big" : "") + (opts.wide ? " wide" : "");
    var dupValue = count >= 2 ? String(count - 1) : "";
    return (
      '<div class="' + cls + '" data-code="' + esc(sticker.code) + '" role="button" tabindex="0"' +
      ' aria-pressed="' + (has ? "true" : "false") + '" aria-label="' + esc(sticker.code) + '">' +
      '<span class="card-code">' + esc(sticker.code) + "</span>" +
      '<span class="check" aria-hidden="true">✓</span>' +
      '<span class="dup"><span class="dup-cap">повт.</span>' +
      '<input class="card-count" type="number" inputmode="numeric" min="0" step="1"' +
      ' value="' + dupValue + '" placeholder="0" aria-label="Повторки ' + esc(sticker.code) + '"></span>' +
      "</div>"
    );
  }

  // Полоса прогресса набора (используется и при точечном обновлении после клика).
  function teamProgressHTML(set, state) {
    var p = P.setProgress(set, state);
    var dupes = p.dupes ? ' · повторки: <b>' + p.dupes + "</b>" : "";
    return (
      '<div class="progress-line" id="teamProgress">' +
      "<span class=\"nums\">Собрано <b>" + p.collected + "</b> / " + p.total +
      " · <b>" + p.pct + "%</b>" + dupes + "</span>" +
      progressBar(p.pct) +
      "</div>"
    );
  }

  // Ссылка-стрелка на соседний набор (предыдущий/следующий), с зацикливанием.
  function teamNavBtn(set, dir) {
    if (!set) return "";
    var arrow = dir < 0 ? "‹" : "›";
    var cls = "team-nav-btn " + (dir < 0 ? "prev" : "next");
    var title = (dir < 0 ? "Предыдущий: " : "Следующий: ") + set.name;
    return '<a class="' + cls + '" href="#/set/' + esc(set.id) + '"' +
      ' title="' + esc(title) + '" aria-label="' + esc(title) + '">' + arrow + "</a>";
  }

  // Сосед по списку наборов со сдвигом dir (−1 / +1), по кругу.
  function neighborSet(set, dir) {
    var sets = (window.WC_DATA && window.WC_DATA.sets) || [];
    var i = -1;
    for (var k = 0; k < sets.length; k++) { if (sets[k].id === set.id) { i = k; break; } }
    if (i < 0 || sets.length < 2) return null;
    return sets[(i + dir + sets.length) % sets.length];
  }

  function renderTeam(set, state) {
    var prev = neighborSet(set, -1);
    var next = neighborSet(set, 1);
    var head =
      '<header class="team-head">' +
      '<a class="back" href="#/">← Все наборы</a>' +
      '<div class="team-nav">' +
      teamNavBtn(prev, -1) +
      "<h1>" + flagImg(set) + esc(set.name) + "</h1>" +
      teamNavBtn(next, 1) +
      "</div>" +
      teamProgressHTML(set, state) +
      '<div class="team-tools">' +
      '<button type="button" data-action="clear-dupes">Убрать повторки</button>' +
      "</div>" +
      "</header>";

    var body;
    if (set.kind === "special") {
      // FWC: разбиваем по разделам альбома.
      var sections = window.WC_FWC_SECTIONS || [];
      body = sections.map(function (sec) {
        var items = set.stickers.filter(function (s) { return s.section === sec.key; });
        if (!items.length) return "";
        var cards = items.map(function (s) {
          return card(s, state.counts[s.code] || 0);
        }).join("");
        return (
          '<section class="fwc-section">' +
          "<h2>" + esc(sec.title) + "</h2>" +
          '<div class="grid">' + cards + "</div>" +
          "</section>"
        );
      }).join("");
    } else {
      // Разворот 1:1 по фото. Каждый ряд — { align?, cells: [...] },
      // где cell "n" — обычная карточка, "w" — горизонтальная (на 2 колонки).
      //  Левая:  [1,2 справа] / [3,4,5,6] / [7,8,9,10]
      //  Правая: [11,12, 13-гориз.] / [14,15,16,17] / [18,19,20 справа]
      var renderRows = function (stickers, rows) {
        var html = "", idx = 0;
        rows.forEach(function (row) {
          var cls = "prow" + (row.align ? " prow-" + row.align : "");
          var cells = row.cells.map(function (t) {
            var s = stickers[idx++];
            return card(s, state.counts[s.code] || 0, { wide: t === "w" });
          }).join("");
          html += '<div class="' + cls + '">' + cells + "</div>";
        });
        return html;
      };
      var leftRows = [
        { align: "right", cells: ["n", "n"] },
        { cells: ["n", "n", "n", "n"] },
        { cells: ["n", "n", "n", "n"] }
      ];
      var rightRows = [
        { cells: ["n", "n", "w"] },
        { cells: ["n", "n", "n", "n"] },
        { align: "right", cells: ["n", "n", "n"] }
      ];
      body = '<div class="spread">' +
        '<div class="page">' + renderRows(set.stickers.slice(0, 10), leftRows) + "</div>" +
        '<div class="page">' + renderRows(set.stickers.slice(10, 20), rightRows) + "</div>" +
        "</div>";
    }

    return head + '<main class="team-body">' + body + "</main>";
  }

  function renderOverview(data, state) {
    var o = P.overallProgress(data, state);

    var saved = state.updatedAt
      ? "последнее сохранение: " + new Date(state.updatedAt).toLocaleString("ru-RU")
      : "пока ничего не сохранено";

    var head =
      '<header class="overview-head">' +
      "<h1>Альбом ЧМ-2026 — мои наклейки</h1>" +
      '<div class="overall" id="overallProgress">' +
      '<div class="overall-nums">' +
      "<span>Собрано <b>" + o.collected + "</b> / " + o.total + "</span>" +
      "<span class=\"big-pct\">" + o.pct + "%</span>" +
      "<span>Осталось <b>" + o.remaining + "</b></span>" +
      "<span>На обмен <b>" + o.dupes + "</b></span>" +
      "</div>" +
      progressBar(o.pct) +
      "</div>" +
      '<div class="toolbar">' +
      '<button type="button" data-action="report">📋 Отчёт (есть / нужно / обмен)</button>' +
      '<button type="button" data-action="export">⬇ Бэкап (JSON)</button>' +
      '<button type="button" data-action="import">⬆ Импорт</button>' +
      '<input type="file" id="importFile" accept="application/json,.json" hidden>' +
      "</div>" +
      '<div class="saved-line">' + esc(saved) + "</div>" +
      "</header>";

    // Поле поиска: фильтрует наборы по названию страны или по буквам/кодам наклеек
    // (напр. «qat»). Фильтрация — в app.js по data-search без перерендера.
    var search =
      '<div class="search-box">' +
      '<input type="search" id="setSearch" class="search-input" autocomplete="off"' +
      ' placeholder="Поиск: страна или код наклейки (напр. qat)"' +
      ' aria-label="Поиск набора">' +
      '<span class="search-empty" id="searchEmpty" hidden>Ничего не найдено</span>' +
      "</div>";

    var tiles = data.sets.map(function (set) {
      var p = P.setProgress(set, state);
      var done = p.collected === p.total ? " done" : "";
      // строка для поиска: имя + id + все коды набора, в нижнем регистре
      var hay = (set.name + " " + set.id + " " +
        set.stickers.map(function (s) { return s.code; }).join(" ")).toLowerCase();
      return (
        '<a class="tile' + done + '" href="#/set/' + esc(set.id) + '"' +
        ' data-search="' + esc(hay) + '">' +
        '<span class="tile-name">' + flagImg(set) + esc(set.name) + "</span>" +
        '<span class="tile-nums">' + p.collected + "/" + p.total + " · " + p.pct + "%</span>" +
        progressBar(p.pct) +
        "</a>"
      );
    }).join("");

    return head + search + '<main class="tiles" id="setTiles">' + tiles + "</main>";
  }

  // --- Отчёт по коллекции (есть / нужно / повторки) --------------------------

  // Чип с кодом наклейки. Для повторок добавляем ×N (лишних копий).
  function chip(item, kind) {
    var badge = kind === "dup" ? '<span class="chip-x">×' + item.spare + "</span>" : "";
    var lbl = item.label ? ' title="' + esc(item.label) + '"' : "";
    return '<span class="chip chip-' + kind + '"' + lbl + ">" + esc(item.code) + badge + "</span>";
  }

  // Блок «набор + чипы» для одной секции отчёта. items — массив наклеек.
  function reportSetBlock(set, items, kind) {
    if (!items.length) return "";
    var chips = items.map(function (i) { return chip(i, kind); }).join("");
    return '<div class="rep-set">' +
      "<h3>" + flagImg(set) + esc(set.name) +
      ' <span class="cnt">' + items.length + "</span></h3>" +
      '<div class="rep-chips">' + chips + "</div></div>";
  }

  // Секция отчёта внутри <details> (длинные списки можно свернуть).
  function reportSection(title, count, openByDefault, sets, pick, kind, emptyMsg) {
    var blocks = sets.map(function (s) { return reportSetBlock(s, pick(s), kind); }).join("");
    if (!blocks) blocks = '<p class="rep-empty">' + esc(emptyMsg) + "</p>";
    return '<details class="rep-section"' + (openByDefault ? " open" : "") + ">" +
      "<summary><span>" + esc(title) + '</span><span class="rep-count">' + count + "</span></summary>" +
      '<div class="rep-body">' + blocks + "</div></details>";
  }

  function renderReport(data, state) {
    var rep = window.WC_REPORT.build(data, state);
    var t = rep.totals;

    var head =
      '<header class="overview-head">' +
      '<a class="back" href="#/">← Все наборы</a>' +
      "<h1>Отчёт по коллекции</h1>" +
      '<div class="overall">' +
      '<div class="overall-nums">' +
      "<span>Всего <b>" + t.total + "</b></span>" +
      "<span>✓ Есть <b>" + t.have + "</b></span>" +
      "<span>✗ Нужно <b>" + t.missing + "</b></span>" +
      "<span>⇄ На обмен <b>" + t.dupes + "</b></span>" +
      '<span class="big-pct">' + t.pct + "%</span>" +
      "</div>" +
      progressBar(t.pct) +
      "</div>" +
      '<div class="toolbar">' +
      '<button type="button" data-action="report-txt">⬇ Скачать .txt</button>' +
      '<button type="button" data-action="report-csv">⬇ Скачать .csv (таблица)</button>' +
      "</div>" +
      '<div class="saved-line">Сформировано: ' + esc(rep.generatedAt.toLocaleString("ru-RU")) + "</div>" +
      "</header>";

    // Сводная таблица по наборам.
    var summaryRows = rep.sets.map(function (s) {
      var pc = s.total ? Math.round(s.have / s.total * 100) : 0;
      var done = s.have === s.total ? " rep-done" : "";
      return '<tr class="' + done.trim() + '">' +
        '<td class="rep-name">' + flagImg(s) + esc(s.name) + "</td>" +
        '<td class="c">' + s.have + "/" + s.total + "</td>" +
        '<td class="c">' + pc + "%</td>" +
        '<td class="c">' + s.missing + "</td>" +
        '<td class="c">' + (s.dupes || "") + "</td>" +
        "</tr>";
    }).join("");
    var summary =
      '<details class="rep-section" open>' +
      "<summary><span>Сводка по наборам</span></summary>" +
      '<div class="rep-body"><div class="table-wrap"><table class="rep-summary">' +
      "<thead><tr><th>Набор</th><th class=\"c\">Есть</th><th class=\"c\">%</th>" +
      '<th class="c">Нужно</th><th class="c">Повт.</th></tr></thead>' +
      "<tbody>" + summaryRows + "</tbody></table></div></div></details>";

    var sections =
      reportSection("✗ Нужные — нет в наличии", t.missing, true, rep.sets,
        function (s) { return s.missingItems; }, "missing", "Всё собрано! 🎉") +
      reportSection("⇄ На обмен — повторки", t.dupes, true, rep.sets,
        function (s) { return s.dupeItems; }, "dup", "Повторок пока нет.") +
      reportSection("✓ Есть в наличии", t.have, false, rep.sets,
        function (s) { return s.haveItems; }, "have", "Пока ничего не отмечено.");

    return head + '<main class="report">' + summary + sections + "</main>";
  }

  window.WC_RENDER = {
    renderOverview: renderOverview,
    renderTeam: renderTeam,
    renderReport: renderReport,
    teamProgressHTML: teamProgressHTML
  };
})();
