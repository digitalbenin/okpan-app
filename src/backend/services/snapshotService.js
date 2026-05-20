import * as Y from 'yjs';
import { db } from '../../db/init.js';
import { eq, and, gt, desc, sql, inArray, or } from 'drizzle-orm';
import { yjs_snapshots, yjs_updates, change_log, ingestion_state } from '../../db/schema.js';
import * as schema from '../../db/schema.js';
import { getProjectDoc, ensureTableMap, replaceProjectDoc } from './projectCacheService.js';
import { scheduleAssetReconcile } from './assetTorrentManagerService.js';

// Minimal compatibility: ensure parent table maps exist before applying updates
const TABLES = [
  'project',
  'settings',
  'website_settings',
  'object_display_fields',
  'research_fields',
  'ontology_fields',
  'assets',
  'generic_assets',
  'objects',
  'templates',
  'languages',
  'institutions',
  'texts',
  'translations',
  'vocabularies',
  'datasources',
  'imports',
  'objects_assets',
  'assets_institutions',
  'objects_research_fields',
  'objects_ontology_fields',
  'vocabularies_generic_assets',
  'objects_datasources'
];

function ensureParentTypes(doc) {
  const tables = doc.getMap('tables');
  for (const t of TABLES) {
    if (!tables.get(t)) tables.set(t, new Y.Map());
  }
}

function isSkeletonProjectRow(row) {
  return !!row && !row.title_id && !row.description_id
}

function countDocRows(doc) {
  try {
    const tables = doc.getMap('tables');
    let total = 0;
    const perTable = {};
    tables.forEach((tableMap, key) => {
      const size = typeof tableMap?.size === 'number' ? tableMap.size : 0;
      perTable[key] = size;
      total += size;
    });
    return { total, perTable };
  } catch {
    return { total: 0, perTable: {} };
  }
}

async function getLatestWatermark(projectId) {
  const stateRows = await db
    .select({ last_id: ingestion_state.last_processed_change_id })
    .from(ingestion_state)
    .where(eq(ingestion_state.project_id, projectId))
    .limit(1)
    .execute();
  if (stateRows.length && stateRows[0]?.last_id) return stateRows[0].last_id;

  const lastChange = await db
    .select({ id: change_log.id })
    .from(change_log)
    .where(eq(change_log.project_id, projectId))
    .orderBy(desc(change_log.created_at), desc(change_log.id))
    .limit(1)
    .execute();
  return lastChange[0]?.id ?? null;
}

export async function createProjectSnapshot(projectId) {
  if (!projectId) throw new Error('createProjectSnapshot requires projectId');
  const doc = getProjectDoc(projectId);
  const snapshotBytes = Y.encodeStateAsUpdate(doc);
  const stateVector = Y.encodeStateVector(doc);
  const lastChangeId = await getLatestWatermark(projectId);

  await db.insert(yjs_snapshots).values({
    project_id: projectId,
    last_change_id: lastChangeId,
    snapshot_bytes: Buffer.from(snapshotBytes),
    state_vector: Buffer.from(stateVector)
  }).execute();

  return { projectId, lastChangeId };
}

export async function loadLatestSnapshot(projectId) {
  const rows = await db
    .select()
    .from(yjs_snapshots)
    .where(eq(yjs_snapshots.project_id, projectId))
    .orderBy(desc(yjs_snapshots.created_at), desc(yjs_snapshots.id))
    .limit(1)
    .execute();
  return rows[0] || null;
}

export async function applySnapshotToDoc(projectId, snapshotRow) {
  if (!snapshotRow) return false;
  const doc = replaceProjectDoc(projectId);
  const bytes = snapshotRow.snapshot_bytes;
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (!u8 || u8.length === 0) return false;
  Y.applyUpdate(doc, u8);
  return true;
}

export async function replayUpdatesAfterSnapshot(projectId, snapshotRow) {
  if (!snapshotRow) return 0;
  const doc = getProjectDoc(projectId);
  const updates = await db
    .select({ update_bytes: yjs_updates.update_bytes, to_id: yjs_updates.to_change_id })
    .from(yjs_updates)
    .where(and(eq(yjs_updates.project_id, projectId), gt(yjs_updates.created_at, snapshotRow.created_at)))
    .orderBy(yjs_updates.created_at, yjs_updates.id)
    .execute();

  let applied = 0;
  const seenToIds = new Set();
  for (const row of updates) {
    if (row.to_id && seenToIds.has(row.to_id)) continue;
    if (row.to_id) seenToIds.add(row.to_id);
    const bytes = row.update_bytes;
    const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    if (!u8 || u8.length < 3) continue;
    Y.applyUpdate(doc, u8);
    applied += 1;
  }
  return applied;
}

async function replayAllUpdates(projectId) {
  const doc = replaceProjectDoc(projectId);
  const updates = await db
    .select({ update_bytes: yjs_updates.update_bytes, to_id: yjs_updates.to_change_id, created_at: yjs_updates.created_at, id: yjs_updates.id })
    .from(yjs_updates)
    .where(eq(yjs_updates.project_id, projectId))
    .orderBy(yjs_updates.created_at, yjs_updates.id)
    .execute();

  let applied = 0;
  const seenToIds = new Set();
  for (const row of updates) {
    if (row.to_id && seenToIds.has(row.to_id)) continue;
    if (row.to_id) seenToIds.add(row.to_id);

    const bytes = row.update_bytes;
    const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    if (!u8 || u8.length < 3) continue;
    try {
      Y.applyUpdate(doc, u8);
      applied += 1;
    } catch (err) {
      console.warn('[Snapshot] Failed to apply update during full replay', { projectId, updateId: row.id }, err);
    }
  }
  return applied;
}

export async function hydrateProjectFromLatestSnapshot(projectId) {
  try {
    const doc = getProjectDoc(projectId);
    const before = countDocRows(doc);
    console.log('[Snapshot] Hydration start', { projectId, guid: doc.guid, rows: before.total });
    const snap = await loadLatestSnapshot(projectId);
    if (!snap) {
      // No snapshot exists yet; fall back to replaying all yjs_updates.
      // Only ensure parent maps if there are updates to replay (legacy logs).
      try {
        const cntRows = await db
          .select({ c: sql`COUNT(*)` })
          .from(yjs_updates)
          .where(eq(yjs_updates.project_id, projectId))
          .limit(1)
          .execute();
        const count = Number(cntRows?.[0]?.c ?? 0);
        if (count > 0) ensureParentTypes(doc);
      } catch {
        // If count fails, be conservative and do not pre-create parents
      }
      const applied = await replayAllUpdates(projectId);
      const after = countDocRows(doc);
      console.log('[Snapshot] No snapshot found; applied updates from log', { projectId, applied, rows: after.total });
      return { applied, fromSnapshot: false };
    }
    await applySnapshotToDoc(projectId, snap);
    const applied = await replayUpdatesAfterSnapshot(projectId, snap);
    const after = countDocRows(doc);
    console.log('[Snapshot] Hydrated from snapshot', { projectId, applied, rows: after.total });
    return { applied, fromSnapshot: true };
  } catch (err) {
    console.error('[Snapshot] Hydration error', { projectId }, err);
    return { applied: 0, fromSnapshot: false, error: err?.message };
  }
}

export async function hydrateProjectFromDatabase(projectId) {
  if (!projectId) return { applied: 0 };

  // 1. Snapshot / History Strategy (Primary)
  // We prefer loading this because it preserves Vector Clocks and Deletions.
  let historyApplied = 0;
  try {
      const res = await hydrateProjectFromLatestSnapshot(projectId);
      historyApplied = res.applied;
  } catch (err) {
      console.warn('[Snapshot] Failed to load history', err);
  }

  const doc = getProjectDoc(projectId);
  const tables = doc.getMap('tables');

  // 2. Validation
  const stats = countDocRows(doc);

  // 3. Fallback / Migration Strategy
  // If History yielded 0 rows, check if SQLite has data.
  // This happens on:
  // - First run after feature enable
  // - Disaster recovery (history wiped)
  // - Fresh import via SQL script
  let dbHasData = false;
  try {
      // Fast check: do we have a project record?
      const pCount = (await db.select({ c: sql`COUNT(*)` }).from(schema.project).where(eq(schema.project.id, projectId)).execute())[0].c;
      dbHasData = (pCount > 0);
  } catch {}

  const processDocHasProject = doc.getMap('tables').get('project')?.size > 0;

  if (stats.total > 0) {
      if (dbHasData && !processDocHasProject) {
          console.warn('[Snapshot] History was partially incomplete (missing project table) but preserving existing CRDT history to prevent vector clock resets.', { projectId });
      } else {
          console.log('[Snapshot] Hydrated successfully from History', { projectId, rows: stats.total });
      }
      return { applied: historyApplied, source: 'history' };
  }

  if (!dbHasData) {
      // Empty DB, Empty Doc. Clean slate.
      return { applied: 0, source: 'empty' };
  }

  // 4. Perform Deep Hydration (SQL -> Yjs)
  console.log('[Snapshot] History empty but DB has data. Performing Migration Hydration.', { projectId });
  let loadedCount = 0;
  
  // -- Deep Hydration Logic Start -- 
  const resolveSchema = (name) => {
    if (name === 'generic_assets') return schema.genericAssets;
    if (name === 'website_settings') return schema.websiteSettings;
    return schema[name];
  };

  const loadIntoDoc = (tableName, rows) => {
    if (!rows || rows.length === 0) return;
    const yMap = ensureTableMap(projectId, tableName);
    doc.transact(() => {
      for (const row of rows) {
        // Strict: Only string/number/boolean/null allowed at top level of Y.Map if we want easy interop
        // But we store row as a nested Y.Map for atomicity
        const rowMap = new Y.Map();
        for (const [k, v] of Object.entries(row)) {
           rowMap.set(k, v);
        }
        yMap.set(row.id, rowMap);
      }
    }, 'hydration');
    loadedCount += rows.length;
  };

  try {
      // Project
      const projectRows = await db.select().from(schema.project).where(eq(schema.project.id, projectId)).execute();
      loadIntoDoc('project', projectRows.filter((row) => !isSkeletonProjectRow(row)));

      // Core Tables
      const directProjectTables = [
        'settings', 'website_settings', 'object_display_fields',
        'research_fields', 'ontology_fields', 'assets', 'generic_assets',
        'objects', 'templates', 'languages', 'institutions'
      ];
      for (const t of directProjectTables) {
         const tableDef = resolveSchema(t);
         if (tableDef && tableDef.project_id) {
             const rows = await db.select().from(tableDef).where(eq(tableDef.project_id, projectId)).execute();
             loadIntoDoc(t, rows);
         }
      }

      // Dependent Tables (Translations, Datasources, Junctions, Vocabs)
      // (Simplified for brevity, assuming existing logic was mostly correct but mis-ordered)
      
      // Texts/Translations
      const langIds = (await db.select({ id: schema.languages.id }).from(schema.languages).where(eq(schema.languages.project_id, projectId)).execute()).map(r => r.id);
      if (langIds.length > 0) {
          loadIntoDoc('texts', await db.select().from(schema.texts).where(inArray(schema.texts.original_language_id, langIds)).execute());
          loadIntoDoc('translations', await db.select().from(schema.translations).where(inArray(schema.translations.language_id, langIds)).execute());
      }
      
      // Datasources
      const instIds = (await db.select({ id: schema.institutions.id }).from(schema.institutions).where(eq(schema.institutions.project_id, projectId)).execute()).map(r => r.id);
      if (instIds.length > 0) {
          loadIntoDoc('datasources', await db.select().from(schema.datasources).where(inArray(schema.datasources.institution_id, instIds)).execute());
      }

      // Junctions
      const linkTables = [
         { name: 'objects_assets', col: 'object_id', ref: 'objects', refCol: 'id' },
         { name: 'assets_institutions', col: 'asset_id', ref: 'assets', refCol: 'id' },
         { name: 'objects_research_fields', col: 'object_id', ref: 'objects', refCol: 'id' },
         { name: 'objects_ontology_fields', col: 'object_id', ref: 'objects', refCol: 'id' },
         { name: 'objects_datasources', col: 'object_id', ref: 'objects', refCol: 'id' },
         { name: 'vocabularies_generic_assets', col: 'generic_asset_id', ref: 'generic_assets', refCol: 'id' }
      ];
      for (const l of linkTables) {
          const tableDef = resolveSchema(l.name);
          const refDef = resolveSchema(l.ref);
          const refIds = (await db.select({ id: refDef[l.refCol] }).from(refDef).where(eq(refDef.project_id, projectId)).execute()).map(r => r.id);
          if (refIds.length > 0) {
             loadIntoDoc(l.name, await db.select().from(tableDef).where(inArray(tableDef[l.col], refIds)).execute());
          }
      }

      // Vocabularies: field_id → research_fields.id, main_asset_id → genericAssets.id
      const rfIds = (await db.select({ id: schema.research_fields.id }).from(schema.research_fields).where(eq(schema.research_fields.project_id, projectId)).execute()).map(r => r.id);
      const gaIds = (await db.select({ id: schema.genericAssets.id }).from(schema.genericAssets).where(eq(schema.genericAssets.project_id, projectId)).execute()).map(r => r.id);
      const conds = [];
      if (rfIds.length) conds.push(inArray(schema.vocabularies.field_id, rfIds));
      if (gaIds.length) conds.push(inArray(schema.vocabularies.main_asset_id, gaIds));
      if (conds.length) {
          loadIntoDoc('vocabularies', await db.select().from(schema.vocabularies).where(or(...conds)).execute());
      }

  } catch (err) {
      console.error('[Snapshot] Deep hydration failed', err);
  }

  // 5. Important: Lock in this state as a snapshot immediately
  if (loadedCount > 0) {
      await createProjectSnapshot(projectId);
      console.log('[Snapshot] Saved Migration Snapshot. Future loads will use History.');
  }

  // Trigger P2P asset reconcile after hydration so any asset rows now in the doc
  // are checked against local disk and missing ones are queued for download.
  try {
    scheduleAssetReconcile(projectId);
    console.log('[Snapshot] Scheduled P2P asset reconcile after hydration:', projectId);
  } catch (err) {
    console.warn('[Snapshot] scheduleAssetReconcile error after hydration:', err?.message);
  }

  return { applied: loadedCount, source: 'migration' };
}