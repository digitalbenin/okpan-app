import { executeQuery } from "$lib/stores/GraphqlUtils.js";

// Note: Replace 'researchFields', 'list', 'getById', etc., with your actual GraphQL section and operation names.

// Fetch all research fields for a specific project
export const getResearchFields = async (projectId, page, pageSize, fetchFn) => {
    // Assuming 'research_fields' is the section and 'list' is the operation
    const params = {
        projectId,
        include_vocabularies: true // Add parameter to include vocabularies
    };
    if (page !== undefined) params.page = page;
    if (pageSize !== undefined) params.pageSize = pageSize;
    const response = await executeQuery('research_fields', 'list', params, fetchFn);
    return response; // Or response.result depending on executeQuery's return structure
};

// Get a single research field by ID
export const getResearchFieldById = async (fieldId, fetchFn) => {
    if (!fieldId) {
        console.error("getResearchFieldById called without fieldId.");
        return { result: null, error: "Missing fieldId" };
    }
    console.log(`Refetching research field with ID: ${fieldId}`);

    // Assuming 'research_fields' is the section and 'getById' is the operation
    const response = await executeQuery('research_fields', 'getById', {
        fieldId,
        include_vocabularies: true // Add parameter to include vocabularies
    }, fetchFn);
    console.log("Raw response from getById executeQuery:", response);

    // Check response existence
    if (!response) {
        console.error("Error fetching research field: executeQuery returned null/undefined.");
        return { result: null, error: "Failed to fetch research field: No response" };
    }
    // Check for GraphQL errors (assuming executeQuery might place them in response.error)
    if (response.error) {
        console.error("Error fetching research field (GraphQL error):", response.error);
        return { result: null, error: response.error?.message || response.error || "Failed to fetch research field: GraphQL error" };
    }

    // --- Updated Check: Expect response.research_fields --- 
    const researchFieldsResult = response.research_fields;

    if (!researchFieldsResult || !Array.isArray(researchFieldsResult)) {
        console.error("Error fetching research field: Invalid result structure (expected research_fields array).", researchFieldsResult);
        return { result: null, error: "Failed to fetch research field: Invalid result structure" };
    }
    // --- End Updated Check ---

    console.log("Fetched single research field successfully:", researchFieldsResult);
    // Return the expected structure { result: [...], error: null }
    return { result: researchFieldsResult, error: null };
};

// Create a new research field (initial implementation, may need translation handling)
export const createResearchField = async (fieldData, fetchFn) => {
    // TODO: Handle initial text/translation creation if needed upon creation
    // Assuming 'research_fields' is the section and 'create' is the operation
    const result = await executeQuery('research_fields', 'create', fieldData, fetchFn);
    return result;
};

// Update a research field, including translations orchestration
export const updateResearchField = async (fieldId, updateData, fetchFn) => {
    if (!fieldId) {
        console.error("Research Field ID is required to update.");
        return { result: null, error: "Missing Research Field ID" };
    }

    // 1. Prepare and execute the main update (non-translatable type + default text)
    const mainUpdateVariables = {
        fieldId: fieldId,
        type: updateData.type,
        name: updateData.name, // Default language name
        description: updateData.description // Default language description
    };
    // Remove null/undefined fields before sending
    Object.keys(mainUpdateVariables).forEach(key =>
        (mainUpdateVariables[key] === undefined || mainUpdateVariables[key] === null) && delete mainUpdateVariables[key]
    );

    console.log("Attempting main update for research field:", fieldId, "with variables:", mainUpdateVariables);
    const mainUpdateResponse = await executeQuery('research_fields', 'update', mainUpdateVariables, fetchFn);
    console.log("Raw response from executeQuery('research_fields', 'update'):", mainUpdateResponse);

    if (!mainUpdateResponse || mainUpdateResponse.error) {
        console.error("Main research field update failed:", mainUpdateResponse?.error);
        const errorMessage = mainUpdateResponse?.error?.message || (Array.isArray(mainUpdateResponse?.error) ? mainUpdateResponse.error[0]?.message : mainUpdateResponse?.error);
        return { result: null, error: errorMessage || "Unknown error during main update" };
    }

    console.log("Main research field update part successful. Proceeding with translations...");

    // 2. Orchestrate Translation Updates/Creations
    const translationErrors = [];
    const translationResults = {};

    // Helper function to process one type of translation (name, description)
    const processTranslations = async (translationsArray, textId, fieldName) => {
        if (!textId || !translationsArray || translationsArray.length === 0) {
            console.log(`No ${fieldName} translations to process or missing textId (${textId}).`);
            return; // Skip if no ID or no translations for this field
        }
        translationResults[fieldName] = [];

        for (const trans of translationsArray) {
            const { id: originalTranslationId, language_code, content } = trans;
            let operation = null;
            let variables = {};

            if (originalTranslationId) {
                // Existing translation -> Update
                operation = 'update';
                variables = { id: originalTranslationId, content: content || "" }; // Ensure content is not null/undefined
            } else if (content) { // Only create if there's content
                // New translation -> Create
                operation = 'create';
                variables = {
                    textId: textId, // ID of the related text record (e.g., name_id)
                    languageCode: language_code,
                    content: content
                };
            } else {
                // No ID and no content -> Skip (or potentially delete if ID exists? TBD)
                console.log(`Skipping translation for ${fieldName} (${language_code}) due to empty content and no ID.`);
                continue;
            }

            try {
                console.log(`Executing translations.${operation} for ${fieldName} (${language_code}) with vars:`, variables);
                const transResponse = await executeQuery('translations', operation, variables, fetchFn);
                console.log(`Raw response from translations.${operation} for ${fieldName} (${language_code}):`, transResponse);

                if (!transResponse || transResponse.error) {
                    throw new Error(JSON.stringify(transResponse?.error || `Failed to ${operation} ${fieldName} translation for ${language_code}`));
                }
                translationResults[fieldName].push(transResponse.result); // Store result

            } catch (err) {
                console.error(`Error during translations.${operation} for ${fieldName} (${language_code}):`, err);
                translationErrors.push(`Failed to ${operation} ${fieldName} for ${language_code}: ${err.message}`);
            }
        } // End of for...of loop
    }; // End of processTranslations function

    // Process translations for name and description concurrently
    // Pass the original text IDs from the updateData payload
    await Promise.all([
        processTranslations(updateData.nameTranslations, updateData.original_name_id, 'name'),
        processTranslations(updateData.descriptionTranslations, updateData.original_description_id, 'description')
    ]);

    // 3. Final Result Aggregation
    if (translationErrors.length > 0) {
        const errorMessage = `Main data saved, but errors occurred during translation updates: ${translationErrors.join('; ')}`;
        console.error("Research field update partially failed:", errorMessage);
        // Return partial success data along with the error message
        return {
            result: { mainUpdate: mainUpdateResponse?.result, translationResults },
            error: errorMessage
        };
    }

    console.log("Research field and all associated translations updated successfully.");
    // Return full success data
    return {
        result: { mainUpdate: mainUpdateResponse?.result, translationResults },
        error: null
    };
};

// Delete a research field
export const deleteResearchField = async (fieldId, fetchFn) => {
    // TODO: Consider cascading deletes for related texts/translations if necessary
    // Assuming 'research_fields' is the section and 'delete' is the operation
    const result = await executeQuery('research_fields', 'delete', { fieldId }, fetchFn);
    return result;
}; 