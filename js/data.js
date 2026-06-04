/* Каталог альбома «FIFA World Cup 2026» — что вообще существует.
   Здесь НЕТ прогресса пользователя: счётчики живут только в localStorage (см. store.js),
   ключом служит code наклейки. Поэтому каталог можно дополнять (label/name/image)
   без миграции собранного прогресса.

   Коды берём буквально, как в альбоме:
   - страны: ПРЕФИКС + 1..20 (без ведущих нулей: MEX1, MEX10, MEX20);
   - Шотландия — исключение: SC01..SC09 (с нулём), затем SC10..SC20 (без нуля);
   - FWC: строка "00", затем FWC1..FWC19.
*/
(function () {
  "use strict";

  // 20 наклеек вида ПРЕФИКС+номер (для обычных стран, без падинга).
  function team(prefix) {
    var arr = [];
    for (var n = 1; n <= 20; n++) arr.push({ code: prefix + n });
    return arr;
  }

  // [id, русское имя, префикс кода] — порядок как в альбоме (группы A..L).
  var COUNTRIES = [
    ["MEX", "Мексика", "MEX"],
    ["RSA", "ЮАР", "RSA"],
    ["KOR", "Южная Корея", "KOR"],
    ["CZE", "Чехия", "CZE"],
    ["CAN", "Канада", "CAN"],
    ["BIH", "Босния и Герцеговина", "BIH"],
    ["QAT", "Катар", "QAT"],
    ["SUI", "Швейцария", "SUI"],
    ["BRA", "Бразилия", "BRA"],
    ["MAR", "Марокко", "MAR"],
    ["HAI", "Гаити", "HAI"],
    // Шотландия — особые коды, задаём ниже отдельно.
    ["USA", "США", "USA"],
    ["PAR", "Парагвай", "PAR"],
    ["AUS", "Австралия", "AUS"],
    ["TUR", "Турция", "TUR"],
    ["GER", "Германия", "GER"],
    ["CUW", "Кюрасао", "CUW"],
    ["CIV", "Кот-д'Ивуар", "CIV"],
    ["ECU", "Эквадор", "ECU"],
    ["NED", "Нидерланды", "NED"],
    ["JPN", "Япония", "JPN"],
    ["SWE", "Швеция", "SWE"],
    ["TUN", "Тунис", "TUN"],
    ["BEL", "Бельгия", "BEL"],
    ["EGY", "Египет", "EGY"],
    ["IRN", "Иран", "IRN"],
    ["NZL", "Новая Зеландия", "NZL"],
    ["ESP", "Испания", "ESP"],
    ["CPV", "Кабо-Верде", "CPV"],
    ["KSA", "Саудовская Аравия", "KSA"],
    ["URU", "Уругвай", "URU"],
    ["FRA", "Франция", "FRA"],
    ["SEN", "Сенегал", "SEN"],
    ["IRQ", "Ирак", "IRQ"],
    ["NOR", "Норвегия", "NOR"],
    ["ARG", "Аргентина", "ARG"],
    ["ALG", "Алжир", "ALG"],
    ["AUT", "Австрия", "AUT"],
    ["JOR", "Иордания", "JOR"],
    ["POR", "Португалия", "POR"],
    ["COD", "ДР Конго", "COD"],
    ["UZB", "Узбекистан", "UZB"],
    ["COL", "Колумбия", "COL"],
    ["ENG", "Англия", "ENG"],
    ["CRO", "Хорватия", "CRO"],
    ["GHA", "Гана", "GHA"],
    ["PAN", "Панама", "PAN"]
  ];

  var sets = COUNTRIES.map(function (c) {
    return { id: c[0], name: c[1], kind: "country", stickers: team(c[2]) };
  });

  // Шотландия: SC01..SC09 (с нулём), SC10..SC20 (без нуля). Вставляем после Гаити (индекс 11).
  var scotland = { id: "SCO", name: "Шотландия", kind: "country", stickers: [] };
  for (var n = 1; n <= 20; n++) {
    scotland.stickers.push({ code: "SC" + (n < 10 ? "0" + n : "" + n) });
  }
  sets.splice(11, 0, scotland);

  // FWC — спец-набор, разбит по разделам альбома. label показываем где известно из фото.
  var fwc = {
    id: "FWC", name: "FIFA World Cup", kind: "special",
    stickers: [
      { code: "00", section: "intro" },
      { code: "FWC1", section: "intro", label: "Official Emblem" },
      { code: "FWC2", section: "intro", label: "Official Mascots" },
      { code: "FWC3", section: "intro" },
      { code: "FWC4", section: "intro", label: "Official Slogan" },
      { code: "FWC5", section: "hosts", label: "Official Ball", big: true },
      { code: "FWC6", section: "hosts", label: "Канада" },
      { code: "FWC7", section: "hosts", label: "Мексика" },
      { code: "FWC8", section: "hosts", label: "США" },
      { code: "FWC9", section: "history", label: "Italy 1934" },
      { code: "FWC10", section: "history", label: "Brazil 1950" },
      { code: "FWC11", section: "history" },
      { code: "FWC12", section: "history", label: "Chile 1962" },
      { code: "FWC13", section: "history", label: "Germany 1974" },
      { code: "FWC14", section: "history" },
      { code: "FWC15", section: "history" },
      { code: "FWC16", section: "history" },
      { code: "FWC17", section: "history" },
      { code: "FWC18", section: "history" },
      { code: "FWC19", section: "history" }
    ]
  };
  sets.push(fwc);

  // Коды флагов (файлы flags/<код>.svg). Шотландия/Англия — спец-коды.
  var FLAGS = {
    MEX: "mx", RSA: "za", KOR: "kr", CZE: "cz", CAN: "ca", BIH: "ba", QAT: "qa",
    SUI: "ch", BRA: "br", MAR: "ma", HAI: "ht", SCO: "gb-sct", USA: "us", PAR: "py",
    AUS: "au", TUR: "tr", GER: "de", CUW: "cw", CIV: "ci", ECU: "ec", NED: "nl",
    JPN: "jp", SWE: "se", TUN: "tn", BEL: "be", EGY: "eg", IRN: "ir", NZL: "nz",
    ESP: "es", CPV: "cv", KSA: "sa", URU: "uy", FRA: "fr", SEN: "sn", IRQ: "iq",
    NOR: "no", ARG: "ar", ALG: "dz", AUT: "at", JOR: "jo", POR: "pt", COD: "cd",
    UZB: "uz", COL: "co", ENG: "gb-eng", CRO: "hr", GHA: "gh", PAN: "pa"
  };
  sets.forEach(function (s) { if (FLAGS[s.id]) s.flag = FLAGS[s.id]; });

  window.WC_DATA = {
    catalogVersion: 1,
    totalStickers: 980,
    sets: sets
  };

  // Подписи разделов FWC для рендера.
  window.WC_FWC_SECTIONS = [
    { key: "intro", title: "Вступление" },
    { key: "hosts", title: "Принимающие страны" },
    { key: "history", title: "История (конец альбома)" }
  ];
})();
