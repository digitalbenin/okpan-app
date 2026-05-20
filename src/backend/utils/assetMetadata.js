/**
 * Shared asset content metadata helpers.
 *
 * @namespace backend.utils.assetMetadata
 * @memberof backend.utils
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * MIME type lookup used for persisted asset content metadata.
 * @memberof backend.utils.assetMetadata
 * @constant {Object}
 */
export const MIME_BY_EXT = {
  '.avif': 'image/avif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
};

/**
 * Derive the normalized extension and MIME type for an asset file.
 * @memberof backend.utils.assetMetadata
 * @param {string} filePath - Asset file path.
 * @returns {{ext:string, mime:string}}
 */
export function getAssetContentInfo(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return { ext, mime: MIME_BY_EXT[ext] || 'application/octet-stream' };
}

/**
 * Compute the SHA-256 checksum of a file.
 * @memberof backend.utils.assetMetadata
 * @param {string} filePath - File path to hash.
 * @param {Object} [options={}] - Hashing options.
 * @param {boolean} [options.swallowErrors=false] - Resolve with `null` instead of rejecting on read errors.
 * @returns {Promise<string|null>}
 */
export async function computeFileSha256(filePath, { swallowErrors = false } = {}) {
  return new Promise((resolve, reject) => {
    try {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', (error) => swallowErrors ? resolve(null) : reject(error));
    } catch (error) {
      if (swallowErrors) resolve(null);
      else reject(error);
    }
  });
}