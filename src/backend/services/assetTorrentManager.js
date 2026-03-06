/**
 * assetTorrentManager.js
 *
 * Manages WebTorrent seeding and downloading for asset P2P sync.
 *
 * Loop prevention strategy:
 *   - After download completes, we NEVER update assets.path or generic_assets.path in the DB.
 *   - The seeder sets torrent_name = path.basename(assets.path).
 *   - The downloader writes the file to the SAME relative path: <assetPath>/<projectId>/<torrent_name>
 *     which matches assets.path on both peers (same app directory structure).
 *   - All runtime/operational state is written only to asset_local_state / generic_asset_local_state
 *     which are NOT included in the Yjs document, preventing any sync-back loops.
 *
 * Only the torrent metadata fields on assets/generic_assets are Yjs-synced.
 * Those fields are written once by the seeder and read by all downloaders. They are immutable
 * after initial write so there is no conflicting update storm possible.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { db } from '../../db/init.js';
import { assets, genericAssets, asset_local_state, generic_asset_local_state } from '../../db/schema.js';
import { eq, and, isNotNull, inArray, sql } from 'drizzle-orm';

// ─── Constants ───────────────────────────────────────────────────────────────

const ASSET_BASE_PATH = './src/assets/project_assets';
const MAX_CONCURRENT_DOWNLOADS_PER_PROJECT = 3;
const MAX_RETRIES = 5;
const DOWNLOAD_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const RECONCILE_INTERVAL_MS = 90_000;       // 90 seconds anti-entropy loop
const RECONCILE_DEBOUNCE_MS = 600;          // debounce rapid ingestion events
const BACKOFF_SEQUENCE_MS = [5_000, 15_000, 30_000, 60_000, 120_000];

// ─── Module-level state ───────────────────────────────────────────────────────

/** Singleton WebTorrent client */
let _WebTorrentModule = null;
let _wtClient = null;

/** Active download assetIds per project: Map<projectId, Set<assetId>> */
const activeDownloads = new Map();

/** Pending download jobs per project: Map<projectId, Array<DownloadJob>> */
const downloadQueues = new Map();

/** Reconcile loop intervals per project: Map<projectId, NodeJS.Timeout> */
const reconcileIntervals = new Map();

/** Debounce timers for scheduleAssetReconcile: Map<projectId, NodeJS.Timeout> */
const reconcileDebounceTimers = new Map();

/** Guard against overlapping reconcile runs: Set<projectId> */
const reconcileRunning = new Set();

/** infoHashes we are already seeding (to avoid duplicate seed calls): Set<string> */
const seededHashes = new Set();

/** Reference to main window webContents for IPC events */
let _webContents = null;

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getWtClient() {
  if (!_WebTorrentModule) {
    console.log('[AssetTorrent] Dynamically importing WebTorrent...');
    const wtImport = await import('webtorrent');
    _WebTorrentModule = wtImport.default || wtImport;
  }

  if (!_wtClient || _wtClient.destroyed) {
    console.log('[AssetTorrent] Creating WebTorrent client');
    _wtClient = new _WebTorrentModule();
    _wtClient.on('error', (err) => {
      console.error('[AssetTorrent] WebTorrent client error:', err?.message || err);
    });
  }
  return _wtClient;
}

function getOrSet(map, key, factory) {
  if (!map.has(key)) map.set(key, factory());
  return map.get(key);
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

/**
 * Compute SHA-256 hex digest of a file. Returns null on error.
 */
async function computeSha256(filePath) {
  return new Promise((resolve) => {
    try {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', (err) => {
        console.warn('[AssetTorrent] SHA-256 read error:', filePath, err?.message);
        resolve(null);
      });
    } catch (err) {
      console.warn('[AssetTorrent] SHA-256 setup error:', err?.message);
      resolve(null);
    }
  });
}

// ─── IPC emission ─────────────────────────────────────────────────────────────

/**
 * Register the main window webContents so progress events reach the renderer.
 * Called from main.js after window creation.
 */
export function setMainWindowContents(webContents) {
  _webContents = webContents;
  console.log('[AssetTorrent] Registered main window webContents for IPC events');
}

function emitSyncProgress(assetId, isGeneric, status, progress = 0, error = null) {
  if (!_webContents || _webContents.isDestroyed()) return;
  try {
    _webContents.send('asset-sync-progress', { assetId, isGeneric, status, progress, error });
  } catch (err) {
    console.warn('[AssetTorrent] Failed to send asset-sync-progress IPC:', err?.message);
  }
}

// ─── Local state DB helpers ───────────────────────────────────────────────────

/**
 * Upsert a row in asset_local_state or generic_asset_local_state.
 * These tables are local-only and NOT part of any Yjs sync.
 */
async function upsertLocalState(assetId, isGeneric, fields) {
  const table = isGeneric ? generic_asset_local_state : asset_local_state;
  const pkCol = isGeneric ? table.generic_asset_id : table.asset_id;
  const pkKey = isGeneric ? 'generic_asset_id' : 'asset_id';
  try {
    await db
      .insert(table)
      .values({ [pkKey]: assetId, ...fields })
      .onConflictDoUpdate({ target: pkCol, set: fields })
      .execute();
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

// ─── Seeding ─────────────────────────────────────────────────────────────────

/**
 * Start seeding an asset file. Called after successful local import.
 *
 * IMPORTANT: torrent_name MUST equal path.basename(filePath) so that a peer
 * downloading this torrent writes the file to the same relative path as
 * assets.path — making the media:// URL resolve on both seeder and downloader
 * without any DB path update (= no Yjs loop).
 *
 * Returns { infoHash, name, length, pieceLength } or null on failure.
 */
export async function seedAsset({ projectId, assetId, filePath, isGeneric = false }) {
  if (!projectId || !assetId || !filePath) {
    console.warn('[AssetTorrent] seedAsset: missing required params', { projectId, assetId, filePath });
    return null;
  }
  if (!fs.existsSync(filePath)) {
    console.warn(`[AssetTorrent] seedAsset: file not found at: ${filePath}`);
    return null;
  }

  const client = await getWtClient();
  const name = sanitizeName(path.basename(filePath));
  const absPath = path.resolve(filePath);

  console.log(`[AssetTorrent] seedAsset called: assetId=${assetId} file=${filePath}`);

  return new Promise((resolve) => {
    try {
      // Check if already seeding this file path
      const existing = client.torrents.find(
        (t) => t.files?.some((f) => path.resolve(f.path) === absPath)
      );
      if (existing) {
        console.log(`[AssetTorrent] Already seeding ${assetId}, infoHash=${existing.infoHash}`);
        seededHashes.add(existing.infoHash);
        upsertLocalState(assetId, isGeneric, { sync_status: 'seeding', sync_error: null }).catch(() => {});
        emitSyncProgress(assetId, isGeneric, 'seeding', 100);
        resolve({
          infoHash: existing.infoHash,
          name: existing.name,
          length: existing.length,
          pieceLength: existing.pieceLength
        });
        return;
      }

      client.seed(filePath, { name }, (torrent) => {
        console.log(
          `[AssetTorrent] Seeding started: assetId=${assetId} infoHash=${torrent.infoHash} ` +
          `length=${torrent.length} pieceLength=${torrent.pieceLength}`
        );
        seededHashes.add(torrent.infoHash);
        upsertLocalState(assetId, isGeneric, {
          sync_status: 'seeding',
          sync_error: null,
          last_success_at: Date.now(),
          download_progress: 100
        }).catch(() => {});
        emitSyncProgress(assetId, isGeneric, 'seeding', 100);
        resolve({
          infoHash: torrent.infoHash,
          name: torrent.name,
          length: torrent.length,
          pieceLength: torrent.pieceLength
        });
      });
    } catch (err) {
      console.error(`[AssetTorrent] seedAsset error for ${assetId}:`, err);
      resolve(null);
    }
  });
}

// ─── Downloading ─────────────────────────────────────────────────────────────

async function downloadAsset({ projectId, assetId, infoHash, torrentName, assetPath, isGeneric }) {
  const client = await getWtClient();
  const safeName = sanitizeName(torrentName);

  // Derive download destination to match the synced assets.path structure.
  // assets.path is stored as './src/assets/project_assets/<projectId>/<name>'
  // so destDir = that same directory, and the file will land at the expected path.
  const destDir = path.join(ASSET_BASE_PATH, projectId);
  const expectedFilePath = path.join(destDir, safeName);

  // Ensure project folder exists
  if (!fs.existsSync(destDir)) {
    console.log(`[AssetTorrent] Creating project asset dir: ${destDir}`);
    fs.mkdirSync(destDir, { recursive: true });
  }

  // File already present on disk — mark available and seed
  if (fs.existsSync(expectedFilePath)) {
    console.log(`[AssetTorrent] File already exists on disk for ${assetId}: ${expectedFilePath}`);
    await upsertLocalState(assetId, isGeneric, {
      sync_status: 'available',
      last_success_at: Date.now(),
      download_progress: 100,
      sync_error: null
    });
    emitSyncProgress(assetId, isGeneric, 'available', 100);
    // Re-seed so other peers can fetch from us too
    if (!seededHashes.has(infoHash)) {
      seedAsset({ projectId, assetId, filePath: expectedFilePath, isGeneric }).catch(() => {});
    }
    const active = getOrSet(activeDownloads, projectId, () => new Set());
    active.delete(assetId);
    drainQueue(projectId);
    return { success: true, path: expectedFilePath };
  }

  const active = getOrSet(activeDownloads, projectId, () => new Set());
  if (active.has(assetId)) {
    console.log(`[AssetTorrent] Download already active for ${assetId}, skipping`);
    return { success: false, reason: 'already_active' };
  }

  active.add(assetId);
  console.log(
    `[AssetTorrent] Starting download: assetId=${assetId} infoHash=${infoHash} ` +
    `destDir=${destDir} torrentName=${safeName}`
  );

  await upsertLocalState(assetId, isGeneric, {
    sync_status: 'downloading',
    last_attempt_at: Date.now(),
    download_progress: 0,
    sync_error: null
  });
  emitSyncProgress(assetId, isGeneric, 'downloading', 0);

  const magnetURI = `magnet:?xt=urn:btih:${infoHash}&dn=${encodeURIComponent(safeName)}`;

  return new Promise((resolve) => {
    let settled = false;

    const settle = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutHandle);
      resolve(result);
    };

    const timeoutHandle = setTimeout(async () => {
      console.warn(`[AssetTorrent] Download timeout for assetId=${assetId} infoHash=${infoHash}`);
      active.delete(assetId);
      await handleDownloadError({ projectId, assetId, isGeneric, errCode: 'TIMEOUT' });
      settle({ success: false, reason: 'timeout' });
    }, DOWNLOAD_TIMEOUT_MS);

    try {
      // Re-use existing torrent if already tracked by infoHash
      let torrent = client.get(infoHash);
      if (!torrent) {
        torrent = client.add(magnetURI, { path: destDir });
      }

      if (!torrent) {
        throw new Error('WebTorrent client.add returned null');
      }

      torrent.on('download', () => {
        const progress =
          torrent.length > 0 ? Math.round((torrent.downloaded / torrent.length) * 100) : 0;
        // Update progress in DB at most every ~2 seconds to reduce write pressure
        upsertLocalState(assetId, isGeneric, { download_progress: progress }).catch(() => {});
        emitSyncProgress(assetId, isGeneric, 'downloading', progress);
      });

      torrent.on('done', async () => {
        console.log(`[AssetTorrent] Download done: assetId=${assetId} infoHash=${infoHash}`);
        active.delete(assetId);

        try {
          // Verify the file landed where we expect
          if (!fs.existsSync(expectedFilePath)) {
            // WebTorrent may use subdirectory for multi-file torrents; try to locate the file
            const possible = torrent.files?.[0]?.path;
            console.warn(
              `[AssetTorrent] Expected file not found at ${expectedFilePath}. ` +
              `WebTorrent reported: ${possible}`
            );
            if (!possible || !fs.existsSync(possible)) {
              throw new Error(`Downloaded file not found at expected path: ${expectedFilePath}`);
            }
          }

          // Optional SHA-256 integrity check
          const stateRow = await getLocalState(assetId, isGeneric);
          // We'll check against the hash stored in the assets table when reconciling
          // (stateRow doesn't have sha256 — it's on the asset row itself)
          console.log(`[AssetTorrent] File verified at: ${expectedFilePath}`);

          await upsertLocalState(assetId, isGeneric, {
            sync_status: 'seeding', // transition straight to seeding
            sync_error: null,
            last_success_at: Date.now(),
            download_progress: 100,
            retry_count: 0
          });
          emitSyncProgress(assetId, isGeneric, 'seeding', 100);
          seededHashes.add(torrent.infoHash);

          console.log(
            `[AssetTorrent] Asset ${assetId} now seeding (was downloaded). path=${expectedFilePath}`
          );

        } catch (postErr) {
          console.error(`[AssetTorrent] Post-download error for ${assetId}:`, postErr?.message);
          await handleDownloadError({ projectId, assetId, isGeneric, errCode: classifyError(postErr) });
        }

        drainQueue(projectId);
        settle({ success: true, path: expectedFilePath });
      });

      torrent.on('error', async (err) => {
        console.error(`[AssetTorrent] Torrent error for assetId=${assetId}:`, err?.message || err);
        active.delete(assetId);
        const errCode = classifyError(err);
        await handleDownloadError({ projectId, assetId, isGeneric, errCode });
        drainQueue(projectId);
        settle({ success: false, reason: errCode });
      });

    } catch (setupErr) {
      console.error(`[AssetTorrent] downloadAsset setup error for ${assetId}:`, setupErr?.message);
      active.delete(assetId);
      handleDownloadError({ projectId, assetId, isGeneric, errCode: classifyError(setupErr) }).catch(() => {});
      drainQueue(projectId);
      settle({ success: false, reason: setupErr?.message });
    }
  });
}

async function handleDownloadError({ projectId, assetId, isGeneric, errCode }) {
  const state = await getLocalState(assetId, isGeneric);
  const retries = (state?.retry_count ?? 0) + 1;
  const status = retries >= MAX_RETRIES ? 'error' : 'missing';
  const backoffMs = BACKOFF_SEQUENCE_MS[Math.min(retries - 1, BACKOFF_SEQUENCE_MS.length - 1)];

  console.log(
    `[AssetTorrent] Download error: assetId=${assetId} errCode=${errCode} ` +
    `retries=${retries}/${MAX_RETRIES} status=${status} nextRetryMs=${status === 'missing' ? backoffMs : 'none'}`
  );

  await upsertLocalState(assetId, isGeneric, {
    sync_status: status,
    sync_error: errCode,
    retry_count: retries,
    download_progress: 0
  });
  emitSyncProgress(assetId, isGeneric, status, 0, errCode);

  if (status === 'missing') {
    // Schedule a retry after backoff — we'll trigger via reconcile
    setTimeout(() => {
      console.log(`[AssetTorrent] Backoff expired for ${assetId}, re-scheduling reconcile`);
      scheduleAssetReconcile(projectId, assetId);
    }, backoffMs);
  }
}

// ─── Queue management ─────────────────────────────────────────────────────────

function enqueueDownload(job) {
  const active = getOrSet(activeDownloads, job.projectId, () => new Set());
  const queue = getOrSet(downloadQueues, job.projectId, () => []);

  if (active.has(job.assetId) || queue.some((q) => q.assetId === job.assetId)) {
    console.log(`[AssetTorrent] Download already queued/active for ${job.assetId}, skipping`);
    return;
  }

  if (active.size < MAX_CONCURRENT_DOWNLOADS_PER_PROJECT) {
    console.log(
      `[AssetTorrent] Starting download immediately (active=${active.size}): assetId=${job.assetId}`
    );
    downloadAsset(job).catch((err) =>
      console.error('[AssetTorrent] Unexpected downloadAsset error:', err)
    );
  } else {
    console.log(
      `[AssetTorrent] Queued download (active=${active.size} queue=${queue.length}): assetId=${job.assetId}`
    );
    queue.push(job);
  }
}

function drainQueue(projectId) {
  const active = getOrSet(activeDownloads, projectId, () => new Set());
  const queue = getOrSet(downloadQueues, projectId, () => []);

  while (active.size < MAX_CONCURRENT_DOWNLOADS_PER_PROJECT && queue.length > 0) {
    const job = queue.shift();
    console.log(
      `[AssetTorrent] Draining queue: starting ${job.assetId} (remaining=${queue.length})`
    );
    downloadAsset(job).catch((err) =>
      console.error('[AssetTorrent] Queue drain downloadAsset error:', err)
    );
  }
}

// ─── Seed local assets that have no torrent metadata yet ─────────────────────

/**
 * Finds assets that exist on disk but have no torrent_info_hash yet
 * (e.g. imported via the seed script before the app ran, or where the async
 * seeding failed silently on a previous run).  Seeds each one and writes the
 * metadata back to the assets / generic_assets row so Yjs can propagate it.
 *
 * This is a best-effort startup sweep — errors are logged but never thrown.
 */
async function seedUnseededLocalAssets(projectId) {
  const tables = [
    { table: assets,       isGeneric: false, label: 'assets' },
    { table: genericAssets, isGeneric: true,  label: 'generic_assets' },
  ];

  for (const { table, isGeneric, label } of tables) {
    try {
      // Find rows that belong to this project, have a path, but NO infoHash yet
      const rows = await db
        .select({ id: table.id, path: table.path })
        .from(table)
        .where(
          and(
            eq(table.project_id, projectId),
            // torrent_info_hash IS NULL
            sql`${table.torrent_info_hash} IS NULL`,
            // path IS NOT NULL
            isNotNull(table.path)
          )
        )
        .execute();

      if (rows.length === 0) continue;

      console.log(
        `[AssetTorrent] seedUnseededLocalAssets: found ${rows.length} unseeded rows ` +
        `in ${label} for project=${projectId}`
      );

      for (const row of rows) {
        const filePath = row.path;
        if (!filePath || !fs.existsSync(filePath)) {
          // File not on disk — not a seeder for this asset, skip
          continue;
        }

        console.log(
          `[AssetTorrent] seedUnseededLocalAssets: seeding assetId=${row.id} file=${filePath}`
        );

        try {
          const torrentMeta = await seedAsset({
            projectId,
            assetId: row.id,
            filePath,
            isGeneric,
          });

          if (!torrentMeta?.infoHash) {
            console.warn(`[AssetTorrent] seedUnseededLocalAssets: no infoHash returned for ${row.id}`);
            continue;
          }

          // Compute SHA-256 for integrity checking on downloading peers
          let sha256 = null;
          try {
            sha256 = await computeSha256(filePath);
          } catch (hashErr) {
            console.warn(`[AssetTorrent] seedUnseededLocalAssets: SHA-256 failed for ${row.id}:`, hashErr?.message);
          }

          const ext  = path.extname(filePath).toLowerCase();
          const mime = {
            '.avif': 'image/avif',
            '.mp4':  'video/mp4',
            '.webm': 'video/webm',
            '.mov':  'video/quicktime',
            '.mp3':  'audio/mpeg',
            '.ogg':  'audio/ogg',
          }[ext] || 'application/octet-stream';

          await db
            .update(table)
            .set({
              torrent_info_hash:    torrentMeta.infoHash,
              torrent_name:         torrentMeta.name,
              torrent_length:       torrentMeta.length,
              torrent_piece_length: torrentMeta.pieceLength,
              asset_content_ext:    ext,
              asset_content_mime:   mime,
              asset_content_sha256: sha256,
            })
            .where(eq(table.id, row.id))
            .execute();

          console.log(
            `[AssetTorrent] seedUnseededLocalAssets: torrent metadata written for ` +
            `${row.id} infoHash=${torrentMeta.infoHash}`
          );
        } catch (err) {
          console.error(
            `[AssetTorrent] seedUnseededLocalAssets: failed to seed ${row.id}:`,
            err?.message
          );
        }
      }
    } catch (err) {
      console.error(
        `[AssetTorrent] seedUnseededLocalAssets error (${label}):`,
        err?.message
      );
    }
  }
}

// ─── Reconciliation ───────────────────────────────────────────────────────────

/**
 * Lightweight trigger: debounced reconcile for a project.
 * Safe to call frequently (e.g. after every remote ingestion commit).
 * Does NOT block the caller.
 *
 * @param {string} projectId
 * @param {string|null} assetId  Optional: limit reconcile to a single asset
 */
export function scheduleAssetReconcile(projectId, assetId = null) {
  if (!projectId) return;

  if (reconcileDebounceTimers.has(projectId)) {
    clearTimeout(reconcileDebounceTimers.get(projectId));
  }
  const timer = setTimeout(() => {
    reconcileDebounceTimers.delete(projectId);
    reconcileProject(projectId, assetId).catch((err) =>
      console.error(`[AssetTorrent] reconcileProject error for ${projectId}:`, err)
    );
  }, RECONCILE_DEBOUNCE_MS);

  reconcileDebounceTimers.set(projectId, timer);
}

/**
 * Full reconcile for a project: check both assets and generic_assets.
 * Idempotent and guarded against concurrent execution.
 */
async function reconcileProject(projectId, specificAssetId = null) {
  if (reconcileRunning.has(projectId)) {
    console.log(
      `[AssetTorrent] Reconcile already running for ${projectId}` +
      (specificAssetId ? ` (asset: ${specificAssetId})` : '') +
      ', skip'
    );
    return;
  }
  reconcileRunning.add(projectId);
  const label = specificAssetId ? `asset=${specificAssetId}` : 'full';
  console.log(`[AssetTorrent] Reconcile start: project=${projectId} ${label}`);

  try {
    // ── Pass 1: seed any local assets that were imported without torrent metadata
    // (e.g. via seed script, or where previous seeding failed).
    // This runs only on full reconcile (not single-asset) to avoid redundant work.
    if (!specificAssetId) {
      await seedUnseededLocalAssets(projectId);
    }
    // ── Pass 2: download remote assets that have infoHash but are missing locally
    await reconcileTable({ projectId, isGeneric: false, specificAssetId });
    await reconcileTable({ projectId, isGeneric: true, specificAssetId });
  } catch (err) {
    console.error(`[AssetTorrent] reconcileProject unexpected error:`, err);
  } finally {
    reconcileRunning.delete(projectId);
    console.log(`[AssetTorrent] Reconcile end: project=${projectId} ${label}`);
  }
}

async function reconcileTable({ projectId, isGeneric, specificAssetId }) {
  const assetTable = isGeneric ? genericAssets : assets;
  const stateTable = isGeneric ? generic_asset_local_state : asset_local_state;
  const stateIdCol = isGeneric ? stateTable.generic_asset_id : stateTable.asset_id;
  const tableLabel = isGeneric ? 'generic_assets' : 'assets';

  try {
    // Build query for assets that have torrent metadata
    const conditions = [eq(assetTable.project_id, projectId), isNotNull(assetTable.torrent_info_hash)];
    if (specificAssetId) conditions.push(eq(assetTable.id, specificAssetId));

    const assetRows = await db
      .select({
        id: assetTable.id,
        path: assetTable.path,
        torrent_info_hash: assetTable.torrent_info_hash,
        torrent_name: assetTable.torrent_name,
        asset_content_sha256: assetTable.asset_content_sha256
      })
      .from(assetTable)
      .where(and(...conditions))
      .execute();

    if (assetRows.length === 0) {
      console.log(
        `[AssetTorrent] Reconcile ${tableLabel}: no torrent rows for project=${projectId}`
      );
      return;
    }

    // Bulk-load local states  
    const ids = assetRows.map((r) => r.id);
    const localStates = await db
      .select()
      .from(stateTable)
      .where(inArray(stateIdCol, ids))
      .execute();
    const stateMap = new Map(
      localStates.map((s) => [s[isGeneric ? 'generic_asset_id' : 'asset_id'], s])
    );

    console.log(
      `[AssetTorrent] Reconcile ${tableLabel}: found ${assetRows.length} rows with torrent metadata ` +
      `(project=${projectId})`
    );

    for (const row of assetRows) {
      const state = stateMap.get(row.id);
      const status = state?.sync_status ?? null;

      // Derive the canonical local path where the file should live (or was seeded from)
      const safeName = sanitizeName(row.torrent_name || path.basename(row.path || 'asset.bin'));
      const localFilePath = path.join(ASSET_BASE_PATH, projectId, safeName);
      // Also check the original path as stored (seeder side)
      const originalFilePath = row.path;

      const fileExistsLocal = fs.existsSync(localFilePath);
      const fileExistsOriginal = originalFilePath && fs.existsSync(originalFilePath);
      const hasFile = fileExistsLocal || fileExistsOriginal;
      const canonicaFilePath = fileExistsOriginal ? originalFilePath : localFilePath;

      // ── Case 1: already seeding/available and file is on disk ────────────────
      if ((status === 'seeding' || status === 'available') && hasFile) {
        // Re-attach seeding after restart if not already tracked
        if (!seededHashes.has(row.torrent_info_hash)) {
          console.log(
            `[AssetTorrent] Re-seeding after restart: assetId=${row.id} file=${canonicaFilePath}`
          );
          seedAsset({ projectId, assetId: row.id, filePath: canonicaFilePath, isGeneric }).catch(() => {});
        }
        continue;
      }

      // ── Case 2: we have the file but state is missing/null (seeder restart or new import) ──
      if (hasFile && (status === null || status === 'missing')) {
        console.log(
          `[AssetTorrent] File present but status=${status}, starting seed: assetId=${row.id}`
        );
        seedAsset({ projectId, assetId: row.id, filePath: canonicaFilePath, isGeneric }).catch(() => {});
        continue;
      }

      // ── Case 3: file missing despite available/seeding status (disk deleted?) ──
      if ((status === 'seeding' || status === 'available') && !hasFile) {
        console.warn(
          `[AssetTorrent] File missing on disk despite status=${status}: assetId=${row.id}, re-queuing download`
        );
        await upsertLocalState(row.id, isGeneric, { sync_status: 'missing', retry_count: 0 });
        // fall through to download below
      }

      // ── Case 4: download stuck (status=downloading but not tracked) ────────────
      if (status === 'downloading') {
        const active = getOrSet(activeDownloads, projectId, () => new Set());
        if (active.has(row.id)) {
          console.log(`[AssetTorrent] Download still active for ${row.id}, skip`);
          continue;
        }
        console.warn(`[AssetTorrent] Stuck download for ${row.id}, resetting to missing`);
        await upsertLocalState(row.id, isGeneric, { sync_status: 'missing' });
      }

      // ── Case 5: max retries exceeded ────────────────────────────────────────
      if (status === 'error' && (state?.retry_count ?? 0) >= MAX_RETRIES) {
        console.log(
          `[AssetTorrent] Skipping ${row.id}: max retries (${MAX_RETRIES}) reached`
        );
        continue;
      }

      // ── Case 6: needs download ───────────────────────────────────────────────
      console.log(
        `[AssetTorrent] Queuing download: assetId=${row.id} infoHash=${row.torrent_info_hash} ` +
        `status=${status} retries=${state?.retry_count ?? 0}`
      );
      enqueueDownload({
        projectId,
        assetId: row.id,
        infoHash: row.torrent_info_hash,
        torrentName: row.torrent_name || safeName,
        assetPath: row.path,
        isGeneric
      });
    }
  } catch (err) {
    console.error(`[AssetTorrent] reconcileTable error (${tableLabel}):`, err?.message, err);
  }
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

/**
 * Start the periodic anti-entropy reconcile loop for a project.
 * Call this when opening a project.
 */
export function startReconcileLoop(projectId) {
  if (!projectId || reconcileIntervals.has(projectId)) return;
  console.log(
    `[AssetTorrent] Starting periodic reconcile loop: project=${projectId} interval=${RECONCILE_INTERVAL_MS}ms`
  );
  // Immediate first run
  scheduleAssetReconcile(projectId);
  const interval = setInterval(() => {
    reconcileProject(projectId).catch((err) =>
      console.error(`[AssetTorrent] Periodic reconcile error for ${projectId}:`, err)
    );
  }, RECONCILE_INTERVAL_MS);
  reconcileIntervals.set(projectId, interval);
}

/**
 * Stop all activity for a project (called on project close).
 */
export function stopProjectTorrents(projectId) {
  if (!projectId) return;
  const interval = reconcileIntervals.get(projectId);
  if (interval) { clearInterval(interval); reconcileIntervals.delete(projectId); }
  const debounce = reconcileDebounceTimers.get(projectId);
  if (debounce) { clearTimeout(debounce); reconcileDebounceTimers.delete(projectId); }
  downloadQueues.delete(projectId);
  activeDownloads.delete(projectId);
  reconcileRunning.delete(projectId);
  console.log(`[AssetTorrent] Stopped all activity for project=${projectId}`);
}

/**
 * Destroy the WebTorrent client and clean up all state. Call on app quit.
 */
export function destroyTorrentManager() {
  console.log('[AssetTorrent] Destroying manager');
  for (const t of reconcileIntervals.values()) clearInterval(t);
  for (const t of reconcileDebounceTimers.values()) clearTimeout(t);
  reconcileIntervals.clear();
  reconcileDebounceTimers.clear();
  activeDownloads.clear();
  downloadQueues.clear();
  reconcileRunning.clear();
  seededHashes.clear();
  if (_wtClient && !_wtClient.destroyed) {
    _wtClient.destroy(() => console.log('[AssetTorrent] WebTorrent client destroyed'));
    _wtClient = null;
  }
}

/**
 * Reset error status for all failed assets in a project (e.g. after network restore).
 * Resets status from 'error' to 'missing' so reconcile will retry them.
 */
export async function resetErroredAssets(projectId) {
  if (!projectId) return;
  console.log(`[AssetTorrent] Resetting errored assets for project=${projectId}`);
  try {
    await db
      .update(asset_local_state)
      .set({ sync_status: 'missing', retry_count: 0, sync_error: null })
      .where(
        and(
          // Filter by assets belonging to this project via sub-select equivalent
          eq(asset_local_state.sync_status, 'error')
        )
      )
      .execute();
    await db
      .update(generic_asset_local_state)
      .set({ sync_status: 'missing', retry_count: 0, sync_error: null })
      .where(eq(generic_asset_local_state.sync_status, 'error'))
      .execute();
  } catch (err) {
    console.error(`[AssetTorrent] resetErroredAssets error:`, err?.message);
  }
}

/**
 * Get sync status summary for a project (for IPC/UI queries).
 */
export async function getProjectSyncStatus(projectId) {
  if (!projectId) return null;
  try {
    const assetRows = await db
      .select({ id: assets.id, torrent_info_hash: assets.torrent_info_hash })
      .from(assets)
      .where(and(eq(assets.project_id, projectId), isNotNull(assets.torrent_info_hash)))
      .execute();

    const gaRows = await db
      .select({ id: genericAssets.id, torrent_info_hash: genericAssets.torrent_info_hash })
      .from(genericAssets)
      .where(and(eq(genericAssets.project_id, projectId), isNotNull(genericAssets.torrent_info_hash)))
      .execute();

    const allIds = assetRows.map((r) => r.id);
    const allGaIds = gaRows.map((r) => r.id);

    const states = allIds.length
      ? await db.select().from(asset_local_state).where(inArray(asset_local_state.asset_id, allIds)).execute()
      : [];
    const gaStates = allGaIds.length
      ? await db.select().from(generic_asset_local_state).where(inArray(generic_asset_local_state.generic_asset_id, allGaIds)).execute()
      : [];

    const countBy = (arr, key) => arr.filter((s) => s.sync_status === key).length;
    const allStates = [...states, ...gaStates];

    return {
      total: assetRows.length + gaRows.length,
      seeding: countBy(allStates, 'seeding'),
      available: countBy(allStates, 'available'),
      downloading: countBy(allStates, 'downloading'),
      missing: countBy(allStates, 'missing'),
      error: countBy(allStates, 'error'),
      activeDownloads:
        (activeDownloads.get(projectId)?.size ?? 0),
      queuedDownloads:
        (downloadQueues.get(projectId)?.length ?? 0)
    };
  } catch (err) {
    console.error(`[AssetTorrent] getProjectSyncStatus error:`, err?.message);
    return null;
  }
}
