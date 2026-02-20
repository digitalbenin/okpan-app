import { app } from 'electron';
import path from 'path';
import fs from 'fs';

/**
 * Returns the base directory used to store user-uploaded project assets.
 * Uses app.getPath('userData') in an Electron context so the location is
 * always writable in production packages (regardless of process.cwd()).
 * Falls back to a CWD-relative path for non-Electron environments (e.g. tests).
 *
 * @returns {string} Absolute path to the project_assets base directory.
 */
export function getAssetBasePath() {
    try {
        return path.join(app.getPath('userData'), 'project_assets');
    } catch {
        // Fallback for non-Electron environments (e.g. unit tests)
        return path.join(process.cwd(), 'src', 'assets', 'project_assets');
    }
}

/**
 * Returns the directory for a specific project's assets.
 * @param {string} projectId
 * @returns {string} Absolute path to the project asset folder.
 */
export function getProjectAssetFolder(projectId) {
    return path.join(getAssetBasePath(), projectId);
}

/**
 * Resolves the actual filesystem path for a stored project asset path.
 * Tries the userData-based location first, then falls back to the legacy
 * CWD-relative location so existing (pre-rename) data still works.
 *
 * @param {string} storedPath - The path value stored in the database.
 * @returns {string|null} Resolved absolute path, or null if not found.
 */
export function resolveAssetPath(storedPath) {
    if (!storedPath) return null;

    // Already absolute – return as-is if it exists.
    if (path.isAbsolute(storedPath) && fs.existsSync(storedPath)) {
        return storedPath;
    }

    const cwd = process.cwd();
    const candidates = [
        // New userData-based location
        path.join(getAssetBasePath(), storedPath),
        // Legacy: {cwd}/src/{storedPath}  (e.g. storedPath = "assets/project_assets/...")
        path.join(cwd, 'src', storedPath),
        // Legacy: {cwd}/{storedPath}
        path.join(cwd, storedPath),
    ];

    return candidates.find(fs.existsSync) ?? null;
}
