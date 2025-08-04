import { dialog } from 'electron';
import { parse } from 'csv-parse/sync';
import * as XLSX from 'xlsx';
import fs from 'fs/promises';
import { setCurrentProjectId, getCurrentProjectId, clearCurrentProjectId } from '../services/projectCache.js';

/**
 * Handler for ping requests
 * @returns {string} 'pong' response
 */
export const handlePing = () => {
    console.log('pong');
    return 'pong';
};

/**
 * Handler for opening system file dialog
 * @param {Event} event - The IPC event
 * @param {Object} options - Dialog options
 * @param {boolean} options.isDirectory - Whether to open directory picker
 * @param {boolean} options.multiple - Whether to allow multiple file selection
 * @returns {Promise<Object>} Dialog result containing selected file paths
 */
export const handleFileDialog = async (event, options) => {
    // Default filters if none are provided
    const defaultFilters = [
        { name: 'All Files', extensions: ['*'] }
    ];

    const dialogOptions = {
        // Use options.title if provided, otherwise keep it default
        title: options.title || 'Select File',
        properties: [
            options.isDirectory ? 'openDirectory' : 'openFile',
            // Use options.properties if provided (like 'openFile')
            // Note: Electron combines properties, so sending ['openFile'] 
            // from renderer is okay even if we derive it here.
            ...(Array.isArray(options.properties) ? options.properties : []),
            options.multiple && !options.isDirectory ? 'multiSelections' : null
        ].filter(p => p !== null && p !== undefined).filter((v, i, a) => a.indexOf(v) === i), // Filter nulls and duplicates
        // Use filters from options if provided, otherwise use the default
        filters: options.filters && Array.isArray(options.filters) && options.filters.length > 0
            ? options.filters
            : defaultFilters
    };

    // Log the final options being used for debugging
    // console.log("Using dialog options:", JSON.stringify(dialogOptions, null, 2));

    try {
        const result = await dialog.showOpenDialog(dialogOptions);
        return result; // Return the full result object (includes canceled flag)
    } catch (error) {
        console.error("Error showing file dialog:", error);
        // Return an error structure consistent with a cancelled dialog
        return { canceled: true, filePaths: [] };
    }
};

/**
 * Handler for importing structured data files (JSON, CSV, TSV, XLSX)
 * @param {Event} event - The IPC event
 * @param {Object} options - Dialog options
 * @param {string} options.title - Dialog title
 * @param {boolean} options.multiple - Whether to allow multiple file selection
 * @param {string} options.separator - Custom separator for CSV/TSV files (default: auto-detect)
 * @returns {Promise<Object>} Result with parsed data or error
 */
export const handleStructuredDataImport = async (event, options = {}) => {
    const filters = [
        { name: 'JSON Files', extensions: ['json'] },
        { name: 'CSV Files', extensions: ['csv'] },
        { name: 'TSV Files', extensions: ['tsv'] },
        { name: 'Excel Files', extensions: ['xlsx', 'xls'] },
        { name: 'All Supported', extensions: ['json', 'csv', 'tsv', 'xlsx', 'xls'] }
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
        const result = await dialog.showOpenDialog(dialogOptions);

        if (result.canceled || !result.filePaths?.length) {
            return { success: false, canceled: true, data: null };
        }

        const filePaths = result.filePaths;
        const parsedFiles = [];

        for (const filePath of filePaths) {
            try {
                const parsedData = await parseStructuredFile(filePath, options.separator);
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
        console.error("Error in structured data import:", error);
        return {
            success: false,
            canceled: false,
            error: error.message,
            data: null
        };
    }
};

/**
 * Parse a structured data file based on its extension
 * @param {string} filePath - Path to the file
 * @param {string} separator - Custom separator for CSV/TSV files
 * @returns {Promise<Object>} Parsed data with format info
 */
async function parseStructuredFile(filePath, separator) {
    const extension = filePath.split('.').pop().toLowerCase();
    const fileContent = await fs.readFile(filePath, 'utf-8');

    switch (extension) {
        case 'json':
            return {
                success: true,
                format: 'json',
                data: JSON.parse(fileContent),
                error: null
            };

        case 'csv':
            const csvData = parse(fileContent, {
                columns: true,
                skip_empty_lines: true,
                trim: true,
                delimiter: separator || ','
            });
            return {
                success: true,
                format: 'csv',
                data: csvData,
                error: null
            };

        case 'tsv':
            const tsvData = parse(fileContent, {
                columns: true,
                skip_empty_lines: true,
                trim: true,
                delimiter: separator || '\t'
            });
            return {
                success: true,
                format: 'tsv',
                data: tsvData,
                error: null
            };

        case 'xlsx':
        case 'xls':
            // For Excel files, we need to read as binary
            const binaryContent = await fs.readFile(filePath);
            const workbook = XLSX.read(binaryContent, { type: 'buffer' });

            // Get the first sheet
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];

            // Convert to JSON
            const excelData = XLSX.utils.sheet_to_json(sheet);

            return {
                success: true,
                format: extension,
                data: excelData,
                error: null,
                sheets: workbook.SheetNames // Include available sheet names
            };

        default:
            throw new Error(`Unsupported file format: ${extension}`);
    }
};

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
 * Handler for clearing the current project ID cache
 * @param {Event} event - The IPC event
 * @returns {Object} Success response
 */
export const handleClearCurrentProject = (event) => {
    try {
        clearCurrentProjectId();
        return { success: true };
    } catch (error) {
        console.error('Error clearing current project ID:', error);
        return { success: false, error: error.message };
    }
}; 