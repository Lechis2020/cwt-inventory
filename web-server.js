const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const ROOT_DIR = __dirname;
const BASE_DATA_DIR = path.resolve(process.env.CWT_DATA_DIR || ROOT_DIR);
const SRC_DIR = path.join(ROOT_DIR, 'src');
const DATA_FILE = path.join(BASE_DATA_DIR, 'inventory-data.json');
const SETTINGS_FILE = path.join(BASE_DATA_DIR, 'app-settings.json');
const BACKUP_DIR = path.join(BASE_DATA_DIR, 'backups');
const AUTO_BACKUP_CHECK_INTERVAL_MS = 30 * 60 * 1000;

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';

let database = { items: [], movements: [] };
let appSettings = { companyName: 'CWT Inventory', lastAutoBackupDate: '' };

function createDefaultDatabase() {
  return { items: [], movements: [] };
}

function createDefaultSettings() {
  return { companyName: 'CWT Inventory', lastAutoBackupDate: '' };
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
    movements: Array.isArray(data.movements) ? data.movements : []
  };
}

function normalizeSettings(data) {
  if (!data || typeof data !== 'object') {
    return createDefaultSettings();
  }

  return {
    companyName: typeof data.companyName === 'string' && data.companyName.trim()
      ? data.companyName.trim()
      : 'CWT Inventory',
    lastAutoBackupDate: typeof data.lastAutoBackupDate === 'string'
      ? data.lastAutoBackupDate
      : ''
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

function saveDatabase() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(database, null, 2));
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

function saveSettings() {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(appSettings, null, 2));
}

function toClientItem(item, options = {}) {
  const includeImageData = options.includeImageData === true;
  const imageData = sanitizeImageData(item?.imageData);
  const imagePreviewData = sanitizeImageData(item?.imagePreviewData);
  const { imageData: _unusedImageData, imagePreviewData: _unusedImagePreviewData, ...rest } = item || {};

  const response = {
    ...rest,
    machines: sanitizeMachineList(item?.machines),
    sourceUrl: sanitizeSourceUrl(item?.sourceUrl),
    imagePreviewData,
    hasImage: Boolean(imageData || imagePreviewData)
  };

  if (includeImageData) {
    response.imageData = imageData;
  }

  return response;
}

function listClientItems(options = {}) {
  return database.items.map((item) => toClientItem(item, options));
}

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
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

function performBackup(mode = 'manual') {
  if (!fs.existsSync(DATA_FILE)) {
    saveDatabase();
  }

  ensureBackupDirectory();
  const fileName = createBackupFileName(mode === 'auto' ? 'cwt-inventory-auto-backup' : 'cwt-inventory-backup');
  const filePath = path.join(BACKUP_DIR, fileName);

  fs.copyFileSync(DATA_FILE, filePath);

  if (mode === 'auto') {
    appSettings.lastAutoBackupDate = getLocalDateStamp();
    saveSettings();
  }

  return {
    fileName,
    filePath
  };
}

function maybeRunAutomaticBackup() {
  try {
    const today = getLocalDateStamp();
    if (appSettings.lastAutoBackupDate === today) {
      return;
    }
    performBackup('auto');
    console.log('[backup] Daily backup created for', today);
  } catch (error) {
    console.error('[backup] Automatic backup failed:', error);
  }
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8'
  });
  res.end(JSON.stringify(payload));
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.js') return 'application/javascript; charset=utf-8';
  if (ext === '.json') return 'application/json; charset=utf-8';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.svg') return 'image/svg+xml';
  return 'application/octet-stream';
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk.toString('utf-8');
      if (raw.length > 10 * 1024 * 1024) {
        reject(new Error('Request body too large.'));
      }
    });
    req.on('end', () => {
      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch (_error) {
        reject(new Error('Invalid JSON payload.'));
      }
    });
    req.on('error', (error) => reject(error));
  });
}

function listBackups() {
  ensureBackupDirectory();

  return fs.readdirSync(BACKUP_DIR)
    .filter((name) => name.toLowerCase().endsWith('.json'))
    .map((name) => {
      const filePath = path.join(BACKUP_DIR, name);
      const stats = fs.statSync(filePath);
      return {
        name,
        size: stats.size,
        modifiedAt: stats.mtime.toISOString()
      };
    })
    .sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt));
}

function addItem(payload) {
  const name = (payload?.name || '').trim();
  if (!name) {
    return { error: 'Item name is required.' };
  }

  const sku = (payload?.sku || '').trim();
  const duplicate = database.items.some((item) => (item.sku || '').trim().toLowerCase() === sku.toLowerCase() && sku);
  if (duplicate) {
    return { error: 'SKU already exists. Use a unique SKU.' };
  }

  const quantity = Math.max(0, Math.floor(parseNumber(payload?.quantity, 0)));
  const reorderLevel = Math.max(0, Math.floor(parseNumber(payload?.reorderLevel, 0)));
  const unitPrice = Math.max(0, parseNumber(payload?.unitPrice, 0));
  const now = new Date().toISOString();

  const item = {
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

  database.items.push(item);
  database.movements.push({
    id: createId('move'),
    itemId: item.id,
    type: 'set',
    quantity,
    previousQuantity: 0,
    newQuantity: quantity,
    reason: 'Initial stock',
    timestamp: now
  });
  saveDatabase();

  return { item };
}

function updateItem(itemId, payload) {
  const item = database.items.find((entry) => entry.id === itemId);
  if (!item) {
    return { error: 'Item not found.' };
  }

  const name = (payload?.name || '').trim();
  if (!name) {
    return { error: 'Item name is required.' };
  }

  const sku = (payload?.sku || '').trim();
  const duplicate = database.items.some((entry) => {
    if (entry.id === itemId) {
      return false;
    }
    return (entry.sku || '').trim().toLowerCase() === sku.toLowerCase() && sku;
  });
  if (duplicate) {
    return { error: 'SKU already exists. Use a unique SKU.' };
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
  return { item };
}

function adjustStock(itemId, payload) {
  const item = database.items.find((entry) => entry.id === itemId);
  if (!item) {
    return { error: 'Item not found.' };
  }

  const type = payload?.type;
  const quantity = Math.max(0, Math.floor(parseNumber(payload?.quantity, 0)));
  const reason = (payload?.reason || '').trim() || 'Manual stock adjustment';

  if (!['in', 'out', 'set'].includes(type)) {
    return { error: 'Invalid stock adjustment type.' };
  }

  if (type !== 'set' && quantity <= 0) {
    return { error: 'Quantity must be greater than zero.' };
  }

  const previousQuantity = item.quantity;
  let newQuantity = previousQuantity;

  if (type === 'in') {
    newQuantity = previousQuantity + quantity;
  } else if (type === 'out') {
    if (quantity > previousQuantity) {
      return { error: 'Cannot remove more stock than available.' };
    }
    newQuantity = previousQuantity - quantity;
  } else {
    newQuantity = quantity;
  }

  const now = new Date().toISOString();
  item.quantity = newQuantity;
  item.updatedAt = now;

  database.movements.push({
    id: createId('move'),
    itemId: item.id,
    type,
    quantity: type === 'set' ? Math.abs(newQuantity - previousQuantity) : quantity,
    previousQuantity,
    newQuantity,
    reason,
    timestamp: now
  });

  saveDatabase();
  return { item };
}

async function handleApi(req, res, parsedUrl) {
  const pathname = parsedUrl.pathname;

  try {
    if (req.method === 'GET' && pathname === '/api/items') {
      const includeImageData = parsedUrl.searchParams.get('full') === '1';
      sendJson(res, 200, { items: listClientItems({ includeImageData }) });
      return;
    }

    if (req.method === 'POST' && pathname === '/api/items') {
      const payload = await readRequestBody(req);
      const result = addItem(payload);
      if (result.error) {
        sendJson(res, 400, { error: result.error });
        return;
      }
      sendJson(res, 200, {
        success: true,
        item: toClientItem(result.item, { includeImageData: true }),
        items: listClientItems()
      });
      return;
    }

    const updateMatch = pathname.match(/^\/api\/items\/([^/]+)$/);
    const imageMatch = pathname.match(/^\/api\/items\/([^/]+)\/image$/);
    if (imageMatch && req.method === 'GET') {
      const item = database.items.find((entry) => entry.id === imageMatch[1]);
      if (!item) {
        sendJson(res, 404, { error: 'Item not found.' });
        return;
      }
      sendJson(res, 200, {
        id: item.id,
        imageData: sanitizeImageData(item.imageData),
        imagePreviewData: sanitizeImageData(item.imagePreviewData),
        hasImage: Boolean(sanitizeImageData(item.imageData) || sanitizeImageData(item.imagePreviewData))
      });
      return;
    }

    if (updateMatch && req.method === 'PUT') {
      const payload = await readRequestBody(req);
      const result = updateItem(updateMatch[1], payload);
      if (result.error) {
        sendJson(res, 400, { error: result.error });
        return;
      }
      sendJson(res, 200, {
        success: true,
        item: toClientItem(result.item, { includeImageData: true }),
        items: listClientItems()
      });
      return;
    }

    if (updateMatch && req.method === 'DELETE') {
      const itemId = updateMatch[1];
      const before = database.items.length;
      database.items = database.items.filter((item) => item.id !== itemId);
      if (database.items.length === before) {
        sendJson(res, 404, { error: 'Item not found.' });
        return;
      }
      database.movements = database.movements.filter((movement) => movement.itemId !== itemId);
      saveDatabase();
      sendJson(res, 200, { success: true, id: itemId, items: listClientItems() });
      return;
    }

    const adjustMatch = pathname.match(/^\/api\/items\/([^/]+)\/adjust$/);
    if (adjustMatch && req.method === 'POST') {
      const payload = await readRequestBody(req);
      const result = adjustStock(adjustMatch[1], payload);
      if (result.error) {
        sendJson(res, 400, { error: result.error });
        return;
      }
      sendJson(res, 200, {
        success: true,
        id: result.item.id,
        quantity: result.item.quantity,
        items: listClientItems()
      });
      return;
    }

    const movementMatch = pathname.match(/^\/api\/items\/([^/]+)\/movements$/);
    if (movementMatch && req.method === 'GET') {
      const itemId = movementMatch[1];
      const movements = database.movements
        .filter((movement) => movement.itemId === itemId)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      sendJson(res, 200, { itemId, movements });
      return;
    }

    if (pathname === '/api/settings' && req.method === 'GET') {
      sendJson(res, 200, { settings: appSettings });
      return;
    }

    if (pathname === '/api/settings' && req.method === 'PUT') {
      const payload = await readRequestBody(req);
      appSettings = normalizeSettings({
        ...appSettings,
        companyName: payload?.companyName
      });
      saveSettings();
      sendJson(res, 200, { success: true, settings: appSettings });
      return;
    }

    if (pathname === '/api/backup' && req.method === 'POST') {
      const result = performBackup('manual');
      sendJson(res, 200, { success: true, mode: 'manual', fileName: result.fileName, filePath: result.filePath });
      return;
    }

    if (pathname === '/api/backups' && req.method === 'GET') {
      const backups = listBackups();
      sendJson(res, 200, { backups, folder: BACKUP_DIR });
      return;
    }

    sendJson(res, 404, { error: 'Not found.' });
  } catch (error) {
    console.error('API error:', error);
    sendJson(res, 500, { error: error.message || 'Unexpected server error.' });
  }
}

function handleStatic(res, pathname) {
  const relativePath = pathname === '/' ? 'index.html' : pathname.slice(1);
  const resolved = path.normalize(path.join(SRC_DIR, relativePath));
  if (!resolved.startsWith(SRC_DIR)) {
    sendJson(res, 403, { error: 'Forbidden.' });
    return;
  }

  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    sendJson(res, 404, { error: 'Not found.' });
    return;
  }

  res.writeHead(200, {
    'Content-Type': getMimeType(resolved)
  });
  fs.createReadStream(resolved).pipe(res);
}

function handleRequest(req, res) {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  if (pathname.startsWith('/api/')) {
    handleApi(req, res, parsedUrl);
    return;
  }

  handleStatic(res, pathname);
}

ensureDataDirectory();
loadDatabase();
loadSettings();
ensureBackupDirectory();
maybeRunAutomaticBackup();
setInterval(() => {
  maybeRunAutomaticBackup();
}, AUTO_BACKUP_CHECK_INTERVAL_MS);

const server = http.createServer(handleRequest);
server.listen(PORT, HOST, () => {
  console.log(`CWT Inventory web server running at http://localhost:${PORT}`);
  console.log(`Backups directory: ${BACKUP_DIR}`);
});
