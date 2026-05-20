/**
 * Media protocol registration for resolving `media://` URLs to local files.
 *
 * @namespace backend.protocols.media
 * @memberof backend.protocols
 */
import { protocol, app } from 'electron';
import path from 'path';
import fs from 'fs';
import { DATABASE_MEDIA_ALIAS } from '../../db/runtimeDatabasePaths.js';
import { dbPath } from '../../db/init.js';
import { LOGICAL_ASSET_ROOT, resolveLogicalAssetPath } from '../utils/assetPaths.js';

function resolveMediaPath(urlObj, requestUrl) {
  let pathStr;

  if (requestUrl) {
    const rawPath = requestUrl.substring('media://'.length);
    const pathEndIndex = rawPath.search(/[?#]/);
    const normalizedRawPath = pathEndIndex >= 0 ? rawPath.substring(0, pathEndIndex) : rawPath;
    pathStr = decodeURIComponent(normalizedRawPath);
  } else {
    const host = urlObj.hostname || '';
    const pathname = decodeURIComponent(urlObj.pathname || '');

    if (host && /^[a-zA-Z]$/.test(host)) {
      pathStr = `${host}:${pathname}`;
    } else {
      pathStr = host ? host + pathname : pathname;
    }

    if (!/^[a-zA-Z]:\//.test(pathStr)) {
      pathStr = pathStr.replace(/^\//, '');
    }
  }

  const normalizedLogicalPath = pathStr.replace(/^\/+/, '');
  if (normalizedLogicalPath === DATABASE_MEDIA_ALIAS) {
    return dbPath ? path.normalize(dbPath) : null;
  }

  if (/^[a-zA-Z]:\//.test(pathStr)) {
    const normalizedWinPath = process.platform === 'win32'
      ? pathStr.replace(/\//g, '\\')
      : pathStr;
    if (fs.existsSync(normalizedWinPath)) return path.normalize(normalizedWinPath);
  }

  if (/^[a-zA-Z]\//.test(pathStr)) {
    const driveLetter = pathStr.charAt(0).toUpperCase();
    const restOfPath = pathStr.substring(pathStr.indexOf('/') + 1);
    const winPathStr = process.platform === 'win32'
      ? `${driveLetter}:\\${restOfPath.replace(/\//g, '\\')}`
      : `/${pathStr}`;
    if (fs.existsSync(winPathStr)) return path.normalize(winPathStr);
  }

  if (path.isAbsolute(pathStr)) {
    if (fs.existsSync(pathStr)) return path.normalize(pathStr);
  }

  const maybePosixAbsolute = '/' + pathStr;
  if (path.isAbsolute(maybePosixAbsolute) && fs.existsSync(maybePosixAbsolute)) {
    return path.normalize(maybePosixAbsolute);
  }

  pathStr = pathStr.replace(/^\//, '');

  const projectRoot = process.cwd();
  const appRoot = app.getAppPath?.() || '';
  const resourcesApp = process.resourcesPath ? path.join(process.resourcesPath, 'app') : '';
  const logicalAssetCandidate = pathStr.startsWith(LOGICAL_ASSET_ROOT)
    ? resolveLogicalAssetPath(pathStr)
    : null;

  const candidates = [
    appRoot ? path.join(appRoot, pathStr) : null,
    appRoot ? path.join(appRoot, 'src', pathStr) : null,
    resourcesApp ? path.join(resourcesApp, pathStr) : null,
    resourcesApp ? path.join(resourcesApp, 'src', pathStr) : null,
    logicalAssetCandidate,
    path.join(projectRoot, pathStr),
    path.join(projectRoot, 'src', pathStr)
  ].filter(Boolean);

  return candidates.find(fs.existsSync) || null;
}

/**
 * Registers the `media://` file protocol.
 * @memberof backend.protocols.media
 * @returns {void}
 */
export function registerMediaProtocol() {
  protocol.registerFileProtocol('media', (request, callback) => {
    try {
      const resolvedPath = resolveMediaPath(new URL(request.url), request.url);
      if (resolvedPath && fs.existsSync(resolvedPath)) {
        callback({ path: resolvedPath });
      } else {
        callback({ error: -2 });
      }
    } catch (error) {
      console.error('Media protocol error:', error);
      callback({ error: -2 });
    }
  });
}