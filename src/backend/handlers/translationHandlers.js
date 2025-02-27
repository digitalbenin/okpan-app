import { dialog } from 'electron';
import fs from 'fs/promises';
import { graphql } from 'graphql';

/**
 * Handler for exporting translations to a JSON file
 * @param {Object} event - The IPC event
 * @param {string} filePath - Optional file path to save to
 * @param {Object} options - Additional options
 * @param {Object} options.schema - GraphQL schema
 * @param {Object} options.resolvers - GraphQL resolvers
 * @param {Object} options.db - Database connection
 * @returns {Promise<Object>} Result of the export operation
 */
export const handleExportTranslations = async (event, filePath, { schema, resolvers, db }) => {
    try {
        console.log('Exporting translations to:', filePath);

        // Query to get all interface translations
        const query = `{
      interface_translations {
        locale
        namespace
        key
        value
      }
      languages {
        code
        name
        is_default
      }
    }`;

        // Execute the query
        const result = await graphql({
            schema,
            source: query,
            rootValue: resolvers,
            contextValue: { db }
        });

        if (result.errors) {
            console.error('GraphQL errors during export:', result.errors);
            return { success: false, errors: result.errors };
        }

        // Format the data for export
        const exportData = {
            translations: result.data.interface_translations,
            languages: result.data.languages,
            exportDate: new Date().toISOString()
        };

        // If no filePath is provided, show a save dialog
        if (!filePath) {
            const { canceled, filePath: selectedPath } = await dialog.showSaveDialog({
                title: 'Export Translations',
                defaultPath: 'translations_export.json',
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

        return { success: true, message: 'Translations exported successfully', filePath };
    } catch (error) {
        console.error('Error exporting translations:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Handler for importing translations from a JSON file
 * @param {Object} event - The IPC event
 * @param {string} filePath - Optional file path to import from
 * @param {Object} options - Additional options
 * @param {Object} options.schema - GraphQL schema
 * @param {Object} options.resolvers - GraphQL resolvers
 * @param {Object} options.db - Database connection
 * @returns {Promise<Object>} Result of the import operation
 */
export const handleImportTranslations = async (event, filePath, { schema, resolvers, db }) => {
    try {
        console.log('Importing translations from:', filePath);

        // If no filePath is provided, show an open dialog
        if (!filePath) {
            const { canceled, filePaths } = await dialog.showOpenDialog({
                title: 'Import Translations',
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

        // Import languages first if they don't exist
        if (importData.languages && Array.isArray(importData.languages)) {
            for (const language of importData.languages) {
                // Check if language exists
                const checkQuery = `{
          languages(where: { code: { eq: "${language.code}" } }) {
            id
          }
        }`;

                const checkResult = await graphql({
                    schema,
                    source: checkQuery,
                    rootValue: resolvers,
                    contextValue: { db }
                });

                if (checkResult.data.languages.length === 0) {
                    // Language doesn't exist, create it
                    const createQuery = `mutation {
            insertIntoLanguages(values: [{
              code: "${language.code}",
              name: "${language.name}",
              is_default: ${language.is_default || 0}
            }]) {
              id
            }
          }`;

                    await graphql({
                        schema,
                        source: createQuery,
                        rootValue: resolvers,
                        contextValue: { db }
                    });

                    console.log(`Created language: ${language.code} (${language.name})`);
                }
            }
        }

        // Import translations
        let importedCount = 0;
        let updatedCount = 0;
        let errorCount = 0;

        for (const translation of importData.translations) {
            try {
                // Check if translation exists using namespace, key, and locale as unique identifiers
                const checkQuery = `{
          interface_translations(where: { 
            namespace: { eq: "${translation.namespace}" }, 
            key: { eq: "${translation.key}" },
            locale: { eq: "${translation.locale}" }
          }) {
            id
          }
        }`;

                const checkResult = await graphql({
                    schema,
                    source: checkQuery,
                    rootValue: resolvers,
                    contextValue: { db }
                });

                if (checkResult.data.interface_translations.length > 0) {
                    // Translation exists, update it
                    const updateQuery = `mutation {
            updateInterface_translations(
              set: { value: "${translation.value.replace(/"/g, '\\"')}" }
              where: { 
                namespace: { eq: "${translation.namespace}" }, 
                key: { eq: "${translation.key}" },
                locale: { eq: "${translation.locale}" }
              }
            ) {
              id
            }
          }`;

                    await graphql({
                        schema,
                        source: updateQuery,
                        rootValue: resolvers,
                        contextValue: { db }
                    });

                    updatedCount++;
                } else {
                    // Translation doesn't exist, create it
                    const createQuery = `mutation {
            insertIntoInterface_translations(values: [{
              locale: "${translation.locale}",
              namespace: "${translation.namespace}",
              key: "${translation.key}",
              value: "${translation.value.replace(/"/g, '\\"')}"
            }]) {
              id
            }
          }`;

                    await graphql({
                        schema,
                        source: createQuery,
                        rootValue: resolvers,
                        contextValue: { db }
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
            message: 'Translations imported successfully',
            stats: {
                imported: importedCount,
                updated: updatedCount,
                errors: errorCount,
                total: importData.translations.length
            }
        };
    } catch (error) {
        console.error('Error importing translations:', error);
        return { success: false, error: error.message };
    }
}; 