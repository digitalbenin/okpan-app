/**
 * Preload script — runs in a privileged context between the main and renderer processes.
 * Exposes a curated API to the renderer via `contextBridge` so the renderer never
 * needs direct access to Node.js or Electron internals.
 *
 * All two-way calls use `ipcRenderer.invoke` (request/response).
 * Fire-and-forget notifications use `ipcRenderer.send`.
 * Event subscriptions return an unsubscribe function so callers can clean up.
 *
 * @see https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
 */
import { contextBridge, ipcRenderer, webUtils } from 'electron';

contextBridge.exposeInMainWorld('api', {
    // ─── Core ─────────────────────────────────────────────────────────────────

    executeGraphQL: (query, variables, context) => ipcRenderer.invoke('execute-graphql', { query, variables, context }),
    ping: () => ipcRenderer.invoke('ping'),
    getSystemInfo: () => ipcRenderer.invoke('get-system-info'),

    // ─── File operations ──────────────────────────────────────────────────────

    /** Returns the native filesystem path for a File object. Synchronous — uses webUtils, not IPC. */
    getPathForFile: (file) => webUtils.getPathForFile(file),
    openFileDialog: (options) => ipcRenderer.invoke('open-file-dialog', options),
    readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),

    // ─── Import / Export ──────────────────────────────────────────────────────

    importAssets: (data) => ipcRenderer.invoke('import-assets', data),
    importTranslations: (filePath) => ipcRenderer.invoke('import-translations', filePath),
    exportTranslations: (filePath) => ipcRenderer.invoke('export-translations', filePath),
    importStructuredData: (options) => ipcRenderer.invoke('import-structured-data', options),
    excelSheetSelection: (options) => ipcRenderer.invoke('excel-sheet-selection', options),
    exportProject: (options) => ipcRenderer.invoke('export-project', options),
    exportConnections: (options) => ipcRenderer.invoke('export-connections', options),
    importConnections: (options) => ipcRenderer.invoke('import-connections', options),
    exportConnectionTypeCsv: (options) => ipcRenderer.invoke('export-connection-type-csv', options),
    importConnectionTypeCsv: (options) => ipcRenderer.invoke('import-connection-type-csv', options),

    // ─── Backup ───────────────────────────────────────────────────────────────

    createBackup: (options) => ipcRenderer.invoke('backup-create', options),
    selectBackupFile: () => ipcRenderer.invoke('backup-select-file'),
    checkBackupFile: (options) => ipcRenderer.invoke('backup-check-file', options),
    restoreBackup: (options) => ipcRenderer.invoke('backup-restore', options),

    // ─── AI suggestions ───────────────────────────────────────────────────────

    suggestObjectMatches: (assets, options) => ipcRenderer.invoke('suggest-object-matches', assets, options),
    suggestFieldMappings: (csvFieldNames, options) => ipcRenderer.invoke('suggest-field-mappings', csvFieldNames, options),
    suggestTemplateReuse: (inputHeaders, projectId) => ipcRenderer.invoke('suggest-template-reuse', inputHeaders, projectId),

    // ─── Settings & profile ───────────────────────────────────────────────────

    getLanguages: (lang = 'en') => ipcRenderer.invoke('languages:list', { lang }),
    getGlobalSettings: () => ipcRenderer.invoke('global-settings:get'),
    updateGlobalInterfaceLanguage: (locale) => ipcRenderer.invoke('global-settings:update-interface-language', locale),
    getGlobalProfile: () => ipcRenderer.invoke('global-profile:get'),
    updateGlobalUsername: (username) => ipcRenderer.invoke('global-profile:update', username),

    // ─── Embeddings ───────────────────────────────────────────────────────────

    computeAllMissingEmbeddings: () => ipcRenderer.invoke('compute-all-missing-embeddings'),

    // ─── Project session ──────────────────────────────────────────────────────

    setCurrentProject: (projectId) => ipcRenderer.invoke('set-current-project', projectId),
    getCurrentProject: () => ipcRenderer.invoke('get-current-project'),
    clearCurrentProject: () => ipcRenderer.invoke('clear-current-project'),

    // ─── P2P & networking ─────────────────────────────────────────────────────

    getNetworkStatus: () => ipcRenderer.invoke('network-status:get'),
    getProjectPeers: (projectId) => ipcRenderer.invoke('get-project-peers', projectId),
    getProjectPresence: (projectId) => ipcRenderer.invoke('project-presence:get', projectId),
    setProjectPassword: (projectId, password) => ipcRenderer.invoke('project-set-password', { projectId, password }),
    joinP2PProject: (projectId, password) => ipcRenderer.invoke('project-join-p2p', { projectId, password }),
    suspendP2PProject: (projectId) => ipcRenderer.invoke('project-suspend-p2p', projectId),
    reconnectP2PProject: (projectId, password) => ipcRenderer.invoke('project-reconnect-p2p', { projectId, password }),

    // ─── Snapshots ────────────────────────────────────────────────────────────

    createSnapshot: (projectId) => ipcRenderer.invoke('snapshot-create', projectId),
    hydrateFromSnapshot: (projectId) => ipcRenderer.invoke('snapshot-hydrate', projectId),
    listRecoverySnapshots: (projectId) => ipcRenderer.invoke('recovery-snapshots-list', projectId),
    createRecoverySnapshot: (projectId, reason = null) => ipcRenderer.invoke('recovery-snapshots-create', { projectId, reason }),
    restoreRecoverySnapshot: (projectId, snapshotId) => ipcRenderer.invoke('recovery-snapshots-restore', { projectId, snapshotId }),
    deleteRecoverySnapshot: (projectId, snapshotId) => ipcRenderer.invoke('recovery-snapshots-delete', { projectId, snapshotId }),

    // ─── Asset P2P sync ───────────────────────────────────────────────────────

    getAssetSyncStatus: (projectId) => ipcRenderer.invoke('asset-sync-status', projectId),
    triggerAssetReconcile: (projectId, assetId = null) => ipcRenderer.invoke('asset-sync-reconcile', { projectId, assetId }),

    // ─── Website export ───────────────────────────────────────────────────────

    exportStaticWebsite: (options) => ipcRenderer.invoke('export-static-website', options),
    /** Uses `ipcRenderer.send` (fire-and-forget) — the preview window is owned and managed entirely by the main process. */
    openPreview: (projectId) => ipcRenderer.send('open-preview', projectId),

    // ─── Debug ────────────────────────────────────────────────────────────────

    inspectYDoc: (projectId) => ipcRenderer.invoke('ydoc-dump', projectId),

    // ─── Event listeners ──────────────────────────────────────────────────────
    // Each subscription returns an unsubscribe function for cleanup.
    // The Electron `event` object is stripped before forwarding to the callback.

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
    onImportProgress: (callback) => {
        const subscription = (event, ...args) => callback(...args);
        ipcRenderer.on('import-assets-progress', subscription);
        return () => ipcRenderer.removeListener('import-assets-progress', subscription);
    },
    onAssetSyncProgress: (callback) => {
        const subscription = (event, ...args) => callback(...args);
        ipcRenderer.on('asset-sync-progress', subscription);
        return () => ipcRenderer.removeListener('asset-sync-progress', subscription);
    }
});


