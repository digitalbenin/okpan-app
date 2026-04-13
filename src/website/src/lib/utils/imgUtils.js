// Asset URL handling for both Electron (media://) and static export (relative paths)

import { resolveSitePath } from '$lib/utils/sitePaths.js';

const isStaticExport = import.meta.env.VITE_USE_JSON === 'true';

/**
 * Retrieves the correct URL for an asset object.
 * In Electron preview mode: uses the custom 'media://' protocol.
 * In static export mode: uses relative paths to the assets folder.
 * @param {{ asset_path: string } | null | undefined} asset - The asset object from the database.
 * @returns {string} The resolvable URL for the image.
 */
export function getAssetUrl(asset) {
  if (!asset || !asset.asset_path) {
    return '';
  }
  
  // Normalize path to forward slashes
  const normalizedPath = asset.asset_path.replace(/\\/g, '/');
  
  // Static export: convert "src/assets/project_assets/{projectId}/file.avif" to "/assets/{projectId}/file.avif"
  if (isStaticExport) {
    // Extract the project-relative part: project_assets/{projectId}/...
    const match = normalizedPath.match(/project_assets\/(.+)$/);
    if (match) {
      return resolveSitePath(`assets/${match[1]}`);
    }
    // Fallback: just use the filename
    return resolveSitePath(`assets/${normalizedPath.split('/').pop()}`);
  }
  
  // Electron preview mode: use media:// protocol
  return `media://${normalizedPath}`;
}