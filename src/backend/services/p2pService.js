import { TrysteroProvider } from '@winstonfassett/y-webrtc-trystero'
import { joinRoom } from 'trystero'
import { RTCPeerConnection } from 'node-datachannel/polyfill'
import WebSocket from 'ws'
import * as awarenessProtocol from 'y-protocols/awareness.js'
import * as Y from 'yjs'
import { getProjectDoc } from './projectCache.js'
import { ingestRemoteUpdate } from '../handlers/remoteIngestionHandler.js'

// Minimal P2P provider registry keyed by projectId
// Stores { provider, awareness, onUpdate }
const providers = new Map()

// Ensure Node/Electron main has WebRTC & WebSocket globals
if (typeof globalThis.RTCPeerConnection === 'undefined') {
  globalThis.RTCPeerConnection = RTCPeerConnection
}
if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = WebSocket
}

/**
 * Start a Trystero-backed Yjs provider for the given project.
 * Uses the shared Y.Doc from projectCache.
 */
export async function startP2PForProject(projectId) {
  if (!projectId) return null
  if (providers.has(projectId)) return providers.get(projectId).provider

  // Canonical local projection (driven by DB ingestion)
  const doc = getProjectDoc(projectId)
  const roomId = `project-${projectId}`
  const appId = process.env.TRYSTERO_APP_ID || 'db-conn-tool'
  // Transport-only doc for provider; prevents mutating canonical before DB commit
  const transportDoc = new Y.Doc()
  const awareness = new awarenessProtocol.Awareness(transportDoc)

  // Set initial local presence and enable 5s heartbeat for debug visibility
  awareness.setLocalState({
    clientId: transportDoc.clientID,
    projectId,
    role: 'backend-main',
    heartbeat: Date.now()
  })

  // Log peer connect/disconnect via awareness change events
  const onChange = ({ added = [], updated = [], removed = [] }) => {
    for (const clientId of added) {
      console.log('[P2P] Peer connected', { projectId, clientId })
    }
    for (const clientId of updated) {
      console.log('[P2P] Peer updated', { projectId, clientId })
    }
    for (const clientId of removed) {
      console.log('[P2P] Peer disconnected', { projectId, clientId })
    }
  }
  awareness.on('change', onChange)

  // Join a Trystero room server-side with rtcPolyfill
  const trysteroRoom = joinRoom({ appId, rtcPolyfill: RTCPeerConnection }, roomId)

  // Initialize provider with transport doc (no explicit connect)
  const provider = new TrysteroProvider(roomId, transportDoc, {
    appId,        // Required: Your Trystero app ID
    awareness,    // Awareness protocol
    trysteroRoom  // Use pre-configured room (server-side)
  })

  // Seed transport doc from current canonical state so peers can catch up
  try {
    const snap = Y.encodeStateAsUpdate(doc)
    if (snap && snap.length) {
      Y.applyUpdate(transportDoc, snap)
    }
  } catch (err) {
    console.warn('[P2P] Failed to seed transport doc from canonical snapshot', err)
  }

  // Bridge inbound remote updates → SQLite-first commit
  const remoteUpdateHandler = async (update, origin) => {
    // Ignore updates originating from our local bridge
    if (origin === 'local-bridge') return
    try {
      await ingestRemoteUpdate(projectId, update)
    } catch (err) {
      console.error('[P2P] Remote ingestion failed', err)
    }
  }
  transportDoc.on('update', remoteUpdateHandler)

  // Bridge local canonical projection (from DB ingestion) → broadcast to peers
  const localUpdateHandler = (update, origin) => {
    // Only echo ingestion-origin updates to transport for broadcast
    if (origin === 'ingestion') {
      try {
        transportDoc.transact(() => { Y.applyUpdate(transportDoc, update) }, 'local-bridge')
      } catch (err) {
        console.warn('[P2P] Failed to bridge local ingestion update to transport', err)
      }
    }
  }
  doc.on('update', localUpdateHandler)

  providers.set(projectId, { provider, awareness, onChange, transportDoc, remoteUpdateHandler, localUpdateHandler })
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
    try { entry.transportDoc?.off('update', entry.remoteUpdateHandler) } catch (err) { console.warn('[P2P] Failed to remove transportDoc update handler', err) }
    try { getProjectDoc(projectId)?.off('update', entry.localUpdateHandler) } catch (err) { console.warn('[P2P] Failed to remove canonical doc update handler', err) }

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