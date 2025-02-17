const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const started = require('electron-squirrel-startup');
const { graphql } = require('graphql')
require('dotenv').config();

// Import database
const { db, graphqlSchema } = require(path.join(__dirname, 'init.js'));
console.log('Database initialized successfully');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// IPC Handlers
const handleGraphQL = async (event, { query, variables }) => {
  try {
    console.log('Executing GraphQL query:', query, 'with variables:', variables);
    const result = await graphql({
      schema: graphqlSchema.schema,
      source: query,
      variableValues: variables,
      contextValue: { db }
    });

    if (result.errors) {
      console.error('GraphQL errors:', result.errors);
      return { success: false, errors: result.errors };
    }

    return { success: true, data: result.data };
  } catch (error) {
    console.error('Error executing GraphQL query:', error);
    return { success: false, error: error.message };
  }
};



const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      //sandbox: true  // Enable sandboxing
    },
  });

  // Set a secure CSP
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'"
        ]
      }
    });
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../build/index.html'));
  }

  // Open the DevTools.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.webContents.openDevTools();
  }
};

// Add this before app.whenReady()
ipcMain.handle('ping', () => {
  console.log('pong');
  return 'pong';
});

// Initialize app
app.whenReady().then(() => {


  // Register IPC handlers
  ipcMain.handle('execute-graphql', handleGraphQL)

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
