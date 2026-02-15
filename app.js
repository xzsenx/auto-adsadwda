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
  updateFavCount();
  renderCards();
  observeReveals();
}

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
  const filtered = currentFilter === 'all'
    ? CARS
    : CARS.filter(c => c.category === currentFilter);

  if (filtered.length === 0) {
    grid.innerHTML = '<div class="grid-empty">Нет авто в этой категории</div>';
    return;
  }

  grid.innerHTML = filtered.map(car => {
    const isFav = favorites.includes(car.id);
    return `
      <div class="car-card reveal" data-id="${car.id}">
        <div class="card-media" data-open="modal">
          ${carImage(car)}
          <span class="card-badge">${car.tag}</span>
          <span class="card-price-tag">${car.price}</span>
        </div>
        <div class="card-info">
          <div class="card-title">${car.title}</div>
          <div class="card-desc">${car.desc}</div>
          <div class="card-chips">
            <span class="card-chip">${car.specs.year}</span>
            <span class="card-chip">${car.specs.km} км</span>
            <span class="card-chip">${car.specs.engine}</span>
            <button class="card-chip fav-chip" data-fav="${car.id}" title="В избранное">${isFav ? '♥' : '♡'}</button>
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
  renderCards();
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
  $$('.chip').forEach(c => c.classList.toggle('active', c.dataset.filter === filter));
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

// escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal();
    closeDrawer();
  }
});

/* ===== INIT ===== */
loadCars();
