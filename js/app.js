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
    var m = hash.match(/^#\/set\/(.+)$/);
    if (m) {
      var id = decodeURIComponent(m[1]);
      var set = SET_BY_ID[id];
      if (set) {
        currentSet = set;
        view.innerHTML = RENDER.renderTeam(set, state);
        window.scrollTo(0, 0);
        return;
      }
    }
    currentSet = null;
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
    }
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
    if (btn) { handleAction(btn.getAttribute("data-action")); return; }

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

  window.addEventListener("hashchange", route);

  // --- Старт -----------------------------------------------------------------

  (function sanityCheck() {
    var sum = DATA.sets.reduce(function (a, s) { return a + s.stickers.length; }, 0);
    if (DATA.sets.length !== 49) console.warn("Ожидалось 49 наборов, найдено " + DATA.sets.length);
    if (sum !== DATA.totalStickers) console.warn("Сумма наклеек " + sum + " ≠ " + DATA.totalStickers);
  })();

  route();
})();
