import { executeQuery } from "$lib/stores/GraphqlUtils.js";
import { invalidate } from "$app/navigation";
import { searchObjects } from "$lib/stores/ObjectsUtils.js";
import { isElectronApiAvailable } from "$lib/utils/electronApi.js";
// Note: Replace 'researchFields', 'list', 'getById', etc., with your actual GraphQL section and operation names.

// Fetch objects linked to a specific connection option (vocabulary) for a research field
export async function fetchLinkedObjectsByVocabularyOption({
    projectId,
    fieldId,
    vocabularyId,
    page = 1,
    pageSize = 24,
}) {
    if (!projectId || !fieldId || !vocabularyId) {
        return { items: [], totalCount: 0 };
    }

    // Avoid triggering GraphQL/toasts when not running in Electron.
    if (!isElectronApiAvailable()) {
        return { items: [], totalCount: 0 };
    }

    const linkedRes = await searchObjects({
        projectId,
        researchFieldFilters: [
            {
                fieldId,
                vocabularyIds: [vocabularyId],
            },
        ],
        page: page - 1, // backend is 0-based
        pageSize,
        orderBy: "updated_at",
        direction: "desc",
    });

    return {
        items: linkedRes?.items || [],
        totalCount: linkedRes?.totalCount || 0,
    };
}

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

export const getVocabularyById = async (vocabularyId) => {
    if (!vocabularyId) {
        return { result: null, error: "Missing vocabularyId" };
    }

    const response = await executeQuery('research_fields', 'getVocabularyById', {
        vocabularyId,
    });

    if (!response) {
        return { result: null, error: "Failed to fetch vocabulary: No response" };
    }
    if (response.error) {
        return { result: null, error: response.error?.message || response.error || "Failed to fetch vocabulary: GraphQL error" };
    }

    const vocabulariesResult = response.vocabularies;

    if (!vocabulariesResult || !Array.isArray(vocabulariesResult)) {
        return { result: null, error: "Failed to fetch vocabulary: Invalid result structure" };
    }

    return { result: vocabulariesResult[0], error: null };
};

// Create a new research field (initial implementation, may need translation handling)
export const createResearchField = async (fieldData) => {
    // Set default values for new boolean fields if not provided
    const params = {
        ...fieldData,
        fieldsConfig: fieldData.fieldsConfig || fieldData.fields_config,
        private: fieldData.private !== undefined ? (fieldData.private ? 1 : 0) : 0, // default false
        onwebsite: fieldData.onwebsite !== undefined ? (fieldData.onwebsite ? 1 : 0) : 1 // default true
    };

    // TODO: Handle initial text/translation creation if needed upon creation
    // Assuming 'research_fields' is the section and 'create' is the operation
    const result = await executeQuery('research_fields', 'create', params);
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
        // Boolean fields (convert to integers for SQLite)
        private: updateData.private !== undefined ? (updateData.private ? 1 : 0) : undefined,
        onwebsite: updateData.onwebsite !== undefined ? (updateData.onwebsite ? 1 : 0) : undefined,
        // Text content for default language
        name: updateData.name,
        description: updateData.description,
        fieldsConfig: updateData.fields_config || updateData.fieldsConfig,
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
    if (!fieldId) {
        return { result: null, error: "Missing Research Field ID" };
    }

    try {
        // Collect all generic asset IDs first, before the cascading deletion wipes the links
        let uniqueGenericAssetIds = [];
        try {
            const vocabRes = await executeQuery('research_fields', 'getVocabulariesByFieldId', { fieldId });
            const vocabularies = vocabRes?.vocabularies || [];

            const genericAssetIds = [];
            for (const vocab of vocabularies) {
                if (vocab.main_asset_id) genericAssetIds.push(vocab.main_asset_id);
                if (vocab.vocabulariesGenericAssets?.length > 0) {
                    for (const vga of vocab.vocabulariesGenericAssets) {
                        if (vga.generic_asset_id) genericAssetIds.push(vga.generic_asset_id);
                    }
                }
            }

            uniqueGenericAssetIds = [...new Set(genericAssetIds)];
        } catch (e) {
            console.error("Failed to gather associated generic assets before research field deletion:", e);
        }

        const result = await executeQuery('research_fields', 'delete', { fieldId });

        if (!result) {
            return { result: null, error: "Failed to delete research field: No response" };
        }
        if (result.error) {
            return { result: null, error: result.error?.message || result.error || "Failed to delete research field: GraphQL error" };
        }

        // Now that the research field (and its vocabularies) are deleted, we can safely delete the generic assets
        // without triggering FOREIGN KEY constraint errors from vocabularies.main_asset_id
        if (uniqueGenericAssetIds.length > 0) {
            try {
                for (const assetId of uniqueGenericAssetIds) {
                    await executeQuery('genericAssets', 'delete', { assetId });
                }
            } catch (e) {
                console.error("Failed to delete orphaned generic assets:", e);
            }
        }

        invalidate("app:research-fields");
        return { result: result, error: null };
    } catch (error) {
        console.error('Error during research field deletion:', error);
        return { result: null, error: error.message };
    }
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
        // External link
        externalLink: updatedData.externalLink,
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

    console.log("[DEBUG] STORE UpdateParams:", JSON.stringify(updateParams));

    // Execute the multi-step mutation
    const result = await executeQuery('research_fields', 'updateVocabulary', updateParams);

    if (result.error) {
        console.error('Vocabulary update error:', result.error);
        return { result: null, error: result.error };
    }


    invalidate("app:research-fields");
    return { result: result.result, error: null };
};

export const updateVocabularyAssets = async (vocabularyId, assetIds) => {
    // 1. Unlink all existing assets
    const deleteResult = await executeQuery('vocabulary_assets', 'delete', { vocabularyId });
    if (deleteResult.error) return { error: deleteResult.error };

    // 2. Link new assets if any
    if (assetIds && assetIds.length > 0) {
        const values = assetIds.map((assetId, index) => ({
            vocabulary_id: vocabularyId,
            generic_asset_id: assetId,
            order: index
        }));
        
        const insertResult = await executeQuery('vocabulary_assets', 'create', { values });
        if (insertResult.error) return { error: insertResult.error };
        return { result: insertResult.result, error: null };
    }

    return { result: true, error: null };
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
        // External link
        externalLink: data.externalLink,
        // Optional assets if ever used in the future
        mainAsset: data.mainAsset,
        otherAssets: data.otherAssets
    };

    // Prune undefined to avoid GraphQL variable issues
    Object.keys(params).forEach((k) => params[k] === undefined && delete params[k]);

    const result = await executeQuery('research_fields', 'addVocabulary', params);

    if (result?.error) {
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

    // First gather generic assets associated with the vocabulary so we can delete them AFTER
    // the vocabulary is deleted (to avoid FOREIGN KEY constraint failures).
    let uniqueGenericAssetIds = [];
    try {
        const vocabResponse = await executeQuery('research_fields', 'getVocabularyById', { vocabularyId });
        const vocabulary = vocabResponse?.vocabularies?.[0];
        
        if (vocabulary) {
            const genericAssetIds = [];
            
            if (vocabulary.main_asset_id) {
                genericAssetIds.push(vocabulary.main_asset_id);
            }
            
            if (vocabulary.vocabulariesGenericAssets?.length > 0) {
                for (const vga of vocabulary.vocabulariesGenericAssets) {
                    if (vga.generic_asset_id) {
                        genericAssetIds.push(vga.generic_asset_id);
                    }
                }
            }
            
            // Deduplicate ids
            uniqueGenericAssetIds = [...new Set(genericAssetIds)];
        }
    } catch (e) {
        console.error("Failed to gather associated generic assets before vocabulary deletion:", e);
    }

    // Delete the vocabulary itself first (this cascades to vocabularies_generic_assets but leaves genericAssets orphaned)
    const result = await executeQuery('research_fields', 'deleteVocabulary', { vocabularyId });
    if (result?.error) {
        return { result: null, error: result.error };
    }

    // Now safely delete the generic assets from the DB
    if (uniqueGenericAssetIds.length > 0) {
        try {
            for (const assetId of uniqueGenericAssetIds) {
                await executeQuery('genericAssets', 'delete', { assetId });
            }
        } catch (e) {
            console.error("Failed to delete orphaned generic assets after vocabulary deletion:", e);
        }
    }

    invalidate("app:research-fields");
    return { result: result.result || result, error: null };
};

// Count objects that contain values from a specific research field
export const countObjectsUsingResearchField = async (fieldId) => {
    if (!fieldId) {
        return { result: null, error: "Missing Research Field ID" };
    }

    const response = await executeQuery('research_fields', 'countObjects', { fieldId });

    if (!response) {
        return { result: null, error: "Failed to count objects: No response" };
    }
    if (response.error) {
        return { result: null, error: response.error?.message || response.error || "Failed to count objects: GraphQL error" };
    }

    const count = response.result || 0;
    return { result: count, error: null };
};