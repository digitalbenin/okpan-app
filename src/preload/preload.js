/**
 * Preload script - runs in a privileged context between the main and renderer processes.
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

contextBridge.exposeInMainWorld('api', {
    // --- Core ---
    /**
     * Executes a GraphQL query or mutation against the local database.
     * @memberOf preload
     * @param {string} query - GraphQL query or mutation string.
     * @param {Object} [variables] - GraphQL variables.
     * @param {Object} [context] - Additional context passed to the resolver.
        * @returns {Promise.<{success: boolean, data: (Object|undefined), errors: (Array.<Object>|undefined), error: (string|undefined)}>}
     */
    executeGraphQL: (query, variables, context) => ipcRenderer.invoke('execute-graphql', { query, variables, context }),

    /**
     * Returns the active GraphQL schema as SDL and optionally writes it to disk.
     * @memberOf preload
     * @param {string} [outputPath] - Optional path to write the schema file to.
        * @returns {Promise.<{success: boolean, data: ({schema: string, outputPath: (string|undefined)}|undefined), error: (string|undefined)}>}
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
        * @returns {Promise.<{arch: string, platform: string, isDev: boolean}>}
     */
    getSystemInfo: () => ipcRenderer.invoke('get-system-info'),

    // --- File operations ---
    /**
     * Returns the native filesystem path for a File object.
     * Synchronous - uses `webUtils`, not IPC.
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

    // --- Import / Export ---
    /**
     * Imports asset files (images, media) into the project.
     * @memberOf preload
     * @param {Object} data - Import options including `projectId`, `institutionId`, and `files`.
        * @returns {Promise.<{errors: Array.<Object>, createdAssets: Array.<Object>, files: Array.<string>}>}
     */
    importAssets: (data) => ipcRenderer.invoke('import-assets', data),

    /**
     * Imports translations from a file into the database.
     * @memberOf preload
     * @param {string} filePath
        * @returns {Promise.<{success: boolean, error: (string|undefined)}>}
     */
    importTranslations: (filePath) => ipcRenderer.invoke('import-translations', filePath),

    /**
     * Exports translations from the database to a file.
     * @memberOf preload
     * @param {string} filePath
        * @returns {Promise.<{success: boolean, error: (string|undefined)}>}
     */
    exportTranslations: (filePath) => ipcRenderer.invoke('export-translations', filePath),

    /**
     * Imports structured data (e.g. CSV, JSON) into the project.
     * @memberOf preload
     * @param {Object} options
        * @returns {Promise.<{success: boolean, canceled: boolean, data: (Object|Array.<Object>|null), error: (string|undefined)}>}
     */
    importStructuredData: (options) => ipcRenderer.invoke('import-structured-data', options),

    /**
     * Opens a sheet-selection dialog for a multi-sheet Excel file.
     * @memberOf preload
     * @param {Object} options
        * @returns {Promise.<{success: boolean, format: (string|undefined), multiPage: (boolean|undefined), data: (Array.<Object>|null|undefined), error: (string|null|undefined), selectedSheet: (string|undefined)}>}
     */
    excelSheetSelection: (options) => ipcRenderer.invoke('excel-sheet-selection', options),

    /**
     * Exports the full project to a portable archive.
     * @memberOf preload
     * @param {Object} options
        * @returns {Promise.<{success: boolean, error: (string|undefined)}>}
     */
    exportProject: (options) => ipcRenderer.invoke('export-project', options),

    /**
     * Exports the project's connection records to a file.
     * @memberOf preload
     * @param {Object} options
        * @returns {Promise.<{success: boolean, error: (string|undefined)}>}
     */
    exportConnections: (options) => ipcRenderer.invoke('export-connections', options),

    /**
     * Imports connection records from a file into the project.
     * @memberOf preload
     * @param {Object} options
        * @returns {Promise.<{success: boolean, error: (string|undefined)}>}
     */
    importConnections: (options) => ipcRenderer.invoke('import-connections', options),

    /**
     * Exports all connections of a given type to a CSV file.
     * @memberOf preload
     * @param {Object} options
        * @returns {Promise.<{success: boolean, error: (string|undefined)}>}
     */
    exportConnectionTypeCsv: (options) => ipcRenderer.invoke('export-connection-type-csv', options),

    /**
     * Imports connections from a CSV file for a specific connection type.
     * @memberOf preload
     * @param {Object} options
        * @returns {Promise.<{success: boolean, error: (string|undefined)}>}
     */
    importConnectionTypeCsv: (options) => ipcRenderer.invoke('import-connection-type-csv', options),

    // --- Backup ---
    /**
     * Creates a full backup of the project database.
     * @memberOf preload
     * @param {Object} options
        * @returns {Promise.<{success: boolean, error: (string|undefined)}>}
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
        * @returns {Promise.<{success: boolean, error: (string|undefined)}>}
     */
    checkBackupFile: (options) => ipcRenderer.invoke('backup-check-file', options),

    /**
     * Restores the database from a backup file.
     * @memberOf preload
     * @param {Object} options
        * @returns {Promise.<{success: boolean, error: (string|undefined)}>}
     */
    restoreBackup: (options) => ipcRenderer.invoke('backup-restore', options),

    // --- AI suggestions ---
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
        * @returns {Promise.<{success: boolean, matchingTemplates: Array.<Object>, inputHeaders: Array.<string>, projectId: string, institutionId: (string|null|undefined), totalMatches: number, error: (string|undefined)}>}
     */
    suggestTemplateReuse: (inputHeaders, projectId) => ipcRenderer.invoke('suggest-template-reuse', inputHeaders, projectId),

    // --- Settings & profile ---
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
        * @returns {Promise.<{clientId: (string|null), interfaceLanguage: (string|null), appVersion: (string|null)}>}
     */
    getGlobalSettings: () => ipcRenderer.invoke('global-settings:get'),

    /**
     * Persists the preferred UI locale.
     * @memberOf preload
     * @param {string} locale - BCP 47 language tag (e.g. `'en'`, `'it'`).
        * @returns {Promise.<{clientId: (string|null), interfaceLanguage: (string|null), appVersion: (string|null)}>}
     */
    updateGlobalInterfaceLanguage: (locale) => ipcRenderer.invoke('global-settings:update-interface-language', locale),

    /**
     * Returns the current user's profile (clientId and username).
     * @memberOf preload
        * @returns {Promise.<{clientId: (string|null), username: (string|null)}>}
     */
    getGlobalProfile: () => ipcRenderer.invoke('global-profile:get'),

    /**
     * Persists a new display name for the current user.
     * Falls back to a randomly generated username when `username` is blank.
     * @memberOf preload
     * @param {string} username
        * @returns {Promise.<{clientId: (string|null), username: (string|null)}>}
     */
    updateGlobalUsername: (username) => ipcRenderer.invoke('global-profile:update', username),

    // --- Embeddings ---
    /**
     * Triggers computation of AI embeddings for all records that are missing them.
     * @memberOf preload
        * @returns {Promise.<number>}
     */
    computeAllMissingEmbeddings: () => ipcRenderer.invoke('compute-all-missing-embeddings'),

    // --- Project session ---
    /**
     * Marks a project as the currently active one in the main process.
     * @memberOf preload
     * @param {string} projectId
        * @returns {Promise.<{success: boolean, projectId: (string|undefined), hydrated: (boolean|undefined), error: (string|undefined)}>}
     */
    setCurrentProject: (projectId) => ipcRenderer.invoke('set-current-project', projectId),

    /**
     * Returns the ID of the currently active project, or `null` if none is open.
     * @memberOf preload
        * @returns {Promise.<{success: boolean, projectId: (string|null|undefined), error: (string|undefined)}>}
     */
    getCurrentProject: () => ipcRenderer.invoke('get-current-project'),

    /**
     * Clears the currently active project from the main process cache.
     * @memberOf preload
        * @returns {Promise.<{success: boolean, error: (string|undefined)}>}
     */
    clearCurrentProject: () => ipcRenderer.invoke('clear-current-project'),

    // --- P2P & networking ---
    /**
     * Returns the current local network status (online/offline, IP addresses, etc.).
     * @memberOf preload
        * @returns {Promise.<{online: boolean, source: string, ts: number, netOnline: (boolean|null)}>}
     */
    getNetworkStatus: () => ipcRenderer.invoke('network-status:get'),

    /**
     * Returns the list of peers currently connected to a shared project.
     * @memberOf preload
     * @param {string} projectId
        * @returns {Promise.<number>}
     */
    getProjectPeers: (projectId) => ipcRenderer.invoke('get-project-peers', projectId),

    /**
     * Returns the presence state (online users) for a shared project.
     * @memberOf preload
     * @param {string} projectId
        * @returns {Promise.<{peers: Array.<Object>, count: number}>}
     */
    getProjectPresence: (projectId) => ipcRenderer.invoke('project-presence:get', projectId),

    /**
     * Sets or updates the password for a shared project.
     * @memberOf preload
     * @param {string} projectId
     * @param {string} password
        * @returns {Promise.<{success: boolean, error: (string|undefined)}>}
     */
    setProjectPassword: (projectId, password) => ipcRenderer.invoke('project-set-password', { projectId, password }),

    /**
     * Joins an existing P2P-shared project using a password and optional
     * custom signaling relay URL and TURN shared secret.
     * @memberOf preload
     * @param {string} projectId
     * @param {string} password
     * @param {string} [signalingUrl]
     * @param {string} [turnSecret]
        * @returns {Promise.<{success: boolean, projectId: (string|undefined), error: (string|undefined)}>} 
     */
    joinP2PProject: (projectId, password, signalingUrl, turnSecret) => ipcRenderer.invoke('project-join-p2p', { projectId, password, signalingUrl, turnSecret }),
    /**
     * Pauses P2P sync for a project without removing it.
     * @memberOf preload
     * @param {string} projectId
        * @returns {Promise.<{success: boolean, error: (string|undefined)}>}
     */
    suspendP2PProject: (projectId) => ipcRenderer.invoke('project-suspend-p2p', projectId),

    /**
     * Reconnects to P2P sync for a project, optionally with a new password.
     * @memberOf preload
     * @param {string} projectId
     * @param {string} [password]
        * @returns {Promise.<{success: boolean, skipped: (boolean|undefined), reason: (string|undefined), error: (string|undefined)}>}
     */
    reconnectP2PProject: (projectId, password) => ipcRenderer.invoke('project-reconnect-p2p', { projectId, password }),

    // --- Snapshots ---
    /**
     * Creates a Yjs snapshot of the project's CRDT state.
     * @memberOf preload
     * @param {string} projectId
        * @returns {Promise.<{success: boolean, result: (Object|undefined), error: (string|undefined)}>}
     */
    createSnapshot: (projectId) => ipcRenderer.invoke('snapshot-create', projectId),

    /**
     * Hydrates the local database from an existing Yjs snapshot.
     * @memberOf preload
     * @param {string} projectId
        * @returns {Promise.<{success: boolean, result: (Object|undefined), error: (string|undefined)}>}
     */
    hydrateFromSnapshot: (projectId) => ipcRenderer.invoke('snapshot-hydrate', projectId),

    /**
     * Lists all recovery snapshots for a project.
     * @memberOf preload
     * @param {string} projectId
        * @returns {Promise.<{success: boolean, snapshots: (Array.<Object>|undefined), error: (string|undefined)}>}
     */
    listRecoverySnapshots: (projectId) => ipcRenderer.invoke('recovery-snapshots-list', projectId),

    /**
     * Creates a recovery snapshot, optionally labelled with a reason.
     * @memberOf preload
     * @param {string} projectId
     * @param {string|null} [reason=null] - Human-readable reason for the snapshot.
        * @returns {Promise.<{success: boolean, snapshot: (Object|undefined), error: (string|undefined)}>}
     */
    createRecoverySnapshot: (projectId, reason = null) => ipcRenderer.invoke('recovery-snapshots-create', { projectId, reason }),

    /**
     * Restores the project database to the state captured in a recovery snapshot.
     * @memberOf preload
     * @param {string} projectId
     * @param {string} snapshotId
        * @returns {Promise.<{success: boolean, result: (Object|undefined), error: (string|undefined)}>}
     */
    restoreRecoverySnapshot: (projectId, snapshotId) => ipcRenderer.invoke('recovery-snapshots-restore', { projectId, snapshotId }),

    /**
     * Permanently deletes a recovery snapshot.
     * @memberOf preload
     * @param {string} projectId
     * @param {string} snapshotId
        * @returns {Promise.<{success: boolean, result: (Object|undefined), error: (string|undefined)}>}
     */
    deleteRecoverySnapshot: (projectId, snapshotId) => ipcRenderer.invoke('recovery-snapshots-delete', { projectId, snapshotId }),

    // --- Asset P2P sync ---
    /**
     * Returns the current P2P sync status for all assets in a project.
     * @memberOf preload
     * @param {string} projectId
        * @returns {Promise.<{success: boolean, status: (Object|undefined), error: (string|undefined)}>}
     */
    getAssetSyncStatus: (projectId) => ipcRenderer.invoke('asset-sync-status', projectId),

    /**
     * Schedules an asset sync reconciliation pass for a project.
     * When `assetId` is provided, only that asset is reconciled.
     * @memberOf preload
     * @param {string} projectId
     * @param {string|null} [assetId=null] - Target a specific asset, or `null` for a full project reconcile.
        * @returns {Promise.<{success: boolean, error: (string|undefined)}>}
     */
    triggerAssetReconcile: (projectId, assetId = null) => ipcRenderer.invoke('asset-sync-reconcile', { projectId, assetId }),

    // --- Website export ---
    /**
     * Exports the project as a static website archive.
     * @memberOf preload
     * @param {Object} options
        * @returns {Promise.<{success: boolean, error: (string|undefined)}>}
     */
    exportStaticWebsite: (options) => ipcRenderer.invoke('export-static-website', options),

    /**
     * Opens the built-in preview window for a project.
     * Uses `ipcRenderer.send` (fire-and-forget)  the preview window is
     * owned and managed entirely by the main process.
     * @memberOf preload
     * @param {string} projectId
     * @returns {void}
     */
    openPreview: (projectId) => ipcRenderer.send('open-preview', projectId),

    // --- Debug ---
    /**
     * Dumps the raw Yjs document state for debugging.
     * @memberOf preload
     * @param {string} projectId
        * @returns {Promise.<{meta: Object, tables: Object, guid: string, rowCounts: Object, totalRows: number}>}
     */
    inspectYDoc: (projectId) => ipcRenderer.invoke('ydoc-dump', projectId),

    // --- Event listeners ---
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
     * @param {function(Object): void} callback - Receives payload with shape: <code>{ clientId: string|null, username: string|null }</code>.
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
     * @param {function(Object): void} callback - Receives payload with shape: <code>{ status: 'start'|'progress'|'complete', total?: number, processed?: number, percent?: number }</code>.
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




