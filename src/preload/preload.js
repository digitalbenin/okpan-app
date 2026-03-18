// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer, webUtils } from 'electron';


contextBridge.exposeInMainWorld('api', {
    executeGraphQL: (query, variables, context) => ipcRenderer.invoke('execute-graphql', { query, variables, context }),
    ping: () => ipcRenderer.invoke('ping'),
    getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
    exportTranslations: (filePath) => ipcRenderer.invoke('export-translations', filePath),
    importTranslations: (filePath) => ipcRenderer.invoke('import-translations', filePath),
    exportLogs: (filePath) => ipcRenderer.invoke('export-logs', filePath),
    clearLogs: (filters) => ipcRenderer.invoke('clear-logs', filters),
    importAssets: (data) => ipcRenderer.invoke('import-assets', data),
    // Removed legacy exportProjectSql in favor of unified exportProject
    exportProject: (options) => ipcRenderer.invoke('export-project', options),
    exportConnections: (options) => ipcRenderer.invoke('export-connections', options),
    importConnections: (options) => ipcRenderer.invoke('import-connections', options),
    exportConnectionTypeCsv: (options) => ipcRenderer.invoke('export-connection-type-csv', options),
    importConnectionTypeCsv: (options) => ipcRenderer.invoke('import-connection-type-csv', options),
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
    getNetworkStatus: () => ipcRenderer.invoke('network-status:get'),
    getProjectPeers: (projectId) => ipcRenderer.invoke('get-project-peers', projectId),
    getProjectPresence: (projectId) => ipcRenderer.invoke('project-presence:get', projectId),
    getGlobalProfile: () => ipcRenderer.invoke('global-profile:get'),
    updateGlobalUsername: (username) => ipcRenderer.invoke('global-profile:update', username),

    // Y.Doc inspection
    inspectYDoc: (projectId) => ipcRenderer.invoke('ydoc-dump', projectId),

    // Project Sharing & Joining
    setProjectPassword: (projectId, password) => ipcRenderer.invoke('project-set-password', { projectId, password }),
    joinP2PProject: (projectId, password) => ipcRenderer.invoke('project-join-p2p', { projectId, password }),
    suspendP2PProject: (projectId) => ipcRenderer.invoke('project-suspend-p2p', projectId),
    reconnectP2PProject: (projectId, password) => ipcRenderer.invoke(
        'project-reconnect-p2p',
        password === undefined ? projectId : { projectId, password }
    ),

    // Snapshot management
    createSnapshot: (projectId) => ipcRenderer.invoke('snapshot-create', projectId),
    hydrateFromSnapshot: (projectId) => ipcRenderer.invoke('snapshot-hydrate', projectId),
    listRecoverySnapshots: (projectId) => ipcRenderer.invoke('recovery-snapshots-list', projectId),
    createRecoverySnapshot: (projectId, reason = null) => ipcRenderer.invoke('recovery-snapshots-create', { projectId, reason }),
    restoreRecoverySnapshot: (projectId, snapshotId) => ipcRenderer.invoke('recovery-snapshots-restore', { projectId, snapshotId }),

    // Listeners for backend events
    onDataChanged: (callback) => {
        const subscription = (event, ...args) => callback(...args);
        ipcRenderer.on('data-changed', subscription);
        return () => ipcRenderer.removeListener('data-changed', subscription);
    },
    onGlobalProfileChanged: (callback) => {
        const subscription = (event, ...args) => callback(...args);
        ipcRenderer.on('global-profile-changed', subscription);
        return () => ipcRenderer.removeListener('global-profile-changed', subscription);
    },
    onProjectPresenceChanged: (callback) => {
        const subscription = (event, ...args) => callback(...args);
        ipcRenderer.on('project-presence-changed', subscription);
        return () => ipcRenderer.removeListener('project-presence-changed', subscription);
    },
    onNetworkStatusChanged: (callback) => {
        const subscription = (event, ...args) => callback(...args);
        ipcRenderer.on('network-status-changed', subscription);
        return () => ipcRenderer.removeListener('network-status-changed', subscription);
    },
    onImportProgress: (callback) => ipcRenderer.on('import-assets-progress', callback),
    removeImportProgressListeners: () => ipcRenderer.removeAllListeners('import-assets-progress'),
    openPreview: (projectId) => ipcRenderer.send('open-preview', projectId),
    
    // Website export
    exportStaticWebsite: (options) => ipcRenderer.invoke('export-static-website', options),

    // Asset P2P sync
    getAssetSyncStatus: (projectId) => ipcRenderer.invoke('asset-sync-status', projectId),
    triggerAssetReconcile: (projectId, assetId = null) => ipcRenderer.invoke(
        'asset-sync-reconcile',
        assetId ? { projectId, assetId } : projectId
    ),
    onAssetSyncProgress: (callback) => {
        const subscription = (event, ...args) => callback(...args);
        ipcRenderer.on('asset-sync-progress', subscription);
        return () => ipcRenderer.removeListener('asset-sync-progress', subscription);
    }
});


