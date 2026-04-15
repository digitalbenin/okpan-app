import * as fs from 'fs';
import sharp from 'sharp';
import crypto from 'crypto';
import { db } from '../../db/init.js';
import { assets, genericAssets } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { seedAsset } from '../services/assetTorrentManager.js';

const sm = 300
const md = 1400
const assetPath = "./src/assets/project_assets"

// MIME type map for P2P torrent metadata
const MIME_BY_EXT = {
  '.avif': 'image/avif',
  '.mp4':  'video/mp4',
  '.webm': 'video/webm',
  '.mov':  'video/quicktime',
  '.mp3':  'audio/mpeg',
  '.ogg':  'audio/ogg',
};

/**
 * Compute SHA-256 hex of a file for integrity verification.
 */
async function computeFileSha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

// Configuration object for file types and limits
const assetConfig = {
    image: {
        formats: ["png", "jpg", "jpeg", "webp", "gif", "avif"],
        maxSize: 5000000, // 5MB
        maxSizeLabel: "5MB"
    },
    video: {
        formats: ["mp4", "webm", "mov"],
        maxSize: 52428800, // 50MB
        maxSizeLabel: "50MB"
    },
    audio: {
        formats: ["mp3", "ogg"],
        maxSize: 10485760, // 10MB
        maxSizeLabel: "10MB"
    }
}

const imagesFormats = assetConfig.image.formats
const videoFormats = assetConfig.video.formats
const audioFormats = assetConfig.audio.formats



const getCroppedUUID = () => {
    return uuidv4().slice(0, 8);
}

const getProgress = (progress, total) => {
    return Math.round((progress / total) * 100)
}


const checkAssetType = (filePath) => {

    //check by file extension
    const ext = path.extname(filePath).toLowerCase().slice(1)
    if (imagesFormats.includes(ext)) {
        return "image"
    }
    if (videoFormats.includes(ext)) {
        return "video"
    }
    if (audioFormats.includes(ext)) {
        return "audio"
    }
    return "unknown"
}


const handleImportAssets = async (event, data) => {
    let errors = []
    let createdAssets = []; // Array to store created assets
    let importedFilePaths = []; // Track only files actually imported

    if (!data.projectId) {
        throw new Error("Project ID is required");
    }
    // data.isGenericAsset will determine the target table.
    // If data.isGenericAsset is true, institutionId should be null or undefined.
    // If data.isGenericAsset is false or undefined, institutionId is expected for 'assets' table.
    if (data.isGenericAsset && data.institutionId) {
        console.warn("Warning: isGenericAsset is true, but institutionId is provided. institutionId will be ignored for generic assets.");
    }


    //check if folder with projectid is present, otherwise create it
    const projectFolder = path.join(assetPath, data.projectId);
    if (!fs.existsSync(projectFolder)) {
        fs.mkdirSync(projectFolder, { recursive: true });
    }

    // Process files from directory or array
    const filesToProcess = (() => {
        if (Array.isArray(data?.files) && data.files.length) return data.files;
        if (Array.isArray(data?.paths) && data.paths.length) return data.paths;
        if (Array.isArray(data?.path) && data.path.length) return data.path;
        if (typeof data?.path === 'string') {
            if (data?.isDirectory) {
                return fs.readdirSync(data.path).map(file => path.join(data.path, file));
            }
            return [data.path];
        }
        return [];
    })();

    const totalFiles = filesToProcess.length;
    console.debug('[import-assets] total files to process:', totalFiles);

    // Throttle configuration for progress events
    const progressChannel = 'import-assets-progress';
    const throttleIntervalMs = Number.isFinite(data?.progressThrottleMs) ? data.progressThrottleMs : 500; // default 500ms
    let _lastProgressSentAt = 0;
    const sendProgress = (force = false) => {
        const now = Date.now();
        if (!force && now - _lastProgressSentAt < throttleIntervalMs) return;
        _lastProgressSentAt = now;
        try {
            event?.sender?.send(progressChannel, {
                status: 'progress',
                processed: importedFilePaths.length,
                total: totalFiles,
                percent: totalFiles > 0 ? getProgress(importedFilePaths.length, totalFiles) : 0,
                files: [...importedFilePaths]
            });
        } catch { }
    };

    // Notify renderer that import started
    try {
        event?.sender?.send('import-assets-progress', {
            status: 'start',
            total: totalFiles,
            processed: 0,
            percent: 0
        });
    } catch { }

    for (const filePath of filesToProcess) {
        try {
            console.debug('[import-assets] processing file:', filePath);
            const asset = await processAssetFile(filePath, projectFolder, data);

            if (asset) {
                const newAsset = await saveAssetToDb(asset, data.isGenericAsset);
                importedFilePaths.push(filePath);
                // Do not return a newly created asset to the UI until torrent metadata
                // has been persisted. Otherwise users can link the asset immediately,
                // while remote peers still see a synced asset row with no torrent
                // metadata and therefore nothing to download.
                const seededAsset = await seedAndPersistTorrentMetadata(newAsset, data.isGenericAsset).catch((err) => {
                    console.error('[assetHandlers] seedAndPersistTorrentMetadata error (non-fatal):', err?.message);
                    return newAsset;
                });
                createdAssets.push({ ...seededAsset, _sourcePath: filePath });
            }
        } catch (error) {
            console.error(`Error processing file ${filePath}:`, error);
            errors.push(error);
        }

        // Emit progress update after each attempt
        sendProgress();
    }
    // Ensure a final progress emission for UI before complete
    sendProgress(true);

    // Final completion event
    try {
        event?.sender?.send('import-assets-progress', {
            status: 'complete',
            processed: importedFilePaths.length,
            total: totalFiles,
            percent: totalFiles > 0 ? getProgress(importedFilePaths.length, totalFiles) : 0,
            files: [...importedFilePaths],
            errorsCount: errors.length
        });
    } catch { }

    return {
        errors,
        createdAssets,
        files: importedFilePaths
    }
}

const makeAVIF = async (imagePath, destPath) => {
    const image = sharp(imagePath)
    const metadata = await image.metadata()
    const format = metadata.format
    const fileName = path.basename(imagePath);
    const fileNameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'));
    const uuid = getCroppedUUID();
    const newFileName = `${fileNameWithoutExt}_${uuid}`;
    destPath = path.join(destPath, newFileName);
    const origSize = metadata.size;
    if (origSize > assetConfig.image.maxSize) {
        throw new Error(`Image file is too large (max ${assetConfig.image.maxSizeLabel})`);
    }
    if (format === "avif") {
        await image.resize(sm).toFile(`${destPath}_sm.avif`);
        await image.resize(md).toFile(`${destPath}_md.avif`);
        fs.copyFileSync(imagePath, `${destPath}.avif`);
    }
    else {
        await image.avif({ quality: 70, effort: 2, smartSubsample: true }).resize(sm).toFile(`${destPath}_sm.avif`);
        await image.avif({ quality: 70, effort: 2, smartSubsample: true }).resize(md).toFile(`${destPath}_md.avif`);
        await image.avif({ quality: 70, effort: 2, smartSubsample: true }).toFile(`${destPath}.avif`);
    }

    // Return the paths for the asset object
    return {
        sm: `${destPath}_sm.avif`,
        md: `${destPath}_md.avif`,
        original: `${destPath}.avif`
    };
}

// Generic processor for media files (video and audio)
const processMediaFile = async (filePath, destPath, assetType) => {
    const config = assetConfig[assetType];
    if (!config) {
        throw new Error(`Unsupported asset type: ${assetType}`);
    }

    const stats = fs.statSync(filePath);
    const fileSizeInBytes = stats.size;

    if (fileSizeInBytes > config.maxSize) {
        throw new Error(`${assetType.charAt(0).toUpperCase() + assetType.slice(1)} file is too large (max ${config.maxSizeLabel})`);
    }

    const fileName = path.basename(filePath);
    const fileNameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'));
    const fileExt = fileName.substring(fileName.lastIndexOf('.'));
    const uuid = getCroppedUUID();
    const newFileName = `${fileNameWithoutExt}_${uuid}${fileExt}`;
    const finalPath = path.join(destPath, newFileName);

    // Simply copy the media file for now - no processing
    fs.copyFileSync(filePath, finalPath);

    return {
        original: finalPath
    };
}

// Unified file processor that handles all asset types
const processAssetFile = async (filePath, projectFolder, data) => {
    const assetType = checkAssetType(filePath);
    let formats = null;

    if (assetType === "image") {
        formats = await makeAVIF(filePath, projectFolder);
    } else if (assetType === "video" || assetType === "audio") {
        formats = await processMediaFile(filePath, projectFolder, assetType);
    } else {
        console.warn(`Unsupported asset type: ${assetType} for file: ${filePath}`);
        return null;
    }

    return {
        project_id: data?.projectId,
        institution_id: data.isGenericAsset ? undefined : data?.institutionId,
        path: formats.original,
        filename: path.basename(filePath),
        type: assetType,
        formats
    };
}

const saveAssetToDb = async (assetData, isGeneric) => {
    const table = isGeneric ? genericAssets : assets;
    const [newAsset] = await db.insert(table).values({
        id: uuidv4(),
        ...assetData,
        // Ensure institution_id is explicitly set to null if it's undefined and not a generic asset
        // For generic assets, institution_id should not be part of assetData passed here if schema doesn't have it
        institution_id: isGeneric ? undefined : (assetData.institution_id || null),
    }).returning();
    return newAsset;
}

/**
 * After a DB row is saved, seed the original file via WebTorrent and
 * write torrent metadata back to the same row so Yjs propagates it to peers.
 * Failures are non-fatal: the asset row remains usable locally.
 */
async function seedAndPersistTorrentMetadata(newAsset, isGeneric) {
    const filePath = newAsset.path;
    if (!filePath || !fs.existsSync(filePath)) {
        console.warn('[assetHandlers] seedAndPersistTorrentMetadata: file not found, skipping seed', filePath);
        return newAsset;
    }

    let torrentMeta = null;
    try {
        torrentMeta = await seedAsset({
            projectId: newAsset.project_id,
            assetId: newAsset.id,
            filePath,
            isGeneric
        });
    } catch (err) {
        console.error('[assetHandlers] seedAsset error, torrent metadata will not be stored:', err?.message);
        return newAsset;
    }

    if (!torrentMeta?.infoHash) {
        console.warn('[assetHandlers] seedAsset returned no infoHash for', newAsset.id);
        return newAsset;
    }

    // Compute SHA-256 for integrity verification on downloaders
    let sha256 = null;
    try {
        sha256 = await computeFileSha256(filePath);
    } catch (err) {
        console.warn('[assetHandlers] SHA-256 computation failed:', err?.message);
    }

    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME_BY_EXT[ext] || 'application/octet-stream';

    const torrentFields = {
        torrent_info_hash:   torrentMeta.infoHash,
        torrent_name:        torrentMeta.name,
        torrent_length:      torrentMeta.length,
        torrent_piece_length: torrentMeta.pieceLength,
        asset_content_mime:  mime,
        asset_content_ext:   ext,
        asset_content_sha256: sha256,
    };

    const table = isGeneric ? genericAssets : assets;
    try {
        await db.update(table).set(torrentFields).where(eq(table.id, newAsset.id)).execute();
        console.log(
            `[assetHandlers] Torrent metadata written to DB: assetId=${newAsset.id} ` +
            `infoHash=${torrentMeta.infoHash} sha256=${sha256?.slice(0, 16)}...`
        );
        return { ...newAsset, ...torrentFields };
    } catch (err) {
        console.error('[assetHandlers] Failed to write torrent metadata to DB:', err?.message);
        return newAsset;
    }
}

export { handleImportAssets, getProgress }
