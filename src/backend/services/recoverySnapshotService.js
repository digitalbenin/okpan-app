import path from 'path';
import os from 'os';
import fs from 'fs';
import fsPromises from 'fs/promises';
import { randomUUID } from 'crypto';
import { app } from 'electron';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { eq, inArray, or } from 'drizzle-orm';
import { db, dbPath } from '../../db/init.js';
import * as dbSchema from '../../db/schema.js';
import { createProjectBackup, restoreProjectBackup } from './backupService.js';
import { ingestOnceForProject } from './changeLogTailerService.js';
import { hydrateProjectFromDatabase } from './snapshotService.js';
import { removePathRobust, WINDOWS_FS_RETRY_OPTIONS } from './fsUtils.js';

const SNAPSHOT_ROOT_DIR = 'project-recovery-snapshots';
const DEFAULT_SNAPSHOT_LIMIT = 10;
const snapshotLocks = new Map();

function getSnapshotsBaseDir() {
  try {
    return path.join(app.getPath('userData'), SNAPSHOT_ROOT_DIR);
  } catch {
    return path.join(process.cwd(), '.snapshot-recovery');
  }
}

function getProjectSnapshotDir(projectId) {
  return path.join(getSnapshotsBaseDir(), projectId);
}

function getSnapshotArchivePath(projectId, snapshotId) {
  return path.join(getProjectSnapshotDir(projectId), `${snapshotId}.dctx`);
}

function getSnapshotManifestPath(projectId, snapshotId) {
  return path.join(getProjectSnapshotDir(projectId), `${snapshotId}.json`);
}

function getSnapshotStagingRootDir() {
  return path.join(getSnapshotsBaseDir(), '.staging');
}

async function withProjectLock(projectId, work) {
  const previous = snapshotLocks.get(projectId) || Promise.resolve();
  let releaseLock;
  const current = new Promise((resolve) => {
    releaseLock = resolve;
  });

  snapshotLocks.set(projectId, previous.then(() => current));
  await previous;

  try {
    return await work();
  } finally {
    releaseLock();
    if (snapshotLocks.get(projectId) === current) {
      snapshotLocks.delete(projectId);
    }
  }
}

async function ensureProjectSnapshotDir(projectId) {
  await fsPromises.mkdir(getProjectSnapshotDir(projectId), { recursive: true });
}

async function removeSnapshotFiles(projectId, snapshotId) {
  await Promise.allSettled([
    fsPromises.rm(getSnapshotArchivePath(projectId, snapshotId), {
      force: true,
      ...WINDOWS_FS_RETRY_OPTIONS,
    }),
    fsPromises.rm(getSnapshotManifestPath(projectId, snapshotId), {
      force: true,
      ...WINDOWS_FS_RETRY_OPTIONS,
    }),
  ]);
}

async function readManifest(filePath) {
  const raw = await fsPromises.readFile(filePath, 'utf-8');
  return JSON.parse(raw);
}

async function loadProjectSnapshotManifests(projectId) {
  const dirPath = getProjectSnapshotDir(projectId);
  if (!fs.existsSync(dirPath)) {
    return [];
  }

  const entries = await fsPromises.readdir(dirPath, { withFileTypes: true });
  const manifests = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) {
      continue;
    }

    const manifestPath = path.join(dirPath, entry.name);
    try {
      const manifest = await readManifest(manifestPath);
      const archivePath = getSnapshotArchivePath(projectId, manifest.id);
      if (!fs.existsSync(archivePath)) {
        continue;
      }
      manifests.push({
        ...manifest,
        filePath: archivePath,
        manifestPath,
      });
    } catch (error) {
      console.warn('[RecoverySnapshot] Failed to read manifest', { projectId, manifestPath, error: error?.message });
    }
  }

  manifests.sort((left, right) => {
    const leftTs = new Date(left.createdAt || 0).getTime();
    const rightTs = new Date(right.createdAt || 0).getTime();
    return rightTs - leftTs;
  });

  return manifests;
}

function isManualSnapshot(manifest) {
  return manifest?.trigger === 'manual' || manifest?.isAutomatic === false;
}

async function pruneProjectSnapshots(projectId, keepCount = DEFAULT_SNAPSHOT_LIMIT) {
  const manifests = await loadProjectSnapshotManifests(projectId);
  const automaticSnapshots = manifests.filter((manifest) => !isManualSnapshot(manifest));
  const stale = automaticSnapshots.slice(Math.max(keepCount, 0));

  for (const entry of stale) {
    await removeSnapshotFiles(projectId, entry.id);
  }
}

export async function deleteProjectRecoverySnapshots(projectId) {
  if (!projectId || typeof projectId !== 'string') {
    throw new Error('deleteProjectRecoverySnapshots requires a valid projectId');
  }

  return withProjectLock(projectId, async () => {
    await fsPromises.rm(getProjectSnapshotDir(projectId), {
      recursive: true,
      force: true,
      ...WINDOWS_FS_RETRY_OPTIONS,
    });

    return { deleted: true };
  });
}

function normalizeIdList(values) {
  if (!Array.isArray(values)) return [];
  return values.filter((value) => typeof value === 'string' && value.trim());
}

function collectTextIds(...groups) {
  const ids = new Set();
  groups.flat().forEach((value) => {
    if (typeof value === 'string' && value.trim()) {
      ids.add(value);
    }
  });
  return Array.from(ids);
}

async function deleteWhereIn(tx, table, column, ids) {
  if (!ids.length) {
    return;
  }
  await tx.delete(table).where(inArray(column, ids)).execute();
}

async function deleteProjectAssetsFolder(projectId) {
  const projectAssetsFolder = path.join(process.cwd(), 'src', 'assets', 'project_assets', projectId);
  await removePathRobust(projectAssetsFolder, { recursive: true });
}

async function deleteProjectStateForRestore(projectId) {
  const projectRow = await db
    .select({
      title_id: dbSchema.project.title_id,
      description_id: dbSchema.project.description_id,
    })
    .from(dbSchema.project)
    .where(eq(dbSchema.project.id, projectId))
    .limit(1)
    .execute();

  if (!projectRow.length) {
    return { deleted: false };
  }

  const institutions = await db
    .select({
      id: dbSchema.institutions.id,
      name_id: dbSchema.institutions.name_id,
      description_id: dbSchema.institutions.description_id,
      country_id: dbSchema.institutions.country_id,
      location_id: dbSchema.institutions.location_id,
    })
    .from(dbSchema.institutions)
    .where(eq(dbSchema.institutions.project_id, projectId))
    .execute();

  const institutionIds = normalizeIdList(institutions.map((row) => row.id));

  const researchFields = await db
    .select({
      id: dbSchema.research_fields.id,
      name_id: dbSchema.research_fields.name_id,
      description_id: dbSchema.research_fields.description_id,
    })
    .from(dbSchema.research_fields)
    .where(eq(dbSchema.research_fields.project_id, projectId))
    .execute();

  const researchFieldIds = normalizeIdList(researchFields.map((row) => row.id));

  const genericAssets = await db
    .select({ id: dbSchema.genericAssets.id })
    .from(dbSchema.genericAssets)
    .where(eq(dbSchema.genericAssets.project_id, projectId))
    .execute();

  const genericAssetIds = normalizeIdList(genericAssets.map((row) => row.id));

  const assetRows = await db
    .select({ id: dbSchema.assets.id })
    .from(dbSchema.assets)
    .where(eq(dbSchema.assets.project_id, projectId))
    .execute();

  const assetIds = normalizeIdList(assetRows.map((row) => row.id));

  const ontologyFields = await db
    .select({
      id: dbSchema.ontology_fields.id,
      name_id: dbSchema.ontology_fields.name_id,
      description_id: dbSchema.ontology_fields.description_id,
      category_id: dbSchema.ontology_fields.category_id,
    })
    .from(dbSchema.ontology_fields)
    .where(eq(dbSchema.ontology_fields.project_id, projectId))
    .execute();

  const datasources = institutionIds.length
    ? await db
        .select({
          id: dbSchema.datasources.id,
          import_id: dbSchema.datasources.import_id,
          name_id: dbSchema.datasources.name_id,
          method_id: dbSchema.datasources.method_id,
          notes_id: dbSchema.datasources.notes_id,
        })
        .from(dbSchema.datasources)
        .where(inArray(dbSchema.datasources.institution_id, institutionIds))
        .execute()
    : [];

  const vocabularies = researchFieldIds.length
    ? await db
        .select({
          option_id: dbSchema.vocabularies.option_id,
          description_id: dbSchema.vocabularies.description_id,
        })
        .from(dbSchema.vocabularies)
        .where(inArray(dbSchema.vocabularies.field_id, researchFieldIds))
        .execute()
    : [];

  const websiteSettings = await db
    .select({
      title_id: dbSchema.websiteSettings.title_id,
      about_id: dbSchema.websiteSettings.about_id,
    })
    .from(dbSchema.websiteSettings)
    .where(eq(dbSchema.websiteSettings.project_id, projectId))
    .execute();

  const languages = await db
    .select({ id: dbSchema.languages.id })
    .from(dbSchema.languages)
    .where(eq(dbSchema.languages.project_id, projectId))
    .execute();

  const languageIds = normalizeIdList(languages.map((row) => row.id));
  const importIds = normalizeIdList(datasources.map((row) => row.import_id));

  const textIds = collectTextIds(
    projectRow[0]?.title_id,
    projectRow[0]?.description_id,
    institutions.flatMap((row) => [row.name_id, row.description_id, row.country_id, row.location_id]),
    researchFields.flatMap((row) => [row.name_id, row.description_id]),
    ontologyFields.flatMap((row) => [row.name_id, row.description_id, row.category_id]),
    datasources.flatMap((row) => [row.name_id, row.method_id, row.notes_id]),
    vocabularies.flatMap((row) => [row.option_id, row.description_id]),
    websiteSettings.flatMap((row) => [row.title_id, row.about_id]),
  );

  await db.transaction(async (tx) => {
    await tx.update(dbSchema.project)
      .set({ title_id: null, description_id: null })
      .where(eq(dbSchema.project.id, projectId))
      .execute();

    await tx.delete(dbSchema.actions)
      .where(eq(dbSchema.actions.project_id, projectId))
      .execute();

    if (assetIds.length > 0) {
      await deleteWhereIn(tx, dbSchema.asset_local_state, dbSchema.asset_local_state.asset_id, assetIds);
    }
    if (genericAssetIds.length > 0) {
      await deleteWhereIn(tx, dbSchema.generic_asset_local_state, dbSchema.generic_asset_local_state.generic_asset_id, genericAssetIds);
    }

    await tx.delete(dbSchema.objects)
      .where(eq(dbSchema.objects.project_id, projectId))
      .execute();

    await tx.delete(dbSchema.assets)
      .where(eq(dbSchema.assets.project_id, projectId))
      .execute();

    await tx.delete(dbSchema.templates)
      .where(eq(dbSchema.templates.project_id, projectId))
      .execute();

    if (institutionIds.length > 0) {
      await tx.delete(dbSchema.datasources)
        .where(inArray(dbSchema.datasources.institution_id, institutionIds))
        .execute();
    }

    await tx.delete(dbSchema.institutions)
      .where(eq(dbSchema.institutions.project_id, projectId))
      .execute();

    if (researchFieldIds.length > 0) {
      await tx.delete(dbSchema.vocabularies)
        .where(inArray(dbSchema.vocabularies.field_id, researchFieldIds))
        .execute();
    }

    if (genericAssetIds.length > 0) {
      await tx.delete(dbSchema.vocabularies)
        .where(inArray(dbSchema.vocabularies.main_asset_id, genericAssetIds))
        .execute();
    }

    await tx.delete(dbSchema.research_fields)
      .where(eq(dbSchema.research_fields.project_id, projectId))
      .execute();

    await tx.delete(dbSchema.genericAssets)
      .where(eq(dbSchema.genericAssets.project_id, projectId))
      .execute();

    await tx.delete(dbSchema.ontology_fields)
      .where(eq(dbSchema.ontology_fields.project_id, projectId))
      .execute();

    await tx.delete(dbSchema.object_display_fields)
      .where(eq(dbSchema.object_display_fields.project_id, projectId))
      .execute();

    await tx.delete(dbSchema.websiteSettings)
      .where(eq(dbSchema.websiteSettings.project_id, projectId))
      .execute();

    await tx.delete(dbSchema.settings)
      .where(eq(dbSchema.settings.project_id, projectId))
      .execute();

    if (importIds.length > 0) {
      await deleteWhereIn(tx, dbSchema.imports, dbSchema.imports.id, importIds);
    }

    if (textIds.length || languageIds.length) {
      let translationsWhere = null;
      if (textIds.length && languageIds.length) {
        translationsWhere = or(
          inArray(dbSchema.translations.text_id, textIds),
          inArray(dbSchema.translations.language_id, languageIds),
        );
      } else if (textIds.length) {
        translationsWhere = inArray(dbSchema.translations.text_id, textIds);
      } else if (languageIds.length) {
        translationsWhere = inArray(dbSchema.translations.language_id, languageIds);
      }

      if (translationsWhere) {
        await tx.delete(dbSchema.translations)
          .where(translationsWhere)
          .execute();
      }
    }

    let textsWhere = null;
    if (textIds.length && languageIds.length) {
      textsWhere = or(
        inArray(dbSchema.texts.id, textIds),
        inArray(dbSchema.texts.original_language_id, languageIds),
      );
    } else if (textIds.length) {
      textsWhere = inArray(dbSchema.texts.id, textIds);
    } else if (languageIds.length) {
      textsWhere = inArray(dbSchema.texts.original_language_id, languageIds);
    }

    if (textsWhere) {
      await tx.delete(dbSchema.texts)
        .where(textsWhere)
        .execute();
    }

    await tx.delete(dbSchema.languages)
      .where(eq(dbSchema.languages.project_id, projectId))
      .execute();

  });

  await deleteProjectAssetsFolder(projectId);

  return { deleted: true };
}

async function flushProjectTailer(projectId, { batchSize = 500, maxPasses = 50 } = {}) {
  let passes = 0;
  while (passes < maxPasses) {
    const progressed = await ingestOnceForProject(projectId, batchSize);
    if (!progressed) {
      break;
    }
    passes += 1;
  }
  return { passes };
}

function toPublicManifest(manifest) {
  return {
    id: manifest.id,
    projectId: manifest.projectId,
    createdAt: manifest.createdAt,
    trigger: manifest.trigger,
    reason: manifest.reason,
    isAutomatic: manifest.isAutomatic,
    metadata: manifest.metadata,
  };
}

async function createSnapshotCloneFromLiveDb(targetDbPath) {
  await fsPromises.mkdir(path.dirname(targetDbPath), { recursive: true });
  await fsPromises.rm(targetDbPath, { force: true });

  const escapedTargetPath = targetDbPath.replace(/\\/g, '/').replace(/'/g, "''");

  try {
    await db.run('PRAGMA wal_checkpoint(FULL);');
  } catch (error) {
    console.warn('[RecoverySnapshot] WAL checkpoint before clone failed', { error: error?.message });
  }

  await db.run(`VACUUM INTO '${escapedTargetPath}';`);
}

function openSnapshotCloneDb(cloneDbPath) {
  const cloneClient = createClient({
    url: `file:${cloneDbPath.replace(/\\/g, '/')}`,
  });

  return {
    client: cloneClient,
    db: drizzle(cloneClient, { schema: dbSchema }),
  };
}

async function finalizeSnapshotFromDb(projectId, options = {}, sourceDb) {
  await ensureProjectSnapshotDir(projectId);

  const snapshotId = randomUUID();
  const createdAt = new Date().toISOString();
  const archivePath = getSnapshotArchivePath(projectId, snapshotId);
  const manifestPath = getSnapshotManifestPath(projectId, snapshotId);
  const trigger = options.trigger || 'manual';
  const reason = options.reason || null;
  const isAutomatic = options.isAutomatic !== false;

  const backupResult = await createProjectBackup(
    { project_id: projectId, filePath: archivePath },
    { db: sourceDb },
  );

  const manifest = {
    id: snapshotId,
    projectId,
    createdAt,
    trigger,
    reason,
    isAutomatic,
    metadata: backupResult.metadata,
  };

  await fsPromises.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  await pruneProjectSnapshots(projectId, options.keepCount || DEFAULT_SNAPSHOT_LIMIT);

  return toPublicManifest(manifest);
}

export async function listRecoverySnapshots(projectId, options = {}) {
  const limit = Number.isFinite(options.limit) ? options.limit : DEFAULT_SNAPSHOT_LIMIT;
  const manifests = await loadProjectSnapshotManifests(projectId);
  return manifests.slice(0, Math.max(limit, 0)).map(toPublicManifest);
}

export async function createRecoverySnapshot(projectId, options = {}) {
  if (!projectId || typeof projectId !== 'string') {
    throw new Error('createRecoverySnapshot requires a valid projectId');
  }

  return withProjectLock(projectId, async () => {
    return finalizeSnapshotFromDb(projectId, options, db);
  });
}

export async function prepareSessionOpenRecoverySnapshot(projectId, options = {}) {
  if (!projectId || typeof projectId !== 'string') {
    throw new Error('prepareSessionOpenRecoverySnapshot requires a valid projectId');
  }

  return withProjectLock(projectId, async () => {
    const stagingRootDir = getSnapshotStagingRootDir();
    await fsPromises.mkdir(stagingRootDir, { recursive: true });
    const stagingBaseDir = await fsPromises.mkdtemp(path.join(stagingRootDir, `${projectId}-`));
    const cloneDbPath = path.join(stagingBaseDir, path.basename(dbPath || 'snapshot-clone.db'));

    await createSnapshotCloneFromLiveDb(cloneDbPath);

    const packagingJob = (async () => {
      const { client: cloneClient, db: cloneDb } = openSnapshotCloneDb(cloneDbPath);
      try {
        return await withProjectLock(projectId, async () => finalizeSnapshotFromDb(projectId, {
          trigger: options.trigger || 'session-open',
          reason: options.reason || 'Automatic recovery snapshot captured before the first sync after opening this project in a new app session.',
          isAutomatic: true,
          keepCount: options.keepCount,
        }, cloneDb));
      } finally {
        try {
          await cloneClient.close?.();
        } catch (error) {
          console.warn('[RecoverySnapshot] Failed to close staged clone DB', { projectId, error: error?.message });
        }
        await fsPromises.rm(stagingBaseDir, { recursive: true, force: true });
      }
    })().catch((error) => {
      console.warn('[RecoverySnapshot] Failed to finalize session-open snapshot', { projectId, error: error?.message });
      return null;
    });

    return {
      cloneDbPath,
      packagingJob,
    };
  });
}

export async function restoreRecoverySnapshot(projectId, snapshotId) {
  if (!projectId || typeof projectId !== 'string') {
    throw new Error('restoreRecoverySnapshot requires a valid projectId');
  }
  if (!snapshotId || typeof snapshotId !== 'string') {
    throw new Error('restoreRecoverySnapshot requires a valid snapshotId');
  }

  return withProjectLock(projectId, async () => {
    const manifestPath = getSnapshotManifestPath(projectId, snapshotId);
    const archivePath = getSnapshotArchivePath(projectId, snapshotId);

    if (!fs.existsSync(manifestPath) || !fs.existsSync(archivePath)) {
      throw new Error('Requested recovery snapshot was not found');
    }

    const manifest = await readManifest(manifestPath);
    if (manifest.projectId !== projectId) {
      throw new Error('Snapshot does not belong to the requested project');
    }

    await deleteProjectStateForRestore(projectId);

    const restoreResult = await restoreProjectBackup(
      { filePath: archivePath, strategy: 'overwrite', preserveProjectRow: true },
      { db },
    );

    const flushResult = await flushProjectTailer(projectId);
    const hydrationResult = await hydrateProjectFromDatabase(projectId);

    return {
      snapshot: toPublicManifest(manifest),
      restoreResult,
      flushResult,
      hydrationResult,
    };
  });
}

export async function deleteRecoverySnapshot(projectId, snapshotId) {
  if (!projectId || typeof projectId !== 'string') {
    throw new Error('deleteRecoverySnapshot requires a valid projectId');
  }
  if (!snapshotId || typeof snapshotId !== 'string') {
    throw new Error('deleteRecoverySnapshot requires a valid snapshotId');
  }

  return withProjectLock(projectId, async () => {
    const manifestPath = getSnapshotManifestPath(projectId, snapshotId);
    const archivePath = getSnapshotArchivePath(projectId, snapshotId);

    if (!fs.existsSync(manifestPath) || !fs.existsSync(archivePath)) {
      throw new Error('Requested recovery snapshot was not found');
    }

    const manifest = await readManifest(manifestPath);
    if (manifest.projectId !== projectId) {
      throw new Error('Snapshot does not belong to the requested project');
    }

    await removeSnapshotFiles(projectId, snapshotId);

    return {
      deleted: true,
      snapshot: toPublicManifest(manifest),
    };
  });
}