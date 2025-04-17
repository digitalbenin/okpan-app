import { executeQuery } from "$lib/stores/GraphqlUtils.js";

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

// TODO: Add functions for creating, updating, deleting datasources using executeQuery or partialUpdate 