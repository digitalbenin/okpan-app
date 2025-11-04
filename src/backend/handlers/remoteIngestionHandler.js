import * as Y from 'yjs'
import { diff as deepDiff } from '@opentf/obj-diff'
import { db } from '../../db/init.js'
import * as schema from '../../db/schema.js'
import { eq, and, sql } from 'drizzle-orm'
import { getProjectDoc } from '../services/projectCache.js'
import { FK_ORDER } from '../services/projectScope.js'
import { withProjectLock } from '../services/lockService.js'

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

// NOT NULL fields per table to avoid setting nulls on updates
const NOT_NULL_FIELDS = {
  languages: ['project_id', 'code', 'name']
}

// Required fields for a successful INSERT (beyond id and project_id injection)
const INSERT_REQUIRED_FIELDS = {
  languages: ['code', 'name']
}

function hasRequiredForInsert(tableName, row) {
  const req = INSERT_REQUIRED_FIELDS[tableName]
  if (!req || req.length === 0) return true
  for (const key of req) {
    const v = row?.[key]
    // Treat empty string as missing for safety; DB allows it but we prefer real values
    if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) return false
  }
  return true
}

function sanitizeRowForDb(row, { dropCreatedAt = true, tableName } = {}) {
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
    // Avoid setting nulls on NOT NULL columns for specific tables
    const notNullCols = NOT_NULL_FIELDS[tableName] || []
    if ((v === null || v === undefined) && notNullCols.includes(k)) {
      // drop null assignment to satisfy NOT NULL constraints
      continue
    }
    out[k] = v
  }
  return out
}

// Inject minimal context required so triggers can resolve change_log.project_id
function injectProjectContextIfMissing(tableName, row, projectId) {
  try {
    const req = CONTEXT_REQUIREMENTS[tableName]
    if (req && req.includes('project_id') && projectId) {
      if (!row || row.project_id === undefined || row.project_id === null) {
        return { ...row, project_id: projectId }
      }
    }
  } catch (_) {}
  return row
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
  objects: ['project_id'],
  templates: ['project_id'],
  datasources: ['institution_id', 'template_id'], // either
  imports: ['template_id'],
  ontology_fields: ['project_id'],
  research_fields: ['project_id'],
  assets: ['project_id'],
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

// Simple stats helper for logging
function tablesStats(tablesJson) {
  try {
    const tables = Object.keys(tablesJson || {}).length
    let rows = 0
    for (const v of Object.values(tablesJson || {})) {
      rows += Object.keys(v || {}).length
    }
    return { tables, rows }
  } catch (_) {
    return { tables: 0, rows: 0 }
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
  const values = { id, ...sanitizeRowForDb(row, { dropCreatedAt: true, tableName }) }
  await db.insert(table).values(values).execute()
}

async function applyUpdate(tableName, id, row) {
  const table = resolveTable(tableName)
  if (!table) return
  const values = { ...sanitizeRowForDb(row, { dropCreatedAt: true, tableName }) }
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
  // Allow callers to provide a baseline doc representing the BEFORE state
  // This fixes zero-diff when the canonical doc has already integrated the update.
  const baseline = options?.beforeDoc || getProjectDoc(projectId)

  // Seed shadow doc from canonical state
  const shadow = new Y.Doc()
  const snapshot = Y.encodeStateAsUpdate(baseline)
  Y.applyUpdate(shadow, snapshot)
  // Capture BEFORE tables from the shadow seeded at a single point-in-time
  // This avoids races from reading the live canonical doc, which can mutate concurrently
  const beforeTables = jsonTables(shadow)
  const beforeStats = tablesStats(beforeTables)

  // Apply inbound remote update to the same shadow and capture AFTER tables
  try {
    Y.applyUpdate(shadow, updateBytes)
  } catch (err) {
    console.error('[RemoteIngestion] Failed to apply inbound Yjs update', err)
    return { applied: 0, error: err?.message }
  }
  let afterTables = jsonTables(shadow)
  let afterStats = tablesStats(afterTables)
  let source = options?.beforeDoc ? 'baseline' : 'shadow'

  // Fallbacks:
  // 1) Structural: if AFTER equals BEFORE by counts, and canonical differs by counts → use canonical.
  // 2) Content: if AFTER has no diffs vs BEFORE, but canonical has diffs → use canonical.
  try {
    const canonical = getProjectDoc(projectId)
    const canonicalTables = jsonTables(canonical)
    const canonicalStats = tablesStats(canonicalTables)

    const structuralUnchanged = afterStats.tables === beforeStats.tables && afterStats.rows === beforeStats.rows
    const canonicalStructurallyDiffers = canonicalStats.tables !== beforeStats.tables || canonicalStats.rows !== beforeStats.rows

    // Compute content-level diffs only if structural unchanged
    const firstDiffs = deepDiff(beforeTables || {}, afterTables || {}) || []
    const noContentDiff = firstDiffs.length === 0
    const canonicalDiffs = noContentDiff ? (deepDiff(beforeTables || {}, canonicalTables || {}) || []) : []

    if ((structuralUnchanged && canonicalStructurallyDiffers) || (noContentDiff && canonicalDiffs.length > 0)) {
      afterTables = canonicalTables
      afterStats = canonicalStats
      source = noContentDiff ? 'canonical-fallback-diff' : 'canonical-fallback-struct'
    }
  } catch (_) {}

  try {
    console.log('[RemoteIngestion] BEFORE/AFTER tables snapshot', {
      projectId,
      updateBytes: updateBytes?.length || 0,
      source,
      before: beforeStats,
      after: afterStats
    })
  } catch (_) {}
  const { inserts, updates, deletes } = computeDiff(beforeTables, afterTables)

  let applied = 0
  let deferredInserts = 0
  let deferredUpdates = 0
  let deferredDeletes = 0
  // Multi-pass transaction to satisfy FKs: attempt in FK order repeatedly (max 3 passes)
  const result = await withProjectLock(projectId, async () => {
    await db.transaction(async (tx) => {
    // Capture starting change_log rowid to stamp provenance only for rows created by this transaction
    let startRowid = 0
    try {
      const lastRow = await tx
        .select({ rid: sql`rowid` })
        .from(schema.change_log)
        .where(eq(schema.change_log.project_id, projectId))
        .orderBy(sql`rowid desc`)
        .limit(1)
        .execute()
      startRowid = Number(lastRow?.[0]?.rid || 0)
    } catch (_) {}
    const remainingInserts = inserts.map(x => ({ ...x }))
    const remainingUpdates = updates.map(x => ({ ...x }))
    const remainingDeletes = deletes.map(x => ({ ...x }))

    // Cyclic FK fields that should be excluded on initial insert and applied later via update
    // This breaks the cycle: project → languages → texts → project
    const CYCLIC_FK_FIELDS = {
      project: ['title_id', 'description_id']
    }

    let pass = 0
    let progress = true
    while (progress && pass < 3) {
      progress = false
      pass += 1
      console.log('[RemoteIngestion] Commit pass start', { projectId, pass, remainingInserts: remainingInserts.length, remainingUpdates: remainingUpdates.length, remainingDeletes: remainingDeletes.length })

      // Inserts and updates forward in FK order
      for (const t of FK_ORDER) {
        const tableRef = resolveTable(t)
        if (!tableRef) continue

        for (let i = remainingInserts.length - 1; i >= 0; i--) {
          const ins = remainingInserts[i]
          if (ins.table !== t) continue
          try {
            let payload = sanitizeRowForDb(ins.row, { dropCreatedAt: true, tableName: t })
            // Inject minimal project context when required
            payload = injectProjectContextIfMissing(t, payload, projectId)
            // Break cyclic FK: for project inserts, drop text FK fields on first insert
            // and schedule them to be applied via an update in a subsequent pass
            const cyclicKeys = CYCLIC_FK_FIELDS[t]
            if (Array.isArray(cyclicKeys) && cyclicKeys.length > 0) {
              const fkPayload = {}
              let hasFk = false
              for (const key of cyclicKeys) {
                if (payload[key] !== undefined && payload[key] !== null) {
                  fkPayload[key] = payload[key]
                  delete payload[key]
                  hasFk = true
                }
              }
              if (hasFk) {
                // Queue an update for this row so FK fields are set after dependencies exist
                remainingUpdates.push({ table: t, id: ins.id, row: fkPayload })
              }
            }
            if (!hasProjectContext(t, { id: ins.id, ...payload })) {
              console.warn('[RemoteIngestion] Deferring insert lacking project context', { table: t, id: ins.id, requires: CONTEXT_REQUIREMENTS[t] })
              continue
            }
            // Enforce required fields for INSERT on specific tables (e.g., languages)
            if (!hasRequiredForInsert(t, payload)) {
              console.warn('[RemoteIngestion] Deferring insert lacking required fields', { table: t, id: ins.id, required: INSERT_REQUIRED_FIELDS[t] })
              continue
            }
            // Avoid aborting the transaction when rows already exist locally.
            // If the PK (id) is already present, treat the insert as idempotent.
            await tx
              .insert(tableRef)
              .values({ id: ins.id, ...payload })
              .onConflictDoNothing({ target: tableRef.id })
              .execute()
            applied += 1
            remainingInserts.splice(i, 1)
            progress = true
          } catch (err) {
            if (isFkError(err) || isChangeLogProjectIdNotNull(err)) {
              console.warn('[RemoteIngestion] Insert deferred due to FK/ProjectId', { table: t, id: ins.id, err: err?.message })
              continue
            }
            throw err
          }
        }

        for (let i = remainingUpdates.length - 1; i >= 0; i--) {
          const up = remainingUpdates[i]
          if (up.table !== t) continue
          try {
            let payload = sanitizeRowForDb(up.row, { dropCreatedAt: true, tableName: t })
            payload = injectProjectContextIfMissing(t, payload, projectId)
            // If this table requires certain fields to exist on insert, and payload has them,
            // perform an upsert to ensure the row is created if missing.
            const canUpsertInsert = hasRequiredForInsert(t, payload)
            if (canUpsertInsert && INSERT_REQUIRED_FIELDS[t]) {
              await tx
                .insert(tableRef)
                .values({ id: up.id, ...payload })
                .onConflictDoUpdate({ target: tableRef.id, set: { ...payload } })
                .execute()
            } else {
              await tx.update(tableRef).set({ ...payload }).where(eq(tableRef.id, up.id)).execute()
            }
            applied += 1
            remainingUpdates.splice(i, 1)
            progress = true
          } catch (err) {
            if (isFkError(err) || isChangeLogProjectIdNotNull(err)) {
              console.warn('[RemoteIngestion] Update deferred due to FK/ProjectId', { table: t, id: up.id, err: err?.message })
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
        for (let i = remainingDeletes.length - 1; i >= 0; i--) {
          const del = remainingDeletes[i]
          if (del.table !== t) continue
          try {
            await tx.delete(tableRef).where(eq(tableRef.id, del.id)).execute()
            applied += 1
            remainingDeletes.splice(i, 1)
            progress = true
          } catch (err) {
            if (isFkError(err) || isChangeLogProjectIdNotNull(err)) {
              console.warn('[RemoteIngestion] Delete deferred due to FK/ProjectId', { table: t, id: del.id, err: err?.message })
              continue
            }
            throw err
          }
        }
      }
    }
    // Stamp provenance for change_log rows created during this transaction to prevent echo loops
    try {
      const newRowsWhere = and(
        eq(schema.change_log.project_id, projectId),
        sql`rowid > ${startRowid}`
      )
      await tx
        .update(schema.change_log)
        .set({ origin: 'remote' })
        .where(newRowsWhere)
        .execute()
      if (options?.remoteClientId) {
        await tx
          .update(schema.change_log)
          .set({ client_id: options.remoteClientId })
          .where(newRowsWhere)
          .execute()
      }
    } catch (stampErr) {
      console.warn('[RemoteIngestion] Failed to stamp provenance on change_log', stampErr)
    }

    deferredInserts = remainingInserts.length
    deferredUpdates = remainingUpdates.length
    deferredDeletes = remainingDeletes.length
    })
    const summary = { projectId, inserts: inserts.length, updates: updates.length, deletes: deletes.length, diffSource: options?.beforeDoc ? 'baseline-before-after' : 'shadow-before-after' }
    if (deferredInserts || deferredUpdates || deferredDeletes) {
      console.log('[RemoteIngestion] Committed with deferrals', { ...summary, deferredInserts, deferredUpdates, deferredDeletes })
    } else {
      console.log('[RemoteIngestion] Committed', summary)
    }
    return { applied, ...summary, deferredInserts, deferredUpdates, deferredDeletes }
  })

  return result
}