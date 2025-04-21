import { browser } from '$app/environment';
import { getResearchFields } from '$lib/stores/ResearchFieldsUtils.js';
import { getOntologyFields } from '$lib/stores/OntologyFieldsUtils.js';
import { getContentLanguageStore } from "$lib/stores/ContentLanguageStore.svelte.js";

/** @type {import('./$types').PageLoad} */
export async function load({ params, fetch }) {
    if (!browser) return {}; // Return empty object on server, client-side fetch will populate

    const projectId = params.project_id;

    console.log(`Loading data for @data-structure in project ${projectId}...`);

    const { getAvaliableLocalesForProject } = getContentLanguageStore();

    // Fetch data in parallel
    const [researchFieldsResponse, ontologyFieldsResponse, projectLanguages] = await Promise.all([
        getResearchFields(projectId, undefined, undefined), // Fetch all research fields for the project
        getOntologyFields(undefined, undefined), // Fetch all ontology fields (no project ID needed based on query file)
        getAvaliableLocalesForProject(projectId) // Added fetch for languages
    ]);

    // Extract results directly from the properties of the returned data object
    // (executeQuery returns the 'data' object from the GraphQL response)
    const researchFields = researchFieldsResponse?.result || [];
    const ontologyFields = ontologyFieldsResponse?.result || [];

    // Error handling might need adjustment depending on how performQuery surfaces errors
    // Currently, performQuery throws errors, so they would be caught by SvelteKit's error handling
    // or could be caught with a try...catch block here if needed.
    // The previous error checks based on 'researchFieldsResponse.error' are removed as 'error' isn't a property.
    /*
    if (researchFieldsResponse?.error) { // This check is likely incorrect now
        console.error("Error fetching research fields:", researchFieldsResponse.error);
    }
    if (ontologyFieldsResponse?.error) { // This check is likely incorrect now
        console.error("Error fetching ontology fields:", ontologyFieldsResponse.error);
    }
    */

    console.log("Fetched research fields:", researchFields);
    console.log("Fetched ontology fields:", ontologyFields);
    console.log("Fetched project languages:", projectLanguages);

    return {
        researchFields,
        ontologyFields,
        projectLanguages,
        projectId // Pass projectId for context if needed
    };
} 