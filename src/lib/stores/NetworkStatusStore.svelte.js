const isBrowser = typeof window !== 'undefined';

let storeInstance = null;

export function getNetworkStatusStore() {
    if (storeInstance) return storeInstance;

    const networkStatusState = $state({
        isInitialized: false,
        online: true,
        source: 'startup',
        lastChangedAt: null,
    });

    let cleanupFns = [];

    const applyStatus = (online, source = 'unknown', ts = Date.now()) => {
        if (typeof online !== 'boolean') return;
        if (networkStatusState.online === online && networkStatusState.source === source) return;
        networkStatusState.online = online;
        networkStatusState.source = source;
        networkStatusState.lastChangedAt = ts;
    };

    const initialize = async () => {
        if (!isBrowser || networkStatusState.isInitialized) return;

        applyStatus(navigator.onLine, 'navigator-bootstrap');

        const handleBrowserOnline = () => applyStatus(true, 'browser-event');
        const handleBrowserOffline = () => applyStatus(false, 'browser-event');

        window.addEventListener('online', handleBrowserOnline);
        window.addEventListener('offline', handleBrowserOffline);

        cleanupFns.push(() => window.removeEventListener('online', handleBrowserOnline));
        cleanupFns.push(() => window.removeEventListener('offline', handleBrowserOffline));

        const removeNetworkStatusListener = window.api?.onNetworkStatusChanged?.((status) => {
            applyStatus(status?.online, status?.source || 'electron', status?.ts || Date.now());
        }) || null;

        if (removeNetworkStatusListener) {
            cleanupFns.push(removeNetworkStatusListener);
        }

        try {
            const status = await window.api?.getNetworkStatus?.();
            applyStatus(status?.online ?? navigator.onLine, status?.source || 'electron-bootstrap', status?.ts || Date.now());
        } catch {
            applyStatus(navigator.onLine, 'navigator-fallback');
        }

        networkStatusState.isInitialized = true;
    };

    const destroy = () => {
        cleanupFns.forEach((fn) => fn());
        cleanupFns = [];
        networkStatusState.isInitialized = false;
    };

    storeInstance = {
        get networkStatusState() { return networkStatusState; },
        initialize,
        destroy,
    };

    return storeInstance;
}

export const networkStatusStore = getNetworkStatusStore();
