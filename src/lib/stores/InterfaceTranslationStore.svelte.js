import { executeQuery } from "$lib/api/graphqlClient.js";
import { getLogStore } from "$lib/stores/LogStore.svelte.js";
import { browser } from "$app/environment";

let storeInstance = null;
const DEFAULT_INTERFACE_LANGUAGE = { code: 'en', name: 'English' };

export function getTranslationStore() {
    if (storeInstance) return storeInstance;

    const { error: logError } = getLogStore();

    const translationState = $state({
        translations: {},
        languages: [],
        currentLocale: 'en',
        isLoading: false,
        error: null,
        isInitialized: false,
        defaultLocale: 'en'
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

    const fetchLanguages = async () => {
        const result = await executeQuery('interface_languages', 'list');
        if (!result) {
            const errorMsg = "No response received from server for languages";
            translationState.languages = [];
            translationState.error = errorMsg;
            await logError("fetch_languages", errorMsg);
            return;
        }

        const fetchedLanguages = Array.isArray(result) ? result : [];
        translationState.languages = fetchedLanguages.length > 0
            ? fetchedLanguages
            : [DEFAULT_INTERFACE_LANGUAGE];

        if (translationState.languages.length > 0) {
            const persistedLocale = await getPersistedInterfaceLanguage();
            const persistedLanguage = persistedLocale
                ? translationState.languages.find(lang => lang.code === persistedLocale)
                : null;
            const enLang = translationState.languages.find(lang => lang.code === 'en');
            translationState.currentLocale = persistedLanguage?.code || enLang?.code || translationState.languages[0].code;
        }
    };

    const fetchTranslations = async () => {
        const result = await executeQuery('interface_translations', 'list');
        if (!result) {
            const errorMsg = "No response received from server for translations";
            translationState.translations = {};
            translationState.error = errorMsg;
            await logError("fetch_translations", errorMsg);
            return;
        }

        const translations = Array.isArray(result) ? result : [];
        const translationData = {};
        for (const item of translations) {
            if (!item || !item.namespace || !item.key || !item.locale) {
                console.warn("Skipping invalid translation item:", item);
                continue;
            }
            translationData[item.namespace] ??= {};
            translationData[item.namespace][item.key] ??= {};
            translationData[item.namespace][item.key][item.locale] = { id: item.id, value: item.value };
        }
        translationState.translations = translationData;
    };

    // Initialize the store
    const initialize = async () => {
        if (translationState.isInitialized) return;
        translationState.isLoading = true;
        translationState.error = null;
        await fetchLanguages();
        await fetchTranslations();
        translationState.isInitialized = true;
        translationState.isLoading = false;
    };

    const getTranslation = (namespace, key, locale = null, fallback = null) => {
        const targetLocale = locale || translationState.currentLocale;
        const localeMap = translationState.translations[namespace]?.[key];
        if (!localeMap) return fallback || key;
        if (localeMap[targetLocale]) return localeMap[targetLocale].value;
        if (localeMap['en']) return localeMap['en'].value;
        const availableLocales = Object.keys(localeMap);
        if (availableLocales.length > 0) return localeMap[availableLocales[0]].value;
        console.warn(`No translation found for "${namespace}.${key}" in locale "${targetLocale}"`);
        return fallback || key;
    };

    const setLocale = async (locale) => {
        if (!translationState.languages.some(lang => lang.code === locale)) {
            console.warn(`Locale "${locale}" is not supported in interface languages`);
            return false;
        }
        translationState.currentLocale = locale;
        if (browser && typeof window?.api?.updateGlobalInterfaceLanguage === 'function') {
            try {
                await window.api.updateGlobalInterfaceLanguage(locale);
            } catch (error) {
                console.warn('Failed to persist interface language:', error);
                await logError('update_interface_language', error.message);
            }
        }
        return true;
    };

    const getAvailableNamespaces = () => Object.keys(translationState.translations);

    const getNamespaceTranslations = (namespace, locale = null) => {
        const targetLocale = locale || translationState.currentLocale;
        if (!translationState.translations[namespace]) return {};
        const result = {};
        for (const key in translationState.translations[namespace]) {
            result[key] = getTranslation(namespace, key, targetLocale);
        }
        return result;
    };

    const getFormattedTranslations = () => {
        const result = {};
        for (const namespace in translationState.translations) {
            result[namespace] = getNamespaceTranslations(namespace);
        }
        return result;
    };

    const refreshTranslations = async () => {
        translationState.isLoading = true;
        await fetchTranslations();
        translationState.isLoading = false;
        return Object.keys(translationState.translations).length;
    };

    const exportTranslations = async (filePath = null) => {
        const data = {
            namespaces: getAvailableNamespaces(),
            languages: translationState.languages.map(l => l.code),
            translations: translationState.translations
        };
        if (filePath) return { success: true, data };
        return data;
    };

    const importTranslations = async () => {
        translationState.isLoading = true;
        translationState.error = null;
        let languagesAddedCount = 0;
        let translationsAddedCount = 0;

        try {
            const dialogResult = await window.api.openFileDialog({
                title: 'Select Translations JSON File',
                properties: ['openFile'],
                filters: [{ name: 'JSON Files', extensions: ['json'] }]
            });

            if (dialogResult.canceled || !dialogResult.filePaths?.length) {
                translationState.isLoading = false;
                return { success: false, message: "No file selected or dialog cancelled", stats: { languages: 0, translations: 0 } };
            }

            const fileContent = await window.api.readFile(dialogResult.filePaths[0]);
            if (fileContent == null) throw new Error("Failed to read file or file is empty.");

            let jsonData;
            try {
                jsonData = JSON.parse(fileContent);
            } catch (parseError) {
                throw new Error(`Failed to parse JSON: ${parseError.message}`);
            }

            const languagesToImport = jsonData?.languages;
            if (Array.isArray(languagesToImport) && languagesToImport.length > 0) {
                for (const lang of languagesToImport) {
                    if (lang?.code && lang?.name) {
                        try {
                            await executeQuery('interface_languages', 'create', { code: lang.code, name: lang.name });
                            languagesAddedCount++;
                        } catch (langError) {
                            console.warn(`Could not add language ${lang.code} (may already exist):`, langError.message);
                        }
                    }
                }
            }

            const translationsToImport = Array.isArray(jsonData?.translations) ? jsonData.translations : [];
            if (translationsToImport.length > 0) {
                await executeQuery('interface_translations', 'import', { translations: translationsToImport });
                translationsAddedCount = translationsToImport.length;
            }

            await refreshTranslations();
            await fetchLanguages();
            translationState.isLoading = false;
            return {
                success: true,
                message: `Import successful. Languages processed: ${languagesAddedCount}, Translations processed: ${translationsAddedCount}`,
                stats: { languages: languagesAddedCount, translations: translationsAddedCount }
            };
        } catch (err) {
            console.error("Import failed:", err);
            translationState.error = err.message;
            await logError("import_translations", err.message);
            translationState.isLoading = false;
            return { success: false, message: err.message, stats: { languages: languagesAddedCount, translations: translationsAddedCount } };
        }
    };

    const createTranslation = async (namespace, key, values) => {
        if (!namespace || !key || !values) throw new Error("Missing required parameters");
        translationState.isLoading = true;
        const errors = [];

        for (const [locale, value] of Object.entries(values)) {
            if (!value) continue;
            const result = await executeQuery('interface_translations', 'create', { namespace, key, locale, value });
            if (result?.error) errors.push(`Failed to create translation for ${locale}: ${result.error}`);
        }

        await fetchTranslations();
        translationState.isLoading = false;
        return errors.length ? { success: false, error: errors.join('; ') } : { success: true };
    };

    const updateTranslation = async (namespace, key, values) => {
        if (!namespace || !key || !values) throw new Error("Missing required parameters");
        if (!translationState.translations[namespace]?.[key]) {
            throw new Error(`Translation ${namespace}.${key} not found`);
        }
        translationState.isLoading = true;
        const errors = [];

        for (const [locale, value] of Object.entries(values)) {
            if (value === undefined || value === null) continue;
            const existing = translationState.translations[namespace][key][locale];
            const result = existing
                ? await executeQuery('interface_translations', 'update', { id: existing.id, value })
                : await executeQuery('interface_translations', 'create', { namespace, key, locale, value });
            if (result?.error) errors.push(`Failed to ${existing ? 'update' : 'create'} translation for ${locale}: ${result.error}`);
        }

        await fetchTranslations();
        translationState.isLoading = false;
        return errors.length ? { success: false, error: errors.join('; ') } : { success: true };
    };

    const deleteTranslation = async (namespace, key) => {
        if (!namespace || !key) return { success: false, error: "Missing required parameters" };

        const keyEntry = translationState.translations[namespace]?.[key];
        if (!keyEntry) {
            await fetchTranslations();
            return { success: true };
        }

        const ids = Object.values(keyEntry).map(d => d.id).filter(Boolean);
        translationState.isLoading = true;
        const errors = [];

        for (const id of ids) {
            const result = await executeQuery('interface_translations', 'delete', { id });
            if (result?.error) errors.push(`Failed to delete ID ${id}: ${result.error}`);
        }

        if (translationState.translations[namespace]?.[key]) {
            delete translationState.translations[namespace][key];
            if (!Object.keys(translationState.translations[namespace]).length) {
                delete translationState.translations[namespace];
            }
        }

        await fetchTranslations();
        translationState.isLoading = false;
        return errors.length
            ? { success: false, error: errors.join('; ') }
            : { success: true };
    };

    const deleteNamespace = async (namespace) => {
        if (!namespace) return { success: false, error: "Missing namespace parameter" };

        const namespaceEntry = translationState.translations[namespace];
        if (!namespaceEntry) {
            await fetchTranslations();
            return { success: true };
        }

        translationState.isLoading = true;
        const errors = [];

        for (const key of Object.keys(namespaceEntry)) {
            const result = await deleteTranslation(namespace, key);
            if (!result.success) errors.push(result.error || `Failed to delete key '${key}'`);
        }

        if (translationState.translations[namespace]) delete translationState.translations[namespace];
        await fetchTranslations();
        translationState.isLoading = false;

        return errors.length
            ? { success: false, error: errors.join('; ') }
            : { success: true };
    };

    const createNamespace = (namespace) => {
        if (!namespace) throw new Error("Missing namespace parameter");
        if (!translationState.translations[namespace]) {
            translationState.translations = { ...translationState.translations, [namespace]: {} };
        }
        return { namespace, success: true };
    };

    const t = (key, params = {}) => {
        let namespace = 'common';
        let translationKey = key;

        if (key.includes(':')) {
            const parts = key.split(':');
            namespace = parts[0];
            translationKey = parts.slice(1).join(':');
        } else if (key.includes('.')) {
            const parts = key.split('.');
            namespace = parts[0];
            translationKey = parts.slice(1).join('.');
        }

        const { fallback, ...otherParams } = params || {};
        let text = getTranslation(namespace, translationKey, null, fallback);

        // Plural support: "singular form | plural form" — pick based on count param
        if ('count' in otherParams && text.includes(' | ')) {
            const [singular, plural] = text.split(' | ');
            text = Number(otherParams.count) === 1 ? singular : plural;
        }

        if (Object.keys(otherParams).length > 0) {
            Object.keys(otherParams).forEach(param => {
                text = text.replace(new RegExp(`{{${param}}}`, 'g'), otherParams[param]);
            });
        }

        return text;
    };

    if (!translationState.isInitialized && !translationState.isLoading) {
        setTimeout(() => initialize(), 0);
    }

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

