const state = {
  items: [],
  machineKits: [],
  historyItemId: null,
  draftImageData: '',
  draftImagePreviewData: '',
  draftImageChanged: false,
  draftImageLoadToken: 0,
  thumbnailLoadIds: new Set(),
  draftMachines: [],
  draftMachineKitComponents: [],
  draftMachineKitImageData: '',
  draftMachineKitImagePreviewData: '',
  draftMachineKitImageChanged: false,
  scanTarget: null,
  scannerStream: null,
  scannerRafId: null,
  scannerDetector: null,
  scannerRunning: false,
  scannerLastValue: '',
  scannerLastScanAt: 0,
  settings: {
    companyName: 'CWT Inventory',
    lastAutoBackupDate: ''
  },
  toastTimer: null
};

const elements = {};
const IMAGE_PROCESS_MAX_SIDE = 1600;
const IMAGE_PROCESS_PREVIEW_SIDE = 320;
const IMAGE_PROCESS_QUALITY = 0.78;
const IMAGE_PROCESS_PREVIEW_QUALITY = 0.72;
const ITEMS_CACHE_KEY = 'cwt-items-cache-v1';

document.addEventListener('DOMContentLoaded', () => {
  cacheElements();
  bindEvents();
  bindIpc();
  hydrateItemsFromCache();
  window.inventoryAPI.getItems();
  if (typeof window.inventoryAPI.getMachineKits === 'function') {
    window.inventoryAPI.getMachineKits();
  }
  loadAppSettings();
});

function cacheElements() {
  elements.inventoryTitle = document.getElementById('inventory-title');
  elements.hardRefreshBtn = document.getElementById('hard-refresh-btn');
  elements.backupNowBtn = document.getElementById('backup-now-btn');
  elements.openSettingsBtn = document.getElementById('open-settings-btn');
  elements.openMachineModalBtn = document.getElementById('open-machine-modal-btn');
  elements.searchInput = document.getElementById('search-input');
  elements.scanSearchBtn = document.getElementById('scan-search-btn');
  elements.lowStockOnly = document.getElementById('low-stock-only');
  elements.stats = document.getElementById('stats');
  elements.itemsBody = document.getElementById('items-body');
  elements.emptyState = document.getElementById('empty-state');

  elements.itemModal = document.getElementById('item-modal');
  elements.itemModalTitle = document.getElementById('item-modal-title');
  elements.itemForm = document.getElementById('item-form');
  elements.itemFormSubmit = elements.itemForm.querySelector('button[type="submit"]');
  elements.itemId = document.getElementById('item-id');
  elements.itemName = document.getElementById('item-name');
  elements.itemSku = document.getElementById('item-sku');
  elements.scanSkuBtn = document.getElementById('scan-sku-btn');
  elements.itemCategory = document.getElementById('item-category');
  elements.itemLocation = document.getElementById('item-location');
  elements.itemSourceUrl = document.getElementById('item-source-url');
  elements.machineInput = document.getElementById('machine-input');
  elements.addMachineBtn = document.getElementById('add-machine-btn');
  elements.machineList = document.getElementById('machine-list');
  elements.itemQuantity = document.getElementById('item-quantity');
  elements.itemReorderLevel = document.getElementById('item-reorder-level');
  elements.itemUnitPrice = document.getElementById('item-unit-price');
  elements.itemNotes = document.getElementById('item-notes');
  elements.itemImageInput = document.getElementById('item-image-input');
  elements.itemImageCameraInput = document.getElementById('item-image-camera-input');
  elements.takePhotoBtn = document.getElementById('take-photo-btn');
  elements.choosePhotoBtn = document.getElementById('choose-photo-btn');
  elements.itemImagePreviewWrap = document.getElementById('item-image-preview-wrap');
  elements.itemImagePreview = document.getElementById('item-image-preview');
  elements.clearItemImageBtn = document.getElementById('clear-item-image-btn');

  elements.stockModal = document.getElementById('stock-modal');
  elements.stockForm = document.getElementById('stock-form');
  elements.stockItemName = document.getElementById('stock-item-name');
  elements.stockItemId = document.getElementById('stock-item-id');
  elements.stockType = document.getElementById('stock-type');
  elements.stockQuantity = document.getElementById('stock-quantity');
  elements.stockReason = document.getElementById('stock-reason');

  elements.historyModal = document.getElementById('history-modal');
  elements.historyTitle = document.getElementById('history-title');
  elements.historyList = document.getElementById('history-list');
  elements.scannerModal = document.getElementById('scanner-modal');
  elements.scannerVideo = document.getElementById('scanner-video');
  elements.scannerStatus = document.getElementById('scanner-status');
  elements.scannerStartBtn = document.getElementById('scanner-start-btn');
  elements.scannerStopBtn = document.getElementById('scanner-stop-btn');
  elements.settingsModal = document.getElementById('settings-modal');
  elements.settingsForm = document.getElementById('settings-form');
  elements.companyNameInput = document.getElementById('company-name-input');
  elements.openBackupsFolderBtn = document.getElementById('open-backups-folder-btn');
  elements.refreshItemsBtn = document.getElementById('refresh-items-btn');
  elements.refreshItemsFileInput = document.getElementById('refresh-items-file-input');
  elements.backupInfo = document.getElementById('backup-info');

  elements.machineModal = document.getElementById('machine-modal');
  elements.machineKitsList = document.getElementById('machine-kits-list');
  elements.machineKitForm = document.getElementById('machine-kit-form');
  elements.machineKitFormTitle = document.getElementById('machine-kit-form-title');
  elements.machineKitId = document.getElementById('machine-kit-id');
  elements.machineKitName = document.getElementById('machine-kit-name');
  elements.machineKitItemSearch = document.getElementById('machine-kit-item-search');
  elements.machineKitItemSearchResults = document.getElementById('machine-kit-item-search-results');
  elements.machineKitItemQty = document.getElementById('machine-kit-item-qty');
  elements.addMachineKitItemBtn = document.getElementById('add-machine-kit-item-btn');
  elements.machineKitComponents = document.getElementById('machine-kit-components');
  elements.machineKitImageInput = document.getElementById('machine-kit-image-input');
  elements.machineKitImageCameraInput = document.getElementById('machine-kit-image-camera-input');
  elements.takeMachinePhotoBtn = document.getElementById('take-machine-photo-btn');
  elements.chooseMachinePhotoBtn = document.getElementById('choose-machine-photo-btn');
  elements.machineKitImagePreviewWrap = document.getElementById('machine-kit-image-preview-wrap');
  elements.machineKitImagePreview = document.getElementById('machine-kit-image-preview');
  elements.clearMachineKitImageBtn = document.getElementById('clear-machine-kit-image-btn');
  elements.clearMachineKitBtn = document.getElementById('clear-machine-kit-btn');

  elements.toast = document.getElementById('toast');
}

function bindEvents() {
  const openItemModalButton = document.getElementById('open-item-modal-btn');
  if (openItemModalButton) {
    openItemModalButton.addEventListener('click', () => {
      openItemModal();
    });
  }
  if (elements.hardRefreshBtn) {
    elements.hardRefreshBtn.addEventListener('click', onHardRefreshClicked);
  }
  if (elements.openMachineModalBtn) {
    elements.openMachineModalBtn.addEventListener('click', openMachineModal);
  }
  elements.backupNowBtn.addEventListener('click', onBackupNowClicked);
  elements.openSettingsBtn.addEventListener('click', openSettingsModal);
  elements.settingsForm.addEventListener('submit', onSettingsFormSubmit);
  elements.openBackupsFolderBtn.addEventListener('click', onOpenBackupsFolderClicked);
  if (elements.refreshItemsBtn) {
    elements.refreshItemsBtn.addEventListener('click', onRefreshItemsClicked);
  }
  if (elements.refreshItemsFileInput) {
    elements.refreshItemsFileInput.addEventListener('change', onRefreshItemsFileSelected);
  }

  elements.searchInput.addEventListener('input', renderItems);
  elements.lowStockOnly.addEventListener('change', renderItems);
  elements.scanSearchBtn.addEventListener('click', () => {
    openScanner('search');
  });

  elements.itemForm.addEventListener('submit', onItemFormSubmit);
  elements.scanSkuBtn.addEventListener('click', () => {
    openScanner('sku');
  });
  elements.addMachineBtn.addEventListener('click', addMachineFromInput);
  elements.machineInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addMachineFromInput();
    }
  });
  elements.machineList.addEventListener('click', onMachineListClick);
  elements.takePhotoBtn.addEventListener('click', () => {
    elements.itemImageCameraInput.click();
  });
  elements.choosePhotoBtn.addEventListener('click', () => {
    elements.itemImageInput.click();
  });
  elements.itemImageInput.addEventListener('change', onItemImageSelected);
  elements.itemImageCameraInput.addEventListener('change', onItemImageSelected);
  elements.clearItemImageBtn.addEventListener('click', clearDraftImage);
  elements.stockForm.addEventListener('submit', onStockFormSubmit);
  elements.scannerStartBtn.addEventListener('click', startScanner);
  elements.scannerStopBtn.addEventListener('click', stopScanner);
  if (elements.machineKitForm) {
    elements.machineKitForm.addEventListener('submit', onMachineKitFormSubmit);
  }
  if (elements.addMachineKitItemBtn) {
    elements.addMachineKitItemBtn.addEventListener('click', addMachineKitComponentFromInput);
  }
  if (elements.machineKitItemSearch) {
    elements.machineKitItemSearch.addEventListener('input', onMachineKitItemSearchInput);
    elements.machineKitItemSearch.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        addMachineKitComponentFromInput();
      }
    });
  }
  if (elements.machineKitItemSearchResults) {
    elements.machineKitItemSearchResults.addEventListener('click', onMachineKitItemSearchResultsClick);
  }
  if (elements.machineKitItemQty) {
    elements.machineKitItemQty.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        addMachineKitComponentFromInput();
      }
    });
  }
  if (elements.takeMachinePhotoBtn) {
    elements.takeMachinePhotoBtn.addEventListener('click', () => {
      elements.machineKitImageCameraInput.click();
    });
  }
  if (elements.chooseMachinePhotoBtn) {
    elements.chooseMachinePhotoBtn.addEventListener('click', () => {
      elements.machineKitImageInput.click();
    });
  }
  if (elements.machineKitImageInput) {
    elements.machineKitImageInput.addEventListener('change', onMachineKitImageSelected);
  }
  if (elements.machineKitImageCameraInput) {
    elements.machineKitImageCameraInput.addEventListener('change', onMachineKitImageSelected);
  }
  if (elements.clearMachineKitImageBtn) {
    elements.clearMachineKitImageBtn.addEventListener('click', clearDraftMachineKitImage);
  }
  if (elements.machineKitComponents) {
    elements.machineKitComponents.addEventListener('click', onMachineKitComponentsClick);
  }
  if (elements.machineKitsList) {
    elements.machineKitsList.addEventListener('click', onMachineKitsListClick);
  }
  if (elements.clearMachineKitBtn) {
    elements.clearMachineKitBtn.addEventListener('click', resetMachineKitForm);
  }

  elements.itemsBody.addEventListener('click', onTableAction);

  document.querySelectorAll('.modal').forEach((modal) => {
    modal.addEventListener('click', (event) => {
      if (event.target === modal) {
        closeModal(modal.id);
      }
    });
  });

  document.querySelectorAll('[data-close]').forEach((button) => {
    button.addEventListener('click', () => {
      closeModal(button.dataset.close);
    });
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeAllModals();
    }
  });
}

function bindIpc() {
  window.inventoryAPI.onItemsList((items) => {
    state.items = normalizeItems(items);
    persistItemsCache(state.items);
    renderAll();
    renderMachineKitItemOptions();
    renderMachineKits();
  });

  window.inventoryAPI.onItemsUpdated((items) => {
    state.items = normalizeItems(items);
    persistItemsCache(state.items);
    renderAll();
    renderMachineKitItemOptions();
    renderMachineKits();
  });

  if (typeof window.inventoryAPI.onMachineKitsList === 'function') {
    window.inventoryAPI.onMachineKitsList((machineKits) => {
      state.machineKits = normalizeMachineKits(machineKits);
      renderMachineKits();
    });
  }

  if (typeof window.inventoryAPI.onMachineKitsUpdated === 'function') {
    window.inventoryAPI.onMachineKitsUpdated((machineKits) => {
      state.machineKits = normalizeMachineKits(machineKits);
      renderMachineKits();
    });
  }

  if (typeof window.inventoryAPI.onMachineKitSaved === 'function') {
    window.inventoryAPI.onMachineKitSaved((payload) => {
      resetMachineKitForm();
      const message = payload?.type === 'update' ? 'Machine updated.' : 'Machine added.';
      showToast(message);
    });
  }

  if (typeof window.inventoryAPI.onMachineKitDeleted === 'function') {
    window.inventoryAPI.onMachineKitDeleted(() => {
      resetMachineKitForm();
      showToast('Machine deleted.');
    });
  }

  if (typeof window.inventoryAPI.onMachineKitSold === 'function') {
    window.inventoryAPI.onMachineKitSold((payload) => {
      const machineName = payload?.name || 'Machine';
      const quantity = Math.max(1, Math.floor(toNumber(payload?.quantity, 1)));
      showToast(`${machineName} sold (${quantity}). Stock auto-updated.`);
    });
  }

  window.inventoryAPI.onItemMovements((payload) => {
    if (!payload || payload.itemId !== state.historyItemId) {
      return;
    }
    renderHistory(payload.movements || []);
  });

  window.inventoryAPI.onItemSaved((payload) => {
    closeModal('item-modal');
    showToast(payload?.type === 'update' ? 'Item updated.' : 'Item added.');
  });

  window.inventoryAPI.onItemDeleted(() => {
    showToast('Item deleted.');
  });

  window.inventoryAPI.onStockAdjusted(() => {
    closeModal('stock-modal');
    showToast('Stock updated.');
  });

  window.inventoryAPI.onItemError((payload) => {
    showToast(payload?.message || 'Could not complete action.', true);
  });

  window.inventoryAPI.onBackupCreated((payload) => {
    if (payload?.mode === 'auto') {
      showToast('Daily backup created.');
      applyAppSettings({
        ...state.settings,
        lastAutoBackupDate: payload.lastAutoBackupDate || state.settings.lastAutoBackupDate
      });
    }
  });

  window.inventoryAPI.onSettingsUpdated((settings) => {
    applyAppSettings(settings);
  });
}

function hydrateItemsFromCache() {
  try {
    const raw = window.localStorage.getItem(ITEMS_CACHE_KEY);
    if (!raw) {
      return;
    }

    const parsed = JSON.parse(raw);
    const cachedItems = Array.isArray(parsed?.items) ? parsed.items : [];
    if (cachedItems.length === 0) {
      return;
    }

    state.items = normalizeItems(cachedItems);
    renderAll();
  } catch (_error) {
    // Ignore cache parse/storage errors and continue with live data.
  }
}

function persistItemsCache(items) {
  try {
    const payload = Array.isArray(items)
      ? items.map((item) => {
        const preview = sanitizeImageData(item.imagePreviewData) || sanitizeImageData(item.imageData);
        return {
          ...item,
          imageData: '',
          imagePreviewData: preview,
          hasImage: Boolean(item.hasImage || preview)
        };
      })
      : [];

    window.localStorage.setItem(ITEMS_CACHE_KEY, JSON.stringify({
      savedAt: new Date().toISOString(),
      items: payload
    }));
  } catch (_error) {
    // Ignore storage errors (e.g., private mode limits).
  }
}

async function loadAppSettings() {
  try {
    const settings = await window.inventoryAPI.getAppSettings();
    applyAppSettings(settings);
  } catch (_error) {
    applyAppSettings(state.settings);
  }
}

function applyAppSettings(settings) {
  const companyName = typeof settings?.companyName === 'string' && settings.companyName.trim()
    ? settings.companyName.trim()
    : 'CWT Inventory';
  const lastAutoBackupDate = typeof settings?.lastAutoBackupDate === 'string'
    ? settings.lastAutoBackupDate
    : '';

  state.settings = {
    companyName,
    lastAutoBackupDate
  };

  elements.inventoryTitle.textContent = companyName;
  elements.companyNameInput.value = companyName;
  updateBackupInfo();
}

function openSettingsModal() {
  elements.companyNameInput.value = state.settings.companyName;
  updateBackupInfo();
  openModal('settings-modal');
}

function updateBackupInfo() {
  if (!elements.backupInfo) {
    return;
  }

  if (!state.settings.lastAutoBackupDate) {
    elements.backupInfo.textContent = 'No automatic backup yet.';
    return;
  }

  elements.backupInfo.textContent = `Last daily backup: ${formatDateStamp(state.settings.lastAutoBackupDate)}`;
}

function formatDateStamp(dateStamp) {
  const parsed = new Date(`${dateStamp}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return dateStamp;
  }
  return parsed.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

async function onBackupNowClicked() {
  try {
    const result = await window.inventoryAPI.createBackup();
    if (result?.canceled) {
      return;
    }

    if (result?.success) {
      showToast('Backup saved.');
      return;
    }

    showToast(result?.error || 'Backup failed.', true);
  } catch (_error) {
    showToast('Backup failed.', true);
  }
}

async function onOpenBackupsFolderClicked() {
  try {
    await window.inventoryAPI.openBackupFolder();
  } catch (_error) {
    showToast('Could not open backup folder.', true);
  }
}

async function onHardRefreshClicked() {
  try {
    window.localStorage.removeItem(ITEMS_CACHE_KEY);
  } catch (_error) {
    // Ignore storage permission failures.
  }

  if (typeof window.caches !== 'undefined') {
    try {
      const cacheKeys = await window.caches.keys();
      await Promise.all(cacheKeys.map((key) => window.caches.delete(key)));
    } catch (_error) {
      // Ignore Cache API failures and continue reload.
    }
  }

  try {
    const url = new URL(window.location.href);
    url.searchParams.set('refresh', Date.now().toString());
    window.location.replace(url.toString());
  } catch (_error) {
    window.location.reload();
  }
}

function onRefreshItemsClicked() {
  if (!elements.refreshItemsFileInput) {
    showToast('Refresh is unavailable in this build.', true);
    return;
  }

  elements.refreshItemsFileInput.value = '';
  elements.refreshItemsFileInput.click();
}

async function onRefreshItemsFileSelected(event) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  if (!file.name.toLowerCase().endsWith('.json')) {
    showToast('Choose a JSON file (inventory-data.json).', true);
    event.target.value = '';
    return;
  }

  if (typeof window.inventoryAPI.refreshItems !== 'function') {
    showToast('Refresh is unavailable in this build.', true);
    event.target.value = '';
    return;
  }

  let parsed;
  try {
    const raw = await file.text();
    parsed = JSON.parse(raw);
  } catch (_error) {
    showToast('Invalid JSON file. Use inventory-data.json.', true);
    event.target.value = '';
    return;
  }

  try {
    const result = await window.inventoryAPI.refreshItems(parsed);

    if (!result?.success) {
      showToast(result?.error || 'Could not refresh items.', true);
      return;
    }

    const itemCount = Math.max(0, Math.floor(toNumber(result.itemCount, 0)));
    showToast(`Refresh complete. ${itemCount} item(s) loaded.`);
  } catch (error) {
    showToast(error?.message || 'Could not refresh items.', true);
  } finally {
    event.target.value = '';
  }
}

async function onSettingsFormSubmit(event) {
  event.preventDefault();

  try {
    const updated = await window.inventoryAPI.updateAppSettings({
      companyName: elements.companyNameInput.value
    });
    applyAppSettings(updated);
    closeModal('settings-modal');
    showToast('Settings saved.');
  } catch (_error) {
    showToast('Could not save settings.', true);
  }
}

function normalizeItems(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map((item) => ({
    ...item,
    name: item.name || '',
    sku: item.sku || '',
    category: item.category || '',
    location: item.location || '',
    machines: sanitizeMachineList(item.machines),
    sourceUrl: sanitizeSourceUrl(item.sourceUrl),
    imageData: sanitizeImageData(item.imageData),
    imagePreviewData: sanitizeImageData(item.imagePreviewData),
    hasImage: Boolean(item.hasImage || sanitizeImageData(item.imageData) || sanitizeImageData(item.imagePreviewData)),
    notes: item.notes || '',
    quantity: Math.max(0, Math.floor(toNumber(item.quantity, 0))),
    reorderLevel: Math.max(0, Math.floor(toNumber(item.reorderLevel, 0))),
    unitPrice: Math.max(0, toNumber(item.unitPrice, 0))
  }));
}

function normalizeMachineKits(machineKits) {
  if (!Array.isArray(machineKits)) {
    return [];
  }

  return machineKits
    .map((machineKit) => ({
      id: typeof machineKit?.id === 'string' ? machineKit.id : '',
      name: typeof machineKit?.name === 'string' ? machineKit.name.trim().replace(/\s+/g, ' ') : '',
      components: sanitizeMachineKitComponents(machineKit?.components),
      imageData: sanitizeImageData(machineKit?.imageData),
      imagePreviewData: sanitizeImageData(machineKit?.imagePreviewData),
      hasImage: Boolean(
        machineKit?.hasImage
        || sanitizeImageData(machineKit?.imageData)
        || sanitizeImageData(machineKit?.imagePreviewData)
      ),
      createdAt: machineKit?.createdAt || '',
      updatedAt: machineKit?.updatedAt || ''
    }))
    .filter((machineKit) => machineKit.id && machineKit.name);
}

function sanitizeImageData(imageData) {
  if (typeof imageData !== 'string') {
    return '';
  }

  const trimmed = imageData.trim();
  return trimmed.startsWith('data:image/') ? trimmed : '';
}

function sanitizeSourceUrl(sourceUrl) {
  if (typeof sourceUrl !== 'string') {
    return '';
  }

  const trimmed = sourceUrl.trim();
  if (!trimmed) {
    return '';
  }

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(candidate);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return '';
    }
    return parsed.toString();
  } catch (_error) {
    return '';
  }
}

function sanitizeMachineList(machines) {
  const source = Array.isArray(machines)
    ? machines
    : typeof machines === 'string'
      ? machines.split(',')
      : [];
  const seen = new Set();
  const result = [];

  source.forEach((value) => {
    if (typeof value !== 'string') {
      return;
    }

    const normalized = value.trim().replace(/\s+/g, ' ');
    if (!normalized) {
      return;
    }

    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    result.push(normalized);
  });

  return result;
}

function sanitizeMachineKitComponents(components) {
  const source = Array.isArray(components) ? components : [];
  const totals = new Map();

  source.forEach((entry) => {
    if (!entry || typeof entry !== 'object') {
      return;
    }

    const itemId = typeof entry.itemId === 'string' ? entry.itemId.trim() : '';
    const quantity = Math.max(0, Math.floor(toNumber(entry.quantity, 0)));
    if (!itemId || quantity <= 0) {
      return;
    }

    totals.set(itemId, (totals.get(itemId) || 0) + quantity);
  });

  return Array.from(totals.entries()).map(([itemId, quantity]) => ({
    itemId,
    quantity
  }));
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function openMachineModal() {
  if (!elements.machineModal || !elements.machineKitName) {
    showToast('Machine manager is unavailable in this build.', true);
    return;
  }

  resetMachineKitForm();
  renderMachineKits();
  openModal('machine-modal');
  elements.machineKitName.focus();
  if (typeof window.inventoryAPI.getMachineKits === 'function') {
    window.inventoryAPI.getMachineKits();
  }
}

function resetMachineKitForm() {
  if (!elements.machineKitForm || !elements.machineKitId || !elements.machineKitName || !elements.machineKitFormTitle || !elements.machineKitItemQty) {
    return;
  }

  elements.machineKitForm.reset();
  elements.machineKitId.value = '';
  elements.machineKitName.value = '';
  elements.machineKitFormTitle.textContent = 'Add Machine';
  elements.machineKitItemQty.value = '1';
  if (elements.machineKitItemSearch) {
    elements.machineKitItemSearch.value = '';
    delete elements.machineKitItemSearch.dataset.selectedItemId;
  }
  if (elements.machineKitImageInput) {
    elements.machineKitImageInput.value = '';
  }
  if (elements.machineKitImageCameraInput) {
    elements.machineKitImageCameraInput.value = '';
  }
  state.draftMachineKitComponents = [];
  state.draftMachineKitImageData = '';
  state.draftMachineKitImagePreviewData = '';
  state.draftMachineKitImageChanged = false;
  renderMachineKitItemOptions();
  renderDraftMachineKitComponents();
  renderMachineKitImagePreview();
}

function renderMachineKitItemOptions() {
  if (!elements.machineKitItemSearch || !elements.machineKitItemSearchResults) {
    return;
  }

  const query = elements.machineKitItemSearch.value.trim().toLowerCase();
  const sortedItems = [...state.items]
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

  if (sortedItems.length === 0) {
    elements.machineKitItemSearchResults.innerHTML = '<div class="machine-kit-search-empty">Add inventory items first.</div>';
    return;
  }

  const selectedItemId = elements.machineKitItemSearch.dataset.selectedItemId || '';
  const selectedItem = sortedItems.find((item) => item.id === selectedItemId);
  if (selectedItem && elements.machineKitItemSearch.value.trim() === selectedItem.name) {
    elements.machineKitItemSearchResults.innerHTML = `<div class="machine-kit-search-selected">Selected: ${escapeHtml(selectedItem.name)} (Stock: ${selectedItem.quantity})</div>`;
    return;
  }

  delete elements.machineKitItemSearch.dataset.selectedItemId;

  if (!query) {
    elements.machineKitItemSearchResults.innerHTML = '<div class="machine-kit-search-empty">Type to search items.</div>';
    return;
  }

  const matches = sortedItems
    .filter((item) => {
      const haystack = [item.name, item.sku, item.category, item.location]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    })
    .slice(0, 12);

  if (matches.length === 0) {
    elements.machineKitItemSearchResults.innerHTML = '<div class="machine-kit-search-empty">No matching items.</div>';
    return;
  }

  elements.machineKitItemSearchResults.innerHTML = matches.map((item) => `
    <button type="button" class="machine-kit-search-option" data-machine-search-id="${item.id}">
      <strong>${escapeHtml(item.name)}</strong>
      <span>${escapeHtml(item.sku || item.category || 'No SKU')} | Stock ${item.quantity}</span>
    </button>
  `).join('');
}

function onMachineKitItemSearchInput() {
  renderMachineKitItemOptions();
}

function onMachineKitItemSearchResultsClick(event) {
  const button = event.target.closest('button[data-machine-search-id]');
  if (!button) {
    return;
  }

  const itemId = button.dataset.machineSearchId;
  const item = state.items.find((entry) => entry.id === itemId);
  if (!item || !elements.machineKitItemSearch) {
    return;
  }

  elements.machineKitItemSearch.value = item.name;
  elements.machineKitItemSearch.dataset.selectedItemId = item.id;
  renderMachineKitItemOptions();
}

function resolveMachineKitSearchSelection() {
  if (!elements.machineKitItemSearch) {
    return '';
  }

  const selectedItemId = elements.machineKitItemSearch.dataset.selectedItemId || '';
  if (selectedItemId && state.items.some((entry) => entry.id === selectedItemId)) {
    return selectedItemId;
  }

  const query = elements.machineKitItemSearch.value.trim().toLowerCase();
  if (!query) {
    return '';
  }

  const exactMatches = state.items.filter((item) => (
    item.name.toLowerCase() === query
    || item.sku.toLowerCase() === query
  ));
  if (exactMatches.length === 1) {
    return exactMatches[0].id;
  }

  const containsMatches = state.items.filter((item) => {
    const haystack = [item.name, item.sku, item.category, item.location].join(' ').toLowerCase();
    return haystack.includes(query);
  });
  if (containsMatches.length === 1) {
    return containsMatches[0].id;
  }

  return '';
}

function getMachineKitBuildableCount(machineKit) {
  if (!machineKit || !Array.isArray(machineKit.components) || machineKit.components.length === 0) {
    return 0;
  }

  let minBuildable = Number.POSITIVE_INFINITY;
  for (const component of machineKit.components) {
    const item = state.items.find((entry) => entry.id === component.itemId);
    if (!item) {
      return 0;
    }

    const buildableFromItem = Math.floor(item.quantity / component.quantity);
    minBuildable = Math.min(minBuildable, buildableFromItem);
  }

  return Number.isFinite(minBuildable) ? Math.max(0, minBuildable) : 0;
}

function renderMachineKits() {
  if (!elements.machineKitsList) {
    return;
  }

  if (!Array.isArray(state.machineKits) || state.machineKits.length === 0) {
    elements.machineKitsList.innerHTML = '<p class="machine-kit-empty">No machines yet. Add one on the right.</p>';
    return;
  }

  const sortedMachineKits = [...state.machineKits]
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

  elements.machineKitsList.innerHTML = sortedMachineKits.map((machineKit) => {
    const buildable = getMachineKitBuildableCount(machineKit);
    const thumbnail = sanitizeImageData(machineKit.imagePreviewData) || sanitizeImageData(machineKit.imageData);
    const componentsMarkup = machineKit.components.map((component) => {
      const item = state.items.find((entry) => entry.id === component.itemId);
      const label = item ? item.name : 'Missing item';
      const stockText = item ? `Stock ${item.quantity}` : 'Missing';
      return `<span class="machine-kit-component">${escapeHtml(label)} x${component.quantity} (${stockText})</span>`;
    }).join('');
    const imageMarkup = thumbnail
      ? `<img class="machine-kit-thumb" src="${thumbnail}" loading="lazy" alt="${escapeHtml(machineKit.name)} picture">`
      : machineKit.hasImage
        ? '<div class="machine-kit-thumb placeholder">Photo</div>'
        : '<div class="machine-kit-thumb placeholder">No image</div>';

    return `
      <article class="machine-kit-card">
        <div class="machine-kit-top">
          <div class="machine-kit-title-cell">
            ${imageMarkup}
            <div class="machine-kit-name">${escapeHtml(machineKit.name)}</div>
          </div>
        </div>
        <p class="machine-kit-buildable">Can build now: ${buildable}</p>
        <div class="machine-kit-component-list">${componentsMarkup}</div>
        <div class="machine-kit-actions">
          <button class="btn btn-small btn-primary" data-machine-action="sell" data-id="${machineKit.id}" ${buildable > 0 ? '' : 'disabled'}>Sell</button>
          <button class="btn btn-small" data-machine-action="edit" data-id="${machineKit.id}">Edit</button>
          <button class="btn btn-small btn-danger" data-machine-action="delete" data-id="${machineKit.id}">Delete</button>
        </div>
      </article>
    `;
  }).join('');
}

function renderDraftMachineKitComponents() {
  if (!elements.machineKitComponents) {
    return;
  }

  if (state.draftMachineKitComponents.length === 0) {
    elements.machineKitComponents.innerHTML = '<span class="machine-empty">No items linked to this machine yet.</span>';
    return;
  }

  elements.machineKitComponents.innerHTML = state.draftMachineKitComponents.map((component, index) => {
    const item = state.items.find((entry) => entry.id === component.itemId);
    const itemName = item ? item.name : 'Missing item';
    const stockText = item ? `Current stock: ${item.quantity}` : 'Item is missing';

    return `
      <div class="machine-kit-component-row">
        <div>
          <strong>${escapeHtml(itemName)}</strong>
          <div class="machine-kit-component-meta">${escapeHtml(stockText)} | Uses ${component.quantity} per machine</div>
        </div>
        <button type="button" class="btn btn-small btn-danger" data-component-index="${index}">Remove</button>
      </div>
    `;
  }).join('');
}

function addMachineKitComponentFromInput() {
  const itemId = resolveMachineKitSearchSelection();
  if (!itemId) {
    showToast('Search and select an inventory item first.', true);
    return;
  }

  const quantity = Math.max(0, Math.floor(toNumber(elements.machineKitItemQty.value, 0)));
  if (quantity <= 0) {
    showToast('Item quantity per machine must be at least 1.', true);
    return;
  }

  const existingIndex = state.draftMachineKitComponents.findIndex((entry) => entry.itemId === itemId);
  if (existingIndex >= 0) {
    state.draftMachineKitComponents[existingIndex] = {
      ...state.draftMachineKitComponents[existingIndex],
      quantity: state.draftMachineKitComponents[existingIndex].quantity + quantity
    };
  } else {
    state.draftMachineKitComponents.push({ itemId, quantity });
  }

  state.draftMachineKitComponents = sanitizeMachineKitComponents(state.draftMachineKitComponents);
  elements.machineKitItemQty.value = '1';
  if (elements.machineKitItemSearch) {
    elements.machineKitItemSearch.value = '';
    delete elements.machineKitItemSearch.dataset.selectedItemId;
  }
  renderMachineKitItemOptions();
  renderDraftMachineKitComponents();
}

function onMachineKitComponentsClick(event) {
  const button = event.target.closest('button[data-component-index]');
  if (!button) {
    return;
  }

  const index = Number(button.dataset.componentIndex);
  if (!Number.isInteger(index) || index < 0 || index >= state.draftMachineKitComponents.length) {
    return;
  }

  state.draftMachineKitComponents = state.draftMachineKitComponents
    .filter((_entry, entryIndex) => entryIndex !== index);
  renderDraftMachineKitComponents();
}

function onMachineKitFormSubmit(event) {
  event.preventDefault();

  const payload = {
    id: elements.machineKitId.value.trim(),
    name: elements.machineKitName.value.trim(),
    components: sanitizeMachineKitComponents(state.draftMachineKitComponents)
  };

  if (payload.components.length === 0) {
    showToast('Add at least one item for this machine.', true);
    return;
  }

  const isUpdate = Boolean(payload.id);
  if (!isUpdate || state.draftMachineKitImageChanged) {
    payload.imageData = state.draftMachineKitImageData;
    payload.imagePreviewData = state.draftMachineKitImagePreviewData;
    payload.imageUpdated = true;
  }

  if (!isUpdate) {
    if (typeof window.inventoryAPI.addMachineKit !== 'function') {
      showToast('Machine feature is unavailable in this build.', true);
      return;
    }
    window.inventoryAPI.addMachineKit(payload);
    return;
  }

  if (typeof window.inventoryAPI.updateMachineKit !== 'function') {
    showToast('Machine feature is unavailable in this build.', true);
    return;
  }
  window.inventoryAPI.updateMachineKit(payload);
}

function onMachineKitsListClick(event) {
  const button = event.target.closest('button[data-machine-action]');
  if (!button) {
    return;
  }

  const machineKitId = button.dataset.id;
  const machineKit = state.machineKits.find((entry) => entry.id === machineKitId);
  if (!machineKit) {
    showToast('Machine no longer exists.', true);
    return;
  }

  const action = button.dataset.machineAction;
  if (action === 'edit') {
    elements.machineKitId.value = machineKit.id;
    elements.machineKitName.value = machineKit.name;
    elements.machineKitFormTitle.textContent = 'Edit Machine';
    state.draftMachineKitComponents = sanitizeMachineKitComponents(machineKit.components);
    state.draftMachineKitImageData = sanitizeImageData(machineKit.imageData);
    state.draftMachineKitImagePreviewData = sanitizeImageData(machineKit.imagePreviewData);
    state.draftMachineKitImageChanged = false;
    if (elements.machineKitItemSearch) {
      elements.machineKitItemSearch.value = '';
      delete elements.machineKitItemSearch.dataset.selectedItemId;
    }
    if (elements.machineKitImageInput) {
      elements.machineKitImageInput.value = '';
    }
    if (elements.machineKitImageCameraInput) {
      elements.machineKitImageCameraInput.value = '';
    }
    renderMachineKitItemOptions();
    renderDraftMachineKitComponents();
    renderMachineKitImagePreview();
    elements.machineKitName.focus();
    return;
  }

  if (action === 'delete') {
    const confirmed = window.confirm(`Delete machine "${machineKit.name}"?`);
    if (confirmed) {
      if (typeof window.inventoryAPI.deleteMachineKit !== 'function') {
        showToast('Machine feature is unavailable in this build.', true);
        return;
      }
      window.inventoryAPI.deleteMachineKit(machineKit.id);
    }
    return;
  }

  if (action === 'sell') {
    const raw = window.prompt(`How many "${machineKit.name}" machines were sold?`, '1');
    if (raw == null) {
      return;
    }

    const quantity = Math.max(0, Math.floor(toNumber(raw, 0)));
    if (quantity <= 0) {
      showToast('Enter a valid machine quantity.', true);
      return;
    }

    if (typeof window.inventoryAPI.sellMachineKit !== 'function') {
      showToast('Machine feature is unavailable in this build.', true);
      return;
    }
    window.inventoryAPI.sellMachineKit({
      id: machineKit.id,
      quantity
    });
  }
}

function clearDraftMachineKitImage() {
  state.draftMachineKitImageData = '';
  state.draftMachineKitImagePreviewData = '';
  state.draftMachineKitImageChanged = true;

  if (elements.machineKitImageInput) {
    elements.machineKitImageInput.value = '';
  }
  if (elements.machineKitImageCameraInput) {
    elements.machineKitImageCameraInput.value = '';
  }

  renderMachineKitImagePreview();
}

async function onMachineKitImageSelected(event) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  if (!file.type.startsWith('image/')) {
    showToast('Only image files are allowed.', true);
    event.target.value = '';
    return;
  }

  const maxMb = 10;
  const maxBytes = maxMb * 1024 * 1024;
  if (file.size > maxBytes) {
    showToast(`Image is too large. Use a file under ${maxMb} MB.`, true);
    event.target.value = '';
    return;
  }

  try {
    const processed = await processImageUpload(file);
    state.draftMachineKitImageData = processed.imageData;
    state.draftMachineKitImagePreviewData = processed.imagePreviewData || processed.imageData;
    state.draftMachineKitImageChanged = true;
    renderMachineKitImagePreview();
    if (processed.optimized) {
      showToast('Photo optimized for faster loading.');
    }
  } catch (_error) {
    showToast('Could not load image.', true);
    event.target.value = '';
  }
}

function renderMachineKitImagePreview() {
  if (!elements.machineKitImagePreviewWrap || !elements.machineKitImagePreview) {
    return;
  }

  const imageData = sanitizeImageData(state.draftMachineKitImageData)
    || sanitizeImageData(state.draftMachineKitImagePreviewData);

  if (!imageData) {
    elements.machineKitImagePreviewWrap.classList.add('hidden');
    elements.machineKitImagePreview.removeAttribute('src');
    return;
  }

  elements.machineKitImagePreview.src = imageData;
  elements.machineKitImagePreviewWrap.classList.remove('hidden');
}

function renderAll() {
  renderStats();
  renderItems();
}

function renderStats() {
  const totalItems = state.items.length;
  const totalUnits = state.items.reduce((sum, item) => sum + item.quantity, 0);
  const totalValue = state.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  const lowStockCount = state.items.filter((item) => isLowStock(item)).length;

  elements.stats.innerHTML = `
    <article class="stat-card">
      <p>Total Items</p>
      <strong>${totalItems}</strong>
    </article>
    <article class="stat-card">
      <p>Total Units</p>
      <strong>${totalUnits}</strong>
    </article>
    <article class="stat-card">
      <p>Inventory Value</p>
      <strong>${formatCurrency(totalValue)}</strong>
    </article>
    <article class="stat-card stat-warning">
      <p>Low Stock</p>
      <strong>${lowStockCount}</strong>
    </article>
  `;
}

function getFilteredItems() {
  const query = elements.searchInput.value.trim().toLowerCase();
  const lowStockOnly = elements.lowStockOnly.checked;

  return state.items.filter((item) => {
    if (lowStockOnly && !isLowStock(item)) {
      return false;
    }

    if (!query) {
      return true;
    }

    return [item.name, item.sku, item.category, item.location, item.sourceUrl, item.machines.join(' ')]
      .join(' ')
      .toLowerCase()
      .includes(query);
  });
}

function renderItems() {
  const items = getFilteredItems();
  elements.itemsBody.innerHTML = '';

  if (items.length === 0) {
    elements.emptyState.style.display = 'block';
    return;
  }

  elements.emptyState.style.display = 'none';

  items.forEach((item) => {
    const row = document.createElement('tr');
    if (isLowStock(item)) {
      row.classList.add('row-low-stock');
    }
    const thumbnail = sanitizeImageData(item.imagePreviewData) || sanitizeImageData(item.imageData);
    if (!thumbnail && item.hasImage) {
      hydrateListThumbnail(item.id);
    }
    const imageMarkup = thumbnail
      ? `<img class="item-thumb" src="${thumbnail}" loading="lazy" alt="${escapeHtml(item.name)} picture">`
      : item.hasImage
        ? '<div class="item-thumb placeholder">Photo</div>'
        : '<div class="item-thumb placeholder">No image</div>';

    row.innerHTML = `
      <td>
        <div class="item-cell">
          ${imageMarkup}
          <div>
            <div class="item-name">${escapeHtml(item.name)}</div>
            ${item.notes ? `<div class="item-note">${escapeHtml(item.notes)}</div>` : ''}
          </div>
        </div>
      </td>
      <td>${escapeHtml(item.sku || '-')}</td>
      <td>${escapeHtml(item.category || '-')}</td>
      <td>${escapeHtml(item.location || '-')}</td>
      <td>${renderSourceLink(item.sourceUrl)}</td>
      <td>${renderMachineSummary(item.machines)}</td>
      <td>
        <span class="qty-pill ${isLowStock(item) ? 'low' : ''}">${item.quantity}</span>
      </td>
      <td>${item.reorderLevel}</td>
      <td>${formatCurrency(item.unitPrice)}</td>
      <td>
        <div class="row-actions">
          <button class="btn btn-small" data-action="adjust" data-id="${item.id}">Adjust</button>
          <button class="btn btn-small" data-action="history" data-id="${item.id}">History</button>
          <button class="btn btn-small" data-action="edit" data-id="${item.id}">Edit</button>
          <button class="btn btn-small btn-danger" data-action="delete" data-id="${item.id}">Delete</button>
        </div>
      </td>
    `;

    elements.itemsBody.appendChild(row);
  });
}

async function hydrateListThumbnail(itemId) {
  if (!itemId || typeof window.inventoryAPI.getItemImage !== 'function') {
    return;
  }
  if (state.thumbnailLoadIds.has(itemId)) {
    return;
  }

  state.thumbnailLoadIds.add(itemId);
  try {
    const payload = await window.inventoryAPI.getItemImage(itemId);
    const index = state.items.findIndex((entry) => entry.id === itemId);
    if (index < 0) {
      return;
    }

    const previewFromApi = sanitizeImageData(payload?.imagePreviewData);
    const fullFromApi = sanitizeImageData(payload?.imageData);
    let preview = previewFromApi;

    if (!preview && fullFromApi) {
      preview = await downscaleImageDataUrl(fullFromApi, IMAGE_PROCESS_PREVIEW_SIDE, IMAGE_PROCESS_PREVIEW_QUALITY);
    }

    if (!preview) {
      return;
    }

    const current = state.items[index];
    if (sanitizeImageData(current.imagePreviewData) === preview) {
      return;
    }

    state.items[index] = {
      ...current,
      imagePreviewData: preview,
      hasImage: true
    };

    persistItemsCache(state.items);
    renderItems();
  } catch (_error) {
    // Keep UI stable; placeholder remains if thumbnail hydration fails.
  } finally {
    state.thumbnailLoadIds.delete(itemId);
  }
}

function isLowStock(item) {
  return item.quantity <= item.reorderLevel;
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(value || 0);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderSourceLink(sourceUrl) {
  const safeUrl = sanitizeSourceUrl(sourceUrl);
  if (!safeUrl) {
    return '-';
  }

  let label = safeUrl;
  try {
    label = new URL(safeUrl).hostname;
  } catch (_error) {
    label = safeUrl;
  }

  return `<a class="source-link" href="${safeUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
}

function renderMachineSummary(machines) {
  const safeMachines = sanitizeMachineList(machines);
  if (safeMachines.length === 0) {
    return '-';
  }

  const visible = safeMachines.slice(0, 2);
  const chips = visible
    .map((machine) => `<span class="machine-pill">${escapeHtml(machine)}</span>`)
    .join('');
  const more = safeMachines.length > 2
    ? `<span class="machine-pill more">+${safeMachines.length - 2} more</span>`
    : '';

  return `<div class="machine-pills">${chips}${more}</div>`;
}

function onItemFormSubmit(event) {
  event.preventDefault();

  state.draftMachines = sanitizeMachineList([...state.draftMachines, elements.machineInput.value]);
  elements.machineInput.value = '';
  renderDraftMachines();

  const payload = {
    id: elements.itemId.value.trim(),
    name: elements.itemName.value.trim(),
    sku: elements.itemSku.value.trim(),
    category: elements.itemCategory.value.trim(),
    location: elements.itemLocation.value.trim(),
    machines: state.draftMachines,
    sourceUrl: sanitizeSourceUrl(elements.itemSourceUrl.value),
    quantity: Math.max(0, Math.floor(toNumber(elements.itemQuantity.value, 0))),
    reorderLevel: Math.max(0, Math.floor(toNumber(elements.itemReorderLevel.value, 0))),
    unitPrice: Math.max(0, toNumber(elements.itemUnitPrice.value, 0)),
    notes: elements.itemNotes.value.trim()
  };

  const isUpdate = Boolean(payload.id);
  if (!isUpdate || state.draftImageChanged) {
    payload.imageData = state.draftImageData;
    payload.imagePreviewData = state.draftImagePreviewData;
    payload.imageUpdated = true;
  }

  if (isUpdate) {
    window.inventoryAPI.updateItem(payload);
    return;
  }

  window.inventoryAPI.addItem(payload);
}

function onStockFormSubmit(event) {
  event.preventDefault();

  const payload = {
    id: elements.stockItemId.value,
    type: elements.stockType.value,
    quantity: Math.max(0, Math.floor(toNumber(elements.stockQuantity.value, 0))),
    reason: elements.stockReason.value.trim()
  };

  window.inventoryAPI.adjustStock(payload);
}

function onTableAction(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) {
    return;
  }

  const itemId = button.dataset.id;
  const action = button.dataset.action;
  const item = state.items.find((entry) => entry.id === itemId);

  if (!item) {
    showToast('Item no longer exists.', true);
    return;
  }

  if (action === 'edit') {
    openItemModal(item);
    return;
  }

  if (action === 'adjust') {
    openStockModal(item);
    return;
  }

  if (action === 'history') {
    openHistoryModal(item);
    return;
  }

  if (action === 'delete') {
    const confirmed = window.confirm(`Delete ${item.name}? This cannot be undone.`);
    if (confirmed) {
      window.inventoryAPI.deleteItem(item.id);
    }
  }
}

function openItemModal(item = null) {
  elements.itemForm.reset();
  elements.itemImageInput.value = '';
  elements.itemImageCameraInput.value = '';
  elements.machineInput.value = '';
  state.draftImageChanged = false;
  state.draftImageLoadToken += 1;

  if (item) {
    elements.itemModalTitle.textContent = 'Edit Item';
    elements.itemFormSubmit.textContent = 'Update Item';

    elements.itemId.value = item.id;
    elements.itemName.value = item.name;
    elements.itemSku.value = item.sku;
    elements.itemCategory.value = item.category;
    elements.itemLocation.value = item.location;
    elements.itemSourceUrl.value = item.sourceUrl;
    elements.itemQuantity.value = item.quantity;
    elements.itemQuantity.disabled = true;
    elements.itemQuantity.title = 'Use Adjust to change quantity.';
    elements.itemReorderLevel.value = item.reorderLevel;
    elements.itemUnitPrice.value = item.unitPrice;
    elements.itemNotes.value = item.notes;
    state.draftMachines = sanitizeMachineList(item.machines);
    state.draftImageData = sanitizeImageData(item.imageData);
    state.draftImagePreviewData = sanitizeImageData(item.imagePreviewData);

    if (!state.draftImageData && item.hasImage) {
      loadFullImageForEdit(item.id, state.draftImageLoadToken);
    }
  } else {
    elements.itemModalTitle.textContent = 'Add Item';
    elements.itemFormSubmit.textContent = 'Save Item';

    elements.itemId.value = '';
    elements.itemQuantity.value = '0';
    elements.itemQuantity.disabled = false;
    elements.itemQuantity.title = '';
    elements.itemReorderLevel.value = '0';
    elements.itemUnitPrice.value = '0';
    elements.itemSourceUrl.value = '';
    state.draftMachines = [];
    state.draftImageData = '';
    state.draftImagePreviewData = '';
  }

  renderDraftMachines();
  renderItemImagePreview();
  openModal('item-modal');
  elements.itemName.focus();
}

async function loadFullImageForEdit(itemId, token) {
  if (!itemId || typeof window.inventoryAPI.getItemImage !== 'function') {
    return;
  }

  try {
    const payload = await window.inventoryAPI.getItemImage(itemId);
    if (state.draftImageLoadToken !== token || elements.itemId.value !== itemId) {
      return;
    }

    const fullImage = sanitizeImageData(payload?.imageData);
    const previewImage = sanitizeImageData(payload?.imagePreviewData);
    if (!fullImage && !previewImage) {
      return;
    }

    state.draftImageData = fullImage;
    state.draftImagePreviewData = previewImage || fullImage;
    renderItemImagePreview();
  } catch (_error) {
    // Keep editing flow smooth even if image fetch fails.
  }
}

function addMachineFromInput() {
  const candidate = elements.machineInput.value;
  const nextMachines = sanitizeMachineList([...state.draftMachines, candidate]);
  const hadTypedValue = candidate.trim().length > 0;
  const wasDuplicate = hadTypedValue && nextMachines.length === state.draftMachines.length;

  state.draftMachines = nextMachines;
  elements.machineInput.value = '';
  renderDraftMachines();

  if (wasDuplicate) {
    showToast('Machine already added.', true);
  } else if (hadTypedValue) {
    elements.machineInput.focus();
  }
}

function onMachineListClick(event) {
  const button = event.target.closest('button[data-machine-index]');
  if (!button) {
    return;
  }

  const index = Number(button.dataset.machineIndex);
  if (!Number.isInteger(index) || index < 0 || index >= state.draftMachines.length) {
    return;
  }

  state.draftMachines = state.draftMachines.filter((_machine, machineIndex) => machineIndex !== index);
  renderDraftMachines();
}

function renderDraftMachines() {
  if (state.draftMachines.length === 0) {
    elements.machineList.innerHTML = '<span class="machine-empty">No machines added yet.</span>';
    return;
  }

  elements.machineList.innerHTML = state.draftMachines.map((machine, index) => `
    <span class="machine-chip">
      ${escapeHtml(machine)}
      <button type="button" class="remove-machine-btn" data-machine-index="${index}" aria-label="Remove machine">x</button>
    </span>
  `).join('');
}

function openScanner(target) {
  if (!target) {
    return;
  }

  state.scanTarget = target;
  state.scannerLastValue = '';
  state.scannerLastScanAt = 0;

  const targetLabel = target === 'sku' ? 'item SKU' : 'search field';
  elements.scannerStatus.textContent = `Point your camera at a barcode or QR code to fill ${targetLabel}.`;
  openModal('scanner-modal');
  startScanner();
}

async function startScanner() {
  if (state.scannerRunning) {
    return;
  }

  if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
    elements.scannerStatus.textContent = 'Camera is not available on this device.';
    showToast('Camera is not available.', true);
    return;
  }

  if (!window.BarcodeDetector) {
    elements.scannerStatus.textContent = 'Scanner is not supported on this device. Type the code manually.';
    showToast('Barcode scanning is not supported on this device.', true);
    return;
  }

  try {
    if (!state.scannerDetector) {
      state.scannerDetector = new BarcodeDetector({
        formats: ['qr_code', 'ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'itf']
      });
    }

    state.scannerStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' }
      },
      audio: false
    });

    elements.scannerVideo.srcObject = state.scannerStream;
    await elements.scannerVideo.play();

    state.scannerRunning = true;
    elements.scannerStatus.textContent = 'Scanning... hold steady for 1 second.';
    scanLoop();
  } catch (_error) {
    elements.scannerStatus.textContent = 'Camera access failed. Check camera permissions and try again.';
    showToast('Unable to access camera for scanning.', true);
    stopScanner();
  }
}

function stopScanner() {
  state.scannerRunning = false;

  if (state.scannerRafId) {
    window.cancelAnimationFrame(state.scannerRafId);
    state.scannerRafId = null;
  }

  if (state.scannerStream) {
    state.scannerStream.getTracks().forEach((track) => track.stop());
    state.scannerStream = null;
  }

  if (elements.scannerVideo) {
    elements.scannerVideo.pause();
    elements.scannerVideo.srcObject = null;
  }
}

function scanLoop() {
  if (!state.scannerRunning) {
    return;
  }

  Promise.resolve()
    .then(async () => {
      const detections = await state.scannerDetector.detect(elements.scannerVideo);
      if (!Array.isArray(detections) || detections.length === 0) {
        return;
      }

      const rawValue = String(detections[0]?.rawValue || '').trim();
      if (!rawValue) {
        return;
      }

      const now = Date.now();
      const sameAsPrevious = rawValue === state.scannerLastValue;
      const isCooldown = sameAsPrevious && (now - state.scannerLastScanAt) < 1200;
      if (isCooldown) {
        return;
      }

      state.scannerLastValue = rawValue;
      state.scannerLastScanAt = now;
      applyScannedCode(rawValue);
    })
    .catch(() => {
      // Ignore intermittent detector failures and keep scanning.
    })
    .finally(() => {
      if (state.scannerRunning) {
        state.scannerRafId = window.requestAnimationFrame(scanLoop);
      }
    });
}

function applyScannedCode(value) {
  const scannedValue = value.trim();
  if (!scannedValue) {
    return;
  }

  if (state.scanTarget === 'sku') {
    elements.itemSku.value = scannedValue;
    elements.scannerStatus.textContent = `Captured code for SKU: ${scannedValue}`;
    showToast('Code scanned into SKU.');
  } else {
    elements.searchInput.value = scannedValue;
    renderItems();
    elements.scannerStatus.textContent = `Captured code for search: ${scannedValue}`;
    showToast('Code scanned into search.');
  }

  stopScanner();
  closeModal('scanner-modal');
}

function clearDraftImage() {
  state.draftImageData = '';
  state.draftImagePreviewData = '';
  state.draftImageChanged = true;
  elements.itemImageInput.value = '';
  elements.itemImageCameraInput.value = '';
  renderItemImagePreview();
}

async function onItemImageSelected(event) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  if (!file.type.startsWith('image/')) {
    showToast('Only image files are allowed.', true);
    event.target.value = '';
    return;
  }

  const maxMb = 10;
  const maxBytes = maxMb * 1024 * 1024;
  if (file.size > maxBytes) {
    showToast(`Image is too large. Use a file under ${maxMb} MB.`, true);
    event.target.value = '';
    return;
  }

  try {
    const processed = await processImageUpload(file);
    state.draftImageData = processed.imageData;
    state.draftImagePreviewData = processed.imagePreviewData || processed.imageData;
    state.draftImageChanged = true;
    renderItemImagePreview();
    if (processed.optimized) {
      showToast('Photo optimized for faster loading.');
    }
  } catch (_error) {
    showToast('Could not load image.', true);
    event.target.value = '';
  }
}

async function processImageUpload(file) {
  const sourceDataUrl = await fileToDataUrl(file);
  const optimizedFull = await downscaleImageDataUrl(sourceDataUrl, IMAGE_PROCESS_MAX_SIDE, IMAGE_PROCESS_QUALITY);
  const optimizedPreview = await downscaleImageDataUrl(sourceDataUrl, IMAGE_PROCESS_PREVIEW_SIDE, IMAGE_PROCESS_PREVIEW_QUALITY);
  const optimized = optimizedFull.length < sourceDataUrl.length;

  return {
    imageData: optimizedFull || sourceDataUrl,
    imagePreviewData: optimizedPreview || optimizedFull || sourceDataUrl,
    optimized
  };
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = sanitizeImageData(String(reader.result || ''));
      if (!result) {
        reject(new Error('invalid image data'));
        return;
      }
      resolve(result);
    };
    reader.onerror = () => reject(new Error('failed reading file'));
    reader.readAsDataURL(file);
  });
}

function loadImageElement(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('failed loading image'));
    image.src = dataUrl;
  });
}

async function downscaleImageDataUrl(sourceDataUrl, maxSide, quality) {
  const image = await loadImageElement(sourceDataUrl);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (!width || !height) {
    return sourceDataUrl;
  }

  const longestSide = Math.max(width, height);
  const scale = longestSide > maxSide ? (maxSide / longestSide) : 1;
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const context = canvas.getContext('2d');
  if (!context) {
    return sourceDataUrl;
  }

  context.drawImage(image, 0, 0, targetWidth, targetHeight);
  return canvas.toDataURL('image/jpeg', quality);
}

function renderItemImagePreview() {
  const imageData = sanitizeImageData(state.draftImageData) || sanitizeImageData(state.draftImagePreviewData);

  if (!imageData) {
    elements.itemImagePreviewWrap.classList.add('hidden');
    elements.itemImagePreview.removeAttribute('src');
    return;
  }

  elements.itemImagePreview.src = imageData;
  elements.itemImagePreviewWrap.classList.remove('hidden');
}

function openStockModal(item) {
  elements.stockForm.reset();
  elements.stockItemId.value = item.id;
  elements.stockItemName.textContent = `${item.name} | Current quantity: ${item.quantity}`;
  elements.stockType.value = 'in';
  elements.stockQuantity.value = '1';

  openModal('stock-modal');
  elements.stockQuantity.focus();
}

function openHistoryModal(item) {
  state.historyItemId = item.id;
  elements.historyTitle.textContent = `Movement History | ${item.name}`;
  elements.historyList.innerHTML = '<p class="muted">Loading history...</p>';

  openModal('history-modal');
  window.inventoryAPI.getItemMovements(item.id);
}

function renderHistory(movements) {
  if (!Array.isArray(movements) || movements.length === 0) {
    elements.historyList.innerHTML = '<p class="muted">No stock movements yet for this item.</p>';
    return;
  }

  const actionLabel = {
    in: 'Stock In',
    out: 'Stock Out',
    set: 'Set Quantity'
  };

  elements.historyList.innerHTML = movements.map((entry) => {
    const type = entry.type || 'set';
    const badge = actionLabel[type] || 'Adjustment';
    const timestamp = new Date(entry.timestamp).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });

    const qtyText = type === 'in'
      ? `+${entry.quantity}`
      : type === 'out'
        ? `-${entry.quantity}`
        : `${entry.previousQuantity} -> ${entry.newQuantity}`;

    return `
      <article class="history-item ${type}">
        <div class="history-item-top">
          <span class="history-badge">${badge}</span>
          <time>${timestamp}</time>
        </div>
        <div class="history-qty">${qtyText}</div>
        <div class="history-meta">${entry.previousQuantity} -> ${entry.newQuantity}</div>
        <p>${escapeHtml(entry.reason || 'No reason provided')}</p>
      </article>
    `;
  }).join('');
}

function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) {
    return;
  }

  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (!modal) {
    return;
  }

  if (id === 'scanner-modal') {
    stopScanner();
    state.scanTarget = null;
  }

  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');

  if (id === 'history-modal') {
    state.historyItemId = null;
  }

  if (id === 'machine-modal') {
    resetMachineKitForm();
  }
}

function closeAllModals() {
  document.querySelectorAll('.modal.is-open').forEach((modal) => {
    closeModal(modal.id);
  });
}

function showToast(message, isError = false) {
  if (!message) {
    return;
  }

  elements.toast.textContent = message;
  elements.toast.classList.toggle('error', Boolean(isError));
  elements.toast.classList.add('show');

  window.clearTimeout(state.toastTimer);
  state.toastTimer = window.setTimeout(() => {
    elements.toast.classList.remove('show');
  }, 2200);
}
