import { executeQuery, partialUpdate } from "$lib/stores/GraphqlUtils.js";
import { invalidate } from "$app/navigation";

// Fetch all data sources for a specific institution within a project
export const getDatasources = async (projectId, institutionId) => {
    if (!projectId || !institutionId) {
        return { result: [], error: "Project ID and Institution ID are required" };
    }
    const params = { institutionId };
    const response = await executeQuery('datasources', 'list', params);

    if (!response) {
        return { result: [], error: "Internal error fetching datasources" };
    }
    if (response.error) {
        return { result: [], error: response.error };
    }
    return { result: response.result || [], error: null };
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

    const mainUpdateVariables = {
        datasourceId: datasourceId,
        language: updatedData.language,
        contact: updatedData.contact,
        copyright: updatedData.copyright,
        date: updatedData.date,
        name: updatedData.name,
        method: updatedData.method,
        notes: updatedData.notes
    };
    Object.keys(mainUpdateVariables).forEach(key =>
        (mainUpdateVariables[key] === undefined || mainUpdateVariables[key] === null) && delete mainUpdateVariables[key]
    );

    const mainUpdateResponse = await executeQuery('datasources', 'update', mainUpdateVariables, fetchFn);

    if (!mainUpdateResponse || mainUpdateResponse.error) {
        const errorMessage = mainUpdateResponse?.error?.message || (Array.isArray(mainUpdateResponse?.error) ? mainUpdateResponse.error[0]?.message : mainUpdateResponse?.error);
        return { result: null, error: errorMessage || "Unknown error during main update" };
    }

    const translationErrors = [];
    const translationResults = {};

    const processTranslations = async (translationsArray, textId, fieldName) => {
        if (!textId || !translationsArray || translationsArray.length === 0) {
            return;
        }
        translationResults[fieldName] = [];

        for (const trans of translationsArray) {
            const { id: originalTranslationId, language_code, content } = trans;
            let operation = null;
            let variables = {};

            if (originalTranslationId) {
                operation = 'update';
                variables = { id: originalTranslationId, content: content };
            } else {
                operation = 'create';
                variables = {
                    textId: textId,
                    languageCode: language_code,
                    content: content
                };
            }

            try {
                const transResponse = await executeQuery('translations', operation, variables);

                if (!transResponse || transResponse.error) {
                    throw new Error(JSON.stringify(transResponse?.error || `Failed to ${operation} ${fieldName} translation for ${language_code}`));
                }
                translationResults[fieldName].push(transResponse.result);
            } catch (err) {
                translationErrors.push(`Failed to ${operation} ${fieldName} for ${language_code}: ${err.message}`);
            }
        }
    };

    await Promise.all([
        processTranslations(updatedData.nameTranslations, updatedData.original_name_id, 'name'),
        processTranslations(updatedData.methodTranslations, updatedData.original_method_id, 'method'),
        processTranslations(updatedData.notesTranslations, updatedData.original_notes_id, 'notes')
    ]);

    if (translationErrors.length > 0) {
        const errorMessage = `Main data saved, but errors occurred during translation updates: ${translationErrors.join('; ')}`;
        return {
            result: { mainUpdate: mainUpdateResponse?.result, translationResults },
            error: errorMessage
        };
    }

    return {
        result: { mainUpdate: mainUpdateResponse?.result, translationResults },
        error: null
    };
}; // End of updateDatasource function

// Function to delete a datasource
export const deleteDatasource = async (datasourceId) => {
    if (!datasourceId) {
        return { error: "Invalid datasource ID for deleteDatasource" };
    }

    const result = await executeQuery('datasources', 'delete', { datasourceId });
    invalidate("app:datasources");
    return result;
};
