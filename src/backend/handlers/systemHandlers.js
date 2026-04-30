import { dialog } from 'electron';
import { parse } from 'csv-parse/sync';
import * as XLSX from 'xlsx';
import fs from 'fs/promises';
import path from 'path';
import { XMLParser } from 'fast-xml-parser';
import { setCurrentProjectId, getCurrentProjectId, clearCurrentProjectId } from '../services/projectCache.js';
import { stopP2PForProject } from '../services/p2pService.js';
import { stopProjectTorrents } from '../services/assetTorrentManager.js';
import { applyImportPreset, describeImportPresets } from '../services/importPresets/index.js';

/**
 * Handler for ping requests
 * @returns {string} 'pong' response
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
                const listed = await listFilesRecursively(dirPath);
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

export const handleStructuredDataImport = async (event, options = {}) => {
    const filters = [
        { name: 'All Supported', extensions: ['json', 'csv', 'tsv', 'xlsx', 'xls', 'xml'] },
        { name: 'JSON Files', extensions: ['json'] },
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

function finalizeParsedData(parsedData, selectedPreset) {
    if (selectedPreset) {
        return applyImportPreset(parsedData, { selectedPreset });
    }

    return describeImportPresets(parsedData);
}

/**
 * Handler for setting the current project ID in cache
 * @param {Event} event - The IPC event
 * @param {string} projectId - The project ID to cache
 * @returns {Object} Success response
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
 * Handler for getting the current cached project ID
 * @param {Event} event - The IPC event
 * @returns {Object} Response with current project ID
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
 * Handler for parsing a specific sheet from an Excel file
 * @param {Event} event - The IPC event
 * @param {Object} options - Options for sheet parsing
 * @param {string} options.filePath - Path to the Excel file
 * @param {string} options.sheetName - Name of the sheet to parse
 * @returns {Promise<Object>} Result with parsed data or error
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
 * Handler for clearing the current project ID cache
 * @param {Event} event - The IPC event
 * @returns {Object} Success response
 */
export const handleClearCurrentProject = async (event) => {
    try {
        const currentProjectId = getCurrentProjectId();
        if (currentProjectId) {
            await stopProjectTorrents(currentProjectId);
            await stopP2PForProject(currentProjectId);
        }
        clearCurrentProjectId();
        return { success: true };
    } catch (error) {
        console.error('Error clearing current project ID:', error);
        return { success: false, error: error.message };
    }
};