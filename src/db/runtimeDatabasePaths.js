import path from 'path';
import electron from 'electron';

const { app } = electron;

const DEFAULT_DEV_DB_RELATIVE_PATH = 'src/db/local.db';
const DEFAULT_PACKAGED_DB_DIRECTORY = 'db';
const DEFAULT_PACKAGED_DB_FILE_NAME = 'local.db';

export const DATABASE_MEDIA_ALIAS = 'app-db/current.db';
export const DATABASE_MEDIA_URL = `media://${DATABASE_MEDIA_ALIAS}`;

export function resolveApplicationRoot() {
    const isElectron = !!process.versions.electron;

    if (isElectron && app?.isPackaged) {
        return app.getAppPath?.()
            || (process.resourcesPath ? path.join(process.resourcesPath, 'app') : process.cwd());
    }

    return process.cwd();
}

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