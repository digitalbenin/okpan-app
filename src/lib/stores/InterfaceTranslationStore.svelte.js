import { getLogStore } from "$lib/stores/LogStore.svelte.js";
import { browser } from "$app/environment";

const DEFAULT_INTERFACE_LANGUAGE = { code: 'en', name: 'English' };
const { error: logError } = getLogStore();

class TranslationStore {
    translations = $state({});
    languages = $state([]);
    currentLocale = $state('en');
    isLoading = $state(false);
    error = $state(null);
    isInitialized = $state(false);
    defaultLocale = $state('en');

    constructor() {
        this.initialize = this.initialize.bind(this);
        this.setLocale = this.setLocale.bind(this);
        this.getTranslation = this.getTranslation.bind(this);
        this.getNamespaceTranslations = this.getNamespaceTranslations.bind(this);
        this.getAvailableNamespaces = this.getAvailableNamespaces.bind(this);
        this.getFormattedTranslations = this.getFormattedTranslations.bind(this);
        this.t = this.t.bind(this);
    }

    get state() {
        return this;
    }

    get translationState() {
        return this;
    }

    /**
     * Initialize store from pre-loaded data (called from root layout after load())
     */
    initialize({ languages = [], translations = [], locale = 'en' } = {}) {
        this.languages = languages.length > 0 ? languages : [DEFAULT_INTERFACE_LANGUAGE];
        this.currentLocale = locale;
        this._ingestTranslations(translations);
        this.isInitialized = true;
        this.isLoading = false;
        this.error = null;
    }

    _ingestTranslations(rawTranslations = []) {
        const translationData = {};
        for (const item of rawTranslations) {
            if (!item || !item.namespace || !item.key || !item.locale) {
                console.warn("Skipping invalid translation item:", item);
                continue;
            }
            translationData[item.namespace] ??= {};
            translationData[item.namespace][item.key] ??= {};
            translationData[item.namespace][item.key][item.locale] = { id: item.id, value: item.value };
        }
        this.translations = translationData;
    }

    getTranslation(namespace, key, locale = null, fallback = null) {
        const targetLocale = locale || this.currentLocale;
        const localeMap = this.translations[namespace]?.[key];
        if (!localeMap) return fallback || key;
        if (localeMap[targetLocale]) return localeMap[targetLocale].value;
        if (localeMap['en']) return localeMap['en'].value;
        const availableLocales = Object.keys(localeMap);
        if (availableLocales.length > 0) return localeMap[availableLocales[0]].value;
        console.warn(`No translation found for "${namespace}.${key}" in locale "${targetLocale}"`);
        return fallback || key;
    }

    async setLocale(locale) {
        if (!this.languages.some(lang => lang.code === locale)) {
            console.warn(`Locale "${locale}" is not supported in interface languages`);
            return false;
        }
        this.currentLocale = locale;
        if (browser && typeof window?.api?.updateGlobalInterfaceLanguage === 'function') {
            try {
                await window.api.updateGlobalInterfaceLanguage(locale);
            } catch (error) {
                console.warn('Failed to persist interface language:', error);
                await logError('update_interface_language', error.message);
            }
        }
        return true;
    }

    getAvailableNamespaces() {
        return Object.keys(this.translations);
    }

    getNamespaceTranslations(namespace, locale = null) {
        const targetLocale = locale || this.currentLocale;
        if (!this.translations[namespace]) return {};
        const result = {};
        for (const key in this.translations[namespace]) {
            result[key] = this.getTranslation(namespace, key, targetLocale);
        }
        return result;
    }

    getFormattedTranslations() {
        const result = {};
        for (const namespace in this.translations) {
            result[namespace] = this.getNamespaceTranslations(namespace);
        }
        return result;
    }

    t(key, params = {}) {
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
        let text = this.getTranslation(namespace, translationKey, null, fallback);

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
    }
}

export const translationStore = new TranslationStore();

export function getTranslationStore() {
    return translationStore;
}
