import path from 'path';
import os from 'os';
import fs from 'fs';
import fsPromises from 'fs/promises';
import yauzl from 'yauzl';
import { v4 as uuidv4 } from 'uuid';
import { eq } from 'drizzle-orm';
import * as dbSchema from '../../db/schema.js';
import {
  resolveProjectAssetPath,
  toLogicalAssetFormats,
  toLogicalStoredAssetPath,
} from './assetPaths.js';

async function ensureDir(dirPath) {
  await fsPromises.mkdir(dirPath, { recursive: true });
}

async function extractZipToFolder(zipPath, destFolder) {
  await ensureDir(destFolder);

  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err) return reject(err);

      zipfile.readEntry();

      zipfile.on('entry', (entry) => {
        if (/\/$/.test(entry.fileName)) {
          zipfile.readEntry();
        } else {
          zipfile.openReadStream(entry, async (streamErr, readStream) => {
            if (streamErr) return reject(streamErr);

            const destPath = path.join(destFolder, entry.fileName);
            await ensureDir(path.dirname(destPath));

            const writeStream = fs.createWriteStream(destPath);
            readStream.pipe(writeStream);

            writeStream.on('close', () => {
              zipfile.readEntry();
            });

            writeStream.on('error', reject);
          });
        }
      });

      zipfile.on('end', () => resolve(true));
      zipfile.on('error', reject);
    });
  });
}

function validateConnectionsPayload(payload) {
  if (!payload || typeof payload !== 'object') return false;
  if (payload.type !== 'connections-export') return false;
  if (payload.version !== 1) return false;
  if (!Array.isArray(payload.connection_types)) return false;
  for (const typeRow of payload.connection_types) {
    if (!Array.isArray(typeRow?.connections)) return false;
    for (const conn of typeRow.connections) {
      if (!Array.isArray(conn?.images)) return false;
      for (const img of conn.images) {
        if (!img?.formats || typeof img.formats !== 'object') return false;
        if (!img.formats.original) return false;
      }
    }
  }
  return true;
}

async function createText(content, context, languageId, db) {
  const [row] = await db.insert(dbSchema.texts).values({
    id: uuidv4(),
    content: content || '',
    context,
    original_language_id: languageId
  }).returning();
  return row;
}

function makeImportedAssetBaseName(filename, assetId) {
  const parsed = path.parse(filename || `asset_${assetId}`);
  const base = parsed.name || `asset_${assetId}`;
  const ext = parsed.ext || '.avif';
  const suffix = uuidv4().slice(0, 8);
  return `${base}_${suffix}${ext}`;
}

async function importImageReference(imageRef, extractedRoot, projectFolder, projectId, db) {
  const sourceFormats = imageRef?.formats;
  if (!sourceFormats?.original) return null;

  const originalSource = path.join(extractedRoot, sourceFormats.original);
  if (!fs.existsSync(originalSource)) return null;

  const baseName = makeImportedAssetBaseName(imageRef?.filename, imageRef?.asset_id || 'asset');
  const parsed = path.parse(baseName);
  const originalDest = path.join(projectFolder, `${parsed.name}${parsed.ext}`);

  await fsPromises.copyFile(originalSource, originalDest);

  const formats = {
    original: originalDest
  };

  for (const [key, relativeSourcePath] of Object.entries(sourceFormats)) {
    if (key === 'original') continue;
    if (!relativeSourcePath || typeof relativeSourcePath !== 'string') continue;
    const source = path.join(extractedRoot, relativeSourcePath);
    if (!fs.existsSync(source)) continue;

    const sourceExt = path.extname(source) || '.avif';
    const keySuffix = key === 'sm' || key === 'md' ? `_${key}` : `_${key}`;
    const destination = path.join(projectFolder, `${parsed.name}${keySuffix}${sourceExt}`);
    await fsPromises.copyFile(source, destination);
    formats[key] = destination;
  }

  const storedFormats = toLogicalAssetFormats(formats);

  const [newAsset] = await db.insert(dbSchema.genericAssets).values({
    id: uuidv4(),
    filename: imageRef.filename || path.basename(originalSource),
    path: toLogicalStoredAssetPath(originalDest),
    type: imageRef.type || 'image',
    formats: storedFormats,
    project_id: projectId
  }).returning();

  return newAsset;
}

export async function importConnectionsJson(options, { db }) {
  const { filePath, projectId } = options || {};
  if (!filePath) throw new Error('filePath is required');
  if (!projectId) throw new Error('projectId is required');

  const tmpBase = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'connections-import-'));
  try {
    await extractZipToFolder(filePath, tmpBase);

    const jsonPath = path.join(tmpBase, 'connections.json');
    if (!fs.existsSync(jsonPath)) {
      return { success: false, error: 'Invalid file: missing connections.json' };
    }

    const payload = JSON.parse(await fsPromises.readFile(jsonPath, 'utf-8'));
    if (!validateConnectionsPayload(payload)) {
      return { success: false, error: 'Invalid connections export format' };
    }

    const projectLanguages = await db
      .select()
      .from(dbSchema.languages)
      .where(eq(dbSchema.languages.project_id, projectId))
      .execute();

    const defaultLanguage = projectLanguages.find((lang) => lang.is_default === 1) || projectLanguages[0];
    if (!defaultLanguage) {
      return { success: false, error: 'No project language found for import' };
    }

    const projectFolder = resolveProjectAssetPath(projectId);
    await ensureDir(projectFolder);

    let importedConnectionTypes = 0;
    let importedConnections = 0;
    let importedImages = 0;

    for (const connectionType of payload.connection_types) {
      const nameText = await createText(
        connectionType?.name || 'Untitled connection type',
        'research_fields.name',
        defaultLanguage.id,
        db
      );

      const descriptionText = await createText(
        connectionType?.description || '',
        'research_fields.description',
        defaultLanguage.id,
        db
      );

      const [newField] = await db.insert(dbSchema.research_fields).values({
        id: uuidv4(),
        name_id: nameText.id,
        description_id: descriptionText.id,
        type: 'vocabulary',
        project_id: projectId,
        private: Number(connectionType?.private) === 1 ? 1 : 0,
        onwebsite: Number(connectionType?.onwebsite) === 0 ? 0 : 1
      }).returning();
      importedConnectionTypes += 1;

      for (const connection of connectionType?.connections || []) {
        const optionText = await createText(
          connection?.option || 'Untitled connection',
          'vocabularies.option',
          defaultLanguage.id,
          db
        );

        const descText = await createText(
          connection?.description || '',
          'vocabularies.description',
          defaultLanguage.id,
          db
        );

        const importedAssets = [];
        for (const imageRef of connection?.images || []) {
          const newAsset = await importImageReference(imageRef, tmpBase, projectFolder, projectId, db);
          if (newAsset) {
            importedAssets.push(newAsset);
            importedImages += 1;
          }
        }

        const mainAssetId = importedAssets[0]?.id || null;
        const [newVocabulary] = await db.insert(dbSchema.vocabularies).values({
          id: uuidv4(),
          option_id: optionText.id,
          description_id: descText.id,
          external_link: connection?.external_link || null,
          field_id: newField.id,
          main_asset_id: mainAssetId
        }).returning();
        importedConnections += 1;

        if (importedAssets.length > 1) {
          const links = importedAssets.slice(1).map((asset, index) => ({
            id: uuidv4(),
            vocabulary_id: newVocabulary.id,
            generic_asset_id: asset.id,
            order: index
          }));
          await db.insert(dbSchema.vocabularies_generic_assets).values(links).execute();
        }
      }
    }

    return {
      success: true,
      imported: {
        connection_types: importedConnectionTypes,
        connections: importedConnections,
        images: importedImages
      }
    };
  } catch (error) {
    console.error('Error importing connections JSON:', error);
    throw error;
  } finally {
    try {
      await fsPromises.rm(tmpBase, { recursive: true, force: true });
    } catch { }
  }
}
