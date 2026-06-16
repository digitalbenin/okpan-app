/**
 * Adds the custom media protocol prefix to an asset path when needed.
 * @param {string|null|undefined} url Asset path or URL.
 * @returns {string|undefined} URL prefixed with media:// when applicable.
 */
export function addImageProtocolPrefix(url) {
    if (!url) return;
    if (typeof url === 'string' && url.startsWith('media://')) return url;
    const normalized = String(url).replace(/\\/g, '/');

    return `media://${normalized}`;
}

/**
 * Common file extensions for different media types
 */
export const MEDIA_EXTENSIONS = {
    image: ["jpg", "jpeg", "png", "gif", "webp", "avif"],
    audio: ["mp3", "ogg"],
    video: ["mp4", "webm", "mov"],
};

/**
 * Common MIME types for different media types
 */
export const MEDIA_MIME_TYPES = {
    image: ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"],
    audio: ["audio/mpeg", "audio/ogg"],
    video: ["video/mp4", "video/webm", "video/quicktime"],
};

/**
 * Detects media type from filename or asset object
 * @param {string|object} assetOrFilename - Asset object with filename/name or filename string
 * @returns {string} Media type: 'image', 'video', 'audio', or 'unknown'
 */
export function getMediaType(assetOrFilename) {
    if (!assetOrFilename) return "unknown";

    // If asset has explicit type property
    if (typeof assetOrFilename === "object" && assetOrFilename.type) {
        if (["image", "video", "audio"].includes(assetOrFilename.type)) {
            return assetOrFilename.type;
        }
    }

    // Get filename
    const fileName = typeof assetOrFilename === "string" 
        ? assetOrFilename 
        : (assetOrFilename.filename || assetOrFilename.name || "");

    // Extract extension
    const ext = fileName.split(".").pop()?.toLowerCase() || "";

    if (MEDIA_EXTENSIONS.image.includes(ext)) return "image";
    if (MEDIA_EXTENSIONS.video.includes(ext)) return "video";
    if (MEDIA_EXTENSIONS.audio.includes(ext)) return "audio";

    return "unknown";
}

function getExtensionsForTypes(types) {
    const extensions = [];
    for (const type of types) {
        if (MEDIA_EXTENSIONS[type]) {
            extensions.push(...MEDIA_EXTENSIONS[type]);
        }
    }
    return extensions;
}

/**
 * Creates file dialog filters for specified media types
 * @param {string[]} types - Array of media types ('image', 'audio', 'video')
 * @returns {object[]} Array of filter objects for Electron file dialog
 */
export function createMediaFilters(types) {
    const filters = [];
    const allExtensions = getExtensionsForTypes(types);

    // Add "All Accepted Formats" as first option if we have extensions
    if (allExtensions.length > 0) {
        filters.push({
            name: "All Accepted Formats",
            extensions: allExtensions,
        });
    }

    // Add individual type filters
    if (types.includes("image")) {
        filters.push({
            name: "Images",
            extensions: MEDIA_EXTENSIONS.image,
        });
    }

    if (types.includes("audio")) {
        filters.push({
            name: "Audio",
            extensions: MEDIA_EXTENSIONS.audio,
        });
    }

    if (types.includes("video")) {
        filters.push({
            name: "Video",
            extensions: MEDIA_EXTENSIONS.video,
        });
    }

    // Always add "All Files" as last option
    filters.push({ name: "All Files", extensions: ["*"] });

    return filters;
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

function getPreferredAssetSource(asset, preferredSize = "sm") {
    if (!asset) return null;

    const formats = parseAssetFormats(asset.formats);
    if (!formats) {
        return asset.path || null;
    }

    return (
        formats[preferredSize] ||
        formats.sm ||
        formats.md ||
        formats.lg ||
        formats.thumbnail ||
        formats.original ||
        asset.path ||
        null
    );
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
    const src = getPreferredAssetSource(asset, preferredSize);
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
    const src = getPreferredAssetSource(asset, preferredSize);
    if (!src) return null;
    return addProtocol ? addImageProtocolPrefix(src) : src;
}