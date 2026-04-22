import path from 'path';
import fsPromises from 'fs/promises';

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