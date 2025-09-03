import { executeQuery } from "$lib/stores/GraphqlUtils.js";
import { invalidate } from "$app/navigation";
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
    return { result: researchFieldsResult[0], error: null };
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

    // Prepare all parameters for the multi-step mutation
    const updateParams = {
        fieldId: fieldId,
        // Direct fields
        type: updateData.type,
        // Text content for default language
        name: updateData.name,
        description: updateData.description,
        // Translation arrays
        nameTranslations: updateData.nameTranslations,
        descriptionTranslations: updateData.descriptionTranslations
    };

    // Remove undefined values to prevent GraphQL errors
    Object.keys(updateParams).forEach(key =>
        (updateParams[key] === undefined || updateParams[key] === null) && delete updateParams[key]
    );



    try {
        // Execute the multi-step mutation that includes translation processing
        const result = await executeQuery('research_fields', 'update', updateParams);



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
        if (result.processDescriptionTranslations?.errors) {
            translationErrors.push(...result.processDescriptionTranslations.errors);
        }

        invalidate("app:research-fields");

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
        console.error('Error during research field update:', error);
        return { result: null, error: error.message };
    }
};

// Delete a research field
export const deleteResearchField = async (fieldId) => {
    const result = await executeQuery('research_fields', 'delete', { fieldId });
    invalidate("app:research-fields");
    return result;
};

// Function to update a vocabulary, including translations orchestration
export const updateVocabulary = async (vocabularyId, updatedData) => {
    if (!vocabularyId) {
        return { result: null, error: "Missing Vocabulary ID" };
    }



    // Prepare all parameters for the multi-step mutation
    const updateParams = {
        vocabularyId: vocabularyId,
        // Text content for default language
        option: updatedData.option,
        description: updatedData.description,
        // Asset fields
        mainAsset: updatedData.mainAsset,
        otherAssets: updatedData.otherAssets,
        // Translation arrays
        optionTranslations: updatedData.optionTranslations,
        descriptionTranslations: updatedData.descriptionTranslations
    };

    // Remove undefined values to prevent GraphQL errors
    Object.keys(updateParams).forEach(key => {
        if (updateParams[key] === undefined) {
            delete updateParams[key];
        }
    });

    console.log('updateVocabulary: Sending parameters:', updateParams);
    console.log('updateVocabulary: mainAsset value:', updateParams.mainAsset);

    // Execute the multi-step mutation
    const result = await executeQuery('research_fields', 'updateVocabulary', updateParams);

    if (result.error) {
        console.error('Vocabulary update error:', result.error);
        return { result: null, error: result.error };
    }


    invalidate("app:research-fields");
    return { result: result.result, error: null };
};

// Create a vocabulary for a research field (supports translations on create)
export const addVocabulary = async (fieldId, data) => {
    if (!fieldId) {
        return { result: null, error: "Missing Research Field ID" };
    }

    const params = {
        fieldId,
        languageId: data.languageId,
        option: data.option,
        description: data.description,
        // Optional translation arrays on creation
        optionTranslations: data.optionTranslations,
        descriptionTranslations: data.descriptionTranslations,
        // Optional assets if ever used in the future
        mainAsset: data.mainAsset,
        otherAssets: data.otherAssets
    };

    // Prune undefined to avoid GraphQL variable issues
    Object.keys(params).forEach((k) => params[k] === undefined && delete params[k]);

    console.log("addVocabulary: Calling executeQuery with params:", params);
    const result = await executeQuery('research_fields', 'addVocabulary', params);
    console.log("addVocabulary: executeQuery result:", result);

    if (result?.error) {
        console.error("addVocabulary: Error from executeQuery:", result.error);
        return { result: null, error: result.error };
    }
    invalidate("app:research-fields");
    return { result, error: null };
};

// Delete a vocabulary by ID
export const deleteVocabulary = async (vocabularyId) => {
    if (!vocabularyId) {
        return { result: null, error: "Missing Vocabulary ID" };
    }
    const result = await executeQuery('research_fields', 'deleteVocabulary', { vocabularyId });
    if (result?.error) {
        return { result: null, error: result.error };
    }
    invalidate("app:research-fields");
    return { result, error: null };
};