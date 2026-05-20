/**
 * Connections JSON export service for serializing connection types and their
 * linked assets.
 *
 * @namespace backend.services.exportConnectionsJsonService
 * @memberof backend.services
 */
import path from 'path';
import os from 'os';
import fs from 'fs';
import yazl from 'yazl';
import { eq, inArray } from 'drizzle-orm';
import * as dbSchema from '../../db/schema.js';
import { ensureDir, writeJsonFile } from '../utils/fsUtils.js';

async function createZipFromFolder(folderPath, zipPath) {
  await ensureDir(path.dirname(zipPath));
  return new Promise(async (resolve, reject) => {
    try {
      const zipfile = new yazl.ZipFile();
      const out = fs.createWriteStream(zipPath);
      zipfile.outputStream.pipe(out).on('close', () => resolve(true));

      async function addDir(dir) {
        const entries = await fsPromises.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            await addDir(fullPath);
          } else if (entry.isFile()) {
            const relPath = path.relative(folderPath, fullPath).replace(/\\/g, '/');
            zipfile.addFile(fullPath, relPath);
          }
        }
      }

      await addDir(folderPath);
      zipfile.end();
    } catch (err) {
      reject(err);
    }
  });
}

function resolveTextContent(textId, textsMap) {
  if (!textId) return null;
  const row = textsMap.get(textId);
  return row?.content ?? null;
}

function normalizeFormats(asset) {
  const formats = asset?.formats && typeof asset.formats === 'object' ? asset.formats : null;
  const out = {};
  if (formats) {
    for (const [key, value] of Object.entries(formats)) {
      if (typeof value === 'string' && value) out[key] = value;
    }
  }
  if (!out.original && asset?.path) out.original = asset.path;
  return out;
}

function makeRelativeAssetExportPath(assetId, absolutePath) {
  const ext = path.extname(absolutePath || '') || '';
  const fileBase = path.basename(absolutePath || `asset-${assetId}`);
  return `assets/${assetId}/${fileBase}${ext && fileBase.endsWith(ext) ? '' : ext}`;
}

/**
 * Export connection types and linked assets to a ZIP archive.
 * @memberof backend.services.exportConnectionsJsonService
 * @param {Object} options - Export options.
 * @param {Object} db - Database handle.
 * @returns {Promise<Object>}
 */
export async function exportConnectionsJson(options, { db }) {
  const { filePath, projectId } = options || {};
  if (!filePath || !filePath.toLowerCase().endsWith('.zip')) throw new Error('filePath must be a .zip path for connections export');
  if (!projectId) throw new Error('projectId is required');

  const researchFields = await db
    .select()
    .from(dbSchema.research_fields)
    .where(eq(dbSchema.research_fields.project_id, projectId))
    .execute();

  const connectionTypes = researchFields.filter((field) => String(field.type || '').toLowerCase() === 'vocabulary');
  const fieldIds = connectionTypes.map((field) => field.id).filter(Boolean);

  const vocabularies = fieldIds.length
    ? await db
      .select()
      .from(dbSchema.vocabularies)
      .where(inArray(dbSchema.vocabularies.field_id, fieldIds))
      .execute()
    : [];

  const vocabularyIds = vocabularies.map((v) => v.id).filter(Boolean);
  const vocabAssetsLinks = vocabularyIds.length
    ? await db
      .select()
      .from(dbSchema.vocabularies_generic_assets)
      .where(inArray(dbSchema.vocabularies_generic_assets.vocabulary_id, vocabularyIds))
      .execute()
    : [];

  const genericAssetIds = Array.from(new Set([
    ...vocabularies.map((v) => v.main_asset_id).filter(Boolean),
    ...vocabAssetsLinks.map((link) => link.generic_asset_id).filter(Boolean)
  ]));

  const genericAssets = genericAssetIds.length
    ? await db
      .select()
      .from(dbSchema.genericAssets)
      .where(inArray(dbSchema.genericAssets.id, genericAssetIds))
      .execute()
    : [];

  const textIds = Array.from(new Set([
    ...connectionTypes.map((f) => f.name_id).filter(Boolean),
    ...connectionTypes.map((f) => f.description_id).filter(Boolean),
    ...vocabularies.map((v) => v.option_id).filter(Boolean),
    ...vocabularies.map((v) => v.description_id).filter(Boolean)
  ]));

  const texts = textIds.length
    ? await db
      .select()
      .from(dbSchema.texts)
      .where(inArray(dbSchema.texts.id, textIds))
      .execute()
    : [];

  const textsMap = new Map(texts.map((row) => [row.id, row]));
  const genericAssetsMap = new Map(genericAssets.map((row) => [row.id, row]));
  const vocabAssetsByVocabulary = vocabAssetsLinks.reduce((acc, link) => {
    if (!acc[link.vocabulary_id]) acc[link.vocabulary_id] = [];
    acc[link.vocabulary_id].push(link);
    return acc;
  }, {});

  const outRoot = path.join(os.tmpdir(), `connections_export_${projectId}_${Date.now()}`);
  const assetsDir = path.join(outRoot, 'assets');
  await ensureDir(assetsDir);

  const exportedImageByAssetId = new Map();

  const ensureAssetExported = async (assetId) => {
    if (!assetId) return null;
    const existing = exportedImageByAssetId.get(assetId);
    if (existing) return existing;

    const asset = genericAssetsMap.get(assetId);
    if (!asset) return null;

    const sourceFormats = normalizeFormats(asset);
    if (!sourceFormats.original) return null;

    const exportedFormats = {};

    try {
      for (const [key, sourcePath] of Object.entries(sourceFormats)) {
        if (!sourcePath || !fs.existsSync(sourcePath)) continue;
        const relPath = makeRelativeAssetExportPath(asset.id, sourcePath);
        const destination = path.join(outRoot, relPath);
        await ensureDir(path.dirname(destination));
        await fsPromises.copyFile(sourcePath, destination);
        exportedFormats[key] = relPath.replace(/\\/g, '/');
      }

      if (!exportedFormats.original) return null;

      const imageRef = {
        asset_id: asset.id,
        filename: asset.filename || null,
        type: asset.type || null,
        path: exportedFormats.original,
        formats: exportedFormats
      };
      exportedImageByAssetId.set(assetId, imageRef);
      return imageRef;
    } catch {
      return null;
    }
  };

  const vocabByField = vocabularies.reduce((acc, row) => {
    if (!acc[row.field_id]) acc[row.field_id] = [];
    acc[row.field_id].push(row);
    return acc;
  }, {});

  const connectionTypesOut = [];
  for (const field of connectionTypes) {
    const fieldVocabularies = vocabByField[field.id] || [];
    const connectionsOut = [];

    for (const vocabulary of fieldVocabularies) {
      const images = [];
      const mainImage = await ensureAssetExported(vocabulary.main_asset_id);
      if (mainImage) images.push(mainImage);

      const linkedAssets = (vocabAssetsByVocabulary[vocabulary.id] || []).sort((a, b) => {
        const ao = a.order ?? Number.MAX_SAFE_INTEGER;
        const bo = b.order ?? Number.MAX_SAFE_INTEGER;
        return ao - bo;
      });

      for (const link of linkedAssets) {
        const img = await ensureAssetExported(link.generic_asset_id);
        if (img && !images.some((it) => it.asset_id === img.asset_id)) {
          images.push(img);
        }
      }

      connectionsOut.push({
        id: vocabulary.id,
        option: resolveTextContent(vocabulary.option_id, textsMap),
        description: resolveTextContent(vocabulary.description_id, textsMap),
        external_link: vocabulary.external_link ?? null,
        images
      });
    }

    connectionTypesOut.push({
      id: field.id,
      name: resolveTextContent(field.name_id, textsMap),
      description: resolveTextContent(field.description_id, textsMap),
      onwebsite: field.onwebsite,
      private: field.private,
      connections: connectionsOut
    });
  }

  await writeJsonFile(path.join(outRoot, 'connections.json'), {
    type: 'connections-export',
    version: 1,
    exported_at: new Date().toISOString(),
    connection_types: connectionTypesOut
  });

  await createZipFromFolder(outRoot, filePath);
  try {
    await fsPromises.rm(outRoot, { recursive: true, force: true });
  } catch { }

  return {
    filePath,
    mode: 'zip',
    counts: {
      connection_types: connectionTypesOut.length,
      connections: connectionTypesOut.reduce((sum, it) => sum + (it.connections?.length || 0), 0),
      images: exportedImageByAssetId.size
    }
  };
}
