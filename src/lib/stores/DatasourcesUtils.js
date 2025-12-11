import { executeQuery } from "$lib/stores/GraphqlUtils.js";
import { invalidate } from "$app/navigation";

// Fetch all data sources for a specific institution within a project
export const getDatasources = async (options) => {
    const result = await executeQuery('datasources', 'list', options);
    if (result && result.result) {
        return { items: result.result || [], totalCount: result.result.length || 0 };
    }
    return { items: [], totalCount: 0, error: result?.error || new Error("Failed to fetch data sources or unexpected response structure") };
};

// Fetch datasources linked to a specific object
export const getDatasourcesByObject = async (objectId) => {
    if (!objectId) {
        return { items: [], totalCount: 0, error: "Missing object ID" };
    }
    
    const result = await executeQuery('datasources', 'list', { 
        objectId: objectId,  // Use camelCase to match GraphQL variable name
        page: 0,
        pageSize: 100 // Get all datasources for the object
    });
    
    if (result && result.result) {
        return { items: result.result || [], totalCount: result.result.length || 0 };
    }
    return { items: [], totalCount: 0, error: result?.error || new Error("Failed to fetch data sources for object") };
};

// Unlink a datasource from an object by removing ontology field associations
export const unlinkDatasourceFromObject = async (objectId, datasourceId) => {
    if (!objectId || !datasourceId) {
        return { deletedCount: 0, error: "Missing object or datasource ID" };
    }

    try {
        const result = await executeQuery('datasources', 'unlinkObjectFromDatasource', {
            objectId,
            datasourceId
        });

        const deletedCount = (result?.deletedCount ?? 0);
        return { deletedCount, error: null };
    } catch (error) {
        return { deletedCount: 0, error };
    }
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

// Get template(s) used by a datasource via objects_datasources junction
export const getTemplateByDatasource = async (datasourceId) => {
    if (!datasourceId) {
        return { result: null, error: "Missing Datasource ID" };
    }
    const response = await executeQuery('templates', 'getByDatasource', { datasourceId });
    
    if (!response || response.error) {
        return { result: null, error: response?.error || "Failed to fetch template" };
    }
    
    // Extract unique templates from junction records
    if (response.result?.length > 0) {
        const uniqueTemplates = response.result
            .filter(od => od.template_id && od.template)
            .map(od => od.template);
        // Return the first template found (could be enhanced to return all if needed)
        return { result: uniqueTemplates[0] || null, error: null };
    }
    
    return { result: null, error: null };
};

// Get distinct objects linked to a datasource
export const getObjectsByDatasource = async (options) => {
    const {
        datasourceId,
        projectId,
        institutionId,
        status,
        page = 0,
        pageSize = 25,
        orderBy,
        direction
    } = options || {};

    if (!datasourceId) {
        return { items: [], totalCount: 0, error: "Missing Datasource ID" };
    }

    const params = {
        datasourceId,
        projectId,
        institutionId,
        status,
        page,
        pageSize,
        orderBy,
        direction
    };

    const result = await executeQuery('datasources', 'objectsByDatasource', params);

    const items = result?.result?.items ?? [];
    const totalCount = result?.result?.totalCount ?? items.length;

    return { items, totalCount, error: result?.error || null };
};

// Get a single datasource by ID
export const createDatasource = async (params) => {
    const response = await executeQuery('datasources', 'create', params);

    if (!response || response.error || !response.result) {
        return { result: null, error: response?.error || "Failed to create datasource" };
    }
    return { result: response.result, error: null };
};

// Version that throws errors for useFetcher compatibility
export const createDatasourceWithThrow = async (params) => {
    const response = await executeQuery('datasources', 'create', params);
    if (!response) {
        const errorMessage = response?.error?.message ||
            response?.error ||
            "Failed to create datasource";
        throw new Error(errorMessage);
    }

    return response; // Return just the result, not wrapped in object
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
        // Default language id for creating missing base texts on update
        languageId: updatedData.languageId,
        // Translation arrays
        nameTranslations: updatedData.nameTranslations,
        methodTranslations: updatedData.methodTranslations,
        notesTranslations: updatedData.notesTranslations
    };

    // Remove undefined values to prevent GraphQL errors, but allow nulls
    Object.keys(updateParams).forEach(key =>
        updateParams[key] === undefined && delete updateParams[key]
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
        invalidate("app:institution");
        console.log("invalidate :)")


        if (translationErrors.length > 0) {
            const errorMessage = `Main data saved, but errors occurred during translation updates: ${translationErrors.join('; ')}`;
            console.warn(`[DS Utils] translation errors: ${errorMessage}`);
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
        console.error('[DS Utils] update error:', error?.message || error);
        return { result: null, error: error.message };
    }
};

// Function to delete a datasource
export const deleteDatasource = async (datasourceId) => {
    if (!datasourceId) {
        return { error: "Invalid datasource ID for deleteDatasource" };
    }
    const result = await executeQuery('datasources', 'delete', { datasourceId });
    return result;
};
