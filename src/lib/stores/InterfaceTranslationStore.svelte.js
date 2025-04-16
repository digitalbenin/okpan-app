import { executeQuery } from "$lib/stores/GraphqlUtils.js";
import { getValidationStore } from "./ValidationStore.svelte.js";
import { getLogStore } from "$lib/stores/LogStore.svelte.js";

// Create a singleton instance
let storeInstance = null;

// Main store function that creates and returns the store
export function getTranslationStore() {
    // If we already have an instance, return it
    if (storeInstance) {
        return storeInstance;
    }

    // Get validation store
    const { getSchema, validate } = getValidationStore();

    // Get log store for error logging
    const { error: logError } = getLogStore();

    // Get the base schema for validation
    const baseSchema = getSchema('interface_translations', 'insert');

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

        // Store languages with fallback to empty array
        translationState.languages = Array.isArray(result.result) ? result.result : [];
        // console.log(`Found ${translationState.languages.length} interface languages`);

        // Set default locale if available
        if (translationState.languages.length > 0) {
            const enLang = translationState.languages.find(lang => lang.code === 'en');
            translationState.currentLocale = enLang ? enLang.code : translationState.languages[0].code;
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
            translationData[item.namespace][item.key][item.locale] = item.value;
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
    const getTranslation = (namespace, key, locale = null) => {
        const targetLocale = locale || translationState.currentLocale;

        // Check if namespace exists
        if (!translationState.translations[namespace]) {
            console.warn(`Namespace "${namespace}" not found`);
            return key;
        }

        // Check if key exists in namespace
        if (!translationState.translations[namespace][key]) {
            console.warn(`Key "${key}" not found in namespace "${namespace}"`);
            return key;
        }

        // Check if translation exists for locale
        if (!translationState.translations[namespace][key][targetLocale]) {
            // Try English as first fallback
            if (translationState.translations[namespace][key]['en']) {
                return translationState.translations[namespace][key]['en'];
            }

            // Fallback to any available translation
            const availableLocales = Object.keys(translationState.translations[namespace][key]);
            if (availableLocales.length > 0) {
                return translationState.translations[namespace][key][availableLocales[0]];
            }

            console.warn(`No translation found for "${namespace}.${key}" in locale "${targetLocale}"`);
            return key;
        }

        return translationState.translations[namespace][key][targetLocale];
    };

    // Set the current locale
    const setLocale = (locale) => {
        if (translationState.languages.some(lang => lang.code === locale)) {
            translationState.currentLocale = locale;
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
        if (!namespace || !key || !values) {
            throw new Error("Missing required parameters");
        }

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

        translationState.isLoading = true;

        // We'll create entries for each locale provided in values
        const results = [];

        for (const locale in values) {
            if (!values[locale]) continue;

            // Validate using base schema
            const entryValidation = await validate(
                { namespace, key, locale, value: values[locale] },
                baseSchema
            );

            if (!entryValidation.success) {
                await logError(`create_translation_${locale}`, entryValidation.errors[0]);
                throw new Error(`Error for ${locale}: ${entryValidation.errors[0]}`);
            }

            // Execute the creation query
            const result = await executeQuery('interface_translations', 'create', {
                namespace,
                key,
                locale,
                value: values[locale]
            });

            results.push(result);
        }

        // Refresh translations after creating new ones
        await fetchTranslations();

        translationState.isLoading = false;
        return results;
    };

    // Update a translation (multi-locale update)
    const updateTranslation = async (namespace, key, values) => {
        if (!namespace || !key || !values) {
            throw new Error("Missing required parameters");
        }

        // Ensure we have existing translations for this namespace and key
        if (!translationState.translations[namespace] ||
            !translationState.translations[namespace][key]) {
            throw new Error(`Translation ${namespace}.${key} not found`);
        }

        // Validate namespace and key
        const validationResult = await validate(
            { namespace, key },
            {
                namespace: baseSchema.shape.namespace,
                key: baseSchema.shape.key
            }
        );

        if (!validationResult.success) {
            await logError("update_translation_validation", validationResult.errors[0]);
            throw new Error(validationResult.errors[0]);
        }

        translationState.isLoading = true;

        // We'll update entries for each locale provided in values
        const results = [];

        for (const locale in values) {
            if (!values[locale] && values[locale] !== '') continue;

            // Validate using base schema
            const entryValidation = await validate(
                { namespace, key, locale, value: values[locale] },
                baseSchema
            );

            if (!entryValidation.success) {
                await logError(`update_translation_${locale}`, entryValidation.errors[0]);
                throw new Error(`Error for ${locale}: ${entryValidation.errors[0]}`);
            }

            // Check if we already have a translation for this locale
            const existingTranslation = translationState.translations[namespace][key][locale];

            if (existingTranslation !== undefined) {
                // If exists, update
                const result = await executeQuery('interface_translations', 'update', {
                    namespace,
                    key,
                    locale,
                    value: values[locale]
                });
                results.push(result);
            } else {
                // If doesn't exist, create
                const result = await executeQuery('interface_translations', 'create', {
                    namespace,
                    key,
                    locale,
                    value: values[locale]
                });
                results.push(result);
            }
        }

        // Refresh translations after updating
        await fetchTranslations();

        translationState.isLoading = false;
        return results;
    };

    // Delete a translation (all locales)
    const deleteTranslation = async (namespace, key) => {
        if (!namespace || !key) {
            throw new Error("Missing required parameters");
        }

        // Ensure we have existing translations for this namespace and key
        if (!translationState.translations[namespace] ||
            !translationState.translations[namespace][key]) {
            throw new Error(`Translation ${namespace}.${key} not found`);
        }

        translationState.isLoading = true;

        const result = await executeQuery('interface_translations', 'delete', {
            namespace,
            key
        });

        // Remove from local state
        if (translationState.translations[namespace] &&
            translationState.translations[namespace][key]) {
            delete translationState.translations[namespace][key];

            // If namespace is now empty, remove it
            if (Object.keys(translationState.translations[namespace]).length === 0) {
                delete translationState.translations[namespace];
            }
        }

        translationState.isLoading = false;
        return result;
    };

    // Delete a namespace (all keys and locales)
    const deleteNamespace = async (namespace) => {
        if (!namespace) {
            throw new Error("Missing namespace parameter");
        }

        // Ensure namespace exists
        if (!translationState.translations[namespace]) {
            throw new Error(`Namespace ${namespace} not found`);
        }

        translationState.isLoading = true;

        // Delete all translations in the namespace
        const keys = Object.keys(translationState.translations[namespace]);
        const results = [];

        for (const key of keys) {
            const result = await executeQuery('interface_translations', 'delete', {
                namespace,
                key
            });
            results.push(result);
        }

        // Remove from local state
        if (translationState.translations[namespace]) {
            delete translationState.translations[namespace];
        }

        translationState.isLoading = false;
        return {
            namespace,
            deletedKeys: keys.length,
            results
        };
    };

    // Create a new namespace if it doesn't exist
    const createNamespace = (namespace) => {
        if (!namespace) {
            throw new Error("Missing namespace parameter");
        }

        // Validate namespace
        const namespaceSchema = baseSchema.shape.namespace;
        const validationResult = namespaceSchema.safeParse(namespace);

        if (!validationResult.success) {
            const error = validationResult.error.errors[0].message;
            throw new Error(error);
        }

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

        // Get the translation
        let text = getTranslation(namespace, translationKey);

        // Replace parameters in the translation
        if (params && Object.keys(params).length > 0) {
            Object.keys(params).forEach(param => {
                text = text.replace(new RegExp(`{{${param}}}`, 'g'), params[param]);
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

