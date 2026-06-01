import { getLogStore } from "$lib/stores/LogStore.svelte.js";

const { error: logError } = getLogStore();

class AssetSyncStore {
    assets = $state({});
    isInitialized = $state(false);
    isLoading = $state(false);

    #unsubscribeSyncProgress = null;

    constructor() {
        this.initialize = this.initialize.bind(this);
        this.cleanup = this.cleanup.bind(this);
        this.getAssetStatus = this.getAssetStatus.bind(this);
        this.setupSyncListener = this.setupSyncListener.bind(this);
    }

    get state() {
        return this;
    }

    /**
     * Initialize store from pre-loaded asset sync data.
     * @param {Object} options
     * @param {Array} [options.assets=[]]
     * @param {Array} [options.genericAssets=[]]
     */
    initialize({ assets = [], genericAssets = [] } = {}) {
        this.assets = {};

        for (const a of assets) {
            const ls = a.localState;
            this.assets[a.id] = {
                status: ls?.sync_status || 'missing',
                progress: ls?.download_progress ?? 0,
                error: ls?.sync_error ?? null,
                isGeneric: false
            };
        }

        for (const g of genericAssets) {
            const ls = g.localState;
            this.assets[g.id] = {
                status: ls?.sync_status || 'missing',
                progress: ls?.download_progress ?? 0,
                error: ls?.sync_error ?? null,
                isGeneric: true
            };
        }

        this.isInitialized = true;
    }

    /**
     * Set up IPC listener for real-time sync progress updates.
     * Call this once (e.g. in a component $effect or onMount).
     * @returns {Function} Cleanup function to unsubscribe.
     */
    setupSyncListener() {
        if (this.#unsubscribeSyncProgress || !window.api?.onAssetSyncProgress) {
            return () => {};
        }

        this.#unsubscribeSyncProgress = window.api.onAssetSyncProgress((payload) => {
            const { assetId, isGeneric, status, progress, error } = payload;
            if (!this.assets[assetId]) {
                this.assets[assetId] = {
                    status: 'missing',
                    progress: 0,
                    error: null,
                    isGeneric
                };
            }

            if (status !== undefined) this.assets[assetId].status = status;
            if (progress !== undefined) this.assets[assetId].progress = progress;
            if (error !== undefined) this.assets[assetId].error = error;
        });

        return () => this.cleanup();
    }

    cleanup() {
        if (this.#unsubscribeSyncProgress) {
            this.#unsubscribeSyncProgress();
            this.#unsubscribeSyncProgress = null;
        }
    }

    getAssetStatus(assetId) {
        return this.assets[assetId] || { status: 'missing', progress: 0, error: null };
    }
}

export const assetSyncStore = new AssetSyncStore();

export function getAssetSyncStore() {
    return assetSyncStore;
}
