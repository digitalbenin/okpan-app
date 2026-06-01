const DEFAULT_CONTENT_LANGUAGE = { code: 'en', name: 'English', is_default: 1 };

class ContentLanguageStore {
    languages = $state([]);
    projectLanguages = $state([]);
    currentLocale = $state('en');
    isLoading = $state(false);
    error = $state(null);
    isInitialized = $state(false);
    defaultLocale = $state('en');

    constructor() {
        this.initialize = this.initialize.bind(this);
        this.setLocale = this.setLocale.bind(this);
        this.getLanguage = this.getLanguage.bind(this);
        this.getAvailableLocales = this.getAvailableLocales.bind(this);
        this.setProjectLanguages = this.setProjectLanguages.bind(this);
        this.getTranslationContent = this.getTranslationContent.bind(this);
        this.getExistingTranslationId = this.getExistingTranslationId.bind(this);
        this.buildTranslationFormValues = this.buildTranslationFormValues.bind(this);
    }

    get state() {
        return this;
    }

    get contentLanguageState() {
        return this;
    }

    /**
     * Initialize store from pre-loaded data.
     */
    initialize({ languages = [], projectLanguages = [], locale = 'en' } = {}) {
        this.languages = languages.length > 0 ? languages : [DEFAULT_CONTENT_LANGUAGE];
        this.projectLanguages = projectLanguages.length > 0 ? projectLanguages : this.languages;
        this.currentLocale = locale;
        this.isInitialized = true;
    }

    getLanguage(code) {
        return this.languages.find(language => language.code === code);
    }

    setLocale(code) {
        this.currentLocale = code;
    }

    getAvailableLocales() {
        return this.languages.map(language => language.code);
    }

    setProjectLanguages(langs) {
        this.projectLanguages = langs;
    }

    getTranslationContent(fieldObj, langCode) {
        return fieldObj?.translations?.find((t) => t.language?.code === langCode)?.content ?? "";
    }

    getExistingTranslationId(fieldObj, langCode) {
        return fieldObj?.translations?.find((t) => t.language?.code === langCode)?.id ?? null;
    }

    buildTranslationFormValues(entity, secondaryLanguages, translatableFields) {
        const values = {};
        secondaryLanguages.forEach(lang => {
            translatableFields.forEach(fieldName => {
                values[`translations_${lang.id}_${fieldName}`] = this.getTranslationContent(entity?.[fieldName], lang.code);
            });
        });
        return values;
    }
}

export const contentLanguageStore = new ContentLanguageStore();

export function getContentLanguageStore() {
    return contentLanguageStore;
}
