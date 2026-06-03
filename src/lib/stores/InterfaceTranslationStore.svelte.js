import { getLogStore } from "$lib/stores/LogStore.svelte.js";
import { browser } from "$app/environment";

const DEFAULT_INTERFACE_LANGUAGE = { code: 'en', name: 'English' };
const { error: logError } = getLogStore();

let storeInstance = null;

export function getTranslationStore() {
    if (storeInstance) return storeInstance;

    const translationState = $state({
        translations: {},
        languages: [DEFAULT_INTERFACE_LANGUAGE],
        currentLocale: 'en',
        isLoading: false,
        error: null,
        isInitialized: false,
        defaultLocale: 'en',
    });

    const _ingestTranslations = (rawTranslations = []) => {
        const translationData = {};
        for (const item of rawTranslations) {
            if (!item || !item.namespace || !item.key || !item.locale) continue;
            translationData[item.namespace] ??= {};
            translationData[item.namespace][item.key] ??= {};
            translationData[item.namespace][item.key][item.locale] = { id: item.id, value: item.value };
        }
        translationState.translations = translationData;
    };

    const initialize = ({ languages = [], translations = [], locale = 'en' } = {}) => {
        translationState.languages = languages.length > 0 ? languages : [DEFAULT_INTERFACE_LANGUAGE];
        translationState.currentLocale = locale;
        _ingestTranslations(translations);
        translationState.isInitialized = true;
        translationState.isLoading = false;
        translationState.error = null;
    };

    const getTranslation = (namespace, key, locale = null, fallback = null) => {
        const targetLocale = locale || translationState.currentLocale;
        const localeMap = translationState.translations[namespace]?.[key];
        if (!localeMap) return fallback || key;
        if (localeMap[targetLocale]) return localeMap[targetLocale].value;
        if (localeMap['en']) return localeMap['en'].value;
        const availableLocales = Object.keys(localeMap);
        if (availableLocales.length > 0) return localeMap[availableLocales[0]].value;
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

    storeInstance = {
        get translationState() { return translationState; },
        initialize,
        getTranslation,
        setLocale,
        getAvailableNamespaces,
        getNamespaceTranslations,
        getFormattedTranslations,
        t,
    };

    return storeInstance;
}

export const translationStore = getTranslationStore();
