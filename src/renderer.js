const state = {
  items: [],
  historyItemId: null,
  draftImageData: '',
  draftMachines: [],
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

document.addEventListener('DOMContentLoaded', () => {
  cacheElements();
  bindEvents();
  bindIpc();
  window.inventoryAPI.getItems();
  loadAppSettings();
});

function cacheElements() {
  elements.inventoryTitle = document.getElementById('inventory-title');
  elements.backupNowBtn = document.getElementById('backup-now-btn');
  elements.openSettingsBtn = document.getElementById('open-settings-btn');
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
  elements.backupInfo = document.getElementById('backup-info');

  elements.toast = document.getElementById('toast');
}

function bindEvents() {
  document.getElementById('open-item-modal-btn').addEventListener('click', () => {
    openItemModal();
  });
  elements.backupNowBtn.addEventListener('click', onBackupNowClicked);
  elements.openSettingsBtn.addEventListener('click', openSettingsModal);
  elements.settingsForm.addEventListener('submit', onSettingsFormSubmit);
  elements.openBackupsFolderBtn.addEventListener('click', onOpenBackupsFolderClicked);

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
    renderAll();
  });

  window.inventoryAPI.onItemsUpdated((items) => {
    state.items = normalizeItems(items);
    renderAll();
  });

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
    notes: item.notes || '',
    quantity: Math.max(0, Math.floor(toNumber(item.quantity, 0))),
    reorderLevel: Math.max(0, Math.floor(toNumber(item.reorderLevel, 0))),
    unitPrice: Math.max(0, toNumber(item.unitPrice, 0))
  }));
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

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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

    row.innerHTML = `
      <td>
        <div class="item-cell">
          ${item.imageData
            ? `<img class="item-thumb" src="${item.imageData}" alt="${escapeHtml(item.name)} picture">`
            : '<div class="item-thumb placeholder">No image</div>'}
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
    notes: elements.itemNotes.value.trim(),
    imageData: state.draftImageData
  };

  if (payload.id) {
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
  }

  renderDraftMachines();
  renderItemImagePreview();
  openModal('item-modal');
  elements.itemName.focus();
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
    clearDraftImage();
    return;
  }

  const maxMb = 10;
  const maxBytes = maxMb * 1024 * 1024;
  if (file.size > maxBytes) {
    showToast(`Image is too large. Use a file under ${maxMb} MB.`, true);
    clearDraftImage();
    return;
  }

  try {
    state.draftImageData = await fileToDataUrl(file);
    renderItemImagePreview();
  } catch (_error) {
    showToast('Could not load image.', true);
    clearDraftImage();
  }
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

function renderItemImagePreview() {
  const imageData = sanitizeImageData(state.draftImageData);

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
