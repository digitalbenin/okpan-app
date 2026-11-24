/**
 * Process and save local media with the metadata needed for later P2P sync.
 *
 * @namespace backend.services.assetImportService
 * @memberof backend.services
 */
import * as fs from 'fs';
import sharp from 'sharp';
import { db } from '../../db/init.js';
import { assets, genericAssets, asset_local_state, generic_asset_local_state } from '../../db/schema.js';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { toLogicalAssetFormats } from '../utils/assetPaths.js';
import { computeFileSha256, computeFileTorrentMetadata, getAssetContentInfo } from '../utils/assetMetadata.js';

const sm = 300;
const md = 1400;

/**
 * Supported asset formats and size limits used by the import pipeline.
 * @memberof backend.services.assetImportService
 * @constant {Object}
 */
export const assetConfig = {
    image: {
        formats: ["png", "jpg", "jpeg", "webp", "gif", "avif"],
        maxSize: 5000000,
        maxSizeLabel: "5MB"
    },
    video: {
        formats: ["mp4", "webm", "mov"],
        maxSize: 5242880000,
        maxSizeLabel: "5GB"
    },
    audio: {
        formats: ["mp3", "ogg"],
        maxSize: 10485760,
        maxSizeLabel: "10MB"
    }
};

const imagesFormats = assetConfig.image.formats;
const videoFormats = assetConfig.video.formats;
const audioFormats = assetConfig.audio.formats;

/**
 * Generate a short random suffix for imported filenames.
 * @memberof backend.services.assetImportService
 * @method
 * @returns {string}
 */
export const getCroppedUUID = () => uuidv4().slice(0, 8);

/**
 * Detect whether a file should be treated as an image, video, audio, or unknown.
 * @memberof backend.services.assetImportService
 * @method
 * @param {string} filePath - Source file path.
 * @returns {string}
 */
export const checkAssetType = (filePath) => {
    const ext = path.extname(filePath).toLowerCase().slice(1);
    if (imagesFormats.includes(ext)) return "image";
    if (videoFormats.includes(ext)) return "video";
    if (audioFormats.includes(ext)) return "audio";
    return "unknown";
};

function reserveImportFile(filePath, createdFiles) {
    const fd = fs.openSync(filePath, 'wx');
    createdFiles.push(filePath);
    fs.closeSync(fd);
}

/**
 * Convert an image into AVIF derivatives and return the generated paths.
 * @memberof backend.services.assetImportService
 * @method
 * @param {string} imagePath - Source image path.
 * @param {string} destPath - Destination folder path.
 * @param {string[]} createdFiles - Output files owned by the current attempt.
 * @returns {Promise<Object>}
 */
async function makeAVIF(imagePath, destPath, createdFiles) {
    const image = sharp(imagePath);
    const metadata = await image.metadata();
    const format = metadata.format;
    const fileName = path.basename(imagePath);
    const fileNameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'));
    const uuid = getCroppedUUID();
    const newFileName = `${fileNameWithoutExt}_${uuid}`;
    destPath = path.join(destPath, newFileName);
    const origSize = metadata.size;
    if (origSize > assetConfig.image.maxSize) {
        throw new Error(`Image file is too large (max ${assetConfig.image.maxSizeLabel})`);
    }
    const formats = {
        sm: `${destPath}_sm.avif`,
        md: `${destPath}_md.avif`,
        original: `${destPath}.avif`
    };
    for (const filePath of Object.values(formats)) {
        reserveImportFile(filePath, createdFiles);
    }
    if (format === "avif") {
        await image.resize(sm).toFile(formats.sm);
        await image.resize(md).toFile(formats.md);
        await fs.promises.copyFile(imagePath, formats.original);
    } else {
        await image.avif({ quality: 70, effort: 2, smartSubsample: true }).resize(sm).toFile(formats.sm);
        await image.avif({ quality: 70, effort: 2, smartSubsample: true }).resize(md).toFile(formats.md);
        await image.avif({ quality: 70, effort: 2, smartSubsample: true }).toFile(formats.original);
    }
    return formats;
}

/**
 * Copy a video or audio file into the project asset folder.
 * @memberof backend.services.assetImportService
 * @method
 * @param {string} filePath - Source file path.
 * @param {string} destPath - Destination folder path.
 * @param {string} assetType - Asset type label.
 * @param {string[]} createdFiles - Output files owned by the current attempt.
 * @returns {Promise<Object>}
 */
async function processMediaFile(filePath, destPath, assetType, createdFiles) {
    const config = assetConfig[assetType];
    if (!config) {
        throw new Error(`Unsupported asset type: ${assetType}`);
    }

    const stats = fs.statSync(filePath);
    if (stats.size > config.maxSize) {
        throw new Error(`${assetType.charAt(0).toUpperCase() + assetType.slice(1)} file is too large (max ${config.maxSizeLabel})`);
    }

    const fileName = path.basename(filePath);
    const fileNameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'));
    const fileExt = fileName.substring(fileName.lastIndexOf('.'));
    const uuid = getCroppedUUID();
    const newFileName = `${fileNameWithoutExt}_${uuid}${fileExt}`;
    const finalPath = path.join(destPath, newFileName);

    reserveImportFile(finalPath, createdFiles);
    await fs.promises.copyFile(filePath, finalPath);

    return { original: finalPath };
}


/**
 * Process and persist one local asset and its sync state.
 * @memberof backend.services.assetImportService
 * @method
 * @param {string} filePath - Source file path.
 * @param {string} projectFolder - Destination project asset folder.
 * @param {Object} data - Import payload.
 * @param {string} basePath - Logical asset base path.
 * @returns {Promise<Object|null>}
 */
export async function importAssetFile(filePath, projectFolder, data, basePath) {
    const assetType = checkAssetType(filePath);
    if (assetType === "unknown") {
        console.warn(`Unsupported asset type: ${assetType} for file: ${filePath}`);
        return null;
    }

    const createdFiles = [];
    try {
        const formats = assetType === "image"
            ? await makeAVIF(filePath, projectFolder, createdFiles)
            : await processMediaFile(filePath, projectFolder, assetType, createdFiles);
        const logicalFormats = toLogicalAssetFormats(formats, { assetBasePath: basePath });
        return await saveAssetToDb({
            id: uuidv4(),
            project_id: data.projectId,
            path: logicalFormats.original,
            filename: path.basename(filePath),
            type: assetType,
            formats: logicalFormats,
            ...await buildAssetMetadata(formats.original)
        }, data.isGenericAsset, data.institutionId);
    } catch (error) {
        for (const createdFile of createdFiles) {
            try {
                await fs.promises.rm(createdFile, { force: true });
            } catch (cleanupError) {
                console.warn(`[assetImportService] Could not remove ${createdFile}:`, cleanupError.message);
            }
        }
        throw error;
    }
}

async function buildAssetMetadata(filePath) {
    const torrentMeta = await computeFileTorrentMetadata(filePath);
    let sha256 = null;
    try {
        sha256 = await computeFileSha256(filePath);
    } catch (err) {
        console.warn('[assetImportService] SHA-256 computation failed:', err?.message);
    }

    const { ext, mime } = getAssetContentInfo(filePath);

    return {
        torrent_info_hash:    torrentMeta.infoHash,
        torrent_name:         torrentMeta.name,
        torrent_length:       torrentMeta.length,
        torrent_piece_length: torrentMeta.pieceLength,
        asset_content_mime:   mime,
        asset_content_ext:    ext,
        asset_content_sha256: sha256,
    };
}

async function saveAssetToDb(asset, isGeneric, institutionId) {
    const table = isGeneric ? genericAssets : assets;
    const stateTable = isGeneric ? generic_asset_local_state : asset_local_state;
    const stateIdKey = isGeneric ? 'generic_asset_id' : 'asset_id';
    const [[newAsset]] = await db.batch([
        db.insert(table).values({
            ...asset,
            institution_id: isGeneric ? undefined : (institutionId || null)
        }).returning(),
        db.insert(stateTable).values({
            [stateIdKey]: asset.id,
            sync_status: 'available',
            last_success_at: Date.now(),
            download_progress: 100
        })
    ]);
    return newAsset;
}
