(function initWebBridge() {
  if (window.inventoryAPI) {
    return;
  }

  const listeners = {};

  function setListener(eventName, callback) {
    listeners[eventName] = callback;
  }

  function emit(eventName, payload) {
    const callback = listeners[eventName];
    if (typeof callback === 'function') {
      callback(payload);
    }
  }

  function emitError(message) {
    emit('item-error', { message });
  }

  async function request(path, options) {
    const response = await fetch(`/api${path}`, {
      method: options?.method || 'GET',
      headers: options?.body
        ? { 'Content-Type': 'application/json' }
        : undefined,
      body: options?.body ? JSON.stringify(options.body) : undefined
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || `Request failed (${response.status})`);
    }

    return payload;
  }

  function run(action) {
    Promise.resolve()
      .then(action)
      .catch((error) => {
        emitError(error.message || 'Action failed.');
      });
  }

  window.inventoryAPI = {
    getItems: function getItems() {
      run(async function loadItems() {
        const payload = await request('/items');
        emit('items-list', payload.items || []);
      });
    },
    getMachineKits: function getMachineKits() {
      run(async function loadMachineKits() {
        const payload = await request('/machine-kits');
        emit('machine-kits-list', payload.machineKits || []);
      });
    },
    getItemImage: async function getItemImage(itemId) {
      const payload = await request(`/items/${encodeURIComponent(itemId)}/image`);
      return {
        id: payload.id,
        imageData: payload.imageData || '',
        imagePreviewData: payload.imagePreviewData || '',
        hasImage: Boolean(payload.hasImage)
      };
    },
    addItem: function addItem(data) {
      run(async function createItem() {
        const payload = await request('/items', { method: 'POST', body: data });
        emit('item-saved', { type: 'add', item: payload.item });
        emit('items-updated', payload.items || []);
      });
    },
    updateItem: function updateItem(data) {
      run(async function saveItem() {
        const payload = await request(`/items/${encodeURIComponent(data.id)}`, { method: 'PUT', body: data });
        emit('item-saved', { type: 'update', item: payload.item });
        emit('items-updated', payload.items || []);
      });
    },
    deleteItem: function deleteItem(id) {
      run(async function removeItem() {
        const payload = await request(`/items/${encodeURIComponent(id)}`, { method: 'DELETE' });
        emit('item-deleted', { id: payload.id });
        emit('items-updated', payload.items || []);
        if (Array.isArray(payload.machineKits)) {
          emit('machine-kits-updated', payload.machineKits);
        }
      });
    },
    adjustStock: function adjustStock(data) {
      run(async function updateStock() {
        const payload = await request(`/items/${encodeURIComponent(data.id)}/adjust`, {
          method: 'POST',
          body: data
        });
        emit('stock-adjusted', { id: payload.id, quantity: payload.quantity });
        emit('items-updated', payload.items || []);
      });
    },
    addMachineKit: function addMachineKit(data) {
      run(async function createMachineKit() {
        const payload = await request('/machine-kits', { method: 'POST', body: data });
        emit('machine-kit-saved', { type: 'add', machineKit: payload.machineKit });
        emit('machine-kits-updated', payload.machineKits || []);
      });
    },
    updateMachineKit: function updateMachineKit(data) {
      run(async function saveMachineKit() {
        const payload = await request(`/machine-kits/${encodeURIComponent(data.id)}`, {
          method: 'PUT',
          body: data
        });
        emit('machine-kit-saved', { type: 'update', machineKit: payload.machineKit });
        emit('machine-kits-updated', payload.machineKits || []);
      });
    },
    deleteMachineKit: function deleteMachineKit(id) {
      run(async function removeMachineKit() {
        const payload = await request(`/machine-kits/${encodeURIComponent(id)}`, { method: 'DELETE' });
        emit('machine-kit-deleted', { id: payload.id });
        emit('machine-kits-updated', payload.machineKits || []);
      });
    },
    sellMachineKit: function sellMachineKit(data) {
      run(async function recordMachineSale() {
        const payload = await request(`/machine-kits/${encodeURIComponent(data.id)}/sell`, {
          method: 'POST',
          body: data
        });
        emit('machine-kit-sold', {
          id: payload.id,
          name: payload.name,
          quantity: payload.quantity
        });
        emit('items-updated', payload.items || []);
      });
    },
    getItemMovements: function getItemMovements(itemId) {
      run(async function loadMovements() {
        const payload = await request(`/items/${encodeURIComponent(itemId)}/movements`);
        emit('item-movements-list', { itemId: payload.itemId, movements: payload.movements || [] });
      });
    },
    createBackup: async function createBackup() {
      try {
        const payload = await request('/backup', { method: 'POST' });
        emit('backup-created', {
          mode: 'manual',
          filePath: payload.filePath,
          timestamp: new Date().toISOString()
        });
        return { canceled: false, success: true, filePath: payload.filePath };
      } catch (error) {
        return { canceled: false, success: false, error: error.message };
      }
    },
    openBackupFolder: async function openBackupFolder() {
      window.open('/api/backups', '_blank', 'noopener');
      return { path: '/api/backups' };
    },
    getAppSettings: async function getAppSettings() {
      const payload = await request('/settings');
      return payload.settings || {};
    },
    updateAppSettings: async function updateAppSettings(data) {
      const payload = await request('/settings', { method: 'PUT', body: data });
      emit('settings-updated', payload.settings || {});
      return payload.settings || {};
    },
    refreshItems: async function refreshItems(data) {
      const payload = await request('/refresh-items', { method: 'POST', body: data });
      emit('items-updated', payload.items || []);
      emit('machine-kits-updated', payload.machineKits || []);
      return {
        success: Boolean(payload.success),
        error: payload.error || '',
        itemCount: payload.itemCount || 0,
        movementCount: payload.movementCount || 0,
        machineKitCount: payload.machineKitCount || 0
      };
    },

    onItemsList: function onItemsList(callback) {
      setListener('items-list', callback);
    },
    onItemsUpdated: function onItemsUpdated(callback) {
      setListener('items-updated', callback);
    },
    onMachineKitsList: function onMachineKitsList(callback) {
      setListener('machine-kits-list', callback);
    },
    onMachineKitsUpdated: function onMachineKitsUpdated(callback) {
      setListener('machine-kits-updated', callback);
    },
    onMachineKitSaved: function onMachineKitSaved(callback) {
      setListener('machine-kit-saved', callback);
    },
    onMachineKitDeleted: function onMachineKitDeleted(callback) {
      setListener('machine-kit-deleted', callback);
    },
    onMachineKitSold: function onMachineKitSold(callback) {
      setListener('machine-kit-sold', callback);
    },
    onItemMovements: function onItemMovements(callback) {
      setListener('item-movements-list', callback);
    },
    onItemSaved: function onItemSaved(callback) {
      setListener('item-saved', callback);
    },
    onItemDeleted: function onItemDeleted(callback) {
      setListener('item-deleted', callback);
    },
    onStockAdjusted: function onStockAdjusted(callback) {
      setListener('stock-adjusted', callback);
    },
    onItemError: function onItemError(callback) {
      setListener('item-error', callback);
    },
    onBackupCreated: function onBackupCreated(callback) {
      setListener('backup-created', callback);
    },
    onSettingsUpdated: function onSettingsUpdated(callback) {
      setListener('settings-updated', callback);
    }
  };
})();
