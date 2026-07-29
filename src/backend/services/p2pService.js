/**
 * P2P sync service for project collaboration, presence tracking, and
 * Trystero-backed Yjs provider management.
 *
 * @namespace backend.services.p2pService
 * @memberof backend.services
 */
import { TrysteroProvider } from '@winstonfassett/y-webrtc-trystero'
// Use Trystero Torrent (WebTorrent) strategy for matchmaking
import { joinRoom, getRelaySockets } from 'trystero'
import { RTCPeerConnection as NodeRTCPeerConnection } from 'node-datachannel/polyfill'
import { getRelayConfig, getTurnConfig, isForceTurnOnly, getTurnOnlyIceServers } from '../utils/trysteroConfig.js'

// Monkey-patch RTCPeerConnection to log state changes for debugging connection drops
const RTCPeerConnection = class extends NodeRTCPeerConnection {
  constructor(config) {
    super(config);
    this.addEventListener('connectionstatechange', () => {
      console.log('[WebRTC] connectionstatechange', this.connectionState);
    });
    this.addEventListener('iceconnectionstatechange', () => {
      console.log('[WebRTC] iceconnectionstatechange', this.iceConnectionState);
    });
    this.addEventListener('icegatheringstatechange', () => {
      console.log('[WebRTC] icegatheringstatechange', this.iceGatheringState);
    });
    this.addEventListener('signalingstatechange', () => {
      console.log('[WebRTC] signalingstatechange', this.signalingState);
    });
  }
}
import WebSocket from 'ws'
import * as awarenessProtocol from 'y-protocols/awareness.js'
import * as Y from 'yjs'
import { eq } from 'drizzle-orm'
import { db } from '../../db/init.js'
import { project } from '../../db/schema.js'
import { getProjectDoc } from './projectCacheService.js'
import { ingestRemoteUpdate } from './remoteIngestionService.js'
import { hydrateProjectFromDatabase } from './snapshotService.js'
import { scheduleAssetReconcile, resetErroredAssets } from './assetTorrentManagerService.js'
import { getGlobalProfile } from '../../db/queries/globalSettings.js'

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
    //console.log('[P2P] Baseline synced from canonical', { projectId, baseline: baselineStats, canonical: canonicalStats })
  } catch (err) {
    console.warn('[P2P] Failed to sync baseline from canonical', { projectId, err: err?.message })
  }
}

// Minimal P2P provider registry keyed by projectId
// Stores { provider, awareness, onUpdate }
const providers = new Map()
const pendingProjectPasswords = new Map()
let presenceNotifier = null
const LOCAL_PRESENCE_HEARTBEAT_MS = 10000
const WEBSOCKET_READY_STATE_LABELS = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED']

// Health-check tracking: last time any remote peer was seen per project
const lastPeerSeenAt = new Map()
const healthCheckIntervals = new Map()
const HEALTH_CHECK_INTERVAL_MS = 30000
const PEER_DEAD_THRESHOLD_MS = 60000

function startHealthCheck(projectId) {
  if (healthCheckIntervals.has(projectId)) return
  lastPeerSeenAt.set(projectId, Date.now())
  const interval = setInterval(() => {
    const entry = providers.get(projectId)
    if (!entry) {
      stopHealthCheck(projectId)
      return
    }
    const lastSeen = lastPeerSeenAt.get(projectId) || 0
    const elapsed = Date.now() - lastSeen
    const remotePeers = listRemotePeers(projectId)
    if (remotePeers.length > 0) {
      lastPeerSeenAt.set(projectId, Date.now())
    } else if (elapsed > PEER_DEAD_THRESHOLD_MS) {
      console.warn('[P2P] Health check: no peers for >60s, restarting P2P', { projectId, elapsed })
      stopP2PForProject(projectId).then(() => {
        startP2PForProject(projectId, { skipHydration: true })
      }).catch(err => {
        console.error('[P2P] Health check restart failed', { projectId, err: err?.message })
      })
    }
  }, HEALTH_CHECK_INTERVAL_MS)
  healthCheckIntervals.set(projectId, interval)
}

function stopHealthCheck(projectId) {
  const interval = healthCheckIntervals.get(projectId)
  if (interval) {
    clearInterval(interval)
    healthCheckIntervals.delete(projectId)
  }
  lastPeerSeenAt.delete(projectId)
}

/**
 * Store a pending project password used during reconnect flows.
 * @memberof backend.services.p2pService
 * @param {string} projectId - Project identifier.
 * @param {string} password - Pending password.
 * @returns {void}
 */
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

function reannounceLocalPresence(projectId, entry) {
  applyLocalPresenceState(projectId, entry, entry.localUsername)
  emitProjectPresence(projectId)
}

function summarizeRelaySockets() {
  return Object.entries(getRelaySockets()).map(([url, socket]) => ({
    url,
    readyState: WEBSOCKET_READY_STATE_LABELS[socket?.readyState] || socket?.readyState || 'unknown'
  }))
}

function logRelayState(projectId, context, details = {}) {
  console.log('[P2P] relay state', {
    projectId,
    context,
    relays: summarizeRelaySockets(),
    ...details
  })
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

/**
 * Set the callback used to broadcast presence changes.
 * @memberof backend.services.p2pService
 * @param {Function|null} notifier - Presence notifier callback.
 * @returns {void}
 */
export function setPresenceNotifier(notifier) {
  presenceNotifier = notifier
}

// Ensure Node/Electron main has WebSocket globals for Trystero matchmaking.
// Trystero receives RTCPeerConnection explicitly via `joinRoom`.
if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = WebSocket
}


/**
 * Start a Trystero-backed Yjs provider for a project.
 * @memberof backend.services.p2pService
 * @param {string} projectId - Project identifier.
 * @param {Object} [options={}] - Start options.
 * @returns {Promise<Object|null>}
 */
export async function startP2PForProject(projectId, options = {}) {
  console.log('[P2P] startP2PForProject ENTRY', { projectId, hasProvider: providers.has(projectId), providerCount: providers.size })
  if (!projectId) return null
  if (providers.has(projectId)) {
    console.log('[P2P] start skipped: provider already exists', { projectId })
    emitProjectPresence(projectId)
    return providers.get(projectId).provider
  }

  console.log('[P2P] start requested', { projectId })

  // Ensure Doc is hydrated from DB before starting P2P to prevent "empty doc" diffs
  if (!options.skipHydration) {
    try {
      await hydrateProjectFromDatabase(projectId)
    } catch (err) {
      console.warn('[P2P] Initial hydration failed', err)
    }
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
  } catch (err) {
    console.warn('[P2P] Failed to seed baseline doc from canonical', err)
  }

  // Set initial local presence and keep it fresh so peers re-see us after reconnects.
  const globalProfile = await getGlobalProfile()
  awareness.setLocalState(buildLocalPresenceState(doc, projectId, globalProfile?.username))

  // Log peer connect/disconnect via awareness change events
  const onChange = ({ added = [], updated = [], removed = [] }) => {
    for (const clientId of added) {
      console.log('[P2P] Peer connected', { projectId, clientId })
      lastPeerSeenAt.set(projectId, Date.now())
      // New peer appeared: reset any errored assets and re-reconcile.
      // This handles the "after reconnect/network restoration" trigger point.
      resetErroredAssets(projectId).catch((err) =>
        console.warn('[P2P] resetErroredAssets error on peer connect:', err?.message)
      );
      scheduleAssetReconcile(projectId);
    }
    for (const clientId of updated) {
      // heartbeat — no log
      lastPeerSeenAt.set(projectId, Date.now())
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

  const rtcConfig = isForceTurnOnly()
    ? { iceServers: getTurnOnlyIceServers(), iceTransportPolicy: 'relay' }
    : {};

  console.log('[P2P] calling joinRoom', { projectId, roomId, appId, hasPassword: !!password, relayCount: Object.keys(getRelaySockets()).length, forceTurn: isForceTurnOnly() })
  const trysteroRoom = joinRoom({
    appId,
    password,
    rtcPolyfill: RTCPeerConnection,
    ...getRelayConfig(),
    ...getTurnConfig(),
    ...(Object.keys(rtcConfig).length > 0 ? { rtcConfig } : {}),
  }, roomId)
  console.log('[P2P] joinRoom returned', { projectId, hasRoom: !!trysteroRoom, hasLeave: typeof trysteroRoom?.leave === 'function' })

  logRelayState(projectId, 'room-created', {
    roomId,
    appId,
    hasPassword: !!password
  })

  trysteroRoom.onPeerJoin((peerId) => {
    console.log('[P2P] room peer joined', { projectId, peerId })
    logRelayState(projectId, 'peer-join', { peerId })
  })
  trysteroRoom.onPeerLeave((peerId) => {
    console.log('[P2P] room peer left', { projectId, peerId })
    logRelayState(projectId, 'peer-leave', { peerId })
  })

  // Initialize provider with canonical doc (no explicit connect)
  const provider = new TrysteroProvider(roomId, doc, {
    appId,        // Required: Your Trystero app ID
    awareness,    // Awareness protocol
    trysteroRoom  // Use pre-configured room (server-side)
  })

  const entry = {
    provider,
    awareness,
    onChange,
    onDocUpdatePersist: null,
    baselineDoc,
    trysteroRoom,
    localUsername: globalProfile?.username,
    presenceHeartbeat: null,
  }

  // Re-announce local awareness after the provider has attached its listeners.
  // This avoids losing presence on reconnect paths where the initial pre-provider
  // state assignment is never propagated to already-online peers.
  reannounceLocalPresence(projectId, entry)

  provider.on('status', ({ connected }) => {
    console.log('[P2P] provider status', { projectId, connected })
    logRelayState(projectId, 'provider-status', { connected })
    if (connected) {
      reannounceLocalPresence(projectId, entry)
    }
  })
  provider.on('synced', ({ synced }) => {
    console.log('[P2P] provider synced', { projectId, synced })
  })
  provider.on('peers', ({ added = [], removed = [], trysteroPeers = [], bcPeers = [] }) => {
    if (added.length === 0 && removed.length === 0) return
    console.log('[P2P] provider peers', {
      projectId,
      added,
      removed,
      trysteroCount: trysteroPeers.length,
      bcCount: bcPeers.length
    })
  })
  provider.on('destroy', () => {
    console.log('[P2P] provider destroyed', { projectId })
  })

  // Strict sequential queue to prevent concurrent baselineDoc diffing races
  let updateQueue = Promise.resolve()

  // Persist non-ingestion updates to SQLite via remote ingestion pipeline
  const onDocUpdatePersist = (update, origin) => {
    updateQueue = updateQueue.then(async () => {
      try {
        // Ignore updates originating from DB tailer projections or local hydration/replay
        if (origin === 'ingestion' || origin === 'hydration' || origin === 'replay') {
        syncBaselineFromCanonical(projectId, baselineDoc, doc)
        return
      }
      const beforeBase = countDocTables(baselineDoc)
      const beforeCanon = countDocTables(doc)
      // Persist using baseline BEFORE snapshot to avoid zero-diff after local integration
      const res = await ingestRemoteUpdate(projectId, update, { beforeDoc: baselineDoc })
      if (res?.applied || res?.inserts || res?.updates || res?.deletes) {
        //console.log('[P2P] Persisted Yjs update to SQLite', { projectId, origin, bytes: update?.length || 0, ...res })
        // Advance baseline to reflect the newly persisted update.

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
    }).catch(err => {
      console.error('[P2P] Update queue failed', err)
    })
  }
  doc.on('update', onDocUpdatePersist)
  entry.onDocUpdatePersist = onDocUpdatePersist

  entry.presenceHeartbeat = setInterval(() => {
    reannounceLocalPresence(projectId, entry)
  }, LOCAL_PRESENCE_HEARTBEAT_MS)

  providers.set(projectId, entry)
  console.log('[P2P] provider registered', { projectId, clientId: doc.clientID, providerCount: providers.size })
  startHealthCheck(projectId)
  emitProjectPresence(projectId)
  return provider
}


/**
 * Stop the Trystero-backed Yjs provider for a project.
 * @memberof backend.services.p2pService
 * @param {string} projectId - Project identifier.
 * @returns {Promise<void>}
 */
export async function stopP2PForProject(projectId) {
  stopHealthCheck(projectId)
  const entry = providers.get(projectId)
  console.log('[P2P] stopP2PForProject ENTRY', { projectId, hasEntry: !!entry, providerCount: providers.size })
  if (!entry) {
    console.log('[P2P] stop skipped: no entry', { projectId })
    return
  }
  try {
    try {
      entry.awareness?.off('change', entry.onChange)
    } catch (err) { console.warn('[P2P] Failed to remove awareness listener', err) }
    try {
      if (entry.presenceHeartbeat) clearInterval(entry.presenceHeartbeat)
    } catch (err) { console.warn('[P2P] Failed to clear presence heartbeat', err) }
    try { getProjectDoc(projectId)?.off('update', entry.onDocUpdatePersist) } catch (err) { console.warn('[P2P] Failed to remove canonical doc persistence handler', err) }

    const provider = entry.provider
    console.log('[P2P] destroying provider', { projectId, hasDestroy: typeof provider.destroy === 'function', hasDisconnect: typeof provider.disconnect === 'function' })
    if (typeof provider.destroy === 'function') await provider.destroy()
    else if (typeof provider.disconnect === 'function') await provider.disconnect()
    console.log('[P2P] provider destroyed', { projectId })

    try {
      if (entry.trysteroRoom && typeof entry.trysteroRoom.leave === 'function') {
        console.log('[P2P] leaving trystero room', { projectId })
        entry.trysteroRoom.leave()
        console.log('[P2P] trystero room left', { projectId })
      }
    } catch (err) { console.warn('[P2P] Failed to leave trystero room', err) }

    // Close relay sockets if no other rooms are active.
    // Trystero auto-reconnects on close via the socket's onclose handler,
    // so we override it before closing to prevent orphaned reconnects.
    console.log('[P2P] checking socket cleanup', { projectId, providerCountBeforeDelete: providers.size })
    if (providers.size <= 1) {
      try {
        const sockets = getRelaySockets()
        const socketStates = Object.entries(sockets).map(([url, s]) => ({ url, readyState: s?.readyState }))
        console.log('[P2P] closing relay sockets', { projectId, socketStates })
        for (const socket of Object.values(sockets)) {
          if (socket?.readyState <= 1) {
            console.log('[P2P] overriding onclose and closing socket', { projectId, readyState: socket.readyState })
            socket.onclose = () => {}
            socket.close()
          }
        }
        console.log('[P2P] relay sockets closed', { projectId })
      } catch (err) { console.warn('[P2P] Failed to close relay sockets', err) }
    }

    try {
      if (typeof entry.awareness?.destroy === 'function') {
        entry.awareness.destroy()
      }
    } catch (err) { console.warn('[P2P] Failed to destroy awareness', err) }

    // Baseline doc is local-only; rely on GC
  } catch (err) {
    console.error('[P2P] stopP2PForProject error', err)
  }
  providers.delete(projectId)
  console.log('[P2P] stopP2PForProject EXIT', { projectId, providerCountAfterDelete: providers.size })
  emitProjectPresence(projectId)
}


/**
 * Get the current P2P provider for a project.
 * @memberof backend.services.p2pService
 * @param {string} projectId - Project identifier.
 * @returns {Object|null}
 */
export function getP2PProvider(projectId) {
  return providers.get(projectId)?.provider || null
}

/**
 * Check whether any P2P provider is currently active.
 * @memberof backend.services.p2pService
 * @returns {boolean}
 */
export function hasAnyP2PProvider() {
  return providers.size > 0
}

/**
 * Get the current peer count for a project.
 * @memberof backend.services.p2pService
 * @param {string} projectId - Project identifier.
 * @returns {number}
 */
export function getProjectPeersCount(projectId) {
  return getProjectPresence(projectId).count
}

/**
 * Get the current presence payload for a project.
 * @memberof backend.services.p2pService
 * @param {string} projectId - Project identifier.
 * @returns {Object}
 */
export function getProjectPresence(projectId) {
  const peers = listRemotePeers(projectId)
  return {
    peers,
    count: peers.length
  }
}

/**
 * Refresh the presence state for every active project.
 * @memberof backend.services.p2pService
 * @returns {Promise<void>}
 */
export async function refreshAllProjectPresence() {
  const globalProfile = await getGlobalProfile()

  for (const [projectId, entry] of providers.entries()) {
    entry.localUsername = globalProfile?.username
    reannounceLocalPresence(projectId, entry)
    emitProjectPresence(projectId)
  }
}
