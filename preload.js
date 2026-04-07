const { ipcRenderer } = require('electron');

window.electronAPI = {
  selectDownloadFolder: () => ipcRenderer.invoke('select-download-folder'),
};
