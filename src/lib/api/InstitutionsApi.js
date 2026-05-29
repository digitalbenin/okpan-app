import { executeQuery } from "$lib/api/graphqlClient.js";
import { getValidationStore } from "$lib/stores/ValidationStore.svelte.js";
import { invalidate, invalidateAll } from "$app/navigation";
import { deleteAssetsBulk } from "$lib/api/AssetsApi.js";

// Get validation store
const { getSchema, validate } = getValidationStore();

/**
 * @namespace frontend.api.InstitutionsApi
 */

/**
 * Returns all institutions for a project.
 * @memberOf frontend.api.InstitutionsApi
 * @method
 * @param {Object} options - Query filters (projectId, status, page, pageSize, orderBy, direction, search).
 * @returns {Promise.<{items: Array.<Object>, totalCount: number}>} Paginated institutions.
 */
export const getProjectInstitutions = async (options) => {
    const response = await executeQuery('institutions', 'list', options);

    return response;
};

/**
 * Returns a single institution by ID.
 * @memberOf frontend.api.InstitutionsApi
 * @method
 * @param {string} institutionId - The institution ID.
 * @param {Function} [fetchFn] - Optional custom fetch function for SSR contexts.
 * @returns {Promise.<Object>} The institution record including localised texts.
 */
export const getInstitution = async (institutionId, fetchFn) => {
    const result = await executeQuery('institutions', 'getById', { institutionId }, fetchFn);

    return result;
};

/**
 * Updates an institution's status (e.g. draft, published).
 * @memberOf frontend.api.InstitutionsApi
 * @method
 * @param {string} institutionId - The institution ID.
 * @param {string} status - New status value.
 * @returns {Promise.<{result: (Object|null), error: (string|null)}>}
 */
export const updateInstitutionStatus = async (institutionId, status) => {
    if (!institutionId) {
        return { result: null, error: "Missing Institution ID" };
    }
    if (!status) {
        return { result: null, error: "Missing status value" };
    }

    const result = await executeQuery('institutions', 'updateStatus', { id: institutionId, status });

    if (result?.error) {
        return { result: null, error: result.error };
    }

    // Invalidate both the detail and listings
    await invalidateAll();

    const updated = result || [{ id: institutionId, status }];
    return { result: updated, error: null };
};

/**
 * Bulk updates the status of multiple institutions.
 * @memberOf frontend.api.InstitutionsApi
 * @method
 * @param {Array.<string>} institutionIds - Array of institution IDs.
 * @param {string} status - New status value.
 * @returns {Promise.<{result: Array.<Object>, errors: Array.<{error: string}>}>}
 */
export const updateInstitutionsStatusBulk = async (institutionIds, status) => {
    if (!Array.isArray(institutionIds) || institutionIds.length === 0) {
        return { result: [], errors: [{ error: "No institutions selected" }] };
    }
    if (!status) {
        return { result: [], errors: [{ error: "Missing status value" }] };
    }

    const updates = institutionIds.map((id) => ({ id, status }));
    const result = await executeQuery('institutions', 'bulkUpdate', { updates });

    if (result?.error) {
        return { result: [], errors: [{ error: result.error }] };
    }

    await invalidateAll();

    return {
        result: result?.bulkUpdateInstitutions || [],
        errors: []
    };
};

/**
 * Updates an institution, including translation orchestration.
 * @memberOf frontend.api.InstitutionsApi
 * @method
 * @param {string} institutionId - The institution ID.
 * @param {Object} updatedData - Updated fields (status, website, links, name, description, country, location, languageId, nameTranslations, descriptionTranslations, countryTranslations, locationTranslations).
 * @returns {Promise.<{result: (Object|null), error: (string|null)}>}
 */
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
    return { result, error: null };
};

/**
 * Deletes an institution and all its related assets (physical files included).
 * @memberOf frontend.api.InstitutionsApi
 * @method
 * @param {string} institutionId - The institution ID.
 * @returns {Promise.<Object>} Delete result.
 */
export const deleteInstitution = async (institutionId) => {
    // First, fetch and delete related assets to ensure physical files are removed
    const assetsListResponse = await executeQuery('assets', 'list', { institutionId, pageSize: 1000 });
    const relatedAssets = assetsListResponse?.items || [];
    
    if (relatedAssets.length > 0) {
        const assetIds = relatedAssets.map(asset => asset.id);
        await deleteAssetsBulk(assetIds);
    }

    // The delete mutation expects variable name `id`, not `institutionId`
    const result = await executeQuery('institutions', 'delete', { id: institutionId });
    await invalidateAll();
    return result;
};

/**
 * Creates a new institution, including required localised text entries.
 * @memberOf frontend.api.InstitutionsApi
 * @method
 * @param {Object} institutionData - Institution data (name, projectId, languageId, description, country, location, website, links, status).
 * @returns {Promise.<{institution: Object, nameId: string, descriptionId: string, countryId: string, locationId: string, error: (string|null)}>}
 */
export const createInstitution = async (institutionData) => {
    const result = await executeQuery('institutions', 'create', institutionData);

    if (result.error) {
        console.error('Institution creation error:', result.error);
        return { result: null, error: result.error };
    }

    // Extract all relevant IDs and institution from the institution object
    // The create mutation is multi-step; final result merges all step responses.
    // The institution row comes from the last step's `result: insertIntoInstitutions(...)` alias.
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