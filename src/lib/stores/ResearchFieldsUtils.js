import { executeQuery } from "$lib/stores/GraphqlUtils.js";
import { invalidate } from "$app/navigation";
import { getContentLanguageStore } from "./ContentLanguageStore.svelte.js";
// Note: Replace 'researchFields', 'list', 'getById', etc., with your actual GraphQL section and operation names.

// Fetch all research fields for a specific project
export const getResearchFields = async (projectId, page, pageSize) => {
    // Assuming 'research_fields' is the section and 'list' is the operation
    const params = {
        projectId,
        include_vocabularies: true // Add parameter to include vocabularies
    };
    if (page !== undefined) params.page = page;
    if (pageSize !== undefined) params.pageSize = pageSize;
    const response = await executeQuery('research_fields', 'list', params);
    return response; // Or response.result depending on executeQuery's return structure
};

// Get a single research field by ID
export const getResearchFieldById = async (fieldId) => {
    if (!fieldId) {
        return { result: null, error: "Missing fieldId" };
    }

    // Assuming 'research_fields' is the section and 'getById' is the operation
    const response = await executeQuery('research_fields', 'getById', {
        fieldId,
        include_vocabularies: true // Add parameter to include vocabularies
    });

    if (!response) {
        return { result: null, error: "Failed to fetch research field: No response" };
    }
    if (response.error) {
        return { result: null, error: response.error?.message || response.error || "Failed to fetch research field: GraphQL error" };
    }

    const researchFieldsResult = response.research_fields;

    if (!researchFieldsResult || !Array.isArray(researchFieldsResult)) {
        return { result: null, error: "Failed to fetch research field: Invalid result structure" };
    }

    // Return the expected structure { result: [...], error: null }
    return { result: researchFieldsResult, error: null };
};

// Create a new research field (initial implementation, may need translation handling)
export const createResearchField = async (fieldData) => {
    // TODO: Handle initial text/translation creation if needed upon creation
    // Assuming 'research_fields' is the section and 'create' is the operation
    const result = await executeQuery('research_fields', 'create', fieldData);
    invalidate("app:research_fields");
    return result;
};

// Update a research field, including translations orchestration
export const updateResearchField = async (fieldId, updateData) => {
    if (!fieldId) {
        return { result: null, error: "Missing Research Field ID" };
    }

    // 1. Prepare and execute the main update (non-translatable type + default text)
    const mainUpdateVariables = {
        fieldId: fieldId,
        type: updateData.type,
        name: updateData.name, // Default language name
        description: updateData.description // Default language description
    };
    Object.keys(mainUpdateVariables).forEach(key =>
        (mainUpdateVariables[key] === undefined || mainUpdateVariables[key] === null) && delete mainUpdateVariables[key]
    );

    const mainUpdateResponse = await executeQuery('research_fields', 'update', mainUpdateVariables);

    if (!mainUpdateResponse || mainUpdateResponse.error) {
        const errorMessage = mainUpdateResponse?.error?.message || (Array.isArray(mainUpdateResponse?.error) ? mainUpdateResponse.error[0]?.message : mainUpdateResponse?.error) || "Unknown error during main update";
        return { result: null, error: errorMessage };
    }

    // 2. Process translations using ContentLanguageStore functions (same as institutions/projects/datasources)
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
                    // Create new translation using language code (same as institutions/projects/datasources)
                    const result = await addTranslation(textId, language_code, content);
                    translationResults[fieldName].push(result);
                }
            } catch (err) {
                translationErrors.push(`Failed to process ${fieldName} translation for language ${language_code}: ${err.message}`);
            }
        }
    };

    await Promise.all([
        processTranslations(updateData.nameTranslations, updateData.original_name_id, 'name'),
        processTranslations(updateData.descriptionTranslations, updateData.original_description_id, 'description')
    ]);

    // 3. Final Result Aggregation
    if (translationErrors.length > 0) {
        const errorMessage = `Main data saved, but errors occurred during translation updates: ${translationErrors.join('; ')}`;
        return {
            result: { mainUpdate: mainUpdateResponse?.result, translationResults },
            error: errorMessage
        };
    }
    invalidate("app:research-fields");

    return {
        result: { mainUpdate: mainUpdateResponse?.result, translationResults },
        error: null
    };
};

// Delete a research field
export const deleteResearchField = async (fieldId) => {
    // TODO: Consider cascading deletes for related texts/translations if necessary
    // Assuming 'research_fields' is the section and 'delete' is the operation
    const result = await executeQuery('research_fields', 'delete', { fieldId });
    invalidate("app:research-fields");
    return result;
}; 