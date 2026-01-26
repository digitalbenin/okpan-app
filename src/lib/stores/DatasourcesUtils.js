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

// Create a datasource for an object with auto-generated name
export const createDatasourceForObject = async ({ institutionId, projectId, languageId }) => {
    if (!institutionId || !projectId || !languageId) {
        return { result: null, error: "Missing required parameters: institutionId, projectId, languageId" };
    }

    const timestamp = Date.now();
    
    // Import epochToDate dynamically to avoid circular dependencies
    const { epochToDate } = await import("$lib/utils/dates.js");
    const defaultName = `Data source ${epochToDate(timestamp, true)}`;

    const params = {
        name: defaultName,
        institutionId,
        languageId,
        date: timestamp,
    };

    return await createDatasource(params);
};

// Delete datasource from object: removes ontology fields and junction relation
export const deleteDatasourceFromObject = async (objectId, datasourceId) => {
    if (!objectId || !datasourceId) {
        return { error: "Missing object or datasource ID" };
    }

    try {
        const result = await executeQuery('datasources', 'deleteFromObject', {
            objectId,
            datasourceId,
        });

        return { success: true, error: null };
    } catch (error) {
        return { success: false, error };
    }
};

// Save or update ontology fields for a datasource
// This intelligently updates existing rows instead of deleting and recreating
export const saveOntologyFieldsForDatasource = async (objectId, datasourceId, templateId, fields) => {
    if (!objectId || !datasourceId) {
        return { error: "Missing object or datasource ID" };
    }

    try {
        // First, get the existing fields to determine what needs updating vs inserting
        const result = await executeQuery('datasources', 'saveOntologyFields', {
            objectId,
            datasourceId,
            templateId: templateId || null,
        });

        // The query returns with the alias 'result', not the step name 'getExistingFields'
        const existingFields = result?.result || [];

        // Build maps for quick lookup and identify duplicates
        const existingByLabel = new Map();
        const duplicatesIds = [];

        existingFields.forEach(ef => {
            if (existingByLabel.has(ef.label)) {
                // Duplicate found! We should mark this for deletion to clean up the DB.
                // We keep the FIRST one seen (matching frontend behavior) and delete subsequent ones.
                duplicatesIds.push(ef.id);
            } else {
                existingByLabel.set(ef.label, ef);
            }
        });

        const newFieldLabels = new Set((fields || []).map(f => f.label));

        // Determine operations
        const toUpdate = [];
        const toInsert = [];
        const toDelete = [...duplicatesIds]; // Start with duplicates

        // Process new/updated fields
        for (const field of fields || []) {
            const existing = existingByLabel.get(field.label);
            if (existing) {
                // Field exists - check if it needs updating
                const needsUpdate = 
                    existing.value !== (field.value || "") ||
                    (existing.field_id || null) !== (field.field_id || null) ||
                    existing.primary !== (field.primary || 0);

                if (needsUpdate) {
                    toUpdate.push({
                        id: existing.id,
                        value: field.value || "",
                        field_id: field.field_id || null,
                        primary: field.primary || 0,
                    });
                }
            } else {
                // New field - insert it
                toInsert.push({
                    object_id: objectId,
                    datasources_id: datasourceId,
                    label: field.label,
                    value: field.value || "",
                    field_id: field.field_id || null,
                    primary: field.primary || 0,
                    default_description: 0,
                });
            }
        }

        // Find fields that were removed
        for (const existing of existingFields) {
            if (!newFieldLabels.has(existing.label)) {
                toDelete.push(existing.id);
            }
        }

        // Execute operations in parallel for efficiency
        const operations = [];

        if (toUpdate.length > 0) {
            for (const update of toUpdate) {
                operations.push(
                    executeQuery('objects', 'updateOntologyFieldById', {
                        id: update.id,
                        value: update.value,
                        fieldId: update.field_id,
                        primary: update.primary,
                    })
                );
            }
        }

        if (toInsert.length > 0) {
            operations.push(
                executeQuery('objects', 'insertOntologyFields', {
                    fields: toInsert,
                })
            );
        }

        if (toDelete.length > 0) {
            // Bulk delete not supported by schema for IDs, doing one-by-one
            for (const id of toDelete) {
                 operations.push(
                    executeQuery('objects', 'deleteOntologyFieldById', {
                        id: id,
                    })
                );
            }
        }

        if (operations.length > 0) {
            await Promise.all(operations);
        }

        invalidate('app:objects');
        return { success: true, error: null };
    } catch (error) {
        console.error('saveOntologyFieldsForDatasource error:', error);
        return { result: null, error };
    }
};

