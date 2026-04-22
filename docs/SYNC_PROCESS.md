# P2P Synchronization Architecture

This document describes the complete peer-to-peer synchronization pipeline: how local SQLite state is converted into Yjs updates, how those updates travel across the network, how remote updates are re-applied to SQLite, and how the system handles conflicts, assets, and backups.

## Table of Contents

### 1. Architectural Overview
- Introduction to the Local-First paradigm
- Core Technologies (SQLite, Yjs, WebRTC/WebSockets, WebTorrent)
- The Separation of Concerns: Local Database vs. Shared CRDT State

### 2. The Data Model & Project Genesis
- Mapping SQLite schema to Yjs structures
- Project Genesis: pre-seeding structural `Y.Map` trees
- State vectors and deterministic schema creation

### 3. Outbound Flow: Local to Network (`changeLogTailerService.js`)
- Triggering changes: database write hooks and changelog tailing
- Preventing circular echo loops
- Translating SQLite operations into Yjs operations
- Emitting Yjs updates to the swarm

### 4. The Transport Layer (`p2pService.js`)
- Peer discovery and connection coordination
- Yjs sync handshake (`syncStep1`, `syncStep2`)
- Continuous update propagation
- Disconnects, reconnects, and partitions

### 5. Inbound Flow: Network to Local (`remoteIngestionHandler.js`)
- Receiving remote Yjs updates
- Computing diffs between Yjs and SQLite
- Translating diffs into inserts, updates, and deletes
- Applying updates safely through a queue

### 6. Conflict Resolution & Edge Cases
- Native Yjs conflict resolution
- Dynamic map collisions and map destruction
- The rescue mechanism for orphaned rows
- Offline edits and delayed reconciliation

### 7. Asset & Binary Synchronization (`assetTorrentManager.js`)
- Why assets are not stored inside the Yjs document
- How asset metadata and file transfer are decoupled
- Seeder and leecher lifecycle across peers

### 8. Backups, Rehydration, and P2P Traps (`backupService.js`)
- What a `.dctx` backup contains
- How backup restore rehydrates SQLite and Yjs state
- Private restore vs. shared restore behavior
- Forced rollback risks in a live swarm

---

## 1. Architectural Overview

### Introduction to the Local-First Paradigm
The synchronization system follows a local-first model. Every peer stores a complete working copy of project data locally in SQLite and can continue reading and writing that data without waiting for the network. The network is used to reconcile state between peers, not to gate normal application behavior.

This means local writes happen immediately. A user action updates the local database first, the synchronization layer converts that change into a CRDT update, and that update is later shared with the rest of the swarm. If the peer is offline, work continues normally and synchronization resumes once connectivity returns.

### Core Technologies
The design relies on four separate subsystems, each with a distinct responsibility:

1. **SQLite** stores relational application data locally and supports querying, filtering, and foreign-key-driven structure.
2. **Yjs** maintains the shared collaborative state as a CRDT, allowing multiple peers to converge on the same result after concurrent edits.
3. **WebRTC / WebSockets** provide peer discovery and transport for Yjs updates. Signaling introduces peers; direct channels carry the actual sync traffic.
4. **WebTorrent** handles binary asset transfer separately from the document sync layer.

### The Separation of Concerns
The architecture intentionally separates relational storage from collaborative state.

- SQLite is optimized for structured storage, queries, and application logic.
- Yjs is optimized for distributed merge behavior and eventual consistency.

Neither replaces the other. Yjs acts as the network-facing shared state, while SQLite acts as the local indexed projection of that state. The synchronization pipeline therefore moves in a fixed direction:

**UI action -> SQLite write -> changelog tailer -> Yjs update -> network transport -> remote Yjs apply -> SQLite write**

That separation is what makes the system predictable. Database behavior stays relational; network merge behavior stays CRDT-based.

## 2. The Data Model & Project Genesis

### Mapping SQLite Schema to Yjs Structures
SQLite organizes data as tables and rows. Yjs organizes data as shared types such as `Y.Map`. To synchronize the relational database through Yjs, the system translates the schema into a nested key-value structure inside a single `Y.Doc`.

At the top level, the document contains a root `Y.Map` named `tables`. Each SQLite table is represented by its own child `Y.Map` under that root. Each row in a table is then stored as a value keyed by its primary `id`.

Example structure:

```javascript
tables (Y.Map)
  project (Y.Map)
    "pr_123" -> { id: "pr_123", ... }
  institutions (Y.Map)
    "inst_001" -> { id: "inst_001", ... }
    "inst_002" -> { id: "inst_002", ... }
  texts (Y.Map)
    "txt_456" -> { id: "txt_456", ... }
```

This mapping keeps synchronization generic. The transport layer does not need to understand SQL. It only needs to exchange updates to named maps and row objects.

### Project Genesis: Pre-seeding Structural `Y.Map` Trees
One of the critical failure modes in Yjs appears when two offline peers independently create the same nested shared type for the first time. For example, if both peers create the `institutions` map while disconnected, Yjs treats them as two different shared objects that happen to occupy the same conceptual location. When the peers reconnect, one structure wins and the other is discarded.

That behavior is deterministic from Yjs' perspective, but it is dangerous for the application because rows stored inside the discarded map can disappear from the visible CRDT graph.

To avoid this, the system now creates all table maps at project genesis. As soon as the initial `project` row is inserted and detected by the changelog tailer, the system iterates through the known schema order and pre-seeds every required table map inside the `Y.Doc`. That means all later peers inherit the same shared structural objects instead of inventing their own offline.

### State Vectors and Deterministic Schema Creation
Yjs synchronization is driven by logical clocks and state vectors, not SQL timestamps. Once the initial structural maps exist, all later row-level edits are attached to the same shared object graph. This removes the structural collision problem and limits later reconciliation to ordinary row and field updates.

The practical result is that project creation establishes the shared skeleton once, and every later sync event only fills or mutates that skeleton.

## 3. Outbound Flow: Local to Network (`changeLogTailerService.js`)

### Triggering Changes: Database Write Hooks and Changelog Tailing
The outbound sync path begins with a local database write. A UI action reaches the backend, the backend writes to SQLite, and SQLite logs that write into the changelog. The changelog tailer continuously reads newly recorded operations and converts them into Yjs mutations.

This design is important because it keeps the synchronization layer downstream from ordinary application behavior. The application does not need to know how to speak Yjs in every handler. It only needs to write to SQLite consistently.

### Preventing Circular Echo Loops
Bi-directional sync always risks echoing a remote update back to the network as if it were local. The system avoids this by tracking write context. When a remote Yjs update is being applied into SQLite, the ingestion path marks that work as remote-originated. The changelog tailer checks that context and skips re-broadcasting those writes.

Without that guard, the system would continuously replay the same operation across peers.

### Translating SQLite Operations into Yjs Operations
For each eligible changelog record:

1. The tailer identifies the affected table and row.
2. It reads or constructs the current row payload.
3. It opens a Yjs transaction.
4. It updates the appropriate table map.

Typical translations are straightforward:

- `INSERT` and `UPDATE` become `Y.Map.set(id, rowData)`.
- `DELETE` becomes `Y.Map.delete(id)`.

The use of `doc.transact(...)` ensures multiple related changes are emitted as one coherent Yjs update rather than a fragmented series of partial messages.

### Emitting Yjs Updates to the Swarm
Once the Yjs transaction completes, Yjs emits a binary update describing the exact operations that occurred. That binary payload is then handed off to the transport layer. The tailer does not need to know which peers are connected; it only needs to publish the update into the local collaboration runtime.

## 4. The Transport Layer (`p2pService.js`)

### Peer Discovery and Connection Coordination
The transport layer is responsible for finding peers interested in the same project and establishing direct channels between them. A signaling mechanism introduces peers and exchanges the connection metadata needed for WebRTC negotiation. After that, peers communicate directly.

This separation matters because the signaling server is not the source of truth. It only helps peers find each other. The actual synchronized state lives in Yjs on the peers themselves.

### Yjs Sync Handshake (`syncStep1`, `syncStep2`)
When two peers connect, they do not exchange full database dumps. They exchange Yjs state vectors and request only the missing operations.

The handshake works like this:

1. `syncStep1`: a peer sends its current state vector.
2. `syncStep2`: the other peer computes the missing delta and returns only what is needed.

This keeps reconnects efficient, especially after a temporary disconnect or a period of offline work.

### Continuous Update Propagation
After the handshake, newly generated Yjs binary updates are streamed over the open peer channel as they happen. The transport layer does not reinterpret the payload. It simply forwards it to the receiving peer.

That keeps the transport generic and allows Yjs to remain the only authority on merge semantics.

### Disconnects, Reconnects, and Partitions
If a peer goes offline, local work continues. The peer keeps writing to SQLite and the tailer keeps mutating the local `Y.Doc`. When the connection returns, the handshake runs again and only the missing operations are exchanged.

This is what makes the system resilient to intermittent connectivity. The peer does not pause work while disconnected; it accumulates valid CRDT state and reconciles later.

## 5. Inbound Flow: Network to Local (`remoteIngestionHandler.js`)

### Receiving Remote Yjs Updates
On the receiving side, the transport layer delivers a binary Yjs update to the local collaboration runtime. Yjs applies that update directly to the in-memory `Y.Doc`. At that point, the shared document has changed, but SQLite has not yet been updated.

The ingestion layer is responsible for bridging that change back into the relational database.

### Computing Diffs Between Yjs and SQLite
To determine what to write into SQLite, the ingestion handler compares two views of the world:

1. The canonical relational state currently stored in SQLite.
2. The new collaborative state now visible in the `Y.Doc`.

The diffing logic classifies changes into three categories:

- `inserts`: rows present in Yjs but absent in SQLite
- `updates`: rows present in both, but with changed field values
- `deletes`: rows removed from Yjs that still exist in SQLite

This step is essential because inbound network updates arrive as CRDT operations, not as SQL statements.

### Translating Diffs Into Database Writes
Once the diff is computed, the ingestion layer turns it into concrete SQLite operations. Each insert, update, or delete is scheduled against the appropriate table, preserving the data shape expected by the local application.

### Applying Updates Safely Through a Queue
Remote updates may arrive quickly or overlap in time. To avoid lock contention and out-of-order writes, the system processes inbound synchronization through a sequential queue. Each batch is applied in order inside a controlled database transaction.

During that write, the system marks the work as remote-originated so that the changelog tailer does not re-emit it back to the network.

## 6. Conflict Resolution & Edge Cases

### Native Yjs Conflict Resolution
Yjs resolves concurrent edits deterministically using its own CRDT semantics. If two peers modify different fields of the same row while disconnected, those field-level changes can coexist. If they modify the exact same field, Yjs resolves the conflict deterministically so that all peers converge on the same final value.

That means the application does not implement its own distributed merge algorithm for ordinary field edits. It relies on Yjs to do that correctly.

### Dynamic Map Collisions and Map Destruction
The more dangerous class of conflict is structural rather than field-level. If two peers create the same nested table map independently while offline, Yjs may discard one of those competing structures during reconciliation. This is the failure mode that project genesis is meant to prevent.

### The Rescue Mechanism for Orphaned Rows
For projects created before the genesis fix, or for any case where a structural map collision still occurs, the ingestion layer now includes a rescue path. When diffing detects what looks like a structural wipe instead of a real user deletion, it consults the canonical database state, identifies the orphaned rows, and re-injects them into the surviving shared map.

This prevents a structural CRDT collision from becoming actual business-data loss.

### Offline Edits and Delayed Reconciliation
The system is designed for peers to remain offline for long periods. During that time, both peers may accumulate legitimate local changes. Reconciliation is delayed, not prevented. Once connectivity returns, the sync protocol exchanges the missing Yjs operations and the ingestion layer projects the converged state back into SQLite.

## 7. Asset & Binary Synchronization (`assetTorrentManager.js`)

### Why Assets Are Not Stored Inside the Yjs Document
Binary assets are intentionally excluded from the Yjs document. Yjs is well suited to structured state and incremental document history, but embedding large files directly into the CRDT would inflate memory usage, increase sync payload size, and slow down reconnects.

### How Asset Metadata and File Transfer Are Decoupled
Asset metadata still lives in SQLite and therefore still participates in the normal Yjs synchronization path. An asset row can be synchronized like any other relational record. The file itself, however, is transferred separately through WebTorrent.

This allows peers to agree on what asset exists without forcing the CRDT layer to carry the binary payload.

### Seeder and Leecher Lifecycle Across Peers
When a user adds an asset:

1. The binary file is stored locally.
2. The metadata row is written to SQLite.
3. That metadata is synchronized through Yjs.
4. The asset manager seeds the file through WebTorrent.
5. Remote peers receive the metadata, detect that the file is missing locally, and download it through the torrent layer.

This split keeps structured sync and binary transfer independent while still making them appear as one coherent feature to the user.

## 8. Backups, Rehydration, and P2P Traps (`backupService.js`)

### What a `.dctx` Backup Contains
The backup system exports a project as a compressed `.dctx` archive. That archive contains SQL data and supporting metadata, but it does not preserve the original Yjs binary history as an authoritative CRDT timeline.

This distinction is important: restoring a backup recreates the relational state, not the original per-operation collaboration history.

### How Backup Restore Rehydrates SQLite and Yjs State
During restore, the backup service extracts the archive and executes the SQL payload into SQLite. From the point of view of the local system, this looks like a large batch of new local writes. Those writes enter the changelog, the tailer observes them, project genesis ensures the structural maps exist, and the local `Y.Doc` is rebuilt from the restored relational state.

That means a backup restore is effectively a local rehydration event that regenerates collaborative state from SQLite.

### Private Restore vs. Shared Restore Behavior
If the restored project remains private and isolated, this is fine. The restored SQLite state is projected into a fresh `Y.Doc`, and no external peer is affected.

If the restored project later joins a shared swarm, the situation changes. Because the restored rows are emitted as new local Yjs operations, other peers may interpret that restored state as the newest valid collaborative history.

### Forced Rollback Risks in a Live Swarm
This creates the main restore hazard: restoring an older backup on one peer can function like a rollback that is re-broadcast into the swarm as fresh edits. Other peers may converge toward that restored state even if they previously held newer data.

In practice, that means backup restore should be treated carefully:

1. Restoring into a private project is safe.
2. Restoring into a shared project should be treated as an intentional authoritative action, not a casual local recovery step.

Without that distinction, a peer can unintentionally push an older project snapshot back across the network.
