import { executeQuery, partialUpdate } from "$lib/stores/GraphqlUtils.js";

// Fetch all data sources for a specific institution within a project
export const getDatasources = async (projectId, institutionId, fetchFn) => {
    if (!projectId || !institutionId) {
        console.error("Project ID and Institution ID are required to fetch data sources.");
        return { result: [], error: "Missing IDs" }; // Return error structure
    }

    // The GraphQL query 'ListDatasources' only expects institutionId as a String.
    const params = {
        institutionId: institutionId, // Pass as string, remove Number()
        // projectId is not needed for this specific query based on the logs
    };

    // Use executeQuery, similar to InstitutionsUtils.js
    // Assuming section 'datasources' and operation 'list'
    const response = await executeQuery('datasources', 'list', params, fetchFn);

    // Check if executeQuery returned a valid response object
    if (!response) {
        console.error("executeQuery did not return a valid response for datasources.");
        return { result: [], error: "Internal error fetching datasources" };
    }

    // Check for errors in the response handled by executeQuery
    if (response.error) {
        console.error("Error fetching data sources via executeQuery:", response.error);
        return { result: [], error: response.error }; // Propagate error
    }

    console.log("Fetched datasources:", response.result);
    // Ensure we return an array, even if result is null/undefined
    return { result: response.result || [], error: null };
};

// Get a single datasource by ID
export const getDatasource = async (datasourceId, fetchFn) => {
    if (!datasourceId) {
        console.error("Datasource ID is required.");
        return { result: null, error: "Missing Datasource ID" };
    }
    const variables = { datasourceId };
    // Assuming 'getById' is the correct operation name in datasources.js
    const response = await executeQuery('datasources', 'getById', variables, fetchFn);

    if (!response || response.error || !response.result) { // Check if result exists
        console.error("Error fetching datasource:", response?.error);
        return { result: null, error: response?.error || "Failed to fetch datasource" };
    }
    console.log("Fetched single datasource:", response.result);
    // The query definition nests result under 'result', so return that
    return { result: response.result, error: null };
};

// Function to update a datasource, including translations orchestration
export const updateDatasource = async (datasourceId, updatedData, fetchFn) => {
    if (!datasourceId) {
        console.error("Datasource ID is required to update.");
        return { result: null, error: "Missing Datasource ID" };
    }

    // 1. Prepare and execute the main update (default text + direct fields)
    const mainUpdateVariables = {
        datasourceId: datasourceId,
        language: updatedData.language,
        contact: updatedData.contact,
        copyright: updatedData.copyright,
        date: updatedData.date, // Already ISO string or null from Detail component
        name: updatedData.name,
        method: updatedData.method,
        notes: updatedData.notes
    };
    // Remove null/undefined fields before sending
    Object.keys(mainUpdateVariables).forEach(key =>
        (mainUpdateVariables[key] === undefined || mainUpdateVariables[key] === null) && delete mainUpdateVariables[key]
    );

    console.log("Attempting main update for datasource:", datasourceId, "with variables:", mainUpdateVariables);
    const mainUpdateResponse = await executeQuery('datasources', 'update', mainUpdateVariables, fetchFn);
    console.log("Raw response from executeQuery('datasources', 'update'):", mainUpdateResponse);

    if (!mainUpdateResponse || mainUpdateResponse.error) {
        console.error("Main datasource update failed:", mainUpdateResponse?.error);
        const errorMessage = mainUpdateResponse?.error?.message || (Array.isArray(mainUpdateResponse?.error) ? mainUpdateResponse.error[0]?.message : mainUpdateResponse?.error);
        return { result: null, error: errorMessage || "Unknown error during main update" };
    }

    console.log("Main datasource update part successful. Proceeding with translations...");

    // 2. Orchestrate Translation Updates/Creations
    const translationErrors = [];
    const translationResults = {};

    // Helper function to process one type of translation (name, method, notes)
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

    // Process translations for name, method, and notes concurrently
    await Promise.all([
        processTranslations(updatedData.nameTranslations, updatedData.original_name_id, 'name'),
        processTranslations(updatedData.methodTranslations, updatedData.original_method_id, 'method'),
        processTranslations(updatedData.notesTranslations, updatedData.original_notes_id, 'notes')
    ]);

    // 3. Final Result Aggregation
    if (translationErrors.length > 0) {
        const errorMessage = `Main data saved, but errors occurred during translation updates: ${translationErrors.join('; ')}`;
        console.error("Datasource update partially failed:", errorMessage);
        // Return partial success data along with the error message
        return {
            result: { mainUpdate: mainUpdateResponse?.result, translationResults },
            error: errorMessage
        };
    }

    console.log("Datasource and all associated translations updated successfully.");
    // Return full success data
    return {
        result: { mainUpdate: mainUpdateResponse?.result, translationResults },
        error: null
    };

}; // End of updateDatasource function
