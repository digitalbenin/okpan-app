const isBrowser = typeof window !== 'undefined';

class NetworkStatusStore {
    isInitialized = $state(false);
    online = $state(true);
    source = $state('startup');
    lastChangedAt = $state(null);

    _cleanupFns = [];

    constructor() {
        this.initialize = this.initialize.bind(this);
        this.destroy = this.destroy.bind(this);
    }

    get state() {
        return this;
    }

    applyStatus(online, source = 'unknown', ts = Date.now()) {
        if (typeof online !== 'boolean') return;
        if (this.online === online && this.source === source) return;

        this.online = online;
        this.source = source;
        this.lastChangedAt = ts;
    }

    async initialize() {
        if (!isBrowser || this.isInitialized) return;

        this.applyStatus(navigator.onLine, 'navigator-bootstrap');

        const handleBrowserOnline = () => this.applyStatus(true, 'browser-event');
        const handleBrowserOffline = () => this.applyStatus(false, 'browser-event');

        window.addEventListener('online', handleBrowserOnline);
        window.addEventListener('offline', handleBrowserOffline);

        this._cleanupFns.push(() => window.removeEventListener('online', handleBrowserOnline));
        this._cleanupFns.push(() => window.removeEventListener('offline', handleBrowserOffline));

        const removeNetworkStatusListener = window.api?.onNetworkStatusChanged?.((status) => {
            this.applyStatus(status?.online, status?.source || 'electron', status?.ts || Date.now());
        }) || null;

        if (removeNetworkStatusListener) {
            this._cleanupFns.push(removeNetworkStatusListener);
        }

        try {
            const status = await window.api?.getNetworkStatus?.();
            this.applyStatus(status?.online ?? navigator.onLine, status?.source || 'electron-bootstrap', status?.ts || Date.now());
        } catch {
            this.applyStatus(navigator.onLine, 'navigator-fallback');
        }

        this.isInitialized = true;
    }

    destroy() {
        this._cleanupFns.forEach((fn) => fn());
        this._cleanupFns = [];
        this.isInitialized = false;
    }
}

export const networkStatusStore = new NetworkStatusStore();

export function getNetworkStatusStore() {
    return networkStatusStore;
}
