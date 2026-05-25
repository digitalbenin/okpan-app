import { browser } from '$app/environment';
import { getOntologyFields } from '$lib/api/OntologyFieldsApi.js';

/** @type {import('./$types').PageLoad} */
export async function load({ params, depends, parent }) {
    if (!browser) return

    depends("app:ontology_fields");

    const ontologyFieldsResponse = await getOntologyFields(params.project_id);

    return {
        ontologyFields: ontologyFieldsResponse.result || []
    };
}