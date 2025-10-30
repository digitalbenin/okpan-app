# Yjs ↔ SQLite Sync Action Plan (Trystero Provider)

This document describes a database-native synchronization backbone powered by SQLite triggers and Yjs, transported peer‑to‑peer via a Trystero‑based Yjs provider. SQLite remains the source of truth; Yjs is the append‑only projection and transport format.

## Goals & Scope
- Capture every row‑level change regardless of write path (ORM, raw SQL, batch imports).
- Derive deterministic Yjs updates from a canonical database change stream.
- Provide fast boot and recovery via periodic snapshots plus tail replay.
- Keep the transport simple and reliable using a Trystero‑backed provider for Yjs sync and awareness.
- Maintain operational clarity, testability, and resilience.

## Core Components
- Change Log: Canonical event stream written by SQLite triggers (`INSERT/UPDATE/DELETE`).
- Yjs Updates: Append‑only record of compact Yjs update bytes produced from change log batches.
- Y.Doc: In‑memory CRDT per project representing the current projection (driven exclusively by committed DB changes).
- Snapshots: Periodic full‑state Yjs bytes with a precise watermark for fast boot and minimal replay.
- Transport: Trystero‑based Yjs provider (`providers/YTrysteroProvider.js`) carrying native Yjs sync and awareness messages peer‑to‑peer.

## Sequential Development Plan (Full Project Sync)

1) Define sync tables in `src/db/schema.js`
- Outcome: Add `change_log`, `yjs_updates`, `yjs_snapshots`, and optional `ingestion_state` alongside existing domain tables.
- Test: Reset DB; start app; run a simple `select` on each new table to confirm visibility (Drizzle).

2) Create triggers for core project tables
- Outcome: Add AFTER `INSERT/UPDATE/DELETE` triggers in `src/db/migrations/002_change_log_triggers.sql` for `project`, `settings`, `website_settings`, `object_display_fields`, `research_fields`, `ontology_fields`, `assets`, `generic_assets`, `objects`, `templates`, `languages`, `institutions`.
- Test: Perform CRUD on each table; verify one `change_log` row per committed row mutation with correct `project_id`, `table`, `op`, payload.

3) Create triggers for junction tables
- Outcome: Add triggers for `objects_assets`, `assets_institutions`, `objects_research_fields`, `objects_ontology_fields`, `vocabularies_generic_assets` to emit `change_log` entries on association changes.
- Test: Link/unlink rows; verify `change_log` emits rows with derived `project_id` and correct payload.

4) Create triggers for texts, translations, vocabularies, datasources, imports
- Outcome: Add triggers for `texts`, `translations`, `vocabularies`, `datasources`, `imports` with `project_id` derivation per the matrix.
- Test: Edit text content, add translations, create vocabularies/datasources/imports; verify `change_log` coverage and consistent `project_id`.

5) Implement `project_id` derivation in triggers
- Outcome: Use parent references to derive `project_id` when the table doesn’t store it directly.
- Test: For each derivation path, mutate a row and confirm `project_id` in `change_log` matches the expected parent project.

6) Index `change_log` for ordered ingestion
- Outcome: Index on `(project_id, timestamp, id)` for deterministic reads.
- Test: Query ordered pages; confirm stable ordering for same‑second events.

7) Implement `src/backend/services/yDocRegistry.js`
- Outcome: Manage a per‑project live `Y.Doc` with maps/arrays for covered tables; stable keys by row `id`.
- Test: Create a doc; assert types exist; dispose without leaks.

8) Implement `src/backend/services/changeLogTailer.js`
- Outcome: Read committed `change_log` rows after the watermark, group by `project_id`, apply inside a single `Y.Doc` transaction, produce Yjs bytes, persist to `yjs_updates`, advance watermark.
- Test: Seed `change_log` with mixed table mutations; run tailer; assert `yjs_updates` rows and `Y.Doc` reflect DB state.

9) Implement `src/backend/services/snapshotService.js`
- Outcome: Encode full‑state Yjs bytes with `last_change_id` and optional `state_vector`; persist to `yjs_snapshots`; load snapshot and replay `yjs_updates` on boot.
- Test: Create snapshot; restart; verify fast boot and equality of state before/after (including `encodeStateVector`).

10) Wire boot in `src/backend/main.js`
- Outcome: On start, hydrate each active project from latest snapshot, then start tailer; ensure services initialize in order.
- Test: Cold start with and without snapshots; confirm proper hydration and ingestion begins at expected watermark.

11) Implement `src/backend/services/projectScope.js`
- Outcome: Provide minimal snapshot metadata for a given `project_id` (e.g., `watermarkId`) plus `createdAppVersion` for compatibility checks. Rebuild order is static and defined locally; counts are omitted for performance.
- Test: Confirm snapshot hydration advances the `watermarkId` appropriately; verify `createdAppVersion` is present and warning logic can compare against the local app version.

12) Implement remote transport provider (Trystero)
- Outcome: Use `providers/YTrysteroProvider.js` to carry Yjs sync and awareness peer‑to‑peer via Trystero strategies (Nostr, MQTT, Torrent, Supabase, Firebase, IPFS).
- Test: Connect two peers; verify initial sync (state vector → updates) and ongoing updates/awareness.
 - Initial sync semantics: On first connect, peers exchange state vectors. If the receiver's doc is empty or far behind, the sender emits a compact full‑state update (`Y.encodeStateAsUpdate`) as part of the native handshake. This functions as a "bootstrap snapshot" and avoids replaying thousands of historical updates.

 

13) Implement `src/backend/services/remoteIngestion.js` (SQLite‑first)
- Outcome: Apply inbound bytes to a shadow `Y.Doc`; derive SQL mutations; commit atomically; triggers emit `change_log`.
- Test: Simulate remote inserts/updates/deletes; confirm DB commits and subsequent live `Y.Doc` updates via tailer.

14) Implement DB rebuild from snapshot
- Outcome: FK‑safe insertion order: parents (`project`, `languages`, `texts`) → dependents (`institutions`, `objects`) → junctions; apply snapshot rows accordingly.
- Test: Wipe DB; rebuild from snapshot; verify schema constraints and joins hold.

15) Implement incremental updates after initial sync
- Outcome: After the Yjs handshake, consume native Yjs updates over Trystero; process exactly‑once with watermarks.
- Test: Perform edits on sender across core and junction tables; verify receiver consistency and watermark advancement.

16) Implement echo prevention
- Outcome: Stamp `origin='remote'` and `client_id` on remote commits; skip re‑emitting remote‑origin changes in broadcaster logic.
- Test: Round‑trip a remote mutation; ensure no duplicate outbound broadcast.

17) Optional conflict policies
- Outcome: Add CAS on `updated_at` (or a version field) for sensitive rows; buffer dependent ops; maintain deterministic inbound ordering.
- Test: Simulate competing edits (e.g., uniqueness collisions); verify behavior per policy.

18) Observability metrics
- Outcome: Emit lag, rows per batch, update sizes, snapshot duration, replay times; add a lightweight debug IPC endpoint.
- Test: Run a burst import; confirm metrics captured and lag returns to baseline.

19) Retention and pruning
- Outcome: Keep the latest two snapshots; retain `yjs_updates` from the penultimate snapshot forward; prune older updates.
- Test: After new snapshot, run pruning; verify safe fallback remains via penultimate snapshot.

20) Crash and restart resilience
- Outcome: Ensure tailer idempotency if a crash occurs after update generation but before persistence; resume cleanly from the watermark.
- Test: Simulate a crash at the boundary; restart; verify no duplicate application and correct watermark.

21) Production readiness gate
- Outcome: Checklist covering trigger coverage, deterministic rebuild, exactly‑once updates, conflict policy decisions, observability, recovery, retention, and transport sanity.
- Test: Execute against staged datasets; sign off when all gates pass.

## Why the `yjs_updates` Table
- Purpose: Persist an append‑only stream of Yjs update bytes derived from `change_log`, decoupling domain events from the CRDT projection and enabling fast boot, deterministic replay, and external transport.
- Benefits: Fast bootstrap from snapshot + recent updates; deterministic projection; transport‑friendly feed; idempotent recovery; auditability.
- Runtime: Tailer applies batches inside a single `Y.Doc` transaction, produces Yjs bytes, appends to `yjs_updates`, and advances the watermark atomically.
- Retention: Load latest snapshot, replay subsequent `yjs_updates`; keep last two snapshots; prune older updates prior to the penultimate snapshot.

## Trigger Strategy (Row‑Level Event Capture)
- Per‑table triggers: AFTER `INSERT/UPDATE/DELETE` on domain and junction tables.
- Payload: Table name, row ID, operation type, resolved `project_id`, `client_id`, `created_at`, and row JSON.
- Determinism: One log entry per changed row with stable ordering; include enough context for deterministic derivation.
- Transactional visibility: Log rows appear only after commit; ingestion runs post‑commit to avoid lock contention.

## Change Ingestion Pipeline
- Polling model: Read `change_log` strictly after the watermark, in bounded batches; group by `project_id`.
- Yjs projection: Apply rows inside a single `Y.Doc` transaction per batch to produce compact updates.
- Persistence: Append update bytes to `yjs_updates` with `(from_change_id, to_change_id)`; advance watermark atomically.
- Failure handling: If a batch fails after update generation but before persistence, re‑run the batch; updates are idempotent.

## Remote Transport Ingestion (SQLite‑first Order)
- Decision: Use SQLite‑first reception for inbound remote updates. The canonical `Y.Doc` is driven only by committed database changes (`change_log`).
- Workflow (receive → commit → project):
  - Receive remote Yjs bytes via the Trystero‑based provider.
  - Apply inbound bytes to a shadow `Y.Doc` for the target project.
  - Derive row‑level mutations against map projections keyed by `id`; generate SQL (`INSERT/UPDATE/DELETE`) and execute inside a single SQLite transaction in dependency order.
  - On commit, triggers write `change_log` rows; the tailer produces `yjs_updates` and advances the watermark; the live `Y.Doc` updates deterministically.
- Why SQLite‑first: Constraint safety, no CRDT rollback, clean provenance.
- Echo prevention & dedupe: Stamp provenance; broadcaster avoids re‑emitting remote origin events.
- UI latency: If needed, reflect changes optimistically from the shadow doc, but do not mutate the canonical `Y.Doc` until DB commit succeeds.
- Failure handling: On DB error, abort the transaction and drop inbound bytes; optionally notify the sender.

### Architecture Overview (Remote → SQLite → Projection)
- Transport: Trystero‑based Yjs provider sends/receives native Yjs sync and awareness.
- Shadow `Y.Doc`: Temporary CRDT to interpret inbound updates into domain mutations.
- SQLite Transaction: Applies derived mutations atomically with constraints enforced.
- Triggers → `change_log`: Emits row‑level events for committed mutations.
- Ingestion → `yjs_updates`: Tailer consumes and produces compact Yjs bytes, advancing watermarks.
- Live `Y.Doc`: Canonical local projection driven exclusively by committed ingestion batches.

### Inbound Lifecycle (Receive → Commit → Project)
- Receive bytes: Decode Yjs update; extract `project_id` and sender `client_id` from envelope/transport metadata.
- Stage on shadow doc: Apply inbound bytes; compute inserts/updates/deletes against canonical projections.
- Map to SQL: Generate dependency‑ordered statements; include provenance; prefer explicit operations.
- Commit atomically: Execute in a single transaction; triggers emit `change_log`.
- Project deterministically: Tailer applies, produces `yjs_updates`, and advances watermark; live `Y.Doc` converges.

### Ordering & Idempotency
- Ordering: Apply inbound updates in arrival order per peer; Yjs guarantees convergence regardless of interleaving. Within DB transactions, order mutations by dependencies.
- Idempotency: Reapplying the same Yjs bytes has no effect; SQL uses keys/constraints to avoid double‑inserts; tailer watermarks ensure exactly‑once.

## Security & Privacy
- Transport encryption: Trystero provides end‑to‑end encrypted sessions; signaling strategy choice affects discovery metadata only.
- Payload hygiene: Awareness may include user identifiers; sanitize fields and limit exposure.

## Strategy Selection
- Choose a Trystero backend suited to the deployment environment (Nostr/MQTT/Torrent/Supabase/Firebase/IPFS).
- Test reliability/latency in Electron targets; provide TURN‑like relays if the network is restrictive.

## Transport Provider Usage (Example)
```js
import * as Y from 'yjs'
import { Awareness } from 'y-protocols/awareness'
import { joinRoom } from 'trystero/mqtt' // choose your strategy
import YTrysteroProvider from '../../providers/YTrysteroProvider.js'

const doc = new Y.Doc()
const awareness = new Awareness(doc)

const trysteroConfig = { appId: 'db-conn-tool', /* strategy options */ }
const provider = new YTrysteroProvider('project-123', doc, {
  awareness,
  joinRoom,
  trysteroConfig
})

await provider.connect()
// Use Yjs as usual; awareness broadcasts presence; sync flows peer‑to‑peer.
```

## Testing Plan
- Unit tests: Trigger coverage and `project_id` derivation; tailer batching and update generation; snapshot encode/decode equivalence.
- Integration tests: Remote ingestion SQL mapping and commit order; echo prevention; crash/restart idempotency.
- Transport tests: Peer discovery and initial sync; reliability across strategies in Electron environment; awareness propagation.

## Retention & Recovery
- Keep two snapshots; retain updates from penultimate snapshot forward; prune older updates.
- On boot: Load latest snapshot, replay updates after its watermark, resume ingestion.

---
This plan uses a Trystero‑backed provider for Yjs sync and awareness, keeping transport concerns minimal while preserving a robust, SQLite‑first ingestion and deterministic CRDT projection.