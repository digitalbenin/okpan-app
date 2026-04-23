import { browser } from '$app/environment';

const CONTENT_LOCALE_STORAGE_KEY = 'website-content-language';

let storeInstance = null;

function normalizeLocale(locale) {
	return typeof locale === 'string' ? locale.trim().toLowerCase() : '';
}

function normalizeLanguages(languages = []) {
	const seen = new Set();
	return (Array.isArray(languages) ? languages : [])
		.map((language) => {
			const code = normalizeLocale(language?.code);
			if (!code || seen.has(code)) {
				return null;
			}

			seen.add(code);
			return {
				code,
				name: language?.name || code
			};
		})
		.filter(Boolean);
}

function getLocaleStorageKey() {
	if (!browser || typeof window === 'undefined') {
		return CONTENT_LOCALE_STORAGE_KEY;
	}

	const siteBasePath = typeof window.__SITE_BASE_PATH__ === 'string'
		? window.__SITE_BASE_PATH__.trim()
		: '';
	const scope = siteBasePath || '/';

	return `${CONTENT_LOCALE_STORAGE_KEY}:${scope}`;
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

function getRequestedLocaleFromUrl() {
	if (!browser || typeof window === 'undefined') {
		return '';
	}

	try {
		const url = new URL(window.location.href);
		return url.searchParams.get('content_language')
			|| url.searchParams.get('contentLocale')
			|| '';
	} catch {
		return '';
	}
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

	return defaultLocale;
}

function findMatchingTranslation(value, locale) {
	if (!value || typeof value !== 'object' || !Array.isArray(value.translations)) {
		return null;
	}

	const normalized = normalizeLocale(locale);
	if (!normalized) {
		return null;
	}

	const exactMatch = value.translations.find(
		(translation) => normalizeLocale(translation?.language_code) === normalized
	);
	if (exactMatch?.content) {
		return exactMatch.content;
	}

	const baseLocale = normalized.split('-')[0];
	const baseMatch = value.translations.find(
		(translation) => normalizeLocale(translation?.language_code) === baseLocale
	);
	if (baseMatch?.content) {
		return baseMatch.content;
	}

	return null;
}

export function resolveLocalizedContent(value, locale = '', fallback = '') {
	if (typeof value === 'string') {
		return value || fallback;
	}

	if (!value || typeof value !== 'object') {
		return fallback;
	}

	const translated = findMatchingTranslation(value, locale);
	if (translated) {
		return translated;
	}

	if (typeof value.content === 'string' && value.content) {
		return value.content;
	}

	const firstTranslation = value.translations?.find((translation) => typeof translation?.content === 'string' && translation.content);
	if (firstTranslation?.content) {
		return firstTranslation.content;
	}

	return fallback;
}

export function getLocalizedFieldValue(entity, field, locale = '', fallback = '') {
	if (!entity || !field) {
		return fallback;
	}

	const localizedValue = entity?.[`${field}_i18n`];
	if (localizedValue !== undefined) {
		return resolveLocalizedContent(localizedValue, locale, fallback);
	}

	return resolveLocalizedContent(entity?.[field], locale, fallback);
}

export function getWebsiteContentStore() {
	if (storeInstance) {
		return storeInstance;
	}

	const contentState = $state({
		currentLocale: '',
		defaultLocale: '',
		languages: []
	});

	const applyLocale = (locale) => {
		const nextLocale = resolveLocale(locale, contentState.languages, contentState.defaultLocale);
		contentState.currentLocale = nextLocale;

		if (browser && typeof window !== 'undefined' && nextLocale) {
			window.localStorage.setItem(getLocaleStorageKey(), nextLocale);
		}

		return nextLocale;
	};

	const initialize = ({ languages = [], defaultLocale = '' } = {}) => {
		const normalizedLanguages = normalizeLanguages(languages);
		const fallbackLocale = resolveLocale(defaultLocale, normalizedLanguages, normalizedLanguages[0]?.code || '');

		contentState.languages = normalizedLanguages;
		contentState.defaultLocale = fallbackLocale;

		if (normalizedLanguages.length === 0) {
			contentState.currentLocale = '';
			return '';
		}

		const preferredLocale = contentState.currentLocale || getInitialLocale(normalizedLanguages, fallbackLocale);
		return applyLocale(preferredLocale || fallbackLocale);
	};

	const content = (entityOrValue, field = null, fallback = '') => {
		contentState.currentLocale;

		if (field) {
			return getLocalizedFieldValue(entityOrValue, field, contentState.currentLocale, fallback);
		}

		return resolveLocalizedContent(entityOrValue, contentState.currentLocale, fallback);
	};

	storeInstance = {
		contentState,
		initialize,
		setLocale: applyLocale,
		content
	};

	return storeInstance;
}