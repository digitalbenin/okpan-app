
# Asset P2P Sync Process (WebTorrent + Yjs/Trystero Control Plane)

## 1. Scope and Decision

This document defines the **authoritative** process for syncing asset binaries between peers.

### Chosen strategy

- Keep existing Yjs + DB ingestion pipeline for **metadata only**.
- Use **WebTorrent** for **binary payload transfer** (P2P only).
- Use Trystero/Yjs events to trigger asset download checks.

### Asset size variant policy

Based on `src/backend/handlers/assetHandlers.js`:

- Images are converted to AVIF through `makeAVIF()`.
- Three files are generated (`sm`, `md`, `original`), but DB `path` stores `formats.original`.
- **Only `original` AVIF is synchronized over P2P**.
- `sm` and `md` are local derivatives and are **not part of network sync**.

> Note: For non-AVIF source images, the synced file is still AVIF (`original` output), preserving dimensions but changing encoding.

---

## 2. Current Architecture Constraints (Observed)

- `p2pService.js` currently syncs Yjs doc/table updates (row-level).
- `snapshotService.js` hydrates relational data into doc maps.
- `remoteIngestionHandler.js` ingests row changes into SQLite tables.
- `assetHandlers.js` writes files into filesystem and stores DB rows.

Problem: asset rows replicate, but file bytes do not.

---

## 3. Data Model Additions (Metadata Only)

Use dedicated P2P tables instead of adding all necessary fields directly to `assets` / `generic_assets`.

- `asset_p2p` with `asset_id` (UNIQUE, FK -> `assets.id`, ON DELETE CASCADE)
- `generic_asset_p2p` with `generic_asset_id` (UNIQUE, FK -> `generic_assets.id`, ON DELETE CASCADE)

Store in each table:

- `torrent_info_hash` TEXT NULL
- `torrent_name` TEXT NULL
- `torrent_length` INTEGER NULL
- `torrent_piece_length` INTEGER NULL
- `asset_sync_status` TEXT NULL (`missing|downloading|available|seeding|error`)
- `asset_sync_error` TEXT NULL
- `asset_content_mime` TEXT NULL
- `asset_content_ext` TEXT NULL
- `asset_content_sha256` TEXT NULL
- `retry_count` INTEGER NOT NULL DEFAULT 0
- `last_attempt_at` INTEGER NULL (timestamp)
- `last_success_at` INTEGER NULL (timestamp)

Why this is recommended:

- enforces true 1:1 integrity with DB constraints
- keeps business asset tables clean from transport/runtime concerns
- simplifies future additions (peer stats, cooldowns, diagnostics)



### Important semantics

- `path` remains local cache path, not global locator.
- `torrent_info_hash` is the global P2P locator.
- A row is considered remotely fetchable iff `torrent_info_hash` is not null.

---

## 4. Filesystem Layout

Use a project-local deterministic cache root:

- `src/assets/project_assets/<projectId>/...` (existing import location)
- Add torrent runtime folder:
  - `.torrent-cache/<projectId>/` (resume/session metadata)
  - `.torrent-temp/<projectId>/` (in-progress temp files, optional)

Recommended final asset location:

- Keep existing location used by app (`project_assets/<projectId>/...`).
- WebTorrent writes final file there (avoid duplicate permanent copies).

---

## 5. End-to-End Flow

## 5.1 Import (local peer)

1. User imports file.
2. `assetHandlers.processAssetFile()` generates AVIF set.
3. Save DB row using `formats.original` path.
4. Start WebTorrent seeding for the `original` AVIF file.
5. Read generated torrent metadata (`infoHash`, length, piece length, name).
6. Update the same DB row with torrent metadata fields.
7. Existing Yjs sync propagates the row update to peers.

## 5.2 Remote ingestion (other peer)

1. Peer receives metadata row via current Yjs->DB ingestion.
2. Post-commit hook checks:
   - row has `torrent_info_hash`
   - local file for that hash/path is absent
3. Queue download job (`projectId`, `assetId`, `torrent_info_hash`).
4. WebTorrent client downloads file from swarm.
5. On success:
   - write final file path
   - set `asset_sync_status=available`
   - optionally start seeding
6. On failure:
   - set `asset_sync_status=error`, record reason
   - retry with backoff.

---

## 6. Trigger Points: When a Peer Looks for Assets

A peer must reconcile missing assets on all of these events:

1. **After remote row ingestion commit** (primary trigger).
2. **Project open/startup** (initial reconciliation).
3. **After snapshot hydration completes**.
4. **After reconnect/network restoration**.
5. **Periodic anti-entropy loop** (every 60-180s, configurable).

Reconciliation query:

- Select rows where `torrent_info_hash IS NOT NULL`
- AND (`asset_sync_status IS NULL OR asset_sync_status IN ('missing','error')`)
- OR file missing on disk despite `available`.

---

## 7. WebTorrent Integration Plan

## 7.1 `p2pService.js`

Add an `AssetTorrentManager` (singleton per process), with map keyed by `projectId`.

Responsibilities:

- create/reuse `WebTorrent` client
- seed files
- add/download torrents by `infoHash`
- track progress per asset
- emit status updates to DB/UI

Minimal methods:

- `seedAsset({ projectId, assetId, filePath, name })`
- `downloadAsset({ projectId, assetId, infoHash, destPath })`
- `ensureReconcile(projectId)`
- `stopProject(projectId)`
- `destroy()`

## 7.2 `remoteIngestionHandler.js`

After successful insert/update of `assets` and `generic_assets`, invoke lightweight enqueue:

- `scheduleAssetReconcile(projectId, assetId?)`

Do not block ingestion on download.

## 7.3 `snapshotService.js`

After `hydrateProjectFromLatestSnapshot()` / replay completion, call:

- `scheduleAssetReconcile(projectId)`

## 7.4 `assetHandlers.js`

After DB row creation for imported original AVIF:

- call `seedAsset(...)`
- persist torrent metadata back to the same row.

---

## 8. Torrent Metadata Lifecycle

### Create/seed metadata

- Prefer magnet-only workflow (`infoHash` + name + length) unless `.torrent` persistence is required.
- Persist enough data in DB to re-attach seeding after restart.

### Resume on restart

At app startup/project open:

1. Query all local rows with `torrent_info_hash`.
2. For rows with existing local file:
   - re-seed.
3. For missing local file:
   - set `missing` and enqueue download.

---

## 9. Error Handling and Retries

Retry policy:

- exponential backoff: 5s, 15s, 30s, 60s, 120s (cap)
- max attempts before status `error`
- reset attempts when a new peer appears or network reconnects.

Classify errors:

- `NO_PEERS`
- `TIMEOUT`
- `HASH_MISMATCH`
- `DISK_WRITE`
- `PERMISSION`
- `UNKNOWN`

Persist `asset_sync_error` for diagnostics.

---

## 10. Integrity and Security

- WebTorrent piece validation is mandatory (automatic).
- Optionally verify `asset_content_sha256` after full download for app-level assurance.
- Never trust remote-provided local file path.
- Write downloads into controlled project folders only.
- Sanitize names to prevent path traversal.

---

## 11. Concurrency Limits

Recommended defaults:

- max active downloads per project: `3`
- max active seeds per project: `unlimited` (practically bounded)
- global max active torrents: `20`

Queue rest in FIFO with priority for rows recently edited/opened.

---

## 12. UI/Telemetry Expectations

Progress fields/events per asset:

- `queued`
- `downloading` (%)
- `verifying`
- `available`
- `error`

Emit through existing IPC/event channels to renderer.

Log counters:

- total remote assets
- missing assets
- active downloads
- completed in session
- failed in session

---

## 13. Migration Checklist

1. Add schema fields (`torrent_info_hash`, etc.) to `assets` and `generic_assets`.
2. Add WebTorrent dependency and manager module.
3. Wire seeding in `assetHandlers` post-import.
4. Wire reconcile triggers in `remoteIngestionHandler` and `snapshotService`.
5. Add startup/project-open reconciliation.
6. Add status persistence and retry loop.
7. Add integration tests.

---

## 14. Acceptance Criteria

1. Importing an image on Peer A creates AVIF original and seeds it.
2. Peer B receives row metadata and auto-downloads without manual action.
3. Peer B stores file and marks asset available.
4. App restart on both peers resumes seeding/downloading correctly.
5. Temporary disconnect resumes without full restart.
6. No binary content is inserted into Yjs document updates.
7. `sm`/`md` are never required for sync correctness.

---

## 15. Non-Goals (for this phase)

- Sync of `sm`/`md` derivatives.
- Tracker infrastructure beyond current P2P setup (unless needed later).
- Replacing existing Yjs DB ingestion architecture.

---