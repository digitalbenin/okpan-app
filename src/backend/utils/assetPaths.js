/**
 * Asset path helpers for resolving logical media references, normalizing asset
 * format payloads, collecting all file paths referenced by an asset row, and
 * preparing project-scoped asset references for backup/restore flows.
 *
 * @namespace backend.utils.assetPaths
 * @memberof backend.utils
 */
import path from 'path';
import electron from 'electron';

const { app } = electron;

/**
 * Logical root used when storing project asset paths in the database.
 * @memberof backend.utils.assetPaths
 * @constant {string}
 */
export const LOGICAL_ASSET_ROOT = 'src/assets/project_assets';

/**
 * Convert a filesystem path to forward-slash form for stable comparisons.
 * @function toPosixPath
 * @memberof backend.utils.assetPaths
 * @param {string} filePath - Path to normalize.
 * @returns {string}
 */
export function toPosixPath(filePath) {
  return typeof filePath === 'string' ? filePath.replace(/\\/g, '/') : '';
}

/**
 * Normalize a stored asset formats payload into an object.
 * @function normalizeAssetFormats
 * @memberof backend.utils.assetPaths
 * @param {Object|string|null|undefined} value - Raw formats payload.
 * @returns {Object.<string, *>}
 */
export function normalizeAssetFormats(value) {
  if (!value) {
    return {};
  }

  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }

  if (typeof value === 'object') {
    return value;
  }

  return {};
}

function normalizeAssetBasePath({ assetBasePath, userDataPath } = {}) {
  if (typeof assetBasePath === 'string' && assetBasePath.trim()) {
    return path.normalize(assetBasePath);
  }

  return path.normalize(resolveAssetBasePath({ userDataPath }));
}

/**
 * Resolve the absolute base directory that stores project assets.
 * @function resolveAssetBasePath
 * @memberof backend.utils.assetPaths
 * @param {Object} [options={}] - Path resolution options.
 * @param {string} [options.userDataPath] - Explicit Electron user data path.
 * @returns {string}
 */
export function resolveAssetBasePath({ userDataPath } = {}) {
  if (typeof userDataPath === 'string' && userDataPath.trim()) {
    return path.join(userDataPath.trim(), 'assets', 'project_assets');
  }

  try {
    const runtimeUserDataPath = app?.getPath?.('userData');
    if (runtimeUserDataPath) {
      return path.join(runtimeUserDataPath, 'assets', 'project_assets');
    }
  } catch {}

  return path.join(process.cwd(), LOGICAL_ASSET_ROOT);
}

/**
 * Resolve the absolute asset directory for a specific project.
 * @function resolveProjectAssetPath
 * @memberof backend.utils.assetPaths
 * @param {string} projectId - Project identifier.
 * @param {Object} [options={}] - Path resolution options.
 * @param {string} [options.assetBasePath] - Explicit asset base path.
 * @param {string} [options.userDataPath] - Explicit Electron user data path.
 * @returns {string}
 */
export function resolveProjectAssetPath(projectId, options = {}) {
  return path.join(normalizeAssetBasePath(options), projectId);
}

/**
 * Resolve a logical or relative asset reference to an absolute file path.
 * @function resolveLogicalAssetPath
 * @memberof backend.utils.assetPaths
 * @param {string} filePath - Stored asset path reference.
 * @param {Object} [options={}] - Path resolution options.
 * @param {string} [options.assetBasePath] - Explicit asset base path.
 * @param {string} [options.userDataPath] - Explicit Electron user data path.
 * @returns {string|null}
 */
export function resolveLogicalAssetPath(filePath, options = {}) {
  if (!filePath || typeof filePath !== 'string') {
    return null;
  }

  if (path.isAbsolute(filePath)) {
    return path.normalize(filePath);
  }

  const normalized = toPosixPath(filePath).replace(/^\/+/, '');
  if (normalized.startsWith(LOGICAL_ASSET_ROOT)) {
    const rest = normalized.replace(/^src\/assets\/project_assets\/?/, '');
    return path.join(normalizeAssetBasePath(options), rest);
  }

  return path.resolve(filePath);
}

/**
 * Resolve an asset file reference with a caller-provided path resolver.
 * @function resolveAssetFilePath
 * @memberof backend.utils.assetPaths
 * @param {string} filePath - Stored asset path reference.
 * @param {Function} [resolvePath=resolveLogicalAssetPath] - Path resolver.
 * @returns {string|null}
 */
export function resolveAssetFilePath(filePath, resolvePath = resolveLogicalAssetPath) {
  if (!filePath || typeof filePath !== 'string') {
    return null;
  }

  const trimmed = filePath.trim();
  if (!trimmed) {
    return null;
  }

  return typeof resolvePath === 'function' ? resolvePath(trimmed) : null;
}

/**
 * Collect the primary asset file and all derived format files for a row.
 * @function collectAssetFilePaths
 * @memberof backend.utils.assetPaths
 * @param {Object} assetRow - Asset database row or equivalent payload.
 * @param {Function} [resolvePath=resolveLogicalAssetPath] - Path resolver.
 * @returns {string[]}
 */
export function collectAssetFilePaths(assetRow, resolvePath = resolveLogicalAssetPath) {
  const files = new Set();

  const mainPath = resolveAssetFilePath(assetRow?.path, resolvePath);
  if (mainPath) {
    files.add(mainPath);
  }

  const formats = normalizeAssetFormats(assetRow?.formats);
  Object.values(formats).forEach((formatPath) => {
    const resolved = resolveAssetFilePath(formatPath, resolvePath);
    if (resolved) {
      files.add(resolved);
    }
  });

  return [...files];
}

/**
 * Normalize a single stored asset path into a project-scoped logical reference.
 * @function normalizeProjectAssetPathReference
 * @memberof backend.utils.assetPaths
 * @param {string} filePath - Stored asset path reference.
 * @param {string} projectId - Project identifier.
 * @param {Object} [options={}] - Path normalization options.
 * @param {string} [options.assetBasePath] - Explicit asset base path.
 * @param {string} [options.userDataPath] - Explicit Electron user data path.
 * @returns {string|null|undefined}
 */
export function normalizeProjectAssetPathReference(filePath, projectId, options = {}) {
  if (!filePath || typeof filePath !== 'string') {
    return filePath;
  }

  const normalizedPath = toLogicalStoredAssetPath(filePath, options);
  if (typeof normalizedPath === 'string' && normalizedPath.startsWith(LOGICAL_ASSET_ROOT)) {
    return normalizedPath;
  }

  if (!projectId || typeof projectId !== 'string') {
    return normalizedPath;
  }

  const fileName = path.basename(filePath);
  if (!fileName) {
    return normalizedPath;
  }

  return `${LOGICAL_ASSET_ROOT}/${projectId}/${fileName}`;
}

/**
 * Normalize all derived asset format paths for a project-scoped asset row.
 * @function normalizeProjectAssetFormats
 * @memberof backend.utils.assetPaths
 * @param {Object} formats - Asset formats map.
 * @param {string} projectId - Project identifier.
 * @param {Object} [options={}] - Path normalization options.
 * @returns {Object.<string, (string|null|undefined)>}
 */
export function normalizeProjectAssetFormats(formats, projectId, options = {}) {
  if (!formats || typeof formats !== 'object') {
    return formats;
  }

  const normalizedFormats = {};
  for (const [key, value] of Object.entries(formats)) {
    normalizedFormats[key] = normalizeProjectAssetPathReference(value, projectId, options);
  }

  return normalizedFormats;
}

/**
 * Normalize the path fields of a single asset row for project export/restore.
 * @function normalizeProjectAssetRow
 * @memberof backend.utils.assetPaths
 * @param {Object} assetRow - Asset database row or equivalent payload.
 * @param {string} projectId - Project identifier.
 * @param {Object} [options={}] - Path normalization options.
 * @returns {Object|null|undefined}
 */
export function normalizeProjectAssetRow(assetRow, projectId, options = {}) {
  if (!assetRow || typeof assetRow !== 'object') {
    return assetRow;
  }

  return {
    ...assetRow,
    path: normalizeProjectAssetPathReference(assetRow.path, projectId, options),
    formats: normalizeProjectAssetFormats(assetRow.formats, projectId, options),
  };
}

/**
 * Normalize the path fields of multiple asset rows for a single project.
 * @function normalizeProjectAssetRows
 * @memberof backend.utils.assetPaths
 * @param {Object[]} rows - Asset rows to normalize.
 * @param {string} projectId - Project identifier.
 * @param {Object} [options={}] - Path normalization options.
 * @returns {Object[]}
 */
export function normalizeProjectAssetRows(rows, projectId, options = {}) {
  return Array.isArray(rows)
    ? rows.map((row) => normalizeProjectAssetRow(row, projectId, options))
    : [];
}

/**
 * Convert an absolute asset path into the logical path stored by the app.
 * @function toLogicalStoredAssetPath
 * @memberof backend.utils.assetPaths
 * @param {string} filePath - Absolute or logical asset path.
 * @param {Object} [options={}] - Path normalization options.
 * @param {string} [options.assetBasePath] - Explicit asset base path.
 * @param {string} [options.userDataPath] - Explicit Electron user data path.
 * @returns {string|null|undefined}
 */
export function toLogicalStoredAssetPath(filePath, options = {}) {
  if (!filePath || typeof filePath !== 'string') {
    return filePath;
  }

  const resolvedPath = resolveLogicalAssetPath(filePath, options);
  if (!resolvedPath) {
    return filePath;
  }

  const basePath = toPosixPath(normalizeAssetBasePath(options));
  const normalizedResolvedPath = toPosixPath(path.normalize(resolvedPath));

  if (normalizedResolvedPath === basePath || normalizedResolvedPath.startsWith(`${basePath}/`)) {
    const suffix = normalizedResolvedPath.slice(basePath.length).replace(/^\/+/, '');
    return suffix ? `${LOGICAL_ASSET_ROOT}/${suffix}` : LOGICAL_ASSET_ROOT;
  }

  return normalizedResolvedPath;
}

/**
 * Convert every asset format path in a map into logical stored form.
 * @function toLogicalAssetFormats
 * @memberof backend.utils.assetPaths
 * @param {Object} formats - Asset formats map.
 * @param {Object} [options={}] - Path normalization options.
 * @returns {Object.<string, (string|null|undefined)>}
 */
export function toLogicalAssetFormats(formats, options = {}) {
  const normalizedFormats = formats && typeof formats === 'object' ? formats : {};
  const logicalFormats = {};

  for (const [key, value] of Object.entries(normalizedFormats)) {
    logicalFormats[key] = toLogicalStoredAssetPath(value, options);
  }

  return logicalFormats;
}