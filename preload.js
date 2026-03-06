const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('inventoryAPI', {
  getItems: () => ipcRenderer.send('get-items'),
  addItem: (data) => ipcRenderer.send('add-item', data),
  updateItem: (data) => ipcRenderer.send('update-item', data),
  deleteItem: (id) => ipcRenderer.send('delete-item', id),
  adjustStock: (data) => ipcRenderer.send('adjust-stock', data),
  getItemMovements: (itemId) => ipcRenderer.send('get-item-movements', itemId),
  createBackup: () => ipcRenderer.invoke('create-backup'),
  openBackupFolder: () => ipcRenderer.invoke('open-backup-folder'),
  getAppSettings: () => ipcRenderer.invoke('get-app-settings'),
  updateAppSettings: (data) => ipcRenderer.invoke('update-app-settings', data),

  onItemsList: (callback) => {
    ipcRenderer.removeAllListeners('items-list');
    ipcRenderer.on('items-list', (_event, data) => callback(data));
  },
  onItemsUpdated: (callback) => {
    ipcRenderer.removeAllListeners('items-updated');
    ipcRenderer.on('items-updated', (_event, data) => callback(data));
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
