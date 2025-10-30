import * as Y from 'yjs';
import { db } from '../../db/init.js';
import { eq, and, gt, desc } from 'drizzle-orm';
import { yjs_snapshots, yjs_updates, change_log, ingestion_state } from '../../db/schema.js';
import { getProjectDoc } from './projectCache.js';

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
    // Ensure parents so older update batches (missing type creation) can apply
    ensureParentTypes(doc);
    const before = countDocRows(doc);
    console.log('[Snapshot] Hydration start', { projectId, guid: doc.guid, rows: before.total });
    const snap = await loadLatestSnapshot(projectId);
    if (!snap) {
      // No snapshot exists yet; fall back to replaying all yjs_updates
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