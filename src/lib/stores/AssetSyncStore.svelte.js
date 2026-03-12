import { performQuery } from "$lib/stores/GraphqlUtils.js";
import { getLogStore } from "$lib/stores/LogStore.svelte.js";
import { assetsOperations } from "$lib/queries/assets.js";

let storeInstance = null;

export function getAssetSyncStore() {
    if (storeInstance) return storeInstance;

    const { error: logError } = getLogStore();
    let unsubscribeSyncProgress = null;

    const syncState = $state({
        assets: {}, // key: assetId => value: { status, progress, error, isGeneric }
        isInitialized: false,
        isLoading: false
    });

    const init = async (projectId) => {
        if (!projectId) return;

        syncState.isLoading = true;
        try {
            // Fetch initial local state using Drizzle GraphQL auto-generated queries
            const queryDef = assetsOperations.getLocalStates;

            const data = await performQuery(queryDef, { projectId });

            syncState.assets = {};

            // Populate state
            if (data?.assets) {
                for (const a of data.assets) {
                    const ls = a.localState;
                    syncState.assets[a.id] = {
                        status: ls?.sync_status || 'missing',
                        progress: ls?.download_progress ?? 0,
                        error: ls?.sync_error ?? null,
                        isGeneric: false
                    };
                }
            }
            if (data?.genericAssets) {
                for (const g of data.genericAssets) {
                    const ls = g.localState;
                    syncState.assets[g.id] = {
                        status: ls?.sync_status || 'missing',
                        progress: ls?.download_progress ?? 0,
                        error: ls?.sync_error ?? null,
                        isGeneric: true
                    };
                }
            }
            syncState.isInitialized = true;
        } catch (err) {
            console.error('[AssetSyncStore] failed to initialize:', err);
            await logError('AssetSyncStore Init', err.message);
        } finally {
            syncState.isLoading = false;
        }

        // Listen for IPC events triggered by backend torrent manager loops
        if (!unsubscribeSyncProgress && window.api?.onAssetSyncProgress) {
            unsubscribeSyncProgress = window.api.onAssetSyncProgress((payload) => {
                const { assetId, isGeneric, status, progress, error } = payload;
                if (!syncState.assets[assetId]) {
                    syncState.assets[assetId] = {
                        status: 'missing',
                        progress: 0,
                        error: null,
                        isGeneric
                    };
                }

                if (status !== undefined) syncState.assets[assetId].status = status;
                if (progress !== undefined) syncState.assets[assetId].progress = progress;
                if (error !== undefined) syncState.assets[assetId].error = error;
            });
        }
    };

    storeInstance = {
        get state() { return syncState; },
        init,
        // Utility method to quickly get state safely
        getAssetStatus(assetId) {
            return syncState.assets[assetId] || { status: 'missing', progress: 0, error: null };
        }
    };

    return storeInstance;
}
