import * as Y from 'yjs'
import { db } from '../../db/init.js'
import * as schema from '../../db/schema.js'
import { eq } from 'drizzle-orm'
import { getProjectDoc } from '../services/projectCache.js'
import { FK_ORDER } from '../services/projectScope.js'

// FK order centralized in projectScope.js

// Normalize timestamp-ish fields so Drizzle's timestamp_ms columns receive Date
const TIMESTAMP_FIELDS = new Set(['created_at', 'updated_at', 'date', 'initialized_at'])

function coerceTimestamp(v) {
  if (v === null || v === undefined) return undefined
  if (v instanceof Date) return v
  if (typeof v === 'number') {
    const d = new Date(v)
    return isNaN(d.getTime()) ? undefined : d
  }
  if (typeof v === 'string') {
    // Try ISO then numeric
    const d1 = new Date(v)
    if (!isNaN(d1.getTime())) return d1
    const n = Number(v)
    if (!Number.isNaN(n)) {
      const d2 = new Date(n)
      if (!isNaN(d2.getTime())) return d2
    }
    return undefined
  }
  // Yjs JSON for unknown types may come as {} — drop it
  return undefined
}

function sanitizeRowForDb(row, { dropCreatedAt = true } = {}) {
  if (!row || typeof row !== 'object') return {}
  const out = {}
  for (const [k, v] of Object.entries(row)) {
    if (TIMESTAMP_FIELDS.has(k)) {
      if (k === 'created_at' && dropCreatedAt) continue // let DEFAULT handle
      const ts = coerceTimestamp(v)
      if (ts !== undefined) out[k] = ts
      // else omit so DEFAULT / $onUpdateFn applies
      continue
    }
    out[k] = v
  }
  return out
}

function jsonTables(doc) {
  try {
    const tables = doc.getMap('tables')
    return tables ? tables.toJSON() : {}
  } catch (_) {
    return {}
  }
}

function computeDiff(beforeTables, afterTables) {
  const inserts = []
  const updates = []
  const deletes = []

  const tableNames = Array.from(new Set([
    ...Object.keys(beforeTables || {}),
    ...Object.keys(afterTables || {})
  ]))

  for (const t of tableNames) {
    const before = beforeTables?.[t] || {}
    const after = afterTables?.[t] || {}
    const rowIds = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]))
    for (const id of rowIds) {
      const b = before[id]
      const a = after[id]
      if (!b && a) inserts.push({ table: t, id, row: a })
      else if (b && !a) deletes.push({ table: t, id })
      else if (b && a) {
        const beforeStr = JSON.stringify(b)
        const afterStr = JSON.stringify(a)
        if (beforeStr !== afterStr) updates.push({ table: t, id, row: a })
      }
    }
  }
  return { inserts, updates, deletes }
}

async function applyInsert(tableName, id, row) {
  const table = schema[tableName]
  if (!table) return
  // Ensure id field present
  const values = { id, ...sanitizeRowForDb(row, { dropCreatedAt: true }) }
  await db.insert(table).values(values).execute()
}

async function applyUpdate(tableName, id, row) {
  const table = schema[tableName]
  if (!table) return
  const values = { ...sanitizeRowForDb(row, { dropCreatedAt: true }) }
  await db.update(table).set(values).where(eq(table.id, id)).execute()
}

async function applyDelete(tableName, id) {
  const table = schema[tableName]
  if (!table) return
  await db.delete(table).where(eq(table.id, id)).execute()
}

/**
 * Ingest a remote Yjs update for a project using SQLite-first order.
 * - Applies inbound bytes to a shadow doc seeded from the canonical doc
 * - Computes row-level diffs against canonical projection
 * - Commits INSERT/UPDATE/DELETE in FK-safe order inside a single transaction
 * - SQLite triggers emit change_log; tailer will project and persist yjs_updates
 */
export async function ingestRemoteUpdate(projectId, updateBytes, options = {}) {
  if (!projectId || !updateBytes) return { applied: 0 }
  const canonical = getProjectDoc(projectId)

  // Seed shadow doc from canonical state
  const shadow = new Y.Doc()
  const snapshot = Y.encodeStateAsUpdate(canonical)
  Y.applyUpdate(shadow, snapshot)

  // Apply inbound remote update to shadow
  try {
    Y.applyUpdate(shadow, updateBytes)
  } catch (err) {
    console.error('[RemoteIngestion] Failed to apply inbound Yjs update', err)
    return { applied: 0, error: err?.message }
  }

  const beforeTables = jsonTables(canonical)
  const afterTables = jsonTables(shadow)
  const { inserts, updates, deletes } = computeDiff(beforeTables, afterTables)

  let applied = 0
  // Run transaction for deterministic commit
  await db.transaction(async (tx) => {
    // Inserts and updates forward in FK order
    for (const t of FK_ORDER) {
      for (const ins of inserts.filter(x => x.table === t)) {
        await tx.insert(schema[t]).values({ id: ins.id, ...ins.row }).execute()
        applied += 1
      }
      for (const up of updates.filter(x => x.table === t)) {
        await tx.update(schema[t]).set({ ...up.row }).where(eq(schema[t].id, up.id)).execute()
        applied += 1
      }
    }

    // Deletes reverse order to satisfy FKs
    for (const t of [...FK_ORDER].reverse()) {
      for (const del of deletes.filter(x => x.table === t)) {
        await tx.delete(schema[t]).where(eq(schema[t].id, del.id)).execute()
        applied += 1
      }
    }
  })

  console.log('[RemoteIngestion] Committed', { projectId, inserts: inserts.length, updates: updates.length, deletes: deletes.length })
  return { applied, inserts: inserts.length, updates: updates.length, deletes: deletes.length }
}