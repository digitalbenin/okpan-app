import { app, BrowserWindow, ipcMain, dialog, protocol } from 'electron';
import serve from 'electron-serve';
import started from 'electron-squirrel-startup';
import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import fsPromises from 'fs/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize electron-serve early (before app is ready) so its protocol is registered in time
const loadURLProd = serve({ directory: 'build' });

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
import { eq, sql, isNull } from 'drizzle-orm';
import { handleExportProject, handleExportConnections, handleImportConnections } from './handlers/exportHandlers.js';
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

// Static website export
ipcMain.handle('export-static-website', async (event, options) => {
  try {
    const { exportStaticWebsite } = await import('./services/websiteExportService.js');
    return await exportStaticWebsite(options.projectId, options.outputPath, {
      db,
      filters: options.filters,
      appPath: app.getAppPath(),
      resourcesPath: process.resourcesPath,
      isPackaged: app.isPackaged
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
    // In dev, addImageProtocolPrefix("src/...") produces hostname="src" and pathname="/assets/..."
    const host = urlObj.hostname || '';
    const pathname = decodeURIComponent(urlObj.pathname || '');
    pathStr = (host ? host + pathname : pathname).replace(/^\//, '');
  }

  // Convert to absolute path if needed
  if (/^[a-zA-Z]\//.test(pathStr)) {
    // Windows drive format (c/Users/... -> C:\\Users\\...)
    const driveLetter = pathStr.charAt(0).toUpperCase();
    const restOfPath = pathStr.substring(2);
    return process.platform === 'win32'
      ? `${driveLetter}:\\${restOfPath.replace(/\//g, '\\')}`
      : `/${pathStr}`;
  }

  if (path.isAbsolute(pathStr)) {
    return path.normalize(pathStr);
  }

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
      // Read website SPA from app resources (handles dev and packaged via app.getAppPath())
      const buildDir = path.join(app.getAppPath(), 'src', 'website', 'build');

      let filePath;
      // Default to index.html (or 200.html) for SPA fallback
      if (!pathname || pathname === '' || pathname === 'index.html') {
        filePath = path.join(buildDir, 'index.html');
        if (!fs.existsSync(filePath)) {
          filePath = path.join(buildDir, '200.html');
        }
      } else {
        filePath = path.join(buildDir, pathname);
      }

      if (fs.existsSync(filePath)) {
        callback({ path: filePath });
      } else {
        // Fallback to index.html or 200.html for client-side routing
        let fallbackPath = path.join(buildDir, 'index.html');
        if (!fs.existsSync(fallbackPath)) {
          fallbackPath = path.join(buildDir, '200.html');
        }

        if (fs.existsSync(fallbackPath)) {
          callback({ path: fallbackPath });
        } else {
          // If even the fallback is missing, signal not found
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

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});



// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
