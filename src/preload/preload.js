// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from 'electron';


contextBridge.exposeInMainWorld('api', {
    executeGraphQL: (query, variables) => ipcRenderer.invoke('execute-graphql', { query, variables }),
    ping: () => ipcRenderer.invoke('ping'),
    exportTranslations: (filePath) => ipcRenderer.invoke('export-translations', filePath),
    importTranslations: (filePath) => ipcRenderer.invoke('import-translations', filePath)
});
