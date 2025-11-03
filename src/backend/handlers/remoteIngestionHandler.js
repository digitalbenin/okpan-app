import * as Y from 'yjs'
import { diff as deepDiff } from '@opentf/obj-diff'
import { db } from '../../db/init.js'
import * as schema from '../../db/schema.js'
import { eq } from 'drizzle-orm'
import { getProjectDoc } from '../services/projectCache.js'
import { FK_ORDER } from '../services/projectScope.js'

// FK order centralized in projectScope.js

function isFkError(err) {
  const code = err?.code ?? err?.rawCode
  if (code === 'SQLITE_CONSTRAINT_FOREIGNKEY' || code === 787) return true
  const msg = String(err?.message || '')
  return /FOREIGN KEY constraint failed/i.test(msg)
}

function isChangeLogProjectIdNotNull(err) {
  const code = err?.code ?? err?.rawCode
  const msg = String(err?.message || '')
  if (code === 'SQLITE_CONSTRAINT_NOTNULL' || code === 1299) {
    if (/change_log\.project_id/i.test(msg)) return true
  }
  if (/NOT NULL constraint failed: change_log\.project_id/i.test(msg)) return true
  return false
}

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

// Map Y.Doc snake_case table names to Drizzle schema export names where needed
const TABLE_NAME_MAP = {
  generic_assets: 'genericAssets',
  website_settings: 'websiteSettings'
}

function resolveTable(tableName) {
  const k = TABLE_NAME_MAP[tableName] || tableName
  return schema[k]
}

// Minimum fields required so triggers can resolve project_id for change_log
const CONTEXT_REQUIREMENTS = {
  project: [],
  languages: ['project_id'],
  texts: ['original_language_id'],
  translations: ['language_id'],
  institutions: ['project_id'],
  objects: ['project_id', 'institution_id'], // either
  templates: ['project_id'],
  datasources: ['institution_id', 'template_id'], // either
  imports: ['template_id'],
  ontology_fields: ['project_id'],
  research_fields: ['project_id'],
  assets: ['project_id', 'institution_id'], // either
  generic_assets: ['project_id'],
  objects_assets: ['object_id', 'asset_id'], // either
  assets_institutions: ['asset_id', 'institution_id'], // either
  objects_research_fields: ['object_id', 'field_id'], // either
  objects_ontology_fields: ['object_id', 'field_id', 'datasources_id'], // any
  vocabularies: ['field_id', 'main_asset_id'], // either
  vocabularies_generic_assets: ['generic_asset_id', 'vocabulary_id'], // either
  object_display_fields: ['project_id'],
  settings: ['project_id'],
  website_settings: ['project_id']
}

function hasProjectContext(tableName, row) {
  const req = CONTEXT_REQUIREMENTS[tableName]
  if (!req) return true // unknown tables: assume safe
  if (req.length === 0) return true
  // Passes if any required field is present and truthy
  for (const key of req) {
    if (row && row[key]) return true
  }
  return false
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
  const diffs = deepDiff(beforeTables || {}, afterTables || {}) || []

  const inserts = []
  const updates = []
  const deletes = []

  const insertKeys = new Set()
  const updateKeys = new Set()
  const deleteKeys = new Set()

  const makeKey = (table, id) => `${table}#${id}`
  const getBeforeRows = (table) => (beforeTables?.[table] || {})
  const getAfterRows = (table) => (afterTables?.[table] || {})
  const toSegs = (p) => {
    if (Array.isArray(p)) return p
    if (typeof p === 'string') return p.split(/[./]/).filter(Boolean)
    return []
  }

  for (const d of diffs) {
    const t = d?.t
    const segs = toSegs(d?.p)

    if (segs.length === 0) {
      // Root-level structural replacement → add inserts for rows present in AFTER but absent in BEFORE
      for (const table of Object.keys(afterTables || {})) {
        const beforeRows = getBeforeRows(table)
        const afterRows = getAfterRows(table)
        for (const id of Object.keys(afterRows)) {
          if (!(id in beforeRows)) insertKeys.add(makeKey(table, id))
        }
      }
      continue
    }

    if (segs.length === 1) {
      const table = String(segs[0])
      const beforeRows = getBeforeRows(table)
      const afterRows = getAfterRows(table)
      if (t === 1) {
        // Table created → explicit inserts for all new rows
        for (const id of Object.keys(afterRows)) {
          if (!(id in beforeRows)) insertKeys.add(makeKey(table, id))
        }
      } else if (t === 0) {
        // Table deleted → explicit bulk deletes for all existing rows
        for (const id of Object.keys(beforeRows)) {
          deleteKeys.add(makeKey(table, id))
        }
      } else if (t === 2) {
        // Table updated → when BEFORE is empty and AFTER has rows, treat as creation
        if (Object.keys(beforeRows).length === 0 && Object.keys(afterRows).length > 0) {
          for (const id of Object.keys(afterRows)) {
            insertKeys.add(makeKey(table, id))
          }
        }
        // else rely on nested row-level diffs
      }
      continue
    }

    // segs.length >= 2 → row-level or nested field-level
    const table = String(segs[0])
    const id = String(segs[1])
    if (segs.length === 2) {
      if (t === 0) deleteKeys.add(makeKey(table, id))
      else if (t === 1) insertKeys.add(makeKey(table, id))
      else if (t === 2) updateKeys.add(makeKey(table, id))
    } else {
      updateKeys.add(makeKey(table, id))
    }
  }

  for (const k of insertKeys) {
    const [table, id] = k.split('#')
    const row = afterTables?.[table]?.[id]
    if (row !== undefined) inserts.push({ table, id, row })
  }
  for (const k of updateKeys) {
    const [table, id] = k.split('#')
    const row = afterTables?.[table]?.[id]
    if (row !== undefined) updates.push({ table, id, row })
  }
  for (const k of deleteKeys) {
    const [table, id] = k.split('#')
    deletes.push({ table, id })
  }

  // Optional debug: enable by setting env P2P_DEBUG_COMPUTEDIFF=1
  try {
    if (process?.env?.P2P_DEBUG_COMPUTEDIFF === '1') {
      console.log('[RemoteIngestion] Diff classification', {
        diffs: diffs.length,
        inserts: inserts.length,
        updates: updates.length,
        deletes: deletes.length,
        sample: diffs.slice(0, 5)
      })
    }
  } catch (_) {}

  return { inserts, updates, deletes }
}

async function applyInsert(tableName, id, row) {
  const table = resolveTable(tableName)
  if (!table) return
  // Ensure id field present
  const values = { id, ...sanitizeRowForDb(row, { dropCreatedAt: true }) }
  await db.insert(table).values(values).execute()
}

async function applyUpdate(tableName, id, row) {
  const table = resolveTable(tableName)
  if (!table) return
  const values = { ...sanitizeRowForDb(row, { dropCreatedAt: true }) }
  await db.update(table).set(values).where(eq(table.id, id)).execute()
}

async function applyDelete(tableName, id) {
  const table = resolveTable(tableName)
  if (!table) return
  await db.delete(table).where(eq(table.id, id)).execute()
}

/**
 * Ingest a remote Yjs update for a project using SQLite-first order.
 * - Applies inbound bytes to a shadow doc seeded from the canonical doc
 * - Computes row-level diffs using shadow BEFORE vs AFTER to avoid races
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
  // Capture BEFORE tables from the shadow seeded at a single point-in-time
  // This avoids races from reading the live canonical doc, which can mutate concurrently
  const beforeTables = jsonTables(shadow)

  // Apply inbound remote update to the same shadow and capture AFTER tables
  try {
    Y.applyUpdate(shadow, updateBytes)
  } catch (err) {
    console.error('[RemoteIngestion] Failed to apply inbound Yjs update', err)
    return { applied: 0, error: err?.message }
  }
  const afterTables = jsonTables(shadow)
  const { inserts, updates, deletes } = computeDiff(beforeTables, afterTables)

  let applied = 0
  let deferredInserts = 0
  let deferredUpdates = 0
  let deferredDeletes = 0
  // Run transaction for deterministic commit
  await db.transaction(async (tx) => {
    // Inserts and updates forward in FK order
    for (const t of FK_ORDER) {
      const tableRef = resolveTable(t)
      if (!tableRef) continue
      for (const ins of inserts.filter(x => x.table === t)) {
        try {
          const payload = sanitizeRowForDb(ins.row, { dropCreatedAt: true })
          // Ensure triggers can resolve project_id for change_log before attempting INSERT
          if (!hasProjectContext(t, { id: ins.id, ...payload })) {
            console.warn('[RemoteIngestion] Deferring insert lacking project context', { table: t, id: ins.id })
            deferredInserts += 1
            continue
          }
          await tx.insert(tableRef).values({ id: ins.id, ...payload }).execute()
          applied += 1
        } catch (err) {
          if (isFkError(err) || isChangeLogProjectIdNotNull(err)) {
            deferredInserts += 1
            continue
          }
          throw err
        }
      }
      for (const up of updates.filter(x => x.table === t)) {
        try {
          await tx.update(tableRef).set({ ...sanitizeRowForDb(up.row, { dropCreatedAt: true }) }).where(eq(tableRef.id, up.id)).execute()
          applied += 1
        } catch (err) {
          if (isFkError(err) || isChangeLogProjectIdNotNull(err)) {
            deferredUpdates += 1
            continue
          }
          throw err
        }
      }
    }

    // Deletes reverse order to satisfy FKs
    for (const t of [...FK_ORDER].reverse()) {
      const tableRef = resolveTable(t)
      if (!tableRef) continue
      for (const del of deletes.filter(x => x.table === t)) {
        try {
          await tx.delete(tableRef).where(eq(tableRef.id, del.id)).execute()
          applied += 1
        } catch (err) {
          if (isFkError(err) || isChangeLogProjectIdNotNull(err)) {
            deferredDeletes += 1
            continue
          }
          throw err
        }
      }
    }
  })

  const summary = { projectId, inserts: inserts.length, updates: updates.length, deletes: deletes.length, diffSource: 'shadow-before-after' }
  if (deferredInserts || deferredUpdates || deferredDeletes) {
    console.log('[RemoteIngestion] Committed with deferrals', { ...summary, deferredInserts, deferredUpdates, deferredDeletes })
  } else {
    console.log('[RemoteIngestion] Committed', summary)
  }
  return { applied, ...summary, deferredInserts, deferredUpdates, deferredDeletes }
}