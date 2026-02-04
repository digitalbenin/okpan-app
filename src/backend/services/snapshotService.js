import * as Y from 'yjs';
import { db } from '../../db/init.js';
import { eq, and, gt, desc, sql, inArray, or } from 'drizzle-orm';
import { yjs_snapshots, yjs_updates, change_log, ingestion_state } from '../../db/schema.js';
import * as schema from '../../db/schema.js';
import { getProjectDoc, ensureTableMap } from './projectCache.js';

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
  'vocabularies_generic_assets'
];

function ensureParentTypes(doc) {
  const tables = doc.getMap('tables');
  for (const t of TABLES) {
    if (!tables.get(t)) tables.set(t, new Y.Map());
  }
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
  const doc = getProjectDoc(projectId);
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
  const doc = getProjectDoc(projectId);
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
  const doc = getProjectDoc(projectId);
  const tables = doc.getMap('tables');

  // Optimization: If doc already has rows, assume it's valid and skip hydration
  let existingRows = 0;
  try {
    tables.forEach((tableMap) => {
      const size = typeof tableMap?.size === 'number' ? tableMap.size : 0;
      existingRows += size;
    });
  } catch {
    existingRows = 0;
  }
  if (existingRows > 0) {
     console.log('[Snapshot] Doc already hydrated, skipping DB load', { projectId, existingRows });
     return { applied: 0, skipped: true };
  }

  let loadedCount = 0;

  console.log('[Snapshot] Deep hydration from SQLite start', { projectId });

  // Resolve schema table from string name
  const resolveSchema = (name) => {
    if (name === 'generic_assets') return schema.genericAssets;
    if (name === 'website_settings') return schema.websiteSettings;
    return schema[name];
  };

  // Helper to load rows into Yjs
  const loadIntoDoc = (tableName, rows) => {
    if (!rows || rows.length === 0) return;
    const yMap = ensureTableMap(projectId, tableName);
    doc.transact(() => {
      for (const row of rows) {
        const rowMap = new Y.Map();
        for (const [k, v] of Object.entries(row)) {
          rowMap.set(k, v);
        }
        yMap.set(row.id, rowMap);
      }
    }, 'hydration'); // Origin 'hydration' to skip tailing (p2pService should ignore these if it sees them, but they are local)
    loadedCount += rows.length;
  };

  // 1. Core Project Tables
  const directProjectTables = [
    'settings', 'website_settings', 'object_display_fields',
    'research_fields', 'ontology_fields', 'assets', 'generic_assets',
    'objects', 'templates', 'languages', 'institutions'
  ];

  // Project table uses id instead of project_id
  try {
    const projectRows = await db
      .select()
      .from(schema.project)
      .where(eq(schema.project.id, projectId))
      .execute();
    loadIntoDoc('project', projectRows);
  } catch (err) {
    console.warn('[Snapshot] Failed to hydrate table project', err);
  }

  for (const t of directProjectTables) {
    const tableDef = resolveSchema(t);
    if (!tableDef || !tableDef.project_id) continue;
    try {
      const rows = await db.select().from(tableDef).where(eq(tableDef.project_id, projectId)).execute();
      loadIntoDoc(t, rows);
    } catch(err) {
      console.warn(`[Snapshot] Failed to hydrate table ${t}`, err);
    }
  }

  // 2. Dependent Tables

  // Texts & Translations (via Languages)
  try {
     const langIds = (await db.select({ id: schema.languages.id }).from(schema.languages).where(eq(schema.languages.project_id, projectId)).execute()).map(r => r.id);
     
     if (langIds.length > 0) {
        const textRows = await db.select().from(schema.texts).where(inArray(schema.texts.original_language_id, langIds)).execute();
        loadIntoDoc('texts', textRows);

        const transRows = await db.select().from(schema.translations).where(inArray(schema.translations.language_id, langIds)).execute();
        loadIntoDoc('translations', transRows);
     }
  } catch(err) { console.warn('[Snapshot] Failed to hydrate texts/translations', err); }

  // Datasources (via Institution OR Template)
  try {
     const instIds = (await db.select({ id: schema.institutions.id }).from(schema.institutions).where(eq(schema.institutions.project_id, projectId)).execute()).map(r => r.id);
     const tplIds = (await db.select({ id: schema.templates.id }).from(schema.templates).where(eq(schema.templates.project_id, projectId)).execute()).map(r => r.id);
     
     const conditions = [];
     if (instIds.length > 0) conditions.push(inArray(schema.datasources.institution_id, instIds));
     if (tplIds.length > 0) conditions.push(inArray(schema.datasources.template_id, tplIds));

     if (conditions.length > 0) {
        const dsRows = await db.select().from(schema.datasources)
          .where(or(...conditions)).execute();
        loadIntoDoc('datasources', dsRows);
     }
  } catch(err) { console.warn('[Snapshot] Failed to hydrate datasources', err); }

  // Junctions
  const linkTables = [
     { name: 'objects_assets', col: 'object_id', ref: 'objects', refCol: 'id' },
     { name: 'assets_institutions', col: 'asset_id', ref: 'assets', refCol: 'id' },
     { name: 'objects_research_fields', col: 'object_id', ref: 'objects', refCol: 'id' },
     { name: 'objects_ontology_fields', col: 'object_id', ref: 'objects', refCol: 'id' },
     { name: 'vocabularies_generic_assets', col: 'generic_asset_id', ref: 'generic_assets', refCol: 'id' }
  ];

  for (const l of linkTables) {
    const tableDef = resolveSchema(l.name);
    const refDef = resolveSchema(l.ref);
    if (!tableDef || !refDef) continue;
    try {
       const refIds = (await db.select({ id: refDef[l.refCol] }).from(refDef).where(eq(refDef.project_id, projectId)).execute()).map(r => r.id);
       if (refIds.length > 0) {
           const rows = await db.select().from(tableDef).where(inArray(tableDef[l.col], refIds)).execute();
           loadIntoDoc(l.name, rows);
       }
    } catch(err) { console.warn(`[Snapshot] Failed to hydrate ${l.name}`, err); }
  }

  // Vocabularies (via Field OR Main Asset)
  try {
     const fieldIds = (await db.select({ id: schema.ontology_fields.id }).from(schema.ontology_fields).where(eq(schema.ontology_fields.project_id, projectId)).execute()).map(r => r.id);
     const assetIds = (await db.select({ id: schema.assets.id }).from(schema.assets).where(eq(schema.assets.project_id, projectId)).execute()).map(r => r.id);

     const conditions = [];
     if (fieldIds.length > 0) conditions.push(inArray(schema.vocabularies.field_id, fieldIds));
     if (assetIds.length > 0) conditions.push(inArray(schema.vocabularies.main_asset_id, assetIds));

     if (conditions.length > 0) {
         const vocRows = await db.select().from(schema.vocabularies)
           .where(or(...conditions)).execute();
         loadIntoDoc('vocabularies', vocRows);
     }
  } catch(err) { console.warn('[Snapshot] Failed to hydrate vocabularies', err); }

  console.log('[Snapshot] Deep hydration complete', { projectId, loadedRows: loadedCount });
  return { applied: loadedCount };
}