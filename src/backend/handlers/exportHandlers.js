/**
 * IPC handlers for export and import flows.
 * @namespace backend.handlers.exportHandlers
 * @memberof backend.handlers
 */
import { dialog } from 'electron';
import { eq, and } from 'drizzle-orm';
import { db } from '../../db/init.js';
import * as dbSchema from '../../db/schema.js';
import { exportProjectJson } from '../services/exportJsonService.js';
import { exportProjectSql } from '../services/exportSqlService.js';
import { exportProjectCsv } from '../services/exportCsvService.js';
import { exportConnectionsJson } from '../services/exportConnectionsJsonService.js';
import { importConnectionsJson } from '../services/importConnectionsJsonService.js';
import { exportConnectionTypeCsv } from '../services/exportConnectionTypeCsvService.js';
import { importConnectionTypeCsv } from '../services/importConnectionTypeCsvService.js';
import { sanitizeFilename } from '../utils/exportUtils.js';
export { buildCounts, makeExportResult, buildObjectSearchConditions } from '../utils/exportUtils.js';

/**
 * Export the current project as SQL, JSON, or CSV.
 * @memberof backend.handlers.exportHandlers
 * @param {Electron.IpcMainInvokeEvent} event - IPC event.
 * @param {Object} options - Export options.
 * @param {Object} options.db - Database connection.
 * @returns {Promise.<{canceled: (boolean|undefined), success: (boolean|undefined), error: (string|undefined)}>}
 */
export async function handleExportProject(event, options, { db }) {
    try {
        const {
            filePath: inputFilePath,
            filters = {},
            includeAssets = false,
            mode = 'sql', // 'sql' | 'zip' (only relevant for SQL)
            format = 'json' // 'sql' | 'json' (default to JSON for unified API)
        } = options || {};

        // Route by format
        if (format === 'json') {
            // Handle file path for JSON export
            let filePath = inputFilePath;
            if (!filePath) {
                const result = await dialog.showSaveDialog({
                    title: 'Save JSON Export ZIP',
                    defaultPath: 'export-json.zip',
                    filters: [{ name: 'Zip', extensions: ['zip'] }]
                });
                if (result.canceled) return { canceled: true };
                filePath = result.filePath;
            }

            // Ensure .zip extension for JSON
            const zipPath = filePath && typeof filePath === 'string' && filePath.toLowerCase().endsWith('.zip')
                ? filePath
                : (filePath + '.zip');
            return await exportProjectJson({ filePath: zipPath, filters, includeAssets }, { db });
        }

        if (format === 'csv') {
            let filePath = inputFilePath;
            if (!filePath) {
                const result = await dialog.showSaveDialog({
                    title: 'Save CSV Export ZIP',
                    defaultPath: 'export-csv.zip',
                    filters: [{ name: 'Zip', extensions: ['zip'] }]
                });
                if (result.canceled) return { canceled: true };
                filePath = result.filePath;
            }
            const zipPath = filePath && typeof filePath === 'string' && filePath.toLowerCase().endsWith('.zip')
                ? filePath
                : (filePath + '.zip');
            return await exportProjectCsv({ filePath: zipPath, filters, includeAssets }, { db });
        }

        if (!filters?.project_id) {
            throw new Error('project_id is required in filters');
        }

        // SQL export
        let filePath = inputFilePath;
        const wantZip = (mode === 'zip' || includeAssets) || (typeof filePath === 'string' && filePath.toLowerCase().endsWith('.zip'));

        if (!filePath) {
            const result = await dialog.showSaveDialog({
                title: wantZip ? 'Save Export ZIP' : 'Save SQL export',
                defaultPath: wantZip ? 'export.zip' : 'export.sql',
                filters: wantZip ? [{ name: 'Zip', extensions: ['zip'] }] : [{ name: 'SQL', extensions: ['sql'] }]
            });
            if (result.canceled) return { canceled: true };
            filePath = result.filePath;
        }

        return await exportProjectSql(
            { filePath, filters, includeAssets, mode: wantZip ? 'zip' : 'sql' },
            { db }
        );
    } catch (error) {
        console.error('Error in handleExportProject:', error);
        throw error;
    }
}

/**
 * Export all connections for a project as a JSON archive.
 * @memberof backend.handlers.exportHandlers
 * @param {Electron.IpcMainInvokeEvent} event - IPC event.
 * @param {Object} options - Export options.
 * @param {Object} options.db - Database connection.
 * @returns {Promise.<{canceled: (boolean|undefined), success: (boolean|undefined), error: (string|undefined)}>}
 */
export async function handleExportConnections(event, options, { db }) {
  try {
    const {
      filePath: inputFilePath,
      projectId
    } = options || {};

    if (!projectId) {
      throw new Error('projectId is required');
    }

    let filePath = inputFilePath;
    if (!filePath) {
      const result = await dialog.showSaveDialog({
        title: 'Save Connections Export ZIP',
        defaultPath: 'connections-export.zip',
        filters: [{ name: 'Zip', extensions: ['zip'] }]
      });
      if (result.canceled) return { canceled: true };
      filePath = result.filePath;
    }

    const zipPath = filePath && typeof filePath === 'string' && filePath.toLowerCase().endsWith('.zip')
      ? filePath
      : (filePath + '.zip');

    return await exportConnectionsJson({ filePath: zipPath, projectId }, { db });
  } catch (error) {
    console.error('Error in handleExportConnections:', error);
    throw error;
  }
}

/**
 * Import connections from a JSON archive.
 * @memberof backend.handlers.exportHandlers
 * @param {Electron.IpcMainInvokeEvent} event - IPC event.
 * @param {Object} options - Import options.
 * @param {Object} options.db - Database connection.
 * @returns {Promise.<{canceled: (boolean|undefined), success: (boolean|undefined), error: (string|undefined)}>}
 */
export async function handleImportConnections(event, options, { db }) {
  try {
    const { filePath: inputFilePath, projectId } = options || {};

    if (!projectId) {
      throw new Error('projectId is required');
    }

    let filePath = inputFilePath;
    if (!filePath) {
      const result = await dialog.showOpenDialog({
        title: 'Import Connections Export ZIP',
        filters: [{ name: 'Zip', extensions: ['zip'] }],
        properties: ['openFile']
      });
      if (result.canceled) return { canceled: true };
      filePath = result.filePaths[0];
    }

    return await importConnectionsJson({ filePath, projectId }, { db });
  } catch (error) {
    console.error('Error in handleImportConnections:', error);
    throw error;
  }
}

/**
 * Export a specific connection type as a CSV file.
 * @memberof backend.handlers.exportHandlers
 * @param {Electron.IpcMainInvokeEvent} event - IPC event.
 * @param {Object} options - Export options.
 * @param {Object} options.db - Database connection.
 * @returns {Promise.<{canceled: (boolean|undefined), success: (boolean|undefined), error: (string|undefined)}>}
 */
export async function handleExportConnectionTypeCsv(event, options, { db }) {
  try {
    const {
      filePath: inputFilePath,
      projectId,
      connectionTypeId
    } = options || {};

    if (!projectId) {
      throw new Error('projectId is required');
    }
    if (!connectionTypeId) {
      throw new Error('connectionTypeId is required');
    }

    const [connectionType] = await db
      .select({
        id: dbSchema.research_fields.id,
        name: dbSchema.texts.content
      })
      .from(dbSchema.research_fields)
      .leftJoin(dbSchema.texts, eq(dbSchema.texts.id, dbSchema.research_fields.name_id))
      .where(and(
        eq(dbSchema.research_fields.id, connectionTypeId),
        eq(dbSchema.research_fields.project_id, projectId)
      ))
      .execute();

    if (!connectionType) {
      throw new Error('Connection type not found');
    }

    let filePath = inputFilePath;
    if (!filePath) {
      const result = await dialog.showSaveDialog({
        title: 'Save Connection Type CSV Export',
        defaultPath: `${sanitizeFilename(connectionType.name, 'connection-type')}.csv`,
        filters: [{ name: 'CSV', extensions: ['csv'] }]
      });
      if (result.canceled) return { canceled: true };
      filePath = result.filePath;
    }

    const csvPath = filePath && typeof filePath === 'string' && filePath.toLowerCase().endsWith('.csv')
      ? filePath
      : `${filePath}.csv`;

    return await exportConnectionTypeCsv({ filePath: csvPath, projectId, connectionTypeId }, { db });
  } catch (error) {
    console.error('Error in handleExportConnectionTypeCsv:', error);
    throw error;
  }
}

/**
 * Import a specific connection type from a CSV file.
 * @memberof backend.handlers.exportHandlers
 * @param {Electron.IpcMainInvokeEvent} event - IPC event.
 * @param {Object} options - Import options.
 * @param {Object} options.db - Database connection.
 * @returns {Promise.<{canceled: (boolean|undefined), success: (boolean|undefined), error: (string|undefined)}>}
 */
export async function handleImportConnectionTypeCsv(event, options, { db }) {
  try {
    const {
      filePath: inputFilePath,
      projectId,
      connectionTypeName
    } = options || {};

    if (!projectId) {
      throw new Error('projectId is required');
    }
    if (!connectionTypeName) {
      throw new Error('connectionTypeName is required');
    }

    let filePath = inputFilePath;
    if (!filePath) {
      const result = await dialog.showOpenDialog({
        title: 'Import Connection Type CSV',
        filters: [{ name: 'CSV', extensions: ['csv'] }],
        properties: ['openFile']
      });
      if (result.canceled) return { canceled: true };
      filePath = result.filePaths[0];
    }

    return await importConnectionTypeCsv({ filePath, projectId, connectionTypeName }, { db });
  } catch (error) {
    console.error('Error in handleImportConnectionTypeCsv:', error);
    throw error;
  }
}

/**
 * Export the project as a static website.
 * @memberof backend.handlers.exportHandlers
 * @param {Electron.IpcMainInvokeEvent} _event - IPC event.
 * @param {Object} options - Export options.
 * @param {Object} options.app - Electron app instance.
 * @returns {Promise.<{success: (boolean|undefined), error: (string|undefined)}>}
 */
export async function handleExportStaticWebsite(_event, options, { app }) {
  try {
    const { exportStaticWebsite } = await import('../services/websiteExportService.js');
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
}