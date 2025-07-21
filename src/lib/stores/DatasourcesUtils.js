import { executeQuery, partialUpdate } from "$lib/stores/GraphqlUtils.js";
import { invalidate } from "$app/navigation";

// Fetch all data sources for a specific institution within a project
export const getDatasources = async (options) => {
    const result = await executeQuery('datasources', 'list', options);
    if (result && result.result) {
        return { items: result.result || [], totalCount: result.result.length || 0 };
    }
    return { items: [], totalCount: 0, error: result?.error || new Error("Failed to fetch data sources or unexpected response structure") };
};

// Get a single datasource by ID
export const getDatasource = async (datasourceId) => {
    if (!datasourceId) {
        return { result: null, error: "Missing Datasource ID" };
    }
    const variables = { datasourceId };
    const response = await executeQuery('datasources', 'getById', variables);

    if (!response || response.error || !response.result) {
        return { result: null, error: response?.error || "Failed to fetch datasource" };
    }
    return { result: response.result, error: null };
};

// Function to update a datasource, including translations orchestration
export const updateDatasource = async (datasourceId, updatedData) => {
    if (!datasourceId) {
        return { result: null, error: "Missing Datasource ID" };
    }

    // Prepare all parameters for the multi-step mutation
    const updateParams = {
        datasourceId: datasourceId,
        // Direct fields
        language: updatedData.language,
        contact: updatedData.contact,
        copyright: updatedData.copyright,
        date: updatedData.date,
        // Text content for default language
        name: updatedData.name,
        method: updatedData.method,
        notes: updatedData.notes,
        // Translation arrays
        nameTranslations: updatedData.nameTranslations,
        methodTranslations: updatedData.methodTranslations,
        notesTranslations: updatedData.notesTranslations
    };

    // Remove undefined values to prevent GraphQL errors
    Object.keys(updateParams).forEach(key =>
        (updateParams[key] === undefined || updateParams[key] === null) && delete updateParams[key]
    );



    try {
        // Execute the multi-step mutation that includes translation processing
        const result = await executeQuery('datasources', 'update', updateParams);



        if (!result || result.error) {
            const errorMessage = result?.error?.message ||
                (Array.isArray(result?.error) ? result.error[0]?.message : result?.error) ||
                "Unknown error during update";
            console.error('Update failed:', errorMessage);
            return { result: null, error: errorMessage };
        }

        // Check for translation errors in the result
        const translationErrors = [];
        if (result.processNameTranslations?.errors) {
            translationErrors.push(...result.processNameTranslations.errors);
        }
        if (result.processMethodTranslations?.errors) {
            translationErrors.push(...result.processMethodTranslations.errors);
        }
        if (result.processNotesTranslations?.errors) {
            translationErrors.push(...result.processNotesTranslations.errors);
        }

        invalidate("app:datasources");

        if (translationErrors.length > 0) {
            const errorMessage = `Main data saved, but errors occurred during translation updates: ${translationErrors.join('; ')}`;
            console.warn(errorMessage);
            return {
                result: result,
                error: errorMessage
            };
        }

        return {
            result: result,
            error: null
        };
    } catch (error) {
        console.error('Error during datasource update:', error);
        return { result: null, error: error.message };
    }
};

// Function to delete a datasource
export const deleteDatasource = async (datasourceId) => {
    if (!datasourceId) {
        return { error: "Invalid datasource ID for deleteDatasource" };
    }

    const result = await executeQuery('datasources', 'delete', { datasourceId });
    invalidate("app:datasources");
    return result;
};
