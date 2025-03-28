import { API_SECTIONS, performQuery } from "$lib/utils/queries.js";
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

    // Get queries from API_SECTIONS
    const languagesQuery = API_SECTIONS.interface_languages.operations.interfaceLanguagesList;
    const interfaceTranslationsQuery = API_SECTIONS.interface_translations.operations.interfaceTranslationsList;
    const createInterfaceTranslationQuery = API_SECTIONS.interface_translations.operations.interfaceTranslationsCreate;
    const updateInterfaceTranslationQuery = API_SECTIONS.interface_translations.operations.interfaceTranslationsUpdate;
    const deleteInterfaceTranslationQuery = API_SECTIONS.interface_translations.operations.interfaceTranslationsDelete;

    // Fetch all supported languages
    const fetchLanguages = async () => {
        try {
            const result = await performQuery(languagesQuery);

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

            // Set default locale if available
            if (translationState.languages.length > 0) {
                const enLang = translationState.languages.find(lang => lang.code === 'en');
                translationState.currentLocale = enLang ? enLang.code : translationState.languages[0].code;
            }
        } catch (err) {
            const errorMsg = err?.message || "Unknown error";
            translationState.languages = [];
            translationState.error = `Failed to fetch languages: ${errorMsg}`;
            await logError("fetch_languages", errorMsg);
        }
    };

    // Fetch all translations and organize them by namespace and key
    const fetchTranslations = async () => {
        try {
            const result = await performQuery(interfaceTranslationsQuery);

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
        } catch (err) {
            console.error("Error fetching translations:", err);
            translationState.translations = {};
            translationState.error = `Failed to fetch translations: ${errorMsg}`;
            await logError("fetch_translations", errorMsg);
        }
    };

    // Initialize the store
    const initialize = async () => {
        if (translationState.isInitialized) return;

        try {
            translationState.isLoading = true;
            translationState.error = null;

            // Fetch languages first
            await fetchLanguages();

            // Then fetch translations
            await fetchTranslations();

            translationState.isInitialized = true;
        } catch (err) {
            translationState.error = `Failed to initialize translation store: ${err.message}`;
            console.error("Translation store initialization error:", err);
            await logError("init_translation_store", err.message);
        } finally {
            translationState.isLoading = false;
        }
    };

    // Get a translation by namespace, key and locale
    const getTranslation = (namespace, key, locale = null) => {
        const targetLocale = locale || translationState.currentLocale;

        try {
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
        } catch (err) {
            console.error(`Error getting translation for "${namespace}.${key}":`, err);
            return key;
        }
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

    // Get translations formatted for sveltekit-i18n
    const getFormattedTranslations = () => {
        const formatted = {};

        for (const namespace in translationState.translations) {
            formatted[namespace] = {};

            // Use interface languages
            for (const lang of translationState.languages) {
                formatted[namespace][lang.code] = getNamespaceTranslations(namespace, lang.code);
            }
        }

        return formatted;
    };

    // Refresh translations from the server
    const refreshTranslations = async () => {
        translationState.isLoading = true;
        translationState.error = null;

        try {
            await fetchTranslations();
            return { success: true };
        } catch (err) {
            const errorMsg = err?.message || "Unknown error";
            console.error("Error refreshing translations:", errorMsg);
            translationState.error = `Failed to fetch translations: ${errorMsg}`;
            await logError("refresh_translations", errorMsg);
            return { success: false, error: errorMsg };
        } finally {
            translationState.isLoading = false;
        }
    };

    // Export translations to a JSON file
    const exportTranslations = async (filePath = null) => {
        try {
            translationState.isLoading = true;
            translationState.error = null;

            const result = await window.api.exportTranslations(filePath);

            if (!result.success) {
                throw new Error(result.error || result.message || 'Export failed');
            }

            return result;
        } catch (err) {
            translationState.error = `Failed to export translations: ${err.message}`;
            console.error("Error exporting translations:", err);
            await logError("export_translations", err.message);
            throw err;
        } finally {
            translationState.isLoading = false;
        }
    };

    // Import translations from a JSON file
    const importTranslations = async (filePath = null) => {
        try {
            translationState.isLoading = true;
            translationState.error = null;

            const result = await window.api.importTranslations(filePath);

            if (!result.success) {
                throw new Error(result.error || result.message || 'Import failed');
            }

            // Refresh translations after import
            await fetchLanguages();
            await fetchTranslations();

            return result;
        } catch (err) {
            translationState.error = `Failed to import translations: ${err.message}`;
            console.error("Error importing translations:", err);
            await logError("import_translations", err.message);
            throw err;
        } finally {
            translationState.isLoading = false;
        }
    };

    // Create a new translation with validation
    const createTranslation = async (namespace, key, values) => {
        try {
            translationState.isLoading = true;
            translationState.error = null;

            // Validate each translation using the base schema
            for (const [locale, value] of Object.entries(values)) {
                if (!value.trim()) continue;

                const validationResult = await validate({
                    namespace,
                    key,
                    locale,
                    value
                }, baseSchema);

                if (!validationResult.success) {
                    throw new Error(validationResult.errors[0]);
                }
            }

            // Create mutations for each language
            const mutations = [];
            for (const [locale, value] of Object.entries(values)) {
                if (!value.trim()) continue;

                const result = await performQuery(createInterfaceTranslationQuery, {
                    locale,
                    namespace,
                    key,
                    value
                });
                mutations.push(result);
            }

            // Refresh translations
            await fetchTranslations();
            return { success: true };
        } catch (err) {
            translationState.error = `Failed to create translation: ${err.message}`;
            console.error("Error creating translation:", err);
            await logError("create_translation", err.message);
            return { success: false, error: err.message };
        } finally {
            translationState.isLoading = false;
        }
    };

    // Update an existing translation with validation
    const updateTranslation = async (namespace, key, values) => {
        try {
            translationState.isLoading = true;
            translationState.error = null;

            // Validate each translation using the base schema
            // Get the first locale to use for validation
            const firstLocale = Object.keys(values)[0];
            if (firstLocale) {
                const validationResult = await validate({
                    namespace,
                    key,
                    locale: firstLocale,
                    value: values[firstLocale]
                }, baseSchema);

                if (!validationResult.success) {
                    throw new Error(validationResult.errors[0]);
                }
            }

            // Find all translations for this key in the namespace
            const keyTranslations = [];
            for (const ns in translationState.translations) {
                if (ns === namespace && translationState.translations[ns][key]) {
                    for (const locale in translationState.translations[ns][key]) {
                        keyTranslations.push({
                            namespace,
                            key,
                            locale,
                            value: translationState.translations[ns][key][locale]
                        });
                    }
                }
            }

            // Get existing translations from the database
            const query = {
                name: "Get existing translations",
                query: `{
                interface_translations(where: { 
                    namespace: { eq: "${namespace}" }, 
                    key: { eq: "${key}" }
                }) {
                    id
                    locale
                    value
                }
                }`
            };

            const result = await performQuery(query);

            const existingTranslations = result.interface_translations;
            const existingLocales = existingTranslations.map(t => t.locale);

            // Update existing translations and create new ones
            const mutations = [];

            // First, handle existing translations
            for (const translation of existingTranslations) {
                const newValue = values[translation.locale];

                // Skip if value hasn't changed or isn't provided
                if (!newValue || newValue === translation.value) {
                    continue;
                }

                const result = await performQuery(updateInterfaceTranslationQuery, {
                    id: translation.id,
                    value: newValue
                });
                mutations.push(result);
            }

            // Create new translations for languages that don't have one yet
            for (const locale of Object.keys(values)) {
                // Skip if this language already has a translation
                if (existingLocales.includes(locale)) {
                    continue;
                }

                // Skip if no value was provided for this language
                if (!values[locale]) {
                    continue;
                }

                const result = await performQuery(createInterfaceTranslationQuery, {
                    locale,
                    namespace,
                    key,
                    value: values[locale]
                });
                mutations.push(result);
            }

            // Refresh translations
            await fetchTranslations();
            return { success: true };
        } catch (err) {
            translationState.error = `Failed to update translation: ${err.message}`;
            console.error("Error updating translation:", err);
            await logError("update_translation", err.message);
            return { success: false, error: err.message };
        } finally {
            translationState.isLoading = false;
        }
    };

    // Delete a translation
    const deleteTranslation = async (namespace, key) => {
        try {
            translationState.isLoading = true;
            translationState.error = null;

            // Find all translations for this key in the namespace
            const query = {
                name: "Get translations to delete",
                query: `{
                interface_translations(where: { 
                    namespace: { eq: "${namespace}" }, 
                    key: { eq: "${key}" }
                }) {
                    id
                }
                }`
            };

            const result = await performQuery(query);

            const translationsToDelete = result.interface_translations;

            // Delete each translation
            const mutations = [];
            for (const translation of translationsToDelete) {
                const result = await performQuery(deleteInterfaceTranslationQuery, {
                    id: translation.id
                });
                mutations.push(result);
            }

            // Refresh translations
            await fetchTranslations();
            return { success: true };
        } catch (err) {
            translationState.error = `Failed to delete translation: ${err.message}`;
            console.error("Error deleting translation:", err);
            await logError("delete_translation", err.message);
            return { success: false, error: err.message };
        } finally {
            translationState.isLoading = false;
        }
    };

    // Delete a namespace and all its translations
    const deleteNamespace = async (namespace) => {
        try {
            translationState.isLoading = true;
            translationState.error = null;

            // Find all translations in this namespace
            const query = {
                name: "Get namespace translations to delete",
                query: `{
                interface_translations(where: { 
                    namespace: { eq: "${namespace}" }
                }) {
                    id
                }
                }`
            };

            const result = await performQuery(query);

            const translationsToDelete = result.interface_translations;

            // Delete each translation
            const mutations = [];
            for (const translation of translationsToDelete) {
                const result = await performQuery(deleteInterfaceTranslationQuery, {
                    id: translation.id
                });
                mutations.push(result);
            }

            // Refresh translations
            await fetchTranslations();
            return { success: true };
        } catch (err) {
            translationState.error = `Failed to delete namespace: ${err.message}`;
            console.error("Error deleting namespace:", err);
            await logError("delete_namespace", err.message);
            return { success: false, error: err.message };
        } finally {
            translationState.isLoading = false;
        }
    };

    // Create a new namespace with validation
    const createNamespace = (namespace) => {
        try {
            // Validate namespace using the base schema's namespace field
            const validationResult = baseSchema.pick({ namespace }).safeParse({ namespace });

            return {
                success: validationResult.success,
                error: validationResult.success ? null : validationResult.error.errors[0].message
            };
        } catch (err) {
            console.error("Error validating namespace:", err);
            return { success: false, error: err.message };
        }
    };

    // Translate function (t)
    const t = (key, params = {}) => {
        // Split key into namespace and actual key
        const parts = key.split('.');

        if (parts.length < 2) {
            console.warn(`Invalid translation key format: ${key}. Expected format: namespace.key`);
            return key;
        }

        const namespace = parts[0];
        const actualKey = parts.slice(1).join('.');

        let text = getTranslation(namespace, actualKey);

        // Replace parameters in the text
        if (params && typeof params === 'object') {
            for (const [key, value] of Object.entries(params)) {
                const fallback = key === 'fallback' ? value : null;
                if (fallback && text === actualKey) {
                    text = fallback;
                    continue;
                }
                text = text.replace(new RegExp(`{${key}}`, 'g'), value);
            }
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
        getAvailableNamespaces,
        initialize,
        getTranslation,
        setLocale,
        getNamespaceTranslations,
        getFormattedTranslations,
        refreshTranslations,
        exportTranslations,
        importTranslations,
        createTranslation,
        updateTranslation,
        deleteTranslation,
        deleteNamespace,
        createNamespace,
        t
    };

    return storeInstance;
}

