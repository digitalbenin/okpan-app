import { watch } from "runed";

const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_INITIAL_DELAY_MS = 1000;
const RECONNECT_RETRY_DELAY_MS = 4000;

/**
 * Manages automatic P2P reconnect/suspend cycles in response to network changes.
 *
 * Must be called during component initialization (uses `watch` internally).
 *
 * @param {object} networkStatusState - Reactive state from NetworkStatusStore.
 * @param {() => string | undefined} getProjectId - Getter for the active project ID.
 * @returns {{ destroy: () => void }}
 */
export function createP2PReconnectManager(networkStatusState, getProjectId) {
    let prevOnline = null;
    let reconnectTimeout = null;
    let reconnectRunId = 0;
    let reconnectAttemptCount = 0;

    const stopReconnectCycle = () => {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
        reconnectAttemptCount = 0;
    };

    const runReconnectAttempt = async (projectId, runId) => {
        if (!projectId || runId !== reconnectRunId || !networkStatusState.online) return;

        reconnectAttemptCount += 1;

        try {
            console.log("Restarting P2P discovery...", { projectId, runId });
            const result = await window.api.reconnectP2PProject(projectId);

            if (!result?.success) {
                const canRetry = runId === reconnectRunId
                    && networkStatusState.online
                    && reconnectAttemptCount < MAX_RECONNECT_ATTEMPTS;

                if (canRetry) {
                    reconnectTimeout = setTimeout(
                        () => void runReconnectAttempt(projectId, runId),
                        RECONNECT_RETRY_DELAY_MS
                    );
                }
                return;
            }

            stopReconnectCycle();
        } catch (err) {
            console.warn("Failed to reconnect P2P:", err);

            const canRetry = runId === reconnectRunId
                && networkStatusState.online
                && reconnectAttemptCount < MAX_RECONNECT_ATTEMPTS;

            if (canRetry) {
                reconnectTimeout = setTimeout(
                    () => void runReconnectAttempt(projectId, runId),
                    RECONNECT_RETRY_DELAY_MS
                );
            }
        }
    };

    const scheduleReconnect = (projectId) => {
        console.log("Network online, scheduling P2P reconnect...");
        if (!projectId) return;

        reconnectRunId += 1;
        const runId = reconnectRunId;
        stopReconnectCycle();
        reconnectTimeout = setTimeout(
            () => void runReconnectAttempt(projectId, runId),
            RECONNECT_INITIAL_DELAY_MS
        );
    };

    const suspend = (projectId) => {
        console.log("Network offline, suspending P2P...");
        reconnectRunId += 1;
        if (!projectId) return;

        stopReconnectCycle();
        window.api.suspendP2PProject(projectId).catch((err) => {
            console.warn("Failed to suspend P2P:", err);
        });
    };

    watch(
        () => networkStatusState.lastChangedAt,
        () => {
            if (!networkStatusState.isInitialized) return;

            const { online, source } = networkStatusState;

            // First post-init fire: record baseline state without triggering any action.
            if (prevOnline === null) {
                prevOnline = online;
                return;
            }

            const projectId = getProjectId();

            // Device resumed from sleep: always attempt reconnect if online,
            // regardless of whether the online flag itself changed.
            if (source === "electron-resume") {
                prevOnline = online;
                if (projectId && online) scheduleReconnect(projectId);
                return;
            }

            if (prevOnline === online) return;
            prevOnline = online;

            if (!projectId) return;

            if (online) {
                scheduleReconnect(projectId);
            } else {
                suspend(projectId);
            }
        }
    );

    return {
        destroy() {
            reconnectRunId += 1;
            stopReconnectCycle();
        }
    };
}
