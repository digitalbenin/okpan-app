import { executeQuery } from "$lib/stores/GraphqlUtils.js";
import { getValidationStore } from "./ValidationStore.svelte.js";
import { getLogStore } from "$lib/stores/LogStore.svelte.js";

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
        console.log("initializing languages");
        await fetchLanguages();
        contentLanguageState.isInitialized = true;
    };

    const fetchLanguages = async () => {
        contentLanguageState.isLoading = true;
        const result = await executeQuery('languages', 'list');
        console.log(result);

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
        getAvaliableLocalesForProject
    };

    return storeInstance;
}
