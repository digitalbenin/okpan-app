import { API_SECTIONS } from "$lib/utils/queries.js";
import { getValidationStore } from "$lib/stores/ValidationStore.svelte.js";
import { addToast } from "$lib/components/base/BaseToast.svelte";
import { getLogStore } from "$lib/stores/LogStore.svelte.js";


const { error: logError } = getLogStore();

// Get validation store
const { getSchema, validate } = getValidationStore();


const institutionsListQuery = API_SECTIONS.institutions.operations.institutionsListWithCounts.query;
const institutionQuery = API_SECTIONS.institutions.operations.institutionsGetByIdWithCounts.query;
// const projectByIdWithCountsQuery = API_SECTIONS.projects.operations.projectByIdWithCounts.query;
// const updateProjectMutation = API_SECTIONS.projects.operations.projectsUpdate.query;
// const deleteProjectMutation = API_SECTIONS.projects.operations.projectsDelete.query;
// const addLanguageToProjectMutation = API_SECTIONS.projects.operations.projectAddLanguage.query;
// const removeLanguageFromProjectMutation = API_SECTIONS.projects.operations.projectRemoveLanguage.query;
// const setLanguageAsDefaultMutation = API_SECTIONS.projects.operations.projectSetDefaultLanguage.query;

export const getProjectInstitutions = async (projectId) => {
    try {
        // projectInstitutionsState.isLoading = true;

        const response = await window.api.executeGraphQL(institutionsListQuery, { projectId });

        // console.log("response", response);
        // projectInstitutionsState.institutions = response.data.institutionsList;
        // projectInstitutionsState.isLoading = false;
        return response.data.institutionsList;
    } catch (error) {
        // projectInstitutionsState.error = error;
        // projectInstitutionsState.isLoading = false;
        addToast({
            data: {
                title: "Error",
                description: `Failed to fetch institutions: ${error.message}`,
                type: "error"
            }
        });
        await logError("getInstitutions", error.message);
        throw error;
    } finally {
        // projectInstitutionsState.isLoading = false;
    }
};

export const getInstitution = async (institutionId) => {
    try {
        // projectInstitutionsState.isLoading = true;

        const response = await window.api.executeGraphQL(institutionsListQuery, { institutionId });

        // console.log("response", response);
        // projectInstitutionsState.institutions = response.data.institutionsList;
        // projectInstitutionsState.isLoading = false;
        return response.data.institutionsList;
    } catch (error) {
        // projectInstitutionsState.error = error;
        // projectInstitutionsState.isLoading = false;
        addToast({
            data: {
                title: "Error",
                description: `Failed to fetch institution: ${error.message}`,
                type: "error"
            }
        });
        await logError("getInstitutions", error.message);
        throw error;
    } finally {
        // projectInstitutionsState.isLoading = false;
    }
};