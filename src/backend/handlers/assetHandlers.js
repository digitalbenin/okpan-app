/**
 * IPC handlers for asset import operations.
 * @namespace backend.handlers.assetHandlers
 * @memberof backend.handlers
 */
import * as fs from 'fs';
import path from 'path';
import { scheduleAssetReconcile } from '../services/assetTorrentManagerService.js';
import { resolveAssetBasePath, resolveProjectAssetPath } from '../utils/assetPaths.js';
import { processAssetFile, buildSeededAssetRecord, saveAssetToDb } from '../services/assetImportService.js';

const getProgress = (progress, total) => {
    return Math.round((progress / total) * 100)
}
/**
 * Import one or more asset files into the current project.
 * @function handleImportAssets
 * @memberof backend.handlers.assetHandlers
 * @param {Electron.IpcMainInvokeEvent} event - IPC event.
 * @param {Object} data - Import payload.
 * @returns {Promise.<{errors: Array.<Object>, createdAssets: Array.<Object>, files: Array.<string>}>}
 */
const handleImportAssets = async (event, data) => {
    let errors = []
    let createdAssets = []; // Array to store created assets
    let importedFilePaths = []; // Track only files actually imported

    if (!data.projectId) {
        throw new Error("Project ID is required");
    }
    // data.isGenericAsset will determine the target table.
    // If data.isGenericAsset is true, institutionId should be null or undefined.
    // If data.isGenericAsset is false or undefined, institutionId is expected for 'assets' table.
    if (data.isGenericAsset && data.institutionId) {
        console.warn("Warning: isGenericAsset is true, but institutionId is provided. institutionId will be ignored for generic assets.");
    }


    //check if folder with projectid is present, otherwise create it
    const basePath = resolveAssetBasePath({ userDataPath: data.userDataPath });
    const projectFolder = resolveProjectAssetPath(data.projectId, { assetBasePath: basePath });
    if (!fs.existsSync(projectFolder)) {
        fs.mkdirSync(projectFolder, { recursive: true });
    }

    // Process files from directory or array
    const filesToProcess = (() => {
        if (Array.isArray(data?.files) && data.files.length) return data.files;
        if (Array.isArray(data?.paths) && data.paths.length) return data.paths;
        if (Array.isArray(data?.path) && data.path.length) return data.path;
        if (typeof data?.path === 'string') {
            if (data?.isDirectory) {
                return fs.readdirSync(data.path).map(file => path.join(data.path, file));
            }
            return [data.path];
        }
        return [];
    })();

    const totalFiles = filesToProcess.length;
    console.debug('[import-assets] total files to process:', totalFiles);

    // Throttle configuration for progress events
    const progressChannel = 'import-assets-progress';
    const throttleIntervalMs = Number.isFinite(data?.progressThrottleMs) ? data.progressThrottleMs : 500; // default 500ms
    let _lastProgressSentAt = 0;
    const sendProgress = (force = false) => {
        const now = Date.now();
        if (!force && now - _lastProgressSentAt < throttleIntervalMs) return;
        _lastProgressSentAt = now;
        try {
            event?.sender?.send(progressChannel, {
                status: 'progress',
                processed: importedFilePaths.length,
                total: totalFiles,
                percent: totalFiles > 0 ? getProgress(importedFilePaths.length, totalFiles) : 0,
                files: [...importedFilePaths]
            });
        } catch { }
    };

    // Notify renderer that import started
    try {
        event?.sender?.send('import-assets-progress', {
            status: 'start',
            total: totalFiles,
            processed: 0,
            percent: 0
        });
    } catch { }

    for (const filePath of filesToProcess) {
        try {
            console.debug('[import-assets] processing file:', filePath);
            const asset = await processAssetFile(filePath, projectFolder, data, basePath);

            if (asset) {
                const seededAssetRecord = await buildSeededAssetRecord(asset, data.isGenericAsset, data.disableP2P === true);
                const newAsset = await saveAssetToDb(seededAssetRecord, data.isGenericAsset);
                if (data.disableP2P !== true) {
                    scheduleAssetReconcile(newAsset.project_id, newAsset.id);
                }
                importedFilePaths.push(filePath);
                createdAssets.push({ ...newAsset, _sourcePath: filePath });
            }
        } catch (error) {
            console.error(`Error processing file ${filePath}:`, error);
            errors.push(error);
        }

        // Emit progress update after each attempt
        sendProgress();
    }
    // Ensure a final progress emission for UI before complete
    sendProgress(true);

    // Final completion event
    try {
        event?.sender?.send('import-assets-progress', {
            status: 'complete',
            processed: importedFilePaths.length,
            total: totalFiles,
            percent: totalFiles > 0 ? getProgress(importedFilePaths.length, totalFiles) : 0,
            files: [...importedFilePaths],
            errorsCount: errors.length
        });
    } catch { }

    return {
        errors,
        createdAssets,
        files: importedFilePaths
    }
}

export { handleImportAssets, getProgress }
