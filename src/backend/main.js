import { app, BrowserWindow, ipcMain, dialog, protocol } from 'electron';
import started from 'electron-squirrel-startup';
import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import fsPromises from 'fs/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import database and schema
import { db, getGlobalProfile, updateGlobalUsername } from '../db/init.js';
import { createGraphQLSchema } from '../db/graphqlDefs.js';

// Import handlers
import { handleExportTranslations, handleImportTranslations } from './handlers/translationHandlers.js';
import { handleGraphQL } from './handlers/graphqlHandler.js';
import { handlePing, handleFileDialog, handleStructuredDataImport, handleSetCurrentProject, handleGetCurrentProject, handleClearCurrentProject, handleExcelSheetSelection } from './handlers/systemHandlers.js';
import { handleImportAssets } from './handlers/assetHandlers.js';
import { suggestObjectMatches } from './handlers/assetMappingHandler.js';
import { suggestFieldMappings } from './handlers/importHandler.js';
import { handleSuggestTemplateReuse } from './handlers/templateMatchingHandler.js';
import { embeddingService } from './services/embeddingService.js';
import { ontology_fields, texts } from '../db/schema.js';
import { getProjectDoc, getCurrentProjectId } from './services/projectCache.js';
import { startP2PForProject, getProjectPeersCount, getProjectPresence, setPresenceNotifier, refreshAllProjectPresence } from './services/p2pService.js';
import { startChangeLogTailer } from './services/changeLogTailerService.js';
import { createProjectSnapshot, hydrateProjectFromLatestSnapshot } from './services/snapshotService.js';
import { eq, sql, isNull } from 'drizzle-orm';
import { handleExportProject, handleExportConnections, handleImportConnections } from './handlers/exportHandlers.js';
import { handleListLanguages } from './handlers/languagesHandlers.js';
// import { applyMigration } from '../db/scripts/applyMigration.js';
import { handleCreateBackup, handleSelectBackupFile, handleCheckBackupFile, handleRestoreBackup } from './handlers/backupHandler.js';
import {
  startReconcileLoop,
  stopProjectTorrents,
  setMainWindowContents,
  destroyTorrentManager,
  getProjectSyncStatus,
  scheduleAssetReconcile
} from './services/assetTorrentManager.js';

// Trystero + WebTorrent open many concurrent sockets per project. Bump the
// global EventEmitter listener cap to avoid spurious MaxListenersExceededWarnings.
import EventEmitter from 'events';
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
  // Optionally, re-throw or handle fatal errors appropriately here
});

app.disableHardwareAcceleration()

function sendToAllWindows(channel, payload) {
  for (const window of BrowserWindow.getAllWindows()) {
    if (window.isDestroyed() || window.webContents.isDestroyed()) continue;
    window.webContents.send(channel, payload);
  }
}

setPresenceNotifier((projectId, presence) => {
  sendToAllWindows('project-presence-changed', { projectId, presence });
});

// Create GraphQL schema
const { schema, resolvers } = createGraphQLSchema(db);

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// Register IPC handlers
ipcMain.handle('ping', handlePing);
ipcMain.handle('get-system-info', () => ({
  arch: process.arch,
  platform: process.platform,
  isDev: !!MAIN_WINDOW_VITE_DEV_SERVER_URL
}));
ipcMain.handle('execute-graphql', (event, params) =>
  handleGraphQL(event, params, { schema, resolvers, db })
);
ipcMain.handle('export-translations', (event, filePath) =>
  handleExportTranslations(event, filePath, { schema, resolvers, db })
);
ipcMain.handle('import-translations', (event, filePath) =>
  handleImportTranslations(event, filePath, { schema, resolvers, db })
);
ipcMain.handle('import-assets', (event, data) =>
  handleImportAssets(event, data)
);
ipcMain.handle('open-file-dialog', handleFileDialog);
ipcMain.handle('import-structured-data', handleStructuredDataImport);
ipcMain.handle('excel-sheet-selection', handleExcelSheetSelection);
ipcMain.handle('languages:list', handleListLanguages);
ipcMain.handle('global-profile:get', async () => {
  return getGlobalProfile();
});
ipcMain.handle('global-profile:update', async (event, username) => {
  const profile = await updateGlobalUsername(username);
  await refreshAllProjectPresence();
  sendToAllWindows('global-profile-changed', profile);
  return profile;
});

// Static website export
ipcMain.handle('export-static-website', async (event, options) => {
  try {
    const { exportStaticWebsite } = await import('./services/websiteExportService.js');
    return await exportStaticWebsite(options.projectId, options.outputPath, {
      db,
      filters: options.filters
    });
  } catch (error) {
    console.error('Error exporting static website:', error);
    throw error;
  }
});

// New generic export channel supports { format: 'sql' | 'json', ... }
ipcMain.handle('export-project', (event, options) =>
  handleExportProject(event, options, { db })
);

ipcMain.handle('export-connections', (event, options) =>
  handleExportConnections(event, options, { db })
);

ipcMain.handle('import-connections', (event, options) =>
  handleImportConnections(event, options, { db })
);

// Backup handlers
ipcMain.handle('backup-create', (event, options) =>
  handleCreateBackup(event, options, { db })
);
ipcMain.handle('backup-select-file', handleSelectBackupFile);
ipcMain.handle('backup-check-file', (event, options) =>
  handleCheckBackupFile(event, options, { db })
);
ipcMain.handle('backup-restore', (event, options) =>
  handleRestoreBackup(event, options, { db })
);

// Project cache handlers
let tailerStarted = false;
ipcMain.handle('set-current-project', async (event, projectId) => {
  // Set project in cache using existing handler
  const res = handleSetCurrentProject(event, projectId);
  if (!res?.success) {
    return res;
  }
  // Hydrate from latest snapshot before starting tailer
  try {
    await hydrateProjectFromLatestSnapshot(projectId);
  } catch (err) {
    console.error('Hydration failed for project', projectId, err);
  }
  // Start tailer once, after hydration
  if (!tailerStarted) {
    startChangeLogTailer();
    tailerStarted = true;
  }
  // Start P2P provider for this project (Trystero + Yjs)
  try {
    const notifyFrontend = () => {
      // Notify the renderer that data has changed so it can invalidate queries
      if (event && event.sender && !event.sender.isDestroyed()) {
        try {
           event.sender.send('data-changed', { projectId, origin: 'p2p' });
        } catch (e) {
           console.warn('Failed to notify frontend of data change', e);
        }
      }
    };
    await startP2PForProject(projectId, { onDataChange: notifyFrontend });
    try {
      event.sender.send('project-presence-changed', {
        projectId,
        presence: getProjectPresence(projectId)
      });
    } catch (presenceError) {
      console.warn('Failed to notify frontend of project presence', presenceError);
    }
  } catch (err) {
    console.error('Failed to start P2P provider for project', projectId, err);
  }
  // Delay WebTorrent init by 5s so node_datachannel (Trystero/WebRTC) is fully
  // settled before we create the WebTorrent client. Both touch low-level UDP/async
  // callbacks and racing them crashes on macOS.
  setTimeout(() => {
    try {
      startReconcileLoop(projectId);
    } catch (err) {
      console.error('Failed to start asset reconcile loop for project', projectId, err);
    }
  }, 5000);
  return { ...res, hydrated: true };
});
ipcMain.handle('get-current-project', handleGetCurrentProject);
ipcMain.handle('clear-current-project', handleClearCurrentProject);

ipcMain.handle('get-project-peers', (event, projectId) => {
  return getProjectPeersCount(projectId);
});
ipcMain.handle('project-presence:get', (event, projectId) => {
  return getProjectPresence(projectId);
});

// Y.Doc inspection handler (returns plain JS object)
ipcMain.handle('ydoc-dump', async (event, projectId) => {
  try {
    if (!projectId || typeof projectId !== 'string') {
      throw new Error('ydoc-dump requires a valid projectId string');
    }
    const doc = getProjectDoc(projectId);
    const meta = doc.getMap('meta').toJSON();
    const tables = doc.getMap('tables').toJSON();
    // Compute simple row counts to aid debugging/hydration verification
    let totalRows = 0;
    const rowCounts = {};
    try {
      doc.getMap('tables').forEach((tableMap, key) => {
        const size = typeof tableMap?.size === 'number' ? tableMap.size : 0;
        rowCounts[key] = size;
        totalRows += size;
      });
    } catch { }
    return { meta, tables, guid: doc.guid, rowCounts, totalRows };
  } catch (error) {
    console.error('Error in ydoc-dump:', error);
    throw error;
  }
});

// Asset mapping handlers
ipcMain.handle('suggest-object-matches', async (event, assets, options) => {
  try {
    return await suggestObjectMatches(assets, options);
  } catch (error) {
    console.error('Error in suggest-object-matches:', error);
    throw error;
  }
});

ipcMain.handle('suggest-field-mappings', async (event, csvFieldNames, options) => {
  try {
    return await suggestFieldMappings(csvFieldNames, options);
  } catch (error) {
    console.error('Error in suggest-field-mappings:', error);
    throw error;
  }
});

// Template matching handlers
ipcMain.handle('suggest-template-reuse', async (event, inputHeaders, projectId) => {
  try {
    return await handleSuggestTemplateReuse(event, inputHeaders, projectId);
  } catch (error) {
    console.error('Error in suggest-template-reuse:', error);
    throw error;
  }
});

// Embedding handlers
ipcMain.handle('compute-all-missing-embeddings', async (event) => {
  try {
    const fieldsWithoutEmbeddings = await db
      .select({
        field_id: ontology_fields.id,
        name_content: texts.content,
        description_content: texts.content
      })
      .from(ontology_fields)
      .leftJoin(texts, eq(ontology_fields.name_id, texts.id))
      .where(isNull(ontology_fields.embeddings))
      .execute();

    await embeddingService.initialize();

    for (const field of fieldsWithoutEmbeddings) {
      const embedding = await embeddingService.computeOntologyFieldEmbedding(
        field.name_content,
        field.description_content
      );

      if (embedding) {
        await db
          .update(ontology_fields)
          .set({ embeddings: embedding })
          .where(eq(ontology_fields.id, field.field_id))
          .execute();
      }
    }

    return fieldsWithoutEmbeddings.length;
  } catch (error) {
    console.error('Error computing embeddings:', error);
    throw error;
  }
});

// Handler for reading file content
ipcMain.handle('read-file', async (event, filePath) => {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('Invalid file path provided.');
  }
  // Basic security check (optional): Ensure it's an absolute path if needed
  // or restrict to certain directories if required.
  // For now, we assume the path provided by dialog is trustworthy enough
  try {
    const content = await fsPromises.readFile(filePath, 'utf-8');
    return content;
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    // Rethrow a more generic error or specific error code
    throw new Error(`Failed to read file: ${error.message}`);
  }
});

ipcMain.on('open-preview', (event, projectId) => {
  const previewWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(import.meta.dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Se stai usando il dev server:
  previewWindow.loadURL(`http://localhost:5174?project_id=${projectId}`);
});

// Snapshot management IPC
ipcMain.handle('snapshot-create', async (event, projectId) => {
  try {
    if (!projectId || typeof projectId !== 'string') {
      throw new Error('snapshot-create requires a valid projectId');
    }
    const result = await createProjectSnapshot(projectId);
    return { success: true, result };
  } catch (error) {
    console.error('Error in snapshot:create:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('snapshot-hydrate', async (event, projectId) => {
  try {
    if (!projectId || typeof projectId !== 'string') {
      throw new Error('snapshot-hydrate requires a valid projectId');
    }
    const result = await hydrateProjectFromLatestSnapshot(projectId);
    return { success: true, result };
  } catch (error) {
    console.error('Error in snapshot-hydrate:', error);
    return { success: false, error: error.message };
  }
});

// Asset P2P sync status handler (for UI queries)
ipcMain.handle('asset-sync-status', async (event, projectId) => {
  try {
    if (!projectId || typeof projectId !== 'string') {
      throw new Error('asset-sync-status requires a valid projectId');
    }
    const status = await getProjectSyncStatus(projectId);
    return { success: true, status };
  } catch (error) {
    console.error('Error in asset-sync-status:', error);
    return { success: false, error: error.message };
  }
});

// Manual reconcile trigger (for refresh button or debug)
ipcMain.handle('asset-sync-reconcile', async (event, projectId) => {
  try {
    if (!projectId || typeof projectId !== 'string') {
      throw new Error('asset-sync-reconcile requires a valid projectId');
    }
    scheduleAssetReconcile(projectId);
    return { success: true };
  } catch (error) {
    console.error('Error in asset-sync-reconcile:', error);
    return { success: false, error: error.message };
  }
});

// Register protocol
protocol.registerSchemesAsPrivileged([
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
]);

// Helper function for path resolution
function resolveMediaPath(urlObj) {
  let pathStr;

  // Handle Windows drive letters in hostname (media://c/Users/... -> c/Users/...)
  if (urlObj.hostname && /^[a-zA-Z]$/.test(urlObj.hostname)) {
    pathStr = urlObj.hostname + decodeURIComponent(urlObj.pathname);
  } else {
    pathStr = decodeURIComponent(urlObj.pathname).replace(/^\//, '');
  }

  // Convert to absolute path if needed
  if (/^[a-zA-Z]\//.test(pathStr)) {
    // Windows drive format (c/Users/... -> C:\Users\...)
    const driveLetter = pathStr.charAt(0).toUpperCase();
    const restOfPath = pathStr.substring(2);
    return process.platform === 'win32'
      ? `${driveLetter}:\\${restOfPath.replace(/\//g, '\\')}`
      : `/${pathStr}`;
  }

  if (path.isAbsolute(pathStr)) {
    return path.normalize(pathStr);
  }

  // Try relative paths in project
  const projectRoot = process.cwd();
  const candidates = [
    path.join(projectRoot, 'src', pathStr),
    path.join(projectRoot, pathStr)
  ];

  return candidates.find(fs.existsSync) || null;
}

// Create window function
const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 1080,
    icon: path.join(import.meta.dirname, '../assets/logo_wip.png'),
    webPreferences: {
      preload: path.join(import.meta.dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true  // Enable sandboxing
    },
  });

  // Set a secure CSP
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; font-src 'self' data: 'unsafe-inline'; img-src * 'self' data: media:"
        ]
      }
    });
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(import.meta.dirname, '../../build/index.html'));
  }

  // Open the DevTools.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.webContents.openDevTools();
  }

  // Register webContents so assetTorrentManager can emit IPC progress events to renderer
  setMainWindowContents(mainWindow.webContents);
};

// Initialize app
app.whenReady().then(() => {
  // Register media protocol handler
  protocol.registerFileProtocol('media', (request, callback) => {
    try {
      const resolvedPath = resolveMediaPath(new URL(request.url));

      if (resolvedPath && fs.existsSync(resolvedPath)) {
        callback({ path: resolvedPath });
      } else {
        callback({ error: -2 });
      }
    } catch (error) {
      console.error('Media protocol error:', error);
      callback({ error: -2 });
    }
  });

  // Serve SPA build via custom website:// protocol
  // URL format: website://app/path - 'app' is the host, path is the file
  protocol.registerFileProtocol('website', (request, callback) => {
    try {
      const url = new URL(request.url);
      // pathname starts with / so we remove it
      const pathname = decodeURIComponent(url.pathname).replace(/^\//, '');
      const buildDir = path.join(process.cwd(), 'src', 'website', 'build');

      let filePath;
      if (!pathname || pathname === '' || pathname === 'index.html') {
        filePath = path.join(buildDir, 'index.html');
      } else {
        filePath = path.join(buildDir, pathname);
      }

      if (fs.existsSync(filePath)) {
        callback({ path: filePath });
      } else {
        // Fallback to 200.html for client-side routing
        callback({ path: path.join(buildDir, 'index.html') });
      }
    } catch (error) {
      console.error('Website protocol error:', error);
      callback({ error: -2 });
    }
  });

  createWindow();
});

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Clean up WebTorrent client and reconcile loops before the process exits
app.on('before-quit', () => {
  try { destroyTorrentManager(); } catch (err) { console.warn('destroyTorrentManager error on quit:', err); }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});



// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
