/* Хранилище прогресса в localStorage.
   Структура — разрежённая карта code -> count (нули не храним):
     { schemaVersion: 1, updatedAt: "ISO", counts: { "MEX1": 1, "00": 2, ... } }
   Всё обёрнуто в try/catch: повреждённое значение, приватный режим или
   переполнение квоты не должны ронять приложение. */
(function () {
  "use strict";

  var KEY = "wc2026-sticker-progress";
  var KEY_GROUPS = "wc2026-group-results";
  var KEY_PLAYOFF = "wc2026-playoff-results";
  var SCHEMA_VERSION = 1;

  function freshState() {
    return { schemaVersion: SCHEMA_VERSION, updatedAt: null, counts: {} };
  }

  // Приводим произвольный объект к валидному состоянию (counts: code->целое≥1).
  function sanitize(raw) {
    var state = freshState();
    if (raw && typeof raw === "object" && raw.counts && typeof raw.counts === "object") {
      Object.keys(raw.counts).forEach(function (code) {
        var n = Math.floor(Number(raw.counts[code]));
        if (isFinite(n) && n >= 1) state.counts[code] = n;
      });
      if (typeof raw.updatedAt === "string") state.updatedAt = raw.updatedAt;
    }
    return state;
  }

  function loadProgress() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return freshState();
      return sanitize(JSON.parse(raw));
    } catch (e) {
      console.warn("Не удалось прочитать прогресс из localStorage:", e);
      return freshState();
    }
  }

  function saveProgress(state) {
    state.schemaVersion = SCHEMA_VERSION;
    state.updatedAt = new Date().toISOString();
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      console.warn("Не удалось сохранить прогресс:", e);
      if (window.WC_onSaveError) window.WC_onSaveError(e);
      return false;
    }
  }

  function getCount(state, code) {
    return state.counts[code] || 0;
  }

  // Устанавливает счётчик. n<=0 удаляет ключ (держим карту разрежённой). Сохраняет сразу.
  function setCount(state, code, n) {
    n = Math.floor(Number(n));
    if (!isFinite(n) || n <= 0) {
      delete state.counts[code];
    } else {
      state.counts[code] = n;
    }
    saveProgress(state);
    return getCount(state, code);
  }

  // Экспорт: скачивание JSON-файла бэкапа.
  function exportProgress(state) {
    var payload = {
      schemaVersion: SCHEMA_VERSION,
      app: "wc2026-sticker-tracker",
      exportedAt: new Date().toISOString(),
      counts: state.counts
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var stamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    var a = document.createElement("a");
    a.href = url;
    a.download = "wc2026-backup-" + stamp + ".json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 0);
  }

  /* Импорт из выбранного файла.
     mode: "replace" (по умолчанию) — заменить локальные данные бэкапом;
           "merge" — для каждого кода берём больший счётчик.
     cb(err, result) — result: { state, applied, unknown } где
       applied — сколько кодов записано, unknown — массив кодов, которых нет в каталоге. */
  function importProgress(file, mode, state, knownCodes, cb) {
    mode = mode === "merge" ? "merge" : "replace";
    var reader = new FileReader();
    reader.onerror = function () { cb(new Error("Не удалось прочитать файл")); };
    reader.onload = function () {
      var parsed;
      try {
        parsed = JSON.parse(reader.result);
      } catch (e) {
        cb(new Error("Файл не является корректным JSON"));
        return;
      }
      if (!parsed || typeof parsed.counts !== "object" || parsed.counts === null) {
        cb(new Error("В файле нет поля counts"));
        return;
      }

      var incoming = sanitize(parsed).counts;
      var unknown = [];
      var applied = 0;

      if (mode === "replace") state.counts = {};

      Object.keys(incoming).forEach(function (code) {
        var n = incoming[code];
        if (knownCodes && !knownCodes.has(code)) unknown.push(code);
        if (mode === "merge") {
          state.counts[code] = Math.max(state.counts[code] || 0, n);
        } else {
          state.counts[code] = n;
        }
        applied++;
      });

      saveProgress(state);
      cb(null, { state: state, applied: applied, unknown: unknown });
    };
    reader.readAsText(file);
  }

  // --- Результаты матчей в группах (отдельный ключ) ----------------------------

  function loadGroupResults() {
    try {
      var raw = localStorage.getItem(KEY_GROUPS);
      if (!raw) return { schemaVersion: SCHEMA_VERSION, results: {} };
      var p = JSON.parse(raw);
      if (!p || typeof p.results !== "object" || !p.results) {
        return { schemaVersion: SCHEMA_VERSION, results: {} };
      }
      return { schemaVersion: SCHEMA_VERSION, results: p.results };
    } catch (e) {
      console.warn("Не удалось прочитать результаты групп:", e);
      return { schemaVersion: SCHEMA_VERSION, results: {} };
    }
  }

  function saveGroupResults(g) {
    g.schemaVersion = SCHEMA_VERSION;
    try {
      localStorage.setItem(KEY_GROUPS, JSON.stringify(g));
      return true;
    } catch (e) {
      console.warn("Не удалось сохранить результаты групп:", e);
      if (window.WC_onSaveError) window.WC_onSaveError(e);
      return false;
    }
  }

  // Устанавливает одну половину счёта матча (side: "h"|"a"). Пустое/невалидное → null.
  // Если обе половины пусты — удаляем матч (держим карту разрежённой).
  function setMatchSide(g, key, side, value) {
    var n = parseInt(value, 10);
    var m = g.results[key] || { h: null, a: null };
    m[side] = (isNaN(n) || n < 0) ? null : n;
    if (m.h === null && m.a === null) delete g.results[key];
    else g.results[key] = m;
    saveGroupResults(g);
  }

  // --- Результаты матчей плей-офф (отдельный ключ) -----------------------------
  // Структура такая же, как у групп: { schemaVersion, results: { matchId: {h,a} } }.

  function loadPlayoffResults() {
    try {
      var raw = localStorage.getItem(KEY_PLAYOFF);
      if (!raw) return { schemaVersion: SCHEMA_VERSION, results: {} };
      var p = JSON.parse(raw);
      if (!p || typeof p.results !== "object" || !p.results) {
        return { schemaVersion: SCHEMA_VERSION, results: {} };
      }
      return { schemaVersion: SCHEMA_VERSION, results: p.results };
    } catch (e) {
      console.warn("Не удалось прочитать результаты плей-офф:", e);
      return { schemaVersion: SCHEMA_VERSION, results: {} };
    }
  }

  function savePlayoffResults(g) {
    g.schemaVersion = SCHEMA_VERSION;
    try {
      localStorage.setItem(KEY_PLAYOFF, JSON.stringify(g));
      return true;
    } catch (e) {
      console.warn("Не удалось сохранить результаты плей-офф:", e);
      if (window.WC_onSaveError) window.WC_onSaveError(e);
      return false;
    }
  }

  // Одна половина счёта матча плей-офф (side: "h"|"a"). Пустое/невалидное → null.
  function setPlayoffSide(g, key, side, value) {
    var n = parseInt(value, 10);
    var m = g.results[key] || { h: null, a: null };
    m[side] = (isNaN(n) || n < 0) ? null : n;
    if (m.h === null && m.a === null) delete g.results[key];
    else g.results[key] = m;
    savePlayoffResults(g);
  }

  window.WC_STORE = {
    loadProgress: loadProgress,
    saveProgress: saveProgress,
    getCount: getCount,
    setCount: setCount,
    exportProgress: exportProgress,
    importProgress: importProgress,
    loadGroupResults: loadGroupResults,
    saveGroupResults: saveGroupResults,
    setMatchSide: setMatchSide,
    loadPlayoffResults: loadPlayoffResults,
    savePlayoffResults: savePlayoffResults,
    setPlayoffSide: setPlayoffSide
  };
})();
