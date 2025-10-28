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
  hasCurrentProjectId
} from './projectCache.js';

const DEFAULT_INGEST_BATCH_SIZE = 200;
const DEFAULT_INGEST_INTERVAL_MS = 1000;

const tailerLocks = new Map(); // projectId → boolean

async function fetchNextChangeBatch(projectId, batchSize) {
  const stateRows = await db
    .select()
    .from(ingestion_state)
    .where(eq(ingestion_state.project_id, projectId))
    .limit(1);

  const lastId = stateRows[0]?.last_processed_change_id || null;
  let lastTs = 0;
  if (lastId) {
    const lastRows = await db
      .select({ created_at: change_log.created_at })
      .from(change_log)
      .where(eq(change_log.id, lastId))
      .limit(1);
    lastTs = lastRows[0]?.created_at || 0;
  }

  const afterWatermarkCond = lastId
    ? or(
      gt(change_log.created_at, lastTs),
      and(eq(change_log.created_at, lastTs), gt(change_log.id, lastId))
    )
    : sql`1=1`;

  const rows = await db
    .select()
    .from(change_log)
    .where(and(eq(change_log.project_id, projectId), afterWatermarkCond))
    .orderBy(change_log.created_at, change_log.id)
    .limit(batchSize);

  return rows;
}

async function applyBatchToDoc(projectId, rows) {
  if (!rows || rows.length === 0) return null;

  const doc = getProjectDoc(projectId);
  const stateVector = Y.encodeStateVector(doc);

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
        const rowMap = ensureRowMap(projectId, tableName, rowId);
        setRowFields(rowMap, payload);
      } catch (err) {
        console.error('Tailer apply error:', err);
      }
    }
  }, 'ingestion');

  const updateBytes = Y.encodeStateAsUpdate(doc, stateVector);

  const fromId = rows[0].id;
  const toId = rows[rows.length - 1].id;
  await db.insert(yjs_updates).values({
    project_id: projectId,
    from_change_id: fromId,
    to_change_id: toId,
    update_bytes: Buffer.from(updateBytes)
  });

  const stateRows = await db
    .select()
    .from(ingestion_state)
    .where(eq(ingestion_state.project_id, projectId))
    .limit(1);
  if (stateRows.length === 0) {
    await db.insert(ingestion_state).values({
      project_id: projectId,
      last_processed_change_id: toId
    });
  } else {
    await db
      .update(ingestion_state)
      .set({ last_processed_change_id: toId })
      .where(eq(ingestion_state.project_id, projectId))
      .execute();
  }

  return { fromId, toId };
}

export async function ingestOnceForProject(projectId, batchSize = DEFAULT_INGEST_BATCH_SIZE) {
  if (!projectId) return false;
  if (tailerLocks.get(projectId)) return false;
  tailerLocks.set(projectId, true);
  try {
    const rows = await fetchNextChangeBatch(projectId, batchSize);
    if (!rows || rows.length === 0) return false;
    await applyBatchToDoc(projectId, rows);
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