import { API_SECTIONS, performQuery } from "$lib/utils/queries.js";
import { getValidationStore } from "./ValidationStore.svelte.js";
import { addToast } from "$lib/components/base/BaseToast.svelte";
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

    // Get queries from API_SECTIONS
    const contentLanguagesList = API_SECTIONS.languages.operations.list;
    const contentLanguagesListByProject = API_SECTIONS.languages.operations.listByProject;
    const contentLanguagesCreate = API_SECTIONS.languages.operations.create;
    const contentLanguagesDelete = API_SECTIONS.languages.operations.delete;



    const initialize = async () => {
        console.log("initializing languages");
        try {
            await fetchLanguages();
            contentLanguageState.isInitialized = true;
        } catch (error) {
            contentLanguageState.error = error;
            contentLanguageState.isInitialized = false;
            addToast({
                data: {
                    title: "Error",
                    description: `Failed to initialize: ${error.message}`,
                    type: "error"
                }
            });
            await logError("initialize", error.message);
        }
    };

    const fetchLanguages = async () => {
        try {
            contentLanguageState.isLoading = true;
            const result = await performQuery(contentLanguagesList);
            console.log(result);

            contentLanguageState.languages = result?.result || [];
            contentLanguageState.isLoading = false;
            return result?.result || [];
        } catch (error) {
            contentLanguageState.error = error;
            contentLanguageState.isLoading = false;
            // Error already handled by performQuery
            throw error;
        }
    };

    const getLanguage = (code) => {
        return contentLanguageState.languages.find(language => language.code === code);
    };

    const setLocale = (code) => {
        contentLanguageState.currentLocale = code;
    };

    const deleteLanguage = async (code) => {
        try {
            contentLanguageState.isLoading = true;
            await performQuery(contentLanguagesDelete, { code });

            await fetchLanguages();
            addToast({
                data: {
                    title: "Success",
                    description: "Language deleted successfully",
                    type: "success"
                }
            });

        } catch (error) {
            // Error already handled by performQuery
            throw error;
        } finally {
            contentLanguageState.isLoading = false;
        }
    };

    const createLanguage = async (code, name, nativeName, direction, flag) => {
        try {
            contentLanguageState.isLoading = true;
            const validationResult = await validate({
                code, name, nativeName, direction, flag
            }, languagesSchema);

            if (!validationResult.success) {
                await logError("create_language", validationResult.errors[0]);
                addToast({
                    data: {
                        title: "Can't create language",
                        description: validationResult.errors[0],
                        type: "error"
                    }
                });
                throw new Error(validationResult.errors[0]);
            }

            const result = await performQuery(contentLanguagesCreate, {
                code, name, nativeName, direction, flag
            });

            await fetchLanguages();
            addToast({
                data: {
                    title: "Success",
                    description: "Language created successfully",
                    type: "success"
                }
            });
            return result.insertIntoLanguages[0];
        } catch (error) {
            // Error already handled by performQuery
            throw error;
        } finally {
            contentLanguageState.isLoading = false;
        }
    };

    const getAvailableLocales = () => {
        return contentLanguageState.languages.map(language => language.code);
    };

    const getAvaliableLocalesForProject = async (projectId) => {
        try {
            const result = await performQuery(contentLanguagesListByProject, { projectId });

            contentLanguageState.projectLanguages = result.result;
            return result.result;
        } catch (error) {
            // Error already handled by performQuery
            throw error;
        }
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
