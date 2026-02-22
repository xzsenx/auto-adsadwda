/* ===== TELEGRAM MINI APP ===== */
(function() {
  const tg = window.Telegram?.WebApp;
  if (tg) {
    tg.ready();
    tg.expand();
    document.body.classList.add('tg-app');
  }
})();

/* ===== CONFIG ===== */
const DATA_URL = 'https://qzxoonsqalnjaqfrhhth.supabase.co/storage/v1/object/public/auto/cars.json';
const TG_CHANNEL = 'https://t.me/auto_from_korea_test';

/* ===== FALLBACK DATA (пока n8n не подключён) ===== */
const FALLBACK_CARS = [
  {
    id: 'camry-2023',
    title: 'Toyota Camry',
    price: '2 450 000 ₽',
    tag: 'SEDAN',
    category: 'sedan',
    images: [],
    desc: 'Надёжный седан для города и трассы. Пробег 32 000 км, один владелец.',
    specs: { year: '2023', km: '32 000', engine: '2.5L', drive: 'Передний' }
  },
  {
    id: 'bmw-x5',
    title: 'BMW X5 xDrive',
    price: '5 900 000 ₽',
    tag: 'SUV',
    category: 'suv',
    images: [],
    desc: 'Премиальный кроссовер. Полный привод, панорама, адаптивная подвеска.',
    specs: { year: '2022', km: '41 000', engine: '3.0L Turbo', drive: 'Полный' }
  },
  {
    id: 'porsche-911',
    title: 'Porsche 911 Carrera',
    price: '12 500 000 ₽',
    tag: 'LIMITED',
    category: 'sport',
    images: [],
    desc: 'Легенда спорткаров. PDK, Sport Chrono, керамические тормоза.',
    specs: { year: '2023', km: '8 200', engine: '3.0L Biturbo', drive: 'Задний' }
  },
];

/* ===== STATE ===== */
let CARS = [];
let favorites = JSON.parse(localStorage.getItem('auto_favs') || '[]');
let currentFilter = 'all';
let currentSort = 'default';
let advancedFilters = { brands: new Set(), models: new Map(), priceMin: null, priceMax: null, yearMin: null, yearMax: null, kmMin: null, kmMax: null, hpMin: null, hpMax: null, drive: new Set() };
let filterPanelOpen = false;

/* ===== DOM ===== */
const $ = (s, p = document) => p.querySelector(s);
const $$ = (s, p = document) => [...p.querySelectorAll(s)];

const grid = $('#carGrid');
const favCountEl = $('#favCount');
const modal = $('#modal');
const modalBackdrop = $('#modalBackdrop');
const modalBody = $('#modalBody');
const drawer = $('#drawer');
const drawerBackdrop = $('#drawerBackdrop');
const drawerItems = $('#drawerItems');

/* ===== PARSE HELPERS ===== */
function parsePrice(str) {
  return parseInt(str.replace(/[^0-9]/g, ''), 10) || 0;
}
function parseKm(str) {
  return parseInt(str.replace(/[^0-9]/g, ''), 10) || 0;
}
function parseHp(str) {
  // "150 л.с." -> 150, "150 лс" -> 150, "2.0L" -> 0, "3.0L Turbo" -> 0
  const m = str.match(/(\d+)\s*(?:л\.?с|hp)/i);
  return m ? parseInt(m[1], 10) : 0;
}
function getBrand(title) {
  // "BMW X5 xDrive" -> "BMW", "Mercedes-Benz S-Class" -> "Mercedes-Benz"
  const parts = title.split(' ');
  if (parts.length >= 2 && parts[0].endsWith('-')) return parts[0] + parts[1];
  if (title.includes('-') && parts[0].includes('-')) return parts[0];
  return parts[0];
}
function getModel(title) {
  return title.slice(getBrand(title).length).trim();
}

const POPULAR_BRANDS = ['BMW','Mercedes-Benz','Toyota','Hyundai','Kia','Audi','Volkswagen','Lexus','Mazda','Porsche','Nissan','Honda'];

/* ===== LOAD DATA ===== */
async function loadCars() {
  try {
    const res = await fetch(DATA_URL + '?t=' + Date.now());
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    CARS = Array.isArray(data) && data.length > 0 ? data : FALLBACK_CARS;
  } catch(e) {
    console.warn('cars.json ошибка:', e);
    CARS = FALLBACK_CARS;
  }
  buildBrandDropdown();
  updateFavCount();
  renderCards();
  observeReveals();
}

/* ===== BRAND / MODEL DROPDOWN ===== */
function getSortedBrands() {
  const allBrands = [...new Set(CARS.map(c => getBrand(c.title)))];
  const popular = POPULAR_BRANDS.filter(b => allBrands.includes(b));
  const rest = allBrands.filter(b => !POPULAR_BRANDS.includes(b)).sort();
  return { popular, rest };
}

function brandCount(brand) {
  return CARS.filter(c => getBrand(c.title) === brand).length;
}

function buildBrandDropdown() {
  const { popular, rest } = getSortedBrands();
  const list = $('#brandList');
  let html = '';
  popular.forEach(b => {
    const sel = advancedFilters.brands.has(b) ? ' selected' : '';
    html += `<div class="dropdown-item${sel}" data-brand-item="${b}"><span class="check-box">✓</span><span class="item-label">${b}</span><span class="item-count">${brandCount(b)}</span></div>`;
  });
  if (popular.length && rest.length) html += `<div class="dropdown-divider"></div>`;
  rest.forEach(b => {
    const sel = advancedFilters.brands.has(b) ? ' selected' : '';
    html += `<div class="dropdown-item${sel}" data-brand-item="${b}"><span class="check-box">✓</span><span class="item-label">${b}</span><span class="item-count">${brandCount(b)}</span></div>`;
  });
  list.innerHTML = html;
  updateBrandToggleText();
}

function updateBrandToggleText() {
  const txt = $('#brandToggle .dropdown-text');
  if (advancedFilters.brands.size === 0) { txt.textContent = 'Все марки'; return; }
  if (advancedFilters.brands.size <= 2) { txt.textContent = [...advancedFilters.brands].join(', '); return; }
  txt.textContent = [...advancedFilters.brands].slice(0, 2).join(', ') + ` +${advancedFilters.brands.size - 2}`;
}

function buildModelDropdown() {
  const group = $('#modelGroup');
  if (advancedFilters.brands.size === 0) { group.style.display = 'none'; return; }

  const list = $('#modelList');
  let html = '';
  for (const brand of advancedFilters.brands) {
    const models = [...new Set(CARS.filter(c => getBrand(c.title) === brand).map(c => getModel(c.title)))].filter(Boolean).sort();
    if (models.length === 0) continue;
    // brand header
    html += `<div class="dropdown-item" style="opacity:.5;pointer-events:none;font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;padding:6px 14px 2px">${brand}</div>`;
    const selModels = advancedFilters.models.get(brand);
    models.forEach(m => {
      const sel = selModels?.has(m) ? ' selected' : '';
      const cnt = CARS.filter(c => getBrand(c.title) === brand && getModel(c.title) === m).length;
      html += `<div class="dropdown-item${sel}" data-model-item="${m}" data-model-brand="${brand}"><span class="check-box">✓</span><span class="item-label">${m}</span><span class="item-count">${cnt}</span></div>`;
    });
    html += `<div class="dropdown-divider"></div>`;
  }
  list.innerHTML = html;
  group.style.display = '';
  updateModelToggleText();
}

function updateModelToggleText() {
  const txt = $('#modelToggle .dropdown-text');
  let total = 0;
  const names = [];
  for (const [, mset] of advancedFilters.models) total += mset.size;
  if (total === 0) { txt.textContent = 'Все модели'; return; }
  for (const [, mset] of advancedFilters.models) { for (const m of mset) names.push(m); }
  if (names.length <= 2) { txt.textContent = names.join(', '); return; }
  txt.textContent = names.slice(0, 2).join(', ') + ` +${names.length - 2}`;
}

/* dropdown open/close */
function toggleDropdown(id) {
  const dd = $('#' + id);
  const isOpen = dd.classList.contains('open');
  // close all
  $$('.dropdown-select.open').forEach(d => d.classList.remove('open'));
  if (!isOpen) dd.classList.add('open');
}

/* close dropdowns on outside click */
document.addEventListener('mousedown', (e) => {
  if (!e.target.closest('.dropdown-select')) {
    $$('.dropdown-select.open').forEach(d => d.classList.remove('open'));
  }
});

$('#brandToggle').addEventListener('click', () => toggleDropdown('brandDropdown'));
$('#modelToggle').addEventListener('click', () => toggleDropdown('modelDropdown'));

/* brand search */
$('#brandSearch').addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase();
  $$('#brandList .dropdown-item[data-brand-item]').forEach(el => {
    el.style.display = el.dataset.brandItem.toLowerCase().includes(q) ? '' : 'none';
  });
});

/* brand item click */
$('#brandList').addEventListener('click', (e) => {
  const item = e.target.closest('[data-brand-item]');
  if (!item) return;
  const b = item.dataset.brandItem;
  if (advancedFilters.brands.has(b)) {
    advancedFilters.brands.delete(b);
    advancedFilters.models.delete(b);
    item.classList.remove('selected');
  } else {
    advancedFilters.brands.add(b);
    item.classList.add('selected');
  }
  updateBrandToggleText();
  buildModelDropdown();
});

/* model item click */
$('#modelList').addEventListener('click', (e) => {
  const item = e.target.closest('[data-model-item]');
  if (!item) return;
  const brand = item.dataset.modelBrand;
  const model = item.dataset.modelItem;
  if (!advancedFilters.models.has(brand)) advancedFilters.models.set(brand, new Set());
  const mset = advancedFilters.models.get(brand);
  if (mset.has(model)) { mset.delete(model); item.classList.remove('selected'); }
  else { mset.add(model); item.classList.add('selected'); }
  if (mset.size === 0) advancedFilters.models.delete(brand);
  updateModelToggleText();
});

/* ===== IMAGE HELPERS ===== */
function carImage(car, size = 'card') {
  if (car.images && car.images.length > 0) {
    return `<img class="car-img" src="${car.images[0]}" alt="${car.title}" loading="lazy">`;
  }
  // fallback — первая буква марки
  return `<div class="car-placeholder">${car.title.charAt(0)}</div>`;
}

function carGallery(car) {
  if (!car.images || car.images.length === 0) {
    return `<div class="car-placeholder car-placeholder-lg">${car.title.charAt(0)}</div>`;
  }
  if (car.images.length === 1) {
    return `<img class="car-img" src="${car.images[0]}" alt="${car.title}">`;
  }
  // галерея с точками
  return `
    <div class="gallery" data-index="0">
      <div class="gallery-track">
        ${car.images.map((src, i) => `<img class="gallery-slide" src="${src}" alt="${car.title} фото ${i + 1}" loading="lazy">`).join('')}
      </div>
      <button class="gallery-arrow gallery-prev">‹</button>
      <button class="gallery-arrow gallery-next">›</button>
      <div class="gallery-dots">
        ${car.images.map((_, i) => `<span class="gallery-dot${i === 0 ? ' active' : ''}" data-slide="${i}"></span>`).join('')}
      </div>
    </div>`;
}

/* ===== RENDER CARDS ===== */
function renderCards() {
  let list = currentFilter === 'all'
    ? [...CARS]
    : CARS.filter(c => c.category === currentFilter);

  list = applyAdvancedFilters(list);
  list = applySorting(list);

  if (list.length === 0) {
    grid.innerHTML = '<div class="grid-empty">Нет авто по заданным параметрам</div>';
    return;
  }

  grid.innerHTML = list.map(car => {
    const isFav = favorites.includes(car.id);
    return `
      <div class="car-card reveal" data-id="${car.id}">
        <div class="card-media" data-open="modal">
          ${carImage(car)}
          <span class="card-badge">${car.tag}</span>
          <span class="card-price-tag">${car.price}</span>
          <button class="card-fav-btn${isFav ? ' active' : ''}" data-fav="${car.id}" title="В избранное">${isFav ? '♥' : '♡'}</button>
        </div>
        <div class="card-info">
          <div class="card-title">${car.title}</div>
          <div class="card-desc">${car.desc}</div>
          <div class="card-chips">
            <span class="card-chip">${car.specs.year}</span>
            <span class="card-chip">${car.specs.km} км</span>
            <span class="card-chip">${car.specs.engine}</span>
          </div>
        </div>
      </div>`;
  }).join('');

  observeReveals();
}

/* ===== MODAL ===== */
function openModal(carId) {
  const car = CARS.find(c => c.id === carId);
  if (!car) return;

  const isFav = favorites.includes(car.id);

  modalBody.innerHTML = `
    <div class="modal-media">
      ${carGallery(car)}
    </div>
    <div class="modal-title">${car.title}</div>
    <div class="modal-price">${car.price}</div>
    <div class="modal-desc">${car.desc}</div>
    <div class="modal-specs">
      <div class="spec-item"><div class="spec-label">Год</div><div class="spec-val">${car.specs.year}</div></div>
      <div class="spec-item"><div class="spec-label">Пробег</div><div class="spec-val">${car.specs.km} км</div></div>
      <div class="spec-item"><div class="spec-label">Двигатель</div><div class="spec-val">${car.specs.engine}</div></div>
      <div class="spec-item"><div class="spec-label">Привод</div><div class="spec-val">${car.specs.drive}</div></div>
    </div>
    <button class="btn btn-primary btn-full" data-fav-modal="${car.id}">
      ${isFav ? '♥ В избранном' : '♡ Добавить в избранное'}
    </button>
    ${car.message_id ? `<a href="${TG_CHANNEL}/${car.message_id}" class="btn btn-full" target="_blank" rel="noopener" style="margin-top:10px">Все фото в Telegram →</a>` : ''}
    <a href="${TG_CHANNEL}" class="btn btn-full" target="_blank" rel="noopener" style="margin-top:10px">Написать в Telegram →</a>
  `;

  modal.classList.add('open');
  modalBackdrop.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
}

function closeModal() {
  modal.classList.remove('open');
  modalBackdrop.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
}

/* ===== GALLERY NAV ===== */
document.addEventListener('click', (e) => {
  const gallery = e.target.closest('.gallery');
  if (!gallery) return;

  const track = gallery.querySelector('.gallery-track');
  const slides = gallery.querySelectorAll('.gallery-slide');
  const dots = gallery.querySelectorAll('.gallery-dot');
  let idx = parseInt(gallery.dataset.index) || 0;

  if (e.target.matches('.gallery-next')) {
    idx = (idx + 1) % slides.length;
  } else if (e.target.matches('.gallery-prev')) {
    idx = (idx - 1 + slides.length) % slides.length;
  } else if (e.target.matches('.gallery-dot')) {
    idx = parseInt(e.target.dataset.slide);
  } else return;

  gallery.dataset.index = idx;
  track.style.transform = `translateX(-${idx * 100}%)`;
  dots.forEach((d, i) => d.classList.toggle('active', i === idx));
});

/* ===== DRAWER ===== */
function openDrawer() {
  renderDrawer();
  drawer.classList.add('open');
  drawerBackdrop.classList.add('open');
  drawer.setAttribute('aria-hidden', 'false');
}

function closeDrawer() {
  drawer.classList.remove('open');
  drawerBackdrop.classList.remove('open');
  drawer.setAttribute('aria-hidden', 'true');
}

function renderDrawer() {
  if (favorites.length === 0) {
    drawerItems.innerHTML = '<div class="drawer-empty">Пусто — добавьте авто в избранное</div>';
    return;
  }

  drawerItems.innerHTML = favorites.map(id => {
    const car = CARS.find(c => c.id === id);
    if (!car) return '';
    const thumb = car.images && car.images[0]
      ? `<img class="drawer-item-thumb" src="${car.images[0]}" alt="${car.title}">`
      : `<div class="drawer-item-placeholder">${car.title.charAt(0)}</div>`;
    return `
      <div class="drawer-item">
        ${thumb}
        <div class="drawer-item-info">
          <div class="drawer-item-title">${car.title}</div>
          <div class="drawer-item-price">${car.price}</div>
        </div>
        <button class="drawer-item-remove" data-remove="${car.id}" title="Убрать">✕</button>
      </div>`;
  }).join('');
}

/* ===== FAVORITES ===== */
function toggleFav(carId) {
  const idx = favorites.indexOf(carId);
  if (idx === -1) favorites.push(carId);
  else favorites.splice(idx, 1);
  localStorage.setItem('auto_favs', JSON.stringify(favorites));
  updateFavCount();
  // update fav buttons without re-rendering
  const isFav = favorites.includes(carId);
  $$(`[data-fav="${carId}"]`).forEach(btn => {
    btn.textContent = isFav ? '♥' : '♡';
    btn.classList.toggle('active', isFav);
  });
}

function updateFavCount() {
  favCountEl.textContent = favorites.length;
}

function clearFavs() {
  favorites = [];
  localStorage.setItem('auto_favs', JSON.stringify(favorites));
  updateFavCount();
  renderCards();
  renderDrawer();
}

/* ===== FILTERS ===== */
function setFilter(filter) {
  currentFilter = filter;
  $$('.chip[data-filter]').forEach(c => c.classList.toggle('active', c.dataset.filter === filter));
  renderCards();
}

/* ===== ADVANCED FILTERS & SORTING ===== */
function applyAdvancedFilters(cars) {
  return cars.filter(car => {
    const brand = getBrand(car.title);
    const price = parsePrice(car.price);
    const year = parseInt(car.specs.year, 10);
    const km = parseKm(car.specs.km);
    const hp = parseHp(car.specs.engine);
    const drive = (car.specs.drive || '').trim();
    if (advancedFilters.brands.size > 0) {
      if (!advancedFilters.brands.has(brand)) return false;
      const selModels = advancedFilters.models.get(brand);
      if (selModels && selModels.size > 0) {
        if (!selModels.has(getModel(car.title))) return false;
      }
    }
    if (advancedFilters.priceMin !== null && price < advancedFilters.priceMin) return false;
    if (advancedFilters.priceMax !== null && price > advancedFilters.priceMax) return false;
    if (advancedFilters.yearMin !== null && year < advancedFilters.yearMin) return false;
    if (advancedFilters.yearMax !== null && year > advancedFilters.yearMax) return false;
    if (advancedFilters.kmMin !== null && km < advancedFilters.kmMin) return false;
    if (advancedFilters.kmMax !== null && km > advancedFilters.kmMax) return false;
    if (advancedFilters.hpMin !== null && hp > 0 && hp < advancedFilters.hpMin) return false;
    if (advancedFilters.hpMax !== null && hp > 0 && hp > advancedFilters.hpMax) return false;
    if (advancedFilters.drive.size > 0 && !advancedFilters.drive.has(drive)) return false;
    return true;
  });
}

function applySorting(cars) {
  if (currentSort === 'default') return cars;
  const cmp = {
    'price-asc':  (a, b) => parsePrice(a.price) - parsePrice(b.price),
    'price-desc': (a, b) => parsePrice(b.price) - parsePrice(a.price),
    'year-desc':  (a, b) => parseInt(b.specs.year, 10) - parseInt(a.specs.year, 10),
    'km-asc':     (a, b) => parseKm(a.specs.km) - parseKm(b.specs.km),
  };
  return cars.sort(cmp[currentSort]);
}

function setSort(sort) {
  currentSort = sort;
  $$('.sort-chip').forEach(c => c.classList.toggle('active', c.dataset.sort === sort));
  renderCards();
}

/* ===== FILTER PANEL ===== */
const filterPanel = $('#filterPanel');
const btnFilterPanel = $('#btnFilterPanel');

function toggleFilterPanel() {
  filterPanelOpen = !filterPanelOpen;
  filterPanel.classList.toggle('open', filterPanelOpen);
  filterPanel.setAttribute('aria-hidden', String(!filterPanelOpen));
  btnFilterPanel.classList.toggle('panel-open', filterPanelOpen);
}

function applyFilterPanel() {
  const pMin = $('#priceMin').value;
  const pMax = $('#priceMax').value;
  const yMin = $('#yearMin').value;
  const yMax = $('#yearMax').value;
  const kMin = $('#kmMin').value;
  const kMax = $('#kmMax').value;
  const hMin = $('#hpMin').value;
  const hMax = $('#hpMax').value;

  advancedFilters.priceMin = pMin ? parseInt(pMin, 10) : null;
  advancedFilters.priceMax = pMax ? parseInt(pMax, 10) : null;
  advancedFilters.yearMin  = yMin ? parseInt(yMin, 10) : null;
  advancedFilters.yearMax  = yMax ? parseInt(yMax, 10) : null;
  advancedFilters.kmMin    = kMin ? parseInt(kMin, 10) : null;
  advancedFilters.kmMax    = kMax ? parseInt(kMax, 10) : null;
  advancedFilters.hpMin    = hMin ? parseInt(hMin, 10) : null;
  advancedFilters.hpMax    = hMax ? parseInt(hMax, 10) : null;

  renderCards();
}

function resetFilterPanel() {
  advancedFilters = { brands: new Set(), models: new Map(), priceMin: null, priceMax: null, yearMin: null, yearMax: null, kmMin: null, kmMax: null, hpMin: null, hpMax: null, drive: new Set() };
  $('#priceMin').value = '';
  $('#priceMax').value = '';
  $('#yearMin').value = '';
  $('#yearMax').value = '';
  $('#kmMin').value = '';
  $('#kmMax').value = '';
  $('#hpMin').value = '';
  $('#hpMax').value = '';
  $$('[data-drive]').forEach(c => c.classList.toggle('active', c.dataset.drive === 'all'));
  buildBrandDropdown();
  $('#modelGroup').style.display = 'none';
  $('#modelList').innerHTML = '';
  renderCards();
}

/* ===== SCROLL REVEAL ===== */
function observeReveals() {
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });

  $$('.reveal:not(.visible)').forEach(el => obs.observe(el));
}

/* ===== THEME TOGGLE ===== */
$('#btnInvert').addEventListener('click', () => document.body.classList.toggle('invert'));

/* ===== EVENT DELEGATION ===== */
document.addEventListener('click', (e) => {
  const target = e.target;

  // sort chips
  if (target.matches('.sort-chip[data-sort]')) {
    setSort(target.dataset.sort);
    return;
  }

  // drive filter chips in advanced panel
  if (target.matches('[data-drive]')) {
    const drive = target.dataset.drive;
    if (drive === 'all') {
      advancedFilters.drive.clear();
    } else {
      if (advancedFilters.drive.has(drive)) advancedFilters.drive.delete(drive);
      else advancedFilters.drive.add(drive);
    }
    const hasAny = advancedFilters.drive.size > 0;
    $$('[data-drive]').forEach(c => {
      if (c.dataset.drive === 'all') c.classList.toggle('active', !hasAny);
      else c.classList.toggle('active', advancedFilters.drive.has(c.dataset.drive));
    });
    return;
  }

  // filter chips
  if (target.matches('.chip[data-filter]')) {
    setFilter(target.dataset.filter);
    return;
  }

  // fav button on card
  if (target.matches('[data-fav]')) {
    e.stopPropagation();
    toggleFav(target.dataset.fav);
    return;
  }

  // fav button in modal
  if (target.matches('[data-fav-modal]')) {
    toggleFav(target.dataset.favModal);
    openModal(target.dataset.favModal);
    return;
  }

  // open modal from card
  const card = target.closest('.car-card');
  if (card && !target.matches('[data-fav]')) {
    openModal(card.dataset.id);
    return;
  }

  // remove from drawer
  if (target.matches('[data-remove]')) {
    toggleFav(target.dataset.remove);
    renderDrawer();
    return;
  }
});

// fav drawer toggle
$('#btnFav').addEventListener('click', openDrawer);
$('#drawerClose').addEventListener('click', closeDrawer);
$('#drawerBackdrop').addEventListener('click', closeDrawer);
$('#btnClearFav').addEventListener('click', clearFavs);

// modal close
$('#modalClose').addEventListener('click', closeModal);
$('#modalBackdrop').addEventListener('click', closeModal);

// filter panel
btnFilterPanel.addEventListener('click', toggleFilterPanel);
$('#btnApplyFilters').addEventListener('click', applyFilterPanel);
$('#btnResetFilters').addEventListener('click', resetFilterPanel);

// escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal();
    closeDrawer();
    if (filterPanelOpen) toggleFilterPanel();
  }
});

/* ===== ADMIN CHECK ===== */
const ADMIN_IDS = [0];
const ADMIN_PASS = 'auto2026';
function checkAdmin() {
  const tg = window.Telegram?.WebApp;
  if (tg?.initDataUnsafe?.user?.id) {
    tg.ready();
    if (ADMIN_IDS.includes(tg.initDataUnsafe.user.id)) return true;
  }
  return localStorage.getItem('auto_admin') === ADMIN_PASS;
}

if (checkAdmin()) {
  const btn = document.getElementById('btnAdmin');
  if (btn) btn.style.display = '';
}

/* ===== INIT ===== */
loadCars();
