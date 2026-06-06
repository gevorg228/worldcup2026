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
      '<div class="topnav"><a href="#/groups">🏆 Группы / турнирная таблица</a></div>' +
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
        '<span class="tile-name">' + flagImg(set) + esc(set.name) + "</span>" +
        '<span class="tile-nums">' + p.collected + "/" + p.total + " · " + p.pct + "%</span>" +
        progressBar(p.pct) +
        "</a>"
      );
    }).join("");

    return head + '<main class="tiles">' + tiles + "</main>";
  }

  // --- Группы ----------------------------------------------------------------

  function dot(res) {
    var cls = res === "W" ? "w" : res === "L" ? "l" : res === "D" ? "d" : "e";
    return '<span class="dot dot-' + cls + '"></span>';
  }
  function formDots(form) {
    var html = "";
    for (var i = 0; i < 3; i++) html += dot(form[i] || null);
    return html;
  }
  function fmtDate(d) {
    var p = String(d).split(".");
    var mm = { "06": "июня", "07": "июля" }[p[1]] || ("." + p[1]);
    return (+p[0]) + " " + mm;
  }

  // Таблица группы (используется и для точечного обновления после ввода счёта).
  function standingsTableHTML(letter, gstate) {
    var G = window.WC_GROUPS, group = G.byLetter[letter];
    var res = G.compute(group, gstate.results);
    var body = res.rows.map(function (t, i) {
      var to = G.team(t.id);
      var pos = res.anyPlayed ? (i + 1) : "–";
      var next = t.next ? flagImg(G.team(t.next)) : "–";
      return "<tr>" +
        '<td class="c">' + pos + "</td>" +
        '<td class="team">' + flagImg(to) + "<span>" + esc(to.name) + "</span></td>" +
        '<td class="c">' + t.g + "</td>" +
        '<td class="c">' + t.w + "</td>" +
        '<td class="c">' + t.d + "</td>" +
        '<td class="c">' + t.l + "</td>" +
        '<td class="c">' + t.gf + "−" + t.ga + "</td>" +
        '<td class="c pts">' + t.pts + "</td>" +
        '<td class="c form">' + formDots(t.form) + "</td>" +
        '<td class="c next">' + next + "</td>" +
        "</tr>";
    }).join("");
    return '<div class="table-wrap"><table class="standings">' +
      "<thead><tr>" +
      '<th class="c">#</th><th>Команда</th>' +
      '<th class="c">Игры</th><th class="c">В</th><th class="c">Н</th><th class="c">П</th>' +
      '<th class="c">Мячи</th><th class="c">Очки</th>' +
      '<th class="c">Посл. матчи</th><th class="c">След.</th>' +
      "</tr></thead><tbody>" + body + "</tbody></table></div>";
  }

  function renderGroup(letter, gstate) {
    var G = window.WC_GROUPS, group = G.byLetter[letter];
    if (!group) return renderGroupsIndex();

    var head =
      '<header class="team-head">' +
      '<a class="back" href="#/groups">← Все группы</a>' +
      "<h1>Группа " + esc(letter) + "</h1>" +
      "</header>";

    var standings = '<div id="groupStandings">' + standingsTableHTML(letter, gstate) + "</div>";

    var matchRow = function (m) {
      var r = gstate.results[m.key] || {};
      var hv = (r.h !== null && r.h !== undefined) ? r.h : "";
      var av = (r.a !== null && r.a !== undefined) ? r.a : "";
      var H = G.team(m.home), A = G.team(m.away);
      return '<div class="match">' +
        '<span class="mt mt-h"><span>' + esc(H.name) + "</span>" + flagImg(H) + "</span>" +
        '<input class="ms" type="number" inputmode="numeric" min="0" data-mkey="' + esc(m.key) + '" data-side="h" value="' + hv + '" aria-label="' + esc(H.name) + '">' +
        '<span class="msep">:</span>' +
        '<input class="ms" type="number" inputmode="numeric" min="0" data-mkey="' + esc(m.key) + '" data-side="a" value="' + av + '" aria-label="' + esc(A.name) + '">' +
        '<span class="mt mt-a">' + flagImg(A) + "<span>" + esc(A.name) + "</span></span>" +
        "</div>";
    };
    // группируем матчи по дате (в хронологическом порядке)
    var byDate = [];
    G.matchesByDate(group).forEach(function (m) {
      var last = byDate[byDate.length - 1];
      if (last && last.date === m.date) last.items.push(m);
      else byDate.push({ date: m.date, items: [m] });
    });
    var matches = byDate.map(function (d) {
      return '<section class="matchday"><h2>' + esc(fmtDate(d.date)) + "</h2>" +
        d.items.map(matchRow).join("") + "</section>";
    }).join("");

    return head + standings + '<div class="matches">' + matches + "</div>";
  }

  function renderGroupsIndex(pstate, gstate) {
    var G = window.WC_GROUPS;
    var head =
      '<header class="overview-head">' +
      '<a class="back" href="#/">← Наборы</a>' +
      '<div class="topnav"><a href="#/playoff">🏆 Плей-офф (сетка) ↓</a></div>' +
      "<h1>Группы</h1>" +
      "</header>";
    var tiles = G.list.map(function (group) {
      var flags = group.teams.map(function (id) { return flagImg(G.team(id)); }).join("");
      return '<a class="tile gtile" href="#/group/' + group.letter + '">' +
        '<span class="tile-name">Группа ' + group.letter + "</span>" +
        '<span class="gflags">' + flags + "</span>" +
        "</a>";
    }).join("");
    return head + '<main class="tiles">' + tiles + "</main>" +
      '<section id="playoffBracket" class="po-section">' + renderPlayoff(pstate, gstate) + "</section>";
  }

  // --- Плей-офф (сетка) -------------------------------------------------------

  // Одна строка команды в матче: флаг + название (или метка слота) + ячейка счёта.
  // label — что показать, пока команда не определена (1E, 3ABCDF, A01…).
  function poTeamRowHTML(mid, side, teamId, label, score, isWin, isLose) {
    var G = window.WC_GROUPS;
    var t = teamId ? G.team(teamId) : null;
    var nm = t ? t.name : (label || "—");
    var flag = t ? flagImg(t) : "";
    var cls = "po-team" + (isWin ? " po-win" : "") + (isLose ? " po-lose" : "") + (t ? "" : " po-tbd");
    var val = (score !== null && score !== undefined && score !== "") ? score : "";
    return '<div class="' + cls + '">' +
      '<span class="po-flag">' + flag + "</span>" +
      '<span class="po-name">' + esc(nm) + "</span>" +
      '<input class="po-score" type="number" inputmode="numeric" min="0" step="1"' +
      ' data-pmatch="' + esc(mid) + '" data-side="' + side + '" value="' + esc(val) +
      '" aria-label="' + esc(nm) + ', счёт"></div>';
  }

  // Один матч (m — уже резолвленный объект из WC_PLAYOFF).
  function poMatchHTML(m) {
    var date = m.date ? '<div class="po-date">' + esc(fmtDate(m.date)) + "</div>" : "";
    return '<div class="po-match" data-mid="' + esc(m.id) + '">' + date +
      poTeamRowHTML(m.id, "h", m.a, m.labelA, m.sa, m.winner && m.winner === m.a, m.loser && m.loser === m.a) +
      poTeamRowHTML(m.id, "a", m.b, m.labelB, m.sb, m.winner && m.winner === m.b, m.loser && m.loser === m.b) +
      "</div>";
  }

  // Колонка раунда одной из половин. side: "l" (слева) | "r" (справа).
  function poColHTML(round, side, matches, resolved) {
    var inner = matches.map(function (def) {
      return poMatchHTML(resolved[def.id]);
    }).join("");
    return '<div class="po-col po-' + side + '" data-round="' + esc(round.key) + '">' +
      '<div class="po-round-title">' + esc(round.title) + "</div>" +
      '<div class="po-round">' + inner + "</div></div>";
  }

  function renderPlayoff(pstate, gstate) {
    pstate = pstate || window.WC_STORE.loadPlayoffResults();
    gstate = gstate || window.WC_STORE.loadGroupResults();
    var PO = window.WC_PLAYOFF;
    var resolved = PO.resolveAll(pstate.results, gstate);

    var byKey = {};
    PO.rounds.forEach(function (r) { byKey[r.key] = r; });

    // Зеркальная сетка: левая половина каждого раунда — слева, правая — справа,
    // финал — в центре. Колонки справа идут в обратном порядке раундов.
    var order = ["r32", "r16", "qf", "sf"];
    var leftCols = order.map(function (k) {
      var r = byKey[k], half = r.matches.slice(0, r.matches.length / 2);
      return poColHTML(r, "l", half, resolved);
    }).join("");
    var rightCols = order.slice().reverse().map(function (k) {
      var r = byKey[k], half = r.matches.slice(r.matches.length / 2);
      return poColHTML(r, "r", half, resolved);
    }).join("");

    // Центр: финал, а под ним — матч за 3-е место.
    var finalRound = byKey["final"], thirdRound = byKey["third"];
    var thirdInline = thirdRound ?
      '<div class="po-third-inline">' +
      '<div class="po-third-title">' + esc(thirdRound.title) + "</div>" +
      poMatchHTML(resolved[thirdRound.matches[0].id]) + "</div>" : "";
    var centerCol = '<div class="po-col po-center" data-round="final">' +
      '<div class="po-round-title">' + esc(finalRound.title) + "</div>" +
      '<div class="po-round">' + poMatchHTML(resolved["final"]) + thirdInline + "</div></div>";

    var bracket = '<div class="po-bracket">' + leftCols + centerCol + rightCols + "</div>";

    return "<h2>Плей-офф</h2>" +
      '<p class="po-hint">Введите счёт — победитель автоматически проходит дальше, ' +
      "проигравшие полуфиналов попадают в матч за 3-е место.</p>" +
      '<div class="po-scroll">' + bracket + "</div>";
  }

  window.WC_RENDER = {
    renderOverview: renderOverview,
    renderTeam: renderTeam,
    teamProgressHTML: teamProgressHTML,
    renderGroupsIndex: renderGroupsIndex,
    renderGroup: renderGroup,
    standingsTableHTML: standingsTableHTML,
    renderPlayoff: renderPlayoff
  };
})();
