/* ============================================================
   star.js — данные и расчёт реального звёздного неба
   Наблюдатель: Запорожье (47.8381° N, 35.1392° E)

   Возвращает объект:
   {
     stars: [...],        // звёзды с координатами RA/Dec/mag
     constellations: [...], // линии созвездий (пары индексов звёзд)
     latitude: число,
     longitude: число,
     getVisibleStars: функция(date) → массив звёзд с az/alt
   }
   ============================================================ */

(function (global) {
  'use strict';

  // ─── Координаты наблюдателя ───
  const LATITUDE  = 47.8381;   // широта Запорожья
  const LONGITUDE = 35.1392;   // долгота Запорожья

  // ─── Звёзды: [RA(град), Dec(град), mag, name] ───
  // RA приведено к градусам (0–360), Dec — к десятичным градусам.
  // Выборка ярких звёзд (mag < 3.5), видимых на широте ~48° N.
  const STARS_RAW = [
    // Ursa Major (Большая Медведица)
    [165.932, 61.751, 1.79, 'Dubhe'],
    [165.460, 56.382, 2.37, 'Merak'],
    [178.458, 53.694, 2.44, 'Phecda'],
    [183.856, 57.033, 3.31, 'Megrez'],
    [193.507, 55.960, 1.77, 'Alioth'],
    [200.981, 54.925, 2.27, 'Mizar'],
    [206.885, 49.313, 1.86, 'Benetnash'],

    // Ursa Minor (Малая Медведица)
    [37.954,  89.264, 2.02, 'Polaris'],
    [263.054, 86.586, 2.08, 'Kochab'],
    [222.676, 74.155, 3.00, 'Pherkad'],

    // Cassiopeia (Кассиопея)
    [2.295,   59.150, 2.28, 'Schedar'],
    [10.127,  56.537, 2.24, 'Caph'],
    [21.454,  60.235, 2.47, 'Gamma Cas'],
    [28.599,  63.670, 2.68, 'Ruchbah'],
    [41.050,  60.235, 3.38, 'Segin'],

    // Orion (Орион)
    [88.793,   7.407, 0.45, 'Betelgeuse'],
    [78.634,  -8.202, 0.18, 'Rigel'],
    [83.002,  -0.299, 1.74, 'Bellatrix'],
    [81.283,   6.350, 1.64, 'Alnilam'],
    [83.785,  -5.391, 2.25, 'Saiph'],
    [86.939,  -9.670, 2.06, 'Mintaka'],
    [84.053,  -1.202, 2.23, 'Alnitak'],

    // Taurus (Телец)
    [68.980,  16.509, 0.87, 'Aldebaran'],
    [81.573,  28.608, 1.65, 'Elnath'],

    // Auriga (Возничий)
    [79.172,  45.998, 0.08, 'Capella'],
    [89.882,  44.947, 1.90, 'Menkalinan'],

    // Gemini (Близнецы)
    [113.650, 31.888, 1.58, 'Pollux'],
    [116.329, 28.026, 1.16, 'Castor'],

    // Canis Major (Большой Пёс)
    [101.287, -16.716, -1.46, 'Sirius'],
    [111.024, -17.822, 1.98, 'Adhara'],

    // Canis Minor (Малый Пёс)
    [114.825,  5.225, 0.34, 'Procyon'],

    // Leo (Лев)
    [152.093, 11.967, 1.36, 'Regulus'],
    [177.265, 14.572, 2.56, 'Denebola'],

    // Virgo (Дева)
    [201.298, -11.161, 0.98, 'Spica'],

    // Bootes (Волопас)
    [213.915, 19.182, -0.05, 'Arcturus'],

    // Scorpius (Скорпион)
    [247.352, -26.432, 0.96, 'Antares'],

    // Lyra (Лира)
    [279.234, 38.784, 0.03, 'Vega'],

    // Cygnus (Лебедь)
    [310.358, 45.280, 1.25, 'Deneb'],
    [292.680, 50.000, 2.23, 'Sadr'],
    [305.557, 40.257, 2.23, 'Gienah'],

    // Aquila (Орёл)
    [297.696,   8.868, 0.76, 'Altair'],

    // Crux (Южный Крест) — не виден в Запорожье, но включён для полноты
    // [186.650, -63.099, 1.25, 'Acrux'],

    // Draco (Дракон)
    [262.608, 52.301, 2.23, 'Eltanin'],
    [268.382, 56.873, 2.74, 'Rastaban'],

    // Pegasus (Пегас)
    [345.944, 28.083, 2.49, 'Markab'],
    [3.309,   15.184, 2.83, 'Algenib'],

    // Andromeda (Андромеда)
    [9.832,   30.861, 2.06, 'Alpheratz'],
    [17.433,  35.621, 2.06, 'Mirach'],

    // Perseus (Персей)
    [51.081,  49.861, 1.79, 'Mirfak'],

    // Cepheus (Цефей)
    [319.644, 62.585, 2.44, 'Alderamin']
  ];

  // ─── Созвездия: линии, соединяющие звёзды ───
  // Каждая линия — массив индексов в STARS_RAW.
  const CONSTELLATIONS = [
    {
      name: 'Ursa Major',
      ru: 'Большая Медведица',
      lines: [[0,1], [1,2], [2,3], [3,0], [3,4], [4,5], [5,6]]
    },
    {
      name: 'Ursa Minor',
      ru: 'Малая Медведица',
      lines: [[7,8], [8,9]]
    },
    {
      name: 'Cassiopeia',
      ru: 'Кассиопея',
      lines: [[10,11], [11,12], [12,13], [13,14]]
    },
    {
      name: 'Orion',
      ru: 'Орион',
      lines: [
        [15,16], [15,17], [16,18], [17,19], [18,20],
        [19,20], [19,21], [20,21], [21,22]
      ]
    },
    {
      name: 'Taurus',
      ru: 'Телец',
      lines: [[23,24]]
    },
    {
      name: 'Auriga',
      ru: 'Возничий',
      lines: [[25,26]]
    },
    {
      name: 'Gemini',
      ru: 'Близнецы',
      lines: [[27,28]]
    },
    {
      name: 'Canis Major',
      ru: 'Большой Пёс',
      lines: [[29,30]]
    },
    {
      name: 'Canis Minor',
      ru: 'Малый Пёс',
      lines: []
    },
    {
      name: 'Leo',
      ru: 'Лев',
      lines: [[31,32]]
    },
    {
      name: 'Virgo',
      ru: 'Дева',
      lines: []
    },
    {
      name: 'Bootes',
      ru: 'Волопас',
      lines: []
    },
    {
      name: 'Scorpius',
      ru: 'Скорпион',
      lines: []
    },
    {
      name: 'Lyra',
      ru: 'Лира',
      lines: []
    },
    {
      name: 'Cygnus',
      ru: 'Лебедь',
      lines: [[34,35], [35,36]]
    },
    {
      name: 'Aquila',
      ru: 'Орёл',
      lines: []
    },
    {
      name: 'Draco',
      ru: 'Дракон',
      lines: [[38,39]]
    },
    {
      name: 'Pegasus',
      ru: 'Пегас',
      lines: [[40,41]]
    },
    {
      name: 'Andromeda',
      ru: 'Андромеда',
      lines: [[42,43]]
    },
    {
      name: 'Perseus',
      ru: 'Персей',
      lines: []
    },
    {
      name: 'Cepheus',
      ru: 'Цефей',
      lines: []
    }
  ];

  // ─── Расчёт местного звёздного времени (LST) ───
  // Возвращает LST в часах (0–24) для заданной даты.
  function getLocalSiderealTime(date, longitudeDeg) {
    const jd = date.getTime() / 86400000 + 2440587.5;
    const t = (jd - 2451545.0) / 36525.0; // юлианские века от J2000

    // Гринвичское среднее звёздное время в градусах
    let gmst = 280.46061837
             + 360.98564736629 * (jd - 2451545.0)
             + 0.000387933 * t * t
             - t * t * t / 38710000.0;
    gmst = ((gmst % 360) + 360) % 360;

    // Местное звёздное время = GMST + долгота
    let lst = gmst + longitudeDeg;
    lst = ((lst % 360) + 360) % 360;
    return lst / 15.0; // часы
  }

  // ─── Преобразование RA/Dec → азимут/высота ───
  function raDecToAltAz(raHours, decDeg, latDeg, lstHours) {
    const ra  = raHours * 15 * Math.PI / 180;
    const dec = decDeg * Math.PI / 180;
    const lat = latDeg * Math.PI / 180;
    const H   = (lstHours * 15 - raHours * 15) * Math.PI / 180; // часовой угол

    const sinAlt = Math.sin(dec) * Math.sin(lat)
                 + Math.cos(dec) * Math.cos(lat) * Math.cos(H);
    const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt)));

    const cosAz = (Math.sin(dec) - Math.sin(alt) * Math.sin(lat))
                / (Math.cos(alt) * Math.cos(lat));
    let az = Math.acos(Math.max(-1, Math.min(1, cosAz)));

    if (Math.sin(H) > 0) az = 2 * Math.PI - az;

    return {
      altitude: alt * 180 / Math.PI,   // в градусах
      azimuth:  az  * 180 / Math.PI    // в градусах от севера по часовой
    };
  }

  // ─── Публичный API ───
  function getStarData(date) {
    const d = date || new Date();
    const lst = getLocalSiderealTime(d, LONGITUDE);

    const visibleStars = [];
    const starIndexMap = {}; // старый индекс → новый индекс в visibleStars

    STARS_RAW.forEach(function (s, idx) {
      const [raDeg, decDeg, mag, name] = s;
      const raHours = raDeg / 15;
      const { altitude, azimuth } = raDecToAltAz(raHours, decDeg, LATITUDE, lst);

      if (altitude > 0) {
        starIndexMap[idx] = visibleStars.length;
        visibleStars.push({
          name: name,
          ra: raDeg,
          dec: decDeg,
          mag: mag,
          altitude: altitude,
          azimuth: azimuth
        });
      }
    });

    // Пересобираем линии созвездий с новыми индексами
    const visibleConstellations = [];
    CONSTELLATIONS.forEach(function (c) {
      const mappedLines = c.lines
        .map(function (pair) {
          const a = starIndexMap[pair[0]];
          const b = starIndexMap[pair[1]];
          if (a !== undefined && b !== undefined) return [a, b];
          return null;
        })
        .filter(function (p) { return p !== null; });

      if (mappedLines.length > 0) {
        visibleConstellations.push({
          name: c.name,
          ru: c.ru,
          lines: mappedLines
        });
      }
    });

    return {
      date: d,
      latitude: LATITUDE,
      longitude: LONGITUDE,
      lst: lst,
      stars: visibleStars,
      constellations: visibleConstellations,
      allStars: STARS_RAW,
      allConstellations: CONSTELLATIONS
    };
  }

  // Экспорт
  global.StarData = {
    getStarData: getStarData,
    getLocalSiderealTime: getLocalSiderealTime,
    raDecToAltAz: raDecToAltAz,
    LATITUDE: LATITUDE,
    LONGITUDE: LONGITUDE
  };

})(typeof window !== 'undefined' ? window : this);