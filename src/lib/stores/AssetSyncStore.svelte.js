import { getLogStore } from "$lib/stores/LogStore.svelte.js";

const { error: logError } = getLogStore();

let storeInstance = null;

export function getAssetSyncStore() {
    if (storeInstance) return storeInstance;

    const assetSyncState = $state({
        assets: {},
        isInitialized: false,
        isLoading: false,
    });

    let unsubscribeSyncProgress = null;

    const initialize = ({ assets = [], genericAssets = [] } = {}) => {
        assetSyncState.assets = {};

        for (const a of assets) {
            const ls = a.localState;
            assetSyncState.assets[a.id] = {
                status: ls?.sync_status || 'missing',
                progress: ls?.download_progress ?? 0,
                error: ls?.sync_error ?? null,
                isGeneric: false
            };
        }

        for (const g of genericAssets) {
            const ls = g.localState;
            assetSyncState.assets[g.id] = {
                status: ls?.sync_status || 'missing',
                progress: ls?.download_progress ?? 0,
                error: ls?.sync_error ?? null,
                isGeneric: true
            };
        }

        assetSyncState.isInitialized = true;
    };

    const setupSyncListener = () => {
        if (unsubscribeSyncProgress || !window.api?.onAssetSyncProgress) {
            return () => {};
        }

        unsubscribeSyncProgress = window.api.onAssetSyncProgress((payload) => {
            const { assetId, isGeneric, status, progress, error } = payload;
            if (!assetSyncState.assets[assetId]) {
                assetSyncState.assets[assetId] = {
                    status: 'missing',
                    progress: 0,
                    error: null,
                    isGeneric
                };
            }

            if (status !== undefined) assetSyncState.assets[assetId].status = status;
            if (progress !== undefined) assetSyncState.assets[assetId].progress = progress;
            if (error !== undefined) assetSyncState.assets[assetId].error = error;
        });

        return () => cleanup();
    };

    const cleanup = () => {
        if (unsubscribeSyncProgress) {
            unsubscribeSyncProgress();
            unsubscribeSyncProgress = null;
        }
    };

    const getAssetStatus = (assetId) =>
        assetSyncState.assets[assetId] || { status: 'missing', progress: 0, error: null };

    storeInstance = {
        get assetSyncState() { return assetSyncState; },
        initialize,
        setupSyncListener,
        cleanup,
        getAssetStatus,
    };

    return storeInstance;
}

export const assetSyncStore = getAssetSyncStore();
