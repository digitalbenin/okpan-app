// Manages WebTorrent seeding/downloading for asset P2P sync.
// Local-state tables (asset_local_state / generic_asset_local_state) are never
// Yjs-synced, preventing write-back loops. Torrent metadata on assets/generic_assets
// is written once by the seeder and is immutable after that.

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';
import { joinRoom } from 'trystero';
import { RTCPeerConnection } from 'node-datachannel/polyfill';
import SimplePeer from '@thaunknown/simple-peer';
import { db } from '../../db/init.js';
import { assets, genericAssets, asset_local_state, generic_asset_local_state } from '../../db/schema.js';
import { eq, and, isNotNull, inArray, sql } from 'drizzle-orm';

const ASSET_BASE_PATH = './src/assets/project_assets';
const MAX_CONCURRENT_DOWNLOADS_PER_PROJECT = 3;
const MAX_RETRIES = 5;
const DOWNLOAD_TIMEOUT_MS = 60 * 1000;
const RECONCILE_INTERVAL_MS = 90_000;
const RECONCILE_DEBOUNCE_MS = 600;
const BACKOFF_SEQUENCE_MS = [5_000, 15_000, 30_000, 60_000, 120_000];

const WEBRTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ],
};

let _WebTorrentModule = null;
let _wtClient = null;
let _webContents = null;

const activeDownloads   = new Map(); // projectId â†’ Set<assetId>
const downloadQueues    = new Map(); // projectId â†’ DownloadJob[]
const reconcileIntervals= new Map(); // projectId â†’ Timeout
const reconcileDebounce = new Map(); // projectId â†’ Timeout
const reconcileRunning  = new Set();
const seededHashes      = new Set();
const projectSeededHashes = new Map(); // projectId â†’ Set<infoHash>
const signalingActions  = new Map(); // projectId â†’ { room, sendRequest, sendSignal, seederPeers }
const pendingPeerSignals= new Map(); // `${projectId}:${infoHash}` â†’ { projectId, peer, seederId }


async function getWtClient() {
  if (!_WebTorrentModule) {
    const m = await import('webtorrent');
    _WebTorrentModule = m.default || m;
  }
  if (!_wtClient || _wtClient.destroyed) {
    _wtClient = new _WebTorrentModule({ maxConns: 30, dht: false, lsd: false, tracker: false });
    _wtClient.on('error', (err) => console.error('[AssetTorrent] client error:', err?.message));
  }
  return _wtClient;
}

function getOrSet(map, key, factory) {
  if (!map.has(key)) map.set(key, factory());
  return map.get(key);
}

function getPendingPeerSignalKey(projectId, infoHash) {
  return `${projectId}:${infoHash}`;
}

function recordSeededHash(projectId, infoHash) {
  if (!projectId || !infoHash) return;
  seededHashes.add(infoHash);
  getOrSet(projectSeededHashes, projectId, () => new Set()).add(infoHash);
}

function clearProjectPendingSignals(projectId) {
  for (const [key, entry] of pendingPeerSignals) {
    if (entry?.projectId !== projectId) continue;
    try { entry.peer?.destroy(); } catch (_) {}
    pendingPeerSignals.delete(key);
  }
}

function clearProjectSeededHashes(projectId) {
  const hashes = projectSeededHashes.get(projectId);
  if (!hashes) return;
  for (const infoHash of hashes) seededHashes.delete(infoHash);
  projectSeededHashes.delete(projectId);
}

function sanitizeName(name) {
  if (!name || typeof name !== 'string') return 'asset.bin';
  return path.basename(name).replace(/[^\w.\-]/g, '_') || 'asset.bin';
}

function classifyError(err) {
  const msg = String(err?.message || err || '').toLowerCase();
  if (/no peers|could not find|swarm/i.test(msg)) return 'NO_PEERS';
  if (/timeout/i.test(msg)) return 'TIMEOUT';
  if (/hash|integrity|piece/i.test(msg)) return 'HASH_MISMATCH';
  if (/permission|eacces|eperm/i.test(msg)) return 'PERMISSION';
  if (/disk|enospc|no space/i.test(msg)) return 'DISK_WRITE';
  return 'UNKNOWN';
}

async function computeSha256(filePath) {
  return new Promise((resolve) => {
    try {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      stream.on('data', (c) => hash.update(c));
      stream.on('end',  () => resolve(hash.digest('hex')));
      stream.on('error', () => resolve(null));
    } catch { resolve(null); }
  });
}


export function setMainWindowContents(webContents) {
  _webContents = webContents;
}

function emitSyncProgress(assetId, isGeneric, status, progress = 0, error = null) {
  if (!_webContents || _webContents.isDestroyed()) return;
  try { _webContents.send('asset-sync-progress', { assetId, isGeneric, status, progress, error }); }
  catch (err) { console.warn('[AssetTorrent] IPC send failed:', err?.message); }
}


async function upsertLocalState(assetId, isGeneric, fields) {
  const table = isGeneric ? generic_asset_local_state : asset_local_state;
  const pkCol = isGeneric ? table.generic_asset_id : table.asset_id;
  const pkKey = isGeneric ? 'generic_asset_id' : 'asset_id';
  try {
    await db.insert(table).values({ [pkKey]: assetId, ...fields })
      .onConflictDoUpdate({ target: pkCol, set: fields }).execute();
  } catch (err) {
    console.error(`[AssetTorrent] upsertLocalState failed for ${assetId}:`, err?.message);
  }
}

async function getLocalState(assetId, isGeneric) {
  const table = isGeneric ? generic_asset_local_state : asset_local_state;
  const pkCol = isGeneric ? table.generic_asset_id : table.asset_id;
  try {
    const rows = await db.select().from(table).where(eq(pkCol, assetId)).limit(1).execute();
    return rows[0] || null;
  } catch (err) {
    console.warn(`[AssetTorrent] getLocalState failed for ${assetId}:`, err?.message);
    return null;
  }
}

// Joins a dedicated room per project (`project-assets-{projectId}`) and sets up
// two actions: peerRequest (downloader â†’ all) and peerSignal (SDP/ICE relay).
// Seeder: responds to peerRequest by creating an initiator SimplePeer and
// injecting it into the live torrent via torrent.addPeer().
// Downloader: creates a non-initiator SimplePeer, registers it in
// pendingPeerSignals, and broadcasts a peerRequest.

async function setupSignalingForProject(projectId) {
  if (signalingActions.has(projectId)) return;

  let room;
  try {
    const appId = process.env.TRYSTERO_APP_ID || 'db-conn-tool';
    room = joinRoom({ appId, rtcPolyfill: RTCPeerConnection }, `project-assets-${projectId}`);
  } catch (err) {
    console.error('[AssetTorrent] signaling room creation failed:', err?.message);
    return;
  }

  const [sendRequest, receiveRequest] = room.makeAction('peerRequest');
  const [sendSignal,  receiveSignal]  = room.makeAction('peerSignal');

  // seederPeers: `${infoHash}:${requesterId}` → SimplePeer (initiator side)
  // Needed so incoming signals from the downloader can be routed back to the
  // correct initiator peer to complete the WebRTC handshake.
  const seederPeers = new Map();
  signalingActions.set(projectId, { room, sendRequest, sendSignal, seederPeers });

  // When a new peer joins the room, re-broadcast any pending download requests
  // that haven't been answered yet.  This handles the case where the downloader
  // started before the seeder was visible in the Trystero room (the initial
  // broadcast at startup went to nobody; the seeder joined later).
  room.onPeerJoin((peerId) => {
    for (const [key, entry] of pendingPeerSignals) {
      if (entry?.projectId !== projectId || entry.seederId) continue;
      const [, infoHash] = key.split(':', 2);
      if (infoHash) {
        console.log(`[AssetTorrent] [Signaling] New peer ${peerId} – re-sending request for ${infoHash}`);
        sendRequest({ infoHash }, [peerId]);
      }
    }
  });

  room.onPeerLeave((peerId) => {
    resetPendingSeederForPeer(projectId, peerId).catch((err) => {
      console.warn('[AssetTorrent] failed to reset pending seeder on leave:', err?.message);
    });
  });

  receiveRequest(async ({ infoHash }, requesterId) => {
    const client  = await getWtClient();
    const torrent = await client.get(infoHash);
    if (!torrent) return;

    let peer;
    try { peer = new SimplePeer({ initiator: true, trickle: true, config: WEBRTC_CONFIG }); }
    catch (err) { console.error('[AssetTorrent] seeder SimplePeer failed:', err?.message); return; }

    const key = `${infoHash}:${requesterId}`;
    // Destroy any stale peer for this key before replacing — prevents old
    // signal listeners from flooding the downloader with duplicate offers.
    const stalePeer = seederPeers.get(key);
    if (stalePeer) { try { stalePeer.destroy(); } catch (_) {} seederPeers.delete(key); }
    seederPeers.set(key, peer);
    peer.on('signal', (signal) => sendSignal({ infoHash, signal }, [requesterId]));
    peer.on('connect', () => console.log(`[AssetTorrent] [Signaling] Seeder WebRTC connected ${infoHash}`));
    peer.on('error',  (err)    => { console.warn(`[AssetTorrent] seeder peer error ${infoHash}:`, err?.message); seederPeers.delete(key); });
    peer.on('close',  ()       => seederPeers.delete(key));
    try {
      torrent.addPeer(peer);
      console.log(`[AssetTorrent] [Signaling] Seeder injected peer for ${infoHash}`);
    } catch (err) {
      console.warn('[AssetTorrent] seeder torrent.addPeer failed:', err?.message);
      peer.destroy();
      seederPeers.delete(key);
    }
  });

  receiveSignal(({ infoHash, signal }, senderId) => {
    // Path A: signal is from a downloader back to the seeder's initiator peer
    const seederPeer = seederPeers.get(`${infoHash}:${senderId}`);
    if (seederPeer) {
      // The node-datachannel WebRTC polyfill has two bugs in the answer SDP it
      // produces for the non-initiator peer:
      //   1. type is incorrectly set to 'offer' instead of 'answer'
      //   2. a=setup:actpass is illegal in an answer (must be active/passive)
      // Both are corrected here before forwarding to the seeder's initiator peer.
      const corrected = (signal?.type === 'offer' && signal.sdp)
        ? { ...signal, type: 'answer', sdp: signal.sdp.replace(/a=setup:actpass/g, 'a=setup:active') }
        : signal;
      console.log(`[AssetTorrent] [Signaling] Seeder received back-signal for ${infoHash} type=${signal?.type || 'candidate'} (corrected=${corrected?.type || 'candidate'})`);
      try { seederPeer.signal(corrected); }
      catch (err) { console.warn(`[AssetTorrent] seeder peer.signal error ${infoHash}:`, err?.message); }
      return;
    }
    // Path B: signal is from the seeder to the downloader's non-initiator peer
    const entry = pendingPeerSignals.get(getPendingPeerSignalKey(projectId, infoHash));
    if (!entry) return;
    if (!entry.seederId) {
      entry.seederId = senderId;
      console.log(`[AssetTorrent] [Signaling] Seeder ${senderId} answered ${infoHash}`);
    } else if (entry.seederId !== senderId) {
      console.log(`[AssetTorrent] [Signaling] Ignoring signal from unexpected seeder ${senderId} for ${infoHash}; locked to ${entry.seederId}`);
      return;
    }
    try { entry.peer.signal(signal); }
    catch (err) { console.warn(`[AssetTorrent] peer.signal error ${infoHash}:`, err?.message); }
  });
}

function cleanupSignalingPeer(projectId, infoHash) {
  const key = getPendingPeerSignalKey(projectId, infoHash);
  const entry = pendingPeerSignals.get(key);
  if (entry) { try { entry.peer.destroy(); } catch (_) {} pendingPeerSignals.delete(key); }
}

function createDownloaderSignalPeer({ projectId, infoHash, torrent, sig }) {
  if (!sig || !torrent) return false;

  let sigPeer;
  try { sigPeer = new SimplePeer({ initiator: false, trickle: true, config: WEBRTC_CONFIG }); }
  catch (err) {
    console.warn(`[AssetTorrent] downloader SimplePeer failed ${infoHash}:`, err?.message);
    return false;
  }

  const key = getPendingPeerSignalKey(projectId, infoHash);
  const staleEntry = pendingPeerSignals.get(key);
  if (staleEntry) {
    try { staleEntry.peer.destroy(); } catch (_) {}
    pendingPeerSignals.delete(key);
  }

  sigPeer.on('signal', (signal) => {
    const entry = pendingPeerSignals.get(key);
    if (entry?.seederId) {
      console.log(`[AssetTorrent] [Signaling] Downloader sending back-signal for ${infoHash} type=${signal?.type || 'candidate'}`);
      sig.sendSignal({ infoHash, signal }, [entry.seederId]);
    } else {
      console.warn(`[AssetTorrent] [Signaling] Downloader sigPeer signal fired but seederId not yet set for ${infoHash}`);
    }
  });

  sigPeer.on('connect', () => {
    console.log(`[AssetTorrent] [Signaling] WebRTC connected, injecting peer for ${infoHash}`);
    try { torrent.addPeer(sigPeer); }
    catch (err) { console.warn('[AssetTorrent] downloader torrent.addPeer failed:', err?.message); }
  });

  sigPeer.on('error', (err) => console.warn(`[AssetTorrent] downloader peer error ${infoHash}:`, err?.message));
  sigPeer.on('close', () => {
    const entry = pendingPeerSignals.get(key);
    if (entry?.peer === sigPeer && !torrent.done) {
      console.warn(`[AssetTorrent] [Signaling] Downloader peer closed for ${infoHash}; awaiting a fresh seeder response`);
      entry.seederId = null;
    }
  });

  pendingPeerSignals.set(key, { projectId, peer: sigPeer, seederId: null });
  console.log(`[AssetTorrent] [Signaling] Broadcasting peerRequest for ${infoHash}`);
  sig.sendRequest({ infoHash });
  return true;
}

async function resetPendingSeederForPeer(projectId, peerId) {
  if (!projectId || !peerId) return;

  const client = await getWtClient();
  const sig = signalingActions.get(projectId);
  if (!sig) return;

  for (const [key, entry] of pendingPeerSignals) {
    if (entry?.projectId !== projectId || entry.seederId !== peerId) continue;

    const [, infoHash] = key.split(':', 2);
    const torrent = await client.get(infoHash);
    if (!torrent || torrent.done) {
      cleanupSignalingPeer(projectId, infoHash);
      continue;
    }

    console.warn(`[AssetTorrent] [Signaling] Seeder ${peerId} left during ${infoHash}; rebuilding downloader peer`);
    createDownloaderSignalPeer({ projectId, infoHash, torrent, sig });
  }
}

function resolveCandidateAssetPaths(projectId, row) {
  const safeName = sanitizeName(row.torrent_name || path.basename(row.path || 'asset.bin'));
  const localPath = path.join(ASSET_BASE_PATH, projectId, safeName);
  const candidates = [row.path, row.formats?.original, localPath]
    .filter((value, index, arr) => typeof value === 'string' && value.length > 0 && arr.indexOf(value) === index);

  return {
    safeName,
    localPath,
    existingPath: candidates.find((candidate) => fs.existsSync(candidate)) || null,
  };
}

async function repairAssetStateTable({ projectId, assetTable, stateTable, isGeneric }) {
  const stateIdCol = isGeneric ? stateTable.generic_asset_id : stateTable.asset_id;
  const assetRows = await db
    .select({
      id: assetTable.id,
      path: assetTable.path,
      formats: assetTable.formats,
      torrent_info_hash: assetTable.torrent_info_hash,
      torrent_name: assetTable.torrent_name,
    })
    .from(assetTable)
    .where(and(eq(assetTable.project_id, projectId), isNotNull(assetTable.torrent_info_hash)))
    .execute();

  if (!assetRows.length) return { repaired: 0 };

  const stateRows = await db.select().from(stateTable).where(inArray(stateIdCol, assetRows.map((row) => row.id))).execute();
  const stateMap = new Map(stateRows.map((state) => [state[isGeneric ? 'generic_asset_id' : 'asset_id'], state]));
  const active = getOrSet(activeDownloads, projectId, () => new Set());
  let repaired = 0;

  for (const row of assetRows) {
    const state = stateMap.get(row.id);
    if (!state) continue;

    const status = state.sync_status ?? null;
    const { existingPath } = resolveCandidateAssetPaths(projectId, row);
    const hasFile = !!existingPath;

    if ((status === 'seeding' || status === 'available') && !hasFile) {
      await upsertLocalState(row.id, isGeneric, { sync_status: 'missing', sync_error: null, download_progress: 0 });
      repaired += 1;
      continue;
    }

    if (status === 'downloading' && !active.has(row.id) && !hasFile) {
      await upsertLocalState(row.id, isGeneric, { sync_status: 'missing', sync_error: null, download_progress: 0 });
      repaired += 1;
    }
  }

  return { repaired };
}

async function repairProjectAssetStates(projectId) {
  if (!projectId) return { repaired: 0 };

  const results = await Promise.all([
    repairAssetStateTable({ projectId, assetTable: assets, stateTable: asset_local_state, isGeneric: false }),
    repairAssetStateTable({ projectId, assetTable: genericAssets, stateTable: generic_asset_local_state, isGeneric: true }),
  ]);

  const repaired = results.reduce((sum, result) => sum + (result?.repaired || 0), 0);
  if (repaired > 0) {
    console.warn(`[AssetTorrent] Repaired ${repaired} stale local asset sync state rows for project ${projectId}`);
    scheduleAssetReconcile(projectId);
  }

  return { repaired };
}


export async function seedAsset({ projectId, assetId, filePath, isGeneric = false, expectedInfoHash = null }) {
  if (!projectId || !assetId || !filePath) return null;
  if (!fs.existsSync(filePath)) {
    console.warn(`[AssetTorrent] seedAsset: file not found: ${filePath}`);
    return null;
  }

  const client  = await getWtClient();
  const name    = sanitizeName(path.basename(filePath));
  const absPath = path.resolve(filePath);

  return new Promise((resolve) => {
    try {
      const existing = (expectedInfoHash && client.torrents.find((torrent) => torrent.infoHash === expectedInfoHash))
        || client.torrents.find((torrent) => torrent.files?.some((file) => path.resolve(file.path) === absPath));
      if (existing) {
        recordSeededHash(projectId, existing.infoHash);
        setupSignalingForProject(projectId).catch(() => {});
        upsertLocalState(assetId, isGeneric, { sync_status: 'seeding', sync_error: null }).catch(() => {});
        emitSyncProgress(assetId, isGeneric, 'seeding', 100);
        resolve({ infoHash: existing.infoHash, name: existing.name, length: existing.length, pieceLength: existing.pieceLength });
        return;
      }

      client.seed(filePath, { name }, (torrent) => {
        console.log(`[AssetTorrent] Seeding: assetId=${assetId} infoHash=${torrent.infoHash}`);
        recordSeededHash(projectId, torrent.infoHash);
        setupSignalingForProject(projectId).catch(() => {});
        upsertLocalState(assetId, isGeneric, { sync_status: 'seeding', sync_error: null, last_success_at: Date.now(), download_progress: 100 }).catch(() => {});
        emitSyncProgress(assetId, isGeneric, 'seeding', 100);
        resolve({ infoHash: torrent.infoHash, name: torrent.name, length: torrent.length, pieceLength: torrent.pieceLength });
      });
    } catch (err) {
      console.error(`[AssetTorrent] seedAsset error for ${assetId}:`, err);
      resolve(null);
    }
  });
}


// After a torrent download: update the asset row's local path and, for AVIF
// images, generate 300-px (sm) and 1400-px (md) variants.  Fully non-blocking.
async function persistDownloadedAsset(assetId, isGeneric, originalPath) {
  const ext   = path.extname(originalPath).toLowerCase();
  const table = isGeneric ? genericAssets : assets;

  if (ext === '.avif') {
    const base   = originalPath.slice(0, -5); // strip ".avif"
    const smPath = `${base}_sm.avif`;
    const mdPath = `${base}_md.avif`;

    if (!fs.existsSync(smPath) || !fs.existsSync(mdPath)) {
      const img = sharp(originalPath);
      await Promise.all([
        img.clone().avif({ quality: 70, effort: 2 }).resize(300).toFile(smPath),
        img.clone().avif({ quality: 70, effort: 2 }).resize(1400).toFile(mdPath),
      ]);
      console.log(`[AssetTorrent] Image variants generated for ${assetId}`);
    }

    await db.update(table).set({
      path: originalPath,
      formats: { original: originalPath, sm: smPath, md: mdPath },
    }).where(eq(table.id, assetId)).execute();
  } else {
    // Video / audio: just update the local path so the frontend can find it.
    await db.update(table).set({ path: originalPath }).where(eq(table.id, assetId)).execute();
  }
}

function resolveDownloadedFilePath(expectedPath, torrent) {
  if (expectedPath && fs.existsSync(expectedPath)) return expectedPath;

  const fallback = torrent?.files?.find((file) => file?.path && fs.existsSync(file.path))?.path;
  return fallback || null;
}

async function downloadAsset({ projectId, assetId, infoHash, torrentName, isGeneric }) {
  const client   = await getWtClient();
  const safeName = sanitizeName(torrentName);
  const destDir  = path.join(ASSET_BASE_PATH, projectId);
  const expected = path.join(destDir, safeName);

  fs.mkdirSync(destDir, { recursive: true });

  if (fs.existsSync(expected)) {
    await upsertLocalState(assetId, isGeneric, { sync_status: 'available', last_success_at: Date.now(), download_progress: 100, sync_error: null });
    emitSyncProgress(assetId, isGeneric, 'available', 100);
    if (!seededHashes.has(infoHash)) seedAsset({ projectId, assetId, filePath: expected, isGeneric, expectedInfoHash: infoHash }).catch(() => {});
    persistDownloadedAsset(assetId, isGeneric, expected).catch(() => {});
    const active = getOrSet(activeDownloads, projectId, () => new Set());
    active.delete(assetId);
    drainQueue(projectId);
    return { success: true, path: expected };
  }

  const active = getOrSet(activeDownloads, projectId, () => new Set());
  console.log(`[AssetTorrent] Download start: assetId=${assetId} infoHash=${infoHash}`);

  await upsertLocalState(assetId, isGeneric, { sync_status: 'downloading', last_attempt_at: Date.now(), download_progress: 0, sync_error: null });
  emitSyncProgress(assetId, isGeneric, 'downloading', 0);

  const magnet = `magnet:?xt=urn:btih:${infoHash}&dn=${encodeURIComponent(safeName)}`;

  return new Promise((resolve) => {
    let settled = false;
    const settle = (r) => { if (settled) return; settled = true; clearTimeout(timer); resolve(r); };

    const timer = setTimeout(async () => {
      active.delete(assetId);
      cleanupSignalingPeer(projectId, infoHash);
      drainQueue(projectId);
      await handleDownloadError({ projectId, assetId, isGeneric, errCode: 'TIMEOUT' });
      settle({ success: false, reason: 'timeout' });
    }, DOWNLOAD_TIMEOUT_MS);

    (async () => {
      try {
        const stale = await client.get(infoHash);
        if (stale) await new Promise((res) => client.remove(infoHash, { destroyStore: false }, res));

        const torrent = client.add(magnet, { path: destDir });
        if (!torrent) throw new Error('client.add returned null');

        // Set up Trystero signaling for tracker-free peer discovery.
        await setupSignalingForProject(projectId);
        const sig = signalingActions.get(projectId);
        if (sig) {
          createDownloaderSignalPeer({ projectId, infoHash, torrent, sig });
        }

        torrent.on('warning', (w) => console.warn(`[AssetTorrent] warning ${assetId}:`, w?.message || w));
        torrent.on('wire',    (w) => console.log(`[AssetTorrent] peer connected ${assetId}: ${w.remoteAddress}`));
        // torrent.on('noPeers', (t) => console.warn(`[AssetTorrent] no peers ${assetId} (${t})`)); // Removed to prevent log spam when seeding
        torrent.on('ready',   ()  => console.log(`[AssetTorrent] metadata ready ${assetId} peers=${torrent.numPeers}`));
        torrent.on('download', () => {
          const pct = torrent.length > 0 ? Math.round((torrent.downloaded / torrent.length) * 100) : 0;
          upsertLocalState(assetId, isGeneric, { download_progress: pct }).catch(() => {});
          emitSyncProgress(assetId, isGeneric, 'downloading', pct);
        });

        torrent.on('done', async () => {
          active.delete(assetId);
          cleanupSignalingPeer(projectId, infoHash);
          try {
            const actualPath = resolveDownloadedFilePath(expected, torrent);
            if (!actualPath) {
              throw new Error(`Downloaded file not found for ${assetId}; expected ${expected}`);
            }

            if (actualPath !== expected) {
              console.warn(`[AssetTorrent] Download completed at fallback path for ${assetId}: ${actualPath}`);
            }

            await persistDownloadedAsset(assetId, isGeneric, actualPath);
            await upsertLocalState(assetId, isGeneric, { sync_status: 'seeding', sync_error: null, last_success_at: Date.now(), download_progress: 100, retry_count: 0 });
            emitSyncProgress(assetId, isGeneric, 'seeding', 100);
            recordSeededHash(projectId, torrent.infoHash);
            console.log(`[AssetTorrent] Download done: assetId=${assetId} path=${actualPath}`);
          } catch (err) {
            console.error(`[AssetTorrent] post-download error ${assetId}:`, err?.message);
            await handleDownloadError({ projectId, assetId, isGeneric, errCode: classifyError(err) });
          }
          drainQueue(projectId);
          const finalPath = resolveDownloadedFilePath(expected, torrent) || expected;
          settle({ success: fs.existsSync(finalPath), path: finalPath });
        });

        torrent.on('error', async (err) => {
          active.delete(assetId);
          cleanupSignalingPeer(projectId, infoHash);
          console.error(`[AssetTorrent] torrent error ${assetId}:`, err?.message);
          await handleDownloadError({ projectId, assetId, isGeneric, errCode: classifyError(err) });
          drainQueue(projectId);
          settle({ success: false, reason: classifyError(err) });
        });

      } catch (err) {
        active.delete(assetId);
        cleanupSignalingPeer(projectId, infoHash);
        console.error(`[AssetTorrent] download setup error ${assetId}:`, err?.message);
        handleDownloadError({ projectId, assetId, isGeneric, errCode: classifyError(err) }).catch(() => {});
        drainQueue(projectId);
        settle({ success: false, reason: err?.message });
      }
    })();
  });
}

async function handleDownloadError({ projectId, assetId, isGeneric, errCode }) {
  const state   = await getLocalState(assetId, isGeneric);
  const retries = (state?.retry_count ?? 0) + 1;
  const status  = retries >= MAX_RETRIES ? 'error' : 'missing';
  const backoff = BACKOFF_SEQUENCE_MS[Math.min(retries - 1, BACKOFF_SEQUENCE_MS.length - 1)];
  console.log(`[AssetTorrent] Download error: ${assetId} code=${errCode} retries=${retries}/${MAX_RETRIES}`);
  await upsertLocalState(assetId, isGeneric, { sync_status: status, sync_error: errCode, retry_count: retries, download_progress: 0 });
  emitSyncProgress(assetId, isGeneric, status, 0, errCode);
  if (status === 'missing') setTimeout(() => scheduleAssetReconcile(projectId, assetId), backoff);
}


function enqueueDownload(job) {
  const active = getOrSet(activeDownloads, job.projectId, () => new Set());
  const queue  = getOrSet(downloadQueues,  job.projectId, () => []);
  if (active.has(job.assetId) || queue.some((q) => q.assetId === job.assetId)) return;
  if (active.size < MAX_CONCURRENT_DOWNLOADS_PER_PROJECT) {
    active.add(job.assetId);
    downloadAsset(job).catch((err) => { console.error('[AssetTorrent] downloadAsset error:', err); active.delete(job.assetId); drainQueue(job.projectId); });
  } else {
    queue.push(job);
  }
}

function drainQueue(projectId) {
  const active = getOrSet(activeDownloads, projectId, () => new Set());
  const queue  = getOrSet(downloadQueues,  projectId, () => []);
  while (active.size < MAX_CONCURRENT_DOWNLOADS_PER_PROJECT && queue.length > 0) {
    const job = queue.shift();
    active.add(job.assetId);
    downloadAsset(job).catch((err) => { console.error('[AssetTorrent] drain error:', err); active.delete(job.assetId); drainQueue(projectId); });
  }
}


async function seedUnseededLocalAssets(projectId) {
  const tables = [
    { table: assets,        isGeneric: false },
    { table: genericAssets, isGeneric: true  },
  ];
  for (const { table, isGeneric } of tables) {
    try {
      const rows = await db
        .select({ id: table.id, path: table.path })
        .from(table)
        .where(and(eq(table.project_id, projectId), sql`${table.torrent_info_hash} IS NULL`, isNotNull(table.path)))
        .execute();

      for (const row of rows) {
        if (!row.path || !fs.existsSync(row.path)) continue;
        const meta = await seedAsset({ projectId, assetId: row.id, filePath: row.path, isGeneric });
        if (!meta?.infoHash) continue;

        const sha256 = await computeSha256(row.path);
        const ext    = path.extname(row.path).toLowerCase();
        const mime   = { '.avif': 'image/avif', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' }[ext] || 'application/octet-stream';

        await db.update(table).set({
          torrent_info_hash:    meta.infoHash,
          torrent_name:         meta.name,
          torrent_length:       meta.length,
          torrent_piece_length: meta.pieceLength,
          asset_content_ext:    ext,
          asset_content_mime:   mime,
          asset_content_sha256: sha256,
        }).where(eq(table.id, row.id)).execute();

        console.log(`[AssetTorrent] Seeded unseeded asset ${row.id} infoHash=${meta.infoHash}`);
      }
    } catch (err) {
      console.error('[AssetTorrent] seedUnseededLocalAssets error:', err?.message);
    }
  }
}

export function scheduleAssetReconcile(projectId, assetId = null) {
  if (!projectId) return;
  if (reconcileDebounce.has(projectId)) clearTimeout(reconcileDebounce.get(projectId));
  const t = setTimeout(() => {
    reconcileDebounce.delete(projectId);
    reconcileProject(projectId, assetId).catch((err) =>
      console.error(`[AssetTorrent] reconcileProject error:`, err)
    );
  }, RECONCILE_DEBOUNCE_MS);
  reconcileDebounce.set(projectId, t);
}

async function reconcileProject(projectId, specificAssetId = null) {
  if (reconcileRunning.has(projectId)) return;
  reconcileRunning.add(projectId);
  console.log(`[AssetTorrent] Reconcile: project=${projectId}${specificAssetId ? ` asset=${specificAssetId}` : ''}`);
  try {
    await repairProjectAssetStates(projectId);
    if (!specificAssetId) await seedUnseededLocalAssets(projectId);
    await reconcileTable({ projectId, isGeneric: false, specificAssetId });
    await reconcileTable({ projectId, isGeneric: true,  specificAssetId });
  } catch (err) {
    console.error('[AssetTorrent] reconcileProject error:', err);
  } finally {
    reconcileRunning.delete(projectId);
  }
}

async function reconcileTable({ projectId, isGeneric, specificAssetId }) {
  const assetTable = isGeneric ? genericAssets : assets;
  const stateTable = isGeneric ? generic_asset_local_state : asset_local_state;
  const stateIdCol = isGeneric ? stateTable.generic_asset_id : stateTable.asset_id;

  try {
    const conditions = [eq(assetTable.project_id, projectId), isNotNull(assetTable.torrent_info_hash)];
    if (specificAssetId) conditions.push(eq(assetTable.id, specificAssetId));

    const assetRows = await db
      .select({ id: assetTable.id, path: assetTable.path, formats: assetTable.formats, torrent_info_hash: assetTable.torrent_info_hash, torrent_name: assetTable.torrent_name })
      .from(assetTable).where(and(...conditions)).execute();

    if (!assetRows.length) return;

    const localStates = await db.select().from(stateTable).where(inArray(stateIdCol, assetRows.map((r) => r.id))).execute();
    const stateMap    = new Map(localStates.map((s) => [s[isGeneric ? 'generic_asset_id' : 'asset_id'], s]));

    for (const row of assetRows) {
      const state    = stateMap.get(row.id);
      const status   = state?.sync_status ?? null;
      const { safeName, existingPath } = resolveCandidateAssetPaths(projectId, row);
      const hasFile  = !!existingPath;
      const filePath = existingPath;

      if ((status === 'seeding' || status === 'available') && hasFile) {
        if (!seededHashes.has(row.torrent_info_hash))
          seedAsset({ projectId, assetId: row.id, filePath, isGeneric, expectedInfoHash: row.torrent_info_hash }).catch(() => {});
        continue;
      }
      if (hasFile && (status === null || status === 'missing')) {
        seedAsset({ projectId, assetId: row.id, filePath, isGeneric, expectedInfoHash: row.torrent_info_hash }).catch(() => {});
        continue;
      }
      if ((status === 'seeding' || status === 'available') && !hasFile) {
        console.warn(`[AssetTorrent] File missing despite status=${status}: ${row.id}`);
        await upsertLocalState(row.id, isGeneric, { sync_status: 'missing', retry_count: 0 });
      }
      if (status === 'downloading') {
        const act = getOrSet(activeDownloads, projectId, () => new Set());
        if (act.has(row.id)) continue;
        await upsertLocalState(row.id, isGeneric, { sync_status: 'missing' });
      }
      if (status === 'error' && (state?.retry_count ?? 0) >= MAX_RETRIES) continue;

      enqueueDownload({ projectId, assetId: row.id, infoHash: row.torrent_info_hash, torrentName: row.torrent_name || safeName, isGeneric });
    }
  } catch (err) {
    console.error('[AssetTorrent] reconcileTable error:', err?.message);
  }
}


export function startReconcileLoop(projectId) {
  if (!projectId || reconcileIntervals.has(projectId)) return;
  scheduleAssetReconcile(projectId);
  const interval = setInterval(
    () => reconcileProject(projectId).catch((err) => console.error('[AssetTorrent] periodic reconcile error:', err)),
    RECONCILE_INTERVAL_MS
  );
  reconcileIntervals.set(projectId, interval);
}

export function stopProjectTorrents(projectId) {
  if (!projectId) return;
  const iv = reconcileIntervals.get(projectId); if (iv) { clearInterval(iv); reconcileIntervals.delete(projectId); }
  const dv = reconcileDebounce.get(projectId);  if (dv) { clearTimeout(dv);  reconcileDebounce.delete(projectId); }
  const sig = signalingActions.get(projectId);
  if (sig) {
    for (const p of sig.seederPeers.values()) try { p.destroy(); } catch (_) {}
    try { sig.room?.leave?.(); } catch (err) { console.warn('[AssetTorrent] signaling room leave failed:', err?.message); }
    signalingActions.delete(projectId);
  }
  clearProjectPendingSignals(projectId);
  clearProjectSeededHashes(projectId);
  downloadQueues.delete(projectId);
  activeDownloads.delete(projectId);
  reconcileRunning.delete(projectId);
}

export function destroyTorrentManager() {
  for (const t of reconcileIntervals.values()) clearInterval(t);
  for (const t of reconcileDebounce.values())  clearTimeout(t);
  for (const sig of signalingActions.values()) {
    for (const p of sig.seederPeers.values()) try { p.destroy(); } catch (_) {}
    try { sig.room?.leave?.(); } catch (err) { console.warn('[AssetTorrent] signaling room leave failed:', err?.message); }
  }
  for (const entry of pendingPeerSignals.values()) try { entry.peer?.destroy(); } catch (_) {}
  reconcileIntervals.clear();
  reconcileDebounce.clear();
  signalingActions.clear();
  activeDownloads.clear();
  downloadQueues.clear();
  reconcileRunning.clear();
  pendingPeerSignals.clear();
  projectSeededHashes.clear();
  seededHashes.clear();
  if (_wtClient && !_wtClient.destroyed) {
    _wtClient.destroy(() => console.log('[AssetTorrent] WebTorrent client destroyed'));
    _wtClient = null;
  }
}

export async function resetErroredAssets(projectId) {
  if (!projectId) return;
  try {
    await db.update(asset_local_state)
      .set({ sync_status: 'missing', retry_count: 0, sync_error: null })
      .where(eq(asset_local_state.sync_status, 'error')).execute();
    await db.update(generic_asset_local_state)
      .set({ sync_status: 'missing', retry_count: 0, sync_error: null })
      .where(eq(generic_asset_local_state.sync_status, 'error')).execute();
  } catch (err) {
    console.error('[AssetTorrent] resetErroredAssets error:', err?.message);
  }
}

export async function getProjectSyncStatus(projectId) {
  if (!projectId) return null;
  try {
    await repairProjectAssetStates(projectId);
    const assetRows = await db.select({ id: assets.id }).from(assets)
      .where(and(eq(assets.project_id, projectId), isNotNull(assets.torrent_info_hash))).execute();
    const gaRows = await db.select({ id: genericAssets.id }).from(genericAssets)
      .where(and(eq(genericAssets.project_id, projectId), isNotNull(genericAssets.torrent_info_hash))).execute();

    const states = assetRows.length
      ? await db.select().from(asset_local_state).where(inArray(asset_local_state.asset_id, assetRows.map((r) => r.id))).execute() : [];
    const gaStates = gaRows.length
      ? await db.select().from(generic_asset_local_state).where(inArray(generic_asset_local_state.generic_asset_id, gaRows.map((r) => r.id))).execute() : [];

    const all = [...states, ...gaStates];
    const count = (s) => all.filter((x) => x.sync_status === s).length;
    return {
      total:           assetRows.length + gaRows.length,
      seeding:         count('seeding'),
      available:       count('available'),
      downloading:     count('downloading'),
      missing:         count('missing'),
      error:           count('error'),
      activeDownloads: activeDownloads.get(projectId)?.size ?? 0,
      queuedDownloads: downloadQueues.get(projectId)?.length ?? 0,
    };
  } catch (err) {
    console.error('[AssetTorrent] getProjectSyncStatus error:', err?.message);
    return null;
  }
}

