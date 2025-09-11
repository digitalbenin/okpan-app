import { dialog } from 'electron';
import { exportProjectJson } from '../services/exportJsonService.js';
import { exportProjectSql } from '../services/exportSqlService.js';

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

        if (!filters?.project_id) {
            throw new Error('project_id is required in filters');
        }

        // SQL export
        let filePath = inputFilePath;
        const wantZip = mode === 'zip' || (typeof filePath === 'string' && filePath.toLowerCase().endsWith('.zip'));

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