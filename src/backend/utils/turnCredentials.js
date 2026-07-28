/**
 * Generate time-limited TURN credentials from a shared secret.
 * Uses the TURN REST API scheme (HMAC-SHA1).
 *
 * @param {string} secret - Shared secret (matches TURN_SECRET on the server).
 * @param {number} [ttlSeconds=86400] - Credential lifetime in seconds (default: 24h).
 * @returns {{ username: string, credential: string }}
 */
import crypto from 'crypto';

export function generateTurnCredentials(secret, ttlSeconds = 86400) {
  const timestamp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const username = String(timestamp);
  const hmac = crypto.createHmac('sha1', secret);
  hmac.update(username);
  const credential = hmac.digest('base64');
  return { username, credential };
}
