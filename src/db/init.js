import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema.js';
import { globalSettings, interface_languages, interface_translations } from './schema.js';
import { eq } from 'drizzle-orm';
import { dirname, extname, join } from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';

const GLOBAL_SETTINGS_ID = 1;
const DEFAULT_INTERFACE_LANGUAGE_CODE = 'en';
const INTERFACE_TRANSLATIONS_DIR = join(process.cwd(), 'src', 'assets', 'interface-translations');

const parseJsonFile = (filePath) => {
    const fileContent = fs.readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '');
    return JSON.parse(fileContent);
};

// Get the database path from env
const dbPath = process.env.DB_FILE_NAME || 'src/db/local.db';

// Ensure the database directory exists
const dbDir = dirname(dbPath);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// Debug logging
console.log('Database path:', dbPath);
console.log('Database exists:', fs.existsSync(dbPath));

// Create the SQLite client with proper URL format
const client = createClient({
    url: `file:${dbPath.replace(/\\/g, '/')}` // Ensure forward slashes for URLs
});

// Create Drizzle instance with schema
const db = drizzle(client, { schema });

const ensureGlobalSettingsSchema = async () => {
    try {
        const result = await client.execute('PRAGMA table_info(global_settings)');
        const columnNames = Array.isArray(result.rows)
            ? result.rows.map((row) => row.name)
            : [];

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
    const localeFiles = entries.filter((entry) => entry.isFile() && extname(entry.name).toLowerCase() === '.json');

    const languages = [];
    const languageCodes = new Set();
    const translations = [];

    for (const entry of localeFiles) {
        const filePath = join(INTERFACE_TRANSLATIONS_DIR, entry.name);
        const rawFile = parseJsonFile(filePath);
        const locale = rawFile?.code?.trim()?.toLowerCase()
            || entry.name.slice(0, -extname(entry.name).length).trim().toLowerCase();
        if (!locale) continue;

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
            if (!language?.code) continue;

            const normalizedCode = language.code.trim().toLowerCase();
            if (!normalizedCode) continue;

            languageMap.set(normalizedCode, {
                code: normalizedCode,
                name: language.name?.trim() || normalizedCode.toUpperCase()
            });
        }

        for (const translation of bundled.translations) {
            if (!translation?.locale) continue;

            const normalizedCode = translation.locale.trim().toLowerCase();
            if (!normalizedCode || languageMap.has(normalizedCode)) continue;

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
            if (existingLanguageCodes.has(language.code)) continue;
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

// Initialize global settings (singleton)
const initializeGlobalSettings = async () => {
    try {
        await ensureGlobalSettingsSchema();

        // Check if global settings already exist
        const existing = await db.select().from(globalSettings).where(eq(globalSettings.id, GLOBAL_SETTINGS_ID)).limit(1);

        if (existing.length === 0) {
            // Create the singleton row with UUID
            await db.insert(globalSettings).values({
                id: GLOBAL_SETTINGS_ID, // Enforce singleton
                client_id: randomUUID(),
                app_version: process.env.npm_package_version || '1.0.0'
            });
            console.log('Global settings initialized with new client_id');
        } else {
            console.log('Global settings already exist, client_id:', existing[0].client_id);
        }

        await ensureDefaultInterfaceTranslations();
    } catch (error) {
        console.error('Error initializing global settings:', error);
    }
};

const getGlobalSettingsRow = async () => {
    await initializeGlobalSettings();
    const settings = await db.select().from(globalSettings).where(eq(globalSettings.id, GLOBAL_SETTINGS_ID)).limit(1);
    return settings[0] || null;
};

// Helper function to get client ID
export const getClientId = async () => {
    try {
        const settings = await getGlobalSettingsRow();
        return settings?.client_id || null;
    } catch (error) {
        console.error('Error getting client_id:', error);
        return null;
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

export const updateGlobalInterfaceLanguage = async (locale) => {
    try {
        const normalizedLocale = typeof locale === 'string' ? locale.trim() : '';
        const nextLocale = normalizedLocale || null;

        await initializeGlobalSettings();
        await db.update(globalSettings)
            .set({ interface_language: nextLocale })
            .where(eq(globalSettings.id, GLOBAL_SETTINGS_ID));

        return getGlobalSettings();
    } catch (error) {
        console.error('Error updating interface language:', error);
        throw error;
    }
};

// Initialize on startup
initializeGlobalSettings();

export { db };