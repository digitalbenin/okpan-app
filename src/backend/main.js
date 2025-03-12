import { app, BrowserWindow, ipcMain, dialog, protocol } from 'electron';
import started from 'electron-squirrel-startup';
import 'dotenv/config';
import path from 'path';
import net from 'net';
import fs from 'fs';

// Import database and schema
import { db } from '../db/init.js';
import { createGraphQLSchema } from '../db/graphqlDefs.js';

// Import handlers
import { handleExportTranslations, handleImportTranslations } from './handlers/translationHandlers.js';
import { handleGraphQL } from './handlers/graphqlHandler.js';
import { handlePing, handleFileDialog } from './handlers/systemHandlers.js';
import { handleImportAssets } from './handlers/assetHandlers.js';

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
  }
]);

// Create window function
const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 1080,
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
          "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src * 'self' data: media:"
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
      console.log('Media protocol request:', request.url);
      const pathToMedia = decodeURIComponent(new URL(request.url).pathname).replace(/^\//, '');
      console.log('Path to media:', pathToMedia);

      // Get the project root directory
      const projectRoot = process.cwd();
      console.log('Project root:', projectRoot);

      // TEMPORARY!!!!!!! Try different path combinations
      const possiblePaths = [
        // Try with src prefix
        path.join(projectRoot, 'src', pathToMedia),
        // Try as-is
        path.join(projectRoot, pathToMedia),
        // Try with src prefix and Windows separators
        path.join(projectRoot, 'src', pathToMedia.replace(/\//g, '\\')),
        // Try the exact path from database
        path.join(projectRoot, pathToMedia.replace(/\//g, '\\'))
      ];

      console.log('Trying possible paths:');
      for (const tryPath of possiblePaths) {
        console.log('Attempting path:', tryPath);
        if (fs.existsSync(tryPath)) {
          console.log('File found at:', tryPath);
          callback({ path: tryPath });
          return;
        }
      }

      console.error('File not found in any of the attempted paths');
      callback({ error: -2 });
    } catch (error) {
      console.error('Media protocol error:', error);
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
