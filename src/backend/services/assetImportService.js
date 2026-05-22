/**
 * Asset import service for processing uploaded media, persisting imported
 * assets, and creating seeded asset records with torrent metadata.
 *
 * @namespace backend.services.assetImportService
 * @memberof backend.services
 */
import * as fs from 'fs';
import sharp from 'sharp';
import { db } from '../../db/init.js';
import { assets, genericAssets } from '../../db/schema.js';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { seedAsset } from './assetTorrentManagerService.js';
import { resolveLogicalAssetPath, toLogicalAssetFormats } from '../utils/assetPaths.js';
import { computeFileSha256, getAssetContentInfo } from '../utils/assetMetadata.js';

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

/**
 * Convert an image into AVIF derivatives and return the generated paths.
 * @memberof backend.services.assetImportService
 * @method
 * @param {string} imagePath - Source image path.
 * @param {string} destPath - Destination folder path.
 * @returns {Promise<Object>}
 */
export const makeAVIF = async (imagePath, destPath) => {
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
    if (format === "avif") {
        await image.resize(sm).toFile(`${destPath}_sm.avif`);
        await image.resize(md).toFile(`${destPath}_md.avif`);
        fs.copyFileSync(imagePath, `${destPath}.avif`);
    } else {
        await image.avif({ quality: 70, effort: 2, smartSubsample: true }).resize(sm).toFile(`${destPath}_sm.avif`);
        await image.avif({ quality: 70, effort: 2, smartSubsample: true }).resize(md).toFile(`${destPath}_md.avif`);
        await image.avif({ quality: 70, effort: 2, smartSubsample: true }).toFile(`${destPath}.avif`);
    }
    return {
        sm: `${destPath}_sm.avif`,
        md: `${destPath}_md.avif`,
        original: `${destPath}.avif`
    };
};

/**
 * Copy a video or audio file into the project asset folder.
 * @memberof backend.services.assetImportService
 * @method
 * @param {string} filePath - Source file path.
 * @param {string} destPath - Destination folder path.
 * @param {string} assetType - Asset type label.
 * @returns {Promise<Object>}
 */
export const processMediaFile = async (filePath, destPath, assetType) => {
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

    // Simply copy the media file for now - no processing
    fs.copyFileSync(filePath, finalPath);

    return { original: finalPath };
};


/**
 * Process a single asset file and return the normalized asset payload.
 * @memberof backend.services.assetImportService
 * @method
 * @param {string} filePath - Source file path.
 * @param {string} projectFolder - Destination project asset folder.
 * @param {Object} data - Import payload.
 * @param {string} basePath - Logical asset base path.
 * @returns {Promise<Object|null>}
 */
export const processAssetFile = async (filePath, projectFolder, data, basePath) => {
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

    const logicalFormats = toLogicalAssetFormats(formats, { assetBasePath: basePath });

    return {
        project_id: data?.projectId,
        institution_id: data.isGenericAsset ? undefined : data?.institutionId,
        path: logicalFormats.original,
        filename: path.basename(filePath),
        type: assetType,
        formats: logicalFormats
    };
};

/**
 * Persist an imported asset record to the appropriate table.
 * @memberof backend.services.assetImportService
 * @method
 * @param {Object} assetData - Asset payload.
 * @param {boolean} isGeneric - Whether to save into generic_assets.
 * @returns {Promise<Object>}
 */
export const saveAssetToDb = async (assetData, isGeneric) => {
    const table = isGeneric ? genericAssets : assets;
    const [newAsset] = await db.insert(table).values({
        ...assetData,
        id: assetData.id || uuidv4(),
        institution_id: isGeneric ? undefined : (assetData.institution_id || null),
    }).returning();
    return newAsset;
};

/**
 * Build a seeded asset record with torrent metadata before insert.
 * @memberof backend.services.assetImportService
 * @param {Object} assetData - Asset payload.
 * @param {boolean} isGeneric - Whether the record is generic.
 * @param {boolean} [disableP2P=false] - Disable signaling for this import.
 * @returns {Promise<Object>}
 */
export async function buildSeededAssetRecord(assetData, isGeneric, disableP2P = false) {
    const filePath = resolveLogicalAssetPath(assetData.path);
    if (!filePath || !fs.existsSync(filePath)) {
        throw new Error(`Imported asset file not found: ${filePath}`);
    }

    const assetId = assetData.id || uuidv4();
    const torrentMeta = await seedAsset({
        projectId: assetData.project_id,
        assetId,
        filePath,
        isGeneric,
        enableSignaling: !disableP2P
    });

    if (!torrentMeta?.infoHash) {
        throw new Error(`Failed to create torrent metadata for imported asset ${assetId}`);
    }

    let sha256 = null;
    try {
        sha256 = await computeFileSha256(filePath);
    } catch (err) {
        console.warn('[assetImportService] SHA-256 computation failed:', err?.message);
    }

    const { ext, mime } = getAssetContentInfo(filePath);

    const torrentFields = {
        torrent_info_hash:    torrentMeta.infoHash,
        torrent_name:         torrentMeta.name,
        torrent_length:       torrentMeta.length,
        torrent_piece_length: torrentMeta.pieceLength,
        asset_content_mime:   mime,
        asset_content_ext:    ext,
        asset_content_sha256: sha256,
    };

    return {
        ...assetData,
        id: assetId,
        ...torrentFields,
    };
}
