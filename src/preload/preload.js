/**
 * Preload script — runs in a privileged context between the main and renderer processes.
 * Exposes a curated API to the renderer via `contextBridge` so the renderer never
 * needs direct access to Node.js or Electron internals.
 *
 * All two-way calls use `ipcRenderer.invoke` (request/response).
 * Fire-and-forget notifications use `ipcRenderer.send`.
 * Event subscriptions return an unsubscribe function so callers can clean up.
 *
 * @namespace preload
 * @see https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
 */
import { contextBridge, ipcRenderer, webUtils } from 'electron';

/**
 * Standard result shape returned by most IPC handlers.
 * @typedef {Object} preload.IpcResult
 * @property {boolean} success - Whether the operation succeeded.
 * @property {string} [error] - Error message if the operation failed.
 */

/**
 * Current user's identity as stored in global settings.
 * @typedef {Object} preload.GlobalProfile
 * @property {string|null} clientId - Unique device identifier (UUID).
 * @property {string|null} username - Display name.
 */

/**
 * App-wide global settings snapshot.
 * @typedef {Object} preload.GlobalSettings
 * @property {string|null} clientId - Unique device identifier (UUID).
 * @property {string|null} interfaceLanguage - BCP 47 locale code (e.g. `'en'`, `'it'`).
 * @property {string|null} appVersion - Running application version string.
 */

/**
 * Progress event emitted during an asset import operation.
 * @typedef {Object} preload.ImportProgressEvent
 * @property {'start'|'progress'|'complete'} status - Stage of the import.
 * @property {number} [total] - Total number of assets to import.
 * @property {number} [processed] - Number of assets processed so far.
 * @property {number} [percent] - Completion percentage (0–100).
 */

contextBridge.exposeInMainWorld('api', {
    // ─── Core ─────────────────────────────────────────────────────────────────

    /**
     * Executes a GraphQL query or mutation against the local database.
     * @memberOf preload
     * @param {string} query - GraphQL query or mutation string.
     * @param {Object} [variables] - GraphQL variables.
     * @param {Object} [context] - Additional context passed to the resolver.
     * @returns {Promise<Object>} GraphQL execution result `{ data, errors }`.
     */
    executeGraphQL: (query, variables, context) => ipcRenderer.invoke('execute-graphql', { query, variables, context }),

    /**
     * Returns the active GraphQL schema as SDL and optionally writes it to disk.
     * @memberOf preload
     * @param {string} [outputPath] - Optional path to write the schema file to.
     * @returns {Promise<{ success: boolean, data?: { schema: string, outputPath?: string }, error?: string }>}
     */
    exportGraphQLSchema: (outputPath) => ipcRenderer.invoke('export-graphql-schema', { outputPath }),

    /**
     * Checks whether the main process is reachable.
     * @memberOf preload
     * @returns {Promise<boolean>}
     */
    ping: () => ipcRenderer.invoke('ping'),

    /**
     * Returns OS and application version information.
     * @memberOf preload
     * @returns {Promise<Object>}
     */
    getSystemInfo: () => ipcRenderer.invoke('get-system-info'),

    // ─── File operations ──────────────────────────────────────────────────────

    /**
     * Returns the native filesystem path for a File object.
     * Synchronous — uses `webUtils`, not IPC.
     * @memberOf preload
     * @param {File} file
     * @returns {string}
     */
    getPathForFile: (file) => webUtils.getPathForFile(file),

    /**
     * Opens a native file-picker dialog.
     * @memberOf preload
     * @param {Object} options - Electron `dialog.showOpenDialog` options.
     * @returns {Promise<{files: Array<{path: string}>}>}
     */
    openFileDialog: (options) => ipcRenderer.invoke('open-file-dialog', options),

    /**
     * Reads a file from the local filesystem and returns its contents as a string.
     * @memberOf preload
     * @param {string} filePath - Absolute path to the file.
     * @returns {Promise<string>}
     */
    readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),

    // ─── Import / Export ──────────────────────────────────────────────────────

    /**
     * Imports asset files (images, media) into the project.
     * @memberOf preload
     * @param {Object} data - Import options including `projectId`, `institutionId`, and `files`.
     * @returns {Promise<{createdAssets: Array<Object>}>}
     */
    importAssets: (data) => ipcRenderer.invoke('import-assets', data),

    /**
     * Imports translations from a file into the database.
     * @memberOf preload
     * @param {string} filePath
     * @returns {Promise<preload.IpcResult>}
     */
    importTranslations: (filePath) => ipcRenderer.invoke('import-translations', filePath),

    /**
     * Exports translations from the database to a file.
     * @memberOf preload
     * @param {string} filePath
     * @returns {Promise<preload.IpcResult>}
     */
    exportTranslations: (filePath) => ipcRenderer.invoke('export-translations', filePath),

    /**
     * Imports structured data (e.g. CSV, JSON) into the project.
     * @memberOf preload
     * @param {Object} options
     * @returns {Promise<Object>}
     */
    importStructuredData: (options) => ipcRenderer.invoke('import-structured-data', options),

    /**
     * Opens a sheet-selection dialog for a multi-sheet Excel file.
     * @memberOf preload
     * @param {Object} options
     * @returns {Promise<Object>}
     */
    excelSheetSelection: (options) => ipcRenderer.invoke('excel-sheet-selection', options),

    /**
     * Exports the full project to a portable archive.
     * @memberOf preload
     * @param {Object} options
     * @returns {Promise<preload.IpcResult>}
     */
    exportProject: (options) => ipcRenderer.invoke('export-project', options),

    /**
     * Exports the project's connection records to a file.
     * @memberOf preload
     * @param {Object} options
     * @returns {Promise<preload.IpcResult>}
     */
    exportConnections: (options) => ipcRenderer.invoke('export-connections', options),

    /**
     * Imports connection records from a file into the project.
     * @memberOf preload
     * @param {Object} options
     * @returns {Promise<preload.IpcResult>}
     */
    importConnections: (options) => ipcRenderer.invoke('import-connections', options),

    /**
     * Exports all connections of a given type to a CSV file.
     * @memberOf preload
     * @param {Object} options
     * @returns {Promise<preload.IpcResult>}
     */
    exportConnectionTypeCsv: (options) => ipcRenderer.invoke('export-connection-type-csv', options),

    /**
     * Imports connections from a CSV file for a specific connection type.
     * @memberOf preload
     * @param {Object} options
     * @returns {Promise<preload.IpcResult>}
     */
    importConnectionTypeCsv: (options) => ipcRenderer.invoke('import-connection-type-csv', options),

    // ─── Backup ───────────────────────────────────────────────────────────────

    /**
     * Creates a full backup of the project database.
     * @memberOf preload
     * @param {Object} options
     * @returns {Promise<preload.IpcResult>}
     */
    createBackup: (options) => ipcRenderer.invoke('backup-create', options),

    /**
     * Opens a file dialog so the user can select an existing backup file.
     * @memberOf preload
     * @returns {Promise<{filePath: string|null}>}
     */
    selectBackupFile: () => ipcRenderer.invoke('backup-select-file'),

    /**
     * Validates a backup file before restoring.
     * @memberOf preload
     * @param {Object} options
     * @returns {Promise<preload.IpcResult>}
     */
    checkBackupFile: (options) => ipcRenderer.invoke('backup-check-file', options),

    /**
     * Restores the database from a backup file.
     * @memberOf preload
     * @param {Object} options
     * @returns {Promise<preload.IpcResult>}
     */
    restoreBackup: (options) => ipcRenderer.invoke('backup-restore', options),

    // ─── AI suggestions ───────────────────────────────────────────────────────

    /**
     * Suggests matching existing objects for a set of assets using AI embeddings.
     * @memberOf preload
     * @param {Array<Object>} assets
     * @param {Object} options
     * @returns {Promise<Array<Object>>}
     */
    suggestObjectMatches: (assets, options) => ipcRenderer.invoke('suggest-object-matches', assets, options),

    /**
     * Suggests mappings between CSV column names and known ontology fields.
     * @memberOf preload
     * @param {Array<string>} csvFieldNames
     * @param {Object} options
     * @returns {Promise<Array<Object>>}
     */
    suggestFieldMappings: (csvFieldNames, options) => ipcRenderer.invoke('suggest-field-mappings', csvFieldNames, options),

    /**
     * Suggests whether an existing import template can be reused for new input headers.
     * @memberOf preload
     * @param {Array<string>} inputHeaders
     * @param {string} projectId
     * @returns {Promise<Object>}
     */
    suggestTemplateReuse: (inputHeaders, projectId) => ipcRenderer.invoke('suggest-template-reuse', inputHeaders, projectId),

    // ─── Settings & profile ───────────────────────────────────────────────────

    /**
     * Returns the list of available interface languages.
     * @memberOf preload
     * @param {string} [lang='en'] - BCP 47 locale code for language name localisation.
     * @returns {Promise<Array<{code: string, name: string}>>}
     */
    getLanguages: (lang = 'en') => ipcRenderer.invoke('languages:list', { lang }),

    /**
     * Returns the app-wide global settings.
     * @memberOf preload
     * @returns {Promise<preload.GlobalSettings>}
     */
    getGlobalSettings: () => ipcRenderer.invoke('global-settings:get'),

    /**
     * Persists the preferred UI locale.
     * @memberOf preload
     * @param {string} locale - BCP 47 language tag (e.g. `'en'`, `'it'`).
     * @returns {Promise<preload.GlobalSettings>}
     */
    updateGlobalInterfaceLanguage: (locale) => ipcRenderer.invoke('global-settings:update-interface-language', locale),

    /**
     * Returns the current user's profile (clientId and username).
     * @memberOf preload
     * @returns {Promise<preload.GlobalProfile>}
     */
    getGlobalProfile: () => ipcRenderer.invoke('global-profile:get'),

    /**
     * Persists a new display name for the current user.
     * Falls back to a randomly generated username when `username` is blank.
     * @memberOf preload
     * @param {string} username
     * @returns {Promise<preload.GlobalProfile>}
     */
    updateGlobalUsername: (username) => ipcRenderer.invoke('global-profile:update', username),

    // ─── Embeddings ───────────────────────────────────────────────────────────

    /**
     * Triggers computation of AI embeddings for all records that are missing them.
     * @memberOf preload
     * @returns {Promise<preload.IpcResult>}
     */
    computeAllMissingEmbeddings: () => ipcRenderer.invoke('compute-all-missing-embeddings'),

    // ─── Project session ──────────────────────────────────────────────────────

    /**
     * Marks a project as the currently active one in the main process.
     * @memberOf preload
     * @param {string} projectId
     * @returns {Promise<void>}
     */
    setCurrentProject: (projectId) => ipcRenderer.invoke('set-current-project', projectId),

    /**
     * Returns the ID of the currently active project, or `null` if none is open.
     * @memberOf preload
     * @returns {Promise<string|null>}
     */
    getCurrentProject: () => ipcRenderer.invoke('get-current-project'),

    /**
     * Clears the currently active project from the main process cache.
     * @memberOf preload
     * @returns {Promise<void>}
     */
    clearCurrentProject: () => ipcRenderer.invoke('clear-current-project'),

    // ─── P2P & networking ─────────────────────────────────────────────────────

    /**
     * Returns the current local network status (online/offline, IP addresses, etc.).
     * @memberOf preload
     * @returns {Promise<Object>}
     */
    getNetworkStatus: () => ipcRenderer.invoke('network-status:get'),

    /**
     * Returns the list of peers currently connected to a shared project.
     * @memberOf preload
     * @param {string} projectId
     * @returns {Promise<Array<Object>>}
     */
    getProjectPeers: (projectId) => ipcRenderer.invoke('get-project-peers', projectId),

    /**
     * Returns the presence state (online users) for a shared project.
     * @memberOf preload
     * @param {string} projectId
     * @returns {Promise<Object>}
     */
    getProjectPresence: (projectId) => ipcRenderer.invoke('project-presence:get', projectId),

    /**
     * Sets or updates the password for a shared project.
     * @memberOf preload
     * @param {string} projectId
     * @param {string} password
     * @returns {Promise<preload.IpcResult>}
     */
    setProjectPassword: (projectId, password) => ipcRenderer.invoke('project-set-password', { projectId, password }),

    /**
     * Joins an existing P2P-shared project using a password.
     * @memberOf preload
     * @param {string} projectId
     * @param {string} password
     * @returns {Promise<preload.IpcResult>}
     */
    joinP2PProject: (projectId, password) => ipcRenderer.invoke('project-join-p2p', { projectId, password }),

    /**
     * Pauses P2P sync for a project without removing it.
     * @memberOf preload
     * @param {string} projectId
     * @returns {Promise<preload.IpcResult>}
     */
    suspendP2PProject: (projectId) => ipcRenderer.invoke('project-suspend-p2p', projectId),

    /**
     * Reconnects to P2P sync for a project, optionally with a new password.
     * @memberOf preload
     * @param {string} projectId
     * @param {string} [password]
     * @returns {Promise<preload.IpcResult>}
     */
    reconnectP2PProject: (projectId, password) => ipcRenderer.invoke('project-reconnect-p2p', { projectId, password }),

    // ─── Snapshots ────────────────────────────────────────────────────────────

    /**
     * Creates a Yjs snapshot of the project's CRDT state.
     * @memberOf preload
     * @param {string} projectId
     * @returns {Promise<preload.IpcResult>}
     */
    createSnapshot: (projectId) => ipcRenderer.invoke('snapshot-create', projectId),

    /**
     * Hydrates the local database from an existing Yjs snapshot.
     * @memberOf preload
     * @param {string} projectId
     * @returns {Promise<preload.IpcResult>}
     */
    hydrateFromSnapshot: (projectId) => ipcRenderer.invoke('snapshot-hydrate', projectId),

    /**
     * Lists all recovery snapshots for a project.
     * @memberOf preload
     * @param {string} projectId
     * @returns {Promise<Array<Object>>}
     */
    listRecoverySnapshots: (projectId) => ipcRenderer.invoke('recovery-snapshots-list', projectId),

    /**
     * Creates a recovery snapshot, optionally labelled with a reason.
     * @memberOf preload
     * @param {string} projectId
     * @param {string|null} [reason=null] - Human-readable reason for the snapshot.
     * @returns {Promise<preload.IpcResult>}
     */
    createRecoverySnapshot: (projectId, reason = null) => ipcRenderer.invoke('recovery-snapshots-create', { projectId, reason }),

    /**
     * Restores the project database to the state captured in a recovery snapshot.
     * @memberOf preload
     * @param {string} projectId
     * @param {string} snapshotId
     * @returns {Promise<preload.IpcResult>}
     */
    restoreRecoverySnapshot: (projectId, snapshotId) => ipcRenderer.invoke('recovery-snapshots-restore', { projectId, snapshotId }),

    /**
     * Permanently deletes a recovery snapshot.
     * @memberOf preload
     * @param {string} projectId
     * @param {string} snapshotId
     * @returns {Promise<preload.IpcResult>}
     */
    deleteRecoverySnapshot: (projectId, snapshotId) => ipcRenderer.invoke('recovery-snapshots-delete', { projectId, snapshotId }),

    // ─── Asset P2P sync ───────────────────────────────────────────────────────

    /**
     * Returns the current P2P sync status for all assets in a project.
     * @memberOf preload
     * @param {string} projectId
     * @returns {Promise<Object>}
     */
    getAssetSyncStatus: (projectId) => ipcRenderer.invoke('asset-sync-status', projectId),

    /**
     * Schedules an asset sync reconciliation pass for a project.
     * When `assetId` is provided, only that asset is reconciled.
     * @memberOf preload
     * @param {string} projectId
     * @param {string|null} [assetId=null] - Target a specific asset, or `null` for a full project reconcile.
     * @returns {Promise<preload.IpcResult>}
     */
    triggerAssetReconcile: (projectId, assetId = null) => ipcRenderer.invoke('asset-sync-reconcile', { projectId, assetId }),

    // ─── Website export ───────────────────────────────────────────────────────

    /**
     * Exports the project as a static website archive.
     * @memberOf preload
     * @param {Object} options
     * @returns {Promise<preload.IpcResult>}
     */
    exportStaticWebsite: (options) => ipcRenderer.invoke('export-static-website', options),

    /**
     * Opens the built-in preview window for a project.
     * Uses `ipcRenderer.send` (fire-and-forget) — the preview window is
     * owned and managed entirely by the main process.
     * @memberOf preload
     * @param {string} projectId
     * @returns {void}
     */
    openPreview: (projectId) => ipcRenderer.send('open-preview', projectId),

    // ─── Debug ────────────────────────────────────────────────────────────────

    /**
     * Dumps the raw Yjs document state for debugging.
     * @memberOf preload
     * @param {string} projectId
     * @returns {Promise<Object>}
     */
    inspectYDoc: (projectId) => ipcRenderer.invoke('ydoc-dump', projectId),

    // ─── Event listeners ──────────────────────────────────────────────────────
    // Each subscription returns an unsubscribe function for cleanup.
    // The Electron `event` object is stripped before forwarding to the callback.

    /**
     * Subscribes to database change notifications from the main process.
     * @memberOf preload
     * @param {function(...*): void} callback
     * @returns {function(): void} Unsubscribe function.
     */
    onDataChanged: (callback) => {
        const subscription = (event, ...args) => callback(...args);
        ipcRenderer.on('data-changed', subscription);
        return () => ipcRenderer.removeListener('data-changed', subscription);
    },

    /**
     * Subscribes to global profile change events (username or clientId updated).
     * @memberOf preload
     * @param {function(preload.GlobalProfile): void} callback
     * @returns {function(): void} Unsubscribe function.
     */
    onGlobalProfileChanged: (callback) => {
        const subscription = (event, ...args) => callback(...args);
        ipcRenderer.on('global-profile-changed', subscription);
        return () => ipcRenderer.removeListener('global-profile-changed', subscription);
    },

    /**
     * Subscribes to presence change events for a shared project (users joining/leaving).
     * @memberOf preload
     * @param {function(Object): void} callback
     * @returns {function(): void} Unsubscribe function.
     */
    onProjectPresenceChanged: (callback) => {
        const subscription = (event, ...args) => callback(...args);
        ipcRenderer.on('project-presence-changed', subscription);
        return () => ipcRenderer.removeListener('project-presence-changed', subscription);
    },

    /**
     * Subscribes to network status change events (online/offline transitions).
     * @memberOf preload
     * @param {function(Object): void} callback
     * @returns {function(): void} Unsubscribe function.
     */
    onNetworkStatusChanged: (callback) => {
        const subscription = (event, ...args) => callback(...args);
        ipcRenderer.on('network-status-changed', subscription);
        return () => ipcRenderer.removeListener('network-status-changed', subscription);
    },

    /**
     * Subscribes to progress events during an asset import operation.
     * @memberOf preload
     * @param {function(preload.ImportProgressEvent): void} callback
     * @returns {function(): void} Unsubscribe function.
     */
    onImportProgress: (callback) => {
        const subscription = (event, ...args) => callback(...args);
        ipcRenderer.on('import-assets-progress', subscription);
        return () => ipcRenderer.removeListener('import-assets-progress', subscription);
    },

    /**
     * Subscribes to P2P asset sync progress events.
     * @memberOf preload
     * @param {function(Object): void} callback
     * @returns {function(): void} Unsubscribe function.
     */
    onAssetSyncProgress: (callback) => {
        const subscription = (event, ...args) => callback(...args);
        ipcRenderer.on('asset-sync-progress', subscription);
        return () => ipcRenderer.removeListener('asset-sync-progress', subscription);
    }
});
