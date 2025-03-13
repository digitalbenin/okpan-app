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
    const projectByIdQuery = API_SECTIONS.projects.operations.projectsGetById.query;
    const createProjectMutation = API_SECTIONS.projects.operations.projectsCreate.query;
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

            const response = await window.api.executeGraphQL(projectByIdQuery, {
                projectId
            });

            if (!response.success) {
                throw new Error(response.errors?.[0]?.message || "Failed to fetch project");
            }

            projectState.currentProject = response?.data?.project[0];
            projectState.isLoading = false;
            return response?.data?.project[0];

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

            const validationResult = await validate(project, getSchema('project', 'insert'));

            if (!validationResult.success) {
                throw new Error(validationResult.errors[0]);
            }

            const response = await window.api.executeGraphQL(createProjectMutation, {
                project
            });

            if (!response.success) {
                throw new Error(response.errors?.[0]?.message || "Failed to create project");
            }

            projectState.projects.push(response.data.project);
            projectState.isLoading = false;
            return response.data.project;
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
