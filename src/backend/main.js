import { app, BrowserWindow, ipcMain, dialog, protocol } from 'electron';
import started from 'electron-squirrel-startup';
import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import fsPromises from 'fs/promises';
import { fileURLToPath } from 'url';

const MIN_WINDOW_WIDTH = 800;
const MIN_WINDOW_HEIGHT = 600;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import database and schema
import { db, getGlobalSettings, updateGlobalInterfaceLanguage } from '../db/init.js';
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
import { eq, sql, isNull } from 'drizzle-orm';
import {
  handleExportProject,
  handleExportConnections,
  handleImportConnections,
  handleExportConnectionTypeCsv,
  handleImportConnectionTypeCsv
} from './handlers/exportHandlers.js';
import { handleListLanguages } from './handlers/languagesHandlers.js';
import { handleCreateBackup, handleSelectBackupFile, handleCheckBackupFile, handleRestoreBackup } from './handlers/backupHandler.js';

app.disableHardwareAcceleration()

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
ipcMain.handle('set-current-project', handleSetCurrentProject);
ipcMain.handle('get-current-project', handleGetCurrentProject);
ipcMain.handle('clear-current-project', handleClearCurrentProject);

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
    pathStr = decodeURIComponent(requestUrl.substring('media://'.length));
  } else {
    // fallback if no requestUrl provided
    if (urlObj.hostname && /^[a-zA-Z]$/.test(urlObj.hostname)) {
      pathStr = urlObj.hostname + decodeURIComponent(urlObj.pathname);
    } else {
      pathStr = urlObj.hostname ? urlObj.hostname + decodeURIComponent(urlObj.pathname) : decodeURIComponent(urlObj.pathname);
    }
  }

  // Windows drive format (c:/Users/... or c/Users/...)
  if (/^[a-zA-Z]:\//.test(pathStr) || /^[a-zA-Z]\//.test(pathStr)) {
    const driveLetter = pathStr.charAt(0).toUpperCase();
    const restOfPath = pathStr.substring(pathStr.indexOf('/') + 1);
    const winPathStr = process.platform === 'win32'
      ? `${driveLetter}:\\${restOfPath.replace(/\//g, '\\')}`
      : `/${pathStr}`;
      
    if (fs.existsSync(winPathStr)) return winPathStr;
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
    minWidth: MIN_WINDOW_WIDTH,
    minHeight: MIN_WINDOW_HEIGHT,
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
      const buildDir = path.join(process.cwd(), 'src', 'website', 'build');

      let filePath;
      if (!pathname || pathname === '') {
        filePath = path.join(buildDir, '200.html');
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
