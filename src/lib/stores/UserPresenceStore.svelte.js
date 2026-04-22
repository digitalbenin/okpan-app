let storeInstance = null;

const isBrowser = typeof window !== 'undefined';

export function getUserPresenceStore() {
    if (storeInstance) {
        return storeInstance;
    }

    const state = $state({
        isInitialized: false,
        isSaving: false,
        clientId: null,
        username: null,
        currentProjectId: null,
        peers: []
    });

    let removeGlobalProfileListener = null;
    let removeProjectPresenceListener = null;

    function applyProfile(profile) {
        state.clientId = profile?.clientId || null;
        state.username = profile?.username || null;
    }

    function applyPresence(projectId, presence) {
        if (!projectId || state.currentProjectId !== projectId) {
            return;
        }

        state.peers = Array.isArray(presence?.peers) ? presence.peers : [];
    }

    const initialize = async () => {
        if (!isBrowser || state.isInitialized) {
            return;
        }

        applyProfile(await window.api.getGlobalProfile());

        removeGlobalProfileListener = window.api.onGlobalProfileChanged((profile) => {
            applyProfile(profile);
        });

        removeProjectPresenceListener = window.api.onProjectPresenceChanged(({ projectId, presence }) => {
            applyPresence(projectId, presence);
        });

        state.isInitialized = true;
    };

    const setCurrentProject = async (projectId) => {
        state.currentProjectId = projectId || null;
        state.peers = [];

        if (!isBrowser || !projectId) {
            return;
        }

        const presence = await window.api.getProjectPresence(projectId);

        if (state.currentProjectId === projectId) {
            state.peers = Array.isArray(presence?.peers) ? presence.peers : [];
        }
    };

    const saveUsername = async (username) => {
        if (!isBrowser) {
            return null;
        }

        state.isSaving = true;

        try {
            const profile = await window.api.updateGlobalUsername(username);
            applyProfile(profile);
            return profile;
        } finally {
            state.isSaving = false;
        }
    };

    const ensureUsername = async () => {
        if (state.username) {
            return state.username;
        }

        const profile = await saveUsername('');
        return profile?.username || null;
    };

    const destroy = () => {
        removeGlobalProfileListener?.();
        removeGlobalProfileListener = null;
        removeProjectPresenceListener?.();
        removeProjectPresenceListener = null;
        state.isInitialized = false;
    };

    storeInstance = {
        state,
        initialize,
        setCurrentProject,
        saveUsername,
        ensureUsername,
        destroy
    };

    return storeInstance;
}