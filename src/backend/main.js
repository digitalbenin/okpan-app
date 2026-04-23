import { app, BrowserWindow, ipcMain, dialog, protocol, net, powerMonitor } from 'electron';
import serve from 'electron-serve';
import started from 'electron-squirrel-startup';
import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import fsPromises from 'fs/promises';
import { lookup as dnsLookup } from 'dns/promises';
import { fileURLToPath } from 'url';

const MIN_WINDOW_WIDTH = 800;
const MIN_WINDOW_HEIGHT = 600;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONNECTIVITY_PROBE_HOSTS = (process.env.CONNECTIVITY_PROBE_HOSTS || 'cloudflare.com,google.com,microsoft.com')
  .split(',')
  .map((host) => host.trim())
  .filter(Boolean);

// Initialize electron-serve early (before app is ready) so its protocol is registered in time
const loadURLProd = serve({ directory: 'build' });

// Import database and schema
import {
  db,
  getGlobalProfile,
  updateGlobalUsername,
  getGlobalSettings,
  updateGlobalInterfaceLanguage
} from '../db/init.js';
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
import { ontology_fields, project, texts } from '../db/schema.js';
import { getProjectDoc, getCurrentProjectId } from './services/projectCache.js';
import { startP2PForProject, stopP2PForProject, getP2PProvider, getProjectPeersCount, getProjectPresence, setPresenceNotifier, refreshAllProjectPresence, setPendingProjectPassword } from './services/p2pService.js';
import { startChangeLogTailer } from './services/changeLogTailerService.js';
import { createProjectSnapshot, hydrateProjectFromLatestSnapshot, hydrateProjectFromDatabase } from './services/snapshotService.js';
import { createRecoverySnapshot, deleteRecoverySnapshot, listRecoverySnapshots, prepareSessionOpenRecoverySnapshot, restoreRecoverySnapshot } from './services/recoverySnapshotService.js';
import { eq, sql, isNull } from 'drizzle-orm';
import {
  handleExportProject,
  handleExportConnections,
  handleImportConnections,
  handleExportConnectionTypeCsv,
  handleImportConnectionTypeCsv
} from './handlers/exportHandlers.js';
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
import { isSharedProject } from '../lib/utils/projectSharing.js';

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

let currentNetworkStatus = {
  online: true,
  source: 'startup',
  ts: Date.now()
};
const CONNECTIVITY_PROBE_INTERVAL_MS = 10000;
const CONNECTIVITY_PROBE_TIMEOUT_MS = 3000;
const CONNECTIVITY_PROBE_FAILURE_THRESHOLD = 2;
let connectivityProbeTimer = null;
let connectivityProbeRunning = false;
let consecutiveConnectivityProbeFailures = 0;
const openedProjectsThisSession = new Set();
const sessionOpenSnapshotJobs = new Map();
const pendingProjectJoins = new Set();

function sendToAllWindows(channel, payload) {
  for (const window of BrowserWindow.getAllWindows()) {
    if (window.isDestroyed() || window.webContents.isDestroyed()) continue;
    window.webContents.send(channel, payload);
  }
}

function broadcastNetworkStatus(online, source = 'electron') {
  const nextStatus = {
    online: !!online,
    source,
    ts: Date.now()
  };

  if (currentNetworkStatus.online === nextStatus.online && currentNetworkStatus.source === nextStatus.source) {
    console.log('[Network] status unchanged', nextStatus);
    return;
  }

  currentNetworkStatus = nextStatus;
  console.log('[Network] status changed', currentNetworkStatus);
  sendToAllWindows('network-status-changed', currentNetworkStatus);
}

function withTimeout(promise, timeoutMs, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

async function probeConnectivity() {
  if (!net.isOnline()) {
    return false;
  }

  await Promise.any(
    CONNECTIVITY_PROBE_HOSTS.map((host) =>
      withTimeout(dnsLookup(host), CONNECTIVITY_PROBE_TIMEOUT_MS, `dns:${host}`)
    )
  );

  return true;
}

async function runConnectivityProbe() {
  if (connectivityProbeRunning) {
    return;
  }

  connectivityProbeRunning = true;

  try {
    const online = await probeConnectivity();

    consecutiveConnectivityProbeFailures = 0;
    if (!currentNetworkStatus.online) {
      broadcastNetworkStatus(online, 'connectivity-probe');
    }
  } catch (error) {
    consecutiveConnectivityProbeFailures += 1;
    console.log('[Network] connectivity probe failed', {
      consecutiveFailures: consecutiveConnectivityProbeFailures,
      message: error?.message || error
    });

    if (currentNetworkStatus.online && consecutiveConnectivityProbeFailures >= CONNECTIVITY_PROBE_FAILURE_THRESHOLD) {
      broadcastNetworkStatus(false, 'connectivity-probe');
    }
  } finally {
    connectivityProbeRunning = false;
  }
}

function startConnectivityProbe() {
  if (connectivityProbeTimer) {
    return;
  }

  void runConnectivityProbe();
  connectivityProbeTimer = setInterval(() => {
    void runConnectivityProbe();
  }, CONNECTIVITY_PROBE_INTERVAL_MS);
}

function stopConnectivityProbe() {
  if (!connectivityProbeTimer) {
    return;
  }

  clearInterval(connectivityProbeTimer);
  connectivityProbeTimer = null;
  connectivityProbeRunning = false;
  consecutiveConnectivityProbeFailures = 0;
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
ipcMain.handle('network-status:get', () => {
  const netOnline = app.isReady() ? net.isOnline() : null;
  console.log('[Network] network-status:get', {
    cached: currentNetworkStatus,
    netOnline
  });
  return {
    ...currentNetworkStatus,
    netOnline
  };
});
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

// P2P Sharing Settings & Joining
ipcMain.handle('project-set-password', async (event, { projectId, password }) => {
  try {
    const { eq } = await import('drizzle-orm');
    const { project } = await import('../db/schema.js');
    await db.update(project).set({ password }).where(eq(project.id, projectId)).execute();
    setPendingProjectPassword(projectId, password || null);
    return { success: true };
  } catch (err) {
    console.error('[P2P] Failed to set password:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('project-join-p2p', async (event, { projectId, password }) => {
  try {
    pendingProjectJoins.add(projectId);
    setPendingProjectPassword(projectId, password || null);
    clearDelayedReconcileStart(projectId);
    await stopProjectTorrents(projectId);
    await stopP2PForProject(projectId);

    return { success: true, projectId };
  } catch (err) {
    console.error('[P2P] Failed to join P2P project:', err);
    return { success: false, error: err.message };
  }
});
  ipcMain.handle('project-suspend-p2p', async (event, projectId) => {
    try {
      if (!projectId) return { success: false, error: 'No projectId provided' };
      clearDelayedReconcileStart(projectId);
      await stopProjectTorrents(projectId);
      
      const wasRunning = !!getP2PProvider(projectId);
      if (wasRunning) {
        await stopP2PForProject(projectId);
      }
      return { success: true };
    } catch (err) {
      console.error('[P2P] Failed to suspend P2P project:', err);
      return { success: false, error: err.message };
    }
  });
ipcMain.handle('project-reconnect-p2p', async (event, projectId) => {
  const normalizedProjectId = typeof projectId === 'string' ? projectId : projectId?.projectId;
  const passwordOverride = typeof projectId === 'string' ? undefined : projectId?.password;

  if (reconnectP2PJobs.has(normalizedProjectId)) {
    console.log('[P2P] reconnect request deduped', { projectId: normalizedProjectId });
    return reconnectP2PJobs.get(normalizedProjectId);
  }

  const reconnectJob = (async () => {
    try {
      if (!normalizedProjectId) return { success: false, error: 'No projectId provided' };
      const sharedProject = await isProjectShared(normalizedProjectId);
      console.log('[P2P] reconnect requested', {
        projectId: normalizedProjectId,
        sharedProject,
        hadProvider: !!getP2PProvider(normalizedProjectId),
        hasPasswordOverride: passwordOverride !== undefined,
      });
      clearDelayedReconcileStart(normalizedProjectId);

      if (passwordOverride !== undefined) {
        setPendingProjectPassword(normalizedProjectId, passwordOverride || null);
      }

      const wasRunning = !!getP2PProvider(normalizedProjectId);
      await stopProjectTorrents(normalizedProjectId);
      if (wasRunning) {
        await stopP2PForProject(normalizedProjectId);
      }

      if (!sharedProject) {
        return { success: true, skipped: true, reason: 'project-is-private' };
      }

      const notifyFrontend = () => {
        if (event?.sender && !event.sender.isDestroyed()) {
          try {
            event.sender.send('data-changed', { projectId: normalizedProjectId, origin: 'p2p' });
          } catch (notifyError) {
            console.warn('Failed to notify frontend of data change', notifyError);
          }
        }
      };

      await startP2PForProject(normalizedProjectId, {
        onDataChange: notifyFrontend,
        skipHydration: true,
      });

      try {
        event?.sender?.send('project-presence-changed', {
          projectId: normalizedProjectId,
          presence: getProjectPresence(normalizedProjectId)
        });
      } catch (presenceError) {
        console.warn('Failed to notify frontend of project presence', presenceError);
      }

      scheduleDelayedReconcileStart(normalizedProjectId);

      console.log('[P2P] reconnect completed', {
        projectId: normalizedProjectId,
        hadProvider: wasRunning,
        hasProvider: !!getP2PProvider(normalizedProjectId),
        peers: getProjectPeersCount(normalizedProjectId)
      });

      return { success: true };
    } catch (err) {
      console.error('[P2P] Failed to reconnect P2P project:', err);
      return { success: false, error: err.message };
    } finally {
      reconnectP2PJobs.delete(normalizedProjectId);
    }
  })();

  reconnectP2PJobs.set(normalizedProjectId, reconnectJob);
  return reconnectJob;
});

ipcMain.handle('global-settings:get', async () => getGlobalSettings());
ipcMain.handle('global-settings:update-interface-language', async (event, locale) =>
  updateGlobalInterfaceLanguage(locale)
);

// Static website export
ipcMain.handle('export-static-website', async (event, options) => {
  try {
    const { exportStaticWebsite } = await import('./services/websiteExportService.js');
    return await exportStaticWebsite(options.projectId, options.outputPath, {
      db,
      filters: options.filters,
      appPath: app.getAppPath(),
      resourcesPath: process.resourcesPath,
      userDataPath: app.getPath('userData'),
      isPackaged: app.isPackaged,
      basePath: options.basePath,
      locale: options.locale
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

ipcMain.handle('export-connection-type-csv', (event, options) =>
  handleExportConnectionTypeCsv(event, options, { db })
);

ipcMain.handle('import-connection-type-csv', (event, options) =>
  handleImportConnectionTypeCsv(event, options, { db })
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
const reconnectP2PJobs = new Map();
const delayedReconcileStarts = new Map();

function clearDelayedReconcileStart(projectId) {
  const timer = delayedReconcileStarts.get(projectId);
  if (timer) {
    clearTimeout(timer);
    delayedReconcileStarts.delete(projectId);
  }
}

function scheduleDelayedReconcileStart(projectId) {
  if (!projectId) {
    return;
  }

  clearDelayedReconcileStart(projectId);
  const timer = setTimeout(() => {
    delayedReconcileStarts.delete(projectId);
    try {
      startReconcileLoop(projectId);
    } catch (err) {
      console.error('Failed to start asset reconcile loop for project', projectId, err);
    }
  }, 5000);

  delayedReconcileStarts.set(projectId, timer);
}

async function isProjectShared(projectId) {
  if (!projectId) {
    return false;
  }

  const rows = await db
    .select({ is_shared: project.is_shared })
    .from(project)
    .where(eq(project.id, projectId))
    .limit(1)
    .execute();

  return isSharedProject(rows[0]);
}

async function ensureSessionOpenRecoverySnapshot(projectId) {
  if (!projectId || openedProjectsThisSession.has(projectId)) {
    return null;
  }

  if (sessionOpenSnapshotJobs.has(projectId)) {
    return sessionOpenSnapshotJobs.get(projectId);
  }

  const job = (async () => {
    try {
      const prepared = await prepareSessionOpenRecoverySnapshot(projectId, {
        trigger: 'session-open',
        reason: 'Automatic recovery snapshot captured before the first sync after opening this project in a new app session.',
        isAutomatic: true,
      });
      openedProjectsThisSession.add(projectId);
      prepared?.packagingJob?.catch(() => {});
      return prepared;
    } catch (error) {
      console.warn('[RecoverySnapshot] Failed to prepare session-open snapshot', { projectId, error: error?.message });
      return null;
    } finally {
      sessionOpenSnapshotJobs.delete(projectId);
    }
  })();

  sessionOpenSnapshotJobs.set(projectId, job);
  return job;
}

async function bootstrapProjectRuntime(event, projectId, { hydrateSnapshot = false, captureSessionSnapshot = false } = {}) {
  if (!projectId) {
    return { success: false, error: 'No projectId provided' };
  }

  const sharedProject = await isProjectShared(projectId);
  const isPendingRemoteJoin = pendingProjectJoins.has(projectId);

  if (hydrateSnapshot && !getP2PProvider(projectId)) {
    try {
      await hydrateProjectFromDatabase(projectId);
    } catch (err) {
      console.error('Hydration failed for project', projectId, err);
    }
  }

  if (!tailerStarted) {
    startChangeLogTailer();
    tailerStarted = true;
  }

  if (captureSessionSnapshot) {
    await ensureSessionOpenRecoverySnapshot(projectId);
  }

  if (!sharedProject && !isPendingRemoteJoin) {
    clearDelayedReconcileStart(projectId);

    if (getP2PProvider(projectId)) {
      try {
        await stopProjectTorrents(projectId);
        await stopP2PForProject(projectId);
      } catch (err) {
        console.warn('Failed to stop P2P for private project', projectId, err);
      }
    }

    return { success: true, shared: false };
  }

  try {
    const notifyFrontend = () => {
      if (event && event.sender && !event.sender.isDestroyed()) {
        try {
          event.sender.send('data-changed', { projectId, origin: 'p2p' });
        } catch (e) {
          console.warn('Failed to notify frontend of data change', e);
        }
      }
    };

    await startP2PForProject(projectId, { 
      onDataChange: notifyFrontend,
      skipHydration: true // Already handled by hydrateSnapshot logic above
    });
    if (sharedProject) {
      pendingProjectJoins.delete(projectId);
    }
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

  scheduleDelayedReconcileStart(projectId);

  return { success: true };
}

ipcMain.handle('set-current-project', async (event, projectId) => {
  // Set project in cache using existing handler
  const res = handleSetCurrentProject(event, projectId);
  if (!res?.success) {
    return res;
  }
  await bootstrapProjectRuntime(event, projectId, { hydrateSnapshot: true, captureSessionSnapshot: true });
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

ipcMain.on('open-preview', async (event, projectId) => {
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
    const wasRunning = !!getP2PProvider(projectId);
    if (wasRunning) {
      await stopP2PForProject(projectId);
    }
    const result = await hydrateProjectFromLatestSnapshot(projectId);
    if (wasRunning) {
      await startP2PForProject(projectId, { skipHydration: true });
    }
    return { success: true, result };
  } catch (error) {
    console.error('Error in snapshot-hydrate:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('recovery-snapshots-list', async (_event, projectId) => {
  try {
    if (!projectId || typeof projectId !== 'string') {
      throw new Error('recovery-snapshots-list requires a valid projectId');
    }

    const snapshots = await listRecoverySnapshots(projectId, { limit: 10 });
    return { success: true, snapshots };
  } catch (error) {
    console.error('Error in recovery-snapshots-list:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('recovery-snapshots-create', async (_event, payload) => {
  try {
    const projectId = typeof payload === 'string' ? payload : payload?.projectId;
    const reason = typeof payload === 'string' ? null : payload?.reason ?? null;
    if (!projectId || typeof projectId !== 'string') {
      throw new Error('recovery-snapshots-create requires a valid projectId');
    }

    const snapshot = await createRecoverySnapshot(projectId, {
      trigger: 'manual',
      reason,
      isAutomatic: false,
    });

    return { success: true, snapshot };
  } catch (error) {
    console.error('Error in recovery-snapshots-create:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('recovery-snapshots-restore', async (event, payload) => {
  try {
    const projectId = payload?.projectId;
    const snapshotId = payload?.snapshotId;
    if (!projectId || typeof projectId !== 'string') {
      throw new Error('recovery-snapshots-restore requires a valid projectId');
    }
    if (!snapshotId || typeof snapshotId !== 'string') {
      throw new Error('recovery-snapshots-restore requires a valid snapshotId');
    }

    clearDelayedReconcileStart(projectId);
    const hadProvider = !!getP2PProvider(projectId);

    await stopProjectTorrents(projectId);
    if (hadProvider) {
      await stopP2PForProject(projectId);
    }

    const result = await restoreRecoverySnapshot(projectId, snapshotId);

    if (hadProvider) {
      await startP2PForProject(projectId, { skipHydration: true });
    }

    scheduleDelayedReconcileStart(projectId);

    if (event?.sender && !event.sender.isDestroyed()) {
      event.sender.send('data-changed', { projectId, origin: 'recovery-snapshot-restore' });
    }

    return { success: true, result };
  } catch (error) {
    console.error('Error in recovery-snapshots-restore:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('recovery-snapshots-delete', async (_event, payload) => {
  try {
    const projectId = payload?.projectId;
    const snapshotId = payload?.snapshotId;
    if (!projectId || typeof projectId !== 'string') {
      throw new Error('recovery-snapshots-delete requires a valid projectId');
    }
    if (!snapshotId || typeof snapshotId !== 'string') {
      throw new Error('recovery-snapshots-delete requires a valid snapshotId');
    }

    const result = await deleteRecoverySnapshot(projectId, snapshotId);
    return { success: true, result };
  } catch (error) {
    console.error('Error in recovery-snapshots-delete:', error);
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

// Manual reconcile trigger (for refresh button, debug, or targeted renderer recovery)
ipcMain.handle('asset-sync-reconcile', async (event, payload) => {
  try {
    const projectId = typeof payload === 'string' ? payload : payload?.projectId;
    const assetId = typeof payload === 'string' ? null : payload?.assetId ?? null;
    if (!projectId || typeof projectId !== 'string') {
      throw new Error('asset-sync-reconcile requires a valid projectId');
    }
    scheduleAssetReconcile(projectId, assetId);
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
function resolveMediaPath(urlObj, requestUrl) {
  let pathStr;

  // Use original url string to avoid url parser stripping/moving segments into hostname
  if (requestUrl) {
    const rawPath = requestUrl.substring('media://'.length);
    const pathEndIndex = rawPath.search(/[?#]/);
    const normalizedRawPath = pathEndIndex >= 0 ? rawPath.substring(0, pathEndIndex) : rawPath;
    pathStr = decodeURIComponent(normalizedRawPath);
  } else {
    const host = urlObj.hostname || '';
    const pathname = decodeURIComponent(urlObj.pathname || '');

    // Fallback for callers that only pass a URL object.
    // In dev, addImageProtocolPrefix("src/...") produces hostname="src" and pathname="/assets/...".
    // Absolute Windows paths may parse as hostname="c" and pathname="/Users/...".
    if (host && /^[a-zA-Z]$/.test(host)) {
      pathStr = `${host}:${pathname}`;
    } else {
      pathStr = host ? host + pathname : pathname;
    }

    if (!/^[a-zA-Z]:\//.test(pathStr)) {
      pathStr = pathStr.replace(/^\//, '');
    }
  }

  // Windows drive format (C:/Users/...)
  if (/^[a-zA-Z]:\//.test(pathStr)) {
    const normalizedWinPath = process.platform === 'win32'
      ? pathStr.replace(/\//g, '\\')
      : pathStr;

    if (fs.existsSync(normalizedWinPath)) return path.normalize(normalizedWinPath);
  }

  // Windows drive format without colon (c/Users/... -> C:\Users\...)
  if (/^[a-zA-Z]\//.test(pathStr)) {
    const driveLetter = pathStr.charAt(0).toUpperCase();
    const restOfPath = pathStr.substring(pathStr.indexOf('/') + 1);
    const winPathStr = process.platform === 'win32'
      ? `${driveLetter}:\\${restOfPath.replace(/\//g, '\\')}`
      : `/${pathStr}`;

    if (fs.existsSync(winPathStr)) return path.normalize(winPathStr);
  }

  if (path.isAbsolute(pathStr)) {
    if (fs.existsSync(pathStr)) return path.normalize(pathStr);
  }

  // Also handle POSIX paths that might not start with / but are meant to be absolute (from media://volumes/...)
  const maybePosixAbsolute = '/' + pathStr;
  if (path.isAbsolute(maybePosixAbsolute) && fs.existsSync(maybePosixAbsolute)) {
    return path.normalize(maybePosixAbsolute);
  }

  pathStr = pathStr.replace(/^\//, ''); // Strip leading slash for relative paths

  // Try relative paths in project and packaged app
  const projectRoot = process.cwd();
  const appRoot = app.getAppPath?.() || '';
  const resourcesApp = process.resourcesPath ? path.join(process.resourcesPath, 'app') : '';
  const userData = app?.getPath?.('userData') || '';
  const userAssetsRoot = userData ? path.join(userData, 'assets', 'project_assets') : '';

  // Special mapping: logical seeded path -> userData assets
  let userDataCandidate = null;
  if (pathStr.startsWith('src/assets/project_assets')) {
    const rest = pathStr.replace(/^src\/assets\/project_assets\/?/, '');
    userDataCandidate = userAssetsRoot ? path.join(userAssetsRoot, rest) : null;
  }

  const candidates = [
    // Packaged app locations
    appRoot ? path.join(appRoot, pathStr) : null,
    appRoot ? path.join(appRoot, 'src', pathStr) : null,
    resourcesApp ? path.join(resourcesApp, pathStr) : null,
    resourcesApp ? path.join(resourcesApp, 'src', pathStr) : null,
    // userData mapping for writable assets
    userDataCandidate,
    // Dev locations
    path.join(projectRoot, pathStr),
    path.join(projectRoot, 'src', pathStr)
  ].filter(Boolean);

  return candidates.find(fs.existsSync) || null;
}

// Create window function
const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 1080,
  minWidth: MIN_WINDOW_WIDTH,
  minHeight: MIN_WINDOW_HEIGHT,
    icon: path.join(app.getAppPath(), 'src/assets/logo_wip.png'),
    webPreferences: {
      preload: path.join(app.getAppPath(), '.vite/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true  // Enable sandboxing
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

  // Load app: dev uses Vite server, production uses electron-serve
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    // Use electron-serve initialized before app ready
    loadURLProd(mainWindow);
  }

  // Open the DevTools.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.webContents.on('online-status-changed', (_event, online) => {
    broadcastNetworkStatus(online, 'electron-webcontents');
  });

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.executeJavaScript('navigator.onLine', true)
      .then((online) => {
        currentNetworkStatus = {
          online: !!online,
          source: 'electron-initial',
          ts: Date.now()
        };
        sendToAllWindows('network-status-changed', currentNetworkStatus);
      })
      .catch((err) => {
        console.warn('Failed to read initial navigator.onLine state:', err?.message || err);
      });
  });

  // Register webContents so assetTorrentManager can emit IPC progress events to renderer
  setMainWindowContents(mainWindow.webContents);
};

// Initialize app
app.whenReady().then(() => {
  powerMonitor.on('suspend', () => {
    broadcastNetworkStatus(false, 'electron-suspend');
  });

  powerMonitor.on('resume', () => {
    broadcastNetworkStatus(true, 'electron-resume');
  });

  // startConnectivityProbe();

  // Register media protocol handler
  protocol.registerFileProtocol('media', (request, callback) => {
    try {
      const resolvedPath = resolveMediaPath(new URL(request.url), request.url);

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
      const websiteRootDir = app.isPackaged ? app.getAppPath() : process.cwd();
      const buildDir = path.join(websiteRootDir, 'src', 'website', 'build');
      const spaShellPath = fs.existsSync(path.join(buildDir, 'index.html'))
        ? path.join(buildDir, 'index.html')
        : path.join(buildDir, '200.html');

      let filePath;
      if (!pathname || pathname === '' || pathname === 'index.html' || pathname === '200.html') {
        filePath = spaShellPath;
      } else {
        filePath = path.join(buildDir, pathname);
      }

      if (fs.existsSync(filePath)) {
        callback({ path: filePath });
      } else {
        if (fs.existsSync(spaShellPath)) {
          callback({ path: spaShellPath });
        } else {
          callback({ error: -6 });
        }
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
  stopConnectivityProbe();
  try { destroyTorrentManager(); } catch (err) { console.warn('destroyTorrentManager error on quit:', err); }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});



// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
