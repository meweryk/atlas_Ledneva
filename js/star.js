/* ============================================================
   star.js — реальное звёздное небо над Запорожьем
   Наблюдатель: 47.8381° N, 35.1392° E
   Проекция: зенит в центре, горизонт по краю круга, север сверху.

   Помимо 85 ярких звёзд каталога добавляется ~500 faint-звёзд,
   распределённых вдоль галактической плоскости — они создают
   визуальный эффект Млечного Пути.
   ============================================================ */

(function (global) {
  'use strict';

  const LATITUDE  = 47.8381;
  const LONGITUDE = 35.1392;

  // ─── Звёзды: [RA(°), Dec(°), mag, name] ───
  const STARS_RAW = [
    // Ursa Major (Большая Медведица)
    [165.932,  61.751, 1.79, 'Dubhe'],
    [165.460,  56.382, 2.37, 'Merak'],
    [178.458,  53.694, 2.44, 'Phecda'],
    [183.856,  57.033, 3.31, 'Megrez'],
    [193.507,  55.960, 1.77, 'Alioth'],
    [200.981,  54.925, 2.27, 'Mizar'],
    [206.885,  49.313, 1.86, 'Alkaid'],

    // Ursa Minor (Малая Медведица)
    [37.954,   89.264, 1.98, 'Polaris'],
    [222.676,  74.155, 2.08, 'Kochab'],
    [230.182,  71.834, 3.00, 'Pherkad'],

    // Cassiopeia (Кассиопея)
    [2.295,    59.150, 2.28, 'Caph'],
    [10.127,   56.537, 2.24, 'Schedar'],
    [14.177,   60.716, 2.15, 'Gamma Cas'],
    [21.454,   60.235, 2.68, 'Ruchbah'],
    [28.599,   63.670, 3.37, 'Segin'],

    // Orion (Орион)
    [88.793,    7.407, 0.45, 'Betelgeuse'],
    [78.634,   -8.202, 0.18, 'Rigel'],
    [81.283,    6.350, 1.64, 'Bellatrix'],
    [83.002,   -0.299, 2.25, 'Mintaka'],
    [84.053,   -1.202, 1.69, 'Alnilam'],
    [85.190,   -1.943, 1.74, 'Alnitak'],
    [86.939,   -9.670, 2.06, 'Saiph'],

    // Taurus (Телец)
    [68.980,   16.509, 0.87, 'Aldebaran'],
    [81.573,   28.608, 1.65, 'Elnath'],
    [84.411,   21.143, 3.00, 'Zeta Tau'],

    // Auriga (Возничий)
    [79.172,   45.998, 0.08, 'Capella'],
    [89.882,   44.947, 1.90, 'Menkalinan'],
    [89.930,   37.213, 2.65, 'Theta Aur'],

    // Gemini (Близнецы)
    [116.329,  28.026, 1.16, 'Pollux'],
    [113.650,  31.888, 1.58, 'Castor'],
    [99.428,   16.399, 1.93, 'Alhena'],

    // Canis Major (Большой Пёс)
    [101.287, -16.716, -1.46, 'Sirius'],
    [104.656, -28.972, 1.50, 'Adhara'],
    [107.098, -26.393, 1.83, 'Wezen'],
    [95.674,  -17.956, 1.98, 'Mirzam'],

    // Canis Minor (Малый Пёс)
    [114.825,   5.225, 0.34, 'Procyon'],

    // Leo (Лев)
    [152.093,  11.967, 1.36, 'Regulus'],
    [177.265,  14.572, 2.56, 'Denebola'],
    [154.993,  19.842, 2.08, 'Algieba'],
    [168.527,  20.524, 2.56, 'Zosma'],

    // Virgo (Дева)
    [201.298, -11.161, 0.98, 'Spica'],
    [190.415,  -1.449, 2.74, 'Porrima'],
    [195.544,  10.959, 2.83, 'Vindemiatrix'],

    // Bootes (Волопас)
    [213.915,  19.182, -0.05, 'Arcturus'],
    [221.247,  27.074, 2.37, 'Izar'],
    [208.671,  18.398, 2.68, 'Muphrid'],

    // Scorpius (Скорпион)
    [247.352, -26.432, 0.96, 'Antares'],
    [241.359, -19.805, 2.62, 'Graffias'],
    [240.083, -22.622, 2.32, 'Dschubba'],
    [264.330, -42.998, 1.86, 'Sargas'],
    [263.402, -37.104, 1.62, 'Shaula'],

    // Lyra (Лира)
    [279.234,  38.784, 0.03, 'Vega'],
    [282.520,  33.363, 3.45, 'Sheliak'],
    [284.736,  32.690, 3.24, 'Sulafat'],

    // Cygnus (Лебедь)
    [310.358,  45.280, 1.25, 'Deneb'],
    [305.557,  40.257, 2.23, 'Sadr'],
    [311.553,  33.970, 2.48, 'Gienah'],
    [296.244,  45.131, 2.87, 'Delta Cyg'],
    [292.680,  27.960, 3.09, 'Albireo'],

    // Aquila (Орёл)
    [297.696,   8.868, 0.76, 'Altair'],
    [296.565,  10.613, 2.72, 'Tarazed'],
    [298.828,   6.407, 3.71, 'Alshain'],

    // Draco (Дракон)
    [269.152,  51.489, 2.23, 'Eltanin'],
    [262.608,  52.301, 2.79, 'Rastaban'],
    [211.097,  64.376, 3.65, 'Thuban'],
    [231.232,  58.966, 3.29, 'Edasich'],

    // Pegasus (Пегас)
    [346.190,  15.205, 2.49, 'Markab'],
    [345.944,  28.083, 2.42, 'Scheat'],
    [3.309,    15.184, 2.83, 'Algenib'],
    [326.046,   9.875, 2.39, 'Enif'],
    [340.366,  10.831, 3.40, 'Homam'],

    // Andromeda (Андромеда)
    [2.097,    29.090, 2.06, 'Alpheratz'],
    [17.433,   35.621, 2.06, 'Mirach'],
    [30.975,   42.330, 2.10, 'Almach'],

    // Perseus (Персей)
    [51.081,   49.861, 1.79, 'Mirfak'],
    [47.042,   40.956, 2.12, 'Algol'],
    [58.533,   31.884, 2.85, 'Zeta Per'],

    // Cepheus (Цефей)
    [319.645,  62.585, 2.44, 'Alderamin'],
    [322.165,  70.561, 3.23, 'Alfirk'],

    // Sagittarius (Стрелец)
    [276.043, -34.385, 1.79, 'Kaus Australis'],
    [283.816, -26.297, 2.02, 'Nunki'],

    // Aries (Овен)
    [31.793,   23.462, 2.00, 'Hamal'],
    [28.660,   20.808, 2.64, 'Sheratan'],

    // Pisces (Рыбы)
    [22.871,   15.346, 3.62, 'Eta Psc'],

    // Aquarius (Водолей)
    [322.890,  -5.571, 2.87, 'Sadalsuud']
  ];

  // ─── Созвездия: линии между индексами STARS_RAW (0..84) ───
  const CONSTELLATIONS = [
    { name: 'Ursa Major',  ru: 'Большая Медведица',
      lines: [[0,1],[1,2],[2,3],[3,0],[3,4],[4,5],[5,6]] },

    { name: 'Ursa Minor',  ru: 'Малая Медведица',
      lines: [[7,8],[8,9]] },

    { name: 'Cassiopeia',  ru: 'Кассиопея',
      lines: [[10,11],[11,12],[12,13],[13,14]] },

    { name: 'Orion',       ru: 'Орион',
      lines: [
        [15,17], [17,19], [15,20],
        [19,20], [19,16], [20,21], [16,21]
      ] },

    { name: 'Taurus',      ru: 'Телец',
      lines: [[22,23],[22,24]] },

    { name: 'Auriga',      ru: 'Возничий',
      lines: [[25,26],[26,27],[27,25]] },

    { name: 'Gemini',      ru: 'Близнецы',
      lines: [[28,29],[28,30]] },

    { name: 'Canis Major', ru: 'Большой Пёс',
      lines: [[31,32],[31,33],[33,34]] },

    { name: 'Leo',         ru: 'Лев',
      lines: [[36,38],[38,39],[39,37]] },

    { name: 'Virgo',       ru: 'Дева',
      lines: [[40,41],[41,42]] },

    { name: 'Bootes',      ru: 'Волопас',
      lines: [[43,44],[43,45]] },

    { name: 'Scorpius',    ru: 'Скорпион',
      lines: [[46,47],[47,48],[48,49],[49,50]] },

    { name: 'Lyra',        ru: 'Лира',
      lines: [[51,52],[51,53],[52,53]] },

    { name: 'Cygnus',      ru: 'Лебедь',
      lines: [[54,55],[55,56],[55,58],[57,55]] },

    { name: 'Aquila',      ru: 'Орёл',
      lines: [[59,60],[59,61]] },

    { name: 'Draco',       ru: 'Дракон',
      lines: [[62,63],[63,64]] },

    { name: 'Pegasus',     ru: 'Пегас',
      lines: [[66,67],[66,68],[67,69],[68,69]] },

    { name: 'Andromeda',   ru: 'Андромеда',
      lines: [[70,71],[71,72]] },

    { name: 'Perseus',     ru: 'Персей',
      lines: [[73,74],[74,75]] },

    { name: 'Cepheus',     ru: 'Цефей',
      lines: [[76,77]] },

    { name: 'Sagittarius', ru: 'Стрелец',
      lines: [[78,79]] },

    { name: 'Aries',       ru: 'Овен',
      lines: [[80,81]] }
  ];

  /* ---------- ГАЛАКТИЧЕСКИЕ КООРДИНАТЫ ---------- */
  // Постоянные для перевода галактических координат (l, b)
  // в экваториальные (RA, Dec) эпохи J2000.
  const RA_NGP_DEG  = 192.85948;   // прямое восхождение северного галактического полюса
  const DEC_NGP_DEG = 27.12825;    // склонение северного галактического полюса
  const L_OMEGA_DEG = 32.93192;    // галактическая долгота восходящего узла

  function galacticToEquatorial(lDeg, bDeg) {
    const raNGP  = RA_NGP_DEG  * Math.PI / 180;
    const decNGP = DEC_NGP_DEG * Math.PI / 180;
    const lOmega = L_OMEGA_DEG * Math.PI / 180;

    const l = lDeg * Math.PI / 180;
    const b = bDeg * Math.PI / 180;
    const dl = l - lOmega;

    const sinDec = Math.sin(b) * Math.sin(decNGP)
                 + Math.cos(b) * Math.cos(decNGP) * Math.sin(dl);
    const dec = Math.asin(Math.max(-1, Math.min(1, sinDec)));

    const y = Math.cos(b) * Math.cos(dl);
    const x = Math.sin(b) * Math.cos(decNGP)
            - Math.cos(b) * Math.sin(decNGP) * Math.sin(dl);

    let ra = raNGP + Math.atan2(y, x);
    ra = ((ra % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

    return {
      ra:  ra  * 180 / Math.PI,
      dec: dec * 180 / Math.PI
    };
  }

  /* ---------- ГЕНЕРАЦИЯ ЗВЁЗД МЛЕЧНОГО ПУТИ ---------- */
  // Распределяем faint-звёзды вдоль галактической плоскости.
  // l — равномерно по окружности; b — треугольное распределение
  // с максимумом на плоскости и затуханием к ±B_MAX.
  function generateMilkyWayStars(count) {
    const N = count || 500;
    const B_MAX = 19;          // полуширина полосы в галактической широте
    const stars = [];

    for (let i = 0; i < N; i++) {
      const l = Math.random() * 360;
      // Треугольное распределение b в диапазоне [-B_MAX, B_MAX]
      const b = (Math.random() - Math.random()) * B_MAX;

      const eq = galacticToEquatorial(l, b);

      // Звёздная величина: от 4.2 до 6.5 с упором в тусклые.
      // pow(random, 0.7) смещает распределение к меньшим значениям —
      // получается больше очень тусклых звёзд и меньше ярких.
      const mag = 3.9 + Math.pow(Math.random(), 0.7) * 2.3;

      stars.push([eq.ra, eq.dec, mag, 'MW_' + i]);
    }

    return stars;
  }

  // Объединённый каталог: сначала 85 ярких звёзд (индексы 0–84),
  // затем ~500 звёзд Млечного Пути (индексы 85+).
  const MILKY_WAY_STARS = generateMilkyWayStars(800);
  const STARS_ALL = STARS_RAW.concat(MILKY_WAY_STARS);

  /* ---------- ВРЕМЯ И КООРДИНАТЫ ---------- */

  // LST (местное звёздное время) в часах
  function getLocalSiderealTime(date, longitudeDeg) {
    const jd = date.getTime() / 86400000 + 2440587.5;
    const t  = (jd - 2451545.0) / 36525.0;

    let gmst = 280.46061837
             + 360.98564736629 * (jd - 2451545.0)
             + 0.000387933 * t * t
             - t * t * t / 38710000.0;
    gmst = ((gmst % 360) + 360) % 360;

    let lst = gmst + longitudeDeg;
    lst = ((lst % 360) + 360) % 360;
    return lst / 15.0;
  }

  // RA/Dec → азимут/высота
  function raDecToAltAz(raDeg, decDeg, latDeg, lstHours) {
    const ra  = raDeg * Math.PI / 180;
    const dec = decDeg * Math.PI / 180;
    const lat = latDeg * Math.PI / 180;
    const H   = (lstHours * 15 - raDeg) * Math.PI / 180;

    const sinAlt = Math.sin(dec) * Math.sin(lat)
                 + Math.cos(dec) * Math.cos(lat) * Math.cos(H);
    const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt)));

    const cosAz = (Math.sin(dec) - Math.sin(alt) * Math.sin(lat))
                / (Math.cos(alt) * Math.cos(lat));
    let az = Math.acos(Math.max(-1, Math.min(1, cosAz)));
    if (Math.sin(H) > 0) az = 2 * Math.PI - az;

    return {
      altitude: alt * 180 / Math.PI,
      azimuth:  az  * 180 / Math.PI
    };
  }

  /* ---------- ПУБЛИЧНЫЙ API ---------- */

  function getStarData(date) {
    const d = date || new Date();
    const lst = getLocalSiderealTime(d, LONGITUDE);

    const visible = [];
    const idxMap = {};

    STARS_ALL.forEach(function (s, i) {
      const raDeg  = s[0];
      const decDeg = s[1];
      const mag    = s[2];
      const name   = s[3];

      const { altitude, azimuth } = raDecToAltAz(raDeg, decDeg, LATITUDE, lst);

      if (altitude > 0) {
        idxMap[i] = visible.length;
        visible.push({
          name: name,
          ra: raDeg,
          dec: decDeg,
          mag: mag,
          altitude: altitude,
          azimuth: azimuth
        });
      }
    });

    const consts = [];
    CONSTELLATIONS.forEach(function (c) {
      const mapped = c.lines
        .map(function (p) {
          const a = idxMap[p[0]];
          const b = idxMap[p[1]];
          return (a !== undefined && b !== undefined) ? [a, b] : null;
        })
        .filter(function (p) { return p !== null; });

      if (mapped.length > 0) {
        consts.push({ name: c.name, ru: c.ru, lines: mapped });
      }
    });

    return {
      date: d,
      latitude: LATITUDE,
      longitude: LONGITUDE,
      lst: lst,
      stars: visible,
      constellations: consts
    };
  }

  global.StarData = {
    getStarData: getStarData,
    getLocalSiderealTime: getLocalSiderealTime,
    raDecToAltAz: raDecToAltAz,
    galacticToEquatorial: galacticToEquatorial,
    generateMilkyWayStars: generateMilkyWayStars,
    LATITUDE: LATITUDE,
    LONGITUDE: LONGITUDE
  };

})(typeof window !== 'undefined' ? window : this);