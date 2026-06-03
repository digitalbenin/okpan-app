const DEFAULT_CONTENT_LANGUAGE = { code: 'en', name: 'English', is_default: 1 };

let storeInstance = null;

export function getContentLanguageStore() {
    if (storeInstance) return storeInstance;

    const contentLanguageState = $state({
        languages: [DEFAULT_CONTENT_LANGUAGE],
        projectLanguages: [DEFAULT_CONTENT_LANGUAGE],
        currentLocale: 'en',
        isLoading: false,
        error: null,
        isInitialized: false,
        defaultLocale: 'en',
    });

    const initialize = ({ languages = [], projectLanguages = [], locale = 'en' } = {}) => {
        contentLanguageState.languages = languages.length > 0 ? languages : [DEFAULT_CONTENT_LANGUAGE];
        contentLanguageState.projectLanguages = projectLanguages.length > 0 ? projectLanguages : contentLanguageState.languages;
        contentLanguageState.currentLocale = locale;
        contentLanguageState.isInitialized = true;
    };

    const getLanguage = (code) => contentLanguageState.languages.find(language => language.code === code);

    const setLocale = (code) => { contentLanguageState.currentLocale = code; };

    const getAvailableLocales = () => contentLanguageState.languages.map(language => language.code);

    const setProjectLanguages = (langs) => { contentLanguageState.projectLanguages = langs; };

    const getTranslationContent = (fieldObj, langCode) =>
        fieldObj?.translations?.find((t) => t.language?.code === langCode)?.content ?? "";

    const getExistingTranslationId = (fieldObj, langCode) =>
        fieldObj?.translations?.find((t) => t.language?.code === langCode)?.id ?? null;

    const buildTranslationFormValues = (entity, secondaryLanguages, translatableFields) => {
        const values = {};
        secondaryLanguages.forEach(lang => {
            translatableFields.forEach(fieldName => {
                values[`translations_${lang.id}_${fieldName}`] = getTranslationContent(entity?.[fieldName], lang.code);
            });
        });
        return values;
    };

    storeInstance = {
        get contentLanguageState() { return contentLanguageState; },
        initialize,
        getLanguage,
        setLocale,
        getAvailableLocales,
        setProjectLanguages,
        getTranslationContent,
        getExistingTranslationId,
        buildTranslationFormValues,
    };

    return storeInstance;
}

export const contentLanguageStore = getContentLanguageStore();
