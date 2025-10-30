// Trystero-based Yjs provider: bridges Yjs sync & awareness over Trystero actions
// Requirements: yjs, y-protocols, lib0, and a chosen trystero strategy.

import * as Y from 'yjs'
import { Awareness } from 'y-protocols/awareness'
import * as awarenessProtocol from 'y-protocols/awareness'
import * as syncProtocol from 'y-protocols/sync'
import * as encoding from 'lib0/encoding'
import * as decoding from 'lib0/decoding'

// Optionally import a default strategy here. Prefer passing `joinRoom` via options.
// import { joinRoom as defaultJoinRoom } from 'trystero/websocket'

class Emitter {
  constructor () {
    this.handlers = new Map()
  }
  on (type, fn) {
    const set = this.handlers.get(type) || new Set()
    set.add(fn)
    this.handlers.set(type, set)
    return () => this.off(type, fn)
  }
  off (type, fn) {
    const set = this.handlers.get(type)
    if (set) set.delete(fn)
  }
  emit (type, ...args) {
    const set = this.handlers.get(type)
    if (!set) return
    for (const fn of set) {
      try { fn(...args) } catch (_) {}
    }
  }
}

export default class YTrysteroProvider extends Emitter {
  /**
   * @param {string} roomId
   * @param {Y.Doc} doc
   * @param {{
   *   awareness?: Awareness,
   *   joinRoom?: Function, // from your chosen trystero strategy
   *   trysteroConfig?: any, // strategy-specific config
   * }} opts
   */
  constructor (roomId, doc, opts = {}) {
    super()
    this.roomId = roomId
    this.doc = doc
    this.awareness = opts.awareness || new Awareness(doc)
    this.joinRoom = opts.joinRoom // || defaultJoinRoom
    this.trysteroConfig = opts.trysteroConfig

    this.room = null
    this.connected = false
    this._unsubs = []
    this._sendSync = null
    this._getSync = null
    this._sendAwareness = null
    this._getAwareness = null
  }

  async connect () {
    if (!this.joinRoom) throw new Error('YTrysteroProvider: `joinRoom` (trystero strategy) is required')
    if (!this.trysteroConfig) throw new Error('YTrysteroProvider: `trysteroConfig` is required')

    this.room = await this.joinRoom(this.trysteroConfig, this.roomId)
    const [sendSync, getSync] = this.room.makeAction('y-sync')
    const [sendAwareness, getAwareness] = this.room.makeAction('y-awareness')
    this._sendSync = sendSync
    this._getSync = getSync
    this._sendAwareness = sendAwareness
    this._getAwareness = getAwareness

    // Wire incoming sync messages
    this._getSync((data, peerId) => {
      const decoder = decoding.createDecoder(new Uint8Array(data))
      const encoder = encoding.createEncoder()
      const msgType = syncProtocol.readSyncMessage(decoder, encoder, this.doc, peerId)
      if (encoding.length(encoder) > 0) {
        // Respond (usually SyncStep2) specifically to sender
        this._sendSync(encoding.toUint8Array(encoder), peerId)
      }
      this.emit('message', { type: 'sync', msgType, from: peerId })
    })

    // Wire incoming awareness messages
    this._getAwareness((data, peerId) => {
      const decoder = decoding.createDecoder(new Uint8Array(data))
      awarenessProtocol.applyAwarenessUpdate(decoder, this.awareness, peerId)
      this.emit('message', { type: 'awareness', from: peerId })
    })

    // Broadcast document updates
    this._unsubs.push(this.doc.on('update', (update, origin) => {
      const encoder = encoding.createEncoder()
      syncProtocol.writeUpdate(encoder, update)
      this._sendSync(encoding.toUint8Array(encoder))
    }))

    // Broadcast local awareness changes
    this._unsubs.push(this.awareness.on('update', ({ added, updated, removed }, origin) => {
      const changed = added.concat(updated).concat(removed)
      if (changed.length === 0) return
      const encoder = encoding.createEncoder()
      awarenessProtocol.writeAwarenessUpdate(encoder, this.awareness, changed)
      this._sendAwareness(encoding.toUint8Array(encoder))
    }))

    // Peer lifecycle
    if (this.room.onPeerJoin) {
      this.room.onPeerJoin((peerId) => {
        this.emit('peer-join', peerId)
        // Kick off sync with the new peer
        const enc = encoding.createEncoder()
        syncProtocol.writeSyncStep1(enc, this.doc)
        this._sendSync(encoding.toUint8Array(enc), peerId)
        // Send full local awareness state to the new peer
        const encAw = encoding.createEncoder()
        const all = Array.from(this.awareness.getStates().keys())
        awarenessProtocol.writeAwarenessUpdate(encAw, this.awareness, all)
        this._sendAwareness(encoding.toUint8Array(encAw), peerId)
      })
    }
    if (this.room.onPeerLeave) {
      this.room.onPeerLeave((peerId) => {
        this.emit('peer-leave', peerId)
      })
    }

    this.connected = true
    this.emit('connected')

    // Optional: proactively request remote state from all peers
    const enc = encoding.createEncoder()
    syncProtocol.writeSyncStep1(enc, this.doc)
    this._sendSync(encoding.toUint8Array(enc))

    // Broadcast full awareness state once on connect
    const encAw = encoding.createEncoder()
    const all = Array.from(this.awareness.getStates().keys())
    awarenessProtocol.writeAwarenessUpdate(encAw, this.awareness, all)
    this._sendAwareness(encoding.toUint8Array(encAw))
  }

  async disconnect () {
    if (!this.connected) return
    this.connected = false
    for (const unsub of this._unsubs) try { unsub() } catch (_) {}
    this._unsubs = []
    try {
      if (this.room && this.room.leave) await this.room.leave()
    } catch (_) {}
    this.room = null
    this.emit('disconnected')
  }

  async destroy () {
    await this.disconnect()
    this.awareness.destroy()
  }
}