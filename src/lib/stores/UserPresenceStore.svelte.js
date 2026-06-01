const isBrowser = typeof window !== 'undefined';

class UserPresenceStore {
    isInitialized = $state(false);
    isSaving = $state(false);
    clientId = $state(null);
    username = $state(null);
    currentProjectId = $state(null);
    peers = $state([]);

    _cleanupFns = [];

    constructor() {
        this.initialize = this.initialize.bind(this);
        this.setCurrentProject = this.setCurrentProject.bind(this);
        this.saveUsername = this.saveUsername.bind(this);
        this.ensureUsername = this.ensureUsername.bind(this);
        this.destroy = this.destroy.bind(this);
    }

    get state() {
        return this;
    }

    applyProfile(profile) {
        this.clientId = profile?.clientId || null;
        this.username = profile?.username || null;
    }

    applyPresence(projectId, presence) {
        if (!projectId || this.currentProjectId !== projectId) return;
        this.peers = Array.isArray(presence?.peers) ? presence.peers : [];
    }

    async initialize() {
        if (!isBrowser || this.isInitialized) return;

        this.applyProfile(await window.api.getGlobalProfile());

        const removeGlobalProfileListener = window.api.onGlobalProfileChanged((profile) => {
            this.applyProfile(profile);
        });

        const removeProjectPresenceListener = window.api.onProjectPresenceChanged(({ projectId, presence }) => {
            this.applyPresence(projectId, presence);
        });

        this._cleanupFns.push(removeGlobalProfileListener, removeProjectPresenceListener);
        this.isInitialized = true;
    }

    async setCurrentProject(projectId) {
        this.currentProjectId = projectId || null;
        this.peers = [];

        if (!isBrowser || !projectId) return;

        const presence = await window.api.getProjectPresence(projectId);

        if (this.currentProjectId === projectId) {
            this.peers = Array.isArray(presence?.peers) ? presence.peers : [];
        }
    }

    async saveUsername(username) {
        if (!isBrowser) return null;

        this.isSaving = true;
        try {
            const profile = await window.api.updateGlobalUsername(username);
            this.applyProfile(profile);
            return profile;
        } finally {
            this.isSaving = false;
        }
    }

    async ensureUsername() {
        if (this.username) return this.username;

        const profile = await this.saveUsername('');
        return profile?.username || null;
    }

    destroy() {
        this._cleanupFns.forEach((fn) => fn());
        this._cleanupFns = [];
        this.isInitialized = false;
    }
}

export const userPresenceStore = new UserPresenceStore();

export function getUserPresenceStore() {
    return userPresenceStore;
}
