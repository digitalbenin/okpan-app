/**
 * Change-log tailer service that ingests database change_log rows into the
 * in-memory Yjs document and persists derived updates.
 *
 * @namespace backend.services.changeLogTailerService
 * @memberof backend.services
 */
import * as Y from 'yjs';
import { db } from '../../db/init.js';
import { getGlobalProfile, updateGlobalUsername } from '../../db/queries/globalSettings.js';
import { eq, and, or, gt, sql } from 'drizzle-orm';
import { FK_ORDER } from '../utils/projectScope.js';
import {
  change_log,
  yjs_updates,
  ingestion_state,
  project,
  settings,
  websiteSettings,
  object_display_fields,
  research_fields,
  ontology_fields,
  assets,
  genericAssets,
  objects,
  templates,
  languages,
  institutions,
  texts,
  translations,
  vocabularies,
  datasources,
  imports,
  objects_assets,
  assets_institutions,
  objects_research_fields,
  objects_ontology_fields,
  vocabularies_generic_assets
} from '../../db/schema.js';
import {
  getProjectDoc,
  ensureRowMap,
  setRowFields,
  deleteRow,
  getCurrentProjectId,
  hasCurrentProjectId,
} from './projectCacheService.js';
import { recordProjectActivityFromSyncEvent } from './syncActivityService.js';

const DEFAULT_INGEST_BATCH_SIZE = 200;
const DEFAULT_INGEST_INTERVAL_MS = 1000;

const tailerLocks = new Map(); // projectId → boolean

let dataChangeNotifier = null;
/**
 * Set the callback that fires when local changes have been ingested.
 * @memberof backend.services.changeLogTailerService
 * @param {Function|null} fn - Change notification callback.
 * @returns {void}
 */
export function setDataChangeNotifier(fn) {
  dataChangeNotifier = fn;
}

function isSkeletonProjectRow(row) {
  return !!row && !row.title_id && !row.description_id
}

async function fetchNextChangeBatch(projectId, batchSize) {
  const stateRows = await db
    .select()
    .from(ingestion_state)
    .where(eq(ingestion_state.project_id, projectId))
    .limit(1)
    .execute();

  const lastId = stateRows[0]?.last_processed_change_id || null;

  // Use rowid for deterministic, monotonic ordering regardless of created_at formatting
  let lastRowid = 0;
  if (lastId) {
    const lastRowidRows = await db
      .select({ rowid: sql`rowid` })
      .from(change_log)
      .where(eq(change_log.id, lastId))
      .limit(1)
      .execute();
    lastRowid = Number(lastRowidRows[0]?.rowid || 0);
  }

  // Select only metadata columns to avoid materializing huge JSON strings
  const rows = await db
    .select({
      id: change_log.id,
      project_id: change_log.project_id,
      origin: change_log.origin,
      table_name: change_log.table_name,
      op: change_log.op,
      row_id: change_log.row_id,
      created_at: change_log.created_at,
      new_row: change_log.new_row,
      old_row: change_log.old_row
    })
    .from(change_log)
    .where(and(eq(change_log.project_id, projectId), gt(sql`rowid`, lastRowid)))
    .orderBy(sql`rowid`)
    .limit(batchSize)
    .execute();

  return rows;
}

async function ensureActivityActorProfile() {
  let profile = await getGlobalProfile();

  if (!profile?.username) {
    profile = await updateGlobalUsername('');
  }

  return {
    actor_client_id: profile?.clientId || null,
    actor_username: profile?.username || null
  };
}

async function buildSyncActivityEvent(rows) {
  if (!rows?.length || rows[0]?.origin !== 'local') {
    return null;
  }

  const actor = await ensureActivityActorProfile();
  const sourceKey = rows[rows.length - 1]?.id;

  if (!sourceKey) {
    return null;
  }

  return {
    source_key: sourceKey,
    bundle_id: sourceKey,
    kind: 'user',
    created_at: Date.now(),
    ...actor,
    changes: JSON.stringify(rows.map((row) => ({
      table_name: row.table_name,
      op: row.op,
      row_id: row.row_id,
      new_row: row.new_row,
      old_row: row.old_row
    })))
  };
}

// Helper: load a single row from a table by id; skip heavy fields for certain tables
async function loadRowPayload(tableName, rowId) {
  try {
    switch (tableName) {
      case 'project': {
        const res = await db.select().from(project).where(eq(project.id, rowId)).limit(1).execute();
        const row = res[0] || null;
        if (isSkeletonProjectRow(row)) {
          return null;
        }
        return row;
      }
      case 'settings': {
        const res = await db.select().from(settings).where(eq(settings.id, rowId)).limit(1).execute();
        return res[0] || null;
      }
      case 'website_settings': {
        const res = await db.select().from(websiteSettings).where(eq(websiteSettings.id, rowId)).limit(1).execute();
        return res[0] || null;
      }
      case 'object_display_fields': {
        const res = await db.select().from(object_display_fields).where(eq(object_display_fields.id, rowId)).limit(1).execute();
        return res[0] || null;
      }
      case 'research_fields': {
        const res = await db.select().from(research_fields).where(eq(research_fields.id, rowId)).limit(1).execute();
        return res[0] || null;
      }
      case 'ontology_fields': {
        const res = await db.select().from(ontology_fields).where(eq(ontology_fields.id, rowId)).limit(1).execute();
        return res[0] || null;
      }
      case 'assets': {
        const res = await db.select().from(assets).where(eq(assets.id, rowId)).limit(1).execute();
        return res[0] || null;
      }
      case 'generic_assets': {
        const res = await db.select().from(genericAssets).where(eq(genericAssets.id, rowId)).limit(1).execute();
        return res[0] || null;
      }
      case 'objects': {
        const res = await db.select().from(objects).where(eq(objects.id, rowId)).limit(1).execute();
        return res[0] || null;
      }
      case 'templates': {
        const res = await db.select().from(templates).where(eq(templates.id, rowId)).limit(1).execute();
        return res[0] || null;
      }
      case 'languages': {
        const res = await db.select().from(languages).where(eq(languages.id, rowId)).limit(1).execute();
        return res[0] || null;
      }
      case 'institutions': {
        const res = await db.select().from(institutions).where(eq(institutions.id, rowId)).limit(1).execute();
        return res[0] || null;
      }
      case 'texts': {
        const res = await db.select().from(texts).where(eq(texts.id, rowId)).limit(1).execute();
        return res[0] || null;
      }
      case 'translations': {
        const res = await db.select().from(translations).where(eq(translations.id, rowId)).limit(1).execute();
        return res[0] || null;
      }
      case 'vocabularies': {
        const res = await db.select().from(vocabularies).where(eq(vocabularies.id, rowId)).limit(1).execute();
        return res[0] || null;
      }
      case 'datasources': {
        const res = await db.select().from(datasources).where(eq(datasources.id, rowId)).limit(1).execute();
        const payload = res[0] || null;
        if (payload && payload.import_id) {
          delete payload.import_id;
        }
        return payload;
      }
      case 'imports': {
        // Skip heavy imports payloads entirely during hydration
        return null;
      }
      case 'objects_assets': {
        const res = await db.select().from(objects_assets).where(eq(objects_assets.id, rowId)).limit(1).execute();
        return res[0] || null;
      }
      case 'assets_institutions': {
        const res = await db.select().from(assets_institutions).where(eq(assets_institutions.id, rowId)).limit(1).execute();
        return res[0] || null;
      }
      case 'objects_research_fields': {
        const res = await db.select().from(objects_research_fields).where(eq(objects_research_fields.id, rowId)).limit(1).execute();
        return res[0] || null;
      }
      case 'objects_ontology_fields': {
        const res = await db.select().from(objects_ontology_fields).where(eq(objects_ontology_fields.id, rowId)).limit(1).execute();
        return res[0] || null;
      }
      case 'objects_datasources': {
        const { objects_datasources } = await import('../../db/schema.js');
        const res = await db.select().from(objects_datasources).where(eq(objects_datasources.id, rowId)).limit(1).execute();
        return res[0] || null;
      }
      case 'vocabularies_generic_assets': {
        const res = await db.select().from(vocabularies_generic_assets).where(eq(vocabularies_generic_assets.id, rowId)).limit(1).execute();
        return res[0] || null;
      }
      default:
        return null;
    }
  } catch (_) {
    return null;
  }
}

async function applyBatchToDoc(projectId, rows) {
  if (!rows || rows.length === 0) return null;

  const doc = getProjectDoc(projectId);
  const stateVector = Y.encodeStateVector(doc);
  const syncActivityEvent = await buildSyncActivityEvent(rows);

  // Track if the transaction produced any Yjs changes
  let changed = false;
  const onUpdate = (_update, origin) => {
    // Only count updates originating from this ingestion transaction
    if (origin === 'ingestion') changed = true;
  };
  doc.on('update', onUpdate);

  // Build ops with payloads outside of Yjs transaction (no awaits inside transact)
  const ops = [];
  for (const row of rows) {
    try {
      const tableName = row.table_name;
      const rowId = row.row_id;
      const op = row.op;
      // Skip hydration for imports rows to avoid huge JSON payloads
      if (tableName === 'imports') {
        if (op === 'DELETE') {
          ops.push({ kind: 'delete', tableName, rowId });
        }
        continue;
      }
      if (op === 'DELETE') {
        ops.push({ kind: 'delete', tableName, rowId });
        continue;
      }
      // Load current row payload directly from the actual table
      const payload = await loadRowPayload(tableName, rowId) || {};
      
      // Filter out system timestamps to prevent infinite sync loops
      // The DB will manage its own timestamps on write
      if (payload.created_at) delete payload.created_at;
      if (payload.updated_at) delete payload.updated_at;
      if (payload.initialized_at) delete payload.initialized_at;

      // Yjs network serialization degrades Date objects into empty {}.
      // Convert them to numeric timestamps so they sync correctly across peers
      // and allow strict equivalence checking.
      for (const key of Object.keys(payload)) {
        if (payload[key] instanceof Date) {
          payload[key] = payload[key].getTime();
        }
      }

      ops.push({ kind: 'set', tableName, rowId, payload });
    } catch (err) {
      console.error('Tailer prep error:', err);
    }
  }

  doc.transact(() => {
    try {
      for (const op of ops) {
        if (op.tableName === 'project' && op.kind === 'set') {
           const tables = doc.getMap('tables');
           for (const t of FK_ORDER) {
             if (!tables.get(t)) tables.set(t, new Y.Map());
           }
        }
      }

      for (const op of ops) {
        if (op.kind === 'delete') {
          deleteRow(projectId, op.tableName, op.rowId);
        } else if (op.kind === 'set') {
          const rowMap = ensureRowMap(projectId, op.tableName, op.rowId);
          setRowFields(rowMap, op.payload);
        }
      }

      if (syncActivityEvent) {
        const activityEvents = doc.getMap('activity_events');
        const eventMap = new Y.Map();

        for (const [key, value] of Object.entries(syncActivityEvent)) {
          eventMap.set(key, value);
        }

        activityEvents.set(syncActivityEvent.source_key, eventMap);
      }
    } catch (err) {
      console.error('Tailer apply error:', err);
    }
  }, 'ingestion');

  doc.off('update', onUpdate);

  const updateBytes = Y.encodeStateAsUpdate(doc, stateVector);

  const fromId = rows[0].id;
  const toId = rows[rows.length - 1].id;
  // If no actual changes occurred (idempotent apply), skip persisting update bytes
  // Persist update bytes only if the doc actually changed
  if (changed && updateBytes && updateBytes.length > 0) {
    // Avoid inserting duplicates for the same change-id window
    const existing = await db
      .select({ id: yjs_updates.id })
      .from(yjs_updates)
      .where(and(
        eq(yjs_updates.project_id, projectId),
        eq(yjs_updates.from_change_id, fromId),
        eq(yjs_updates.to_change_id, toId)
      ))
      .limit(1)
      .execute();

    if (!existing.length) {
      await db.insert(yjs_updates).values({
        project_id: projectId,
        from_change_id: fromId,
        to_change_id: toId,
        update_bytes: Buffer.from(updateBytes)
      }).execute();
    }
  }

  const stateRows = await db
    .select()
    .from(ingestion_state)
    .where(eq(ingestion_state.project_id, projectId))
    .limit(1)
    .execute();
  if (stateRows.length === 0) {
    await db.insert(ingestion_state).values({
      project_id: projectId,
      last_processed_change_id: toId
    }).execute();
  } else {
    await db
      .update(ingestion_state)
      .set({ last_processed_change_id: toId })
      .where(eq(ingestion_state.project_id, projectId))
      .execute();
  }

  if (syncActivityEvent) {
    await recordProjectActivityFromSyncEvent(projectId, syncActivityEvent);
  }

  return { fromId, toId, changed };
}

let nullFetchCounter = 0;
/**
 * Ingest a single change_log batch for a project.
 * @memberof backend.services.changeLogTailerService
 * @param {string} projectId - Project identifier.
 * @param {number} [batchSize=200] - Maximum rows to ingest.
 * @returns {Promise<boolean>}
 */
export async function ingestOnceForProject(projectId, batchSize = DEFAULT_INGEST_BATCH_SIZE) {
  if (!projectId) return false;
  if (tailerLocks.get(projectId)) return false;
  tailerLocks.set(projectId, true);
  try {
    const rows = await fetchNextChangeBatch(projectId, batchSize);
    if (!rows || rows.length === 0) {
      if (nullFetchCounter++ % 10 === 0) {
        // console.log('[Tailer] Fetched 0 rows (throlling log)');
      }
      return false;
    }
    nullFetchCounter = 0;
    const firstOrigin = rows[0]?.origin || 'local';
    const segmentLength = rows.findIndex((row) => (row.origin || 'local') !== firstOrigin);
    const batchRows = segmentLength === -1 ? rows : rows.slice(0, segmentLength);
    //console.log('[Tailer] Fetched batch', { projectId, foundCount: rows?.length || 0 });
    const res = await applyBatchToDoc(projectId, batchRows);
    if (firstOrigin === 'local') {
      dataChangeNotifier?.(projectId);
    }
    return true;
  } catch (error) {
    console.error('Error ingesting change_log:', error);
    return false;
  } finally {
    tailerLocks.delete(projectId);
  }
}

/**
 * Start the periodic change-log tailing loop.
 * @memberof backend.services.changeLogTailerService
 * @param {Object} [options={}] - Tailer options.
 * @param {number} [options.intervalMs=1000] - Polling interval in milliseconds.
 * @param {number} [options.batchSize=200] - Maximum rows per batch.
 * @returns {void}
 */
export function startChangeLogTailer({ intervalMs = 1000, batchSize = 200 } = {}) {
  // Debug log to ensure the tailer actually started
  //console.log('[Tailer] Loop started');
  setInterval(async () => {
    try {
      if (!hasCurrentProjectId()) return;
      //if (intervalCounter++ % 10 === 0) console.log('[Tailer] Loop ticking for project', getCurrentProjectId());
      const projectId = getCurrentProjectId();
      
      let progressed = true;
      let safeGuard = 5;
      while (progressed && safeGuard > 0) {
        progressed = await ingestOnceForProject(projectId, batchSize);
        safeGuard -= 1;
      }
    } catch (err) {
      console.error('Tailer tick error:', err);
    }
  }, intervalMs);
}