/* Точка входа: hash-роутинг, делегирование событий, связка store + render.
   Подключается последним (после data/store/progress/render). */
(function () {
  "use strict";

  var DATA = window.WC_DATA;
  var STORE = window.WC_STORE;
  var RENDER = window.WC_RENDER;

  var view = document.getElementById("view");
  var state = STORE.loadProgress();
  var gstate = STORE.loadGroupResults();
  var pstate = STORE.loadPlayoffResults();
  var currentSet = null;
  var currentGroup = null;

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
    currentGroup = null;
    // Страница групп/плей-офф — во всю ширину экрана (сетка широкая).
    view.classList.toggle("full", hash === "#/groups" || hash === "#/playoff");

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

    var mGroup = hash.match(/^#\/group\/([A-L])$/);
    if (mGroup) {
      currentGroup = mGroup[1];
      view.innerHTML = RENDER.renderGroup(currentGroup, gstate);
      window.scrollTo(0, 0);
      return;
    }

    if (hash === "#/groups") {
      view.innerHTML = RENDER.renderGroupsIndex(pstate, gstate);
      window.scrollTo(0, 0);
      return;
    }

    // Плей-офф живёт внизу страницы групп — рендерим её и прокручиваем к сетке.
    if (hash === "#/playoff") {
      view.innerHTML = RENDER.renderGroupsIndex(pstate, gstate);
      var pb = document.getElementById("playoffBracket");
      if (pb) pb.scrollIntoView();
      else window.scrollTo(0, 0);
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
    if (e.target.classList && e.target.classList.contains("ms")) {
      STORE.setMatchSide(gstate, e.target.getAttribute("data-mkey"), e.target.getAttribute("data-side"), e.target.value);
      var box = document.getElementById("groupStandings");
      if (box && currentGroup) box.innerHTML = RENDER.standingsTableHTML(currentGroup, gstate);
      return;
    }
    if (e.target.classList && e.target.classList.contains("po-score")) {
      STORE.setPlayoffSide(pstate, e.target.getAttribute("data-pmatch"), e.target.getAttribute("data-side"), e.target.value);
      // Перерисовываем всю сетку: победитель мог сдвинуться дальше по раундам.
      var pbox = document.getElementById("playoffBracket");
      if (pbox) pbox.innerHTML = RENDER.renderPlayoff(pstate, gstate);
      return;
    }
    if (e.target.id === "importFile") {
      handleImportFile(e.target);
    }
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
