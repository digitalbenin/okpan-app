// Remove unused 'dev' import and enforce media:// URLs

/**
 * Retrieves the correct URL for an asset object.
 * Always uses the custom 'media://' protocol to serve files from the project source.
 * @param {{ asset_path: string } | null | undefined} asset - The asset object from the database.
 * @returns {string} The resolvable URL for the image.
 */
export function getAssetUrl(asset) {
  if (!asset || !asset.asset_path) {
    return '';
  }
  // Ensure forward slashes for Electron protocol handling
  return `media://${asset.asset_path.replace(/\\/g, '/')}`;
}