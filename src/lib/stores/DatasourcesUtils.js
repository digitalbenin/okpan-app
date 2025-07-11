import { executeQuery, partialUpdate } from "$lib/stores/GraphqlUtils.js";
import { invalidate } from "$app/navigation";
import { getContentLanguageStore } from "$lib/stores/ContentLanguageStore.svelte.js";

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

    console.log('=== DATASOURCE MAIN UPDATE ===');
    console.log('Main update variables:', JSON.stringify(mainUpdateVariables, null, 2));

    const mainUpdateResponse = await executeQuery('datasources', 'update', mainUpdateVariables);

    console.log('Main update response:', JSON.stringify(mainUpdateResponse, null, 2));

    if (!mainUpdateResponse || mainUpdateResponse.error) {
        const errorMessage = mainUpdateResponse?.error?.message || (Array.isArray(mainUpdateResponse?.error) ? mainUpdateResponse.error[0]?.message : mainUpdateResponse?.error);
        console.error('Main update failed:', errorMessage);
        return { result: null, error: errorMessage || "Unknown error during main update" };
    }

    // 2. Process translations using ContentLanguageStore functions (same as institutions/projects)
    const translationErrors = [];
    const translationResults = {};

    const { addTranslation, updateTranslation } = getContentLanguageStore();

    const processTranslations = async (translationsArray, textId, fieldName) => {
        if (!textId || !translationsArray || translationsArray.length === 0) {
            return;
        }
        translationResults[fieldName] = [];

        for (const trans of translationsArray) {
            const { id: originalTranslationId, language_code, content } = trans;

            try {
                if (originalTranslationId) {
                    // Update existing translation
                    const result = await updateTranslation(originalTranslationId, content);
                    translationResults[fieldName].push(result);
                } else if (content && language_code) {
                    // Create new translation using language code (same as institutions/projects)
                    const result = await addTranslation(textId, language_code, content);
                    translationResults[fieldName].push(result);
                }
            } catch (err) {
                translationErrors.push(`Failed to process ${fieldName} translation for language ${language_code}: ${err.message}`);
            }
        }
    };

    await Promise.all([
        processTranslations(updatedData.nameTranslations, updatedData.original_name_id, 'name'),
        processTranslations(updatedData.methodTranslations, updatedData.original_method_id, 'method'),
        processTranslations(updatedData.notesTranslations, updatedData.original_notes_id, 'notes')
    ]);

    // 3. Final Result Aggregation
    if (translationErrors.length > 0) {
        const errorMessage = `Main data saved, but errors occurred during translation updates: ${translationErrors.join('; ')}`;
        console.warn(errorMessage);
        return {
            result: { mainUpdate: mainUpdateResponse?.result, translationResults },
            error: errorMessage
        };
    }

    invalidate("app:datasources");
    return {
        result: { mainUpdate: mainUpdateResponse?.result, translationResults },
        error: null
    };
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
