import { dev } from '$app/environment';

/**
 * Retrieves the correct URL for an asset object.
 * In development, it uses the custom 'media://' protocol to serve files from the project source.
 * In production, it assumes assets are served from the root.
 * @param {{ asset_path: string } | null | undefined} asset - The asset object from the database.
 * @returns {string} The resolvable URL for the image.
 */
export function getAssetUrl(asset) {
  if (!asset || !asset.asset_path) {
    return '';
  }

  if (dev) {
    // In development, use the media protocol. The path needs to use forward slashes.
    return `media://${asset.asset_path.replace(/\\/g, '/')}`;
  } else {
    // In production, assume the file is available at the root.
    // We just need the filename from the asset_path.
    const filename = asset.asset_path.split(/[\\/]/).pop();
    return `/${filename}`;
  }
}