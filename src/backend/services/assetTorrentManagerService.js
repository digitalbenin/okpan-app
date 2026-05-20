/**
 * Asset torrent manager service for P2P seeding, downloading, and reconcile
 * scheduling of project assets.
 *
 * @namespace backend.services.assetTorrentManagerService
 * @memberof backend.services
 */
// Manages WebTorrent seeding/downloading for asset P2P sync.
// Local-state tables (asset_local_state / generic_asset_local_state) are never
// Yjs-synced, preventing write-back loops. Torrent metadata on assets/generic_assets
// is written once by the seeder and is immutable after that.

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { db } from '../../db/init.js';
import { assets, genericAssets, asset_local_state, generic_asset_local_state } from '../../db/schema.js';
import { eq, and, isNotNull, inArray, sql } from 'drizzle-orm';
import {
  resolveLogicalAssetPath,
  resolveProjectAssetPath,
  toLogicalStoredAssetPath,
} from '../utils/assetPaths.js';
import { computeFileSha256, getAssetContentInfo } from '../utils/assetMetadata.js';
import {
  cleanupAssetSignalingPeer,
  createDownloaderSignalPeer,
  destroyAssetSignaling,
  ensureProjectAssetSignaling,
  stopProjectAssetSignaling,
} from './assetTorrentSignalingService.js';

const MAX_CONCURRENT_DOWNLOADS_PER_PROJECT = 3;
const MAX_RETRIES = 5;
const DOWNLOAD_TIMEOUT_MS = 60 * 1000;
const RECONCILE_INTERVAL_MS = 90_000;
const RECONCILE_DEBOUNCE_MS = 600;
const BACKOFF_SEQUENCE_MS = [5_000, 15_000, 30_000, 60_000, 120_000];

let _WebTorrentModule = null;
let _wtClient = null;
let _webContents = null;

const ASSET_TABLE_VARIANTS = [
  {
    isGeneric: false,
    assetTable: assets,
    stateTable: asset_local_state,
    stateIdCol: asset_local_state.asset_id,
    stateIdKey: 'asset_id',
    otherAssetTable: genericAssets,
  },
  {
    isGeneric: true,
    assetTable: genericAssets,
    stateTable: generic_asset_local_state,
    stateIdCol: generic_asset_local_state.generic_asset_id,
    stateIdKey: 'generic_asset_id',
    otherAssetTable: assets,
  },
];

function getAssetTableVariant(isGeneric) {
  return isGeneric ? ASSET_TABLE_VARIANTS[1] : ASSET_TABLE_VARIANTS[0];
}

function resolveReadableAssetPath(filePath) {
  const candidates = [filePath, resolveLogicalAssetPath(filePath)]
    .filter((candidate, index, arr) => typeof candidate === 'string' && candidate.length > 0 && arr.indexOf(candidate) === index);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return path.normalize(candidate);
  }

  return candidates[1] || candidates[0] || null;
}
const activeDownloads   = new Map(); // projectId → Set<assetId>
const downloadQueues    = new Map(); // projectId → DownloadJob[]
const downloadAbortFuncs= new Map(); // projectId ? Map<assetId, abortFn>
const stoppedProjects   = new Set(); // projects being torn down -- blocks new work
const reconcileIntervals= new Map(); // projectId → Timeout
const reconcileDebounce = new Map(); // projectId → Timeout
const reconcileRunning  = new Set();
const seededHashes      = new Set();
const projectSeededHashes = new Map(); // projectId → Set<infoHash>


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

async function getProjectTorrent(infoHash) {
  const client = await getWtClient();
  return client.get(infoHash);
}

function ensureProjectSignaling(projectId) {
  return ensureProjectAssetSignaling(projectId, { getTorrent: getProjectTorrent });
}

function getOrSet(map, key, factory) {
  if (!map.has(key)) map.set(key, factory());
  return map.get(key);
}

function recordSeededHash(projectId, infoHash) {
  if (!projectId || !infoHash) return;
  seededHashes.add(infoHash);
  getOrSet(projectSeededHashes, projectId, () => new Set()).add(infoHash);
}

function clearProjectSeededHashes(projectId) {
  const hashes = projectSeededHashes.get(projectId);
  if (!hashes) return;
  for (const infoHash of hashes) seededHashes.delete(infoHash);
  projectSeededHashes.delete(projectId);
}

async function collectProjectTorrentHashes(projectId) {
  const hashes = new Set(projectSeededHashes.get(projectId) || []);

  try {
    const [assetRows, genericRows] = await Promise.all([
      db.select({ infoHash: assets.torrent_info_hash })
        .from(assets)
        .where(and(eq(assets.project_id, projectId), isNotNull(assets.torrent_info_hash)))
        .execute(),
      db.select({ infoHash: genericAssets.torrent_info_hash })
        .from(genericAssets)
        .where(and(eq(genericAssets.project_id, projectId), isNotNull(genericAssets.torrent_info_hash)))
        .execute(),
    ]);

    for (const row of [...assetRows, ...genericRows]) {
      if (row?.infoHash) hashes.add(row.infoHash);
    }
  } catch (err) {
    console.warn('[AssetTorrent] Failed to collect project torrent hashes:', err?.message);
  }

  return hashes;
}

function isTorrentWithinProjectDir(projectId, torrent) {
  const projectDir = resolveProjectAssetPath(projectId);
  return torrent?.files?.some((file) => {
    const resolvedPath = path.resolve(file.path);
    return resolvedPath === projectDir || resolvedPath.startsWith(`${projectDir}${path.sep}`);
  }) || false;
}

async function removeProjectClientTorrents(projectId) {
  if (!_wtClient || _wtClient.destroyed) return;

  const hashes = await collectProjectTorrentHashes(projectId);
  const matchingTorrents = _wtClient.torrents.filter((torrent) => {
    return hashes.has(torrent.infoHash) || isTorrentWithinProjectDir(projectId, torrent);
  });

  await Promise.allSettled(matchingTorrents.map((torrent) => {
    return new Promise((resolve) => {
      try {
        _wtClient.remove(torrent.infoHash, { destroyStore: false }, () => resolve());
      } catch (error) {
        console.warn('[AssetTorrent] Failed to remove project torrent before restore:', {
          projectId,
          infoHash: torrent?.infoHash,
          error: error?.message,
        });
        resolve();
      }
    });
  }));
}

const WINDOWS_RESERVED_BASENAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;

function getTorrentMetadataName(name) {
  if (!name || typeof name !== 'string') return 'asset.bin';
  return path.basename(name) || 'asset.bin';
}

function sanitizeName(name) {
  let base = getTorrentMetadataName(name)
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/[. ]+$/g, '');

  if (!base) base = 'asset.bin';

  if (WINDOWS_RESERVED_BASENAME.test(base)) {
    const ext = path.extname(base);
    const stem = path.basename(base, ext) || 'asset';
    base = `${stem}_${ext}`;
  }

  return base;
}

function isReadableTorrentStore(torrent) {
  if (!torrent?.store) return Promise.resolve(false);
  if (!Number.isFinite(torrent.length) || torrent.length <= 0) return Promise.resolve(true);

  const length = Math.max(1, Math.min(torrent.pieceLength || torrent.length, torrent.length));
  return new Promise((resolve) => {
    try {
      torrent.store.get(0, { offset: 0, length }, (err) => {
        resolve(!err);
      });
    } catch {
      resolve(false);
    }
  });
}

async function persistTorrentMetadataForAsset(assetId, isGeneric, meta) {
  if (!meta?.infoHash) return;

  const { assetTable } = getAssetTableVariant(isGeneric);
  await db.update(assetTable).set({
    torrent_info_hash: meta.infoHash,
    torrent_name: meta.name,
    torrent_length: meta.length,
    torrent_piece_length: meta.pieceLength,
  }).where(eq(assetTable.id, assetId)).execute();
}

function hasCompleteLocalFile(filePath, expectedLength = null) {
  if (!filePath || !fs.existsSync(filePath)) return false;

  const numericLength = Number(expectedLength);
  if (!Number.isFinite(numericLength) || numericLength <= 0) {
    return true;
  }

  try {
    return fs.statSync(filePath).size === numericLength;
  } catch {
    return false;
  }
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

async function queryAssetRowPresence(assetId, isGeneric) {
  const { assetTable, otherAssetTable } = getAssetTableVariant(isGeneric);

  const [expectedRows, otherRows] = await Promise.all([
    db.select({ id: assetTable.id }).from(assetTable).where(eq(assetTable.id, assetId)).limit(1).execute(),
    db.select({ id: otherAssetTable.id }).from(otherAssetTable).where(eq(otherAssetTable.id, assetId)).limit(1).execute(),
  ]);

  if (expectedRows.length > 0) return 'expected';
  if (otherRows.length > 0) return 'other';
  return 'missing';
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
  const { stateTable, stateIdCol, stateIdKey } = getAssetTableVariant(isGeneric);

  const presence = await queryAssetRowPresence(assetId, isGeneric);
  if (presence === 'other') {
    //console.warn(
    //  `[AssetTorrent] upsertLocalState skipped for ${assetId}: parent row exists in ${isGeneric ? 'assets' : 'generic_assets'} ` +
    //  `but write targeted ${isGeneric ? 'generic_asset_local_state' : 'asset_local_state'}`
    //);
    return false;
  }
  if (presence !== 'expected') {
    //console.warn(
    //  `[AssetTorrent] upsertLocalState deferred for ${assetId}: parent row missing from ${isGeneric ? 'generic_assets' : 'assets'}`
    //);
    return false;
  }

  try {
    await db.insert(stateTable).values({ [stateIdKey]: assetId, ...fields })
      .onConflictDoUpdate({ target: stateIdCol, set: fields }).execute();
    return true;
  } catch (err) {
    console.error(`[AssetTorrent] upsertLocalState failed for ${assetId}:`, err?.message);
    return false;
  }
}

async function getLocalState(assetId, isGeneric) {
  const { stateTable, stateIdCol } = getAssetTableVariant(isGeneric);
  try {
    const rows = await db.select().from(stateTable).where(eq(stateIdCol, assetId)).limit(1).execute();
    return rows[0] || null;
  } catch (err) {
    console.warn(`[AssetTorrent] getLocalState failed for ${assetId}:`, err?.message);
    return null;
  }
}

function resolveCandidateAssetPaths(projectId, row) {
  const safeName = sanitizeName(row.torrent_name || path.basename(row.path || 'asset.bin'));
  const localPath = path.join(resolveProjectAssetPath(projectId), safeName);
  const candidates = [
    resolveReadableAssetPath(row.path),
    resolveReadableAssetPath(row.formats?.original),
    localPath,
  ]
    .filter((value, index, arr) => typeof value === 'string' && value.length > 0 && arr.indexOf(value) === index);

  let existingPath = null;
  let incompletePath = null;

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    if (hasCompleteLocalFile(candidate, row.torrent_length)) {
      existingPath = candidate;
      break;
    }
    if (!incompletePath) incompletePath = candidate;
  }

  return {
    safeName,
    localPath,
    existingPath,
    incompletePath,
  };
}

async function repairAssetStateTable({ projectId, variant }) {
  const { assetTable, stateTable, stateIdCol, stateIdKey, isGeneric } = variant;
  const assetRows = await db
    .select({
      id: assetTable.id,
      path: assetTable.path,
      formats: assetTable.formats,
      torrent_info_hash: assetTable.torrent_info_hash,
      torrent_name: assetTable.torrent_name,
      torrent_length: assetTable.torrent_length,
    })
    .from(assetTable)
    .where(and(eq(assetTable.project_id, projectId), isNotNull(assetTable.torrent_info_hash)))
    .execute();

  if (!assetRows.length) return { repaired: 0 };

  const stateRows = await db.select().from(stateTable).where(inArray(stateIdCol, assetRows.map((row) => row.id))).execute();
  const stateMap = new Map(stateRows.map((state) => [state[stateIdKey], state]));
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
      continue;
    }

    if (hasFile && (status === 'seeding' || status === 'available') && (state.download_progress ?? 0) < 100) {
      await upsertLocalState(row.id, isGeneric, { sync_status: status, sync_error: null, download_progress: 100 });
      repaired += 1;
    }
  }

  return { repaired };
}

async function repairProjectAssetStates(projectId) {
  if (!projectId) return { repaired: 0 };

  const results = await Promise.all(
    ASSET_TABLE_VARIANTS.map((variant) => repairAssetStateTable({ projectId, variant }))
  );

  const repaired = results.reduce((sum, result) => sum + (result?.repaired || 0), 0);
  if (repaired > 0) {
    //console.warn(`[AssetTorrent] Repaired ${repaired} stale local asset sync state rows for project ${projectId}`);
    scheduleAssetReconcile(projectId);
  }

  return { repaired };
}

function reseedExistingAsset({ projectId, row, filePath, isGeneric }) {
  return seedAsset({
    projectId,
    assetId: row.id,
    filePath,
    isGeneric,
    expectedInfoHash: row.torrent_info_hash,
    expectedLength: row.torrent_length,
  })
    .then((meta) => {
      if (meta?.infoHash && meta.infoHash !== row.torrent_info_hash) {
        return persistTorrentMetadataForAsset(row.id, isGeneric, meta);
      }
      return null;
    })
    .catch(() => {});
}


export async function seedAsset({ projectId, assetId, filePath, isGeneric = false, expectedInfoHash = null, expectedLength = null, enableSignaling = true }) {
  if (!projectId || !assetId || !filePath) return null;
  if (stoppedProjects.has(projectId)) return null;
  if (!hasCompleteLocalFile(filePath, expectedLength)) {
    console.warn(`[AssetTorrent] seedAsset: file not found: ${filePath}`);
    return null;
  }

  const client  = await getWtClient();
  const name    = getTorrentMetadataName(path.basename(filePath));
  const absPath = path.resolve(filePath);

  return new Promise((resolve) => {
    const beginSeed = () => {
      client.seed(filePath, { name }, (torrent) => {
        //console.log(`[AssetTorrent] Seeding: assetId=${assetId} infoHash=${torrent.infoHash}`);
        recordSeededHash(projectId, torrent.infoHash);
        if (enableSignaling) {
          ensureProjectSignaling(projectId).catch(() => {});
        }
        upsertLocalState(assetId, isGeneric, { sync_status: 'seeding', sync_error: null, last_success_at: Date.now(), download_progress: 100 }).catch(() => {});
        emitSyncProgress(assetId, isGeneric, 'seeding', 100);
        resolve({ infoHash: torrent.infoHash, name: torrent.name, length: torrent.length, pieceLength: torrent.pieceLength });
      });
    };

    (async () => {
      try {
        const existing = (expectedInfoHash && client.torrents.find((torrent) => torrent.infoHash === expectedInfoHash))
          || client.torrents.find((torrent) => torrent.files?.some((file) => path.resolve(file.path) === absPath));
        if (existing?.done && hasCompleteLocalFile(filePath, expectedLength) && await isReadableTorrentStore(existing)) {
          recordSeededHash(projectId, existing.infoHash);
          if (enableSignaling) {
            ensureProjectSignaling(projectId).catch(() => {});
          }
          upsertLocalState(assetId, isGeneric, { sync_status: 'seeding', sync_error: null, download_progress: 100 }).catch(() => {});
          emitSyncProgress(assetId, isGeneric, 'seeding', 100);
          resolve({ infoHash: existing.infoHash, name: existing.name, length: existing.length, pieceLength: existing.pieceLength });
          return;
        }

        if (existing) {
          client.remove(existing.infoHash, { destroyStore: false }, () => beginSeed());
          return;
        }

        beginSeed();
      } catch (err) {
        console.error(`[AssetTorrent] seedAsset error for ${assetId}:`, err);
        resolve(null);
      }
    })();
  });
}


// After a torrent download: update the asset row's local path and, for AVIF
// images, generate 300-px (sm) and 1400-px (md) variants.  Fully non-blocking.
async function persistDownloadedAsset(assetId, isGeneric, originalPath) {
  const ext   = path.extname(originalPath).toLowerCase();
  const { assetTable } = getAssetTableVariant(isGeneric);
  const logicalOriginalPath = toLogicalStoredAssetPath(originalPath);

  if (ext === '.avif') {
    const base   = originalPath.slice(0, -5); // strip ".avif"
    const smPath = `${base}_sm.avif`;
    const mdPath = `${base}_md.avif`;
    const logicalSmPath = toLogicalStoredAssetPath(smPath);
    const logicalMdPath = toLogicalStoredAssetPath(mdPath);

    if (!fs.existsSync(smPath) || !fs.existsSync(mdPath)) {
      const img = sharp(originalPath);
      await Promise.all([
        img.clone().avif({ quality: 70, effort: 2 }).resize(300).toFile(smPath),
        img.clone().avif({ quality: 70, effort: 2 }).resize(1400).toFile(mdPath),
      ]);
      //console.log(`[AssetTorrent] Image variants generated for ${assetId}`);
    }

    await db.update(assetTable).set({
      path: logicalOriginalPath,
      formats: { original: logicalOriginalPath, sm: logicalSmPath, md: logicalMdPath },
    }).where(eq(assetTable.id, assetId)).execute();
  } else {
    // Video / audio: just update the local path so the frontend can find it.
    await db.update(assetTable).set({ path: logicalOriginalPath }).where(eq(assetTable.id, assetId)).execute();
  }
}

function resolveDownloadedFilePath(expectedPath, torrent) {
  if (expectedPath && fs.existsSync(expectedPath)) return expectedPath;

  const fallback = torrent?.files?.find((file) => file?.path && fs.existsSync(file.path))?.path;
  return fallback || null;
}

async function downloadAsset({ projectId, assetId, infoHash, torrentName, isGeneric, expectedLength = null }) {
  const client   = await getWtClient();
  const safeName = sanitizeName(torrentName);
  const destDir  = resolveProjectAssetPath(projectId);
  const expected = path.join(destDir, safeName);

  fs.mkdirSync(destDir, { recursive: true });

  if (hasCompleteLocalFile(expected, expectedLength)) {
    await upsertLocalState(assetId, isGeneric, { sync_status: 'available', last_success_at: Date.now(), download_progress: 100, sync_error: null });
    emitSyncProgress(assetId, isGeneric, 'available', 100);
    if (!seededHashes.has(infoHash)) seedAsset({ projectId, assetId, filePath: expected, isGeneric, expectedInfoHash: infoHash, expectedLength }).catch(() => {});
    persistDownloadedAsset(assetId, isGeneric, expected).catch(() => {});
    const active = getOrSet(activeDownloads, projectId, () => new Set());
    active.delete(assetId);
    drainQueue(projectId);
    return { success: true, path: expected };
  }

  const active = getOrSet(activeDownloads, projectId, () => new Set());
  //console.log(`[AssetTorrent] Download start: assetId=${assetId} infoHash=${infoHash}`);

  await upsertLocalState(assetId, isGeneric, { sync_status: 'downloading', last_attempt_at: Date.now(), download_progress: 0, sync_error: null });
  emitSyncProgress(assetId, isGeneric, 'downloading', 0);

  const magnet = `magnet:?xt=urn:btih:${infoHash}&dn=${encodeURIComponent(safeName)}`;

  return new Promise((resolve) => {
    let settled = false;
    const cleanupAbort = () => downloadAbortFuncs.get(projectId)?.delete(assetId);
    const settle = (r) => { if (settled) return; settled = true; clearTimeout(timer); cleanupAbort(); resolve(r); };

    const abortDownload = async () => {
      active.delete(assetId);
      cleanupAssetSignalingPeer(projectId, infoHash);
      const staleT = await client.get(infoHash);
      if (staleT) await new Promise((res) => client.remove(infoHash, { destroyStore: false }, res));
      settle({ success: false, reason: 'aborted' });
    };
    getOrSet(downloadAbortFuncs, projectId, () => new Map()).set(assetId, abortDownload);

    const timeoutFn = async () => {
      active.delete(assetId);
      cleanupAssetSignalingPeer(projectId, infoHash);
      drainQueue(projectId);
      await handleDownloadError({ projectId, assetId, isGeneric, errCode: 'TIMEOUT' });
      settle({ success: false, reason: 'timeout' });
    };
    let timer = setTimeout(timeoutFn, DOWNLOAD_TIMEOUT_MS);
    const resetTimer = () => { clearTimeout(timer); timer = setTimeout(timeoutFn, DOWNLOAD_TIMEOUT_MS); };

    (async () => {
      try {
        const stale = await client.get(infoHash);
        if (stale) await new Promise((res) => client.remove(infoHash, { destroyStore: false }, res));

        const torrent = client.add(magnet, { path: destDir });
        if (!torrent) throw new Error('client.add returned null');

        // Set up Trystero signaling for tracker-free peer discovery.
        if (await ensureProjectSignaling(projectId)) createDownloaderSignalPeer({ projectId, infoHash, torrent });

        torrent.on('warning', (w) => console.warn(`[AssetTorrent] warning ${assetId}:`, w?.message || w));
        // torrent.on('noPeers', (t) => console.warn(`[AssetTorrent] no peers ${assetId} (${t})`)); // Removed to prevent log spam when seeding
        torrent.on('download', () => {
          resetTimer();
          const pct = torrent.length > 0 ? Math.round((torrent.downloaded / torrent.length) * 100) : 0;
          upsertLocalState(assetId, isGeneric, { download_progress: pct }).catch(() => {});
          emitSyncProgress(assetId, isGeneric, 'downloading', pct);
        });

        torrent.on('done', async () => {
          active.delete(assetId);
          cleanupAssetSignalingPeer(projectId, infoHash);
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
            //console.log(`[AssetTorrent] Download done: assetId=${assetId} path=${actualPath}`);
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
          cleanupAssetSignalingPeer(projectId, infoHash);
          console.error(`[AssetTorrent] torrent error ${assetId}:`, err?.message);
          await handleDownloadError({ projectId, assetId, isGeneric, errCode: classifyError(err) });
          drainQueue(projectId);
          settle({ success: false, reason: classifyError(err) });
        });

      } catch (err) {
        active.delete(assetId);
        cleanupAssetSignalingPeer(projectId, infoHash);
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
  //console.log(`[AssetTorrent] Download error: ${assetId} code=${errCode} retries=${retries}/${MAX_RETRIES}`);
  await upsertLocalState(assetId, isGeneric, { sync_status: status, sync_error: errCode, retry_count: retries, download_progress: 0 });
  emitSyncProgress(assetId, isGeneric, status, 0, errCode);
  if (status === 'missing') setTimeout(() => scheduleAssetReconcile(projectId, assetId), backoff);
}


function enqueueDownload(job) {
  if (stoppedProjects.has(job.projectId)) return;
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
  if (stoppedProjects.has(projectId)) return;
  const active = getOrSet(activeDownloads, projectId, () => new Set());
  const queue  = getOrSet(downloadQueues,  projectId, () => []);
  while (active.size < MAX_CONCURRENT_DOWNLOADS_PER_PROJECT && queue.length > 0) {
    const job = queue.shift();
    active.add(job.assetId);
    downloadAsset(job).catch((err) => { console.error('[AssetTorrent] drain error:', err); active.delete(job.assetId); drainQueue(projectId); });
  }
}


async function seedUnseededLocalAssets(projectId) {
  for (const variant of ASSET_TABLE_VARIANTS) {
    const { assetTable, isGeneric } = variant;
    try {
      const rows = await db
        .select({ id: assetTable.id, path: assetTable.path })
        .from(assetTable)
        .where(and(eq(assetTable.project_id, projectId), sql`${assetTable.torrent_info_hash} IS NULL`, isNotNull(assetTable.path)))
        .execute();

      for (const row of rows) {
        const filePath = resolveReadableAssetPath(row.path);
        if (!filePath || !fs.existsSync(filePath)) continue;
        const meta = await seedAsset({ projectId, assetId: row.id, filePath, isGeneric });
        if (!meta?.infoHash) continue;

        const sha256 = await computeFileSha256(filePath, { swallowErrors: true });
        const { ext, mime } = getAssetContentInfo(filePath);

        await db.update(assetTable).set({
          torrent_info_hash:    meta.infoHash,
          torrent_name:         meta.name,
          torrent_length:       meta.length,
          torrent_piece_length: meta.pieceLength,
          asset_content_ext:    ext,
          asset_content_mime:   mime,
          asset_content_sha256: sha256,
        }).where(eq(assetTable.id, row.id)).execute();

        //console.log(`[AssetTorrent] Seeded unseeded asset ${row.id} infoHash=${meta.infoHash}`);
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
  if (reconcileRunning.has(projectId) || stoppedProjects.has(projectId)) return;
  reconcileRunning.add(projectId);
   //console.log(`[AssetTorrent] Reconcile: project=${projectId}${specificAssetId ? ` asset=${specificAssetId}` : ''}`);
  try {
    await repairProjectAssetStates(projectId);
    if (!specificAssetId) await seedUnseededLocalAssets(projectId);
    for (const variant of ASSET_TABLE_VARIANTS) {
      await reconcileTable({ projectId, variant, specificAssetId });
    }
  } catch (err) {
    console.error('[AssetTorrent] reconcileProject error:', err);
  } finally {
    reconcileRunning.delete(projectId);
  }
}

async function reconcileTable({ projectId, variant, specificAssetId }) {
  const { assetTable, stateTable, stateIdCol, stateIdKey, isGeneric } = variant;

  try {
    const conditions = [eq(assetTable.project_id, projectId), isNotNull(assetTable.torrent_info_hash)];
    if (specificAssetId) conditions.push(eq(assetTable.id, specificAssetId));

    const assetRows = await db
      .select({ id: assetTable.id, path: assetTable.path, formats: assetTable.formats, torrent_info_hash: assetTable.torrent_info_hash, torrent_name: assetTable.torrent_name, torrent_length: assetTable.torrent_length })
      .from(assetTable).where(and(...conditions)).execute();

    if (!assetRows.length) return;

    const localStates = await db.select().from(stateTable).where(inArray(stateIdCol, assetRows.map((r) => r.id))).execute();
    const stateMap    = new Map(localStates.map((s) => [s[stateIdKey], s]));

    for (const row of assetRows) {
      const state    = stateMap.get(row.id);
      const status   = state?.sync_status ?? null;
      const { safeName, existingPath, incompletePath } = resolveCandidateAssetPaths(projectId, row);
      const hasFile  = !!existingPath;
      const filePath = existingPath;

      if (!hasFile && incompletePath) {
        //console.warn(`[AssetTorrent] Incomplete local asset detected for ${row.id}; forcing retry state`);
        await upsertLocalState(row.id, isGeneric, { sync_status: 'missing', download_progress: 0, sync_error: null });
      }

      if (hasFile && (status === 'seeding' || status === 'available') && (state?.download_progress ?? 0) < 100) {
        await upsertLocalState(row.id, isGeneric, { sync_status: status, download_progress: 100, sync_error: null });
      }

      if ((status === 'seeding' || status === 'available') && hasFile) {
        if (!seededHashes.has(row.torrent_info_hash)) {
          reseedExistingAsset({ projectId, row, filePath, isGeneric });
        }
        continue;
      }
      if (hasFile && (status === null || status === 'missing')) {
        reseedExistingAsset({ projectId, row, filePath, isGeneric });
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

      enqueueDownload({ projectId, assetId: row.id, infoHash: row.torrent_info_hash, torrentName: row.torrent_name || safeName, isGeneric, expectedLength: row.torrent_length });
    }
  } catch (err) {
    console.error('[AssetTorrent] reconcileTable error:', err?.message);
  }
}


export function startReconcileLoop(projectId) {
  if (!projectId || reconcileIntervals.has(projectId)) return;
  stoppedProjects.delete(projectId);
  resetErroredAssets(projectId).catch((err) => console.warn('[AssetTorrent] resetErroredAssets on start:', err?.message));
  scheduleAssetReconcile(projectId);
  const interval = setInterval(
    () => reconcileProject(projectId).catch((err) => console.error('[AssetTorrent] periodic reconcile error:', err)),
    RECONCILE_INTERVAL_MS
  );
  reconcileIntervals.set(projectId, interval);
}

export async function stopProjectTorrents(projectId) {
  if (!projectId) return;
  stoppedProjects.add(projectId);
  const abortMap = downloadAbortFuncs.get(projectId);
  if (abortMap) {
    await Promise.all([...abortMap.values()].map((fn) => fn().catch(() => {})));
    downloadAbortFuncs.delete(projectId);
  }
  const iv = reconcileIntervals.get(projectId); if (iv) { clearInterval(iv); reconcileIntervals.delete(projectId); }
  const dv = reconcileDebounce.get(projectId);  if (dv) { clearTimeout(dv);  reconcileDebounce.delete(projectId); }
  stopProjectAssetSignaling(projectId);
  await removeProjectClientTorrents(projectId);
  clearProjectSeededHashes(projectId);
  downloadQueues.delete(projectId);
  activeDownloads.delete(projectId);
  reconcileRunning.delete(projectId);
}

export function destroyTorrentManager() {
  for (const t of reconcileIntervals.values()) clearInterval(t);
  for (const t of reconcileDebounce.values())  clearTimeout(t);
  destroyAssetSignaling();
  reconcileIntervals.clear();
  reconcileDebounce.clear();
  activeDownloads.clear();
  downloadQueues.clear();
  downloadAbortFuncs.clear();
  stoppedProjects.clear();
  reconcileRunning.clear();
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
    const statusSets = await Promise.all(ASSET_TABLE_VARIANTS.map(async ({ assetTable, stateTable, stateIdCol }) => {
      const assetRows = await db.select({ id: assetTable.id }).from(assetTable)
        .where(and(eq(assetTable.project_id, projectId), isNotNull(assetTable.torrent_info_hash))).execute();

      const states = assetRows.length
        ? await db.select().from(stateTable).where(inArray(stateIdCol, assetRows.map((row) => row.id))).execute()
        : [];

      return { total: assetRows.length, states };
    }));

    const all = statusSets.flatMap((statusSet) => statusSet.states);
    const count = (s) => all.filter((x) => x.sync_status === s).length;
    return {
      total:           statusSets.reduce((sum, statusSet) => sum + statusSet.total, 0),
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

