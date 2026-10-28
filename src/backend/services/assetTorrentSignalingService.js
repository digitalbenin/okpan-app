/**
 * Project-scoped Trystero signaling for tracker-free asset torrent peer
 * discovery and WebRTC handshake routing.
 *
 * @namespace backend.services.assetTorrentSignalingService
 * @memberof backend.services
 */
import crypto from 'crypto';
import { joinRoom } from 'trystero';
import { RTCPeerConnection } from 'node-datachannel/polyfill';
import SimplePeer from '@thaunknown/simple-peer';
import { getTurnOnlyIceServers, isForceTurnOnly } from '../utils/trysteroConfig.js';
import { resolveProjectConnection } from './projectSignalingService.js';

function getWebRTCConfig(turn = {}) {
  const stunServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ];
  const turnServers = turn.turnConfig || [];

  return isForceTurnOnly()
    ? {
        iceServers: turnServers.length > 0 ? turnServers : getTurnOnlyIceServers(),
        iceTransportPolicy: 'relay',
      }
    : {
        iceServers: [...stunServers, ...turnServers],
      };
}

const signalingActions = new Map();
const pendingPeerSignals = new Map();

function normalizeAttemptId(attemptId) {
  return typeof attemptId === 'string' && attemptId.length > 0 ? attemptId : null;
}

function getPendingPeerSignalKey(projectId, infoHash, attemptId) {
  return `${projectId}:${infoHash}:${attemptId}`;
}

function getSeederPeerKey(infoHash, requesterId, attemptId) {
  return `${infoHash}:${requesterId}:${attemptId}`;
}

function destroyPeer(peer) {
  try { peer?.destroy(); } catch (_) {}
}

function removePendingPeerSignalEntry(key, { destroy = true } = {}) {
  const entry = pendingPeerSignals.get(key);
  if (!entry) return null;
  if (destroy) destroyPeer(entry.peer);
  pendingPeerSignals.delete(key);
  return entry;
}

function clearPendingPeerSignalsForAsset(projectId, infoHash, keepAttemptId = null) {
  for (const [key, entry] of pendingPeerSignals) {
    if (entry?.projectId !== projectId || entry?.infoHash !== infoHash) continue;
    if (keepAttemptId && entry.attemptId === keepAttemptId) continue;
    removePendingPeerSignalEntry(key);
  }
}

function findPendingPeerSignalEntry(projectId, infoHash, attemptId = null, senderId = null) {
  const normalizedAttemptId = normalizeAttemptId(attemptId);
  if (normalizedAttemptId) {
    return pendingPeerSignals.get(getPendingPeerSignalKey(projectId, infoHash, normalizedAttemptId)) || null;
  }

  let latestEntry = null;
  for (const entry of pendingPeerSignals.values()) {
    if (entry?.projectId !== projectId || entry?.infoHash !== infoHash) continue;
    if (senderId && entry.seederId && entry.seederId !== senderId) continue;
    if (!latestEntry || (entry.createdAt ?? 0) > (latestEntry.createdAt ?? 0)) {
      latestEntry = entry;
    }
  }

  return latestEntry;
}

function clearSeederPeersForRequest(seederPeers, infoHash, requesterId, keepAttemptId = null) {
  for (const [key, entry] of seederPeers) {
    if (entry?.infoHash !== infoHash || entry?.requesterId !== requesterId) continue;
    if (keepAttemptId && entry.attemptId === keepAttemptId) continue;
    destroyPeer(entry.peer);
    seederPeers.delete(key);
  }
}

function findSeederPeerEntry(seederPeers, infoHash, requesterId, attemptId = null) {
  const normalizedAttemptId = normalizeAttemptId(attemptId);
  if (normalizedAttemptId) {
    return seederPeers.get(getSeederPeerKey(infoHash, requesterId, normalizedAttemptId)) || null;
  }

  let latestEntry = null;
  for (const entry of seederPeers.values()) {
    if (entry?.infoHash !== infoHash || entry?.requesterId !== requesterId) continue;
    if (!latestEntry || (entry.createdAt ?? 0) > (latestEntry.createdAt ?? 0)) {
      latestEntry = entry;
    }
  }

  return latestEntry;
}

function clearProjectPendingSignals(projectId) {
  for (const [key, entry] of pendingPeerSignals) {
    if (entry?.projectId !== projectId) continue;
    removePendingPeerSignalEntry(key);
  }
}

/**
 * Get the current signaling state for a project.
 * @memberof backend.services.assetTorrentSignalingService
 * @param {string} projectId - Project identifier.
 * @returns {Object|null}
 */
export function getProjectAssetSignaling(projectId) {
  return signalingActions.get(projectId) || null;
}

/**
 * Remove the pending peer signaling entry for an asset.
 * @memberof backend.services.assetTorrentSignalingService
 * @param {string} projectId - Project identifier.
 * @param {string} infoHash - Torrent info hash.
 * @param {string|null} [attemptId=null] - Optional attempt identifier.
 * @param {Object} [options={}] - Cleanup options.
 * @param {boolean} [options.destroy=true] - Whether to destroy the WebTorrent-owned peer.
 * @returns {void}
 */
export function cleanupAssetSignalingPeer(projectId, infoHash, attemptId = null, { destroy = true } = {}) {
  const normalizedAttemptId = normalizeAttemptId(attemptId);
  if (normalizedAttemptId) {
    const key = getPendingPeerSignalKey(projectId, infoHash, normalizedAttemptId);
    if (destroy) removePendingPeerSignalEntry(key);
    else pendingPeerSignals.delete(key);
    return;
  }

  if (destroy) clearPendingPeerSignalsForAsset(projectId, infoHash);
  else {
    for (const [key, entry] of pendingPeerSignals) {
      if (entry?.projectId === projectId && entry?.infoHash === infoHash) pendingPeerSignals.delete(key);
    }
  }
}

/**
 * Create the downloader-side peer used for asset torrent signaling.
 * @memberof backend.services.assetTorrentSignalingService
 * @param {Object} options - Peer creation options.
 * @param {string} options.projectId - Project identifier.
 * @param {string} options.infoHash - Torrent info hash.
 * @param {Object} options.torrent - WebTorrent torrent instance.
 * @returns {boolean}
 */
export function createDownloaderSignalPeer({ projectId, infoHash, torrent }) {
  const sig = signalingActions.get(projectId);
  if (!sig || !torrent) return false;

  const attemptId = crypto.randomUUID();

  let sigPeer;
  try { sigPeer = new SimplePeer({ initiator: false, trickle: true, config: getWebRTCConfig(sig.turn) }); }
  catch (err) {
    console.warn(`[AssetTorrent] downloader SimplePeer failed ${infoHash}:`, err?.message);
    return false;
  }

  sigPeer.id = `dl-${infoHash}-${attemptId}`;

  clearPendingPeerSignalsForAsset(projectId, infoHash);

  const key = getPendingPeerSignalKey(projectId, infoHash, attemptId);
  const entry = {
    key,
    projectId,
    infoHash,
    attemptId,
    peer: sigPeer,
    seederId: null,
    createdAt: Date.now(),
  };

  sigPeer.on('signal', (signal) => {
    const currentEntry = pendingPeerSignals.get(key);
    if (currentEntry?.seederId) {
      sig.sendSignal({ infoHash, attemptId, signal }, [currentEntry.seederId]);
    } else {
      console.warn(`[AssetTorrent] [Signaling] Downloader sigPeer signal fired but seederId not yet set for ${infoHash}`);
    }
  });

  sigPeer.once('connect', () => {
    try {
      torrent.addPeer(sigPeer);
    } catch (err) {
      console.warn('[AssetTorrent] downloader torrent.addPeer failed:', err?.message);
    }
  });

  sigPeer.on('error', (err) => console.warn(`[AssetTorrent] downloader peer error ${infoHash}:`, err?.message));
  sigPeer.on('close', () => {
    const currentEntry = pendingPeerSignals.get(key);
    if (currentEntry?.peer === sigPeer && !torrent.done) {
      console.warn(`[AssetTorrent] [Signaling] Downloader peer closed for ${infoHash}; awaiting a fresh seeder response`);
      currentEntry.seederId = null;
    }
  });

  pendingPeerSignals.set(key, entry);
  sig.sendRequest({ infoHash, attemptId });
  return true;
}

async function resetPendingSeederForPeer(projectId, peerId) {
  if (!projectId || !peerId) return;

  const sig = signalingActions.get(projectId);
  if (!sig) return;

  for (const entry of pendingPeerSignals.values()) {
    if (entry?.projectId !== projectId || entry.seederId !== peerId) continue;

    const torrent = await sig.getTorrent(entry.infoHash);
    if (!torrent || torrent.done) {
      cleanupAssetSignalingPeer(projectId, entry.infoHash, entry.attemptId);
      continue;
    }

    console.warn(`[AssetTorrent] [Signaling] Seeder ${peerId} left during ${entry.infoHash}; rebuilding downloader peer`);
    createDownloaderSignalPeer({ projectId, infoHash: entry.infoHash, torrent });
  }
}

/**
 * Ensure a signaling room exists for the project and attach request/signal handlers.
 * @memberof backend.services.assetTorrentSignalingService
 * @param {string} projectId - Project identifier.
 * @param {Object} [options={}] - Signaling options.
 * @param {Function} options.getTorrent - Lookup function that returns a torrent by info hash.
 * @returns {Promise<Object|null>}
 */
export async function ensureProjectAssetSignaling(projectId, { getTorrent } = {}) {
  if (!projectId || typeof getTorrent !== 'function') return null;

  const existing = signalingActions.get(projectId);
  if (existing) return existing;

  let room;
  let turn = {};
  try {
    const appId = process.env.TRYSTERO_APP_ID || 'db-conn-tool';
    // Same per-project relay/TURN resolution as the sync room, so assets and
    // project data always meet on the same signaling network.
    const connection = await resolveProjectConnection(projectId);
    turn = connection.turn;
    room = joinRoom({
      appId,
      rtcPolyfill: RTCPeerConnection,
      ...connection.relay,
      ...connection.turn,
      ...(isForceTurnOnly() ? { rtcConfig: { iceServers: connection.turn.turnConfig || getTurnOnlyIceServers(), iceTransportPolicy: 'relay' } } : {}),
    }, `project-assets-${projectId}`);
  } catch (err) {
    console.error('[AssetTorrent] signaling room creation failed:', err?.message);
    return null;
  }

  const [sendRequest, receiveRequest] = room.makeAction('peerRequest');
  const [sendSignal, receiveSignal] = room.makeAction('peerSignal');

  const state = { room, sendRequest, sendSignal, seederPeers: new Map(), getTorrent, turn };
  signalingActions.set(projectId, state);

  room.onPeerJoin((peerId) => {
    for (const entry of pendingPeerSignals.values()) {
      if (entry?.projectId !== projectId || entry.seederId || !entry.infoHash) continue;
      sendRequest({ infoHash: entry.infoHash, attemptId: entry.attemptId }, [peerId]);
    }
  });

  room.onPeerLeave((peerId) => {
    resetPendingSeederForPeer(projectId, peerId).catch((err) => {
      console.warn('[AssetTorrent] failed to reset pending seeder on leave:', err?.message);
    });
  });

  receiveRequest(async ({ infoHash, attemptId }, requesterId) => {
    const torrent = await getTorrent(infoHash);
    if (!torrent) return;

    const normalizedAttemptId = normalizeAttemptId(attemptId) || `legacy-${requesterId}`;

    let peer;
    try { peer = new SimplePeer({ initiator: true, trickle: true, config: getWebRTCConfig(state.turn) }); }
    catch (err) {
      console.error('[AssetTorrent] seeder SimplePeer failed:', err?.message);
      return;
    }

    peer.id = `seed-${infoHash}-${normalizedAttemptId}`;

    const key = getSeederPeerKey(infoHash, requesterId, normalizedAttemptId);
    clearSeederPeersForRequest(state.seederPeers, infoHash, requesterId, normalizedAttemptId);
    state.seederPeers.set(key, {
      key,
      infoHash,
      requesterId,
      attemptId: normalizedAttemptId,
      createdAt: Date.now(),
      peer,
    });

    peer.on('signal', (signal) => sendSignal({ infoHash, attemptId: normalizedAttemptId, signal }, [requesterId]));
    peer.on('error', (err) => {
      console.warn(`[AssetTorrent] seeder peer error ${infoHash}:`, err?.message);
      state.seederPeers.delete(key);
    });
    peer.on('close', () => state.seederPeers.delete(key));

    try {
      torrent.addPeer(peer);
    } catch (err) {
      console.warn('[AssetTorrent] seeder torrent.addPeer failed:', err?.message);
      peer.destroy();
      state.seederPeers.delete(key);
    }
  });

  receiveSignal(({ infoHash, attemptId, signal }, senderId) => {
    const seederEntry = findSeederPeerEntry(state.seederPeers, infoHash, senderId, attemptId);
    if (seederEntry?.peer) {
      const corrected = (signal?.type === 'offer' && signal.sdp)
        ? { ...signal, type: 'answer', sdp: signal.sdp.replace(/a=setup:actpass/g, 'a=setup:active') }
        : signal;

      try { seederEntry.peer.signal(corrected); }
      catch (err) { console.warn(`[AssetTorrent] seeder peer.signal error ${infoHash}:`, err?.message); }
      return;
    }

    const entry = findPendingPeerSignalEntry(projectId, infoHash, attemptId, senderId);
    if (!entry) return;
    if (!entry.seederId) {
      entry.seederId = senderId;
    } else if (entry.seederId !== senderId) {
      return;
    }

    try { entry.peer.signal(signal); }
    catch (err) { console.warn(`[AssetTorrent] peer.signal error ${infoHash}:`, err?.message); }
  });

  return state;
}

/**
 * Stop and clear project-specific signaling state.
 * @memberof backend.services.assetTorrentSignalingService
 * @param {string} projectId - Project identifier.
 * @returns {void}
 */
export function stopProjectAssetSignaling(projectId) {
  if (!projectId) return;

  const sig = signalingActions.get(projectId);
  if (sig) {
    for (const entry of sig.seederPeers.values()) destroyPeer(entry?.peer);
    try { sig.room?.leave?.(); } catch (err) { console.warn('[AssetTorrent] signaling room leave failed:', err?.message); }
    signalingActions.delete(projectId);
  }

  clearProjectPendingSignals(projectId);
}

/**
 * Destroy all signaling rooms and clear pending peer state.
 * @memberof backend.services.assetTorrentSignalingService
 * @returns {void}
 */
export function destroyAssetSignaling() {
  for (const projectId of [...signalingActions.keys()]) {
    stopProjectAssetSignaling(projectId);
  }

  for (const entry of pendingPeerSignals.values()) destroyPeer(entry?.peer);
  pendingPeerSignals.clear();
  signalingActions.clear();
}