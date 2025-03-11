import { API_SECTIONS } from "$lib/utils/queries.js";
import { getValidationStore } from "./ValidationStore.svelte.js";

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
    const languagesQuery = API_SECTIONS.interface_languages.operations.find(
        (op) => op.name === "List Interface Languages"
    ).query;

    const interfaceTranslationsQuery = API_SECTIONS.interface_translations.operations.find(
        (op) => op.name === "List Interface Translations"
    ).query;

    const createInterfaceTranslationQuery = API_SECTIONS.interface_translations.operations.find(
        (op) => op.name === "Create Interface Translation"
    ).query;

    const updateInterfaceTranslationQuery = API_SECTIONS.interface_translations.operations.find(
        (op) => op.name === "Update Interface Translation"
    ).query;

    const deleteInterfaceTranslationQuery = API_SECTIONS.interface_translations.operations.find(
        (op) => op.name === "Delete Interface Translation"
    ).query;

    // Fetch all supported languages
    const fetchLanguages = async () => {
        try {
            const result = await window.api.executeGraphQL(languagesQuery);

            if (!result.success || result.errors) {
                throw new Error(
                    result.errors
                        ? result.errors[0].message
                        : "Failed to fetch languages"
                );
            }

            translationState.languages = result.data.interface_languages;

            // Set default locale if available
            // Note: interface languages don't have is_default, so we'll use the first one or 'en'
            if (translationState.languages.length > 0) {
                const enLang = translationState.languages.find(lang => lang.code === 'en');
                translationState.currentLocale = enLang ? enLang.code : translationState.languages[0].code;
            }
        } catch (err) {
            console.error("Error fetching languages:", err);
            throw err;
        }
    };

    // Fetch all translations and organize them by namespace and key
    const fetchTranslations = async () => {
        try {
            const result = await window.api.executeGraphQL(interfaceTranslationsQuery);

            if (!result.success || result.errors) {
                throw new Error(
                    result.errors
                        ? result.errors[0].message
                        : "Failed to fetch translations"
                );
            }

            if (!result.data || !result.data.interface_translations) {
                throw new Error("No translation data received from server");
            }

            // Organize translations by namespace and key
            const translationData = {};

            for (const item of result.data.interface_translations) {
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
            throw err;
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
        try {
            translationState.isLoading = true;
            translationState.error = null;
            await fetchTranslations();
        } catch (err) {
            translationState.error = `Failed to refresh translations: ${err.message}`;
            console.error("Error refreshing translations:", err);
        } finally {
            translationState.isLoading = false;
        }
    };

    // Export translations to a JSON file
    const exportTranslations = async (filePath = null) => {
        try {
            translationState.isLoading = true;
            translationState.error = null;

            console.log('Exporting translations...');

            const result = await window.api.exportTranslations(filePath);

            if (!result.success) {
                throw new Error(result.error || result.message || 'Export failed');
            }

            console.log('Export successful:', result.message);
            return result;
        } catch (err) {
            translationState.error = `Failed to export translations: ${err.message}`;
            console.error("Error exporting translations:", err);
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

            console.log('Importing translations...');

            const result = await window.api.importTranslations(filePath);

            if (!result.success) {
                throw new Error(result.error || result.message || 'Import failed');
            }

            console.log('Import successful:', result.message, result.stats);

            // Refresh translations after import
            await fetchLanguages();
            await fetchTranslations();

            return result;
        } catch (err) {
            translationState.error = `Failed to import translations: ${err.message}`;
            console.error("Error importing translations:", err);
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

                const result = await window.api.executeGraphQL(
                    createInterfaceTranslationQuery,
                    {
                        locale,
                        namespace,
                        key,
                        value
                    }
                );
                mutations.push(result);
            }

            // Check for errors
            const errors = mutations.filter(
                (result) => !result.success || result.errors
            );
            if (errors.length > 0) {
                throw new Error(
                    errors[0].errors
                        ? errors[0].errors[0].message
                        : "Failed to create translation"
                );
            }

            // Refresh translations
            await fetchTranslations();
            return { success: true };
        } catch (err) {
            translationState.error = `Failed to create translation: ${err.message}`;
            console.error("Error creating translation:", err);
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
            const query = `{
                interface_translations(where: { 
                    namespace: { eq: "${namespace}" }, 
                    key: { eq: "${key}" }
                }) {
                    id
                    locale
                    value
                }
            }`;

            const result = await window.api.executeGraphQL(query);
            if (!result.success || result.errors) {
                throw new Error(
                    result.errors
                        ? result.errors[0].message
                        : "Failed to fetch existing translations"
                );
            }

            const existingTranslations = result.data.interface_translations;
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

                const result = await window.api.executeGraphQL(
                    updateInterfaceTranslationQuery,
                    {
                        id: translation.id,
                        value: newValue
                    }
                );
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

                const result = await window.api.executeGraphQL(
                    createInterfaceTranslationQuery,
                    {
                        locale,
                        namespace,
                        key,
                        value: values[locale]
                    }
                );
                mutations.push(result);
            }

            // Check for errors
            const errors = mutations.filter(
                (result) => !result.success || result.errors
            );
            if (errors.length > 0) {
                throw new Error(
                    errors[0].errors
                        ? errors[0].errors[0].message
                        : "Failed to update translation"
                );
            }

            // Refresh translations
            await fetchTranslations();
            return { success: true };
        } catch (err) {
            translationState.error = `Failed to update translation: ${err.message}`;
            console.error("Error updating translation:", err);
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
            const query = `{
                interface_translations(where: { 
                    namespace: { eq: "${namespace}" }, 
                    key: { eq: "${key}" }
                }) {
                    id
                }
            }`;

            const result = await window.api.executeGraphQL(query);
            if (!result.success || result.errors) {
                throw new Error(
                    result.errors
                        ? result.errors[0].message
                        : "Failed to fetch translations to delete"
                );
            }

            const translationsToDelete = result.data.interface_translations;

            // Delete each translation
            const mutations = [];
            for (const translation of translationsToDelete) {
                const result = await window.api.executeGraphQL(
                    deleteInterfaceTranslationQuery,
                    {
                        id: translation.id
                    }
                );
                mutations.push(result);
            }

            // Check for errors
            const errors = mutations.filter(
                (result) => !result.success || result.errors
            );
            if (errors.length > 0) {
                throw new Error(
                    errors[0].errors
                        ? errors[0].errors[0].message
                        : "Failed to delete translation"
                );
            }

            // Refresh translations
            await fetchTranslations();
            return { success: true };
        } catch (err) {
            translationState.error = `Failed to delete translation: ${err.message}`;
            console.error("Error deleting translation:", err);
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
            const query = `{
                interface_translations(where: { 
                    namespace: { eq: "${namespace}" }
                }) {
                    id
                }
            }`;

            const result = await window.api.executeGraphQL(query);
            if (!result.success || result.errors) {
                throw new Error(
                    result.errors
                        ? result.errors[0].message
                        : "Failed to fetch translations to delete"
                );
            }

            const translationsToDelete = result.data.interface_translations;

            // Delete each translation
            const mutations = [];
            for (const translation of translationsToDelete) {
                const result = await window.api.executeGraphQL(
                    deleteInterfaceTranslationQuery,
                    {
                        id: translation.id
                    }
                );
                mutations.push(result);
            }

            // Check for errors
            const errors = mutations.filter(
                (result) => !result.success || result.errors
            );
            if (errors.length > 0) {
                throw new Error(
                    errors[0].errors
                        ? errors[0].errors[0].message
                        : "Failed to delete namespace translations"
                );
            }

            // Refresh translations
            await fetchTranslations();
            return { success: true };
        } catch (err) {
            translationState.error = `Failed to delete namespace: ${err.message}`;
            console.error("Error deleting namespace:", err);
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

