// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer, webUtils } from 'electron';


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
    createBackup: (options) => ipcRenderer.invoke('backup-create', options),
    selectBackupFile: () => ipcRenderer.invoke('backup-select-file'),
    checkBackupFile: (options) => ipcRenderer.invoke('backup-check-file', options),
    restoreBackup: (options) => ipcRenderer.invoke('backup-restore', options),
    getPathForFile: (file) => webUtils.getPathForFile(file),
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

    // Y.Doc inspection
    inspectYDoc: (projectId) => ipcRenderer.invoke('ydoc-dump', projectId),

    // Snapshot management
    createSnapshot: (projectId) => ipcRenderer.invoke('snapshot-create', projectId),
    hydrateFromSnapshot: (projectId) => ipcRenderer.invoke('snapshot-hydrate', projectId),

    // Listeners for backend events
    onImportProgress: (callback) => ipcRenderer.on('import-assets-progress', callback),
    removeImportProgressListeners: () => ipcRenderer.removeAllListeners('import-assets-progress'),
    openPreview: (projectId) => ipcRenderer.send('open-preview', projectId)
});


