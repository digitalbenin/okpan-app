import { API_SECTIONS } from "$lib/utils/queries.js";
import { getValidationStore } from "./ValidationStore.svelte.js";
import { addToast } from "$lib/components/base/BaseToast.svelte";
import { getLogStore } from "$lib/stores/LogStore.svelte.js";

// Create a singleton instance
let storeInstance = null;

const { error: logError } = getLogStore();

// Main store function that creates and returns the store
export function getProjectStore() {
    // If we already have an instance, return it
    if (storeInstance) {
        return storeInstance;
    }

    // Get validation store
    const { getSchema, validate } = getValidationStore();

    const projectState = $state({
        projects: [],
        currentProject: null,
        isLoading: false,
        error: null
    });

    const projectListQuery = API_SECTIONS.projects.operations.projectsListWithCounts.query;
    const projectByIdWithCountsQuery = API_SECTIONS.projects.operations.projectByIdWithCounts.query;
    const updateProjectMutation = API_SECTIONS.projects.operations.projectsUpdate.query;
    const deleteProjectMutation = API_SECTIONS.projects.operations.projectsDelete.query;
    const addLanguageToProjectMutation = API_SECTIONS.projects.operations.projectAddLanguage.query;
    const removeLanguageFromProjectMutation = API_SECTIONS.projects.operations.projectRemoveLanguage.query;
    const setLanguageAsDefaultMutation = API_SECTIONS.projects.operations.projectSetDefaultLanguage.query;

    // Initialize the project store
    const initialize = async () => {
        try {
            projectState.isLoading = true;

            const response = await window.api.executeGraphQL(projectListQuery);

            if (!response.success) {
                throw new Error(response.errors?.[0]?.message || "Failed to fetch projects");
            }

            console.log("response from initialize", response);

            projectState.projects = response.data.projectsList;
            projectState.isLoading = false;
        } catch (error) {
            projectState.error = error;
            projectState.isLoading = false;
            addToast({
                data: {
                    title: "Error",
                    description: `Failed to fetch projects: ${error.message}`,
                    type: "error"
                }
            });
            await logError("initialize", error.message);
            throw error;
        } finally {
            projectState.isLoading = false;
        }
    };

    const getProjects = async () => {
        try {
            projectState.isLoading = true;

            const response = await window.api.executeGraphQL(projectListQuery);

            console.log("response", response);
            projectState.projects = response.data.projectsList;
            projectState.isLoading = false;
            return response.data.projectsList;
        } catch (error) {
            projectState.error = error;
            projectState.isLoading = false;
            addToast({
                data: {
                    title: "Error",
                    description: `Failed to fetch projects: ${error.message}`,
                    type: "error"
                }
            });
            await logError("getProjects", error.message);
            throw error;
        } finally {
            projectState.isLoading = false;
        }
    };

    const setProject = async (projectId) => {
        try {
            projectState.isLoading = true;

            const response = await window.api.executeGraphQL(projectByIdWithCountsQuery, {
                projectId
            });

            if (!response.success) {
                throw new Error(response.errors?.[0]?.message || "Failed to fetch project");
            }

            projectState.currentProject = response?.data?.projectById;
            projectState.isLoading = false;
            return response?.data?.projectById;

        } catch (error) {
            projectState.error = error;
            projectState.isLoading = false;
            addToast({
                data: {
                    title: "Error",
                    description: `Failed to fetch project: ${error.message}`,
                    type: "error"
                }
            });
            await logError("setProject", error.message);
            throw error;
        } finally {
            projectState.isLoading = false;
        }
    };

    const createProject = async (project) => {
        try {
            projectState.isLoading = true;

            // Validate the incoming project data
            if (!project.languages || !project.title || !project.description) {
                throw new Error("Missing required project data");
            }

            // Find the default language
            const defaultLang = project.languages.find(lang => lang.is_default === 1);
            if (!defaultLang) {
                throw new Error("No default language selected");
            }

            const projectName = project.title.content;
            const description = project.description.content;
            const languageCode = defaultLang.language_code;

            // Get mutations from the API_SECTIONS
            const mutations = API_SECTIONS.projects.operations.projectsCreate.mutations;

            // Step 1: Create title
            const titleQuery = mutations[0].query;
            const titleResult = await window.api.executeGraphQL(titleQuery, {
                projectName,
                languageCode,
            });

            if (!titleResult.success) {
                throw new Error(titleResult.errors?.[0]?.message || "Failed to create title");
            }
            const titleId = titleResult.data.insertIntoTexts[0].id;

            // Step 2: Create description
            const descriptionQuery = mutations[1].query;
            const descriptionResult = await window.api.executeGraphQL(descriptionQuery, {
                description,
                languageCode,
            });

            if (!descriptionResult.success) {
                throw new Error(descriptionResult.errors?.[0]?.message || "Failed to create description");
            }
            const descriptionId = descriptionResult.data.insertIntoTexts[0].id;

            // Step 3: Create project
            const projectQuery = mutations[2].query;
            const projectResult = await window.api.executeGraphQL(projectQuery, {
                titleId,
                descriptionId,
            });

            if (!projectResult.success) {
                throw new Error(projectResult.errors?.[0]?.message || "Failed to create project");
            }
            const projectId = projectResult.data.insertIntoProject[0].id;

            // Step 4: Add default language
            const languageQuery = mutations[3].query;
            const languageResult = await window.api.executeGraphQL(languageQuery, {
                projectId,
                languageCode,
            });

            if (!languageResult.success) {
                throw new Error(languageResult.errors?.[0]?.message || "Failed to set default language");
            }

            // Step 5: Add translations if any (both for title and description)
            if (project.title.translations?.length || project.description.translations?.length) {
                const createTranslationQuery = API_SECTIONS.translations.operations.translationsCreate.query;

                // Add title translations
                for (const translation of project.title.translations || []) {
                    if (translation.content) {
                        await window.api.executeGraphQL(createTranslationQuery, {
                            textId: titleId,
                            languageCode: translation.language_code,
                            content: translation.content,
                        });
                    }
                }

                // Add description translations
                for (const translation of project.description.translations || []) {
                    if (translation.content) {
                        await window.api.executeGraphQL(createTranslationQuery, {
                            textId: descriptionId,
                            languageCode: translation.language_code,
                            content: translation.content,
                        });
                    }
                }
            }

            // Create a response object with the new project data
            const newProject = {
                id: projectId,
                title_id: titleId,
                description_id: descriptionId
            };

            // Add to projects array
            projectState.projects.push(newProject);
            projectState.isLoading = false;

            return newProject;
        } catch (error) {
            projectState.error = error;
            projectState.isLoading = false;
            addToast({
                data: {
                    title: "Error",
                    description: `Failed to create project: ${error.message}`,
                    type: "error"
                }
            });
            await logError("createProject", error.message);
            throw error;
        } finally {
            projectState.isLoading = false;
        }
    };

    const updateProject = async (projectId, project) => {
        try {
            projectState.isLoading = true;

            const validationResult = await validate(project, getSchema('project', 'update'));

            if (!validationResult.success) {
                throw new Error(validationResult.errors[0]);
            }

            const response = await window.api.executeGraphQL(updateProjectMutation, {
                projectId,
                project
            });

            if (!response.success) {
                throw new Error(response.errors?.[0]?.message || "Failed to update project");
            }

            const index = projectState.projects.findIndex(p => p.id === projectId);
            projectState.projects[index] = response.data.project;
            projectState.isLoading = false;
            return response.data.project;
        } catch (error) {
            projectState.error = error;
            projectState.isLoading = false;
            addToast({
                data: {
                    title: "Error",
                    description: `Failed to update project: ${error.message}`,
                    type: "error"
                }
            });
            await logError("updateProject", error.message);
            throw error;
        } finally {
            projectState.isLoading = false;
        }
    };

    const deleteProject = async (projectId) => {
        try {
            projectState.isLoading = true;

            const response = await window.api.executeGraphQL(deleteProjectMutation, {
                projectId
            });

            if (!response.success) {
                throw new Error(response.errors?.[0]?.message || "Failed to delete project");
            }

            projectState.projects = projectState.projects.filter(p => p.id !== projectId);
            projectState.isLoading = false;
            return response.data.project;
        } catch (error) {
            projectState.error = error;
            projectState.isLoading = false;
            addToast({
                data: {
                    title: "Error",
                    description: `Failed to delete project: ${error.message}`,
                    type: "error"
                }
            });
            await logError("deleteProject", error.message);
            throw error;
        } finally {
            projectState.isLoading = false;
        }
    };

    const addLanguageToProject = async (projectId, languageCode) => {
        try {
            projectState.isLoading = true;

            const response = await window.api.executeGraphQL(addLanguageToProjectMutation, {
                projectId,
                languageCode
            });

            if (!response.success) {
                throw new Error(response.errors?.[0]?.message || "Failed to add language to project");
            }

            projectState.projects.find(p => p.id === projectId).languages.push(response.data.projectLanguage);
            projectState.isLoading = false;
            return response.data.projectLanguage;
        } catch (error) {
            projectState.error = error;
            projectState.isLoading = false;
            addToast({
                data: {
                    title: "Error",
                    description: `Failed to add language to project: ${error.message}`,
                    type: "error"
                }
            });
            await logError("addLanguageToProject", error.message);
            throw error;
        } finally {
            projectState.isLoading = false;
        }
    };

    const removeLanguageFromProject = async (projectId, languageCode) => {
        try {
            projectState.isLoading = true;

            const response = await window.api.executeGraphQL(removeLanguageFromProjectMutation, {
                projectId,
                languageCode
            });

            if (!response.success) {
                throw new Error(response.errors?.[0]?.message || "Failed to remove language from project");
            }

            projectState.projects.find(p => p.id === projectId).languages = projectState.projects.find(p => p.id === projectId).languages.filter(l => l.languageCode !== languageCode);
            projectState.isLoading = false;
            return response.data.projectLanguage;
        } catch (error) {
            projectState.error = error;
            projectState.isLoading = false;
            addToast({
                data: {
                    title: "Error",
                    description: `Failed to remove language from project: ${error.message}`,
                    type: "error"
                }
            });
            await logError("removeLanguageFromProject", error.message);
            throw error;
        } finally {
            projectState.isLoading = false;
        }
    };

    const setLanguageAsDefault = async (projectId, code) => {
        try {
            projectState.isLoading = true;

            const response = await window.api.executeGraphQL(setLanguageAsDefaultMutation, {
                projectId,
                code
            });

            if (!response.success) {
                throw new Error(response.errors?.[0]?.message || "Failed to set language as default");
            }

            projectState.projects.find(p => p.id === projectId).defaultLanguage = code;
            projectState.isLoading = false;
            return response.data.projectLanguage;
        } catch (error) {
            projectState.error = error;
            projectState.isLoading = false;
            addToast({
                data: {
                    title: "Error",
                    description: `Failed to set language as default: ${error.message}`,
                    type: "error"
                }
            });
            await logError("setLanguageAsDefault", error.message);
            throw error;
        } finally {
            projectState.isLoading = false;
        }
    };

    // Start initialization if not already initialized
    if (!projectState.isInitialized && !projectState.isLoading) {
        // Start initialization asynchronously
        setTimeout(() => {
            initialize();
        }, 0);
    }

    // Create the store instance    
    storeInstance = {
        projectState,
        initialize,
        getProjects,
        setProject,
        createProject,
        updateProject,
        deleteProject,
        addLanguageToProject,
        removeLanguageFromProject,
        setLanguageAsDefault
    };

    return storeInstance;
}
