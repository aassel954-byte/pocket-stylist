'use strict';

// ── CONFIG ──────────────────────────────────────────────────
const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast';
const GEOCODE_URL = 'https://nominatim.openstreetmap.org/search';
const REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse';

// ── STORAGE ──────────────────────────────────────────────────
const Store = {
  getProfile: () => { try { const d = localStorage.getItem('ps_profile'); return d ? JSON.parse(d) : null; } catch { return null; } },
  saveProfile: (p) => localStorage.setItem('ps_profile', JSON.stringify(p)),
  clear: () => localStorage.removeItem('ps_profile'),
};

// ── WEATHER ──────────────────────────────────────────────────
const Wx = {
  async byCoords(lat, lon) {
    const p = new URLSearchParams({
      latitude: lat, longitude: lon,
      current: 'temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m',
      timezone: 'auto',
    });
    const r = await fetch(`${WEATHER_URL}?${p}`);
    const d = await r.json();
    return d.current;
  },
  async geocode(city) {
    const p = new URLSearchParams({ q: city, format: 'json', limit: 1 });
    const r = await fetch(`${GEOCODE_URL}?${p}`, { headers: { 'User-Agent': 'PocketStylist/1.0' } });
    const d = await r.json();
    if (!d.length) throw new Error('Город не найден');
    return { lat: parseFloat(d[0].lat), lon: parseFloat(d[0].lon) };
  },
  async geoLocation() {
    return new Promise((res, rej) => {
      if (!navigator.geolocation) { rej(new Error('no_geo')); return; }
      navigator.geolocation.getCurrentPosition(
        p => res({ lat: p.coords.latitude, lon: p.coords.longitude }),
        () => rej(new Error('denied')),
        { timeout: 6000 }
      );
    });
  },
  async reverseCity(lat, lon) {
    const p = new URLSearchParams({ lat, lon, format: 'json' });
    const r = await fetch(`${REVERSE_URL}?${p}`, { headers: { 'User-Agent': 'PocketStylist/1.0' } });
    const d = await r.json();
    return d.address?.city || d.address?.town || d.address?.village || 'Ваш город';
  },
  desc(code) {
    const m = {
      0:'Ясно',1:'Преим. ясно',2:'Перем. облачность',3:'Пасмурно',
      45:'Туман',48:'Туман с инеем',
      51:'Слабая морось',53:'Морось',55:'Сильная морось',
      61:'Слабый дождь',63:'Дождь',65:'Сильный дождь',
      71:'Слабый снег',73:'Снег',75:'Сильный снег',
      80:'Ливень',81:'Ливень умер.',82:'Сильный ливень',
      95:'Гроза',96:'Гроза с градом',99:'Сильная гроза',
    };
    return m[code] || 'Переменная облачность';
  },
  icon(code) {
    if (code === 0) return '☀️';
    if (code <= 2) return '🌤️';
    if (code <= 3) return '☁️';
    if (code <= 48) return '🌫️';
    if (code <= 67) return '🌧️';
    if (code <= 77) return '❄️';
    if (code <= 82) return '🌦️';
    return '⛈️';
  },
};

// ── STYLIST (rule-based) ──────────────────────────────────────
const Stylist = {
  suggest(profile, weather, event) {
    const temp      = weather.temperature_2m;
    const code      = weather.weather_code;
    const wardrobe  = profile.wardrobe || [];
    const bodyType  = profile.bodyType || 'rectangle';
    const colorType = profile.colorType || 'Зима';
    const zones     = profile.problemZones || [];
    const style     = profile.stylePreference || 'Smart casual';

    const items = [];
    const outer = this.outerwear(temp, wardrobe);
    if (outer) items.push(outer);
    const top = this.topLayer(event, style, wardrobe);
    if (top) items.push(top);
    items.push(this.shirt(event, style, wardrobe));
    items.push(this.pants(event, style, wardrobe, zones));
    items.push(this.shoes(event, style, wardrobe));

    return {
      title:         this.title(event),
      subtitle:      this.subtitle(event),
      weatherNote:   this.weatherNote(temp, code),
      trendNote:     this.trendNote(event),
      items,
      palette:       this.palette(colorType),
      combinations:  this.combos(items),
      colorRule:     this.colorRule(colorType),
      stylistTip:    this.stylistTip(bodyType, zones),
      confidenceTip: this.confidenceTip(),
    };
  },

  pick(list, wardrobe) {
    return list.find(i => wardrobe.includes(i)) || list[0];
  },

  outerwear(temp, wardrobe) {
    if (temp >= 18) return null;
    let list, color, colorName, reason;
    if (temp < 0) {
      list = ['Пуховик','Дублёнка','Пальто']; color = '#263238'; colorName = 'тёмно-серый';
      reason = 'Мороз — тёплая верхняя одежда обязательна';
    } else if (temp < 10) {
      list = ['Пальто','Тренч','Кожаная куртка','Дублёнка']; color = '#4E342E'; colorName = 'тёмно-коричневый';
      reason = 'Холодно — пальто или тренч защитят и добавят элегантности';
    } else {
      list = ['Лёгкий плащ','Тренч','Пальто']; color = '#455A64'; colorName = 'серо-синий';
      reason = 'Прохладно с утра — лёгкое пальто будет кстати';
    }
    return { name: this.pick(list, wardrobe), color, colorName, reason };
  },

  topLayer(event, style, wardrobe) {
    const formal = ['office','negotiations','conference'];
    if (!formal.includes(event) && style !== 'Строго деловой' && event !== 'restaurant') return null;
    const list = ['Тёмно-синий костюм','Серый костюм','Блейзер','Пиджак casual'];
    const name = this.pick(list, wardrobe);
    const map = {
      'Тёмно-синий костюм': ['#1B2A4A','тёмно-синий'],
      'Серый костюм':       ['#546E7A','тёмно-серый'],
      'Блейзер':            ['#37474F','антрацит'],
      'Пиджак casual':      ['#4A4A4A','тёмный'],
    };
    const [color, colorName] = map[name] || ['#37474F','тёмный'];
    return { name, color, colorName, reason: 'Основа образа — задаёт уровень формальности' };
  },

  shirt(event, style, wardrobe) {
    const formal = ['office','negotiations','conference'].includes(event) || style === 'Строго деловой';
    const list = formal
      ? ['Белая рубашка','Голубая рубашка','Рубашка в клетку','Водолазка','Свитер V-вырез','Пуловер']
      : ['Водолазка','Свитер V-вырез','Пуловер','Рубашка в клетку','Белая рубашка','Голубая рубашка'];
    const name = this.pick(list, wardrobe);
    const map = {
      'Белая рубашка':    ['#F5F5F5','белый'],
      'Голубая рубашка':  ['#90CAF9','голубой'],
      'Рубашка в клетку': ['#8D6E63','тёплый коричневый'],
      'Водолазка':        ['#37474F','тёмно-серый'],
      'Свитер V-вырез':   ['#5D4037','коричневый'],
      'Пуловер':          ['#78909C','серо-голубой'],
    };
    const [color, colorName] = map[name] || ['#ECEFF1','светлый'];
    return { name, color, colorName, reason: formal ? 'Чистая рубашка — основа делового образа' : 'Создаёт правильный баланс между стилем и комфортом' };
  },

  pants(event, style, wardrobe, zones) {
    const formal = ['office','negotiations','conference'];
    let list;
    if (formal.includes(event) || style === 'Строго деловой') {
      list = ['Классические тёмно-синие','Чёрные классические','Классические серые','Чинос','Тёмные джинсы'];
    } else if (event === 'home') {
      list = ['Чинос','Тёмные джинсы','Классические серые','Классические тёмно-синие','Чёрные классические'];
    } else {
      list = ['Чинос','Тёмные джинсы','Классические тёмно-синие','Чёрные классические','Классические серые'];
    }
    const name = this.pick(list, wardrobe);
    const map = {
      'Классические тёмно-синие': ['#1B2A4A','тёмно-синий'],
      'Чёрные классические':      ['#1C1C1C','чёрный'],
      'Классические серые':       ['#607D8B','серый'],
      'Тёмные джинсы':            ['#263238','тёмный индиго'],
      'Чинос':                    ['#A1887F','бежево-коричневый'],
    };
    const [color, colorName] = map[name] || ['#455A64','тёмный'];
    let reason = 'Хорошо сочетается с верхней частью образа';
    if (zones.includes('Короткие ноги')) reason = 'Монохромный низ визуально удлиняет силуэт';
    if (zones.includes('Живот / талия')) reason = 'Прямой крой без манжет создаёт стройный силуэт';
    return { name, color, colorName, reason };
  },

  shoes(event, style, wardrobe) {
    const formal = ['office','negotiations','conference'];
    let list;
    if (formal.includes(event) || style === 'Строго деловой') {
      list = ['Чёрные оксфорды','Коричневые туфли','Дерби','Лоферы','Ботинки'];
    } else if (event === 'restaurant') {
      list = ['Лоферы','Коричневые туфли','Чёрные оксфорды','Дерби','Ботинки'];
    } else {
      list = ['Лоферы','Белые кроссовки','Ботинки','Дерби','Коричневые туфли'];
    }
    const name = this.pick(list, wardrobe);
    const map = {
      'Чёрные оксфорды':   ['#1C1C1C','чёрный'],
      'Коричневые туфли':  ['#5D4037','тёмно-коричневый'],
      'Лоферы':            ['#4E342E','тёмно-коричневый'],
      'Дерби':             ['#37474F','тёмный'],
      'Белые кроссовки':   ['#FAFAFA','белый'],
      'Ботинки':           ['#3E2723','тёмно-коричневый'],
    };
    const [color, colorName] = map[name] || ['#1C1C1C','тёмный'];
    return { name, color, colorName, reason: 'Завершает образ и задаёт уровень формальности' };
  },

  palette(ct) {
    const p = {
      'Весна': [{ color:'#DEB887',role:'основной' },{ color:'#87CEEB',role:'средний' },{ color:'#F4A460',role:'акцент' }],
      'Лето':  [{ color:'#708090',role:'основной' },{ color:'#B0C4DE',role:'средний' },{ color:'#9FAFB9',role:'акцент' }],
      'Осень': [{ color:'#5D4037',role:'основной' },{ color:'#556B2F',role:'средний' },{ color:'#DAA520',role:'акцент' }],
      'Зима':  [{ color:'#1C1C1C',role:'основной' },{ color:'#37474F',role:'средний' },{ color:'#1565C0',role:'акцент' }],
    };
    return p[ct] || p['Зима'];
  },

  colorRule(ct) {
    const r = {
      'Весна': 'Цветотип "Весна" — тёплые, светлые, свежие оттенки. Бежевый с голубым создают мягкий элегантный контраст. Избегайте холодных тёмных серых.',
      'Лето':  'Цветотип "Лето" — холодные приглушённые тона без резких контрастов. Серо-голубые оттенки создают утончённый образ. Яркие цвета — только маленьким акцентом.',
      'Осень': 'Цветотип "Осень" — тёплые землистые оттенки. Коричневый, оливковый и горчичный работают как единая природная гамма. Избегайте холодных серых и пастельных розовых.',
      'Зима':  'Цветотип "Зима" любит контрасты: тёмный с белым или ярким. Тёмно-синий с белой рубашкой — классика вашего типа. Яркий акцент в галстуке или нагрудном платке — финальный штрих.',
    };
    return r[ct] || r['Зима'];
  },

  combos(items) {
    const names = items.slice(0, 3).map(i => i.name).join(' + ');
    return [
      { name: 'Базовое',    description: names || 'Классическое сочетание вещей' },
      { name: 'С акцентом', description: 'Добавьте нагрудный платок или часы — небольшая деталь меняет весь образ' },
      { name: 'Монохром',   description: 'Подберите рубашку в тон брюкам — тёмные оттенки одного цвета визуально вытягивают силуэт' },
    ];
  },

  stylistTip(bodyType, zones) {
    const zoneTips = {
      'Живот / талия':  'Расстёгнутый пиджак и тёмная рубашка навыпуск — два главных приёма для скрытия живота.',
      'Короткая шея':   'Расстёгнутый ворот или V-вырез удлиняют шею визуально. Откажитесь от плотного узла галстука.',
      'Короткие ноги':  'Брюки без манжет + обувь в тон брюкам создают непрерывную вертикаль, удлиняя силуэт.',
      'Широкие плечи':  'Тёмный верх и однотонные вещи без горизонтальных полос уравновесят пропорции.',
      'Узкие плечи':    'Структурированный пиджак с мягкими подплечниками добавит ширины и уверенности.',
    };
    for (const z of zones) {
      if (zoneTips[z]) return zoneTips[z];
    }
    const bt = {
      oval:      'Расстегните пиджак — V-линия визуально вытягивает фигуру.',
      rectangle: 'Структурированные плечи и приталенный силуэт создадут нужные пропорции.',
      triangle:  'Тёмный верх уравновесит широкие плечи — избегайте горизонтальных полос.',
      inverted:  'Светлый верх + тёмный низ добавит баланс и объём нижней части.',
      trapezoid: 'Вертикальные линии на рубашке и прямые брюки — ваш выигрышный приём.',
    };
    return bt[bodyType] || 'Уложите нагрудный платок — эта деталь мгновенно поднимает образ на уровень выше.';
  },

  confidenceTip() {
    const tips = [
      'Осанка — лучший аксессуар. Прямая спина делает любой образ дороже на порядок.',
      'Мужчина в 50+ носит одежду, а не наоборот. Уверенность — главная деталь образа.',
      'Подойдите к зеркалу и убедитесь, что всё сидит по фигуре. Посадка важнее бренда.',
      'Хорошо подобранные часы или ремень завершают образ лучше любого галстука.',
    ];
    return tips[new Date().getDay() % tips.length];
  },

  weatherNote(temp, code) {
    const isRain = code >= 51 && code <= 82;
    const rain = isRain ? ' Возьмите зонт.' : '';
    if (temp < 0)  return `Мороз ${Math.abs(Math.round(temp))}°C — многослойность обязательна. Термобельё под рубашку сохранит тепло.${rain}`;
    if (temp < 10) return `Холодно (${Math.round(temp)}°C) — верхняя одежда необходима. Шарф добавит тепла и элегантности.${rain}`;
    if (temp < 18) return `Прохладно (${Math.round(temp)}°C) — лёгкая верхняя одежда не помешает, особенно вечером.${rain}`;
    if (temp < 25) return `Комфортная температура (${Math.round(temp)}°C) — можно обойтись без верхней одежды.${rain}`;
    return `Тепло (${Math.round(temp)}°C) — выбирайте лёгкие дышащие ткани. Хлопок предпочтительнее.${rain}`;
  },

  trendNote(event) {
    const t = {
      office:       'Тренд сезона — тихая роскошь: минимализм, качественные ткани, никаких логотипов.',
      negotiations: 'Power dressing через цвет: тёмно-синий сигнализирует о надёжности и компетентности.',
      restaurant:   'Smart elegant: пиджак без галстука с хорошей рубашкой — современный ресторанный дресс-код.',
      home:         'Elevated casual: чинос + структурированный джемпер — комфортно и намеренно стильно.',
      walk:         'Refined casual: тёмные джинсы + блейзер — граница между отдыхом и стилем.',
      conference:   'Authority look: костюм без галстука — знак современности и уверенности.',
    };
    return t[event] || 'Минимализм и качество материалов — главный тренд делового гардероба этого сезона.';
  },

  title(event) {
    const t = { office:'Деловой образ', negotiations:'Образ для переговоров', home:'Комфортный рабочий день', restaurant:'Вечерний образ', walk:'Casual прогулка', conference:'Конференц-образ' };
    return t[event] || 'Образ дня';
  },

  subtitle(event) {
    const s = { office:'Профессионально, уверенно, уместно', negotiations:'Производите впечатление с первых секунд', home:'Работаете дома — выглядите собранно', restaurant:'Элегантно, без излишней формальности', walk:'Свежо, стильно, без усилий', conference:'Авторитетно среди коллег и партнёров' };
    return s[event] || 'Подобрано под ваш профиль и погоду';
  },
};

// ── STATIC DATA ───────────────────────────────────────────────
const BODY_TYPES = [
  { id:'rectangle', icon:'⬜', name:'Прямоугольник', desc:'Плечи ≈ талия ≈ бёдра' },
  { id:'triangle',  icon:'🔻', name:'Треугольник',   desc:'Широкие плечи, узкие бёдра' },
  { id:'inverted',  icon:'🔺', name:'Обр. треуг.',   desc:'Узкие плечи, широкие бёдра' },
  { id:'oval',      icon:'⭕', name:'Овал',          desc:'Округлая талия, живот' },
  { id:'trapezoid', icon:'🔷', name:'Трапеция',      desc:'Немного шире внизу' },
];

const PROBLEM_ZONES = [
  'Живот / талия','Широкие плечи','Узкие плечи',
  'Короткая шея','Длинное туловище','Короткие ноги','Полные ноги',
];

const COLOR_TYPES = {
  'Весна': { desc:'Тёплые светлые цвета — бежевый, коралловый, светло-синий.',        cols:['#F4A460','#FF7F50','#87CEEB'] },
  'Лето':  { desc:'Холодные пастельные тона — серо-голубой, лавандовый, розово-серый.', cols:['#B0C4DE','#DDA0DD','#D3D3D3'] },
  'Осень': { desc:'Тёплые насыщенные цвета — терракота, оливковый, горчичный.',         cols:['#CD853F','#556B2F','#DAA520'] },
  'Зима':  { desc:'Холодные контрастные цвета — чёрный, белый, ярко-синий, красный.',   cols:['#1C1C1C','#FFFFFF','#0047AB'] },
};

const SKIN_OPTS  = [{ id:'very_light',label:'Очень светлая',dot:'#FDEBD0'},{ id:'light',label:'Светлая',dot:'#F5CBA7'},{ id:'olive',label:'Оливковая',dot:'#C9A84C'},{ id:'tan',label:'Смуглая',dot:'#A04000'},{ id:'dark',label:'Тёмная',dot:'#5D4037'}];
const HAIR_OPTS  = [{ id:'black',label:'Чёрный',dot:'#1C1C1C'},{ id:'dark_brown',label:'Тёмно-коричн.',dot:'#3D1C02'},{ id:'brown',label:'Каштановый',dot:'#7B3F00'},{ id:'blonde',label:'Русый',dot:'#D4AC0D'},{ id:'gray',label:'Седой',dot:'#B0BEC5'}];
const EYE_OPTS   = [{ id:'brown',label:'Карие',dot:'#6D4C41'},{ id:'green',label:'Зелёные',dot:'#388E3C'},{ id:'gray',label:'Серые',dot:'#78909C'},{ id:'blue',label:'Голубые',dot:'#1E88E5'},{ id:'black',label:'Чёрные',dot:'#212121'}];
const TONE_OPTS  = [{ id:'warm',label:'Тёплый (золотистый)',dot:'#F9A825'},{ id:'cool',label:'Холодный (розовый)',dot:'#E91E63'},{ id:'neutral',label:'Нейтральный',dot:'#9E9E9E'}];

const WARDROBE = {
  'Верхняя одежда':    ['Пальто','Тренч','Пуховик','Дублёнка','Кожаная куртка','Лёгкий плащ'],
  'Пиджаки':           ['Тёмно-синий костюм','Серый костюм','Блейзер','Пиджак casual'],
  'Рубашки / трикотаж':['Белая рубашка','Голубая рубашка','Рубашка в клетку','Водолазка','Свитер V-вырез','Пуловер'],
  'Брюки':             ['Классические серые','Классические тёмно-синие','Чёрные классические','Тёмные джинсы','Чинос'],
  'Обувь':             ['Чёрные оксфорды','Коричневые туфли','Лоферы','Дерби','Белые кроссовки','Ботинки'],
  'Аксессуары':        ['Кожаный ремень','Классические часы','Спортивные часы','Галстуки','Нагрудный платок','Запонки'],
};

const EVENTS = [
  { id:'office',       label:'Офис',        icon:'💼' },
  { id:'negotiations', label:'Переговоры',  icon:'🤝' },
  { id:'home',         label:'Дома',        icon:'🏠' },
  { id:'restaurant',   label:'Ресторан',    icon:'🍽️' },
  { id:'walk',         label:'Прогулка',    icon:'🚶' },
  { id:'conference',   label:'Конференция', icon:'🎤' },
];

// ── DOM HELPERS ───────────────────────────────────────────────
const $ = sel => document.querySelector(sel);
const $$ = sel => [...document.querySelectorAll(sel)];
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

// ── APP STATE ─────────────────────────────────────────────────
let S = {
  screen: 'home',
  step: 1,
  ob: {},
  colorQ: {},
  wx: null,
  wxLoading: false,
  outfit: null,
  outfitErr: null,
  event: null,
};

// ── ROUTER ────────────────────────────────────────────────────
function go(screen) {
  S.screen = screen;
  S.outfit = null;
  S.outfitErr = null;
  render();
}

function render() {
  if (!Store.getProfile()) { renderWelcome(); return; }
  if (S.screen === 'profile') { renderProfile(); return; }
  renderHome();
}

// ── WELCOME ───────────────────────────────────────────────────
function renderWelcome() {
  document.getElementById('app').innerHTML = `
<div class="welcome">
  <div class="welcome-logo">👔</div>
  <h1 class="welcome-title">Карманный стилист</h1>
  <p class="welcome-subtitle">Подберёт образ под погоду и событие каждое утро</p>
  <button class="btn btn-primary" id="btn-start" style="max-width:260px;">Начать →</button>
</div>`;
  $('#btn-start').addEventListener('click', () => { S.step = 1; S.ob = {}; S.colorQ = {}; renderOnb(); });
}

// ── ONBOARDING ────────────────────────────────────────────────
function renderOnb() {
  const steps = [null, onbStep1, onbStep2, onbStep3, onbStep4, onbStep5, onbStep6, onbStep7];
  document.getElementById('app').innerHTML = steps[S.step]();
  onbEvents(S.step);
}

function pbHtml(cur) {
  return `<div class="progress-bar">${[1,2,3,4,5,6,7].map(i =>
    `<div class="progress-dot ${i < cur ? 'done' : i === cur ? 'active' : ''}"></div>`
  ).join('')}</div><p class="step-label">Шаг ${cur} из 7</p>`;
}

function backNext() {
  return `<div style="display:flex;gap:10px;margin-top:20px;">
    <button class="btn btn-outline" id="btn-back" style="flex:1;">← Назад</button>
    <button class="btn btn-primary" id="btn-next" style="flex:2;">Далее →</button>
  </div>`;
}

function onbStep1() {
  const d = S.ob;
  const h = d.height || 178, w = d.weight || 85;

  function selHtml(id, label, options, def) {
    const cur = d[id] || def;
    return `<div class="form-group">
      <label class="label">${label}</label>
      <select class="input" id="inp-${id}">
        ${options.map(o => `<option value="${o}" ${o == cur ? 'selected' : ''}>${o}</option>`).join('')}
      </select>
    </div>`;
  }

  const suitSizes   = [44,46,48,50,52,54,56,58];
  const collarSizes = Array.from({length:11}, (_,i) => 37+i);
  const pantsSizes  = Array.from({length:11}, (_,i) => 44+i*2);
  const shoeSizes   = Array.from({length:11}, (_,i) => 38+i);

  return `<div class="onboarding">
  ${pbHtml(1)}
  <h2 class="onboarding-title">Расскажите о себе</h2>
  <p class="onboarding-subtitle">Заполняется один раз — потом приложение делает всё само</p>

  <div class="form-group">
    <label class="label">Имя</label>
    <input class="input" id="inp-name" type="text" placeholder="Как вас зовут?" value="${esc(d.name||'')}">
  </div>
  <div class="form-group">
    <label class="label">Возраст</label>
    <input class="input" id="inp-age" type="number" min="30" max="80" placeholder="50" value="${esc(d.age||'')}">
  </div>

  <div class="divider"></div>
  <p style="font-size:13px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.6px;margin-bottom:16px;">Рост и вес</p>

  <div class="slider-group">
    <div class="slider-header">
      <label class="label" style="margin:0">Рост</label>
      <span class="slider-value" id="sv-height">${h} см</span>
    </div>
    <input type="range" id="sl-height" min="155" max="210" value="${h}"
      oninput="document.getElementById('sv-height').textContent=this.value+' см'">
  </div>
  <div class="slider-group">
    <div class="slider-header">
      <label class="label" style="margin:0">Вес</label>
      <span class="slider-value" id="sv-weight">${w} кг</span>
    </div>
    <input type="range" id="sl-weight" min="50" max="180" value="${w}"
      oninput="document.getElementById('sv-weight').textContent=this.value+' кг'">
  </div>

  <div class="divider"></div>
  <p style="font-size:13px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.6px;margin-bottom:16px;">Размеры одежды</p>

  ${selHtml('sizeSuit',   'Размер костюма / пиджака', suitSizes,   50)}
  ${selHtml('sizeCollar', 'Размер рубашки (ворот)',   collarSizes, 41)}
  ${selHtml('sizePants',  'Размер брюк (EU)',          pantsSizes,  52)}
  ${selHtml('sizeShoes',  'Размер обуви (EU)',          shoeSizes,   43)}

  <div class="divider"></div>
  <p style="font-size:13px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.6px;margin-bottom:16px;">Местоположение</p>

  <div class="form-group">
    <label class="label">Ваш город</label>
    <input class="input" id="inp-city" type="text" placeholder="Астана" value="${esc(d.city||'')}">
  </div>
  <button class="btn btn-outline" id="btn-geo" style="margin-bottom:16px;">📍 Определить автоматически</button>
  <div id="geo-status" style="font-size:13px;color:var(--text-secondary);min-height:18px;margin-bottom:8px;"></div>

  <button class="btn btn-primary" id="btn-next" style="margin-top:8px;">Далее →</button>
</div>`;
}

function onbStep2() {
  const d = S.ob;
  const sliders = [
    { id:'chest',  label:'Обхват груди',    min:80,  max:140, unit:'см', def:100 },
    { id:'waist',  label:'Обхват талии',    min:60,  max:140, unit:'см', def:90  },
    { id:'hips',   label:'Обхват бёдер',    min:80,  max:140, unit:'см', def:100 },
    { id:'neck',   label:'Обхват шеи',      min:30,  max:55,  unit:'см', def:40  },
    { id:'sleeve', label:'Длина рукава',    min:55,  max:90,  unit:'см', def:65  },
    { id:'inseam', label:'Длина внутр. шва',min:65,  max:95,  unit:'см', def:80  },
  ];
  return `<div class="onboarding">
  ${pbHtml(2)}
  <h2 class="onboarding-title">Параметры фигуры</h2>
  <p class="onboarding-subtitle">Двигайте ползунки</p>
  ${sliders.map(s => {
    const v = d[s.id] || s.def;
    return `<div class="slider-group">
      <div class="slider-header">
        <label class="label" style="margin:0">${s.label}</label>
        <span class="slider-value" id="sv-${s.id}">${v} ${s.unit}</span>
      </div>
      <input type="range" id="sl-${s.id}" min="${s.min}" max="${s.max}" value="${v}"
        oninput="document.getElementById('sv-${s.id}').textContent=this.value+' ${s.unit}'">
    </div>`;
  }).join('')}
  ${backNext()}
</div>`;
}

function onbStep3() {
  return `<div class="onboarding">
  ${pbHtml(3)}
  <h2 class="onboarding-title">Тип телосложения</h2>
  <p class="onboarding-subtitle">Выберите ближайший к вашей фигуре</p>
  <div class="body-type-grid">
    ${BODY_TYPES.map(t => `
    <div class="body-type-card ${S.ob.bodyType===t.id?'active':''}" data-bt="${t.id}">
      <span class="body-type-icon">${t.icon}</span>
      <div class="body-type-name">${t.name}</div>
      <div class="body-type-desc">${t.desc}</div>
    </div>`).join('')}
  </div>
  <div class="form-group">
    <label class="label">Проблемные зоны (можно несколько)</label>
    ${PROBLEM_ZONES.map(z => `
    <label class="check-item">
      <input type="checkbox" name="pz" value="${esc(z)}" ${(S.ob.problemZones||[]).includes(z)?'checked':''}>
      ${z}
    </label>`).join('')}
  </div>
  ${backNext()}
</div>`;
}

function onbStep4() {
  function opts(list, qKey) {
    return list.map(o => `
    <div class="color-option ${S.colorQ[qKey]===o.id?'active':''}" data-q="${qKey}" data-v="${o.id}">
      <span class="color-dot" style="background:${o.dot};border:1px solid var(--border)"></span>
      ${o.label}
    </div>`).join('');
  }
  const ct = S.ob.colorType;
  return `<div class="onboarding">
  ${pbHtml(4)}
  <h2 class="onboarding-title">Цветотип</h2>
  <p class="onboarding-subtitle">Помогает подбирать подходящие цвета одежды</p>
  <div class="form-group"><label class="label">Цвет кожи</label><div class="color-options">${opts(SKIN_OPTS,'skin')}</div></div>
  <div class="form-group"><label class="label">Цвет волос</label><div class="color-options">${opts(HAIR_OPTS,'hair')}</div></div>
  <div class="form-group"><label class="label">Цвет глаз</label><div class="color-options">${opts(EYE_OPTS,'eyes')}</div></div>
  <div class="form-group"><label class="label">Подтон кожи</label><div class="color-options">${opts(TONE_OPTS,'tone')}</div></div>
  ${ct ? `<div class="colortype-result">
    <div style="font-size:12px;opacity:.7;margin-bottom:4px;">ВАШ ЦВЕТОТИП</div>
    <div class="colortype-name">${esc(ct)}</div>
    <div class="colortype-desc">${esc(COLOR_TYPES[ct]?.desc||'')}</div>
    <div style="display:flex;justify-content:center;gap:8px;margin-top:10px;">
      ${(COLOR_TYPES[ct]?.cols||[]).map(c=>`<span style="width:22px;height:22px;border-radius:50%;background:${c};display:inline-block;border:1px solid rgba(255,255,255,0.3)"></span>`).join('')}
    </div>
  </div>` : ''}
  <div style="display:flex;gap:10px;margin-top:20px;">
    <button class="btn btn-outline" id="btn-back" style="flex:1;">← Назад</button>
    <button class="btn btn-outline" id="btn-calc" style="flex:1.5;">Определить</button>
    <button class="btn btn-primary" id="btn-next" style="flex:2;">Далее →</button>
  </div>
</div>`;
}

function calcCT(q) {
  const warm = q.tone === 'warm' || ((q.hair === 'blonde' || q.hair === 'brown') && q.tone !== 'cool');
  const light = q.skin === 'very_light' || q.skin === 'light';
  if (warm && light)  return 'Весна';
  if (!warm && light) return 'Лето';
  if (warm && !light) return 'Осень';
  return 'Зима';
}

function onbStep5() {
  const sel = S.ob.wardrobe || [];
  return `<div class="onboarding">
  ${pbHtml(5)}
  <h2 class="onboarding-title">Ваш гардероб</h2>
  <p class="onboarding-subtitle">Отметьте вещи, которые у вас есть</p>
  <div id="wrd-count" style="font-size:13px;color:var(--accent);font-weight:700;margin-bottom:16px;">Выбрано: ${sel.length}</div>
  ${Object.entries(WARDROBE).map(([cat,items]) => `
  <div class="wardrobe-section">
    <div class="wardrobe-section-title">${cat}</div>
    <div class="pills">
      ${items.map(item => `<button class="pill wrd-pill ${sel.includes(item)?'active':''}" data-item="${esc(item)}">${item}</button>`).join('')}
    </div>
  </div>`).join('')}
  ${backNext()}
</div>`;
}

function onbStep6() {
  const d = S.ob;
  return `<div class="onboarding">
  ${pbHtml(6)}
  <h2 class="onboarding-title">Стилевые предпочтения</h2>
  <p class="onboarding-subtitle">Помогает точнее подбирать образы</p>
  <div class="form-group">
    <label class="label">Предпочтительный стиль</label>
    <div class="pills">
      ${['Строго деловой','Smart casual','Casual','Смешанный'].map(s =>
        `<button class="pill sp-pill ${d.stylePreference===s?'active':''}" data-sp="${s}">${s}</button>`).join('')}
    </div>
  </div>
  <div class="form-group" style="margin-top:16px;">
    <label class="label">Отношение к трендам</label>
    <div class="pills">
      ${['Слежу','Не против','Консерватор'].map(s =>
        `<button class="pill ta-pill ${d.trendAttitude===s?'active':''}" data-ta="${s}">${s}</button>`).join('')}
    </div>
  </div>
  ${backNext()}
</div>`;
}

function onbStep7() {
  const d = S.ob;
  return `<div class="onboarding">
  ${pbHtml(7)}
  <h2 class="onboarding-title">Почти готово!</h2>
  <p class="onboarding-subtitle">Проверьте ваш профиль перед стартом</p>
  <div class="card" style="background:var(--bg-secondary);box-shadow:none;">
    <div class="sh">Ваш профиль</div>
    <p style="font-size:14px;color:var(--text-secondary);line-height:2;">
      👤 ${esc(d.name)}, ${d.age} лет · ${esc(d.city||'город не указан')}<br>
      📏 ${d.height||'—'} см · ${d.weight||'—'} кг<br>
      👔 Костюм ${d.sizeSuit||'—'} · Ворот ${d.sizeCollar||'—'} · Брюки ${d.sizePants||'—'} · Обувь ${d.sizeShoes||'—'}<br>
      🏋️ ${d.bodyType||'тип не выбран'} · ${d.colorType||'цветотип не определён'}<br>
      🎨 ${d.stylePreference||'стиль не выбран'} · ${(d.wardrobe||[]).length} вещей
    </p>
  </div>
  <div style="display:flex;gap:10px;margin-top:16px;">
    <button class="btn btn-outline" id="btn-back" style="flex:1;">← Назад</button>
    <button class="btn btn-accent" id="btn-finish" style="flex:2;">Готово ✓</button>
  </div>
</div>`;
}

function onbEvents(step) {
  if (step === 1) {
    $('#btn-geo')?.addEventListener('click', async () => {
      const st = document.getElementById('geo-status');
      st.textContent = '⏳ Определяем...';
      try {
        const { lat, lon } = await Wx.geoLocation();
        const city = await Wx.reverseCity(lat, lon);
        $('#inp-city').value = city;
        S.ob.lat = lat; S.ob.lon = lon;
        st.textContent = `✅ ${city}`;
      } catch {
        st.textContent = '❌ Не удалось. Введите вручную.';
      }
    });
    $('#btn-next').addEventListener('click', () => {
      const name = $('#inp-name').value.trim();
      const age  = parseInt($('#inp-age').value);
      const city = $('#inp-city').value.trim();
      if (!name) { alert('Введите ваше имя'); return; }
      if (!age || age < 30 || age > 80) { alert('Введите корректный возраст (30–80)'); return; }
      if (!city) { alert('Укажите ваш город'); return; }
      S.ob.name       = name;
      S.ob.age        = age;
      S.ob.height     = parseInt($('#sl-height').value);
      S.ob.weight     = parseInt($('#sl-weight').value);
      S.ob.sizeSuit   = $('#inp-sizeSuit').value;
      S.ob.sizeCollar = $('#inp-sizeCollar').value;
      S.ob.sizePants  = $('#inp-sizePants').value;
      S.ob.sizeShoes  = $('#inp-sizeShoes').value;
      S.ob.city       = city;
      S.step = 2; renderOnb();
    });
    return;
  }

  $('#btn-back')?.addEventListener('click', () => { S.step--; renderOnb(); });

  if (step === 2) {
    $('#btn-next').addEventListener('click', () => {
      ['chest','waist','hips','neck','sleeve','inseam'].forEach(id => {
        S.ob[id] = parseInt($(`#sl-${id}`).value);
      });
      S.step = 3; renderOnb();
    });
  }

  if (step === 3) {
    $$('.body-type-card').forEach(c => c.addEventListener('click', () => {
      S.ob.bodyType = c.dataset.bt;
      $$('.body-type-card').forEach(x => x.classList.remove('active'));
      c.classList.add('active');
    }));
    $('#btn-next').addEventListener('click', () => {
      if (!S.ob.bodyType) { alert('Выберите тип телосложения'); return; }
      S.ob.problemZones = $$('input[name=pz]:checked').map(cb => cb.value);
      S.step = 4; renderOnb();
    });
  }

  if (step === 4) {
    $$('.color-option').forEach(o => o.addEventListener('click', () => {
      const q = o.dataset.q;
      S.colorQ[q] = o.dataset.v;
      $$(`[data-q="${q}"]`).forEach(x => x.classList.remove('active'));
      o.classList.add('active');
    }));
    $('#btn-calc').addEventListener('click', () => {
      S.ob.colorType = calcCT(S.colorQ);
      renderOnb();
    });
    $('#btn-next').addEventListener('click', () => { S.step = 5; renderOnb(); });
  }

  if (step === 5) {
    if (!S.ob.wardrobe) S.ob.wardrobe = [];
    $$('.wrd-pill').forEach(p => p.addEventListener('click', () => {
      const item = p.dataset.item;
      const idx = S.ob.wardrobe.indexOf(item);
      if (idx === -1) S.ob.wardrobe.push(item);
      else S.ob.wardrobe.splice(idx, 1);
      p.classList.toggle('active');
      const el = document.getElementById('wrd-count');
      if (el) el.textContent = `Выбрано: ${S.ob.wardrobe.length}`;
    }));
    $('#btn-next').addEventListener('click', () => {
      if ((S.ob.wardrobe||[]).length < 3) { alert('Выберите хотя бы 3 вещи'); return; }
      S.step = 6; renderOnb();
    });
  }

  if (step === 6) {
    $$('.sp-pill').forEach(p => p.addEventListener('click', () => {
      S.ob.stylePreference = p.dataset.sp;
      $$('.sp-pill').forEach(x => x.classList.remove('active')); p.classList.add('active');
    }));
    $$('.ta-pill').forEach(p => p.addEventListener('click', () => {
      S.ob.trendAttitude = p.dataset.ta;
      $$('.ta-pill').forEach(x => x.classList.remove('active')); p.classList.add('active');
    }));
    $('#btn-next').addEventListener('click', () => {
      if (!S.ob.stylePreference) { alert('Выберите предпочтительный стиль'); return; }
      S.step = 7; renderOnb();
    });
  }

  if (step === 7) {
    $('#btn-finish').addEventListener('click', () => {
      Store.saveProfile(S.ob);
      S.screen = 'home'; S.wx = null;
      renderHome();
    });
  }
}

// ── HOME ──────────────────────────────────────────────────────
function renderHome() {
  const profile = Store.getProfile();
  document.getElementById('app').innerHTML = `
<div class="main">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
    <div>
      <div style="font-size:12px;color:var(--text-secondary);">Доброе утро</div>
      <h1 style="font-size:22px;font-weight:800;">${esc(profile.name)} 👋</h1>
    </div>
    <span style="font-size:13px;color:var(--text-secondary);">${new Date().toLocaleDateString('ru-RU',{day:'numeric',month:'long'})}</span>
  </div>

  ${wxHtml()}

  <div class="card">
    <h3 style="margin-bottom:12px;">Куда сегодня?</h3>
    <div class="pills">
      ${EVENTS.map(e => `<button class="pill ev-pill ${S.event===e.id?'active':''}" data-ev="${e.id}">${e.icon} ${e.label}</button>`).join('')}
    </div>
  </div>

  <button class="btn btn-accent" id="btn-gen" ${!S.event?'disabled':''}>
    ✨ Подобрать образ
  </button>

  ${S.outfitErr ? `<div class="alert alert-error">${esc(S.outfitErr)}</div>` : ''}
  ${outfitHtml()}
</div>
${navHtml('home')}`;
  homeEvents();
}

function wxHtml() {
  if (S.wxLoading) return `<div class="card"><div style="display:flex;align-items:center;gap:10px;"><div class="spinner" style="width:22px;height:22px;border-width:2px;"></div><span style="font-size:14px;color:var(--text-secondary);">Загружаем погоду…</span></div></div>`;
  if (!S.wx) return `<div class="card" style="display:flex;align-items:center;justify-content:space-between;"><span style="font-size:14px;color:var(--text-secondary);">Погода не загружена</span><button class="btn btn-outline" id="btn-wx" style="width:auto;padding:8px 14px;font-size:13px;">☁️ Загрузить</button></div>`;
  const w = S.wx;
  return `<div class="card">
    <div class="weather-widget">
      <div class="weather-icon">${Wx.icon(w.weather_code)}</div>
      <div style="flex:1;">
        <div style="display:flex;align-items:baseline;gap:4px;">
          <span class="weather-temp">${Math.round(w.temperature_2m)}°</span>
          <span class="weather-feels">ощущается ${Math.round(w.apparent_temperature)}°</span>
        </div>
        <div class="weather-desc">${Wx.desc(w.weather_code)}</div>
        <div class="weather-details"><span>💨 ${w.wind_speed_10m} км/ч</span><span>💧 ${w.relative_humidity_2m}%</span></div>
      </div>
      <button id="btn-wx-ref" style="background:none;border:none;cursor:pointer;font-size:20px;padding:4px;" title="Обновить">🔄</button>
    </div>
  </div>`;
}

function outfitHtml() {
  const o = S.outfit;
  if (!o) return '';
  return `<div id="outfit">
  <div class="card">
    <div class="outfit-badge">Образ дня</div>
    <h2 style="font-size:20px;margin-bottom:4px;">${esc(o.title)}</h2>
    <p style="font-size:14px;color:var(--text-secondary);">${esc(o.subtitle)}</p>
  </div>
  ${o.weatherNote?`<div class="card"><div class="sh">☁️ Погода</div><p style="font-size:14px;">${esc(o.weatherNote)}</p></div>`:''}
  ${o.trendNote?`<div class="card"><div class="sh">📈 Тренд</div><p style="font-size:14px;">${esc(o.trendNote)}</p></div>`:''}
  <div class="card">
    <div class="sh">👔 Образ</div>
    ${(o.items||[]).map(it=>`
    <div class="outfit-item">
      <div class="item-color" style="background:${esc(it.color)};"></div>
      <div>
        <div class="item-name">${esc(it.name)}</div>
        <div class="item-color-name">${esc(it.colorName)}</div>
        <div class="item-reason">${esc(it.reason)}</div>
      </div>
    </div>`).join('')}
  </div>
  <div class="card">
    <div class="sh">🎨 Цветовая палитра</div>
    <div class="palette">
      ${(o.palette||[]).map(p=>`
      <div class="palette-item">
        <div class="swatch" style="background:${esc(p.color)};"></div>
        <span class="palette-role">${esc(p.role)}</span>
      </div>`).join('')}
    </div>
    ${o.colorRule?`<p style="font-size:13px;color:var(--text-secondary);margin-top:12px;line-height:1.6;">${esc(o.colorRule)}</p>`:''}
  </div>
  <div class="card">
    <div class="sh">🔀 Варианты сочетаний</div>
    ${(o.combinations||[]).map(c=>`
    <div class="combo-item">
      <div class="combo-name">${esc(c.name)}</div>
      <div style="font-size:14px;">${esc(c.description)}</div>
    </div>`).join('')}
  </div>
  ${o.stylistTip?`<div class="card"><div class="sh">✨ Совет стилиста</div><div class="tip-box">${esc(o.stylistTip)}</div></div>`:''}
  ${o.confidenceTip?`<div class="card"><div class="sh">💪 Уверенность</div><div class="tip-box green">${esc(o.confidenceTip)}</div></div>`:''}
</div>`;
}

function homeEvents() {
  if (!S.wx && !S.wxLoading) loadWx();
  $('#btn-wx')?.addEventListener('click', loadWx);
  $('#btn-wx-ref')?.addEventListener('click', loadWx);
  $$('.ev-pill').forEach(p => p.addEventListener('click', () => {
    S.event = p.dataset.ev;
    $$('.ev-pill').forEach(x => x.classList.remove('active')); p.classList.add('active');
    const btn = $('#btn-gen'); if (btn) btn.disabled = false;
  }));
  $('#btn-gen')?.addEventListener('click', genOutfit);
  $$('.nav-btn').forEach(b => b.addEventListener('click', () => go(b.dataset.sc)));
}

async function loadWx() {
  S.wxLoading = true; renderHome();
  const profile = Store.getProfile();
  try {
    let lat, lon;
    if (profile.lat && profile.lon) { lat = profile.lat; lon = profile.lon; }
    else {
      try { const c = await Wx.geoLocation(); lat = c.lat; lon = c.lon; }
      catch { const c = await Wx.geocode(profile.city || 'Астана'); lat = c.lat; lon = c.lon; }
    }
    S.wx = await Wx.byCoords(lat, lon);
  } catch { S.wx = null; }
  finally { S.wxLoading = false; renderHome(); }
}

function genOutfit() {
  if (!S.event) return;
  if (!S.wx) { S.outfitErr = 'Сначала загрузите погоду'; renderHome(); return; }
  S.outfitErr = null;
  S.outfit = Stylist.suggest(Store.getProfile(), S.wx, S.event);
  renderHome();
  setTimeout(() => document.getElementById('outfit')?.scrollIntoView({ behavior: 'smooth' }), 80);
}

// ── PROFILE ───────────────────────────────────────────────────
function renderProfile() {
  const p = Store.getProfile();
  document.getElementById('app').innerHTML = `
<div class="main">
  <div style="text-align:center;padding:24px 0 16px;">
    <div class="profile-avatar">👤</div>
    <h2 style="font-size:20px;">${esc(p.name)}</h2>
    <p style="font-size:14px;color:var(--text-secondary);">${p.age} лет · ${esc(p.city||'')}</p>
  </div>

  <div class="card">
    <div class="sh">Фигура</div>
    <p style="font-size:14px;color:var(--text-secondary);line-height:1.9;">
      Тип: <strong style="color:var(--text);">${esc(p.bodyType||'—')}</strong><br>
      Рост: <strong style="color:var(--text);">${p.height} см</strong> · Вес: <strong style="color:var(--text);">${p.weight} кг</strong><br>
      Грудь: ${p.chest} · Талия: ${p.waist} · Бёдра: ${p.hips} (см)
    </p>
    ${(p.problemZones||[]).length?`<p style="font-size:13px;color:var(--text-secondary);margin-top:6px;">Зоны: ${esc(p.problemZones.join(', '))}</p>`:''}
  </div>

  <div class="card">
    <div class="sh">Цветотип</div>
    <p style="font-size:16px;font-weight:700;">${esc(p.colorType||'Не определён')}</p>
    ${p.colorType && COLOR_TYPES[p.colorType] ? `
    <p style="font-size:13px;color:var(--text-secondary);margin:6px 0 8px;">${esc(COLOR_TYPES[p.colorType].desc)}</p>
    <div style="display:flex;gap:8px;">
      ${COLOR_TYPES[p.colorType].cols.map(c=>`<span style="width:22px;height:22px;border-radius:50%;background:${c};display:inline-block;border:1px solid var(--border);"></span>`).join('')}
    </div>` : ''}
  </div>

  <div class="card">
    <div class="sh">Гардероб (${(p.wardrobe||[]).length} вещей)</div>
    <div class="pills" style="margin-top:6px;">
      ${(p.wardrobe||[]).map(item=>`<span class="pill active" style="cursor:default;font-size:12px;padding:6px 10px;">${esc(item)}</span>`).join('')}
    </div>
  </div>

  <div class="card">
    <div class="sh">Стиль</div>
    <p style="font-size:14px;">${esc(p.stylePreference||'—')} · Тренды: ${esc(p.trendAttitude||'—')}</p>
  </div>

  <div class="divider"></div>
  <button class="btn btn-outline" id="btn-reset" style="color:#c0392b;border-color:#e74c3c;">🗑️ Сбросить профиль</button>
</div>
${navHtml('profile')}`;

  $('#btn-reset').addEventListener('click', () => {
    if (!confirm('Сбросить профиль? Все данные будут удалены.')) return;
    Store.clear();
    S = { screen:'home', step:1, ob:{}, colorQ:{}, wx:null, wxLoading:false, outfit:null, outfitErr:null, event:null };
    renderWelcome();
  });
  $$('.nav-btn').forEach(b => b.addEventListener('click', () => go(b.dataset.sc)));
}

// ── NAV ───────────────────────────────────────────────────────
function navHtml(active) {
  return `<nav class="nav">
    <button class="nav-btn ${active==='home'?'active':''}" data-sc="home"><span class="nav-icon">👔</span><span>Образ</span></button>
    <button class="nav-btn ${active==='profile'?'active':''}" data-sc="profile"><span class="nav-icon">👤</span><span>Профиль</span></button>
  </nav>`;
}

// ── INIT ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (Store.getProfile()) { S.screen = 'home'; renderHome(); }
  else renderWelcome();
});
