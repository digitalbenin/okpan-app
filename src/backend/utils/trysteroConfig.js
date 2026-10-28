/**
 * Build shared Trystero joinRoom config from environment variables.
 * Returns relayUrls and turnConfig arrays to spread into joinRoom() calls.
 */
import { generateTurnCredentials } from './turnCredentials.js';
import { defaultRelayUrls as defaultNostrRelays } from 'trystero/nostr';

function buildTurnIceServers() {
  const serverUrl = process.env.TURN_SERVER_URL;
  if (!serverUrl) return [];

  const username = process.env.TURN_USERNAME;
  const credential = process.env.TURN_CREDENTIAL;
  if (username && credential) {
    return [{ urls: serverUrl, username, credential }];
  }

  const secret = process.env.TURN_SECRET;
  if (secret) {
    const { username: genUser, credential: genCred } = generateTurnCredentials(secret);
    return [{ urls: serverUrl, username: genUser, credential: genCred }];
  }

  return [];
}

/**
 * Check whether FORCE_TURN_ONLY is enabled.
 * @returns {boolean}
 */
export function isForceTurnOnly() {
  return process.env.FORCE_TURN_ONLY === 'true';
}

/**
 * Get ICE servers array containing only TURN servers.
 * Useful for overriding default STUN servers when FORCE_TURN_ONLY is set.
 * @returns {Array<Object>} iceServers array for RTCPeerConnection config.
 */
export function getTurnOnlyIceServers() {
  return buildTurnIceServers();
}

/**
 * Build the relayUrls config for Trystero joinRoom() calls.
 * Trystero's Nostr strategy in v0.22.0 reads config.relayUrls (flat array),
 * NOT config.relayConfig.urls (nested object).
 * Per-project custom signaling URLs and the TRYSTERO_RELAY_URLS env var are
 * merged with the default NOSTR relays so the client connects to both the
 * custom relays and the public fallback pool.
 * @param {Object} [options={}] - Relay options.
 * @param {Array.<string>} [options.extraUrls=[]] - Per-project relay URLs (custom signaling servers).
 * @returns {Object} with relayUrls array, or empty object if no custom relay is configured.
 */
export function getRelayConfig(options = {}) {
  const extraUrls = Array.isArray(options?.extraUrls)
    ? options.extraUrls.map(u => (typeof u === 'string' ? u.trim() : '')).filter(Boolean)
    : [];

  const urls = process.env.TRYSTERO_RELAY_URLS;
  const envUrls = urls
    ? urls.split(',').map(u => u.trim()).filter(Boolean)
    : [];

  const customUrls = [...new Set([...extraUrls, ...envUrls])];
  if (customUrls.length === 0) {
    return {};
  }

  const allUrls = [...new Set([...customUrls, ...defaultNostrRelays])];
  return { relayUrls: allUrls };
}

/**
 * Build turnConfig from TURN_* env vars.
 * Supports two modes:
 *   1. Static credentials: TURN_SERVER_URL + TURN_USERNAME + TURN_CREDENTIAL
 *   2. Time-limited credentials: TURN_SERVER_URL + TURN_SECRET (HMAC-SHA1)
 *
 * @returns {Object} turnConfig to pass to joinRoom(), or empty object if not configured.
 */
export function getTurnConfig() {
  const serverUrl = process.env.TURN_SERVER_URL;
  if (!serverUrl) return {};

  // Mode 1: Static credentials
  const username = process.env.TURN_USERNAME;
  const credential = process.env.TURN_CREDENTIAL;
  if (username && credential) {
    return {
      turnConfig: [{ urls: serverUrl, username, credential }]
    };
  }

  // Mode 2: Time-limited credentials from shared secret
  const secret = process.env.TURN_SECRET;
  if (secret) {
    const { username: genUser, credential: genCred } = generateTurnCredentials(secret);
    return {
      turnConfig: [{ urls: serverUrl, username: genUser, credential: genCred }]
    };
  }

  return {};
}
