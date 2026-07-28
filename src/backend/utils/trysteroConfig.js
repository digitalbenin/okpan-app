/**
 * Build shared Trystero joinRoom config from environment variables.
 * Returns relayUrls and turnConfig arrays to spread into joinRoom() calls.
 */
import { generateTurnCredentials } from './turnCredentials.js';

/**
 * Parse TRYSTERO_RELAY_URLS env var into a relayUrls array.
 * Trystero's Nostr strategy in v0.22.0 reads config.relayUrls (flat array),
 * NOT config.relayConfig.urls (nested object).
 * @returns {Object} with relayUrls array, or empty object if not set.
 */
export function getRelayConfig() {
  const urls = process.env.TRYSTERO_RELAY_URLS;
  if (!urls) return {};

  const urlList = urls.split(',').map(u => u.trim()).filter(Boolean);
  if (urlList.length === 0) return {};

  return { relayUrls: urlList };
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
