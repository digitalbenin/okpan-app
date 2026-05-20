/**
 * IPC handlers for project backup and restore operations.
 * @namespace backend.handlers.backupHandler
 * @memberof backend.handlers
 */
import { dialog } from 'electron';
import { createProjectBackup, restoreProjectBackup, checkProjectExists, inspectBackupFile } from '../services/backupService.js';

/**
 * Create a backup file for a project.
 * @memberof backend.handlers.backupHandler
 * @param {Electron.IpcMainInvokeEvent} event - IPC event.
 * @param {Object} options - Backup options.
 * @param {Object} options.db - Database connection.
 * @returns {Promise<Object>}
 */
export async function handleCreateBackup(event, options, { db }) {
  try {
    const { project_id } = options || {};

    if (!project_id) {
      throw new Error('project_id is required');
    }

    // open save dialog to select backup file path
    const result = await dialog.showSaveDialog({
      title: 'Save Project Backup',
      defaultPath: `backup-${project_id}-${Date.now()}.dctx`,
      filters: [
        { name: 'DB Connection Tool Backup', extensions: ['dctx'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['createDirectory', 'showOverwriteConfirmation']
    });

    if (result.canceled) {
      return { canceled: true };
    }

    // create backup file
    const backupResult = await createProjectBackup(
      { project_id, filePath: result.filePath },
      { db }
    );

    return {
      success: true,
      ...backupResult
    };
  } catch (error) {
    console.error('Error creating backup:', error);
    throw error;
  }
}

/**
 * Open a file picker for selecting a backup archive.
 * @memberof backend.handlers.backupHandler
 * @param {Electron.IpcMainInvokeEvent} event - IPC event.
 * @returns {Promise<Object>}
 */
export async function handleSelectBackupFile(event) {
  try {
    const result = await dialog.showOpenDialog({
      title: 'Select Project Backup File',
      filters: [
        { name: 'DB Connection Tool Backup', extensions: ['dctx'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    });

    if (result.canceled) {
      return { canceled: true };
    }

    return {
      success: true,
      filePath: result.filePaths[0]
    };
  } catch (error) {
    console.error('Error selecting backup file:', error);
    throw error;
  }
}

/**
 * Inspect a backup file and return its validation details.
 * @memberof backend.handlers.backupHandler
 * @param {Electron.IpcMainInvokeEvent} event - IPC event.
 * @param {Object} options - Inspection options.
 * @param {Object} options.db - Database connection.
 * @returns {Promise<Object>}
 */
export async function handleCheckBackupFile(event, options, { db }) {
  const { filePath } = options || {};

  if (!filePath) {
    throw new Error('filePath is required');
  }

  try {
    return await inspectBackupFile(filePath, { db });
  } catch (error) {
    console.error('Error checking backup file:', error);
    throw error;
  }
}

/**
 * Restore a project backup using the selected merge strategy.
 * @memberof backend.handlers.backupHandler
 * @param {Electron.IpcMainInvokeEvent} event - IPC event.
 * @param {Object} options - Restore options.
 * @param {Object} options.db - Database connection.
 * @returns {Promise<Object>}
 */
export async function handleRestoreBackup(event, options, { db }) {
  try {
    const { filePath, strategy = 'merge' } = options || {};

    if (!filePath) {
      throw new Error('filePath is required');
    }

    if (!['merge', 'overwrite'].includes(strategy)) {
      throw new Error('strategy must be "merge" or "overwrite"');
    }

    const restoreResult = await restoreProjectBackup(
      { filePath, strategy },
      { db }
    );

    return {
      success: true,
      ...restoreResult
    };
  } catch (error) {
    console.error('Error restoring backup:', error);
    throw error;
  }
}
