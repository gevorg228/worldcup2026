/* Хранилище прогресса в localStorage.
   Структура — разрежённая карта code -> count (нули не храним):
     { schemaVersion: 1, updatedAt: "ISO", counts: { "MEX1": 1, "00": 2, ... } }
   Всё обёрнуто в try/catch: повреждённое значение, приватный режим или
   переполнение квоты не должны ронять приложение. */
(function () {
  "use strict";

  var KEY = "wc2026-sticker-progress";
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

  function resetProgress(state) {
    state.counts = {};
    try {
      localStorage.removeItem(KEY);
    } catch (e) {
      console.warn("Не удалось очистить localStorage:", e);
    }
    state.updatedAt = null;
    return state;
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

  window.WC_STORE = {
    loadProgress: loadProgress,
    saveProgress: saveProgress,
    getCount: getCount,
    setCount: setCount,
    resetProgress: resetProgress,
    exportProgress: exportProgress,
    importProgress: importProgress
  };
})();
