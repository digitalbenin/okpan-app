let storeInstance = null;

const isBrowser = typeof window !== 'undefined';

export function getNetworkStatusStore() {
    if (storeInstance) {
        return storeInstance;
    }

    const state = $state({
        isInitialized: false,
        online: true,
        source: 'startup',
        lastChangedAt: null
    });

    let removeNetworkStatusListener = null;
    let removeBrowserOnlineListener = null;
    let removeBrowserOfflineListener = null;

    function applyStatus(online, source = 'unknown', ts = Date.now()) {
        console.log('[NetworkStore] applyStatus called', {
            online,
            source,
            ts,
            currentOnline: state.online,
            currentSource: state.source
        });

        if (typeof online !== 'boolean') {
            console.log('[NetworkStore] ignored non-boolean online value', { online, source });
            return;
        }

        if (state.online === online && state.source === source) {
            console.log('[NetworkStore] ignored duplicate status', { online, source });
            return;
        }

        state.online = online;
        state.source = source;
        state.lastChangedAt = ts;
        console.log('[NetworkStore] state updated', {
            online: state.online,
            source: state.source,
            lastChangedAt: state.lastChangedAt
        });
    }

    const initialize = async () => {
        if (!isBrowser || state.isInitialized) {
            console.log('[NetworkStore] initialize skipped', {
                isBrowser,
                isInitialized: state.isInitialized
            });
            return;
        }

        console.log('[NetworkStore] initialize start', {
            navigatorOnline: navigator.onLine
        });

        applyStatus(navigator.onLine, 'navigator-bootstrap');

        const handleBrowserOnline = () => {
            console.log('[NetworkStore] browser online event');
            applyStatus(true, 'browser-event');
        };
        const handleBrowserOffline = () => {
            console.log('[NetworkStore] browser offline event');
            applyStatus(false, 'browser-event');
        };

        window.addEventListener('online', handleBrowserOnline);
        window.addEventListener('offline', handleBrowserOffline);

        removeBrowserOnlineListener = () => window.removeEventListener('online', handleBrowserOnline);
        removeBrowserOfflineListener = () => window.removeEventListener('offline', handleBrowserOffline);

        removeNetworkStatusListener = window.api?.onNetworkStatusChanged?.((status) => {
            console.log('[NetworkStore] electron network-status-changed event', status);
            applyStatus(status?.online, status?.source || 'electron', status?.ts || Date.now());
        }) || null;

        try {
            const status = await window.api?.getNetworkStatus?.();
            console.log('[NetworkStore] getNetworkStatus resolved', status);
            applyStatus(status?.online ?? navigator.onLine, status?.source || 'electron-bootstrap', status?.ts || Date.now());
        } catch {
            console.log('[NetworkStore] getNetworkStatus failed, using navigator fallback', {
                navigatorOnline: navigator.onLine
            });
            applyStatus(navigator.onLine, 'navigator-fallback');
        }

        state.isInitialized = true;
        console.log('[NetworkStore] initialize complete', {
            online: state.online,
            source: state.source
        });
    };

    const destroy = () => {
        removeNetworkStatusListener?.();
        removeNetworkStatusListener = null;
        removeBrowserOnlineListener?.();
        removeBrowserOnlineListener = null;
        removeBrowserOfflineListener?.();
        removeBrowserOfflineListener = null;
        state.isInitialized = false;
    };

    storeInstance = {
        state,
        initialize,
        destroy
    };

    return storeInstance;
}