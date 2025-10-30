# Trystero-Based Yjs Provider

This guide shows how to use a small provider (`YTrysteroProvider`) that bridges the Yjs sync and awareness protocols over Trystero actions. It replaces `y-webrtc` for transport while keeping Yjs’s CRDTs, merge semantics, and protocols intact.

## Why This Provider

- Uses Trystero for matchmaking, encryption, and automatic chunking/throttling of large payloads.
- Keeps Yjs’s native sync (`SyncStep1`, `SyncStep2`, `Update`) and awareness protocols.
- Simple, self-contained, no extra monkey patching or secondary docs.

## Prerequisites

- `yjs`
- `y-protocols` (sync + awareness)
- `lib0` (encoders/decoders)
- `trystero` strategy of your choice (e.g. `trystero/websocket`, `trystero/mqtt`, etc.)

Install (example):

```
npm i yjs y-protocols lib0 trystero
```

Then pick a strategy and import its `joinRoom` (see Trystero docs for the right package and config for your environment).

## Files

- `providers/YTrysteroProvider.js` — provider class bridging Yjs protocols over Trystero.

## Usage

Example with a WebSocket-based strategy (adjust import and config for your chosen strategy):

```js
import * as Y from 'yjs'
import { Awareness } from 'y-protocols/awareness'
import { joinRoom } from 'trystero/websocket' // pick your strategy
import YTrysteroProvider from '../providers/YTrysteroProvider.js'

const doc = new Y.Doc()
const awareness = new Awareness(doc)

// Strategy-specific config — consult Trystero docs
const trysteroConfig = { url: 'wss://your-signaling.example/ws' }

const provider = new YTrysteroProvider('my-room', doc, {
  awareness,
  joinRoom,
  trysteroConfig
})

provider.on('connected', () => console.log('connected'))
provider.on('peer-join', (id) => console.log('peer joined', id))
provider.on('peer-leave', (id) => console.log('peer left', id))

await provider.connect()

// Example Yjs binding usage (e.g. y-prosemirror/y-quill) continues as usual.
// Awareness states work as with other providers
awareness.setLocalStateField('user', { name: 'Ada', color: '#4b8' })

// Disconnect when done
// await provider.disconnect()
```

## How It Works

- Sync actions:
  - Creates two Trystero actions: `y-sync` and `y-awareness`.
  - On connect or peer join, sends `SyncStep1` (state vector) to discover missing updates.
  - On incoming messages, uses `y-protocols/sync.readSyncMessage` to apply updates and, when needed, responds with `SyncStep2`.
  - On local Yjs updates, encodes `Update` and broadcasts over `y-sync`.
- Awareness actions:
  - Sends diffs on local awareness changes (`writeAwarenessUpdate`).
  - Applies remote diffs (`applyAwarenessUpdate`).
  - Sends full local state to newly joined peers.
- Transport:
  - Trystero handles chunking/throttling and peer encryption.
  - You supply the signaling strategy + config (WebSocket, MQTT, Firebase, etc.).

## API

- `new YTrysteroProvider(roomId, doc, { awareness, joinRoom, trysteroConfig })`
  - `roomId`: shared room name.
  - `doc`: your Yjs `Y.Doc`.
  - `awareness` (optional): existing `Awareness` instance; one is created if omitted.
  - `joinRoom`: Trystero’s `joinRoom` from your chosen strategy.
  - `trysteroConfig`: strategy-specific configuration object.
- `connect(): Promise<void>` — joins the room, wires protocols, kicks off sync.
- `disconnect(): Promise<void>` — leaves the room and unwires listeners.
- `destroy(): Promise<void>` — disconnects and destroys awareness.
- Events: `connected`, `disconnected`, `peer-join`, `peer-leave`, `message`.

## Notes & Tips

- Initial sync: In P2P, broadcasting `SyncStep1` works; per-peer targeting can reduce chatter — both converge.
- Awareness: On join, the provider sends a full local state to the joining peer to prevent “empty presence” races.
- Large updates: Trystero auto-chunks typed arrays; use `writeUpdate`/`writeSyncStep2` output directly.
- Backpressure: Trystero throttles; avoid massive bursts by batching heavy local operations if you notice stalls.

## Migration From `y-webrtc`

- Replace `WebrtcProvider(room, doc, { awareness })` with `YTrysteroProvider(room, doc, { joinRoom, trysteroConfig, awareness })`.
- Keep all Yjs bindings (ProseMirror, Quill, etc.) — they don’t change.
- Awareness API and semantics remain identical.

## Troubleshooting

- “Nothing happens”: Verify your strategy import and `trysteroConfig` (e.g., signaling URL or credentials).
- “Peers never connect”: Check NAT traversal/TURN settings for your strategy; try a different strategy if needed.
- “Updates are slow”: Instrument local batching; ensure you’re not firing extremely large single updates back-to-back.

## Security

- Trystero encrypts P2P channels; signaling strategy choice affects discovery metadata.
- Awareness payloads may contain user identifiers; sanitize and limit fields as needed.

## FAQ

- Is this a full drop-in provider? Yes — for sync and awareness over Trystero.
- Does it change Yjs semantics? No — Yjs CRDT, protocol, and convergence stay the same.
- Can I use multiple strategies? Yes, the provider accepts any `joinRoom` + config that follows Trystero’s API.