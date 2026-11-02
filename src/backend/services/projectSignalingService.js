/**
 * Per-project P2P connection resolution: custom signaling relay, project
 * password and the derived backup TURN configuration.
 *
 * Join flows run before any local project row exists, so values entered at join
 * time live in transient "pending" state until sync materializes the real
 * project/settings rows. Never insert placeholder rows to hold them.
 *
 * Resolution order for both the relay and the password is always:
 * persisted row -> pending join value -> default.
 *
 * @namespace backend.services.projectSignalingService
 * @memberof backend.services
 */
import { eq } from 'drizzle-orm';
import { db } from '../../db/init.js';
import { project, settings } from '../../db/schema.js';
import { getRelayConfig, getTurnConfig } from '../utils/trysteroConfig.js';
import { generateTurnCredentials } from '../utils/turnCredentials.js';
import { buildTurnUrlsFromSignaling, normalizeTurnSecret, pickSignalingSettingsRow } from '../../lib/utils/signalingUrl.js';

const pendingProjectPasswords = new Map();
const pendingSignalingServers = new Map();
const pendingTurnSecrets = new Map();

/**
 * Store a pending project password used during join/reconnect flows. Passing a
 * falsy password clears the pending value.
 * @memberof backend.services.projectSignalingService
 * @param {string} projectId - Project identifier.
 * @param {(string|null)} password - Pending password.
 * @returns {void}
 */
export function setPendingProjectPassword(projectId, password) {
    if (!projectId) return;

    const normalizedPassword = typeof password === 'string' ? password.trim() : '';
    if (!normalizedPassword) {
        pendingProjectPasswords.delete(projectId);
        return;
    }

    pendingProjectPasswords.set(projectId, normalizedPassword);
}

/**
 * Store a pending custom signaling relay URL used during join flows. Passing a
 * falsy URL clears the pending value.
 * @memberof backend.services.projectSignalingService
 * @param {string} projectId - Project identifier.
 * @param {(string|null)} signalingUrl - Normalized relay URL, or null.
 * @returns {void}
 */
export function setPendingSignalingServer(projectId, signalingUrl) {
    if (!projectId) return;

    const normalized = typeof signalingUrl === 'string' ? signalingUrl.trim() : '';
    if (!normalized) {
        pendingSignalingServers.delete(projectId);
        return;
    }

    pendingSignalingServers.set(projectId, normalized);
}

/**
 * Resolve the project password: persisted column first, then the pending
 * join value. Returns undefined when the project has no password.
 * @memberof backend.services.projectSignalingService
 * @param {string} projectId - Project identifier.
 * @returns {Promise.<(string|undefined)>}
 */
export async function resolveProjectPassword(projectId) {
    if (!projectId) return undefined;

    try {
        const rows = await db
            .select({ password: project.password })
            .from(project)
            .where(eq(project.id, projectId))
            .limit(1)
            .execute();
        if (rows.length > 0 && rows[0].password) {
            return rows[0].password;
        }
    } catch (err) {
        console.warn('[P2P] Failed to load project password', { projectId, err: err?.message });
    }

    return pendingProjectPasswords.get(projectId) || undefined;
}

/**
 * Resolve the custom signaling relay URL: the authoritative settings row first
 * (owner-defined, arrives via sync), then the pending join value, then null for
 * the default network.
 * @memberof backend.services.projectSignalingService
 * @param {string} projectId - Project identifier.
 * @returns {Promise.<(string|null)>}
 */
export async function resolveProjectSignalingServer(projectId) {
    if (!projectId) return null;

    try {
        const rows = await db
            .select({ id: settings.id, sig_server: settings.sig_server })
            .from(settings)
            .where(eq(settings.project_id, projectId))
            .execute();
        const saved = pickSignalingSettingsRow(rows)?.sig_server || null;
        if (saved) return saved;
    } catch (err) {
        console.warn('[P2P] Failed to load project signaling settings', { projectId, err: err?.message });
    }

    return pendingSignalingServers.get(projectId) || null;
}

/**
 * Store a pending TURN shared secret used during join flows. Passing a falsy
 * value clears the pending value.
 * @memberof backend.services.projectSignalingService
 * @param {string} projectId - Project identifier.
 * @param {(string|null)} turnSecret - Pending TURN shared secret.
 * @returns {void}
 */
export function setPendingTurnSecret(projectId, turnSecret) {
    if (!projectId) return;

    const normalized = normalizeTurnSecret(turnSecret);
    if (!normalized) {
        pendingTurnSecrets.delete(projectId);
        return;
    }

    pendingTurnSecrets.set(projectId, normalized);
}

/**
 * Resolve the per-project TURN shared secret: the owner-defined settings row
 * first (it arrives through sync), then the pending value entered at join time.
 * The hint matters for peers behind strict NATs: the first connection needs
 * TURN before any settings row can be synced.
 * @memberof backend.services.projectSignalingService
 * @param {string} projectId - Project identifier.
 * @returns {Promise.<(string|null)>}
 */
export async function resolveProjectTurnSecret(projectId) {
    if (!projectId) return null;

    try {
        const rows = await db
            .select({ id: settings.id, turn_secret: settings.turn_secret })
            .from(settings)
            .where(eq(settings.project_id, projectId))
            .execute();
        const saved = normalizeTurnSecret(pickSignalingSettingsRow(rows)?.turn_secret);
        if (saved) return saved;
    } catch (err) {
        console.warn('[P2P] Failed to load project TURN secret', { projectId, err: err?.message });
    }

    return normalizeTurnSecret(pendingTurnSecrets.get(projectId));
}

/**
 * Build the TURN config for a project.
 *
 * A self-hosted Okpan server exposes coturn next to its relay: when a custom
 * signaling relay is configured, the TURN endpoints are derived from the relay
 * host and the credentials are time-limited HMAC values (TURN REST API)
 * generated from a shared secret. The secret is the per-project `turn_secret`
 * (set by the project owner, synced to every peer), falling back to the project
 * password. With no secret available, the env-configured TURN server applies
 * unchanged.
 * @memberof backend.services.projectSignalingService
 * @param {(string|null)} signalingUrl - Resolved signaling relay URL.
 * @param {(string|undefined)} password - Resolved project password.
 * @param {(string|null)} turnSecret - Resolved per-project TURN shared secret.
 * @returns {Object} `turnConfig` spread for `joinRoom()`.
 */
function buildTurnConfig(signalingUrl, password, turnSecret) {
    const secret = turnSecret || password;
    if (signalingUrl && secret) {
        const urls = buildTurnUrlsFromSignaling(signalingUrl);
        if (urls.length > 0) {
            return { turnConfig: [{ urls, ...generateTurnCredentials(secret) }] };
        }
    }

    return getTurnConfig();
}

/**
 * Resolve all per-project connection options for a Trystero room.
 * @memberof backend.services.projectSignalingService
 * @param {string} projectId - Project identifier.
 * @returns {Promise.<{signalingUrl: (string|null), password: (string|undefined), relay: Object, turn: Object}>}
 *   `relay` and `turn` spread directly into `joinRoom()` config.
 */
export async function resolveProjectConnection(projectId) {
    const signalingUrl = await resolveProjectSignalingServer(projectId);
    const password = await resolveProjectPassword(projectId);
    const turnSecret = await resolveProjectTurnSecret(projectId);

    return {
        signalingUrl,
        password,
        turnSecret,
        relay: getRelayConfig({ extraUrls: signalingUrl ? [signalingUrl] : [] }),
        turn: buildTurnConfig(signalingUrl, password, turnSecret)
    };
}
