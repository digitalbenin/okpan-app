import { TrysteroProvider } from '@winstonfassett/y-webrtc-trystero'
import { RTCPeerConnection } from 'node-datachannel/polyfill'
import WebSocket from 'ws'
import { Awareness } from 'y-protocols/awareness'
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
  const awareness = new Awareness(doc)

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

  // Pass rtcPolyfill for server-side usage; provider will use Trystero under the hood
  const provider = new TrysteroProvider(roomId, doc, {
    appId,
    awareness,
    trysteroConfig: { rtcPolyfill: RTCPeerConnection }
  })

  // Connect if the provider exposes a connect() method
  if (typeof provider.connect === 'function') {
    try { await provider.connect() } catch (e) { console.log(e) }
  }

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
    try { entry.awareness?.off('update', entry.onUpdate) } catch (_) {}

    const provider = entry.provider
    if (typeof provider.destroy === 'function') await provider.destroy()
    else if (typeof provider.disconnect === 'function') await provider.disconnect()
  } catch (_) {}
  providers.delete(projectId)
}

/**
 * Get the provider instance for a project.
 */
export function getP2PProvider(projectId) {
  return providers.get(projectId)?.provider || null
}