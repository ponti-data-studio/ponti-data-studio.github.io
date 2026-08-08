'use strict';

// ==========================================================
// IndexedDB
// ==========================================================

const DB_NAME = 'PromptLibraryDB';
const DB_VERSION = 1;
const STORE_NAME = 'prompts';

let dbInstance = null;

function initDB() {
  return new Promise((resolve, reject) => {
    if (dbInstance) return resolve(dbInstance);

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

async function getAllPrompts() {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

async function getPrompt(id) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

async function addPrompt(data) {
  const db = await initDB();
  const now = new Date().toISOString();
  const record = {
    id: generateId(),
    name: data.name,
    desc: data.desc,
    createdAt: now,
    updatedAt: now
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.add(record);
    request.onsuccess = () => resolve(record);
    request.onerror = () => reject(request.error);
  });
}

async function updatePrompt(id, data) {
  const db = await initDB();
  const existing = await getPrompt(id);
  if (!existing) throw new Error('Prompt tidak ditemukan');

  const record = {
    ...existing,
    name: data.name,
    desc: data.desc,
    updatedAt: new Date().toISOString()
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(record);
    request.onsuccess = () => resolve(record);
    request.onerror = () => reject(request.error);
  });
}

async function upsertPromptRaw(record) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(record);
    request.onsuccess = () => resolve(record);
    request.onerror = () => reject(request.error);
  });
}

async function deletePrompt(id) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}

async function clearPrompts() {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.clear();
    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}

function generateId() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

// ==========================================================
// State
// ==========================================================

const state = {
  prompts: [],       // all prompts, sorted updatedAt DESC
  searchQuery: '',
  editingId: null,    // id currently being edited, null = create mode
  pendingDeleteId: null
};

// ==========================================================
// DOM Elements
// ==========================================================

const el = {
  promptGrid: document.getElementById('promptGrid'),
  emptyState: document.getElementById('emptyState'),
  emptyStateTitle: document.getElementById('emptyStateTitle'),
  emptyStateDesc: document.getElementById('emptyStateDesc'),
  emptyStateAddBtn: document.getElementById('emptyStateAddBtn'),
  listCount: document.getElementById('listCount'),
  searchInput: document.getElementById('searchInput'),

  btnAddPrompt: document.getElementById('btnAddPrompt'),
  btnMenu: document.getElementById('btnMenu'),
  menuPopover: document.getElementById('menuPopover'),
  btnExport: document.getElementById('btnExport'),
  btnImport: document.getElementById('btnImport'),
  importFileInput: document.getElementById('importFileInput'),
  btnInstall: document.getElementById('btnInstall'),

  formModalOverlay: document.getElementById('formModalOverlay'),
  formModalTitle: document.getElementById('formModalTitle'),
  formModalClose: document.getElementById('formModalClose'),
  promptForm: document.getElementById('promptForm'),
  fieldName: document.getElementById('fieldName'),
  fieldDesc: document.getElementById('fieldDesc'),
  errorName: document.getElementById('errorName'),
  errorDesc: document.getElementById('errorDesc'),
  formCancelBtn: document.getElementById('formCancelBtn'),
  formSaveBtn: document.getElementById('formSaveBtn'),

  detailModalOverlay: document.getElementById('detailModalOverlay'),
  detailModalTitle: document.getElementById('detailModalTitle'),
  detailModalMeta: document.getElementById('detailModalMeta'),
  detailModalText: document.getElementById('detailModalText'),
  detailModalClose: document.getElementById('detailModalClose'),
  detailCopyBtn: document.getElementById('detailCopyBtn'),
  detailEditBtn: document.getElementById('detailEditBtn'),
  detailDeleteBtn: document.getElementById('detailDeleteBtn'),

  confirmModalOverlay: document.getElementById('confirmModalOverlay'),
  confirmModalName: document.getElementById('confirmModalName'),
  confirmCancelBtn: document.getElementById('confirmCancelBtn'),
  confirmDeleteBtn: document.getElementById('confirmDeleteBtn'),

  iosHintOverlay: document.getElementById('iosHintOverlay'),
  iosHintCloseBtn: document.getElementById('iosHintCloseBtn'),

  toastContainer: document.getElementById('toastContainer')
};

// ==========================================================
// CRUD (orchestration layer between UI and DB)
// ==========================================================

async function loadPrompts() {
  const all = await getAllPrompts();
  all.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  state.prompts = all;
  renderList();
}

async function createPromptFromForm(name, desc) {
  await addPrompt({ name, desc });
  await loadPrompts();
}

async function updatePromptFromForm(id, name, desc) {
  await updatePrompt(id, { name, desc });
  await loadPrompts();
}

async function removePrompt(id) {
  await deletePrompt(id);
  await loadPrompts();
}

// ==========================================================
// Rendering
// ==========================================================

function getFilteredPrompts() {
  const q = state.searchQuery.trim().toLowerCase();
  if (!q) return state.prompts;
  return state.prompts.filter(p =>
    p.name.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q)
  );
}

function renderList() {
  const list = getFilteredPrompts();
  const hasAnyPrompts = state.prompts.length > 0;
  const q = state.searchQuery.trim();

  el.promptGrid.innerHTML = '';

  if (!hasAnyPrompts) {
    el.emptyState.hidden = false;
    el.emptyStateTitle.textContent = 'Belum ada prompt';
    el.emptyStateDesc.textContent = 'Mulai buat prompt pertama kamu.';
    el.emptyStateAddBtn.hidden = false;
    el.listCount.textContent = '';
    return;
  }

  if (list.length === 0) {
    el.emptyState.hidden = false;
    el.emptyStateTitle.textContent = 'Tidak ada prompt ditemukan';
    el.emptyStateDesc.textContent = `Tidak ada hasil untuk "${q}".`;
    el.emptyStateAddBtn.hidden = true;
    el.listCount.textContent = '';
    return;
  }

  el.emptyState.hidden = true;
  el.listCount.textContent = q
    ? `${list.length} hasil ditemukan`
    : `${list.length} prompt tersimpan`;

  const fragment = document.createDocumentFragment();
  list.forEach(prompt => {
    fragment.appendChild(buildPromptCard(prompt));
  });
  el.promptGrid.appendChild(fragment);
}

function buildPromptCard(prompt) {
  const card = document.createElement('article');
  card.className = 'prompt-card';
  card.setAttribute('role', 'listitem');
  card.tabIndex = 0;
  card.dataset.id = prompt.id;

  const name = document.createElement('h3');
  name.className = 'prompt-card__name';
  name.textContent = prompt.name; // textContent only -> no XSS

  const preview = document.createElement('p');
  preview.className = 'prompt-card__preview';
  preview.textContent = prompt.desc; // textContent only -> no XSS

  const footer = document.createElement('div');
  footer.className = 'prompt-card__footer';

  const date = document.createElement('span');
  date.className = 'prompt-card__date';
  date.textContent = formatRelativeDate(prompt.updatedAt);

  const actions = document.createElement('div');
  actions.className = 'prompt-card__actions';

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'card-action-btn card-action-btn--copy';
  copyBtn.setAttribute('aria-label', 'Copy prompt');
  copyBtn.title = 'Copy';
  copyBtn.innerHTML = copyIconSvg();

  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.className = 'card-action-btn card-action-btn--edit';
  editBtn.setAttribute('aria-label', 'Edit prompt');
  editBtn.title = 'Edit';
  editBtn.innerHTML = editIconSvg();

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'card-action-btn card-action-btn--danger';
  deleteBtn.setAttribute('aria-label', 'Hapus prompt');
  deleteBtn.title = 'Hapus';
  deleteBtn.innerHTML = deleteIconSvg();

  copyBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    copyPromptToClipboard(prompt, copyBtn);
  });
  editBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openFormModal(prompt);
  });
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openConfirmDelete(prompt);
  });

  actions.append(copyBtn, editBtn, deleteBtn);
  footer.append(date, actions);
  card.append(name, preview, footer);

  card.addEventListener('click', () => openDetailModal(prompt.id));
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openDetailModal(prompt.id);
    }
  });

  return card;
}

function formatRelativeDate(isoString) {
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '';
  const now = new Date();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return 'Baru saja';
  if (diffMin < 60) return `${diffMin} menit lalu`;
  if (diffHour < 24) return `${diffHour} jam lalu`;
  if (diffDay < 7) return `${diffDay} hari lalu`;

  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function copyIconSvg() {
  return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="8" y="8" width="12" height="12" rx="1.6" stroke="currentColor" stroke-width="1.6"/><path d="M16 8V5.6A1.6 1.6 0 0 0 14.4 4H5.6A1.6 1.6 0 0 0 4 5.6v8.8A1.6 1.6 0 0 0 5.6 16H8" stroke="currentColor" stroke-width="1.6"/></svg>';
}
function editIconSvg() {
  return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>';
}
function deleteIconSvg() {
  return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 7h14M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0v12a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}

// ==========================================================
// Modal — Add / Edit Form
// ==========================================================

function openFormModal(prompt) {
  closeDetailModal();
  state.editingId = prompt ? prompt.id : null;

  el.formModalTitle.textContent = prompt ? 'Edit Prompt' : 'Tambah Prompt';
  el.fieldName.value = prompt ? prompt.name : '';
  el.fieldDesc.value = prompt ? prompt.desc : '';
  clearFormErrors();

  el.formModalOverlay.hidden = false;
  document.body.style.overflow = 'hidden';
  setTimeout(() => el.fieldName.focus(), 50);
}

function closeFormModal() {
  el.formModalOverlay.hidden = true;
  state.editingId = null;
  el.promptForm.reset();
  clearFormErrors();
  restoreBodyScroll();
}

function clearFormErrors() {
  el.errorName.hidden = true;
  el.errorDesc.hidden = true;
  el.fieldName.classList.remove('is-invalid');
  el.fieldDesc.classList.remove('is-invalid');
}

async function handleFormSubmit(e) {
  e.preventDefault();
  const name = el.fieldName.value.trim();
  const desc = el.fieldDesc.value; // preserve whitespace/line breaks intact

  let valid = true;
  clearFormErrors();

  if (!name) {
    el.errorName.hidden = false;
    el.fieldName.classList.add('is-invalid');
    valid = false;
  }
  if (!desc.trim()) {
    el.errorDesc.hidden = false;
    el.fieldDesc.classList.add('is-invalid');
    valid = false;
  }
  if (!valid) return;

  el.formSaveBtn.disabled = true;
  try {
    if (state.editingId) {
      await updatePromptFromForm(state.editingId, name, desc);
      showToast('Prompt berhasil diperbarui.', 'success');
    } else {
      await createPromptFromForm(name, desc);
      showToast('Prompt berhasil disimpan.', 'success');
    }
    closeFormModal();
  } catch (err) {
    console.error(err);
    showToast('Terjadi kesalahan. Coba lagi.', 'error');
  } finally {
    el.formSaveBtn.disabled = false;
  }
}

// ==========================================================
// Modal — Detail
// ==========================================================

let currentDetailPrompt = null;

async function openDetailModal(id) {
  const prompt = await getPrompt(id);
  if (!prompt) return;
  currentDetailPrompt = prompt;

  el.detailModalTitle.textContent = prompt.name;
  el.detailModalText.textContent = prompt.desc;
  el.detailModalMeta.textContent = `Diperbarui ${formatRelativeDate(prompt.updatedAt)}`;

  el.detailModalOverlay.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeDetailModal() {
  el.detailModalOverlay.hidden = true;
  currentDetailPrompt = null;
  restoreBodyScroll();
}

// ==========================================================
// Confirm Delete
// ==========================================================

function openConfirmDelete(prompt) {
  state.pendingDeleteId = prompt.id;
  el.confirmModalName.textContent = prompt.name;
  el.confirmModalOverlay.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeConfirmDelete() {
  el.confirmModalOverlay.hidden = true;
  state.pendingDeleteId = null;
  restoreBodyScroll();
}

async function handleConfirmDelete() {
  const id = state.pendingDeleteId;
  if (!id) return;
  try {
    await removePrompt(id);
    showToast('Prompt berhasil dihapus.', 'success');
  } catch (err) {
    console.error(err);
    showToast('Gagal menghapus prompt.', 'error');
  } finally {
    closeConfirmDelete();
    if (currentDetailPrompt && currentDetailPrompt.id === id) {
      closeDetailModal();
    }
  }
}

function restoreBodyScroll() {
  const anyOpen = !el.formModalOverlay.hidden ||
    !el.detailModalOverlay.hidden ||
    !el.confirmModalOverlay.hidden ||
    !el.iosHintOverlay.hidden;
  if (!anyOpen) document.body.style.overflow = '';
}

// ==========================================================
// Clipboard
// ==========================================================

async function copyPromptToClipboard(prompt, triggerBtn) {
  try {
    await writeToClipboard(prompt.desc);
    showToast('Prompt berhasil disalin.', 'success');
    if (triggerBtn) flashCopiedState(triggerBtn);
  } catch (err) {
    console.error(err);
    showToast('Gagal menyalin prompt.', 'error');
  }
}

async function writeToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }
  // fallback for non-secure contexts / older browsers
  return new Promise((resolve, reject) => {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      ok ? resolve() : reject(new Error('execCommand copy failed'));
    } catch (err) {
      reject(err);
    }
  });
}

function flashCopiedState(btn) {
  btn.classList.add('is-copied');
  const original = btn.innerHTML;
  btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 12.5 9.5 17 19 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  setTimeout(() => {
    btn.classList.remove('is-copied');
    btn.innerHTML = original;
  }, 1400);
}

// ==========================================================
// Search
// ==========================================================

let searchDebounceTimer = null;
function handleSearchInput(e) {
  const value = e.target.value;
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    state.searchQuery = value;
    renderList();
  }, 120);
}

// ==========================================================
// Import / Export
// ==========================================================

function handleExport() {
  closeMenuPopover();
  getAllPrompts().then(all => {
    const json = JSON.stringify(all, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'prompt-library-backup.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Backup berhasil diunduh.', 'success');
  }).catch(err => {
    console.error(err);
    showToast('Gagal membuat backup.', 'error');
  });
}

function handleImportClick() {
  closeMenuPopover();
  el.importFileInput.value = '';
  el.importFileInput.click();
}

async function handleImportFileSelected(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const data = JSON.parse(text);

    if (!Array.isArray(data)) throw new Error('invalid structure');

    let importedCount = 0;
    for (const item of data) {
      if (!item || typeof item !== 'object') continue;
      if (typeof item.name !== 'string' || typeof item.desc !== 'string') continue;

      const now = new Date().toISOString();
      const record = {
        id: typeof item.id === 'string' && item.id ? item.id : generateId(),
        name: item.name,
        desc: item.desc,
        createdAt: typeof item.createdAt === 'string' ? item.createdAt : now,
        updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : now
      };
      await upsertPromptRaw(record); // ID sama -> update, ID baru -> insert
      importedCount++;
    }

    if (importedCount === 0) throw new Error('no valid records');

    await loadPrompts();
    showToast('Data berhasil diimport.', 'success');
  } catch (err) {
    console.error(err);
    showToast('File backup tidak valid.', 'error');
  }
}

// ==========================================================
// Menu Popover
// ==========================================================

function toggleMenuPopover() {
  const isHidden = el.menuPopover.hidden;
  el.menuPopover.hidden = !isHidden;
  el.btnMenu.setAttribute('aria-expanded', String(isHidden));
}
function closeMenuPopover() {
  el.menuPopover.hidden = true;
  el.btnMenu.setAttribute('aria-expanded', 'false');
}

// ==========================================================
// Toast
// ==========================================================

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.setAttribute('role', 'status');

  const icon = type === 'success'
    ? '<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M5 12.5 9.5 17 19 7" stroke="#5FA8A0" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    : '<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#E08585" stroke-width="1.8"/><path d="M12 8v5M12 16h.01" stroke="#E08585" stroke-width="1.8" stroke-linecap="round"/></svg>';

  toast.innerHTML = icon;
  const text = document.createElement('span');
  text.textContent = message;
  toast.appendChild(text);

  el.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('is-leaving');
    setTimeout(() => toast.remove(), 200);
  }, 2600);
}

// ==========================================================
// PWA (install prompt)
// ==========================================================

let deferredInstallPrompt = null;

function isStandaloneMode() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function setupInstallExperience() {
  if (isStandaloneMode()) {
    el.btnInstall.hidden = true;
    return;
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    el.btnInstall.hidden = false;
  });

  window.addEventListener('appinstalled', () => {
    el.btnInstall.hidden = true;
    deferredInstallPrompt = null;
    showToast('Aplikasi berhasil diinstall.', 'success');
  });

  // iOS Safari doesn't support beforeinstallprompt — show manual instructions button instead
  if (isIOS() && !isStandaloneMode()) {
    el.btnInstall.hidden = false;
  }
}

async function handleInstallClick() {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    if (outcome === 'accepted') {
      el.btnInstall.hidden = true;
    }
    deferredInstallPrompt = null;
    return;
  }

  if (isIOS()) {
    el.iosHintOverlay.hidden = false;
    document.body.style.overflow = 'hidden';
    return;
  }

  showToast('Install belum tersedia di browser ini.', 'error');
}

// ==========================================================
// Service Worker
// ==========================================================

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(err => {
      console.error('Service worker registration failed:', err);
    });
  });
}

// ==========================================================
// Event Listeners
// ==========================================================

function bindEventListeners() {
  el.btnAddPrompt.addEventListener('click', () => openFormModal(null));
  el.emptyStateAddBtn.addEventListener('click', () => openFormModal(null));

  el.formModalClose.addEventListener('click', closeFormModal);
  el.formCancelBtn.addEventListener('click', closeFormModal);
  el.formModalOverlay.addEventListener('click', (e) => {
    if (e.target === el.formModalOverlay) closeFormModal();
  });
  el.promptForm.addEventListener('submit', handleFormSubmit);

  el.detailModalClose.addEventListener('click', closeDetailModal);
  el.detailModalOverlay.addEventListener('click', (e) => {
    if (e.target === el.detailModalOverlay) closeDetailModal();
  });
  el.detailCopyBtn.addEventListener('click', () => {
    if (currentDetailPrompt) copyPromptToClipboard(currentDetailPrompt, el.detailCopyBtn);
  });
  el.detailEditBtn.addEventListener('click', () => {
    if (currentDetailPrompt) openFormModal(currentDetailPrompt);
  });
  el.detailDeleteBtn.addEventListener('click', () => {
    if (currentDetailPrompt) openConfirmDelete(currentDetailPrompt);
  });

  el.confirmCancelBtn.addEventListener('click', closeConfirmDelete);
  el.confirmDeleteBtn.addEventListener('click', handleConfirmDelete);
  el.confirmModalOverlay.addEventListener('click', (e) => {
    if (e.target === el.confirmModalOverlay) closeConfirmDelete();
  });

  el.iosHintCloseBtn.addEventListener('click', () => {
    el.iosHintOverlay.hidden = true;
    restoreBodyScroll();
  });
  el.iosHintOverlay.addEventListener('click', (e) => {
    if (e.target === el.iosHintOverlay) {
      el.iosHintOverlay.hidden = true;
      restoreBodyScroll();
    }
  });

  el.searchInput.addEventListener('input', handleSearchInput);

  el.btnMenu.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMenuPopover();
  });
  document.addEventListener('click', (e) => {
    if (!el.menuPopover.hidden && !el.menuPopover.contains(e.target) && e.target !== el.btnMenu) {
      closeMenuPopover();
    }
  });
  el.btnExport.addEventListener('click', handleExport);
  el.btnImport.addEventListener('click', handleImportClick);
  el.importFileInput.addEventListener('change', handleImportFileSelected);

  el.btnInstall.addEventListener('click', handleInstallClick);

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!el.confirmModalOverlay.hidden) closeConfirmDelete();
    else if (!el.formModalOverlay.hidden) closeFormModal();
    else if (!el.detailModalOverlay.hidden) closeDetailModal();
    else if (!el.iosHintOverlay.hidden) { el.iosHintOverlay.hidden = true; restoreBodyScroll(); }
    else if (!el.menuPopover.hidden) closeMenuPopover();
  });
}

// ==========================================================
// Init
// ==========================================================

async function init() {
  bindEventListeners();
  setupInstallExperience();
  registerServiceWorker();

  try {
    await loadPrompts();
  } catch (err) {
    console.error('Gagal memuat data:', err);
    showToast('Gagal memuat data prompt.', 'error');
  }
}

document.addEventListener('DOMContentLoaded', init);
