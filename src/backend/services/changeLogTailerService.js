import * as Y from 'yjs';
import { db } from '../../db/init.js';
import { eq, and, or, gt, sql } from 'drizzle-orm';
import { change_log, yjs_updates, ingestion_state } from '../../db/schema.js';
import {
  getProjectDoc,
  ensureRowMap,
  setRowFields,
  deleteRow,
  getCurrentProjectId,
  hasCurrentProjectId,
} from './projectCache.js';

const DEFAULT_INGEST_BATCH_SIZE = 200;
const DEFAULT_INGEST_INTERVAL_MS = 1000;

const tailerLocks = new Map(); // projectId → boolean

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
    lastRowid = lastRowidRows[0]?.rowid || 0;
  }

  const rows = await db
    .select()
    .from(change_log)
    .where(and(eq(change_log.project_id, projectId), gt(sql`rowid`, lastRowid)))
    .orderBy(sql`rowid`)
    .limit(batchSize)
    .execute();

  return rows;
}

async function applyBatchToDoc(projectId, rows) {
  if (!rows || rows.length === 0) return null;

  const doc = getProjectDoc(projectId);
  const stateVector = Y.encodeStateVector(doc);

  // Track if the transaction produced any Yjs changes
  let changed = false;
  const onUpdate = (_update, origin) => {
    // Only count updates originating from this ingestion transaction
    if (origin === 'ingestion') changed = true;
  };
  doc.on('update', onUpdate);

  doc.transact(() => {
    for (const row of rows) {
      try {
        const tableName = row.table_name;
        const rowId = row.row_id;
        const op = row.op;
        if (op === 'DELETE') {
          deleteRow(projectId, tableName, rowId);
          continue;
        }
        const payloadRaw = row.new_row ?? row.old_row ?? null;
        let payload = {};
        if (payloadRaw != null) {
          if (typeof payloadRaw === 'string') {
            try {
              payload = JSON.parse(payloadRaw);
            } catch (e) {
              console.error('Failed to parse payload string as JSON', e);
              payload = {};
            }
          } else if (typeof payloadRaw === 'object') {
            payload = payloadRaw;
          }
        }
        // Ensure table exists and row map exists within the same transaction
        const rowMap = ensureRowMap(projectId, tableName, rowId);
        setRowFields(rowMap, payload);
      } catch (err) {
        console.error('Tailer apply error:', err);
      }
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

  return { fromId, toId, changed };
}

export async function ingestOnceForProject(projectId, batchSize = DEFAULT_INGEST_BATCH_SIZE) {
  if (!projectId) return false;
  if (tailerLocks.get(projectId)) return false;
  tailerLocks.set(projectId, true);
  try {
    const rows = await fetchNextChangeBatch(projectId, batchSize);
    if (!rows || rows.length === 0) return false;
    const res = await applyBatchToDoc(projectId, rows);
    console.log('[Tailer] Applied batch', { projectId, fromId: res?.fromId, toId: res?.toId, changed: !!res?.changed });
    return true;
  } catch (error) {
    console.error('Error ingesting change_log:', error);
    return false;
  } finally {
    tailerLocks.delete(projectId);
  }
}

export function startChangeLogTailer({ intervalMs = DEFAULT_INGEST_INTERVAL_MS, batchSize = DEFAULT_INGEST_BATCH_SIZE } = {}) {
  setInterval(async () => {
    try {
      if (!hasCurrentProjectId()) return;
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