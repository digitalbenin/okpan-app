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

export const getCroppedUUID = () => uuidv4().slice(0, 8);

export const checkAssetType = (filePath) => {
    const ext = path.extname(filePath).toLowerCase().slice(1);
    if (imagesFormats.includes(ext)) return "image";
    if (videoFormats.includes(ext)) return "video";
    if (audioFormats.includes(ext)) return "audio";
    return "unknown";
};

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

// Generic processor for media files (video and audio)
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

// Unified file processor that routes to the correct processor by asset type
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
 * Build the final asset record, including torrent metadata, before inserting
 * it into the shared asset table. This avoids syncing rows that point at a
 * logical asset path but still have no downloadable torrent metadata.
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
