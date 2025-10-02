// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from 'electron';


contextBridge.exposeInMainWorld('api', {
    executeGraphQL: (query, variables, context) => ipcRenderer.invoke('execute-graphql', { query, variables, context }),
    ping: () => ipcRenderer.invoke('ping'),
    exportTranslations: (filePath) => ipcRenderer.invoke('export-translations', filePath),
    importTranslations: (filePath) => ipcRenderer.invoke('import-translations', filePath),
    exportLogs: (filePath) => ipcRenderer.invoke('export-logs', filePath),
    clearLogs: (filters) => ipcRenderer.invoke('clear-logs', filters),
    importAssets: (data) => ipcRenderer.invoke('import-assets', data),
    // Removed legacy exportProjectSql in favor of unified exportProject
    exportProject: (options) => ipcRenderer.invoke('export-project', options),
    openFileDialog: (options) => ipcRenderer.invoke('open-file-dialog', options),
    readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
    importStructuredData: (options) => ipcRenderer.invoke('import-structured-data', options),
    excelSheetSelection: (options) => ipcRenderer.invoke('excel-sheet-selection', options),
    suggestObjectMatches: (assets, options) => ipcRenderer.invoke('suggest-object-matches', assets, options),
    suggestFieldMappings: (csvFieldNames, options) => ipcRenderer.invoke('suggest-field-mappings', csvFieldNames, options),
    suggestTemplateReuse: (inputHeaders, projectId) => ipcRenderer.invoke('suggest-template-reuse', inputHeaders, projectId),
    // Languages
    getLanguages: (lang = 'en') => ipcRenderer.invoke('languages:list', { lang }),

    // Embedding methods
    computeAllMissingEmbeddings: () => ipcRenderer.invoke('compute-all-missing-embeddings'),

    // Project cache methods
    setCurrentProject: (projectId) => ipcRenderer.invoke('set-current-project', projectId),
    getCurrentProject: () => ipcRenderer.invoke('get-current-project'),
    clearCurrentProject: () => ipcRenderer.invoke('clear-current-project'),

    // Listeners for backend events
    onImportProgress: (callback) => ipcRenderer.on('import-assets-progress', callback),
    removeImportProgressListeners: () => ipcRenderer.removeAllListeners('import-assets-progress'),
});
