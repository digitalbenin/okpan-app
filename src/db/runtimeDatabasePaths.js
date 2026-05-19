import path from 'path';
import electron from 'electron';

const { app } = electron;

const DEFAULT_DEV_DB_RELATIVE_PATH = 'src/db/local.db';
const DEFAULT_PACKAGED_DB_DIRECTORY = 'db';
const DEFAULT_PACKAGED_DB_FILE_NAME = 'local.db';

export const DATABASE_MEDIA_ALIAS = 'app-db/current.db';
export const DATABASE_MEDIA_URL = `media://${DATABASE_MEDIA_ALIAS}`;

/**
 * Resolves the application root directory based on the current runtime environment.
 * In a packaged Electron app, uses `app.getAppPath()` or falls back to `resourcesPath`.
 * In development, returns `process.cwd()`.
 *
 * @returns {string} Absolute path to the application root.
 */
export function resolveApplicationRoot() {
    const isElectron = !!process.versions.electron;

    if (isElectron && app?.isPackaged) {
        return app.getAppPath?.()
            || (process.resourcesPath ? path.join(process.resourcesPath, 'app') : process.cwd());
    }

    return process.cwd();
}

/**
 * Pure-function variant of resolveApplicationRoot that accepts explicit values
 * instead of reading from the Electron `app` singleton. Useful when the caller
 * has already resolved these values from the IPC context.
 *
 * @param {{ appPath?: string, resourcesPath?: string, isPackaged?: boolean }} params
 * @returns {string} Absolute path to the application root.
 */
export function resolveAppRootFromParams({ appPath, resourcesPath, isPackaged } = {}) {
    if (isPackaged) {
        return appPath || (resourcesPath ? path.join(resourcesPath, 'app') : process.cwd());
    }

    return appPath || process.cwd();
}

/**
 * Resolves the absolute path to the SQLite database file.
 * Resolution order: `DB_FILE_NAME` env var → Electron `userData` dir (packaged) → local dev path.
 *
 * @returns {string} Absolute path to the database file.
 */
export function resolveDatabasePath() {
    const configuredPath = process.env.DB_FILE_NAME?.trim();

    if (configuredPath) {
        return path.isAbsolute(configuredPath)
            ? configuredPath
            : path.resolve(configuredPath);
    }

    if (app?.isPackaged) {
        return path.join(
            app.getPath('userData'),
            DEFAULT_PACKAGED_DB_DIRECTORY,
            DEFAULT_PACKAGED_DB_FILE_NAME
        );
    }

    return path.resolve(DEFAULT_DEV_DB_RELATIVE_PATH);
}