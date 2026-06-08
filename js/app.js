/* Точка входа: hash-роутинг, делегирование событий, связка store + render.
   Подключается последним (после data/store/progress/render). */
(function () {
  "use strict";

  var DATA = window.WC_DATA;
  var STORE = window.WC_STORE;
  var RENDER = window.WC_RENDER;

  var view = document.getElementById("view");
  var state = STORE.loadProgress();
  var currentSet = null;

  // Индексы: набор по id и множество всех известных кодов (для валидации импорта).
  var SET_BY_ID = {};
  var KNOWN_CODES = new Set();
  DATA.sets.forEach(function (set) {
    SET_BY_ID[set.id] = set;
    set.stickers.forEach(function (s) { KNOWN_CODES.add(s.code); });
  });

  // Сообщаем пользователю, если сохранение в localStorage не удалось (приватный режим/квота).
  var saveErrorShown = false;
  window.WC_onSaveError = function () {
    if (saveErrorShown) return;
    saveErrorShown = true;
    alert("Не удалось сохранить прогресс в браузере. Сделайте Экспорт, чтобы не потерять данные.");
  };

  // --- Роутинг ---------------------------------------------------------------

  function route() {
    var hash = location.hash || "#/";
    currentSet = null;

    var mSet = hash.match(/^#\/set\/(.+)$/);
    if (mSet) {
      var set = SET_BY_ID[decodeURIComponent(mSet[1])];
      if (set) {
        currentSet = set;
        view.innerHTML = RENDER.renderTeam(set, state);
        window.scrollTo(0, 0);
        return;
      }
    }

    if (hash === "#/report") {
      view.innerHTML = RENDER.renderReport(DATA, state);
      window.scrollTo(0, 0);
      return;
    }

    view.innerHTML = RENDER.renderOverview(DATA, state);
    window.scrollTo(0, 0);
  }

  // --- Точечное обновление DOM (без полного перерендера при клике) -----------

  function updateCardEl(cardEl, count) {
    var has = count >= 1;
    cardEl.classList.toggle("has", has);
    cardEl.setAttribute("aria-pressed", has ? "true" : "false");
    var input = cardEl.querySelector(".card-count");
    if (input) input.value = count >= 2 ? String(count - 1) : ""; // в поле — повторки
  }

  function refreshTeamProgress() {
    if (!currentSet) return;
    var el = document.getElementById("teamProgress");
    if (el) el.outerHTML = RENDER.teamProgressHTML(currentSet, state);
  }

  function toggleCard(cardEl) {
    var code = cardEl.dataset.code;
    var current = STORE.getCount(state, code);
    var next = current >= 1 ? 0 : 1;
    STORE.setCount(state, code, next);
    updateCardEl(cardEl, STORE.getCount(state, code));
    refreshTeamProgress();
  }

  // Поле-число задаёт количество ПОВТОРОК. d повторок → всего копий = d+1
  // (повторка подразумевает «есть»). d=0 → оставляем «есть», если уже было.
  function setCardDuplicates(cardEl, raw) {
    var code = cardEl.dataset.code;
    var d = parseInt(raw, 10);
    if (isNaN(d) || d < 0) d = 0;
    var owned = STORE.getCount(state, code) >= 1;
    var total = d >= 1 ? d + 1 : (owned ? 1 : 0);
    STORE.setCount(state, code, total);
    updateCardEl(cardEl, STORE.getCount(state, code));
    refreshTeamProgress();
  }

  // --- Тулбар: экспорт / импорт / сброс --------------------------------------

  function handleAction(action) {
    if (action === "export") {
      STORE.exportProgress(state);
    } else if (action === "import") {
      var f = document.getElementById("importFile");
      if (f) f.click();
    } else if (action === "clear-dupes") {
      clearDuplicates();
    } else if (action === "report") {
      location.hash = "#/report";
    } else if (action === "report-txt") {
      window.WC_REPORT.downloadText(window.WC_REPORT.build(DATA, state));
    } else if (action === "report-csv") {
      window.WC_REPORT.downloadCSV(window.WC_REPORT.build(DATA, state));
    } else if (action.indexOf("dl-") === 0) {
      // выгрузка одного блока отчёта (dl-summary / dl-missing / dl-dup / dl-have)
      window.WC_REPORT.downloadSection(window.WC_REPORT.build(DATA, state), action.slice(3));
    }
  }

  // Убирает все повторки в текущем наборе: count>=2 → 1 (отметка «есть» остаётся).
  function clearDuplicates() {
    if (!currentSet) return;
    var dupes = 0;
    currentSet.stickers.forEach(function (s) {
      var c = STORE.getCount(state, s.code);
      if (c >= 2) dupes += c - 1;
    });
    if (!dupes) { alert("В этом наборе нет повторок."); return; }
    if (!confirm("Убрать все повторки в наборе «" + currentSet.name + "»?\nОтметки «есть» останутся. Повторок сейчас: " + dupes + ".")) return;
    currentSet.stickers.forEach(function (s) {
      if (STORE.getCount(state, s.code) >= 2) STORE.setCount(state, s.code, 1);
    });
    route();
  }

  function handleImportFile(input) {
    var file = input.files && input.files[0];
    if (!file) return;
    var replace = confirm(
      "Импорт бэкапа.\n\n" +
      "OK — ЗАМЕНИТЬ текущий прогресс данными из файла.\n" +
      "Отмена — ОБЪЕДИНИТЬ (для каждой наклейки взять большее значение)."
    );
    STORE.importProgress(file, replace ? "replace" : "merge", state, KNOWN_CODES, function (err, res) {
      input.value = ""; // позволяем выбрать тот же файл повторно
      if (err) {
        alert("Ошибка импорта: " + err.message);
        return;
      }
      var msg = "Импортировано кодов: " + res.applied;
      if (res.unknown.length) {
        msg += "\nКодов не из этого альбома: " + res.unknown.length +
          " (сохранены, но не учитываются в прогрессе).";
      }
      alert(msg);
      route();
    });
  }

  // --- Делегирование событий на #view ---------------------------------------

  view.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-action]");
    // preventDefault — чтобы кнопка внутри <summary> не сворачивала блок отчёта.
    if (btn) { e.preventDefault(); handleAction(btn.getAttribute("data-action")); return; }

    if (e.target.closest(".dup")) return; // клик по блоку повторок не переключает «есть»
    var cardEl = e.target.closest(".card");
    if (cardEl) toggleCard(cardEl);
  });

  view.addEventListener("keydown", function (e) {
    if ((e.key === "Enter" || e.key === " ") &&
        e.target.classList && e.target.classList.contains("card")) {
      e.preventDefault();
      toggleCard(e.target);
    }
  });

  view.addEventListener("change", function (e) {
    if (e.target.classList && e.target.classList.contains("card-count")) {
      var cardEl = e.target.closest(".card");
      if (cardEl) setCardDuplicates(cardEl, e.target.value);
      return;
    }
    if (e.target.id === "importFile") {
      handleImportFile(e.target);
    }
  });

  // --- Поиск наборов на главной ----------------------------------------------
  // Фильтрует плитки по data-search (имя + id + коды наклеек) без перерендера.
  function filterTiles(query) {
    var tiles = document.getElementById("setTiles");
    if (!tiles) return;
    var q = query.trim().toLowerCase();
    var shown = 0;
    var cards = tiles.querySelectorAll(".tile");
    for (var i = 0; i < cards.length; i++) {
      var match = !q || (cards[i].getAttribute("data-search") || "").indexOf(q) !== -1;
      cards[i].hidden = !match;
      if (match) shown++;
    }
    var empty = document.getElementById("searchEmpty");
    if (empty) empty.hidden = shown !== 0;
  }

  view.addEventListener("input", function (e) {
    if (e.target.id === "setSearch") filterTiles(e.target.value);
  });

  // Навигация между наборами стрелками клавиатуры (←/→) на странице набора.
  // Не перехватываем, если фокус в поле ввода или зажат модификатор.
  document.addEventListener("keydown", function (e) {
    if (!currentSet) return;
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    var sets = DATA.sets;
    var i = sets.indexOf(currentSet);
    if (i < 0 || sets.length < 2) return;
    var dir = e.key === "ArrowLeft" ? -1 : 1;
    var nb = sets[(i + dir + sets.length) % sets.length];
    e.preventDefault();
    location.hash = "#/set/" + encodeURIComponent(nb.id);
  });

  window.addEventListener("hashchange", route);

  // --- Старт -----------------------------------------------------------------

  (function sanityCheck() {
    var sum = DATA.sets.reduce(function (a, s) { return a + s.stickers.length; }, 0);
    if (DATA.sets.length !== 49) console.warn("Ожидалось 49 наборов, найдено " + DATA.sets.length);
    if (sum !== DATA.totalStickers) console.warn("Сумма наклеек " + sum + " ≠ " + DATA.totalStickers);
  })();

  route();
})();
