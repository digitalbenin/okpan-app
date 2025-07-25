import { executeQuery } from "$lib/stores/GraphqlUtils.js";
import { getValidationStore } from "./ValidationStore.svelte.js";
import { getLogStore } from "$lib/stores/LogStore.svelte.js";
import { z } from "zod";

// Create a singleton instance
let storeInstance = null;

const { error: logError } = getLogStore();

// Main store function that creates and returns the store
export function getContentLanguageStore() {
    // If we already have an instance, return it
    if (storeInstance) {
        return storeInstance;
    }

    // Get validation store
    const { getSchema, validate } = getValidationStore();

    // Get the base schema for validation
    const languagesSchema = getSchema('languages', 'insert');

    // Create a custom schema for translations to ensure all fields are properly validated
    const translationsSchema = z.object({
        textId: z.string().min(1),
        languageCode: z.string().min(1),
        content: z.string().min(1)
    });

    // State variables defined inside the function
    const contentLanguageState = $state({
        languages: [],
        projectLanguages: [],
        currentLocale: 'en',
        isLoading: false,
        error: null,
        isInitialized: false,
        defaultLocale: 'en'
    });

    const initialize = async () => {
        // console.log("initializing languages");
        await fetchLanguages();
        contentLanguageState.isInitialized = true;
    };

    const fetchLanguages = async () => {
        contentLanguageState.isLoading = true;
        const result = await executeQuery('languages', 'list');
        // console.log(result);

        contentLanguageState.languages = result?.result || [];
        contentLanguageState.isLoading = false;
        return result?.result || [];
    };

    const getLanguage = (code) => {
        return contentLanguageState.languages.find(language => language.code === code);
    };

    const setLocale = (code) => {
        contentLanguageState.currentLocale = code;
    };

    const deleteLanguage = async (code) => {
        contentLanguageState.isLoading = true;
        await executeQuery('languages', 'delete', { code });
        await fetchLanguages();
        contentLanguageState.isLoading = false;
    };

    const createLanguage = async (code, name, nativeName, direction, flag) => {
        contentLanguageState.isLoading = true;

        const validationResult = await validate({
            code, name, nativeName, direction, flag
        }, languagesSchema);

        if (!validationResult.success) {
            await logError("create_language", validationResult.errors[0]);
            contentLanguageState.isLoading = false;
            throw new Error(validationResult.errors[0]);
        }

        const result = await executeQuery('languages', 'create', {
            code, name, nativeName, direction, flag
        });

        await fetchLanguages();
        contentLanguageState.isLoading = false;
        return result.insertIntoLanguages[0];
    };

    const getAvailableLocales = () => {
        return contentLanguageState.languages.map(language => language.code);
    };

    const getAvaliableLocalesForProject = async (projectId) => {
        const result = await executeQuery('languages', 'listByProject', { projectId });
        contentLanguageState.projectLanguages = result.result;
        return result.result;
    };

    const setProjectLanguages = (langs) => {
        contentLanguageState.projectLanguages = langs;
    };

    // Add a new translation for a text in a specific language
    const addTranslation = async (textId, languageCode, content) => {
        contentLanguageState.isLoading = true;

        // Find the language ID for the given language code
        const language = contentLanguageState.projectLanguages.find(lang => lang.code === languageCode);
        if (!language) {
            await logError("add_translation", `Language with code "${languageCode}" not found`);
            contentLanguageState.isLoading = false;
            throw new Error(`Language with code "${languageCode}" not found`);
        }

        // Validate the input data
        const validationResult = await validate({
            textId,
            languageCode,
            content
        }, translationsSchema);

        if (!validationResult.success) {
            await logError("add_translation", validationResult.errors[0]);
            contentLanguageState.isLoading = false;
            throw new Error(validationResult.errors[0]);
        }

        // Execute the query to create the translation with languageId instead of languageCode
        const result = await executeQuery('translations', 'create', {
            textId,
            languageId: language.id,  // Use languageId instead of languageCode
            content
        });

        contentLanguageState.isLoading = false;
        return result;
    };

    // Update an existing translation
    const updateTranslation = async (translationId, content, context = null) => {
        contentLanguageState.isLoading = true;

        // Execute the query to update the translation with optional context
        const result = await executeQuery('translations', 'update', {
            id: translationId,
            content
        }, context);

        contentLanguageState.isLoading = false;
        return result;
    };

    // Delete a translation
    const deleteTranslation = async (translationId) => {
        contentLanguageState.isLoading = true;

        // Execute the query to delete the translation
        const result = await executeQuery('translations', 'delete', {
            translationId
        });

        contentLanguageState.isLoading = false;
        return result;
    };

    // Get all translations for a specific text
    const getTranslationsForText = async (textId) => {
        contentLanguageState.isLoading = true;

        // Execute the query to get translations
        const result = await executeQuery('translations', 'getByTextId', {
            textId
        });

        contentLanguageState.isLoading = false;
        return result?.result || [];
    };

    // Start initialization if not already initialized
    if (!contentLanguageState.isInitialized && !contentLanguageState.isLoading) {
        // Start initialization asynchronously
        setTimeout(() => {
            initialize();
        }, 0);
    }

    // Create the store instance    
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
        setProjectLanguages, // <-- add the setter here
        // Add the new translation functions
        addTranslation,
        updateTranslation,
        deleteTranslation,
        getTranslationsForText
    };

    return storeInstance;
}
