/**
 * IPC handlers for general system operations.
 * @namespace backend.handlers.systemHandlers
 * @memberof backend.handlers
 */
import { dialog } from 'electron';
import { parse } from 'csv-parse/sync';
import * as XLSX from 'xlsx';
import fs from 'fs/promises';
import path from 'path';
import { XMLParser } from 'fast-xml-parser';
import { setCurrentProjectId, getCurrentProjectId, clearCurrentProjectId } from '../services/projectCacheService.js';
import { stopP2PForProject, getP2PProvider } from '../services/p2pService.js';
import { stopProjectTorrents } from '../services/assetTorrentManagerService.js';
import { stopProjectAssetSignaling } from '../services/assetTorrentSignalingService.js';
import { applyImportPreset, describeImportPresets } from '../services/importPresets/index.js';

/**
 * Respond to a ping request.
 * @function handlePing
 * @memberof backend.handlers.systemHandlers
 * @returns {string}
 */
export const handlePing = () => {
    console.log('pong');
    return 'pong';
};

// Helper: convert bytes to MB (number with 2 decimals)
const bytesToMB = (bytes) => {
    const mb = bytes / (1024 * 1024);
    return Math.round(mb * 100) / 100;
};

// Helper: recursively list files in a directory with size info
async function listFilesRecursively(dirPath) {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const results = [];

    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            const subResults = await listFilesRecursively(fullPath);
            results.push(...subResults);
        } else if (entry.isFile()) {
            try {
                const stat = await fs.stat(fullPath);
                results.push({
                    path: fullPath,
                    name: entry.name,
                    size: bytesToMB(stat.size),
                });
            } catch (e) {
            }
        }
    }

    return results;
}

// Helper: list only top-level files in a directory
async function listFilesTopLevel(dirPath) {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const results = [];
    for (const entry of entries) {
        if (!entry.isFile()) continue;
        const fullPath = path.join(dirPath, entry.name);
        try {
            const stat = await fs.stat(fullPath);
            results.push({
                path: fullPath,
                name: entry.name,
                size: bytesToMB(stat.size),
            });
        } catch (e) {}
    }
    return results;
}

/**
 * Open a file or directory picker and return the selected files.
 * @function handleFileDialog
 * @memberof backend.handlers.systemHandlers
 * @param {Electron.IpcMainInvokeEvent} event - IPC event.
 * @param {Object} options - Dialog options.
 * @returns {Promise.<{canceled: boolean, filePaths: Array.<string>, files: (Array.<{path: string, name: string, size: number}>|undefined)}>}
 */
export const handleFileDialog = async (event, options) => {
    const imageFilters = [
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif'] },
        { name: 'All Files', extensions: ['*'] }
    ];

    const dialogOptions = {
        title: options.title || 'Select Image Assets',
        properties: [
            options.isDirectory ? 'openDirectory' : 'openFile',
            ...(Array.isArray(options.properties) ? options.properties : []),
            options.multiple && !options.isDirectory ? 'multiSelections' : null
        ].filter(p => p !== null && p !== undefined).filter((v, i, a) => a.indexOf(v) === i),
        filters: options.filters || imageFilters
    };

    try {
        const result = await dialog.showOpenDialog(dialogOptions);

        if (result.canceled || !result.filePaths?.length) {
            return { canceled: true, filePaths: [] };
        }

        let files = [];
        if (options.isDirectory) {
            for (const dirPath of result.filePaths) {
                const listed = options.recursive !== false
                    ? await listFilesRecursively(dirPath)
                    : await listFilesTopLevel(dirPath);
                const imageFiles = listed.filter(file => {
                    const ext = file.name.split('.').pop().toLowerCase();
                    return ['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif'].includes(ext);
                });
                files.push(...imageFiles);
            }
        } else {
            for (const filePath of result.filePaths) {
                try {
                    const stat = await fs.stat(filePath);
                    files.push({
                        path: filePath,
                        name: filePath.split(/[/\\]/).pop(),
                        size: bytesToMB(stat.size),
                    });
                } catch (e) {
                }
            }
        }

        return {
            canceled: false,
            filePaths: result.filePaths,
            files
        };
    } catch (error) {
        console.error('Error showing file dialog:', error);
        return { canceled: true, filePaths: [] };
    }
};

/**
 * Open or parse a structured data file for import.
 * @function handleStructuredDataImport
 * @memberof backend.handlers.systemHandlers
 * @param {Electron.IpcMainInvokeEvent} event - IPC event.
 * @param {Object} options - Import options.
 * @returns {Promise.<{success: boolean, canceled: boolean, data: (Object|Array.<Object>|null), error: (string|undefined)}>}
 */
export const handleStructuredDataImport = async (event, options = {}) => {
    const filters = [
        { name: 'All Supported', extensions: ['json', 'jsonld', 'json-ld', 'csv', 'tsv', 'xlsx', 'xls', 'xml'] },
        { name: 'JSON Files', extensions: ['json'] },
        { name: 'JSON-LD Files', extensions: ['jsonld', 'json-ld'] },
        { name: 'CSV Files', extensions: ['csv'] },
        { name: 'TSV Files', extensions: ['tsv'] },
        { name: 'Excel Files', extensions: ['xlsx', 'xls'] },
        { name: 'XML Files', extensions: ['xml'] }
    ];

    const dialogOptions = {
        title: options.title || 'Select Data File',
        properties: [
            'openFile',
            ...(options.multiple ? ['multiSelections'] : [])
        ],
        filters
    };

    try {
        let filePaths = [];

        if (options.filePath) {
            filePaths = [options.filePath];
        } else {
            const result = await dialog.showOpenDialog(dialogOptions);

            if (result.canceled || !result.filePaths?.length) {
                return { success: false, canceled: true, data: null };
            }

            filePaths = result.filePaths;
        }

        const parsedFiles = [];

        for (const filePath of filePaths) {
            try {
                const parsedData = await parseStructuredFile(filePath, {
                    separator: options.separator,
                    selectedPreset: options.selectedPreset
                });

                parsedFiles.push({
                    filePath,
                    fileName: filePath.split(/[/\\]/).pop(),
                    ...parsedData
                });
            } catch (error) {
                console.error(`Error parsing file ${filePath}:`, error);
                parsedFiles.push({
                    filePath,
                    fileName: filePath.split(/[/\\]/).pop(),
                    success: false,
                    error: error.message,
                    data: null,
                    format: 'unknown'
                });
            }
        }

        return {
            success: true,
            canceled: false,
            data: options.multiple ? parsedFiles : parsedFiles[0]
        };
    } catch (error) {
        console.error('Error in structured data import:', error);
        return {
            success: false,
            canceled: false,
            error: error.message,
            data: null
        };
    }
};

async function parseStructuredFile(filePath, options = {}) {
    const { separator, selectedPreset } = options;
    const extension = filePath.split('.').pop().toLowerCase();
    const fileContent = await fs.readFile(filePath, 'utf-8');

    switch (extension) {
        case 'json':
        case 'jsonld':
        case 'json-ld':
            return finalizeParsedData({
                success: true,
                format: 'json',
                data: JSON.parse(fileContent),
                error: null
            }, selectedPreset);

        case 'csv': {
            const csvData = parse(fileContent, {
                columns: true,
                skip_empty_lines: true,
                trim: true,
                delimiter: separator || ',',
                relax_column_count: true
            });

            return finalizeParsedData({
                success: true,
                format: 'csv',
                data: csvData,
                error: null
            }, selectedPreset);
        }

        case 'tsv': {
            const tsvData = parse(fileContent, {
                columns: true,
                skip_empty_lines: true,
                trim: true,
                delimiter: separator || '\t',
                relax_column_count: true
            });

            return finalizeParsedData({
                success: true,
                format: 'tsv',
                data: tsvData,
                error: null
            }, selectedPreset);
        }

        case 'xlsx':
        case 'xls': {
            const binaryContent = await fs.readFile(filePath);
            const workbook = XLSX.read(binaryContent, { type: 'buffer' });

            if (workbook.SheetNames.length > 1) {
                return finalizeParsedData({
                    success: true,
                    format: extension,
                    multiPage: true,
                    sheets: workbook.SheetNames,
                    data: null,
                    error: null
                }, selectedPreset);
            }

            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const excelData = XLSX.utils.sheet_to_json(sheet);

            return finalizeParsedData({
                success: true,
                format: extension,
                multiPage: false,
                data: excelData,
                error: null,
                sheets: workbook.SheetNames
            }, selectedPreset);
        }

        case 'xml':
            try {
                const parser = new XMLParser({
                    ignoreAttributes: false,
                    attributeNamePrefix: '@_'
                });
                const parsedContent = parser.parse(fileContent);

                return finalizeParsedData({
                    success: true,
                    format: 'xml',
                    data: parsedContent,
                    error: null
                }, selectedPreset);
            } catch (error) {
                throw new Error(`XML parsing error: ${error.message}`);
            }

        default:
            throw new Error(`Unsupported file format: ${extension}`);
    }
}

async function finalizeParsedData(parsedData, selectedPreset) {
    if (selectedPreset) {
        return applyImportPreset(parsedData, { selectedPreset });
    }

    return describeImportPresets(parsedData);
}

/**
 * Store the current project ID in the local cache.
 * @function handleSetCurrentProject
 * @memberof backend.handlers.systemHandlers
 * @param {Electron.IpcMainInvokeEvent} event - IPC event.
 * @param {string} projectId - Project ID to cache.
 * @returns {{success: boolean, projectId: (string|undefined), error: (string|undefined)}}
 */
export const handleSetCurrentProject = (event, projectId) => {
    try {
        setCurrentProjectId(projectId);
        return { success: true, projectId };
    } catch (error) {
        console.error('Error setting current project ID:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Read the current cached project ID.
 * @function handleGetCurrentProject
 * @memberof backend.handlers.systemHandlers
 * @param {Electron.IpcMainInvokeEvent} event - IPC event.
 * @returns {{success: boolean, projectId: (string|null|undefined), error: (string|undefined)}}
 */
export const handleGetCurrentProject = (event) => {
    try {
        const projectId = getCurrentProjectId();
        return { success: true, projectId };
    } catch (error) {
        console.error('Error getting current project ID:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Parse a selected worksheet from an Excel file.
 * @function handleExcelSheetSelection
 * @memberof backend.handlers.systemHandlers
 * @param {Electron.IpcMainInvokeEvent} event - IPC event.
 * @param {Object} options - Sheet selection options.
 * @returns {Promise.<{success: boolean, format: (string|undefined), multiPage: (boolean|undefined), data: (Array.<Object>|null), error: (string|null|undefined), selectedSheet: (string|undefined)}>}
 */
export const handleExcelSheetSelection = async (event, options) => {
    const { filePath, sheetName } = options;

    if (!filePath || !sheetName) {
        return {
            success: false,
            error: 'File path and sheet name are required',
            data: null
        };
    }

    try {
        const extension = filePath.split('.').pop().toLowerCase();

        if (!['xlsx', 'xls'].includes(extension)) {
            return {
                success: false,
                error: 'File must be an Excel file (.xlsx or .xls)',
                data: null
            };
        }

        // Read the file as binary
        const binaryContent = await fs.readFile(filePath);
        const workbook = XLSX.read(binaryContent, { type: 'buffer' });

        // Check if the requested sheet exists
        if (!workbook.SheetNames.includes(sheetName)) {
            return {
                success: false,
                error: `Sheet "${sheetName}" not found. Available sheets: ${workbook.SheetNames.join(', ')}`,
                data: null
            };
        }

        // Get the requested sheet
        const sheet = workbook.Sheets[sheetName];

        // Convert to JSON
        const excelData = XLSX.utils.sheet_to_json(sheet);

        return {
            success: true,
            format: extension,
            multiPage: false,
            data: excelData,
            error: null,
            //sheets: workbook.SheetNames,
            selectedSheet: sheetName
        };

    } catch (error) {
        console.error('Error parsing Excel sheet:', error);
        return {
            success: false,
            error: error.message,
            data: null
        };
    }
};

/**
 * Clear the cached project ID and stop related sync processes.
 * @function handleClearCurrentProject
 * @memberof backend.handlers.systemHandlers
 * @param {Electron.IpcMainInvokeEvent} event - IPC event.
 * @returns {Promise.<{success: boolean, error: (string|undefined)}>}
 */
export const handleClearCurrentProject = async (event) => {
    try {
        const currentProjectId = getCurrentProjectId();
        console.log('[P2P] clearCurrentProject', { currentProjectId, hasProvider: currentProjectId ? !!getP2PProvider(currentProjectId) : false });
        if (currentProjectId) {
            await stopProjectTorrents(currentProjectId);
            await stopP2PForProject(currentProjectId);
            stopProjectAssetSignaling(currentProjectId);
        }
        clearCurrentProjectId();
        return { success: true };
    } catch (error) {
        console.error('Error clearing current project ID:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Read a file from disk as UTF-8 text.
 * @memberof backend.handlers.systemHandlers
 * @param {Electron.IpcMainInvokeEvent} _event - IPC event.
 * @param {string} filePath - Absolute file path.
 * @returns {Promise<string>}
 */
export async function handleReadFile(_event, filePath) {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('Invalid file path provided.');
  }

  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    throw new Error(`Failed to read file: ${error.message}`);
  }
}