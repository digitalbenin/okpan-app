import { executeQuery } from "$lib/stores/GraphqlUtils.js";
import { getValidationStore } from "./ValidationStore.svelte.js";
import { getLogStore } from "$lib/stores/LogStore.svelte.js";
import { z } from "zod";

let storeInstance = null;
const { error: logError } = getLogStore();

export function getContentLanguageStore() {
    if (storeInstance) return storeInstance;

    const { getSchema, validate } = getValidationStore();
    const languagesSchema = getSchema('languages', 'insert');
    const translationsSchema = z.object({
        textId: z.string().min(1),
        languageCode: z.string().min(1),
        content: z.string().min(1)
    });

    const contentLanguageState = $state({
        languages: [],
        projectLanguages: [],
        currentLocale: 'en',
        isLoading: false,
        error: null,
        isInitialized: false,
        defaultLocale: 'en'
    });

    const setLoading = (loading) => contentLanguageState.isLoading = loading;

    const initialize = async () => {
        await fetchLanguages();
        contentLanguageState.isInitialized = true;
    };

    const fetchLanguages = async () => {
        setLoading(true);
        const result = await executeQuery('languages', 'list');
        contentLanguageState.languages = result?.result || [];
        setLoading(false);
        return contentLanguageState.languages;
    };

    const getLanguage = (code) => contentLanguageState.languages.find(language => language.code === code);
    const setLocale = (code) => contentLanguageState.currentLocale = code;
    const getAvailableLocales = () => contentLanguageState.languages.map(language => language.code);
    const setProjectLanguages = (langs) => contentLanguageState.projectLanguages = langs;

    const deleteLanguage = async (code) => {
        setLoading(true);
        await executeQuery('languages', 'delete', { code });
        await fetchLanguages();
        setLoading(false);
    };

    const createLanguage = async (code, name, nativeName, direction, flag) => {
        setLoading(true);
        const validationResult = await validate({ code, name, nativeName, direction, flag }, languagesSchema);

        if (!validationResult.success) {
            await logError("create_language", validationResult.errors[0]);
            setLoading(false);
            throw new Error(validationResult.errors[0]);
        }

        const result = await executeQuery('languages', 'create', { code, name, nativeName, direction, flag });
        await fetchLanguages();
        setLoading(false);
        return result.insertIntoLanguages[0];
    };

    const getAvaliableLocalesForProject = async (projectId) => {
        const result = await executeQuery('languages', 'listByProject', { projectId });
        contentLanguageState.projectLanguages = result.result;
        return result.result;
    };

    // Add a new translation for a text in a specific language
    const addTranslation = async (textId, languageCode, content) => {
        setLoading(true);
        const language = contentLanguageState.projectLanguages.find(lang => lang.code === languageCode);
        
        if (!language) {
            const error = `Language with code "${languageCode}" not found`;
            await logError("add_translation", error);
            setLoading(false);
            throw new Error(error);
        }

        const validationResult = await validate({ textId, languageCode, content }, translationsSchema);
        if (!validationResult.success) {
            await logError("add_translation", validationResult.errors[0]);
            setLoading(false);
            throw new Error(validationResult.errors[0]);
        }

        const result = await executeQuery('translations', 'create', { textId, languageId: language.id, content });
        setLoading(false);
        return result;
    };

    const updateTranslation = async (translationId, content, context = null) => {
        setLoading(true);
        const result = await executeQuery('translations', 'update', { id: translationId, content }, context);
        setLoading(false);
        return result;
    };

    const deleteTranslation = async (translationId) => {
        setLoading(true);
        const result = await executeQuery('translations', 'delete', { translationId });
        setLoading(false);
        return result;
    };

    const getTranslationsForText = async (textId) => {
        setLoading(true);
        const result = await executeQuery('translations', 'getByTextId', { textId });
        setLoading(false);
        return result?.result || [];
    };

    // Helper functions for entity translations
    const getTranslationContent = (fieldObj, langCode) =>
        fieldObj?.translations?.find((t) => t.language?.code === langCode)?.content ?? "";

    const getExistingTranslationId = (fieldObj, langCode) =>
        fieldObj?.translations?.find((t) => t.language?.code === langCode)?.id ?? null;

    const handleFieldTranslation = async (fieldObj, langCode, content, textId = null) => {
        if (!content?.trim()) return null;
        const existingId = getExistingTranslationId(fieldObj, langCode);
        const mainId = fieldObj?.id || textId;
        return existingId ? updateTranslation(existingId, content) 
            : mainId ? addTranslation(mainId, langCode, content) : null;
    };

    const processEntityTranslations = async (entity, secondaryLanguages, translatableFields, formValues, textIdMap = null) => {
        const promises = secondaryLanguages.flatMap(lang =>
            translatableFields.map(fieldName => {
                const content = formValues[`translations_${lang.id}_${fieldName}`];
                return content?.trim() ? handleFieldTranslation(entity?.[fieldName], lang.code, content, textIdMap?.[fieldName]) : null;
            })
        ).filter(Boolean);

        if (promises.length > 0) await Promise.all(promises);
    };

    const buildTranslationFormValues = (entity, secondaryLanguages, translatableFields) => {
        const values = {};
        secondaryLanguages.forEach(lang => {
            translatableFields.forEach(fieldName => {
                values[`translations_${lang.id}_${fieldName}`] = getTranslationContent(entity?.[fieldName], lang.code);
            });
        });
        return values;
    };

    // Start initialization if not already initialized
    if (!contentLanguageState.isInitialized && !contentLanguageState.isLoading) {
        setTimeout(initialize, 0);
    }

    storeInstance = {
        contentLanguageState,
        fetchLanguages,
        initialize,
        getLanguage,
        setLocale,
        getAvailableLocales,
        deleteLanguage,
        createLanguage,
        getAvaliableLocalesForProject,
        setProjectLanguages,
        addTranslation,
        updateTranslation,
        deleteTranslation,
        getTranslationsForText,
        getTranslationContent,
        getExistingTranslationId,
        handleFieldTranslation,
        processEntityTranslations,
        buildTranslationFormValues,
    };

    return storeInstance;
}
