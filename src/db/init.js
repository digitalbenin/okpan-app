import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema.js';
import { globalSettings, interface_languages, interface_translations } from './schema.js';
import { eq } from 'drizzle-orm';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import electron from 'electron';
import { setGlobalClientIdNumber } from '../backend/services/projectCache.js';
const { app } = electron;

const GLOBAL_SETTINGS_ID = 1;
const DEFAULT_INTERFACE_LANGUAGE_CODE = 'en';
const DEFAULT_DB_RELATIVE_PATH = 'src/db/local.db';

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

export function generateRandomUsername() {
    const suffix = Math.floor(100 + Math.random() * 900);
    return `${pickRandom(USERNAME_ADJECTIVES)}${pickRandom(USERNAME_NOUNS)}${suffix}`;
}

function resolveApplicationRoot() {
    const isElectron = !!process.versions.electron;

    if (isElectron && app?.isPackaged) {
        return app.getAppPath?.()
            || (process.resourcesPath ? path.join(process.resourcesPath, 'app') : process.cwd());
    }

    return process.cwd();
}

function resolveDatabasePath() {
    const envPath = process.env.DB_FILE_NAME || DEFAULT_DB_RELATIVE_PATH;

    if (path.isAbsolute(envPath)) {
        return envPath;
    }

    if (app?.isPackaged) {
        return path.join(APP_ROOT, envPath);
    }

    return path.resolve(envPath);
}

function getCurrentAppVersion() {
    return app?.getVersion?.() || process.env.npm_package_version || '1.0.0';
}

const APP_ROOT = resolveApplicationRoot();
const INTERFACE_TRANSLATIONS_DIR = path.join(APP_ROOT, 'src', 'assets', 'interface-translations');

const parseJsonFile = (filePath) => {
    const fileContent = fs.readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '');
    return JSON.parse(fileContent);
};

const dbPath = resolveDatabasePath();
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

console.log('Database path:', dbPath);
console.log('Database exists:', fs.existsSync(dbPath));

const client = createClient({
    url: `file:${dbPath.replace(/\\/g, '/')}`
});

const db = drizzle(client, { schema });

const ensureGlobalSettingsSchema = async () => {
    try {
        const result = await client.execute('PRAGMA table_info(global_settings)');
        const columnNames = Array.isArray(result.rows)
            ? result.rows.map((row) => row.name)
            : [];

        if (!columnNames.includes('username')) {
            await client.execute('ALTER TABLE global_settings ADD COLUMN username TEXT');
            console.log('Added username column to global_settings');
        }

        if (!columnNames.includes('interface_language')) {
            await client.execute('ALTER TABLE global_settings ADD COLUMN interface_language TEXT');
            console.log('Added interface_language column to global_settings');
        }
    } catch (error) {
        console.error('Error ensuring global settings schema:', error);
    }
};

const getBundledInterfaceTranslations = () => {
    if (!fs.existsSync(INTERFACE_TRANSLATIONS_DIR)) {
        return {
            languages: [],
            translations: []
        };
    }

    const entries = fs.readdirSync(INTERFACE_TRANSLATIONS_DIR, { withFileTypes: true });
    const localeFiles = entries.filter((entry) => entry.isFile() && path.extname(entry.name).toLowerCase() === '.json');

    const languages = [];
    const languageCodes = new Set();
    const translations = [];

    for (const entry of localeFiles) {
        const filePath = path.join(INTERFACE_TRANSLATIONS_DIR, entry.name);
        const rawFile = parseJsonFile(filePath);
        const locale = rawFile?.code?.trim()?.toLowerCase()
            || entry.name.slice(0, -path.extname(entry.name).length).trim().toLowerCase();

        if (!locale) {
            continue;
        }

        const fileTranslations = Array.isArray(rawFile?.translations)
            ? rawFile.translations
            : Array.isArray(rawFile)
                ? rawFile
                : [];

        if (!languageCodes.has(locale)) {
            languages.push({
                code: locale,
                name: rawFile?.name?.trim() || locale
            });
            languageCodes.add(locale);
        }

        for (const translation of fileTranslations) {
            if (!translation?.namespace || !translation?.key || translation?.value === undefined || translation?.value === null) {
                continue;
            }

            translations.push({
                locale,
                namespace: translation.namespace,
                key: translation.key,
                value: translation.value
            });
        }
    }

    return { languages, translations };
};

const ensureDefaultInterfaceTranslations = async () => {
    try {
        const existingLanguages = await db.select().from(interface_languages);
        const existingTranslations = await db.select().from(interface_translations);

        const bundled = getBundledInterfaceTranslations();
        const existingLanguageCodes = new Set(
            existingLanguages
                .map((language) => language.code?.trim()?.toLowerCase())
                .filter(Boolean)
        );
        const existingTranslationKeys = new Set(
            existingTranslations
                .map((translation) => {
                    const locale = translation.locale?.trim()?.toLowerCase();
                    if (!locale || !translation.namespace || !translation.key) {
                        return null;
                    }

                    return `${locale}::${translation.namespace}::${translation.key}`;
                })
                .filter(Boolean)
        );

        const missingLanguages = [];
        const languageMap = new Map();

        for (const language of bundled.languages) {
            if (!language?.code) {
                continue;
            }

            const normalizedCode = language.code.trim().toLowerCase();
            if (!normalizedCode) {
                continue;
            }

            languageMap.set(normalizedCode, {
                code: normalizedCode,
                name: language.name?.trim() || normalizedCode.toUpperCase()
            });
        }

        for (const translation of bundled.translations) {
            if (!translation?.locale) {
                continue;
            }

            const normalizedCode = translation.locale.trim().toLowerCase();
            if (!normalizedCode || languageMap.has(normalizedCode)) {
                continue;
            }

            languageMap.set(normalizedCode, {
                code: normalizedCode,
                name: normalizedCode === 'en' ? 'English' : normalizedCode.toUpperCase()
            });
        }

        if (!languageMap.has(DEFAULT_INTERFACE_LANGUAGE_CODE)) {
            languageMap.set(DEFAULT_INTERFACE_LANGUAGE_CODE, {
                code: DEFAULT_INTERFACE_LANGUAGE_CODE,
                name: DEFAULT_INTERFACE_LANGUAGE_CODE
            });
        }

        for (const language of languageMap.values()) {
            if (existingLanguageCodes.has(language.code)) {
                continue;
            }
            missingLanguages.push(language);
        }

        if (missingLanguages.length > 0) {
            await db.insert(interface_languages).values(missingLanguages);
            console.log(`Bootstrapped ${missingLanguages.length} interface languages`);
        }

        if (bundled.translations.length > 0) {
            const translationsToInsert = bundled.translations
                .filter((translation) => translation?.locale && translation?.namespace && translation?.key && translation?.value)
                .map((translation) => ({
                    locale: translation.locale.trim().toLowerCase(),
                    namespace: translation.namespace,
                    key: translation.key,
                    value: translation.value
                }))
                .filter((translation) => {
                    const compoundKey = `${translation.locale}::${translation.namespace}::${translation.key}`;
                    return !existingTranslationKeys.has(compoundKey);
                });

            if (translationsToInsert.length > 0) {
                await db.insert(interface_translations).values(translationsToInsert);
                console.log(`Bootstrapped ${translationsToInsert.length} interface translations`);
            }
        }
    } catch (error) {
        console.error('Error ensuring default interface translations:', error);
    }
};

let globalSettingsInitialization = null;
let globalSettingsInitialized = false;

const initializeGlobalSettings = async () => {
    if (globalSettingsInitialized) {
        return;
    }

    if (globalSettingsInitialization) {
        return globalSettingsInitialization;
    }

    globalSettingsInitialization = (async () => {
        try {
            await ensureGlobalSettingsSchema();

            const existing = await db
                .select()
                .from(globalSettings)
                .where(eq(globalSettings.id, GLOBAL_SETTINGS_ID))
                .limit(1);

            if (existing.length === 0) {
                const newClientId = randomUUID();
                await db.insert(globalSettings).values({
                    id: GLOBAL_SETTINGS_ID,
                    client_id: newClientId,
                    username: null,
                    interface_language: DEFAULT_INTERFACE_LANGUAGE_CODE,
                    app_version: getCurrentAppVersion()
                });
                console.log('Global settings initialized with new client_id');
                setGlobalClientIdNumber(newClientId);
            } else {
                const currentSettings = existing[0];
                const updates = {};

                if (!currentSettings.interface_language) {
                    updates.interface_language = DEFAULT_INTERFACE_LANGUAGE_CODE;
                }

                if (Object.keys(updates).length > 0) {
                    await db
                        .update(globalSettings)
                        .set(updates)
                        .where(eq(globalSettings.id, GLOBAL_SETTINGS_ID));
                }

                console.log('Global settings already exist, client_id:', currentSettings.client_id);
                setGlobalClientIdNumber(currentSettings.client_id);
            }

            await ensureDefaultInterfaceTranslations();
            globalSettingsInitialized = true;
        } catch (error) {
            console.error('Error initializing global settings:', error);
            throw error;
        } finally {
            globalSettingsInitialization = null;
        }
    })();

    return globalSettingsInitialization;
};

const getGlobalSettingsRow = async () => {
    await initializeGlobalSettings();
    const settings = await db
        .select()
        .from(globalSettings)
        .where(eq(globalSettings.id, GLOBAL_SETTINGS_ID))
        .limit(1);
    return settings[0] || null;
};

export const getClientId = async () => {
    try {
        const settings = await getGlobalSettingsRow();
        return settings?.client_id || null;
    } catch (error) {
        console.error('Error getting client_id:', error);
        return null;
    }
};

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

export const updateGlobalUsername = async (username) => {
    try {
        const normalizedUsername = typeof username === 'string' ? username.trim() : '';
        const nextUsername = normalizedUsername || generateRandomUsername();

        await initializeGlobalSettings();
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

export const updateGlobalInterfaceLanguage = async (locale) => {
    try {
        const normalizedLocale = typeof locale === 'string' ? locale.trim() : '';
        const nextLocale = normalizedLocale || null;

        await initializeGlobalSettings();
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

void initializeGlobalSettings();

export { db, client, dbPath };