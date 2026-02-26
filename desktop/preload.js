const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tinyRemote', {
  onServerStatus: (cb) => {
    ipcRenderer.on('server-status', (_, data) => cb(data));
  },
  restartServers: () => ipcRenderer.invoke('restart-servers'),
  openInBrowser: (url) => ipcRenderer.invoke('open-in-browser', url),
  getStartupFolder: () => ipcRenderer.invoke('get-startup-folder'),
  getStartOnBoot: () => ipcRenderer.invoke('get-start-on-boot'),
  setStartOnBoot: (enable) => ipcRenderer.invoke('set-start-on-boot', enable),
});
