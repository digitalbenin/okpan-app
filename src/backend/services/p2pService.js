import { TrysteroProvider } from '@winstonfassett/y-webrtc-trystero'
// Use Trystero Torrent (WebTorrent) strategy for matchmaking
import { joinRoom } from 'trystero'
import { RTCPeerConnection } from 'node-datachannel/polyfill'
import WebSocket from 'ws'
import * as awarenessProtocol from 'y-protocols/awareness.js'
import * as Y from 'yjs'
import { eq } from 'drizzle-orm'
import { db } from '../../db/init.js'
import { project } from '../../db/schema.js'
import { getProjectDoc } from './projectCache.js'
import { ingestRemoteUpdate } from '../handlers/remoteIngestionHandler.js'
import { hydrateProjectFromDatabase } from './snapshotService.js'
import { scheduleAssetReconcile, resetErroredAssets } from './assetTorrentManager.js'
import { getGlobalProfile } from '../../db/init.js'

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

function syncBaselineFromCanonical(projectId, baselineDoc, canonicalDoc) {
  try {
    const snapshot = Y.encodeStateAsUpdate(canonicalDoc)
    Y.applyUpdate(baselineDoc, snapshot)
    const baselineStats = countDocTables(baselineDoc)
    const canonicalStats = countDocTables(canonicalDoc)
    console.log('[P2P] Baseline synced from canonical', { projectId, baseline: baselineStats, canonical: canonicalStats })
  } catch (err) {
    console.warn('[P2P] Failed to sync baseline from canonical', { projectId, err: err?.message })
  }
}

// Minimal P2P provider registry keyed by projectId
// Stores { provider, awareness, onUpdate }
const providers = new Map()
const pendingProjectPasswords = new Map()
let presenceNotifier = null

export function setPendingProjectPassword(projectId, password) {
  if (!projectId) return

  const normalizedPassword = typeof password === 'string' ? password.trim() : ''
  if (!normalizedPassword) {
    pendingProjectPasswords.delete(projectId)
    return
  }

  pendingProjectPasswords.set(projectId, normalizedPassword)
}

function normalizeUsername(username) {
  if (typeof username !== 'string') return null
  const trimmed = username.trim()
  return trimmed || null
}

function buildLocalPresenceState(doc, projectId, username) {
  return {
    clientId: doc.clientID,
    projectId,
    role: 'backend-main',
    heartbeat: Date.now(),
    username: normalizeUsername(username)
  }
}

function applyLocalPresenceState(projectId, entry, username) {
  const doc = getProjectDoc(projectId)
  entry.awareness.setLocalState(buildLocalPresenceState(doc, projectId, username))
}

function listRemotePeers(projectId) {
  const entry = providers.get(projectId)
  if (!entry?.awareness) return []

  const peers = []
  const localClientId = getProjectDoc(projectId)?.clientID

  entry.awareness.getStates().forEach((state, awarenessClientId) => {
    const stateProjectId = state?.projectId || projectId
    const clientId = state?.clientId ?? awarenessClientId
    const username = normalizeUsername(state?.username)

    if (stateProjectId !== projectId || clientId === localClientId || !username) {
      return
    }

    peers.push({
      clientId: String(clientId),
      username
    })
  })

  peers.sort((left, right) => left.username.localeCompare(right.username))
  return peers
}

function emitProjectPresence(projectId) {
  if (!presenceNotifier) return
  presenceNotifier(projectId, getProjectPresence(projectId))
}

export function setPresenceNotifier(notifier) {
  presenceNotifier = notifier
}

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
  if (providers.has(projectId)) {
    emitProjectPresence(projectId)
    return providers.get(projectId).provider
  }

  // Ensure Doc is hydrated from DB before starting P2P to prevent "empty doc" diffs
  try {
    await hydrateProjectFromDatabase(projectId)
  } catch (err) {
    console.warn('[P2P] Initial hydration failed', err)
  }

  // Canonical local projection (driven by DB ingestion)
  const doc = getProjectDoc(projectId)

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
  const globalProfile = await getGlobalProfile()
  awareness.setLocalState(buildLocalPresenceState(doc, projectId, globalProfile?.username))

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
    emitProjectPresence(projectId)
  }
  awareness.on('change', onChange)

  // Run db query to get project password
  let password = undefined;
  try {
    const projRecord = await db.select({ password: project.password }).from(project).where(eq(project.id, projectId)).limit(1);
    if (projRecord.length > 0 && projRecord[0].password) {
      password = projRecord[0].password;
    }
  } catch (err) {
    console.warn('[P2P] Failed to get project password', err);
  }

  if (!password) {
    password = pendingProjectPasswords.get(projectId)
  }

  const trysteroRoom = joinRoom({
    appId,
    password,
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
        syncBaselineFromCanonical(projectId, baselineDoc, doc)
        const baseStats = countDocTables(baselineDoc)
        const canonStats = countDocTables(doc)
        console.log('[P2P] Local persisted update observed on canonical', { projectId, origin, bytes: update?.length || 0, baseline: baseStats, canonical: canonStats })
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
      } else {
        syncBaselineFromCanonical(projectId, baselineDoc, doc)
      }
    } catch (err) {
      console.error('[P2P] Failed to persist Yjs update to SQLite', err)
    }
  }
  doc.on('update', onDocUpdatePersist)

  providers.set(projectId, { provider, awareness, onChange, onDocUpdatePersist, baselineDoc })
  emitProjectPresence(projectId)
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
  emitProjectPresence(projectId)
}

/**
 * Get the provider instance for a project.
 */
export function getP2PProvider(projectId) {
  return providers.get(projectId)?.provider || null
}

/**
 * Get the number of connected peers for a project.
 */
export function getProjectPeersCount(projectId) {
  return getProjectPresence(projectId).count
}

export function getProjectPresence(projectId) {
  const peers = listRemotePeers(projectId)
  return {
    peers,
    count: peers.length
  }
}

export async function refreshAllProjectPresence() {
  const globalProfile = await getGlobalProfile()

  for (const [projectId, entry] of providers.entries()) {
    applyLocalPresenceState(projectId, entry, globalProfile?.username)
    emitProjectPresence(projectId)
  }
}
