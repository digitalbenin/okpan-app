/**
 * IPC handlers for interface translation import and export.
 * @namespace backend.handlers.translationHandlers
 * @memberof backend.handlers
 */
import { dialog } from 'electron';
import fs from 'fs/promises';
import { eq, and } from 'drizzle-orm';
// Import the database schema tables
import { interface_languages, interface_translations } from '../../db/schema.js';

/**
 * Export interface translations to a JSON file.
 * @function handleExportTranslations
 * @memberof backend.handlers.translationHandlers
 * @param {Electron.IpcMainInvokeEvent} event - IPC event.
 * @param {string} filePath - Path to save to; triggers a save dialog if omitted.
 * @param {Object} options - Handler options.
 * @param {Object} options.db - Database connection.
 * @returns {Promise.<{success: boolean, message: (string|undefined), filePath: (string|undefined), error: (string|undefined)}>}
 */
export const handleExportTranslations = async (event, filePath, { db }) => {
    try {
        console.log('Exporting translations to:', filePath);

        // Query to get all interface translations and languages
        const translations = await db.query.interface_translations.findMany();
        const languages = await db.query.interface_languages.findMany();

        // Format the data for export - exclude IDs and timestamps
        const exportData = {
            translations: translations.map(({ id, created_at, updated_at, ...rest }) => rest),
            languages: languages.map(({ id, created_at, updated_at, ...rest }) => rest),
            exportDate: new Date().toISOString()
        };

        // If no filePath is provided, show a save dialog
        if (!filePath) {
            const { canceled, filePath: selectedPath } = await dialog.showSaveDialog({
                title: 'Export Interface Translations',
                defaultPath: 'interface_translations_export.json',
                filters: [
                    { name: 'JSON Files', extensions: ['json'] }
                ]
            });

            if (canceled) {
                return { success: false, message: 'Export canceled by user' };
            }

            filePath = selectedPath;
        }

        // Write the data to the file
        await fs.writeFile(filePath, JSON.stringify(exportData, null, 2));

        return { success: true, message: 'Interface translations exported successfully', filePath };
    } catch (error) {
        console.error('Error exporting interface translations:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Import interface translations from a JSON file.
 * @function handleImportTranslations
 * @memberof backend.handlers.translationHandlers
 * @param {Electron.IpcMainInvokeEvent} event - IPC event.
 * @param {string} filePath - Path to read from; triggers an open dialog if omitted.
 * @param {Object} options - Handler options.
 * @param {Object} options.db - Database connection.
 * @returns {Promise.<{success: boolean, message: (string|undefined), stats: ({imported: number, updated: number, errors: number, total: number}|undefined), error: (string|undefined)}>}
 */
export const handleImportTranslations = async (event, filePath, { db }) => {
    try {
        console.log('Importing translations from:', filePath);

        // If no filePath is provided, show an open dialog
        if (!filePath) {
            const { canceled, filePaths } = await dialog.showOpenDialog({
                title: 'Import Interface Translations',
                filters: [
                    { name: 'JSON Files', extensions: ['json'] }
                ],
                properties: ['openFile']
            });

            if (canceled || filePaths.length === 0) {
                return { success: false, message: 'Import canceled by user' };
            }

            filePath = filePaths[0];
        }

        // Read the file
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const importData = JSON.parse(fileContent);

        // Validate the import data
        if (!importData.translations || !Array.isArray(importData.translations)) {
            return { success: false, error: 'Invalid import file format: missing translations array' };
        }

        // Import interface languages first if they don't exist
        if (importData.languages && Array.isArray(importData.languages)) {
            for (const language of importData.languages) {
                try {
                    // Validate language object
                    if (!language.code || !language.name) {
                        console.warn(`Skipping invalid language entry:`, language);
                        continue;
                    }

                    // Check if language exists
                    const existingLanguage = await db.query.interface_languages.findFirst({
                        where: eq(interface_languages.code, language.code)
                    });

                    if (!existingLanguage) {
                        // Language doesn't exist, create it
                        await db.insert(interface_languages).values({
                            code: language.code.toLowerCase(),
                            name: language.name.toLowerCase()
                        });

                        console.log(`Created interface language: ${language.code} (${language.name})`);
                    } else {
                        // Optionally update existing language name if different
                        if (existingLanguage.name !== language.name.toLowerCase()) {
                            await db.update(interface_languages)
                                .set({ name: language.name.toLowerCase() })
                                .where(eq(interface_languages.code, language.code));
                            console.log(`Updated interface language: ${language.code} (${language.name})`);
                        }
                    }
                } catch (err) {
                    console.error(`Error importing language ${language.code}:`, err);
                }
            }
        } else {
            console.warn('No languages found in import data');
        }

        // Import translations
        let importedCount = 0;
        let updatedCount = 0;
        let errorCount = 0;

        for (const translation of importData.translations) {
            try {
                // Check if translation exists using namespace, key, and locale as unique identifiers
                const existingTranslation = await db.query.interface_translations.findFirst({
                    where: and(
                        eq(interface_translations.namespace, translation.namespace),
                        eq(interface_translations.key, translation.key),
                        eq(interface_translations.locale, translation.locale)
                    )
                });

                if (existingTranslation) {
                    // Translation exists, update it
                    await db.update(interface_translations)
                        .set({ value: translation.value })
                        .where(and(
                            eq(interface_translations.namespace, translation.namespace),
                            eq(interface_translations.key, translation.key),
                            eq(interface_translations.locale, translation.locale)
                        ));

                    updatedCount++;
                } else {
                    // Translation doesn't exist, create it
                    await db.insert(interface_translations).values({
                        locale: translation.locale,
                        namespace: translation.namespace,
                        key: translation.key,
                        value: translation.value
                    });

                    importedCount++;
                }
            } catch (err) {
                console.error(`Error importing translation ${translation.namespace}.${translation.key} (${translation.locale}):`, err);
                errorCount++;
            }
        }

        return {
            success: true,
            message: 'Interface translations imported successfully',
            stats: {
                imported: importedCount,
                updated: updatedCount,
                errors: errorCount,
                total: importData.translations.length
            }
        };
    } catch (error) {
        console.error('Error importing interface translations:', error);
        return { success: false, error: error.message };
    }
}; 