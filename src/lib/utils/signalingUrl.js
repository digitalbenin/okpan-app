/**
 * Shared helpers for per-project custom signaling relay URLs and the derived
 * backup TURN endpoints. Pure module with no framework or Electron imports, so
 * it can be used from both the renderer and the Electron main process.
 *
 * @namespace frontend.utils.signalingUrl
 */

const PROTOCOL_MAP = {
    'ws:': 'ws:',
    'wss:': 'wss:',
    // Deployment dashboards (e.g. Coolify) serve and display the relay as a
    // web address. The WebSocket handshake is an HTTP upgrade on that very
    // endpoint, so http(s):// is accepted and mapped to the matching scheme.
    'http:': 'ws:',
    'https:': 'wss:'
};
const MAX_URL_LENGTH = 2048;
const TURN_PORT = 3478;

/**
 * Normalize and validate a signaling relay URL.
 *
 * An empty value means "use the default signaling network". Credentials,
 * query strings and fragments are rejected. The path is preserved (some relays
 * are mounted under a prefix) while trailing slashes are trimmed. Web
 * addresses (`http://`, `https://`) are accepted and normalized to the
 * matching WebSocket scheme (`ws://`, `wss://`).
 *
 * @memberOf frontend.utils.signalingUrl
 * @param {*} value - Raw user input.
 * @returns {{ok: boolean, value: (string|null), warning: (string|null), error: (string|null)}}
 *   `value` is the normalized URL, or null for the default network.
 *   `warning` is `'insecure'` for `ws://`. `error` is `'invalid'` or `'protocol'`.
 */
export function normalizeSignalingUrl(value) {
    const raw = typeof value === 'string' ? value.trim() : '';
    if (!raw) {
        return { ok: true, value: null, warning: null, error: null };
    }
    if (raw.length > MAX_URL_LENGTH) {
        return { ok: false, value: null, warning: null, error: 'invalid' };
    }

    let url;
    try {
        url = new URL(raw);
    } catch {
        return { ok: false, value: null, warning: null, error: 'invalid' };
    }

    const mappedProtocol = PROTOCOL_MAP[url.protocol];
    if (!mappedProtocol) {
        return { ok: false, value: null, warning: null, error: 'protocol' };
    }
    if (url.username || url.password || url.search || url.hash) {
        return { ok: false, value: null, warning: null, error: 'invalid' };
    }

    const path = url.pathname.replace(/\/+$/, '');
    return {
        ok: true,
        value: `${mappedProtocol}//${url.host}${path}`,
        warning: mappedProtocol === 'ws:' ? 'insecure' : null,
        error: null
    };
}

/**
 * Normalize a TURN shared secret. Empty input means "not configured".
 *
 * @memberOf frontend.utils.signalingUrl
 * @param {*} value - Raw user input.
 * @returns {(string|null)} Trimmed secret, or null when absent.
 */
export function normalizeTurnSecret(value) {
    const raw = typeof value === 'string' ? value.trim() : '';
    return raw || null;
}

/**
 * Return the host part of a signaling URL for compact display.
 *
 * @memberOf frontend.utils.signalingUrl
 * @param {string} value - Signaling URL.
 * @returns {string} Host (with port when non-default), or the trimmed input as fallback.
 */
export function formatSignalingHost(value) {
    const raw = typeof value === 'string' ? value.trim() : '';
    if (!raw) return '';
    try {
        return new URL(raw).host;
    } catch {
        return raw;
    }
}

/**
 * Pick the authoritative settings row for a project.
 *
 * `settings.project_id` has no unique constraint and settings rows sync between
 * peers with their own UUIDs, so a project can transiently own more than one
 * row. Rows carrying a custom server win, ties break on `id`: the same pure
 * rule is used by the renderer and the Electron main process so both layers
 * always agree.
 *
 * @memberOf frontend.utils.signalingUrl
 * @param {Array.<Object>} rows - Settings rows for one project.
 * @returns {(Object|null)}
 */
export function pickSignalingSettingsRow(rows) {
    const list = Array.isArray(rows) ? [...rows] : [];
    list.sort((left, right) => {
        const leftCustom = left?.sig_server ? 0 : 1;
        const rightCustom = right?.sig_server ? 0 : 1;
        if (leftCustom !== rightCustom) return leftCustom - rightCustom;
        return String(left?.id ?? '').localeCompare(String(right?.id ?? ''));
    });
    return list[0] || null;
}

/**
 * Derive the backup TURN endpoints served by a self-hosted Okpan server from
 * its signaling relay URL (relay and coturn share the same host).
 *
 * @memberOf frontend.utils.signalingUrl
 * @param {string} value - Signaling URL.
 * @returns {Array.<string>} TURN URLs (UDP + TCP), empty when the URL is absent or invalid.
 */
export function buildTurnUrlsFromSignaling(value) {
    const normalized = normalizeSignalingUrl(value);
    if (!normalized.ok || !normalized.value) return [];

    const { hostname } = new URL(normalized.value);
    return [`turn:${hostname}:${TURN_PORT}`, `turn:${hostname}:${TURN_PORT}?transport=tcp`];
}
