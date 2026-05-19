import { db, ensureDatabaseReady } from '../init.js';
import { globalSettings } from '../schema.js';
import { eq } from 'drizzle-orm';

const GLOBAL_SETTINGS_ID = 1;

const USERNAME_ADJECTIVES = [
    'Amber',
    'Bright',
    'Calm',
    'Clever',
    'Golden',
    'Merry',
    'Quiet',
    'Silver',
    'Swift',
    'Wild'
];

const USERNAME_NOUNS = [
    'Badger',
    'Falcon',
    'Fox',
    'Heron',
    'Otter',
    'Panda',
    'Robin',
    'Seal',
    'Wolf',
    'Wren'
];

function pickRandom(items) {
    return items[Math.floor(Math.random() * items.length)];
}

/**
 * Generates a random display name in the form `AdjectiveNounNNN`.
 * Used as the default username when no name has been configured.
 *
 * @returns {string}
 */
export function generateRandomUsername() {
    const suffix = Math.floor(100 + Math.random() * 900);
    return `${pickRandom(USERNAME_ADJECTIVES)}${pickRandom(USERNAME_NOUNS)}${suffix}`;
}

const getGlobalSettingsRow = async () => {
    await ensureDatabaseReady();
    const rows = await db
        .select()
        .from(globalSettings)
        .where(eq(globalSettings.id, GLOBAL_SETTINGS_ID))
        .limit(1);
    return rows[0] || null;
};

/**
 * Returns the current user's profile from global settings.
 *
 * @returns {Promise<{ clientId: string|null, username: string|null }>}
 */
export const getGlobalProfile = async () => {
    try {
        const settings = await getGlobalSettingsRow();
        return {
            clientId: settings?.client_id || null,
            username: settings?.username || null
        };
    } catch (error) {
        console.error('Error getting global profile:', error);
        return {
            clientId: null,
            username: null
        };
    }
};

/**
 * Returns the full set of app-wide global settings.
 *
 * @returns {Promise<{ clientId: string|null, interfaceLanguage: string|null, appVersion: string|null }>}
 */
export const getGlobalSettings = async () => {
    try {
        const settings = await getGlobalSettingsRow();
        return {
            clientId: settings?.client_id || null,
            interfaceLanguage: settings?.interface_language || null,
            appVersion: settings?.app_version || null
        };
    } catch (error) {
        console.error('Error getting global settings:', error);
        return {
            clientId: null,
            interfaceLanguage: null,
            appVersion: null
        };
    }
};

/**
 * Persists a new display name for the current user.
 * Falls back to a randomly generated username when `username` is blank.
 *
 * @param {string} username
 * @returns {Promise<{ clientId: string|null, username: string|null }>}
 */
export const updateGlobalUsername = async (username) => {
    try {
        const normalizedUsername = typeof username === 'string' ? username.trim() : '';
        const nextUsername = normalizedUsername || generateRandomUsername();

        await ensureDatabaseReady();
        await db
            .update(globalSettings)
            .set({ username: nextUsername })
            .where(eq(globalSettings.id, GLOBAL_SETTINGS_ID));

        return getGlobalProfile();
    } catch (error) {
        console.error('Error updating global username:', error);
        throw error;
    }
};

/**
 * Persists the preferred UI locale.
 *
 * @param {string} locale BCP 47 language tag (e.g. `'en'`, `'it'`).
 * @returns {Promise<{ clientId: string|null, interfaceLanguage: string|null, appVersion: string|null }>}
 */
export const updateGlobalInterfaceLanguage = async (locale) => {
    try {
        const normalizedLocale = typeof locale === 'string' ? locale.trim() : '';
        const nextLocale = normalizedLocale || null;

        await ensureDatabaseReady();
        await db
            .update(globalSettings)
            .set({ interface_language: nextLocale })
            .where(eq(globalSettings.id, GLOBAL_SETTINGS_ID));

        return getGlobalSettings();
    } catch (error) {
        console.error('Error updating interface language:', error);
        throw error;
    }
};
