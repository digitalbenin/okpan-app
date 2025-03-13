import { API_SECTIONS } from "$lib/utils/queries.js";
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
    const languagesQuery = API_SECTIONS.languages.operations.contentLanguagesList.query;
    const projectLanguagesQuery = API_SECTIONS.languages.operations.contentLanguagesListByProject.query;
    const createLanguageMutation = API_SECTIONS.languages.operations.contentLanguagesCreate.query;
    const deleteLanguageMutation = API_SECTIONS.languages.operations.contentLanguagesDelete.query;



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
            const response = await window.api.executeGraphQL(languagesQuery);
            console.log(response);

            contentLanguageState.languages = response?.data?.languages || [];
            contentLanguageState.isLoading = false;
            return response?.data?.languages || [];
        } catch (error) {
            contentLanguageState.error = error;
            contentLanguageState.isLoading = false;
            addToast({
                data: {
                    title: "Error",
                    description: `Failed to fetch languages: ${error.message}`,
                    type: "error"
                }
            });
            await logError("fetch_languages", error.message);
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
            const response = await window.api.executeGraphQL(deleteLanguageMutation, { code });

            if (!response.success) {
                throw new Error(response.errors?.[0]?.message || "Failed to delete language");
            }

            await fetchLanguages();
            addToast({
                data: {
                    title: "Success",
                    description: "Language deleted successfully",
                    type: "success"
                }
            });

        } catch (error) {
            addToast({
                data: {
                    title: "Error",
                    description: `Failed to delete language: ${error.message}`,
                    type: "error"
                }
            });
            await logError("delete_language", error.message);
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

            const response = await window.api.executeGraphQL(createLanguageMutation, {
                code, name, nativeName, direction, flag
            });

            if (!response.success) {
                throw new Error(response.errors?.[0]?.message || "Failed to create language");
            }

            await fetchLanguages();
            addToast({
                data: {
                    title: "Success",
                    description: "Language created successfully",
                    type: "success"
                }
            });
            return response.data.contentLanguageCreate;
        } catch (error) {
            addToast({
                data: {
                    title: "Error",
                    description: `Failed to create language: ${error.message}`,
                    type: "error"
                }
            });
            await logError("create_language", error.message);
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
            const response = await window.api.executeGraphQL(projectLanguagesQuery, { projectId });

            if (!response.success) {
                throw new Error(response.errors?.[0]?.message || "Failed to fetch project languages");
            }

            contentLanguageState.projectLanguages = response.data.languages;
            return response.data.languages;
        } catch (error) {
            addToast({
                data: {
                    title: "Error",
                    description: `Failed to fetch project languages: ${error.message}`,
                    type: "error"
                }
            });
            await logError("get_project_languages", error.message);
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
