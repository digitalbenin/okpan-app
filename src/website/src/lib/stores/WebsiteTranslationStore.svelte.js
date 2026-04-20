import { browser } from '$app/environment';

const LOCALE_STORAGE_KEY = 'website-interface-language';
const BUNDLE_MODULES = import.meta.glob('../i18n/*.json', { eager: true });
const BUNDLES = Object.values(BUNDLE_MODULES)
    .map((module) => module?.default ?? module)
    .filter((bundle) => bundle && typeof bundle === 'object');

let storeInstance = null;

function normalizeLocale(locale) {
    return typeof locale === 'string' ? locale.trim().toLowerCase() : '';
}

function getAvailableLanguages() {
    const seen = new Set();

    return BUNDLES
        .map((bundle) => {
            const code = normalizeLocale(bundle?.code);
            if (!code || seen.has(code)) {
                return null;
            }

            seen.add(code);
            return {
                code,
                name: bundle?.name || code,
            };
        })
        .filter(Boolean);
}

function getLocaleStorageKey() {
    if (!browser || typeof window === 'undefined') {
        return LOCALE_STORAGE_KEY;
    }

    const siteBasePath = typeof window.__SITE_BASE_PATH__ === 'string'
        ? window.__SITE_BASE_PATH__.trim()
        : '';
    const scope = siteBasePath || '/';

    return `${LOCALE_STORAGE_KEY}:${scope}`;
}

function getRequestedLocaleFromUrl() {
    if (!browser || typeof window === 'undefined') {
        return '';
    }

    try {
        const url = new URL(window.location.href);
        return url.searchParams.get('interface_language')
            || url.searchParams.get('locale')
            || url.searchParams.get('lang')
            || '';
    } catch {
        return '';
    }
}

function resolveLocale(locale, availableLanguages, defaultLocale) {
    const normalized = normalizeLocale(locale);
    if (!normalized) {
        return defaultLocale;
    }

    const exactMatch = availableLanguages.find((language) => language.code === normalized);
    if (exactMatch) {
        return exactMatch.code;
    }

    const baseLocale = normalized.split('-')[0];
    const baseMatch = availableLanguages.find((language) => language.code === baseLocale);
    if (baseMatch) {
        return baseMatch.code;
    }

    return defaultLocale;
}

function getNestedTranslation(translations, key) {
    if (!translations || !key) return null;

    return key.split('.').reduce((current, part) => {
        if (current && typeof current === 'object' && part in current) {
            return current[part];
        }
        return null;
    }, translations);
}

function getInitialLocale(availableLanguages, defaultLocale) {
    if (!browser || typeof window === 'undefined') {
        return defaultLocale;
    }

    const requestedLocale = getRequestedLocaleFromUrl();
    if (requestedLocale) {
        return resolveLocale(requestedLocale, availableLanguages, defaultLocale);
    }

    const stored = window.localStorage.getItem(getLocaleStorageKey());
    if (stored) {
        return resolveLocale(stored, availableLanguages, defaultLocale);
    }

    const documentLocale = resolveLocale(document?.documentElement?.lang, availableLanguages, '');
    if (documentLocale) {
        return documentLocale;
    }

    const preferred = window.navigator.language || window.navigator.languages?.[0] || defaultLocale;
    return resolveLocale(preferred, availableLanguages, defaultLocale);
}

export function getWebsiteTranslationStore() {
    if (storeInstance) {
        return storeInstance;
    }

    const languages = getAvailableLanguages();
    const defaultLocale = languages[0]?.code || '';

    const translationMap = new Map(
        BUNDLES
            .map((bundle) => {
                const code = normalizeLocale(bundle?.code);
                if (!code) {
                    return null;
                }

                return [code, bundle?.translations || {}];
            })
            .filter(Boolean),
    );

    const translationState = $state({
        currentLocale: getInitialLocale(languages, defaultLocale),
        defaultLocale: defaultLocale,
        languages,
    });

    const applyLocale = (locale) => {
        const nextLocale = resolveLocale(locale, translationState.languages, translationState.defaultLocale);
        translationState.currentLocale = nextLocale;

        if (browser && typeof window !== 'undefined') {
            if (nextLocale) {
                window.localStorage.setItem(getLocaleStorageKey(), nextLocale);
            }

            if (document?.documentElement && nextLocale) {
                document.documentElement.lang = nextLocale;
            }
        }

        return nextLocale;
    };

    const t = (key, params = {}) => {
        translationState.currentLocale;

        const { fallback, ...otherParams } = params || {};
        let text = getNestedTranslation(translationMap.get(translationState.currentLocale), key)
            ?? getNestedTranslation(translationMap.get(translationState.defaultLocale), key)
            ?? fallback
            ?? key;

        if (typeof text !== 'string') {
            text = fallback ?? key;
        }

        if (otherParams && Object.keys(otherParams).length > 0) {
            Object.keys(otherParams).forEach((param) => {
                text = text.replace(new RegExp(`{{${param}}}`, 'g'), String(otherParams[param]));
            });
        }

        return text;
    };

    applyLocale(translationState.currentLocale);

    storeInstance = {
        translationState,
        setLocale: applyLocale,
        t,
    };

    return storeInstance;
}
