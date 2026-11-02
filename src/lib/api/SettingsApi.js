import { executeQuery } from "$lib/api/graphqlClient.js";
import { normalizeSignalingUrl, normalizeTurnSecret, pickSignalingSettingsRow } from "$lib/utils/signalingUrl.js";

/**
 * Per-project P2P settings (`settings` row): custom signaling relay and related
 * connection options.
 *
 * @namespace frontend.api.SettingsApi
 */

/**
 * Returns all settings rows for a project (normally a single row).
 * @memberOf frontend.api.SettingsApi
 * @method
 * @param {string} projectId - The project ID.
 * @returns {Promise.<Array.<Object>>} Settings rows, empty when the project has none yet.
 */
export const getProjectSettings = async (projectId) => {
    if (!projectId) return [];
    const result = await executeQuery('settings', 'getByProjectId', { projectId });
    return Array.isArray(result) ? result : [];
};

/**
 * Returns the effective connection settings for a project: the custom signaling
 * server URL and the TURN shared secret, both null when not configured.
 * @memberOf frontend.api.SettingsApi
 * @method
 * @param {string} projectId - The project ID.
 * @returns {Promise.<{signalingServer: (string|null), turnSecret: (string|null)}>} 
 */
export const getProjectConnectionSettings = async (projectId) => {
    const rows = await getProjectSettings(projectId);
    const row = pickSignalingSettingsRow(rows);
    return {
        signalingServer: row?.sig_server || null,
        turnSecret: row?.turn_secret || null,
    };
};

/**
 * Creates or updates the custom signaling server URL for a project.
 * Passing null or an empty string resets the project to the default network.
 * @memberOf frontend.api.SettingsApi
 * @method
 * @param {string} projectId - The project ID.
 * @param {(string|null)} signalingUrl - Signaling relay URL.
 * @returns {Promise.<{result: (Object|null), error: (string|null)}>}
 */
export const setProjectSignalingServer = async (projectId, signalingUrl) => {
    if (!projectId) {
        return { result: null, error: "Missing Project ID" };
    }

    const normalized = normalizeSignalingUrl(signalingUrl);
    if (!normalized.ok) {
        return { result: null, error: normalized.error };
    }

    try {
        const result = await executeQuery('settings', 'setSignalingServer', {
            projectId,
            sigServer: normalized.value,
        });
        return { result, error: null };
    } catch (error) {
        console.error('Project signaling settings update error:', error);
        return { result: null, error: error.message || error };
    }
};

/**
 * Creates or updates the TURN shared secret for a project.
 * Passing null or an empty string removes the secret.
 * @memberOf frontend.api.SettingsApi
 * @method
 * @param {string} projectId - The project ID.
 * @param {(string|null)} turnSecret - TURN shared secret.
 * @returns {Promise.<{result: (Object|null), error: (string|null)}>} 
 */
export const setProjectTurnSecret = async (projectId, turnSecret) => {
    if (!projectId) {
        return { result: null, error: "Missing Project ID" };
    }

    try {
        const result = await executeQuery('settings', 'setTurnSecret', {
            projectId,
            turnSecret: normalizeTurnSecret(turnSecret),
        });
        return { result, error: null };
    } catch (error) {
        console.error('Project TURN secret update error:', error);
        return { result: null, error: error.message || error };
    }
};

/**
 * Persists the connection settings entered while joining a project (signaling
 * URL and TURN secret), but only when the project has no settings row yet. A
 * row created by the project owner is authoritative and arrives through sync,
 * so it is never overwritten here.
 * @memberOf frontend.api.SettingsApi
 * @method
 * @param {string} projectId - The project ID.
 * @param {(string|null)} signalingUrl - Signaling relay URL entered at join time.
 * @param {(string|null)} turnSecret - TURN shared secret entered at join time.
 * @returns {Promise.<{result: (Object|null), error: (string|null), skipped: (boolean|undefined)}>} 
 */
export const persistJoinConnectionSettings = async (projectId, signalingUrl, turnSecret) => {
    const normalized = normalizeSignalingUrl(signalingUrl);
    const secret = normalizeTurnSecret(turnSecret);
    if (!projectId || !normalized.ok || (!normalized.value && !secret)) {
        return { result: null, error: normalized.ok ? null : normalized.error, skipped: true };
    }

    try {
        const rows = await getProjectSettings(projectId);
        if (rows.length > 0) {
            return { result: null, error: null, skipped: true };
        }
    } catch (error) {
        console.warn('Failed to inspect project settings before persisting join values:', error);
        return { result: null, error: error.message || error, skipped: true };
    }

    if (normalized.value) {
        const { error } = await setProjectSignalingServer(projectId, normalized.value);
        if (error) return { result: null, error, skipped: true };
    }
    if (secret) {
        const { error } = await setProjectTurnSecret(projectId, secret);
        if (error) return { result: null, error, skipped: true };
    }

    return { result: null, error: null, skipped: false };
};
