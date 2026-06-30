/**
 * Core database module — initialises the SQLite database via Drizzle ORM,
 * runs pending migrations, seeds global settings, and back-fills search indexes.
 *
 * @namespace db
 */
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { createClient } from '@libsql/client';
import electron from 'electron';
import * as schema from './schema.js';
import { globalSettings, interface_languages, interface_translations } from './schema.js';
import { eq } from 'drizzle-orm';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { setGlobalClientIdNumber } from '../backend/services/projectCacheService.js';
import { resolveApplicationRoot, resolveDatabasePath } from './runtimeDatabasePaths.js';
import { populateInstitutionsSearchIndex } from './scripts/populateInstitutionsSearch.js';
import { populateObjectSearchIndexes } from './scripts/populateObjectSearchIndexes.js';

const { app } = electron;

const GLOBAL_SETTINGS_ID = 1;
const DEFAULT_INTERFACE_LANGUAGE_CODE = 'en';
const DRIZZLE_MIGRATIONS_TABLE = '__drizzle_migrations';

const APP_ROOT = resolveApplicationRoot();
const INTERFACE_TRANSLATIONS_DIR = path.join(APP_ROOT, 'src', 'assets', 'interface-translations');
const MIGRATIONS_FOLDER = path.join(APP_ROOT, 'src', 'db', 'migrations');
const dbPath = resolveDatabasePath();

ensureDirectoryExists(path.dirname(dbPath));

console.log('Database path:', dbPath);
console.log('Database exists:', fs.existsSync(dbPath));

const client = createClient({
    url: `file:${dbPath.replace(/\\/g, '/')}`
});

const db = drizzle(client, { schema });

let globalSettingsInitialization = null;
let globalSettingsInitialized = false;
let databaseReadyPromise = null;

function ensureDirectoryExists(directoryPath) {
    if (!fs.existsSync(directoryPath)) {
        fs.mkdirSync(directoryPath, { recursive: true });
    }
}

function getCurrentAppVersion() {
    return app?.getVersion?.() || process.env.npm_package_version || '1.0.0';
}

function parseJsonFile(filePath) {
    const fileContent = fs.readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '');
    return JSON.parse(fileContent);
}

const getCountValue = (result) => Number(result.rows?.[0]?.count ?? 0);

const sqliteObjectExists = async (type, name) => {
    const result = await client.execute({
        sql: 'SELECT 1 FROM sqlite_master WHERE type = ? AND name = ? LIMIT 1',
        args: [type, name]
    });

    return result.rows.length > 0;
};

const getTableRowCount = async (tableName) => {
    if (!(await sqliteObjectExists('table', tableName))) {
        return 0;
    }

    const result = await client.execute(`SELECT COUNT(*) AS count FROM "${tableName}"`);
    return getCountValue(result);
};

const getTableColumnNames = async (tableName) => {
    const result = await client.execute(`PRAGMA table_info(${tableName})`);
    return Array.isArray(result.rows)
        ? result.rows.map((row) => row.name)
        : [];
};

const ensureTableColumn = async (tableName, columnName, definition) => {
    const columnNames = await getTableColumnNames(tableName);

    if (columnNames.includes(columnName)) {
        return false;
    }

    await client.execute(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
    return true;
};

const loadMigrationJournal = () => {
    const journalPath = path.join(MIGRATIONS_FOLDER, 'meta', '_journal.json');

    if (!fs.existsSync(journalPath)) {
        return null;
    }

    return JSON.parse(fs.readFileSync(journalPath, 'utf8'));
};

const isLegacyMigrationAlreadyPresent = async (journalEntry) => {
    if (journalEntry.idx === 0) {
        return sqliteObjectExists('table', 'project');
    }

    if (journalEntry.tag.endsWith('institutions-search-fts')) {
        return sqliteObjectExists('table', 'institutions_search');
    }

    if (journalEntry.tag.endsWith('object-search-fts')) {
        return sqliteObjectExists('table', 'objects_search');
    }

    if (journalEntry.tag.endsWith('change-log-triggers')) {
        return sqliteObjectExists('trigger', 'trg_project_change_log_insert');
    }

    if (journalEntry.tag.endsWith('change-log-junction-triggers')) {
        return sqliteObjectExists('trigger', 'trg_objects_assets_change_log_insert');
    }

    if (journalEntry.tag.endsWith('object-updated-at-triggers')) {
        return sqliteObjectExists('trigger', 'trg_objects_assets_updated_at_ai');
    }

    return false;
};

const bootstrapMigrationJournal = async () => {
    const journal = loadMigrationJournal();
    if (!journal) {
        return;
    }

    const migrationTableExists = await sqliteObjectExists('table', DRIZZLE_MIGRATIONS_TABLE);
    if (migrationTableExists) {
        const existingRows = await client.execute(`SELECT COUNT(*) AS count FROM "${DRIZZLE_MIGRATIONS_TABLE}"`);
        if (getCountValue(existingRows) > 0) {
            return;
        }
    }

    if (!(await sqliteObjectExists('table', 'project'))) {
        return;
    }

    const migrations = readMigrationFiles({ migrationsFolder: MIGRATIONS_FOLDER });
    await client.execute(`
        CREATE TABLE IF NOT EXISTS "${DRIZZLE_MIGRATIONS_TABLE}" (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            hash text NOT NULL,
            created_at numeric
        )
    `);

    for (const [index, journalEntry] of journal.entries.entries()) {
        if (!(await isLegacyMigrationAlreadyPresent(journalEntry))) {
            continue;
        }

        const migrationMeta = migrations[index];
        await client.execute({
            sql: `INSERT INTO "${DRIZZLE_MIGRATIONS_TABLE}" ("hash", "created_at") VALUES (?, ?)`,
            args: [migrationMeta.hash, migrationMeta.folderMillis]
        });
    }
};

const ensureSearchIndexesPopulated = async () => {
    if (await sqliteObjectExists('table', 'institutions_search')) {
        const institutionsCount = await getTableRowCount('institutions');
        const institutionsSearchCount = await getTableRowCount('institutions_search');

        if (institutionsCount > 0 && institutionsSearchCount === 0) {
            await populateInstitutionsSearchIndex(client, db);
        }
    }

    if (await sqliteObjectExists('table', 'objects_search')) {
        const [objectsCount, objectsSearchCount] = await Promise.all([
            getTableRowCount('objects'),
            getTableRowCount('objects_search')
        ]);
        const [ontologyFieldsCount, ontologyFieldsSearchCount] = await Promise.all([
            getTableRowCount('objects_ontology_fields'),
            getTableRowCount('objects_ontology_fields_search')
        ]);
        const [researchFieldsCount, researchFieldsSearchCount] = await Promise.all([
            getTableRowCount('objects_research_fields'),
            getTableRowCount('objects_research_fields_search')
        ]);

        const needsObjectBackfill =
            (objectsCount > 0 && objectsSearchCount === 0)
            || (ontologyFieldsCount > 0 && ontologyFieldsSearchCount === 0)
            || (researchFieldsCount > 0 && researchFieldsSearchCount === 0);

        if (needsObjectBackfill) {
            await populateObjectSearchIndexes(client, db);
        }
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

const ensureGlobalSettingsSchema = async () => {
    try {
        if (await ensureTableColumn('global_settings', 'username', 'TEXT')) {
            console.log('Added username column to global_settings');
        }

        if (await ensureTableColumn('global_settings', 'interface_language', 'TEXT')) {
            console.log('Added interface_language column to global_settings');
        }
    } catch (error) {
        console.error('Error ensuring global settings schema:', error);
    }
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

/**
 * Runs all pending Drizzle migrations, back-fills search indexes if needed,
 * and initialises global settings. Safe to call multiple times — subsequent
 * calls reuse the same in-flight promise.
 *
 * @function
 * @memberOf db
 * @returns {Promise<void>}
 */
export const ensureDatabaseReady = async () => {
    if (databaseReadyPromise) {
        return databaseReadyPromise;
    }

    databaseReadyPromise = (async () => {
        await bootstrapMigrationJournal();
        await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
        await ensureSearchIndexesPopulated();
        await initializeGlobalSettings();
    })().catch((error) => {
        databaseReadyPromise = null;
        throw error;
    });

    return databaseReadyPromise;
};

void ensureDatabaseReady();

/**
 * Drizzle ORM database instance connected to the local SQLite file.
 * @memberOf db
 * @type {Object}
 */
/**
 * LibSQL client for executing raw SQL statements.
 * @memberOf db
 * @type {Object}
 */
/**
 * Absolute path to the SQLite database file on disk.
 * @memberOf db
 * @type {string}
 */
export { db, client, dbPath };