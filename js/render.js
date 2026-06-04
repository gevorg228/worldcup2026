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

  // Одна карточка-наклейка. sticker: { code, label?, big? }, count: число.
  // Модель: count = всего копий. «Есть» (галочка) = count>=1; «повторки» = count-1.
  // В поле-числе показываем именно повторки (пусто, если их 0).
  function card(sticker, count) {
    var has = count >= 1;
    var cls = "card" + (has ? " has" : "") + (sticker.big ? " big" : "");
    var label = sticker.label
      ? '<span class="card-label">' + esc(sticker.label) + "</span>"
      : "";
    var dupValue = count >= 2 ? String(count - 1) : "";
    return (
      '<div class="' + cls + '" data-code="' + esc(sticker.code) + '" role="button" tabindex="0"' +
      ' aria-pressed="' + (has ? "true" : "false") + '" aria-label="' + esc(sticker.code) + '">' +
      '<span class="card-code">' + esc(sticker.code) + "</span>" +
      label +
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

  function renderTeam(set, state) {
    var head =
      '<header class="team-head">' +
      '<a class="back" href="#/">← Все наборы</a>' +
      "<h1>" + esc(set.name) + "</h1>" +
      teamProgressHTML(set, state) +
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
      var cardsHtml = set.stickers.map(function (s) {
        return card(s, state.counts[s.code] || 0);
      }).join("");
      body = '<div class="grid">' + cardsHtml + "</div>";
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
      '<button type="button" data-action="export">⬇ Экспорт</button>' +
      '<button type="button" data-action="import">⬆ Импорт</button>' +
      '<input type="file" id="importFile" accept="application/json,.json" hidden>' +
      "</div>" +
      '<div class="saved-line">' + esc(saved) + "</div>" +
      "</header>";

    var tiles = data.sets.map(function (set) {
      var p = P.setProgress(set, state);
      var done = p.collected === p.total ? " done" : "";
      return (
        '<a class="tile' + done + '" href="#/set/' + esc(set.id) + '">' +
        '<span class="tile-name">' + esc(set.name) + "</span>" +
        '<span class="tile-nums">' + p.collected + "/" + p.total + " · " + p.pct + "%</span>" +
        progressBar(p.pct) +
        "</a>"
      );
    }).join("");

    return head + '<main class="tiles">' + tiles + "</main>";
  }

  window.WC_RENDER = {
    renderOverview: renderOverview,
    renderTeam: renderTeam,
    teamProgressHTML: teamProgressHTML
  };
})();
