import path from 'path';
import electron from 'electron';

const { app } = electron;

export const LOGICAL_ASSET_ROOT = 'src/assets/project_assets';

export function toPosixPath(filePath) {
  return typeof filePath === 'string' ? filePath.replace(/\\/g, '/') : '';
}

function normalizeAssetBasePath({ assetBasePath, userDataPath } = {}) {
  if (typeof assetBasePath === 'string' && assetBasePath.trim()) {
    return path.normalize(assetBasePath);
  }

  return path.normalize(resolveAssetBasePath({ userDataPath }));
}

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

export function resolveProjectAssetPath(projectId, options = {}) {
  return path.join(normalizeAssetBasePath(options), projectId);
}

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

export function toLogicalAssetFormats(formats, options = {}) {
  const normalizedFormats = formats && typeof formats === 'object' ? formats : {};
  const logicalFormats = {};

  for (const [key, value] of Object.entries(normalizedFormats)) {
    logicalFormats[key] = toLogicalStoredAssetPath(value, options);
  }

  return logicalFormats;
}