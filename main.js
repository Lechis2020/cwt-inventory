const { app, BrowserWindow, ipcMain, session, dialog, shell } = require('electron');
const fs = require('fs');
const path = require('path');

const BASE_DATA_DIR = path.resolve(process.env.CWT_DATA_DIR || __dirname);
const DATA_FILE = path.join(BASE_DATA_DIR, 'inventory-data.json');
const SETTINGS_FILE = path.join(BASE_DATA_DIR, 'app-settings.json');
const BACKUP_DIR = path.join(BASE_DATA_DIR, 'backups');
const AUTO_BACKUP_CHECK_INTERVAL_MS = 30 * 60 * 1000;

let database = { items: [], movements: [], machineKits: [] };
let appSettings = { companyName: 'CWT Inventory', lastAutoBackupDate: '' };
let mainWindow;
let autoBackupTimer = null;

function createDefaultDatabase() {
  return {
    items: [],
    movements: [],
    machineKits: []
  };
}

function createDefaultSettings() {
  return {
    companyName: 'CWT Inventory',
    lastAutoBackupDate: ''
  };
}

function ensureDataDirectory() {
  if (!fs.existsSync(BASE_DATA_DIR)) {
    fs.mkdirSync(BASE_DATA_DIR, { recursive: true });
  }
}

function parseNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sanitizeImageData(imageData) {
  if (typeof imageData !== 'string') {
    return '';
  }

  const trimmed = imageData.trim();
  return trimmed.startsWith('data:image/') ? trimmed : '';
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
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

function sanitizeMachineKitName(name) {
  if (typeof name !== 'string') {
    return '';
  }

  return name.trim().replace(/\s+/g, ' ');
}

function sanitizeMachineKitComponents(components) {
  if (!Array.isArray(components)) {
    return [];
  }

  const totals = new Map();
  components.forEach((entry) => {
    if (!entry || typeof entry !== 'object') {
      return;
    }

    const itemId = typeof entry.itemId === 'string' ? entry.itemId.trim() : '';
    const quantity = Math.max(0, Math.floor(parseNumber(entry.quantity, 0)));
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

function normalizeMachineKit(rawMachineKit) {
  if (!rawMachineKit || typeof rawMachineKit !== 'object') {
    return null;
  }

  const name = sanitizeMachineKitName(rawMachineKit.name);
  if (!name) {
    return null;
  }

  const now = new Date().toISOString();
  return {
    id: typeof rawMachineKit.id === 'string' && rawMachineKit.id.trim()
      ? rawMachineKit.id.trim()
      : createId('machine'),
    name,
    components: sanitizeMachineKitComponents(rawMachineKit.components),
    createdAt: typeof rawMachineKit.createdAt === 'string' ? rawMachineKit.createdAt : now,
    updatedAt: typeof rawMachineKit.updatedAt === 'string' ? rawMachineKit.updatedAt : now
  };
}

function normalizeDatabase(data) {
  if (!data || typeof data !== 'object') {
    return createDefaultDatabase();
  }

  return {
    items: Array.isArray(data.items)
      ? data.items.map((item) => ({
        ...item,
        machines: sanitizeMachineList(item?.machines),
        sourceUrl: sanitizeSourceUrl(item?.sourceUrl),
        imageData: sanitizeImageData(item?.imageData),
        imagePreviewData: sanitizeImageData(item?.imagePreviewData)
      }))
      : [],
    movements: Array.isArray(data.movements) ? data.movements : [],
    machineKits: Array.isArray(data.machineKits)
      ? data.machineKits
        .map((machineKit) => normalizeMachineKit(machineKit))
        .filter(Boolean)
      : []
  };
}

function refreshItemsDatabase(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || !Array.isArray(snapshot.items)) {
    return { error: 'Invalid inventory backup file. Choose inventory-data.json.' };
  }

  database = normalizeDatabase(snapshot);
  saveDatabase();

  return {
    items: database.items,
    machineKits: database.machineKits,
    itemCount: database.items.length,
    movementCount: database.movements.length,
    machineKitCount: database.machineKits.length
  };
}

function normalizeSettings(data) {
  if (!data || typeof data !== 'object') {
    return createDefaultSettings();
  }

  const companyName = typeof data.companyName === 'string' && data.companyName.trim()
    ? data.companyName.trim()
    : 'CWT Inventory';
  const lastAutoBackupDate = typeof data.lastAutoBackupDate === 'string'
    ? data.lastAutoBackupDate
    : '';

  return {
    companyName,
    lastAutoBackupDate
  };
}

function loadDatabase() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      database = createDefaultDatabase();
      fs.writeFileSync(DATA_FILE, JSON.stringify(database, null, 2));
      return;
    }

    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    database = normalizeDatabase(JSON.parse(raw));
  } catch (error) {
    console.error('Failed to load inventory data:', error);
    database = createDefaultDatabase();
  }
}

function loadSettings() {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) {
      appSettings = createDefaultSettings();
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(appSettings, null, 2));
      return;
    }

    const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
    appSettings = normalizeSettings(JSON.parse(raw));
  } catch (error) {
    console.error('Failed to load app settings:', error);
    appSettings = createDefaultSettings();
  }
}

function saveDatabase() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(database, null, 2));
  } catch (error) {
    console.error('Failed to save inventory data:', error);
  }
}

function saveSettings() {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(appSettings, null, 2));
  } catch (error) {
    console.error('Failed to save app settings:', error);
  }
}

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function sendError(event, message) {
  event.reply('item-error', { message });
}

function getLocalDateStamp(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function ensureBackupDirectory() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

function createBackupFileName(prefix = 'cwt-inventory-backup') {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${prefix}-${timestamp}.json`;
}

function performBackup(options = {}) {
  const mode = options.mode || 'manual';
  const destinationPath = options.destinationPath;

  if (!fs.existsSync(DATA_FILE)) {
    saveDatabase();
  }

  const resolvedPath = destinationPath
    ? destinationPath
    : path.join(BACKUP_DIR, createBackupFileName(mode === 'auto' ? 'cwt-inventory-auto-backup' : 'cwt-inventory-backup'));

  if (!destinationPath) {
    ensureBackupDirectory();
  }

  fs.copyFileSync(DATA_FILE, resolvedPath);

  if (mode === 'auto') {
    appSettings.lastAutoBackupDate = getLocalDateStamp();
    saveSettings();
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('backup-created', {
      mode,
      filePath: resolvedPath,
      timestamp: new Date().toISOString(),
      lastAutoBackupDate: appSettings.lastAutoBackupDate
    });
  }

  return {
    mode,
    filePath: resolvedPath
  };
}

function maybeRunAutomaticBackup() {
  try {
    const today = getLocalDateStamp();
    if (appSettings.lastAutoBackupDate === today) {
      return;
    }
    performBackup({ mode: 'auto' });
  } catch (error) {
    console.error('Automatic backup failed:', error);
  }
}

function startAutomaticBackupSchedule() {
  maybeRunAutomaticBackup();

  if (autoBackupTimer) {
    clearInterval(autoBackupTimer);
  }

  autoBackupTimer = setInterval(() => {
    maybeRunAutomaticBackup();
  }, AUTO_BACKUP_CHECK_INTERVAL_MS);
}

function broadcastItems() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  mainWindow.webContents.send('items-updated', database.items);
}

function broadcastMachineKits() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  mainWindow.webContents.send('machine-kits-updated', database.machineKits);
}

function findItem(itemId) {
  return database.items.find((item) => item.id === itemId);
}

function findMachineKit(machineKitId) {
  return database.machineKits.find((machineKit) => machineKit.id === machineKitId);
}

function isDuplicateSku(sku, excludeId = null) {
  const normalizedSku = (sku || '').trim().toLowerCase();
  if (!normalizedSku) {
    return false;
  }

  return database.items.some((item) => {
    if (excludeId && item.id === excludeId) {
      return false;
    }
    return (item.sku || '').trim().toLowerCase() === normalizedSku;
  });
}

function isDuplicateMachineKitName(name, excludeId = null) {
  const normalizedName = sanitizeMachineKitName(name).toLowerCase();
  if (!normalizedName) {
    return false;
  }

  return database.machineKits.some((machineKit) => {
    if (excludeId && machineKit.id === excludeId) {
      return false;
    }
    return sanitizeMachineKitName(machineKit.name).toLowerCase() === normalizedName;
  });
}

function getMachineKitRequirements(machineKit, machineQuantity) {
  const requirements = [];

  for (const component of machineKit.components) {
    const item = findItem(component.itemId);
    if (!item) {
      return {
        error: `Machine "${machineKit.name}" references a missing item. Edit this machine and remove the missing part.`
      };
    }

    const requiredQuantity = component.quantity * machineQuantity;
    if (requiredQuantity > item.quantity) {
      return {
        error: `Not enough stock for "${item.name}". Need ${requiredQuantity}, available ${item.quantity}.`
      };
    }

    requirements.push({
      item,
      requiredQuantity
    });
  }

  return { requirements };
}

function applyMachineSale(machineKit, machineQuantity, reasonInput = '') {
  const machineName = sanitizeMachineKitName(machineKit?.name);
  if (!machineName) {
    return { error: 'Machine not found.' };
  }

  const normalizedQuantity = Math.max(0, Math.floor(parseNumber(machineQuantity, 0)));
  if (normalizedQuantity <= 0) {
    return { error: 'Machine quantity must be greater than zero.' };
  }

  const components = sanitizeMachineKitComponents(machineKit?.components);
  if (components.length === 0) {
    return { error: 'This machine has no linked inventory items.' };
  }

  const machineWithSafeComponents = {
    ...machineKit,
    name: machineName,
    components
  };

  const requirementsResult = getMachineKitRequirements(machineWithSafeComponents, normalizedQuantity);
  if (requirementsResult.error) {
    return requirementsResult;
  }

  const now = new Date().toISOString();
  const reason = (reasonInput || '').trim() || `Machine sold: ${machineName} x${normalizedQuantity}`;

  requirementsResult.requirements.forEach(({ item, requiredQuantity }) => {
    const previousQuantity = item.quantity;
    const newQuantity = previousQuantity - requiredQuantity;
    item.quantity = newQuantity;
    item.updatedAt = now;

    database.movements.push({
      id: createId('move'),
      itemId: item.id,
      type: 'out',
      quantity: requiredQuantity,
      previousQuantity,
      newQuantity,
      reason,
      machineKitId: machineKit.id,
      machineKitName: machineName,
      machineQuantity: normalizedQuantity,
      timestamp: now
    });
  });

  return {
    machineQuantity: normalizedQuantity,
    reason
  };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      sandbox: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
}

app.whenReady().then(() => {
  ensureDataDirectory();
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    if (permission === 'media') {
      callback(true);
      return;
    }
    callback(false);
  });

  loadDatabase();
  loadSettings();
  ensureBackupDirectory();
  startAutomaticBackupSchedule();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (autoBackupTimer) {
    clearInterval(autoBackupTimer);
    autoBackupTimer = null;
  }
});

ipcMain.on('get-items', (event) => {
  event.reply('items-list', database.items);
});

ipcMain.on('get-machine-kits', (event) => {
  event.reply('machine-kits-list', database.machineKits);
});

ipcMain.on('add-item', (event, payload) => {
  const name = (payload?.name || '').trim();
  if (!name) {
    sendError(event, 'Item name is required.');
    return;
  }

  const sku = (payload?.sku || '').trim();
  if (isDuplicateSku(sku)) {
    sendError(event, 'SKU already exists. Use a unique SKU.');
    return;
  }

  const quantity = Math.max(0, Math.floor(parseNumber(payload?.quantity, 0)));
  const reorderLevel = Math.max(0, Math.floor(parseNumber(payload?.reorderLevel, 0)));
  const unitPrice = Math.max(0, parseNumber(payload?.unitPrice, 0));
  const now = new Date().toISOString();

  const newItem = {
    id: createId('item'),
    name,
    sku,
    category: (payload?.category || '').trim(),
    location: (payload?.location || '').trim(),
    machines: sanitizeMachineList(payload?.machines),
    sourceUrl: sanitizeSourceUrl(payload?.sourceUrl),
    imageData: sanitizeImageData(payload?.imageData),
    imagePreviewData: sanitizeImageData(payload?.imagePreviewData),
    quantity,
    reorderLevel,
    unitPrice,
    notes: (payload?.notes || '').trim(),
    createdAt: now,
    updatedAt: now
  };

  database.items.push(newItem);
  database.movements.push({
    id: createId('move'),
    itemId: newItem.id,
    type: 'set',
    quantity,
    previousQuantity: 0,
    newQuantity: quantity,
    reason: 'Initial stock',
    timestamp: now
  });

  saveDatabase();
  event.reply('item-saved', { type: 'add', item: newItem });
  broadcastItems();
});

ipcMain.on('update-item', (event, payload) => {
  const itemId = payload?.id;
  const item = findItem(itemId);

  if (!item) {
    sendError(event, 'Item not found.');
    return;
  }

  const name = (payload?.name || '').trim();
  if (!name) {
    sendError(event, 'Item name is required.');
    return;
  }

  const sku = (payload?.sku || '').trim();
  if (isDuplicateSku(sku, itemId)) {
    sendError(event, 'SKU already exists. Use a unique SKU.');
    return;
  }

  item.name = name;
  item.sku = sku;
  item.category = (payload?.category || '').trim();
  item.location = (payload?.location || '').trim();
  item.machines = sanitizeMachineList(payload?.machines);
  item.sourceUrl = sanitizeSourceUrl(payload?.sourceUrl);
  const hasImageFields = hasOwn(payload, 'imageData') || hasOwn(payload, 'imagePreviewData');
  const shouldUpdateImage = payload?.imageUpdated === true || (payload?.imageUpdated == null && hasImageFields);
  if (shouldUpdateImage) {
    item.imageData = sanitizeImageData(payload?.imageData);
    item.imagePreviewData = sanitizeImageData(payload?.imagePreviewData);
  }
  item.reorderLevel = Math.max(0, Math.floor(parseNumber(payload?.reorderLevel, 0)));
  item.unitPrice = Math.max(0, parseNumber(payload?.unitPrice, 0));
  item.notes = (payload?.notes || '').trim();
  item.updatedAt = new Date().toISOString();

  saveDatabase();
  event.reply('item-saved', { type: 'update', item });
  broadcastItems();
});

ipcMain.on('delete-item', (event, itemId) => {
  const beforeCount = database.items.length;
  database.items = database.items.filter((item) => item.id !== itemId);

  if (database.items.length === beforeCount) {
    sendError(event, 'Item not found.');
    return;
  }

  database.movements = database.movements.filter((movement) => movement.itemId !== itemId);

  let machineKitsChanged = false;
  database.machineKits = database.machineKits
    .map((machineKit) => {
      const filteredComponents = machineKit.components.filter((component) => component.itemId !== itemId);
      if (filteredComponents.length !== machineKit.components.length) {
        machineKitsChanged = true;
        return {
          ...machineKit,
          components: filteredComponents,
          updatedAt: new Date().toISOString()
        };
      }
      return machineKit;
    })
    .filter((machineKit) => {
      if (machineKit.components.length === 0) {
        machineKitsChanged = true;
        return false;
      }
      return true;
    });

  saveDatabase();
  event.reply('item-deleted', { id: itemId });
  broadcastItems();
  if (machineKitsChanged) {
    broadcastMachineKits();
  }
});

ipcMain.on('adjust-stock', (event, payload) => {
  const item = findItem(payload?.id);
  if (!item) {
    sendError(event, 'Item not found.');
    return;
  }

  const type = payload?.type;
  const rawQuantity = Math.floor(parseNumber(payload?.quantity, 0));
  const quantity = Math.max(0, rawQuantity);
  const reason = (payload?.reason || '').trim() || 'Manual stock adjustment';

  if (!['in', 'out', 'set'].includes(type)) {
    sendError(event, 'Invalid stock adjustment type.');
    return;
  }

  if (type !== 'set' && quantity <= 0) {
    sendError(event, 'Quantity must be greater than zero.');
    return;
  }

  const previousQuantity = item.quantity;
  let nextQuantity = previousQuantity;

  if (type === 'in') {
    nextQuantity = previousQuantity + quantity;
  } else if (type === 'out') {
    if (quantity > previousQuantity) {
      sendError(event, 'Cannot remove more stock than available.');
      return;
    }
    nextQuantity = previousQuantity - quantity;
  } else {
    nextQuantity = quantity;
  }

  const now = new Date().toISOString();
  item.quantity = nextQuantity;
  item.updatedAt = now;

  database.movements.push({
    id: createId('move'),
    itemId: item.id,
    type,
    quantity: type === 'set' ? Math.abs(nextQuantity - previousQuantity) : quantity,
    previousQuantity,
    newQuantity: nextQuantity,
    reason,
    timestamp: now
  });

  saveDatabase();
  event.reply('stock-adjusted', { id: item.id, quantity: nextQuantity });
  broadcastItems();
});

ipcMain.on('add-machine-kit', (event, payload) => {
  const name = sanitizeMachineKitName(payload?.name);
  if (!name) {
    sendError(event, 'Machine name is required.');
    return;
  }
  if (isDuplicateMachineKitName(name)) {
    sendError(event, 'Machine already exists. Use a unique machine name.');
    return;
  }

  const components = sanitizeMachineKitComponents(payload?.components);
  if (components.length === 0) {
    sendError(event, 'Add at least one inventory item to this machine.');
    return;
  }

  const missingComponent = components.find((component) => !findItem(component.itemId));
  if (missingComponent) {
    sendError(event, 'One or more linked items no longer exist. Refresh and try again.');
    return;
  }

  const now = new Date().toISOString();
  const machineKit = {
    id: createId('machine'),
    name,
    components,
    createdAt: now,
    updatedAt: now
  };

  database.machineKits.push(machineKit);
  saveDatabase();
  event.reply('machine-kit-saved', { type: 'add', machineKit });
  broadcastMachineKits();
});

ipcMain.on('update-machine-kit', (event, payload) => {
  const machineKitId = payload?.id;
  const machineKit = findMachineKit(machineKitId);
  if (!machineKit) {
    sendError(event, 'Machine not found.');
    return;
  }

  const name = sanitizeMachineKitName(payload?.name);
  if (!name) {
    sendError(event, 'Machine name is required.');
    return;
  }
  if (isDuplicateMachineKitName(name, machineKitId)) {
    sendError(event, 'Machine already exists. Use a unique machine name.');
    return;
  }

  const components = sanitizeMachineKitComponents(payload?.components);
  if (components.length === 0) {
    sendError(event, 'Add at least one inventory item to this machine.');
    return;
  }

  const missingComponent = components.find((component) => !findItem(component.itemId));
  if (missingComponent) {
    sendError(event, 'One or more linked items no longer exist. Refresh and try again.');
    return;
  }

  machineKit.name = name;
  machineKit.components = components;
  machineKit.updatedAt = new Date().toISOString();

  saveDatabase();
  event.reply('machine-kit-saved', { type: 'update', machineKit });
  broadcastMachineKits();
});

ipcMain.on('delete-machine-kit', (event, machineKitId) => {
  const beforeCount = database.machineKits.length;
  database.machineKits = database.machineKits.filter((machineKit) => machineKit.id !== machineKitId);

  if (database.machineKits.length === beforeCount) {
    sendError(event, 'Machine not found.');
    return;
  }

  saveDatabase();
  event.reply('machine-kit-deleted', { id: machineKitId });
  broadcastMachineKits();
});

ipcMain.on('sell-machine-kit', (event, payload) => {
  const machineKit = findMachineKit(payload?.id);
  if (!machineKit) {
    sendError(event, 'Machine not found.');
    return;
  }

  const saleResult = applyMachineSale(machineKit, payload?.quantity, payload?.reason);
  if (saleResult.error) {
    sendError(event, saleResult.error);
    return;
  }

  saveDatabase();
  event.reply('machine-kit-sold', {
    id: machineKit.id,
    name: machineKit.name,
    quantity: saleResult.machineQuantity
  });
  broadcastItems();
});

ipcMain.on('get-item-movements', (event, itemId) => {
  const movements = database.movements
    .filter((movement) => movement.itemId === itemId)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  event.reply('item-movements-list', { itemId, movements });
});

ipcMain.handle('get-item-image', async (_event, itemId) => {
  const item = findItem(itemId);
  if (!item) {
    return { id: itemId, imageData: '', imagePreviewData: '', hasImage: false };
  }

  const imageData = sanitizeImageData(item.imageData);
  const imagePreviewData = sanitizeImageData(item.imagePreviewData);
  return {
    id: item.id,
    imageData,
    imagePreviewData,
    hasImage: Boolean(imageData || imagePreviewData)
  };
});

ipcMain.handle('create-backup', async () => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Save Backup',
      defaultPath: path.join(BACKUP_DIR, createBackupFileName()),
      filters: [
        { name: 'JSON', extensions: ['json'] }
      ]
    });

    if (result.canceled || !result.filePath) {
      return { canceled: true };
    }

    const backupResult = performBackup({ mode: 'manual', destinationPath: result.filePath });
    return {
      canceled: false,
      success: true,
      filePath: backupResult.filePath
    };
  } catch (error) {
    console.error('Manual backup failed:', error);
    return {
      canceled: false,
      success: false,
      error: error.message
    };
  }
});

ipcMain.handle('open-backup-folder', async () => {
  ensureBackupDirectory();
  await shell.openPath(BACKUP_DIR);
  return { path: BACKUP_DIR };
});

ipcMain.handle('get-app-settings', async () => {
  return appSettings;
});

ipcMain.handle('update-app-settings', async (_event, payload) => {
  appSettings = normalizeSettings({
    ...appSettings,
    companyName: payload?.companyName
  });
  saveSettings();

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('settings-updated', appSettings);
  }

  return appSettings;
});

ipcMain.handle('refresh-items', async (_event, payload) => {
  const result = refreshItemsDatabase(payload);
  if (result.error) {
    return {
      success: false,
      error: result.error
    };
  }

  broadcastItems();
  broadcastMachineKits();

  return {
    success: true,
    items: result.items,
    machineKits: result.machineKits,
    itemCount: result.itemCount,
    movementCount: result.movementCount,
    machineKitCount: result.machineKitCount
  };
});
