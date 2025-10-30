import { TrysteroProvider } from '@winstonfassett/y-webrtc-trystero'
import { joinRoom } from 'trystero'
import { RTCPeerConnection } from 'node-datachannel/polyfill'
import WebSocket from 'ws'
import * as awarenessProtocol from 'y-protocols/awareness.js'
import { getProjectDoc } from './projectCache.js'

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

  const doc = getProjectDoc(projectId)
  const roomId = `project-${projectId}`
  const appId = process.env.TRYSTERO_APP_ID || 'db-conn-tool'
  const awareness = new awarenessProtocol.Awareness(doc)

  // Log peer connect/disconnect via awareness updates
  const onUpdate = ({ added = [], removed = [] }) => {
    for (const clientId of added) {
      console.log('[P2P] Peer connected', { projectId, clientId })
    }
    for (const clientId of removed) {
      console.log('[P2P] Peer disconnected', { projectId, clientId })
    }
  }
  awareness.on('update', onUpdate)
  // Join a Trystero room server-side with rtcPolyfill
  const trysteroRoom = joinRoom({ appId, rtcPolyfill: RTCPeerConnection }, roomId)

  // Initialize provider with existing Trystero room (no explicit connect)
  const provider = new TrysteroProvider(roomId, doc, {
    appId,        // Required: Your Trystero app ID
    //password: ROOM_PASSWORD, // Optional: password for room access
    maxConns: 30,           // Optional: maximum peer connections
    awareness // Optional: awareness protocol
  })

  providers.set(projectId, { provider, awareness, onUpdate })
  return provider
}

/**
 * Stop and remove the provider for the given project.
 */
export async function stopP2PForProject(projectId) {
  const entry = providers.get(projectId)
  if (!entry) return
  try {
    // Remove awareness listener
    try { entry.awareness?.off('update', entry.onUpdate) } catch (_) { }

    const provider = entry.provider
    if (typeof provider.destroy === 'function') await provider.destroy()
    else if (typeof provider.disconnect === 'function') await provider.disconnect()
  } catch (_) { }
  providers.delete(projectId)
}

/**
 * Get the provider instance for a project.
 */
export function getP2PProvider(projectId) {
  return providers.get(projectId)?.provider || null
}