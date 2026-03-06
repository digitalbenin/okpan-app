import { TrysteroProvider } from '@winstonfassett/y-webrtc-trystero'
// Use Trystero Torrent (WebTorrent) strategy for matchmaking
import { joinRoom } from 'trystero'
import { RTCPeerConnection } from 'node-datachannel/polyfill'
import WebSocket from 'ws'
import * as awarenessProtocol from 'y-protocols/awareness.js'
import * as Y from 'yjs'
import { getProjectDoc } from './projectCache.js'
import { ingestRemoteUpdate } from '../handlers/remoteIngestionHandler.js'
import { hydrateProjectFromDatabase } from './snapshotService.js'
import { scheduleAssetReconcile, resetErroredAssets } from './assetTorrentManager.js'

// Helper: count tables and rows in a Y.Doc's `tables` map
function countDocTables(doc) {
  try {
    const tables = doc.getMap('tables')
    const json = tables ? tables.toJSON() : {}
    const tablesCount = Object.keys(json).length
    let rowsCount = 0
    for (const v of Object.values(json)) rowsCount += Object.keys(v || {}).length
    return { tables: tablesCount, rows: rowsCount }
  } catch (_) {
    return { tables: 0, rows: 0 }
  }
}

function safeGetMap(doc, name) {
    const tables = doc.getMap('tables');
    if (!tables.get(name)) tables.set(name, new Y.Map());
    return tables.get(name);
}

// Minimal P2P provider registry keyed by projectId
// Stores { provider, awareness, onUpdate }
const providers = new Map()

// Ensure Node/Electron main has WebSocket globals for Trystero matchmaking.
// WE NO LONGER POLLUTE globalThis.RTCPeerConnection because doing so tricks WebTorrent
// into detecting WebRTC and crashing `node-datachannel`'s delicate C++ N-API lifecycle!
// Trystero receives RTCPeerConnection explicitly via `joinRoom` anyway.
if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = WebSocket
}

/**
 * Start a Trystero-backed Yjs provider for the given project.
 * Uses the shared Y.Doc from projectCache.
 * @param {string} projectId
 * @param {Object} options
 * @param {Function} [options.onDataChange] Callback when remote data is ingested
 */
export async function startP2PForProject(projectId, options = {}) {
  if (!projectId) return null
  if (providers.has(projectId)) return providers.get(projectId).provider

  // Canonical local projection (driven by DB ingestion)
  const doc = getProjectDoc(projectId)

  // Ensure Doc is hydrated from DB before starting P2P to prevent "empty doc" diffs
  try {
    await hydrateProjectFromDatabase(projectId)
  } catch (err) {
    console.warn('[P2P] Initial hydration failed', err)
  }

  const roomId = `project-${projectId}`
  const appId = process.env.TRYSTERO_APP_ID || 'db-conn-tool'
  // Attach provider directly to canonical doc (single Y.Doc architecture)
  const awareness = new awarenessProtocol.Awareness(doc)

  // Maintain a baseline doc representing the last state persisted to SQLite
  // Used to compute BEFORE vs AFTER diffs for remote updates.
  const baselineDoc = new Y.Doc()
  try {
    const initialSnapshot = Y.encodeStateAsUpdate(doc)
    Y.applyUpdate(baselineDoc, initialSnapshot)
    const baseStats = countDocTables(baselineDoc)
    const canonStats = countDocTables(doc)
    console.log('[P2P] Baseline seeded', { projectId, baseline: baseStats, canonical: canonStats })
  } catch (err) {
    console.warn('[P2P] Failed to seed baseline doc from canonical', err)
  }

  // Set initial local presence and enable 5s heartbeat for debug visibility
  awareness.setLocalState({
    clientId: doc.clientID,
    projectId,
    role: 'backend-main',
    heartbeat: Date.now()
  })

  // Log peer connect/disconnect via awareness change events
  const onChange = ({ added = [], updated = [], removed = [] }) => {
    for (const clientId of added) {
      console.log('[P2P] Peer connected', { projectId, clientId })
      // New peer appeared: reset any errored assets and re-reconcile.
      // This handles the "after reconnect/network restoration" trigger point.
      resetErroredAssets(projectId).catch((err) =>
        console.warn('[P2P] resetErroredAssets error on peer connect:', err?.message)
      );
      scheduleAssetReconcile(projectId);
    }
    for (const clientId of updated) {
      console.log('[P2P] Peer updated', { projectId, clientId })
    }
    for (const clientId of removed) {
      console.log('[P2P] Peer disconnected', { projectId, clientId })
    }
  }
  awareness.on('change', onChange)

  const trysteroRoom = joinRoom({
    appId,
    rtcPolyfill: RTCPeerConnection,
  }, roomId)

  // Initialize provider with canonical doc (no explicit connect)
  const provider = new TrysteroProvider(roomId, doc, {
    appId,        // Required: Your Trystero app ID
    awareness,    // Awareness protocol
    trysteroRoom  // Use pre-configured room (server-side)
  })

  // Persist non-ingestion updates to SQLite via remote ingestion pipeline
  const onDocUpdatePersist = async (update, origin) => {
    try {
      // Ignore updates originating from DB tailer projections or local hydration/replay
      if (origin === 'ingestion' || origin === 'hydration' || origin === 'replay') {
        const baseStats = countDocTables(baselineDoc)
        const canonStats = countDocTables(doc)
        console.log('[P2P] Ingestion update observed on canonical', { projectId, bytes: update?.length || 0, baseline: baseStats, canonical: canonStats })
        return
      }
      const beforeBase = countDocTables(baselineDoc)
      const beforeCanon = countDocTables(doc)
      console.log('[P2P] Doc update observed', { projectId, origin, bytes: update?.length || 0, baselineBefore: beforeBase, canonicalBefore: beforeCanon })
      // Persist using baseline BEFORE snapshot to avoid zero-diff after local integration
      const res = await ingestRemoteUpdate(projectId, update, { beforeDoc: baselineDoc })
      if (res?.applied || res?.inserts || res?.updates || res?.deletes) {
        console.log('[P2P] Persisted Yjs update to SQLite', { projectId, origin, bytes: update?.length || 0, ...res })
        // Advance baseline to reflect the newly persisted update.
        // If the update bytes don't change baseline structurally, resync baseline to canonical.
        try {
          const beforeBase = countDocTables(baselineDoc)
          Y.applyUpdate(baselineDoc, update)
          let afterBase = countDocTables(baselineDoc)
          const afterCanon = countDocTables(doc)
          if (afterBase.tables === beforeBase.tables && afterBase.rows === beforeBase.rows && (afterCanon.tables !== beforeBase.tables || afterCanon.rows !== beforeBase.rows)) {
            // Resync baseline from canonical snapshot to avoid accumulating stale state
            const snapshot = Y.encodeStateAsUpdate(doc)
            Y.applyUpdate(baselineDoc, snapshot)
            afterBase = countDocTables(baselineDoc)
          }
          console.log('[P2P] Baseline advanced', { projectId, baselineAfter: afterBase, canonicalAfter: afterCanon })
        } catch (advErr) {
          console.warn('[P2P] Failed to advance baseline doc', advErr)
        }
        
        // Notify listener (frontend) that data has changed
        if (options.onDataChange && typeof options.onDataChange === 'function') {
          options.onDataChange();
        }
      }
    } catch (err) {
      console.error('[P2P] Failed to persist Yjs update to SQLite', err)
    }
  }
  doc.on('update', onDocUpdatePersist)

  providers.set(projectId, { provider, awareness, onChange, onDocUpdatePersist, baselineDoc })
  return provider
}

/**
 * Stop and remove the provider for the given project.
 */
export async function stopP2PForProject(projectId) {
  const entry = providers.get(projectId)
  if (!entry) return
  try {
    // Remove awareness listener & heartbeat
    try { entry.awareness?.off('change', entry.onChange) } catch (err) { console.warn('[P2P] Failed to remove awareness change listener', err) }
    try { getProjectDoc(projectId)?.off('update', entry.onDocUpdatePersist) } catch (err) { console.warn('[P2P] Failed to remove canonical doc persistence handler', err) }
    // Baseline doc is local-only; rely on GC

    const provider = entry.provider
    if (typeof provider.destroy === 'function') await provider.destroy()
    else if (typeof provider.disconnect === 'function') await provider.disconnect()
  } catch (err) {
    console.error('[P2P] stopP2PForProject error', err)
  }
  providers.delete(projectId)
}

/**
 * Get the provider instance for a project.
 */
export function getP2PProvider(projectId) {
  return providers.get(projectId)?.provider || null
}
