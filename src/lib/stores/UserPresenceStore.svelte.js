const isBrowser = typeof window !== 'undefined';

let storeInstance = null;

export function getUserPresenceStore() {
    if (storeInstance) return storeInstance;

    const userPresenceState = $state({
        isInitialized: false,
        isSaving: false,
        clientId: null,
        username: null,
        currentProjectId: null,
        peers: [],
    });

    let cleanupFns = [];

    const applyProfile = (profile) => {
        userPresenceState.clientId = profile?.clientId || null;
        userPresenceState.username = profile?.username || null;
    };

    const applyPresence = (projectId, presence) => {
        if (!projectId || userPresenceState.currentProjectId !== projectId) return;
        userPresenceState.peers = Array.isArray(presence?.peers) ? presence.peers : [];
    };

    const initialize = async () => {
        if (!isBrowser || userPresenceState.isInitialized) return;

        applyProfile(await window.api.getGlobalProfile());

        const removeGlobalProfileListener = window.api.onGlobalProfileChanged((profile) => {
            applyProfile(profile);
        });

        const removeProjectPresenceListener = window.api.onProjectPresenceChanged(({ projectId, presence }) => {
            applyPresence(projectId, presence);
        });

        cleanupFns.push(removeGlobalProfileListener, removeProjectPresenceListener);
        userPresenceState.isInitialized = true;
    };

    const setCurrentProject = async (projectId) => {
        userPresenceState.currentProjectId = projectId || null;
        userPresenceState.peers = [];

        if (!isBrowser || !projectId) return;

        const presence = await window.api.getProjectPresence(projectId);

        if (userPresenceState.currentProjectId === projectId) {
            userPresenceState.peers = Array.isArray(presence?.peers) ? presence.peers : [];
        }
    };

    const saveUsername = async (username) => {
        if (!isBrowser) return null;
        userPresenceState.isSaving = true;
        try {
            const profile = await window.api.updateGlobalUsername(username);
            applyProfile(profile);
            return profile;
        } finally {
            userPresenceState.isSaving = false;
        }
    };

    const ensureUsername = async () => {
        if (userPresenceState.username) return userPresenceState.username;
        const profile = await saveUsername('');
        return profile?.username || null;
    };

    const destroy = () => {
        cleanupFns.forEach((fn) => fn());
        cleanupFns = [];
        userPresenceState.isInitialized = false;
    };

    storeInstance = {
        get userPresenceState() { return userPresenceState; },
        initialize,
        setCurrentProject,
        saveUsername,
        ensureUsername,
        destroy,
    };

    return storeInstance;
}

export const userPresenceStore = getUserPresenceStore();
