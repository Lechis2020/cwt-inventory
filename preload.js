const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('inventoryAPI', {
  getItems: () => ipcRenderer.send('get-items'),
  getMachineKits: () => ipcRenderer.send('get-machine-kits'),
  getItemImage: (itemId) => ipcRenderer.invoke('get-item-image', itemId),
  addItem: (data) => ipcRenderer.send('add-item', data),
  updateItem: (data) => ipcRenderer.send('update-item', data),
  deleteItem: (id) => ipcRenderer.send('delete-item', id),
  adjustStock: (data) => ipcRenderer.send('adjust-stock', data),
  addMachineKit: (data) => ipcRenderer.send('add-machine-kit', data),
  updateMachineKit: (data) => ipcRenderer.send('update-machine-kit', data),
  deleteMachineKit: (id) => ipcRenderer.send('delete-machine-kit', id),
  sellMachineKit: (data) => ipcRenderer.send('sell-machine-kit', data),
  getItemMovements: (itemId) => ipcRenderer.send('get-item-movements', itemId),
  createBackup: () => ipcRenderer.invoke('create-backup'),
  openBackupFolder: () => ipcRenderer.invoke('open-backup-folder'),
  getAppSettings: () => ipcRenderer.invoke('get-app-settings'),
  updateAppSettings: (data) => ipcRenderer.invoke('update-app-settings', data),
  refreshItems: (data) => ipcRenderer.invoke('refresh-items', data),

  onItemsList: (callback) => {
    ipcRenderer.removeAllListeners('items-list');
    ipcRenderer.on('items-list', (_event, data) => callback(data));
  },
  onItemsUpdated: (callback) => {
    ipcRenderer.removeAllListeners('items-updated');
    ipcRenderer.on('items-updated', (_event, data) => callback(data));
  },
  onMachineKitsList: (callback) => {
    ipcRenderer.removeAllListeners('machine-kits-list');
    ipcRenderer.on('machine-kits-list', (_event, data) => callback(data));
  },
  onMachineKitsUpdated: (callback) => {
    ipcRenderer.removeAllListeners('machine-kits-updated');
    ipcRenderer.on('machine-kits-updated', (_event, data) => callback(data));
  },
  onMachineKitSaved: (callback) => {
    ipcRenderer.removeAllListeners('machine-kit-saved');
    ipcRenderer.on('machine-kit-saved', (_event, data) => callback(data));
  },
  onMachineKitDeleted: (callback) => {
    ipcRenderer.removeAllListeners('machine-kit-deleted');
    ipcRenderer.on('machine-kit-deleted', (_event, data) => callback(data));
  },
  onMachineKitSold: (callback) => {
    ipcRenderer.removeAllListeners('machine-kit-sold');
    ipcRenderer.on('machine-kit-sold', (_event, data) => callback(data));
  },
  onItemMovements: (callback) => {
    ipcRenderer.removeAllListeners('item-movements-list');
    ipcRenderer.on('item-movements-list', (_event, data) => callback(data));
  },
  onItemSaved: (callback) => {
    ipcRenderer.removeAllListeners('item-saved');
    ipcRenderer.on('item-saved', (_event, data) => callback(data));
  },
  onItemDeleted: (callback) => {
    ipcRenderer.removeAllListeners('item-deleted');
    ipcRenderer.on('item-deleted', (_event, data) => callback(data));
  },
  onStockAdjusted: (callback) => {
    ipcRenderer.removeAllListeners('stock-adjusted');
    ipcRenderer.on('stock-adjusted', (_event, data) => callback(data));
  },
  onItemError: (callback) => {
    ipcRenderer.removeAllListeners('item-error');
    ipcRenderer.on('item-error', (_event, data) => callback(data));
  },
  onBackupCreated: (callback) => {
    ipcRenderer.removeAllListeners('backup-created');
    ipcRenderer.on('backup-created', (_event, data) => callback(data));
  },
  onSettingsUpdated: (callback) => {
    ipcRenderer.removeAllListeners('settings-updated');
    ipcRenderer.on('settings-updated', (_event, data) => callback(data));
  }
});
