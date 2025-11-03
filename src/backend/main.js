import { app, BrowserWindow, ipcMain, dialog, protocol } from 'electron';
import started from 'electron-squirrel-startup';
import 'dotenv/config';
import path from 'path';
import net from 'net';
import fs from 'fs';
import fsPromises from 'fs/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import database and schema
import { db } from '../db/init.js';
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
import { eq, isNull } from 'drizzle-orm';
import { getProjectDoc } from './services/projectCache.js';
import { startP2PForProject } from './services/p2pService.js';
import { startChangeLogTailer } from './services/changeLogTailerService.js';
import { createProjectSnapshot, hydrateProjectFromLatestSnapshot } from './services/snapshotService.js';
import { handleExportProject } from './handlers/exportHandlers.js';
import { handleListLanguages } from './handlers/languagesHandlers.js';
import { applyMigration } from '../db/scripts/applyMigration.js';

// Create GraphQL schema
const { schema, resolvers } = createGraphQLSchema(db);

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// Register IPC handlers
ipcMain.handle('ping', handlePing);
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

// New generic export channel supports { format: 'sql' | 'json', ... }
ipcMain.handle('export-project', (event, options) =>
  handleExportProject(event, options, { db })
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
    await startP2PForProject(projectId);
  } catch (err) {
    console.error('Failed to start P2P provider for project', projectId, err);
  }
  return { ...res, hydrated: true };
});
ipcMain.handle('get-current-project', handleGetCurrentProject);
ipcMain.handle('clear-current-project', handleClearCurrentProject);

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
    } catch {}
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
};

// Initialize app
app.whenReady().then(() => {
  // Ensure DB migrations and change_log triggers are applied before any ingestion/tailer
  // This makes ongoing local changes appear in change_log for syncing
  applyMigration().catch((err) => {
    console.error('Database migration/setup failed at startup:', err);
  });

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
  protocol.registerFileProtocol('website', (request, callback) => {
    try {
      const url = new URL(request.url);
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
        callback({ path: path.join(buildDir, '200.html') });
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

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});



// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
