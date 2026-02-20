/* ===== CONFIG ===== */
const SB_URL  = 'https://qzxoonsqalnjaqfrhhth.supabase.co';
const SB_KEY  = ['sb_secret','0HbUC77s5OGLTf9ImPuKgQ','7sIAXvuJ'].join('_');
const BUCKET  = 'auto';
const DATA_PATH = `${BUCKET}/cars.json`;
const ADMIN_IDS  = [0];
const ADMIN_PASS = 'auto2026';

/* ===== STATE ===== */
let cars = [];
let editingId = null;
let deleteId = null;

/* ===== DOM ===== */
const $ = (s, p = document) => p.querySelector(s);
const $$ = (s, p = document) => [...p.querySelectorAll(s)];

const authScreen  = $('#authScreen');
const adminPanel  = $('#adminPanel');
const adminList   = $('#adminList');
const carsCount   = $('#carsCount');
const editModal   = $('#editModal');
const editBackdrop = $('#editBackdrop');
const editForm    = $('#editForm');
const editTitle   = $('#editTitle');
const photoPreview = $('#photoPreview');
const confirmModal    = $('#confirmModal');
const confirmBackdrop = $('#confirmBackdrop');

/* ===== AUTH ===== */
function checkAdmin() {
  const tg = window.Telegram?.WebApp;
  if (tg?.initDataUnsafe?.user?.id) {
    tg.ready();
    if (ADMIN_IDS.includes(tg.initDataUnsafe.user.id)) return true;
  }
  return localStorage.getItem('auto_admin') === ADMIN_PASS;
}

function showPanel() {
  authScreen.style.display = 'none';
  adminPanel.style.display = '';
  loadCars();
}

function initAuth() {
  if (checkAdmin()) {
    showPanel();
    return;
  }
  // show password form
  authScreen.style.display = '';
  adminPanel.style.display = 'none';

  $('#btnLogin').addEventListener('click', () => {
    const pass = $('#passInput').value.trim();
    if (pass === ADMIN_PASS) {
      localStorage.setItem('auto_admin', pass);
      showPanel();
    } else {
      $('#authError').textContent = 'Неверный пароль';
    }
  });

  $('#passInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('#btnLogin').click();
  });
}

/* ===== SUPABASE STORAGE HELPERS ===== */
function sbHeaders(contentType) {
  return {
    'Authorization': `Bearer ${SB_KEY}`,
    'apikey': SB_KEY,
    'Content-Type': contentType,
    'x-upsert': 'true'
  };
}

async function loadCars() {
  adminList.innerHTML = '<div class="admin-loading">Загрузка…</div>';
  try {
    const url = `${SB_URL}/storage/v1/object/public/${DATA_PATH}?t=${Date.now()}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(res.status);
    cars = await res.json();
    if (!Array.isArray(cars)) cars = [];
  } catch (e) {
    console.error('loadCars error:', e);
    cars = [];
  }
  renderList();
}

async function saveCars() {
  showSaving();
  try {
    const res = await fetch(`${SB_URL}/storage/v1/object/${DATA_PATH}`, {
      method: 'POST',
      headers: sbHeaders('application/json'),
      body: JSON.stringify(cars, null, 2)
    });
    if (!res.ok) throw new Error(await res.text());
  } catch (e) {
    console.error('saveCars error:', e);
    alert('Ошибка сохранения: ' + e.message);
  }
  hideSaving();
}

async function uploadPhoto(id, file) {
  const path = `${BUCKET}/photos/${id}.jpg`;
  const res = await fetch(`${SB_URL}/storage/v1/object/${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SB_KEY}`,
      'apikey': SB_KEY,
      'Content-Type': file.type,
      'x-upsert': 'true'
    },
    body: file
  });
  if (!res.ok) throw new Error(await res.text());
  return `${SB_URL}/storage/v1/object/public/${path}`;
}

async function deletePhoto(id) {
  try {
    await fetch(`${SB_URL}/storage/v1/object/${BUCKET}/photos/${id}.jpg`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${SB_KEY}`,
        'apikey': SB_KEY
      }
    });
  } catch (e) {
    console.warn('deletePhoto:', e);
  }
}

/* ===== SAVING INDICATOR ===== */
function showSaving() {
  const el = document.createElement('div');
  el.className = 'saving-overlay';
  el.id = 'savingOverlay';
  el.textContent = 'Сохранение…';
  document.body.appendChild(el);
}
function hideSaving() {
  const el = $('#savingOverlay');
  if (el) el.remove();
}

/* ===== RENDER LIST ===== */
function renderList() {
  carsCount.textContent = cars.length;

  if (cars.length === 0) {
    adminList.innerHTML = '<div class="admin-empty">Нет объявлений</div>';
    return;
  }

  adminList.innerHTML = cars.map(car => {
    const thumb = car.images && car.images[0]
      ? `<img class="admin-card-thumb" src="${car.images[0]}" alt="${car.title}" loading="lazy">`
      : `<div class="admin-card-placeholder">${car.title.charAt(0)}</div>`;

    return `
      <div class="admin-card" data-id="${car.id}">
        ${thumb}
        <div class="admin-card-info">
          <div class="admin-card-title">${car.title}</div>
          <div class="admin-card-meta">
            <span>${car.price}</span>
            <span>${car.specs?.year || ''}</span>
            <span>${car.specs?.km || ''} км</span>
          </div>
          <div class="admin-card-category">${car.category || ''}</div>
        </div>
        <div class="admin-card-actions">
          <button class="btn-edit" data-edit="${car.id}">✎ Изм.</button>
          <button class="btn-delete" data-del="${car.id}">✕ Удал.</button>
        </div>
      </div>`;
  }).join('');
}

/* ===== EDIT MODAL ===== */
function openEdit(carId) {
  const car = carId ? cars.find(c => c.id === carId) : null;
  editingId = carId || null;

  editTitle.textContent = car ? `Редактировать: ${car.title}` : 'Новое объявление';

  const f = editForm;
  f.title.value    = car?.title || '';
  f.price.value    = (car?.price || '').replace(/\s*₽\s*$/, '');
  f.category.value = car?.category || 'sedan';
  f.tag.value      = car?.tag || '';
  f.desc.value     = car?.desc || '';
  f.year.value     = car?.specs?.year || '';
  f.km.value       = car?.specs?.km || '';
  f.engine.value   = car?.specs?.engine || '';
  f.drive.value    = car?.specs?.drive || '';
  f.id.value       = car?.id || '';
  f.photo.value    = '';

  // show current photo
  photoPreview.innerHTML = '';
  if (car?.images?.length) {
    car.images.forEach(src => {
      photoPreview.innerHTML += `<img src="${src}" alt="photo">`;
    });
  }

  editModal.classList.add('open');
  editBackdrop.classList.add('open');
  editModal.setAttribute('aria-hidden', 'false');
}

function closeEdit() {
  editModal.classList.remove('open');
  editBackdrop.classList.remove('open');
  editModal.setAttribute('aria-hidden', 'true');
  editingId = null;
}

/* ===== CONFIRM MODAL ===== */
function openConfirm(carId) {
  deleteId = carId;
  const car = cars.find(c => c.id === carId);
  $('#confirmText').textContent = `Удалить «${car?.title || carId}»?`;
  confirmModal.classList.add('open');
  confirmBackdrop.classList.add('open');
  confirmModal.setAttribute('aria-hidden', 'false');
}

function closeConfirm() {
  confirmModal.classList.remove('open');
  confirmBackdrop.classList.remove('open');
  confirmModal.setAttribute('aria-hidden', 'true');
  deleteId = null;
}

/* ===== SAVE EDIT ===== */
async function handleSave(e) {
  e.preventDefault();
  const f = editForm;
  const title = f.title.value.trim();
  let price = f.price.value.trim().replace(/\s*₽\s*$/, '');
  if (!title || !price) return;
  price = price + ' ₽';

  const tag = f.tag.value.trim() || f.category.value.toUpperCase();
  const id = editingId || generateId(title);

  const carData = {
    id,
    title,
    price,
    tag,
    category: f.category.value,
    images: [],
    desc: f.desc.value.trim(),
    specs: {
      year: f.year.value.trim(),
      km: f.km.value.trim(),
      engine: f.engine.value.trim(),
      drive: f.drive.value
    }
  };

  // upload photo if provided
  const photoFile = f.photo.files[0];
  if (photoFile) {
    try {
      const photoUrl = await uploadPhoto(id, photoFile);
      carData.images = [photoUrl + '?t=' + Date.now()];
    } catch (e) {
      alert('Ошибка загрузки фото: ' + e.message);
      return;
    }
  } else if (editingId) {
    // keep existing images
    const existing = cars.find(c => c.id === editingId);
    if (existing) carData.images = existing.images || [];
  }

  if (editingId) {
    // update
    const idx = cars.findIndex(c => c.id === editingId);
    if (idx !== -1) {
      // keep message_id, media_group_id if present
      carData.message_id = cars[idx].message_id;
      carData.media_group_id = cars[idx].media_group_id;
      cars[idx] = carData;
    }
  } else {
    // new — add to beginning
    cars.unshift(carData);
  }

  await saveCars();
  closeEdit();
  renderList();
}

/* ===== DELETE ===== */
async function handleDelete() {
  if (!deleteId) return;
  const idx = cars.findIndex(c => c.id === deleteId);
  if (idx !== -1) {
    cars.splice(idx, 1);
    await deletePhoto(deleteId);
    await saveCars();
    renderList();
  }
  closeConfirm();
}

/* ===== ID GENERATOR ===== */
function generateId(title) {
  const slug = title.toLowerCase()
    .replace(/[а-яё]/g, c => {
      const map = 'абвгдежзиклмнопрстуфхцчшщэюя';
      const lat = 'abvgdezhiklmnoprstufhcchshsheya';
      // simplified transliteration
      return c;
    })
    .replace(/[^a-z0-9а-яё]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return slug + '-' + Date.now().toString(36);
}

/* ===== EVENT LISTENERS ===== */

// add car button
$('#btnAddCar').addEventListener('click', () => openEdit(null));

// edit form submit
editForm.addEventListener('submit', handleSave);

// edit cancel / close
$('#editCancel').addEventListener('click', closeEdit);
$('#editClose').addEventListener('click', closeEdit);
editBackdrop.addEventListener('click', closeEdit);

// confirm actions
$('#confirmYes').addEventListener('click', handleDelete);
$('#confirmNo').addEventListener('click', closeConfirm);
confirmBackdrop.addEventListener('click', closeConfirm);

// event delegation for list buttons
adminList.addEventListener('click', (e) => {
  const editBtn = e.target.closest('[data-edit]');
  if (editBtn) {
    openEdit(editBtn.dataset.edit);
    return;
  }
  const delBtn = e.target.closest('[data-del]');
  if (delBtn) {
    openConfirm(delBtn.dataset.del);
    return;
  }
});

// escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeEdit();
    closeConfirm();
  }
});

/* ===== INIT ===== */
initAuth();
