/**
 * Filesystem helpers shared across backend services and handlers.
 *
 * @namespace backend.utils.fsUtils
 * @memberof backend.utils
 */
import path from 'path';
import fsPromises from 'fs/promises';

import { collectAssetFilePaths } from './assetPaths.js';

/**
 * Default retry settings applied to Windows filesystem removal calls.
 * @memberof backend.utils.fsUtils
 * @constant {{maxRetries:number, retryDelay:number}}
 */
export const WINDOWS_FS_RETRY_OPTIONS = { maxRetries: 10, retryDelay: 200 };

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isPathMissingError(error) {
  return error?.code === 'ENOENT';
}

function isRetryableFsError(error) {
  return ['EPERM', 'EBUSY', 'ENOTEMPTY', 'EMFILE', 'ENFILE'].includes(error?.code);
}

async function ensureWritable(targetPath) {
  try {
    await fsPromises.chmod(targetPath, 0o666);
  } catch (error) {
    if (!isPathMissingError(error)) {
      try {
        const entries = await fsPromises.readdir(targetPath, { withFileTypes: true });
        await Promise.allSettled(entries.map(async (entry) => {
          const childPath = path.join(targetPath, entry.name);
          if (entry.isDirectory()) {
            await ensureWritable(childPath);
            try {
              await fsPromises.chmod(childPath, 0o777);
            } catch {}
            return;
          }
          try {
            await fsPromises.chmod(childPath, 0o666);
          } catch {}
        }));
      } catch {}
    }
  }
}

/**
 * Ensure a directory exists before writing files into it.
 * @memberof backend.utils.fsUtils
 * @param {string} dirPath - Directory path to create.
 * @returns {Promise<void>}
 */
export async function ensureDir(dirPath) {
  await fsPromises.mkdir(dirPath, { recursive: true });
}

/**
 * Write a JSON value to disk with pretty formatting.
 * @memberof backend.utils.fsUtils
 * @param {string} filePath - Destination JSON file path.
 * @param {*} value - Serializable JSON value.
 * @returns {Promise<void>}
 */
export async function writeJsonFile(filePath, value) {
  await ensureDir(path.dirname(filePath));
  await fsPromises.writeFile(filePath, JSON.stringify(value, null, 2), 'utf-8');
}

/**
 * Read and parse a JSON file from disk.
 * @memberof backend.utils.fsUtils
 * @param {string} filePath - JSON file path.
 * @returns {Promise<*>}
 */
export async function readJsonFile(filePath) {
  const raw = await fsPromises.readFile(filePath, 'utf-8');
  return JSON.parse(raw);
}

/**
 * Copy a file if it exists, creating the destination directory when needed.
 * @memberof backend.utils.fsUtils
 * @param {string} sourcePath - Source file path.
 * @param {string} destinationPath - Destination file path.
 * @returns {Promise<boolean>}
 */
export async function copyFileIfExists(sourcePath, destinationPath) {
  try {
    await ensureDir(path.dirname(destinationPath));
    await fsPromises.copyFile(sourcePath, destinationPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Delete the primary and derived asset files referenced by an asset row.
 * @memberof backend.utils.fsUtils
 * @param {Object} assetRow - Asset database row or equivalent payload.
 * @param {Function} resolvePath - Resolver that maps stored paths to disk paths.
 * @returns {Promise<Object[]>}
 */
export async function removeAssetFilesFromDisk(assetRow, resolvePath) {
  const fileErrors = [];

  for (const filePath of collectAssetFilePaths(assetRow, resolvePath)) {
    try {
      await fsPromises.unlink(filePath);
    } catch (error) {
      if (isPathMissingError(error)) continue;
      fileErrors.push({
        path: filePath,
        error: error?.message || 'Unknown error'
      });
    }
  }

  return fileErrors;
}

/**
 * Remove a file or directory and suppress any thrown cleanup error.
 * @memberof backend.utils.fsUtils
 * @param {string} targetPath - File or directory to remove.
 * @param {Object} [options={}] - Removal options.
 * @returns {Promise<boolean>}
 */
export async function removePathQuietly(targetPath, options = {}) {
  try {
    await removePathRobust(targetPath, options);
    return true;
  } catch {
    return false;
  }
}

/**
 * Remove a file or directory with retries for transient Windows lock errors.
 * @memberof backend.utils.fsUtils
 * @param {string} targetPath - File or directory to remove.
 * @param {Object} [options={}] - Removal options.
 * @param {boolean} [options.recursive=false] - Remove directories recursively.
 * @param {number} [options.maxAttempts=20] - Maximum retry attempts.
 * @param {number} [options.retryDelayMs=250] - Base delay between retries.
 * @param {boolean} [options.force=true] - Ignore missing files.
 * @returns {Promise<void>}
 */
export async function removePathRobust(targetPath, options = {}) {
  const {
    recursive = false,
    maxAttempts = 20,
    retryDelayMs = 250,
    force = true,
  } = options;

  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await fsPromises.rm(targetPath, {
        force,
        recursive,
        ...WINDOWS_FS_RETRY_OPTIONS,
      });
      return;
    } catch (error) {
      if (isPathMissingError(error)) {
        return;
      }

      lastError = error;

      if (!isRetryableFsError(error) || attempt === maxAttempts) {
        throw error;
      }

      await ensureWritable(targetPath);
      await sleep(retryDelayMs * attempt);
    }
  }

  if (lastError) {
    throw lastError;
  }
}