import { executeQuery } from "$lib/stores/GraphqlUtils.js";
import { getValidationStore } from "$lib/stores/ValidationStore.svelte.js";
import { invalidate, invalidateAll } from "$app/navigation";
import { deleteAssetsBulk } from "$lib/stores/AssetsUtils.js";

// Get validation store
const { getSchema, validate } = getValidationStore();

export const getProjectInstitutions = async (options) => {
    const response = await executeQuery('institutions', 'list', options);

    return response;
};

export const getInstitution = async (institutionId, fetchFn) => {
    const result = await executeQuery('institutions', 'getById', { institutionId }, fetchFn);

    return result.result;
};

// Update institution status and invalidate caches
export const updateInstitutionStatus = async (institutionId, status) => {
    if (!institutionId) {
        return { result: null, error: "Missing Institution ID" };
    }
    if (!status) {
        return { result: null, error: "Missing status value" };
    }

    const result = await executeQuery('institutions', 'update', { id: institutionId, status });

    if (result?.error) {
        return { result: null, error: result.error };
    }

    // Invalidate both the detail and listings
    await invalidateAll();

    const updated = result?.result?.updateInstitutions || result?.updateInstitutions || [{ id: institutionId, status }];
    return { result: updated, error: null };
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
        website: updatedData.website,
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


    await invalidateAll();
    return { result: result.result, error: null };
};

export const deleteInstitution = async (institutionId) => {
    // First, fetch and delete related assets to ensure physical files are removed
    const assetsListResponse = await executeQuery('assets', 'list', { institutionId, pageSize: 1000 });
    const relatedAssets = assetsListResponse?.result?.items || [];
    
    if (relatedAssets.length > 0) {
        const assetIds = relatedAssets.map(asset => asset.id);
        await deleteAssetsBulk(assetIds);
    }

    // The delete mutation expects variable name `id`, not `institutionId`
    const result = await executeQuery('institutions', 'delete', { id: institutionId });
    await invalidateAll();
    return result;
};

// Function to create an institution, including the required text entries
export const createInstitution = async (institutionData) => {
    const result = await executeQuery('institutions', 'create', institutionData);

    if (result.error) {
        console.error('Institution creation error:', result.error);
        return { result: null, error: result.error };
    }

    // Extract all relevant IDs and institution from the institution object
    const institution = result?.result?.[0];

    if (!institution) {
        console.error('No institution returned from create mutation:', result);
        return { result: null, error: 'No institution created' };
    }

    await invalidateAll();

    return {
        institution,
        nameId: institution?.name_id,
        descriptionId: institution?.description_id,
        countryId: institution?.country_id,
        locationId: institution?.location_id,
    };
};