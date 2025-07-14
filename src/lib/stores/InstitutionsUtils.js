import { executeQuery } from "$lib/stores/GraphqlUtils.js";
import { getValidationStore } from "$lib/stores/ValidationStore.svelte.js";
import { invalidate } from "$app/navigation";

// Get validation store
const { getSchema, validate } = getValidationStore();

export const getProjectInstitutions = async (projectId, page, pageSize, orderBy, direction, search) => {
    const response = await executeQuery('institutions', 'list', { projectId, page, pageSize, orderBy, direction, search });

    return response;
};

export const getInstitution = async (institutionId, fetchFn) => {
    const result = await executeQuery('institutions', 'getById', { institutionId }, fetchFn);

    return result.result;
};

// Function to update an institution, including translations orchestration
export const updateInstitution = async (institutionId, updatedData) => {
    if (!institutionId) {
        return { result: null, error: "Missing Institution ID" };
    }



    // Prepare all parameters for the multi-step mutation
    const updateParams = {
        id: institutionId,
        // Direct fields
        status: updatedData.status,
        links: updatedData.links,
        // Text content for default language
        name: updatedData.name,
        description: updatedData.description,
        country: updatedData.country,
        location: updatedData.location,
        languageId: updatedData.languageId,
        // Translation arrays
        nameTranslations: updatedData.nameTranslations,
        descriptionTranslations: updatedData.descriptionTranslations,
        countryTranslations: updatedData.countryTranslations,
        locationTranslations: updatedData.locationTranslations
    };

    // Remove undefined values to prevent GraphQL errors
    Object.keys(updateParams).forEach(key => {
        if (updateParams[key] === undefined) {
            delete updateParams[key];
        }
    });



    // Execute the multi-step mutation
    const result = await executeQuery('institutions', 'update', updateParams);

    if (result.error) {
        console.error('Institution update error:', result.error);
        return { result: null, error: result.error };
    }


    invalidate("app:institutions");
    return { result: result.result, error: null };
};

export const deleteInstitution = async (institutionId) => {
    const result = await executeQuery('institutions', 'delete', { institutionId });
    invalidate("app:institutions");
    return result;
};