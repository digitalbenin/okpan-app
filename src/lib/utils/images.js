export function addImageProtocolPrefix(url) {
    if (!url) return;
    return `media://${url}`;
}

/**
 * Parses asset formats (handles both string and object formats)
 * @param {string|object} formats - The formats field from an asset
 * @returns {object|null} Parsed formats object or null if invalid
 */
export function parseAssetFormats(formats) {
    if (!formats) return null;
    try {
        return typeof formats === "string" ? JSON.parse(formats) : formats;
    } catch (e) {
        console.error("Error parsing asset formats:", e);
        return null;
    }
}

/**
 * Gets the best image URL from an object's assets
 * @param {object} obj - Object with objectsAssets array
 * @param {string} preferredSize - Preferred image size ('sm', 'md', 'lg', 'thumbnail', 'original')
 * @param {boolean} addProtocol - Whether to add media:// protocol prefix (default: true)
 * @returns {string|null} Image URL with protocol or null if no image found
 */
export function getObjectImageUrl(obj, preferredSize = 'sm', addProtocol = true) {
    const asset = obj?.objectsAssets?.[0]?.asset;
    if (!asset) return null;

    const formats = parseAssetFormats(asset.formats);
    let src = null;

    if (formats) {
        // Try preferred size first, then fallback to other sizes
        src = formats[preferredSize] || 
              formats.sm || 
              formats.md || 
              formats.lg || 
              formats.thumbnail || 
              formats.original || 
              asset.path;
    } else {
        src = asset.path;
    }

    if (!src) return null;
    return addProtocol ? addImageProtocolPrefix(src) : src;
}

/**
 * Gets the best image URL from a direct asset object (not from objectsAssets relation)
 * @param {object} asset - Direct asset object
 * @param {string} preferredSize - Preferred image size ('sm', 'md', 'lg', 'thumbnail', 'original')
 * @param {boolean} addProtocol - Whether to add media:// protocol prefix (default: true)
 * @returns {string|null} Image URL with protocol or null if no image found
 */
export function getAssetImageUrl(asset, preferredSize = 'sm', addProtocol = true) {
    if (!asset) return null;

    const formats = parseAssetFormats(asset.formats);
    let src = null;

    if (formats) {
        src = formats[preferredSize] || 
              formats.sm || 
              formats.md || 
              formats.lg || 
              formats.thumbnail || 
              formats.original || 
              asset.path;
    } else {
        src = asset.path;
    }

    if (!src) return null;
    return addProtocol ? addImageProtocolPrefix(src) : src;
}