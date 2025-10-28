# Yjs ↔ SQLite Sync Action Plan (Triggers, Updates, Snapshots)

This document describes a fresh, database-native synchronization backbone that does not rely on GraphQL semantics. It captures all writes via SQLite triggers, projects them into Yjs updates for transport, and periodically checkpoints state with snapshots. The design keeps SQLite as the source of truth and treats Yjs as an append-only event transport and projection.

## Goals & Scope
- Capture every row-level change regardless of write path (ORM, raw SQL, batch imports).
- Derive deterministic Yjs updates from the database’s canonical change stream.
- Support high-throughput bursts (thousands of writes per transaction) without drift or loss.
- Provide fast boot and recovery using periodic snapshots plus tail replay.
- Keep design simple, testable, and operationally reliable.

## Core Components
- Change Log: A canonical event stream written by SQLite triggers for each INSERT/UPDATE/DELETE on selected tables.
- Yjs Updates: An append-only record of small Yjs updates derived from the change log, ordered and idempotent.
- Y.Doc: In-memory CRDT per project that represents the current projection; only driven by the change log.
- Snapshots: Periodic full-state Yjs bytes with a precise watermark to avoid long tail replays at startup.

## Sequential Development Plan (Full Project Sync)

1) Define sync tables in `src/db/schema.js`
- Outcome: Add `change_log`, `yjs_updates`, `yjs_snapshots`, and optional `ingestion_state` to schema alongside existing domain tables.
- Test: Reset DB; start app; run a simple `select` on each new table to confirm visibility via Drizzle.

2) Create triggers for core project tables
- Outcome: Add AFTER `INSERT/UPDATE/DELETE` triggers in `src/db/migrations/002_change_log_triggers.sql` for `project`, `settings`, `website_settings`, `object_display_fields`, `research_fields`, `ontology_fields`, `assets`, `generic_assets`, `objects`, `templates`, `languages`, `institutions`.
- Test: Perform CRUD on each table; verify one `change_log` row per committed row mutation with correct `project_id`, `table`, `op`, and payload.

3) Create triggers for junction tables
- Outcome: Add triggers for `objects_assets`, `assets_institutions`, `objects_research_fields`, `objects_ontology_fields`, `vocabularies_generic_assets` to emit `change_log` entries on association changes.
- Test: Link/unlink rows; verify `change_log` emits rows with derived `project_id` and correct payload.

4) Create triggers for texts, translations, vocabularies, datasources, imports
- Outcome: Add triggers for `texts`, `translations`, `vocabularies`, `datasources`, `imports` with `project_id` derivation per the matrix below.
- Test: Edit text content, add translations, create vocabularies/datasources/imports; verify `change_log` coverage and consistent `project_id`.

5) Implement project_id derivation in triggers
- Outcome: Use parent references to derive `project_id` when the table doesn’t store it directly (see derivation matrix in this document).
- Test: For each derivation path, mutate a row and confirm `project_id` in `change_log` matches the expected parent project.

6) Index `change_log` for ordered ingestion
- Outcome: Create index on `(project_id, timestamp, id)` via migrations for deterministic reads.
- Test: Query ordered pages; confirm stable ordering for same-second events.

7) Implement `src/backend/services/yDocRegistry.js`
- Outcome: Manage a per-project live `Y.Doc` with arrays for all covered tables; row-shaped entries with stable keys.
- Test: Create a doc; assert arrays exist; dispose without leaks.

8) Implement `src/backend/services/changeLogTailer.js`
- Outcome: Read committed `change_log` rows after the watermark, group by `project_id`, apply in a single `Y.Doc` transaction, produce Yjs bytes, persist to `yjs_updates`, advance watermark.
- Test: Seed `change_log` with mixed table mutations; run tailer; assert `yjs_updates` rows and `Y.Doc` arrays reflect DB state.

9) Implement `src/backend/services/snapshotService.js`
- Outcome: Encode full-state Yjs bytes with `last_change_id` and optional `state_vector`; persist to `yjs_snapshots`; load snapshot and replay `yjs_updates` on boot.
- Test: Create snapshot; restart; verify fast boot and equality of state before/after (including `encodeStateVector` check).

10) Wire boot in `src/backend/main.js`
- Outcome: On start, hydrate each active project from latest snapshot, then start tailer; ensure services are initialized in order.
- Test: Cold start with and without snapshots; confirm proper hydration and ingestion begins at the expected watermark.

11) Implement `src/backend/services/projectScope.js`
- Outcome: Closure service that enumerates all rows for a given `project_id` across covered tables plus dependent `texts/translations/languages` for snapshot manifests.
- Test: For a seeded project, compare counts from the closure service to direct DB queries; ensure equivalence.

12) Implement `src/backend/services/remoteTransport.js`
- Outcome: Event-based interface to send/receive Yjs updates and snapshots over WebRTC; supports chunking, ACKs, and backpressure.
- Test: Simulate inbound/outbound events; confirm handlers fire and ACK flow works.

13) Implement snapshot chunking and manifest
- Outcome: Split large `snapshot_bytes` into transport-size chunks; include a manifest of arrays and counts; verify integrity on receive.
- Test: Send a snapshot; reconstruct on receiver; validate array counts match `projectScope.js` closure.

14) Implement `src/backend/services/remoteIngestion.js` (SQLite-first)
- Outcome: Apply inbound bytes to a shadow `Y.Doc`, derive SQL for all covered tables, commit atomically, triggers emit `change_log`.
- Test: Simulate remote inserts/updates/deletes across multiple tables; confirm DB commits and subsequent live `Y.Doc` updates via tailer.

15) Implement DB rebuild from snapshot
- Outcome: Build a FK-safe insertion order: parents (`project`, `languages`, `texts`) → dependents (`institutions`, `objects`) → junctions; apply snapshot rows accordingly.
- Test: Wipe DB; rebuild from snapshot; verify counts per table and spot-check joins and foreign keys.

16) Implement incremental updates after snapshot
- Outcome: After snapshot hydration, consume `yjs_updates` over WebRTC; apply via remote ingestion; ensure exactly-once processing with watermarks/ACK ranges.
- Test: Perform edits on sender across core and junction tables; verify receiver remains consistent and watermark advances.

17) Implement echo prevention
- Outcome: Stamp `origin='remote'` and `client_id` on remote commits; skip re-emitting remote-origin changes in broadcaster logic.
- Test: Round-trip a remote mutation; ensure no duplicate outbound broadcast is generated.

18) Optional conflict policies
- Outcome: Add CAS on `updated_at` (or a version field) for sensitive rows; buffer dependent ops; maintain deterministic inbound ordering.
- Test: Simulate competing edits (e.g., uniqueness collisions); verify behavior (reject/merge/retry) per policy.

19) Observability metrics
- Outcome: Emit lag, rows per batch, update sizes, snapshot duration, replay times; add a lightweight debug IPC endpoint.
- Test: Run a burst import; confirm metrics captured and lag returns to baseline.

20) Retention and pruning
- Outcome: Keep the latest two snapshots; retain `yjs_updates` from the penultimate snapshot forward; prune older updates.
- Test: After new snapshot, run pruning; verify safe fallback remains via penultimate snapshot.

21) Crash and restart resilience
- Outcome: Ensure tailer idempotency if a crash occurs after update generation but before persistence; resume cleanly from the watermark.
- Test: Simulate a crash at this boundary; restart; verify no duplicate application and correct watermark.

22) Production readiness gate
- Outcome: Checklist covering trigger coverage for all tables, deterministic rebuild, exactly-once updates, conflict policy decisions, observability, recovery, retention, and transport sanity.
- Test: Execute the checklist against staged datasets; sign off when all gates pass.

## Why the `yjs_updates` Table
- Purpose:
  - Persist an append-only stream of Yjs update bytes derived from `change_log`.
  - Decouple the domain event source (`change_log`) from the CRDT projection, enabling fast boot, deterministic replay, and external transport.
- What it enables:
  - Fast bootstrap: Load the latest snapshot, then replay only recent `yjs_updates` instead of re-deriving from thousands of raw domain events.
  - Deterministic projection: Store the exact Yjs bytes produced by ingestion batches; any peer applying them to a `Y.Doc` reaches the same state.
  - Transport-friendly feed: Peers can consume `yjs_updates` without knowing table schema or business rules; they only need Yjs.
  - Idempotent recovery: Each persisted update is linked to a `(from_change_id, to_change_id)` range; the tailer resumes precisely after the last persisted range.
  - Debuggability: Correlate `change_log` rows to resulting `yjs_updates` to audit projection correctness and performance.
- Why not just `change_log`:
  - Re-derivation cost: Building Yjs updates from raw row JSON on every boot or remote sync is expensive, especially after large imports.
  - Schema coupling: Remote peers would need your table semantics to generate consistent updates; with `yjs_updates`, they don’t.
  - Update granularity: Ingestion may batch many `change_log` rows into one compact Yjs transaction; persisting the produced bytes preserves that compaction.
  - Operational safety: Persisted `yjs_updates` provides an exact “what was applied” record; relying solely on re-derivation risks divergence if ingest logic changes across versions.
- Runtime use:
  - Ingestion reads `change_log` in order and applies changes to the project’s `Y.Doc` inside a single CRDT transaction (batch).
  - The transaction produces Yjs bytes; these are appended to `yjs_updates` with `project_id`, `(from_change_id, to_change_id)`, and `created_at`.
  - The watermark (`last_processed_change_id`) advances atomically after persisting, ensuring exactly-once replay semantics.
- Snapshots and retention:
  - Boot: Load latest snapshot, then replay `yjs_updates` strictly after the snapshot’s watermark; skip re-derivation from `change_log`.
  - Revert safety: Keep the last two snapshots and retain `yjs_updates` from the penultimate snapshot forward. If the latest snapshot fails, revert to the penultimate and replay updates from its watermark.
  - Pruning: Once a new snapshot is safely persisted, prune older `yjs_updates` prior to the penultimate snapshot to bound storage while preserving a safe fallback path.
- Performance advantages:
  - Batching reduces write amplification: One Yjs update can represent hundreds of row changes compactly.
  - Smaller payloads: Yjs updates are often smaller than storing full per-row deltas repeatedly.
  - Storage and IO efficiency: Appending `yjs_updates` reduces random writes compared to per-row duplication.
- When you could skip it:
  - If you only need a local, ephemeral `Y.Doc`, never sync to peers, and accept slower boot by rebuilding from `change_log` each time, you can omit `yjs_updates`. You’ll lose fast boot, transport readiness, and the revert-friendly retention workflow.
- Naming:
  - Use `yjs_updates` consistently; it stores the CRDT update bytes plus ordering metadata.

## Trigger Strategy (Row-Level Event Capture)
- Per-table triggers: Define AFTER INSERT/UPDATE/DELETE triggers on primary domain tables (e.g., `objects`, `institutions`, `datasources`, `texts`, `translations`, junction tables).
- Payload content:
  - Table name, row ID, operation type (`INSERT`, `UPDATE`, `DELETE`).
  - Project ID (if the entity carries it or can be resolved), client ID (from a singleton `globalSettings`), `created_at`.
  - Row data as JSON:
    - For INSERT/UPDATE: new row fields (minimal or full; see “Delta vs Full” below).
    - For UPDATE/DELETE: old row fields when helpful for diffing.
- Determinism:
  - Emit one log entry per changed row with a unique ID, ensuring stable ordering even when timestamps collide.
  - For updates, include enough context to compute changed fields deterministically later.
- Scope and coverage:
  - Start with the most-used tables (objects, institutions) and extend incrementally.
  - Include junction tables (e.g., object–ontology relations) to track association changes.
- Echo prevention (future transport):
  - Include `client_id` (who wrote) and an optional origin tag if remote ingestion is added, so receivers can avoid re-emitting echoed changes.

## Transactions & Semantics
- Trigger execution:
  - Triggers fire per row inside the transaction, but change log writes become visible only after the transaction commits.
  - This guarantees atomicity: either all change log rows from a transaction appear, or none do.
- Large transactions:
  - Bursts (thousands of rows) produce contiguous log blocks; tailer processes them in order after commit.
  - Ensure readers consume committed ranges; ingestion runs after commit to avoid lock contention.
- Ordering:
  - Process log entries ordered by `(created_at, id)` to maintain a deterministic sequence across same-second events.
- Idempotency:
  - Treat each change log row as a unique event; ensure downstream update derivation is idempotent.
  - Track a watermark (`last_processed_change_id`) to avoid reprocessing.

## Change Ingestion Pipeline
- Polling model:
  - Periodically read change log rows strictly after the last watermark, in bounded batches (e.g., 100–500 rows).
  - Group rows by `project_id` to apply to the appropriate `Y.Doc`.
- Yjs projection:
  - For each batch, apply changes inside a single `Y.Doc` transaction to produce compact and ordered updates.
  - Decide granularity:
    - One Yjs update per row (simpler, more updates).
    - One Yjs update per batch (fewer updates, better performance).
- Persist updates:
  - Append the resulting Yjs update bytes to `yjs_updates` with `change_id` range, `project_id`, and `created_at`.
  - Advance the watermark atomically after successful persistence.
- Reprocessing & failure handling:
  - If a batch fails after update generation but before persistence, re-run the batch; updates are idempotent.
  - On startup, resume from the last watermark; do not reapply previously processed changes.

## Remote Transport Ingestion (SQLite-first Order)
- Decision:
  - Use SQLite-first reception for inbound remote updates. The live `Y.Doc` is driven only by committed database changes (`change_log`). Remote bytes are used to derive SQL mutations and are not applied to the live `Y.Doc` prior to commit.
- Workflow (receive → commit → project):
  - Receive remote Yjs update bytes via transport (e.g., `y-webrtc`).
  - Stage on a shadow `Y.Doc` to compute row-level mutations against map projections keyed by `id` (e.g., `objects`, `institutions`); use arrays of IDs only for derived order views when needed.
  - Map mutations to SQL (`INSERT`/`UPDATE`/`DELETE`) and execute them inside a single SQLite transaction in dependency order; include `project_id`, `client_id`, and `origin='remote'` where applicable.
  - On commit, triggers write `change_log` rows. The tailer later processes these rows, produces `yjs_updates`, and applies them to the live `Y.Doc` deterministically.
- Why SQLite-first:
  - Constraint safety: Foreign keys, uniqueness, and cascades are enforced before any local CRDT state changes.
  - No CRDT rollback: If a commit fails, the live `Y.Doc` has not changed; discard inbound bytes or NACK the peer.
  - Clean provenance: Only committed rows appear in `change_log`; watermarks and snapshots advance exactly-once after persistence.
- Echo prevention & dedupe:
  - Stamp `client_id` and `origin='remote'` on committed rows. Broadcasters avoid re-emitting remote-origin events, preventing loops.
  - Because remote bytes are not applied to the live `Y.Doc` directly, duplication is avoided by design; the tailer’s projection is the single writer.
- UI latency options:
  - The live projection updates after the commit and tailer pass. If you need optimistic UX, reflect changes from the shadow doc temporarily, but do not mutate the canonical `Y.Doc` until the DB commit succeeds.
- Failure handling:
  - On constraint violation or other DB errors, abort the transaction and drop the inbound update; optionally notify the sender. No compensating CRDT operations are required.
- Snapshot & counters:
  - Remote commits contribute to the per-project snapshot counter. Snapshots and `yjs_updates` retention remain unchanged under this order.

### Architecture Overview (Remote → SQLite → Projection)
- Transport: Receives Yjs update bytes (e.g., via `y-webrtc`).
- Shadow `Y.Doc`: Temporary CRDT used to interpret inbound updates into domain mutations.
- SQLite Transaction: Applies the derived mutations atomically with constraints enforced.
- Triggers → `change_log`: Emits row-level events for committed mutations.
- Ingestion → `yjs_updates`: Tailer consumes `change_log`, produces compact Yjs bytes, and advances watermarks.
- Live `Y.Doc`: Canonical local projection driven exclusively by committed ingestion batches.

### Inbound Lifecycle (Receive → Commit → Project)
- Receive bytes
  - Decode Yjs update; optionally verify signature and protocol/version fields if configured.
  - Extract `project_id` and sender `client_id` from envelope/transport metadata.
- Stage on shadow doc
  - Apply inbound Yjs bytes to a shadow `Y.Doc` for the target project.
  - Compute domain mutations against the map-based canonical projection keyed by `id` (e.g., `objects`, `institutions`, `objects_ontology_fields`); maintain optional arrays of IDs if order views are required.
    - Insert: Shadow doc shows a new key under the relevant table map (`id`) → `INSERT` row.
    - Update: Entry with matching `id` has changed fields → `UPDATE` row.
    - Delete: Entry removed (key deleted) or tombstoned → `DELETE` row.
- Map to SQL
  - Generate SQL statements in dependency order (parents before children) to satisfy foreign keys.
  - Include provenance fields where applicable: `project_id`, `client_id`, and `origin='remote'`.
  - Prefer explicit `INSERT`/`UPDATE`/`DELETE` over blanket upserts to make constraint failures visible.
- Commit atomically
  - Execute all derived statements within a single SQLite transaction.
  - On success: AFTER triggers emit `change_log` rows for each mutated table.
  - On failure: Abort the transaction; do not mutate the live `Y.Doc`. Optionally notify the sender (NACK) or queue for retry.
- Project deterministically
  - Tailer reads committed `change_log` rows strictly after its watermark, applies inside a single `Y.Doc` transaction (batch), produces compact Yjs updates, appends to `yjs_updates`, and advances the watermark atomically.
  - The live `Y.Doc` reflects the committed remote changes, aligned with persisted updates and snapshot watermarks.

### Ordering & Idempotency
- Ordering
  - Apply inbound updates in arrival order per peer; Yjs CRDT guarantees convergence regardless of interleaving.
  - Within a DB transaction, order mutations by dependencies: create/update parent rows before child references; delete children before parents if cascades aren’t configured.
- Idempotency
  - CRDT: Reapplying the same Yjs bytes is safe and has no effect.
  - SQL: Use primary keys and constraint checks to avoid double-inserts; on duplicate `id`, translate to `UPDATE` or skip.
  - Ingestion: Use a `change_id` watermark; replay avoids double-application.

### Conflict Resolution (SQLite-first)
- CRDT layer: Yjs types resolve concurrent edits deterministically (e.g., text types, maps).
- Relational layer: Constraint violations (FK/unique) are rejected at commit time; the canonical doc is unchanged.
- Policies for irreconcilable conflicts:
  - Reject: Abort commit and notify the sender or request resync.
  - Transform: Adjust inbound mutation (e.g., rename to satisfy uniqueness) if business rules permit.
  - Buffer: Delay applying dependent child rows until the parent appears; set bounded retries.

- Recommended policies for stricter control:
  - Compare-and-swap (CAS): Include `WHERE id=? AND updated_at=?` (or a version field) to detect lost updates; on mismatch, retry against the merged base or surface a conflict.
  - Field-level CRDT persistence: For rich text or set-like fields, persist normalized CRDT outputs rather than plain strings to ensure deterministic merges are stored.
  - Deterministic ordering: Maintain stable inbound ordering per project (transport sequence or `(timestamp, monotonic_id)`) to keep shadow merges consistent.
  - Buffer dependent ops: When a mutation depends on a missing parent, buffer until the parent exists or reject with a clear error.

- Operational handling:
  - On failure: Abort the SQLite transaction; do not alter the live `Y.Doc`. Log the reason (FK missing, unique violation) and optionally notify the sender.
  - Observability: Track conflict counts by type, table, and field; surface metrics for retries and rejects to tune policies.

- Bottom line:
  - With SQLite-first, conflicts are handled at the relational/app layer while CRDT merges happen safely in the shadow doc. The canonical `Y.Doc` reflects only committed DB state, avoiding CRDT rollbacks.

### Performance Considerations
- Batch inbound updates per project; commit in one transaction to reduce write amplification.
- Keep batch sizes bounded (e.g., 100–500 change rows per ingest) to balance latency and throughput.
 - Avoid long-running transactions; prefer smaller batches to keep ingest responsive.

### Security & Integrity
- Optional signatures over the wire (e.g., ed25519) to authenticate remote updates.
- Checksums at rest for snapshots/updates (`sha256`) to detect on-disk corruption.
- Persist `yjs_protocol_version` and `doc_schema_version` to guard against format evolution.

### Examples (Remote)
- Remote Object Insert
  - Remote peer inserts an object with fields: `id`, `status`, `name`, `institution_id`, `project_id`, `created_at`, `updated_at` (matching `src/db/schema.js`).
  - Transport delivers Yjs bytes → shadow `Y.Doc` shows a new key in the `objects` map keyed by `id`.
  - SQL (single transaction): `INSERT INTO objects (id, status, name, institution_id, project_id, created_at, updated_at) VALUES (...)` with provenance.
  - Commit → triggers write `change_log` → tailer ingests, persists `yjs_updates`, updates live `Y.Doc`, advances watermark.
- Remote Update & Delete
  - Update: Shadow shows changed fields for `objects.id=...` → `UPDATE objects SET ... WHERE id=...` → commit → trigger → tailer → live `Y.Doc`.
  - Delete: Shadow shows removal/tombstone for `objects.id=...` → `DELETE FROM objects WHERE id=...` (respect cascades) → commit → trigger → tailer → live `Y.Doc`.


## Snapshots (Fast Boot & Bounded Replay)
- When to snapshot:
  - Size threshold: After `N` updates since the last snapshot (e.g., 10k).
- Snapshot contents:
  - Full Yjs document state bytes (`snapshot_update`).
  - Watermark (`last_change_id`) at snapshot time.
  - Optional state vector to enable future incremental diffs.
- Atomic snapshotting:
  - Encode the Y.Doc state and persist it along with the watermark in a single atomic operation.
  - Prevent partial snapshots; a valid snapshot always includes a precise watermark.
- Boot process with snapshots:
  - Load the latest snapshot for the project and apply it to a fresh `Y.Doc`.
  - Replay only `yjs_updates` strictly after the snapshot’s watermark.
  - If no snapshot exists, replay from the beginning of `yjs_updates`; consider creating a snapshot after catch-up.
- Retention & pruning:
  - Keep the last K snapshots (e.g., 3) per project for redundancy.
  - Prune `yjs_updates` older than the latest snapshot (maintain a small safety window).
  - Decide change log retention based on audit needs; otherwise prune by age.

## Performance & Operational Settings
- Indexing:
  - Index change log on `(project_id, created_at, id)`.
  - Index yjs updates on `(project_id, created_at)`.
- Batching:
  - Tailer processes rows in bounded batches and applies them in a single Y.Doc transaction per batch.
  - Tune batch sizes empirically (start with 100–500 rows).
- Memory management:
  - Maintain one `Y.Doc` per active project; evict idle docs and rehydrate from snapshot on demand.

## Observability & Metrics
- Watermarks:
  - Track `last_processed_change_id` and lag (seconds since latest log event) per project.
- Throughput & latency:
  - Count rows processed per batch, updates generated, snapshot duration, replay durations.
- Health signals:
  - Detect tailer stalls, snapshot failures, lag spikes after bulk operations.
- Debugging:
  - Allow inspection of recent change log entries and corresponding Yjs updates for a project.

## Failure Scenarios & Recovery
- Crash during ingestion:
  - On restart, load the latest snapshot and replay the tail; if no snapshot, replay from updates; if updates are missing, rebuild from change log.
- Corrupted snapshot:
  - Fall back to earlier snapshots; if all fail, rebuild by replaying `yjs_updates` (or `change_log` if necessary).
- Duplicate processing:
  - Idempotent Yjs updates and watermark tracking prevent double-application side effects.
- Schema changes:
  - Introduce new triggers and payload mappings as part of migrations; maintain backward compatibility in tailer.
- Storage pressure:
  - Apply retention policies; schedule compaction; monitor disk usage.

## Security & Provenance
- Provenance:
  - Persist `client_id` and optional origin info for every change.
  - Future remote ingestion can use origin/client to avoid echo loops and to attribute changes.
- Integrity:
  - Validate payloads; limit which tables are captured; avoid sensitive content in change payloads unless required.

## Integrity & Verification
- Yjs checksum expectations:
  - Yjs update and snapshot formats do not include a built-in checksum. Malformed bytes will fail to decode, but there is no cryptographic integrity check by default.
- Checksums at rest:
  - Persist a `sha256` (or similar) checksum of `snapshot_bytes` and optionally of each `yjs_update` to detect on-disk corruption.
  - Record `size_bytes` for observability; verify checksum before applying during boot.
- Signatures over the wire (optional future):
  - For peer transport, include an `ed25519` signature per update/snapshot to ensure authenticity and prevent tampering. Store `signature` and `public_key_id` alongside the bytes.
- Versioning:
  - Persist `yjs_protocol_version` and a `doc_schema_version` with snapshots/updates to guard against compatibility issues when your array-based projection evolves.
- State-vector verification:
  - Store the Yjs `state_vector` with each snapshot. After loading a snapshot and replaying updates to the target watermark, compare `encodeStateVector(doc)` against the expected vector to confirm completeness.
- Operational fallback:
  - If verification (checksum, decode, version, or state-vector match) fails for the latest snapshot, revert to the penultimate snapshot and replay updates from its watermark. This leverages the retention policy designed for safe rollback.

## Testing Strategy
- Unit: Verify trigger emissions for INSERT/UPDATE/DELETE; diff correctness; idempotent update application.
- Integration: Simulate burst imports; measure tailer throughput, lag, and snapshot recovery time.
- Recovery: Crash mid-batch and confirm consistent restart; corrupt snapshot deliberately and verify fallback.
- Performance: Measure boot time from snapshot vs full replay; tune batch sizes and snapshot cadence.

## Decisions Finalized
- Payload: Use full row payloads for `INSERT` and `UPDATE`, and include the prior row for `UPDATE`/`DELETE` when available. Any minimal deltas are derived downstream during ingestion.
- Snapshot frequency: Create a snapshot after processing 1000 committed transactions per project. The ingestion layer maintains a per-project transaction counter (based on commit grouping/transaction identifiers) and triggers snapshotting when the counter reaches 1000, then resets the counter.
- Y.Doc structure: Array-based projection rather than table-keyed maps. Each domain type is represented by a Yjs array of row-shaped entries (e.g., an `objects` array), and operations are implemented as append/replace by scanning for `id`. Ordering is preserved using `(timestamp, change_id)`.
- Retention window: Keep at least the latest two snapshots per project and retain `yjs_updates` from the penultimate snapshot forward until the next snapshot is safely persisted. This provides a safe, operational revert path to the penultimate snapshot without losing continuity.
- Indexing: Only use table indexing (SQLite B-tree indexes). Index the change log on `(project_id, timestamp, id)` and yjs updates on `(project_id, timestamp)`; avoid external/virtual indices.

- Reception order: SQLite-first for remote updates. Commit mutations to the database, let triggers emit `change_log`, and drive the live `Y.Doc` exclusively from ingestion of committed rows.

## Example: Object Insert Data Flow
This walkthrough uses actual names from `src/db/schema.js` for the `objects` table.

- Domain write (inside a transaction): Insert into `objects` with fields `id`, `status`, `name`, `institution_id`, `project_id`, `created_at`, `updated_at`. Example values:
  - `objects.id = "a0c8..."` (UUID)
  - `objects.status = "in progress"` (default)
  - `objects.name = "Ceramic Vase"`
  - `objects.institution_id = "inst-123..."`
  - `objects.project_id = "proj-987..."`
  - `objects.created_at = <timestamp_ms>`
  - `objects.updated_at = <timestamp_ms>`

- Trigger emission (after commit): A single change log row is written representing the committed `INSERT` on table `objects` with:
  - `table = "objects"`, `op = "INSERT"`, `project_id = "proj-987..."`, `created_at = <ts>`, `id = <change_id>`
  - `row_json` containing the full new row: `{ id, status, name, institution_id, project_id, created_at, updated_at }`

- Ingestion (batch tail): The tailer reads committed change log rows strictly after its watermark, groups by `project_id`, and begins a Y.Doc transaction for the batch.

- Map-based projection (Y.Doc update): Within the Y.Doc transaction, set the row under `objects` map keyed by `id` (create if missing; merge on update). If an entry with the same `id` already exists (rare for inserts), overwrite or merge deterministically.

- Persist Yjs update: The Yjs update bytes produced by the transaction are appended to `yjs_updates` with the associated `project_id`, the processed `change_id` range, and `timestamp`. The ingestion watermark advances atomically.

- Snapshot evaluation: The ingestion process increments the per-project transaction counter. When the counter reaches 1000 since the last snapshot, it encodes a snapshot of the current Y.Doc, persists it along with the snapshot watermark (`last_change_id`), and resets the counter.

- Boot/resume behavior:
  - On startup, load the latest snapshot for `project_id = "proj-987..."` into a fresh Y.Doc.
  - Replay only `yjs_updates` strictly after the snapshot watermark.
  - If the latest snapshot fails verification, revert to the penultimate snapshot (retained by policy) and replay updates from that snapshot’s watermark.

## Development Plan (SQLite-first, Atomic & Testable)

### File Placement Overview (aligned to current project)
- `src/db/schema.js`: Define tables with Drizzle (`change_log`, `yjs_updates`, `yjs_snapshots`, optional `ingestion_state`). Keep definitions alongside existing domain tables.
- `src/db/migrations/*.sql`: Create SQLite triggers for domain tables (e.g., `objects`, `institutions`) that append rows to `change_log`. Use `src/db/scripts/applyMigration.js` to apply them.
 - `src/db/init.js`: Database bootstrap (Drizzle client) and singleton setup (e.g., `globalSettings`).
- `src/backend/services/yDocRegistry.js`: Manage per-project live `Y.Doc` instances (create/get/dispose), array-based projection structure.
- `src/backend/services/changeLogTailer.js`: Tail committed `change_log`, apply to `Y.Doc`, produce and persist `yjs_updates`, advance watermark.
- `src/backend/services/snapshotService.js`: Snapshot encoder/persister and replay-on-boot utilities.
- `src/backend/services/remoteTransport.js`: Receive remote Yjs bytes (e.g., `y-webrtc`) and emit events to ingestion.
- `src/backend/services/remoteIngestion.js`: Apply inbound bytes to a shadow `Y.Doc`, derive SQL, commit, provenance tagging.
- `src/backend/services/sqlUtils.js`: Thin helpers for batched reads/writes and ordered queries.
- `src/backend/main.js`: Wire services on app start; orchestrate boot from snapshot + tail replay.



## Project-Wide Sync & Rebuild Plan (Full Coverage over WebRTC)

### Scope & Coverage (Tables and Dependencies)
- Core project anchor: `project`.
- Project-scoped tables (direct `project_id`):
  - `settings`, `website_settings`, `object_display_fields`, `research_fields`, `ontology_fields`, `assets`, `generic_assets`, `objects`, `datasources`, `templates`, `vocabularies`, `actions`.
- Junction tables and associations (project-related via FKs):
  - `objects_assets`, `assets_institutions`, `objects_research_fields`, `objects_ontology_fields`, `vocabularies_generic_assets`.
- Institutions (linked to project):
  - `institutions` (via `project_id`).
- Text and language dependencies (referenced by project data):
  - `texts`, `translations`, `languages` (project languages only).
 - Import flows:
   - `imports` (derive project via `templates.project_id`).
- UI/global tables (usually not project-scoped; optional):
  - `interface_languages`, `interface_translations` (global UI translation catalog; include only if peers need identical UI content).
- Operational tables:
  - `actions` (optional, if action history needs to sync), `logs` (optional; not required to rebuild domain state), `global_settings` (singleton; not project data).
- Derived/virtual indices:
  - `institutions_search` (FTS) is recomputed locally; do not sync.

### Rebuild Principle
- A fresh peer receives a full Yjs snapshot for the project (arrays representing rows of all in-scope tables) and then incremental `yjs_updates`.
- The peer applies the snapshot to a shadow `Y.Doc`, derives SQL inserts to populate domain tables, commits atomically, and then follows with updates via the SQLite-first ingestion pipeline.
- No raw SQLite file exchange is required; only CRDT bytes over WebRTC.



### What Is Not Synced
- `institutions_search` (FTS5) and other derived indices are rebuilt locally.
- `logs` and `global_settings` are not required to reconstruct project domain state.
- `interface_languages` and `interface_translations` are global/UI-level; include only if identical UI content is a requirement across peers.

### Guarantees
- Deterministic rebuild from snapshot + updates.
- Exactly-once ingestion via watermarks and ACK ranges.
- Canonical live `Y.Doc` always reflects committed SQLite state.
