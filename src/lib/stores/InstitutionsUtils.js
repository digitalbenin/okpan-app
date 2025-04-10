import { API_SECTIONS, performQuery } from "$lib/utils/queries.js";
import { getValidationStore } from "$lib/stores/ValidationStore.svelte.js";
import { getLogStore } from "$lib/stores/LogStore.svelte.js";


const { error: logError } = getLogStore();

// Get validation store
const { getSchema, validate } = getValidationStore();


const institutionsListWithCounts = API_SECTIONS.institutions.operations.institutionsListWithCounts;
const institutionsGetByIdWithCounts = API_SECTIONS.institutions.operations.institutionsGetByIdWithCounts;
// const projectByIdWithCountsQuery = API_SECTIONS.projects.operations.projectByIdWithCounts.query;
// const updateProjectMutation = API_SECTIONS.projects.operations.projectsUpdate.query;
// const deleteProjectMutation = API_SECTIONS.projects.operations.projectsDelete.query;
// const addLanguageToProjectMutation = API_SECTIONS.projects.operations.projectAddLanguage.query;
// const removeLanguageFromProjectMutation = API_SECTIONS.projects.operations.projectRemoveLanguage.query;
// const setLanguageAsDefaultMutation = API_SECTIONS.projects.operations.projectSetDefaultLanguage.query;

export const getProjectInstitutions = async (projectId, page, pageSize) => {
    try {
        const response = await performQuery(institutionsListWithCounts, { projectId, page, pageSize });
        return response;
    } catch (error) {
        // Already handled by performQuery
        throw error;
    }
};

export const getInstitution = async (institutionId) => {
    try {
        const result = await performQuery(institutionsGetByIdWithCounts, { institutionId });
        return result.result;
    } catch (error) {
        // Already handled by performQuery
        throw error;
    }
};