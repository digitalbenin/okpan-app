/**
 * Backend main process — initialises Electron, the database, and the P2P
 * runtime, then registers all IPC channel handlers.
 *
 * @namespace backend
 */

/**
 * IPC handler functions registered via `ipcMain.handle`. Each function
 * receives an `Electron.IpcMainInvokeEvent` as its first argument and
 * returns a serialisable result to the renderer process.
 *
 * @namespace backend.handlers
 * @memberof backend
 */
/**
 * Long-lived backend services that manage runtime state, orchestration,
 * or external integrations used by the Electron main process.
 *
 * @namespace backend.services
 * @memberof backend
 */
/**
 * Shared backend utilities used by handlers, services, and database queries.
 *
 * @namespace backend.utils
 * @memberof backend
 */
/**
 * Electron custom protocol registration modules.
 *
 * @namespace backend.protocols
 * @memberof backend
 */
import { app, BrowserWindow, ipcMain, protocol, net, powerMonitor } from 'electron';
import serve from 'electron-serve';
import started from 'electron-squirrel-startup';
import 'dotenv/config';
import EventEmitter from 'events';
import path from 'path';
import { sendToAllWindows, notifyProjectDataChanged, notifyProjectPresence } from './services/windowNotifierService.js';
import { broadcastNetworkStatus, getCurrentNetworkStatus, setNetworkStatus, startConnectivityProbe, stopConnectivityProbe } from './services/connectivityService.js';
import { registerMediaProtocol } from './protocols/media.js';
import { registerWebsiteProtocol } from './protocols/website.js';
import log from 'electron-log/main'; 

// Database
import { db, ensureDatabaseReady } from '../db/init.js';
import { getGlobalProfile, updateGlobalUsername, getGlobalSettings, updateGlobalInterfaceLanguage } from '../db/queries/globalSettings.js';
import { createGraphQLSchema } from '../db/graphqlDefs.js';

// Handlers
import { handleExportTranslations, handleImportTranslations } from './handlers/translationHandlers.js';
import { handleGraphQL, handleExportGraphQLSchema } from './handlers/graphqlHandler.js';
import { handlePing, handleFileDialog, handleStructuredDataImport, handleSetCurrentProject, handleGetCurrentProject, handleClearCurrentProject, handleExcelSheetSelection, handleReadFile } from './handlers/systemHandlers.js';
import { handleImportAssets } from './handlers/assetHandlers.js';
import { handleSuggestTemplateReuse } from './handlers/templateMatchingHandler.js';
import { handleListLanguages } from './handlers/languagesHandlers.js';
import { handleCreateBackup, handleSelectBackupFile, handleCheckBackupFile, handleRestoreBackup } from './handlers/backupHandler.js';
import { handleSetProjectPassword, handleJoinP2P, handleSuspendP2P, handleReconnectP2P } from './handlers/projectHandlers.js';
import {
  handleCreateSnapshot,
  handleHydrateSnapshot,
  handleListRecoverySnapshots,
  handleCreateRecoverySnapshot,
  handleRestoreRecoverySnapshot,
  handleDeleteRecoverySnapshot,
  handleGetAssetSyncStatus,
  handleTriggerAssetReconcile
} from './handlers/snapshotHandlers.js';
import { handleComputeAllMissingEmbeddings } from './handlers/embeddingHandler.js';
import {
  handleExportProject,
  handleExportConnections,
  handleImportConnections,
  handleExportConnectionTypeCsv,
  handleImportConnectionTypeCsv,
  handleExportStaticWebsite
} from './handlers/exportHandlers.js';

// Services
import { suggestObjectMatches } from './services/assetMappingService.js';
import { suggestFieldMappings } from './services/fieldMappingService.js';
import { getProjectDoc } from './services/projectCacheService.js';
import { getProjectPeersCount, getProjectPresence, setPresenceNotifier, refreshAllProjectPresence } from './services/p2pService.js';
import { setDataChangeNotifier } from './services/changeLogTailerService.js';
import { bootstrapProjectRuntime } from './services/projectRuntimeService.js';
import { setMainWindowContents, destroyTorrentManager } from './services/assetTorrentManagerService.js';


// ── Constants ──────────────────────────────────────────────────────────────

const MIN_WINDOW_WIDTH = 800;
const MIN_WINDOW_HEIGHT = 600;

const PRIVILEGED_SCHEMES = [
  {
    scheme: 'app',
    privileges: {
      secure: true,
      standard: true,
      allowServiceWorkers: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
      codeCache: true
    }
  },
  {
    scheme: 'media',
    privileges: {
      secure: true,
      standard: true,
      supportFetchAPI: true,
      bypassCSP: true,
      corsEnabled: true,
      stream: true
    }
  },
  {
    scheme: 'website',
    privileges: {
      secure: true,
      standard: true,
      supportFetchAPI: true,
      bypassCSP: true,
      corsEnabled: true,
      stream: true
    }
  }
];

// -- Log initialisation ─────────────────────────────────────────────────────────────

// configure electron-log to write to a file and the console, with different levels for each
log.transports.file.level = 'warn'; 
log.transports.console.level = 'debug';

Object.assign(console, log.functions);

// ── Protocol scheme registration ───────────────────────────────────────────

const registerSchemesAsPrivilegedOnce = protocol.registerSchemesAsPrivileged.bind(protocol);
const restoreRegisterSchemesAsPrivileged = (() => {
  if (process.platform === 'darwin') {
    let didRegisterPrivilegedSchemes = false;
    protocol.registerSchemesAsPrivileged = () => {
      if (didRegisterPrivilegedSchemes) {
        return;
      }

      didRegisterPrivilegedSchemes = true;
      return registerSchemesAsPrivilegedOnce(PRIVILEGED_SCHEMES);
    };
  } else {
    registerSchemesAsPrivilegedOnce(PRIVILEGED_SCHEMES);
    protocol.registerSchemesAsPrivileged = () => {};
  }

  return () => {
    queueMicrotask(() => {
      protocol.registerSchemesAsPrivileged = registerSchemesAsPrivilegedOnce;
    });
  };
})();

// Initialize electron-serve early (before app is ready) so its protocol is registered in time.
const loadURLProd = serve({ directory: 'build' });

restoreRegisterSchemesAsPrivileged();

// ── Process & app bootstrap ─────────────────────────────────────────────────

// Trystero + WebTorrent open many concurrent sockets per project. Bump the
// global EventEmitter listener cap to avoid spurious MaxListenersExceededWarnings.
EventEmitter.defaultMaxListeners = 50;

// Suppress noisy Trystero relay-failure logs (relay redundancy is expected;
// the protocol still works via other relays).
const _origWarn = console.warn.bind(console);
console.warn = (...args) => {
  if (typeof args[0] === 'string' && args[0].startsWith('Trystero: relay failure')) return;
  _origWarn(...args);
};

// Suppress normal network socket timeouts (often caused by WebTorrent tracker
// requests) from showing disruptive system error dialogs in Electron.
process.on('uncaughtException', (error) => {
  if (error?.code === 'ETIMEDOUT' || error?.code === 'ECONNREFUSED' || error?.code === 'ECONNRESET' || error?.code === 'ENOTFOUND') {
    console.warn('[Network] Suppressed uncaught socket/DNS error:', error.message);
    return;
  }
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

app.disableHardwareAcceleration();

// ── Service wiring ──────────────────────────────────────────────────────────

setPresenceNotifier((projectId, presence) => {
  sendToAllWindows('project-presence-changed', { projectId, presence });
});

setDataChangeNotifier((projectId) => {
  sendToAllWindows('data-changed', { projectId, origin: 'local' });
});

const { schema, resolvers } = createGraphQLSchema(db);

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// ── IPC context helpers ─────────────────────────────────────────────────────

const withDatabaseContext = (handler) => (event, payload) => handler(event, payload, { db });
const withGraphQLContext = (handler) => (event, payload) =>
  handler(event, payload, { schema, resolvers, db });

// ── IPC handler registration ────────────────────────────────────────────────

function registerSystemIpcHandlers() {
  ipcMain.handle('ping', handlePing);
  ipcMain.handle('get-system-info', () => ({
    arch: process.arch,
    platform: process.platform,
    isDev: !!MAIN_WINDOW_VITE_DEV_SERVER_URL
  }));
  ipcMain.handle('network-status:get', () => {
    const netOnline = app.isReady() ? net.isOnline() : null;
    const status = getCurrentNetworkStatus();
    console.log('[Network] network-status:get', { cached: status, netOnline });
    return { ...status, netOnline };
  });
  ipcMain.handle('open-file-dialog', handleFileDialog);
  ipcMain.handle('read-file', handleReadFile);
}

function registerSettingsIpcHandlers() {
  ipcMain.handle('languages:list', handleListLanguages);
  ipcMain.handle('global-profile:get', () => getGlobalProfile());
  ipcMain.handle('global-profile:update', async (_event, username) => {
    const profile = await updateGlobalUsername(username);
    await refreshAllProjectPresence();
    sendToAllWindows('global-profile-changed', profile);
    return profile;
  });
  ipcMain.handle('global-settings:get', () => getGlobalSettings());
  ipcMain.handle('global-settings:update-interface-language', (_event, locale) =>
    updateGlobalInterfaceLanguage(locale)
  );
}

function registerProjectIpcHandlers() {
  ipcMain.handle('project-set-password', handleSetProjectPassword);
  ipcMain.handle('project-join-p2p', handleJoinP2P);
  ipcMain.handle('project-suspend-p2p', handleSuspendP2P);
  ipcMain.handle('project-reconnect-p2p', (event, payload) =>
    handleReconnectP2P(event, payload, { notifyProjectDataChanged, notifyProjectPresence })
  );

  ipcMain.handle('set-current-project', async (event, projectId) => {
    const result = handleSetCurrentProject(event, projectId);
    if (!result?.success) return result;

    await bootstrapProjectRuntime(event, projectId, {
      hydrateSnapshot: true,
      captureSessionSnapshot: true
    }, { notifyProjectDataChanged, notifyProjectPresence });

    return { ...result, hydrated: true };
  });
  ipcMain.handle('get-current-project', handleGetCurrentProject);
  ipcMain.handle('clear-current-project', handleClearCurrentProject);
  ipcMain.handle('get-project-peers', (_event, projectId) => getProjectPeersCount(projectId));
  ipcMain.handle('project-presence:get', (_event, projectId) => getProjectPresence(projectId));

  ipcMain.handle('ydoc-dump', async (_event, projectId) => {
    try {
      if (!projectId || typeof projectId !== 'string') {
        throw new Error('ydoc-dump requires a valid projectId string');
      }

      const doc = getProjectDoc(projectId);
      const meta = doc.getMap('meta').toJSON();
      const tables = doc.getMap('tables').toJSON();
      let totalRows = 0;
      const rowCounts = {};

      try {
        doc.getMap('tables').forEach((tableMap, key) => {
          const size = typeof tableMap?.size === 'number' ? tableMap.size : 0;
          rowCounts[key] = size;
          totalRows += size;
        });
      } catch {}

      return { meta, tables, guid: doc.guid, rowCounts, totalRows };
    } catch (error) {
      console.error('Error in ydoc-dump:', error);
      throw error;
    }
  });
}

function registerDataIpcHandlers() {
  ipcMain.handle('execute-graphql', withGraphQLContext(handleGraphQL));
  ipcMain.handle('export-graphql-schema', withGraphQLContext(handleExportGraphQLSchema));
  ipcMain.handle('export-translations', withGraphQLContext(handleExportTranslations));
  ipcMain.handle('import-translations', withGraphQLContext(handleImportTranslations));
  ipcMain.handle('import-assets', handleImportAssets);
  ipcMain.handle('import-structured-data', handleStructuredDataImport);
  ipcMain.handle('excel-sheet-selection', handleExcelSheetSelection);
}

function registerExportIpcHandlers() {
  ipcMain.handle('export-static-website', (event, options) => handleExportStaticWebsite(event, options, { app }));
  ipcMain.handle('export-project', withDatabaseContext(handleExportProject));
  ipcMain.handle('export-connections', withDatabaseContext(handleExportConnections));
  ipcMain.handle('import-connections', withDatabaseContext(handleImportConnections));
  ipcMain.handle('export-connection-type-csv', withDatabaseContext(handleExportConnectionTypeCsv));
  ipcMain.handle('import-connection-type-csv', withDatabaseContext(handleImportConnectionTypeCsv));
  ipcMain.handle('backup-create', withDatabaseContext(handleCreateBackup));
  ipcMain.handle('backup-select-file', handleSelectBackupFile);
  ipcMain.handle('backup-check-file', withDatabaseContext(handleCheckBackupFile));
  ipcMain.handle('backup-restore', withDatabaseContext(handleRestoreBackup));
}

function registerAnalysisIpcHandlers() {
  ipcMain.handle('suggest-object-matches', async (_event, assets, options) => {
    try {
      return await suggestObjectMatches(assets, options);
    } catch (error) {
      console.error('Error in suggest-object-matches:', error);
      throw error;
    }
  });
  ipcMain.handle('suggest-field-mappings', async (_event, csvFieldNames, options) => {
    try {
      return await suggestFieldMappings(csvFieldNames, options);
    } catch (error) {
      console.error('Error in suggest-field-mappings:', error);
      throw error;
    }
  });
  ipcMain.handle('suggest-template-reuse', async (event, inputHeaders, projectId) => {
    try {
      return await handleSuggestTemplateReuse(event, inputHeaders, projectId);
    } catch (error) {
      console.error('Error in suggest-template-reuse:', error);
      throw error;
    }
  });
  ipcMain.handle('compute-all-missing-embeddings', handleComputeAllMissingEmbeddings);
}

function registerSnapshotIpcHandlers() {
  ipcMain.on('open-preview', async (_event, projectId) => {
    const previewWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: MIN_WINDOW_WIDTH,
      minHeight: MIN_WINDOW_HEIGHT,
      webPreferences: {
        preload: path.join(import.meta.dirname, 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    const globalSettings = await getGlobalSettings();
    const previewUrl = new URL('http://localhost:5174');
    previewUrl.searchParams.set('project_id', projectId);

    if (globalSettings?.interfaceLanguage) {
      previewUrl.searchParams.set('interface_language', globalSettings.interfaceLanguage);
    }

    previewWindow.loadURL(previewUrl.toString());
  });

  ipcMain.handle('snapshot-create', handleCreateSnapshot);
  ipcMain.handle('snapshot-hydrate', handleHydrateSnapshot);
  ipcMain.handle('recovery-snapshots-list', handleListRecoverySnapshots);
  ipcMain.handle('recovery-snapshots-create', handleCreateRecoverySnapshot);
  ipcMain.handle('recovery-snapshots-restore', (event, payload) =>
    handleRestoreRecoverySnapshot(event, payload, { notifyProjectDataChanged })
  );
  ipcMain.handle('recovery-snapshots-delete', handleDeleteRecoverySnapshot);
  ipcMain.handle('asset-sync-status', handleGetAssetSyncStatus);
  ipcMain.handle('asset-sync-reconcile', handleTriggerAssetReconcile);
}

function registerIpcHandlers() {
  registerSystemIpcHandlers();
  registerSettingsIpcHandlers();
  registerProjectIpcHandlers();
  registerDataIpcHandlers();
  registerExportIpcHandlers();
  registerAnalysisIpcHandlers();
  registerSnapshotIpcHandlers();
}

// ── Window management ───────────────────────────────────────────────────────

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 1080,
    minWidth: MIN_WINDOW_WIDTH,
    minHeight: MIN_WINDOW_HEIGHT,
    autoHideMenuBar: true,
    icon: path.join(app.getAppPath(), 'src/assets/logo_wip.png'),
    webPreferences: {
      preload: path.join(app.getAppPath(), '.vite/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    },
  });

  // Handle CSP for inline scripts by intercepting and updating headers
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = { ...details.responseHeaders };
    
    // If there's already a CSP header, update it to allow inline scripts
    if (responseHeaders['content-security-policy']) {
      const cspHeader = responseHeaders['content-security-policy'][0];
      // Replace script-src to allow unsafe-inline for inline scripts
      const updatedCSP = cspHeader.replace(
        /script-src[^;]*/,
        "script-src 'self' 'unsafe-inline'"
      );
      responseHeaders['content-security-policy'] = [updatedCSP];
    }
    
    callback({ responseHeaders });
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    loadURLProd(mainWindow);
  }

  mainWindow.webContents.on('online-status-changed', (_event, online) => {
    broadcastNetworkStatus(online, 'electron-webcontents');
  });

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.executeJavaScript('navigator.onLine', true)
      .then((online) => {
        setNetworkStatus(!!online, 'electron-initial');
        sendToAllWindows('network-status-changed', getCurrentNetworkStatus());
        startConnectivityProbe();
      })
      .catch((err) => {
        console.warn('Failed to read initial navigator.onLine state:', err?.message || err);
      });
  });

  // Register webContents so assetTorrentManager can emit IPC progress events to renderer
  setMainWindowContents(mainWindow.webContents);
};

function registerPowerMonitorHandlers() {
  powerMonitor.on('suspend', () => {
    broadcastNetworkStatus(false, 'electron-suspend');
  });

  powerMonitor.on('resume', () => {
    broadcastNetworkStatus(true, 'electron-resume');
  });
}

// ── App lifecycle ───────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  await ensureDatabaseReady();
  registerIpcHandlers();
  registerPowerMonitorHandlers();
  registerMediaProtocol();
  registerWebsiteProtocol();
  createWindow();
});

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopConnectivityProbe();
  try {
    destroyTorrentManager();
  } catch (err) {
    console.warn('destroyTorrentManager error on quit:', err);
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
