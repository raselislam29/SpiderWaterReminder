const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('swr', {
  getState: () => ipcRenderer.invoke('state:get'),
  setState: (partial) => ipcRenderer.invoke('state:set', partial),
  setReminder: (partial) => ipcRenderer.invoke('reminder:set', partial),
  clearReminder: () => ipcRenderer.invoke('reminder:clear'),
  testReminder: () => ipcRenderer.invoke('reminder:test'),
  toggleActive: (isActive) => ipcRenderer.invoke('reminder:toggle', isActive),
  dismissOverlay: () => ipcRenderer.send('overlay:dismiss'),
  reportHeight: (px) => ipcRenderer.send('popup:height', px),
  onOverlayShow: (cb) => {
    const handler = (_e, payload) => cb(payload);
    ipcRenderer.on('overlay:show', handler);
    return () => ipcRenderer.removeListener('overlay:show', handler);
  },
  onOverlayLeave: (cb) => {
    const handler = () => cb();
    ipcRenderer.on('overlay:leave', handler);
    return () => ipcRenderer.removeListener('overlay:leave', handler);
  },
  onState: (cb) => {
    const handler = (_e, state) => cb(state);
    ipcRenderer.on('state:updated', handler);
    return () => ipcRenderer.removeListener('state:updated', handler);
  },
  onStatusTick: (cb) => {
    const handler = (_e, statusText) => cb(statusText);
    ipcRenderer.on('status:tick', handler);
    return () => ipcRenderer.removeListener('status:tick', handler);
  },
});

