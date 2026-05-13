import { executeQuery } from "$lib/stores/GraphqlUtils.js";
import { getValidationStore } from "./ValidationStore.svelte.js";
import { getLogStore } from "$lib/stores/LogStore.svelte.js";
import { browser } from "$app/environment";

// Create a singleton instance
let storeInstance = null;
const DEFAULT_INTERFACE_LANGUAGE = { code: 'en', name: 'English' };

// Main store function that creates and returns the store
export function getTranslationStore() {
    // If we already have an instance, return it
    if (storeInstance) {
        return storeInstance;
    }

    // Get validation store
    // const { getSchema, validate } = getValidationStore();

    // Get log store for error logging
    const { error: logError } = getLogStore();

    // Get the base schema for validation
    // const baseSchema = getSchema('interface_translations', 'insert');

    // State variables defined inside the function
    const translationState = $state({
        translations: {},
        languages: [],
        currentLocale: 'en',
        isLoading: false,
        error: null,
        isInitialized: false,
        defaultLocale: 'en' // Added to track default locale
    });

    const getPersistedInterfaceLanguage = async () => {
        if (!browser || typeof window === 'undefined' || typeof window.api?.getGlobalSettings !== 'function') {
            return null;
        }

        try {
            const settings = await window.api.getGlobalSettings();
            const locale = typeof settings?.interfaceLanguage === 'string'
                ? settings.interfaceLanguage.trim()
                : '';
            return locale || null;
        } catch (error) {
            console.warn('Failed to read persisted interface language:', error);
            return null;
        }
    };

    // Fetch all supported languages
    const fetchLanguages = async () => {
        // console.log("Fetching interface languages...");
        const result = await executeQuery('interface_languages', 'list');
        // console.log("Received interface languages:", result);

        // Check if we have a valid result with more detailed logging
        if (!result) {
            const errorMsg = "No response received from server for languages";
            translationState.languages = [];
            translationState.error = errorMsg;
            await logError("fetch_languages", errorMsg);
            return;
        }

        if (!result.result) {
            const errorMsg = `Response missing 'result' field: ${JSON.stringify(result)}`;
            translationState.languages = [];
            translationState.error = errorMsg;
            await logError("fetch_languages", errorMsg);
            return;
        }

        // Store languages with an English fallback so the app remains usable even
        // before the interface translations tables are populated.
        const fetchedLanguages = Array.isArray(result.result) ? result.result : [];
        translationState.languages = fetchedLanguages.length > 0
            ? fetchedLanguages
            : [DEFAULT_INTERFACE_LANGUAGE];
        // console.log(`Found ${translationState.languages.length} interface languages`);

        // Set default locale if available
        if (translationState.languages.length > 0) {
            const persistedLocale = await getPersistedInterfaceLanguage();
            const persistedLanguage = persistedLocale
                ? translationState.languages.find(lang => lang.code === persistedLocale)
                : null;
            const enLang = translationState.languages.find(lang => lang.code === 'en');
            translationState.currentLocale = persistedLanguage?.code || enLang?.code || translationState.languages[0].code;
        }
    };

    // Fetch all translations and organize them by namespace and key
    const fetchTranslations = async () => {
        // console.log("Fetching interface translations...");
        const result = await executeQuery('interface_translations', 'list');
        // console.log("Received interface translations:", result);

        // Log the structure for debugging
        // console.log("Translation result keys:", result ? Object.keys(result) : "null result");
        if (result && result.result) {
            // console.log("Translation result.result type:", Array.isArray(result.result) ? "Array" : typeof result.result);
            // console.log("Translation result.result length:", Array.isArray(result.result) ? result.result.length : "not an array");
        }

        // Check if we have a valid result with more detailed logging
        if (!result) {
            const errorMsg = "No response received from server for translations";
            translationState.translations = {};
            translationState.error = errorMsg;
            await logError("fetch_translations", errorMsg);
            return;
        }

        if (!result.result) {
            const errorMsg = `Response missing 'result' field: ${JSON.stringify(result)}`;
            translationState.translations = {};
            translationState.error = errorMsg;
            await logError("fetch_translations", errorMsg);
            return;
        }

        // Ensure result.result is treated as an array
        const translations = Array.isArray(result.result) ? result.result : [];
        // console.log(`Found ${translations.length} interface translations`);

        // Organize translations by namespace and key
        const translationData = {};

        for (const item of translations) {
            // Skip invalid items
            if (!item || !item.namespace || !item.key || !item.locale) {
                console.warn("Skipping invalid translation item:", item);
                continue;
            }

            // Create namespace if it doesn't exist
            if (!translationData[item.namespace]) {
                translationData[item.namespace] = {};
            }

            // Create key if it doesn't exist
            if (!translationData[item.namespace][item.key]) {
                translationData[item.namespace][item.key] = {};
            }

            // Add translation for this locale
            translationData[item.namespace][item.key][item.locale] = { id: item.id, value: item.value };
        }

        translationState.translations = translationData;
        // console.log(`Organized translations into ${Object.keys(translationData).length} namespaces`);
    };

    // Initialize the store
    const initialize = async () => {
        if (translationState.isInitialized) return;

        translationState.isLoading = true;
        translationState.error = null;

        // Fetch languages first
        await fetchLanguages();

        // Then fetch translations
        await fetchTranslations();

        translationState.isInitialized = true;
        translationState.isLoading = false;
    };

    // Get a translation by namespace, key and locale
    const getTranslation = (namespace, key, locale = null, fallback = null) => {
        const targetLocale = locale || translationState.currentLocale;

        // Check if namespace exists
        if (!translationState.translations[namespace]) {
            //console.warn(`Namespace "${namespace}" not found`);
            return fallback || key;
        }

        // Check if key exists in namespace
        if (!translationState.translations[namespace][key]) {
            //console.warn(`Key "${key}" not found in namespace "${namespace}"`);
            return fallback || key;
        }

        // Check if translation exists for locale
        if (!translationState.translations[namespace][key][targetLocale]) {
            // Try English as first fallback
            if (translationState.translations[namespace][key]['en']) {
                return translationState.translations[namespace][key]['en'].value;
            }

            // Fallback to any available translation
            const availableLocales = Object.keys(translationState.translations[namespace][key]);
            if (availableLocales.length > 0) {
                return translationState.translations[namespace][key][availableLocales[0]].value;
            }

            console.warn(`No translation found for "${namespace}.${key}" in locale "${targetLocale}"`);
            return fallback || key;
        }

        return translationState.translations[namespace][key][targetLocale].value;
    };

    // Set the current locale
    const setLocale = async (locale) => {
        if (translationState.languages.some(lang => lang.code === locale)) {
            translationState.currentLocale = locale;

            if (browser && typeof window !== 'undefined' && typeof window.api?.updateGlobalInterfaceLanguage === 'function') {
                try {
                    await window.api.updateGlobalInterfaceLanguage(locale);
                } catch (error) {
                    console.warn('Failed to persist interface language:', error);
                    await logError('update_interface_language', error.message);
                }
            }

            return true;
        } else {
            console.warn(`Locale "${locale}" is not supported in interface languages`);
            return false;
        }
    };

    // Function to get available namespaces
    const getAvailableNamespaces = () => {
        return Object.keys(translationState.translations);
    };

    // Get all translations for a specific namespace
    const getNamespaceTranslations = (namespace, locale = null) => {
        const targetLocale = locale || translationState.currentLocale;

        if (!translationState.translations[namespace]) {
            return {};
        }

        const result = {};

        for (const key in translationState.translations[namespace]) {
            result[key] = getTranslation(namespace, key, targetLocale);
        }

        return result;
    };

    // Get all translations formatted for i18n library
    const getFormattedTranslations = () => {
        const result = {};

        for (const namespace in translationState.translations) {
            result[namespace] = getNamespaceTranslations(namespace);
        }

        return result;
    };

    // Refresh translations from backend
    const refreshTranslations = async () => {
        translationState.isLoading = true;

        // Fetch translations and update the state
        await fetchTranslations();

        translationState.isLoading = false;
        return Object.keys(translationState.translations).length;
    };

    // Export translations to a file
    const exportTranslations = async (filePath = null) => {
        const data = {
            namespaces: getAvailableNamespaces(),
            languages: translationState.languages.map(l => l.code),
            translations: translationState.translations
        };

        if (filePath) {
            // TODO: Implement file export when ready
            return { success: true, data };
        }

        return data;
    };

    // Import translations from a file
    const importTranslations = async () => {
        translationState.isLoading = true;
        translationState.error = null;
        let languagesAddedCount = 0;
        let translationsAddedCount = 0;

        try {
            // 1. Show Open Dialog via preload script (using correct function name)
            const result = await window.api.openFileDialog({
                title: 'Select Translations JSON File',
                properties: ['openFile'],
                filters: [{ name: 'JSON Files', extensions: ['json'] }]
            });

            // Check if the user cancelled or an error occurred
            if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
                translationState.isLoading = false;
                return { success: false, message: "No file selected or dialog cancelled", stats: { languages: 0, translations: 0 } };
            }

            const filePath = result.filePaths[0];

            // 2. Read File Content via preload script (using correct function name)
            const fileContent = await window.api.readFile(filePath);
            if (fileContent === null || fileContent === undefined) { // Check for null/undefined explicitly
                throw new Error("Failed to read file or file is empty.");
            }

            // 3. Parse JSON
            let jsonData;
            try {
                jsonData = JSON.parse(fileContent);
            } catch (parseError) {
                console.error("JSON Parse Error:", parseError, "\nContent:", fileContent); // Log content on error
                throw new Error(`Failed to parse JSON: ${parseError.message}`);
            }

            // --- Step 4: Process Languages FIRST ---
            const languagesToImport = jsonData?.languages;
            if (Array.isArray(languagesToImport) && languagesToImport.length > 0) {
                console.log(`Found ${languagesToImport.length} languages to import.`);
                for (const lang of languagesToImport) {
                    if (lang && lang.code && lang.name) {
                        try {
                            // Use executeQuery to add each language
                            // Assuming 'create' is the operation name in interface_languages.js
                            await executeQuery('interface_languages', 'create', {
                                code: lang.code,
                                name: lang.name
                            });
                            languagesAddedCount++;
                        } catch (langError) {
                            // Ignore errors if language likely already exists (e.g., unique constraint)
                            // More specific error checking could be added if needed
                            console.warn(`Could not add language ${lang.code} (may already exist):`, langError.message);
                        }
                    }
                }
                console.log(`Finished processing ${languagesToImport.length} languages. Added/Confirmed: ${languagesAddedCount}`);
                // Optional: Short delay or refresh languages store if needed here
                // await fetchLanguages(); // Refresh local language list if necessary
            } else {
                console.log("No 'languages' array found or empty in JSON file.");
            }

            // --- Step 5: Process Translations --- 
            let translationsToImport = jsonData?.translations; // Use let instead of const

            // Basic validation
            if (!Array.isArray(translationsToImport)) {
                // Allow import even if only languages were present
                console.log("No 'translations' array found or not an array in JSON file.");
                translationsToImport = []; // Ensure it's an empty array if missing/invalid
            }

            // Call the import mutation only if there are translations
            if (translationsToImport.length > 0) {
                console.log(`Attempting to import ${translationsToImport.length} translations.`);
                await executeQuery('interface_translations', 'import', {
                    translations: translationsToImport // Pass the extracted array
                });
                translationsAddedCount = translationsToImport.length; // Assume all were processed by bulk import
            } else {
                console.log("No translations to import.");
            }

            // 6. Refresh translations from backend after successful import
            await refreshTranslations();
            // Optionally refresh languages too if they might have changed
            await fetchLanguages();

            translationState.isLoading = false;
            // Return success stats
            return {
                success: true,
                message: `Import successful. Languages processed: ${languagesAddedCount}, Translations processed: ${translationsAddedCount}`,
                stats: { languages: languagesAddedCount, translations: translationsAddedCount }
            };

        } catch (err) {
            console.error("Import failed:", err);
            translationState.error = err.message;
            await logError("import_translations", err.message); // Log the error
            translationState.isLoading = false;
            // Return error details
            return { success: false, message: err.message, stats: { languages: languagesAddedCount, translations: translationsAddedCount } };
        }
    };

    // Create a new translation or update if exists
    const createTranslation = async (namespace, key, values) => {
        // Validate the input
        // const validationResult = validate(baseSchema, { namespace, key, values });
        // if (!validationResult.success) {
        //     await logError("create_translation_validation", validationResult.errors.join(', '));
        //     return { success: false, error: validationResult.errors.join(', ') };
        // }

        if (!namespace || !key || !values) {
            throw new Error("Missing required parameters");
        }
        /*
        // Validate namespace and key
        const validationResult = await validate(
            { namespace, key },
            {
                namespace: baseSchema.shape.namespace,
                key: baseSchema.shape.key
            }
        );

        if (!validationResult.success) {
            await logError("create_translation_validation", validationResult.errors[0]);
            throw new Error(validationResult.errors[0]);
        }
        */
        translationState.isLoading = true;

        const results = [];
        let allSuccessful = true;
        let errors = [];

        for (const locale in values) {
            if (!values[locale]) continue;

            // Commenting out schema validation for now
            // const entryValidation = await validate(...);
            // if (!entryValidation.success) { ... }

            const singleResult = await executeQuery('interface_translations', 'create', {
                namespace,
                key,
                locale,
                value: values[locale]
            });

            results.push(singleResult);
            console.log(`Single result from create for ${locale}:`, JSON.stringify(singleResult, null, 2));

            let operationFailed = false;
            let errorMessage = `Failed to create translation for ${locale}`;

            if (!singleResult) {
                operationFailed = true;
                errorMessage = `No result for ${locale} during create`;
            } else if (singleResult.errors && singleResult.errors.length > 0) {
                operationFailed = true;
                errorMessage = singleResult.errors.map(e => e.message).join(', ') || `GraphQL error for ${locale} during create`;
            } else {
                const expectedDataKey = 'insertIntoInterface_translations'; // Based on typical mutation naming
                const returnedData = singleResult[expectedDataKey];
                if (!returnedData || !Array.isArray(returnedData) || returnedData.length === 0) {
                    operationFailed = true;
                    errorMessage = `No data or unexpected data structure in create response for ${locale}. Expected key: ${expectedDataKey}`;
                }
            }

            if (operationFailed) {
                allSuccessful = false;
                errors.push(errorMessage);
            }
        }

        await fetchTranslations();
        translationState.isLoading = false;

        if (allSuccessful) {
            return { success: true, data: results };
        } else {
            return { success: false, error: errors.join('; '), data: results };
        }
    };

    // Update a translation (multi-locale update)
    const updateTranslation = async (namespace, key, values) => {
        // Validate the input
        // const validationResult = validate(baseSchema, { namespace, key, values });
        // if (!validationResult.success) {
        //     await logError("update_translation_validation", validationResult.errors.join(', '));
        //     return { success: false, error: validationResult.errors.join(', ') };
        // }

        if (!namespace || !key || !values) {
            throw new Error("Missing required parameters");
        }

        // Ensure we have existing translations for this namespace and key
        if (!translationState.translations[namespace] ||
            !translationState.translations[namespace][key]) {
            throw new Error(`Translation ${namespace}.${key} not found`);
        }

        // Validate namespace and key
        // const validationResult = await validate(
        //     { namespace, key },
        //     {
        //         namespace: baseSchema.shape.namespace,
        //         key: baseSchema.shape.key
        //     }
        // );
        //
        // if (!validationResult.success) {
        //     await logError("update_translation_validation", validationResult.errors[0]);
        //     throw new Error(validationResult.errors[0]);
        // }

        translationState.isLoading = true;

        const results = [];
        let allSuccessful = true;
        let errors = [];

        for (const locale in values) {
            if (!values[locale] && values[locale] !== '') continue; // Skip if value is empty string, unless explicitly allowed

            // Commenting out schema validation for now as per previous steps
            // const entryValidation = await validate(...);
            // if (!entryValidation.success) { ... }

            const existingTranslation = translationState.translations[namespace]?.[key]?.[locale];

            let singleResult;
            let operationType = existingTranslation !== undefined ? 'update' : 'create';

            if (operationType === 'update') {
                singleResult = await executeQuery('interface_translations', 'update', {
                    id: existingTranslation.id,
                    value: values[locale]
                });
            } else { // operationType === 'create'
                singleResult = await executeQuery('interface_translations', 'create', {
                    namespace,
                    key,
                    locale,
                    value: values[locale]
                });
            }
            results.push(singleResult);
            console.log(`Single result from ${operationType} for ${locale}:`, JSON.stringify(singleResult, null, 2));

            let operationFailed = false;
            let errorMessage = `Failed to ${operationType} translation for ${locale}`;

            if (!singleResult) {
                operationFailed = true;
                errorMessage = `No result for ${locale} during ${operationType}`;
            } else if (singleResult.errors && singleResult.errors.length > 0) {
                operationFailed = true;
                errorMessage = singleResult.errors.map(e => e.message).join(', ') || `GraphQL error for ${locale} during ${operationType}`;
            } else {
                // Operation-specific data check
                const expectedDataKey = operationType === 'update' ? 'updateInterface_translations' : 'insertIntoInterface_translations';
                const returnedData = singleResult[expectedDataKey];

                if (!returnedData || !Array.isArray(returnedData) || returnedData.length === 0) {
                    operationFailed = true;
                    errorMessage = `No data or unexpected data structure in ${operationType} response for ${locale}. Expected key: ${expectedDataKey}`;
                }
                // Optional: further checks on returnedData[0] if needed, e.g., presence of id
            }

            if (operationFailed) {
                allSuccessful = false;
                errors.push(errorMessage);
            }
        }

        await fetchTranslations();
        translationState.isLoading = false;

        if (allSuccessful) {
            return { success: true, data: results };
        } else {
            return { success: false, error: errors.join('; '), data: results };
        }
    };

    // Delete a translation (all locales for a given key in a namespace)
    const deleteTranslation = async (namespace, key) => {
        if (!namespace || !key) {
            return { success: false, error: "Missing required parameters for deleteTranslation" };
        }

        translationState.isLoading = true;

        const keyEntry = translationState.translations[namespace]?.[key];

        if (!keyEntry) {
            translationState.isLoading = false;
            // Key not found in local state, could be already deleted or an issue.
            // Consider it a non-failure from the perspective of this operation if the goal is for it to not exist.
            // However, log a warning as this might indicate a desync if user could click delete.
            console.warn(`deleteTranslation: Key "${namespace}.${key}" not found in local state. Assuming already deleted or not present.`);
            await fetchTranslations(); // Refresh to be sure
            return { success: true, message: "Key not found locally, assumed deleted." };
        }

        const idsToDelete = Object.values(keyEntry).map(localeData => localeData.id).filter(id => id);

        if (idsToDelete.length === 0) {
            translationState.isLoading = false;
            console.warn(`deleteTranslation: No IDs found for "${namespace}.${key}" to delete. Removing local entry if it exists.`);
            // If the keyEntry exists but has no valid IDs, remove it locally and refresh.
            delete translationState.translations[namespace][key];
            if (Object.keys(translationState.translations[namespace]).length === 0) {
                delete translationState.translations[namespace];
            }
            await fetchTranslations();
            return { success: true, message: "No valid translation IDs found under key, local entry removed." };
        }

        const individualResults = [];
        let allDeletesSuccessful = true;
        let errorMessages = [];

        for (const id of idsToDelete) {
            const singleResult = await executeQuery('interface_translations', 'delete', { id });
            individualResults.push({ id, result: singleResult });
            console.log(`Single result from delete for ID ${id} (${namespace}.${key}):`, JSON.stringify(singleResult, null, 2));

            let operationFailed = false;
            let specificErrorMessage = `Failed to delete translation with ID ${id}`;

            if (!singleResult) {
                operationFailed = true;
                specificErrorMessage = `No result for delete operation on ID ${id}`;
            } else if (singleResult.errors && singleResult.errors.length > 0) {
                operationFailed = true;
                specificErrorMessage = singleResult.errors.map(e => e.message).join(', ') || `GraphQL error during delete of ID ${id}`;
            } else {
                const expectedDataKey = 'deleteFromInterface_translations';
                const returnedData = singleResult[expectedDataKey];
                // A successful delete often returns the ID of the deleted item or an array of them.
                // Check if returnedData is an array and contains an object with the matching id, or if it's an object with the id.
                let idMatch = false;
                if (Array.isArray(returnedData)) {
                    idMatch = returnedData.some(item => item && item.id === id);
                } else if (returnedData && typeof returnedData === 'object' && returnedData.id === id) {
                    idMatch = true;
                }

                if (!idMatch) {
                    // If no errors, but ID not in expected structure, it could still be a success.
                    // This is a common scenario if the mutation simply returns null or an empty object on success for delete.
                    // We rely on the *absence* of .errors if .deleteFromInterface_translations is not structured as expected.
                    if (!singleResult.errors) { // No explicit GQL errors
                        console.warn(`Delete for ID ${id} (${namespace}.${key}) had no errors but ID was not found in '${expectedDataKey}'. Assuming success based on lack of errors. Log: ${JSON.stringify(singleResult)}`);
                        // Considered success for this ID based on lack of errors
                    } else {
                        operationFailed = true;
                        specificErrorMessage = `Unexpected data structure or missing ID in delete response for ID ${id}. Expected key: ${expectedDataKey}`;
                    }
                }
            }

            if (operationFailed) {
                allDeletesSuccessful = false;
                errorMessages.push(specificErrorMessage);
            }
        }

        // Local state update: remove the entire key after attempting all deletions.
        // This happens regardless of partial success to reflect the intent to delete the key.
        if (translationState.translations[namespace]?.[key]) {
            delete translationState.translations[namespace][key];
            if (Object.keys(translationState.translations[namespace]).length === 0) {
                delete translationState.translations[namespace];
            }
        }

        await fetchTranslations(); // Final refresh to ensure sync with backend
        translationState.isLoading = false;

        if (allDeletesSuccessful) {
            return { success: true, message: `Successfully deleted all translations for ${namespace}.${key}` };
        } else {
            return { success: false, error: `One or more translations for ${namespace}.${key} failed to delete: ${errorMessages.join('; ')}` };
        }
    };

    // Delete a namespace (all keys and locales)
    const deleteNamespace = async (namespace) => {
        if (!namespace) {
            return { success: false, error: "Missing namespace parameter for deleteNamespace" };
        }

        const namespaceEntry = translationState.translations[namespace];
        if (!namespaceEntry) {
            console.warn(`deleteNamespace: Namespace "${namespace}" not found in local state. Assuming already deleted.`);
            // No backend calls needed if not found locally, but refresh to ensure state is accurate.
            await fetchTranslations();
            return { success: true, message: "Namespace not found locally, assumed already deleted or not present." };
        }

        translationState.isLoading = true;

        const keysInNamespace = Object.keys(namespaceEntry);
        let allKeysSuccessfullyDeleted = true;
        const keyDeletionErrorMessages = [];

        if (keysInNamespace.length > 0) {
            for (const key of keysInNamespace) {
                // Rely on the already refactored deleteTranslation which handles ID-based GQL deletion and internal refresh
                const keyDeleteResult = await deleteTranslation(namespace, key);
                if (!keyDeleteResult.success) {
                    allKeysSuccessfullyDeleted = false;
                    keyDeletionErrorMessages.push(keyDeleteResult.error || `Failed to delete key '${key}' in namespace '${namespace}'.`);
                }
            }
        } else {
            console.log(`Namespace "${namespace}" contained no keys. Proceeding to remove local namespace entry.`);
        }

        // Remove the namespace from local state after attempting to delete all its keys
        if (translationState.translations[namespace]) {
            delete translationState.translations[namespace];
        }

        // Although individual deleteTranslation calls refresh, a final one here ensures the overall state
        // (especially the list of namespaces) is up-to-date after all operations.
        await fetchTranslations();
        translationState.isLoading = false;

        if (allKeysSuccessfullyDeleted) {
            return { success: true, message: `Namespace '${namespace}' and all its translations processed for deletion.` };
        } else {
            return {
                success: false,
                error: `Failed to delete one or more keys in namespace '${namespace}': ${keyDeletionErrorMessages.join('; ')}`
            };
        }
    };

    // Create a new namespace if it doesn't exist
    const createNamespace = (namespace) => {
        if (!namespace) {
            throw new Error("Missing namespace parameter");
        }
        /*
        // Validate namespace
        const namespaceSchema = baseSchema.shape.namespace;
        const validationResult = namespaceSchema.safeParse(namespace);

        if (!validationResult.success) {
            const error = validationResult.error.errors[0].message;
            throw new Error(error);
        }
        */
        // No need to create in backend as namespaces are created implicitly with translations
        // Just create empty namespace in local state if doesn't exist
        if (!translationState.translations[namespace]) {
            translationState.translations = {
                ...translationState.translations,
                [namespace]: {}
            };
        }

        return { namespace, success: true };
    };

    // Simple translator function (t)
    const t = (key, params = {}) => {
        let namespace = 'common';
        let translationKey = key;

        // Check if key includes namespace (format: namespace:key or namespace.key)
        if (key.includes(':')) {
            const parts = key.split(':');
            namespace = parts[0];
            translationKey = parts.slice(1).join(':');
        } else if (key.includes('.')) {
            const parts = key.split('.');
            namespace = parts[0];
            translationKey = parts.slice(1).join('.');
        }

        // Extract fallback from params if provided
        const { fallback, ...otherParams } = params || {};

        // Get the translation with fallback value
        let text = getTranslation(namespace, translationKey, null, fallback);

        // Plural support: "singular form | plural form" — pick based on count param
        if ('count' in otherParams && text.includes(' | ')) {
            const [singular, plural] = text.split(' | ');
            text = Number(otherParams.count) === 1 ? singular : plural;
        }

        // Replace parameters in the translation (excluding fallback)
        if (otherParams && Object.keys(otherParams).length > 0) {
            Object.keys(otherParams).forEach(param => {
                text = text.replace(new RegExp(`{{${param}}}`, 'g'), otherParams[param]);
            });
        }

        return text;
    };

    // Start initialization if not already initialized
    if (!translationState.isInitialized && !translationState.isLoading) {
        // Start initialization asynchronously
        setTimeout(() => {
            initialize();
        }, 0);
    }

    // Create the store instance
    storeInstance = {
        translationState,
        initialize,
        fetchLanguages,
        fetchTranslations,
        refreshTranslations,
        getTranslation,
        setLocale,
        getNamespaceTranslations,
        getAvailableNamespaces,
        getFormattedTranslations,
        createTranslation,
        updateTranslation,
        deleteTranslation,
        createNamespace,
        deleteNamespace,
        exportTranslations,
        importTranslations,
        t
    };

    return storeInstance;
}

